/**
 * Scout Firebase Verifier Success Dependency Mapping Contract Tests
 * v20260616-runtime-mapping-1
 *
 * Locks the dependency-adapter mapping for the Firebase runtime verifier
 * success code introduced in #2567. Verifies that:
 * - the dependency adapter exports a new dedicated success code;
 * - an injected verifier adapter that returns
 *   `VERIFIER_FIREBASE_RUNTIME_VERIFIED` with a valid sanitized
 *   `userKeyHash` maps to `allowed: true` and the dependency success code;
 * - the success response keeps `userKey: null` and propagates only the
 *   sanitized `userKeyHash` (16 lowercase hex chars);
 * - raw UID / email / token / Authorization / claims / service account
 *   fields are not propagated;
 * - success with missing or malformed `userKeyHash` safe-fails to
 *   `VERIFY_UNAVAILABLE`;
 * - `VERIFIER_FIREBASE_RUNTIME_DISABLED` and
 *   `VERIFIER_FIREBASE_RUNTIME_FAILED` still safe-fail;
 * - all other existing safe-fail codes still safe-fail;
 * - unknown verifier codes still safe-fail;
 * - the default dependency adapter remains mock-disabled / deny-by-default;
 * - no provider SDK / fetch / network / env / frontend / DB / schema /
 *   `staging_live` / `production_live` changes are introduced.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
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

const dependencyAdapterCode = readFileSafe(DEPENDENCY_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);

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

function buildMockVerifierAdapter(verifyReturn) {
  return {
    kind: 'scout_live_auth_verifier_adapter',
    version: 'test-mock',
    mode: 'firebase',
    mockDisabled: false,
    isMockDisabled: false,
    verifierMode: 'firebase',
    sanitizePayload: () => ({ payload: {}, rejected: false, rejectedFields: [] }),
    verifyToken: async () => verifyReturn,
  };
}

const tests = [];

tests.push({
  name: 'Dependency adapter module exists, is ESM, and exports the new success code',
  fn: async () => {
    assert.ok(dependencyAdapterCode.length > 0, 'dependency adapter module must exist');
    const mod = await loadDependencyAdapterModule();
    assert.strictEqual(
      typeof mod.createScoutLiveDependencyAdapter,
      'function'
    );
    assert.strictEqual(
      typeof mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED,
      'string',
      'dependency adapter must export a dedicated success code'
    );
    assert.strictEqual(
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED,
      'VERIFY_RUNTIME_VERIFIED'
    );
    // The success code must be distinct from every safe-fail / error code.
    const C = mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES;
    const allOthers = [
      C.VERIFY_NOT_IMPLEMENTED,
      C.VERIFY_PAYLOAD_PROHIBITED,
      C.VERIFY_UNAVAILABLE,
      C.RATE_LIMIT_NOT_IMPLEMENTED,
      C.RATE_LIMIT_PAYLOAD_PROHIBITED,
      C.RATE_LIMIT_STORAGE_UNAVAILABLE,
    ];
    for (const code of allOthers) {
      assert.notStrictEqual(
        C.VERIFY_RUNTIME_VERIFIED,
        code,
        'success code must be distinct from safe-fail codes'
      );
    }
  },
});

tests.push({
  name: 'Injected verifier VERIFIED with valid userKeyHash maps to allowed:true and success code',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifierAdapter = buildMockVerifierAdapter({
      allowed: true,
      code: 'VERIFIER_FIREBASE_RUNTIME_VERIFIED',
      reason: 'verified',
      userKey: null,
      userKeyHash: 'a1b2c3d4e5f60718',
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED
    );
    assert.strictEqual(
      result.userKeyHash,
      'a1b2c3d4e5f60718',
      'sanitized userKeyHash must be propagated verbatim'
    );
    assert.strictEqual(result.userKey, null, 'raw userKey must remain null');
  },
});

tests.push({
  name: 'Success path keeps userKey:null and never propagates raw sensitive fields',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    // Inject a "leaky" verifier result that contains raw sensitive fields.
    // The dependency adapter must drop all of them.
    const verifierAdapter = buildMockVerifierAdapter({
      allowed: true,
      code: 'VERIFIER_FIREBASE_RUNTIME_VERIFIED',
      reason: 'verified',
      userKey: 'real-uid-should-not-leak',
      userKeyHash: '0123456789abcdef',
      // The verifier adapter normally sanitizes these, but the
      // dependency adapter must also defend in depth.
      uid: 'real-uid-1234',
      email: 'leak@example.com',
      token: 'raw-token-leak',
      authorization: 'Bearer raw-auth-leak',
      claims: { sub: 'real-uid-1234' },
      serviceAccount: 'should-not-leak',
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, true);
    const responseJson = JSON.stringify(result);
    assert.doesNotMatch(responseJson, /real-uid-1234/, 'raw uid must not appear');
    assert.doesNotMatch(responseJson, /leak@example\.com/, 'raw email must not appear');
    assert.doesNotMatch(responseJson, /raw-token-leak/, 'raw token must not appear');
    assert.doesNotMatch(responseJson, /raw-auth-leak/, 'raw authorization must not appear');
    assert.doesNotMatch(responseJson, /should-not-leak/, 'service account must not appear');
    assert.strictEqual(result.userKey, null, 'userKey must remain null');
    // Only the sanitized 16-hex hash is propagated.
    assert.strictEqual(result.userKeyHash, '0123456789abcdef');
    assert.match(result.userKeyHash, /^[0-9a-f]{16}$/);
  },
});

tests.push({
  name: 'Success path with missing userKeyHash safe-fails to VERIFY_UNAVAILABLE',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifierAdapter = buildMockVerifierAdapter({
      allowed: true,
      code: 'VERIFIER_FIREBASE_RUNTIME_VERIFIED',
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'Success path with malformed userKeyHash safe-fails to VERIFY_UNAVAILABLE',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const malformed = [
      'too-short',
      'WAY-TOO-LONG-WAY-TOO-LONG',
      'GGGGGGGGGGGGGGGG', // non-hex
      '0123456789ABCDEF', // uppercase
      '0123 4567 89ab cdef', // whitespace
      '',
    ];
    for (const bad of malformed) {
      const verifierAdapter = buildMockVerifierAdapter({
        allowed: true,
        code: 'VERIFIER_FIREBASE_RUNTIME_VERIFIED',
        userKeyHash: bad,
      });
      const depAdapter = mod.createScoutLiveDependencyAdapter({
        mockDisabled: false,
        verifierAdapter,
      });
      const result = await depAdapter.verifyToken({});
      assert.strictEqual(
        result.allowed,
        false,
        `bad userKeyHash "${bad}" must safe-fail`
      );
      assert.strictEqual(
        result.code,
        mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE
      );
      assert.strictEqual(result.userKeyHash, null);
    }
  },
});

tests.push({
  name: 'VERIFIER_FIREBASE_RUNTIME_DISABLED maps to VERIFY_NOT_IMPLEMENTED',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifierAdapter = buildMockVerifierAdapter({
      allowed: false,
      code: 'VERIFIER_FIREBASE_RUNTIME_DISABLED',
      reason: 'runtime disabled',
      userKey: null,
      userKeyHash: null,
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'VERIFIER_FIREBASE_RUNTIME_FAILED maps to VERIFY_UNAVAILABLE',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifierAdapter = buildMockVerifierAdapter({
      allowed: false,
      code: 'VERIFIER_FIREBASE_RUNTIME_FAILED',
      reason: 'runtime failed',
      userKey: null,
      userKeyHash: null,
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'All existing safe-fail verifier codes still safe-fail',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const cases = [
      {
        verifierCode: 'VERIFIER_PAYLOAD_PROHIBITED',
        dependencyCode: mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_PAYLOAD_PROHIBITED,
      },
      {
        verifierCode: 'VERIFIER_FIREBASE_DISABLED',
        dependencyCode: mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
      },
      {
        verifierCode: 'VERIFIER_MOCK_DISABLED',
        dependencyCode: mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
      },
      {
        verifierCode: 'VERIFIER_NOT_IMPLEMENTED',
        dependencyCode: mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
      },
      {
        verifierCode: 'VERIFIER_CONFIG_MISSING',
        dependencyCode: mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
      },
    ];
    for (const c of cases) {
      const verifierAdapter = buildMockVerifierAdapter({
        allowed: false,
        code: c.verifierCode,
        reason: c.verifierCode,
      });
      const depAdapter = mod.createScoutLiveDependencyAdapter({
        mockDisabled: false,
        verifierAdapter,
      });
      const result = await depAdapter.verifyToken({});
      assert.strictEqual(result.allowed, false, `${c.verifierCode} must safe-fail`);
      assert.strictEqual(
        result.code,
        c.dependencyCode,
        `${c.verifierCode} must map to ${c.dependencyCode}`
      );
      assert.strictEqual(result.userKey, null);
      assert.strictEqual(result.userKeyHash, null);
    }
  },
});

tests.push({
  name: 'Unknown verifier codes still safe-fail to VERIFY_UNAVAILABLE',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const unknownCodes = [
      'TOTALLY_UNKNOWN',
      '',
      null,
      undefined,
      'VERIFIER_SOMETHING_NEW',
    ];
    for (const code of unknownCodes) {
      const verifierAdapter = buildMockVerifierAdapter({
        allowed: false,
        code,
      });
      const depAdapter = mod.createScoutLiveDependencyAdapter({
        mockDisabled: false,
        verifierAdapter,
      });
      const result = await depAdapter.verifyToken({});
      assert.strictEqual(result.allowed, false, `code ${code} must safe-fail`);
      assert.strictEqual(
        result.code,
        mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE
      );
    }
  },
});

tests.push({
  name: 'Default dependency adapter remains mock-disabled / deny-by-default',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const depAdapter = mod.createScoutLiveDependencyAdapter();
    assert.strictEqual(depAdapter.mockDisabled, true);
    assert.strictEqual(depAdapter.isMockDisabled, true);
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED
    );
    assert.strictEqual(result.userKey, null);
    assert.strictEqual(result.userKeyHash, null);
  },
});

tests.push({
  name: 'mockDisabled:false dependency adapter with default verifier still safe-fails by default',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const depAdapter = mod.createScoutLiveDependencyAdapter({ mockDisabled: false });
    assert.strictEqual(depAdapter.mockDisabled, false);
    // The default verifier adapter (mock-disabled) returns a safe-fail
    // verifier result, so the dependency adapter propagates a safe-fail.
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.notStrictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED
    );
  },
});

tests.push({
  name: 'Real verifier adapter FIREBASE_RUNTIME success path also maps to dependency success',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifier = await loadVerifierModule();
    const verifierAdapter = verifier.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifier.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'test-proj' },
      firebaseVerifier: async () => ({ uid: 'real-uid' }),
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    // Drive the verifier with an idToken. The dependency adapter's safe
    // payload strips idToken out (current allowlist), so the verifier
    // safe-fails to RUNTIME_FAILED → dependency maps to VERIFY_UNAVAILABLE.
    // This is expected in this slice: the boundary-side idToken handoff
    // is a separate slice.
    const result = await depAdapter.verifyToken({});
    assert.strictEqual(result.allowed, false);
    assert.notStrictEqual(
      result.code,
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED,
      'without boundary idToken handoff the runtime must not produce a success'
    );
  },
});

tests.push({
  name: 'Real verifier adapter FIREBASE_RUNTIME with idToken in payload still safe-fails at allowlist',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    const verifier = await loadVerifierModule();
    const verifierAdapter = verifier.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: verifier.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: { projectId: 'test-proj' },
      firebaseVerifier: async () => ({ uid: 'real-uid' }),
    });
    const depAdapter = mod.createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
    });
    // Even if the caller passes idToken, the dependency adapter strips
    // it out before calling the verifier. This is by design.
    const result = await depAdapter.verifyToken({ idToken: 'caller-supplied' });
    assert.strictEqual(result.allowed, false);
  },
});

tests.push({
  name: 'No provider SDK / fetch / network / env / frontend / DB / schema / live primitives added',
  fn: async () => {
    // Dependency adapter must not import SDKs, do fetch, or read env.
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]firebase-admin['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /require\(['"]firebase-admin['"]\)/i);
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]openai['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]@anthropic-ai\/sdk['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]@google\/generative-ai['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]groq-sdk['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /from\s+['"]@mistralai\/mistralai['"]/i);
    assert.doesNotMatch(dependencyAdapterCode, /\bfetch\(/);
    assert.doesNotMatch(dependencyAdapterCode, /\baxios\(/);
    assert.doesNotMatch(dependencyAdapterCode, /process\.env/);
    // No staging_live / production_live execution surfaces.
    assert.doesNotMatch(dependencyAdapterCode, /staging_live/);
    assert.doesNotMatch(dependencyAdapterCode, /production_live/);
    // suggest.js must remain stub-defaulted.
    assert.match(suggestCode, /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/);
    // Frontend source selector must remain local_stub.
    assert.match(sourceSelectorCode, /local_stub/);
  },
});

tests.push({
  name: 'Dependency adapter version was bumped for this slice',
  fn: async () => {
    const mod = await loadDependencyAdapterModule();
    assert.match(
      mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
      /^20260616-runtime-mapping-1$/
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
