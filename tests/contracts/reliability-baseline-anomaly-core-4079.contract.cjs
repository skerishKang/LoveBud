'use strict';

// Issue #4079 — focused explicit contract for the baseline-aware anomaly core.
// This file intentionally uses `.contract.cjs` rather than `.test.cjs` while
// PR #4084 owns tests/test-layer-classification.json. Run explicitly with:
//   node --test tests/contracts/reliability-baseline-anomaly-core-4079.contract.cjs
// It performs no network/DB/provider/Production activity.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(ROOT, 'js', 'observability', 'reliability-sentinel-taxonomy.js');
const BASELINE_PATH = path.join(ROOT, 'js', 'observability', 'reliability-baseline-store-contract.js');
const EVALUATOR_PATH = path.join(ROOT, 'js', 'observability', 'reliability-anomaly-evaluator-core.js');
const STRUCTURAL_CORE_PATH = path.join(ROOT, 'js', 'observability', 'reliability-structural-sentinel-core.js');
const STRUCTURAL_CATALOG_PATH = path.join(ROOT, 'js', 'observability', 'reliability-structural-sentinel-query-catalog.js');
const PARITY_CORE_PATH = path.join(ROOT, 'scripts', 'migration-readonly-target-attribution-parity-core.cjs');

const SHA = '0123456789abcdef0123456789abcdef01234567';

function loadWindowSource(filePath, globalName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  assert.ok(sandbox.window[globalName], `missing ${globalName}`);
  return sandbox.window[globalName];
}

function loadAll(store) {
  const taxonomy = loadWindowSource(TAXONOMY_PATH, 'LoveBudReliabilitySentinelTaxonomy');
  const baseline = loadWindowSource(BASELINE_PATH, 'LoveBudReliabilityBaselineStoreContract');
  const core = loadWindowSource(EVALUATOR_PATH, 'LoveBudReliabilityAnomalyEvaluatorCore');
  const evaluator = core.createAnomalyEvaluator({
    taxonomy,
    baseline_contract: baseline,
    baseline_store: store,
  });
  return { taxonomy, baseline, core, evaluator };
}

function calibration(signalId, a = 0.05, b = 0.15, c = 0.30) {
  return {
    signal_id: signalId,
    expected_variation_max: a,
    material_deviation_min: b,
    critical_discontinuity_min: c,
  };
}

function baselineResult(taxonomy, status, deviation, evidence) {
  return { status, baseline_deviation: deviation, evidence_completeness: evidence };
}

function structuralSummary(taxonomy, outcome, operationClass = 'MEMORY_PARENT_INTEGRITY_CHECK') {
  const positive = outcome === taxonomy.OUTCOME_CODES.ORPHAN_SIGNAL_DETECTED ||
    outcome === taxonomy.OUTCOME_CODES.STRUCTURAL_DRIFT_DETECTED;
  return taxonomy.buildBoundedResult({
    operation_class: operationClass,
    stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
    outcome_code: outcome,
    release_sha: SHA,
    count_bucket: positive ? taxonomy.COUNT_BUCKETS.POSITIVE : taxonomy.COUNT_BUCKETS.ZERO,
    baseline_deviation: positive ? taxonomy.BASELINE_DEVIATION_CLASSES.MATERIAL_DEVIATION : taxonomy.BASELINE_DEVIATION_CLASSES.NONE,
    severity: positive ? taxonomy.SEVERITIES.WARNING : taxonomy.SEVERITIES.INFO,
    owner_action: positive ? taxonomy.OWNER_ACTIONS.INVESTIGATE : taxonomy.OWNER_ACTIONS.NO_ACTION,
    evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE,
  });
}

function hardSignal(baseline, signalId, summary) {
  return {
    signal_id: signalId,
    signal_class: baseline.SIGNAL_ID_TO_CLASS[signalId],
    structural_summary: summary,
  };
}

function baselineSignal(baseline, signalId) {
  return { signal_id: signalId, signal_class: baseline.SIGNAL_ID_TO_CLASS[signalId] };
}

