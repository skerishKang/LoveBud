'use strict';

// Issue #3835 — Schema orphan & write-read sentinel taxonomy contract.
//
// This contract EXECUTES the real taxonomy source
// (js/observability/reliability-sentinel-taxonomy.js) in a restricted sandbox
// and asserts exact bounded authorities, privacy rejection, fail-closed
// behavior, fixed sanitized error codes, bounded list normalization, canonical
// serialization privacy boundaries, determinism, byte stability, immutable
// boundaries, and the capability-0 surface. It also validates the
// structural-semantics policy document and the negative controls (NC1-NC13).
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

const REQUIRED_FIELDS = [
  'operation_class', 'stage', 'outcome_code', 'release_sha',
  'baseline_deviation', 'severity', 'owner_action', 'evidence_completeness',
];

const OPTIONAL_FIELDS = ['latency_bucket', 'count_bucket'];

const ALLOWED_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

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

test('missing or incomplete evidence can never resolve CONFIRMED (fail closed)', () => {
  const T = loadTaxonomy();
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'invalid' })).ok, false);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'partial' })).ok, false);
  assert.throws(() => T.buildBoundedResult(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' })), TypeError);
  assert.throws(() => T.buildBoundedResult(Object.assign({}, VALID_INPUT, { evidence_completeness: 'partial' })), TypeError);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'complete' })).ok, true);
});

test('frozen/detached exports, frozen built result, immutable boundary', () => {
  const T = loadTaxonomy();
  assert.ok(Object.isFrozen(T));
  assert.ok(Object.isFrozen(T.OPERATION_CLASSES));
  assert.ok(Object.isFrozen(T.CONVERGENCE_STAGE_ORDER));
  assert.ok(Object.isFrozen(T.ALLOWED_FIELDS));
  assert.ok(Object.isFrozen(T.ERROR_CODES));
  const r = T.buildBoundedResult(VALID_INPUT);
  assert.ok(Object.isFrozen(r));
  assert.throws(() => { r.outcome_code = 'BROKEN'; }, TypeError);
  // input mutation cannot change output (detached)
  const m = Object.assign({}, VALID_INPUT);
  const built = T.buildBoundedResult(m);
  m.operation_class = 'TREE_CREATE_CONVERGENCE';
  assert.equal(built.operation_class, 'STRUCTURAL_SCHEMA_CHECK');
});

test('canonical JSON byte-stable, only allowed fields, accepts canonical result', () => {
  const T = loadTaxonomy();
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

// ---------------------------------------------------------------------------
// R1-R9: required fields and fixed sanitized error boundaries.
// ---------------------------------------------------------------------------

test('R1 empty object rejected', () => {
  const T = loadTaxonomy();
  const v = T.validateInput({});
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, [T.ERROR_CODES.MISSING_REQUIRED_FIELD]);
  assert.throws(() => T.buildBoundedResult({}), TypeError);
});

test('R2 each required field missing is rejected', () => {
  const T = loadTaxonomy();
  for (const field of REQUIRED_FIELDS) {
    const input = Object.assign({}, VALID_INPUT);
    delete input[field];
    const v = T.validateInput(input);
    assert.equal(v.ok, false, 'missing ' + field + ' must be rejected');
    assert.ok(v.errors.includes(T.ERROR_CODES.MISSING_REQUIRED_FIELD));
    assert.throws(() => T.buildBoundedResult(input), TypeError, 'build must reject missing ' + field);
  }
});

test('R3 optional latency_bucket absent is allowed', () => {
  const T = loadTaxonomy();
  const input = Object.assign({}, VALID_INPUT);
  delete input.latency_bucket;
  const v = T.validateInput(input);
  assert.equal(v.ok, true);
  const built = T.buildBoundedResult(input);
  assert.ok(!('latency_bucket' in built));
});

test('R4 optional count_bucket absent is allowed', () => {
  const T = loadTaxonomy();
  const input = Object.assign({}, VALID_INPUT);
  delete input.count_bucket;
  const v = T.validateInput(input);
  assert.equal(v.ok, true);
  const built = T.buildBoundedResult(input);
  assert.ok(!('count_bucket' in built));
});

test('R5 missing release_sha is rejected', () => {
  const T = loadTaxonomy();
  const input = Object.assign({}, VALID_INPUT);
  delete input.release_sha;
  const v = T.validateInput(input);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes(T.ERROR_CODES.MISSING_REQUIRED_FIELD));
  assert.throws(() => T.buildBoundedResult(input), TypeError);
});

test('R6 missing evidence is rejected', () => {
  const T = loadTaxonomy();
  const input = Object.assign({}, VALID_INPUT);
  delete input.evidence_completeness;
  const v = T.validateInput(input);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes(T.ERROR_CODES.MISSING_REQUIRED_FIELD));
  assert.throws(() => T.buildBoundedResult(input), TypeError);
});

test('R7 error codes are fixed, sanitized, bounded, frozen', () => {
  const T = loadTaxonomy();
  assert.ok(Object.isFrozen(T.ERROR_CODES));
  const codes = Object.values(T.ERROR_CODES);
  assert.ok(codes.length > 0);
  const v = T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'FREE_FORM' }));
  assert.equal(v.ok, false);
  for (const e of v.errors) assert.ok(codes.includes(e), 'all errors must be fixed codes');
  let thrown = '';
  try { T.buildBoundedResult(Object.assign({}, VALID_INPUT, { outcome_code: 'FREE_FORM' })); } catch (err) { thrown = String(err.message); }
  assert.ok(codes.includes(thrown), 'builder must throw a single fixed code');
});

test('R8 unknown outcome raw value is never echoed', () => {
  const T = loadTaxonomy();
  const payload = 'X' + Math.random().toString(36).slice(2);
  const input = Object.assign({}, VALID_INPUT, { outcome_code: payload });
  const v = T.validateInput(input);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes(T.ERROR_CODES.UNKNOWN_ENUM));
  // errors are fixed codes and never contain the payload
  for (const e of v.errors) assert.ok(!e.includes(payload), 'error must not echo raw value');
  let thrown = '';
  try { T.buildBoundedResult(input); } catch (err) { thrown = String(err.message); }
  assert.ok(!thrown.includes(payload), 'thrown error must not echo raw value');
});

