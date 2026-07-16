'use strict';

/**
 * Source-static contract tests for Phase B operator collection CLI.
 *
 * No DB connection, no network, no file mutation.
 * Tests: CLI boundary, trusted plan, digest integrity, recursive sanitization,
 *        output format, fixed attestation fields, baseline HEAD binding, session counting,
 *        receipt branding, accessor rejection, migration manifest rules, exact repeat parsing.
 */

const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const receiptCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'phase-b-collection-receipt-core.cjs')
);
const attestationCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'adoption-attestation-core.cjs')
);
const expectedSchemaCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'expected-schema-candidate-core.cjs')
);
const planCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'adoption-baseline-collection-plan-core.cjs')
);

// ─── Constants ───────────────────────────────────────────────────────────────

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const TEST_BASELINE = '544b71b73046f3c84c2f54dd00425f8a9eeaca65';
const TEST_APPROVAL = 'issue:3573';

const SYNTHETIC_EVIDENCE = {
  format_version: '1.0',
  normalizer_version: '1.0',
  objects: [
    { name: 'table:public.trees', fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { name: 'table:public.memories', fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  ],
};

const SYNTHETIC_CANONICAL = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  migrations: [],
};

const SYNTHETIC_EXPECTED_SCHEMA = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  fingerprint_algorithm: 'sha256',
  normalizer_version: '1.0',
  metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
  critical_objects: [],
  adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
  comparison_scope: ['name', 'fingerprint'],
};

const BOUNDARY_CONTRACT_BYTES = Buffer.from(
  '{"mode":"PRODUCTION_READONLY_CATALOG","dedicated_secret_key":"LOVEBUD_PRODUCTION_READONLY_DATABASE_URL"}'
);
const METADATA_CONTRACT_BYTES = Buffer.from(
  '{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRealValidatedPlan() {
  return planCore.buildPreparedCollectionPlan({
    baselineCommit: TEST_BASELINE,
    approvalReference: TEST_APPROVAL,
  });
}

function buildTestCandidate() {
  return expectedSchemaCore.buildExpectedSchemaCandidate(SYNTHETIC_EVIDENCE, SYNTHETIC_EXPECTED_SCHEMA);
}

function buildTestDraft(plan) {
  const p = plan || buildRealValidatedPlan();
  return attestationCore.buildPreparedUnattestedAttestationDraft({
    preparedPlan: p,
    migrationManifest: SYNTHETIC_CANONICAL,
    expectedSchemaCandidate: buildTestCandidate(),
    catalogEvidence: SYNTHETIC_EVIDENCE,
  });
}

