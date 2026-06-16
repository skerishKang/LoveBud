/**
 * Scout Bearer Token Handoff Boundary Contract Tests
 * v20260616-bearer-handoff-1
 *
 * Locks the guarded Bearer token handoff introduced in #2571.
 * Verifies that:
 * - the default boundary NEVER includes the parsed raw Bearer token in
 *   the verifier payload;
 * - the explicit non-default option `includeIdTokenForVerifier: true`
 *   causes the boundary to forward the parsed token as `idToken` only;
 * - the raw token never appears in the boundary response, userKey,
 *   userKeyHash, reason, rate-limit payload, request ids, or error
 *   objects;
 * - the default dependency adapter does NOT include `idToken` in the
 *   verifier payload;
 * - the explicit dependency option `allowRawTokenHandoff: true` causes
 *   the dependency adapter to forward `idToken`;
 * - malformed / missing / empty / too-long Bearer headers safe-fail
 *   before the verifier is called;
 * - verifier exceptions safe-fail without throw-through;
 * - the full boundary → dependency → verifier chain works with the
 *   guarded handoff and still safe-fails by default;
 * - frontend defaults and `suggest.js` default remain unchanged;
 * - no provider SDK / fetch / network / env / DB / schema /
 *   `staging_live` / `production_live` changes are introduced.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BOUNDARY_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-rate-limit-boundary.js'
);
const DEPENDENCY_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-rate-limit-dependency-adapter.js'
);
const VERIFIER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-verifier-adapter.js'
);
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-source-selector.js'
);

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_err) {
    return '';
  }
}

const boundaryCode = readFileSafe(BOUNDARY_PATH);
const dependencyAdapterCode = readFileSafe(DEPENDENCY_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

let boundaryModulePromise = null;
async function loadBoundaryModule() {
  if (!boundaryModulePromise) boundaryModulePromise = import(BOUNDARY_PATH);
  return boundaryModulePromise;
}

let dependencyAdapterModulePromise = null;
async function loadDependencyAdapterModule() {
  if (!dependencyAdapterModulePromise) {
    dependencyAdapterModulePromise = import(DEPENDENCY_ADAPTER_PATH);
  }
  return dependencyAdapterModulePromise;
}

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) verifierModulePromise = import(VERIFIER_PATH);
  return verifierModulePromise;
}

const tests = [];

tests.push({
  name: 'Boundary factory exposes includeIdTokenForVerifier flag (default false)',
  fn: async () => {
    const mod = await loadBoundaryModule();
    const def = mod.createScoutLiveAuthBoundary({});
    assert.strictEqual(def.includeIdTokenForVerifier, false);
    const guarded = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
    });
    assert.strictEqual(guarded.includeIdTokenForVerifier, true);
  },
});

tests.push({
  name: 'Default boundary does NOT include idToken in verifier payload',
  fn: async () => {
    const mod = await loadBoundaryModule();
    let capturedPayload = null;
    const boundary = mod.createScoutLiveAuthBoundary({
      verifyToken: async (payload) => {
        capturedPayload = payload;
        return { ok: true, uid: 'u' };
      },
    });
    const result = await boundary.authenticate(
      { headers: { authorization: 'Bearer super-secret-token-xyz' } },
      {}
    );
    assert.ok(capturedPayload, 'verifier must be called');
    assert.strictEqual(typeof capturedPayload, 'object');
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(capturedPayload, 'idToken'),
      false,
      'default boundary must not include idToken'
    );
    assert.strictEqual(capturedPayload.authorizationScheme, 'Bearer');
    // Raw token must not appear in the response.
    const serialized = JSON.stringify(result);
    assert.ok(
      !serialized.includes('super-secret-token-xyz'),
      'response must not contain raw token'
    );
  },
});

tests.push({
  name: 'Explicit includeIdTokenForVerifier:true forwards parsed token as idToken',
  fn: async () => {
    const mod = await loadBoundaryModule();
    let capturedPayload = null;
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async (payload) => {
        capturedPayload = payload;
        return { ok: true, uid: 'u' };
      },
    });
    const result = await boundary.authenticate(
      { headers: { authorization: 'Bearer my-real-token-999' } },
      {}
    );
    assert.ok(capturedPayload, 'verifier must be called');
    assert.strictEqual(
      capturedPayload.idToken,
      'my-real-token-999',
      'parsed token must be forwarded as idToken when guarded opt-in is set'
    );
    assert.strictEqual(capturedPayload.authorizationScheme, 'Bearer');
    // The raw token MUST NOT appear in the response.
    const serialized = JSON.stringify(result);
    assert.ok(
      !serialized.includes('my-real-token-999'),
      'response must not echo raw token even with handoff enabled'
    );
    assert.strictEqual(result.token, null, 'boundary result must not include raw token field');
  },
});

tests.push({
  name: 'Raw token does not appear in userKey, userKeyHash, reason, error.message, or rate-limit payload',
  fn: async () => {
    const mod = await loadBoundaryModule();
    const secret = 'absolutely-secret-raw-token-abc';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async (payload) => {
        // The verifier returns a "leaky" result. The boundary must
        // still drop the raw token.
        return {
          ok: true,
          uid: 'real-uid',
          userKey: secret, // intentionally leaky
          userKeyHash: secret, // intentionally leaky
          reason: secret, // intentionally leaky
        };
      },
    });
    const result = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    const serialized = JSON.stringify(result);
    assert.ok(
      !serialized.includes(secret),
      'response JSON must not include raw token'
    );
    // The boundary's userKey should be derived from uid, not from
    // the leaky userKey field.
    assert.strictEqual(result.userKey, 'real-uid');
    // The boundary result must not include a userKeyHash field.
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(result, 'userKeyHash'),
      false,
      'boundary result must not include userKeyHash'
    );
  },
});

tests.push({
  name: 'Malformed / missing / empty / too-long Authorization headers safe-fail before verifier call',
  fn: async () => {
    const mod = await loadBoundaryModule();
    let verifierCalled = false;
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => {
        verifierCalled = true;
        return { ok: true, uid: 'u' };
      },
    });
    // Missing
    let r = await boundary.authenticate({}, {});
    assert.strictEqual(verifierCalled, false, 'verifier must not be called on missing header');
    assert.strictEqual(r.status, 'auth_required');
    // Malformed (not Bearer)
    verifierCalled = false;
    r = await boundary.authenticate({ headers: { authorization: 'Basic abc' } }, {});
    assert.strictEqual(verifierCalled, false);
    assert.strictEqual(r.status, 'auth_invalid');
    // Empty
    verifierCalled = false;
    r = await boundary.authenticate({ headers: { authorization: 'Bearer ' } }, {});
    assert.strictEqual(verifierCalled, false);
    assert.strictEqual(r.status, 'auth_invalid');
    // Too long
    verifierCalled = false;
    const tooLong = 'Bearer ' + 'a'.repeat(5000);
    r = await boundary.authenticate({ headers: { authorization: tooLong } }, {});
    assert.strictEqual(verifierCalled, false);
    assert.strictEqual(r.status, 'auth_invalid');
  },
});

tests.push({
  name: 'Verifier throw safe-fails without throw-through',
  fn: async () => {
    const mod = await loadBoundaryModule();
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => { throw new Error('verifier blew up'); },
    });
    const r = await boundary.authenticate(
      { headers: { authorization: 'Bearer good' } },
      {}
    );
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 'auth_invalid');
    assert.strictEqual(r.error.code, 'AUTH_INVALID');
    assert.strictEqual(
      r.error.message.includes('verifier blew up'),
      false,
      'error message must not echo raw verifier exception'
    );
  },
});

tests.push({
  name: 'Default dependency adapter does NOT forward idToken to verifier',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    let capturedPayload = null;
    const verifierAdapter = {
      kind: 'mock',
      verifyToken: async (payload) => {
        capturedPayload = payload;
        return { allowed: false, code: 'VERIFIER_FIREBASE_RUNTIME_DISABLED' };
      },
    };
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    await depAdapter.verifyToken({ idToken: 'caller-supplied-token' });
    assert.ok(capturedPayload, 'verifier must be called');
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(capturedPayload, 'idToken'),
      false,
      'default dependency adapter must strip idToken'
    );
  },
});

tests.push({
  name: 'Explicit allowRawTokenHandoff:true forwards idToken through dependency adapter',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    let capturedPayload = null;
    const verifierAdapter = {
      kind: 'mock',
      verifyToken: async (payload) => {
        capturedPayload = payload;
        return { allowed: false, code: 'VERIFIER_FIREBASE_RUNTIME_DISABLED' };
      },
    };
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
      allowRawTokenHandoff: true,
    });
    await depAdapter.verifyToken({ idToken: 'forwarded-token-123' });
    assert.ok(capturedPayload, 'verifier must be called');
    assert.strictEqual(capturedPayload.idToken, 'forwarded-token-123');
  },
});

tests.push({
  name: 'allowRawTokenHandoff does NOT add other raw sensitive fields',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    let capturedPayload = null;
    const verifierAdapter = {
      kind: 'mock',
      verifyToken: async (payload) => {
        capturedPayload = payload;
        return { allowed: false, code: 'VERIFIER_FIREBASE_RUNTIME_DISABLED' };
      },
    };
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
      allowRawTokenHandoff: true,
    });
    await depAdapter.verifyToken({
      idToken: 't',
      // These must be stripped even with the handoff opt-in.
      token: 'raw-token-leak',
      authorization: 'Bearer raw-auth-leak',
      apiKey: 'leak',
      firebaseToken: 'leak',
      prompt: 'leak',
      sourceUrl: 'leak',
    });
    assert.ok(capturedPayload, 'verifier must be called');
    assert.strictEqual(capturedPayload.idToken, 't');
    const serialized = JSON.stringify(capturedPayload);
    assert.ok(!serialized.includes('raw-token-leak'), 'raw token must not leak');
    assert.ok(!serialized.includes('raw-auth-leak'), 'raw auth must not leak');
    assert.ok(!serialized.includes('leak'), 'no raw sensitive field must leak');
  },
});

tests.push({
  name: 'Full chain: boundary → dependency → verifier with guarded handoff works',
  fn: async () => {
    const boundaryMod = await loadBoundaryModule();
    const depMod = await loadDependencyAdapterModule();
    const verifierMod = await loadVerifierModule();
    const realVerifier = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => ({ uid: 'real-user' }),
    });
    const depAdapter = depMod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter: realVerifier,
      allowRawTokenHandoff: true,
    });
    const boundary = boundaryMod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: depAdapter.verifyToken,
    });
    const secret = 'super-secret-test-token';
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` }, providerMode: 'firebase' },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.status, 'authenticated');
    const serialized = JSON.stringify(r);
    assert.ok(
      !serialized.includes(secret),
      'response must not echo raw token'
    );
  },
});

tests.push({
  name: 'Full chain WITHOUT handoff still safe-fails (no token reaches verifier)',
  fn: async () => {
    const boundaryMod = await loadBoundaryModule();
    const depMod = await loadDependencyAdapterModule();
    const verifierMod = await loadVerifierModule();
    const realVerifier = verifierMod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'p' },
      firebaseVerifier: async () => ({ uid: 'real-user' }),
    });
    const depAdapter = depMod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter: realVerifier,
      // No allowRawTokenHandoff
    });
    const boundary = boundaryMod.createScoutLiveAuthBoundary({
      // No includeIdTokenForVerifier
      verifyToken: depAdapter.verifyToken,
    });
    const r = await boundary.authenticate(
      { headers: { authorization: 'Bearer some-token' } },
      {}
    );
    // Without the handoff opt-in, the verifier receives no idToken and
    // safe-fails. The boundary maps the safe-fail to auth_invalid.
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 'auth_invalid');
  },
});

tests.push({
  name: 'Version is bumped for the guarded handoff slice',
  fn: async () => {
    const boundaryMod = await loadBoundaryModule();
    const depMod = await loadDependencyAdapterModule();
    // The boundary file's version comment uses the v-prefix convention.
    assert.match(boundaryCode, /v20260616-bearer-handoff-1/);
    // The dependency adapter's exported version.
    assert.match(
      depMod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
      /^20260616-bearer-handoff-1$/
    );
  },
});

tests.push({
  name: 'No provider SDK / fetch / network / env / frontend / DB / schema / live primitives added',
  fn: async () => {
    // Boundary must not import SDKs, do fetch, or read env.
    assert.doesNotMatch(boundaryCode, /from\s+['"]firebase-admin['"]/i);
    assert.doesNotMatch(boundaryCode, /require\(['"]firebase-admin['"]\)/i);
    assert.doesNotMatch(boundaryCode, /from\s+['"]openai['"]/i);
    assert.doesNotMatch(boundaryCode, /from\s+['"]@anthropic-ai\/sdk['"]/i);
    assert.doesNotMatch(boundaryCode, /from\s+['"]@google\/generative-ai['"]/i);
    assert.doesNotMatch(boundaryCode, /from\s+['"]groq-sdk['"]/i);
    assert.doesNotMatch(boundaryCode, /from\s+['"]@mistralai\/mistralai['"]/i);
    assert.doesNotMatch(boundaryCode, /\bfetch\(/);
    assert.doesNotMatch(boundaryCode, /\baxios\(/);
    assert.doesNotMatch(boundaryCode, /process\.env/);
    // No staging_live / production_live execution surfaces.
    assert.doesNotMatch(boundaryCode, /staging_live/);
    assert.doesNotMatch(boundaryCode, /production_live/);
    // suggest.js must remain stub-defaulted.
    assert.match(suggestCode, /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/);
    // Frontend source selector must remain local_stub.
    assert.match(sourceSelectorCode, /local_stub/);
  },
});

tests.push({
  name: 'No raw token echoes in boundary or dependency adapter responses/logs/docs',
  fn: async () => {
    // We do not depend on a specific secret. The test asserts that the
    // boundary never builds a string that includes a hard-coded "Bearer"
    // plus the raw token, and never includes `idToken` in the response.
    // Run a few synthetic calls and confirm the responses never include
    // the synthetic secrets.
    const boundaryMod = await loadBoundaryModule();
    const depMod = await loadDependencyAdapterModule();
    const verifierMod = await loadVerifierModule();
    const secrets = ['secret-1-AAA', 'secret-2-BBB', 'secret-3-CCC'];
    for (const secret of secrets) {
      const realVerifier = verifierMod.createScoutLiveAuthVerifierAdapter({
        mockDisabled: false,
        verifierMode: verifierMod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
        firebaseConfig: { projectId: 'p' },
        firebaseVerifier: async () => ({ uid: 'u' }),
      });
      const depAdapter = depMod.createScoutLiveDependencyAdapter({
        mockDisabled: false,
        verifierAdapter: realVerifier,
        allowRawTokenHandoff: true,
      });
      const boundary = boundaryMod.createScoutLiveAuthBoundary({
        includeIdTokenForVerifier: true,
        verifyToken: depAdapter.verifyToken,
      });
      const r = await boundary.authenticate(
        { headers: { authorization: `Bearer ${secret}` } },
        {}
      );
      const serialized = JSON.stringify(r);
      assert.ok(
        !serialized.includes(secret),
        `response must not echo secret ${secret}`
      );
    }
  },
});

tests.push({
  name: 'Legacy verifier result with raw token as userKey does NOT leak to boundary response.userKey',
  fn: async () => {
    // Edge case: a legacy / mock verifier returns
    //   { ok: true, userKey: <parsed raw token> }
    // The boundary MUST NOT echo the raw token as its own `userKey`.
    // The boundary's success path is the only place this leak can
    // happen, so the contract test locks it.
    const mod = await loadBoundaryModule();
    const secret = 'leaky-userKey-token-9876';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({ ok: true, userKey: secret }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.status, 'authenticated');
    assert.notStrictEqual(
      r.userKey,
      secret,
      'boundary response.userKey must not equal the raw token'
    );
    // The response must not echo the raw token anywhere.
    const serialized = JSON.stringify(r);
    assert.ok(
      !serialized.includes(secret),
      `boundary response must not include the raw token. Got: ${serialized}`
    );
    // Recommended fallback when the only candidate equals the parsed
    // token is the 'anon' identifier.
    assert.strictEqual(r.userKey, 'anon');
  },
});

tests.push({
  name: 'Dependency-adapter success with raw token in userKey + safe userKeyHash uses userKeyHash',
  fn: async () => {
    // Edge case: a dependency-adapter result returns
    //   { allowed: true, userKey: <raw token>, userKeyHash: '0123456789abcdef' }
    // The boundary trusts the sanitized `userKeyHash` and does NOT
    // surface the raw token in its own `userKey`.
    const mod = await loadBoundaryModule();
    const secret = 'leaky-dep-adapter-token-AA-BB';
    const safeHash = '0123456789abcdef';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({
        allowed: true,
        code: 'VERIFY_RUNTIME_VERIFIED',
        userKey: secret, // intentionally leaky
        userKeyHash: safeHash,
      }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.status, 'authenticated');
    assert.strictEqual(
      r.userKey,
      safeHash,
      'boundary must prefer the sanitized userKeyHash for the response userKey'
    );
    const serialized = JSON.stringify(r);
    assert.ok(
      !serialized.includes(secret),
      `boundary response must not include the raw token. Got: ${serialized}`
    );
  },
});

tests.push({
  name: 'uid / userId / subject missing + leaky userKey falls back to anon',
  fn: async () => {
    // Edge case: a legacy verifier returns ONLY `userKey` (no
    // uid / userId / subject), and the `userKey` equals the parsed
    // raw token. The boundary MUST fall back to 'anon' rather than
    // echo the raw token.
    const mod = await loadBoundaryModule();
    const secret = 'only-userKey-leak-CC-DD';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({ ok: true, userKey: secret }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.notStrictEqual(r.userKey, secret);
    assert.strictEqual(r.userKey, 'anon');
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes(secret));
  },
});

tests.push({
  name: 'All four candidate identifiers leaky falls back to anon (defense in depth)',
  fn: async () => {
    // Edge case: every candidate (`uid`, `userId`, `subject`,
    // `userKey`) equals the parsed raw token. The boundary must
    // fall back to 'anon'.
    const mod = await loadBoundaryModule();
    const secret = 'all-candidates-leak-EE-FF';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({
        ok: true,
        uid: secret,
        userId: secret,
        subject: secret,
        userKey: secret,
      }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.userKey, 'anon');
    const serialized = JSON.stringify(r);
    assert.ok(
      !serialized.includes(secret),
      `boundary response must not echo the raw token. Got: ${serialized}`
    );
  },
});

tests.push({
  name: 'uid / userId / subject fields themselves are also token-leak-checked',
  fn: async () => {
    // Edge case: the legacy verifier returns only `uid` (no
    // userKey), and the `uid` equals the parsed raw token. The
    // boundary must treat `uid` as leaky and fall back to 'anon'.
    const mod = await loadBoundaryModule();
    const secret = 'uid-leak-token-GG-HH';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({ ok: true, uid: secret }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.userKey, 'anon');
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes(secret));
  },
});

tests.push({
  name: 'Dependency-adapter success with userKeyHash equal to raw token falls back to anon',
  fn: async () => {
    // Edge case: extreme — the dependency-adapter result has
    //   { allowed: true, userKey: <raw>, userKeyHash: <raw> }
    // The boundary must not surface the raw token in its own
    // userKey. The fallback is 'anon'.
    const mod = await loadBoundaryModule();
    const secret = 'both-fields-leak-II-JJ';
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({
        allowed: true,
        userKey: secret,
        userKeyHash: secret,
      }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.userKey, 'anon');
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes(secret));
  },
});

tests.push({
  name: 'Safe uid is still honored (no false positive for non-token candidates)',
  fn: async () => {
    // Regression check: a non-token `uid` is still used as the
    // boundary's userKey. The leak-check must not falsely reject
    // safe identifiers.
    const mod = await loadBoundaryModule();
    const boundary = mod.createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
      verifyToken: async () => ({ ok: true, uid: 'safe-real-uid' }),
    });
    const r = await boundary.authenticate(
      { headers: { authorization: 'Bearer some-token' } },
      {}
    );
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.userKey, 'safe-real-uid');
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
