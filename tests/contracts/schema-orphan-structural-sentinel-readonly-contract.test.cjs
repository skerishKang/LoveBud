'use strict';

// Issue #3842 — Read-only structural sentinel query + evaluation authority
// contract (Reliability & Observability child of parent #3461).
// Issue #4060 — Structural schema / migration-parity sentinel integration
// (reactivates STRUCTURAL_SCHEMA_DRIFT_CHECK and
// MIGRATION_LEDGER_CATALOG_PARITY_CHECK as PARITY_EVIDENCE descriptors via the
// source-only translation seam; reuses the #3860 parity outcome vocabulary
// exactly).
//
// This contract EXECUTES the real query catalog
// (js/observability/reliability-structural-sentinel-query-catalog.js) and the
// real evaluation core
// (js/observability/reliability-structural-sentinel-core.js) in a restricted
// sandbox and asserts:
//   - fixed descriptor IDs and operation-class mapping;
//   - executable versus deferred versus parity-evidence descriptor modes;
//   - query text is deeply frozen/detached;
//   - query allowlist and mutation-token rejection;
//   - no caller-selected SQL;
//   - no environment/provider fallback;
//   - strict exact-row result shape;
//   - exact count never emitted publicly;
//   - #3835 taxonomy integration;
//   - missing evidence is never success;
//   - valid root memory (parent_id IS NULL) excluded from orphan definition;
//   - positive orphan candidate maps to ORPHAN_SIGNAL_DETECTED;
//   - schema authority unavailable remains non-success;
//   - executor error is sanitized and does not echo raw error/SQL;
//   - parity-evidence descriptors: PARITY_CONFIRMED -> CONFIRMED,
//     PARITY_MISMATCH -> STRUCTURAL_DRIFT_DETECTED,
//     AUTHORITY_ADOPTION_REQUIRED -> never live-applied success,
//     CATALOG_COLLECTION_FAILED -> MONITORING_FAILED, missing/malformed
//     evidence -> never success, catalogued-but-absent-live -> mismatch;
//   - the #3860 parity outcome vocabulary is reused exactly (no new synonyms);
//   - provider/database identity in parity input is fail-closed rejected and
//     never echoed;
//   - unknown fields/values rejected;
//   - prototype/Proxy/accessor boundaries;
//   - byte-stable canonical output;
//   - zero filesystem write/network/provider/deploy/alert/synthetic capability.
//
// It also runs the required negative controls (NC1-NC11f).
//
// Classification: SOURCE_STATIC (no browser/process/network/DB execution).
//
// Refs #3842.
// Refs #4060.
// Refs #3835 — taxonomy authority.
// Refs #3458 — canonical migration/expected-schema authority (completed).
// Refs #3860 — read-only parity core vocabulary (completed).
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'js', 'observability', 'reliability-structural-sentinel-query-catalog.js');
const CORE_PATH = path.join(ROOT, 'js', 'observability', 'reliability-structural-sentinel-core.js');
const TAXONOMY_PATH = path.join(ROOT, 'js', 'observability', 'reliability-sentinel-taxonomy.js');
const CONTRACT_DOC_PATH = path.join(ROOT, 'docs', 'ops', 'SCHEMA_ORPHAN_STRUCTURAL_SENTINEL_READONLY_CONTRACT.md');
const PARITY_CORE_PATH = path.join(ROOT, 'scripts', 'migration-readonly-target-attribution-parity-core.cjs');

const VALID_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

// ---------------------------------------------------------------------------
// Parity-evidence fixtures. The seam consumes ONLY the already-bounded #3860
// parity outcome string (or the bounded collection-failure marker); it never
// receives expected/observed fingerprint records, so no such fixtures exist
// here. Outcomes are asserted to exactly reuse the #3860 vocabulary below.
// ---------------------------------------------------------------------------
function parityOutcome(outcome) {
  return { outcome };
}

function loadFromSource(source, globalName) {
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  assert.ok(sandbox.window[globalName], 'must expose ' + globalName);
  return sandbox.window[globalName];
}

function loadCatalog() {
  return loadFromSource(fs.readFileSync(CATALOG_PATH, 'utf8'), 'LoveBudStructuralSentinelQueryCatalog');
}

function loadCore() {
  return loadFromSource(fs.readFileSync(CORE_PATH, 'utf8'), 'LoveBudStructuralSentinelCore');
}

function loadTaxonomy() {
  return loadFromSource(fs.readFileSync(TAXONOMY_PATH, 'utf8'), 'LoveBudReliabilitySentinelTaxonomy');
}