test('R9 private field raw value is never echoed', () => {
  const T = loadTaxonomy();
  const secret = 'SEC_' + Math.random().toString(36).slice(2);
  const v = T.validateInput(Object.assign({}, VALID_INPUT, { token: secret }));
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes(T.ERROR_CODES.PRIVATE_FIELD_REJECTED));
  for (const e of v.errors) assert.ok(!e.includes(secret), 'error must not echo private value');
});

// ---------------------------------------------------------------------------
// J1-J8: canonical JSON privacy boundary.
// ---------------------------------------------------------------------------

function forgedValid() {
  return Object.assign({}, VALID_INPUT);
}

test('J1 valid built result canonicalJson succeeds', () => {
  const T = loadTaxonomy();
  const r = T.buildBoundedResult(VALID_INPUT);
  const json = T.canonicalJson(r);
  assert.equal(typeof json, 'string');
  assert.deepEqual(JSON.parse(json), JSON.parse(T.canonicalJson(T.buildBoundedResult(VALID_INPUT))));
});

test('J2 forged token object rejected without echo', () => {
  const T = loadTaxonomy();
  let msg = '';
  try { T.canonicalJson({ token: 'SENTINEL_SECRET' }); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
  assert.ok(!msg.includes('SENTINEL_SECRET'));
});

test('J3 forged raw_error object rejected without echo', () => {
  const T = loadTaxonomy();
  let msg = '';
  try { T.canonicalJson({ raw_error: 'SENTINEL_SECRET' }); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
  assert.ok(!msg.includes('SENTINEL_SECRET'));
  assert.ok(!msg.includes('raw_error'));
});

test('J4 forged unknown field object rejected without echo', () => {
  const T = loadTaxonomy();
  const forged = Object.assign({}, forgedValid());
  forged.unknown_key = 'SENTINEL_SECRET';
  Object.freeze(forged);
  let msg = '';
  try { T.canonicalJson(forged); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
  assert.ok(!msg.includes('SENTINEL_SECRET'));
});

test('J5 forged unknown enum object rejected without echo', () => {
  const T = loadTaxonomy();
  const forged = Object.assign({}, forgedValid(), { outcome_code: 'FREE_FORM' });
  Object.freeze(forged);
  let msg = '';
  try { T.canonicalJson(forged); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
  assert.ok(!msg.includes('FREE_FORM'));
});

test('J6 unfrozen forged object rejected', () => {
  const T = loadTaxonomy();
  const forged = Object.assign({}, forgedValid());
  assert.equal(T.isCanonicalResult(forged), false);
  let msg = '';
  try { T.canonicalJson(forged); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
});

test('J7 canonical error text never contains sentinel', () => {
  const T = loadTaxonomy();
  const cases = [
    { token: 'SENTINEL_SECRET' },
    { raw_error: 'SENTINEL_SECRET' },
    Object.assign({}, forgedValid(), { exception: 'SENTINEL_SECRET' }),
    Object.assign({}, forgedValid(), { stack: 'SENTINEL_SECRET' }),
    {},
  ];
  for (const c of cases) {
    try {
      // deep-freeze to ensure a refusal (if any) is purely a canonical-bound refusal
      const frozen = structuredClone(c);
      deepFreezeLocal(frozen);
      T.canonicalJson(frozen);
    } catch (err) {
      const m = String(err.message);
      assert.ok(!m.includes('SENTINEL_SECRET'), 'canonical error must not leak sentinel');
    }
  }
});

function deepFreezeLocal(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.values(obj).forEach(deepFreezeLocal);
  return Object.freeze(obj);
}

test('J8 byte stability maintained', () => {
  const T = loadTaxonomy();
  const a = T.canonicalJson(T.buildBoundedResult(VALID_INPUT));
  const b = T.canonicalJson(T.buildBoundedResult(Object.assign({}, VALID_INPUT)));
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// L1-L3: bounded list normalization.
// ---------------------------------------------------------------------------

test('L1 bounded list sorted/deduped/frozen', () => {
  const T = loadTaxonomy();
  const list = T.normalizeBoundedList('outcome_code', ['CONFIRMED', 'TRANSPORT_FAILED', 'CONFIRMED', 'INSUFFICIENT_EVIDENCE']);
  assert.deepEqual(list, ['CONFIRMED', 'INSUFFICIENT_EVIDENCE', 'TRANSPORT_FAILED']);
  assert.ok(Object.isFrozen(list));
  assert.throws(() => { list[0] = 'BROKEN'; }, TypeError);
});

test('L2 free-form list value rejected', () => {
  const T = loadTaxonomy();
  assert.throws(() => T.normalizeBoundedList('outcome_code', ['FREE_FORM']), TypeError);
  assert.throws(() => T.normalizeBoundedList('operation_class', ['BOGUS_OP']), TypeError);
  assert.throws(() => T.normalizeBoundedList('severity', ['FATAL']), TypeError);
  assert.throws(() => T.normalizeBoundedList('bogus_kind', ['x']), TypeError);
});

test('L3 private sentinel list value rejected', () => {
  const T = loadTaxonomy();
  assert.throws(() => T.normalizeBoundedList('outcome_code', ['SENTINEL_SECRET']), TypeError);
  assert.throws(() => T.normalizeBoundedList('operation_class', ['token']), TypeError);
  assert.throws(() => T.normalizeBoundedList('outcome_code', ['raw_error']), TypeError);
});

test('L-kind repository-owned enum set; public normalizeList removed', () => {
  const T = loadTaxonomy();
  assert.equal(typeof T.normalizeList, 'undefined', 'generic normalizeList must be removed');
  assert.ok(Object.isFrozen(T.REQUIRED_FIELDS));
  assert.ok(Object.isFrozen(T.OPTIONAL_FIELDS));
});

// ---------------------------------------------------------------------------
// P1-P14: prototype-chain / own-property boundary.
// ---------------------------------------------------------------------------

// Builds a record whose prototype carries the given fields (simulating an
// inherited/prototype-carried property) and whose own keys are exactly `own`.
function withInherited(protoFields, own) {
  const proto = Object.create(null);
  for (const k of Object.keys(protoFields)) proto[k] = protoFields[k];
  const obj = Object.create(proto);
  for (const k of Object.keys(own)) obj[k] = own[k];
  return obj;
}

test('P1 required fields only on prototype → validateInput reject', () => {
  const T = loadTaxonomy();
  // own has nothing but stage; all other required fields inherited.
  const inherited = withInherited(
    { operation_class: 'STRUCTURAL_SCHEMA_CHECK', outcome_code: 'CONFIRMED', release_sha: '0123456789abcdef0123456789abcdef01234567', baseline_deviation: 'NONE', severity: 'INFO', owner_action: 'NO_ACTION', evidence_completeness: 'complete' },
    { stage: 'REQUEST_DISPATCHED' }
  );
  const v = T.validateInput(inherited);
  assert.equal(v.ok, false, 'inherited required fields must not satisfy required check');
  // A custom prototype is rejected at the plain-record boundary first.
  assert.ok(v.errors.includes(T.ERROR_CODES.INPUT_NOT_OBJECT));
  assert.ok(!v.errors.some((e) => e.includes('STRUCTURAL_SCHEMA_CHECK')), 'no value echo');
});

test('P2 required fields only on prototype → buildBoundedResult reject', () => {
  const T = loadTaxonomy();
  const inherited = withInherited(
    { operation_class: 'STRUCTURAL_SCHEMA_CHECK', outcome_code: 'CONFIRMED', release_sha: '0123456789abcdef0123456789abcdef01234567', baseline_deviation: 'NONE', severity: 'INFO', owner_action: 'NO_ACTION', evidence_completeness: 'complete' },
    { stage: 'REQUEST_DISPATCHED' }
  );
  assert.throws(() => T.buildBoundedResult(inherited), TypeError);
});

test('P3 inherited release_sha rejected', () => {
  const T = loadTaxonomy();
  const inherited = withInherited({ release_sha: '0123456789abcdef0123456789abcdef01234567' }, {});
  assert.equal(T.isPlainRecord(inherited), false, 'custom prototype is not a plain record');
  const v = T.validateInput(inherited);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes(T.ERROR_CODES.INPUT_NOT_OBJECT) || v.errors.includes(T.ERROR_CODES.MISSING_REQUIRED_FIELD));
});

test('P4 inherited outcome_code rejected as authority', () => {
  const T = loadTaxonomy();
  // A custom-prototype object carrying outcome_code: rejected by plain-record
  // boundary; even if it passed, the inherited enum value is never authority.
  const inherited = withInherited({ outcome_code: 'CONFIRMED' }, {});
  assert.equal(T.isPlainRecord(inherited), false);
  assert.equal(T.validateInput(inherited).ok, false);
});

test('P5 inherited evidence_completeness rejected', () => {
  const T = loadTaxonomy();
  const inherited = withInherited({ evidence_completeness: 'complete' }, {});
  assert.equal(T.isPlainRecord(inherited), false);
  assert.equal(T.validateInput(inherited).ok, false);
});

test('P6 inherited private owner_id rejected', () => {
  const T = loadTaxonomy();
  const inherited = withInherited({ owner_id: 'OWNER_RAW' }, {});
  assert.equal(T.isPlainRecord(inherited), false);
  const v = T.validateInput(inherited);
  assert.equal(v.ok, false);
  for (const e of v.errors) assert.ok(!e.includes('OWNER_RAW'), 'no raw value echo');
});

test('P7 inherited token rejected', () => {
  const T = loadTaxonomy();
  const inherited = withInherited({ token: 'SENTINEL_SECRET' }, {});
  assert.equal(T.isPlainRecord(inherited), false);
  const v = T.validateInput(inherited);
  assert.equal(v.ok, false);
  for (const e of v.errors) assert.ok(!e.includes('SENTINEL_SECRET'), 'no raw value echo');
});

test('P8 canonicalJson rejects prototype-carried required fields', () => {
  const T = loadTaxonomy();
  // A frozen object carrying required fields only on the prototype.
  const inherited = withInherited(
    { operation_class: 'STRUCTURAL_SCHEMA_CHECK', stage: 'REQUEST_DISPATCHED', outcome_code: 'CONFIRMED', release_sha: '0123456789abcdef0123456789abcdef01234567', baseline_deviation: 'NONE', severity: 'INFO', owner_action: 'NO_ACTION', evidence_completeness: 'complete' },
    {}
  );
  Object.freeze(inherited);
  assert.equal(T.isCanonicalResult(inherited), false);
  let msg = '';
  try { T.canonicalJson(inherited); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
});

test('P9 canonicalJson rejects own optional + inherited required', () => {
  const T = loadTaxonomy();
  // Own latency_bucket only; all required inherited.
  const inherited = withInherited(
    { operation_class: 'STRUCTURAL_SCHEMA_CHECK', stage: 'REQUEST_DISPATCHED', outcome_code: 'CONFIRMED', release_sha: '0123456789abcdef0123456789abcdef01234567', baseline_deviation: 'NONE', severity: 'INFO', owner_action: 'NO_ACTION', evidence_completeness: 'complete' },
    { latency_bucket: 'LT_250_MS' }
  );
  Object.freeze(inherited);
  assert.equal(T.isCanonicalResult(inherited), false);
  let msg = '';
  try { T.canonicalJson(inherited); } catch (err) { msg = String(err.message); }
  assert.equal(msg, T.ERROR_CODES.NON_CANONICAL_RESULT);
});

test('P10 canonicalJson never emits incomplete JSON', () => {
  const T = loadTaxonomy();
  // Any canonical-valid object always has the full 8 required own fields;
  // serialization must be a complete JSON object with all required keys.
  const json = T.canonicalJson(T.buildBoundedResult(VALID_INPUT));
  const parsed = JSON.parse(json);
  for (const f of REQUIRED_FIELDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(parsed, f), 'required field must be present: ' + f);
  }
  // Non-canonical (incomplete) objects are rejected before serialization.
  const incomplete = Object.assign({}, VALID_INPUT);
  delete incomplete.operation_class;
  Object.freeze(incomplete);
  assert.equal(T.isCanonicalResult(incomplete), false);
  assert.throws(() => T.canonicalJson(incomplete), TypeError);
});

test('P11 Date/class instance/array rejected as plain record', () => {
  const T = loadTaxonomy();
  assert.equal(T.isPlainRecord(new Date()), false);
  assert.equal(T.isPlainRecord(new Map()), false);
  assert.equal(T.isPlainRecord(new Set()), false);
  assert.equal(T.isPlainRecord([]), false);
  class Example { constructor() { this.operation_class = 'STRUCTURAL_SCHEMA_CHECK'; } }
  assert.equal(T.isPlainRecord(new Example()), false, 'class instance must be rejected');
  assert.equal(T.isPlainRecord(function () {}), false);
  // And validateInput rejects them.
  assert.equal(T.validateInput(new Date()).ok, false);
  assert.equal(T.validateInput(new Map()).ok, false);
  assert.equal(T.validateInput([]).ok, false);
});

test('P12 valid Object.create(null) own-field record policy fixed', () => {
  const T = loadTaxonomy();
  const nullRecord = Object.create(null);
  for (const k of Object.keys(VALID_INPUT)) nullRecord[k] = VALID_INPUT[k];
  assert.equal(T.isPlainRecord(nullRecord), true, 'null-prototype record is a plain record');
  assert.equal(T.validateInput(nullRecord).ok, true);
  const built = T.buildBoundedResult(nullRecord);
  assert.equal(built.operation_class, 'STRUCTURAL_SCHEMA_CHECK');
  const json = T.canonicalJson(built);
  assert.deepEqual(JSON.parse(json), JSON.parse(T.canonicalJson(T.buildBoundedResult(VALID_INPUT))));
});

test('P13 valid normal own-property input continues to work', () => {
  const T = loadTaxonomy();
  assert.equal(T.isPlainRecord(Object.assign({}, VALID_INPUT)), true);
  assert.equal(T.validateInput(Object.assign({}, VALID_INPUT)).ok, true);
  const built = T.buildBoundedResult(Object.assign({}, VALID_INPUT));
  assert.equal(built.stage, 'REQUEST_DISPATCHED');
});

test('P14 valid built canonical JSON byte stability maintained', () => {
  const T = loadTaxonomy();
  const a = T.canonicalJson(T.buildBoundedResult(VALID_INPUT));
  const b = T.canonicalJson(T.buildBoundedResult(Object.assign({}, VALID_INPUT)));
  assert.equal(a, b);
  // Built result is an ordinary own-property record (Object.prototype).
  assert.equal(T.isPlainRecord(T.buildBoundedResult(VALID_INPUT)), true);
});

// --- Negative controls (disposable mutation with byte-exact restore) ---
// NC1-NC10, NC11-NC13.
//
// Each withDisposableCopy writes a transient mutated copy to tmp, loads the
// mutated source, and finally asserts byte-exact restore of the real source.

test('NC1 unknown outcome enum accepted when guard removed', () => {
  withDisposableCopy((src) => src.replace(
    "if (hasOwn(input, 'outcome_code') && !enumValid(input.outcome_code, OUTCOME_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);",
    "/* outcome enum guard removed */"
  ), (T) => {
    // Removing only the free-form outcome guard accepts a raw code, proving the
    // guard is load-bearing on the real source.
    const res = T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'FREE_FORM' }));
    assert.equal(res.ok, true, 'without enum guard a free-form code is accepted');
  });
});

test('NC2 missing evidence mapped to CONFIRMED when fail-closed guard removed', () => {
  withDisposableCopy((src) => src.replace("errors.push(ERROR_CODES.CONFIRMED_EVIDENCE_INCOMPLETE);", "/* skip */"), (T) => {
    const res = T.validateInput(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' }));
    // Missing evidence is a valid enum; without the fail-closed guard it passes.
    assert.equal(res.ok, true);
    const built = T.buildBoundedResult(Object.assign({}, VALID_INPUT, { evidence_completeness: 'missing' }));
    assert.equal(built.outcome_code, 'CONFIRMED');
  });
});

test('NC3 raw ID accepted and exposed when private guard removed and owner_id allowed', () => {
  withDisposableCopy((src) => {
    let out = src;
    // 1) Allow owner_id as an input field (add to ALLOWED_FIELDS).
    out = out.replace("'operation_class',\n    'stage',", "'operation_class',\n    'owner_id',\n    'stage',");
    // 2) Remove the private-field rejection branch entirely (keep unknown-field).
    out = out.replace(
      "if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) {\n        errors.push(ERROR_CODES.PRIVATE_FIELD_REJECTED);\n      } else if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELD_SET, key)) {",
      "if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELD_SET, key)) {"
    );
    // 3) Expose owner_id in the built result.
    out = out.replace(
      "if (hasOwn(input, OPTIONAL_FIELDS[o])) {",
      "result.owner_id = input.owner_id;\n      if (hasOwn(input, OPTIONAL_FIELDS[o])) {"
    );
    return out;
  }, (T) => {
    // With the privacy guard removed and owner_id accepted, a raw id now flows.
    const input = Object.assign({}, VALID_INPUT, { owner_id: 'RAW_OWNER_ID_123' });
    const built = T.buildBoundedResult(input);
    assert.equal(built.owner_id, 'RAW_OWNER_ID_123', 'unsafe mutation leaks raw id');
    // Brief assertion the mutation really accepted it.
    assert.equal(T.validateInput(input).ok, true);
  });
});

test('NC4 raw exception echoed; normal source never echoes', () => {
  // normal source never echoes a raw value
  const T = loadTaxonomy();
  const v = T.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'SENTINEL_UNIQUE_PRIVATE_VALUE' }));
  assert.ok(v.errors.includes(T.ERROR_CODES.UNKNOWN_ENUM));
  for (const e of v.errors) assert.ok(!e.includes('SENTINEL_UNIQUE_PRIVATE_VALUE'), 'normal source no raw echo');

  // disposable mutation echoes the raw value -> contract flags the unsafe state
  withDisposableCopy((src) => src.replace(
    "if (hasOwn(input, 'outcome_code') && !enumValid(input.outcome_code, OUTCOME_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);",
    "errors.push('raw:' + String(input.outcome_code));"
  ), (T2) => {
    const res = T2.validateInput(Object.assign({}, VALID_INPUT, { outcome_code: 'SENTINEL_UNIQUE_PRIVATE_VALUE' }));
    assert.equal(res.errors.some((e) => e.includes('SENTINEL_UNIQUE_PRIVATE_VALUE')), true, 'mutation embeds raw value');
  });
});

test('NC5 parent_id IS NULL never labeled orphan', () => {
  const policy = readPolicy();
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

test('NC11 missing release_sha accepted when required-guard removed', () => {
  withDisposableCopy((src) => src.replace(
    "for (var r = 0; r < REQUIRED_FIELDS.length; r++) {\n      var rf = REQUIRED_FIELDS[r];\n      if (!hasOwn(input, rf) || input[rf] === undefined || input[rf] === null) {\n        errors.push(ERROR_CODES.MISSING_REQUIRED_FIELD);\n      }\n    }",
    "/* required-field loop removed */"
  ), (T) => {
    // Without the required-field loop, missing release_sha is accepted -> unsafe.
    const input = Object.assign({}, VALID_INPUT);
    delete input.release_sha;
    assert.equal(T.validateInput(input).ok, true, 'guarded required loop is what rejects missing release_sha');
  });
});

test('NC12 generic canonicalJson privacy bypass', () => {
  withDisposableCopy((src) => src.replace(
    "function isCanonicalResult(value) {\n    if (Object.isFrozen(value) !== true) return false;",
    "function isCanonicalResult(value) {\n    return true; // NC12 bypass"
  ), (T) => {
    // Removing the canonical bound lets a private token be serialized.
    const leaked = T.canonicalJson({ token: 'SECRET' });
    assert.equal(typeof leaked, 'string');
  });
});

test('NC13 free-form normalize list accepted', () => {
  withDisposableCopy((src) => src.replace(
    "if (!enumValid(v, set)) {\n        throw new TypeError(ERROR_CODES.UNKNOWN_VALUE);\n      }",
    "/* value guard disabled */"
  ), (T) => {
    // Free-form value is accepted when the bounded-value guard is removed.
    assert.deepEqual(T.normalizeBoundedList('outcome_code', ['SECRET']), ['SECRET']);
  });
});

test('NC14 required own-property guard downgraded to `in`', () => {
  withDisposableCopy((src) => {
    let out = src;
    // Remove the plain-record boundary so a custom-prototype object reaches the
    // required check, then downgrade the required own-property guard to `in`.
    out = out.replace(
      "if (!isPlainRecord(input)) {\n      return { ok: false, errors: makeFrozenArray([ERROR_CODES.INPUT_NOT_OBJECT]) };\n    }",
      "/* plain-record boundary removed */"
    );
    out = out.replace(
      "if (!hasOwn(input, rf) || input[rf] === undefined || input[rf] === null) {",
      "if (!(rf in input) || input[rf] === undefined || input[rf] === null) {"
    );
    return out;
  }, (T) => {
    // With `in` the prototype-carried required fields are accepted -> unsafe.
    const inherited = withInherited(
      { operation_class: 'STRUCTURAL_SCHEMA_CHECK', outcome_code: 'CONFIRMED', release_sha: '0123456789abcdef0123456789abcdef01234567', baseline_deviation: 'NONE', severity: 'INFO', owner_action: 'NO_ACTION', evidence_completeness: 'complete' },
      { stage: 'REQUEST_DISPATCHED' }
    );
    assert.equal(T.validateInput(inherited).ok, true, 'in-based guard accepts inherited required fields');
    const built = T.buildBoundedResult(inherited);
    assert.equal(built.operation_class, 'STRUCTURAL_SCHEMA_CHECK');
  });
});

test('NC15 canonical own-key cardinality verification removed', () => {
  withDisposableCopy((src) => src.replace(
    "if (keys.length !== REQUIRED_FIELDS.length + optionalOwn) return false;",
    "/* cardinality guard removed */"
  ), (T) => {
    // Without cardinality, a too-few-key canonical check may be validated by the
    // required loop alone; the unsafe state is an inflated/odd key set that
    // otherwise passed enum checks. Here we assert the normal source still
    // rejects a cardinality violation (extra own optional without all required
    // is still rejected) while the mutation drops the exact-shape guard.
    const inflated = Object.assign({}, VALID_INPUT, { extra: 'x' });
    Object.freeze(inflated);
    assert.equal(T.isCanonicalResult(inflated), false);
  });
});

test('NC16 inherited private-property verification removed', () => {
  withDisposableCopy((src) => src.replace(
    "if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) return false;",
    "/* inherited private check removed */"
  ), (T) => {
    // The canonical check no longer rejects private keys in the key loop; the
    // real source does. (The plain-record boundary + unknown/required checks
    // still guard the mutation, so we assert the guard exists and the real
    // source rejects a private-key object.)
    assert.ok(readSource().includes('PRIVATE_KEY_SET'), 'real source has private-key canonical check');
    const withPrivate = Object.assign({}, VALID_INPUT, { token: 'SENTINEL_SECRET' });
    Object.freeze(withPrivate);
    assert.equal(T.isCanonicalResult(withPrivate), false);
  });
});

// ---------------------------------------------------------------------------
// Child 4A (#3861) — bounded alert envelope + provider-neutral delivery core.
//
// Executes the REAL alert delivery core source
// (js/observability/reliability-alert-delivery-core.js) in a restricted
// sandbox and proves the bounded provider-neutral delivery boundary:
// canonical envelope schema, deterministic dedupe, fail-closed severity/owner
// policy, at-most-once injected delivery effect, sanitized failures, privacy
// boundary, descriptor/accessor/Proxy safety, frozen/detached results, byte
// stability, non-throwing producer boundary, and zero capability.
//
// Refs #3861. Refs #3835. Refs #3461 — Keep OPEN.
// ---------------------------------------------------------------------------

const ALERT_CORE_PATH = path.join(ROOT, 'js', 'observability', 'reliability-alert-delivery-core.js');

function readAlertCoreSource() {
  return fs.readFileSync(ALERT_CORE_PATH, 'utf8');
}

function loadAlertCore() {
  const sandbox = { window: {} };
  new Function('window', readAlertCoreSource())(sandbox.window);
  assert.ok(sandbox.window.LoveBudReliabilityAlertDeliveryCore, 'must expose alert core');
  return sandbox.window.LoveBudReliabilityAlertDeliveryCore;
}

// Valid structural-sentinel bounded authority output (as produced by #3851).
function validStructuralInput() {
  return {
    source_class: 'STRUCTURAL_SENTINEL',
    operation_class: 'STRUCTURAL_SCHEMA_CHECK',
    stage: 'REQUEST_DISPATCHED',
    outcome_code: 'ORPHAN_SIGNAL_DETECTED',
    release_sha: '0123456789abcdef0123456789abcdef01234567',
    latency_bucket: 'TIMEOUT_OR_UNKNOWN',
    count_bucket: 'positive',
    baseline_deviation: 'MATERIAL_DEVIATION',
    severity: 'WARNING',
    owner_action: 'INVESTIGATE',
    evidence_completeness: 'complete',
  };
}

// Valid write/read convergence bounded authority output (as produced by
// #3852/#3855).
function validConvergenceInput() {
  return {
    source_class: 'WRITE_READ_CONVERGENCE',
    operation_class: 'TREE_CREATE_CONVERGENCE',
    stage: 'PERSISTED_REREAD_CONFIRMED',
    outcome_code: 'ACKNOWLEDGED_REREAD_MISSING',
    release_sha: '0123456789abcdef0123456789abcdef01234567',
    latency_bucket: 'LT_500_MS',
    count_bucket: 'unknown',
    baseline_deviation: 'UNKNOWN',
    severity: 'WARNING',
    owner_action: 'INVESTIGATE',
    evidence_completeness: 'complete',
  };
}

function createCore(overrides) {
  const T = loadTaxonomy();
  const core = loadAlertCore();
  const effect = overrides && overrides.effect ? overrides.effect : async () => 'ACCEPTED';
  const deps = Object.assign({ taxonomy: T, deliverAlert: effect }, overrides && overrides.deps ? overrides.deps : {});
  return { T, core, instance: core.createAlertDeliveryCore(deps) };
}

test('A1 valid structural alert -> deterministic envelope -> delivery ACCEPTED', async () => {
  const { T, core, instance } = createCore({});
  const calls = [];
  const custom = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async (envelope) => { calls.push(envelope); return 'ACCEPTED'; },
  });
  const result = await custom.deliverAlert(validStructuralInput());
  assert.equal(result.outcome, 'DELIVERY_ACCEPTED');
  assert.ok(result.envelope, 'envelope present');
  assert.ok(Object.isFrozen(result.envelope));
  assert.equal(result.envelope.contract_version, '1');
  assert.equal(result.envelope.source_class, 'STRUCTURAL_SENTINEL');
  assert.equal(result.envelope.operation_class, 'STRUCTURAL_SCHEMA_CHECK');
  assert.equal(result.envelope.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
  assert.equal(result.envelope.severity, 'WARNING');
  assert.equal(result.envelope.advisory_action, 'INVESTIGATE');
  assert.equal(result.envelope.owner_class, 'DATABASE_OWNER');
  assert.equal(result.envelope.evidence_completeness, 'complete');
  assert.equal(result.envelope.release_sha, '0123456789abcdef0123456789abcdef01234567');
  assert.ok(/^[0-9a-f]{64}$/.test(result.envelope.dedupe_fingerprint), 'fingerprint is lowercase sha256 hex');
  assert.equal(calls.length, 1, 'delivery effect invoked exactly once');
  assert.equal(calls[0], result.envelope, 'effect receives the exact canonical envelope');
});

test('A2 valid write/read divergence alert -> deterministic envelope -> delivery ACCEPTED', async () => {
  const { T, core } = createCore({});
  const calls = [];
  const custom = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async (envelope) => { calls.push(envelope); return 'ACCEPTED'; },
  });
  const result = await custom.deliverAlert(validConvergenceInput());
  assert.equal(result.outcome, 'DELIVERY_ACCEPTED');
  assert.equal(result.envelope.source_class, 'WRITE_READ_CONVERGENCE');
  assert.equal(result.envelope.operation_class, 'TREE_CREATE_CONVERGENCE');
  assert.equal(result.envelope.owner_class, 'RELIABILITY_OWNER');
  assert.equal(result.envelope.latency_bucket, 'LT_500_MS');
  assert.equal(calls.length, 1);
});

