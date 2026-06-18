/**
 * Scout Live Auth Verifier Adapter Skeleton Contract Tests
 * v20260607-1
 *
 * Locks the mock-disabled auth verifier adapter skeleton contract for
 * the Scout live provider path:
 * - module exists and is well-formed
 * - factory default mockDisabled:true returns safe "mock-disabled"
 *   response for verifyToken (no real token verification)
 * - sanitizePayload strips prohibited sensitive fields
 * - not-implemented mode returns the same shape with not-implemented marker
 * - no Firebase Admin SDK / no getAuth / no verifyIdToken
 * - no external auth service / no fetch / no env auth binding
 * - no KV / Durable Object / D1 / database
 * - no provider SDK / no raw secret / no API key propagation
 * - endpoint default stub / frontend local_stub / endpoint client
 *   default disabled remain preserved
 * - dependency adapter is NOT yet wired to the verifier (separate slice)
 * - storage adapter dependency wiring still passes
 * - docs reflect auth verifier adapter skeleton status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
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

const verifierCode = readFileSafe(VERIFIER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
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

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Module exists ────────────────────────────────────────────────────────
tests.push({
  name: 'Auth verifier adapter skeleton module exists',
  fn: () => {
    assert.ok(verifierCode.length > 0, 'verifier adapter module must exist');
  },
});

// ── 2. Module exports factory, version, codes, modes, fields, sanitizer ─────
tests.push({
  name: 'Module exports factory, version, codes, modes, allowlist, denylist, sanitizer',
  fn: async () => {
    const mod = await loadVerifierModule();
    assert.strictEqual(typeof mod.createScoutLiveAuthVerifierAdapter, 'function', 'factory must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION, 'string', 'version must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES, 'object', 'codes must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES, 'object', 'modes must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS, 'object', 'allowed fields must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS, 'object', 'prohibited fields must be exported');
    assert.strictEqual(typeof mod.sanitizeScoutLiveAuthVerifierPayload, 'function', 'sanitizePayload must be exported');
    const v = mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION.replace(/^v/, '');
    assert.ok(/^2026\d{4}-/.test(v), 'version must be a YYYYMMDD-N style string');
    // STAGING mode and code (contract slice v20260618-staging-verifier-contract-1)
    assert.strictEqual(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      'staging',
      'MODES must include STAGING: "staging"'
    );
    assert.strictEqual(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_STAGING_MOCK_VERIFIED,
      'VERIFIER_STAGING_MOCK_VERIFIED',
      'CODES must include VERIFIER_STAGING_MOCK_VERIFIED'
    );
  },
});

// ── 3. Default adapter is mock-disabled ────────────────────────────────────
tests.push({
  name: 'Factory default mockDisabled:true returns mock_disabled adapter',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    assert.strictEqual(adapter.kind, 'scout_live_auth_verifier_adapter', 'kind must be set');
    assert.strictEqual(adapter.version, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION, 'adapter version must match module version');
  },
});

// ── 4. Adapter object is frozen ────────────────────────────────────────────
tests.push({
  name: 'Adapter object is frozen (immutable)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(Object.isFrozen(adapter), true, 'adapter must be frozen');
  },
});

// ── 5. verifyToken safe-fails (mock-disabled) ──────────────────────────────
tests.push({
  name: 'Mock-disabled verifyToken returns { allowed:false, code: VERIFIER_MOCK_DISABLED, userKey:null }',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'mock-disabled verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED, 'code must be VERIFIER_MOCK_DISABLED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
    assert.strictEqual(res.userKey, null, 'userKey must be null in mock-disabled');
    assert.strictEqual(res.userKeyHash, null, 'userKeyHash must be null in mock-disabled');
  },
});

// ── 6. verifyToken result does not include raw token ───────────────────────
tests.push({
  name: 'verifyToken result never includes raw token / authorization / apiKey / firebaseToken',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
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

// ── 7. mockDisabled:false returns not-implemented shape ────────────────────
tests.push({
  name: 'Factory mockDisabled:false returns NOT_IMPLEMENTED adapter with same shape',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.mockDisabled, false, 'mockDisabled must be false');
    assert.strictEqual(adapter.isMockDisabled, false, 'isMockDisabled must be false');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED, 'mode must be NOT_IMPLEMENTED');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'not-implemented verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_NOT_IMPLEMENTED, 'code must be VERIFIER_NOT_IMPLEMENTED');
    assert.strictEqual(res.userKey, null, 'userKey must be null in not-implemented');
  },
});

// ── 8. sanitizePayload strips prohibited fields (drop mode) ───────────────
tests.push({
  name: 'sanitizePayload strips prohibited fields (drop mode) and keeps allowed fields',
  fn: async () => {
    const mod = await loadVerifierModule();
    const result = mod.sanitizeScoutLiveAuthVerifierPayload({
      requestId: 'req_test_123',
      tokenHash: 'hk_abc',
      authorizationScheme: 'Bearer',
      token: 'Bearer TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      rawToken: 'TEST_FIXTURE_RAW',
      authorization: 'Bearer TEST_FIXTURE_AUTH',
      apiKey: 'TEST_FIXTURE_KEY',
      firebaseToken: 'TEST_FIXTURE_FB',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
      unknownField: 'should be dropped',
    });
    assert.strictEqual(result.rejected, false, 'drop mode must not reject');
    const dropped = result.rejectedFields.sort();
    assert.ok(dropped.includes('token'), 'rejectedFields must include token');
    assert.ok(dropped.includes('rawToken'), 'rejectedFields must include rawToken');
    assert.ok(dropped.includes('authorization'), 'rejectedFields must include authorization');
    assert.ok(dropped.includes('apiKey'), 'rejectedFields must include apiKey');
    assert.ok(dropped.includes('firebaseToken'), 'rejectedFields must include firebaseToken');
    assert.ok(dropped.includes('prompt'), 'rejectedFields must include prompt');
    assert.ok(dropped.includes('excerpt'), 'rejectedFields must include excerpt');
    assert.ok(dropped.includes('sourceUrl'), 'rejectedFields must include sourceUrl');
    assert.ok(dropped.includes('rawRequestBody'), 'rejectedFields must include rawRequestBody');
    assert.strictEqual(result.payload.requestId, 'req_test_123', 'allowed field must be kept');
    assert.strictEqual(result.payload.tokenHash, 'hk_abc', 'allowed field must be kept');
    assert.strictEqual(result.payload.authorizationScheme, 'Bearer', 'allowed field must be kept');
    assert.strictEqual(result.payload.token, undefined, 'prohibited field must be dropped');
    assert.strictEqual(result.payload.unknownField, undefined, 'unknown field must be dropped');
  },
});

// ── 9. sanitizePayload reject mode ────────────────────────────────────────
tests.push({
  name: 'sanitizePayload reject mode returns rejected:true with rejectedFields',
  fn: async () => {
    const mod = await loadVerifierModule();
    const result = mod.sanitizeScoutLiveAuthVerifierPayload(
      { requestId: 'req_test_123', token: 'TEST_FIXTURE_TOKEN' },
      { onProhibitedField: 'reject' }
    );
    assert.strictEqual(result.rejected, true, 'reject mode must set rejected:true');
    assert.ok(result.rejectedFields.includes('token'), 'rejectedFields must include token');
    assert.strictEqual(result.payload.token, undefined, 'rejected payload must not contain prohibited field');
  },
});

// ── 10. No Firebase Admin SDK / getAuth / verifyIdToken in code ────────────
tests.push({
  name: 'No Firebase Admin SDK / getAuth / verifyIdToken / cert / initializeApp in code',
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

// ── 11. No external auth service / network call in code ───────────────────
tests.push({
  name: 'No fetch / XHR / axios / external auth network call in code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'verifier must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'verifier must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'verifier must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(code), 'verifier must not construct a new Request');
    assert.ok(!/https?:\/\//.test(code), 'verifier must not embed external auth service URL');
  },
});

// ── 12. No KV / Durable Object / D1 / database runtime access ──────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'verifier must not reference KVNamespace in code');
    assert.ok(!/durableobject/.test(code), 'verifier must not reference DurableObject in code');
    assert.ok(!/d1database/.test(code), 'verifier must not reference D1Database in code');
    assert.ok(!/env\.kv\b/.test(code), 'verifier must not read env.KV in code');
    assert.ok(!/env\.db\b/.test(code), 'verifier must not read env.DB in code');
    assert.ok(!/env\.auth/.test(code), 'verifier must not read env.AUTH in code');
    assert.ok(!/env\.firebase/.test(code), 'verifier must not read env.FIREBASE in code');
  },
});

// ── 13. No provider SDK imports ────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in code (OpenAI / Anthropic / Gemini / Groq / Mistral / NVIDIA etc.)',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `verifier must not import ${provider} in code`);
    }
  },
});

// ── 14. No secrets / env usage in code ─────────────────────────────────────
tests.push({
  name: 'No raw secret / env auth binding / process.env reading in code',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'verifier must not read process.env.SCOUT_* in code');
    assert.ok(!/import\.meta\.env/.test(code), 'verifier must not read import.meta.env in code');
    assert.ok(!/process\.env\.firebase/.test(code), 'verifier must not read process.env.FIREBASE_* in code');
    assert.ok(!/api_key\s*=/.test(code), 'verifier must not assign api_key in code');
    assert.ok(!/bearer\s+/.test(code), 'verifier must not embed bearer tokens in code');
  },
});

// ── 15. Prohibited payload fields are documented in module ─────────────────
tests.push({
  name: 'Prohibited payload fields are documented in module (denylist exported)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const prohibited = mod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS;
    assert.ok(Array.isArray(prohibited), 'prohibited fields must be an array');
    for (const field of ['token', 'rawToken', 'authorization', 'authorizationHeader', 'apiKey', 'secret', 'password', 'cookie', 'sessionCookie', 'firebaseToken', 'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody']) {
      assert.ok(prohibited.includes(field), `prohibited fields must include "${field}"`);
    }
  },
});

// ── 16. Allowed payload fields are documented in module ────────────────────
tests.push({
  name: 'Allowed payload fields are documented in module (allowlist exported)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const allowed = mod.SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS;
    assert.ok(Array.isArray(allowed), 'allowed fields must be an array');
    for (const field of ['requestId', 'tokenHash', 'authorizationScheme', 'providerMode', 'endpointPath', 'nowMs']) {
      assert.ok(allowed.includes(field), `allowed fields must include "${field}"`);
    }
  },
});

// ── 17. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 18. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 19. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no verifier adapter wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-verifier-adapter'),
      'endpoint client must not reference the verifier adapter'
    );
  },
});

// ── 20. No wiring into suggest.js LIVE branch in this slice ────────────────
tests.push({
  name: 'Verifier adapter module is NOT wired into suggest.js LIVE branch in this slice (out of scope)',
  fn: () => {
    assert.ok(
      !suggestCode.includes('live-auth-verifier-adapter'),
      'suggest.js must not import or reference the verifier adapter in this slice (wiring is a separate slice)'
    );
    assert.ok(
      !suggestCode.includes('createScoutLiveAuthVerifierAdapter'),
      'suggest.js must not call createScoutLiveAuthVerifierAdapter in this slice'
    );
  },
});

// ── 21. Dependency adapter wiring is a separate slice (no overclaim) ──────
tests.push({
  name: 'Verifier adapter skeleton does not overclaim — wiring into the dependency adapter is a separate slice',
  fn: () => {
    // The skeleton slice (v20260607-1) only added the verifier module. Wiring
    // the verifier adapter into the dependency adapter is a separate slice
    // (tech/scout-auth-verifier-dependency-wiring). This test locks the
    // skeleton's "module-only" property by asserting that the verifier
    // module itself does not reach into the dependency adapter.
    assert.ok(
      !verifierCode.includes('live-auth-rate-limit-dependency-adapter'),
      'verifier adapter must not import the dependency adapter module'
    );
    assert.ok(
      !verifierCode.includes('createScoutLiveDependencyAdapter'),
      'verifier adapter must not call createScoutLiveDependencyAdapter'
    );
  },
});

// ── 22. Storage adapter dependency wiring still passes ─────────────────────
tests.push({
  name: 'Storage adapter dependency wiring remains intact (dep adapter still imports createScoutLiveRateLimitStorageAdapter)',
  fn: () => {
    assert.ok(
      depAdapterCode.includes('createScoutLiveRateLimitStorageAdapter'),
      'dependency adapter must still import createScoutLiveRateLimitStorageAdapter (wiring from previous slice)'
    );
    assert.ok(
      depAdapterCode.includes('storageAdapter'),
      'dependency adapter must still accept a storageAdapter option'
    );
  },
});

// ── 23. Verifier adapter skeleton doc exists and reflects status ───────────
tests.push({
  name: 'Verifier adapter skeleton doc exists and reflects skeleton status',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-verifier-adapter-skeleton.md');
    const doc = readFileSafe(docPath);
    assert.ok(doc.length > 0, 'verifier adapter skeleton doc must exist');
    const lc = doc.toLowerCase();
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock_disabled') || lc.includes('mock disabled'), 'doc must mention mock-disabled');
    assert.ok(lc.includes('verifytoken'), 'doc must mention verifyToken');
    assert.ok(lc.includes('firebase') || lc.includes('admin sdk'), 'doc must mention Firebase / Admin SDK');
    assert.ok(lc.includes('getauth') || lc.includes('verifyidtoken') || lc.includes('verify_id_token'), 'doc must mention getAuth / verifyIdToken');
    assert.ok(lc.includes('tokenhash') || lc.includes('token_hash'), 'doc must mention tokenHash');
    assert.ok(lc.includes('prohibited') || lc.includes('denylist') || lc.includes('deny list'), 'doc must mention prohibited fields');
    assert.ok(lc.includes('no-go') || lc.includes('no go') || lc.includes('blocked') || lc.includes('not yet'), 'doc must mark real verification as not yet ready');
    assert.ok(lc.includes('staging') && lc.includes('production') && lc.includes('blocked'), 'doc must mark staging_live and production_live as blocked');
  },
});

// ── 24. Related docs reflect verifier adapter skeleton status ─────────────
tests.push({
  name: 'Related docs exist and reflect verifier adapter skeleton status',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
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