function publicText(result, evaluator) {
  return evaluator.canonicalJson(result);
}

test('exact required signal classes and public states are frozen', () => {
  const { baseline, core } = loadAll({ evaluate() { throw new Error('unused'); } });
  assert.deepEqual(Object.values(baseline.SIGNAL_CLASSES).sort(), [
    'ABSOLUTE_INVARIANT', 'CROSS_TABLE_INVARIANT', 'DEPLOYMENT_CORRELATED_SIGNAL',
    'INSUFFICIENT_BASELINE', 'RATE_OF_CHANGE_SIGNAL', 'RATIO_SIGNAL', 'TEMPORAL_BASELINE',
  ].sort());
  assert.deepEqual(Object.values(core.PUBLIC_STATES).sort(), [
    'AUTHORITY_UNAVAILABLE', 'BASELINE_NOT_ESTABLISHED', 'DEGRADED', 'HEALTHY',
    'INCIDENT_CONFIRMED', 'INCIDENT_SUSPECTED', 'INSUFFICIENT_EVIDENCE', 'MONITORING_FAILED',
  ].sort());
  assert.ok(Object.isFrozen(baseline.SIGNAL_CLASSES));
  assert.ok(Object.isFrozen(core.PUBLIC_STATES));
  assert.deepEqual(baseline.CAPABILITIES, []);
  assert.deepEqual(core.CAPABILITIES, []);
});

test('absolute invariant violation is non-healthy without any baseline', async () => {
  let storeCalls = 0;
  const loaded = loadAll({ evaluate() { storeCalls += 1; throw new Error('must not call'); } });
  const { taxonomy, baseline, evaluator } = loaded;
  const result = await evaluator.evaluate({
    release_sha: SHA,
    signals: [hardSignal(baseline, 'ABSOLUTE_RELATIONAL_INVARIANT', structuralSummary(taxonomy, taxonomy.OUTCOME_CODES.ORPHAN_SIGNAL_DETECTED))],
    calibration: [],
  });
  assert.equal(result.state, 'INCIDENT_CONFIRMED');
  assert.notEqual(result.state, 'HEALTHY');
  assert.equal(storeCalls, 0);
});

test('cross-table invariant violation is non-healthy without any baseline', async () => {
  const loaded = loadAll({ evaluate() { throw new Error('must not call'); } });
  const { taxonomy, baseline, evaluator } = loaded;
  const result = await evaluator.evaluate({
    release_sha: SHA,
    signals: [hardSignal(baseline, 'CROSS_TABLE_RELATIONAL_INVARIANT', structuralSummary(taxonomy, taxonomy.OUTCOME_CODES.STRUCTURAL_DRIFT_DETECTED, 'STRUCTURAL_SCHEMA_CHECK'))],
    calibration: [],
  });
  assert.equal(result.state, 'INCIDENT_CONFIRMED');
});

test('ratio baseline absent suppresses verdict as BASELINE_NOT_ESTABLISHED', async () => {
  let calls = 0;
  const loaded = loadAll({
    evaluate() {
      calls += 1;
      return baselineResult(loaded.taxonomy, 'NOT_ESTABLISHED', 'UNKNOWN', 'missing');
    },
  });
  const { baseline, evaluator } = loaded;
  const id = 'BROWSE_ELIGIBILITY_RATIO';
  const result = await evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(calls, 1);
  assert.equal(result.state, 'BASELINE_NOT_ESTABLISHED');
  assert.notEqual(result.state, 'HEALTHY');
});

test('rate-of-change baseline absent also suppresses verdict', async () => {
  const loaded = loadAll({
    evaluate() { return baselineResult(loaded.taxonomy, 'NOT_ESTABLISHED', 'UNKNOWN', 'partial'); },
  });
  const id = 'ENTITY_RATE_OF_CHANGE';
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(result.state, 'BASELINE_NOT_ESTABLISHED');
});

