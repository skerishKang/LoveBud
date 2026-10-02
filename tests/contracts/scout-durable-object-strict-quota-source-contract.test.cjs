/**
 * Scout Durable Object Strict Quota Source Contract Tests
 * v20261002-slice-b-1
 *
 * Issue #4536 Slice B — locks the Durable Object strict per-key quota SOURCE.
 * SOURCE ONLY / NOT RUNTIME-ACTIVATED.
 *
 * Proves:
 *  1. the DO adapter and the DO quota backend are default disabled /
 *     unavailable without an injected namespace or Durable-Object-shaped
 *     state, and `backend`-only DI (stub -> backend -> namespace) works;
 *  2. an injected fake namespace resolves only an existing sanitized runtime
 *     key produced by the canonical key builder;
 *  3. no raw UID / token / email / claims / IP / session / prompt / source
 *     data reaches the namespace, DO state, adapter output, or observer
 *     metadata;
 *  4. strict limit N admits exactly N and denies N+1 with positive bounded
 *     retry information;
 *  5. concurrent/adversarial admissions never exceed N;
 *  6. window rollover resets the counter;
 *  7. corrupt/missing/untrusted persisted state safe-fails, and only the
 *     explicit first-use contract initializes a fresh window;
 *  8. storage throw / binding failure -> unavailable, never allow;
 *  9. allowed/limited outputs carry only the safe bounded result shape;
 * 10. the CURRENT dependency mapper still maps the DO result codes to
 *     RATE_LIMIT_STORAGE_UNAVAILABLE (Slice C mapping is absent);
 * 11. the current endpoint fails closed at the transitional
 *     429 / RATE_LIMITED taxonomy with provider and Engine transport call
 *     count 0 (the mapper still reports RATE_LIMIT_STORAGE_UNAVAILABLE; the
 *     503-vs-429 taxonomy gap is a pre-existing boundary issue owned by
 *     Slice C);
 * 12. frontend `local_stub`, Engine gate/default, the Production provider
 *     stage block, the Slice A gate default, and the current suggest.js
 *     composition remain unchanged;
 * 13. checked-in `wrangler.toml` has no DO binding / migration / runtime
 *     activation, and the new modules never read env bindings.
 *
 * Synthetic local fixtures only. No Cloudflare resource, DO namespace,
 * migration, KV, D1, secret, deployment, provider, Engine, or external
 * network call.
 */

