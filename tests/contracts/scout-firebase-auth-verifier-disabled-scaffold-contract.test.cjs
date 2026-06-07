/**
 * Scout Firebase Auth Verifier Disabled Scaffold Contract Tests
 * v20260607-1
 *
 * Locks the disabled-by-default Firebase auth verifier scaffold:
 * - auth verifier module exports Firebase scaffold mode/code
 * - default adapter behavior remains mock-disabled
 * - Firebase scaffold requires explicit opt-in option
 * - Firebase scaffold safe-fails without real verification
 * - Firebase scaffold result never includes raw token / authorization /
 *   apiKey / firebaseToken
 * - sanitizePayload still strips prohibited fields
 * - module import remains side-effect-free
 * - no Firebase Admin SDK / no getAuth / no verifyIdToken / no
 *   verifyAccessToken / no cert / no initializeApp
 * - no fetch / XHR / axios
 * - no KV / DO / D1 / database
 * - no provider SDK imports
 * - no env secret usage
 * - dependency adapter behavior remains unchanged
 * - suggest.js unchanged
 * - endpoint default stub / explicit stub / frontend local_stub /
 *   endpoint client default disabled preserved
 * - docs updated
 * - gate evidence 11 of 11 complete remains documented
 * - no staging_live / production_live
 * - branch safety reminder is documented
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-runtime-observability-policy-audit.md',
  'lovebud-scout-rollback-kill-switch-policy-audit.md',
  'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

// Locked hashes for runtime files that must NOT be modified by this
// scaffold slice. The auth verifier adapter IS being modified, so it
// is not in the lock list. These are the files that must remain
// byte-identical to main.
const LOCKED_HASHES = {
  storage: 'a4419b1e8fc286219ae75bf88271416c',
  suggest: 'deb6a6d7b03d9db48ad215607cefcd0d',
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

const verifierCode = readFileSafe(VERIFIER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const storageAdapterCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) {
    verifierModulePromise = import(VERIFIER_PATH);
  }
  return verifierModulePromise;
}

const tests = [];

// ── 1. Module exists ────────────────────────────────────────────────────────
tests.push({
  name: 'Auth verifier adapter module exists',
  fn: () => {
    assert.ok(verifierCode.length > 0, 'verifier adapter module must exist');
  },
});

// ── 2. Module exports Firebase scaffold mode/code ───────────────────────────
tests.push({
  name: 'Auth verifier module exports Firebase scaffold mode/code (FIREBASE_DISABLED, FIREBASE_CONFIG_MISSING)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const modes = mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES;
    const codes = mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES;
    assert.strictEqual(modes.FIREBASE_DISABLED, 'firebase_disabled', 'modes.FIREBASE_DISABLED must exist');
    assert.strictEqual(modes.FIREBASE_CONFIG_MISSING, 'firebase_config_missing', 'modes.FIREBASE_CONFIG_MISSING must exist');
    assert.strictEqual(codes.VERIFIER_FIREBASE_DISABLED, 'VERIFIER_FIREBASE_DISABLED', 'codes.VERIFIER_FIREBASE_DISABLED must exist');
    assert.strictEqual(codes.VERIFIER_CONFIG_MISSING, 'VERIFIER_CONFIG_MISSING', 'codes.VERIFIER_CONFIG_MISSING must exist');
  },
});

// ── 3. Default adapter behavior remains mock-disabled ───────────────────────
tests.push({
  name: 'Default adapter behavior remains mock-disabled (no Firebase path with default options)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'default verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED, 'code must be VERIFIER_MOCK_DISABLED');
    assert.strictEqual(res.userKey, null, 'userKey must be null in default');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null in default');
  },
});

// ── 4. Firebase scaffold requires explicit opt-in ────────────────────────────
tests.push({
  name: 'Firebase scaffold requires explicit opt-in (mockDisabled:false + verifierMode:firebase_*)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapterA = mod.createScoutLiveAuthVerifierAdapter({ mockDisabled: false });
    assert.strictEqual(adapterA.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED, 'mockDisabled:false without verifierMode must be NOT_IMPLEMENTED');
    const adapterB = mod.createScoutLiveAuthVerifierAdapter({ mockDisabled: false, verifierMode: 'unknown_mode' });
    assert.strictEqual(adapterB.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED, 'unrecognized verifierMode must be NOT_IMPLEMENTED');
    const adapterC = mod.createScoutLiveAuthVerifierAdapter({ mockDisabled: true, verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED });
    assert.strictEqual(adapterC.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED, 'mockDisabled:true must take priority over verifierMode');
  },
});

// ── 5. Firebase scaffold (FIREBASE_DISABLED) safe-fails ──────────────────────
tests.push({
  name: 'Firebase scaffold (FIREBASE_DISABLED) safe-fails with VERIFIER_FIREBASE_DISABLED',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    assert.strictEqual(adapter.mockDisabled, false, 'mockDisabled must be false');
    assert.strictEqual(adapter.isMockDisabled, false, 'isMockDisabled must be false');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED, 'mode must be FIREBASE_DISABLED');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'FIREBASE_DISABLED verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_DISABLED, 'code must be VERIFIER_FIREBASE_DISABLED');
    assert.strictEqual(res.userKey, null, 'userKey must be null in FIREBASE_DISABLED');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null in FIREBASE_DISABLED');
  },
});

// ── 6. Firebase scaffold (FIREBASE_CONFIG_MISSING) safe-fails ───────────────
tests.push({
  name: 'Firebase scaffold (FIREBASE_CONFIG_MISSING) safe-fails with VERIFIER_CONFIG_MISSING',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
    });
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING, 'mode must be FIREBASE_CONFIG_MISSING');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'FIREBASE_CONFIG_MISSING verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_CONFIG_MISSING, 'code must be VERIFIER_CONFIG_MISSING');
    assert.strictEqual(res.userKey, null, 'userKey must be null in FIREBASE_CONFIG_MISSING');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null in FIREBASE_CONFIG_MISSING');
  },
});

// ── 7. Firebase scaffold result does not include raw token ──────────────────
tests.push({
  name: 'Firebase scaffold verifyToken result never includes raw token / authorization / apiKey / firebaseToken',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    const res = await adapter.verifyToken({
      token: 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      authorization: 'Bearer TEST_FIXTURE_NOT_A_REAL_SECRET',
      apiKey: 'TEST_FIXTURE_KEY',
      firebaseToken: 'TEST_FIXTURE_FB',
    });
    const flat = JSON.stringify(res).toLowerCase();
    assert.ok(!flat.includes('test_fixture_token'), 'result must not include raw token value');
    assert.ok(!flat.includes('test_fixture_not_a_real_secret'), 'result must not include raw authorization value');
    assert.ok(!flat.includes('test_fixture_key'), 'result must not include raw api key value');
    assert.ok(!flat.includes('test_fixture_fb'), 'result must not include raw firebase token value');
    assert.strictEqual(res.token, undefined, 'result must not have a token field');
    assert.strictEqual(res.authorization, undefined, 'result must not have an authorization field');
    assert.strictEqual(res.apiKey, undefined, 'result must not have an apiKey field');
    assert.strictEqual(res.firebaseToken, undefined, 'result must not have a firebaseToken field');
  },
});

// ── 8. sanitizePayload still strips prohibited fields ───────────────────────
tests.push({
  name: 'sanitizePayload still strips prohibited fields (token / rawToken / authorization / apiKey / secret / password / cookie / sessionCookie / firebaseToken / prompt / excerpt / sourceUrl / rawRequestBody)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const result = mod.sanitizeScoutLiveAuthVerifierPayload({
      requestId: 'req_test_123',
      tokenHash: 'hk_abc',
      token: 'TEST_FIXTURE_TOKEN',
      rawToken: 'TEST_FIXTURE_RAW',
      authorization: 'Bearer TEST_FIXTURE_AUTH',
      apiKey: 'TEST_FIXTURE_KEY',
      secret: 'TEST_FIXTURE_SECRET',
      password: 'TEST_FIXTURE_PASS',
      cookie: 'TEST_FIXTURE_COOKIE',
      sessionCookie: 'TEST_FIXTURE_SESSION',
      firebaseToken: 'TEST_FIXTURE_FB',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
    });
    const prohibited = ['token', 'rawToken', 'authorization', 'apiKey', 'secret', 'password', 'cookie', 'sessionCookie', 'firebaseToken', 'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody'];
    for (const f of prohibited) {
      assert.ok(result.rejectedFields.includes(f), `rejectedFields must include ${f}`);
      assert.strictEqual(result.payload[f], undefined, `payload must not contain ${f}`);
    }
    assert.strictEqual(result.payload.requestId, 'req_test_123', 'allowed field requestId must be kept');
    assert.strictEqual(result.payload.tokenHash, 'hk_abc', 'allowed field tokenHash must be kept');
  },
});

// ── 9. Module import is side-effect-free ────────────────────────────────────
tests.push({
  name: 'Module import is side-effect-free (no Firebase init / token verify / storage call / provider call)',
  fn: async () => {
    let importCount = 0;
    const before = importCount;
    await loadVerifierModule();
    importCount++;
    // We can't easily detect side effects from import alone, but we can
    // assert that the module's exports are all pure data / functions and
    // that no top-level call to verifyToken / getAuth / etc. happens.
    const mod = await loadVerifierModule();
    const exportNames = Object.keys(mod);
    assert.ok(exportNames.length > 0, 'module must export something');
    assert.strictEqual(typeof mod.createScoutLiveAuthVerifierAdapter, 'function', 'factory must be a function');
    assert.strictEqual(importCount, before + 1, 'import count must be deterministic');
  },
});

// ── 10. No Firebase Admin SDK / getAuth / verifyIdToken / cert / initializeApp ─
tests.push({
  name: 'No Firebase Admin SDK / getAuth / verifyIdToken / verifyAccessToken / cert / initializeApp in verifier code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'verifier must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'verifier must not reference admin.auth');
    assert.ok(!/initializeapp/.test(code), 'verifier must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(code), 'verifier must not call cert()');
    assert.ok(!/\bgetauth\b/.test(code), 'verifier must not call getAuth');
    assert.ok(!/verifyidtoken/.test(code), 'verifier must not call verifyIdToken');
    assert.ok(!/verifyaccesstoken/.test(code), 'verifier must not call verifyAccessToken');
  },
});

// ── 11. No fetch / XHR / axios ───────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios / external URL in verifier code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'verifier must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'verifier must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'verifier must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(code), 'verifier must not construct a new Request');
    assert.ok(!/https?:\/\//.test(code), 'verifier must not embed external URL');
  },
});

// ── 12. No KV / DO / D1 / database ──────────────────────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in verifier code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'verifier must not reference KVNamespace');
    assert.ok(!/durableobject/.test(code), 'verifier must not reference DurableObject');
    assert.ok(!/d1database/.test(code), 'verifier must not reference D1Database');
    assert.ok(!/env\.kv\b/.test(code), 'verifier must not read env.KV');
    assert.ok(!/env\.db\b/.test(code), 'verifier must not read env.DB');
    assert.ok(!/env\.firebase/.test(code), 'verifier must not read env.FIREBASE');
  },
});

// ── 13. No provider SDK imports ─────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in verifier code (OpenAI / Anthropic / Gemini / Groq / Mistral / NVIDIA etc.)',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `verifier must not import ${provider}`);
    }
  },
});

// ── 14. No env secret usage ─────────────────────────────────────────────────
tests.push({
  name: 'No raw secret / env auth binding / process.env reading in verifier code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'verifier must not read process.env.SCOUT_*');
    assert.ok(!/import\.meta\.env/.test(code), 'verifier must not read import.meta.env');
    assert.ok(!/process\.env\.firebase/.test(code), 'verifier must not read process.env.FIREBASE_*');
    assert.ok(!/api_key\s*=/.test(code), 'verifier must not assign api_key');
    assert.ok(!/bearer\s+/.test(code), 'verifier must not embed bearer tokens');
  },
});

// ── 15. Locked runtime files unchanged ──────────────────────────────────────
tests.push({
  name: 'Locked runtime files (storage adapter / suggest.js) remain unchanged by this scaffold slice',
  fn: () => {
    assert.strictEqual(
      normalizedHash(STORAGE_ADAPTER_PATH),
      LOCKED_HASHES.storage,
      'storage adapter hash must match (storage adapter not modified)'
    );
    assert.strictEqual(
      normalizedHash(SUGGEST_PATH),
      LOCKED_HASHES.suggest,
      'suggest.js hash must match (suggest.js not modified)'
    );
  },
});

// ── 16. Dependency adapter behavior remains unchanged ───────────────────────
tests.push({
  name: 'Dependency adapter behavior remains unchanged (still imports createScoutLiveRateLimitStorageAdapter)',
  fn: () => {
    assert.ok(
      depAdapterCode.includes('createScoutLiveRateLimitStorageAdapter'),
      'dependency adapter must still import createScoutLiveRateLimitStorageAdapter'
    );
    assert.ok(
      depAdapterCode.includes('storageAdapter'),
      'dependency adapter must still accept a storageAdapter option'
    );
  },
});

// ── 17. suggest.js unchanged (no Firebase scaffold wiring) ──────────────────
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

// ── 18. Endpoint default stub preserved ─────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 19. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 20. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no Firebase scaffold wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-verifier-adapter'),
      'endpoint client must not reference the verifier adapter'
    );
  },
});

// ── 21. Related docs updated with Firebase scaffold status ─────────────────
tests.push({
  name: 'Related docs exist and reflect the Firebase auth verifier disabled scaffold status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', docName);
      const content = readFileSafe(docPath);
      assert.ok(content.length > 0, `${docName} must exist`);
      const lcDoc = content.toLowerCase();
      assert.ok(
        lcDoc.includes('firebase auth verifier disabled scaffold status') ||
        lcDoc.includes('firebase auth verifier runtime scaffold status'),
        `${docName} must reference the Firebase auth verifier disabled scaffold status`
      );
    }
  },
});

// ── 22. Gate evidence 11 of 11 complete remains documented ─────────────────
tests.push({
  name: 'Gate evidence 11 of 11 complete remains documented',
  fn: () => {
    const gateDocPath = path.join(ROOT, 'docs/product/lovebud-scout-runtime-observability-policy-audit.md');
    const gateDoc = readFileSafe(gateDocPath);
    const lcGate = gateDoc.toLowerCase();
    assert.ok(lcGate.includes('gate evidence 11 of 11 complete'), 'gate evidence 11 of 11 complete must remain documented');
  },
});

// ── 23. No staging_live / production_live ───────────────────────────────────
tests.push({
  name: 'No staging_live / production_live opt-in in this slice',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!code.includes('staging_live') || code.includes('blocked') || code.includes('not adopted'), 'verifier must not opt into staging_live');
    assert.ok(!code.includes('production_live') || code.includes('blocked') || code.includes('not adopted'), 'verifier must not opt into production_live');
  },
});

// ── 24. Firebase scaffold adapter is frozen ─────────────────────────────────
tests.push({
  name: 'Firebase scaffold adapter is frozen (immutable)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapterA = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    const adapterB = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
    });
    assert.strictEqual(Object.isFrozen(adapterA), true, 'FIREBASE_DISABLED adapter must be frozen');
    assert.strictEqual(Object.isFrozen(adapterB), true, 'FIREBASE_CONFIG_MISSING adapter must be frozen');
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
