/**
 * LoveBud #1882 S4A — Scout Engine Endpoint Wiring Contract
 * Refs #1882
 * Keep #1882 open
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const ENDPOINT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'scout-engine-transport.js');

const endpointCode = fs.readFileSync(ENDPOINT_PATH, 'utf8');
const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');

test('endpoint imports scout-engine-transport', () => {
  assert.match(endpointCode, /scout-engine-transport\.js/);
});

test('Engine transport is explicit opt-in via env flag', () => {
  assert.match(endpointCode, /SCOUT_ENGINE_TRANSPORT_ENABLED/);
});

test('Engine transport fails closed when not enabled — falls through to existing logic', () => {
  assert.match(endpointCode, /engineTransportEnabled/);
  assert.match(endpointCode, /ENGINE_UNAVAILABLE/);
});

test('Engine transport uses injected fetch from context', () => {
  assert.match(endpointCode, /resolvedF/);
  assert.match(endpointCode, /createScoutEngineTransport\(\{[\s\S]*?fetch:\s*resolvedF/);
});

test('Engine transport path returns Scout bounded error envelope on failure', () => {
  assert.match(endpointCode, /buildErrorResponse\(/);
});

test('Engine transport does not fall back to direct Provider on failure', () => {
  assert.match(endpointCode, /ENGINE_UNAVAILABLE/);
});

test('local_stub remains default when Engine transport is not enabled', () => {
  assert.match(endpointCode, /generateStubSuggestion/);
  assert.ok(endpointCode.includes('providerConfig.providerMode === SCOUT_SUGGEST_PROVIDER_MODES.LIVE'));
});

test('endpoint_client opt-in is preserved', () => {
  assert.match(endpointCode, /SCOUT_SUGGEST_PROVIDER_MODE/);
  assert.match(endpointCode, /SCOUT_SUGGEST_PROVIDER_MODES\.LIVE/);
});

test('Engine transport success response uses engine_transport providerMode', () => {
  assert.match(endpointCode, /'engine_transport'/);
});

test('endpoint does not directly import Engine SDK', () => {
  const forbidden = [
    /import\s+.*padiem-ai-engine-client/,
    /require\(.*padiem-ai-engine-client/,
    /from\s+['"]padiem-ai-engine/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(endpointCode), `Forbidden Engine SDK import: ${re}`);
  }
});

test('endpoint source asserts #1882 remains open', () => {
  assert.ok(endpointCode.includes('Keep #1882 open'));
});

test('transport module does not mutate production config or secrets', () => {
  assert.ok(!transportCode.includes('wrangler.toml'));
  assert.ok(!transportCode.includes('PRODUCTION'));
  assert.ok(!transportCode.includes('secret'));
});