'use strict';

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DO_BACKEND_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-durable-object-quota-backend.js');
const DO_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-durable-object-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const KEY_BUILDER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const WRANGLER_PATH = path.join(ROOT, 'wrangler.toml');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-durable-object-quota-source.md');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const doBackendCode = readFileSafe(DO_BACKEND_PATH);
const doAdapterCode = readFileSafe(DO_ADAPTER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const wranglerCode = readFileSafe(WRANGLER_PATH);

let doBackendModulePromise = null;
function loadDoBackend() {
  if (!doBackendModulePromise) doBackendModulePromise = importAbsolute(DO_BACKEND_PATH);
  return doBackendModulePromise;
}

let doAdapterModulePromise = null;
function loadDoAdapter() {
  if (!doAdapterModulePromise) doAdapterModulePromise = importAbsolute(DO_ADAPTER_PATH);
  return doAdapterModulePromise;
}

let depAdapterModulePromise = null;
function loadDepAdapter() {
  if (!depAdapterModulePromise) depAdapterModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  return depAdapterModulePromise;
}

let keyBuilderModulePromise = null;
function loadKeyBuilder() {
  if (!keyBuilderModulePromise) keyBuilderModulePromise = importAbsolute(KEY_BUILDER_PATH);
  return keyBuilderModulePromise;
}

let suggestModulePromise = null;
function loadSuggest() {
  if (!suggestModulePromise) suggestModulePromise = importAbsolute(SUGGEST_PATH);
  return suggestModulePromise;
}

// ─── Synthetic in-memory Durable Object fakes ──────────────────────────────

const SYNTHETIC_USER_KEY_HASH = 'c'.repeat(16);
const SYNTHETIC_IP_HASH = 'd'.repeat(16);
const SENSITIVE_MARKERS = [
  'synthetic-raw-uid-4536',
  'synthetic-raw-email-4536@example.invalid',
  'Bearer synthetic-raw-token-4536',
  'synthetic-raw-token-4536',
  'synthetic-raw-claims-subject-4536',
  '203.0.113.4536',
  'synthetic-session-cookie-4536',
  'synthetic-prompt-body-4536',
  'synthetic-source-url-4536',
  'synthetic-api-key-4536',
];

function createSyntheticStorage(options = {}) {
  const store = new Map();
  return {
    store,
    getCalls: 0,
    putCalls: 0,
    async get(key) {
      this.getCalls += 1;
      if (options.throwOnGet) throw new Error('synthetic durable-object storage failure');
      return store.has(key) ? store.get(key) : undefined;
    },
    async put(key, value) {
      this.putCalls += 1;
      if (options.throwOnPut) throw new Error('synthetic durable-object storage failure');
      store.set(key, value);
    },
  };
}

function createRecordingNamespace(backend) {
  const names = [];
  return {
    names,
    idFromName(name) {
      names.push(name);
      return { name };
    },
    get() {
      return { admit: (request) => backend.admit(request) };
    },
  };
}

function buildQuotaPayload(overrides = {}) {
  return Object.assign({
    userKeyHash: SYNTHETIC_USER_KEY_HASH,
    windowKey: 'live:2026-10-02T10',
    limitName: 'scout_live_per_minute',
    endpointPath: '/api/scout/suggest',
    providerMode: 'live',
  }, overrides);
}

function buildAdmissionRequest(overrides = {}) {
  return Object.assign({
    key: 'scout:rl:v1:composite:0123456789abcdef',
    windowKey: 'live:2026-10-02T10',
    limit: 3,
    windowMs: 60000,
    nowMs: 1000,
  }, overrides);
}

function buildSensitivePayload(overrides = {}) {
  return Object.assign(buildQuotaPayload(), {
    uid: SENSITIVE_MARKERS[0],
    email: SENSITIVE_MARKERS[1],
    token: SENSITIVE_MARKERS[2],
    claims: SENSITIVE_MARKERS[4],
    prompt: SENSITIVE_MARKERS[7],
    sourceUrl: SENSITIVE_MARKERS[8],
    apiKey: SENSITIVE_MARKERS[9],
  }, overrides);
}

function countMarkers(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hits = 0;
  for (const marker of SENSITIVE_MARKERS) {
    if (text.includes(marker)) hits += 1;
  }
  return hits;
}

async function buildInjectedAdapter(overrides = {}) {
  const backendMod = await loadDoBackend();
  const adapterMod = await loadDoAdapter();
  const storage = overrides.storage || createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const namespace = createRecordingNamespace(quota);
  const adapter = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter(Object.assign({
    disabled: false,
    namespace,
    limit: 3,
    windowMs: 60000,
    now: () => 1000,
  }, overrides.adapterOptions || {}));
  return { adapter, backendMod, adapterMod, quota, storage, namespace };
}

function createMockRequest(options = {}) {
  const headers = new Map();
  headers.set('content-type', 'application/json');
  for (const [key, value] of Object.entries(options.headers || {})) {
    headers.set(key.toLowerCase(), value);
  }
  return {
    method: options.method || 'POST',
    headers: { get: (name) => headers.get(String(name).toLowerCase()) || null },
    text: async () => JSON.stringify(options.body || {}),
  };
}

// ─── 1. Default disabled / unavailable ─────────────────────────────────────

test('DO adapter and DO quota backend are default disabled/unavailable without injected dependencies', async () => {
  const backendMod = await loadDoBackend();
  const adapterMod = await loadDoAdapter();

  const defaultAdapter = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter();
  assert.strictEqual(defaultAdapter.mode, adapterMod.SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.DISABLED);
  const disabledResult = await defaultAdapter.checkQuota(buildQuotaPayload());
  assert.strictEqual(disabledResult.allowed, false);
  assert.strictEqual(disabledResult.code, 'DO_QUOTA_BACKEND_DISABLED');
  assert.strictEqual(disabledResult.remaining, null);
  assert.strictEqual(disabledResult.retryAfterSeconds, null);
  assert.strictEqual(disabledResult.windowKey, null);

  const disabledConsume = await defaultAdapter.consumeQuota(buildQuotaPayload());
  assert.strictEqual(disabledConsume.allowed, false);
  assert.strictEqual(disabledConsume.code, 'DO_QUOTA_BACKEND_DISABLED');

  // Explicitly disabled even when a namespace IS injected.
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const explicitlyDisabled = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: true,
    namespace: createRecordingNamespace(quota),
    limit: 3,
    windowMs: 60000,
  });
  const explicitlyDisabledResult = await explicitlyDisabled.checkQuota(buildQuotaPayload());
  assert.strictEqual(explicitlyDisabledResult.allowed, false);
  assert.strictEqual(explicitlyDisabledResult.code, 'DO_QUOTA_BACKEND_DISABLED');
  assert.strictEqual(storage.getCalls, 0, 'a disabled adapter must never touch durable-object storage');

  // Backend without injected Durable-Object-shaped state.
  const statelessBackend = backendMod.createScoutRateLimitDurableObjectQuotaBackend({});
  assert.strictEqual(statelessBackend.hasStorage, false);
  const statelessResult = await statelessBackend.admit(buildAdmissionRequest());
  assert.strictEqual(statelessResult.allowed, false);
  assert.strictEqual(statelessResult.code, 'DO_QUOTA_BACKEND_UNAVAILABLE');
});

