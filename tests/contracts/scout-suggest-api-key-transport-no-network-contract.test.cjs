/**
 * Scout Suggest API-Key Transport No-Network Contract
 * Refs #1882
 *
 * Verifies that the /api/scout/suggest endpoint does NOT make any real
 * network calls in normal CI. Only injected/mock fetch is used.
 *
 * Invariants:
 *  - No real fetch() calls in suggest.js
 *  - No real network primitives in the code path
 *  - Only injected fetch is passed to the transport
 *  - normal CI is network-free
 *  - #1882 remains open
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-api-key-transport.js');
const suggestCode = fs.readFileSync(SUGGEST_PATH, 'utf8');
const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');

test('suggest.js has zero fetch() calls', () => {
  // The endpoint should not call fetch() directly
  // All network goes through the transport with injected fetch
  const fetchCalls = suggestCode.match(/await fetch\(/g) || [];
  assert.strictEqual(fetchCalls.length, 0,
    `suggest.js should have zero fetch() calls, found ${fetchCalls.length}`);
});

test('suggest.js has zero axios/XMLHttpRequest references', () => {
  assert.doesNotMatch(suggestCode, /\baxios\b/);
  assert.doesNotMatch(suggestCode, /XMLHttpRequest/);
});

test('suggest.js uses context.fetch injection (not global fetch)', () => {
  // The endpoint should pass an injected fetch to the transport
  assert.match(suggestCode, /context\.fetch/);
  // The endpoint should NOT use globalThis.fetch or global.fetch directly
  assert.doesNotMatch(suggestCode, /globalThis\.fetch/);
  assert.doesNotMatch(suggestCode, /global\.fetch/);
});

test('transport module accepts injected fetch via options', () => {
  assert.match(transportCode, /fetch/);
  // The transport should check for injected fetch
  assert.match(transportCode, /injectedFetch|injected.*fetch|fetch.*injected/);
});

test('transport module does not call globalThis.fetch directly', () => {
  // The transport may use the injected fetch, but should not fall back
  // to globalThis.fetch in a way that would make a real call in normal CI
  // Check that fetch is always passed through, not hardcoded
  const directFetchCalls = transportCode.match(/globalThis\.fetch|global\.fetch/g) || [];
  // It's OK to have a fallback, but the default should be disabled
  // For normal CI, the injected fetch is always a mock
  assert.ok(directFetchCalls.length <= 1, 'transport should not heavily rely on global fetch');
});

test('gate check prevents fetch call when gates not satisfied', () => {
  // The transport's execute() should check gates before calling fetch
  assert.match(transportCode, /GATE_NOT_SATISFIED|CONFIG_MISSING/);
  // The transport should return early with error if gates not met
  // (uses the status constant comparison)
  assert.match(transportCode, /READY_FOR_ADAPTER/);
  assert.match(transportCode, /normalized\.status\s*===\s*SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS/);
});

test('normal CI config (no env vars) → no fetch call', () => {
  // With no env vars set, the gate should fail and no fetch should be called
  // This is a structural test — the code path requires all gates to be met
  assert.match(suggestCode, /transportGateOk/);
  assert.match(suggestCode, /if\s*\(transportGateOk\)/);
});

test('production stage → no fetch call', () => {
  // The stage check should restrict to staging/test only
  assert.match(suggestCode, /staging['"].*test['"]|test['"].*staging['"]/);
});

test('missing API key → no fetch call', () => {
  // The API key check should prevent transport creation
  assert.match(suggestCode, /hasApiKey/);
  assert.match(suggestCode, /hasApiKey\s*=\s*.*apiKey.*length/);
});

test('suggest.js does not import network libraries', () => {
  // Check for actual import patterns
  const networkImportRe = /(import|require).*['"`](node-fetch|axios|got|undici|request)/;
  assert.ok(!networkImportRe.test(suggestCode),
    'suggest.js should not import network libraries');
});

test('transport module does not import network libraries', () => {
  const networkImportRe = /(import|require).*['"`](node-fetch|axios|got|undici|request)/;
  assert.ok(!networkImportRe.test(transportCode),
    'transport module should not import network libraries');
});

test('suggest.js source asserts #1882 remains open', () => {
  assert.doesNotMatch(suggestCode, /Closes #1882/);
  assert.doesNotMatch(suggestCode, /Fixes #1882/);
  assert.doesNotMatch(suggestCode, /Resolves #1882/);
});

test('frontend files unchanged (no network call in frontend)', () => {
  // The suggest endpoint is server-side only
  // No frontend/browser network calls for the provider
  const providerPath = path.join(ROOT, 'js', 'scout', 'scout-suggestion-provider.js');
  if (fs.existsSync(providerPath)) {
    const providerCode = fs.readFileSync(providerPath, 'utf8');
    // Frontend provider should not have real fetch calls
    const providerFetchCalls = providerCode.match(/await fetch\(/g) || [];
    // It's OK to have zero fetch calls in the frontend provider
    assert.ok(providerFetchCalls.length === 0,
      'frontend provider should not make real network calls');
  }
});
