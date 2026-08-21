'use strict';

// Issue #4082 — NONPROD/Preview reliability rehearsal suite (LOCAL_PACKAGE).
//
// Executes the complete local rehearsal matrix against the
// workers/reliability-preview runtime adapter package and the merged
// observability cores (#4079 evaluator/boundary, #3835 taxonomy, #3861
// delivery core). Everything here is LOCAL: in-memory SQLite, injected
// clocks/timers, injected collection/fetch effects. This suite proves source
// behavior ONLY. It is not Cloudflare Preview execution, not Durable Object
// provider behavior, not Cron binding, not secret binding, and not Slack
// delivery. Those remain ACTUAL_PROVIDER_PREVIEW = NOT_EXECUTED.
//
// Refs #4082. Refs #4079/#4080/#4081/#3835/#3861/#3874.
// Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..', '..');

const previewConfig = require(path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-config.cjs'));
const previewStore = require(path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-store.cjs'));
const previewCollector = require(path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-collector.cjs'));
const previewTransport = require(path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-alert-transport.cjs'));
const previewRunner = require(path.join(ROOT, 'workers', 'reliability-preview', 'reliability-preview-runner.cjs'));

function loadWindowSource(filePath, globalName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  new Function('window', source)(sandbox.window);
  assert.ok(sandbox.window[globalName], 'missing ' + globalName);
  return sandbox.window[globalName];
}

const taxonomy = loadWindowSource(
  path.join(ROOT, 'js', 'observability', 'reliability-sentinel-taxonomy.js'),
  'LoveBudReliabilitySentinelTaxonomy'
);
const baselineContract = loadWindowSource(
  path.join(ROOT, 'js', 'observability', 'reliability-baseline-store-contract.js'),
  'LoveBudReliabilityBaselineStoreContract'
);
const evaluatorCore = loadWindowSource(
  path.join(ROOT, 'js', 'observability', 'reliability-anomaly-evaluator-core.js'),
  'LoveBudReliabilityAnomalyEvaluatorCore'
);
const alertDeliveryCoreApi = loadWindowSource(
  path.join(ROOT, 'js', 'observability', 'reliability-alert-delivery-core.js'),
  'LoveBudReliabilityAlertDeliveryCore'
);

const MAIN_SHA = '88389cd4c80f8ec0af737dfb3b54d65afeb620e2';

const SIGNAL_ID = 'BROWSE_ELIGIBILITY_RATIO';
const SIGNAL_CLASS = baselineContract.SIGNAL_CLASSES.RATIO_SIGNAL;

const CALIBRATION = Object.freeze({
  signal_id: SIGNAL_ID,
  expected_variation_max: 0.05,
  material_deviation_min: 0.15,
  critical_discontinuity_min: 0.30
});

const PRIVACY_MARKERS = [
  'https://hooks.slack.invalid/services/T000/B000/XXXX',
  'xoxb-SECRET-TOKEN-VALUE',
  'owner@example.com',
  'firebase-id-token-abc',
  'postgres://user:password@db.host.internal/neondb',
  'PRIVATE_ROW_MARKER_7f3a',
  'TITLE_PRIVATE_MARKER'
];

const privacySurfaces = [];

function trackPrivacy(label, value) {
  privacySurfaces.push({ label, serialized: JSON.stringify(value) });
}

function testTimer(fn, ms) {
  return setTimeout(fn, ms);
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function makeClock(startMs) {
  let now = startMs;
  return {
    now: function () { return now; },
    advance: function (ms) { now += ms; }
  };
}

function makeConfig(overrides) {
  return previewConfig.createPreviewConfig(Object.assign({}, overrides));
}

function makeStore(clock, configOverrides) {
  return previewStore.createPreviewStore({
    database: new DatabaseSync(':memory:'),
    config: makeConfig(configOverrides),
    now: clock.now
  });
}

function makeEvaluator(store) {
  return evaluatorCore.createAnomalyEvaluator({
    taxonomy,
    baseline_contract: baselineContract,
    baseline_store: store
  });
}

function seedStableBaseline(store, clock, count) {
  for (let i = 0; i < (count || 12); i++) {
    store.recordBaselineSample(SIGNAL_ID, 100 + (i % 2 === 0 ? 0.5 : -0.5), clock.now());
    clock.advance(60 * 1000);
  }
}

function makeCollector(effect, overrides) {
  return previewCollector.createPreviewCollector(Object.assign({
    collectEffect: effect,
    timeoutMs: 5000,
    timer: testTimer,
    clearTimer: function () {},
    validateSignalIdentity: baselineContract.validateSignalIdentity
  }, overrides || {}));
}

function baselineSignal(valueBucket) {
  return { signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS };
}

function makeTransport(fetchScript, callsOut) {
  return previewTransport.createSlackPreviewTransport({
    fetchEffect: async function (url, init) {
      callsOut.push({ urlClass: typeof url, body: init && typeof init.body === 'string' ? init.body : null });
      return fetchScript(url, init);
    },
    timeoutMs: 2000,
    timer: testTimer,
    clearTimer: function () {}
  });
}

function acceptedFetch() {
  return Promise.resolve({ status: 200 });
}

function makeRunner(deps) {
  return previewRunner.createPreviewRunner(Object.assign({
    now: deps.clock ? deps.clock.now : undefined,
    timer: testTimer,
    clearTimer: function () {},
    releaseSha: MAIN_SHA,
    calibrationBySignal: { [SIGNAL_ID]: CALIBRATION },
    taxonomy,
    alertCore: alertDeliveryCoreApi,
    webhookUrlProvider: function () { return 'https://hooks.slack.invalid/services/T000/B000/XXXX'; }
  }, deps));
}



// ---------------------------------------------------------------------------

test('4082 FIXED NONPROD DECISIONS — runtime bounds and kill-switch defaults', function () {
  const config = makeConfig();
  assert.equal(config.RUNTIME_BOUNDS.SCHEDULE_CADENCE_MS, 5 * 60 * 1000);
  assert.equal(config.RUNTIME_BOUNDS.COLLECTOR_TIMEOUT_MS, 5000);
  assert.equal(config.RUNTIME_BOUNDS.FULL_RUN_TIMEOUT_MS, 30000);
  assert.equal(config.RUNTIME_BOUNDS.LEASE_DURATION_MS, 90000);
  assert.equal(config.RUNTIME_BOUNDS.BASELINE_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(config.RUNTIME_BOUNDS.MAX_SAMPLES_PER_SIGNAL, 8640);
  assert.equal(config.RUNTIME_BOUNDS.DEDUPE_MAX_ENTRIES, 2048);
  assert.equal(config.RUNTIME_BOUNDS.HEARTBEAT_HISTORY_MAX, 2016);
  assert.equal(config.RUNTIME_BOUNDS.DEADMAN_STALE_THRESHOLD_MS, 7 * 60 * 1000);
  assert.equal(config.kill_switches.read_only_sentinel, 'DISABLED');
  assert.equal(config.kill_switches.alert_delivery, 'DISABLED');
  assert.equal(previewConfig.KILL_SWITCH_NAMES.READ_ONLY_SENTINEL, 'RELIABILITY_READ_ONLY_SENTINEL_ENABLED');
  assert.equal(previewConfig.KILL_SWITCH_NAMES.ALERT_DELIVERY, 'RELIABILITY_ALERT_DELIVERY_ENABLED');
});

test('4082 FAILURE SEMANTICS — invalid configuration fails closed', function () {
  assert.throws(function () { makeConfig({ COLLECTOR_TIMEOUT_MS: -5 }); }, /INVALID_CONFIG/);
  assert.throws(function () { makeConfig({ LEASE_DURATION_MS: 1.5 }); }, /INVALID_CONFIG/);
  assert.throws(function () { makeConfig({ DEDUPE_MAX_ENTRIES: '2048' }); }, /INVALID_CONFIG/);
});

test('4082 KILL SWITCH CLASSIFICATION — unknown/malformed fails disabled', function () {
  assert.equal(previewConfig.classifyKillSwitch(undefined), 'DISABLED');
  assert.equal(previewConfig.classifyKillSwitch(null), 'DISABLED');
  assert.equal(previewConfig.classifyKillSwitch('garbage'), 'DISABLED');
  assert.equal(previewConfig.classifyKillSwitch(42), 'DISABLED');
  assert.equal(previewConfig.classifyKillSwitch('TRUE'), 'ENABLED');
  assert.equal(previewConfig.classifyKillSwitch('false'), 'DISABLED');
});

test('4082 SCHEDULER REHEARSAL — logical disable short-circuits before any capability use', async function () {
  const clock = makeClock(1_000_000);
  const store = makeStore(clock);
  let collectorInvocations = 0;
  const runner = makeRunner({
    clock,
    config: makeConfig(),
    store,
    collector: makeCollector(function () { collectorInvocations += 1; return []; }),
    evaluator: makeEvaluator(store)
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_DISABLED');
  assert.equal(collectorInvocations, 0);
  assert.equal(store.countHeartbeatRows(), 0);
  assert.equal(store.hasActiveLease(clock.now()), false);
  trackPrivacy('run-record-disabled', record);
});

test('4082 SCHEDULER REHEARSAL — one run per trigger acquires and releases the lease', async function () {
  const clock = makeClock(2_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true }),
    store,
    collector: makeCollector(function () { return [baselineSignal()]; }),
    evaluator: makeEvaluator(store)
  });
  const first = await runner.run('CRON_TRIGGER');
  assert.equal(first.run_class, 'RUN_COMPLETED');
  assert.equal(first.lease_outcome, 'ACQUIRED');
  assert.equal(first.heartbeat_class, 'RECORDED');
  assert.equal(store.hasActiveLease(), false);
  const second = await runner.run('CRON_TRIGGER');
  assert.equal(second.run_class, 'RUN_COMPLETED');
  assert.equal(store.countHeartbeatRows(), 2);
  trackPrivacy('run-record-completed', first);
});

test('4082 SCHEDULER REHEARSAL — overlap suppression rejects a second concurrent runner', async function () {
  const clock = makeClock(3_000_000);
  const store = makeStore(clock);
  const manual = store.acquireLease('holder-A', clock.now());
  assert.equal(manual.outcome, 'ACQUIRED');
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true }),
    store,
    collector: makeCollector(function () { return []; }),
    evaluator: makeEvaluator(store)
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_LEASE_BUSY');
  assert.equal(record.lease_outcome, 'BUSY');
  assert.equal(record.collector_outcome, null);
  assert.equal(store.countHeartbeatRows(), 0);
});

test('4082 SCHEDULER REHEARSAL — expired lease is reclaimable', async function () {
  const clock = makeClock(4_000_000);
  const store = makeStore(clock);
  store.acquireLease('stale-holder', clock.now());
  clock.advance(90 * 1000 + 1);
  const reacquired = store.acquireLease('fresh-runner', clock.now());
  assert.equal(reacquired.outcome, 'ACQUIRED');
  assert.equal(reacquired.expires_at, clock.now() + 90000);
});

test('4082 SCHEDULER REHEARSAL — full-run timeout bounds execution and finalization still releases the lease', async function () {
  const clock = makeClock(5_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const hangingEffect = function () { return new Promise(function () {}); };
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, FULL_RUN_TIMEOUT_MS: 20, COLLECTOR_TIMEOUT_MS: 50 }),
    store,
    collector: makeCollector(hangingEffect, { timeoutMs: 50 }),
    evaluator: makeEvaluator(store)
  });
  const startedAt = Date.now();
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_TIMEOUT');
  assert.ok(Date.now() - startedAt < 5000);
  await sleep(250);
  assert.equal(store.hasActiveLease(), false);
  trackPrivacy('run-record-timeout', record);
});