test('DO adapter has no release/refund seam (strict atomic quota must not be undone client-side)', async () => {
  const adapterMod = await loadDoAdapter();
  const adapter = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter();
  assert.strictEqual(adapter.releaseQuota, undefined);
  assert.strictEqual(typeof adapter.checkQuota, 'function');
  assert.strictEqual(typeof adapter.consumeQuota, 'function');
});

test('backend-only injection works with no namespace and no stub (documented stub -> backend -> namespace precedence)', async () => {
  const backendMod = await loadDoBackend();
  const adapterMod = await loadDoAdapter();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });

  const adapter = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    backend: quota,
    limit: 2,
    windowMs: 60000,
    now: () => 1000,
  });

  assert.strictEqual(adapter.mode, adapterMod.SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.SOURCE);

  const first = await adapter.checkQuota(buildQuotaPayload());
  assert.strictEqual(first.allowed, true, 'backend-only injection must be able to admit');
  assert.strictEqual(first.code, 'DO_QUOTA_ADMITTED');
  assert.strictEqual(first.remaining, 1, 'backend-only injection must consume quota');

  const second = await adapter.checkQuota(buildQuotaPayload());
  assert.strictEqual(second.allowed, true);
  assert.strictEqual(second.remaining, 0, 'backend-only injection must persist across admissions');

  const denied = await adapter.checkQuota(buildQuotaPayload());
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(denied.code, 'DO_QUOTA_LIMITED');

  assert.strictEqual(storage.store.size, 1, 'the backend-only path must persist quota state');
  assert.ok([...storage.store.keys()][0].startsWith('scout:rl:v1:'), 'persisted under the sanitized runtime key');

  // Precedence: an injected stub wins over an injected backend.
  let namespaceResolutions = 0;
  const stubFirst = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    stub: { admit: async () => ({ allowed: true, code: 'DO_QUOTA_ADMITTED', limit: 9, remaining: 8 }) },
    backend: quota,
    namespace: {
      idFromName() { namespaceResolutions += 1; return { name: 'never-used' }; },
      get() { return { admit: async () => ({ allowed: true, code: 'DO_QUOTA_ADMITTED' }) }; },
    },
    limit: 2,
    windowMs: 60000,
  });
  const stubResult = await stubFirst.checkQuota(buildQuotaPayload());
  assert.strictEqual(stubResult.limit, 9, 'stub injection must take precedence');
  assert.strictEqual(namespaceResolutions, 0, 'namespace must not be consulted when a stub is injected');

  // A backend without the bounded admit seam cannot admit.
  const seamlessBackend = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    backend: { note: 'synthetic object without an admit seam' },
    limit: 2,
    windowMs: 60000,
  });
  assert.strictEqual((await seamlessBackend.checkQuota(buildQuotaPayload())).code, 'DO_QUOTA_BACKEND_UNAVAILABLE');
});

// ─── 2. Sanitized runtime key reuse ────────────────────────────────────────

test('injected fake namespace resolves only an existing sanitized runtime key from the canonical key builder', async () => {
  const keyBuilderMod = await loadKeyBuilder();
  const { adapter, namespace } = await buildInjectedAdapter();

  await adapter.checkQuota(buildQuotaPayload());
  assert.strictEqual(namespace.names.length, 1);
  const resolvedName = namespace.names[0];

  const expected = keyBuilderMod
    .buildScoutLiveRateLimitStorageKeyInRuntimeMode(buildQuotaPayload(), { disabled: false, runtime: true });
  assert.strictEqual(expected.ok, true);
  assert.strictEqual(resolvedName, expected.storageKey, 'the DO name must be the canonical sanitized runtime key');
  assert.ok(
    /^scout:rl:v1:[A-Za-z0-9_.:-]{1,64}$/.test(resolvedName),
    `DO name must stay inside the bounded sanitized runtime-key namespace: ${resolvedName}`
  );
  assert.strictEqual(countMarkers(resolvedName), 0, 'DO name must carry no raw identity material');
});

test('quota payload without sanitized identity hash never collapses onto a shared bucket', async () => {
  const { adapter, namespace, storage } = await buildInjectedAdapter();
  const result = await adapter.checkQuota({ windowKey: 'live:2026-10-02T10', limitName: 'scout_live_per_minute' });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'DO_QUOTA_CONFIG_INVALID');
  assert.strictEqual(namespace.names.length, 0, 'no DO may be resolved without identity material');
  assert.strictEqual(storage.getCalls, 0);
});

// ─── 3. Privacy / no-leak surfaces ─────────────────────────────────────────

