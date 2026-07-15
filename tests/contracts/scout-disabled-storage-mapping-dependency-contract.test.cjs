/**
 * Scout Disabled Storage Mapping Dependency Contract Tests
 * v20260607-2
 *
 * Locks the dependency-adapter explicit mapping behavior for disabled
 * rate-limit storage scaffold outcomes:
 * - STORAGE_KV_DISABLED
 * - STORAGE_DURABLE_OBJECT_DISABLED
 * - STORAGE_D1_DISABLED
 * - STORAGE_CONFIG_MISSING
 *
 * Contract expectation in this slice:
 * - dependency adapter now contains explicit disabled-storage mapping branches
 * - these outcomes fail closed as RATE_LIMIT_STORAGE_UNAVAILABLE
 * - unknown storage-code fallback remains preserved
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
    depModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  }
  return depModulePromise;
}

const DISABLED_STORAGE_CODES = Object.freeze([
  'STORAGE_KV_DISABLED',
  'STORAGE_DURABLE_OBJECT_DISABLED',
  'STORAGE_D1_DISABLED',
  'STORAGE_CONFIG_MISSING',
]);

const tests = [];

tests.push({
  name: 'Disabled storage scaffold codes explicitly map to storage unavailable',
  fn: async () => {
    const mod = await loadDepModule();
    for (const storageCodeValue of DISABLED_STORAGE_CODES) {
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
      assert.strictEqual(result.allowed, false, `${storageCodeValue} explicit mapping must deny`);
      assert.strictEqual(
        result.code,
        mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
        `${storageCodeValue} explicit mapping must return RATE_LIMIT_STORAGE_UNAVAILABLE`
      );
    }
  },
});

tests.push({
  name: 'Dependency adapter contains explicit disabled-storage mapping branches',
  fn: () => {
    for (const storageCodeValue of DISABLED_STORAGE_CODES) {
      assert.ok(depCode.includes(storageCodeValue), `dependency adapter must explicitly map ${storageCodeValue}`);
    }
    const firstDisabledCode = depCode.indexOf('STORAGE_KV_DISABLED');
    const unknownFallback = depCode.indexOf('rate-limit storage adapter returned an unknown result');
    assert.ok(firstDisabledCode >= 0, 'explicit disabled-storage mapping block must exist');
    assert.ok(unknownFallback > firstDisabledCode, 'explicit disabled-storage mapping must appear before unknown fallback');
  },
});

tests.push({
  name: 'Unknown storage-code fallback remains preserved',
  fn: async () => {
    const mod = await loadDepModule();
    const adapter = mod.createScoutLiveDependencyAdapter({
      storageAdapter: {
        kind: 'test_storage_adapter',
        isMockDisabled: false,
        async checkQuota() {
          return { allowed: false, code: 'STORAGE_FUTURE_UNKNOWN', reason: 'fixture unknown storage code' };
        },
      },
    });
    const result = await adapter.checkRateLimit({ requestId: 'req_test' });
    assert.strictEqual(result.allowed, false, 'unknown storage fallback must deny');
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
      'unknown storage fallback must remain RATE_LIMIT_STORAGE_UNAVAILABLE'
    );
    assert.ok(depCode.includes('rate-limit storage adapter returned an unknown result'), 'dependency adapter must retain unknown storage fallback message');
  },
});

tests.push({
  name: 'Existing storage mappings remain preserved',
  fn: async () => {
    const mod = await loadDepModule();
    const cases = [
      ['STORAGE_MOCK_DISABLED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED],
      ['STORAGE_NOT_IMPLEMENTED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED],
      ['STORAGE_PAYLOAD_PROHIBITED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_PAYLOAD_PROHIBITED],
    ];
    for (const [storageCodeValue, expectedDependencyCode] of cases) {
      const adapter = mod.createScoutLiveDependencyAdapter({
        storageAdapter: {
          kind: 'test_storage_adapter',
          isMockDisabled: false,
          async checkQuota() {
            return { allowed: false, code: storageCodeValue, reason: 'fixture existing storage code' };
          },
        },
      });
      const result = await adapter.checkRateLimit({ requestId: 'req_test' });
      assert.strictEqual(result.allowed, false, `${storageCodeValue} must deny`);
      assert.strictEqual(result.code, expectedDependencyCode, `${storageCodeValue} mapping must be preserved`);
    }
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
    assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage adapter disabled scaffold code must remain');
  },
});

tests.push({
  name: 'Docs reflect explicit mapping promotion for disabled storage mapping',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-storage-safe-fail-fallback-docs-alignment.md');
    const doc = readFileSafe(docPath);
    assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'docs must reference RATE_LIMIT_STORAGE_UNAVAILABLE');
    assert.ok(doc.includes('explicit mapping') || doc.includes('Explicit Mapping'), 'docs must describe explicit mapping promotion');
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
