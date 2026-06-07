/**
 * Scout Runtime Rate-Limit Storage Implementation Plan Contract Tests
 * v20260607-2
 *
 * This follow-up contract acknowledges the current implementation slice:
 * the storage adapter may intentionally change to add disabled-by-default
 * KV / Durable Object / D1 scaffold modes, while real runtime storage,
 * endpoint default-live behavior, provider calls, and frontend default
 * changes remain blocked.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const planDoc = readFileSafe(PLAN_DOC_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

tests.push({
  name: 'Rate-limit storage plan and storage adapter exist',
  fn: () => {
    assert.ok(planDoc.length > 0, 'rate-limit storage plan doc must exist');
    assert.ok(storageCode.length > 0, 'storage adapter module must exist');
  },
});

tests.push({
  name: 'Storage adapter now documents disabled runtime scaffold modes',
  fn: () => {
    assert.ok(storageCode.includes('KV_DISABLED'), 'storage adapter must define KV_DISABLED scaffold mode');
    assert.ok(storageCode.includes('DURABLE_OBJECT_DISABLED'), 'storage adapter must define DURABLE_OBJECT_DISABLED scaffold mode');
    assert.ok(storageCode.includes('D1_DISABLED'), 'storage adapter must define D1_DISABLED scaffold mode');
    assert.ok(storageCode.includes('STORAGE_CONFIG_MISSING'), 'storage adapter must define STORAGE_CONFIG_MISSING safe-fail code');
    assert.ok(storageCode.includes('mockDisabled: true'), 'default mockDisabled:true must remain documented in code');
  },
});

tests.push({
  name: 'No real runtime storage, provider, Firebase, fetch, or env access is introduced',
  fn: () => {
    const code = codeOnly(storageCode + '\n' + depAdapterCode + '\n' + suggestCode).toLowerCase();
    for (const forbidden of [
      /kvnamespace/,
      /durableobjectnamespace/,
      /d1database/,
      /env\.kv\b/,
      /env\.db\b/,
      /env\.rate_limit/,
      /\bfetch\s*\(/,
      /xmlhttprequest/,
      /axios/,
      /firebase-admin/,
      /initializeapp/,
      /admin\s*\.\s*auth/,
      /process\.env\.scout/,
      /import\.meta\.env/,
    ]) {
      assert.ok(!forbidden.test(code), `runtime code must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Endpoint and frontend defaults remain safe',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must still expose STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'endpoint default stub constant must remain');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend source selector must preserve local_stub');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter'), 'endpoint client must not reference storage adapter');
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