test('no raw UID / token / email / claims / IP / session / prompt / source data reaches namespace, DO state, output, or observer metadata', async () => {
  const adapterMod = await loadDoAdapter();
  const storage = createSyntheticStorage();
  const events = [];

  // Prohibited identity material in the payload is rejected outright.
  const { adapter, namespace } = await buildInjectedAdapter({ storage });
  const rejected = await adapter.checkQuota(buildSensitivePayload());
  assert.strictEqual(rejected.allowed, false);
  assert.strictEqual(rejected.code, 'DO_QUOTA_PAYLOAD_PROHIBITED');
  assert.strictEqual(namespace.names.length, 0, 'a prohibited payload must not resolve a Durable Object');
  assert.strictEqual(storage.getCalls, 0);

  // Clean payload: nothing sensitive crosses any surface.
  const result = await adapter.checkQuota(buildQuotaPayload({ requestId: 'req-4536-1' }));
  assert.strictEqual(result.allowed, true);
  events.push(result);

  let leaks = 0;
  leaks += countMarkers(namespace.names);
  for (const key of storage.store.keys()) leaks += countMarkers(key);
  for (const value of storage.store.values()) leaks += countMarkers(value);
  for (const event of events) leaks += countMarkers(event);
  leaks += countMarkers(JSON.stringify(storage.store));
  assert.strictEqual(leaks, 0, 'sensitive-field leak count must be zero');

  // The persisted record holds only bounded counter material.
  const persisted = [...storage.store.values()][0];
  assert.deepStrictEqual(
    Object.keys(persisted).sort(),
    ['count', 'seen', 'windowKey', 'windowStartMs'],
    'persisted state must be limited to bounded counter fields'
  );
  assert.ok(!('uid' in persisted) && !('email' in persisted) && !('token' in persisted));

  // Adapter mode/version only — no namespace object, no DO id, no raw key.
  assert.deepStrictEqual(
    Object.keys(result).sort(),
    ['adapterVersion', 'allowed', 'backendVersion', 'code', 'limit', 'mode', 'remaining', 'replayed', 'retryAfterSeconds', 'windowKey'],
    'adapter output must be exactly the safe bounded result shape'
  );
  assert.ok(!('key' in result) && !('storageKey' in result) && !('id' in result) && !('namespace' in result));
  assert.strictEqual(adapterMod.SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_CODES.DO_QUOTA_ADMITTED, 'DO_QUOTA_ADMITTED');
});

// ─── 4. Strict limit N ─────────────────────────────────────────────────────

test('strict limit N admits exactly N and denies N+1 with positive bounded retry information', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const limit = 4;

  for (let i = 1; i <= limit; i += 1) {
    const result = await quota.admit(buildAdmissionRequest({ limit, nowMs: 1000 + i }));
    assert.strictEqual(result.allowed, true, `request ${i} must be admitted`);
    assert.strictEqual(result.code, 'DO_QUOTA_ADMITTED');
    assert.strictEqual(result.count, i);
    assert.strictEqual(result.remaining, limit - i);
  }

  const denied = await quota.admit(buildAdmissionRequest({ limit, nowMs: 2000 }));
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(denied.code, 'DO_QUOTA_LIMITED');
  assert.strictEqual(denied.remaining, 0);
  assert.ok(Number.isInteger(denied.retryAfterSeconds) && denied.retryAfterSeconds > 0, 'denial must carry positive retry info');
  assert.ok(denied.retryAfterSeconds <= 60, 'retry information must stay bounded to the window');

  // Same behavior through the adapter/namespace seam.
  const { adapter } = await buildInjectedAdapter({ adapterOptions: { limit, now: () => 1000 } });
  const allowed = [];
  for (let i = 0; i < limit + 2; i += 1) {
    const result = await adapter.checkQuota(buildQuotaPayload());
    if (result.allowed) allowed.push(result);
    else assert.strictEqual(result.code, 'DO_QUOTA_LIMITED');
  }
  assert.strictEqual(allowed.length, limit, 'adapter must admit exactly N requests');
});

test('decision and persistent counter update happen in one serialized operation (no read-then-write split)', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  await quota.admit(buildAdmissionRequest({ limit: 2, nowMs: 1 }));
  const readsAfterFirst = storage.getCalls;
  await quota.admit(buildAdmissionRequest({ limit: 2, nowMs: 2 }));
  assert.strictEqual(storage.getCalls - readsAfterFirst, 1, 'each admission must read once');
  assert.strictEqual(storage.putCalls, 2, 'each admission must persist exactly once');
});

// ─── 5. Concurrency ────────────────────────────────────────────────────────

test('concurrent/adversarial admissions cannot exceed the configured limit N', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const limit = 5;

  const attempts = [];
  for (let i = 0; i < 40; i += 1) {
    attempts.push(quota.admit(buildAdmissionRequest({ limit, nowMs: 5000 + i })));
  }
  const results = await Promise.all(attempts);

  const admitted = results.filter((r) => r.allowed === true);
  const limited = results.filter((r) => r.code === 'DO_QUOTA_LIMITED');
  assert.strictEqual(admitted.length, limit, 'exactly N admissions may succeed under concurrency');
  assert.strictEqual(limited.length, 40 - limit);
  assert.ok(admitted.every((r) => r.code === 'DO_QUOTA_ADMITTED'));
  assert.ok(limited.every((r) => r.allowed === false));

  // The persisted counter matches the number of admissions exactly.
  const persisted = [...storage.store.values()][0];
  assert.strictEqual(persisted.count, limit, 'persisted counter must not oversubscribe');
});

