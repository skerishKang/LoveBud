/**
 * Scout Live Auth Verifier Dependency Wiring Contract Tests
 * v20260607-1
 *
 * Locks the wiring of the auth verifier adapter skeleton into the
 * Scout live dependency adapter mock path:
 * - dependency adapter imports the verifier adapter factory
 * - dependency adapter accepts a verifierAdapter option
 * - default verifier adapter is mock-disabled when none is provided
 * - verifyToken calls verifierAdapter.verifyToken with allowlisted
 *   payload only (no raw token / authorization / apiKey / firebaseToken /
 *   sessionCookie / password / prompt / excerpt / sourceUrl / raw request)
 * - verifyToken result does not propagate raw token fields
 * - verifier mock-disabled / not-implemented / payload-prohibited / unknown
 *   results are mapped to dependency-adapter safe-fail codes
 * - verifier adapter throw is safe-swallowed
 * - checkRateLimit storage wiring remains intact
 * - adapter object is frozen
 * - endpoint default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no Firebase Admin SDK / no getAuth / no verifyIdToken / no KV / DO / D1
 *   / no fetch / no provider SDK / no secrets / no env auth binding
 * - docs reflect auth verifier adapter dependency wiring status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
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
const verifierCode = readFileSafe(VERIFIER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModulePromise = null;
let verifierModulePromise = null;
let storageModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) depModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  return depModulePromise;
}
async function loadVerifierModule() {
  if (!verifierModulePromise) verifierModulePromise = importAbsolute(VERIFIER_PATH);
  return verifierModulePromise;
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

// ── 1. Dependency adapter imports verifier adapter ────────────────────────
tests.push({
  name: 'Dependency adapter imports createScoutLiveAuthVerifierAdapter from verifier adapter module',
  fn: () => {
    assert.ok(
      depCode.includes('live-auth-verifier-adapter'),
      'dependency adapter must import from live-auth-verifier-adapter.js'
    );
    assert.ok(
      depCode.includes('createScoutLiveAuthVerifierAdapter'),
      'dependency adapter must import the createScoutLiveAuthVerifierAdapter factory'
    );
  },
});

// ── 2. Dependency adapter accepts verifierAdapter option ───────────────────
tests.push({
  name: 'createScoutLiveDependencyAdapter accepts verifierAdapter option',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const customVerifier = verifierMod.createScoutLiveAuthVerifierAdapter({ mockDisabled: true });
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: customVerifier });
    assert.ok(adapter, 'adapter must be created with custom verifierAdapter');
    assert.strictEqual(adapter.verifierAdapterKind, 'scout_live_auth_verifier_adapter', 'verifierAdapterKind must be set');
    assert.strictEqual(adapter.verifierAdapterMockDisabled, true, 'verifierAdapterMockDisabled must reflect injected adapter');
  },
});

// ── 3. Default verifier adapter is mock-disabled ──────────────────────────
tests.push({
  name: 'Default verifierAdapter (when none provided) is mock-disabled',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter();
    assert.strictEqual(adapter.verifierAdapterMockDisabled, true, 'default verifierAdapterMockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
  },
});

// ── 4. verifyToken calls verifierAdapter.verifyToken ────────────────────────
tests.push({
  name: 'verifyToken calls the injected verifierAdapter.verifyToken with allowlisted payload',
  fn: async () => {
    let callCount = 0;
    let receivedPayload = null;
    const fakeVerifier = {
      kind: 'fake_verifier',
      isMockDisabled: true,
      async verifyToken(payload) {
        callCount++;
        receivedPayload = payload;
        return {
          allowed: false,
          code: 'VERIFIER_MOCK_DISABLED',
          reason: 'fake verifier mock-disabled',
          userKey: null,
          userKeyHash: null,
        };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({
      requestId: 'req_test_123',
      tokenHash: 'hk_abc',
      authorizationScheme: 'Bearer',
      providerMode: 'live',
      endpointPath: '/api/scout/suggest',
      nowMs: Date.now(),
      // sensitive fields that must be stripped
      token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      authorization: 'Bearer TEST_FIXTURE_AUTH',
      apiKey: 'TEST_FIXTURE_KEY',
      firebaseToken: 'TEST_FIXTURE_FB',
      sessionCookie: 'TEST_FIXTURE_SC',
      password: 'TEST_FIXTURE_PW',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
    });
    assert.strictEqual(callCount, 1, 'verifierAdapter.verifyToken must be called exactly once');
    assert.ok(receivedPayload, 'verifierAdapter.verifyToken must receive a payload');
    // Allowlisted fields are preserved
    assert.strictEqual(receivedPayload.requestId, 'req_test_123', 'requestId must be passed through');
    assert.strictEqual(receivedPayload.tokenHash, 'hk_abc', 'tokenHash must be passed through');
    assert.strictEqual(receivedPayload.authorizationScheme, 'Bearer', 'authorizationScheme must be passed through');
    assert.strictEqual(receivedPayload.endpointPath, '/api/scout/suggest', 'endpointPath must be passed through');
    // Sensitive fields are stripped
    assert.strictEqual(receivedPayload.token, undefined, 'token must be stripped');
    assert.strictEqual(receivedPayload.authorization, undefined, 'authorization must be stripped');
    assert.strictEqual(receivedPayload.apiKey, undefined, 'apiKey must be stripped');
    assert.strictEqual(receivedPayload.firebaseToken, undefined, 'firebaseToken must be stripped');
    assert.strictEqual(receivedPayload.sessionCookie, undefined, 'sessionCookie must be stripped');
    assert.strictEqual(receivedPayload.password, undefined, 'password must be stripped');
    assert.strictEqual(receivedPayload.prompt, undefined, 'prompt must be stripped');
    assert.strictEqual(receivedPayload.excerpt, undefined, 'excerpt must be stripped');
    assert.strictEqual(receivedPayload.sourceUrl, undefined, 'sourceUrl must be stripped');
    assert.strictEqual(receivedPayload.rawRequestBody, undefined, 'rawRequestBody must be stripped');
    // Result is mapped to dependency-adapter safe-fail shape
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'VERIFIER_MOCK_DISABLED must map to VERIFY_NOT_IMPLEMENTED');
  },
});

// ── 5. verifyToken passes allowlisted payload only ─────────────────────────
tests.push({
  name: 'verifyToken only passes allowlisted fields to verifierAdapter (no sensitive data)',
  fn: async () => {
    let receivedPayload = null;
    const fakeVerifier = {
      kind: 'fake_verifier',
      isMockDisabled: true,
      async verifyToken(payload) {
        receivedPayload = payload;
        return { allowed: false, code: 'VERIFIER_MOCK_DISABLED', reason: 'fake', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    await adapter.verifyToken({
      requestId: 'r1',
      tokenHash: 'h1',
      authorizationScheme: 'Bearer',
      providerMode: 'live',
      endpointPath: '/p',
      nowMs: 1,
      // All of these must be stripped:
      token: 'T', rawToken: 'RT', authorization: 'A', authorizationHeader: 'AH',
      apiKey: 'K', secret: 'S', password: 'PW', cookie: 'C', sessionCookie: 'SC',
      firebaseToken: 'FT',
      openaiApiKey: 'OAK', anthropicApiKey: 'AAK', geminiApiKey: 'GAK',
      groqApiKey: 'GQK', mistralApiKey: 'MAK', nvidiaApiKey: 'NAK',
      prompt: 'P', excerpt: 'E', sourceUrl: 'U', rawRequestBody: 'B',
      unknownField: 'X',
    });
    const prohibited = [
      'token', 'rawToken', 'authorization', 'authorizationHeader',
      'apiKey', 'secret', 'password', 'cookie', 'sessionCookie', 'firebaseToken',
      'openaiApiKey', 'anthropicApiKey', 'geminiApiKey',
      'groqApiKey', 'mistralApiKey', 'nvidiaApiKey',
      'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody',
    ];
    for (const field of prohibited) {
      assert.strictEqual(
        receivedPayload[field],
        undefined,
        `prohibited field "${field}" must not be in verifier payload`
      );
    }
    assert.strictEqual(receivedPayload.unknownField, undefined, 'unknown fields must be dropped');
    // Allowed fields are present
    assert.strictEqual(receivedPayload.requestId, 'r1');
    assert.strictEqual(receivedPayload.tokenHash, 'h1');
    assert.strictEqual(receivedPayload.authorizationScheme, 'Bearer');
    assert.strictEqual(receivedPayload.nowMs, 1);
  },
});

// ── 6. verifyToken result does not include raw token fields ───────────────
tests.push({
  name: 'verifyToken result does not include raw token / authorization / apiKey / firebaseToken',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: true,
      async verifyToken() {
        return { allowed: false, code: 'VERIFIER_MOCK_DISABLED', reason: 'fake', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({ token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET' });
    const flat = JSON.stringify(res).toLowerCase();
    assert.ok(!flat.includes('test_fixture_token'), 'result must not include raw token value');
    assert.ok(!flat.includes('test_fixture_not_a_real_secret'), 'result must not include raw secret value');
    assert.strictEqual(res.token, undefined, 'result must not have a token field');
    assert.strictEqual(res.authorization, undefined, 'result must not have an authorization field');
    assert.strictEqual(res.apiKey, undefined, 'result must not have an apiKey field');
    assert.strictEqual(res.firebaseToken, undefined, 'result must not have a firebaseToken field');
    assert.strictEqual(res.userKey, null, 'userKey must be null (skeleton)');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null (skeleton)');
  },
});

// ── 7. VERIFIER_MOCK_DISABLED maps to VERIFY_NOT_IMPLEMENTED ───────────────
tests.push({
  name: 'VERIFIER_MOCK_DISABLED maps to dependency-adapter VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: true,
      async verifyToken() {
        return { allowed: false, code: 'VERIFIER_MOCK_DISABLED', reason: 'mock-disabled', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
  },
});

// ── 8. VERIFIER_NOT_IMPLEMENTED maps to VERIFY_NOT_IMPLEMENTED ─────────────
tests.push({
  name: 'VERIFIER_NOT_IMPLEMENTED maps to dependency-adapter VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: false,
      async verifyToken() {
        return { allowed: false, code: 'VERIFIER_NOT_IMPLEMENTED', reason: 'not-impl', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
  },
});

// ── 9. VERIFIER_PAYLOAD_PROHIBITED maps to VERIFY_PAYLOAD_PROHIBITED ───────
tests.push({
  name: 'VERIFIER_PAYLOAD_PROHIBITED maps to dependency-adapter VERIFY_PAYLOAD_PROHIBITED',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: true,
      async verifyToken() {
        return { allowed: false, code: 'VERIFIER_PAYLOAD_PROHIBITED', reason: 'prohibited', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_PAYLOAD_PROHIBITED);
  },
});

// ── 10. Unknown verifier code maps to VERIFY_UNAVAILABLE ───────────────────
tests.push({
  name: 'Unknown verifier code maps to dependency-adapter VERIFY_UNAVAILABLE',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: true,
      async verifyToken() {
        return { allowed: false, code: 'UNKNOWN_VERIFIER_CODE', reason: 'mystery', userKey: null, userKeyHash: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE);
  },
});

// ── 11. Verifier adapter throw is safe-swallowed ───────────────────────────
tests.push({
  name: 'Verifier adapter throw is safe-swallowed (no throw propagation)',
  fn: async () => {
    const fakeVerifier = {
      kind: 'fake',
      isMockDisabled: true,
      async verifyToken() {
        throw new Error('TEST_FIXTURE_VERIFIER_THROW');
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    let res;
    let threw = false;
    try {
      res = await adapter.verifyToken({});
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'verifyToken must not propagate verifier adapter throws');
    assert.ok(res, 'safe-fail response must be returned');
    assert.strictEqual(res.allowed, false, 'safe-fail response must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE, 'throw must map to VERIFY_UNAVAILABLE');
  },
});

// ── 12. checkRateLimit storage wiring remains intact ───────────────────────
tests.push({
  name: 'checkRateLimit storage adapter dependency wiring is unchanged (storage still routed)',
  fn: async () => {
    let storageCallCount = 0;
    const fakeStorage = {
      kind: 'fake_storage',
      isMockDisabled: true,
      async checkQuota() {
        storageCallCount++;
        return { allowed: false, code: 'STORAGE_MOCK_DISABLED', reason: 'fake', retryAfterSeconds: null };
      },
    };
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(storageCallCount, 1, 'storageAdapter.checkQuota must still be called by checkRateLimit');
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'storage mapping unchanged');
  },
});

// ── 13. Dependency adapter object remains frozen ───────────────────────────
tests.push({
  name: 'Dependency adapter object remains frozen (immutable)',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter();
    assert.strictEqual(Object.isFrozen(adapter), true, 'adapter must be frozen');
  },
});

// ── 14. Endpoint default stub preserved ───────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
  },
});

// ── 15. Explicit stub path preserved ───────────────────────────────────────
tests.push({
  name: 'Explicit stub path is preserved (providerMode:"stub" explicit)',
  fn: () => {
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 16. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 17. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no verifier wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-verifier-adapter'),
      'endpoint client must not reference the verifier adapter'
    );
  },
});

// ── 18. suggest.js unchanged in this slice ─────────────────────────────────
tests.push({
  name: 'suggest.js LIVE branch wiring is not modified by this slice (verifier wiring is dependency-internal)',
  fn: () => {
    assert.ok(
      !suggestCode.includes('live-auth-verifier-adapter'),
      'suggest.js must not import the verifier adapter (wiring is dependency-internal in this slice)'
    );
    assert.ok(
      !suggestCode.includes('createScoutLiveAuthVerifierAdapter'),
      'suggest.js must not call createScoutLiveAuthVerifierAdapter in this slice'
    );
    assert.ok(
      suggestCode.includes('createScoutLiveDependencyAdapter'),
      'suggest.js must still import the dependency adapter (existing wiring preserved)'
    );
  },
});

// ── 19. No Firebase Admin SDK / getAuth / verifyIdToken in dep adapter code ─
tests.push({
  name: 'No Firebase Admin SDK / getAuth / verifyIdToken / cert / initializeApp in dep adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'dep adapter must not import firebase-admin in code');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'dep adapter must not reference admin.auth in code');
    assert.ok(!/initializeapp/.test(code), 'dep adapter must not call initializeApp in code');
    assert.ok(!/cert\s*\(/.test(code), 'dep adapter must not call cert() in code');
    assert.ok(!/\bgetauth\b/.test(code), 'dep adapter must not call getAuth in code');
    assert.ok(!/verifyidtoken/.test(code), 'dep adapter must not call verifyIdToken in code');
    assert.ok(!/verifyaccesstoken/.test(code), 'dep adapter must not call verifyAccessToken in code');
  },
});

// ── 20. No KV / Durable Object / D1 / database runtime access ──────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in dep adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'dep adapter must not reference KVNamespace in code');
    assert.ok(!/durableobject/.test(code), 'dep adapter must not reference DurableObject in code');
    assert.ok(!/d1database/.test(code), 'dep adapter must not reference D1Database in code');
    assert.ok(!/env\.kv\b/.test(code), 'dep adapter must not read env.KV in code');
    assert.ok(!/env\.db\b/.test(code), 'dep adapter must not read env.DB in code');
    assert.ok(!/env\.auth\b/.test(code), 'dep adapter must not read env.AUTH in code');
    assert.ok(!/env\.firebase/.test(code), 'dep adapter must not read env.FIREBASE in code');
  },
});

// ── 21. No fetch / XHR / axios in dep adapter code ─────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in dep adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'dep adapter must not call fetch() in code');
    assert.ok(!/xmlhttprequest/.test(code), 'dep adapter must not use XMLHttpRequest in code');
    assert.ok(!/axios/.test(code), 'dep adapter must not use axios in code');
    assert.ok(!/new\s+request\s*\(/.test(code), 'dep adapter must not construct a new Request in code');
  },
});

// ── 22. No provider SDK imports in dep adapter code ───────────────────────
tests.push({
  name: 'No provider SDK imports in dep adapter code (imports only)',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `dep adapter must not import ${provider} in code`);
    }
  },
});

// ── 23. No secrets / env usage in dep adapter code ────────────────────────
tests.push({
  name: 'No raw secret / env auth binding / process.env reading in dep adapter code',
  fn: () => {
    const code = codeOnly(depCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'dep adapter must not read process.env.SCOUT_* in code');
    assert.ok(!/import\.meta\.env/.test(code), 'dep adapter must not read import.meta.env in code');
    assert.ok(!/process\.env\.firebase/.test(code), 'dep adapter must not read process.env.FIREBASE_* in code');
    assert.ok(!/api_key\s*=/.test(code), 'dep adapter must not assign api_key in code');
    assert.ok(!/bearer\s+/.test(code), 'dep adapter must not embed bearer tokens in code');
  },
});

// ── 24. Verifier adapter module still exists and is well-formed ───────────
tests.push({
  name: 'Verifier adapter module still exists and is well-formed (no regression)',
  fn: async () => {
    const verifierMod = await loadVerifierModule();
    assert.ok(typeof verifierMod.createScoutLiveAuthVerifierAdapter === 'function');
    assert.ok(typeof verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION === 'string');
    assert.ok(typeof verifierMod.sanitizeScoutLiveAuthVerifierPayload === 'function');
    assert.ok(typeof verifierMod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS !== 'undefined');
    assert.ok(typeof verifierMod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS !== 'undefined');
  },
});

// ── 25. Docs reflect verifier adapter dependency wiring status ────────────
tests.push({
  name: 'Related docs exist and reflect verifier adapter dependency wiring status',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
    // The dependency adapter skeleton doc should mention verifier adapter wiring
    const depDoc = readFileSafe(path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md'));
    const lc = depDoc.toLowerCase();
    assert.ok(
      lc.includes('verifier') && (lc.includes('wiring') || lc.includes('wired') || lc.includes('routed')),
      'dependency adapter doc should mention verifier adapter wiring'
    );
    // The verifier adapter skeleton doc should mention dependency wiring
    const verifierDoc = readFileSafe(path.join(ROOT, 'docs/product/lovebud-scout-live-auth-verifier-adapter-skeleton.md'));
    const lc2 = verifierDoc.toLowerCase();
    assert.ok(
      lc2.includes('dependency') && (lc2.includes('wiring') || lc2.includes('wired') || lc2.includes('adapter')),
      'verifier adapter doc should mention dependency adapter wiring'
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
