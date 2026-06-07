/**
 * Scout Runtime Firebase Auth Verifier Implementation Plan Contract Tests
 * v20260607-2
 *
 * This Firebase verifier plan remains valid while the unrelated rate-limit
 * storage adapter is intentionally extended with disabled-by-default KV /
 * Durable Object / D1 scaffold modes. No real Firebase Admin SDK or real
 * token verification is allowed.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const planDoc = readFileSafe(PLAN_DOC_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const runtimeCode = codeOnly([verifierCode, storageCode, suggestCode].join('\n')).toLowerCase();

const tests = [];

tests.push({
  name: 'Firebase verifier implementation plan document remains present',
  fn: () => {
    assert.ok(planDoc.length > 0, 'Firebase verifier plan doc must exist');
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('firebase') && lc.includes('verifier'), 'plan must describe Firebase auth verifier work');
  },
});

tests.push({
  name: 'Firebase verifier remains disabled scaffold only',
  fn: () => {
    assert.ok(verifierCode.includes('VERIFIER_FIREBASE_DISABLED') || verifierCode.includes('FIREBASE_DISABLED'), 'verifier must keep disabled Firebase scaffold status');
    assert.ok(verifierCode.includes('mockDisabled: true'), 'verifier default mockDisabled true must remain');
  },
});

tests.push({
  name: 'No real Firebase Admin SDK, token verification, storage binding, provider SDK, or fetch access is introduced',
  fn: () => {
    for (const forbidden of [
      /firebase-admin/,
      /getauth\s*\(/,
      /verifyidtoken\s*\(/,
      /verifyaccesstoken\s*\(/,
      /initializeapp\s*\(/,
      /cert\s*\(/,
      /kvnamespace/,
      /durableobjectnamespace/,
      /d1database/,
      /env\.kv\b/,
      /env\.db\b/,
      /\bfetch\s*\(/,
      /xmlhttprequest/,
      /axios/,
      /process\.env\.scout/,
      /import\.meta\.env/,
    ]) {
      assert.ok(!forbidden.test(runtimeCode), `runtime code must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Rate-limit storage change is disabled scaffold only and does not affect endpoint/frontend defaults',
  fn: () => {
    assert.ok(storageCode.includes('STORAGE_KV_DISABLED'), 'storage KV scaffold must safe-fail disabled');
    assert.ok(storageCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'storage DO scaffold must safe-fail disabled');
    assert.ok(storageCode.includes('STORAGE_D1_DISABLED'), 'storage D1 scaffold must safe-fail disabled');
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint STUB mode must remain');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend local_stub must remain');
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