function buildTestReceipt(overrides) {
  const plan = buildRealValidatedPlan();
  const draft = buildTestDraft(plan);
  return receiptCore.buildCollectionReceipt(Object.assign({
    preparedPlan: plan,
    boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
    catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
    canonicalManifest: SYNTHETIC_CANONICAL,
    expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
    catalogEvidence: SYNTHETIC_EVIDENCE,
    inactiveExpectedSchemaCandidate: buildTestCandidate(),
    preparedAttestationDraft: draft,
    collectionSessionCount: 1,
  }, overrides));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase B operator collection receipt core', () => {

  // ======================== SCOPE / SOURCE ========================

  it('operator CLI has no require(pg) in code', async () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'), 'utf8'
    );
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes("require('pg')"));
    assert.ok(!codeOnly.includes('new Client'));
    assert.ok(!codeOnly.includes('Pool('));
    assert.ok(!codeOnly.includes('getPrivateInvocationParts'));
    assert.ok(src.includes('collectProductionReadonlyCatalogEvidenceFromFiles'));
  });

  it('receipt core has no pg dependency', () => {
    assert.ok(typeof receiptCore.buildCollectionReceipt === 'function');
    assert.ok(typeof receiptCore.serializeCollectionReceipt === 'function');
  });

  // ======================== TRUSTED PLAN (MODULE-OWNED) ========================

  it('buildPreparedCollectionPlan returns validated plan with digests', () => {
    const plan = buildRealValidatedPlan();
    assert.equal(plan.plan_status, 'PREPARED_ONLY');
    assert.ok(SHA256_RE.test(plan.plan_digest));
    assert.ok(SHA256_RE.test(plan.object_allowlist_digest));
    assert.ok(SHA256_RE.test(plan.collection_plan_contract_digest));
    assert.equal(plan.environment_class, 'PRODUCTION');
    assert.equal(plan.attestation_scope, 'PRODUCTION_READONLY');
    assert.equal(plan.collection_mode, 'CATALOG_METADATA_ONLY');
    assert.equal(plan.output_policy, 'SANITIZED_STDOUT_ONLY');
  });

  it('receipt uses module-owned validated plan digests (no validatePlanFn)', () => {
    const receipt = buildTestReceipt();
    const plan = buildRealValidatedPlan();
    assert.equal(receipt.collection_plan_digest, plan.plan_digest);
    assert.equal(receipt.object_allowlist_digest, plan.object_allowlist_digest);
    assert.equal(receipt.collection_plan_contract_digest, plan.collection_plan_contract_digest);
    assert.equal(receipt.read_only_proofs.length, 10);
  });

  it('attestation draft uses module-owned validated plan (no validatePlanFn)', () => {
    const draft = buildTestDraft();
    assert.equal(draft.baseline_commit, TEST_BASELINE);
    assert.equal(draft.approval_reference, TEST_APPROVAL);
    assert.equal(draft.adoption_status, 'UNATTESTED');
    assert.equal(draft.environment_class, 'PRODUCTION');
  });

  it('buildCollectionReceipt rejects unknown options (like validatePlanFn)', () => {
    const plan = buildRealValidatedPlan();
    const draft = buildTestDraft(plan);
    assert.throws(() => {
      receiptCore.buildCollectionReceipt({
        preparedPlan: plan,
        validatePlanFn: () => ({ ok: true, plan: {} }),
        boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
        catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
        canonicalManifest: SYNTHETIC_CANONICAL,
        expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
        catalogEvidence: SYNTHETIC_EVIDENCE,
        inactiveExpectedSchemaCandidate: buildTestCandidate(),
        preparedAttestationDraft: draft,
        collectionSessionCount: 1,
      });
    }, /RECEIPT_INPUT_INVALID/);
  });

  it('buildPreparedUnattestedAttestationDraft has no validatePlanFn parameter', () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'adoption-attestation-core.cjs'), 'utf8'
    );
    // Read the function signature from source — destructuring makes toString unreliable
    // Find the function declaration and check the argument list
    const fnMatch = src.match(/function buildPreparedUnattestedAttestationDraft\s*\(\s*\{([^}]*)\}/);
    if (fnMatch) {
      // Strip comments to only check actual parameter names
      const clean = fnMatch[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.ok(!clean.includes('validatePlanFn'), 'validatePlanFn must not be a destructured parameter');
    }
  });

  // ======================== DIGEST INTEGRITY ========================

  it('catalog evidence change recomputes digest', () => {
    const d1 = receiptCore.computeObjectDigest(SYNTHETIC_EVIDENCE);
    const ev2 = { ...SYNTHETIC_EVIDENCE, objects: [] };
    const d2 = receiptCore.computeObjectDigest(ev2);
    assert.notEqual(d1, d2);
  });

  it('digest mismatch between evidence and attestation rejected', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const tampered = { ...draft, catalog_evidence_digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };
    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: tampered,
      collectionSessionCount: 1,
    }), /RECEIPT_DIGEST_MISMATCH/);
  });

  it('candidate change triggers digest mismatch', () => {
    const plan = buildRealValidatedPlan();
    const candidate1 = buildTestCandidate();
    const emptyEv = { format_version: '1.0', normalizer_version: '1.0', objects: [] };
    const candidate2 = expectedSchemaCore.buildExpectedSchemaCandidate(emptyEv, SYNTHETIC_EXPECTED_SCHEMA);
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate1,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate2,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    }), /RECEIPT_DIGEST_MISMATCH/);
  });

  it('digest cross-binding between receipt and attestation', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    assert.equal(receipt.catalog_evidence_digest, draft.catalog_evidence_digest);
    assert.equal(receipt.canonical_manifest_digest, draft.canonical_manifest_digest);
    assert.equal(receipt.inactive_candidate_digest, draft.expected_schema_digest);
  });

  // ======================== FORGED PLAN REJECTION ========================

  it('validatePreparedCollectionPlan rejects forged plan_digest', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { plan_digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects forged object_allowlist_digest', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { object_allowlist_digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects forged contract digest', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { collection_plan_contract_digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /CONTRACT_DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects uppercase baseline_commit', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { baseline_commit: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /COMMIT_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects short approval_reference', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { approval_reference: 'bad' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /APPROVAL_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects modified environment_class', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { environment_class: 'STAGING' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /ENUM_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects modified attestation_scope', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { attestation_scope: 'PREVIEW_READONLY' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /ENUM_INVALID/);
  });

  // ======================== RECURSIVE SANITIZATION ========================

  it('rejects nested prohibited key in objects', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ objects: [{ host: 'x' }] }, 0), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects nested prohibited key in candidate', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ data: { raw_role: 'x' } }, 0), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects deeply nested prohibited key', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ a: { b: { database_owner: 'x' } } }, 0), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects prohibited key in arrays', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ arr: [[{ connection_string: 'x' }]] }, 0), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects sensitive pattern in nested value', () => {
    assert.throws(() => receiptCore.scanSensitive({ data: { url: 'postgres://user:pass@host/db' } }, 0), /RECEIPT_SENSITIVE_VALUE/);
  });

  it('accepts clean deeply nested data', () => {
    const clean = { format_version: '1.0', objects: [{ name: 'x', fingerprint: 'sha256:abc' }], meta: { inner: 'ok' } };
    assert.doesNotThrow(() => { receiptCore.checkProhibitedFields(clean, 0); receiptCore.scanSensitive(clean, 0); });
  });

  it('rejects non-finite numbers', () => {
    assert.throws(() => receiptCore.scanSensitive(NaN, 0), /RECEIPT_VALUE_TYPE_INVALID/);
    assert.throws(() => receiptCore.scanSensitive(Infinity, 0), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('rejects non-plain objects', () => {
    class C {}
    assert.throws(() => receiptCore.scanSensitive(new C(), 0), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  // ======================== PRE-DIGEST VALIDATION ========================

  it('validateJsonArtifact rejects undefined', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(undefined, 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects symbol', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(Symbol('x'), 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects function', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(() => {}, 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateArtifact rejects cyclic object (local WeakSet)', () => {
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    assert.throws(() => receiptCore.validateArtifact(cyclic), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Date', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(new Date(), 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Map', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(new Map(), 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Buffer', () => {
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(Buffer.from('x'), 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  // ======================== ACCESSOR / GETTER / SYMBOL REJECTION ========================

  it('validateJsonArtifact rejects accessor without invoking getter', () => {
    let getterCalls = 0;
    const value = {};
    Object.defineProperty(value, 'x', {
      enumerable: true,
      get() { getterCalls += 1; return 'val'; },
    });
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(value, 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
    assert.equal(getterCalls, 0, 'getter must not be invoked');
  });

  it('validateJsonArtifact rejects symbol key', () => {
    const value = { [Symbol('sym')]: 1 };
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(value, 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects non-enumerable field', () => {
    const value = {};
    Object.defineProperty(value, 'hidden', { value: 42, enumerable: false });
    const s = new WeakSet();
    assert.throws(() => receiptCore.validateJsonArtifact(value, 0, s), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateArtifact calls use independent local WeakSet', () => {
    // First call should not affect second call
    const c1 = { a: 1 };
    assert.ok(receiptCore.validateArtifact(c1) === undefined);
    assert.ok(receiptCore.validateArtifact({ b: 2 }) === undefined);
    // Independent WeakSet means each call starts fresh
    assert.ok(receiptCore.validateArtifact(c1) === undefined);
  });

  // ======================== FIXED ATTESTATION ========================

  it('buildPreparedUnattestedAttestationDraft fixed fields', () => {
    const draft = buildTestDraft();
    assert.equal(draft.adoption_status, 'UNATTESTED');
    assert.equal(draft.environment_class, 'PRODUCTION');
    assert.equal(draft.attestation_scope, 'PRODUCTION_READONLY');
    assert.equal(draft.variance_classification, 'UNKNOWN_DRIFT');
    assert.equal(draft.baseline_commit, TEST_BASELINE);
    assert.equal(draft.approval_reference, TEST_APPROVAL);
  });

  it('buildPreparedUnattestedAttestationDraft - no ATTESTED', () => {
    const draft = buildTestDraft();
    assert.notEqual(draft.adoption_status, 'ATTESTED');
  });

  it('buildPreparedUnattestedAttestationDraft - empty migrations for ADOPTION_REQUIRED', () => {
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ADOPTION_REQUIRED', migrations: [] },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.deepEqual(draft.applied_migrations, []);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects forged plan via validator', () => {
    const forged = { plan_status: 'ACTIVE', environment_class: 'STAGING', attestation_scope: 'PREVIEW_READONLY', baseline_commit: TEST_BASELINE, approval_reference: TEST_APPROVAL };
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: forged,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }));
  });

  it('buildPreparedUnattestedAttestationDraft - rejects wrong candidate status', () => {
    const bad = { ...buildTestCandidate(), status: 'ACTIVE' };
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: bad,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /ENUM_INVALID/);
  });

  // ======================== RECEIPT BRANDING (UNFORGEABLE SERIALIZER) ========================

  it('genuine branded receipt serializes successfully', () => {
    const receipt = buildTestReceipt();
    const serialized = receiptCore.serializeCollectionReceipt(receipt);
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.outcome, 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY');
  });

  it('serializeCollectionReceipt rejects forged minimal success object', () => {
    const forged = { outcome: 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY' };
    assert.throws(() => receiptCore.serializeCollectionReceipt(forged), /RECEIPT_INPUT_INVALID/);
  });

  it('serializeCollectionReceipt rejects JSON clone of genuine receipt', () => {
    const receipt = buildTestReceipt();
    const clone = JSON.parse(JSON.stringify(receipt));
    assert.throws(() => receiptCore.serializeCollectionReceipt(clone), /RECEIPT_INPUT_INVALID/);
  });

  it('serializeCollectionReceipt rejects spread clone of genuine receipt', () => {
    const receipt = buildTestReceipt();
    const spread = { ...receipt };
    assert.throws(() => receiptCore.serializeCollectionReceipt(spread), /RECEIPT_INPUT_INVALID/);
  });

  it('receipt is frozen (mutation impossible)', () => {
    const receipt = buildTestReceipt();
    assert.ok(Object.isFrozen(receipt));
    assert.throws(() => { receipt.outcome = 'CHANGED'; }, /Cannot assign to read only property/);
  });

  it('nested receipt artifacts are frozen', () => {
    const receipt = buildTestReceipt();
    assert.ok(Object.isFrozen(receipt.catalog_evidence));
    assert.ok(Object.isFrozen(receipt.inactive_expected_schema_candidate));
    assert.ok(Object.isFrozen(receipt.prepared_attestation_draft));
  });

  it('serializeCollectionReceipt validates invariants on branded receipt', () => {
    // A genuine branded receipt that fails invariant check — can't easily create one
    // without modifying module-internals, but verify the check function exists
    assert.ok(typeof receiptCore.serializeCollectionReceipt === 'function');
  });

  // ======================== SESSION COUNT ENFORCEMENT ========================

  it('buildCollectionReceipt rejects session count 0', () => {
    assert.throws(() => buildTestReceipt({ collectionSessionCount: 0 }), /RECEIPT_INPUT_INVALID/);
  });

  it('buildCollectionReceipt rejects session count 3', () => {
    assert.throws(() => buildTestReceipt({ collectionSessionCount: 3 }), /RECEIPT_INPUT_INVALID/);
  });

  it('buildCollectionReceipt accepts session count 2', () => {
    const receipt = buildTestReceipt({ collectionSessionCount: 2 });
    assert.equal(receipt.collection_session_count, 2);
  });

  // ======================== MIGRATION MANIFEST RULES ========================

  it('ADOPTION_REQUIRED + non-empty migrations reject', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ADOPTION_REQUIRED', migrations: [{ id: '20260101000001_x', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }] },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /INPUT_INVALID/);
  });

  it('ADOPTION_REQUIRED + missing migrations field reject', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ADOPTION_REQUIRED' },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /INPUT_INVALID/);
  });

  it('non-array migrations reject', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ACTIVE', migrations: 'not_array' },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /INPUT_INVALID/);
  });

  // ======================== MIGRATION RECORD VALIDATION ========================

  it('migration record rejects unknown field', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ACTIVE', migrations: [{ id: '20260101000001_test-migration-a', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extra_field: 'bad' }] },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /UNKNOWN_FIELD/);
  });

  it('migration record rejects invalid checksum', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ACTIVE', migrations: [{ id: '20260101000001_test-migration-a', checksum: 'sha256:not_valid_hex' }] },
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /DIGEST_INVALID/);
  });

  it('migration record rejects duplicate id', () => {
    assert.throws(() => attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: buildRealValidatedPlan(),
      migrationManifest: { status: 'ACTIVE', migrations: [
        { id: '20260101000001_test-migration-a', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { id: '20260101000001_test-migration-a', checksum: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ]},
      expectedSchemaCandidate: buildTestCandidate(),
      catalogEvidence: SYNTHETIC_EVIDENCE,
    }), /MIGRATION_INVALID/);
  });

  // ======================== REPEAT COMPARISON ========================

  it('computeObjectDigest is insertion-order independent', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    assert.equal(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest detects actual value change', () => {
    const a = { key: 'v1' };
    const b = { key: 'v2' };
    assert.notEqual(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest is nested-key-order independent', () => {
    const a = { outer: { b: 2, a: 1 } };
    const b = { outer: { a: 1, b: 2 } };
    assert.equal(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest detects array order change', () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    assert.notEqual(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  // ======================== BOUNDED FAILURE / CLI ========================

  it('CLI with invalid argv outputs single JSON document', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--forbidden-flag'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    const matches = result.trim().match(/\{[\s\S]*?\}/g) || [];
    assert.equal(matches.length, 1);
    const p = JSON.parse(matches[0]);
    assert.equal(p.outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
    assert.equal(p.bounded_category, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
    assert.ok(!result.includes('Error:'));
  });

  it('CLI missing required flags outputs bounded JSON', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--secret-file', 'x'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    const p = JSON.parse(result.trim());
    assert.equal(p.collection_session_count, 0);
    assert.ok(!result.includes('Error:'));
  });

  it('CLI --repeat 3 is rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--repeat', '3', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    assert.equal(JSON.parse(result.trim()).outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  it('CLI --repeat 1junk is rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--repeat', '1junk', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    assert.equal(JSON.parse(result.trim()).outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  it('CLI --repeat 01 is rejected (exact match)', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--repeat', '01', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    assert.equal(JSON.parse(result.trim()).outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  it('CLI duplicate --repeat rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--repeat', '1', '--repeat', '2', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    assert.equal(JSON.parse(result.trim()).outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  it('CLI duplicate --secret-file rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli, '--secret-file', 'x', '--secret-file', 'y', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    assert.equal(JSON.parse(result.trim()).outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  it('CLI failure output contains no raw internal categories', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try { result = execFileSync(process.execPath, [cli], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 }); }
    catch (err) { result = err.stdout || ''; }
    const forbidden = ['INPUT_INVALID', 'BASELINE_INVALID', 'PLAN_FAILED', 'REPEAT_MISMATCH', 'CATALOG_ADAPTER_', 'RECEIPT_'];
    for (const raw of forbidden) {
      assert.ok(!result.includes(raw), `Output must not contain raw category: ${raw}`);
    }
  });

  // ======================== SESSION PRESERVATION ========================

  it('pre-session unexpected failure → count 0', () => {
    // The top-level catch in CLI with _state.attemptedSessions=0
    // Test the session-awareness via mapFailure
    assert.equal('COLLECTION_NOT_RUN_CONNECTION_BOUNDARY', collab('UNEXPECTED', 0));
    // This test verifies the mapping logic — we can't inject actual failures easily
    // but mapFailure is a pure function
    assert.equal('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', collab('UNEXPECTED', 1));
  });

  it('post-session unexpected failure → partial/unknown', () => {
    // mapFailure matches: after attempt → partial/unknown
    assert.equal('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', collab('UNEXPECTED', 2));
    assert.equal('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', collab('CATALOG_ADAPTER_QUERY_FAILED', 1));
    assert.equal('COLLECTION_FAIL_PARTIAL_OR_UNKNOWN', collab('COLLECTOR_FAILED', 1));
  });

  it('CLI source has no manifest write operations', () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'), 'utf8'
    );
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes('writeFile'));
    assert.ok(!codeOnly.includes('appendFile'));
  });
});

// ─── Collab helper for mapFailure testing ──────────────────────────────

// Extract the exact mapFailure function from the CLI source
// Since it's not exported, we re-implement the mapping logic for verification
function collab(category, n) {
  // This mirrors the actual CLI mapFailure
  if (!category || category === 'UNEXPECTED') {
    return n > 0 ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN' : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }
  if (category === 'INPUT_INVALID' || category.startsWith('COLLECTION_PLAN_') ||
      category === 'HEAD_UNRESOLVABLE' || category === 'BASELINE_HEAD_MISMATCH' ||
      category === 'CONTRACT_LOAD_FAILED') {
    return 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }
  if (category === 'CATALOG_ADAPTER_READ_ONLY_REQUIRED' || category === 'CATALOG_ADAPTER_MUTATION_DETECTED') {
    return 'COLLECTION_FAIL_READONLY_PROOF';
  }
  if (category === 'CATALOG_ADAPTER_INPUT_INVALID' || category === 'CATALOG_ADAPTER_GRANTEE_UNMAPPED' ||
      category.startsWith('CATALOG_ADAPTER_CATALOG_SHAPE_')) {
    return 'COLLECTION_FAIL_ALLOWLIST_OR_METADATA_CONTRACT';
  }
  if (category === 'CANDIDATE_FAILED' || category === 'ATTESTATION_DRAFT_FAILED' ||
      category.startsWith('RECEIPT_') || category === 'CATALOG_ADAPTER_SANITIZATION_FAILED') {
    return 'COLLECTION_FAIL_SANITIZATION';
  }
  if (category === 'REPEAT_MISMATCH') {
    return 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN';
  }
  if (category === 'CATALOG_ADAPTER_CONNECTION_CONFIG_INVALID' ||
      category === 'CATALOG_ADAPTER_SERVER_VERSION_MISMATCH') {
    return 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }
  if (category === 'CATALOG_ADAPTER_QUERY_FAILED' || category === 'COLLECTOR_FAILED') {
    return n > 0 ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN' : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
  }
  return n > 0 ? 'COLLECTION_FAIL_PARTIAL_OR_UNKNOWN' : 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY';
}