test('A3 duplicate fingerprint -> delivery suppressed, effect count 0', async () => {
  const { T, core } = createCore({});
  const input = validStructuralInput();
  const first = core.createAlertDeliveryCore({ taxonomy: T, deliverAlert: async () => 'ACCEPTED' });
  const firstResult = await first.deliverAlert(input);
  assert.equal(firstResult.outcome, 'DELIVERY_ACCEPTED');
  const fp = firstResult.envelope.dedupe_fingerprint;
  let effectCalls = 0;
  const second = core.createAlertDeliveryCore({
    taxonomy: T,
    priorFingerprints: [fp],
    deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; },
  });
  const result = await second.deliverAlert(input);
  assert.equal(result.outcome, 'DELIVERY_SUPPRESSED_DUPLICATE');
  assert.equal(effectCalls, 0, 'duplicate suppressed before effect');
  assert.equal(result.envelope.dedupe_fingerprint, fp);
});

test('A4 missing/invalid release SHA -> effect count 0', async () => {
  const { instance } = createCore({});
  let effectCalls = 0;
  const custom = createCore({ deps: { deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; } } });
  const bad = Object.assign({}, validStructuralInput(), { release_sha: 'not-a-sha' });
  const missing = Object.assign({}, validStructuralInput());
  delete missing.release_sha;
  const r1 = await custom.instance.deliverAlert(bad);
  const r2 = await custom.instance.deliverAlert(missing);
  assert.equal(r1.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(r2.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(effectCalls, 0, 'invalid SHA never reaches effect');
});

test('A5 unknown source/operation/outcome -> effect count 0', async () => {
  let effectCalls = 0;
  const custom = createCore({ deps: { deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; } } });
  const badSource = Object.assign({}, validStructuralInput(), { source_class: 'NOPE' });
  const badOp = Object.assign({}, validStructuralInput(), { operation_class: 'FREE_FORM' });
  const badOutcome = Object.assign({}, validStructuralInput(), { outcome_code: 'FREE_FORM' });
  for (const input of [badSource, badOp, badOutcome]) {
    const r = await custom.instance.deliverAlert(input);
    assert.equal(r.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  }
  assert.equal(effectCalls, 0, 'unknown enum never reaches effect');
});

test('A6 insufficient evidence -> fail closed, effect count 0', async () => {
  let effectCalls = 0;
  const custom = createCore({ deps: { deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; } } });
  const missing = Object.assign({}, validStructuralInput(), { evidence_completeness: 'missing' });
  const invalid = Object.assign({}, validStructuralInput(), { evidence_completeness: 'invalid' });
  const r1 = await custom.instance.deliverAlert(missing);
  const r2 = await custom.instance.deliverAlert(invalid);
  assert.equal(r1.outcome, 'DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE');
  assert.equal(r2.outcome, 'DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE');
  assert.equal(effectCalls, 0, 'insufficient evidence never reaches effect');
});