test('4082 COLLECTOR REHEARSAL — read-only collection returns bounded signals', async function () {
  const collector = makeCollector(function () {
    return [{ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS }];
  });
  const result = await collector.collect();
  assert.equal(result.outcome, 'COLLECTED');
  assert.equal(result.signals.length, 1);
  assert.deepEqual(Object.keys(result.signals[0]).sort(), ['signal_class', 'signal_id']);
  trackPrivacy('collector-result', result);
});

test('4082 COLLECTOR REHEARSAL — collector timeout fails closed at the configured bound', async function () {
  const collector = makeCollector(function () {
    return new Promise(function () {});
  }, { timeoutMs: 10 });
  const result = await collector.collect();
  assert.equal(result.outcome, 'COLLECTOR_TIMEOUT');
  assert.equal(result.signals.length, 0);
});

test('4082 COLLECTOR REHEARSAL — collector failure fails closed without raw error leakage', async function () {
  const collector = makeCollector(async function () {
    throw new Error('postgres://user:password@db.host.internal/neondb exploded');
  });
  const result = await collector.collect();
  assert.equal(result.outcome, 'COLLECTOR_FAILED');
  assert.equal(JSON.stringify(result).includes('postgres://'), false);
  trackPrivacy('collector-failure', result);
});

test('4082 COLLECTOR REHEARSAL — malformed collector result fails closed', async function () {
  const malformedIdentity = makeCollector(function () {
    return [{ signal_id: 'NOT_IN_VOCABULARY', signal_class: SIGNAL_CLASS }];
  });
  assert.equal((await malformedIdentity.collect()).outcome, 'COLLECTOR_MALFORMED');
  const extraKeys = makeCollector(function () {
    return [{ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS, title: 'PRIVATE_TITLE' }];
  });
  assert.equal((await extraKeys.collect()).outcome, 'COLLECTOR_MALFORMED');
});

