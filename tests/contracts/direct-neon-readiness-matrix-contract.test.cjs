'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MATRIX_PATH = path.resolve(REPO_ROOT, 'docs', 'architecture', 'direct-neon-readiness-matrix-4311.json');
const CONTRACT_DOC_PATH = path.resolve(
  REPO_ROOT,
  'docs',
  'architecture',
  'DIRECT_NEON_EPHEMERAL_PRODUCTION_DIAGNOSTIC_ACTIVATION_CONTRACT_4311.md'
);

const MATRIX = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));

const REQUIRED_ROUTE_FIELDS = [
  'id', 'route', 'method', 'family', 'source_refs', 'source_state', 'runtime_gate',
  'required_objects', 'credential_boundary', 'source_parity', 'privilege_state',
  'live_provider_state', 'checked_in_gate', 'live_gate_state', 'ephemeral_diagnostic_support',
  'diagnostic_execution_authorized', 'production_live', 'disposition_4239',
  'last_exact_head_evidence', 'modal_retained_by_design', 'rollback_authority', 'next_action',
];

const NULLABLE_FIELDS = new Set(['source_helper', 'runtime_gate', 'privilege_block_reason']);
const SHARED_CORE_HELPERS = new Set([
  'functions/_shared/direct-neon-browse-summary-core.js',
  'functions/_shared/direct-neon-browse-transport.js',
]);

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collectSourceGateVars() {
  const found = new Set();
  for (const file of walkJs(path.resolve(REPO_ROOT, 'functions'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bLB_[A-Z0-9_]+_RUNTIME\b/g)) found.add(m[0]);
  }
  return found;
}

function collectDirectNeonHelpers() {
  const dir = path.resolve(REPO_ROOT, 'functions', '_shared');
  return fs.readdirSync(dir)
    .filter((n) => /neon.*\.js$/.test(n))
    .map((n) => `functions/_shared/${n}`)
    .filter((p) => !SHARED_CORE_HELPERS.has(p));
}

function collectCheckedInGates() {
  return parseWranglerProductionGates(fs.readFileSync(path.resolve(REPO_ROOT, 'wrangler.toml'), 'utf8'));
}

// ─── #4451: .env.example / wrangler.toml gate drift authority ────────────────
//
// Both parsers are text-in / Set-out so the drift guard can be exercised against
// in-memory fixtures without mutating repository files.

const ENV_EXAMPLE_PATH = path.resolve(REPO_ROOT, '.env.example');

function parseWranglerProductionGates(text) {
  const parts = String(text).split(/^\[env\.production\.vars\]\s*$/m);
  const section = parts.length > 1 ? parts[1] : '';
  const gates = new Set();
  for (const m of section.matchAll(/^(LB_[A-Z0-9_]+_RUNTIME)\s*=\s*"direct_neon"\s*$/gm)) gates.add(m[1]);
  return gates;
}

function parseDocumentedGates(text) {
  const gates = new Set();
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const m = /^(LB_[A-Z0-9_]+_RUNTIME)\s*=\s*direct_neon\s*$/.exec(s);
    if (m) gates.add(m[1]);
  }
  return gates;
}

function diffGateSets(authorityGates, documentedGates) {
  const missing = [...authorityGates].filter((g) => !documentedGates.has(g)).sort();
  const stale = [...documentedGates].filter((g) => !authorityGates.has(g)).sort();
  const codes = [];
  if (missing.length) codes.push('MISSING_DOCUMENTED_GATE');
  if (stale.length) codes.push('STALE_DOCUMENTED_GATE');
  return { missing, stale, codes };
}

function readEnvExample() {
  return fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
}

