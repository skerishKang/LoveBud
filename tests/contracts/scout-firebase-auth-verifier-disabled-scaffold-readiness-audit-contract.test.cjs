/**
 * Scout Firebase Auth Verifier Disabled Scaffold Readiness Audit Contract Tests
 * v20260607-2
 *
 * Keeps the Firebase verifier readiness audit locked while allowing the
 * independent rate-limit storage adapter to add disabled-by-default KV / DO / D1
 * scaffold modes.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-firebase-auth-verifier-disabled-scaffold-readiness-audit.md');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) { try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; } }

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

const tests = [];

tests.push({ name: 'Firebase verifier readiness audit document remains present', fn: () => {
  assert.ok(auditDoc.length > 0, 'readiness audit doc must exist');
  const lc = auditDoc.toLowerCase();
  assert.ok(lc.includes('readiness') && lc.includes('firebase') && lc.includes('verifier'), 'audit doc must describe Firebase verifier readiness');
}});

tests.push({ name: 'Firebase verifier scaffold remains disabled-by-default', fn: () => {
  assert.ok(verifierCode.includes('FIREBASE_DISABLED') || verifierCode.includes('VERIFIER_FIREBASE_DISABLED'), 'verifier disabled Firebase scaffold must remain');
  assert.ok(verifierCode.includes('mockDisabled: true'), 'verifier default mockDisabled true must remain');
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

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
    catch (err) { console.log('  ✗ ' + t.name); console.log('    ' + (err && err.message ? err.message : String(err))); failed++; }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