test('absolute violation outranks baseline absence and can never collapse to healthy', async () => {
  const loaded = loadAll({
    evaluate() { return baselineResult(loaded.taxonomy, 'NOT_ESTABLISHED', 'UNKNOWN', 'missing'); },
  });
  const absolute = hardSignal(loaded.baseline, 'ABSOLUTE_RELATIONAL_INVARIANT', structuralSummary(loaded.taxonomy, loaded.taxonomy.OUTCOME_CODES.ORPHAN_SIGNAL_DETECTED));
  const ratio = baselineSignal(loaded.baseline, 'BROWSE_ELIGIBILITY_RATIO');
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [ratio, absolute],
    calibration: [calibration('BROWSE_ELIGIBILITY_RATIO')],
  });
  assert.equal(result.state, 'INCIDENT_CONFIRMED');
});

test('monitoring failure is never HEALTHY and raw error is sanitized', async () => {
  const secret = 'postgres://user:secret@provider.invalid/db';
  const loaded = loadAll({ evaluate() { throw new Error(secret); } });
  const id = 'BROWSE_ELIGIBILITY_RATIO';
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(result.state, 'MONITORING_FAILED');
  assert.notEqual(result.state, 'HEALTHY');
  assert.ok(!publicText(result, loaded.evaluator).includes(secret));
});

test('NO_SIGNAL is INSUFFICIENT_EVIDENCE, never HEALTHY', async () => {
  const loaded = loadAll({ evaluate() { throw new Error('unused'); } });
  const result = await loaded.evaluator.evaluate({ release_sha: SHA, signals: [], calibration: [] });
  assert.equal(result.state, 'INSUFFICIENT_EVIDENCE');
  assert.notEqual(result.state, 'HEALTHY');
});

test('explicit INSUFFICIENT_BASELINE signal is fail-closed', async () => {
  let calls = 0;
  const loaded = loadAll({ evaluate() { calls += 1; return {}; } });
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, 'BASELINE_EVIDENCE_SUFFICIENCY')],
    calibration: [],
  });
  assert.equal(result.state, 'BASELINE_NOT_ESTABLISHED');
  assert.equal(calls, 0);
});

test('calibration is injected, bounded, detached, and no default sensitivity is used', async () => {
  let observed = null;
  const loaded = loadAll({
    evaluate(request) {
      observed = request.calibration;
      const t = request.calibration;
      assert.equal(t.expected_variation_max, 0.07);
      assert.equal(t.material_deviation_min, 0.19);
      assert.equal(t.critical_discontinuity_min, 0.41);
      assert.ok(Object.isFrozen(t));
      return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'MATERIAL_DEVIATION', 'complete');
    },
  });
  const id = 'BROWSE_ELIGIBILITY_RATIO';
  const config = calibration(id, 0.07, 0.19, 0.41);
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [config],
  });
  assert.equal(result.state, 'DEGRADED');
  assert.ok(observed);
  config.material_deviation_min = 99;
  assert.equal(observed.material_deviation_min, 0.19);

  const source = fs.readFileSync(BASELINE_PATH, 'utf8') + '\n' + fs.readFileSync(EVALUATOR_PATH, 'utf8');
  assert.doesNotMatch(source, /\b(?:DEFAULT|PRODUCTION)_[A-Z_]*(?:THRESHOLD|SENSITIVITY|ROW_TOTAL|COUNT_TOTAL)\b/);
  assert.doesNotMatch(source, /\btrees\s*={2,3}\s*\d+/i);
  assert.doesNotMatch(source, /\bmemories\s*={2,3}\s*\d+/i);
  assert.doesNotMatch(source, /\b45\b/);
});

test('missing calibration is insufficient evidence, never implicit healthy', async () => {
  let calls = 0;
  const loaded = loadAll({ evaluate() { calls += 1; throw new Error('must not call'); } });
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, 'BROWSE_ELIGIBILITY_RATIO')],
    calibration: [],
  });
  assert.equal(result.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(calls, 0);
});