// ─── 6. Window rollover ────────────────────────────────────────────────────

test('window rollover resets the counter for the new window', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });

  assert.strictEqual((await quota.admit(buildAdmissionRequest({ windowKey: 'live:w1', limit: 2, nowMs: 10 }))).remaining, 1);
  assert.strictEqual((await quota.admit(buildAdmissionRequest({ windowKey: 'live:w1', limit: 2, nowMs: 20 }))).remaining, 0);
  assert.strictEqual((await quota.admit(buildAdmissionRequest({ windowKey: 'live:w1', limit: 2, nowMs: 30 }))).code, 'DO_QUOTA_LIMITED');

  const rolled = await quota.admit(buildAdmissionRequest({ windowKey: 'live:w2', limit: 2, nowMs: 40 }));
  assert.strictEqual(rolled.code, 'DO_QUOTA_ADMITTED', 'a new window must admit again');
  assert.strictEqual(rolled.count, 1);
  assert.strictEqual(rolled.remaining, 1);
  assert.strictEqual(rolled.windowKey, 'live:w2');
});

// ─── 7. Untrusted / missing persisted state ────────────────────────────────

test('corrupt or untrusted persisted state safe-fails and never auto-allows', async () => {
  const backendMod = await loadDoBackend();
  const corruptRecords = [
    'not-an-object',
    { windowKey: 'live:2026-10-02T10', count: 'NaN', windowStartMs: 1, seen: {} },
    { windowKey: 'live:2026-10-02T10', count: -5, windowStartMs: 1, seen: {} },
    { windowKey: 'live:2026-10-02T10', count: 999999, windowStartMs: 1, seen: {} },
    { windowKey: 'live:2026-10-02T10', count: 1, windowStartMs: -1, seen: {} },
    { windowKey: 'live:2026-10-02T10', count: 1, windowStartMs: 1, seen: 'not-an-object' },
    { windowKey: 'live:2026-10-02T10', count: 1, windowStartMs: 1, seen: { 'bad request id!': 1 } },
  ];

  for (const corrupt of corruptRecords) {
    const storage = createSyntheticStorage();
    const key = 'scout:rl:v1:composite:0123456789abcdef';
    await storage.put(key, corrupt);
    const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
    const result = await quota.admit(buildAdmissionRequest());
    assert.strictEqual(
      result.allowed,
      false,
      `corrupt state must never auto-allow: ${JSON.stringify(corrupt)}`
    );
    assert.strictEqual(result.code, 'DO_QUOTA_BACKEND_UNAVAILABLE');
  }
});

test('missing state initializes only under the explicit first-use contract', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });

  assert.strictEqual(storage.store.size, 0, 'no state may exist before the first admission');
  const first = await quota.admit(buildAdmissionRequest({ limit: 2, nowMs: 1234 }));
  assert.strictEqual(first.code, 'DO_QUOTA_ADMITTED');
  assert.strictEqual(first.count, 1);
  const persisted = [...storage.store.values()][0];
  assert.strictEqual(persisted.windowKey, 'live:2026-10-02T10');
  assert.strictEqual(persisted.windowStartMs, 1234);
});

// ─── 8. Storage / binding failure ──────────────────────────────────────────

test('storage throw, binding failure, or DO exception safe-fails as unavailable and never allows', async () => {
  const backendMod = await loadDoBackend();
  const adapterMod = await loadDoAdapter();

  const throwingGet = backendMod.createScoutRateLimitDurableObjectQuotaBackend({
    storage: createSyntheticStorage({ throwOnGet: true }),
  });
  assert.strictEqual((await throwingGet.admit(buildAdmissionRequest())).code, 'DO_QUOTA_BACKEND_UNAVAILABLE');

  const throwingPut = backendMod.createScoutRateLimitDurableObjectQuotaBackend({
    storage: createSyntheticStorage({ throwOnPut: true }),
  });
  const putFailure = await throwingPut.admit(buildAdmissionRequest());
  assert.strictEqual(putFailure.allowed, false);
  assert.strictEqual(putFailure.code, 'DO_QUOTA_BACKEND_UNAVAILABLE');

  const throwingNamespace = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    namespace: {
      idFromName() { throw new Error('synthetic binding failure'); },
      get() { throw new Error('synthetic binding failure'); },
    },
    limit: 3,
    windowMs: 60000,
  });
  const bindingFailure = await throwingNamespace.checkQuota(buildQuotaPayload());
  assert.strictEqual(bindingFailure.allowed, false);
  assert.strictEqual(bindingFailure.code, 'DO_QUOTA_BACKEND_UNAVAILABLE');

  const throwingStub = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    stub: { admit() { throw new Error('synthetic durable-object failure'); } },
    limit: 3,
    windowMs: 60000,
  });
  assert.strictEqual((await throwingStub.checkQuota(buildQuotaPayload())).code, 'DO_QUOTA_BACKEND_UNAVAILABLE');

  // A malformed or missing DO response is never treated as an allow.
  const malformedStub = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false,
    stub: { admit: async () => ({ allowed: true }) },
    limit: 3,
    windowMs: 60000,
  });
  const malformed = await malformedStub.checkQuota(buildQuotaPayload());
  assert.strictEqual(malformed.allowed, false);
  assert.strictEqual(malformed.code, 'DO_QUOTA_BACKEND_UNAVAILABLE');
});

