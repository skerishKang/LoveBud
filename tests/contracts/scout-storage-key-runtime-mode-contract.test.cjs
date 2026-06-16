/**
 * Scout Storage Key Runtime Mode Contract Tests
 * v20260616-runtime-mode-1
 *
 * Locks disabled-by-default behavior for the Scout live rate-limit storage
 * key builder AND the new opt-in runtime mode (STORAGE_RUNTIME). The runtime
 * mode generates deterministic, bounded, sanitized storage keys from
 * pre-derived safe inputs only. Default behavior remains disabled. No
 * live storage, no KV/DO/D1, no provider SDK, no network, no env/secrets,
 * no schema change, no frontend change.
 *
 * Slice issue: #2573
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MODULE_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-key-builder.js',
);
const STORAGE_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-adapter.js',
);
const STORAGE_HASH_HELPER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-hash-helper.js',
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

const moduleSource = readFile(MODULE_PATH);
const moduleCode = codeOnly(moduleSource);
const storageAdapterSource = readFile(STORAGE_ADAPTER_PATH);
const storageAdapterCode = codeOnly(storageAdapterSource);
const storageHashHelperSource = readFile(STORAGE_HASH_HELPER_PATH);
const suggest = readFile(SUGGEST_PATH);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

// Dynamically import the ESM module for behavior tests
let mod = null;
async function loadModule() {
  if (!mod) {
    mod = await import(
      'file://' + MODULE_PATH.replace(/\\/g, '/')
    );
  }
  return mod;
}

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── Slice identity & exports ──────────────────────────────────────────────

push('Module version and slice identity are present', () => {
  assert.ok(
    moduleSource.includes(
      "SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION = '20260616-runtime-mode-1'",
    ),
    'module must declare version 20260616-runtime-mode-1',
  );
  assert.ok(
    moduleSource.includes('Slice issue: #2573') ||
      moduleSource.includes('#2573'),
    'module docstring must reference slice issue #2573',
  );
  assert.ok(
    moduleSource.includes('#1882'),
    'module docstring must reference parent umbrella #1882',
  );
});

push('Module exports runtime mode surface', () => {
  for (const exported of [
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_RUNTIME_KINDS',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS',
    'SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS',
    'sanitizeScoutLiveRateLimitStorageKeyPayload',
    'buildScoutLiveRateLimitStorageKey',
    'buildScoutLiveRateLimitStorageKeyInRuntimeMode',
    'createScoutLiveRateLimitStorageKeyBuilder',
  ]) {
    assert.ok(
      moduleSource.includes('export const ' + exported) ||
        moduleSource.includes('export function ' + exported),
      `missing export ${exported}`,
    );
  }
});

push('Runtime mode constant values are locked', () => {
  assert.ok(
    moduleSource.includes("RUNTIME: 'runtime'"),
    'RUNTIME mode value must be string "runtime"',
  );
  assert.ok(
    moduleSource.includes("STORAGE_KEY_BUILT: 'STORAGE_KEY_BUILT'"),
    'STORAGE_KEY_BUILT code must be present',
  );
  for (const kind of [
    "USER_KEY_HASH: 'userKeyHash'",
    "IP_HASH: 'ipHash'",
    "SESSION_KEY_HASH: 'sessionKeyHash'",
    "COMPOSITE: 'composite'",
  ]) {
    assert.ok(moduleSource.includes(kind), `runtime kind missing: ${kind}`);
  }
});

// ─── Default disabled behavior (regression lock) ───────────────────────────

push('buildScoutLiveRateLimitStorageKey default returns disabled (not runtime)', async () => {
  const m = await loadModule();
  const result = m.buildScoutLiveRateLimitStorageKey({
    userKeyHash: 'h1',
    limitName: 'rl',
    windowKey: 'w1',
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.disabled, true);
  assert.strictEqual(result.storageKey, null);
  assert.strictEqual(
    result.code,
    'STORAGE_KEY_BUILDER_DISABLED',
  );
});

push('Factory default is disabled; runtime mode is never auto-enabled', async () => {
  const m = await loadModule();
  const builder = m.createScoutLiveRateLimitStorageKeyBuilder();
  assert.strictEqual(builder.mode, 'disabled');
  assert.strictEqual(builder.disabled, true);
  // Factory must expose buildKeyInRuntimeMode but it must be opt-in only.
  assert.strictEqual(
    typeof builder.buildKeyInRuntimeMode,
    'function',
  );
  const autoRuntime = builder.buildKeyInRuntimeMode({
    userKeyHash: 'h1',
    limitName: 'rl',
    windowKey: 'w1',
  });
  assert.strictEqual(
    autoRuntime.ok,
    false,
    'runtime mode must not auto-enable without explicit { runtime: true }',
  );
  assert.strictEqual(autoRuntime.storageKey, null);
});

// ─── Explicit runtime mode: success ────────────────────────────────────────

push('Runtime mode with explicit opt-in returns STORAGE_KEY_BUILT', async () => {
  const m = await loadModule();
  const result = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: 'u-1',
      limitName: 'rl1',
      windowKey: 'w-2026-06-16',
      endpointPath: '/api/scout/suggest',
      providerMode: 'stub',
    },
    { runtime: true, disabled: false, kind: 'composite' },
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.code, 'STORAGE_KEY_BUILT');
  assert.ok(
    typeof result.storageKey === 'string' && result.storageKey.length > 0,
  );
  assert.ok(
    result.storageKey.startsWith('scout:rl:v1:'),
    'storageKey must use scout:rl:v1 namespace',
  );
  assert.ok(
    result.mode === 'runtime',
    'mode must be "runtime" when runtime opt-in succeeds',
  );
});

push('Runtime mode is deterministic: same inputs → same key', async () => {
  const m = await loadModule();
  const payload = {
    userKeyHash: 'u-2',
    limitName: 'rl2',
    windowKey: 'w-fixed',
    endpointPath: '/api/scout/suggest',
    providerMode: 'stub',
  };
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(payload, opts);
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(payload, opts);
  const c = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(payload, opts);
  assert.strictEqual(a.storageKey, b.storageKey);
  assert.strictEqual(b.storageKey, c.storageKey);
  assert.strictEqual(a.code, 'STORAGE_KEY_BUILT');
});

push('Distinct userKeyHash produces distinct keys', async () => {
  const m = await loadModule();
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u-A', limitName: 'rl', windowKey: 'w' },
    opts,
  );
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u-B', limitName: 'rl', windowKey: 'w' },
    opts,
  );
  assert.notStrictEqual(a.storageKey, b.storageKey);
});

push('Distinct limitName produces distinct keys', async () => {
  const m = await loadModule();
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u', limitName: 'rl-A', windowKey: 'w' },
    opts,
  );
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u', limitName: 'rl-B', windowKey: 'w' },
    opts,
  );
  assert.notStrictEqual(a.storageKey, b.storageKey);
});

push('Distinct windowKey produces distinct keys', async () => {
  const m = await loadModule();
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u', limitName: 'rl', windowKey: 'w-1' },
    opts,
  );
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u', limitName: 'rl', windowKey: 'w-2' },
    opts,
  );
  assert.notStrictEqual(a.storageKey, b.storageKey);
});

push('Distinct providerMode produces distinct keys', async () => {
  const m = await loadModule();
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: 'u',
      limitName: 'rl',
      windowKey: 'w',
      providerMode: 'stub',
    },
    opts,
  );
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: 'u',
      limitName: 'rl',
      windowKey: 'w',
      providerMode: 'real',
    },
    opts,
  );
  assert.notStrictEqual(a.storageKey, b.storageKey);
});

push('Distinct endpointPath produces distinct keys', async () => {
  const m = await loadModule();
  const opts = { runtime: true, disabled: false, kind: 'composite' };
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: 'u',
      limitName: 'rl',
      windowKey: 'w',
      endpointPath: '/api/scout/suggest',
    },
    opts,
  );
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: 'u',
      limitName: 'rl',
      windowKey: 'w',
      endpointPath: '/api/scout/another',
    },
    opts,
  );
  assert.notStrictEqual(a.storageKey, b.storageKey);
});

// ─── Per-kind contracts ────────────────────────────────────────────────────

push('userKeyHash kind builds key only from userKeyHash input', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u-1' },
    { runtime: true, disabled: false, kind: 'userKeyHash' },
  );
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.code, 'STORAGE_KEY_BUILT');
  assert.ok(r.storageKey.includes(':userKeyHash:'));
});

push('ipHash kind builds key only from ipHash input', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { ipHash: 'ip-1' },
    { runtime: true, disabled: false, kind: 'ipHash' },
  );
  assert.strictEqual(r.ok, true);
  assert.ok(r.storageKey.includes(':ipHash:'));
});

push('sessionKeyHash kind builds key only from sessionKeyHash input', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { sessionKeyHash: 's-1' },
    { runtime: true, disabled: false, kind: 'sessionKeyHash' },
  );
  assert.strictEqual(r.ok, true);
  assert.ok(r.storageKey.includes(':sessionKeyHash:'));
});

push('userKeyHash kind safe-fails without userKeyHash', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { limitName: 'rl', windowKey: 'w' },
    { runtime: true, disabled: false, kind: 'userKeyHash' },
  );
  assert.strictEqual(r.ok, false);
  assert.strictEqual(
    r.code,
    'STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING',
  );
  assert.strictEqual(r.storageKey, null);
});

push('ipHash kind safe-fails without ipHash', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u' },
    { runtime: true, disabled: false, kind: 'ipHash' },
  );
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING');
});

push('sessionKeyHash kind safe-fails without sessionKeyHash', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u' },
    { runtime: true, disabled: false, kind: 'sessionKeyHash' },
  );
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING');
});

push('Unknown runtime kind safe-fails with dedicated code', async () => {
  const m = await loadModule();
  const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u' },
    { runtime: true, disabled: false, kind: 'nonsense_kind' },
  );
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'STORAGE_KEY_BUILDER_RUNTIME_KIND_UNKNOWN');
  assert.strictEqual(r.storageKey, null);
});

// ─── Prohibited raw fields safe-fail (contract lock) ───────────────────────

push('Prohibited raw fields safe-fail with PROHIBITED code in runtime mode', async () => {
  const m = await loadModule();
  const prohibitedSamples = [
    { token: 'tk-1' },
    { authorization: 'Bearer x' },
    { uid: 'u-raw' },
    { email: 'a@b.c' },
    { apiKey: 'ak' },
    { prompt: 'p' },
    { cookie: 'sid' },
    { sourceUrl: 'https://x' },
  ];
  for (const payload of prohibitedSamples) {
    const r = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
      payload,
      { runtime: true, disabled: false, kind: 'composite' },
    );
    assert.strictEqual(
      r.ok,
      false,
      `prohibited payload must safe-fail: ${JSON.stringify(payload)}`,
    );
    assert.strictEqual(r.code, 'STORAGE_KEY_PAYLOAD_PROHIBITED');
    assert.strictEqual(r.storageKey, null);
    assert.ok(
      Array.isArray(r.rejectedFields) && r.rejectedFields.length > 0,
    );
  }
});

// ─── Disabled-by-default guarantees ────────────────────────────────────────

push('Runtime mode rejects calls without { runtime: true }', async () => {
  const m = await loadModule();
  // No opts at all
  const a = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode({
    userKeyHash: 'u',
  });
  assert.strictEqual(a.ok, false);
  assert.strictEqual(a.code, 'STORAGE_KEY_BUILDER_RUNTIME_DISABLED');
  assert.strictEqual(a.storageKey, null);
  // Explicit { runtime: false }
  const b = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u' },
    { runtime: false },
  );
  assert.strictEqual(b.ok, false);
  assert.strictEqual(b.code, 'STORAGE_KEY_BUILDER_RUNTIME_DISABLED');
  // Explicit { disabled: true, runtime: true } — disabled wins
  const c = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    { userKeyHash: 'u' },
    { runtime: true, disabled: true },
  );
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.code, 'STORAGE_KEY_BUILDER_RUNTIME_DISABLED');
});

// ─── Bounded key length ────────────────────────────────────────────────────

push('Runtime storage key is bounded to 200 chars', async () => {
  const m = await loadModule();
  // Use very long inputs to stress the bound.
  const longStr = 'a'.repeat(500);
  const result = m.buildScoutLiveRateLimitStorageKeyInRuntimeMode(
    {
      userKeyHash: longStr,
      ipHash: longStr,
      sessionKeyHash: longStr,
      endpointPath: '/' + longStr,
      providerMode: longStr,
      limitName: longStr,
      windowKey: longStr,
    },
    { runtime: true, disabled: false, kind: 'composite' },
  );
  assert.strictEqual(result.ok, true);
  assert.ok(
    result.storageKey.length <= 200,
    `storageKey must be <= 200 chars, got ${result.storageKey.length}`,
  );
});

// ─── Forbidden surfaces (no live storage / no env / no SDK) ────────────────

push('Module forbids live storage, secrets, network, provider SDKs, and crypto APIs', () => {
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
    'process.env.',
    'STAGING_LIVE',
    'PRODUCTION_LIVE',
    'staging_live',
    'production_live',
  ]) {
    assert.ok(
      !moduleCode.includes(forbidden),
      `module must not include ${forbidden}`,
    );
  }
});

push('No live storage adapter wiring in this slice', () => {
  // The key builder module must not import the storage adapter. It only
  // returns a key string; it does not call into KV/DO/D1 or storage.
  assert.ok(
    !moduleSource.includes("from './live-rate-limit-storage-adapter'"),
    'module must not import storage adapter',
  );
  assert.ok(
    !moduleSource.includes("require('./live-rate-limit-storage-adapter')"),
    'module must not require storage adapter',
  );
  assert.ok(
    !moduleSource.includes("from './live-rate-limit-storage-hash-helper'"),
    'module must not import storage hash helper',
  );
});

// ─── Downstream surfaces must remain at their safe defaults ────────────────

push('Storage adapter default remains mock-disabled', () => {
  // The existing storage adapter (unchanged by this slice) must still be
  // mock-disabled by default. We assert its default mode is mock_disabled.
  assert.ok(
    storageAdapterSource.includes('mock_disabled') ||
      storageAdapterSource.includes('MOCK_DISABLED'),
    'storage adapter must retain mock_disabled default',
  );
});

push('suggest.js default provider mode remains STUB', () => {
  assert.ok(
    suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'),
    'suggest.js must retain STUB mode',
  );
});

push('Frontend source selector default remains local_stub', () => {
  assert.ok(
    sourceSelector.includes('local_stub'),
    'frontend source selector must retain local_stub default',
  );
});

push('Endpoint client remains disabled by default', () => {
  assert.ok(
    endpointClient.includes('Disabled by default'),
    'endpoint client must remain disabled by default',
  );
});

push('Storage hash helper file unchanged and present (no live wiring)', () => {
  // Sanity: the hash helper file should exist and not include any new
  // runtime-mode entry point added by this slice.
  assert.ok(
    storageHashHelperSource.length > 0,
    'storage hash helper file must exist',
  );
  assert.ok(
    !storageHashHelperSource.includes(
      'buildScoutLiveRateLimitStorageKeyInRuntimeMode',
    ),
    'storage hash helper must not define runtime mode entry point',
  );
});

// ─── Parent issue guard (no auto-close of #1882) ──────────────────────────

push('Module docstring explicitly notes #1882 must remain OPEN', () => {
  assert.ok(
    moduleSource.includes('Parent issue: #1882'),
    'module docstring must declare parent issue #1882',
  );
  assert.ok(
    moduleSource.includes('must remain OPEN') ||
      moduleSource.includes('never auto-close') ||
      moduleSource.includes('Keeps #1882 open'),
    'module docstring must warn against auto-closing #1882',
  );
});

// ─── Run ───────────────────────────────────────────────────────────────────

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
