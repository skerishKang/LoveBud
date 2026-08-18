const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(
  ROOT,
  'workers',
  'love-platform-api',
  'firebase-read-principal.js'
);
const WORKER_PATH = path.join(
  ROOT,
  'workers',
  'love-platform-api',
  'worker.js'
);

async function loadModules() {
  const [adapter, core, workerModule] = await Promise.all([
    import('../../workers/love-platform-api/firebase-read-principal.js'),
    import('../../workers/love-platform-api/core.js'),
    import('../../workers/love-platform-api/worker.js')
  ]);
  return { adapter, core, workerModule };
}

function authRequest(token = 'verified-token', headers = {}) {
  return new Request('https://platform.invalid/internal/read-principal', {
    headers: {
      authorization: `Bearer ${token}`,
      ...headers
    }
  });
}

test('verified Firebase uid becomes the exact minimal read principal', async () => {
  const { adapter } = await loadModules();
  let verifierToken = null;

  const principal = await adapter.resolveFirebaseReadPrincipal(
    authRequest('opaque-token-value'),
    async (token) => {
      verifierToken = token;
      return {
        uid: 'firebase-user-123',
        email: 'ignored@example.invalid',
        decoded: { admin: true, plan: 'ignored' },
        providerPayload: { private: true }
      };
    }
  );

  assert.equal(verifierToken, 'opaque-token-value');
  assert.deepEqual(principal, {
    provider: 'firebase',
    providerSubject: 'firebase-user-123',
    legacyOwnerId: 'firebase-user-123'
  });
  assert.deepEqual(Object.keys(principal), [
    'provider',
    'providerSubject',
    'legacyOwnerId'
  ]);
  assert.equal(Object.isFrozen(principal), true);
  assert.equal(JSON.stringify(principal).includes('opaque-token-value'), false);
  assert.equal(JSON.stringify(principal).includes('ignored@example.invalid'), false);
  assert.equal(JSON.stringify(principal).includes('admin'), false);
});

test('resolver does not mutate verified identity or nested claim objects', async () => {
  const { adapter } = await loadModules();
  const verifiedIdentity = {
    uid: 'firebase-user-immutable',
    email: 'not-authority@example.invalid',
    decoded: {
      roles: ['reader'],
      nested: { secret: 'unchanged' }
    }
  };
  const before = structuredClone(verifiedIdentity);

  await adapter.resolveFirebaseReadPrincipal(
    authRequest(),
    async () => verifiedIdentity
  );

  assert.deepEqual(verifiedIdentity, before);
});

test('missing and malformed bearer authorization fail before verifier invocation', async () => {
  const { adapter } = await loadModules();
  let verifierCalls = 0;
  const verifyToken = async () => {
    verifierCalls += 1;
    return { uid: 'must-not-run' };
  };

  const missingRequest = new Request('https://platform.invalid/internal/read-principal');
  await assert.rejects(
    () => adapter.resolveFirebaseReadPrincipal(missingRequest, verifyToken),
    (error) => error.code === adapter.FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED
  );

  for (const authorization of [
    '',
    'Bearer',
    'Bearer ',
    'Bearer token extra',
    'Basic token',
    'bearer token'
  ]) {
    const request = new Request('https://platform.invalid/internal/read-principal', {
      headers: { authorization }
    });
    await assert.rejects(
      () => adapter.resolveFirebaseReadPrincipal(request, verifyToken),
      (error) => error.code === adapter.FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED,
      authorization
    );
  }

  assert.equal(verifierCalls, 0);
});

test('unverified or uid-less verifier results cannot create owner authority', async () => {
  const { adapter } = await loadModules();

  for (const verifiedIdentity of [
    null,
    false,
    {},
    { email: 'owner@example.invalid' },
    { uid: '' },
    { uid: ' spaced-uid ' }
  ]) {
    await assert.rejects(
      () => adapter.resolveFirebaseReadPrincipal(
        authRequest(),
        async () => verifiedIdentity
      ),
      (error) => error.code === adapter.FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
    );
  }
});

test('verifier throw maps to a bounded sanitized availability error', async () => {
  const { adapter } = await loadModules();
  const request = authRequest('private-token', {
    'x-lovebud-request-id': 'req-auth-safe'
  });
  let error;

  try {
    await adapter.resolveFirebaseReadPrincipal(request, async () => {
      const raw = new Error('PRIVATE_PROVIDER_FAILURE firebase-secret-token');
      raw.details = { certificate: 'private-cert', email: 'secret@example.invalid' };
      throw raw;
    });
  } catch (caught) {
    error = caught;
  }

  assert.equal(
    error.code,
    adapter.FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE
  );
  const response = adapter.buildFirebaseReadPrincipalErrorResponse(error, request);
  const bodyText = await response.text();
  const body = JSON.parse(bodyText);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-auth-safe');
  assert.deepEqual(body, {
    error: {
      code: 'FIREBASE_VERIFIER_UNAVAILABLE',
      message: 'Authentication verifier unavailable'
    }
  });

  for (const forbidden of [
    'PRIVATE_PROVIDER_FAILURE',
    'firebase-secret-token',
    'private-cert',
    'secret@example.invalid',
    'details',
    'stack',
    'cause'
  ]) {
    assert.equal(bodyText.includes(forbidden), false, forbidden);
  }
});

