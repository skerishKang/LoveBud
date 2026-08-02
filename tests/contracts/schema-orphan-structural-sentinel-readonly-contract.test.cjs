'use strict';

// Issue #3842 — Read-only structural sentinel query + evaluation authority
// contract (Reliability & Observability child of parent #3461).
//
// This contract EXECUTES the real query catalog
// (js/observability/reliability-structural-sentinel-query-catalog.js) and the
// real evaluation core
// (js/observability/reliability-structural-sentinel-core.js) in a restricted
// sandbox and asserts:
//   - fixed descriptor IDs and operation-class mapping;
//   - executable versus deferred descriptor distinction;
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
// Refs #3835 — taxonomy authority.
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

const VALID_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

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
  assert.equal(deferredIds.length, 6);
  for (const id of deferredIds) {
    const d = catalog.getDescriptor(id);
    assert.equal(d.executable, false);
    assert.equal(d.query, null);
    assert.equal(d.result_contract, null);
    assert.equal(d.deferred_prerequisite, 'CANONICAL_SCHEMA_AUTHORITY_REQUIRED');
  }
});

test('schema-drift and ledger-parity remain deferred (no #3458 activation)', () => {
  const catalog = loadCatalog();
  const drift = catalog.getDescriptor('STRUCTURAL_SCHEMA_DRIFT_CHECK');
  const parity = catalog.getDescriptor('MIGRATION_LEDGER_CATALOG_PARITY_CHECK');
  assert.equal(drift.executable, false);
  assert.equal(parity.executable, false);
  assert.equal(drift.deferred_prerequisite, 'CANONICAL_SCHEMA_AUTHORITY_REQUIRED');
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
    descriptorId: 'STRUCTURAL_SCHEMA_DRIFT_CHECK',
    executor: makeExecutor(rows(0)),
    releaseSha: VALID_RELEASE_SHA,
  });
  assert.equal(result.outcome_code, 'SCHEMA_AUTHORITY_UNAVAILABLE');
  assert.equal(result.count_bucket, 'unknown');
  assert.notEqual(result.evidence_completeness, 'complete');
  assert.notEqual(result.outcome_code, 'CONFIRMED');
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
  }
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