function withDisposableSource(filePath, globalName, transform, fn) {
  const original = fs.readFileSync(filePath, 'utf8');
  const tmp = path.join(os.tmpdir(), 'lb-sent-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.js');
  try {
    fs.writeFileSync(tmp, transform(original), 'utf8');
    fn(loadFromSource(fs.readFileSync(tmp, 'utf8'), globalName));
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
  }
  assert.equal(fs.readFileSync(filePath, 'utf8'), original, 'source must be byte-exact restored');
}

function makeExecutor(rawResultOrThrows) {
  let calls = 0;
  return {
    calls() { return calls; },
    execute() {
      calls += 1;
      if (rawResultOrThrows instanceof Error) throw rawResultOrThrows;
      return Promise.resolve(rawResultOrThrows);
    },
  };
}

function rows(count) {
  return { rows: [{ count }] };
}

function loadEvaluator() {
  const catalog = loadCatalog();
  const taxonomy = loadTaxonomy();
  const core = loadCore();
  const evaluator = core.createStructuralSentinelEvaluator({ catalog, taxonomy });
  return { catalog, taxonomy, core, evaluator };
}

// ---------------------------------------------------------------------------
// Fixed descriptor IDs and operation-class mapping
// ---------------------------------------------------------------------------

test('exact 8 fixed signal IDs are known', () => {
  const catalog = loadCatalog();
  assert.deepEqual(catalog.getAllIds().slice().sort(), [
    'BROWSE_ELIGIBLE_ENTITY_COUNT',
    'MEMORY_PARENT_ORPHAN_COUNT',
    'MEMORY_TREE_PARENT_ORPHAN_COUNT',
    'MIGRATION_LEDGER_CATALOG_PARITY_CHECK',
    'PUBLIC_MEMORY_PARENT_ORPHAN_COUNT',
    'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    'TREE_COMMENT_TARGET_ORPHAN_COUNT',
    'TREE_SOCIAL_TARGET_ORPHAN_COUNT',
  ].sort());
});

test('executable descriptors carry exact operation classes and fixed query', () => {
  const catalog = loadCatalog();
  const execIds = catalog.getExecutableIds();
  assert.deepEqual(execIds.slice().sort(), ['MEMORY_PARENT_ORPHAN_COUNT', 'MEMORY_TREE_PARENT_ORPHAN_COUNT']);
  const tree = catalog.getDescriptor('MEMORY_TREE_PARENT_ORPHAN_COUNT');
  const parent = catalog.getDescriptor('MEMORY_PARENT_ORPHAN_COUNT');
  assert.equal(tree.operation_class, 'TREE_PARENT_INTEGRITY_CHECK');
  assert.equal(parent.operation_class, 'MEMORY_PARENT_INTEGRITY_CHECK');
  assert.equal(tree.executable, true);
  assert.equal(parent.executable, true);
  assert.equal(tree.result_contract.rows, 1);
  assert.deepEqual(tree.result_contract.columns, ['count']);
  assert.deepEqual(parent.result_contract.columns, ['count']);
});

test('deferred descriptors carry fixed prerequisite and no executable SQL', () => {
  const catalog = loadCatalog();
  const deferredIds = catalog.getDeferredIds();
  assert.equal(deferredIds.length, 4);
  for (const id of deferredIds) {
    const d = catalog.getDescriptor(id);
    assert.equal(d.executable, false);
    assert.equal(d.query, null);
    assert.equal(d.result_contract, null);
    assert.equal(d.descriptor_mode, 'DEFERRED');
    assert.equal(d.deferred_prerequisite, 'CANONICAL_SCHEMA_AUTHORITY_REQUIRED');
  }
});

test('schema-drift and ledger-parity are parity-evidence descriptors (reactivated)', () => {
  const catalog = loadCatalog();
  const parityIds = catalog.getParityEvidenceIds();
  assert.deepEqual(parityIds.slice().sort(), [
    'MIGRATION_LEDGER_CATALOG_PARITY_CHECK',
    'STRUCTURAL_SCHEMA_DRIFT_CHECK',
  ]);
  for (const id of parityIds) {
    const d = catalog.getDescriptor(id);
    assert.equal(d.descriptor_mode, 'PARITY_EVIDENCE');
    assert.equal(d.executable, false, id + ' must carry no SQL');
    assert.equal(d.query, null, id + ' must carry no SQL text');
    assert.equal(d.result_contract, null, id + ' must not use the count-row contract');
    assert.equal(d.deferred_prerequisite, null, id + ' must no longer be CANONICAL_SCHEMA_AUTHORITY_REQUIRED-deferred');
    assert.ok(d.parity_contract, id + ' must carry a fixed parity contract');
    assert.ok(Object.isFrozen(d.parity_contract), id + ' parity contract must be frozen');
  }
});

