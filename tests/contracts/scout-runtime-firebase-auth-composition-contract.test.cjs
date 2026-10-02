/**
 * Scout Runtime Firebase Auth Composition Contract Tests
 * v20260616-runtime-firebase-auth-composition-1
 *
 * Issue #4536 Slice A — locks the gated runtime Firebase auth composition
 * in the Scout live path. SOURCE ONLY / DISABLED BY DEFAULT.
 *
 * Proves:
 * - `SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED` is default OFF and only the exact
 *   `true` value enables composition;
 * - gate absent/false => no shared verifier construction, no JWK fetch, and
 *   the existing mock-disabled endpoint behavior is preserved;
 * - gate true + malformed/missing Bearer => auth safe-fail, provider not
 *   reached, no JWK fetch;
 * - gate true + invalid Firebase token => auth safe-fail, provider not
 *   reached;
 * - gate true + valid synthetic Firebase token/JWK fixture => sanitized
 *   VERIFIED state with only a 16-hex `userKeyHash` crossing the boundary;
 * - VERIFIED + no persistent limiter => `RATE_LIMIT_UNAVAILABLE` / 503 with
 *   provider transport call count = 0 (and Engine transport untouched);
 * - raw token / Authorization / UID / email / claims / JWK body / verifier
 *   exception detail never appear in the response, observer metadata, or the
 *   composition result;
 * - frontend default `local_stub`, Engine gate/default, and the Production
 *   provider stage block remain unchanged;
 * - checked-in config never activates the gate;
 * - no Firebase Admin SDK, no second JWT verifier, no persistent
 *   rate-limit backend, no network/provider call.
 *
 * Synthetic/local fixtures only. No real Firebase token, user, project,
 * provider, or external network call.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const COMPOSITION_PATH = path.join(ROOT, 'functions/api/scout/runtime-auth-composition.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SHARED_VERIFIER_PATH = path.join(ROOT, 'functions/_shared/firebase-id-token-verifier.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const WRANGLER_PATH = path.join(ROOT, 'wrangler.toml');

const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

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

const suggestCode = readFileSafe(SUGGEST_PATH);
const compositionCode = readFileSafe(COMPOSITION_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const wranglerCode = readFileSafe(WRANGLER_PATH);

let compositionModulePromise = null;
async function loadCompositionModule() {
  if (!compositionModulePromise) compositionModulePromise = importAbsolute(COMPOSITION_PATH);
  return compositionModulePromise;
}

let sharedVerifierModulePromise = null;
async function loadSharedVerifierModule() {
  if (!sharedVerifierModulePromise) sharedVerifierModulePromise = importAbsolute(SHARED_VERIFIER_PATH);
  return sharedVerifierModulePromise;
}

let suggestModulePromise = null;
async function loadSuggestModule() {
  if (!suggestModulePromise) suggestModulePromise = importAbsolute(SUGGEST_PATH);
  return suggestModulePromise;
}

// ─── Synthetic Firebase fixture (local only, no network) ────────────────────

const cryptoImpl = require('node:crypto').webcrypto;
const encoder = new TextEncoder();

const SYNTHETIC_UID = 'synthetic-firebase-uid-4536';
const SYNTHETIC_EMAIL = 'synthetic-4536@example.invalid';
const SYNTHETIC_PROJECT_ID = 'synthetic-project-4536';

let fixtureCounter = 0;

function b64url(input) {
  const bytes = (input instanceof Uint8Array) ? input : encoder.encode(String(input));
  return Buffer.from(bytes).toString('base64url');
}

function b64urlJson(value) {
  return b64url(JSON.stringify(value));
}

/**
 * Build a synthetic RS256 Firebase-style ID token plus the matching
 * synthetic JWK metadata payload. Local Web Crypto only.
 */
