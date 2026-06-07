/**
 * Scout Runtime Observability Policy Audit Contract Tests
 * v20260607-2
 *
 * Keeps observability policy locked while allowing the independent rate-limit
 * storage adapter to add disabled-by-default KV / Durable Object / D1 scaffold
 * modes. No external observability backend or sensitive logging is introduced.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC = path.join(ROOT, 'docs/product/lovebud-scout-runtime-observability-policy-audit.md');
const STORAGE_ADAPTER = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const OBSERVABILITY_HELPER = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SUGGEST = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) { try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; } }

const auditDoc = readFileSafe(AUDIT_DOC);
const storageCode = readFileSafe(STORAGE_ADAPTER);
const observabilityCode = readFileSafe(OBSERVABILITY_HELPER);
const suggestCode = readFileSafe(SUGGEST);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR);

const tests = [];

tests.push({ name: 'Runtime observability policy audit document remains present', fn: () => {
  assert.ok(auditDoc.length > 0, 'observability audit doc must exist');
  const lc = auditDoc.toLowerCase();
  assert.ok(lc.includes('observability') && lc.includes('policy'), 'audit doc must describe observability policy');
}});

tests.push({ name: 'Storage scaffold remains disabled and safe for observability', fn: () => {
  assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage KV disabled scaffold must exist');
  assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'storage DO disabled scaffold must exist');
  assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'storage D1 disabled scaffold must exist');
  assert.ok(storageCode.includes('rawStorageKey'), 'raw storage key remains denied as payload field');
  assert.ok(storageCode.includes('rawUserIdentifier'), 'raw user identifier remains denied as payload field');
}});

tests.push({ name: 'No external observability backend is introduced', fn: () => {
  assert.ok(observabilityCode.length > 0, 'observability helper must exist');
  assert.ok(!observabilityCode.includes('fetch('), 'observability helper must not call fetch');
  assert.ok(!observabilityCode.includes('XMLHttpRequest'), 'observability helper must not use XMLHttpRequest');
  assert.ok(!observabilityCode.includes('axios'), 'observability helper must not use axios');
}});

tests.push({ name: 'Endpoint and frontend defaults remain preserved', fn: () => {
  assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint STUB mode must remain');
  assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend local_stub must remain');
  assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'endpoint must not directly create storage adapter in this slice');
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