test('caller owner, user, email, and provider headers never become principal authority', async () => {
  const { adapter } = await loadModules();
  const request = authRequest('verified-token', {
    'x-owner-id': 'attacker-owner',
    'x-user-id': 'attacker-user',
    'x-user-email': 'attacker@example.invalid',
    'x-auth-provider': 'neon'
  });

  const principal = await adapter.resolveFirebaseReadPrincipal(
    request,
    async () => ({
      uid: 'verified-firebase-uid',
      email: 'verified-but-not-authority@example.invalid'
    })
  );

  assert.deepEqual(principal, {
    provider: 'firebase',
    providerSubject: 'verified-firebase-uid',
    legacyOwnerId: 'verified-firebase-uid'
  });
});

test('Firebase principal contract fixes provider and rejects email or multi-issuer authority', async () => {
  const { adapter } = await loadModules();

  assert.deepEqual(adapter.FIREBASE_READ_PRINCIPAL_CONTRACT, {
    provider: 'firebase',
    outputFields: [
      'provider',
      'providerSubject',
      'legacyOwnerId'
    ],
    ownerAuthority: 'verified-firebase-uid',
    acceptsEmailAuthority: false,
    acceptsCallerUidAuthority: false,
    acceptsMultipleIssuers: false
  });
});

test('worker exposes a provider-neutral read-principal seam without coupling public Growing reads to auth', async () => {
  const { core, workerModule } = await loadModules();
  let principalCalls = 0;
  const readPrincipal = async () => {
    principalCalls += 1;
    return Object.freeze({
      provider: 'firebase',
      providerSubject: 'verified-user',
      legacyOwnerId: 'verified-user'
    });
  };
  const query = core.createQueryCapability(async () => []);
  const worker = workerModule.createLovePlatformApiWorker({ query, readPrincipal });

  const principal = await worker.resolveReadPrincipal(authRequest());
  assert.equal(principal.providerSubject, 'verified-user');
  assert.equal(principalCalls, 1);

  const growingResponse = await worker.fetch(
    new Request('https://platform.invalid/api/community/growing-trees')
  );
  assert.equal(growingResponse.status, 200);
  assert.deepEqual(await growingResponse.json(), []);
  assert.equal(principalCalls, 1, 'public Growing read must not invoke auth');
});

test('worker fails closed when no read-principal resolver exists and keeps unsupported routes closed', async () => {
  const { core, workerModule } = await loadModules();
  const worker = workerModule.createLovePlatformApiWorker();

  await assert.rejects(
    () => worker.resolveReadPrincipal(authRequest()),
    (error) => error instanceof core.PlatformApiError
      && error.code === core.PLATFORM_ERROR.CAPABILITY_UNSUPPORTED
  );

  const response = await worker.fetch(
    new Request('https://platform.invalid/api/private/trees')
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'PLATFORM_ROUTE_UNAVAILABLE',
      message: 'Platform route unavailable'
    }
  });
});

test('invalid read-principal composition is rejected at worker construction', async () => {
  const { workerModule } = await loadModules();

  assert.throws(
    () => workerModule.createLovePlatformApiWorker({ readPrincipal: {} }),
    /readPrincipal must be a function/
  );
});

test('contract path requires no provider SDK, network, database, Neon Auth, or multi-issuer implementation', async () => {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');
  const productionSource = `${adapterSource}\n${workerSource}`;

  for (const forbidden of [
    'firebase-admin',
    'firebase_admin',
    '@neondatabase/serverless',
    "from 'pg'",
    'DATABASE_URL',
    'neon_auth',
    'Neon Auth',
    'issuerMap',
    'acceptedIssuers',
    'globalThis.fetch',
    'fetch(' 
  ]) {
    assert.equal(productionSource.includes(forbidden), false, forbidden);
  }

  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error('external call forbidden');
  };

  try {
    const { adapter } = await loadModules();
    const principal = await adapter.resolveFirebaseReadPrincipal(
      authRequest(),
      async () => ({ uid: 'offline-verified-user' })
    );
    assert.equal(principal.legacyOwnerId, 'offline-verified-user');
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
