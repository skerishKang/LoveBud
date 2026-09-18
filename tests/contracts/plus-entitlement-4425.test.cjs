// Contract tests for the #4425 Plus entitlement boundary candidate.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const PROFILE = {
  privateStorageEnabled: false,
  plan: 'free',
  plus: false,
  entitlements: { privateStorage: false }
};

function request(auth = 'Bearer token') {
  const headers = {};
  if (auth !== null) headers.authorization = auth;
  return new Request('https://example.test/api/entitlement', { headers });
}

function env(extra = {}) {
  return { LB_PLUS_ENTITLEMENT_READ_RUNTIME: 'direct_neon', ...extra };
}

test('#4425 accepted truthy values across all four fields', async () => {
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  for (const field of ['privateStorageEnabled', 'plus']) {
    assert.equal(direct.hasPlusEntitlement({ ...PROFILE, [field]: true }), true);
    assert.equal(direct.hasPlusEntitlement({ ...PROFILE, [field]: 1 }), true);
    assert.equal(direct.hasPlusEntitlement({ ...PROFILE, [field]: ' TRUE ' }), true);
    assert.equal(direct.hasPlusEntitlement({ ...PROFILE, [field]: '1' }), true);
  }
  assert.equal(direct.hasPlusEntitlement({ ...PROFILE, plan: ' PLUS ' }), true);
  assert.equal(direct.hasPlusEntitlement({ ...PROFILE, plan: 'admin' }), true);
  assert.equal(direct.hasPlusEntitlement({ ...PROFILE, entitlements: { privateStorage: 'true' } }), true);
});

test('#4425 false and missing fields are not entitled', async () => {
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  assert.equal(direct.hasPlusEntitlement(PROFILE), false);
  assert.equal(direct.hasPlusEntitlement({}), false);
  assert.equal(direct.hasPlusEntitlement(null), false);
  assert.equal(direct.hasPlusEntitlement({ plan: 'enterprise' }), false);
});

test('#4425 invalid auth fails closed without profile read', async () => {
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  let reads = 0;
  const result = await direct.resolvePlusEntitlement({
    request: request('Bearer malformed extra'),
    env: env(),
    verifyTokenOverride: async () => ({ uid: 'must-not-run' }),
    readProfile: async () => { reads += 1; return { privateStorageEnabled: true }; }
  });
  assert.deepEqual(result, { entitled: false, reason: 'unauthorized' });
  assert.equal(reads, 0);
});

test('#4425 verifier/read failure fails closed without provider details', async () => {
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  const verifierFailure = await direct.resolvePlusEntitlement({
    request: request(), env: env(),
    verifyTokenOverride: async () => { throw new Error('private verifier detail'); },
    readProfile: async () => ({ privateStorageEnabled: true })
  });
  assert.deepEqual(verifierFailure, { entitled: false, reason: 'unavailable' });

  const readFailure = await direct.resolvePlusEntitlement({
    request: request(), env: env(),
    verifyTokenOverride: async () => ({ uid: 'verified-user' }),
    readProfile: async () => { throw new Error('firestore detail'); }
  });
  assert.deepEqual(readFailure, { entitled: false, reason: 'unavailable' });
  assert.doesNotMatch(JSON.stringify(readFailure), /private verifier detail|firestore detail/);
});

test('#4425 direct gate is exact and contract forbids caching/production cutover', async () => {
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  assert.equal(direct.isPlusEntitlementDirectNeonSelected({}), false);
  assert.equal(direct.isPlusEntitlementDirectNeonSelected({ LB_PLUS_ENTITLEMENT_READ_RUNTIME: 'modal' }), false);
  assert.equal(direct.isPlusEntitlementDirectNeonSelected(env()), true);
  assert.equal(direct.PLUS_ENTITLEMENT_DIRECT_NEON_CONTRACT.cache, 'no-store');
  assert.equal(direct.PLUS_ENTITLEMENT_DIRECT_NEON_CONTRACT.productionCutover, false);
});