test('4082 COLLECTOR REHEARSAL — collector performs no logging', async function () {
  const original = { log: console.log, warn: console.warn, error: console.error };
  let logged = 0;
  console.log = function () { logged += 1; };
  console.warn = function () { logged += 1; };
  console.error = function () { logged += 1; };
  try {
    const collector = makeCollector(function () { return []; });
    await collector.collect();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
  assert.equal(logged, 0);
});

test('4082 STORE REHEARSAL — deterministic ordering independent of insertion order', function () {
  const clock = makeClock(6_000_000);
  const store = makeStore(clock);
  store.recordBaselineSample(SIGNAL_ID, 30, 6_000_300);
  store.recordBaselineSample(SIGNAL_ID, 10, 6_000_100);
  store.recordBaselineSample(SIGNAL_ID, 20, 6_000_200);
  const samples = store.getBaselineSamples(SIGNAL_ID);
  assert.deepEqual(samples.map(function (s) { return s.value; }), [10, 20, 30]);
});

test('4082 STORE REHEARSAL — 30-day retention prunes aged samples', function () {
  const clock = makeClock(7_000_000);
  const store = makeStore(clock);
  store.recordBaselineSample(SIGNAL_ID, 1, clock.now() - (30 * 24 * 60 * 60 * 1000) - 1);
  store.recordBaselineSample(SIGNAL_ID, 2, clock.now());
  assert.equal(store.countBaselineSamples(SIGNAL_ID), 1);
  assert.equal(store.getBaselineSamples(SIGNAL_ID)[0].value, 2);
});

test('4082 STORE REHEARSAL — sample bound holds at 8640 with newest retained', function () {
  const clock = makeClock(8_000_000);
  const store = makeStore(clock);
  for (let i = 0; i < 8700; i++) {
    store.recordBaselineSample(SIGNAL_ID, i, clock.now());
    clock.advance(1);
  }
  assert.equal(store.countBaselineSamples(SIGNAL_ID), 8640);
  const samples = store.getBaselineSamples(SIGNAL_ID);
  assert.equal(samples[samples.length - 1].value, 8699);
  assert.equal(samples[0].value, 60);
});

test('4082 STORE REHEARSAL — #4079 boundary classifies established baseline and deviation classes', function () {
  const clock = makeClock(9_000_000);
  const store = makeStore(clock);
  for (let i = 0; i < 10; i++) {
    store.recordBaselineSample(SIGNAL_ID, 100, clock.now());
    clock.advance(1000);
  }
  const stable = store.evaluate({ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS, calibration: CALIBRATION });
  assert.equal(stable.status, 'ESTABLISHED');
  assert.equal(stable.baseline_deviation, 'EXPECTED_VARIATION');
  assert.equal(stable.evidence_completeness, 'complete');

  store.recordBaselineSample(SIGNAL_ID, 120, clock.now());
  const material = store.evaluate({ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS, calibration: CALIBRATION });
  assert.equal(material.baseline_deviation, 'MATERIAL_DEVIATION');

  store.recordBaselineSample(SIGNAL_ID, 400, clock.now());
  const critical = store.evaluate({ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS, calibration: CALIBRATION });
  assert.equal(critical.baseline_deviation, 'CRITICAL_DISCONTINUITY');

  const sparse = makeStore(makeClock(9_500_000));
  sparse.recordBaselineSample(SIGNAL_ID, 100, 9_500_000);
  const insufficient = sparse.evaluate({ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS, calibration: CALIBRATION });
  assert.equal(insufficient.status, 'INSUFFICIENT');
  assert.equal(insufficient.baseline_deviation, 'UNKNOWN');
});

test('4082 FAILURE SEMANTICS — baseline store unavailable classifies MONITORING_FAILED, never healthy', async function () {
  const throwingStore = {
    evaluate: async function () { throw new Error('storage gone'); }
  };
  const boundary = baselineContract.createBaselineStoreBoundary({ store: throwingStore, taxonomy });
  const result = await boundary.evaluateBaselineSignal({
    signal_id: SIGNAL_ID,
    signal_class: SIGNAL_CLASS,
    calibration: CALIBRATION
  });
  assert.equal(result.status, 'MONITORING_FAILED');
  assert.equal(result.baseline_deviation, 'UNKNOWN');
});

test('4082 FAILURE SEMANTICS — malformed store result classifies INSUFFICIENT, never fabricated completeness', async function () {
  const lyingStore = {
    evaluate: async function () {
      return { status: 'ESTABLISHED', baseline_deviation: 'SUPER_CRITICAL_FABRICATED', evidence_completeness: 'complete' };
    }
  };
  const boundary = baselineContract.createBaselineStoreBoundary({ store: lyingStore, taxonomy });
  const result = await boundary.evaluateBaselineSignal({
    signal_id: SIGNAL_ID,
    signal_class: SIGNAL_CLASS,
    calibration: CALIBRATION
  });
  assert.equal(result.status, 'INSUFFICIENT');
  assert.equal(result.evidence_completeness, 'invalid');
});

test('4082 FAILURE SEMANTICS — contract-valid ESTABLISHED with UNKNOWN deviation fails closed at evaluation', async function () {
  const ambiguousStore = {
    evaluate: async function () {
      return { status: 'ESTABLISHED', baseline_deviation: 'UNKNOWN', evidence_completeness: 'complete' };
    }
  };
  const evaluator = evaluatorCore.createAnomalyEvaluator({
    taxonomy,
    baseline_contract: baselineContract,
    baseline_store: ambiguousStore
  });
  const result = await evaluator.evaluate({
    release_sha: MAIN_SHA,
    signals: [{ signal_id: SIGNAL_ID, signal_class: SIGNAL_CLASS }],
    calibration: [CALIBRATION]
  });
  assert.equal(result.state, 'INSUFFICIENT_EVIDENCE');
});

test('4082 DEDUPE REHEARSAL — same incident does not spam alerts; material transition emits a new alert', async function () {
  const clock = makeClock(10_000_000);
  const store = makeStore(clock);
  const fetchCalls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, fetchCalls);

  function deliver(severity, deviation) {
    const core = alertDeliveryCoreApi.createAlertDeliveryCore({
      taxonomy,
      priorFingerprints: store.getDedupeFingerprints(),
      deliverAlert: function (envelope) {
        return transport.deliver('https://hooks.slack.invalid/services/T000/B000/XXXX', envelope)
          .then(function (r) { return r.result; });
      }
    });
    return core.deliverAlert({
      source_class: alertDeliveryCoreApi.SOURCE_CLASSES.STRUCTURAL_SENTINEL,
      operation_class: 'BROWSE_ELIGIBILITY_BASELINE_CHECK',
      outcome_code: taxonomy.OUTCOME_CODES.BASELINE_DISCONTINUITY_DETECTED,
      release_sha: MAIN_SHA,
      severity,
      owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
      evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE,
      baseline_deviation: deviation
    });
  }

  const first = await deliver(taxonomy.SEVERITIES.WARNING, taxonomy.BASELINE_DEVIATION_CLASSES.MATERIAL_DEVIATION);
  assert.equal(first.outcome, 'DELIVERY_ACCEPTED');
  store.recordDedupe(first.envelope.dedupe_fingerprint, clock.now());

  const duplicate = await deliver(taxonomy.SEVERITIES.WARNING, taxonomy.BASELINE_DEVIATION_CLASSES.MATERIAL_DEVIATION);
  assert.equal(duplicate.outcome, 'DELIVERY_SUPPRESSED_DUPLICATE');
  assert.equal(fetchCalls.length, 1);

  const escalated = await deliver(taxonomy.SEVERITIES.BLOCKING, taxonomy.BASELINE_DEVIATION_CLASSES.CRITICAL_DISCONTINUITY);
  assert.equal(escalated.outcome, 'DELIVERY_ACCEPTED');
  assert.equal(fetchCalls.length, 2);
  assert.notEqual(escalated.envelope.dedupe_fingerprint, first.envelope.dedupe_fingerprint);
  trackPrivacy('dedupe-envelope', duplicate.envelope);
});

