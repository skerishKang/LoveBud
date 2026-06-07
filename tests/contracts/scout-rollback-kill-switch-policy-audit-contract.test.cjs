/**
 * Scout Rollback / Kill-Switch Policy Audit Contract Tests
 * v20260607-2
 *
 * Follow-up storage scaffold slice compatibility lock. The rollback policy
 * audit remains valid while the rate-limit storage adapter is intentionally
 * extended with disabled-by-default KV / Durable Object / D1 scaffold modes.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ROLLBACK_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-rollback-kill-switch-policy-audit.md');
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

const rollbackDoc = readFileSafe(ROLLBACK_DOC_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

tests.push({
  name: 'Rollback policy audit document remains present',
  fn: () => {
    assert.ok(rollbackDoc.length > 0, 'rollback policy audit doc must exist');
    const lc = rollbackDoc.toLowerCase();
    assert.ok(lc.includes('rollback') && lc.includes('kill-switch'), 'rollback doc must describe rollback / kill-switch policy');
  },
});

tests.push({
  name: 'Disabled rate-limit storage scaffold remains rollback-safe',
  fn: () => {
    assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'KV scaffold must safe-fail as disabled');
    assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'Durable Object scaffold must safe-fail as disabled');
    assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'D1 scaffold must safe-fail as disabled');
    assert.ok(storageCode.includes('STORAGE_CONFIG_MISSING'), 'unknown storage config must safe-fail');
    assert.ok(storageCode.includes('mockDisabled: true'), 'default mockDisabled true must remain');
  },
});

tests.push({
  name: 'Rollback-safe storage scaffold introduces no real storage, fetch, Firebase, or provider SDK access',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    for (const forbidden of [/kvnamespace/, /durableobjectnamespace/, /d1database/, /env\.kv\b/, /env\.db\b/, /env\.rate_limit/, /\bfetch\s*\(/, /xmlhttprequest/, /axios/, /firebase-admin/, /initializeapp/, /admin\s*\.\s*auth/, /process\.env\.scout/, /import\.meta\.env/]) {
      assert.ok(!forbidden.test(code), `storage adapter must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Endpoint and frontend rollback defaults are unchanged',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must still expose STUB mode');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend must still default to local_stub');
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
