const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const workerPath = path.join(root, 'workers/love-platform-api/worker.js');
const growingPath = path.join(root, 'workers/love-platform-api/public-growing-read.js');
const layerRegistryPath = path.join(root, 'tests/test-layer-classification.json');
const thisTestPath = 'tests/contracts/love-platform-api-public-growing-read.test.cjs';

async function loadModules() {
  const [core, growing, workerModule] = await Promise.all([
    import('../../workers/love-platform-api/core.js'),
    import('../../workers/love-platform-api/public-growing-read.js'),
    import('../../workers/love-platform-api/worker.js')
  ]);
  return { core, growing, workerModule };
}

function row(overrides = {}) {
  return {
    id: 'tree-public-1',
    title: 'Growing Tree',
    visibility: 'public',
    createdAt: '2026-08-01T00:00:00+00:00',
    updatedAt: '2026-08-10T00:00:00+00:00',
    representativeThumbnail: 'https://media.invalid/thumb.jpg',
    representativeMemorySourceUrl: 'https://media.invalid/source',
    representativeMemoryVisibility: 'public',
    publicMemoryCount: 1,
    emotionTags: ['joy', 'calm', 'joy'],
    ownerId: 'must-not-leak-owner',
    memberId: 'must-not-leak-member',
    authSubject: 'must-not-leak-auth',
    internalNote: 'must-not-leak-internal',
    ...overrides
  };
}

function responseRequestId(response) {
  return response.headers.get('x-lovebud-request-id');
}

test('Growing route uses the provider-neutral Query capability and preserves the current LoveBud public projection', async () => {
  const { core, growing, workerModule } = await loadModules();
  const descriptors = [];
  const fixtures = [
    row({ id: 'private-tree', visibility: 'private' }),
    row({ id: 'zero-public-memories', publicMemoryCount: 0 }),
    row({
      id: 'tree-a',
      title: 'A',
      updatedAt: '2026-08-12T00:00:00+00:00',
      publicMemoryCount: 1,
      emotionTags: ['warm', 'bright', 'warm']
    }),
    row({
      id: 'tree-b',
      title: '',
      updatedAt: null,
      publicMemoryCount: 2,
      representativeThumbnail: '',
      representativeMemorySourceUrl: '',
      representativeMemoryVisibility: null,
      emotionTags: ['z', '', 'a', 7, 'z']
    }),
    row({ id: 'unlisted-tree', visibility: 'unlisted' }),
    row({ id: 'null-visibility-tree', visibility: null }),
    row({ id: 'too-many-public-memories', publicMemoryCount: 3 }),
    row({ id: 'private-media-proof', representativeMemoryVisibility: 'private' })
  ];

  const query = core.createQueryCapability(async (descriptor) => {
    descriptors.push(descriptor);
    return fixtures;
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });
  const response = await worker.fetch(new Request(
    'https://platform.invalid/api/community/growing-trees',
    { headers: { 'x-lovebud-request-id': 'req-growing_123' } }
  ));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(responseRequestId(response), 'req-growing_123');
  assert.equal(descriptors.length, 1);
  assert.deepEqual(descriptors[0], {
    operation: 'lovebud.public-growing-tree-snapshots.v1',
    limit: 6,
    treeVisibility: 'public',
    memoryVisibility: 'public',
    publicMemoryCount: { min: 1, max: 2 },
    order: [
      { field: 'updatedAt', direction: 'desc', nulls: 'last' },
      { field: 'createdAt', direction: 'desc', nulls: 'last' }
    ]
  });
  assert.equal(Object.isFrozen(descriptors[0]), true);
  assert.equal(Object.isFrozen(descriptors[0].publicMemoryCount), true);
  assert.equal(Object.isFrozen(descriptors[0].order), true);

  assert.deepEqual(body, [
    {
      id: 'tree-a',
      title: 'A',
      visibility: 'public',
      createdAt: '2026-08-01T00:00:00+00:00',
      updatedAt: '2026-08-12T00:00:00+00:00',
      representativeThumbnail: 'https://media.invalid/thumb.jpg',
      memoryCount: 1,
      emotionTags: ['bright', 'warm'],
      stage: 'growing',
      theme: 'LoveTree',
      timeRange: '',
      representativeMemorySourceUrl: 'https://media.invalid/source'
    },
    {
      id: 'tree-b',
      title: '나의 Lovetree',
      visibility: 'public',
      createdAt: '2026-08-01T00:00:00+00:00',
      updatedAt: null,
      representativeThumbnail: '',
      memoryCount: 2,
      emotionTags: ['a', 'z'],
      stage: 'growing',
      theme: 'LoveTree',
      timeRange: '',
      representativeMemorySourceUrl: ''
    }
  ]);

  for (const item of body) {
    assert.deepEqual(Object.keys(item), growing.PUBLIC_GROWING_READ_CONTRACT.outputKeys);
    for (const forbidden of ['ownerId', 'memberId', 'authSubject', 'internalNote']) {
      assert.equal(Object.hasOwn(item, forbidden), false, forbidden);
    }
  }
});

