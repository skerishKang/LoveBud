// Contract test for #4531 - private-storage entitlement rollback semantics guard.
//
// Source/docs/test only: no network, database, provider, Firebase/Firestore,
// Cloudflare, Modal, secret, runtime gate, Product request, or Production
// resource is touched. The Direct-Neon column is obtained by running the pure
// checked-in helper with an injected fake transaction; the retained Modal column
// is pinned from checked-in source plus the preserved #3946 legacy truth test.
//
// Refs: #4531 #4000 #4004 #4422 #4425 #4390

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const CONTRACT_DOC = path.resolve(
  ROOT,
  'docs',
  'architecture',
  'private-storage-entitlement-rollback-contract-4531.md'
);
const MATRIX_JSON = path.resolve(
  ROOT,
  'docs',
  'architecture',
  'direct-neon-readiness-matrix-4311.json'
);
const MATRIX_MD = path.resolve(
  ROOT,
  'docs',
  'architecture',
  'DIRECT_NEON_READINESS_MATRIX_4311.md'
);
const NEON_HELPER = path.resolve(
  ROOT,
  'functions',
  '_shared',
  'private-storage-entitlement-neon.js'
);
const MODAL_AUTH = path.resolve(ROOT, 'modal_compute', 'auth.py');
const LEGACY_MODAL_TEST = path.resolve(
  ROOT,
  'tests',
  'contracts',
  'test_entitlement_check_outage_3946.py'
);
const BACKEND_DOC = path.resolve(ROOT, 'docs', 'backend', 'backend.md');
const API_CONTRACT_DOC = path.resolve(ROOT, 'docs', 'engineering', 'API_CONTRACT.md');

const NEON_MODULE = '../../functions/_shared/private-storage-entitlement-neon.js';

const CONTRACT_REL = 'docs/architecture/private-storage-entitlement-rollback-contract-4531.md';

// The four private entitlement-dependent routes: each evaluates the
// private-storage entitlement guard and falls back to the retained Modal path
// when its runtime gate is removed or unset.
const PRIVATE_ROLLBACK_ROWS = Object.freeze([
  { id: 'tree-private-create', gate: 'LB_TREE_PRIVATE_CREATE_WRITE_RUNTIME' },
  { id: 'tree-private-visibility-update', gate: 'LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME' },
  { id: 'memory-private-create', gate: 'LB_MEMORY_PRIVATE_CREATE_WRITE_RUNTIME' },
  { id: 'memory-private-visibility-update', gate: 'LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME' },
]);

// Smallest guard vocabulary that fits the existing matrix field structure. It is
// appended to the existing per-route rollback_authority string; no new
// repository-wide enum or classification block is introduced.
const GUARD_MARKERS = Object.freeze([
  'TECHNICAL_GATE_ROLLBACK_AVAILABLE=YES',
  'BUSINESS_SEMANTICS_PRESERVING_ROLLBACK=NO',
  'BUSINESS_SEMANTICS_EQUIVALENCE=NOT_PROVEN',
  'ENTITLEMENT_PARITY_STATUS=NOT_PROVEN_DIVERGENT_BY_SOURCE',
  'CENTRAL_REVIEW_REQUIRED_BEFORE_PRIVATE_ROLLBACK=YES',
]);

const GUARD_GUARD_TOKEN = 'ROLLBACK SEMANTICS GUARD';

function read(absolutePath) {
  return fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
}

const CONTRACT_TEXT = read(CONTRACT_DOC);
const MATRIX_TEXT = read(MATRIX_JSON);
const MATRIX_DOC_TEXT = read(MATRIX_MD);
const NEON_TEXT = read(NEON_HELPER);
const MODAL_AUTH_TEXT = read(MODAL_AUTH);
const LEGACY_MODAL_TEST_TEXT = read(LEGACY_MODAL_TEST);
const MATRIX = JSON.parse(MATRIX_TEXT);

function matrixRow(id) {
  const row = MATRIX.routes.find((r) => r.id === id);
  assert.ok(row, `matrix row ${id} must exist`);
  return row;
}