test('missing or out-of-bounds quota configuration fails closed as config invalid', async () => {
  const adapterMod = await loadDoAdapter();
  const storage = createSyntheticStorage();
  const quota = (await loadDoBackend()).createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const namespace = createRecordingNamespace(quota);

  const noLimit = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false, namespace, windowMs: 60000,
  });
  assert.strictEqual((await noLimit.checkQuota(buildQuotaPayload())).code, 'DO_QUOTA_CONFIG_INVALID');

  const hugeLimit = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false, namespace, limit: 100000, windowMs: 60000,
  });
  assert.strictEqual((await hugeLimit.checkQuota(buildQuotaPayload())).code, 'DO_QUOTA_CONFIG_INVALID');

  const noWindow = adapterMod.createScoutLiveRateLimitDurableObjectStorageAdapter({
    disabled: false, namespace, limit: 3,
  });
  assert.strictEqual((await noWindow.checkQuota(buildQuotaPayload())).code, 'DO_QUOTA_CONFIG_INVALID');
  assert.strictEqual(storage.getCalls, 0, 'config failures must never touch durable-object storage');
});

// ─── 9. Bounded result shape ───────────────────────────────────────────────

test('allowed/limited outputs carry only the safe bounded result shape', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const allowedResult = await quota.admit(buildAdmissionRequest({ limit: 1, nowMs: 10 }));
  const limitedResult = await quota.admit(buildAdmissionRequest({ limit: 1, nowMs: 20 }));

  const allowedFields = ['allowed', 'backendVersion', 'code', 'count', 'limit', 'ok', 'remaining', 'replayed', 'retryAfterSeconds', 'windowKey', 'windowStartMs'];
  assert.deepStrictEqual(Object.keys(allowedResult).sort(), allowedFields);
  assert.deepStrictEqual(Object.keys(limitedResult).sort(), allowedFields);
  assert.strictEqual(allowedResult.retryAfterSeconds, null, 'an admission must not carry retry information');
  assert.ok(limitedResult.retryAfterSeconds > 0);
  assert.strictEqual(countMarkers(JSON.stringify(allowedResult)) + countMarkers(JSON.stringify(limitedResult)), 0);
});

test('idempotent requestId replay does not consume quota twice and stays bounded', async () => {
  const backendMod = await loadDoBackend();
  const storage = createSyntheticStorage();
  const quota = backendMod.createScoutRateLimitDurableObjectQuotaBackend({ storage });
  const request = buildAdmissionRequest({ limit: 2, nowMs: 10, requestId: 'req-4536-alpha' });

  const first = await quota.admit(request);
  assert.strictEqual(first.allowed, true);
  assert.strictEqual(first.replayed, false);
  assert.strictEqual(first.count, 1);

  const replay = await quota.admit(request);
  assert.strictEqual(replay.allowed, true);
  assert.strictEqual(replay.replayed, true);
  assert.strictEqual(replay.count, 1, 'a replay must not consume quota again');

  const other = await quota.admit(buildAdmissionRequest({ limit: 2, nowMs: 20, requestId: 'req-4536-beta' }));
  assert.strictEqual(other.count, 2);

  const denied = await quota.admit(buildAdmissionRequest({ limit: 2, nowMs: 30, requestId: 'req-4536-gamma' }));
  assert.strictEqual(denied.code, 'DO_QUOTA_LIMITED');

  const persisted = [...storage.store.values()][0];
  assert.strictEqual(Object.keys(persisted.seen).length, 2, 'idempotency metadata is bounded by admitted count');
  assert.ok(Object.keys(persisted.seen).every((id) => /^req-4536-[a-z]+$/.test(id)), 'idempotency metadata carries no user content');
});

// ─── 10. Dependency mapper stop property ───────────────────────────────────

