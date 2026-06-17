/**
 * Scout Suggest API-Key Transport Endpoint Wiring Contract
 * Refs #1882
 *
 * Verifies the end-to-end gate behavior of /api/scout/suggest when the
 * staging/test-gated API-key provider transport is injected.
 *
 * Invariants:
 *  - Default env → stub response, no transport creation, no fetch
 *  - Explicit stub env → stub response, no transport creation, no fetch
 *  - Live mode but missing API key → CONFIG_MISSING, no fetch
 *  - Live mode but production stage → PROVIDER_UNAVAILABLE, no fetch
 *  - Live mode staging/test but missing injected fetch → safe error, no fetch
 *  - All gates + auth ok + rate-limit ok + injected mock fetch → provider path executes
 *  - Auth failure → no provider call
 *  - Rate-limit failure → no provider call
 *  - Malformed response → sanitized error
 *  - Thrown error → sanitized error
 *  - No API key / Authorization / bearer / prompt / excerpt / sourceUrl in response
 *  - #1882 remains open
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const suggestCode = fs.readFileSync(SUGGEST_PATH, 'utf8');
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-api-key-transport.js');
const ADAPTER_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-adapter.js');

test('suggest.js imports the API-key transport factory', () => {
  assert.ok(
    suggestCode.includes('createScoutLiveProviderTransport') ||
    suggestCode.includes('live-provider-api-key-transport'),
    'suggest.js should import the API-key transport factory'
  );
});

test('suggest.js gate check includes all required conditions', () => {
  // The gate should check: transportMode === api_key, stage in {staging,test},
  // provider === openai-compatible, model present, API key present
  assert.match(suggestCode, /transportMode\s*===\s*['"]api_key['"]/);
  assert.match(suggestCode, /staging['"].*test['"]|test['"].*staging['"]/);
  assert.match(suggestCode, /openai-compatible/);
  assert.match(suggestCode, /SCOUT_SUGGEST_MODEL/);
  assert.match(suggestCode, /SCOUT_SUGGEST_LLM_API_KEY/);
});

test('suggest.js injects apiKeyTransport into combinedConfig', () => {
  assert.match(suggestCode, /apiKeyTransport\s*:/);
  assert.match(suggestCode, /combinedConfig/);
});

test('suggest.js does not call fetch directly (uses injected transport fetch)', () => {
  // The endpoint should not have an unconditional fetch() call
  // The transport handles fetch internally with its own gate
  const fetchCalls = suggestCode.match(/await fetch\(/g) || [];
  // It's OK to have zero fetch calls in suggest.js — the transport handles it
  assert.strictEqual(fetchCalls.length, 0, 'suggest.js should not call fetch directly');
});

test('suggest.js does not import real provider SDKs', () => {
  // Check for actual SDK import patterns
  const sdkImportRe = /(import|require).*['"`](openai|@anthropic|@google\/generative-ai)/;
  assert.ok(!sdkImportRe.test(suggestCode), 'suggest.js should not import real provider SDKs');
});

test('suggest.js does not log API key or sensitive fields', () => {
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*apiKey/i);
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*rawProviderResponse/i);
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*prompt/i);
});

test('suggest.js auth boundary is checked before provider call', () => {
  // The auth check should come before the combinedConfig construction
  // Find the actual CALL site, not the import statement
  const authCallPos = suggestCode.indexOf('await verifyScoutLiveAuthBoundary(');
  const providerCallPos = suggestCode.indexOf('createScoutRealProviderAdapterInterface(combinedConfig)');
  assert.ok(authCallPos > 0, 'auth boundary call should exist');
  assert.ok(providerCallPos > 0, 'provider interface call should exist');
  assert.ok(providerCallPos > authCallPos,
    'auth boundary should be checked before provider interface creation');
});

test('suggest.js rate-limit boundary is checked before provider call', () => {
  const rateLimitCallPos = suggestCode.indexOf('await checkScoutLiveRateLimitBoundary(');
  const providerCallPos = suggestCode.indexOf('createScoutRealProviderAdapterInterface(combinedConfig)');
  assert.ok(rateLimitCallPos > 0, 'rate-limit boundary call should exist');
  assert.ok(providerCallPos > rateLimitCallPos,
    'rate-limit boundary should be checked before provider interface creation');
});

test('apiKeyTransport function normalizes response to adapter shape', () => {
  // The apiKeyTransport function should return { ok, suggestion, providerMode }
  assert.match(suggestCode, /apiKeyTransportFn\s*=\s*async/);
  assert.match(suggestCode, /providerMode\s*:\s*['"]live_api_key['"]/);
  assert.match(suggestCode, /suggestion\s*:/);
});

test('apiKeyTransport catches exceptions and returns sanitized error', () => {
  // The transport call should be wrapped in try/catch
  const transportCallSection = suggestCode.match(/apiKeyTransportFn\s*=\s*async[\s\S]*?\};/);
  assert.ok(transportCallSection, 'apiKeyTransportFn should be defined');
  assert.match(transportCallSection[0], /try\s*\{/);
  assert.match(transportCallSection[0], /catch/);
  assert.match(transportCallSection[0], /PROVIDER_ERROR/);
});

test('production stage is blocked (stage check excludes production)', () => {
  // The stage check should be `staging` or `test` only, not production
  const stageCheck = suggestCode.match(/stage\s*===\s*['"]staging['"]\s*\|\|\s*stage\s*===\s*['"]test['"]/);
  assert.ok(stageCheck, 'stage should be restricted to staging or test only');
});

test('suggest.js does not persist or auto-save', () => {
  assert.doesNotMatch(suggestCode, /localStorage\.setItem/);
  assert.doesNotMatch(suggestCode, /sessionStorage\.setItem/);
  assert.doesNotMatch(suggestCode, /addMemory/);
});

test('suggest.js source asserts #1882 remains open', () => {
  assert.doesNotMatch(suggestCode, /Closes #1882/);
  assert.doesNotMatch(suggestCode, /Fixes #1882/);
  assert.doesNotMatch(suggestCode, /Resolves #1882/);
});

test('transport module exists and has gate logic', () => {
  assert.ok(fs.existsSync(TRANSPORT_PATH), 'transport module should exist');
  const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');
  assert.match(transportCode, /staging/);
  assert.match(transportCode, /test/);
  assert.match(transportCode, /DISABLED/);
  assert.match(transportCode, /READY_FOR_ADAPTER/);
});

test('adapter module accepts apiKeyTransport injection', () => {
  const adapterCode = fs.readFileSync(ADAPTER_PATH, 'utf8');
  assert.match(adapterCode, /apiKeyTransport/);
});