test('parity contracts accept exactly the #3860 outcome vocabulary and no fingerprint engine', () => {
  const catalog = loadCatalog();
  const parityCore = require(PARITY_CORE_PATH);
  const drift = catalog.getDescriptor('STRUCTURAL_SCHEMA_DRIFT_CHECK');
  const c = drift.parity_contract;
  assert.ok(c.accepted_outcomes, 'contract must declare accepted outcomes');
  assert.ok(Object.isFrozen(c.accepted_outcomes));
  const expectedOutcomes = Object.keys(parityCore.PARITY_OUTCOMES).sort();
  assert.deepEqual(c.accepted_outcomes.slice().sort(), expectedOutcomes);
  // The sentinel is NOT a second parity engine: the contract must not carry
  // object/fingerprint comparison machinery.
  assert.ok(!('object_name_pattern' in c), 'no object pattern in parity contract');
  assert.ok(!('fingerprint_pattern' in c), 'no fingerprint pattern in parity contract');
  assert.ok(!('evidence_format_version' in c), 'no evidence format gate in parity contract');
});

test('unknown descriptor IDs are rejected', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.getDescriptor('NOT_A_SIGNAL'), null);
  assert.equal(catalog.isKnownSignal('NOT_A_SIGNAL'), false);
  assert.equal(catalog.isKnownSignal('MEMORY_PARENT_ORPHAN_COUNT'), true);
});

test('query text is deeply frozen and detached', () => {
  const catalog = loadCatalog();
  const tree = catalog.getDescriptor('MEMORY_TREE_PARENT_ORPHAN_COUNT');
  assert.ok(Object.isFrozen(tree));
  assert.ok(Object.isFrozen(tree.query));
  assert.ok(Object.isFrozen(tree.result_contract));
  assert.throws(() => { tree.query = 'SELECT 2'; }, TypeError);
  assert.throws(() => { tree.result_contract.columns[0] = 'evil'; }, TypeError);
  // Descriptor identity changes do not mutate the catalog.
  const again = catalog.getDescriptor('MEMORY_TREE_PARENT_ORPHAN_COUNT');
  assert.equal(again.query, tree.query);
});

// ---------------------------------------------------------------------------
// Query allowlist and mutation-token rejection
// ---------------------------------------------------------------------------

test('fixed executable queries pass the query-safety validator', () => {
  const catalog = loadCatalog();
  for (const id of catalog.getExecutableIds()) {
    const d = catalog.getDescriptor(id);
    const safety = catalog.validateQuerySafety(d.query);
    assert.deepEqual(safety, { ok: true, error: null });
  }
});

test('unsafe mutation SQL is rejected fail closed (NC1)', () => {
  const catalog = loadCatalog();
  const unsafe = [
    'SELECT COUNT(*) AS count FROM memories; DROP TABLE memories',
    'DELETE FROM memories WHERE id IS NOT NULL',
    'UPDATE memories SET tree_id = NULL',
    'INSERT INTO memories (id) VALUES (1)',
    'TRUNCATE memories',
    'ALTER TABLE memories ADD COLUMN x text',
    'SELECT pg_sleep(10)',
    'SELECT * FROM dblink(\'x\',\'SELECT 1\') AS t(a int)',
    'SELECT COUNT(*) AS count FROM memories -- second statement',
    'SELECT COUNT(*) AS count FROM memories /* second statement */',
  ];
  for (const sql of unsafe) {
    const safety = catalog.validateQuerySafety(sql);
    assert.equal(safety.ok, false, 'must reject: ' + sql);
  }
});

test('caller-selected SQL is never accepted by the evaluator (NC3)', async () => {
  const { evaluator, catalog } = loadEvaluator();
  let received = null;
  const executor = {
    execute(descriptor) {
      received = descriptor.query;
      return Promise.resolve(rows(0));
    },
  };
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor,
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'CONFIRMED');
  // The executor must receive exactly the fixed catalog query text.
  const fixed = catalog.getDescriptor('MEMORY_PARENT_ORPHAN_COUNT').query;
  assert.equal(received, fixed);
  assert.doesNotMatch(received, /SELECT 2|DELETE|DROP/);
});