test('current dependency mapper still maps the new DO codes to RATE_LIMIT_STORAGE_UNAVAILABLE (Slice C mapping absent)', async () => {
  const depMod = await loadDepAdapter();
  const { adapter } = await buildInjectedAdapter({ adapterOptions: { limit: 2, now: () => 1000 } });

  const dependency = depMod.createScoutLiveDependencyAdapter({ mockDisabled: false, storageAdapter: adapter });
  const first = await dependency.checkRateLimit(buildQuotaPayload());
  assert.strictEqual(first.allowed, false);
  assert.strictEqual(first.code, 'RATE_LIMIT_STORAGE_UNAVAILABLE');

  const second = await dependency.checkRateLimit(buildQuotaPayload());
  assert.strictEqual(second.code, 'RATE_LIMIT_STORAGE_UNAVAILABLE');

  const deniedDeps = depMod.createScoutLiveDependencyAdapter({
    mockDisabled: false,
    storageAdapter: {
      checkQuota: async () => ({ allowed: false, code: 'DO_QUOTA_LIMITED', retryAfterSeconds: 42 }),
    },
  });
  const denied = await deniedDeps.checkRateLimit(buildQuotaPayload());
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(denied.code, 'RATE_LIMIT_STORAGE_UNAVAILABLE', 'DO_QUOTA_LIMITED must not be mapped to allow yet');

  const disabledDeps = depMod.createScoutLiveDependencyAdapter({
    mockDisabled: false,
    storageAdapter: (await loadDoAdapter()).createScoutLiveRateLimitDurableObjectStorageAdapter(),
  });
  assert.strictEqual((await disabledDeps.checkRateLimit(buildQuotaPayload())).code, 'RATE_LIMIT_STORAGE_UNAVAILABLE');

  // The mapper source itself must remain unaware of the DO codes.
  const mapperCode = stripComments(depAdapterCode);
  assert.ok(!mapperCode.includes('DO_QUOTA_ADMITTED'), 'dependency mapper must not map DO admissions yet');
  assert.ok(!mapperCode.includes('DO_QUOTA_LIMITED'), 'dependency mapper must not map DO limit codes yet');
  assert.ok(!mapperCode.includes('durable-object-adapter'), 'dependency mapper must not import the DO adapter yet');
});

// ─── 11. Endpoint fail-closed, provider 0 ──────────────────────────────────
//
// Transitional Slice B truth (authority comment 5946264288): the dependency
// mapper reports RATE_LIMIT_STORAGE_UNAVAILABLE, but the CURRENT rate-limit
// boundary does not inspect that code and collapses every `allowed !== true`
// result to `rate_limited` / RATE_LIMITED / HTTP 429. That is a pre-existing
// boundary taxonomy gap; Slice C must make the runtime taxonomy precise
// (backend unavailable/config invalid -> 503 RATE_LIMIT_UNAVAILABLE,
// quota exhausted -> 429 RATE_LIMITED, admitted -> allowed). These assertions
// are therefore transitional and are expected to change in Slice C.

