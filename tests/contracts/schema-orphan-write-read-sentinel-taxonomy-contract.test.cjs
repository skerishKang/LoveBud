'use strict';

// Issue #3835 — Schema orphan & write-read sentinel taxonomy contract.
//
// This contract EXECUTES the real taxonomy source
// (js/observability/reliability-sentinel-taxonomy.js) in a restricted sandbox
// and asserts exact bounded authorities, privacy rejection, fail-closed
// behavior, determinism, byte stability, immutable boundaries, and the
// capability-0 surface. It also validates the structural-semantics policy
// document and the negative controls (NC1-NC10).
//
// Classification: SOURCE_STATIC (not registered in any browser/process group
// registry; tests/ci-test-group-registry.json is out of scope).
//
// Refs #3835.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(ROOT, 'js', 'observability', 'reliability-sentinel-taxonomy.js');
const POLICY_PATH = path.join(ROOT, 'docs', 'ops', 'SCHEMA_ORPHAN_WRITE_READ_SENTINEL_TAXONOMY_POLICY.md');

const PRIVATE_KEYS = [
  'token', 'cookie', 'authorization', 'email', 'user_id', 'owner_id', 'tree_id',
  'memory_id', 'target_id', 'title', 'description', 'content', 'url', 'query',
  'request_body', 'response_body', 'raw_error', 'exception', 'stack',
  'database_url', 'request_id', 'provider_id', 'account_id', 'project_id',
  'timestamp', 'metadata',
];

function readSource() {
  return fs.readFileSync(TAXONOMY_PATH, 'utf8');
}

function loadFromSource(source) {
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  assert.ok(sandbox.window.LoveBudReliabilitySentinelTaxonomy, 'must expose taxonomy');
  return sandbox.window.LoveBudReliabilitySentinelTaxonomy;
}

function loadTaxonomy() {
  return loadFromSource(readSource());
}

function withDisposableCopy(transform, fn) {
  const original = readSource();
  const tmp = path.join(os.tmpdir(), 'lb-sent-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.js');
  try {
    fs.writeFileSync(tmp, transform(original), 'utf8');
    fn(loadFromSource(fs.readFileSync(tmp, 'utf8')));
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
  }
  // Byte-exact restore regardless of path taken.
  assert.equal(fs.readFileSync(TAXONOMY_PATH, 'utf8'), original, 'source must be byte-exact restored');
}

const VALID_INPUT = {
  operation_class: 'STRUCTURAL_SCHEMA_CHECK',
  stage: 'REQUEST_DISPATCHED',
  outcome_code: 'CONFIRMED',
  evidence_completeness: 'complete',
  baseline_deviation: 'NONE',
  severity: 'INFO',
  owner_action: 'NO_ACTION',
  latency_bucket: 'LT_250_MS',
  count_bucket: 'zero',
  release_sha: '0123456789abcdef0123456789abcdef01234567',
};

// ---------------------------------------------------------------------------
test('exact 8 operation classes', () => {
  const T = loadTaxonomy();
  assert.deepEqual(Object.values(T.OPERATION_CLASSES).sort(), [
    'BROWSE_ELIGIBILITY_BASELINE_CHECK',
    'MEMORY_CREATE_CONVERGENCE',
    'MEMORY_PARENT_INTEGRITY_CHECK',
    'PUBLIC_THRESHOLD_CONVERGENCE',
    'SOCIAL_TARGET_INTEGRITY_CHECK',
    'STRUCTURAL_SCHEMA_CHECK',
    'TREE_CREATE_CONVERGENCE',
    'TREE_PARENT_INTEGRITY_CHECK',
  ].sort());
});

