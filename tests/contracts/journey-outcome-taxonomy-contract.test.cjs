'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(ROOT, 'js', 'observability', 'journey-outcome-taxonomy.js');

function loadBrowserTaxonomy() {
  const source = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const sandbox = { window: {} };

  // Use Function to evaluate the script in a restricted scope
  const fn = new Function('window', source);
  fn(sandbox.window);

  return sandbox.window.LoveBudJourneyOutcomeTaxonomy;
}

test('contract version and canonical class vocabularies are exact', () => {
  const taxonomy = loadBrowserTaxonomy();
  assert.equal(taxonomy.CONTRACT_VERSION, '1');
  assert.deepEqual(Object.values(taxonomy.STATUS_CLASSES).sort(), ['FAILED', 'HEALTHY']);
  assert.deepEqual(Object.values(taxonomy.EXPECTATION_CLASSES).sort(), ['EXPECTED_SUCCESS', 'UNEXPECTED_FAILURE']);
  assert.deepEqual(Object.values(taxonomy.SEVERITY_CLASSES).sort(), ['ERROR', 'INFO']);
  assert.deepEqual(Object.values(taxonomy.LATENCY_BUCKETS).sort(), [
    'GTE_5_S', 'LT_1_S', 'LT_250_MS', 'LT_2_S', 'LT_5_S', 'LT_500_MS', 'TIMEOUT_OR_UNKNOWN',
  ].sort());
  assert.deepEqual(Object.values(taxonomy.HTTP_STATUS_CLASSES).sort(), [
    'HTTP_2XX', 'HTTP_3XX', 'HTTP_4XX', 'HTTP_5XX', 'HTTP_OTHER', 'NOT_MEASURED',
  ].sort());
  assert.deepEqual(Object.values(taxonomy.JOURNEYS).sort(), ['JOURNEY_AUTHENTICATED_MY_TREES_LOAD']);
  assert.deepEqual(Object.values(taxonomy.STAGES).sort(), [
    'ACTION_STARTED', 'CANCELLED', 'CLIENT_STATE_UPDATED', 'CLIENT_VALIDATION_PASSED',
    'DUPLICATE_SUPPRESSED', 'NOT_MEASURABLE', 'PERSISTENCE_CONFIRMED', 'REQUEST_DISPATCHED',
    'RESPONSE_ACCEPTED', 'TERMINAL_FAILURE', 'TERMINAL_SUCCESS', 'TIMED_OUT', 'UI_ACKNOWLEDGED'
  ].sort());
  assert.deepEqual(Object.values(taxonomy.FAILURE_CODES).sort(), [
    'LB_JOURNEY_API_UNAVAILABLE', 'LB_JOURNEY_AUTH_PREPARE_FAILED', 'LB_JOURNEY_AUTH_REQUIRED',
    'LB_JOURNEY_HTTP_4XX', 'LB_JOURNEY_HTTP_5XX', 'LB_JOURNEY_INVALID_PAYLOAD', 'LB_JOURNEY_NETWORK',
    'LB_JOURNEY_RESPONSE_PARSE', 'LB_UNEXPECTED_FAILURE', 'LB_UI_ACKNOWLEDGEMENT_FAILED', 'NONE'
  ].sort());
});