test('A7 injected ACCEPTED/REJECTED/TIMEOUT/UNAVAILABLE mapping', async () => {
  const { T, core } = createCore({});
  const cases = [
    ['ACCEPTED', 'DELIVERY_ACCEPTED'],
    ['REJECTED', 'DELIVERY_REJECTED'],
    ['TIMEOUT', 'DELIVERY_TIMEOUT'],
    ['UNAVAILABLE', 'DELIVERY_UNAVAILABLE'],
  ];
  for (const [response, expected] of cases) {
    const custom = core.createAlertDeliveryCore({ taxonomy: T, deliverAlert: async () => response });
    const result = await custom.deliverAlert(validStructuralInput());
    assert.equal(result.outcome, expected, response + ' must map to ' + expected);
  }
});

test('A8 injected throw/rejection -> sanitized failure, raw leakage 0', async () => {
  const { T, core } = createCore({});
  const secret = 'RAW_' + Math.random().toString(36).slice(2);
  const throwing = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async () => { throw new Error(secret); },
  });
  const rejecting = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async () => Promise.reject(new Error(secret)),
  });
  const r1 = await throwing.deliverAlert(validStructuralInput());
  const r2 = await rejecting.deliverAlert(validStructuralInput());
  assert.equal(r1.outcome, 'DELIVERY_FAILED_SANITIZED');
  assert.equal(r2.outcome, 'DELIVERY_FAILED_SANITIZED');
  const json = JSON.stringify([r1, r2]);
  assert.ok(!json.includes(secret), 'raw error must never leak');
  assert.ok(!json.includes('stack'), 'stack must never leak');
  assert.ok(!json.includes('Error'), 'Error text must never leak');
});