// ---------------------------------------------------------------------------
// Strict exact-row result shape
// ---------------------------------------------------------------------------

test('zero rows is rejected as INSUFFICIENT_EVIDENCE', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.count_bucket, 'unknown');
  assert.notEqual(result.evidence_completeness, 'complete');
});

test('multiple rows is rejected as INSUFFICIENT_EVIDENCE (NC8)', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [{ count: 0 }, { count: 1 }] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
});

test('extra/missing columns are rejected', async () => {
  const { evaluator } = loadEvaluator();
  for (const bad of [
    { rows: [{ count: 0, other: 1 }] },
    { rows: [{ other: 0 }] },
  ]) {
    const result = await evaluator.evaluateSignal({
      descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
      executor: makeExecutor(bad),
      releaseSha: VALID_RELEASE_SHA,
    });
    assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  }
});

test('negative/fractional/overflow/NaN/Infinity counts are rejected (NC7)', async () => {
  const { evaluator } = loadEvaluator();
  const badCounts = [-1, 1.5, NaN, Infinity, -Infinity, 'abc', '-1', '1.5', '9007199254740993'];
  for (const c of badCounts) {
    const result = await evaluator.evaluateSignal({
      descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
      executor: makeExecutor(rows(c)),
      releaseSha: VALID_RELEASE_SHA,
    });
    assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE', 'must reject count: ' + String(c));
  }
});

test('safe integer string counts are accepted (PostgreSQL bigint text form)', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows('0')),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'CONFIRMED');
  const positive = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows('3')),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(positive.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
});

test('rawResult.rows getter is rejected and never executed (NC11a)', async () => {
  const { evaluator } = loadEvaluator();
  const rawResult = {};
  Object.defineProperty(rawResult, 'rows', {
    enumerable: true,
    get() {
      throw new Error('ROWS_GETTER_EXECUTED');
    }
  });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rawResult),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /ROWS_GETTER_EXECUTED/);
});

test('row.count getter is rejected and never executed (NC11b)', async () => {
  const { evaluator } = loadEvaluator();
  const row = {};
  Object.defineProperty(row, 'count', {
    enumerable: true,
    get() {
      throw new Error('COUNT_GETTER_EXECUTED');
    }
  });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [row] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /COUNT_GETTER_EXECUTED/);
});

test('setter/accessor descriptor on row column is rejected (NC11c)', async () => {
  const { evaluator } = loadEvaluator();
  const row = {};
  Object.defineProperty(row, 'count', {
    enumerable: true,
    set(value) {}
  });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [row] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
});

test('throwing raw-result Proxy fails closed without raw error exposure (NC11d)', async () => {
  const { evaluator } = loadEvaluator();
  const proxy = new Proxy({}, {
    getPrototypeOf() {
      throw new Error('PROXY_SECRET');
    }
  });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(proxy),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.ok(result.outcome_code === 'MONITORING_FAILED' || result.outcome_code === 'INSUFFICIENT_EVIDENCE');
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /PROXY_SECRET/);
});

test('throwing row Proxy fails closed (NC11e)', async () => {
  const { evaluator } = loadEvaluator();
  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error('ROW_PROXY_SECRET');
    }
  });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [proxy] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /ROW_PROXY_SECRET/);
});

test('inherited count property on row is rejected (NC11f)', async () => {
  const { evaluator } = loadEvaluator();
  const row = Object.create({ count: 0 });
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [row] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
});

// ---------------------------------------------------------------------------
// Exact count never emitted publicly
// ---------------------------------------------------------------------------

test('exact aggregate count is never emitted in the canonical summary (NC4)', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  for (const c of [0, 1, 5, 999]) {
    const result = await evaluator.evaluateSignal({
      descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
      executor: makeExecutor(rows(c)),
      releaseSha: VALID_RELEASE_SHA,
    });
    const parsed = JSON.parse(taxonomy.canonicalJson(result));
    // No field may carry the exact aggregate count, and no raw 'count' key may
    // exist. The only count-bearing field is the bounded count_bucket.
    assert.ok(!Object.prototype.hasOwnProperty.call(parsed, 'count'));
    const values = Object.values(parsed);
    assert.ok(!values.some((v) => typeof v === 'number' && v === c), 'must not leak exact count ' + c);
    assert.ok(!['0', '1', '5', '999'].includes(String(c)) || !values.includes(String(c)));
  }
});