test('#4425 Firestore REST reader uses request Firebase token, exact verified uid, and a four-field mask', async () => {
  const readerModule = await import('../../functions/_shared/firestore-user-profile-reader.js');
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  let captured = null;
  const req = request('Bearer caller-firebase-id-token');
  const readProfile = readerModule.createFirestoreUserProfileReader({
    request: req,
    env: { FIREBASE_PROJECT_ID: 'relovetree' },
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({
        fields: {
          privateStorageEnabled: { booleanValue: false },
          plan: { stringValue: 'plus' },
          plus: { booleanValue: false },
          entitlements: {
            mapValue: {
              fields: {
                privateStorage: { stringValue: 'false' },
                unrelatedNestedField: { stringValue: 'must-not-be-projected' }
              }
            }
          },
          unrelatedTopLevelField: { stringValue: 'must-not-be-projected' }
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  const result = await direct.resolvePlusEntitlement({
    request: req,
    env: env(),
    verifyTokenOverride: async () => ({ uid: 'verified-user-1' }),
    readProfile
  });

  assert.deepEqual(result, { entitled: true, reason: 'profile' });
  assert.ok(captured);
  const url = new URL(captured.url);
  assert.equal(
    url.pathname,
    '/v1/projects/relovetree/databases/(default)/documents/users/verified-user-1'
  );
  assert.deepEqual(
    url.searchParams.getAll('mask.fieldPaths'),
    ['privateStorageEnabled', 'plan', 'plus', 'entitlements.privateStorage']
  );
  assert.equal(captured.init.method, 'GET');
  assert.equal(captured.init.headers.authorization, 'Bearer caller-firebase-id-token');
  assert.equal(captured.init.headers.accept, 'application/json');
});

test('#4425 Firestore reader projects only entitlement compatibility fields', async () => {
  const readerModule = await import('../../functions/_shared/firestore-user-profile-reader.js');
  const projected = readerModule.projectFirestoreEntitlementProfile({
    fields: {
      privateStorageEnabled: { integerValue: '1' },
      plan: { stringValue: 'free' },
      plus: { booleanValue: false },
      entitlements: {
        mapValue: {
          fields: {
            privateStorage: { booleanValue: true },
            other: { stringValue: 'ignored-by-entitlement-consumer' }
          }
        }
      },
      email: { stringValue: 'must-not-leave-provider-adapter' }
    }
  });
  assert.deepEqual(projected, {
    privateStorageEnabled: '1',
    plan: 'free',
    plus: false,
    entitlements: {
      privateStorage: true,
      other: 'ignored-by-entitlement-consumer'
    }
  });
  assert.equal(Object.hasOwn(projected, 'email'), false);
});

test('#4425 Firestore missing user document preserves existing entitlement=false semantics', async () => {
  const readerModule = await import('../../functions/_shared/firestore-user-profile-reader.js');
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');
  const req = request('Bearer caller-token');
  const readProfile = readerModule.createFirestoreUserProfileReader({
    request: req,
    fetchImpl: async () => new Response('', { status: 404 })
  });
  const result = await direct.resolvePlusEntitlement({
    request: req,
    env: env(),
    verifyTokenOverride: async () => ({ uid: 'verified-user-404' }),
    readProfile
  });
  assert.deepEqual(result, { entitled: false, reason: 'profile' });
});

test('#4425 Firestore permission/network/response failure is unavailable, never no-Plus', async () => {
  const readerModule = await import('../../functions/_shared/firestore-user-profile-reader.js');
  const direct = await import('../../functions/_shared/plus-entitlement-direct-neon.js');

  for (const fetchImpl of [
    async () => new Response(JSON.stringify({ error: { message: 'private provider detail' } }), { status: 403 }),
    async () => { throw new Error('private network detail'); },
    async () => new Response('{invalid-json', { status: 200 })
  ]) {
    const req = request('Bearer caller-token');
    const readProfile = readerModule.createFirestoreUserProfileReader({ request: req, fetchImpl });
    const result = await direct.resolvePlusEntitlement({
      request: req,
      env: env(),
      verifyTokenOverride: async () => ({ uid: 'verified-user-failure' }),
      readProfile
    });
    assert.deepEqual(result, { entitled: false, reason: 'unavailable' });
    assert.doesNotMatch(JSON.stringify(result), /private provider detail|private network detail|invalid-json/);
  }
});

test('#4425 Firestore reader is bounded and source-only', async () => {
  const readerModule = await import('../../functions/_shared/firestore-user-profile-reader.js');
  const req = request('Bearer caller-token');
  let clearCalls = 0;
  const readProfile = readerModule.createFirestoreUserProfileReader({
    request: req,
    timeoutMs: 999999,
    setTimeoutImpl: (callback, timeoutMs) => {
      assert.equal(timeoutMs, 5000);
      callback();
      return 7;
    },
    clearTimeoutImpl: (handle) => {
      assert.equal(handle, 7);
      clearCalls += 1;
    },
    fetchImpl: async (_url, init) => {
      assert.equal(init.signal.aborted, true);
      throw new Error('aborted');
    }
  });

  await assert.rejects(
    () => readProfile('verified-user-timeout'),
    (error) => error?.code === readerModule.FIRESTORE_USER_PROFILE_ERROR.PROVIDER_UNAVAILABLE
  );
  assert.equal(clearCalls, 1);
  assert.equal(readerModule.FIRESTORE_USER_PROFILE_READER_CONTRACT.serviceAccountRequired, false);
  assert.equal(readerModule.FIRESTORE_USER_PROFILE_READER_CONTRACT.productionCutover, false);
  assert.equal(readerModule.FIRESTORE_USER_PROFILE_READER_CONTRACT.authorization, 'firestore-security-rules');
});