async function createSyntheticFirebaseFixture(overrides = {}) {
  fixtureCounter += 1;
  const projectId = overrides.projectId || SYNTHETIC_PROJECT_ID;
  const uid = overrides.uid || SYNTHETIC_UID;
  const nowMs = Number.isFinite(overrides.nowMs) ? overrides.nowMs : Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const kid = `synthetic-kid-${fixtureCounter}-${nowMs.toString(36)}`;

  const keyPair = await cryptoImpl.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const exportedJwk = await cryptoImpl.subtle.exportKey('jwk', keyPair.publicKey);
  const signingJwk = Object.assign({}, exportedJwk, { kid, alg: 'RS256', use: 'sig' });

  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const claims = {
    sub: uid,
    aud: overrides.aud || projectId,
    iss: overrides.iss || `https://securetoken.google.com/${projectId}`,
    iat: nowSeconds - 60,
    auth_time: nowSeconds - 60,
    exp: nowSeconds + 3600,
    email: overrides.email || SYNTHETIC_EMAIL,
  };

  const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const signature = await cryptoImpl.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    keyPair.privateKey,
    encoder.encode(signingInput)
  );

  return {
    projectId,
    uid: claims.sub,
    email: claims.email,
    kid,
    token: `${signingInput}.${b64url(new Uint8Array(signature))}`,
    jwksPayload: { keys: [signingJwk] },
    nowMs,
  };
}

/**
 * Synthetic fetch double. Records every call; only the Firebase JWK URL is
 * answered, any other (provider/transport) URL is refused and still counted.
 */
function createSyntheticFetch(jwksPayload, calls = []) {
  const fetchImpl = async function syntheticFetch(url, init) {
    const urlStr = String(url);
    calls.push({ url: urlStr, method: (init && init.method) || 'GET' });
    if (urlStr === FIREBASE_JWK_URL) {
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'cache-control' ? 'max-age=300' : null) },
        json: async () => jwksPayload,
      };
    }
    return {
      ok: false,
      status: 599,
      headers: { get: () => null },
      json: async () => ({}),
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function countNonJwkCalls(calls) {
  return calls.filter((c) => c.url !== FIREBASE_JWK_URL).length;
}

function countJwkCalls(calls) {
  return calls.filter((c) => c.url === FIREBASE_JWK_URL).length;
}

// ─── Endpoint request double (matches Scout contract family) ────────────────

function createMockRequest(options = {}) {
  const headers = new Map();
  headers.set('content-type', 'application/json');
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k.toLowerCase(), v);
    }
  }
  return {
    method: options.method || 'POST',
    headers: {
      get: (name) => headers.get(String(name).toLowerCase()) || null,
    },
    text: async () => JSON.stringify(options.body || {}),
  };
}

const validBody = {
  excerpt: 'Synthetic excerpt for the #4536 runtime auth composition contract.',
  desiredTone: 'polite',
  requestedLanguage: 'ko',
  maxOutputLength: 200,
};

function liveEnv(fixture, gateValue) {
  const env = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_LLM_API_KEY: 'synthetic-not-a-real-key',
    SCOUT_SUGGEST_MODEL: 'synthetic-model',
    FIREBASE_PROJECT_ID: fixture ? fixture.projectId : SYNTHETIC_PROJECT_ID,
  };
  if (gateValue !== undefined) env.SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED = gateValue;
  return env;
}

function createRecordingObserver() {
  const events = [];
  return {
    events,
    recordBoundaryDecision(event) {
      events.push(event);
    },
  };
}

/**
 * Run the endpoint with a realistic portable env. Request body is provided
 * as text so importAbsolute can attach the stream-backed body double.
 */
async function runEndpoint({ env, authorization, observer, fetchImpl }) {
  const mod = await loadSuggestModule();
  const context = {
    request: createMockRequest({
      body: validBody,
      headers: authorization ? { authorization } : {},
    }),
    env,
  };
  if (observer) context.observer = observer;
  if (fetchImpl) context.fetch = fetchImpl;
  const res = await mod.onRequestPost(context);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const tests = [];

// 1. Gate name + strict true-only evaluation
tests.push({
  name: 'Gate SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED is strict-true-only and default OFF',
  fn: async () => {
    const mod = await loadCompositionModule();
    assert.strictEqual(mod.SCOUT_RUNTIME_FIREBASE_AUTH_GATE, 'SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED');
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({}), false);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: '' }), false);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'false' }), false);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: '1' }), false);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'yes' }), false);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true' }), true);
    assert.strictEqual(mod.isScoutRuntimeFirebaseAuthEnabled({ SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: ' TRUE ' }), true);
  },
});