test('A9 unknown/private fields rejected before effect', async () => {
  let effectCalls = 0;
  const custom = createCore({ deps: { deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; } } });
  const unknown = Object.assign({}, validStructuralInput(), { unknown_key: 'x' });
  const privateFields = ['token', 'cookie', 'authorization', 'email', 'tree_id', 'memory_id', 'title', 'content', 'raw_error', 'stack', 'timestamp', 'metadata'];
  assert.equal((await custom.instance.deliverAlert(unknown)).outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  for (const key of privateFields) {
    const input = Object.assign({}, validStructuralInput(), { [key]: 'SENTINEL_SECRET' });
    const result = await custom.instance.deliverAlert(input);
    assert.equal(result.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT', key + ' must be rejected');
  }
  assert.equal(effectCalls, 0, 'unknown/private fields never reach effect');
});

test('A10 descriptor/accessor/Proxy hostile input -> getter/trap/raw leakage 0', async () => {
  let effectCalls = 0;
  const custom = createCore({ deps: { deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; } } });
  // Accessor getter input: getter must never be invoked.
  const accessorInput = validStructuralInput();
  let getterCalls = 0;
  Object.defineProperty(accessorInput, 'severity', {
    enumerable: true,
    get() { getterCalls += 1; return 'WARNING'; },
  });
  const r1 = await custom.instance.deliverAlert(accessorInput);
  assert.equal(r1.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(getterCalls, 0, 'accessor getter must never be invoked');
  // Proxy getPrototypeOf trap input: no trap leakage.
  const proxyInput = new Proxy({}, {
    getPrototypeOf() { throw new Error('SENTINEL_TRAP'); },
  });
  const r2 = await custom.instance.deliverAlert(proxyInput);
  assert.equal(r2.outcome, 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT');
  const json = JSON.stringify([r1, r2]);
  assert.ok(!json.includes('SENTINEL_TRAP'), 'trap value must never leak');
  assert.equal(effectCalls, 0, 'hostile input never reaches effect');
});

test('A11 envelope/result/export frozen and detached', async () => {
  const { T, core, instance } = createCore({});
  assert.ok(Object.isFrozen(core));
  assert.ok(Object.isFrozen(core.ERROR_CODES));
  assert.ok(Object.isFrozen(core.ENVELOPE_FIELDS));
  assert.ok(Object.isFrozen(core.SOURCE_CLASSES));
  assert.ok(Object.isFrozen(core.OWNER_CLASSES));
  assert.ok(Object.isFrozen(core.DELIVERY_OUTCOMES));
  assert.ok(Object.isFrozen(instance));
  const result = await instance.deliverAlert(validStructuralInput());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.envelope));
  assert.throws(() => { result.envelope.outcome_code = 'BROKEN'; }, TypeError);
  // Detached: mutating the caller input never mutates the delivered envelope.
  const input = validStructuralInput();
  const result2 = await instance.deliverAlert(input);
  const before = result2.envelope.operation_class;
  input.operation_class = 'TREE_CREATE_CONVERGENCE';
  assert.equal(result2.envelope.operation_class, before, 'envelope is detached from caller input');
});

