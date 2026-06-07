/**
 * Scout Disabled Firebase Verifier Dependency Wiring Contract Tests
 * v20260607-2
 *
 * Keeps disabled Firebase verifier dependency wiring locked while allowing
 * the independent rate-limit storage adapter to add disabled-by-default
 * KV / Durable Object / D1 scaffold modes.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

const tests = [];

tests.push({ name: 'Dependency adapter keeps disabled Firebase verifier safe-fail mapping', fn: () => {
  assert.ok(depCode.includes('VERIFIER_FIREBASE_DISABLED'), 'dependency adapter must recognize disabled Firebase verifier code');
  assert.ok(depCode.includes('VERIFIER_CONFIG_MISSING'), 'dependency adapter must recognize missing Firebase config code');
  assert.ok(depCode.includes('VERIFY_NOT_IMPLEMENTED'), 'dependency adapter must preserve verify not implemented safe-fail');
  assert.ok(depCode.includes('VERIFY_UNAVAILABLE'), 'dependency adapter must preserve verify unavailable safe-fail');
}});

tests.push({ name: 'Verifier remains disabled scaffold only', fn: () => {
  assert.ok(verifierCode.includes('FIREBASE_DISABLED') || verifierCode.includes('VERIFIER_FIREBASE_DISABLED'), 'verifier must remain disabled Firebase scaffold');
  assert.ok(verifierCode.includes('mockDisabled: true'), 'verifier default mockDisabled true must remain');
}});

tests.push({ name: 'Rate-limit storage change is disabled scaffold only', fn: () => {
  assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage KV scaffold must safe-fail disabled');
  assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'storage DO scaffold must safe-fail disabled');
  assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'storage D1 scaffold must safe-fail disabled');
  assert.ok(storageCode.includes('mockDisabled: true'), 'storage default mockDisabled true must remain');
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
