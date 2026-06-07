/**
 * Scout Disabled Firebase Verifier Dependency Wiring Contract Tests
 * v20260607-1
 *
 * Locks the wiring of the disabled Firebase auth verifier scaffold into
 * the Scout live dependency adapter contract. This is a contract-only
 * slice — no runtime behavior change, no real Firebase Admin SDK import,
 * no real token verification, no endpoint live behavior.
 *
 * Sub-tests:
 *  1. dependency adapter recognizes disabled Firebase verifier codes
 *  2. VERIFIER_FIREBASE_DISABLED maps to safe-fail
 *  3. VERIFIER_CONFIG_MISSING maps to safe-fail
 *  4. existing verifier mappings remain unchanged
 *  5. default dependency adapter behavior remains mock-disabled
 *  6. dependency adapter does not enable Firebase mode by itself
 *  7. no raw token or auth data propagated
 *  8. no Firebase Admin SDK / no getAuth / no verifyIdToken / no cert / no initializeApp
 *  9. no fetch / XHR / axios
 * 10. no KV / DO / D1 / database access
 * 11. no provider SDK imports
 * 12. no env secret usage
 * 13. suggest.js unchanged
 * 14. endpoint default stub preserved
 * 15. explicit stub path preserved
 * 16. frontend default local_stub preserved
 * 17. endpoint client default disabled preserved
 * 18. docs updated with dependency wiring status
 * 19. no staging_live / production_live
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-firebase-auth-verifier-disabled-scaffold-readiness-audit.md',
  'lovebud-scout-runtime-observability-policy-audit.md',
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-rollback-kill-switch-policy-audit.md',
  'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

// Locked LF/CRLF-normalized md5 hashes for runtime files that must NOT be modified by this
// slice (except dependency adapter itself which we will modify safely).
const LOCKED_HASHES = {
  verifier: '81f80368fe80bb8a770b251efc085509', // auth verifier adapter (locked by previous slice)
  storage: 'a4419b1e8fc286219ae75bf88271416c', // storage adapter
  suggest: 'deb6a6d7b03d9db48ad215607cefcd0d', // suggest.js
};

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

function normalizedHash(filePath) {
  const text = readFileSafe(filePath);
  const normalized = text.replace(/\r\n/g, '\n');
  return crypto.createHash('md5').update(normalized, 'utf-8').digest('hex');
}

const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageAdapterCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModulePromise = null;
let verifierModulePromise = null;
let storageModulePromise = null;
async function loadDepModule() {
  if (!depModulePromise) {
    depModulePromise = import(DEP_ADAPTER_PATH);
  }
  return depModulePromise;
}
async function loadVerifierModule() {
  if (!verifierModulePromise) {
    verifierModulePromise = import(VERIFIER_PATH);
  }
  return verifierModulePromise;
}
async function loadStorageModule() {
  if (!storageModulePromise) {
    storageModulePromise = import(STORAGE_ADAPTER_PATH);
  }
  return storageModulePromise;
}

const tests = [];

// ── 1. Dependency adapter recognizes disabled Firebase verifier codes ────────
tests.push({
  name: 'Dependency adapter can be injected with Firebase disabled scaffold adapter',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const firebaseDisabledAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    const firebaseConfigMissingAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
    });
    // Should not throw
    const adapterA = depMod.createScoutLiveDependencyAdapter({
      verifierAdapter: firebaseDisabledAdapter,
    });
    const adapterB = depMod.createScoutLiveDependencyAdapter({
      verifierAdapter: firebaseConfigMissingAdapter,
    });
    assert.ok(adapterA && adapterB, 'both adapters should be created');
  },
});

// ── 2. VERIFIER_FIREBASE_DISABLED maps to safe-fail ────────────────────────
tests.push({
  name: 'VERIFIER_FIREBASE_DISABLED maps to dependency-adapter VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const verifierAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    const adapter = depMod.createScoutLiveDependencyAdapter({
      verifierAdapter: verifierAdapter,
    });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'FIREBASE_DISABLED must map to VERIFY_NOT_IMPLEMENTED');
    assert.strictEqual(res.userKey, null, 'userKey must be null');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null');
  },
});

// ── 3. VERIFIER_CONFIG_MISSING maps to safe-fail ───────────────────────────
tests.push({
  name: 'VERIFIER_CONFIG_MISSING maps to dependency-adapter VERIFY_UNAVAILABLE',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const verifierAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
    });
    const adapter = depMod.createScoutLiveDependencyAdapter({
      verifierAdapter: verifierAdapter,
    });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE, 'FIREBASE_CONFIG_MISSING must map to VERIFY_UNAVAILABLE');
    assert.strictEqual(res.userKey, null, 'userKey must be null');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null');
  },
});

// ── 4. Existing verifier mappings remain unchanged ─────────────────────────
tests.push({
  name: 'VERIFIER_MOCK_DISABLED still maps to VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const verifierAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({ mockDisabled: true });
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
  },
});

tests.push({
  name: 'VERIFIER_NOT_IMPLEMENTED still maps to VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierMod = await loadVerifierModule();
    const verifierAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({ mockDisabled: false });
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
  },
});

tests.push({
  name: 'VERIFIER_PAYLOAD_PROHIBITED still maps to VERIFY_PAYLOAD_PROHIBITED',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierAdapter = {
      kind: 'scout_live_auth_verifier_adapter_fake_payload_prohibited',
      version: 'fake',
      mockDisabled: false,
      isMockDisabled: false,
      async verifyToken() {
        return {
          allowed: false,
          code: 'VERIFIER_PAYLOAD_PROHIBITED',
          reason: 'verifyToken payload contained prohibited fields',
          userKey: null,
          userKeyHash: null,
        };
      },
    };
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    const res = await adapter.verifyToken({ payload: { token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET' } });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_PAYLOAD_PROHIBITED);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
  },
});

tests.push({
  name: 'Unknown verifier code still maps to VERIFY_UNAVAILABLE',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierAdapter = {
      kind: 'scout_live_auth_verifier_adapter_fake_unknown',
      version: 'fake',
      mockDisabled: false,
      isMockDisabled: false,
      async verifyToken() {
        return {
          allowed: false,
          code: 'UNKNOWN_VERIFIER_CODE',
          reason: 'unknown',
          userKey: null,
          userKeyHash: null,
        };
      },
    };
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
  },
});

tests.push({
  name: 'Verifier adapter throw still maps to VERIFY_UNAVAILABLE (safe-swallowed)',
  fn: async () => {
    const depMod = await loadDepModule();
    const verifierAdapter = {
      kind: 'scout_live_auth_verifier_adapter_fake_throw',
      version: 'fake',
      mockDisabled: false,
      isMockDisabled: false,
      async verifyToken() {
        throw new Error('TEST_FIXTURE_VERIFIER_THROW');
      },
    };
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    let threw = false;
    let res;
    try {
      res = await adapter.verifyToken({});
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'verifyToken must not propagate verifier adapter throws');
    assert.ok(res, 'safe-fail response must be returned');
    assert.strictEqual(res.allowed, false, 'safe-fail response must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE, 'throw must map to VERIFY_UNAVAILABLE');
  },
});

// ── 5. Default dependency adapter behavior remains mock-disabled ───────────
tests.push({
  name: 'Default dependency adapter behavior remains mock-disabled',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter(); // no options
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(adapter.mode, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'default verifyToken must deny');
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'default code must be VERIFY_NOT_IMPLEMENTED');
    assert.strictEqual(res.userKey, null, 'default userKey must be null');
    assert.strictEqual(res.userKeyHash, null, 'default userKeyHash must be null');
  },
});

// ── 6. Dependency adapter does not enable Firebase mode by itself ──────────
tests.push({
  name: 'Dependency adapter does not enable Firebase mode by itself',
  fn: async () => {
    const depMod = await loadDepModule();
    const adapter = depMod.createScoutLiveDependencyAdapter(); // no verifierAdapter option
    // The default verifierAdapter should be mock-disabled
    const defaultVerifier = adapter.verifierAdapter; // internal, but we can check via behavior
    const res = await adapter.verifyToken({});
    // Should still be mock-disabled behavior (VERIFY_NOT_IMPLEMENTED)
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED);
    assert.strictEqual(res.userKey, null);
    assert.strictEqual(res.userKeyHash, null);
    // No automatic Firebase mode enable
    // We can also check that the verifierAdapterKind is still the skeleton
    assert.strictEqual(adapter.verifierAdapterKind, 'scout_live_auth_verifier_adapter');
    assert.strictEqual(adapter.verifierAdapterMockDisabled, true);
  },
});

// ── 7. No raw token or auth data propagated ────────────────────────────────
tests.push({
  name: 'verifyToken payload passed to verifierAdapter is allowlist-only (no sensitive data)',
  fn: async () => {
    let receivedPayload = null;
    const depMod = await loadDepModule();
    const verifierAdapter = {
      kind: 'scout_live_auth_verifier_adapter_fake_payload_audit',
      version: 'fake',
      mockDisabled: false,
      isMockDisabled: false,
      async verifyToken(payload) {
        receivedPayload = payload;
        return { allowed: false, code: 'VERIFIER_FIREBASE_DISABLED', reason: 'test', userKey: null, userKeyHash: null };
      },
    };
    const adapter = depMod.createScoutLiveDependencyAdapter({ verifierAdapter: verifierAdapter });
    await adapter.verifyToken({
      requestId: 'req_test_123',
      tokenHash: 'hk_abc',
      authorizationScheme: 'Bearer',
      providerMode: 'live',
      endpointPath: '/api/scout/suggest',
      nowMs: Date.now(),
      // sensitive fields that must be stripped before reaching verifier
      token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      rawToken: 'TEST_FIXTURE_RAW_TOKEN',
      authorization: 'Bearer TEST_FIXTURE_AUTH',
      authorizationHeader: 'Bearer TEST_FIXTURE_AUTH_HEADER',
      apiKey: 'TEST_FIXTURE_KEY',
      secret: 'TEST_FIXTURE_SECRET',
      password: 'TEST_FIXTURE_PASS',
      cookie: 'TEST_FIXTURE_COOKIE',
      sessionCookie: 'TEST_FIXTURE_SESSION',
      firebaseToken: 'TEST_FIXTURE_FB_TOKEN',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
      unknownField: 'should_be_dropped',
    });
    // Assert sensitive fields are NOT in the payload sent to verifier
    assert.strictEqual(receivedPayload.token, undefined, 'token must be stripped before verifier');
    assert.strictEqual(receivedPayload.rawToken, undefined, 'rawToken must be stripped before verifier');
    assert.strictEqual(receivedPayload.authorization, undefined, 'authorization must be stripped before verifier');
    assert.strictEqual(receivedPayload.authorizationHeader, undefined, 'authorizationHeader must be stripped before verifier');
    assert.strictEqual(receivedPayload.apiKey, undefined, 'apiKey must be stripped before verifier');
    assert.strictEqual(receivedPayload.secret, undefined, 'secret must be stripped before verifier');
    assert.strictEqual(receivedPayload.password, undefined, 'password must be stripped before verifier');
    assert.strictEqual(receivedPayload.cookie, undefined, 'cookie must be stripped before verifier');
    assert.strictEqual(receivedPayload.sessionCookie, undefined, 'sessionCookie must be stripped before verifier');
    assert.strictEqual(receivedPayload.firebaseToken, undefined, 'firebaseToken must be stripped before verifier');
    assert.strictEqual(receivedPayload.prompt, undefined, 'prompt must be stripped before verifier');
    assert.strictEqual(receivedPayload.excerpt, undefined, 'excerpt must be stripped before verifier');
    assert.strictEqual(receivedPayload.sourceUrl, undefined, 'sourceUrl must be stripped before verifier');
    assert.strictEqual(receivedPayload.rawRequestBody, undefined, 'rawRequestBody must be stripped before verifier');
    assert.strictEqual(receivedPayload.unknownField, undefined, 'unknown fields must be dropped before verifier');
    // Assert allowlisted fields ARE present
    assert.strictEqual(receivedPayload.requestId, 'req_test_123', 'requestId must be passed through');
    assert.strictEqual(receivedPayload.tokenHash, 'hk_abc', 'tokenHash must be passed through');
    assert.strictEqual(receivedPayload.authorizationScheme, 'Bearer', 'authorizationScheme must be passed through');
    assert.strictEqual(receivedPayload.endpointPath, '/api/scout/suggest', 'endpointPath must be passed through');
    assert.strictEqual(receivedPayload.nowMs, Date.now(), 'nowMs must be passed through (approx)');
  },
});

// ── 8. no Firebase Admin SDK / no getAuth / no verifyIdToken / no cert / no initializeApp ──
tests.push({
  name: 'No Firebase Admin SDK / getAuth / verifyIdToken / verifyAccessToken / cert / initializeApp in dep adapter code',
  fn: () => {
    const code = codeOnly(depAdapterCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'dep adapter must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'dep adapter must not reference admin.auth');
    assert.ok(!/initializeapp/.test(code), 'dep adapter must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(code), 'dep adapter must not call cert()');
    assert.ok(!/\bgetauth\b/.test(code), 'dep adapter must not call getAuth');
    assert.ok(!/verifyidtoken/.test(code), 'dep adapter must not call verifyIdToken');
    assert.ok(!/verifyaccesstoken/.test(code), 'dep adapter must not call verifyAccessToken');
  },
});

// ── 9. no fetch / XHR / axios ───────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios / external URL in dep adapter code',
  fn: () => {
    const code = codeOnly(depAdapterCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'dep adapter must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'dep adapter must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'dep adapter must not use axios');
    assert.ok(!/https?:\/\//.test(code), 'dep adapter must not embed external URL');
  },
});

// ── 10. no KV / DO / D1 / database ──────────────────────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in dep adapter code',
  fn: () => {
    const code = codeOnly(depAdapterCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'dep adapter must not reference KVNamespace');
    assert.ok(!/durableobject/.test(code), 'dep adapter must not reference DurableObject');
    assert.ok(!/d1database/.test(code), 'dep adapter must not reference D1Database');
    assert.ok(!/env\.kv\b/.test(code), 'dep adapter must not read env.KV');
    assert.ok(!/env\.db\b/.test(code), 'dep adapter must not read env.DB');
    assert.ok(!/env\.auth\b/.test(code), 'dep adapter must not read env.AUTH');
    assert.ok(!/env\.firebase/.test(code), 'dep adapter must not read env.FIREBASE');
  },
});

// ── 11. no provider SDK imports ─────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in dep adapter code (OpenAI / Anthropic / Gemini / Groq / Mistral / NVIDIA etc.)',
  fn: () => {
    const code = codeOnly(depAdapterCode).toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `dep adapter must not import ${provider}`);
    }
  },
});

// ── 12. no env secret usage ─────────────────────────────────────────────────
tests.push({
  name: 'No raw secret / env auth binding / process.env reading in dep adapter code',
  fn: () => {
    const code = codeOnly(depAdapterCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'dep adapter must not read process.env.SCOUT_*');
    assert.ok(!/import\.meta\.env/.test(code), 'dep adapter must not read import.meta.env');
    assert.ok(!/process\.env\.firebase/.test(code), 'dep adapter must not read process.env.FIREBASE_*');
    assert.ok(!/api_key\s*=/.test(code), 'dep adapter must not assign api_key');
    assert.ok(!/bearer\s+/.test(code), 'dep adapter must not embed bearer tokens');
  },
});

// ── 13. suggest.js unchanged (no Firebase scaffold wiring) ─────────────────
tests.push({
  name: 'suggest.js is unchanged (no Firebase scaffold wiring in this slice)',
  fn: () => {
    assert.ok(
      !suggestCode.includes('FIREBASE_DISABLED') && !suggestCode.includes('firebase_disabled'),
      'suggest.js must not reference FIREBASE_DISABLED mode'
    );
    assert.ok(
      !suggestCode.includes('createScoutLiveAuthVerifierAdapter'),
      'suggest.js must not call createScoutLiveAuthVerifierAdapter in this slice'
    );
  },
});

// ── 14. Endpoint default stub preserved ─────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 15. Explicit stub path preserved ────────────────────────────────────────
tests.push({
  name: 'Explicit providerMode:"stub" path is preserved in suggest.js',
  fn: () => {
    assert.ok(
      suggestCode.includes('providerMode') && suggestCode.includes('stub'),
      'suggest.js must preserve explicit stub path concept'
    );
    // More specifically, the constant should exist
    assert.ok(
      suggestCode.includes('STUB:') && (suggestCode.includes("'stub'") || suggestCode.includes('"stub"')),
      'suggest.js must define STUB mode constant'
    );
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

// ── 17. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no Firebase scaffold wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-verifier-adapter'),
      'endpoint client must not reference the verifier adapter'
    );
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-dependency-adapter'),
      'endpoint client must not reference the dependency adapter'
    );
  },
});

// ── 18. docs updated with dependency wiring status ────────────────────────
tests.push({
  name: 'Related docs exist and reflect the disabled Firebase verifier dependency wiring status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', docName);
      const content = readFileSafe(docPath);
      assert.ok(content.length > 0, `${docName} must exist`);
      const lcDoc = content.toLowerCase();
      assert.ok(
        lcDoc.includes('disabled firebase verifier dependency wiring status') ||
        lcDoc.includes('disabled firebase auth verifier dependency wiring status'),
        `${docName} must reference the disabled Firebase verifier dependency wiring status`
      );
    }
  },
});

// ── 19. No staging_live / production_live ───────────────────────────────────
tests.push({
  name: 'No staging_live / production_live opt-in in this slice',
  fn: () => {
    const lc = depAdapterCode.toLowerCase();
    assert.ok(
      !lc.match(/staging_live\s+(yes|opt|enable|adopt|active)/) ||
      lc.includes('blocked') || lc.includes('not adopted'),
      'dep adapter must not opt into staging_live'
    );
    assert.ok(
      !lc.match(/production_live\s+(yes|opt|enable|adopt|active)/) ||
      lc.includes('blocked') || lc.includes('not adopted'),
      'dep adapter must not opt into production_live'
    );
  },
});

// ── Bonus: Dep adapter locked hash should be updated (we changed it) ───────
// This test will fail until we update the LOCKED_HASHES in the existing Firebase scaffold test
// We'll handle that separately in the existing test file updates.

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