// 2. Gate off => no verifier construction, no JWK fetch
tests.push({
  name: 'Gate absent/false => no verifier construction and no JWK fetch',
  fn: async () => {
    const mod = await loadCompositionModule();
    const calls = [];
    const throwingFetch = createSyntheticFetch({ keys: [] }, calls);
    for (const gateValue of [undefined, 'false', '']) {
      const env = gateValue === undefined ? {} : { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: gateValue };
      const result = mod.composeScoutRuntimeFirebaseAuth({
        env,
        fetchImpl: throwingFetch,
        cryptoImpl,
      });
      assert.strictEqual(result.status, mod.SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.GATE_DISABLED);
      assert.strictEqual(result.enabled, false);
      assert.strictEqual(result.verifierConstructed, false);
      assert.strictEqual(result.dependencyAdapter, null);
      assert.strictEqual(result.authBoundary, null);
    }
    assert.strictEqual(calls.length, 0, 'gate off must not fetch JWKs');
  },
});

// 3. Gate off endpoint preserves mock-disabled behavior
tests.push({
  name: 'Gate off endpoint with Bearer preserves mock-disabled 401 and makes no network call',
  fn: async () => {
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const { res, body } = await runEndpoint({
      env: liveEnv(fixture, undefined),
      authorization: `Bearer ${fixture.token}`,
      fetchImpl,
    });
    assert.strictEqual(res.status, 401, 'mock-disabled auth must safe-fail with 401');
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_INVALID');
    assert.strictEqual(calls.length, 0, 'gate off must not fetch JWKs or providers');
  },
});

// 4. Gate true + injected DI => DI precedence, still no verifier construction
tests.push({
  name: 'Gate true with injected live dependencies => no verifier construction (DI precedence)',
  fn: async () => {
    const mod = await loadCompositionModule();
    const calls = [];
    const fetchImpl = createSyntheticFetch({ keys: [] }, calls);
    const result = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true' },
      context: { liveAdapter: { verifyToken: async () => ({ allowed: false }) } },
      fetchImpl,
      cryptoImpl,
    });
    assert.strictEqual(result.status, mod.SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.INJECTED_DEPENDENCIES);
    assert.strictEqual(result.verifierConstructed, false);
    assert.strictEqual(result.dependencyAdapter, null);
    assert.strictEqual(result.authBoundary, null);
    assert.strictEqual(calls.length, 0, 'DI precedence must not fetch JWKs');
  },
});

// 5. Gate true + missing/malformed Bearer => auth fail before any fetch
tests.push({
  name: 'Gate true + missing/malformed Bearer => auth fail, no JWK fetch, provider not reached',
  fn: async () => {
    const mod = await loadCompositionModule();
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const composition = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true', FIREBASE_PROJECT_ID: fixture.projectId },
      fetchImpl,
      cryptoImpl,
      now: () => fixture.nowMs,
    });
    assert.strictEqual(composition.status, mod.SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.FIREBASE_RUNTIME);
    assert.strictEqual(composition.verifierConstructed, true);
    assert.ok(composition.dependencyAdapter);
    assert.ok(composition.authBoundary);

    const verifyToken = composition.dependencyAdapter.verifyToken;
    const cases = [
      { authorization: undefined, status: 'auth_required', code: 'AUTH_REQUIRED' },
      { authorization: 'Token not-bearer', status: 'auth_invalid', code: 'AUTH_INVALID' },
      { authorization: 'Bearer ', status: 'auth_invalid', code: 'AUTH_INVALID' },
      { authorization: `Bearer ${'x'.repeat(5000)}`, status: 'auth_invalid', code: 'AUTH_INVALID' },
    ];
    for (const testCase of cases) {
      const headers = testCase.authorization === undefined ? {} : { authorization: testCase.authorization };
      const result = await composition.authBoundary.authenticate({ headers }, { verifyToken });
      assert.strictEqual(result.ok, false, `auth must fail for ${String(testCase.authorization).slice(0, 20)}`);
      assert.strictEqual(result.status, testCase.status);
      assert.strictEqual(result.error.code, testCase.code);
      assert.ok(result.token == null, 'failure result must not carry a token');
    }
    assert.strictEqual(calls.length, 0, 'malformed Bearer must not trigger a JWK fetch');
  },
});

