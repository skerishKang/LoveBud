/**
 * Scout Storage Runtime Key Dependency Mapping Contract Tests
 * v20260616-runtime-key-mapping-1
 *
 * Locks slice #2577 behavior: the dependency adapter explicitly maps the
 * storage runtime-key scaffold outcome (`STORAGE_KEY_BUILT`) to a
 * safe-fail `RATE_LIMIT_STORAGE_UNAVAILABLE` response. The runtime key
 * scaffold output is sanitized metadata only and must NEVER be
 * interpreted as a quota allow decision.
 *
 * This contract also locks:
 * - existing storage disabled / prohibited / config-missing mappings
 *   remain unchanged;
 * - the dependency adapter does not surface `storageKey`, `keyPreview`,
 *   or any other runtime key builder field in its response;
 * - default dependency adapter behavior remains mock-disabled;
 * - endpoint / frontend / endpoint client defaults are preserved;
 * - no KV / Durable Object / D1 / DB / fetch / provider SDK / env /
 *   secrets / staging_live / production_live is introduced.
 *
 * Slice issue: #2577
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 * Depends on: #2575 / #2576
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const KEY_BUILDER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-key-builder.js');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-storage-runtime-key-dependency-mapping.md');
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

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const depAdapter = readFile(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapter);
const storageAdapter = readFile(STORAGE_ADAPTER_PATH);
const storageAdapterCode = codeOnly(storageAdapter);
const keyBuilder = readFile(KEY_BUILDER_PATH);
const keyBuilderCode = codeOnly(keyBuilder);
const doc = readFileSafe(DOC_PATH);
const suggest = readFile(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClient = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) {
    depModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  }
  return depModulePromise;
}

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── Slice identity & docs ──────────────────────────────────────────────────

push('Mapping doc exists with issue references and runtime-key safe-fail status', () => {
  assert.ok(doc.includes('Status: dependency adapter mapping only / no endpoint behavior change'),
    'doc must declare status: dependency adapter mapping only / no endpoint behavior change');
  assert.ok(doc.includes('Parent issue: #1882'), 'doc must reference parent issue #1882');
  assert.ok(doc.includes('Slice issue: #2577'), 'doc must reference slice issue #2577');
  assert.ok(doc.includes('Depends on: #2575'), 'doc must depend on #2575');
  assert.ok(doc.includes('Depends on: #2576'), 'doc must depend on #2576');
});

push('Dependency adapter version is bumped to runtime-key-mapping slice', () => {
  assert.ok(
    depAdapter.includes("SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260616-runtime-key-mapping-1'"),
    'dependency adapter must declare version 20260616-runtime-key-mapping-1'
  );
  assert.ok(
    depAdapter.includes('Slice issue: #2577') || depAdapter.includes('issue #2577'),
    'dependency adapter docstring must reference slice issue #2577'
  );
  assert.ok(
    depAdapter.includes('#1882'),
    'dependency adapter docstring must reference parent umbrella #1882'
  );
});

push('Dependency adapter docstring warns against auto-closing #1882', () => {
  assert.ok(
    depAdapter.includes('must remain OPEN') ||
      depAdapter.includes('never auto-close') ||
      depAdapter.includes('No closing of #1882'),
    'dependency adapter docstring must warn against auto-closing #1882'
  );
});

// ─── STORAGE_KEY_BUILT explicit safe-fail mapping ───────────────────────────

push('Dependency adapter maps STORAGE_KEY_BUILT to RATE_LIMIT_STORAGE_UNAVAILABLE', () => {
  assert.ok(
    depAdapter.includes("code === 'STORAGE_KEY_BUILT'"),
    'dependency adapter must explicitly recognize STORAGE_KEY_BUILT'
  );
  // The new code must be inside the same safe-fail branch as the other
  // disabled / prohibited / config-missing storage codes that all map
  // to RATE_LIMIT_STORAGE_UNAVAILABLE.
  const builtIdx = depAdapter.indexOf("code === 'STORAGE_KEY_BUILT'");
  const storageUnavailableIdx = depAdapter.indexOf('RATE_LIMIT_STORAGE_UNAVAILABLE');
  const keyPayloadProhibitedIdx = depAdapter.indexOf("code === 'STORAGE_KEY_PAYLOAD_PROHIBITED'");
  const keyBuilderDisabledIdx = depAdapter.indexOf("code === 'STORAGE_KEY_BUILDER_DISABLED'");
  assert.ok(builtIdx > 0, 'STORAGE_KEY_BUILT branch must exist');
  assert.ok(
    builtIdx < storageUnavailableIdx ||
      (builtIdx > keyBuilderDisabledIdx && builtIdx > keyPayloadProhibitedIdx),
    'STORAGE_KEY_BUILT must be in the safe-fail mapping branch'
  );
  assert.ok(
    doc.includes('`STORAGE_KEY_BUILT` maps to `RATE_LIMIT_STORAGE_UNAVAILABLE`'),
    'doc must lock the STORAGE_KEY_BUILT mapping'
  );
});

push('STORAGE_KEY_BUILT is NOT interpreted as a quota allow decision at runtime', async () => {
  const mod = await loadDepModule();
  const fakeStorage = {
    kind: 'test_storage_adapter',
    isMockDisabled: false,
    async checkQuota() {
      return {
        allowed: false,
        code: 'STORAGE_KEY_BUILT',
        reason: 'fixture: storage adapter emitted STORAGE_KEY_BUILT at top-level',
        retryAfterSeconds: null,
        storageKey: 'scout:rl:v1:composite:abcdef0123456789',
        keyPreview: 'scout:rl:v1…3456789',
        storageKeyBuilder: {
          ok: true,
          disabled: false,
          code: 'STORAGE_KEY_BUILT',
          storageKey: 'scout:rl:v1:composite:abcdef0123456789',
          keyPreview: 'scout:rl:v1…3456789',
        },
      };
    },
  };
  const adapter = mod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
  const result = await adapter.checkRateLimit({ requestId: 'req_test' });
  assert.strictEqual(result.allowed, false, 'STORAGE_KEY_BUILT must NOT be a quota allow');
  assert.strictEqual(
    result.code,
    mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
    'STORAGE_KEY_BUILT must map to RATE_LIMIT_STORAGE_UNAVAILABLE'
  );
  // Runtime key metadata must not be surfaced through the dependency
  // adapter response.
  assert.strictEqual(result.storageKey, undefined, 'storageKey must not leak through');
  assert.strictEqual(result.keyPreview, undefined, 'keyPreview must not leak through');
  assert.strictEqual(
    result.storageKeyBuilder,
    undefined,
    'storageKeyBuilder metadata must not leak through'
  );
});

push('Dependency adapter does not surface any runtime key builder fields in response', async () => {
  const mod = await loadDepModule();
  const fakeStorage = {
    kind: 'test_storage_adapter',
    isMockDisabled: false,
    async checkQuota() {
      return {
        allowed: false,
        code: 'STORAGE_KEY_BUILT',
        reason: 'fixture: STORAGE_KEY_BUILT at top-level',
        retryAfterSeconds: null,
        storageKey: 'scout:rl:v1:composite:abcdef0123456789',
        keyPreview: 'scout:rl:v1…3456789',
      };
    },
  };
  const adapter = mod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
  const result = await adapter.checkRateLimit({ requestId: 'req_test' });
  for (const field of [
    'storageKey',
    'keyPreview',
    'rawStorageKey',
    'storageKeyBuilder',
  ]) {
    assert.strictEqual(
      result[field],
      undefined,
      `dependency adapter response must not include ${field}`
    );
  }
});

// ─── Existing safe-fail mappings remain unchanged ───────────────────────────

push('Existing storage disabled mappings remain unchanged', async () => {
  const mod = await loadDepModule();
  const cases = [
    'STORAGE_KV_DISABLED',
    'STORAGE_DURABLE_OBJECT_DISABLED',
    'STORAGE_D1_DISABLED',
    'STORAGE_CONFIG_MISSING',
    'STORAGE_KEY_BUILDER_DISABLED',
    'STORAGE_KEY_PAYLOAD_PROHIBITED',
  ];
  for (const storageCodeValue of cases) {
    const adapter = mod.createScoutLiveDependencyAdapter({
      storageAdapter: {
        kind: 'test_storage_adapter',
        isMockDisabled: false,
        async checkQuota() {
          return { allowed: false, code: storageCodeValue, reason: 'fixture' };
        },
      },
    });
    const result = await adapter.checkRateLimit({ requestId: 'req_test' });
    assert.strictEqual(result.allowed, false, `${storageCodeValue} must deny`);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
      `${storageCodeValue} must remain RATE_LIMIT_STORAGE_UNAVAILABLE`
    );
  }
});

push('Existing storage payload / not-implemented / mock-disabled mappings remain unchanged', async () => {
  const mod = await loadDepModule();
  const cases = [
    ['STORAGE_PAYLOAD_PROHIBITED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_PAYLOAD_PROHIBITED],
    ['STORAGE_NOT_IMPLEMENTED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED],
    ['STORAGE_MOCK_DISABLED', mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED],
  ];
  for (const [storageCodeValue, expectedDependencyCode] of cases) {
    const adapter = mod.createScoutLiveDependencyAdapter({
      storageAdapter: {
        kind: 'test_storage_adapter',
        isMockDisabled: false,
        async checkQuota() {
          return { allowed: false, code: storageCodeValue, reason: 'fixture' };
        },
      },
    });
    const result = await adapter.checkRateLimit({ requestId: 'req_test' });
    assert.strictEqual(result.allowed, false, `${storageCodeValue} must deny`);
    assert.strictEqual(
      result.code,
      expectedDependencyCode,
      `${storageCodeValue} must remain mapped to ${expectedDependencyCode}`
    );
  }
});

// ─── Unknown / throw safety ─────────────────────────────────────────────────

push('Unknown storage result codes still safe-fail to RATE_LIMIT_STORAGE_UNAVAILABLE', async () => {
  const mod = await loadDepModule();
  const adapter = mod.createScoutLiveDependencyAdapter({
    storageAdapter: {
      kind: 'test_storage_adapter',
      isMockDisabled: false,
      async checkQuota() {
        return { allowed: false, code: 'STORAGE_FUTURE_UNKNOWN', reason: 'fixture unknown' };
      },
    },
  });
  const result = await adapter.checkRateLimit({ requestId: 'req_test' });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(
    result.code,
    mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE
  );
});

push('Storage adapter throw remains safe-swallowed to RATE_LIMIT_STORAGE_UNAVAILABLE', async () => {
  const mod = await loadDepModule();
  const adapter = mod.createScoutLiveDependencyAdapter({
    storageAdapter: {
      kind: 'test_storage_adapter',
      isMockDisabled: false,
      async checkQuota() {
        throw new Error('TEST_FIXTURE_STORAGE_THROW');
      },
    },
  });
  let result;
  let threw = false;
  try {
    result = await adapter.checkRateLimit({ requestId: 'req_test' });
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, false, 'storage adapter throw must not propagate');
  assert.ok(result, 'safe-fail response must be returned');
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(
    result.code,
    mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE
  );
});

// ─── Default behavior preservation ──────────────────────────────────────────

push('Default dependency adapter behavior remains mock-disabled', async () => {
  const mod = await loadDepModule();
  const adapter = mod.createScoutLiveDependencyAdapter();
  assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must remain true');
  assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must remain true');
  assert.strictEqual(
    adapter.mode,
    mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED,
    'default mode must remain MOCK_DISABLED'
  );
  const rate = await adapter.checkRateLimit({ requestId: 'req_test' });
  assert.strictEqual(rate.allowed, false, 'default checkRateLimit must deny');
  assert.strictEqual(
    rate.code,
    mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
    'default checkRateLimit code must remain RATE_LIMIT_NOT_IMPLEMENTED'
  );
});

// ─── Allowlist boundary preservation ───────────────────────────────────────

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
    assert.ok(
      depAdapter.includes("'" + allowed + "'"),
      `dependency adapter must include allowed field ${allowed}`
    );
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
    'password',
    'sessionCookie',
    'firebaseToken',
    'openaiApiKey',
    'anthropicApiKey',
  ]) {
    assert.ok(
      !depAdapterCode.includes("'" + forbidden + "'"),
      `dependency adapter storage payload must not include ${forbidden}`
    );
  }
});

// ─── Endpoint / frontend / endpoint client defaults preserved ───────────────

push('Endpoint default stub, frontend local_stub, and endpoint client default remain preserved', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source selector must retain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('Endpoint and frontend do not import or expose runtime key builder surface', () => {
  assert.ok(
    !suggestCode.includes('live-rate-limit-storage-key-builder'),
    'endpoint must not import key builder'
  );
  assert.ok(
    !suggestCode.includes('STORAGE_KEY_BUILT'),
    'endpoint must not expose STORAGE_KEY_BUILT'
  );
  assert.ok(
    !suggestCode.includes('storageKeyBuilder'),
    'endpoint must not expose storageKeyBuilder'
  );
  assert.ok(
    !sourceSelector.includes('storageKeyBuilder'),
    'frontend selector must not expose storageKeyBuilder'
  );
  assert.ok(
    !sourceSelector.includes('STORAGE_KEY_BUILT'),
    'frontend selector must not expose STORAGE_KEY_BUILT'
  );
  assert.ok(
    !endpointClient.includes('storageKeyBuilder'),
    'endpoint client must not expose storageKeyBuilder'
  );
  assert.ok(
    !endpointClient.includes('STORAGE_KEY_BUILT'),
    'endpoint client must not expose STORAGE_KEY_BUILT'
  );
});

// ─── No real backend / fetch / provider / secrets ──────────────────────────

push('No real KV / Durable Object / D1 / DB / fetch / provider SDK / env / secrets is introduced', () => {
  const lower = depCodeOnly(depAdapter);
  assert.ok(!/\b(fetch|xmlhttprequest|axios)\s*\(/.test(lower), 'dependency adapter must not introduce fetch/XHR/axios');
  assert.ok(!/kvnamespace|durableobject|d1database|env\.kv\b|env\.db\b/.test(lower), 'dependency adapter must not introduce storage runtime access');
  assert.ok(!/crypto\.subtle\.digest/.test(lower), 'dependency adapter must not introduce crypto.subtle.digest');
  assert.ok(!/createhash\b/i.test(lower), 'dependency adapter must not introduce createHash');
  assert.ok(!/process\.env\.scout/.test(lower), 'dependency adapter must not read process.env.SCOUT_*');
  assert.ok(!/import\.meta\.env/.test(lower), 'dependency adapter must not read import.meta.env');
  for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia']) {
    assert.ok(
      !new RegExp(`(import|require).*${provider}`, 'i').test(lower),
      `dependency adapter must not import ${provider}`
    );
  }
  for (const forbidden of ['staging_live', 'production_live']) {
    assert.ok(
      !depAdapterCode.includes(forbidden),
      `dependency adapter must not introduce ${forbidden}`
    );
  }
});

function depCodeOnly(source) {
  return codeOnly(source).toLowerCase();
}

// ─── Storage adapter / key builder regression anchors ───────────────────────

push('Storage adapter preserves STORAGE_KEY_BUILT nested metadata in its response shape', async () => {
  // This is a regression anchor: the storage adapter continues to nest
  // STORAGE_KEY_BUILT under storageKeyBuilder.code (not at the top-level
  // code field). The dependency adapter does not depend on this nesting,
  // but the slice must not promote STORAGE_KEY_BUILT to the top level.
  const { createScoutLiveRateLimitStorageAdapter } = await importAbsolute(STORAGE_ADAPTER_PATH);
  const adapter = createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv',
    runtimeKey: true,
  });
  const r = await adapter.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl-1',
    windowKey: 'w-1',
  });
  // Top-level code is the scaffold code, not STORAGE_KEY_BUILT.
  assert.notStrictEqual(
    r.code,
    'STORAGE_KEY_BUILT',
    'storage adapter must not promote STORAGE_KEY_BUILT to top-level code'
  );
  // STORAGE_KEY_BUILT is preserved in nested metadata.
  assert.strictEqual(r.storageKeyBuilder.code, 'STORAGE_KEY_BUILT');
  // allowed must be false (scaffold, not quota allow).
  assert.strictEqual(r.allowed, false);
});

push('Storage adapter and key builder preserve disabled-by-default default', () => {
  assert.ok(storageAdapter.includes("SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = '20260616-runtime-output-1'"),
    'storage adapter version must remain stable');
  assert.ok(keyBuilder.includes("SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION = '20260616-runtime-mode-1'"),
    'key builder version must remain stable');
  assert.ok(keyBuilder.includes('disabled: true'),
    'key builder default disabled must remain');
  assert.ok(keyBuilder.includes('storageKey: null'),
    'key builder default storageKey: null must remain');
  assert.ok(keyBuilder.includes('keyPreview: null'),
    'key builder default keyPreview: null must remain');
});

// ─── Forbidden surface (storageKey / keyPreview on dep adapter) ─────────────

push('Dependency adapter response object does not include storageKey, keyPreview, or storageKeyBuilder in shape', () => {
  // The mapper is pure-data; verify the response shape never includes
  // these fields. We do a behavioral test via the fake storage adapter.
  return (async () => {
    const mod = await loadDepModule();
    const fakeStorage = {
      kind: 'fake',
      isMockDisabled: false,
      async checkQuota() {
        return {
          allowed: false,
          code: 'STORAGE_KEY_BUILT',
          reason: 'fixture',
          retryAfterSeconds: null,
          storageKey: 'should-not-leak',
          keyPreview: 'should-not-leak',
          storageKeyBuilder: { ok: true, code: 'STORAGE_KEY_BUILT', storageKey: 'should-not-leak', keyPreview: 'should-not-leak' },
        };
      },
    };
    const adapter = mod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const r = await adapter.checkRateLimit({ requestId: 'req_test' });
    const keys = Object.keys(r);
    for (const forbidden of ['storageKey', 'keyPreview', 'storageKeyBuilder', 'rawStorageKey']) {
      assert.ok(
        !keys.includes(forbidden),
        `dependency adapter response must not include key "${forbidden}" (keys: ${keys.join(',')})`
      );
    }
  })();
});

// ─── Docstring / doc regression ─────────────────────────────────────────────

push('Documentation locks non-goals and mapping rationale', () => {
  assert.ok(
    doc.includes('NO-GO for endpoint wiring, real key generation, real hashing, real storage backend access, frontend changes, provider integration, deployment changes, or Browse #1661 work in this slice.'),
    'doc must include the standard NO-GO list'
  );
  assert.ok(
    doc.includes('must not leak runtime key builder internals'),
    'doc must describe the leak-prevention rationale'
  );
});

// ─── Runner ─────────────────────────────────────────────────────────────────

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