test('4082 DEDUPE REHEARSAL — dedupe state bounded at 2048 entries with newest retained', function () {
  const clock = makeClock(11_000_000);
  const store = makeStore(clock);
  for (let i = 0; i < 2100; i++) {
    store.recordDedupe(String(i).padStart(64, '0'), clock.now());
    clock.advance(1);
  }
  assert.equal(store.countDedupeEntries(), 2048);
  assert.equal(store.getDedupeFingerprints().includes(String(2099).padStart(64, '0')), true);
  assert.equal(store.getDedupeFingerprints().includes(String(0).padStart(64, '0')), false);
});

test('4082 HEARTBEAT / DEAD-MAN REHEARSAL — persistence, 2016 bound, and 7-minute stale threshold', function () {
  const clock = makeClock(12_000_000);
  const store = makeStore(clock);
  const reader = previewRunner.createPreviewDeadManReader({ store, now: clock.now });

  assert.equal(reader.read().deadman_class, 'NEVER_RECORDED');

  store.recordHeartbeat('EVAL_HEALTHY', MAIN_SHA, clock.now());
  assert.equal(reader.read().deadman_class, 'CURRENT');

  clock.advance(7 * 60 * 1000);
  assert.equal(reader.read().deadman_class, 'CURRENT');

  clock.advance(1);
  const stale = reader.read();
  assert.equal(stale.deadman_class, 'STALE');
  assert.equal(stale.age_ms, 7 * 60 * 1000 + 1);

  for (let i = 0; i < 2100; i++) {
    clock.advance(1000);
    store.recordHeartbeat('EVAL_HEALTHY', MAIN_SHA, clock.now());
  }
  assert.equal(store.countHeartbeatRows(), 2016);
  trackPrivacy('deadman-stale', stale);
});

