/**
 * Scout Live Auth/Rate-Limit Runtime Adapter Implementation Gate
 * Contract Tests
 * v20260607-2
 *
 * This gate remains strict against real Firebase Admin SDK, real KV / DO / D1
 * runtime access, real provider APIs, staging_live, production_live, external
 * observability backends, and parallel boundary adoption. Disabled-by-default
 * rate-limit storage scaffold constants are allowed in the storage adapter.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const GATE_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const gateDoc = readFileSafe(GATE_DOC_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);
const runtimeCode = codeOnly([storageCode, depCode, verifierCode, suggestCode].join('\n')).toLowerCase();

const tests = [];

tests.push({
  name: 'Runtime adapter implementation gate doc remains present',
  fn: () => {
    assert.ok(gateDoc.length > 0, 'gate doc must exist');
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('gate') && lc.includes('runtime adapter'), 'gate doc must describe runtime adapter gate');
  },
});

tests.push({
  name: 'Disabled storage scaffold constants are allowed but real storage access is still blocked',
  fn: () => {
    assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'disabled KV scaffold code is allowed');
    assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'disabled Durable Object scaffold code is allowed');
    assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'disabled D1 scaffold code is allowed');
    assert.ok(storageCode.includes('mockDisabled: true'), 'default mockDisabled true must remain');
  },
});

tests.push({
  name: 'Gate still blocks real Firebase, real storage binding, provider API, fetch, and env secret access',
  fn: () => {
    for (const forbidden of [
      /firebase-admin/,
      /getauth\s*\(/,
      /verifyidtoken\s*\(/,
      /initializeapp\s*\(/,
      /kvnamespace/,
      /durableobjectnamespace/,
      /d1database/,
      /env\.kv\b/,
      /env\.db\b/,
      /env\.rate_limit/,
      /\bfetch\s*\(/,
      /xmlhttprequest/,
      /axios/,
      /process\.env\.scout/,
      /import\.meta\.env/,
    ]) {
      assert.ok(!forbidden.test(runtimeCode), `runtime code must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Gate still blocks endpoint default-live and frontend endpoint auto-enable',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must keep STUB mode');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'source selector must keep local_stub');
    assert.ok(!sourceSelectorCode.includes('storageMode'), 'frontend must not expose storageMode');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter'), 'endpoint client must not reference storage adapter');
    assert.ok(!runtimeCode.includes('staging_live'), 'runtime must not introduce staging_live');
    assert.ok(!runtimeCode.includes('production_live'), 'runtime must not introduce production_live');
  },
});

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✓ ' + t.name);
      passed++;
    } catch (err) {
      console.log('  ✗ ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