test('raw row/ID values are never emitted in the canonical summary', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(2)),
    releaseSha: VALID_RELEASE_SHA,
  });
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /memories/i);
  assert.doesNotMatch(json, /tree_id/i);
  assert.doesNotMatch(json, /parent_id/i);
  assert.doesNotMatch(json, /SELECT/i);
});

// ---------------------------------------------------------------------------
// #3835 taxonomy integration
// ---------------------------------------------------------------------------

test('canonical summaries are taxonomy-valid and byte stable', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(0)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.ok(Object.isFrozen(result));
  const json1 = taxonomy.canonicalJson(result);
  const json2 = taxonomy.canonicalJson(result);
  assert.equal(json1, json2);
  const parsed = JSON.parse(json1);
  assert.equal(parsed.operation_class, 'MEMORY_PARENT_INTEGRITY_CHECK');
  assert.equal(parsed.outcome_code, 'CONFIRMED');
  assert.equal(parsed.count_bucket, 'zero');
  assert.equal(parsed.baseline_deviation, 'NONE');
  assert.equal(parsed.severity, 'INFO');
  assert.equal(parsed.owner_action, 'NO_ACTION');
  assert.equal(parsed.evidence_completeness, 'complete');
});

test('missing evidence is never success', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(0)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.evidence_completeness, 'complete');
  assert.equal(result.outcome_code, 'CONFIRMED');
  // A malformed result is never CONFIRMED even though the count would be zero.
  const malformed = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor({ rows: [] }),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.notEqual(malformed.outcome_code, 'CONFIRMED');
});

// ---------------------------------------------------------------------------
// Root-memory boundary and orphan semantics
// ---------------------------------------------------------------------------

test('root memory (parent_id IS NULL) is never an orphan by query definition', () => {
  const catalog = loadCatalog();
  const query = catalog.getDescriptor('MEMORY_PARENT_ORPHAN_COUNT').query;
  assert.match(query, /parent_id IS NOT NULL/);
  assert.match(query, /LEFT JOIN memories/);
  assert.match(query, /p\.id IS NULL/);
  // The fixed SQL must contain the non-null guard; the contract test proves the
  // semantic directly via the DB-engine rehearsal source.
});

test('positive orphan candidate maps to ORPHAN_SIGNAL_DETECTED', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(1)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
  assert.equal(result.count_bucket, 'positive');
  assert.equal(result.severity, 'WARNING');
  assert.equal(result.owner_action, 'INVESTIGATE');
});

// ---------------------------------------------------------------------------
// Schema authority unavailable / deferred
// ---------------------------------------------------------------------------

test('schema authority unavailable remains non-success (NC10)', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'TREE_SOCIAL_TARGET_ORPHAN_COUNT',
    executor: makeExecutor(rows(0)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'SCHEMA_AUTHORITY_UNAVAILABLE');
  assert.equal(result.count_bucket, 'unknown');
  assert.notEqual(result.evidence_completeness, 'complete');
  assert.notEqual(result.outcome_code, 'CONFIRMED');
});

// ---------------------------------------------------------------------------
// Parity-evidence seam (Issue #4060)
// ---------------------------------------------------------------------------

test('PARITY_CONFIRMED maps to deterministic confirmed structural result', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: parityOutcome('PARITY_CONFIRMED'),
  });
  assert.equal(result.outcome_code, 'CONFIRMED');
  assert.equal(result.baseline_deviation, 'NONE');
  assert.equal(result.severity, 'INFO');
  assert.equal(result.owner_action, 'NO_ACTION');
  assert.equal(result.evidence_completeness, 'complete');
  assert.ok(!('count_bucket' in result), 'parity summaries must not carry a count bucket');
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /PARITY_CONFIRMED/);
  assert.doesNotMatch(json, /PARITY_MISMATCH/);
  assert.doesNotMatch(json, /AUTHORITY_ADOPTION_REQUIRED/);
});

test('PARITY_MISMATCH maps to bounded non-success STRUCTURAL_DRIFT_DETECTED', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MIGRATION_LEDGER_CATALOG_PARITY_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: parityOutcome('PARITY_MISMATCH'),
  });
  assert.equal(result.outcome_code, 'STRUCTURAL_DRIFT_DETECTED');
  assert.equal(result.baseline_deviation, 'MATERIAL_DEVIATION');
  assert.equal(result.severity, 'WARNING');
  assert.equal(result.owner_action, 'INVESTIGATE');
  assert.notEqual(result.outcome_code, 'CONFIRMED');
});

