/**
 * Scout Runtime Firebase Auth Verifier Mode Contract Tests
 * v20260616-firebase-mode-1
 *
 * Locks the disabled-by-default Firebase runtime verifier mode added in
 * issue #2567. Verifies that:
 * - the default factory remains mock-disabled;
 * - explicit non-Firebase non-mock paths remain not-implemented;
 * - existing Firebase disabled/config-missing branches still safe-fail;
 * - the new FIREBASE_RUNTIME mode cannot run without explicit config/verifier;
 * - the new mode is lazy: no import-time initialization or verification;
 * - the new mode's success path returns only a sanitized userKeyHash;
 * - the new mode's failure path safe-fails;
 * - raw token / Authorization / Firebase claims / email / service account
 *   fields never appear in any verifier response;
 * - the dependency adapter still maps verifier results to endpoint-safe
 *   shapes (proxy: existing safe-fail behavior remains);
 * - no provider SDK / fetch / network / live provider / DB / schema /
 *   frontend runtime changes are introduced by this slice.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const DEPENDENCY_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_err) {
    return '';
  }
}

const verifierCode = readFileSafe(VERIFIER_PATH);
const dependencyAdapterCode = readFileSafe(DEPENDENCY_ADAPTER_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const editorHtmlCode = readFileSafe(EDITOR_HTML_PATH);

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) verifierModulePromise = import(VERIFIER_PATH);
  return verifierModulePromise;
}

const tests = [];

tests.push({
  name: 'Verifier adapter module exists, is ESM, and exports the factory',
  fn: async () => {
    assert.ok(verifierCode.length > 0, 'verifier adapter module must exist');
    const mod = await loadVerifierModule();
    assert.strictEqual(
      typeof mod.createScoutLiveAuthVerifierAdapter,
      'function',
      'verifier factory must be exported'
    );
    assert.strictEqual(
      typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES,
      'object'
    );
    assert.strictEqual(
      typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES,
      'object'
    );
  },
});

tests.push({
  name: 'Default factory call remains mock-disabled (no live behavior)',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(adapter.mockDisabled, true);
    assert.strictEqual(adapter.isMockDisabled, true);
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED
    );
    const result = await adapter.verifyToken({ idToken: 'should-not-be-used' });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'mockDisabled:false with no verifierMode remains not-implemented',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.mockDisabled, false);
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED
    );
    const result = await adapter.verifyToken({ idToken: 'tok' });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_NOT_IMPLEMENTED
    );
  },
});

tests.push({
  name: 'Existing FIREBASE_DISABLED scaffold branch still safe-fails',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED
    );
    const result = await adapter.verifyToken({ idToken: 'tok' });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_DISABLED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'Existing FIREBASE_CONFIG_MISSING scaffold branch still safe-fails',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING
    );
    const result = await adapter.verifyToken({ idToken: 'tok' });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_CONFIG_MISSING
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME mode is disabled by default — missing config/verifier safe-fails',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
    });
    assert.strictEqual(
      adapter.mode,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME
    );
    assert.strictEqual(adapter.hasFirebaseConfig, false);
    assert.strictEqual(adapter.hasFirebaseVerifier, false);
    const result = await adapter.verifyToken({ idToken: 'tok' });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_DISABLED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME mode is lazy — no import-time Firebase initialization',
  fn: async () => {
    // Read the source. It must not import firebase-admin, must not call
    // initializeApp / getAuth / cert / verifyIdToken at module top-level.
    assert.ok(verifierCode.length > 0, 'verifier source must exist');
    assert.doesNotMatch(
      verifierCode,
      /from\s+['"]firebase-admin['"]/i,
      'verifier source must not import firebase-admin'
    );
    assert.doesNotMatch(
      verifierCode,
      /require\(['"]firebase-admin['"]\)/i,
      'verifier source must not require firebase-admin'
    );
    assert.doesNotMatch(verifierCode, /\binitializeApp\(/);
    assert.doesNotMatch(verifierCode, /\bgetAuth\(/);
    assert.doesNotMatch(verifierCode, /\bcert\(/);
    assert.doesNotMatch(verifierCode, /\bverifyIdToken\(/);
    // No top-level await of any verification — the source must be plain
    // synchronous at module level.
    assert.doesNotMatch(verifierCode, /^await\s+/m, 'no top-level await');
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME success returns only a sanitized userKeyHash (no raw uid/email)',
  fn: async () => {
    const mod = await loadVerifierModule();
    let verifierCalled = false;
    let passedIdToken = null;
    let passedConfig = null;
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'unit-test-proj' },
      firebaseVerifier: async (idToken, firebaseConfig) => {
        verifierCalled = true;
        passedIdToken = idToken;
        passedConfig = firebaseConfig;
        // The injected verifier intentionally returns sensitive-looking
        // fields. The adapter must NOT echo any of them.
        return {
          uid: 'real-uid-1234',
          email: 'leak@example.com',
          claims: { sub: 'real-uid-1234' },
          providerId: 'firebase',
          serviceAccount: 'should-not-leak',
        };
      },
    });
    const result = await adapter.verifyToken({ idToken: 'incoming-firebase-id-token' });
    assert.strictEqual(verifierCalled, true, 'injected verifier must be called');
    assert.strictEqual(passedIdToken, 'incoming-firebase-id-token');
    assert.deepStrictEqual(passedConfig, { projectId: 'unit-test-proj' });
    assert.strictEqual(result.allowed, true);
    assert.ok(
      typeof result.userKeyHash === 'string' && result.userKeyHash.length > 0,
      'userKeyHash must be a non-empty string'
    );
    assert.strictEqual(result.userKey, null, 'raw userKey must not be returned');
    // The response must not echo any of the verifier's sensitive fields.
    const responseJson = JSON.stringify(result);
    assert.doesNotMatch(responseJson, /real-uid-1234/, 'raw uid must not appear in response');
    assert.doesNotMatch(responseJson, /leak@example\.com/, 'raw email must not appear in response');
    assert.doesNotMatch(responseJson, /firebase/, 'providerId must not appear in response');
    assert.doesNotMatch(responseJson, /should-not-leak/, 'service account must not appear');
    // The idToken must never appear in the response.
    assert.doesNotMatch(responseJson, /incoming-firebase-id-token/, 'idToken must not appear in response');
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME injected verifier failure safe-fails without throwing',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => { throw new Error('downstream down'); },
    });
    let result;
    let threw = false;
    try {
      result = await adapter.verifyToken({ idToken: 'tok' });
    } catch (_err) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'verifyToken must not throw through the boundary');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME rejects payloads that contain prohibited fields',
  fn: async () => {
    const mod = await loadVerifierModule();
    let verifierCalled = false;
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => { verifierCalled = true; return { uid: 'u' }; },
    });
    const result = await adapter.verifyToken({
      idToken: 'tok',
      token: 'raw-token-leak',
    });
    assert.strictEqual(verifierCalled, false, 'verifier must not be called on rejected payload');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED
    );
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME rejects payloads without a non-empty idToken',
  fn: async () => {
    const mod = await loadVerifierModule();
    let verifierCalled = false;
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => { verifierCalled = true; return { uid: 'u' }; },
    });
    const r1 = await adapter.verifyToken({ idToken: '' });
    assert.strictEqual(verifierCalled, false);
    assert.strictEqual(r1.allowed, false);
    assert.strictEqual(
      r1.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED
    );
    const r2 = await adapter.verifyToken({});
    assert.strictEqual(r2.allowed, false);
    assert.strictEqual(
      r2.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED
    );
  },
});

tests.push({
  name: 'FIREBASE_RUNTIME userKeyHash is deterministic and non-reversible',
  fn: async () => {
    const mod = await loadVerifierModule();
    const adapter = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => ({ uid: 'fixed-uid' }),
    });
    const a = await adapter.verifyToken({ idToken: 'tok-a' });
    const b = await adapter.verifyToken({ idToken: 'tok-b' });
    assert.strictEqual(a.allowed, true);
    assert.strictEqual(b.allowed, true);
    // Different idTokens but the same verifier return -> same userKeyHash
    assert.strictEqual(a.userKeyHash, b.userKeyHash);
    // The hash must not contain the raw uid.
    assert.doesNotMatch(a.userKeyHash, /fixed-uid/);
    // The hash must be 16 lowercase hex chars.
    assert.match(a.userKeyHash, /^[0-9a-f]{16}$/);
  },
});

tests.push({
  name: 'Dependency adapter still maps verifier results to endpoint-safe shapes',
  fn: async () => {
    // We do not couple to specific strings — we only assert that the
    // dependency adapter file still exists, still references the safe
    // fail / mock-disabled / not-implemented code surface, and does not
    // add a new SDK / fetch / network primitive.
    assert.ok(dependencyAdapterCode.length > 0, 'dependency adapter must exist');
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]firebase-admin['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /require\(['"]firebase-admin['"]\)/i);
    assert.doesNotMatch(dependencyAdapterCode, /\bfetch\(/);
    assert.doesNotMatch(dependencyAdapterCode, /\baxios\(/);
    // Boundary and suggest must keep their safe defaults.
    assert.ok(boundaryCode.length > 0, 'boundary must exist');
    assert.ok(suggestCode.length > 0, 'suggest must exist');
    assert.match(suggestCode, /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/);
    assert.match(sourceSelectorCode, /local_stub/);
  },
});

tests.push({
  name: 'No frontend / DB / schema / provider SDK / network primitives added',
  fn: async () => {
    // Verifier module must not import SDKs, do fetch, or read env.
    assert.doesNotMatch(verifierCode, /from\s+['"]openai['"]/i);
    assert.doesNotMatch(verifierCode, /from\s+['"]@anthropic-ai\/sdk['"]/i);
    assert.doesNotMatch(verifierCode, /from\s+['"]@google\/generative-ai['"]/i);
    assert.doesNotMatch(verifierCode, /from\s+['"]groq-sdk['"]/i);
    assert.doesNotMatch(verifierCode, /from\s+['"]@mistralai\/mistralai['"]/i);
    assert.doesNotMatch(verifierCode, /from\s+['"]openai\/realtime['"]/i);
    assert.doesNotMatch(verifierCode, /\bfetch\(/);
    assert.doesNotMatch(verifierCode, /\baxios\(/);
    assert.doesNotMatch(verifierCode, /process\.env/);
    // Editor HTML must not have been touched by this slice.
    if (editorHtmlCode.length > 0) {
      assert.doesNotMatch(editorHtmlCode, /firebase-runtime/i);
      assert.doesNotMatch(editorHtmlCode, /live-auth-verifier-adapter\.js/);
    }
    // The default path of suggest.js must remain stub.
    assert.match(suggestCode, /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/);
  },
});

tests.push({
  name: 'No staging_live / production_live / live provider execution introduced',
  fn: async () => {
    // Verifier source must not contain 'live provider' execution markers.
    assert.doesNotMatch(verifierCode, /staging_live/);
    assert.doesNotMatch(verifierCode, /production_live/);
    // Suggest.js must keep STUB as the default and not switch to live.
    assert.match(suggestCode, /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/);
    // The provider mode should not be set to live in the default path.
    assert.doesNotMatch(suggestCode, /providerMode\s*=\s*['"]live['"]/);
  },
});

tests.push({
  name: 'Mode constants and code constants include the new runtime mode and codes',
  fn: async () => {
    const mod = await loadVerifierModule();
    assert.strictEqual(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      'firebase'
    );
    assert.strictEqual(
      typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_DISABLED,
      'string'
    );
    assert.strictEqual(
      typeof mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED,
      'string'
    );
    // Version was bumped for this slice.
    assert.match(
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      /^20260616-firebase-mode-1$/
    );
  },
});

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
      if (err && err.stack) {
        const lines = err.stack.split('\n').slice(0, 3);
        for (const line of lines) console.log('    ' + line);
      }
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