// 6. Gate true + invalid Firebase token => auth safe-fail
tests.push({
  name: 'Gate true + invalid Firebase token (bad signature / wrong audience) => auth safe-fail, provider 0',
  fn: async () => {
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);

    // Bad signature: structurally valid JWT with a tampered signature.
    const parts = fixture.token.split('.');
    const badSignature = `${parts[0]}.${parts[1]}.${b64url('tampered-signature-bytes')}`;
    const badSignatureRun = await runEndpoint({
      env: liveEnv(fixture, 'true'),
      authorization: `Bearer ${badSignature}`,
      fetchImpl,
    });
    assert.strictEqual(badSignatureRun.res.status, 401);
    assert.strictEqual(badSignatureRun.body.error.code, 'AUTH_INVALID');

    // Wrong audience: fails claim validation without provider reach.
    const wrongAudienceFixture = await createSyntheticFirebaseFixture({
      aud: 'synthetic-project-other',
    });
    const wrongAudienceRun = await runEndpoint({
      env: liveEnv(fixture, 'true'),
      authorization: `Bearer ${wrongAudienceFixture.token}`,
      fetchImpl,
    });
    assert.strictEqual(wrongAudienceRun.res.status, 401);
    assert.strictEqual(wrongAudienceRun.body.error.code, 'AUTH_INVALID');

    assert.strictEqual(countNonJwkCalls(calls), 0, 'invalid tokens must never reach a provider transport');
  },
});

// 7. Gate true + valid synthetic token => sanitized VERIFIED
tests.push({
  name: 'Gate true + valid synthetic Firebase token/JWK => sanitized VERIFIED userKeyHash only',
  fn: async () => {
    const mod = await loadCompositionModule();
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const composition = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true', FIREBASE_PROJECT_ID: fixture.projectId },
      fetchImpl,
      cryptoImpl,
      now: () => fixture.nowMs,
    });
    const authResult = await composition.authBoundary.authenticate(
      { headers: { authorization: `Bearer ${fixture.token}` } },
      { verifyToken: composition.dependencyAdapter.verifyToken }
    );
    assert.strictEqual(authResult.ok, true, 'valid synthetic token must verify');
    assert.strictEqual(authResult.status, 'authenticated');
    assert.match(authResult.userKey, /^[0-9a-f]{16}$/, 'only a 16-hex sanitized userKeyHash may cross');
    assert.notStrictEqual(authResult.userKey, fixture.token);
    assert.strictEqual(authResult.token, null);
    assert.strictEqual(authResult.error, null);
    assert.ok(countJwkCalls(calls) >= 1, 'a valid token requires JWK metadata lookup');
    assert.strictEqual(countNonJwkCalls(calls), 0, 'auth verification must not call providers');
  },
});

// 8. Endpoint: VERIFIED + no persistent limiter => 503 RATE_LIMIT_UNAVAILABLE, provider 0
tests.push({
  name: 'Gate true + valid synthetic token + no limiter => 503 RATE_LIMIT_UNAVAILABLE with provider transport calls = 0',
  fn: async () => {
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const observer = createRecordingObserver();
    const { res, body } = await runEndpoint({
      env: liveEnv(fixture, 'true'),
      authorization: `Bearer ${fixture.token}`,
      fetchImpl,
      observer,
    });
    assert.strictEqual(res.status, 503, 'VERIFIED auth with no persistent limiter must fail closed with 503');
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'RATE_LIMIT_UNAVAILABLE');
    assert.strictEqual(res.headers.get('x-lovebud-route-status'), 'rate-limit-unavailable');
    assert.strictEqual(countNonJwkCalls(calls), 0, 'provider transport call count must be 0');
    assert.ok(countJwkCalls(calls) >= 1, 'auth ran against synthetic JWK metadata');
    // Auth must have been recorded as authenticated before the rate-limit stop.
    const authEvent = observer.events.find((e) => e.boundaryDecision === 'authenticated');
    assert.ok(authEvent, 'observer must record the authenticated decision');
    assert.strictEqual(authEvent.errorCode, null);
    // Engine transport stays untouched from this path.
    assert.strictEqual(res.headers.get('x-lovebud-upstream'), 'cloudflare');
  },
});

