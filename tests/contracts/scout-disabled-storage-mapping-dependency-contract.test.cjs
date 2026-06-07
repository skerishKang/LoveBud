/**
 * Scout Disabled Storage Mapping Dependency Contract Tests
 * v20260607-1
 *
 * Locks the expected dependency-adapter behavior for disabled rate-limit
 * storage scaffold outcomes:
 * - STORAGE_KV_DISABLED
 * - STORAGE_DURABLE_OBJECT_DISABLED
 * - STORAGE_D1_DISABLED
 * - STORAGE_CONFIG_MISSING
 *
 * Contract expectation in this slice:
 * - dependency adapter does NOT add explicit per-backend mapping yet
 * - these outcomes still fail closed through the existing unknown storage
 *   result fallback
 * - mapped dependency code remains RATE_LIMIT_STORAGE_UNAVAILABLE
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const depCode = readFileSafe(DEP_ADAPTER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) {
    depModulePromise = import(DEP_ADAPTER_PATH);
  }
  return depModulePromise;
}

const tests = [];

tests.push({
  name: 'Disabled storage scaffold codes are still covered by existing dependency-adapter fallback',
  fn: async () => {
    const mod = await loadDepModule();
    for (const storageCodeValue of [
      'STORAGE_KV_DISABLED',
      'STORAGE_DURABLE_OBJECT_DISABLED',
      'STORAGE_D1_DISABLED',
      'STORAGE_CONFIG_MISSING',
    ]) {
      const adapter = mod.createScoutLiveDependencyAdapter({
        storageAdapter: {
          kind: 'test_storage_adapter',
          isMockDisabled: false,
          async checkQuota() {
            return { allowed: false, code: storageCodeValue, reason: 'fixture disabled storage scaffold' };
          },
        },
      });
      const result = await adapter.checkRateLimit({ requestId: 'req_test' });
      assert.strictEqual(result.allowed, false, `${storageCodeValue} fallback must deny`);
      assert.strictEqual(
        result.code,
        mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
        `${storageCodeValue} fallback must map to RATE_LIMIT_STORAGE_UNAVAILABLE`
      );
    }
  },
});

tests.push({
  name: 'Dependency adapter does not yet contain explicit disabled-storage mapping branches',
  fn: () => {
    assert.ok(!depCode.includes('STORAGE_KV_DISABLED'), 'dependency adapter must not yet map KV disabled scaffold');
    assert.ok(!depCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'dependency adapter must not yet map Durable Object disabled scaffold');
    assert.ok(!depCode.includes('STORAGE_D1_DISABLED'), 'dependency adapter must not yet map D1 disabled scaffold');
  },
});

tests.push({
  name: 'Existing storage-unavailable fallback message/contract is preserved',
  fn: () => {
    assert.ok(depCode.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'dependency adapter must expose RATE_LIMIT_STORAGE_UNAVAILABLE');
    assert.ok(depCode.includes('rate-limit storage adapter returned an unknown result') || depCode.includes('rate-limit storage adapter threw an exception'), 'dependency adapter must retain storage-unavailable fallback path');
  },
});

tests.push({
  name: 'Default dependency adapter behavior remains unchanged',
  fn: async () => {
    const mod = await loadDepModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must remain true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must remain true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED, 'default mode must remain MOCK_DISABLED');
    const rate = await adapter.checkRateLimit({ requestId: 'req_test' });
    assert.strictEqual(rate.allowed, false, 'default checkRateLimit must deny');
    assert.strictEqual(rate.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'default checkRateLimit code must remain RATE_LIMIT_NOT_IMPLEMENTED');
  },
});

tests.push({
  name: 'Endpoint default stub, explicit stub, frontend local_stub, and endpoint client defaults are preserved',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint default STUB mode must remain');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend default local_stub must remain');
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter') && !endpointClientCode.includes('live-auth-rate-limit-dependency-adapter'), 'endpoint client must remain decoupled');
  },
});

tests.push({
  name: 'No real KV / DO / D1 / fetch / provider SDK changes in this slice',
  fn: () => {
    const lower = depCode.toLowerCase();
    assert.ok(!/\b(fetch|xmlhttprequest|axios)\s*\(/.test(lower), 'dependency adapter must not introduce fetch/XHR/axios');
    assert.ok(!/kvnamespace|durableobject|d1database|env\.kv\b|env\.db\b/.test(lower), 'dependency adapter must not introduce storage runtime access');
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia']) {
      assert.ok(!new RegExp(`(import|require).*${provider}`, 'i').test(depCode), `dependency adapter must not import ${provider}`);
    }
  },
});

tests.push({
  name: 'Docs reflect fallback-only alignment for disabled storage mapping',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-storage-safe-fail-fallback-docs-alignment.md');
    const doc = readFileSafe(docPath);
    assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'docs must reference RATE_LIMIT_STORAGE_UNAVAILABLE fallback');
    assert.ok(doc.includes('existing dependency-adapter unknown storage-code safe-fail fallback') || doc.includes('fallback-only'), 'docs must describe fallback-only behavior');
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
