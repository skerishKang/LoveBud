/**
 * Scout Storage Adapter Runtime Key Output Contract Tests
 * v20260616-runtime-output-1
 *
 * Locks slice #2575 behavior: storage adapter binds its non-default
 * runtime scaffold path to the key builder runtime output. Default
 * mock_disabled path remains disabled and never calls the runtime key
 * builder. STORAGE_KEY_BUILT is propagated only as sanitized scaffold
 * metadata — never as a quota allow decision. No real KV / Durable
 * Object / D1 / DB / fetch / provider / frontend live behavior.
 *
 * Slice issue: #2575
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-adapter.js',
);
const KEY_BUILDER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-key-builder.js',
);
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-source-selector.js',
);
const ENDPOINT_CLIENT_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-endpoint-client.js',
);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const adapterSource = readFile(ADAPTER_PATH);
const adapterCode = codeOnly(adapterSource);
const keyBuilderSource = readFile(KEY_BUILDER_PATH);
const suggest = readFile(SUGGEST_PATH);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

// Dynamically import both ESM modules for behavior tests
let adapter = null;
let keyBuilder = null;
async function loadModules() {
  if (!adapter) {
    adapter = await import('file://' + ADAPTER_PATH.replace(/\\/g, '/'));
  }
  if (!keyBuilder) {
    keyBuilder = await import(
      'file://' + KEY_BUILDER_PATH.replace(/\\/g, '/')
    );
  }
  return { adapter, keyBuilder };
}

const PROHIBITED_RAW_FIELDS = [
  'token',
  'rawToken',
  'authorization',
  'authorizationHeader',
  'rawUserId',
  'uid',
  'firebaseUid',
  'email',
  'phone',
  'apiKey',
  'secret',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
  'password',
  'cookie',
  'sessionCookie',
  'firebaseToken',
  'openaiApiKey',
  'anthropicApiKey',
  'geminiApiKey',
];

function collectKeys(obj, acc, seen) {
  acc = acc || new Set();
  seen = seen || new WeakSet();
  if (obj === null || typeof obj !== 'object' || seen.has(obj)) return acc;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) collectKeys(obj[i], acc, seen);
  } else {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      acc.add(keys[i]);
      collectKeys(obj[keys[i]], acc, seen);
    }
  }
  return acc;
}

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── Slice identity & exports ──────────────────────────────────────────────

push('Adapter version and slice identity are present', () => {
  assert.ok(
    adapterSource.includes(
      "SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = '20260616-runtime-output-1'",
    ),
    'adapter must declare version 20260616-runtime-output-1',
  );
  assert.ok(
    adapterSource.includes('Slice issue: #2575'),
    'adapter docstring must reference slice issue #2575',
  );
  assert.ok(
    adapterSource.includes('#1882'),
    'adapter docstring must reference parent umbrella #1882',
  );
  assert.ok(
    adapterSource.includes('must remain OPEN') ||
      adapterSource.includes('never auto-close') ||
      adapterSource.includes('No closing of #1882'),
    'adapter docstring must warn against auto-closing #1882',
  );
});

push('Adapter exposes runtime key output surface', () => {
  for (const exported of [
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES',
    'sanitizeScoutLiveRateLimitStoragePayload',
    'createScoutLiveRateLimitStorageAdapter',
  ]) {
    assert.ok(
      adapterSource.includes('export const ' + exported) ||
        adapterSource.includes('export function ' + exported),
      `missing export ${exported}`,
    );
  }
  assert.ok(
    adapterSource.includes('useRuntimeKeyBuilder'),
    'adapter must expose useRuntimeKeyBuilder flag',
  );
});

// ─── Default behavior (regression lock) ────────────────────────────────────

push('Default adapter remains mock_disabled', async () => {
  const { adapter: A } = await loadModules();
  const def = A.createScoutLiveRateLimitStorageAdapter();
  assert.strictEqual(
    def.mode,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED,
  );
  assert.strictEqual(def.mockDisabled, true);
  assert.strictEqual(def.isMockDisabled, true);
  assert.strictEqual(def.isRuntimeScaffold, false);
  assert.strictEqual(def.hasStorageKeyBuilder, false);
  // useRuntimeKeyBuilder is only present on the runtime scaffold path.
  // For the default mock_disabled adapter, the field is absent.
  assert.ok(
    def.useRuntimeKeyBuilder === undefined ||
      def.useRuntimeKeyBuilder === false,
    'default mock_disabled adapter must not enable useRuntimeKeyBuilder',
  );
});

push('Default adapter does NOT call key builder at all', async () => {
  const { adapter: A } = await loadModules();
  const def = A.createScoutLiveRateLimitStorageAdapter();
  const r = await def.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
  );
  assert.ok(
    !('storageKeyBuilder' in r) || r.storageKeyBuilder === undefined,
    'default mock_disabled response must not include storageKeyBuilder metadata',
  );
  assert.strictEqual(r.storageKey, undefined);
  assert.strictEqual(r.keyPreview, undefined);
});

push('Default adapter consumeQuota and releaseQuota are also mock_disabled', async () => {
  const { adapter: A } = await loadModules();
  const def = A.createScoutLiveRateLimitStorageAdapter();
  const c = await def.consumeQuota({ userKeyHash: 'u', limitName: 'rl' });
  assert.strictEqual(c.allowed, false);
  assert.strictEqual(
    c.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
  );
  const rel = await def.releaseQuota({ userKeyHash: 'u', limitName: 'rl' });
  assert.strictEqual(rel.released, false);
  assert.strictEqual(
    rel.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
  );
});

// ─── Explicit scaffold path WITHOUT runtimeKey: disabled scaffold ─────────

push('Explicit scaffold path with default runtimeKey=false uses disabled buildKey', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
  });
  assert.strictEqual(scaffold.isRuntimeScaffold, true);
  assert.strictEqual(scaffold.hasStorageKeyBuilder, true);
  assert.strictEqual(scaffold.useRuntimeKeyBuilder, false);
  const r = await scaffold.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.storageKeyBuilder.ok, false);
  assert.strictEqual(r.storageKeyBuilder.storageKey, null);
  assert.strictEqual(r.storageKeyBuilder.keyPreview, null);
  // Without runtimeKey: true, the disabled buildKey() path is used, which
  // returns STORAGE_KEY_BUILDER_DISABLED. The adapter's normalized result
  // is preserved as disabled.
  const allowedCodes = [
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES &&
      A.SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILDER_DISABLED,
    'STORAGE_KEY_BUILDER_DISABLED',
  ].filter(Boolean);
  assert.ok(
    allowedCodes.includes(r.storageKeyBuilder.code),
    `unexpected code: ${r.storageKeyBuilder.code}`,
  );
});

// ─── Explicit scaffold path WITH runtimeKey: true → STORAGE_KEY_BUILT ─────

push('Explicit scaffold path with runtimeKey=true calls buildKeyInRuntimeMode and propagates STORAGE_KEY_BUILT', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
  });
  assert.strictEqual(scaffold.useRuntimeKeyBuilder, true);
  const r = await scaffold.checkQuota({
    userKeyHash: 'u-built',
    limitName: 'rl-built',
    windowKey: 'w-built',
    endpointPath: '/api/scout/suggest',
    providerMode: 'stub',
  });
  assert.strictEqual(
    r.allowed,
    false,
    'scaffold result must NOT be treated as quota allow',
  );
  assert.strictEqual(r.storageKeyBuilder.ok, true);
  assert.strictEqual(r.storageKeyBuilder.code, 'STORAGE_KEY_BUILT');
  assert.strictEqual(r.storageKeyBuilder.disabled, false);
  assert.ok(
    typeof r.storageKeyBuilder.storageKey === 'string' &&
      r.storageKeyBuilder.storageKey.length > 0,
  );
  assert.ok(
    r.storageKeyBuilder.storageKey.startsWith('scout:rl:v1:'),
  );
  assert.ok(
    typeof r.storageKeyBuilder.keyPreview === 'string' &&
      r.storageKeyBuilder.keyPreview.length > 0,
  );
});

push('STORAGE_KEY_BUILT response does NOT change allowed to true (scaffold, not quota)', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'durable_object',
    runtimeKey: true,
  });
  const r = await scaffold.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });
  assert.strictEqual(
    r.allowed,
    false,
    'runtime key output must not be quota allow',
  );
  // Top-level code is the scaffold code, not STORAGE_KEY_BUILT
  assert.strictEqual(
    r.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED,
  );
  // key builder metadata preserves the actual key code
  assert.strictEqual(r.storageKeyBuilder.code, 'STORAGE_KEY_BUILT');
});

push('consumeQuota with runtimeKey=true also propagates STORAGE_KEY_BUILT', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
  });
  const r = await scaffold.consumeQuota({
    userKeyHash: 'u-c',
    limitName: 'rl-c',
    windowKey: 'w-c',
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.storageKeyBuilder.ok, true);
  assert.strictEqual(r.storageKeyBuilder.code, 'STORAGE_KEY_BUILT');
  assert.ok(r.storageKeyBuilder.storageKey.startsWith('scout:rl:v1:'));
});

push('releaseQuota with runtimeKey=true also propagates STORAGE_KEY_BUILT', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
  });
  const r = await scaffold.releaseQuota({
    userKeyHash: 'u-r',
    limitName: 'rl-r',
    windowKey: 'w-r',
  });
  assert.strictEqual(
    r.released,
    false,
    'release must not claim quota released',
  );
  assert.strictEqual(r.storageKeyBuilder.ok, true);
  assert.strictEqual(r.storageKeyBuilder.code, 'STORAGE_KEY_BUILT');
  assert.ok(r.storageKeyBuilder.storageKey.startsWith('scout:rl:v1:'));
});

// ─── Sensitive field safety ────────────────────────────────────────────────

push('Response contains no raw sensitive fields as keys in any nested object', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
  });
  const r = await scaffold.checkQuota({
    userKeyHash: 'safe-u-1',
    ipHash: 'safe-ip-1',
    sessionKeyHash: 'safe-s-1',
    endpointPath: '/api/scout/suggest',
    providerMode: 'stub',
    limitName: 'rl-1',
    windowKey: 'w-1',
  });
  const allKeys = collectKeys(r);
  for (let i = 0; i < PROHIBITED_RAW_FIELDS.length; i++) {
    const prohibited = PROHIBITED_RAW_FIELDS[i];
    assert.ok(
      !allKeys.has(prohibited),
      `response must not expose key "${prohibited}"`,
    );
  }
});

// ─── Safe-fail paths ───────────────────────────────────────────────────────

push('Prohibited raw fields in payload safe-fail in runtime scaffold', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
    onProhibitedField: 'reject',
  });
  const r = await scaffold.checkQuota({
    userKeyHash: 'u',
    token: 'tk-leak',
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.storageKeyBuilder.code,
    'STORAGE_KEY_PAYLOAD_PROHIBITED',
  );
  assert.strictEqual(r.storageKeyBuilder.ok, false);
  assert.strictEqual(r.storageKeyBuilder.storageKey, null);
  assert.ok(
    Array.isArray(r.storageKeyBuilder.rejectedFields) &&
      r.storageKeyBuilder.rejectedFields.indexOf('token') !== -1,
  );
});

push('Missing userKeyHash with kind=userKeyHash safe-fails as RUNTIME_PAYLOAD_MISSING', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
    runtimeKeyKind: 'userKeyHash',
  });
  const r = await scaffold.checkQuota({ limitName: 'rl', windowKey: 'w' });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.storageKeyBuilder.code,
    'STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING',
  );
  assert.strictEqual(r.storageKeyBuilder.ok, false);
  assert.strictEqual(r.storageKeyBuilder.storageKey, null);
});

// ─── Default-downstream safety ─────────────────────────────────────────────

push('suggest.js default provider mode remains STUB', () => {
  assert.ok(
    suggest.indexOf('SCOUT_SUGGEST_PROVIDER_MODES.STUB') !== -1,
    'suggest.js must retain STUB mode',
  );
});

push('Frontend source selector default remains local_stub', () => {
  assert.ok(
    sourceSelector.indexOf('local_stub') !== -1,
    'frontend source selector must retain local_stub default',
  );
});

push('Endpoint client remains disabled by default', () => {
  assert.ok(
    endpointClient.indexOf('Disabled by default') !== -1,
    'endpoint client must remain disabled by default',
  );
});

// ─── Forbidden surfaces ────────────────────────────────────────────────────

push('Adapter module forbids live storage, secrets, network, provider SDKs, and crypto APIs', () => {
  const FORBIDDEN = [
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
    'fetch(',
    'axios',
    'openai.chat.completions',
    'anthropic.messages',
    'generateContent',
    'process.env.',
    'STAGING_LIVE',
    'PRODUCTION_LIVE',
    'staging_live',
    'production_live',
  ];
  for (let i = 0; i < FORBIDDEN.length; i++) {
    const forbidden = FORBIDDEN[i];
    assert.ok(
      adapterCode.indexOf(forbidden) === -1,
      `adapter must not include ${forbidden}`,
    );
  }
});

push('Adapter does not import or wire suggest.js / live provider endpoint / live firebase', () => {
  assert.ok(
    adapterSource.indexOf("from './suggest") === -1,
    'adapter must not import suggest.js',
  );
  assert.ok(
    adapterSource.indexOf("require('./suggest") === -1,
    'adapter must not require suggest.js',
  );
  assert.ok(
    adapterSource.indexOf('createScoutFirebaseAuthVerifier') === -1,
    'adapter must not wire firebase auth verifier',
  );
  assert.ok(
    adapterSource.indexOf('SCOUT_FIREBASE_AUTH_VERIFIER') === -1,
    'adapter must not reference firebase auth verifier',
  );
});

// ─── Key builder factory surfaces (used by adapter) ────────────────────────

push('Key builder factory exposes runtime mode when { runtime: true } is passed', async () => {
  const { keyBuilder: K } = await loadModules();
  const builder = K.createScoutLiveRateLimitStorageKeyBuilder({
    disabled: false,
    runtime: true,
  });
  assert.strictEqual(builder.mode, 'runtime');
  assert.strictEqual(builder.disabled, false);
  assert.strictEqual(typeof builder.buildKeyInRuntimeMode, 'function');
  const r = builder.buildKeyInRuntimeMode(
    { userKeyHash: 'u-1', limitName: 'rl', windowKey: 'w' },
    { runtime: true },
  );
  assert.strictEqual(r.code, 'STORAGE_KEY_BUILT');
});

push('Key builder factory default still disabled (regression lock)', async () => {
  const { keyBuilder: K } = await loadModules();
  const def = K.createScoutLiveRateLimitStorageKeyBuilder();
  assert.strictEqual(def.mode, 'disabled');
  assert.strictEqual(def.disabled, true);
});

// ─── Run ───────────────────────────────────────────────────────────────────

(async () => {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
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