test('only PARITY_CONFIRMED maps to CONFIRMED; all other #3860 outcomes fail closed', async () => {
  const { evaluator } = loadEvaluator();
  const expectedMappings = {
    PARITY_MISMATCH: 'STRUCTURAL_DRIFT_DETECTED',
    AUTHORITY_ADOPTION_REQUIRED: 'SCHEMA_AUTHORITY_UNAVAILABLE',
    CATALOG_COLLECTION_FAILED: 'MONITORING_FAILED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
    TARGET_ATTRIBUTION_INVALID: 'INSUFFICIENT_EVIDENCE',
    APPROVAL_INVALID: 'INSUFFICIENT_EVIDENCE',
    EXPECTED_SCHEMA_INVALID: 'INSUFFICIENT_EVIDENCE',
  };
  for (const outcome of Object.keys(expectedMappings)) {
    const result = await evaluator.evaluateSignal({
      descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
      releaseSha: VALID_RELEASE_SHA,
      parityEvidence: parityOutcome(outcome),
    });
    assert.equal(result.outcome_code, expectedMappings[outcome], outcome + ' must map to ' + expectedMappings[outcome]);
    assert.notEqual(result.outcome_code, 'CONFIRMED', outcome + ' must never be CONFIRMED');
  }
});

test('AUTHORITY_ADOPTION_REQUIRED is bounded non-success with OWNER_DECISION_REQUIRED', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: parityOutcome('AUTHORITY_ADOPTION_REQUIRED'),
  });
  assert.equal(result.outcome_code, 'SCHEMA_AUTHORITY_UNAVAILABLE');
  assert.equal(result.owner_action, 'OWNER_DECISION_REQUIRED');
  assert.notEqual(result.outcome_code, 'CONFIRMED');
});

test('missing parity evidence is never success (fail closed)', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'INSUFFICIENT_EVIDENCE');
  assert.notEqual(result.outcome_code, 'CONFIRMED');
});

test('malformed or unknown parity evidence is never success (fail closed)', async () => {
  const { evaluator } = loadEvaluator();
  const cases = [
    null,
    42,
    'string',
    {},
    { outcome: 'NOT_A_REAL_OUTCOME' },
    { outcome: 42 },
    { outcome: 'PARITY_CONFIRMED', extra: true },
    { outcome: 'PARITY_CONFIRMED', project_id: 'proud-grass-75157219' },
    { collection_failed: 'yes' },
    { collection_failed: true, extra: true },
  ];
  for (const bad of cases) {
    const result = await evaluator.evaluateSignal({
      descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
      releaseSha: VALID_RELEASE_SHA,
      parityEvidence: bad,
    });
    assert.notEqual(result.outcome_code, 'CONFIRMED', 'must fail closed for evidence: ' + JSON.stringify(bad));
  }
});

test('collector failure marker maps to sanitized MONITORING_FAILED', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: { collection_failed: true },
  });
  assert.equal(result.outcome_code, 'MONITORING_FAILED');
  assert.equal(result.severity, 'BLOCKING');
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /CATALOG_COLLECTION_FAILED/);
});

test('provider/database identity in parity input is fail-closed rejected and never echoed', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const evidence = {
    outcome: 'PARITY_CONFIRMED',
    project_id: 'proud-grass-75157219',
    host: 'db.example.com',
  };
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: evidence,
  });
  assert.notEqual(result.outcome_code, 'CONFIRMED');
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /proud-grass-75157219/);
  assert.doesNotMatch(json, /db\.example\.com/);
});

test('parity results are deep frozen, detached, deterministic and byte stable', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const evidence = parityOutcome('PARITY_CONFIRMED');
  const first = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: evidence,
  });
  const second = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: evidence,
  });
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(first, second);
  assert.equal(taxonomy.canonicalJson(first), taxonomy.canonicalJson(second));
});

test('parity path never invokes the fixed count executor (count executor calls = 0)', async () => {
  const { evaluator } = loadEvaluator();
  let calls = 0;
  const executor = {
    execute() {
      calls += 1;
      return Promise.resolve(rows(0));
    },
  };
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    executor,
    parityEvidence: parityOutcome('PARITY_CONFIRMED'),
  });
  assert.equal(calls, 0, 'parity path must never call the count executor');
  assert.equal(result.outcome_code, 'CONFIRMED');
});

test('parity outcome vocabulary exactly reuses all 8 #3860 outcome strings', () => {
  const parityCore = require(PARITY_CORE_PATH);
  const catalog = loadCatalog();
  const expectedKeys = Object.keys(parityCore.PARITY_OUTCOMES);
  assert.equal(expectedKeys.length, 8);
  for (const key of expectedKeys) {
    assert.equal(catalog.PARITY_OUTCOMES[key], parityCore.PARITY_OUTCOMES[key], 'must reuse #3860 ' + key);
  }
});