test('4082 FAILURE SEMANTICS — dead-man reader classifies store failure as AUTHORITY_UNAVAILABLE, never healthy', function () {
  const brokenReader = previewRunner.createPreviewDeadManReader({
    store: {
      heartbeatStatus: function () { throw new Error('private storage failure'); }
    },
    now: function () { return 0; }
  });
  assert.equal(brokenReader.read().deadman_class, 'AUTHORITY_UNAVAILABLE');
});

test('4082 ALERT TRANSPORT REHEARSAL — single attempt, NO automatic retry on every failure class', async function () {
  const cases = [
    { script: function () { return Promise.resolve({ status: 500 }); }, expected: 'UNAVAILABLE' },
    { script: function () { return Promise.resolve({ status: 403 }); }, expected: 'REJECTED' },
    { script: function () { return Promise.reject(new Error('dns')); }, expected: 'UNAVAILABLE' },
    { script: function () { return new Promise(function () {}); }, expected: 'TIMEOUT' }
  ];
  for (const c of cases) {
    const calls = [];
    const transport = makeTransport(c.script, calls);
    const envelope = alertDeliveryCoreApi.createAlertDeliveryCore({
      taxonomy,
      deliverAlert: async function () { return 'ACCEPTED'; }
    }).createEnvelope({
      source_class: 'STRUCTURAL_SENTINEL',
      operation_class: 'BROWSE_ELIGIBILITY_BASELINE_CHECK',
      outcome_code: 'BASELINE_DISCONTINUITY_DETECTED',
      release_sha: MAIN_SHA,
      severity: 'WARNING',
      owner_action: 'INVESTIGATE',
      evidence_completeness: 'complete',
      baseline_deviation: 'MATERIAL_DEVIATION'
    });
    const result = await transport.deliver('https://hooks.slack.invalid/services/T000/B000/XXXX', envelope);
    assert.equal(result.result, c.expected);
    assert.equal(result.attempt_class.indexOf('SINGLE_ATTEMPT'), 0);
    assert.equal(calls.length, 1);
    assert.equal(JSON.stringify(result).includes('hooks.slack'), false);
    trackPrivacy('transport-result-' + c.expected, result);
  }
});

