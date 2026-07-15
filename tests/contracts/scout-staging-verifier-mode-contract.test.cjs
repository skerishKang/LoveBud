/**
 * Scout Staging Verifier Mode Contract Tests
 * v20260618-staging-verifier-contract-1
 *
 * Locks the staging verifier mode contract for the Scout live auth path:
 * - STAGING mode enum exists in verifier adapter
 * - STAGING success code exists (VERIFIER_STAGING_MOCK_VERIFIED)
 * - Default mockDisabled:true remains unchanged (mock-disabled wins)
 * - STAGING mode + mockDisabled:true → safe-fail (MOCK_DISABLED)
 * - STAGING mode + mockDisabled:false + missing stagingVerifier → safe-fail (NOT_IMPLEMENTED)
 * - STAGING mode + mockDisabled:false + explicit DI stagingVerifier → sanitized allowed:true possible
 * - Raw token/auth/secret never propagated
 * - Dependency adapter DI boundary documented
 * - suggest.js default unchanged
 * - Production activation not introduced
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');

const verifierCode = fs.readFileSync(VERIFIER_PATH, 'utf-8');
const depAdapterCode = fs.readFileSync(DEP_ADAPTER_PATH, 'utf-8');
const suggestCode = fs.readFileSync(SUGGEST_PATH, 'utf-8');

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) {
    verifierModulePromise = importAbsolute(VERIFIER_PATH);
  }
  return verifierModulePromise;
}

let depAdapterModulePromise = null;
async function loadDepAdapterModule() {
  if (!depAdapterModulePromise) {
    depAdapterModulePromise = importAbsolute(DEP_ADAPTER_PATH);
  }
  return depAdapterModulePromise;
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. STAGING mode enum exists ──────────────────────────────────────────────
tests.push({
  name: 'Verifier adapter exports STAGING mode constant',
  fn: async () => {
    const mod = await loadVerifierModule();
    assert.strictEqual(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      'staging',
      'MODES.STAGING must equal "staging"'
    );
  },
});

// ── 2. STAGING success code exists ───────────────────────────────────────────
tests.push({
  name: 'Verifier adapter exports VERIFIER_STAGING_MOCK_VERIFIED code',
  fn: async () => {
    const mod = await loadVerifierModule();
    assert.strictEqual(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_STAGING_MOCK_VERIFIED,
      'VERIFIER_STAGING_MOCK_VERIFIED',
      'CODES.VERIFIER_STAGING_MOCK_VERIFIED must equal "VERIFIER_STAGING_MOCK_VERIFIED"'
    );
  },
});

// ── 3. Default mockDisabled:true unchanged ───────────────────────────────────
tests.push({
  name: 'Default factory (no options) returns MOCK_DISABLED adapter',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED,
      'default mode must be MOCK_DISABLED'
    );
  },
});

// ── 4. STAGING + mockDisabled:true → MOCK_DISABLED wins ──────────────────────
tests.push({
  name: 'STAGING mode with mockDisabled:true returns MOCK_DISABLED (mock-disabled wins)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: true,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier: async () => ({ uid: 'test' }),
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED,
      'mockDisabled:true must win over STAGING mode'
    );
    assert.strictEqual(adapter.mockDisabled, true, 'mockDisabled must be true');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'mock-disabled must deny');
    assert.strictEqual(
      res.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED,
      'code must be VERIFIER_MOCK_DISABLED'
    );
  },
});

// ── 5. STAGING + mockDisabled:false + missing stagingVerifier → NOT_IMPLEMENTED
tests.push({
  name: 'STAGING mode with mockDisabled:false but missing stagingVerifier safe-fails to NOT_IMPLEMENTED',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      // NO stagingVerifier provided
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED,
      'missing stagingVerifier must result in NOT_IMPLEMENTED mode'
    );
    assert.strictEqual(adapter.hasStagingVerifier, false, 'hasStagingVerifier must be false');
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'missing stagingVerifier must deny');
    assert.strictEqual(
      res.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_NOT_IMPLEMENTED,
      'code must be VERIFIER_NOT_IMPLEMENTED'
    );
  },
});

// ── 6. STAGING + mockDisabled:false + explicit DI stagingVerifier → sanitized allowed:true
tests.push({
  name: 'STAGING mode with explicit DI stagingVerifier returns sanitized allowed:true',
  fn: async () => {
    const mod = await loadVerifierModule();
    const stagingVerifier = async (idToken) => ({
      uid: 'staging-user-' + idToken.slice(0, 8),
    });
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      'mode must be STAGING when all conditions met'
    );
    assert.strictEqual(adapter.hasStagingVerifier, true, 'hasStagingVerifier must be true');
    assert.strictEqual(adapter.mockDisabled, false, 'mockDisabled must be false');

    const res = await adapter.verifyToken({
      idToken: 'test-staging-token-12345',
      requestId: 'req_test_123',
    });
    assert.strictEqual(res.allowed, true, 'staging verifier must allow');
    assert.strictEqual(
      res.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_STAGING_MOCK_VERIFIED,
      'code must be VERIFIER_STAGING_MOCK_VERIFIED'
    );
    assert.strictEqual(res.userKey, null, 'userKey must be null (sanitized)');
    assert.strictEqual(
      typeof res.userKeyHash,
      'string',
      'userKeyHash must be a string'
    );
    assert.strictEqual(res.userKeyHash.length, 16, 'userKeyHash must be 16 chars');
    assert.ok(/^[0-9a-f]{16}$/.test(res.userKeyHash), 'userKeyHash must be lowercase hex');
    assert.ok(
      typeof res.reason === 'string' && res.reason.length > 0,
      'reason must be non-empty string'
    );
  },
});

// ── 7. STAGING adapter reject mode for prohibited fields ─────────────────────
tests.push({
  name: 'STAGING adapter rejects payload with prohibited fields (strict reject policy)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const stagingVerifier = async (idToken) => ({ uid: 'staging-user' });
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });

    const res = await adapter.verifyToken({
      idToken: 'test-token',
      token: 'Bearer TEST_FIXTURE_TOKEN', // prohibited
      authorization: 'Bearer TEST_FIXTURE_AUTH', // prohibited
    });
    assert.strictEqual(res.allowed, false, 'prohibited fields must cause deny');
    assert.strictEqual(
      res.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED,
      'code must be VERIFIER_FIREBASE_RUNTIME_FAILED for prohibited payload'
    );
  },
});

// ── 8. STAGING adapter requires non-empty idToken ────────────────────────────
tests.push({
  name: 'STAGING adapter denies empty/missing idToken',
  fn: async () => {
    const mod = await loadVerifierModule();
    const stagingVerifier = async (idToken) => ({ uid: 'staging-user' });
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });

    // Missing idToken
    const res1 = await adapter.verifyToken({ requestId: 'req_1' });
    assert.strictEqual(res1.allowed, false, 'missing idToken must deny');

    // Empty idToken
    const res2 = await adapter.verifyToken({ idToken: '', requestId: 'req_2' });
    assert.strictEqual(res2.allowed, false, 'empty idToken must deny');
  },
});

// ── 9. STAGING adapter sanitizes raw verifier result (only userKeyHash) ──────
tests.push({
  name: 'STAGING adapter returns only sanitized userKeyHash, never raw uid/email/claims',
  fn: async () => {
    const mod = await loadVerifierModule();
    const stagingVerifier = async (idToken) => ({
      uid: 'real-uid-123',
      email: 'test@example.com',
      claims: { admin: true },
      customField: 'should-not-appear',
    });
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });

    const res = await adapter.verifyToken({ idToken: 'test-token' });
    const flat = JSON.stringify(res).toLowerCase();
    assert.strictEqual(res.allowed, true, 'must allow');
    assert.strictEqual(res.userKey, null, 'userKey must be null');
    assert.ok(!flat.includes('real-uid-123'), 'raw uid must not appear in response');
    assert.ok(!flat.includes('test@example.com'), 'raw email must not appear');
    assert.ok(!flat.includes('admin'), 'raw claims must not appear');
    assert.ok(!flat.includes('customfield'), 'arbitrary fields must not appear');
    assert.ok(res.userKeyHash && res.userKeyHash.length === 16, 'only userKeyHash propagated');
  },
});

// ── 10. Dependency adapter DI boundary for STAGING verifier ──────────────────
tests.push({
  name: 'Dependency adapter documents staging verifier DI boundary (JSDoc)',
  fn: () => {
    assert.ok(
      depAdapterCode.includes('stagingVerifier'),
      'dep adapter JSDoc must mention stagingVerifier DI'
    );
    assert.ok(
      depAdapterCode.includes('STAGING'),
      'dep adapter JSDoc must mention STAGING mode'
    );
    assert.ok(
      depAdapterCode.includes('createScoutLiveAuthVerifierAdapter'),
      'dep adapter must still reference verifier adapter factory'
    );
    assert.ok(
      depAdapterCode.includes('ONLY way to activate staging'),
      'dep adapter JSDoc must state DI is only activation path'
    );
    assert.ok(
      depAdapterCode.includes('no Cloudflare env flag'),
      'dep adapter JSDoc must state no env flag activation'
    );
  },
});

// ── 11. Dependency adapter maps STAGING success to VERIFY_RUNTIME_VERIFIED ──
tests.push({
  name: 'Dependency adapter maps VERIFIER_STAGING_MOCK_VERIFIED to VERIFY_RUNTIME_VERIFIED',
  fn: async () => {
    const verifierMod = await loadVerifierModule();
    const depMod = await loadDepAdapterModule();

    // Create a STAGING verifier adapter with DI
    const stagingVerifier = async (idToken) => ({ uid: 'staging-dep-test' });
    const verifierAdapter = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });

    // Inject into dependency adapter (mockDisabled: false to allow wiring)
    const depAdapter = depMod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
      allowRawTokenHandoff: true,
    });

    const res = await depAdapter.verifyToken({ idToken: 'test-dep-token' });
    assert.strictEqual(res.allowed, true, 'dep adapter must allow with staging verifier');
    assert.strictEqual(
      res.code,
      depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED,
      'dep code must be VERIFY_RUNTIME_VERIFIED (shared with Firebase runtime)'
    );
    assert.ok(res.userKeyHash && res.userKeyHash.length === 16, 'userKeyHash propagated');
  },
});

// ── 12. No raw token/auth/secret in any response ─────────────────────────────
tests.push({
  name: 'No raw token / authorization / apiKey / firebaseToken in any staging response',
  fn: async () => {
    const mod = await loadVerifierModule();
    const stagingVerifier = async (idToken) => ({ uid: 'staging-user' });
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING,
      stagingVerifier,
    });

    const res = await adapter.verifyToken({
      idToken: 'test-sanitize-token',
      token: 'Bearer TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      rawToken: 'TEST_FIXTURE_RAW_TOKEN',
      authorization: 'Bearer TEST_FIXTURE_AUTH_NOT_REAL',
      authorizationHeader: 'Bearer TEST_FIXTURE_AUTH_HEADER',
      apiKey: 'TEST_FIXTURE_API_KEY',
      firebaseToken: 'TEST_FIXTURE_FIREBASE_TOKEN',
      secret: 'TEST_FIXTURE_SECRET',
      password: 'TEST_FIXTURE_PASSWORD',
      sessionCookie: 'TEST_FIXTURE_COOKIE',
    });
    const flat = JSON.stringify(res).toLowerCase();
    assert.ok(!flat.includes('test_fixture_token'), 'raw token must not leak');
    assert.ok(!flat.includes('test_fixture_raw'), 'rawToken must not leak');
    assert.ok(!flat.includes('test_fixture_auth'), 'authorization must not leak');
    assert.ok(!flat.includes('test_fixture_api'), 'apiKey must not leak');
    assert.ok(!flat.includes('test_fixture_firebase'), 'firebaseToken must not leak');
    assert.ok(!flat.includes('test_fixture_secret'), 'secret must not leak');
    assert.ok(!flat.includes('test_fixture_password'), 'password must not leak');
    assert.ok(!flat.includes('test_fixture_cookie'), 'cookie must not leak');
  },
});

// ── 13. suggest.js default unchanged ─────────────────────────────────────────
tests.push({
  name: 'suggest.js default dependency adapter remains mockDisabled:true',
  fn: () => {
    // The LINEAR_DEFAULT in suggest.js should still create mock-disabled adapter
    assert.ok(
      suggestCode.includes('mockDisabled: true'),
      'suggest.js must reference mockDisabled: true for default adapter'
    );
    assert.ok(
      suggestCode.includes('createScoutLiveDependencyAdapter'),
      'suggest.js must call createScoutLiveDependencyAdapter'
    );
    // No STAGING mode activation in suggest.js
    assert.ok(
      !suggestCode.includes('verifierMode'),
      'suggest.js must not contain verifierMode (no staging activation)'
    );
    assert.ok(
      !suggestCode.includes('stagingVerifier'),
      'suggest.js must not contain stagingVerifier (no DI in production)'
    );
  },
});

// ── 14. No Firebase Admin SDK import in verifier code ────────────────────────
tests.push({
  name: 'Verifier adapter still has no Firebase Admin SDK / getAuth / verifyIdToken',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'verifier must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'verifier must not reference admin.auth');
    assert.ok(!/initializeapp/.test(code), 'verifier must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(code), 'verifier must not call cert()');
    assert.ok(!/\bgetauth\b/.test(code), 'verifier must not call getAuth');
    assert.ok(!/verifyidtoken/.test(code), 'verifier must not call verifyIdToken');
  },
});

// ── 15. No external network / fetch in verifier code ─────────────────────────
tests.push({
  name: 'Verifier adapter has no fetch / XHR / axios / external URLs',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'verifier must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'verifier must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'verifier must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(code), 'verifier must not construct new Request');
    assert.ok(!/https?:\\\/\\\/[a-z]/.test(code), 'verifier must not embed external service URL');
  },
});

// ── 16. No env / secret access in verifier code ──────────────────────────────
tests.push({
  name: 'Verifier adapter reads no env / process.env / import.meta.env / secrets',
  fn: () => {
    const code = codeOnly(verifierCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'verifier must not read process.env.SCOUT_*');
    assert.ok(!/import\.meta\.env/.test(code), 'verifier must not read import.meta.env');
    assert.ok(!/process\.env\.firebase/.test(code), 'verifier must not read process.env.FIREBASE_*');
    assert.ok(!/api_key\s*=/.test(code), 'verifier must not assign api_key in code');
    assert.ok(!/bearer\s+[a-z0-9-]{20,}/.test(code), 'verifier must not embed bearer tokens');
  },
});

// ── 17. Staging mode doc exists ──────────────────────────────────────────────
tests.push({
  name: 'Staging verifier mode contract doc exists',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-staging-verifier-mode-contract.md');
    const doc = fs.readFileSync(docPath, 'utf-8');
    assert.ok(doc.length > 0, 'staging verifier mode contract doc must exist');
    const lc = doc.toLowerCase();
    assert.ok(lc.includes('staging'), 'doc must mention staging');
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock_disabled'), 'doc must mention mock-disabled');
    assert.ok(lc.includes('di') || lc.includes('dependency injection'), 'doc must mention DI');
    assert.ok(lc.includes('production') && lc.includes('blocked'), 'doc must mark production blocked');
    assert.ok(lc.includes('2636') && lc.includes('open'), 'doc must reference #2636 remains open');
    assert.ok(lc.includes('1882') && lc.includes('open'), 'doc must reference #1882 remains open');
  },
});

// ── Runner ───────────────────────────────────────────────────────────────────
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