// 9. Leak scan across response/observer/composition surfaces
tests.push({
  name: 'Sensitive leak count = 0 across response, observer metadata, and composition result',
  fn: async () => {
    const fixture = await createSyntheticFirebaseFixture();
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const observer = createRecordingObserver();
    const { res, body } = await runEndpoint({
      env: liveEnv(fixture, 'true'),
      authorization: `Bearer ${fixture.token}`,
      fetchImpl,
      observer,
    });
    const mod = await loadCompositionModule();
    const composition = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true', FIREBASE_PROJECT_ID: fixture.projectId },
      fetchImpl,
      cryptoImpl,
      now: () => fixture.nowMs,
    });

    const surfaces = {
      responseBody: JSON.stringify(body),
      observerMetadata: JSON.stringify(observer.events),
      compositionMetadata: JSON.stringify({
        status: composition.status,
        enabled: composition.enabled,
        verifierConstructed: composition.verifierConstructed,
      }),
    };
    const forbidden = [
      fixture.token,
      fixture.uid,
      fixture.email,
      fixture.token.split('.')[1],
      'Bearer',
      'Authorization',
      fixture.jwksPayload.keys[0].n,
      fixture.jwksPayload.keys[0].e,
      'FIREBASE_JWK',
      'FIREBASE_SIGNATURE',
      'firebaseVerifier',
    ];
    let leaks = 0;
    for (const [surfaceName, text] of Object.entries(surfaces)) {
      for (const needle of forbidden) {
        if (typeof needle === 'string' && needle.length > 0 && text.includes(needle)) {
          leaks += 1;
          assert.fail(`leak in ${surfaceName}: ${needle.slice(0, 24)}`);
        }
      }
    }
    assert.strictEqual(leaks, 0, 'sensitive field leak count must be 0');
    assert.strictEqual(res.status, 503);
  },
});

// 10. FIREBASE_PROJECT_ID authority (no hardcoded default in composition)
tests.push({
  name: 'Composition reads FIREBASE_PROJECT_ID authority (project-mismatched token fails)',
  fn: async () => {
    const mod = await loadCompositionModule();
    const fixture = await createSyntheticFirebaseFixture({ projectId: 'synthetic-project-authority-a' });
    const otherProjectFixture = await createSyntheticFirebaseFixture({ projectId: 'synthetic-project-authority-b' });
    const calls = [];
    const fetchImpl = createSyntheticFetch(fixture.jwksPayload, calls);
    const composition = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true', FIREBASE_PROJECT_ID: fixture.projectId },
      fetchImpl,
      cryptoImpl,
      now: () => fixture.nowMs,
    });
    const mismatch = await composition.authBoundary.authenticate(
      { headers: { authorization: `Bearer ${otherProjectFixture.token}` } },
      { verifyToken: composition.dependencyAdapter.verifyToken }
    );
    assert.strictEqual(mismatch.ok, false, 'token for another project must not verify');
    assert.strictEqual(mismatch.error.code, 'AUTH_INVALID');
  },
});

// 11. Composition failure is fail-closed (missing Web Crypto)
tests.push({
  name: 'Composition construction failure is fail-closed (no crypto => unavailable, no provider path)',
  fn: async () => {
    const mod = await loadCompositionModule();
    const calls = [];
    const fetchImpl = createSyntheticFetch({ keys: [] }, calls);
    const result = mod.composeScoutRuntimeFirebaseAuth({
      env: { SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED: 'true' },
      fetchImpl,
      cryptoImpl: {},
    });
    assert.strictEqual(result.status, mod.SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.FIREBASE_RUNTIME_UNAVAILABLE);
    assert.strictEqual(result.verifierConstructed, false);
    assert.strictEqual(result.dependencyAdapter, null);
    assert.strictEqual(result.authBoundary, null);
    assert.strictEqual(calls.length, 0, 'fail-closed construction must not fetch docs/JWKs');
  },
});

// 12. Reuse-only + no new verifier / no Firebase Admin SDK / no persistent store
tests.push({
  name: 'Composition reuses the shared verifier; no Firebase Admin SDK, no second JWT verifier, no persistent store',
  fn: () => {
    assert.ok(compositionCode.includes('../../_shared/firebase-id-token-verifier.js'));
    assert.ok(compositionCode.includes('readFirebaseProjectId'));
    assert.ok(compositionCode.includes('createFirebaseIdTokenVerifier'));
    assert.ok(compositionCode.includes('live-auth-verifier-adapter.js'));
    assert.ok(compositionCode.includes('live-auth-rate-limit-dependency-adapter.js'));
    assert.ok(compositionCode.includes('live-auth-rate-limit-boundary.js'));
    assert.ok(compositionCode.includes('allowRawTokenHandoff: true'));
    assert.ok(compositionCode.includes('includeIdTokenForVerifier: true'));

    const codeOnly = stripComments(compositionCode).toLowerCase();
    for (const marker of ['firebase-admin', 'initializeapp(', 'getauth(', 'jsonwebtoken', 'from \'jose\'', 'from "jose"']) {
      assert.ok(!codeOnly.includes(marker), `composition must not reference ${marker}`);
    }
    assert.ok(!codeOnly.includes('storage-adapter'), 'no persistent rate-limit storage adapter may be wired');
    assert.ok(!codeOnly.includes('durable'), 'no Durable Object backend may be wired');
    assert.ok(!codeOnly.includes('env.kv'), 'no KV binding may be read');
    assert.ok(!codeOnly.includes('fetch('), 'composition must not call fetch directly (delegates to the shared verifier)');
  },
});