function activeLines(text) {
  return String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

describe('#4311 direct-neon readiness matrix contract', () => {
  it('authority block is present and freshness-bound', () => {
    assert.equal(MATRIX.format_version, '1.0');
    assert.equal(MATRIX.authority.issue, 4311);
    assert.match(MATRIX.authority.as_of_main_sha, /^[a-f0-9]{40}$/);
    assert.ok(MATRIX.authority.staleness_rule.includes('INVALIDATED') || MATRIX.authority.staleness_rule.length > 40);
  });

  it('activation contract document exists', () => {
    assert.ok(fs.existsSync(CONTRACT_DOC_PATH));
  });

  it('every route carries all required fields exactly once and unique ids', () => {
    const ids = new Set();
    for (const route of MATRIX.routes) {
      for (const field of REQUIRED_ROUTE_FIELDS) {
        assert.ok(Object.prototype.hasOwnProperty.call(route, field), `${route.id}: missing ${field}`);
        if (!NULLABLE_FIELDS.has(field)) {
          assert.notEqual(route[field], null, `${route.id}: ${field} must not be null`);
          if (typeof route[field] === 'string') assert.ok(route[field].trim().length > 0, `${route.id}: empty ${field}`);
        }
      }
      assert.ok(!ids.has(route.id), `duplicate route id ${route.id}`);
      ids.add(route.id);
    }
  });

  it('all state values are members of the declared vocabulary', () => {
    const vocab = MATRIX.classification_vocabulary;
    const checks = [
      ['source_state', vocab.source_state],
      ['source_parity', vocab.source_parity],
      ['privilege_state', vocab.privilege_state],
      ['live_provider_state', vocab.live_provider_state],
      ['checked_in_gate', vocab.checked_in_gate],
      ['live_gate_state', vocab.live_gate_state],
      ['ephemeral_diagnostic_support', vocab.ephemeral_diagnostic_support],
      ['diagnostic_execution_authorized', vocab.diagnostic_execution_authorized],
      ['production_live', vocab.production_live],
      ['disposition_4239', vocab.disposition_4239],
    ];
    for (const route of MATRIX.routes) {
      for (const [field, allowed] of checks) {
        assert.ok(allowed.includes(route[field]), `${route.id}: ${field}=${route[field]} not in vocabulary`);
      }
      assert.ok(['READ', 'WRITE'].includes(route.family), `${route.id}: bad family`);
      assert.ok(['modal_runtime', 'direct_neon_runtime'].includes(route.credential_boundary), `${route.id}: bad credential boundary`);
    }
  });

  it('modal-retained classification is explicit, never inferred', () => {
    for (const route of MATRIX.routes) {
      assert.equal(typeof route.modal_retained_by_design, 'boolean', `${route.id}: modal_retained_by_design must be boolean`);
      if (route.modal_retained_by_design) {
        assert.equal(route.source_state, 'KEEP_MODAL_BY_DESIGN', `${route.id}: retained routes must say so in source_state`);
      }
      if (route.source_state === 'KEEP_MODAL_BY_DESIGN') {
        assert.equal(route.modal_retained_by_design, true, `${route.id}: inconsistent retention flags`);
      }
    }
  });

  it('no stale diagnostic authority is inherited into the matrix', () => {
    for (const route of MATRIX.routes) {
      assert.notEqual(
        route.diagnostic_execution_authorized,
        'AUTHORIZED_ONE_SESSION_AT_CITED_SHA',
        `${route.id}: live one-session authority must never be checked into main; use the ephemeral activation lifecycle`
      );
    }
  });

  it('declared source helpers exist on disk', () => {
    for (const route of MATRIX.routes) {
      const declared = [route.source_helper, ...(route.shared_core || [])].filter(Boolean);
      for (const helper of declared) {
        assert.ok(fs.existsSync(path.resolve(REPO_ROOT, helper)), `${route.id}: missing helper ${helper}`);
      }
    }
  });

  it('matrix covers every neon helper source file exactly once', () => {
    const covered = new Map();
    for (const route of MATRIX.routes) {
      const declared = [route.source_helper, ...(route.shared_core || [])].filter(Boolean);
      for (const helper of declared) {
        assert.ok(!covered.has(helper), `${helper} classified by both ${covered.get(helper)} and ${route.id}`);
        covered.set(helper, route.id);
      }
    }
    for (const helper of collectDirectNeonHelpers()) {
      assert.ok(covered.has(helper), `${helper} exists on main but has no matrix entry`);
    }
  });

  it('matrix covers every LB_*_RUNTIME gate variable exactly once', () => {
    const seen = new Map();
    for (const route of MATRIX.routes) {
      if (!route.runtime_gate) continue;
      assert.ok(!seen.has(route.runtime_gate), `${route.runtime_gate} declared by both ${seen.get(route.runtime_gate)} and ${route.id}`);
      seen.set(route.runtime_gate, route.id);
    }
    const sourceGates = collectSourceGateVars();
    for (const gate of sourceGates) assert.ok(seen.has(gate), `${gate} referenced in functions/ but absent from matrix`);
    for (const gate of seen.keys()) assert.ok(sourceGates.has(gate), `${gate} in matrix but absent from functions/`);
  });

  it('checked-in Production gate flags match wrangler.toml exactly', () => {
    const wranglerGates = collectCheckedInGates();
    const matrixGates = new Set(
      MATRIX.routes.filter((r) => r.checked_in_gate === 'CHECKED_IN_PRODUCTION_GATE').map((r) => r.runtime_gate)
    );
    for (const gate of wranglerGates) assert.ok(matrixGates.has(gate), `${gate} checked in wrangler but not flagged in matrix`);
    for (const gate of matrixGates) assert.ok(wranglerGates.has(gate), `${gate} flagged in matrix but not checked in wrangler`);
  });

  it('required DB objects use bounded operation vocabulary', () => {
    const OPS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    for (const route of MATRIX.routes) {
      for (const [table, ops] of Object.entries(route.required_objects)) {
        assert.match(table, /^[a-z][a-z0-9_]*$/, `${route.id}: bad table ${table}`);
        assert.ok(Array.isArray(ops) && ops.length > 0, `${route.id}: ${table} needs operations`);
        for (const op of ops) assert.ok(OPS.has(op), `${route.id}: bad op ${op} on ${table}`);
      }
      if (route.source_state === 'SOURCE_READY' && !route.modal_retained_by_design) {
        assert.ok(Object.keys(route.required_objects).length > 0, `${route.id}: SOURCE_READY route must declare required objects`);
      }
    }
  });

  it('every route carries exact-head evidence and next action', () => {
    for (const route of MATRIX.routes) {
      assert.ok(route.last_exact_head_evidence.ref.length > 0, `${route.id}: evidence ref required`);
      assert.match(route.last_exact_head_evidence.main_sha, /^[a-f0-9]{40}$/, `${route.id}: evidence main_sha must be a full SHA`);
      assert.ok(route.next_action.length > 0, `${route.id}: next_action required`);
      assert.ok(Array.isArray(route.source_refs) && route.source_refs.length > 0, `${route.id}: source_refs required`);
    }
  });
});

describe('#4451 .env.example direct-neon gate drift guard', () => {
  it('.env.example documents exactly the checked-in Production direct-neon gate set', () => {
    const authority = collectCheckedInGates();
    const documented = parseDocumentedGates(readEnvExample());
    const { missing, stale, codes } = diffGateSets(authority, documented);

    assert.ok(authority.size > 0, 'wrangler Production direct_neon gate set must not be empty');
    assert.deepEqual(codes, [], `gate drift codes: ${codes.join(', ')}`);
    assert.deepEqual(missing, [], `MISSING_DOCUMENTED_GATE: ${missing.join(', ')}`);
    assert.deepEqual(stale, [], `STALE_DOCUMENTED_GATE: ${stale.join(', ')}`);
    assert.equal(documented.size, authority.size, 'documented gate count must equal checked-in gate count');
  });

  it('NC1: removing a real checked-in gate from .env.example is detected', () => {
    const authority = collectCheckedInGates();
    const documented = parseDocumentedGates(readEnvExample());
    const removed = [...authority].sort()[0];
    const mutated = new Set(documented);
    mutated.delete(removed);

    const { missing, codes } = diffGateSets(authority, mutated);
    assert.ok(codes.includes('MISSING_DOCUMENTED_GATE'), 'removing a real gate must fail closed');
    assert.deepEqual(missing, [removed]);
  });

  it('NC2: a bogus stale gate added to .env.example is detected', () => {
    const authority = collectCheckedInGates();
    const documented = parseDocumentedGates(readEnvExample());
    const mutated = new Set(documented);
    mutated.add('LB_BOGUS_STALE_RUNTIME');

    const { stale, codes } = diffGateSets(authority, mutated);
    assert.ok(codes.includes('STALE_DOCUMENTED_GATE'), 'an unknown gate must fail closed');
    assert.deepEqual(stale, ['LB_BOGUS_STALE_RUNTIME']);
  });

  it('a matching count is not sufficient — a swapped gate name must still fail', () => {
    // This is the guard against a weak "count == 31" contract: replace one real
    // gate with one bogus gate so the cardinality is unchanged.
    const authority = collectCheckedInGates();
    const documented = parseDocumentedGates(readEnvExample());
    const removed = [...authority].sort()[0];
    const mutated = new Set(documented);
    mutated.delete(removed);
    mutated.add('LB_BOGUS_STALE_RUNTIME');

    assert.equal(mutated.size, documented.size, 'precondition: cardinality unchanged');
    const { missing, stale, codes } = diffGateSets(authority, mutated);
    assert.deepEqual([...codes].sort(), ['MISSING_DOCUMENTED_GATE', 'STALE_DOCUMENTED_GATE']);
    assert.deepEqual(missing, [removed]);
    assert.deepEqual(stale, ['LB_BOGUS_STALE_RUNTIME']);
  });

  it('.env.example no longer presents Netlify-era or service-account env as active', () => {
    const lines = activeLines(readEnvExample());

    for (const legacy of ['NETLIFY_DATABASE_URL', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_SERVICE_ACCOUNT']) {
      const offending = lines.filter((l) => new RegExp(`^${legacy}\\s*=`).test(l));
      assert.deepEqual(offending, [], `${legacy} must not be an active assignment in .env.example`);
    }

    const genericDatabaseUrl = lines.filter((l) => /^DATABASE_URL\s*=/.test(l));
    assert.deepEqual(genericDatabaseUrl, [], 'generic DATABASE_URL must not be documented as active');

    const staleScript = lines.filter((l) => /verify-env\.js\b/.test(l));
    assert.deepEqual(staleScript, [], '.env.example must reference scripts/verify-env.cjs, not verify-env.js');
  });

  it('.env.example documents the read and write DB authority as separate envs', () => {
    const lines = activeLines(readEnvExample());
    assert.ok(lines.some((l) => /^LOVE_PLATFORM_DATABASE_URL\s*=/.test(l)), 'read authority must be documented');
    assert.ok(lines.some((l) => /^LOVE_PLATFORM_WRITE_DATABASE_URL\s*=/.test(l)), 'write authority must be documented');
    assert.ok(lines.some((l) => /^MODAL_BASE_URL\s*=/.test(l)), 'MODAL_BASE_URL must be documented');
    assert.ok(lines.some((l) => /^FIREBASE_PROJECT_ID\s*=/.test(l)), 'FIREBASE_PROJECT_ID must be documented');
  });

  it('verify-env.cjs derives the gate inventory from repository source, not a duplicated list', () => {
    const src = fs.readFileSync(path.resolve(REPO_ROOT, 'scripts', 'verify-env.cjs'), 'utf8');
    const hardCoded = [...collectCheckedInGates()].filter((gate) => src.includes(gate));
    assert.deepEqual(hardCoded, [], `verify-env.cjs must not hard-code checked-in gate names: ${hardCoded.join(', ')}`);
    assert.ok(src.includes('wrangler.toml'), 'verify-env.cjs must read wrangler.toml as gate authority');
    assert.ok(src.includes('.env.example'), 'verify-env.cjs must read .env.example for documented drift');
  });

  it('verify-env.cjs keeps the Cloudflare production host and drops legacy Netlify function validation', () => {
    const src = fs.readFileSync(path.resolve(REPO_ROOT, 'scripts', 'verify-env.cjs'), 'utf8');
    assert.ok(src.includes('https://lovebud.pages.dev'), 'production host must remain lovebud.pages.dev');
    assert.ok(src.includes('--remote'), 'the --remote CLI surface must be preserved');

    const legacyMarker = ['netlify', 'functions'].join('/');
    assert.equal(src.split(legacyMarker).length - 1, 0, 'legacy Netlify function syntax validation must be removed');
  });
});

// ─── #4532 authority freshness semantics + row-state/action coherence ─────────
//
// #4532 hazard: `authority.as_of_main_sha` used to read as "this whole matrix was
// verified at current main" even though it is an immutable historical evidence
// boundary. These guards make that role explicit, forbid a re-mirrored
// current-main field from creeping back in, and reject a next_action that
// logically contradicts its own row state.

const AUTHORITY_FRESHNESS_FIELDS = [
  'as_of_main_sha_role',
  'as_of_main_sha_meaning',
  'current_main_sha_claim',
  'current_main_sha_claim_meaning',
  'claim_vocabulary',
];

const CLAIM_VOCABULARY_KEYS = [
  'HISTORICAL_EXACT_HEAD_EVIDENCE',
  'REPOSITORY_DERIVED_INTENT',
  'LIVE_PROVIDER_ATTESTATION',
  'DERIVED_SUMMARY',
];

// Field names that would re-introduce a masquerading "current main" claim.
const MASQUERADE_FIELDS = [
  'current_main_sha',
  'as_of_current_main_sha',
  'verified_at_main_sha',
  'current_main',
  'main_sha',
];

function readAuthorityFile() {
  return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8')).authority;
}

function authorityFreshnessFaults(authority) {
  const faults = [];
  for (const field of AUTHORITY_FRESHNESS_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(authority, field)) {
      faults.push(`MISSING_FRESHNESS_FIELD:${field}`);
    }
  }
  for (const field of MASQUERADE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(authority, field)) {
      faults.push(`MASQUERADING_CURRENT_MAIN_FIELD:${field}`);
    }
  }
  if (authority.as_of_main_sha_role && authority.as_of_main_sha_role !== 'HISTORICAL_EXACT_HEAD_EVIDENCE_BOUNDARY') {
    faults.push(`AS_OF_MAIN_ROLE_NOT_HISTORICAL:${authority.as_of_main_sha_role}`);
  }
  if (authority.current_main_sha_claim && authority.current_main_sha_claim !== 'NOT_RECORDED_IN_THIS_FILE') {
    faults.push(`CURRENT_MAIN_CLAIM_PRESENT:${authority.current_main_sha_claim}`);
  }
  const vocab = authority.claim_vocabulary || {};
  for (const key of CLAIM_VOCABULARY_KEYS) {
    if (typeof vocab[key] !== 'string' || vocab[key].length < 10) faults.push(`CLAIM_VOCABULARY_WEAK:${key}`);
  }
  return faults;
}

