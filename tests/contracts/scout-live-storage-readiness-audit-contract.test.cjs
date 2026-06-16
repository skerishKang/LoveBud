/**
 * Scout Live Storage Readiness Audit Contract Tests
 * v20260608-1
 *
 * Product readiness audit only. This contract verifies the audit document
 * and guardrails after the storage safe-fail mapping matrix. It must not
 * require runtime behavior expansion, endpoint wiring, real storage key
 * generation, hashing, real storage backends, frontend changes, provider
 * integration, or Browse #1661 work.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-storage-readiness-audit.md');
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

push('Storage readiness audit document exists with baseline and references', () => {
  assert.ok(doc.includes('Status: product readiness audit / no runtime behavior change'));
  assert.ok(doc.includes('Parent issue: #1882'));
  assert.ok(doc.includes('Slice issue: #2349'));
  assert.ok(doc.includes('Depends on: #2347'));
  assert.ok(doc.includes('main HEAD before this audit: 74f17432c56c5d2aec9def25309049707b955a36'));
});

push('Audit references the completed storage safety slice sequence', () => {
  for (const sliceRef of [
    '#2337 / #2338',
    '#2339 / #2340',
    '#2341 / #2342',
    '#2343 / #2344',
    '#2345 / #2346',
    '#2347 / #2348',
  ]) {
    assert.ok(doc.includes(sliceRef), `audit must reference ${sliceRef}`);
  }
});

push('Audit inventories implemented storage boundaries', () => {
  for (const phrase of [
    'Storage backend selection policy',
    'Key hashing and allowlist policy',
    'Disabled key builder scaffold',
    'Storage adapter safe-fail wiring',
    'Dependency adapter safe-fail mapping',
    'Regression matrix',
  ]) {
    assert.ok(doc.includes(phrase), `audit must include ${phrase}`);
  }
});

push('Audit preserves default behavior guardrails', () => {
  for (const phrase of [
    'endpoint default: `stub`',
    'frontend source selector default: `local_stub`',
    'endpoint client: disabled by default',
    'live provider call: not enabled',
    'real storage backend call: not enabled',
    'storage key generation for live traffic: not enabled',
    'hashing secret or salt access: not enabled',
    'Browse #1661: not touched',
  ]) {
    assert.ok(doc.includes(phrase), `audit must preserve ${phrase}`);
  }
});

push('Audit go/no-go matrix blocks live storage and provider work', () => {
  for (const row of [
    '| Runtime key builder implementation | NO-GO |',
    '| Real KV implementation | NO-GO |',
    '| Real Durable Object implementation | NO-GO |',
    '| Real D1 implementation | NO-GO |',
    '| Endpoint live wiring | NO-GO |',
    '| Frontend endpoint default change | NO-GO |',
    '| Staging live | NO-GO |',
    '| Production live | NO-GO |',
    '| Provider integration | NO-GO |',
    '| Browse #1661 | NO-GO |',
  ]) {
    assert.ok(doc.includes(row), `go/no-go matrix must include ${row}`);
  }
});

push('Audit lists remaining blockers before real storage backend work', () => {
  for (const blocker of [
    'Deterministic hash helper contract',
    'Salt and versioning policy',
    'Environment namespace separation policy for staging and production',
    'Storage key format implementation contract',
    'Raw preimage non-persistence tests',
    'Log redaction and observability tests for storage keys',
    'Quota window model and limit policy',
    'Abuse monitoring policy',
    'Backend-specific implementation plan for KV, Durable Object, or D1',
    'Rollback and kill-switch plan for storage runtime',
    'Cost and quota impact review',
    'Staging-only rollout checklist',
    'Privacy review for hashed identifiers and retention',
    'Endpoint safe-fail integration tests',
    'CI evidence that default stub and frontend `local_stub` remain unchanged',
  ]) {
    assert.ok(doc.includes(blocker), `audit must list blocker ${blocker}`);
  }
});

push('Audit recommends the next disabled scaffold contract', () => {
  assert.ok(doc.includes('[TECH] Add Scout storage hash helper disabled scaffold contract'));
  assert.ok(doc.includes('should still avoid real hashing secret/salt access'));
});

push('Runtime files retain expected storage safety boundaries', () => {
  // Issue #2569: dependency adapter version was bumped to
  // 20260616-runtime-mapping-1 to add the Firebase runtime verified
  // mapping. The storage safety boundary markers (STORAGE_KEY_BUILDER_DISABLED
  // / STORAGE_KEY_PAYLOAD_PROHIBITED / RATE_LIMIT_STORAGE_UNAVAILABLE) must
  // remain present.
  assert.ok(depAdapter.includes("SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260616-runtime-mapping-1'"));
  assert.ok(depAdapter.includes("code === 'STORAGE_KEY_BUILDER_DISABLED'"));
  assert.ok(depAdapter.includes("code === 'STORAGE_KEY_PAYLOAD_PROHIBITED'"));
  assert.ok(depAdapter.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'));
  assert.ok(storageAdapter.includes("SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = '20260607-3'"));
  assert.ok(storageAdapter.includes('STORAGE_KEY_BUILDER_DISABLED'));
  assert.ok(storageAdapter.includes('STORAGE_KEY_PAYLOAD_PROHIBITED'));
  assert.ok(keyBuilder.includes("SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION = '20260607-1'"));
  assert.ok(keyBuilder.includes('storageKey: null'));
  assert.ok(keyBuilder.includes('keyPreview: null'));
  assert.ok(keyBuilder.includes('disabled: true'));
});

push('Endpoint and frontend defaults remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('No endpoint or frontend storage key exposure is introduced', () => {
  assert.ok(!suggestCode.includes('live-rate-limit-storage-key-builder'), 'endpoint must not import key builder');
  assert.ok(!suggestCode.includes('storageKeyBuilder'), 'endpoint must not expose storageKeyBuilder');
  assert.ok(!sourceSelector.includes('storageKeyBuilder'), 'frontend selector must not expose storageKeyBuilder');
  assert.ok(!endpointClient.includes('storageKeyBuilder'), 'endpoint client must not expose storageKeyBuilder');
});

push('No real hashing, storage backend, provider, or secret boundary is introduced', () => {
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

push('Audit final verdict blocks runtime live work', () => {
  for (const phrase of [
    'The storage safety track is ready for another disabled-by-default scaffold contract.',
    'It is not ready for real runtime key generation.',
    'It is not ready for real KV, Durable Object, or D1 implementation.',
    'It is not ready for endpoint live wiring.',
    'It is not ready for frontend default endpoint mode.',
    'It is not ready for staging live or production live.',
    'It is not ready for provider integration.',
  ]) {
    assert.ok(doc.includes(phrase), `audit verdict must include ${phrase}`);
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
