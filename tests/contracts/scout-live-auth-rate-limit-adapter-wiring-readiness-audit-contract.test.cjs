/**
 * Scout Live Auth/Rate-Limit Adapter Wiring Readiness Audit Contract Tests
 * v20260607-2
 *
 * The readiness audit remains valid while the rate-limit storage adapter is
 * intentionally extended with disabled-by-default KV / Durable Object / D1
 * scaffold modes. Dependency adapter endpoint wiring and endpoint/frontend
 * defaults remain unchanged.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);
const runtimeCode = codeOnly([depCode, storageCode, suggestCode].join('\n')).toLowerCase();

const tests = [];

tests.push({
  name: 'Adapter wiring readiness audit document remains present',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'readiness audit doc must exist');
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('readiness') && lc.includes('adapter'), 'audit doc must describe adapter readiness');
  },
});

tests.push({
  name: 'Dependency adapter endpoint wiring remains unchanged',
  fn: () => {
    assert.ok(depCode.includes('SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION'), 'dependency adapter must still exist');
    assert.ok(suggestCode.includes('createScoutLiveDependencyAdapter'), 'suggest.js must still use dependency adapter wiring');
    assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'suggest.js must not directly call storage adapter in this slice');
  },
});

tests.push({
  name: 'Disabled storage scaffold is present but not directly wired to endpoint',
  fn: () => {
    assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage KV disabled scaffold must exist');
    assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'storage DO disabled scaffold must exist');
    assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'storage D1 disabled scaffold must exist');
    assert.ok(!suggestCode.includes('live-rate-limit-storage-adapter'), 'suggest.js must not import storage adapter directly');
  },
});

tests.push({
  name: 'No real external runtime access is introduced',
  fn: () => {
    for (const forbidden of [/firebase-admin/, /kvnamespace/, /durableobjectnamespace/, /d1database/, /env\.kv\b/, /env\.db\b/, /env\.rate_limit/, /\bfetch\s*\(/, /xmlhttprequest/, /axios/, /process\.env\.scout/, /import\.meta\.env/]) {
      assert.ok(!forbidden.test(runtimeCode), `runtime code must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Endpoint and frontend defaults remain preserved',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must keep STUB mode');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend must keep local_stub');
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