test('4082 FAILURE SEMANTICS — missing nonprod secret classifies NOT_ATTEMPTED with zero network use', async function () {
  const calls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, calls);
  const envelope = { text: '[NONPROD_RELIABILITY_PREVIEW]' };
  const result = await transport.deliver(null, envelope);
  assert.equal(result.result, 'UNAVAILABLE');
  assert.equal(result.attempt_class, 'NOT_ATTEMPTED_INVALID_TARGET');
  assert.equal(calls.length, 0);
});

test('4082 ALERT TRANSPORT REHEARSAL — payload carries bounded reliability fields only', async function () {
  const calls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, calls);
  const core = alertDeliveryCoreApi.createAlertDeliveryCore({
    taxonomy,
    deliverAlert: async function () { return 'ACCEPTED'; }
  });
  const envelope = core.createEnvelope({
    source_class: 'STRUCTURAL_SENTINEL',
    operation_class: 'BROWSE_ELIGIBILITY_BASELINE_CHECK',
    outcome_code: 'BASELINE_DISCONTINUITY_DETECTED',
    release_sha: MAIN_SHA,
    severity: 'BLOCKING',
    owner_action: 'INVESTIGATE',
    evidence_completeness: 'complete',
    baseline_deviation: 'CRITICAL_DISCONTINUITY'
  });
  const payload = transport.renderPayload(envelope);
  assert.match(payload.text, /^\[NONPROD_RELIABILITY_PREVIEW\]/);
  for (const marker of PRIVACY_MARKERS) {
    assert.equal(payload.text.includes(marker), false);
  }
  assert.equal(payload.text.includes('operation_class=BROWSE_ELIGIBILITY_BASELINE_CHECK'), true);
  assert.equal(payload.text.includes('severity=BLOCKING'), true);
  trackPrivacy('transport-payload', payload);
});

