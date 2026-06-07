/**
 * Scout Storage Key Hashing and Allowlist Contract Tests
 * v20260607-1
 *
 * Locks the policy/readiness contract for future Scout live rate-limit
 * storage key construction. This is contract-only: no runtime key builder,
 * no real KV / Durable Object / D1 implementation, no endpoint behavior
 * change, no frontend default source change, and no provider integration.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-key-hashing-allowlist-contract.md');
const STORAGE_POLICY_PATH = path.join(ROOT, 'docs/product/lovebud-scout-rate-limit-storage-backend-selection-policy.md');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const doc = readFileSafe(DOC_PATH);
const storagePolicyDoc = readFileSafe(STORAGE_POLICY_PATH);
const storageAdapter = readFileSafe(STORAGE_ADAPTER_PATH);
const storageAdapterCode = codeOnly(storageAdapter);
const depAdapter = readFileSafe(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapter);
const suggest = readFileSafe(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClient = readFileSafe(ENDPOINT_CLIENT_PATH);

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
  'raw token',
  'authorization header',
  'raw user ID',
  'email',
  'phone number',
  'API key',
  'prompt',
  'excerpt',
  'source URL',
  'raw request body',
  'raw provider response',
  'raw model output',
];

const existingStorageDenylistTokens = [
  'rawToken',
  'authorizationHeader',
  'rawUserIdentifier',
  'apiKey',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
];

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

push('Storage key hashing allowlist contract document exists with issue references', () => {
  assert.ok(doc.length > 0, 'contract doc must exist');
  assert.ok(doc.includes('Status: contract/readiness only / no runtime storage key builder'), 'doc must declare contract/readiness-only status');
  assert.ok(doc.includes('Parent issue: #1882'), 'doc must reference parent issue #1882');
  assert.ok(doc.includes('Slice issue: #2339'), 'doc must reference slice issue #2339');
});

push('Contract locks the exact allowed storage key inputs', () => {
  for (const allowed of allowedInputs) {
    assert.ok(doc.includes('`' + allowed + '`'), `doc must include allowed input ${allowed}`);
    assert.ok(storageAdapter.includes("'" + allowed + "'"), `existing storage payload allowlist must include ${allowed}`);
  }
  assert.ok(!allowedInputs.includes('requestId'), 'requestId must not be part of the storage key input allowlist in this contract');
});

push('Contract locks prohibited raw and sensitive storage key inputs', () => {
  for (const prohibited of prohibitedInputs) {
    assert.ok(doc.includes(prohibited), `doc must prohibit ${prohibited}`);
  }
  for (const token of existingStorageDenylistTokens) {
    assert.ok(storageAdapter.includes("'" + token + "'") || storageAdapter.includes('"' + token + '"'), `storage adapter denylist must include ${token}`);
  }
});

push('Contract explains every allowed field meaning', () => {
  for (const heading of [
    '### 5.1 `userKeyHash`',
    '### 5.2 `ipHash`',
    '### 5.3 `sessionKeyHash`',
    '### 5.4 `endpointPath`',
    '### 5.5 `providerMode`',
    '### 5.6 `limitName`',
    '### 5.7 `windowKey`',
  ]) {
    assert.ok(doc.includes(heading), `doc must explain ${heading}`);
  }
});

push('Contract requires one-way deterministic hashing before storage adapter input', () => {
  for (const phrase of [
    'one-way deterministic digest',
    'no raw identifier in the output',
    'stable key format with an explicit version prefix',
    'environment separation so staging and production do not share key space',
    'no frontend exposure of hash inputs, salt, or derived storage keys',
    'no storage of raw preimage values',
  ]) {
    assert.ok(doc.includes(phrase), `doc must include hashing requirement: ${phrase}`);
  }
});

push('Contract defines a recommended future key shape without implementing it', () => {
  assert.ok(doc.includes('scout:rate_limit:v1:{providerMode}:{endpointPath}:{limitName}:{windowKey}:{identityScopeHash}'), 'doc must include recommended future key shape');
  assert.ok(doc.includes('This recommended shape is not implemented in this slice.'), 'doc must state key shape is not implemented');
});

push('Contract enforces allowlist-first behavior and fail-closed behavior', () => {
  for (const phrase of [
    'copy only approved fields',
    'drop unknown fields by default',
    'reject prohibited fields when the caller requests strict mode',
    'never concatenate raw request data into a storage key',
    'missing approved hash input → deny',
    'malformed approved hash input → deny',
    'prohibited raw input detected → deny',
    'key builder exception → deny',
    'storage key unavailable → deny',
  ]) {
    assert.ok(doc.includes(phrase), `doc must include behavior: ${phrase}`);
  }
  assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'doc must retain canonical safe-fail code');
});

push('Contract keeps runtime implementation gated', () => {
  for (const phrase of [
    'dedicated implementation issue exists',
    'disabled-by-default key builder scaffold contract exists',
    'tests prove raw identifiers are not present in generated keys',
    'tests prove endpoint default remains `stub`',
    'tests prove frontend default remains `local_stub`',
    'tests prove no real KV, Durable Object, or D1 call is introduced',
    'tests prove no live provider call is introduced',
  ]) {
    assert.ok(doc.includes(phrase), `doc must include gate: ${phrase}`);
  }
});

push('Contract explicitly blocks runtime key builder and real storage implementation', () => {
  for (const phrase of [
    'NO-GO for runtime storage key builder implementation in this slice',
    'NO-GO for real KV, Durable Object, or D1 implementation in this slice',
    'NO-GO for endpoint, frontend, provider, deployment, or Browse #1661 changes in this slice',
    'No runtime storage key builder implementation',
    'No real KV, Durable Object, or D1 implementation',
    'No endpoint behavior change',
    'No frontend default source change',
    'No provider integration',
    'No Browse #1661 work',
  ]) {
    assert.ok(doc.toLowerCase().includes(phrase.toLowerCase()), `doc must block: ${phrase}`);
  }
});

push('Backend selection policy already requires key hashing and key allowlist evidence', () => {
  assert.ok(storagePolicyDoc.includes('key hashing and key allowlist contract'), 'backend policy must require key hashing and allowlist evidence');
  assert.ok(storagePolicyDoc.includes('no raw identifiers in logs or storage keys'), 'backend policy must prohibit raw identifiers in logs or storage keys');
});

push('This slice does not add runtime key builder exports to storage adapter', () => {
  assert.ok(!storageAdapterCode.includes('buildScoutLiveRateLimitStorageKey'), 'storage key builder must not exist in runtime adapter yet');
  assert.ok(!storageAdapterCode.includes('createScoutStorageKey'), 'storage key creator must not exist in runtime adapter yet');
  assert.ok(!storageAdapterCode.includes('hashScoutStorageKeyInput'), 'hash helper must not exist in runtime adapter yet');
});

push('This slice does not add real KV, Durable Object, or D1 runtime bindings', () => {
  const combinedCode = [storageAdapterCode, depAdapterCode, suggestCode].join('\n');
  for (const forbidden of [
    'env.SCOUT_RATE_LIMIT_KV',
    'env.SCOUT_RATE_LIMIT_DO',
    'env.SCOUT_RATE_LIMIT_D1',
    'DurableObjectNamespace',
    'idFromName(',
    'getByName(',
    '.prepare(',
    '.batch(',
    'SCOUT_RATE_LIMIT_KV.',
    'SCOUT_RATE_LIMIT_D1.',
  ]) {
    assert.ok(!combinedCode.includes(forbidden), `runtime code must not add storage binding token ${forbidden}`);
  }
});

push('Endpoint default stub and frontend local_stub remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('Endpoint and frontend do not expose storage key controls', () => {
  for (const forbidden of ['storageKey', 'keyHashSalt', 'windowKeySalt', 'identityScopeHash', 'rateLimitStorageKey']) {
    assert.ok(!suggestCode.includes(forbidden), `endpoint must not expose ${forbidden}`);
    assert.ok(!sourceSelector.includes(forbidden), `source selector must not expose ${forbidden}`);
    assert.ok(!endpointClient.includes(forbidden), `endpoint client must not expose ${forbidden}`);
  }
});

push('No provider integration is introduced by this contract slice', () => {
  const combinedCode = [storageAdapterCode, depAdapterCode, suggestCode].join('\n');
  for (const forbidden of [
    'openai.chat.completions',
    'anthropic.messages',
    'generateContent',
    'providerApiKey',
    'LLM_API_KEY',
    'axios',
  ]) {
    assert.ok(!combinedCode.includes(forbidden), `contract slice must not introduce provider token ${forbidden}`);
  }
});

push('Contract test itself stays policy-only and does not import runtime modules', () => {
  const self = fs.readFileSync(__filename, 'utf-8');
  assert.ok(!self.includes('require(\'../../functions/api/scout/live-rate-limit-storage-adapter.js\')'), 'contract test must not require ESM runtime module');
  assert.ok(!self.includes('await import('), 'contract test must not dynamically import runtime module');
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