test('Growing limit keeps the current default and 3..12 clamp without caller SQL or transport data', async () => {
  const { core, workerModule } = await loadModules();
  const cases = [
    ['', 6],
    ['?limit=', 6],
    ['?limit=abc', 6],
    ['?limit=0', 6],
    ['?limit=1', 3],
    ['?limit=3', 3],
    ['?limit=7', 7],
    ['?limit=12', 12],
    ['?limit=99', 12]
  ];

  for (const [suffix, expectedLimit] of cases) {
    const descriptors = [];
    const query = core.createQueryCapability(async (descriptor) => {
      descriptors.push(descriptor);
      return [];
    });
    const worker = workerModule.createLovePlatformApiWorker({ query });
    const response = await worker.fetch(new Request(
      `https://platform.invalid/api/community/growing-trees${suffix}`
    ));
    assert.equal(response.status, 200, suffix || 'default');
    assert.equal(descriptors.length, 1);
    assert.equal(descriptors[0].limit, expectedLimit);
    assert.deepEqual(Object.keys(descriptors[0]), [
      'operation',
      'limit',
      'treeVisibility',
      'memoryVisibility',
      'publicMemoryCount',
      'order'
    ]);
  }
});

test('fractional Growing limit fails closed before the Query capability is invoked', async () => {
  const { core, workerModule } = await loadModules();
  let queryCalls = 0;
  const query = core.createQueryCapability(async () => {
    queryCalls += 1;
    return [];
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });
  const response = await worker.fetch(new Request(
    'https://platform.invalid/api/community/growing-trees?limit=4.5',
    { headers: { 'x-lovebud-request-id': 'req-fractional' } }
  ));
  const body = await response.json();

  assert.equal(queryCalls, 0);
  assert.equal(response.status, 404);
  assert.equal(responseRequestId(response), 'req-fractional');
  assert.deepEqual(body, {
    error: {
      code: 'PLATFORM_ROUTE_UNAVAILABLE',
      message: 'Platform route unavailable'
    }
  });
});

test('matched Growing route fails closed when no Query capability is injected', async () => {
  const { workerModule } = await loadModules();
  const response = await workerModule.default.fetch(new Request(
    'https://platform.invalid/api/community/growing-trees',
    { headers: { 'x-lovebud-request-id': 'req-no-query' } }
  ));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(responseRequestId(response), 'req-no-query');
  assert.deepEqual(body, {
    error: {
      code: 'CAPABILITY_UNSUPPORTED',
      message: 'Required platform capability unavailable'
    }
  });
});

test('unknown or non-GET routes remain fail-closed and do not invoke the Growing Query capability', async () => {
  const { core, workerModule } = await loadModules();
  let queryCalls = 0;
  const query = core.createQueryCapability(async () => {
    queryCalls += 1;
    return [];
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });

  for (const request of [
    new Request('https://platform.invalid/api/community/latest-trees'),
    new Request('https://platform.invalid/api/community/growing-trees', { method: 'POST' }),
    new Request('https://platform.invalid/api/community/growing-trees/extra')
  ]) {
    const response = await worker.fetch(request);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(body.error, {
      code: 'PLATFORM_ROUTE_UNAVAILABLE',
      message: 'Platform route unavailable'
    });
  }

  assert.equal(queryCalls, 0);
});

test('Query/provider failures are bounded and never leak raw error details', async () => {
  const { core, workerModule } = await loadModules();
  const query = core.createQueryCapability(async () => {
    const error = new Error('SECRET_CONNECTION_STRING provider-private-host');
    error.sql = 'SELECT private_column FROM private_table';
    error.details = { token: 'secret-token' };
    throw error;
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });
  const response = await worker.fetch(new Request(
    'https://platform.invalid/api/community/growing-trees',
    { headers: { 'x-lovebud-request-id': 'req-safe-error' } }
  ));
  const text = await response.text();
  const body = JSON.parse(text);

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(responseRequestId(response), 'req-safe-error');
  assert.deepEqual(body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal platform error'
    }
  });
  for (const forbidden of [
    'SECRET_CONNECTION_STRING',
    'provider-private-host',
    'SELECT private_column',
    'private_table',
    'secret-token',
    'sql',
    'details',
    'stack'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test('malformed Query results fail closed with sanitized INTERNAL_ERROR', async () => {
  const { core, workerModule } = await loadModules();
  const query = core.createQueryCapability(async () => ({ not: 'an array' }));
  const worker = workerModule.createLovePlatformApiWorker({ query });
  const response = await worker.fetch(new Request(
    'https://platform.invalid/api/community/growing-trees'
  ));
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal platform error'
    }
  });
});

test('Growing source performs no DB-driver selection, Product-route import, auth coupling, caller SQL, or external fetch', async () => {
  const { core, workerModule } = await loadModules();
  const source = [
    fs.readFileSync(workerPath, 'utf8'),
    fs.readFileSync(growingPath, 'utf8')
  ].join('\n');

  for (const forbidden of [
    'functions/api/',
    'modal_compute',
    'firebase-admin',
    '@neondatabase/serverless',
    "from 'pg'",
    'DATABASE_URL',
    'DIRECT_NEON_BROWSE_DATABASE_URL',
    'HYPERDRIVE',
    'SELECT ',
    'INSERT ',
    'UPDATE ',
    'DELETE FROM'
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }

  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error('external network is forbidden');
  };
  try {
    const query = core.createQueryCapability(async () => []);
    const worker = workerModule.createLovePlatformApiWorker({ query });
    const response = await worker.fetch(new Request(
      'https://platform.invalid/api/community/growing-trees'
    ));
    assert.equal(response.status, 200);
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Growing contract test is registered exactly once as EXECUTED_FAKE with no external capabilities', () => {
  const registry = JSON.parse(fs.readFileSync(layerRegistryPath, 'utf8'));
  const matches = registry.entries.filter((entry) => entry.path === thisTestPath);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].layer, 'EXECUTED_FAKE');
  assert.deepEqual(matches[0].capabilities, []);
  assert.match(matches[0].rationale, /Growing public-read/i);
  assert.match(matches[0].rationale, /fake Query/i);
  assert.match(matches[0].rationale, /no real external/i);
});