test('malformed, unknown, private, raw-count and SQL/provider fields fail closed', async () => {
  const loaded = loadAll({ evaluate() { return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'NONE', 'complete'); } });
  const badSignals = [
    { signal_id: 'BROWSE_ELIGIBILITY_RATIO', signal_class: 'RATIO_SIGNAL', current_count: 45 },
    { signal_id: 'BROWSE_ELIGIBILITY_RATIO', signal_class: 'RATIO_SIGNAL', baseline_count: 44 },
    { signal_id: 'BROWSE_ELIGIBILITY_RATIO', signal_class: 'RATIO_SIGNAL', provider_id: 'neon' },
    { signal_id: 'BROWSE_ELIGIBILITY_RATIO', signal_class: 'RATIO_SIGNAL', sql: 'SELECT * FROM secrets' },
    { signal_id: 'BROWSE_ELIGIBILITY_RATIO', signal_class: 'RATIO_SIGNAL', token: 'secret' },
    { signal_id: 'UNKNOWN_SIGNAL', signal_class: 'RATIO_SIGNAL' },
  ];
  for (const signal of badSignals) {
    await assert.rejects(
      loaded.evaluator.evaluate({ release_sha: SHA, signals: [signal], calibration: [] }),
      TypeError,
    );
  }
});

test('malformed/private baseline-store result becomes bounded insufficient evidence with no leak', async () => {
  const secret = 'raw-db-error-secret';
  const loaded = loadAll({
    evaluate() {
      return { status: 'ESTABLISHED', baseline_deviation: 'NONE', evidence_completeness: 'complete', raw_error: secret };
    },
  });
  const id = 'TEMPORAL_BASELINE_DEVIATION';
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(result.state, 'INSUFFICIENT_EVIDENCE');
  const text = publicText(result, loaded.evaluator);
  assert.ok(!text.includes(secret));
  assert.ok(!text.includes('raw_error'));
});

test('public result contains no raw counts/IDs/SQL/provider/raw errors/secrets', async () => {
  const loaded = loadAll({
    evaluate() { return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'CRITICAL_DISCONTINUITY', 'complete'); },
  });
  const id = 'DEPLOYMENT_CORRELATED_DISCONTINUITY';
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(result.state, 'INCIDENT_CONFIRMED');
  const parsed = JSON.parse(publicText(result, loaded.evaluator));
  assert.deepEqual(Object.keys(parsed).sort(), ['state', 'summary']);
  const forbidden = ['current_count', 'baseline_count', 'tree_id', 'memory_id', 'user_id', 'sql', 'query', 'provider_id', 'raw_error', 'secret', 'token'];
  const text = JSON.stringify(parsed);
  for (const key of forbidden) assert.ok(!text.includes(key), `must not expose ${key}`);
});

test('outputs are frozen, detached and canonical JSON is deterministic across signal order', async () => {
  const loaded = loadAll({
    evaluate(request) {
      if (request.signal_id === 'ENTITY_RATE_OF_CHANGE') return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'MATERIAL_DEVIATION', 'complete');
      return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'EXPECTED_VARIATION', 'complete');
    },
  });
  const s1 = baselineSignal(loaded.baseline, 'ENTITY_RATE_OF_CHANGE');
  const s2 = baselineSignal(loaded.baseline, 'BROWSE_ELIGIBILITY_RATIO');
  const c1 = calibration('ENTITY_RATE_OF_CHANGE');
  const c2 = calibration('BROWSE_ELIGIBILITY_RATIO');
  const a = await loaded.evaluator.evaluate({ release_sha: SHA, signals: [s1, s2], calibration: [c1, c2] });
  const b = await loaded.evaluator.evaluate({ release_sha: SHA, signals: [s2, s1], calibration: [c2, c1] });
  assert.equal(loaded.evaluator.canonicalJson(a), loaded.evaluator.canonicalJson(b));
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.summary));
  assert.throws(() => { a.state = 'HEALTHY'; }, TypeError);
  s1.signal_class = 'INSUFFICIENT_BASELINE';
  c1.material_deviation_min = 999;
  assert.equal(a.state, 'DEGRADED');
});

