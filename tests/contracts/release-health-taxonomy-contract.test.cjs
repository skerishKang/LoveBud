'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(ROOT, 'scripts', 'release-health-taxonomy.cjs');
const taxonomy = require(TAXONOMY_PATH);

const {
  CONTRACT_VERSION,
  STATUS_CLASSES,
  EXPECTATION_CLASSES,
  SEVERITY_CLASSES,
  CONTENT_TYPE_CLASSES,
  RELEASE_MATCH_STATES,
  LATENCY_BUCKETS,
  HTTP_STATUS_CLASSES,
  SANITIZED_ERROR_CODES,
  SANITIZED_ERROR_CODE_FAMILIES,
  SANITIZED_ERROR_CODE_ALLOWLIST,
  STATUS_CLASS_SET,
  EXPECTATION_CLASS_SET,
  SEVERITY_CLASS_SET,
  CONTENT_TYPE_CLASS_SET,
  RELEASE_MATCH_STATE_SET,
  LATENCY_BUCKET_SET,
  HTTP_STATUS_CLASS_SET,
  SANITIZED_ERROR_CODE_SET,
  classifyLatency,
  classifyHttpStatus,
  classifyContentType,
  classifyReleaseMatch,
  normalizeSanitizedErrorCode,
} = taxonomy;

test('contract version and canonical class vocabularies are exact', () => {
  assert.equal(CONTRACT_VERSION, '1');
  assert.deepEqual(Object.values(STATUS_CLASSES).sort(), ['FAILED', 'HEALTHY']);
  assert.deepEqual(Object.values(EXPECTATION_CLASSES).sort(), ['EXPECTED_SUCCESS', 'UNEXPECTED_FAILURE']);
  assert.deepEqual(Object.values(SEVERITY_CLASSES).sort(), ['ERROR', 'INFO']);
  assert.deepEqual(Object.values(CONTENT_TYPE_CLASSES).sort(), ['CSS', 'HTML', 'JAVASCRIPT', 'JSON', 'NOT_MEASURED', 'OTHER']);
  assert.deepEqual(Object.values(RELEASE_MATCH_STATES).sort(), ['MATCH', 'MISMATCH', 'UNKNOWN']);
  assert.deepEqual(Object.values(LATENCY_BUCKETS).sort(), [
    'GTE_5_S', 'LT_1_S', 'LT_250_MS', 'LT_2_S', 'LT_5_S', 'LT_500_MS', 'TIMEOUT_OR_UNKNOWN',
  ].sort());
  assert.deepEqual(Object.values(HTTP_STATUS_CLASSES).sort(), [
    'HTTP_2XX', 'HTTP_3XX', 'HTTP_4XX', 'HTTP_5XX', 'HTTP_OTHER', 'NOT_MEASURED',
  ].sort());
});