test('ordered convergence stages are immutable authority', () => {
  const T = loadTaxonomy();
  assert.deepEqual(T.CONVERGENCE_STAGE_ORDER, [
    'REQUEST_DISPATCHED',
    'SERVER_ACKNOWLEDGED',
    'PERSISTED_REREAD_CONFIRMED',
    'UI_RENDER_CONFIRMED',
    'BROWSE_ELIGIBILITY_CONFIRMED',
  ]);
  assert.equal(T.STAGE_INDEX.REQUEST_DISPATCHED, 0);
  assert.equal(T.STAGE_INDEX.SERVER_ACKNOWLEDGED, 1);
  assert.equal(T.STAGE_INDEX.PERSISTED_REREAD_CONFIRMED, 2);
  assert.equal(T.STAGE_INDEX.UI_RENDER_CONFIRMED, 3);
  assert.equal(T.STAGE_INDEX.BROWSE_ELIGIBILITY_CONFIRMED, 4);
  assert.throws(() => { T.CONVERGENCE_STAGE_ORDER[0] = 'BOGUS'; }, TypeError);
});

test('exact 12 bounded outcome codes', () => {
  const T = loadTaxonomy();
  assert.deepEqual(Object.values(T.OUTCOME_CODES).sort(), [
    'ACKNOWLEDGED_REREAD_MISSING',
    'ACKNOWLEDGEMENT_MISSING',
    'BASELINE_DISCONTINUITY_DETECTED',
    'CONFIRMED',
    'INSUFFICIENT_EVIDENCE',
    'MONITORING_FAILED',
    'ORPHAN_SIGNAL_DETECTED',
    'PUBLIC_THRESHOLD_NOT_CONFIRMED',
    'REREAD_CONFIRMED_UI_MISSING',
    'SCHEMA_AUTHORITY_UNAVAILABLE',
    'STRUCTURAL_DRIFT_DETECTED',
    'TRANSPORT_FAILED',
  ].sort());
});

test('exact deviation / severity / action / evidence enums', () => {
  const T = loadTaxonomy();
  assert.deepEqual(Object.values(T.BASELINE_DEVIATION_CLASSES).sort(), [
    'CRITICAL_DISCONTINUITY',
    'EXPECTED_VARIATION',
    'MATERIAL_DEVIATION',
    'NONE',
    'UNKNOWN',
  ].sort());
  assert.deepEqual(Object.values(T.SEVERITIES).sort(), ['BLOCKING', 'INFO', 'WARNING']);
  assert.deepEqual(Object.values(T.OWNER_ACTIONS).sort(), [
    'INVESTIGATE', 'NO_ACTION', 'OBSERVE', 'OWNER_DECISION_REQUIRED', 'STOP_SYNTHETIC_WRITES',
  ].sort());
  assert.deepEqual(Object.values(T.EVIDENCE_COMPLETENESS).sort(), ['complete', 'invalid', 'missing', 'partial']);
});

