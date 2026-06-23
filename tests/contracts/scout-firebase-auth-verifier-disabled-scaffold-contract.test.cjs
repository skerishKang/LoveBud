/**
 * Scout Firebase Auth Verifier Disabled Scaffold Contract Tests
 * v20260607-2
 *
 * Keeps the disabled Firebase verifier scaffold locked while allowing the
 * independent rate-limit storage adapter to add disabled-by-default KV / DO / D1
 * scaffold modes.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) { try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; } }

const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) verifierModulePromise = scoutEnvGuard.safeImport(VERIFIER_PATH);
  return verifierModulePromise;
}

const tests = [];

tests.push({ name: 'Auth verifier adapter module exists and exports factory', fn: async () => {
  const mod = await loadVerifierModule();
  assert.ok(verifierCode.length > 0, 'verifier adapter module must exist');
  assert.strictEqual(typeof mod.createScoutLiveAuthVerifierAdapter, 'function', 'verifier factory must be exported');
}});

tests.push({ name: 'Auth verifier remains disabled-by-default', fn: async () => {
  const mod = await loadVerifierModule();
  const adapter = mod.createScoutLiveAuthVerifierAdapter();
  assert.strictEqual(adapter.mockDisabled, true, 'verifier default mockDisabled must remain true');
  assert.ok(verifierCode.includes('FIREBASE_DISABLED') || verifierCode.includes('VERIFIER_FIREBASE_DISABLED'), 'verifier must retain disabled Firebase scaffold');
}});

tests.push({ name: 'Storage adapter change remains disabled scaffold only', fn: () => {
  assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage KV disabled scaffold must exist');
  assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'storage DO disabled scaffold must exist');
  assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'storage D1 disabled scaffold must exist');
  assert.ok(storageCode.includes('mockDisabled: true'), 'storage default mockDisabled true must remain');
}});

tests.push({ name: 'Endpoint and frontend defaults remain preserved', fn: () => {
  assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint STUB mode must remain');
  assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend local_stub must remain');
  assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'endpoint must not directly create storage adapter in this slice');
}});

if (!scoutEnvGuard.shouldSkip()) {(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
    catch (err) { console.log('  ✗ ' + t.name); console.log('    ' + (err && err.message ? err.message : String(err))); failed++; }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();}
