/**
 * Scout Storage Key Builder Disabled Scaffold Contract Tests
 * v20260607-1
 *
 * Locks disabled-by-default behavior for the future Scout live rate-limit
 * storage key builder. This contract allows the scaffold module but blocks
 * real key generation, real hashing, real storage access, endpoint wiring,
 * frontend source changes, provider integration, and Browse #1661 work.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODULE_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-key-builder-disabled-scaffold.md');
const PRIOR_CONTRACT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-key-hashing-allowlist-contract.md');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const moduleSource = readFile(MODULE_PATH);
const moduleCode = codeOnly(moduleSource);
const doc = readFile(DOC_PATH);
const priorDoc = readFile(PRIOR_CONTRACT_DOC_PATH);
const suggest = readFile(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

const allowedInputs = [
  'userKeyHash',
  'ipHash',
  'sessionKeyHash',
  'endpointPath',
  'providerMode',
  'limitName',
  'windowKey',
];

const prohibitedInputs = [
  'rawToken',
  'authorizationHeader',
  'rawUserId',
  'rawUserIdentifier',
  'email',
  'phoneNumber',
  'apiKey',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
  'firebaseToken',
];

push('Disabled scaffold module and doc exist with expected references', () => {
  assert.ok(moduleSource.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION'));
  assert.ok(doc.includes('Status: disabled scaffold / no live storage key generation'));
  assert.ok(doc.includes('Parent issue: #1882'));
  assert.ok(doc.includes('Slice issue: #2341'));
  assert.ok(doc.includes('Depends on: #2339'));
});

push('Scaffold exports expected boundary names', () => {
  for (const exported of [
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS',
    'sanitizeScoutLiveRateLimitStorageKeyPayload',
    'buildScoutLiveRateLimitStorageKey',
    'createScoutLiveRateLimitStorageKeyBuilder',
  ]) {
    assert.ok(moduleSource.includes('export const ' + exported) || moduleSource.includes('export function ' + exported), `missing export ${exported}`);
  }
});

push('Scaffold locks allowed and prohibited input names', () => {
  for (const allowed of allowedInputs) {
    assert.ok(moduleSource.includes("'" + allowed + "'"), `module must include allowed input ${allowed}`);
    assert.ok(doc.includes('`' + allowed + '`'), `doc must include allowed input ${allowed}`);
    assert.ok(priorDoc.includes('`' + allowed + '`'), `prior contract must include allowed input ${allowed}`);
  }
  for (const prohibited of prohibitedInputs) {
    assert.ok(moduleSource.includes("'" + prohibited + "'"), `module must include prohibited input ${prohibited}`);
  }
});

push('Scaffold default behavior is disabled and never returns a usable key', () => {
  assert.ok(moduleSource.includes('disabled: true'), 'factory/result must expose disabled true');
  assert.ok(moduleSource.includes('ok: false'), 'builder must safe-fail');
  assert.ok(moduleSource.includes('storageKey: null'), 'builder must not return storageKey');
  assert.ok(moduleSource.includes('keyPreview: null'), 'builder must not return keyPreview');
  assert.ok(moduleSource.includes('STORAGE_KEY_BUILDER_DISABLED'), 'disabled code must be present');
  assert.ok(moduleSource.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'), 'prohibited payload code must be present');
});

push('Scaffold sanitizer is allowlist-only and rejects prohibited payloads', () => {
  assert.ok(moduleSource.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS.includes(key)'), 'sanitizer must copy only allowed fields');
  assert.ok(moduleSource.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS.includes(key)'), 'sanitizer must inspect prohibited fields');
  assert.ok(moduleSource.includes("onProhibitedField: 'reject'"), 'default must reject prohibited fields');
  assert.ok(moduleSource.includes('rejected: true'), 'sanitizer must support rejected true');
  assert.ok(moduleSource.includes('rejectedFields'), 'sanitizer must report rejected fields');
});

push('Scaffold blocks real hashing, secrets, storage backends, network, and provider integration', () => {
  for (const forbidden of [
    'crypto.subtle.digest',
    'createHash',
    'HMAC',
    'SCOUT_STORAGE_KEY_SALT',
    'SCOUT_RATE_LIMIT_KV',
    'SCOUT_RATE_LIMIT_DO',
    'SCOUT_RATE_LIMIT_D1',
    'DurableObjectNamespace',
    'fetch(',
    'axios',
    'openai.chat.completions',
    'anthropic.messages',
    'generateContent',
  ]) {
    assert.ok(!moduleCode.includes(forbidden), `module must not include ${forbidden}`);
  }
});

push('Documentation locks non-goals and future gates', () => {
  for (const phrase of [
    'The scaffold must not generate usable storage keys for live traffic.',
    'No-GO for real key generation',
    'No-GO for real key generation, real hashing, real storage backend access, endpoint wiring, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.',
    'deterministic hash helper tests',
    'salt/version policy tests',
    'raw preimage non-persistence tests',
    'staging/prod key namespace separation tests',
  ]) {
    assert.ok(doc.toLowerCase().includes(phrase.toLowerCase()), `doc must include ${phrase}`);
  }
});

push('Endpoint and frontend are not wired to the new key builder scaffold', () => {
  assert.ok(!suggestCode.includes('live-rate-limit-storage-key-builder'), 'suggest.js must not import key builder scaffold');
  assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageKeyBuilder'), 'suggest.js must not create key builder');
  assert.ok(!sourceSelector.includes('storageKeyBuilder'), 'frontend selector must not expose key builder');
  assert.ok(!endpointClient.includes('storageKeyBuilder'), 'endpoint client must not expose key builder');
});

push('Endpoint default stub and frontend local_stub remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
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