test('current endpoint path fails closed at 429 RATE_LIMITED with provider and Engine transport call count 0', async () => {
  const depMod = await loadDepAdapter();
  const suggestMod = await loadSuggest();
  const { adapter } = await buildInjectedAdapter({ adapterOptions: { limit: 5, now: () => 9000 } });
  const dependency = depMod.createScoutLiveDependencyAdapter({ mockDisabled: false, storageAdapter: adapter });

  // The DO adapter really can admit; the mapper is what refuses the result.
  const mapperProbe = await dependency.checkRateLimit(buildQuotaPayload());
  assert.strictEqual(mapperProbe.allowed, false);
  assert.strictEqual(mapperProbe.code, 'RATE_LIMIT_STORAGE_UNAVAILABLE');

  const providerCalls = [];
  const engineCalls = [];
  const observerEvents = [];

  const res = await suggestMod.onRequestPost({
    request: createMockRequest({
      body: { excerpt: 'synthetic excerpt for the #4536 Slice B contract', desiredTone: 'polite', requestedLanguage: 'ko', maxOutputLength: 200 },
      headers: { authorization: 'Bearer synthetic-raw-token-4536' },
    }),
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_LLM_API_KEY: 'synthetic-not-a-real-key',
      SCOUT_SUGGEST_MODEL: 'synthetic-model',
      FIREBASE_PROJECT_ID: 'synthetic-project-4536',
    },
    observer: { recordBoundaryDecision: (event) => observerEvents.push(event) },
    liveAdapter: {
      verifyToken: async () => ({ ok: true, userKey: SYNTHETIC_USER_KEY_HASH, status: 'verified' }),
      checkRateLimit: dependency.checkRateLimit,
      requestId: 'req-4536-endpoint',
    },
    fetch: async (url) => {
      providerCalls.push(String(url));
      engineCalls.push(String(url));
      throw new Error('provider transport must not be reached from the quota path');
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  assert.strictEqual(res.status, 429, 'current transitional endpoint taxonomy is 429, not 503');
  assert.ok(body && body.ok === false, 'endpoint response must not be ok');
  assert.strictEqual(body.error.code, 'RATE_LIMITED');
  assert.strictEqual(providerCalls.length, 0, 'provider transport call count must be 0');
  assert.strictEqual(engineCalls.length, 0, 'Engine call count from this path must be 0');
  assert.strictEqual(countMarkers(JSON.stringify(observerEvents)), 0, 'observer metadata must not carry raw token material');
  assert.ok(observerEvents.length >= 1, 'the boundary decision must still be observed');
});

// ─── 12. Invariants preserved ──────────────────────────────────────────────

test('frontend local_stub, Engine gate/default, Production stage block, and Slice A gate default are unchanged', () => {
  assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend default must remain local_stub');
  assert.ok(
    suggestCode.includes("String(env?.SCOUT_ENGINE_TRANSPORT_ENABLED || '').toLowerCase() === 'true'"),
    'Engine transport gate/default must remain unchanged'
  );
  assert.ok(suggestCode.includes("const stageOk = stage === 'staging' || stage === 'test';"), 'Production stage block must remain intact');
  assert.ok(suggestCode.includes('&& stageOk'), 'provider transport must still require staging/test stage');
  assert.ok(
    /SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED\s*=\s*"?true/i.test(wranglerCode) === false,
    'the Slice A Firebase gate must stay OFF in checked-in config'
  );
  const compositionCode = readFileSafe(path.join(ROOT, 'functions/api/scout/runtime-auth-composition.js'));
  assert.ok(compositionCode.includes('SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED'), 'Slice A gate helper must still exist');
  assert.ok(
    stripComments(suggestCode).includes('composeScoutRuntimeFirebaseAuth'),
    'the current suggest.js runtime composition must remain wired'
  );
});

test('suggest.js and the dependency mapper do not import or reference the Slice B DO modules', () => {
  const suggestBare = stripComments(suggestCode);
  const depBare = stripComments(depAdapterCode);
  for (const forbidden of [
    'live-rate-limit-durable-object-quota-backend',
    'live-rate-limit-durable-object-adapter',
    'durable-object-adapter',
    'durable_object',
  ]) {
    assert.ok(!suggestBare.includes(forbidden), `suggest.js must not reference ${forbidden}`);
    assert.ok(!depBare.includes(forbidden), `dependency mapper must not reference ${forbidden}`);
  }
});

// ─── 13. Checked-in configuration untouched ────────────────────────────────

test('checked-in wrangler.toml has no Durable Object binding, migration, or runtime activation', () => {
  assert.ok(wranglerCode.length > 0, 'wrangler.toml must be readable');
  assert.ok(!/durable_objects\b/i.test(wranglerCode), 'wrangler.toml must not declare a durable_objects binding');
  assert.ok(!/SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING/i.test(wranglerCode), 'wrangler.toml must not select a DO binding');
  assert.ok(!/SCOUT_RUNTIME_RATE_LIMIT_BACKEND\s*=\s*"durable_object"/i.test(wranglerCode), 'wrangler.toml must not select the DO backend');
  assert.ok(!/\[\[migrations\]/i.test(wranglerCode), 'wrangler.toml must not declare Durable Object migrations');
  assert.ok(!/\bdurable_object_namespace\b/i.test(wranglerCode));
});

test('Slice B modules read no env binding, no process.env, and perform no fetch', () => {
  for (const [label, code] of [['backend', doBackendCode], ['adapter', doAdapterCode]]) {
    const bare = stripComments(code);
    assert.ok(!/\bprocess\.env\b/.test(bare), `${label} must not read process.env`);
    assert.ok(!/\benv\s*\.\s*SCOUT_/.test(bare), `${label} must not read any env.SCOUT_* binding`);
    assert.ok(!/\bfetch\s*\(/.test(bare), `${label} must not perform a fetch call`);
    assert.ok(!/\bnew\s+SQLite|prepare\s*\(|better-sqlite3|postgres|neon/i.test(bare), `${label} must not touch a database`);
  }
  const adapterBare = stripComments(doAdapterCode);
  assert.ok(adapterBare.includes('SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES'), 'adapter must reuse the DO backend result codes');
  assert.ok(
    adapterBare.includes("from './live-rate-limit-storage-key-builder.js'"),
    'adapter must reuse the canonical sanitized runtime key builder'
  );
  assert.ok(
    adapterBare.includes("from './live-rate-limit-storage-adapter.js'"),
    'adapter must reuse the existing storage payload sanitizer'
  );
});

test('concise #4536 Slice B durable-object quota source doc exists and states the stop property', () => {
  const doc = readFileSafe(DOC_PATH);
  assert.ok(doc.length > 0, 'Slice B DO quota source doc must exist');
  const lc = doc.toLowerCase();
  assert.ok(lc.includes('durable object'), 'doc must name the Durable Object backend');
  assert.ok(lc.includes('rate_limit_storage_unavailable'), 'doc must state the mapper stop property');
  assert.ok(lc.includes('slice c'), 'doc must name the Slice C follow-up');
  assert.ok(lc.includes('kv'), 'doc must record why KV is not the strict counter backend');
});