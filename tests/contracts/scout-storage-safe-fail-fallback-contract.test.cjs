/**
 * Scout Storage Safe-Fail Fallback Contract Tests
 * v20260607-1
 *
 * Contract-only coverage for the existing dependency-adapter behavior:
 * unknown storage adapter outcomes fail closed as RATE_LIMIT_STORAGE_UNAVAILABLE.
 * The disabled storage scaffold codes introduced earlier therefore remain safe
 * without changing endpoint, frontend, provider, or storage runtime behavior.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

const depCode = readFileSafe(DEP_ADAPTER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

let depModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) depModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  return depModulePromise;
}

const tests = [];

tests.push({ name: 'Storage adapter keeps disabled scaffold codes', fn: () => {
  for (const token of ['STORAGE_KV_DISABLED', 'STORAGE_DURABLE_OBJECT_DISABLED', 'STORAGE_D1_DISABLED', 'STORAGE_CONFIG_MISSING']) {
    assert.ok(storageCode.includes(token), `${token} must remain in storage adapter`);
  }
}});

tests.push({ name: 'Dependency adapter keeps storage-unavailable fallback', fn: () => {
  assert.ok(depCode.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'dependency adapter must expose RATE_LIMIT_STORAGE_UNAVAILABLE');
  assert.ok(depCode.includes('rate-limit storage adapter returned an unknown result'), 'dependency adapter must retain unknown storage fallback');
}});

tests.push({ name: 'Disabled scaffold-like storage outcomes fail closed through existing fallback', fn: async () => {
  const mod = await loadDepModule();
  const adapter = mod.createScoutLiveDependencyAdapter({
    mockDisabled: false,
    storageAdapter: {
      kind: 'test_storage_adapter',
      isMockDisabled: false,
      async checkQuota() {
        return { allowed: false, code: 'STORAGE_KV_DISABLED', reason: 'fixture disabled storage scaffold' };
      },
    },
  });
  const result = await adapter.checkRateLimit({ requestId: 'req_test' });
  assert.strictEqual(result.allowed, false, 'storage scaffold fallback must deny');
  assert.strictEqual(result.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE, 'storage scaffold fallback must map to storage unavailable');
}});

tests.push({ name: 'Endpoint and frontend defaults remain preserved', fn: () => {
  assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must keep STUB mode');
  assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend must keep local_stub');
  assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'endpoint must not directly create storage adapter');
}});

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
    catch (err) { console.log('  ✗ ' + t.name); console.log('    ' + (err && err.message ? err.message : String(err))); failed++; }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