function isTerminalLive(route) {
  return (
    route.production_live === 'PRODUCTION_LIVE' &&
    route.live_gate_state === 'LIVE_GATE_VERIFIED' &&
    route.checked_in_gate === 'CHECKED_IN_PRODUCTION_GATE'
  );
}

// Logical contradictions between a row's own state fields and its next_action.
// Deliberately narrow: a terminal row may legitimately state that *future*
// changes would require fresh verification, so only unresolved-obligation and
// direct state-contradiction phrasings are rejected.
function nextActionContradictions(route) {
  const action = String(route.next_action || '');
  const faults = [];
  const terminal = isTerminalLive(route);
  if (terminal) {
    if (/first obtain/i.test(action)) faults.push('TERMINAL_ROW_STILL_FIRST_OBTAIN');
    if (/not yet (?:Production )?(?:live|verified|proven|activated)/i.test(action)) {
      faults.push('TERMINAL_ROW_CLAIMS_NOT_YET');
    }
    if (/is not (?:yet )?Production live/i.test(action)) faults.push('TERMINAL_ROW_CLAIMS_NOT_LIVE');
    if (/requires? (?:a |an |another |one )?(?:separate |fresh )?(?:Product |production )?canary\b/i.test(action)) {
      faults.push('TERMINAL_ROW_REQUIRES_CANARY');
    }
  }
  if (route.checked_in_gate === 'NOT_CHECKED_IN' && /\bis Production live\b/i.test(action)) {
    faults.push('GATE_NOT_CHECKED_IN_BUT_ACTION_CLAIMS_LIVE');
  }
  if (route.production_live === 'NOT_PRODUCTION_LIVE' && /\bis Production live\b/i.test(action)) {
    faults.push('ROW_NOT_LIVE_BUT_ACTION_CLAIMS_LIVE');
  }
  return faults;
}