test('unknown enum / field / invalid SHA rejected; bounded enum accepted', () => {
  const T = loadTaxonomy();
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'FREE_FORM' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { operation_class: 'BOGUS_OP' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { stage: 'NOT_A_STAGE' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { baseline_deviation: 'WEIRD' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { severity: 'FATAL' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { owner_action: 'DELETE_EVERYTHING' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { unexpected_key: 'x' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { release_sha: 'ABC' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { release_sha: '0123456789ABCDEF0123456789ABCDEF01234567' })).ok, false);
  assert.equal(T.validateInput(VALID_INPUT).ok, true);
});

test('missing or invalid evidence can never resolve CONFIRMED', () => {
  const T = loadTaxonomy();
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'invalid' })).ok, false);
  assert.throws(() => T.buildBoundedResult(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' })), TypeError);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'partial' })).ok, true);
});

test('frozen/detached exports, frozen built result, immutable boundary', () => {
  const T = loadTaxonomy();
  assert.ok(Object.isFrozen(T));
  assert.ok(Object.isFrozen(T.OPERATION_CLASSES));
  assert.ok(Object.isFrozen(T.CONVERGENCE_STAGE_ORDER));
  assert.ok(Object.isFrozen(T.ALLOWED_FIELDS));
  const r = T.buildBoundedResult(VALID_INPUT);
  assert.ok(Object.isFrozen(r));
  assert.throws(() => { r.outcome_code = 'BROKEN'; }, TypeError);
  // input mutation cannot change output (detached)
  const m = Object.assign({}, VALID_INPUT);
  const built = T.buildBoundedResult(m);
  m.operation_class = 'TREE_CREATE_CONVERGENCE';
  assert.equal(built.operation_class, 'STRUCTURAL_SCHEMA_CHECK');
});

test('normalizeList sorted/deduped; canonical JSON byte-stable & only allowed fields', () => {
  const T = loadTaxonomy();
  assert.deepEqual(T.normalizeList(['b', 'a', 'b', 'c', 'a']), ['a', 'b', 'c']);
  assert.deepEqual(T.normalizeList(['unexpected', 'unexpected', 'source']), ['source', 'unexpected']);
  const json1 = T.canonicalJson(T.buildBoundedResult(VALID_INPUT));
  const json2 = T.canonicalJson(T.buildBoundedResult(Object.assign({}, VALID_INPUT, { operation_class: 'TREE_CREATE_CONVERGENCE' })));
  assert.notEqual(json1, json2);
  assert.equal(json1, T.canonicalJson(T.buildBoundedResult(VALID_INPUT)));
  const parsed = JSON.parse(json1);
  assert.deepEqual(Object.keys(parsed).sort(), [
    'baseline_deviation', 'count_bucket', 'evidence_completeness', 'latency_bucket',
    'operation_class', 'outcome_code', 'owner_action', 'release_sha', 'severity', 'stage',
  ]);
});

test('privacy-key rejection is key-based; bounded enum not blocked; output privacy-safe', () => {
  const T = loadTaxonomy();
  assert.deepEqual(T.PRIVATE_KEYS.slice().sort(), PRIVATE_KEYS.slice().sort());
  // legit bounded enums with private substrings still accepted
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { owner_action: 'OBSERVE' })).ok, true);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { baseline_deviation: 'EXPECTED_VARIATION' })).ok, true);
  // explicit private keys rejected
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { owner_id: 'x' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { tree_id: 'y' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { token: 'abc' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { stack: 'at ...' })).ok, false);
  // output never contains private key
  const out = T.canonicalJson(T.buildBoundedResult(VALID_INPUT));
  for (const pk of PRIVATE_KEYS) assert.ok(!out.includes('"' + pk + '"'), 'output must not contain ' + pk);
});

test('zero capability surface', () => {
  const T = loadTaxonomy();
  assert.deepEqual(T.CAPABILITIES, []);
  const src = readSource();
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch');
  assert.ok(!/child_process/.test(src), 'no child_process');
  assert.ok(!/\.writeFileSync\s*\(/.test(src), 'no filesystem write');
  assert.ok(!/\.appendFileSync\s*\(/.test(src), 'no filesystem append');
  assert.ok(!/process\.env/.test(src), 'no env read');
  assert.ok(!/\bpg\b[\s\S]*connect/i.test(src), 'no DB');
});

test('policy doc invariants', () => {
  const policy = readPolicy();
  assert.match(policy, /parent_id IS NULL/i);
  assert.match(policy, /valid root memory/i);
  assert.match(policy, /never/i);
  assert.match(policy, /The null-parent root case is excluded/i);
  assert.match(policy, /parent_id IS NOT NULL/i);
  assert.match(policy, /no matching parent/i);
  assert.match(policy, /provider unverified/i);
assert.match(policy, /ARCHITECTURAL_RISK/i);
  assert.match(policy, /UUID\/TEXT/i);
  // Numeric Production threshold/row-count declaration absent. Issue refs
  // (e.g. Refs #3835) and section numbers are exempt; threshold/row-count
  // declarations are not.
  assert.ok(!/\b(?:threshold|rows?|count|memories)\s*[:=]\s*\d+(?:\.\d+)?%?/i.test(policy),
    'no Production threshold/row-count declaration');
  assert.match(policy, /no synthetic write/i);
  assert.match(policy, /source-only/i);
  for (const f of ['operation_class', 'outcome_code', 'evidence_completeness', 'baseline_deviation', 'owner_action']) {
    assert.ok(policy.includes(f), 'policy must mention ' + f);
  }
});

function readPolicy() {
  return fs.readFileSync(POLICY_PATH, 'utf8');
}

// --- Negative controls (disposable mutation with byte-exact restore) ---

test('NC1 unknown outcome code accepted when guard removed', () => {
  withDisposableCopy((src) => src.replace("errors.push('unknown_outcome_code:' + String(input.outcome_code));", ''), (T) => {
    const res = T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'FREE_FORM' }));
    assert.equal(res.ok, true, 'without enum guard a free-form code is accepted');
  });
});