test('latency boundaries are exact and reject implicit coercion', () => {
  const cases = [
    [0, LATENCY_BUCKETS.LT_250_MS],
    [249, LATENCY_BUCKETS.LT_250_MS],
    [250, LATENCY_BUCKETS.LT_500_MS],
    [499, LATENCY_BUCKETS.LT_500_MS],
    [500, LATENCY_BUCKETS.LT_1_S],
    [999, LATENCY_BUCKETS.LT_1_S],
    [1000, LATENCY_BUCKETS.LT_2_S],
    [1999, LATENCY_BUCKETS.LT_2_S],
    [2000, LATENCY_BUCKETS.LT_5_S],
    [4999, LATENCY_BUCKETS.LT_5_S],
    [5000, LATENCY_BUCKETS.GTE_5_S],
    [60000, LATENCY_BUCKETS.GTE_5_S],
    [null, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [undefined, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [NaN, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [Infinity, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [-Infinity, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [-1, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    ['250', LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [{ value: 250 }, LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
    [[], LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN],
  ];
  for (const [input, expected] of cases) {
    assert.equal(classifyLatency(input), expected, `latency ${String(input)} should classify as ${expected}`);
  }
  for (const [input, expected] of cases) {
    assert.equal(classifyLatency(input), expected, `repeated latency ${String(input)} should be deterministic`);
  }
});

test('HTTP status classes are exact at every boundary', () => {
  const cases = [
    [199, HTTP_STATUS_CLASSES.HTTP_OTHER],
    [200, HTTP_STATUS_CLASSES.HTTP_2XX],
    [299, HTTP_STATUS_CLASSES.HTTP_2XX],
    [300, HTTP_STATUS_CLASSES.HTTP_3XX],
    [399, HTTP_STATUS_CLASSES.HTTP_3XX],
    [400, HTTP_STATUS_CLASSES.HTTP_4XX],
    [499, HTTP_STATUS_CLASSES.HTTP_4XX],
    [500, HTTP_STATUS_CLASSES.HTTP_5XX],
    [599, HTTP_STATUS_CLASSES.HTTP_5XX],
    [600, HTTP_STATUS_CLASSES.HTTP_OTHER],
    [null, HTTP_STATUS_CLASSES.NOT_MEASURED],
    [undefined, HTTP_STATUS_CLASSES.NOT_MEASURED],
    [NaN, HTTP_STATUS_CLASSES.NOT_MEASURED],
    [Infinity, HTTP_STATUS_CLASSES.NOT_MEASURED],
    ['200', HTTP_STATUS_CLASSES.NOT_MEASURED],
    [200.5, HTTP_STATUS_CLASSES.NOT_MEASURED],
  ];
  for (const [input, expected] of cases) {
    assert.equal(classifyHttpStatus(input), expected, `HTTP status ${String(input)} should classify as ${expected}`);
  }
});

test('content type and release match classifiers use bounded canonical values', () => {
  assert.equal(classifyContentType('application/json; charset=utf-8'), CONTENT_TYPE_CLASSES.JSON);
  assert.equal(classifyContentType('text/css'), CONTENT_TYPE_CLASSES.CSS);
  assert.equal(classifyContentType('application/javascript'), CONTENT_TYPE_CLASSES.JAVASCRIPT);
  assert.equal(classifyContentType('text/html; charset=utf-8'), CONTENT_TYPE_CLASSES.HTML);
  assert.equal(classifyContentType('application/octet-stream'), CONTENT_TYPE_CLASSES.OTHER);
  assert.equal(classifyContentType(null), CONTENT_TYPE_CLASSES.NOT_MEASURED);
  assert.equal(classifyContentType(42), CONTENT_TYPE_CLASSES.NOT_MEASURED);

  assert.equal(classifyReleaseMatch('abc', 'abc'), RELEASE_MATCH_STATES.MATCH);
  assert.equal(classifyReleaseMatch('abc', 'def'), RELEASE_MATCH_STATES.MISMATCH);
  assert.equal(classifyReleaseMatch('abc', null), RELEASE_MATCH_STATES.UNKNOWN);
  assert.equal(classifyReleaseMatch(undefined, 'abc'), RELEASE_MATCH_STATES.UNKNOWN);
});

test('every fixed sanitized error code is allowlisted and preserves itself', () => {
  const codes = Object.values(SANITIZED_ERROR_CODES);
  assert.equal(new Set(codes).size, codes.length, 'fixed error codes must be unique');
  assert.deepEqual([...SANITIZED_ERROR_CODE_ALLOWLIST].sort(), [...new Set(codes)].sort());
  for (const code of SANITIZED_ERROR_CODE_ALLOWLIST) {
    assert.equal(normalizeSanitizedErrorCode(code), code);
    assert.equal(SANITIZED_ERROR_CODE_SET.has(code), true);
  }
  for (const family of Object.values(SANITIZED_ERROR_CODE_FAMILIES)) {
    for (const code of family) {
      assert.equal(normalizeSanitizedErrorCode(code), code);
    }
  }
});

test('unknown, URL, stack, token, and body strings fail closed without leakage', () => {
  const rawInputs = [
    'unknown runtime error',
    'fetch https://example.test?token=secret failed',
    'Error: unexpected failure\n    at /private/project/scripts/file.cjs:10:2',
    'Bearer very-secret-token',
    '{"responseBody":"private user content","provider_id":"acct-secret"}',
  ];
  for (const raw of rawInputs) {
    const normalized = normalizeSanitizedErrorCode(raw);
    assert.equal(normalized, SANITIZED_ERROR_CODES.LB_UNEXPECTED_FAILURE);
    assert.equal(normalized.includes(raw), false);
    assert.equal(raw.includes(normalized), false);
  }
  assert.equal(normalizeSanitizedErrorCode({ code: SANITIZED_ERROR_CODES.NONE }), SANITIZED_ERROR_CODES.LB_UNEXPECTED_FAILURE);
  assert.equal(normalizeSanitizedErrorCode([]), SANITIZED_ERROR_CODES.LB_UNEXPECTED_FAILURE);

  const input = { raw: rawInputs[1], nested: { code: 'UNKNOWN' } };
  const before = structuredClone(input);
  normalizeSanitizedErrorCode(input);
  assert.deepEqual(input, before, 'normalization must not mutate input objects');
});

test('classifiers and normalization are deterministic across repeated calls', () => {
  const input = 'fetch https://example.test?token=secret failed';
  const first = {
    latency: classifyLatency(250),
    http: classifyHttpStatus(599),
    content: classifyContentType('text/css'),
    release: classifyReleaseMatch('a', 'b'),
    error: normalizeSanitizedErrorCode(input),
  };
  assert.deepEqual({
    latency: classifyLatency(250),
    http: classifyHttpStatus(599),
    content: classifyContentType('text/css'),
    release: classifyReleaseMatch('a', 'b'),
    error: normalizeSanitizedErrorCode(input),
  }, first);
});

test('canonical exports, nested constants, and set-like allowlists are immutable', () => {
  const frozenValues = [
    taxonomy,
    STATUS_CLASSES,
    EXPECTATION_CLASSES,
    SEVERITY_CLASSES,
    CONTENT_TYPE_CLASSES,
    RELEASE_MATCH_STATES,
    LATENCY_BUCKETS,
    HTTP_STATUS_CLASSES,
    SANITIZED_ERROR_CODES,
    SANITIZED_ERROR_CODE_FAMILIES,
    ...Object.values(SANITIZED_ERROR_CODE_FAMILIES),
    SANITIZED_ERROR_CODE_ALLOWLIST,
    STATUS_CLASS_SET,
    EXPECTATION_CLASS_SET,
    SEVERITY_CLASS_SET,
    CONTENT_TYPE_CLASS_SET,
    RELEASE_MATCH_STATE_SET,
    LATENCY_BUCKET_SET,
    HTTP_STATUS_CLASS_SET,
    SANITIZED_ERROR_CODE_SET,
  ];
  for (const value of frozenValues) {
    assert.equal(Object.isFrozen(value), true, 'canonical export must be frozen');
  }

  const originalHealthy = STATUS_CLASSES.HEALTHY;
  const originalCodeCount = SANITIZED_ERROR_CODE_ALLOWLIST.length;
  try { STATUS_CLASSES.HEALTHY = 'MUTATED'; } catch {}
  try { SANITIZED_ERROR_CODE_ALLOWLIST.push('MUTATED'); } catch {}
  try { SANITIZED_ERROR_CODE_SET.add('MUTATED'); } catch {}
  assert.equal(STATUS_CLASSES.HEALTHY, originalHealthy);
  assert.equal(SANITIZED_ERROR_CODE_ALLOWLIST.length, originalCodeCount);
  assert.equal(SANITIZED_ERROR_CODE_SET.has('MUTATED'), false);
});

test('fresh module import has no I/O, environment, process, or stdout/stderr side effect', () => {
  const source = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:fs|node:fs|http|https|node:net|child_process)['"]\)/);
  assert.doesNotMatch(source, /\bprocess\b|\bconsole\b|\bfetch\s*\(|\bsetTimeout\s*\(/);

  const originalLog = console.log;
  const originalError = console.error;
  let logCalls = 0;
  let errorCalls = 0;
  console.log = () => { logCalls++; };
  console.error = () => { errorCalls++; };
  try {
    delete require.cache[require.resolve(TAXONOMY_PATH)];
    const fresh = require(TAXONOMY_PATH);
    assert.equal(fresh.CONTRACT_VERSION, '1');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(logCalls, 0);
  assert.equal(errorCalls, 0);
});