describe('#4532 direct-neon matrix authority freshness guard', () => {
  it('authority block declares explicit freshness semantics', () => {
    const authority = readAuthorityFile();
    assert.deepEqual(authorityFreshnessFaults(authority), []);
    assert.match(authority.as_of_main_sha, /^[0-9a-f]{40}$/, 'historical evidence boundary must stay a full SHA');
  });

  it('NC1: a matrix without explicit freshness semantics fails closed', () => {
    const authority = JSON.parse(JSON.stringify(readAuthorityFile()));
    delete authority.as_of_main_sha_role;
    assert.ok(
      authorityFreshnessFaults(authority).includes('MISSING_FRESHNESS_FIELD:as_of_main_sha_role'),
      'dropping the historical role must be detected'
    );
  });

  it('NC2: re-mirroring a current-main SHA into the matrix fails closed', () => {
    const authority = JSON.parse(JSON.stringify(readAuthorityFile()));
    authority.current_main_sha = 'a'.repeat(40);
    assert.ok(
      authorityFreshnessFaults(authority).some((f) => f.startsWith('MASQUERADING_CURRENT_MAIN_FIELD')),
      'a current_main_sha field must be rejected as a masquerading freshness claim'
    );
  });

  it('NC3: relabelling as_of_main_sha as a current claim fails closed', () => {
    const authority = JSON.parse(JSON.stringify(readAuthorityFile()));
    authority.as_of_main_sha_role = 'CURRENT_MAIN_VERIFIED';
    assert.ok(
      authorityFreshnessFaults(authority).some((f) => f.startsWith('AS_OF_MAIN_ROLE_NOT_HISTORICAL')),
      'as_of_main_sha must stay a historical evidence boundary'
    );
  });

  it('every route keeps SHA-bound historical evidence intact', () => {
    for (const route of MATRIX.routes) {
      const evidence = route.last_exact_head_evidence || {};
      assert.ok(evidence.ref && evidence.ref.length > 0, `${route.id}: evidence ref required`);
      assert.match(
        evidence.main_sha,
        /^[0-9a-f]{40}$/,
        `${route.id}: historical evidence SHA must stay a full SHA and must not be rewritten to a newer main`
      );
    }
  });

  it('no route next_action contradicts its own row state', () => {
    const offenders = [];
    for (const route of MATRIX.routes) {
      for (const fault of nextActionContradictions(route)) offenders.push(`${route.id}:${fault}`);
    }
    assert.deepEqual(offenders, [], `next_action/row-state contradictions: ${offenders.join(', ')}`);
  });

  it('NC4: a terminal row carrying a stale pending action is detected', () => {
    const fixture = JSON.parse(JSON.stringify(MATRIX.routes[0]));
    fixture.next_action = 'First obtain exact-head source/CI evidence, then complete the audit before Production.';
    assert.ok(
      nextActionContradictions(fixture).includes('TERMINAL_ROW_STILL_FIRST_OBTAIN'),
      'a live terminal row must not restart an outstanding evidence obligation'
    );
  });

  it('NC5: a terminal row demanding another canary is detected', () => {
    const fixture = JSON.parse(JSON.stringify(MATRIX.routes[0]));
    fixture.next_action = 'Route requires a fresh Product canary to re-establish the live record.';
    assert.ok(
      nextActionContradictions(fixture).includes('TERMINAL_ROW_REQUIRES_CANARY'),
      'a live terminal row must not demand a replacement canary as its next action'
    );
  });

  it('NC6: gate/state disagreement is detected in both directions', () => {
    const notLive = JSON.parse(JSON.stringify(MATRIX.routes[0]));
    notLive.checked_in_gate = 'NOT_CHECKED_IN';
    assert.ok(
      nextActionContradictions(notLive).includes('GATE_NOT_CHECKED_IN_BUT_ACTION_CLAIMS_LIVE'),
      'a NOT_CHECKED_IN row must not read as Production live'
    );
    const notLiveRow = JSON.parse(
      JSON.stringify(MATRIX.routes.find((r) => r.production_live === 'NOT_PRODUCTION_LIVE'))
    );
    assert.equal(
      notLiveRow.checked_in_gate,
      'NOT_CHECKED_IN',
      'fixture precondition: pick a genuinely non-live row'
    );
    notLiveRow.next_action = 'This direct-Neon read is Production live and verified at current main.';
    assert.ok(
      nextActionContradictions(notLiveRow).includes('ROW_NOT_LIVE_BUT_ACTION_CLAIMS_LIVE'),
      'a NOT_PRODUCTION_LIVE row must not claim Production live in its next action'
    );
  });

  it('matrix checked_in_gate never contradicts the checked-in wrangler runtime gate', () => {
    const checkedIn = collectCheckedInGates();
    const offenders = [];
    for (const route of MATRIX.routes) {
      if (!route.runtime_gate) continue;
      const inWrangler = checkedIn.has(route.runtime_gate);
      const claimed = route.checked_in_gate === 'CHECKED_IN_PRODUCTION_GATE';
      if (inWrangler !== claimed) {
        offenders.push(`${route.id}:${route.runtime_gate}:wrangler=${inWrangler}:matrix=${route.checked_in_gate}`);
      }
    }
    assert.deepEqual(offenders, [], `matrix/wrangler gate contradictions: ${offenders.join(', ')}`);
  });
});
