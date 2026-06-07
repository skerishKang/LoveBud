/**
 * Scout Dependency Storage Safe-Fail Regression Matrix Contract Tests
 * v20260608-1
 *
 * Regression-only coverage for dependency adapter storage result mapping.
 * This test must not require runtime behavior expansion, endpoint wiring,
 * real key generation, hashing, real storage backends, frontend source changes,
 * provider integration, or Browse #1661 work.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-dependency-storage-safe-fail-regression-matrix.md');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const KEY_BUILDER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
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

const doc = readFile(DOC_PATH);
const depAdapter = readFile(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapter);
const storageAdapter = readFile(STORAGE_ADAPTER_PATH);
const storageAdapterCode = codeOnly(storageAdapter);
const keyBuilder = readFile(KEY_BUILDER_PATH);
const keyBuilderCode = codeOnly(keyBuilder);
const suggest = readFile(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

const matrixRows = [
  ['STORAGE_PAYLOAD_PROHIBITED', 'RATE_LIMIT_PAYLOAD_PROHIBITED'],
  ['STORAGE_NOT_IMPLEMENTED', 'RATE_LIMIT_NOT_IMPLEMENTED'],
  ['STORAGE_MOCK_DISABLED', 'RATE_LIMIT_NOT_IMPLEMENTED'],
  ['STORAGE_KV_DISABLED', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
  ['STORAGE_DURABLE_OBJECT_DISABLED', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
  ['STORAGE_D1_DISABLED', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
  ['STORAGE_CONFIG_MISSING', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
  ['STORAGE_KEY_BUILDER_DISABLED', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
  ['STORAGE_KEY_PAYLOAD_PROHIBITED', 'RATE_LIMIT_STORAGE_UNAVAILABLE'],
];

push('Regression matrix document exists with expected status and references', () => {
  assert.ok(doc.includes('Status: regression matrix only / no runtime behavior expansion'));
  assert.ok(doc.includes('Parent issue: #1882'));
  assert.ok(doc.includes('Slice issue: #2347'));
  assert.ok(doc.includes('Depends on: #2345'));
});

push('Regression matrix documents every explicit storage mapping row', () => {
  for (const [sourceCode, targetCode] of matrixRows) {
    assert.ok(doc.includes('`' + sourceCode + '`'), `doc must include source ${sourceCode}`);
    assert.ok(doc.includes('`' + targetCode + '`'), `doc must include target ${targetCode}`);
  }
});

push('Dependency adapter recognizes every explicit storage source code', () => {
  for (const [sourceCode] of matrixRows) {
    assert.ok(depAdapter.includes("code === '" + sourceCode + "'"), `dependency adapter must recognize ${sourceCode}`);
  }
});

push('Payload prohibited mapping remains payload-prohibited', () => {
  assert.ok(depAdapter.includes("code === 'STORAGE_PAYLOAD_PROHIBITED'"));
  assert.ok(depAdapter.includes('RATE_LIMIT_PAYLOAD_PROHIBITED'));
  assert.ok(doc.includes('| `STORAGE_PAYLOAD_PROHIBITED` | `RATE_LIMIT_PAYLOAD_PROHIBITED` | deny |'));
});

push('Mock-disabled and not-implemented storage mappings remain not-implemented', () => {
  assert.ok(depAdapter.includes("code === 'STORAGE_NOT_IMPLEMENTED'"));
  assert.ok(depAdapter.includes("code === 'STORAGE_MOCK_DISABLED'"));
  assert.ok(depAdapter.includes('RATE_LIMIT_NOT_IMPLEMENTED'));
  assert.ok(doc.includes('| `STORAGE_NOT_IMPLEMENTED` | `RATE_LIMIT_NOT_IMPLEMENTED` | deny |'));
  assert.ok(doc.includes('| `STORAGE_MOCK_DISABLED` | `RATE_LIMIT_NOT_IMPLEMENTED` | deny |'));
});

push('Runtime scaffold and key-builder safe-fail mappings remain storage-unavailable', () => {
  for (const code of [
    'STORAGE_KV_DISABLED',
    'STORAGE_DURABLE_OBJECT_DISABLED',
    'STORAGE_D1_DISABLED',
    'STORAGE_CONFIG_MISSING',
    'STORAGE_KEY_BUILDER_DISABLED',
    'STORAGE_KEY_PAYLOAD_PROHIBITED',
  ]) {
    assert.ok(depAdapter.includes("code === '" + code + "'"), `dependency adapter must recognize ${code}`);
  }
  assert.ok(depAdapter.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'));
});

push('Unknown and missing storage codes fail closed to storage unavailable', () => {
  assert.ok(doc.includes('| unknown storage code | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny |'));
  assert.ok(doc.includes('| missing storage code | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny |'));
  assert.ok(depAdapter.includes('rate-limit storage adapter returned an unknown result'));
});

push('Storage adapter throw fail-closed behavior remains documented and implemented', () => {
  assert.ok(doc.includes('| storage adapter throw | `RATE_LIMIT_STORAGE_UNAVAILABLE` | deny |'));
  assert.ok(depAdapter.includes('rate-limit storage adapter threw an exception'));
});

push('Default dependency, endpoint, and frontend behavior remain preserved', () => {
  assert.ok(depAdapter.includes('mockDisabled: true'), 'dependency adapter default mockDisabled must remain');
  assert.ok(depAdapter.includes('SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED'), 'dependency adapter mock mode must remain');
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('No endpoint or frontend key-builder exposure is introduced', () => {
  assert.ok(!suggestCode.includes('live-rate-limit-storage-key-builder'), 'endpoint must not import key builder');
  assert.ok(!suggestCode.includes('STORAGE_KEY_BUILDER_DISABLED'), 'endpoint must not expose key builder code');
  assert.ok(!suggestCode.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'), 'endpoint must not expose key builder code');
  assert.ok(!sourceSelector.includes('storageKeyBuilder'), 'frontend selector must not expose key builder');
  assert.ok(!endpointClient.includes('storageKeyBuilder'), 'endpoint client must not expose key builder');
});

push('No real storage, hashing, provider, or secret boundary is introduced', () => {
  const combinedBoundaryCode = [depAdapterCode, storageAdapterCode, keyBuilderCode].join('\n');
  for (const forbidden of [
    'crypto.subtle.digest',
    'createHash',
    'HMAC',
    'SCOUT_STORAGE_KEY_SALT',
    'SCOUT_RATE_LIMIT_KV',
    'SCOUT_RATE_LIMIT_DO',
    'SCOUT_RATE_LIMIT_D1',
    'DurableObjectNamespace',
    'idFromName(',
    'getByName(',
    '.prepare(',
    '.batch(',
    'axios',
    'openai.chat.completions',
    'anthropic.messages',
    'generateContent',
  ]) {
    assert.ok(!combinedBoundaryCode.includes(forbidden), `must not introduce ${forbidden}`);
  }
});

push('Document locks non-goals and regression-only scope', () => {
  for (const phrase of [
    'This slice should not expand runtime behavior.',
    'GO for regression matrix documentation and contract tests.',
    'NO-GO for runtime behavior expansion, endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.',
  ]) {
    assert.ok(doc.includes(phrase), `doc must include ${phrase}`);
  }
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