test('sentinel core does not implement a second fingerprint/parity engine', () => {
  const coreSrc = fs.readFileSync(CORE_PATH, 'utf8');
  assert.doesNotMatch(coreSrc, /compareParityVocabularies/);
  assert.doesNotMatch(coreSrc, /validateParityObjectList/);
  assert.doesNotMatch(coreSrc, /critical_objects/);
  assert.doesNotMatch(coreSrc, /format_version/);
  assert.doesNotMatch(coreSrc, /object_name_pattern/);
  assert.doesNotMatch(coreSrc, /fingerprint_pattern/);
});

test('parity input cannot smuggle raw SQL or exact counts into public output', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    releaseSha: VALID_RELEASE_SHA,
    parityEvidence: parityOutcome('PARITY_CONFIRMED'),
  });
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /SELECT/i);
  assert.doesNotMatch(json, /count/i);
  assert.doesNotMatch(json, /sha256:/);
  assert.doesNotMatch(json, /critical_alpha/);
});

// ---------------------------------------------------------------------------
// Executor error sanitization
// ---------------------------------------------------------------------------

test('executor error is sanitized and never echoes raw error/SQL (NC9)', async () => {
  const { evaluator, taxonomy } = loadEvaluator();
  const err = new Error('raw DB failure: SELECT 1 FROM secrets WHERE token=\'abc\'');
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(err),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'MONITORING_FAILED');
  assert.equal(result.count_bucket, 'unknown');
  assert.equal(result.severity, 'BLOCKING');
  assert.equal(result.evidence_completeness, 'missing');
  const json = taxonomy.canonicalJson(result);
  assert.doesNotMatch(json, /raw DB failure/i);
  assert.doesNotMatch(json, /SELECT 1/i);
  assert.doesNotMatch(json, /secrets/i);
  assert.doesNotMatch(json, /token/i);
});

// ---------------------------------------------------------------------------
// Unknown fields / invalid baseline classes
// ---------------------------------------------------------------------------

test('unknown descriptor id is rejected by the evaluator (NC5)', async () => {
  const { evaluator } = loadEvaluator();
  await assert.rejects(
    () =>
      evaluator.evaluateSignal({
        descriptorId: 'NOT_A_SIGNAL',
        executor: makeExecutor(rows(0)),
        releaseSha: VALID_RELEASE_SHA,
      }),
    (e) => e instanceof TypeError && /UNKNOWN_DESCRIPTOR/.test(e.message)
  );
});

test('caller numeric threshold maps are rejected (invalid baseline class)', async () => {
  const { evaluator } = loadEvaluator();
  await assert.rejects(
    () =>
      evaluator.evaluateSignal({
        descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
        executor: makeExecutor(rows(0)),
        releaseSha: VALID_RELEASE_SHA,
        baselineClass: { threshold: 5 },
      }),
    (e) => e instanceof TypeError && /INVALID_BASELINE_CLASS/.test(e.message)
  );
  await assert.rejects(
    () =>
      evaluator.evaluateSignal({
        descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
        executor: makeExecutor(rows(0)),
        releaseSha: VALID_RELEASE_SHA,
        baselineClass: 5,
      }),
    (e) => e instanceof TypeError && /INVALID_BASELINE_CLASS/.test(e.message)
  );
});

test('bounded baseline class is accepted for the synthetic seam', async () => {
  const { evaluator } = loadEvaluator();
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(1)),
    releaseSha: VALID_RELEASE_SHA,
    baselineClass: 'EXPECTED_VARIATION',
  });
  assert.equal(result.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
  assert.equal(result.baseline_deviation, 'EXPECTED_VARIATION');
});

// ---------------------------------------------------------------------------
// Mutable-catalog / mutable-summary negative controls
// ---------------------------------------------------------------------------