/**
 * Faults for one route's rollback guidance. A bare `GATE_ONLY_ROLLBACK` with no
 * business-semantics caveat is a failure, because gate removal for a private
 * entitlement-dependent route is a routing change only.
 */
function rollbackGuardFaults(rollbackText, contractText) {
  const text = String(rollbackText || '');
  const faults = [];
  if (!text.includes(GUARD_GUARD_TOKEN)) faults.push('MISSING_ROLLBACK_SEMANTICS_GUARD');
  for (const marker of GUARD_MARKERS) {
    if (!text.includes(marker)) faults.push(`MISSING_MARKER:${marker}`);
  }
  if (!text.includes(CONTRACT_REL)) faults.push('MISSING_CONTRACT_REFERENCE');
  if (
    /GATE_ONLY_ROLLBACK/.test(text) &&
    !/BUSINESS_SEMANTICS_EQUIVALENCE=NOT_PROVEN/.test(text)
  ) {
    faults.push('GATE_ONLY_ROLLBACK_WITHOUT_SEMANTICS_CAVEAT');
  }
  if (/BUSINESS_SEMANTICS_PRESERVING_ROLLBACK\s*=\s*YES/.test(text)) {
    faults.push('CONTRADICTORY_SEMANTICS_PRESERVING_CLAIM');
  }
  if (/BUSINESS_SEMANTICS_EQUIVALENCE\s*=\s*(PROVEN|EQUIVALENT|YES)/.test(text)) {
    faults.push('CONTRADICTORY_SEMANTICS_EQUIVALENCE_CLAIM');
  }
  // The guard may not be asserted anywhere without its own authority doc.
  if (text.includes(GUARD_GUARD_TOKEN) && !/authority|authorit/i.test(contractText)) {
    faults.push('GUARD_WITHOUT_AUTHORITY_DOC');
  }
  return faults;
}

// Cases whose outcome must differ between the canonical Direct-Neon rule and the
// retained Modal legacy rule.
const WIDEN_WITNESS = Object.freeze({
  label: 'Neon private_storage_enabled=false + Firestore plan=plus',
  direct: Object.freeze([{ private_storage_enabled: false }]),
  directOutcome: 'DENY',
  modalOutcome: 'ALLOW',
  legacyPin: 'test_plus_plan_returns_true'
});

const NARROW_WITNESS = Object.freeze({
  label: 'Neon private_storage_enabled=true + Firestore document free/empty',
  direct: Object.freeze([{ private_storage_enabled: true }]),
  directOutcome: 'ALLOW',
  modalOutcome: 'DENY',
  legacyPin: 'test_free_profile_returns_false'
});