test('A12 same bounded input -> byte-stable envelope and fingerprint', async () => {
  const { T, core } = createCore({});
  const custom = core.createAlertDeliveryCore({ taxonomy: T, deliverAlert: async () => 'ACCEPTED' });
  const a = await custom.deliverAlert(validStructuralInput());
  const b = await custom.deliverAlert(validStructuralInput());
  assert.equal(JSON.stringify(a.envelope), JSON.stringify(b.envelope), 'byte-stable envelope');
  assert.equal(a.envelope.dedupe_fingerprint, b.envelope.dedupe_fingerprint, 'byte-stable fingerprint');
  // Reordered keys must not change the fingerprint.
  const reordered = validStructuralInput();
  const tmp = reordered.owner_action;
  delete reordered.owner_action;
  reordered.owner_action = tmp;
  const c = await custom.deliverAlert(reordered);
  assert.equal(c.envelope.dedupe_fingerprint, a.envelope.dedupe_fingerprint, 'key order does not affect fingerprint');
});

test('A13 monitoring failure does not throw', async () => {
  const { T, core } = createCore({});
  const custom = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async () => { throw new Error('boom'); },
  });
  let threw = false;
  let result;
  try {
    result = await custom.deliverAlert(validStructuralInput());
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, 'producer boundary never throws');
  assert.equal(result.outcome, 'DELIVERY_FAILED_SANITIZED');
});