// 13. Endpoint wiring stays minimal and after the LIVE guard
tests.push({
  name: 'suggest.js wires the composition inside the LIVE branch only, preserving defaults',
  fn: () => {
    assert.ok(suggestCode.includes('composeScoutRuntimeFirebaseAuth'), 'suggest.js must call the composition helper');
    assert.ok(suggestCode.includes('runtime-auth-composition.js'), 'suggest.js must import the composition helper');
    const liveBranchIdx = suggestCode.indexOf('SCOUT_SUGGEST_PROVIDER_MODES.LIVE');
    const compositionCallIdx = suggestCode.indexOf('composeScoutRuntimeFirebaseAuth({ env, context })');
    assert.ok(liveBranchIdx > -1, 'LIVE branch guard must exist');
    assert.ok(compositionCallIdx > liveBranchIdx, 'composition must be constructed after the LIVE branch guard');
    const defaultAdapterIdx = suggestCode.indexOf('createScoutLiveDependencyAdapter({ mockDisabled: true })');
    assert.ok(defaultAdapterIdx > liveBranchIdx, 'mock-disabled fallback must remain in the LIVE branch');
    const normalizedSuggest = suggestCode.replace(/\r\n/g, '\n');
    assert.ok(
      normalizedSuggest.includes(
        'runtimeAuthBoundary\n      ? await runtimeAuthBoundary.authenticate(request, liveDependencies)\n      : await verifyScoutLiveAuthBoundary(request, liveDependencies)'
      ),
      'boundary selection must fall back to the existing one-shot wrapper'
    );
    assert.ok(
      suggestCode.includes('context?.liveAdapter') && suggestCode.includes('context?.liveDependencies'),
      'existing DI seams must be preserved'
    );
  },
});

// 14. Frontend / Engine / Production defaults unchanged
tests.push({
  name: 'Frontend local_stub, Engine gate, and Production provider stage block remain unchanged',
  fn: () => {
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend default must remain local_stub');
    assert.ok(
      suggestCode.includes("String(env?.SCOUT_ENGINE_TRANSPORT_ENABLED || '').toLowerCase() === 'true'"),
      'Engine transport gate/default must remain unchanged'
    );
    assert.ok(suggestCode.includes("const stageOk = stage === 'staging' || stage === 'test';"));
    assert.ok(
      suggestCode.includes('&& stageOk'),
      'provider transport must still require staging/test stage'
    );
    const compositionOnly = stripComments(compositionCode);
    assert.ok(!compositionOnly.includes('SCOUT_SUGGEST_PROVIDER_STAGE'), 'composition must not touch provider stage config');
  },
});

// 15. Checked-in config never activates the gate
tests.push({
  name: 'Checked-in config never enables SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED=true',
  fn: () => {
    assert.ok(wranglerCode.length > 0, 'wrangler.toml must be readable');
    assert.ok(
      !/SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED\s*=\s*"?true/i.test(wranglerCode),
      'wrangler.toml must not activate the gate'
    );
    const functionsDir = path.join(ROOT, 'functions');
    const mentioning = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          if (readFileSafe(p).includes('SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED')) {
            mentioning.push(path.relative(ROOT, p).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(functionsDir);
    assert.deepStrictEqual(
      mentioning,
      ['functions/api/scout/runtime-auth-composition.js'],
      'the gate name must be defined only in the composition helper'
    );
  },
});

// 16. Documentation of the slice exists (authority allows one concise doc)
tests.push({
  name: 'Concise #4536 runtime-auth composition doc exists and states the stop property',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-runtime-firebase-auth-composition.md');
    const doc = readFileSafe(docPath);
    assert.ok(doc.length > 0, 'runtime auth composition doc must exist');
    const lc = doc.toLowerCase();
    assert.ok(lc.includes('scout_runtime_firebase_auth_enabled'), 'doc must name the gate');
    assert.ok(lc.includes('rate_limit_unavailable'), 'doc must state the rate-limit stop property');
    assert.ok(lc.includes('default') && lc.includes('off'), 'doc must state the default is OFF');
  },
});

// ─── Runner ─────────────────────────────────────────────────────────────────

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
