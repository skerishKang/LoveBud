/**
 * Scout Storage Key Builder Adapter Wiring Contract Tests
 * v20260607-1
 *
 * Locks the disabled key-builder-to-storage-adapter wiring boundary.
 * The adapter may call the disabled key builder only on runtime scaffold paths,
 * while preserving safe-fail behavior and avoiding real key generation,
 * hashing, storage backends, endpoint wiring, frontend changes, provider
 * integration, and Browse #1661 work.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const KEY_BUILDER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-key-builder-adapter-wiring.md');
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

const adapter = readFile(ADAPTER_PATH);
const adapterCode = codeOnly(adapter);
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

push('Adapter wiring doc exists with issue references and disabled status', () => {
  assert.ok(doc.includes('Status: disabled wiring / no live storage key generation'));
  assert.ok(doc.includes('Parent issue: #1882'));
  assert.ok(doc.includes('Slice issue: #2343'));
  assert.ok(doc.includes('Depends on: #2341'));
});

push('Storage adapter imports the disabled key builder scaffold only at adapter boundary', () => {
  assert.ok(adapter.includes("from './live-rate-limit-storage-key-builder.js'"), 'adapter must import key builder scaffold');
  assert.ok(adapter.includes('createScoutLiveRateLimitStorageKeyBuilder'), 'adapter must reference key builder factory');
  assert.ok(adapter.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES'), 'adapter must reference key builder codes');
  assert.ok(!suggestCode.includes('live-rate-limit-storage-key-builder'), 'endpoint must not import key builder');
  assert.ok(!sourceSelector.includes('storageKeyBuilder'), 'frontend source selector must not expose key builder');
  assert.ok(!endpointClient.includes('storageKeyBuilder'), 'endpoint client must not expose key builder');
});

push('Storage adapter exposes disabled key builder metadata only on runtime scaffold path', () => {
  assert.ok(adapter.includes('hasStorageKeyBuilder: true'), 'runtime scaffold adapter must expose key builder');
  assert.ok(adapter.includes('hasStorageKeyBuilder: false'), 'default/not-implemented adapters must not expose key builder');
  assert.ok(adapter.includes('createRuntimeScaffoldAdapter'), 'runtime scaffold path must exist');
  assert.ok(adapter.includes('resolveDisabledStorageKeyBuilder'), 'adapter must resolve disabled key builder');
});

push('Storage adapter calls disabled key builder but keeps safe-fail response shape', () => {
  assert.ok(adapter.includes('storageKeyBuilder.buildKey(payload)'), 'runtime scaffold methods must call disabled key builder');
  assert.ok(adapter.includes('storageKey: null'), 'adapter must force null storage key in normalized result');
  assert.ok(adapter.includes('keyPreview: null'), 'adapter must force null key preview in normalized result');
  assert.ok(adapter.includes('ok: false'), 'normalized key builder result must be safe-fail');
  assert.ok(adapter.includes('disabled: true'), 'normalized key builder result must stay disabled');
  assert.ok(adapter.includes('storageKeyBuilder: normalizedKeyBuilderResult'), 'responses must include sanitized key builder result');
});

push('Storage adapter maps prohibited key builder payloads to safe adapter code', () => {
  assert.ok(adapter.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'), 'adapter must expose prohibited key payload code');
  assert.ok(adapter.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED'), 'adapter must inspect key builder prohibited code');
  assert.ok(adapter.includes('SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED'), 'adapter must map to adapter prohibited code');
});

push('Default storage adapter behavior remains mock-disabled', () => {
  assert.ok(adapter.includes('mockDisabled: true'), 'default mock-disabled behavior must remain');
  assert.ok(adapter.includes('mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED'), 'mock-disabled mode must remain');
  assert.ok(adapter.includes('buildMockDisabledCheckResponse'), 'mock-disabled check response must remain');
  assert.ok(adapter.includes('buildMockDisabledConsumeResponse'), 'mock-disabled consume response must remain');
  assert.ok(adapter.includes('buildMockDisabledReleaseResponse'), 'mock-disabled release response must remain');
});

push('Key builder scaffold itself remains disabled and never creates usable keys', () => {
  assert.ok(keyBuilder.includes('storageKey: null'), 'key builder must return null storageKey');
  assert.ok(keyBuilder.includes('keyPreview: null'), 'key builder must return null keyPreview');
  assert.ok(keyBuilder.includes('ok: false'), 'key builder must safe-fail');
  assert.ok(keyBuilder.includes('disabled: true'), 'key builder must stay disabled');
});

push('No real hashing, storage backend, network, or provider integration is introduced', () => {
  const combinedCode = [adapterCode, keyBuilderCode, suggestCode].join('\n');
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
    assert.ok(!combinedCode.includes(forbidden), `must not introduce ${forbidden}`);
  }
});

push('Endpoint and frontend defaults remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('Documentation locks allowed and disallowed wiring', () => {
  for (const phrase of [
    'import the disabled key builder scaffold',
    'preserve `storageKey: null` and `keyPreview: null`',
    'map prohibited key-builder payloads to `STORAGE_KEY_PAYLOAD_PROHIBITED`',
    'no usable storage key generation',
    'no real hash helper',
    'no hashing secret or salt access',
    'no KV read/write/delete',
    'no Durable Object namespace, id, stub, or fetch',
    'no D1 prepare/batch/exec',
    'NO-GO for real key generation, real hashing, real storage backend access, endpoint wiring, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.',
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
