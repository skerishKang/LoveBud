/**
 * Scout Live Storage Adapter Dependency Wiring Contract Tests
 * v20260607-1
 *
 * Locks the wiring of the rate-limit storage adapter skeleton into the
 * Scout live dependency adapter mock path:
 * - dependency adapter imports the storage adapter factory
 * - dependency adapter accepts a storageAdapter option
 * - default storage adapter is mock-disabled when none is provided
 * - checkRateLimit calls storageAdapter.checkQuota with allowlisted payload only
 * - checkRateLimit does NOT pass sensitive payload fields
 * - storage mock-disabled / not-implemented / payload-prohibited results
 *   are mapped to dependency-adapter safe-fail codes
 * - storage adapter throw is safe-swallowed
 * - verifyToken mock-disabled default behavior is unchanged
 * - adapter object is frozen
 * - endpoint default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no KV / Durable Object / D1 / database / fetch / env storage binding
 * - no Firebase Admin SDK / no provider SDK
 * - no secrets / env usage
 * - docs reflect storage adapter dependency wiring status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const depCode = readFileSafe(DEP_ADAPTER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModulePromise = null;
let storageModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) depModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  return depModulePromise;
}
async function loadStorageModule() {
  if (!storageModulePromise) storageModulePromise = importAbsolute(STORAGE_ADAPTER_PATH);
  return storageModulePromise;
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Dependency adapter imports storage adapter ───────────────────────────
tests.push({
  name: 'Dependency adapter imports createScoutLiveRateLimitStorageAdapter from storage adapter module',
  fn: () => {
    assert.ok(
      depCode.includes('live-rate-limit-storage-adapter'),
      'dependency adapter must import from live-rate-limit-storage-adapter.js'
    );
    assert.ok(
      depCode.includes('createScoutLiveRateLimitStorageAdapter'),
      'dependency adapter must import the createScoutLiveRateLimitStorageAdapter factory'
    );
  },
});

// ── 2. Dependency adapter accepts storageAdapter option ────────────────────
tests.push({
  name: 'createScoutLiveDependencyAdapter accepts storageAdapter option',
  fn: async () => {
    const depMod = await loadDepModule();
    const storageMod = await loadStorageModule();
    const customStorage = storageMod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: true });
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: customStorage });
    assert.ok(adapter, 'adapter must be created with custom storageAdapter');
    assert.strictEqual(adapter.storageAdapterKind, 'scout_live_rate_limit_storage_adapter', 'storageAdapterKind must be set');
    assert.strictEqual(adapter.storageAdapterMockDisabled, true, 'storageAdapterMockDisabled must reflect injected adapter');
  },
});

// ── 3. Default storage adapter is mock-disabled ─────────────────────────────
tests.push({
  name: 'Default storageAdapter (when none provided) is mock-disabled',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter();
    assert.strictEqual(adapter.storageAdapterMockDisabled, true, 'default storageAdapterMockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
  },
});

// ── 4. checkRateLimit calls storageAdapter.checkQuota ───────────────────────
tests.push({
  name: 'checkRateLimit calls the injected storageAdapter.checkQuota with allowlisted payload',
  fn: async () => {
    let callCount = 0;
    let receivedPayload = null;
    const fakeStorage = {
      kind: 'fake_storage',
      isMockDisabled: true,
      async checkQuota(payload) {
        callCount++;
        receivedPayload = payload;
        return {
          allowed: false,
          code: 'STORAGE_MOCK_DISABLED',
          reason: 'fake storage mock-disabled',
          retryAfterSeconds: null,
        };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({
      requestId: 'req_test_123',
      userKeyHash: 'hk_abc',
      ipHash: 'iph_xyz',
      sessionKeyHash: 'skh_def',
      endpointPath: '/api/scout/suggest',
      providerMode: 'live',
      windowKey: 'wk_1',
      limitName: 'rl_default',
      nowMs: Date.now(),
      // sensitive fields that must be stripped
      token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      apiKey: 'TEST_FIXTURE_KEY',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
    });
    assert.strictEqual(callCount, 1, 'storageAdapter.checkQuota must be called exactly once');
    assert.ok(receivedPayload, 'storageAdapter.checkQuota must receive a payload');
    // Allowlisted fields are preserved
    assert.strictEqual(receivedPayload.requestId, 'req_test_123', 'requestId must be passed through');
    assert.strictEqual(receivedPayload.userKeyHash, 'hk_abc', 'userKeyHash must be passed through');
    assert.strictEqual(receivedPayload.endpointPath, '/api/scout/suggest', 'endpointPath must be passed through');
    // Sensitive fields are stripped
    assert.strictEqual(receivedPayload.token, undefined, 'token must be stripped');
    assert.strictEqual(receivedPayload.apiKey, undefined, 'apiKey must be stripped');
    assert.strictEqual(receivedPayload.prompt, undefined, 'prompt must be stripped');
    assert.strictEqual(receivedPayload.excerpt, undefined, 'excerpt must be stripped');
    assert.strictEqual(receivedPayload.sourceUrl, undefined, 'sourceUrl must be stripped');
    assert.strictEqual(receivedPayload.rawRequestBody, undefined, 'rawRequestBody must be stripped');
    // Result is mapped to dependency-adapter safe-fail shape
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'STORAGE_MOCK_DISABLED must map to RATE_LIMIT_NOT_IMPLEMENTED');
  },
});

// ── 5. checkRateLimit passes allowlisted payload only ───────────────────────
tests.push({
  name: 'checkRateLimit only passes allowlisted fields to storageAdapter (no sensitive data)',
  fn: async () => {
    let receivedPayload = null;
    const fakeStorage = {
      kind: 'fake_storage',
      isMockDisabled: true,
      async checkQuota(payload) {
        receivedPayload = payload;
        return { allowed: false, code: 'STORAGE_MOCK_DISABLED', reason: 'fake', retryAfterSeconds: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    await adapter.checkRateLimit({
      requestId: 'r1',
      userKeyHash: 'h1',
      ipHash: 'i1',
      sessionKeyHash: 's1',
      endpointPath: '/p',
      providerMode: 'live',
      windowKey: 'w1',
      limitName: 'l1',
      nowMs: 1,
      // All of these must be stripped:
      token: 'T', rawToken: 'RT', authorization: 'A', apiKey: 'K', secret: 'S',
      prompt: 'P', excerpt: 'E', sourceUrl: 'U', rawRequestBody: 'B',
      rawProviderResponse: 'R', rawModelOutput: 'M', password: 'PW', cookie: 'C',
      sessionCookie: 'SC', firebaseToken: 'FT',
      openaiApiKey: 'OAK', anthropicApiKey: 'AAK', geminiApiKey: 'GAK',
      groqApiKey: 'GQK', mistralApiKey: 'MAK', nvidiaApiKey: 'NAK',
      unknownField: 'X',
    });
    const prohibited = [
      'token', 'rawToken', 'authorization', 'apiKey', 'secret',
      'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody',
      'rawProviderResponse', 'rawModelOutput', 'password', 'cookie',
      'sessionCookie', 'firebaseToken',
      'openaiApiKey', 'anthropicApiKey', 'geminiApiKey',
      'groqApiKey', 'mistralApiKey', 'nvidiaApiKey',
    ];
    for (const field of prohibited) {
      assert.strictEqual(
        receivedPayload[field],
        undefined,
        `prohibited field "${field}" must not be in storage payload`
      );
    }
    assert.strictEqual(receivedPayload.unknownField, undefined, 'unknown fields must be dropped');
    // Allowed fields are present
    assert.strictEqual(receivedPayload.requestId, 'r1');
    assert.strictEqual(receivedPayload.userKeyHash, 'h1');
    assert.strictEqual(receivedPayload.nowMs, 1);
  },
});

// ── 6. STORAGE_MOCK_DISABLED maps to RATE_LIMIT_NOT_IMPLEMENTED ─────────────
tests.push({
  name: 'STORAGE_MOCK_DISABLED maps to dependency-adapter RATE_LIMIT_NOT_IMPLEMENTED',
  fn: async () => {
    const fakeStorage = {
      kind: 'fake',
      isMockDisabled: true,
      async checkQuota() {
        return { allowed: false, code: 'STORAGE_MOCK_DISABLED', reason: 'mock-disabled', retryAfterSeconds: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED);
  },
});

// ── 7. STORAGE_NOT_IMPLEMENTED maps to RATE_LIMIT_NOT_IMPLEMENTED ──────────
tests.push({
  name: 'STORAGE_NOT_IMPLEMENTED maps to dependency-adapter RATE_LIMIT_NOT_IMPLEMENTED',
  fn: async () => {
    const fakeStorage = {
      kind: 'fake',
      isMockDisabled: false,
      async checkQuota() {
        return { allowed: false, code: 'STORAGE_NOT_IMPLEMENTED', reason: 'not-implemented', retryAfterSeconds: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED);
  },
});

// ── 8. STORAGE_PAYLOAD_PROHIBITED maps to RATE_LIMIT_PAYLOAD_PROHIBITED ────
tests.push({
  name: 'STORAGE_PAYLOAD_PROHIBITED maps to dependency-adapter RATE_LIMIT_PAYLOAD_PROHIBITED',
  fn: async () => {
    const fakeStorage = {
      kind: 'fake',
      isMockDisabled: true,
      async checkQuota() {
        return { allowed: false, code: 'STORAGE_PAYLOAD_PROHIBITED', reason: 'prohibited', retryAfterSeconds: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_PAYLOAD_PROHIBITED);
  },
});

// ── 9. Storage adapter throw is safe-swallowed ─────────────────────────────
tests.push({
  name: 'Storage adapter throw is safe-swallowed (no throw propagation)',
  fn: async () => {
    const fakeStorage = {
      kind: 'fake',
      isMockDisabled: true,
      async checkQuota() {
        throw new Error('TEST_FIXTURE_STORAGE_THROW');
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    let res;
    let threw = false;
    try {
      res = await adapter.checkRateLimit({});
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'checkRateLimit must not propagate storage adapter throws');
    assert.ok(res, 'safe-fail response must be returned');
    assert.strictEqual(res.allowed, false, 'safe-fail response must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE, 'throw must map to RATE_LIMIT_STORAGE_UNAVAILABLE');
  },
});

// ── 10. verifyToken behavior unchanged ──────────────────────────────────────
tests.push({
  name: 'verifyToken mock-disabled default behavior is unchanged',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter();
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
  },
});

// ── 11. Adapter object remains frozen ──────────────────────────────────────
tests.push({
  name: 'Dependency adapter object remains frozen (immutable)',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter();
    assert.strictEqual(Object.isFrozen(adapter), true, 'adapter must be frozen');
  },
});

// ── 12. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
  },
});

// ── 13. Explicit stub path preserved ───────────────────────────────────────
tests.push({
  name: 'Explicit stub path is preserved (providerMode:"stub" explicit)',
  fn: () => {
    assert.ok(suggestCode.includes('STUB: \'stub\'') || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 14. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 15. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no storage adapter wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-rate-limit-storage-adapter'),
      'endpoint client must not reference the storage adapter'
    );
  },
});

// ── 16. No KV / Durable Object / D1 / database in dep adapter code ─────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in dependency adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'dependency adapter must not reference KVNamespace in code');
    assert.ok(!/durableobject/.test(code), 'dependency adapter must not reference DurableObject in code');
    assert.ok(!/d1database/.test(code), 'dependency adapter must not reference D1Database in code');
    assert.ok(!/env\.kv\b/.test(code), 'dependency adapter must not read env.KV in code');
    assert.ok(!/env\.db\b/.test(code), 'dependency adapter must not read env.DB in code');
  },
});

// ── 17. No fetch / XHR / axios in dep adapter code ─────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in dependency adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'dependency adapter must not call fetch in code');
    assert.ok(!/xmlhttprequest/.test(code), 'dependency adapter must not use XMLHttpRequest in code');
    assert.ok(!/axios/.test(code), 'dependency adapter must not use axios in code');
  },
});

// ── 18. No Firebase Admin SDK in dep adapter code ─────────────────────────
tests.push({
  name: 'No Firebase Admin SDK imports in dependency adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'dependency adapter must not import firebase-admin in code');
  },
});

// ── 19. No provider SDK imports in dep adapter code ───────────────────────
tests.push({
  name: 'No provider SDK imports in dependency adapter code (imports only)',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `dependency adapter must not import ${provider} in code`);
    }
  },
});

// ── 20. No secrets / env usage in dep adapter code ─────────────────────────
tests.push({
  name: 'No raw secret / env storage binding / process.env reading in dependency adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'dependency adapter must not read process.env.SCOUT_* in code');
    assert.ok(!/import\.meta\.env/.test(code), 'dependency adapter must not read import.meta.env in code');
    assert.ok(!/api_key\s*=/.test(code), 'dependency adapter must not assign api_key in code');
  },
});

// ── 21. suggest.js is not modified by this slice (no new imports) ──────────
tests.push({
  name: 'suggest.js LIVE branch wiring is not modified by this slice (storage wiring is dependency-internal)',
  fn: () => {
    assert.ok(
      !suggestCode.includes('live-rate-limit-storage-adapter'),
      'suggest.js must not import the storage adapter (wiring is dependency-internal in this slice)'
    );
    assert.ok(
      suggestCode.includes('createScoutLiveDependencyAdapter'),
      'suggest.js must still import the dependency adapter (existing wiring preserved)'
    );
  },
});

// ── 22. Dependency adapter skeleton test still passes (no regression) ──────
tests.push({
  name: 'Dependency adapter skeleton module still exports its core API (no regression)',
  fn: async () => {
    const depMod = await loadDepModule();
    assert.ok(typeof depMod.createScoutLiveDependencyAdapter === 'function');
    assert.ok(typeof depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION === 'string');
    assert.ok(typeof depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES === 'object');
    assert.ok(typeof depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES === 'object');
  },
});

// ── 23. Storage adapter module still exists and is well-formed ───────────
tests.push({
  name: 'Storage adapter module still exists and is well-formed (no regression)',
  fn: async () => {
    const storageMod = await loadStorageModule();
    assert.ok(typeof storageMod.createScoutLiveRateLimitStorageAdapter === 'function');
    assert.ok(typeof storageMod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION === 'string');
    assert.ok(typeof storageMod.sanitizeScoutLiveRateLimitStoragePayload === 'function');
  },
});

// ── 24. Docs reflect storage adapter dependency wiring status ────────────
tests.push({
  name: 'Related docs exist and reflect storage adapter dependency wiring status',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
    // The dependency adapter skeleton doc should mention storage adapter wiring
    const depDoc = readFileSafe(path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md'));
    const lc = depDoc.toLowerCase();
    assert.ok(
      lc.includes('storage') && (lc.includes('wiring') || lc.includes('wired') || lc.includes('routed')),
      'dependency adapter doc should mention storage adapter wiring'
    );
  },
});

// ── Runner ─────────────────────────────────────────────────────────────────
(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  \u2713 ' + t.name);
      passed++;
    } catch (err) {
      console.log('  \u2717 ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
