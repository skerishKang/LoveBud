const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const corePath = path.join(root, 'workers/love-platform-api/core.js');
const workerPath = path.join(root, 'workers/love-platform-api/worker.js');

async function loadFoundation() {
  const [core, workerModule] = await Promise.all([
    import('../../workers/love-platform-api/core.js'),
    import('../../workers/love-platform-api/worker.js')
  ]);
  return { core, worker: workerModule.default };
}

function requestIdOf(response) {
  return response.headers.get('x-lovebud-request-id');
}

test('request context is provider-neutral and propagates a bounded safe request id', async () => {
  const { core } = await loadFoundation();
  const request = new Request('https://platform.invalid/v1/example?private=ignored', {
    headers: { 'x-lovebud-request-id': 'req-client_123:ok' }
  });

  const context = core.createRequestContext(request);

  assert.deepEqual(Object.keys(context), [
    'requestId',
    'method',
    'path',
    'principal',
    'capabilities'
  ]);
  assert.equal(context.requestId, 'req-client_123:ok');
  assert.equal(context.method, 'GET');
  assert.equal(context.path, '/v1/example');
  assert.equal(context.principal, null);
  assert.equal(context.capabilities.query, null);
  assert.equal(context.capabilities.transaction, null);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.capabilities), true);
});

test('unsafe and overlong request ids are never propagated', async () => {
  const { core } = await loadFoundation();

  for (const unsafeId of ['contains spaces', 'x'.repeat(81), 'bad/slash']) {
    const request = new Request('https://platform.invalid/', {
      headers: { 'x-lovebud-request-id': unsafeId }
    });
    const context = core.createRequestContext(request);

    assert.notEqual(context.requestId, unsafeId);
    assert.match(context.requestId, /^[A-Za-z0-9._:-]+$/);
    assert.ok(context.requestId.length > 0 && context.requestId.length <= 80);
  }
});

test('shared streamed body guard rejects bytes beyond the canonical boundary', async () => {
  const { core } = await loadFoundation();
  const request = new Request('https://platform.invalid/body', {
    method: 'POST',
    body: 'x'.repeat(core.PLATFORM_FOUNDATION_CONTRACT.requestBodyMaxBytes + 1)
  });

  await assert.rejects(
    () => core.readPlatformRequestBody(request),
    (error) => {
      assert.equal(error.code, core.PLATFORM_ERROR.REQUEST_BODY_TOO_LARGE);
      return true;
    }
  );
});

test('wire errors expose only stable sanitized fields', async () => {
  const { core } = await loadFoundation();
  const rawError = new Error('SECRET_CONNECTION_STRING sentinel-private-value');
  rawError.sql = 'SELECT private_data FROM users';
  rawError.details = { token: 'secret-token' };
  rawError.cause = new Error('provider internals');

  const response = core.buildPlatformErrorResponse(rawError, 'req-safe');
  const bodyText = await response.text();
  const body = JSON.parse(bodyText);

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(requestIdOf(response), 'req-safe');
  assert.deepEqual(Object.keys(body), ['error']);
  assert.deepEqual(Object.keys(body.error), ['code', 'message']);
  assert.deepEqual(body.error, {
    code: 'INTERNAL_ERROR',
    message: 'Internal platform error'
  });

  for (const forbidden of [
    'SECRET_CONNECTION_STRING',
    'sentinel-private-value',
    'SELECT private_data',
    'secret-token',
    'provider internals',
    'stack',
    'cause',
    'details',
    'sql'
  ]) {
    assert.equal(bodyText.includes(forbidden), false, forbidden);
  }
});

test('query capability never implies interactive transaction capability', async () => {
  const { core } = await loadFoundation();
  const query = core.createQueryCapability(async () => []);
  const capabilities = core.createCapabilitySet({ query });

  assert.equal(core.requireCapability(capabilities, 'query'), query);
  assert.equal(capabilities.transaction, null);
  assert.throws(
    () => core.requireCapability(capabilities, 'transaction'),
    (error) => {
      assert.equal(error.code, core.PLATFORM_ERROR.CAPABILITY_UNSUPPORTED);
      return true;
    }
  );
});

test('transaction capability is explicit and independent from query capability', async () => {
  const { core } = await loadFoundation();
  const transaction = core.createTransactionCapability(async (work) => work());
  const capabilities = core.createCapabilitySet({ transaction });

  assert.equal(capabilities.query, null);
  assert.equal(core.requireCapability(capabilities, 'transaction'), transaction);
  assert.throws(
    () => core.requireCapability(capabilities, 'query'),
    (error) => error.code === core.PLATFORM_ERROR.CAPABILITY_UNSUPPORTED
  );
});

test('unrouted worker fails closed without Production secrets or provider bindings', async () => {
  const { worker } = await loadFoundation();
  let environmentReads = 0;
  const forbiddenEnvironment = new Proxy({}, {
    get() {
      environmentReads += 1;
      throw new Error('environment must not be read');
    }
  });

  const response = await worker.fetch(
    new Request('https://platform.invalid/api/trees'),
    forbiddenEnvironment
  );
  const body = await response.json();

  assert.equal(environmentReads, 0);
  assert.equal(response.status, 404);
  assert.deepEqual(body, {
    error: {
      code: 'PLATFORM_ROUTE_UNAVAILABLE',
      message: 'Platform route unavailable'
    }
  });
  assert.match(requestIdOf(response), /^[A-Za-z0-9._:-]+$/);
});

test('unrouted worker makes no external network or database call', async () => {
  const { worker } = await loadFoundation();
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error('external call forbidden');
  };

  try {
    const response = await worker.fetch(new Request('https://platform.invalid/unused'));
    assert.equal(response.status, 404);
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('foundation source has no Product route, auth provider, DB driver, or Production secret coupling', () => {
  const source = [
    fs.readFileSync(corePath, 'utf8'),
    fs.readFileSync(workerPath, 'utf8')
  ].join('\n');

  const forbiddenFragments = [
    'functions/api/',
    'modal_compute',
    'firebase-admin',
    '@neondatabase/serverless',
    "from 'pg'",
    'DATABASE_URL',
    'DIRECT_NEON_BROWSE_DATABASE_URL',
    'MODAL_BASE_URL',
    'HYPERDRIVE',
    'service_binding'
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});

test('sanitized error categories and source-only capability posture remain stable', async () => {
  const { core } = await loadFoundation();

  assert.deepEqual(core.PLATFORM_FOUNDATION_CONTRACT.errorCategories, [
    'PLATFORM_ROUTE_UNAVAILABLE',
    'REQUEST_BODY_TOO_LARGE',
    'REQUEST_BODY_READ_FAILED',
    'CAPABILITY_UNSUPPORTED',
    'INTERNAL_ERROR'
  ]);
  assert.equal(core.PLATFORM_FOUNDATION_CONTRACT.name, 'love-platform-api');
  assert.equal(core.PLATFORM_FOUNDATION_CONTRACT.routed, false);
  assert.equal(core.PLATFORM_FOUNDATION_CONTRACT.productionCapability, 'none');
  assert.equal(core.PLATFORM_FOUNDATION_CONTRACT.requestBodyMaxBytes, 128 * 1024);
});