test('4082 END-TO-END PREVIEW REHEARSAL — healthy cycle records heartbeat and emits no alert', async function () {
  const clock = makeClock(13_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const fetchCalls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, fetchCalls);
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, kill_switch_alert: true }),
    store,
    collector: makeCollector(function () {
      store.recordBaselineSample(SIGNAL_ID, 100.5, clock.now());
      return [baselineSignal()];
    }),
    evaluator: makeEvaluator(store),
    transport
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_COMPLETED');
  assert.equal(record.collector_outcome, 'COLLECTED');
  assert.equal(record.evaluation_state, 'HEALTHY');
  assert.equal(record.alert_decision, 'NOT_ALERTABLE_STATE');
  assert.equal(record.heartbeat_class, 'RECORDED');
  assert.equal(fetchCalls.length, 0);
  assert.equal(store.hasActiveLease(), false);
  trackPrivacy('e2e-healthy-record', record);
});

test('4082 END-TO-END PREVIEW REHEARSAL — critical discontinuity alerts once, then dedupes', async function () {
  const clock = makeClock(14_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const fetchCalls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, fetchCalls);
  let collectedValue = 400;
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, kill_switch_alert: true }),
    store,
    collector: makeCollector(function () {
      store.recordBaselineSample(SIGNAL_ID, collectedValue, clock.now());
      return [baselineSignal()];
    }),
    evaluator: makeEvaluator(store),
    transport
  });

  const incident = await runner.run('CRON_TRIGGER');
  assert.equal(incident.evaluation_state, 'INCIDENT_SUSPECTED');
  assert.equal(incident.alert_decision, 'ALERT_ACCEPTED');
  assert.equal(fetchCalls.length, 1);
  assert.equal(store.countDedupeEntries(), 1);

  clock.advance(5 * 60 * 1000);
  const repeat = await runner.run('CRON_TRIGGER');
  assert.equal(repeat.evaluation_state, 'INCIDENT_SUSPECTED');
  assert.equal(repeat.alert_decision, 'ALERT_SUPPRESSED_DUPLICATE');
  assert.equal(fetchCalls.length, 1);
  trackPrivacy('e2e-incident-record', incident);
});