test('catalog and summaries are deeply frozen (NC12, NC14)', async () => {
  const { evaluator, catalog, taxonomy } = loadEvaluator();
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(evaluator));
  for (const id of catalog.getAllIds()) {
    assert.ok(Object.isFrozen(catalog.getDescriptor(id)));
  }
  const result = await evaluator.evaluateSignal({
    descriptorId: 'MEMORY_PARENT_ORPHAN_COUNT',
    executor: makeExecutor(rows(0)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.ok(Object.isFrozen(result));
  assert.throws(() => { result.outcome_code = 'CONFIRMED'; }, TypeError);
});

// ---------------------------------------------------------------------------
// Source authority boundary checks
// ---------------------------------------------------------------------------

test('catalog and core declare zero capabilities', () => {
  const catalog = loadCatalog();
  const core = loadCore();
  assert.deepEqual(catalog.CAPABILITIES, []);
  assert.deepEqual(core.CAPABILITIES, []);
});

test('catalog/core source must not embed provider, env, network, or secret logic', () => {
  const catalogSrc = fs.readFileSync(CATALOG_PATH, 'utf8');
  const coreSrc = fs.readFileSync(CORE_PATH, 'utf8');
  for (const src of [catalogSrc, coreSrc]) {
    assert.doesNotMatch(src, /process\.env/i);
    assert.doesNotMatch(src, /DATABASE_URL/i);
    assert.doesNotMatch(src, /NEON_|MODAL_|CLOUDFLARE_/i);
    assert.doesNotMatch(src, /fetch\s*\(/i);
    assert.doesNotMatch(src, /https?:\/\//i);
    assert.doesNotMatch(src, /require\s*\(['"]pg['"]\)/i);
    assert.doesNotMatch(src, /child_process|execSync|spawn/i);
    assert.doesNotMatch(src, /writeFileSync|appendFileSync/i);
    // Parity-evidence integration must not add capability: no DB driver, no
    // provider SDK, no network client, no filesystem write, no shell.
    assert.doesNotMatch(src, /migration-readonly-target-attribution-parity-core/);
    assert.doesNotMatch(src, /proud-grass/);
  }
});

test('catalog PARITY_OUTCOMES is frozen and exactly matches the #3860 outcome set', () => {
  const catalog = loadCatalog();
  const parityCore = require(PARITY_CORE_PATH);
  assert.ok(Object.isFrozen(catalog.PARITY_OUTCOMES));
  assert.deepEqual(
    Object.keys(catalog.PARITY_OUTCOMES).sort(),
    Object.keys(parityCore.PARITY_OUTCOMES).sort()
  );
});

test('contract document exists and covers the required sections and CI wiring', () => {
  const doc = fs.readFileSync(CONTRACT_DOC_PATH, 'utf8');
  assert.match(doc, /MEMORY_TREE_PARENT_ORPHAN_COUNT/);
  assert.match(doc, /MEMORY_PARENT_ORPHAN_COUNT/);
  assert.match(doc, /CANONICAL_SCHEMA_AUTHORITY_REQUIRED/);
  assert.doesNotMatch(doc, /STRUCTURAL_SENTINEL_DB_ENGINE_CI_BLOCKED/);
  assert.match(doc, /DB_ENGINE_EXECUTION/);
  assert.match(doc, /db-engine-structural-sentinel/);
  assert.match(doc, /postgres:17\.4-bookworm/);
  assert.match(doc, /170004/);
  assert.match(doc, /LB_TEST_PG/);
  assert.match(doc, /local DB execution prohibited/);
  assert.match(doc, /authoritative PostgreSQL evidence pending fresh exact-head CI/);
  assert.match(doc, /derived cardinality/);
  assert.doesNotMatch(doc, /literal 9/);
  assert.match(doc, /valid root memory/);
  assert.match(doc, /CONFIRMED \/ NONE/);
  assert.match(doc, /ORPHAN_SIGNAL_DETECTED/);
});

// ---------------------------------------------------------------------------
// Full required mapping
// ---------------------------------------------------------------------------

test('required baseline boundary mapping holds for both executable signals', async () => {
  const { evaluator } = loadEvaluator();
  for (const id of ['MEMORY_PARENT_ORPHAN_COUNT', 'MEMORY_TREE_PARENT_ORPHAN_COUNT']) {
    const zero = await evaluator.evaluateSignal({
      descriptorId: id,
      executor: makeExecutor(rows(0)),
      releaseSha: VALID_RELEASE_SHA,
    });
    assert.equal(zero.outcome_code, 'CONFIRMED');
    assert.equal(zero.baseline_deviation, 'NONE');
    assert.equal(zero.count_bucket, 'zero');
    assert.equal(zero.evidence_completeness, 'complete');

    const positive = await evaluator.evaluateSignal({
      descriptorId: id,
      executor: makeExecutor(rows(2)),
      releaseSha: VALID_RELEASE_SHA,
    });
    assert.equal(positive.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
    assert.equal(positive.count_bucket, 'positive');
    assert.equal(positive.evidence_completeness, 'complete');
  }
});