test('#3835 vocabulary compatibility: every summary is a real canonical taxonomy result', async () => {
  const loaded = loadAll({ evaluate() { return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'NONE', 'complete'); } });
  const id = 'BROWSE_ELIGIBILITY_RATIO';
  const result = await loaded.evaluator.evaluate({
    release_sha: SHA,
    signals: [baselineSignal(loaded.baseline, id)],
    calibration: [calibration(id)],
  });
  assert.equal(result.state, 'HEALTHY');
  assert.equal(loaded.taxonomy.isCanonicalResult(result.summary), true);
  assert.ok(Object.values(loaded.taxonomy.OUTCOME_CODES).includes(result.summary.outcome_code));
  assert.ok(Object.values(loaded.taxonomy.BASELINE_DEVIATION_CLASSES).includes(result.summary.baseline_deviation));
  assert.ok(Object.values(loaded.taxonomy.SEVERITIES).includes(result.summary.severity));
  assert.ok(Object.values(loaded.taxonomy.OWNER_ACTIONS).includes(result.summary.owner_action));
});

test('#4061/#3860 parity boundary remains a translation dependency, never a second parity engine', () => {
  const evaluatorSource = fs.readFileSync(EVALUATOR_PATH, 'utf8');
  const baselineSource = fs.readFileSync(BASELINE_PATH, 'utf8');
  const combined = evaluatorSource + '\n' + baselineSource;
  assert.doesNotMatch(combined, /PARITY_OUTCOMES\s*=/);
  assert.doesNotMatch(combined, /expected[_ -]?schema/i);
  assert.doesNotMatch(combined, /observed[_ -]?(?:schema|catalog|fingerprint)/i);
  assert.doesNotMatch(combined, /fingerprint.*(?:===|==|compare)/i);
  assert.doesNotMatch(combined, /migration-readonly-target-attribution-parity-core/);

  const structural = fs.readFileSync(STRUCTURAL_CORE_PATH, 'utf8');
  const catalog = fs.readFileSync(STRUCTURAL_CATALOG_PATH, 'utf8');
  assert.match(structural, /NOT a second schema\/migration parity engine/i);
  assert.match(structural, /evaluateParitySignal/);
  assert.match(catalog, /PARITY_EVIDENCE/);
  if (fs.existsSync(PARITY_CORE_PATH)) {
    const parity = fs.readFileSync(PARITY_CORE_PATH, 'utf8');
    assert.match(parity, /PARITY_CONFIRMED/);
    assert.match(parity, /PARITY_MISMATCH/);
  }
});

test('new evaluation modules have zero forbidden runtime capability', () => {
  const source = fs.readFileSync(BASELINE_PATH, 'utf8') + '\n' + fs.readFileSync(EVALUATOR_PATH, 'utf8');
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /process\.env/,
    /require\s*\(\s*['"](?:pg|fs|node:fs|child_process|node:child_process)/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b|\bCREATE\b/i,
    /postgres:\/\//i,
    /neon\.tech/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
});

test('accessor/Proxy-like hostile records fail closed without becoming healthy', async () => {
  const loaded = loadAll({ evaluate() { return baselineResult(loaded.taxonomy, 'ESTABLISHED', 'NONE', 'complete'); } });
  let getterCalls = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'signal_id', { enumerable: true, get() { getterCalls += 1; return 'BROWSE_ELIGIBILITY_RATIO'; } });
  Object.defineProperty(hostile, 'signal_class', { enumerable: true, value: 'RATIO_SIGNAL' });
  await assert.rejects(
    loaded.evaluator.evaluate({ release_sha: SHA, signals: [hostile], calibration: [] }),
    TypeError,
  );
  assert.equal(getterCalls, 0);
});