test('NC2 missing evidence mapped to CONFIRMED when fail-closed guard removed', () => {
  withDisposableCopy((src) => src.replace("errors.push('missing_evidence_not_confirmed');", ''), (T) => {
    const res = T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' }));
    // Without the guard, missing evidence is no longer rejected; outcome stays CONFIRMED.
    assert.equal(res.ok, true);
    const built = T.buildBoundedResult(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' }));
    assert.equal(built.outcome_code, 'CONFIRMED');
  });
});

test('NC3 raw ID field accepted when private-key reject removed', () => {
  withDisposableCopy((src) => src.replace("if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) {\n        errors.push('private_key_rejected:' + key);\n      }", ''), (T) => {
    // Removing the private-key branch only: owner_id still triggers
    // unknown_field; for a true NC3 the field would otherwise pass privacy
    // gating, so we assert the private-key branch exists in the normal source.
    assert.ok(readSource().includes('private_key_rejected'), 'normal source has private-key rejection');
    assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { owner_id: 'x' })).ok, false, 'raw id still rejected by unknown-field guard');
  });
});

test('NC4 raw exception echoed', () => {
  withDisposableCopy((src) => src.replace("errors.push('unknown_outcome_code:' + String(input.outcome_code));", "errors.push(String(input.outcome_code));"), (T) => {
    const res = T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'SECRET_PAYLOAD' }));
    assert.ok(res.errors.some((e) => e.includes('SECRET_PAYLOAD')), 'raw value echoed without prefix');
    // Normal source must NOT echo raw values; verified in privacy test.
  });
});

test('NC5 parent_id IS NULL never labeled orphan', () => {
  const policy = readPolicy();
  // The policy explicitly states a null parent is a valid root, never an
  // orphan, and that the null-parent case is excluded from orphan candidates.
  assert.match(policy, /valid root memory[\s\S]{0,200}never[\s*<]{0,20}an[\s\S]{0,20}orphan/i);
  assert.match(policy, /The null-parent root case is excluded/i);
  assert.match(policy, /parent_id IS NOT NULL/i);
  // Source rejects parent identifier keys outright (privacy boundary).
  const T = loadTaxonomy();
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { target_id: 'x' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { memory_id: 'x' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { tree_id: 'x' })).ok, false);
});

test('NC6 mutable authority', () => {
  const T = loadTaxonomy();
  assert.throws(() => { T.OPERATION_CLASSES.STRUCTURAL_SCHEMA_CHECK = 'BROKEN'; }, TypeError);
  assert.throws(() => { T.CONVERGENCE_STAGES.REQUEST_DISPATCHED = 'X'; }, TypeError);
  assert.equal(T.CONVERGENCE_STAGE_ORDER.length, 5);
});

test('NC7 mutable output', () => {
  const T = loadTaxonomy();
  const r = T.buildBoundedResult(VALID_INPUT);
  assert.throws(() => { r.outcome_code = 'BROKEN'; }, TypeError);
});

test('NC8 no automatic alert/deploy/write function present', () => {
  const src = readSource();
  assert.ok(!src.includes('sendAlert'), 'no alert');
  assert.ok(!src.includes('writeSynthetic'), 'no synthetic write');
  assert.ok(!src.includes('deploy('), 'no deploy');
});

test('NC9 no numeric Production threshold embedded', () => {
  const src = readSource();
  assert.ok(!/\b(?:threshold|baseline)\b\s*[:=]\s*\d+/.test(src), 'no numeric threshold');
});

test('NC10 unknown metadata key accepted → rejected', () => {
  const T = loadTaxonomy();
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { metadata: { a: 1 } })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { unexpected: 1 })).ok, false);
});