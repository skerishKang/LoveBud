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