test('4082 KILL SWITCH REHEARSAL — alert switch independently disables transport invocation', async function () {
  const clock = makeClock(15_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const fetchCalls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, fetchCalls);
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, kill_switch_alert: false }),
    store,
    collector: makeCollector(function () {
      store.recordBaselineSample(SIGNAL_ID, 400, clock.now());
      return [baselineSignal()];
    }),
    evaluator: makeEvaluator(store),
    transport
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.evaluation_state, 'INCIDENT_SUSPECTED');
  assert.equal(record.alert_decision, 'ALERT_DISABLED_BY_KILL_SWITCH');
  assert.equal(fetchCalls.length, 0);
});

test('4082 FAILURE SEMANTICS — collector failure inside a run is classified and never blocks finalization', async function () {
  const clock = makeClock(16_000_000);
  const store = makeStore(clock);
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true }),
    store,
    collector: makeCollector(async function () { throw new Error('readonly role revoked'); }),
    evaluator: makeEvaluator(store)
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.collector_outcome, 'COLLECTOR_FAILED');
  assert.equal(record.evaluation_state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(record.heartbeat_class, 'RECORDED');
  assert.equal(store.hasActiveLease(), false);
  assert.equal(store.getBaselineSamples(SIGNAL_ID).length, 0);
});

test('4082 FAILURE SEMANTICS — heartbeat write failure is classified and the lease is still released', async function () {
  const clock = makeClock(17_000_000);
  const baseStore = makeStore(clock);
  const failingHeartbeatStore = Object.freeze(Object.assign({}, baseStore, {
    recordHeartbeat: function () { throw new Error('heartbeat disk full'); }
  }));
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true }),
    store: failingHeartbeatStore,
    collector: makeCollector(function () { return []; }),
    evaluator: makeEvaluator(baseStore)
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_FINALIZATION_FAILED');
  assert.equal(baseStore.hasActiveLease(), false);
  trackPrivacy('run-record-heartbeat-failure', record);
});

test('4082 FAILURE SEMANTICS — dedupe store failure is classified, never silent', async function () {
  const clock = makeClock(18_000_000);
  const baseStore = makeStore(clock);
  seedStableBaseline(baseStore, clock);
  const failingDedupeStore = Object.freeze(Object.assign({}, baseStore, {
    getDedupeFingerprints: function () { throw new Error('dedupe table unreadable'); }
  }));
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, kill_switch_alert: true }),
    store: failingDedupeStore,
    collector: makeCollector(function () {
      baseStore.recordBaselineSample(SIGNAL_ID, 400, clock.now());
      return [baselineSignal()];
    }),
    evaluator: makeEvaluator(baseStore),
    transport: makeTransport(function () { return acceptedFetch(); }, [])
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.run_class, 'RUN_FINALIZATION_FAILED');
  assert.equal(baseStore.hasActiveLease(), false);
});

test('4082 FAILURE SEMANTICS — missing nonprod webhook secret inside a run classifies transport unavailable', async function () {
  const clock = makeClock(19_000_000);
  const store = makeStore(clock);
  seedStableBaseline(store, clock);
  const fetchCalls = [];
  const transport = makeTransport(function () { return acceptedFetch(); }, fetchCalls);
  const runner = makeRunner({
    clock,
    config: makeConfig({ kill_switch_sentinel: true, kill_switch_alert: true }),
    store,
    collector: makeCollector(function () {
      store.recordBaselineSample(SIGNAL_ID, 400, clock.now());
      return [baselineSignal()];
    }),
    evaluator: makeEvaluator(store),
    transport,
    webhookUrlProvider: function () { return null; }
  });
  const record = await runner.run('CRON_TRIGGER');
  assert.equal(record.evaluation_state, 'INCIDENT_SUSPECTED');
  assert.equal(record.alert_decision, 'ALERT_TRANSPORT_UNAVAILABLE');
  assert.equal(fetchCalls.length, 0);
  assert.equal(store.hasActiveLease(), false);
});

test('4082 PRIVACY AUDIT — no private marker crosses any rehearsal surface', function () {
  assert.ok(privacySurfaces.length >= 10);
  for (const surface of privacySurfaces) {
    for (const marker of PRIVACY_MARKERS) {
      assert.equal(
        surface.serialized.includes(marker),
        false,
        'privacy leak in surface ' + surface.label + ' for marker class'
      );
    }
  }
});