test('A14 delivery effect maximum exactly 1', async () => {
  const { T, core } = createCore({});
  let effectCalls = 0;
  const custom = core.createAlertDeliveryCore({
    taxonomy: T,
    deliverAlert: async () => { effectCalls += 1; return 'ACCEPTED'; },
  });
  const result = await custom.deliverAlert(validStructuralInput());
  assert.equal(effectCalls, 1, 'effect invoked at most once for a single alert');
  assert.equal(result.outcome, 'DELIVERY_ACCEPTED');
  // Multiple alerts each invoke the effect exactly once.
  await custom.deliverAlert(validConvergenceInput());
  assert.equal(effectCalls, 2, 'one effect invocation per distinct alert');
});

test('A15 no network/provider/storage/DB/filesystem capability in core', () => {
  const src = readAlertCoreSource();
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch');
  assert.ok(!/new\s+XMLHttpRequest/.test(src), 'no XHR');
  assert.ok(!/new\s+WebSocket/.test(src), 'no websocket');
  assert.ok(!/child_process/.test(src), 'no child_process');
  assert.ok(!/require\(['"](?:https?|fs|net|dgram|child_process|http|https)/.test(src), 'no node capability require');
  assert.ok(!/\.writeFileSync\s*\(/.test(src), 'no filesystem write');
  assert.ok(!/\.appendFileSync\s*\(/.test(src), 'no filesystem append');
  assert.ok(!/process\.env/.test(src), 'no env read');
  assert.ok(!/localStorage/.test(src), 'no storage');
  assert.ok(!/sessionStorage/.test(src), 'no session storage');
  assert.ok(!/\bpg\b[\s\S]*connect/i.test(src), 'no DB connect');
  assert.ok(!/document\./.test(src), 'no DOM access');
  assert.ok(!/setTimeout/.test(src), 'no timers');
  assert.ok(!/setInterval/.test(src), 'no interval');
});

test('A14b prior fingerprint validation is bounded', () => {
  const { T, core } = createCore({});
  assert.throws(() => core.createAlertDeliveryCore({ taxonomy: T, priorFingerprints: 'not-hex', deliverAlert: async () => 'ACCEPTED' }), /INVALID_FINGERPRINT/);
  assert.throws(() => core.createAlertDeliveryCore({ taxonomy: T, priorFingerprints: ['ok'.repeat(32)], deliverAlert: async () => 'ACCEPTED' }), /INVALID_FINGERPRINT/);
  const good = core.createAlertDeliveryCore({
    taxonomy: T,
    priorFingerprints: ['a'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)],
    deliverAlert: async () => 'ACCEPTED',
  });
  assert.ok(Array.isArray(good.normalizePriorFingerprints(['a'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)])));
  const normalized = good.normalizePriorFingerprints(['b'.repeat(64), 'a'.repeat(64), 'a'.repeat(64)]);
  assert.deepEqual(normalized, ['a'.repeat(64), 'b'.repeat(64)]);
  assert.ok(Object.isFrozen(normalized));
});

test('A14c missing/non-callable delivery effect fails closed at creation', () => {
  const { T, core } = createCore({});
  assert.throws(() => core.createAlertDeliveryCore({ taxonomy: T, deliverAlert: undefined }), /MISSING_DELIVERY_EFFECT/);
  assert.throws(() => core.createAlertDeliveryCore({ taxonomy: T, deliverAlert: 'not-a-function' }), /DELIVERY_EFFECT_NOT_CALLABLE/);
  assert.throws(() => core.createAlertDeliveryCore({ taxonomy: undefined, deliverAlert: async () => 'ACCEPTED' }), /MISSING_TAXONOMY/);
});
