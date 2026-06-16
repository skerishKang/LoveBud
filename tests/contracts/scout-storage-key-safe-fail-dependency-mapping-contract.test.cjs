/**
 * Scout Storage Key Safe-Fail Dependency Mapping Contract Tests
 * v20260607-1
 *
 * Locks storage key builder safe-fail code mapping at the dependency adapter
 * boundary. This contract does not allow endpoint wiring, real key generation,
 * hashing, real storage backends, frontend source changes, provider integration,
 * or Browse #1661 work.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const KEY_BUILDER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-key-safe-fail-dependency-mapping.md');
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

const depAdapter = readFile(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapter);
const storageAdapter = readFile(STORAGE_ADAPTER_PATH);
const storageAdapterCode = codeOnly(storageAdapter);
const keyBuilder = readFile(KEY_BUILDER_PATH);
const keyBuilderCode = codeOnly(keyBuilder);
const doc = readFile(DOC_PATH);
const suggest = readFile(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

push('Dependency mapping doc exists with issue references and status', () => {
  assert.ok(doc.includes('Status: dependency adapter mapping only / no endpoint behavior change'));
  assert.ok(doc.includes('Parent issue: #1882'));
  assert.ok(doc.includes('Slice issue: #2345'));
  assert.ok(doc.includes('Depends on: #2343'));
});

push('Dependency adapter version is bumped for the runtime-key scaffold mapping slice', () => {
  // Issue #2569: this slice added the Firebase runtime verified mapping
  // at version 20260616-runtime-mapping-1. Issue #2571 then bumped the
  // version to 20260616-bearer-handoff-1 to add the guarded raw token
  // handoff option. Issue #2577 then bumped the version to
  // 20260616-runtime-key-mapping-1 to add the STORAGE_KEY_BUILT safe-fail
  // mapping.
  assert.ok(depAdapter.includes("SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260616-runtime-key-mapping-1'"));
});

push('Dependency adapter maps storage key builder disabled to storage unavailable', () => {
  assert.ok(depAdapter.includes("code === 'STORAGE_KEY_BUILDER_DISABLED'"), 'must recognize STORAGE_KEY_BUILDER_DISABLED');
  assert.ok(depAdapter.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'must map to RATE_LIMIT_STORAGE_UNAVAILABLE');
  assert.ok(doc.includes('`STORAGE_KEY_BUILDER_DISABLED` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`'));
});

push('Dependency adapter maps storage key payload prohibited to storage unavailable', () => {
  assert.ok(depAdapter.includes("code === 'STORAGE_KEY_PAYLOAD_PROHIBITED'"), 'must recognize STORAGE_KEY_PAYLOAD_PROHIBITED');
  assert.ok(doc.includes('`STORAGE_KEY_PAYLOAD_PROHIBITED` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`'));
});

push('Existing storage scaffold unavailable mappings remain intact', () => {
  for (const code of [
    'STORAGE_KV_DISABLED',
    'STORAGE_DURABLE_OBJECT_DISABLED',
    'STORAGE_D1_DISABLED',
    'STORAGE_CONFIG_MISSING',
  ]) {
    assert.ok(depAdapter.includes("code === '" + code + "'"), `must preserve ${code} mapping`);
    assert.ok(doc.includes(code), `doc must mention ${code}`);
  }
});

push('Storage payload prohibited still maps to payload-prohibited, not storage-unavailable', () => {
  assert.ok(depAdapter.includes("code === 'STORAGE_PAYLOAD_PROHIBITED'"));
  assert.ok(depAdapter.includes('RATE_LIMIT_PAYLOAD_PROHIBITED'));
  assert.ok(doc.includes('`STORAGE_PAYLOAD_PROHIBITED` remains mapped to `RATE_LIMIT_PAYLOAD_PROHIBITED`'));
});

push('Dependency adapter keeps allowlisted storage payload boundary', () => {
  for (const allowed of [
    'requestId',
    'userKeyHash',
    'ipHash',
    'sessionKeyHash',
    'endpointPath',
    'providerMode',
    'windowKey',
    'limitName',
    'nowMs',
  ]) {
    assert.ok(depAdapter.includes("'" + allowed + "'"), `dependency adapter must include allowed field ${allowed}`);
  }
  for (const forbidden of [
    'rawToken',
    'authorizationHeader',
    'apiKey',
    'prompt',
    'excerpt',
    'sourceUrl',
    'rawRequestBody',
    'rawProviderResponse',
    'rawModelOutput',
  ]) {
    assert.ok(!depAdapterCode.includes("'" + forbidden + "'"), `dependency adapter storage payload must not include ${forbidden}`);
  }
});

push('Default dependency adapter behavior remains mock-disabled', () => {
  assert.ok(depAdapter.includes('mockDisabled: true'), 'default mockDisabled must remain true');
  assert.ok(depAdapter.includes('SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED'), 'mock-disabled mode must remain');
  assert.ok(depAdapter.includes('buildMockDisabledRateLimitResponse'), 'mock-disabled rate-limit helper must remain');
  assert.ok(depAdapter.includes('buildMockDisabledVerifyResponse'), 'mock-disabled verify helper must remain');
});

push('Storage adapter and key builder remain disabled without usable storage key generation', () => {
  assert.ok(storageAdapter.includes('STORAGE_KEY_BUILDER_DISABLED'));
  assert.ok(storageAdapter.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'));
  assert.ok(keyBuilder.includes('storageKey: null'));
  assert.ok(keyBuilder.includes('keyPreview: null'));
  assert.ok(keyBuilder.includes('disabled: true'));
  assert.ok(keyBuilder.includes('ok: false'));
});

push('Endpoint and frontend remain unwired to key builder and dependency mapping details', () => {
  assert.ok(!suggestCode.includes('live-rate-limit-storage-key-builder'), 'endpoint must not import key builder');
  assert.ok(!suggestCode.includes('STORAGE_KEY_BUILDER_DISABLED'), 'endpoint must not expose key builder code');
  assert.ok(!suggestCode.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'), 'endpoint must not expose key builder code');
  assert.ok(!sourceSelector.includes('storageKeyBuilder'), 'frontend selector must not expose key builder');
  assert.ok(!endpointClient.includes('storageKeyBuilder'), 'endpoint client must not expose key builder');
});

push('Endpoint and frontend defaults remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('No real hashing, storage backend, provider SDK, or secret access is introduced in this boundary', () => {
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

push('Documentation locks non-goals and mapping rationale', () => {
  assert.ok(doc.includes('dependency adapter must collapse those storage-key-specific details into the existing generic rate-limit storage unavailable boundary'));
  assert.ok(doc.includes('without exposing raw field names or raw payload content'));
  assert.ok(doc.toLowerCase().includes('no-go for endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or browse #1661 work in this slice.'));
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