describe('#4531 private-storage entitlement rollback contract', () => {
  // -- A. Direct-Neon source authority ----------------------------------------
  describe('A. canonical Direct-Neon entitlement authority', () => {
    it('declares Neon public.users.private_storage_enabled as the strict-true source of truth', () => {
      assert.match(NEON_TEXT, /sourceOfTruth:\s*'neon\.public\.users\.private_storage_enabled'/);
      assert.match(NEON_TEXT, /truthRule:\s*'strict-boolean-true'/);
      assert.match(NEON_TEXT, /defaultEntitled:\s*false/);
      assert.match(NEON_TEXT, /transactionScoped:\s*true/);
      assert.match(NEON_TEXT, /rowLock:\s*'FOR SHARE'/);
      assert.match(NEON_TEXT, /firestoreRequired:\s*false/);
      assert.match(NEON_TEXT, /serviceAccountRequired:\s*false/);
      assert.match(NEON_TEXT, /cache:\s*'none'/);
    });

    it('reads the entitlement row under the caller transaction with a FOR SHARE lock', () => {
      assert.match(NEON_TEXT, /SELECT private_storage_enabled/);
      assert.match(NEON_TEXT, /FROM public\.users/);
      assert.match(NEON_TEXT, /WHERE id = \$1/);
      assert.match(NEON_TEXT, /LIMIT 1/);
      assert.match(NEON_TEXT, /FOR SHARE/);
      // the canonical rule is strict boolean identity, with no truthiness or coercion
      assert.match(NEON_TEXT, /row\?\.private_storage_enabled === true/);
      assert.doesNotMatch(NEON_TEXT, /firestore\.client|\.collection\(|\.document\(/);
    });

    it('fails closed for false/null/missing/malformed rows and reports query failure as unavailable', async () => {
      const mod = await import(NEON_MODULE);
      const denied = [
        [{ private_storage_enabled: false }],
        [{ private_storage_enabled: null }],
        [{ private_storage_enabled: 1 }],
        [{ private_storage_enabled: 'true' }],
        [{}],
        [],
      ];
      for (const rows of denied) {
        const result = await mod.readPrivateStorageEntitlement(
          { query: async () => rows },
          'uid-4531'
        );
        assert.equal(result.entitled, false, JSON.stringify(rows));
      }
      await assert.rejects(
        () =>
          mod.readPrivateStorageEntitlement(
            { query: async () => { throw new Error('unavailable'); } },
            'uid-4531'
          ),
        (error) => error.code === mod.PRIVATE_STORAGE_ENTITLEMENT_ERROR.UNAVAILABLE
      );
    });
  });

  // -- B. Retained Modal legacy divergence ------------------------------------
  describe('B. retained Modal legacy entitlement behavior', () => {
    it('reads Firestore users/{uid} and keeps every legacy allow branch', () => {
      assert.match(MODAL_AUTH_TEXT, /collection\("users"\)\.document\(uid\)\.get\(\)/);
      assert.match(MODAL_AUTH_TEXT, /def user_has_plus_entitlement\(uid: str\) -> bool/);
      assert.match(MODAL_AUTH_TEXT, /def is_entitlement_truthy\(value: Any\) -> bool/);
      assert.match(MODAL_AUTH_TEXT, /profile\.get\("privateStorageEnabled"\)/);
      assert.match(MODAL_AUTH_TEXT, /in \{"plus", "admin"\}/);
      assert.match(MODAL_AUTH_TEXT, /profile\.get\("plus"\)/);
      assert.match(MODAL_AUTH_TEXT, /entitlements\.get\("privateStorage"\)/);
      assert.match(MODAL_AUTH_TEXT, /if not snapshot\.exists:\n\s+return False/);
    });

    it('coerces legacy truthy shapes instead of applying strict boolean identity', () => {
      assert.match(MODAL_AUTH_TEXT, /if value is True:/);
      assert.match(MODAL_AUTH_TEXT, /isinstance\(value, int\) and value == 1/);
      assert.match(MODAL_AUTH_TEXT, /in \{"true", "1"\}/);
    });

    it('keeps availability failure distinct and makes no Neon strict-true equivalence claim', () => {
      assert.match(MODAL_AUTH_TEXT, /raise EntitlementCheckUnavailableError\(\) from error/);
      assert.match(
        MODAL_AUTH_TEXT,
        /if visibility == "private" and not user_has_plus_entitlement\(uid\)/
      );
      // the legacy source must not claim canonical Neon authority or transaction scope
      assert.doesNotMatch(MODAL_AUTH_TEXT, /private_storage_enabled/);
      assert.doesNotMatch(MODAL_AUTH_TEXT, /FOR SHARE/);
      assert.doesNotMatch(MODAL_AUTH_TEXT, /\bneon\b/i);
    });

    it('leaves the preserved #3946 legacy truth test intact as the divergent-behavior evidence', () => {
      assert.match(LEGACY_MODAL_TEST_TEXT, /import modal_compute\.auth as auth/);
      for (const name of [
        'test_missing_profile_returns_false',
        'test_free_profile_returns_false',
        'test_plus_plan_returns_true',
        'test_admin_plan_returns_true',
        'test_private_storage_enabled_returns_true',
        'test_entitlements_private_storage_returns_true',
        'test_public_guard_skips_entitlement_lookup',
      ]) {
        assert.ok(
          LEGACY_MODAL_TEST_TEXT.includes(`def ${name}():`),
          `${name} must remain in the preserved legacy truth test`
        );
        assert.ok(
          LEGACY_MODAL_TEST_TEXT.includes(name),
          `${name} must remain referenced by the runner`
        );
      }
      assert.match(LEGACY_MODAL_TEST_TEXT, /data=\{"plan": "plus"\}/);
      assert.match(LEGACY_MODAL_TEST_TEXT, /data=\{\}/);
      assert.match(
        LEGACY_MODAL_TEST_TEXT,
        /assert user_has_plus_entitlement\("uid-free"\) is False/
      );
    });
  });

  // -- C. Symbolic truth-table mismatch --------------------------------------
  describe('C. symbolic rollback mismatch (no provider calls)', () => {
    it('widen witness: Direct-Neon DENY while the retained Modal path allows', async () => {
      const mod = await import(NEON_MODULE);
      const result = await mod.readPrivateStorageEntitlement(
        { query: async () => [...WIDEN_WITNESS.direct] },
        'uid-4531'
      );
      assert.equal(result.entitled, false, WIDEN_WITNESS.label);
      assert.equal(WIDEN_WITNESS.directOutcome, 'DENY');
      // Modal allows this legacy shape via the plan branch pinned in section B.
      assert.equal(WIDEN_WITNESS.modalOutcome, 'ALLOW');
      assert.ok(
        LEGACY_MODAL_TEST_TEXT.includes(`def ${WIDEN_WITNESS.legacyPin}():`),
        'widen witness must be pinned by the preserved legacy truth test'
      );
      assert.match(CONTRACT_TEXT, /ROLLBACK_CAN_WIDEN_ELIGIBILITY = YES/);
    });

    it('narrow witness: Direct-Neon ALLOW while the retained Modal path denies', async () => {
      const mod = await import(NEON_MODULE);
      const result = await mod.readPrivateStorageEntitlement(
        { query: async () => [...NARROW_WITNESS.direct] },
        'uid-4531'
      );
      assert.equal(result.entitled, true, NARROW_WITNESS.label);
      assert.equal(NARROW_WITNESS.directOutcome, 'ALLOW');
      // Modal denies an existing-but-free Firestore document.
      assert.equal(NARROW_WITNESS.modalOutcome, 'DENY');
      assert.ok(
        LEGACY_MODAL_TEST_TEXT.includes(`def ${NARROW_WITNESS.legacyPin}():`),
        'narrow witness must be pinned by the preserved legacy truth test'
      );
      assert.match(CONTRACT_TEXT, /ROLLBACK_CAN_NARROW_ELIGIBILITY = YES/);
    });

    it('records both mismatch directions in the contract truth table', () => {
      assert.ok(
        CONTRACT_TEXT.includes(
          '| Neon `private_storage_enabled = true`, Firestore document empty/free | ALLOW | DENY |'
        ),
        'narrow truth-table row missing'
      );
      assert.ok(
        CONTRACT_TEXT.includes('| Neon `false`, Firestore `plan = "plus"` | DENY | ALLOW |'),
        'widen truth-table row missing'
      );
      assert.ok(
        CONTRACT_TEXT.includes('| public / non-private request (visibility != private)'),
        'public bypass truth-table row missing'
      );
      assert.ok(
        CONTRACT_TEXT.includes('| Neon entitlement read unavailable (query failure)'),
        'unavailable truth-table row missing'
      );
    });

    it('states every required rollback conclusion', () => {
      for (const marker of [
        'CANONICAL_PRODUCT_ENTITLEMENT_AUTHORITY          = neon.public.users.private_storage_enabled',
        'DIRECT_NEON_RULE                                 = strict boolean true',
        'DIRECT_NEON_TRANSACTION_SCOPED                   = YES',
        'DIRECT_NEON_ROW_LOCK                             = FOR SHARE',
        'MODAL_LEGACY_COMPATIBILITY_RULE                  = FIRESTORE_MULTI_FIELD_LEGACY',
        'DIRECT_NEON_MODAL_ENTITLEMENT_PARITY             = NOT_PROVEN_DIVERGENT_BY_SOURCE',
        'TECHNICAL_GATE_ROLLBACK_AVAILABLE                = YES',
        'BUSINESS_SEMANTICS_PRESERVING_ROLLBACK           = NO',
        'BUSINESS_SEMANTICS_EQUIVALENCE                   = NOT_PROVEN',
        'ENTITLEMENT_PARITY_STATUS                        = NOT_PROVEN_DIVERGENT_BY_SOURCE',
        'CENTRAL_REVIEW_REQUIRED_BEFORE_PRIVATE_ROLLBACK  = YES',
      ]) {
        assert.ok(CONTRACT_TEXT.includes(marker), `contract doc missing: ${marker}`);
      }
    });

    it('does not re-litigate or downgrade historical live evidence', () => {
      assert.match(CONTRACT_TEXT, /PRODUCTION_LIVE\s+retained/);
      assert.match(CONTRACT_TEXT, /LIVE_GATE_VERIFIED\s+retained/);
      for (const row of PRIVATE_ROLLBACK_ROWS) {
        const entry = matrixRow(row.id);
        assert.equal(entry.runtime_gate, row.gate, `${row.id}: gate drift`);
        assert.equal(entry.production_live, 'PRODUCTION_LIVE', `${row.id}: historical live state changed`);
        assert.equal(entry.live_gate_state, 'LIVE_GATE_VERIFIED', `${row.id}: live gate state changed`);
        assert.ok(entry.last_exact_head_evidence.main_sha, `${row.id}: cited evidence SHA removed`);
      }
    });
  });

  // -- D. Every private rollback row carries the caveat ----------------------
  describe('D. all private entitlement-dependent rollback rows are guarded', () => {
    it('guard predicate rejects a bare GATE_ONLY_ROLLBACK and accepts the guarded form', () => {
      const bare =
        'GATE_ONLY_ROLLBACK: reviewed removal/unset of LB_TREE_PRIVATE_CREATE_WRITE_RUNTIME.';
      const faults = rollbackGuardFaults(bare, CONTRACT_TEXT);
      assert.ok(faults.includes('GATE_ONLY_ROLLBACK_WITHOUT_SEMANTICS_CAVEAT'), 'bare gate-only rollback must fail');
      assert.ok(faults.includes('MISSING_ROLLBACK_SEMANTICS_GUARD'), 'bare gate-only rollback must fail');
      assert.ok(faults.includes('MISSING_CONTRACT_REFERENCE'), 'bare gate-only rollback must fail');

      const guarded = `${GUARD_GUARD_TOKEN}: ${GUARD_MARKERS.join('; ')}; ${CONTRACT_REL}`;
      assert.deepEqual(rollbackGuardFaults(guarded, CONTRACT_TEXT), []);
    });

    it('each private matrix row carries the routing-only rollback caveat', () => {
      for (const row of PRIVATE_ROLLBACK_ROWS) {
        const entry = matrixRow(row.id);
        const faults = rollbackGuardFaults(entry.rollback_authority, CONTRACT_TEXT);
        assert.deepEqual(faults, [], `${row.id}: ${faults.join(', ')}`);
        assert.match(entry.rollback_authority, /GATE_ONLY_ROLLBACK/);
      }
    });

    it('each private row in the rendered matrix carries the same caveat', () => {
      for (const row of PRIVATE_ROLLBACK_ROWS) {
        const line = MATRIX_DOC_TEXT.split('\n').find((l) => l.startsWith(`| ${row.id} |`));
        assert.ok(line, `${row.id} must remain rendered in the matrix doc`);
        const faults = rollbackGuardFaults(line, CONTRACT_TEXT);
        assert.deepEqual(faults, [], `${row.id} (rendered): ${faults.join(', ')}`);
      }
    });

    it('the guard is limited to the four private entitlement-dependent rows', () => {
      const guardedIds = MATRIX.routes
        .filter((r) => String(r.rollback_authority).includes(GUARD_GUARD_TOKEN))
        .map((r) => r.id)
        .sort();
      assert.deepEqual(
        guardedIds,
        PRIVATE_ROLLBACK_ROWS.map((r) => r.id).sort(),
        'exactly the four private entitlement-dependent rows carry the rollback guard'
      );
    });
  });

  // -- E. Dangerous wording regression guard ---------------------------------
  describe('E. dangerous rollback wording', () => {
    // Affirmative-claim forms only. Negated guard text ("is not
    // business-semantics-preserving") and historical evidence cannot match, so no
    // broad phrase scan is needed and historical matrix rows stay untouched.
    const FORBIDDEN_CLAIMS = Object.freeze([
      /rollback\s+(?:is|remains|stays)\s+(?:fully\s+)?(?:business[- ]semantics[- ]preserving|semantics[- ]preserving|entitlement[- ]equivalent)/i,
      /gate[- ]only\s+rollback\s+(?:is|remains|stays)\s+semantics[- ]preserving/i,
      /Modal\s+fallback\s+is\s+entitlement[- ]equivalent/i,
      /rollback\s+preserves\s+(?:business\s+)?entitlement\s+semantics/i,
      /DIRECT_NEON_MODAL_ENTITLEMENT_PARITY\s*=\s*PROVEN/i,
      /ENTITLEMENT_PARITY_STATUS\s*=\s*PROVEN/i,
      /BUSINESS_SEMANTICS_PRESERVING_ROLLBACK\s*=\s*YES/i,
      /BUSINESS_SEMANTICS_EQUIVALENCE\s*=\s*(?:PROVEN|EQUIVALENT|YES)/i,
    ]);

    const ACTIVE_SURFACES = Object.freeze([
      ['rollback contract', CONTRACT_TEXT],
      ['readiness matrix json', MATRIX_TEXT],
      ['readiness matrix md', MATRIX_DOC_TEXT],
      ['docs/backend/backend.md', read(BACKEND_DOC)],
      ['docs/engineering/API_CONTRACT.md', read(API_CONTRACT_DOC)],
    ]);

    it('flags synthetic affirmative claims (negative control)', () => {
      const synthetic = [
        'gate-only rollback is semantics-preserving for this route',
        'Modal fallback is entitlement-equivalent to Direct-Neon',
        'rollback preserves entitlement semantics',
        'DIRECT_NEON_MODAL_ENTITLEMENT_PARITY=PROVEN',
        'BUSINESS_SEMANTICS_PRESERVING_ROLLBACK=YES',
        'BUSINESS_SEMANTICS_EQUIVALENCE=PROVEN',
      ];
      for (const text of synthetic) {
        assert.ok(
          FORBIDDEN_CLAIMS.some((re) => re.test(text)),
          `dangerous wording must be flagged: ${text}`
        );
      }
    });

    it('accepts the negated guard wording used by this contract (bounded exclusion)', () => {
      const negated = [
        'unsetting this gate is a routing rollback only and is not business-semantics-preserving',
        'BUSINESS_SEMANTICS_PRESERVING_ROLLBACK=NO',
        'BUSINESS_SEMANTICS_EQUIVALENCE=NOT_PROVEN',
        'DIRECT_NEON_MODAL_ENTITLEMENT_PARITY=NOT_PROVEN_DIVERGENT_BY_SOURCE',
      ];
      for (const text of negated) {
        for (const re of FORBIDDEN_CLAIMS) {
          assert.doesNotMatch(text, re, `guard wording must not self-trigger: ${text}`);
        }
      }
    });

    it('no active guard surface claims rollback is semantics-preserving', () => {
      for (const [label, text] of ACTIVE_SURFACES) {
        for (const re of FORBIDDEN_CLAIMS) {
          assert.doesNotMatch(text, re, `${label}: dangerous rollback wording matched ${re}`);
        }
      }
    });

    it('keeps the contract, docs, and matrix cross-referenced', () => {
      for (const [label, text] of ACTIVE_SURFACES) {
        assert.ok(text.includes(CONTRACT_REL), `${label} must reference ${CONTRACT_REL}`);
      }
      assert.ok(
        CONTRACT_TEXT.includes('docs/architecture/direct-neon-readiness-matrix-4311.json'),
        'contract must bind the matrix json'
      );
      assert.ok(
        CONTRACT_TEXT.includes('tests/contracts/private-storage-entitlement-rollback-parity-4531.test.cjs'),
        'contract must bind this guard test'
      );
    });
  });
});