test('latency boundaries are exact and reject implicit coercion', () => {
  const taxonomy = loadBrowserTaxonomy();
  const cases = [
    [0, taxonomy.LATENCY_BUCKETS.LT_250_MS],
    [249, taxonomy.LATENCY_BUCKETS.LT_250_MS],
    [250, taxonomy.LATENCY_BUCKETS.LT_500_MS],
    [499, taxonomy.LATENCY_BUCKETS.LT_500_MS],
    [500, taxonomy.LATENCY_BUCKETS.LT_1_S],
    [999, taxonomy.LATENCY_BUCKETS.LT_1_S],
    [1000, taxonomy.LATENCY_BUCKETS.LT_2_S],
    [1999, taxonomy.LATENCY_BUCKETS.LT_2_S],
    [2000, taxonomy.LATENCY_BUCKETS.LT_5_S],
    [4999, taxonomy.LATENCY_BUCKETS.LT_5_S],
    [5000, taxonomy.LATENCY_BUCKETS.GTE_5_S],
    [60000, taxonomy.LATENCY_BUCKETS.GTE_5_S],
    [null, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [undefined, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [NaN, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [Infinity, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [-Infinity, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [-1, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    ['250', taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [{ value: 250 }, taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [[], taxonomy.LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
  ];
  for (const [input, expected] of cases) {
    assert.equal(taxonomy.classifyLatency(input), expected, `latency ${String(input)} should classify as ${expected}`);
  }
});

test('HTTP status classes are exact at every boundary', () => {
  const taxonomy = loadBrowserTaxonomy();
  const cases = [
    [199, taxonomy.HTTP_STATUS_CLASSES.HTTP_OTHER],
    [200, taxonomy.HTTP_STATUS_CLASSES.HTTP_2XX],
    [299, taxonomy.HTTP_STATUS_CLASSES.HTTP_2XX],
    [300, taxonomy.HTTP_STATUS_CLASSES.HTTP_3XX],
    [399, taxonomy.HTTP_STATUS_CLASSES.HTTP_3XX],
    [400, taxonomy.HTTP_STATUS_CLASSES.HTTP_4XX],
    [499, taxonomy.HTTP_STATUS_CLASSES.HTTP_4XX],
    [500, taxonomy.HTTP_STATUS_CLASSES.HTTP_5XX],
    [599, taxonomy.HTTP_STATUS_CLASSES.HTTP_5XX],
    [600, taxonomy.HTTP_STATUS_CLASSES.HTTP_OTHER],
    [null, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
    [undefined, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
    [NaN, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
    [Infinity, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
    ['200', taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
    [200.5, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED],
  ];
  for (const [input, expected] of cases) {
    assert.equal(taxonomy.classifyHttpStatus(input), expected, `HTTP status ${String(input)} should classify as ${expected}`);
  }
});

test('unknown, URL, stack, token, and body strings fail closed without leakage', () => {
  const taxonomy = loadBrowserTaxonomy();
  const rawInputs = [
    'unknown runtime error',
    'fetch https://example.test?token=secret failed',
    'Error: unexpected failure\n    at /private/project/scripts/file.cjs:10:2',
    'Bearer very-secret-token',
    '{"responseBody":"private user content","provider_id":"acct-secret"}',
  ];
  for (const raw of rawInputs) {
    const normalized = taxonomy.normalizeFailureCode(raw);
    assert.equal(normalized, taxonomy.FAILURE_CODES.LB_UNEXPECTED_FAILURE);
    assert.equal(normalized.includes(raw), false);
    assert.equal(raw.includes(normalized), false);
  }
});

test('canonical exports, nested constants, and set-like allowlists are immutable', () => {
  const taxonomy = loadBrowserTaxonomy();
  assert.equal(Object.isFrozen(taxonomy), true, 'canonical export must be frozen');
  assert.equal(Object.isFrozen(taxonomy.STATUS_CLASSES), true);
  assert.equal(Object.isFrozen(taxonomy.FAILURE_CODES), true);
  assert.equal(Object.isFrozen(taxonomy.OUTCOME_EVENT_FIELDS), true);
  assert.deepEqual([...taxonomy.OUTCOME_EVENT_FIELDS], [
    'journey', 'stage', 'statusClass', 'expectationClass', 'severity',
    'failureCode', 'httpStatus', 'latencyBucket', 'resultCountBucket',
  ]);
  assert.equal(Object.isFrozen(taxonomy.STATUS_CLASS_SET), true);
  assert.throws(() => taxonomy.OUTCOME_EVENT_FIELDS.push('privateField'), TypeError);
  assert.throws(() => taxonomy.FAILURE_CODE_SET.add('raw-message'), TypeError);
  assert.equal(taxonomy.OUTCOME_EVENT_FIELDS.includes('privateField'), false);
});

test('bounded event builder is exact, canonical, immutable, and drops unknown input', () => {
  const taxonomy = loadBrowserTaxonomy();
  const raw = {
    stage: taxonomy.STAGES.TERMINAL_SUCCESS,
    statusClass: taxonomy.STATUS_CLASSES.FAILED,
    expectationClass: taxonomy.EXPECTATION_CLASSES.UNEXPECTED_FAILURE,
    severity: taxonomy.SEVERITY_CLASSES.ERROR,
    failureCode: 'fetch https://example.test?token=secret failed',
    httpStatus: 200,
    latencyMs: 250,
    resultCountBucket: 'positive',
    rawException: 'Error: secret response body',
    url: 'https://example.test/private?token=secret',
  };
  const before = { ...raw };
  const success = taxonomy.buildBoundedEvent(raw);

  assert.deepEqual(Object.keys(success), [...taxonomy.OUTCOME_EVENT_FIELDS]);
  assert.equal(Object.isFrozen(success), true);
  assert.equal(success.statusClass, taxonomy.STATUS_CLASSES.HEALTHY);
  assert.equal(success.expectationClass, taxonomy.EXPECTATION_CLASSES.EXPECTED_SUCCESS);
  assert.equal(success.severity, taxonomy.SEVERITY_CLASSES.INFO);
  assert.equal(success.failureCode, taxonomy.FAILURE_CODES.NONE);
  assert.equal(success.latencyBucket, taxonomy.LATENCY_BUCKETS.LT_500_MS);
  assert.equal(success.rawException, undefined);
  assert.equal(success.url, undefined);
  assert.deepEqual(raw, before, 'builder must not mutate its input');

  const failure = taxonomy.buildBoundedEvent({
    stage: taxonomy.STAGES.TERMINAL_FAILURE,
    statusClass: taxonomy.STATUS_CLASSES.HEALTHY,
    expectationClass: taxonomy.EXPECTATION_CLASSES.EXPECTED_SUCCESS,
    severity: taxonomy.SEVERITY_CLASSES.INFO,
    failureCode: 'Bearer very-secret-token',
    httpStatus: undefined,
    latencyMs: 5000,
    resultCountBucket: 'unknown',
  });
  assert.equal(failure.statusClass, taxonomy.STATUS_CLASSES.FAILED);
  assert.equal(failure.expectationClass, taxonomy.EXPECTATION_CLASSES.UNEXPECTED_FAILURE);
  assert.equal(failure.severity, taxonomy.SEVERITY_CLASSES.ERROR);
  assert.equal(failure.failureCode, taxonomy.FAILURE_CODES.LB_UNEXPECTED_FAILURE);
  assert.equal(failure.httpStatus, taxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED);
  assert.equal(failure.latencyBucket, taxonomy.LATENCY_BUCKETS.GTE_5_S);
});

test('fresh module import has no side effect beyond window.LoveBudJourneyOutcomeTaxonomy', () => {
  const source = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /console\./);
  assert.doesNotMatch(source, /setTimeout\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|cookie|indexedDB/);
});
