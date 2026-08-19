const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const workerPath = path.join(root, 'workers/love-platform-api/worker.js');
const routePath = path.join(root, 'workers/love-platform-api/public-lovetree-growing-read.js');
const layerRegistryPath = path.join(root, 'tests/test-layer-classification.json');
const thisTestPath = 'tests/contracts/love-platform-api-public-lovetree-growing-read.test.cjs';

async function loadModules() {
  const [core, route, workerModule] = await Promise.all([
    import('../../workers/love-platform-api/core.js'),
    import('../../workers/love-platform-api/public-lovetree-growing-read.js'),
    import('../../workers/love-platform-api/worker.js')
  ]);
  return { core, route, workerModule };
}

function row(overrides = {}) {
  return {
    id: 'tree-public-1',
    title: 'LoveTree',
    artist: 'Artist',
    visibility: 'public',
    createdAt: '2026-08-01T00:00:00+00:00',
    publicMemoryCount: 3,
    likeCount: 7,
    ownerId: 'must-not-leak-owner',
    memberId: 'must-not-leak-member',
    clientKey: 'must-not-leak-client-key',
    authSubject: 'must-not-leak-auth',
    privateMemo: 'must-not-leak-private',
    ...overrides
  };
}

function request(suffix = '', init = {}) {
  return new Request(`https://platform.invalid/internal/lovetree/public/browse-eligible-trees${suffix}`, init);
}

function responseRequestId(response) {
  return response.headers.get('x-lovebud-request-id');
}

test('LoveTree public growing route uses its distinct anonymous Query capability and exact outward projection', async () => {
  const { core, route, workerModule } = await loadModules();
  const descriptors = [];
  let principalCalls = 0;
  const fixtures = [
    row({ id: 'private-tree', visibility: 'private' }),
    row({ id: 'unlisted-tree', visibility: 'unlisted' }),
    row({ id: 'null-tree', visibility: null }),
    row({ id: 'too-small-0', publicMemoryCount: 0 }),
    row({ id: 'too-small-1', publicMemoryCount: 1 }),
    row({ id: 'too-small-2', publicMemoryCount: 2, totalMemoryCount: 8 }),
    row({ id: 'tree-a', title: 'A', artist: '', publicMemoryCount: 3, likeCount: 9 }),
    row({ id: 'tree-b', title: 'B', artist: 'B Artist', publicMemoryCount: 4, likeCount: null }),
    row({ id: 'tree-negative', title: 'Negative', artist: 'N', publicMemoryCount: 5, likeCount: -2 }),
    row({ id: 'bad-like', likeCount: 1.5 }),
    row({ id: 'bad-artist', artist: null })
  ];

  const query = core.createQueryCapability(async (descriptor) => {
    descriptors.push(descriptor);
    return fixtures;
  });
  const worker = workerModule.createLovePlatformApiWorker({
    query,
    readPrincipal: async () => {
      principalCalls += 1;
      throw new Error('anonymous route must not resolve auth');
    }
  });
  const response = await worker.fetch(request('', {
    headers: {
      authorization: 'Bearer ignored-on-anonymous-route',
      cookie: 'session=ignored',
      'x-lovebud-request-id': 'req-lovetree-growing'
    }
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(responseRequestId(response), 'req-lovetree-growing');
  assert.equal(principalCalls, 0);
  assert.equal(descriptors.length, 1);
  assert.deepEqual(descriptors[0], {
    operation: 'lovetree.public.browse-eligible-trees.v1',
    limit: 6,
    treeVisibility: 'public',
    memoryVisibility: 'public',
    publicMemoryCount: { min: 3 },
    order: [
      { field: 'likeCount', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' }
    ]
  });
  assert.equal(Object.isFrozen(descriptors[0]), true);
  assert.equal(Object.isFrozen(descriptors[0].publicMemoryCount), true);
  assert.equal(Object.isFrozen(descriptors[0].order), true);
  assert.equal(route.PUBLIC_LOVETREE_GROWING_READ_CONTRACT.tertiaryOrder, null);

  assert.deepEqual(body, [
    { id: 'tree-a', title: 'A', artist: '', likeCount: 9 },
    { id: 'tree-b', title: 'B', artist: 'B Artist', likeCount: 0 },
    { id: 'tree-negative', title: 'Negative', artist: 'N', likeCount: -2 }
  ]);
  for (const item of body) {
    assert.deepEqual(Object.keys(item), route.PUBLIC_LOVETREE_GROWING_READ_CONTRACT.outputKeys);
    for (const forbidden of ['ownerId', 'memberId', 'clientKey', 'authSubject', 'privateMemo', 'visibility', 'publicMemoryCount', 'createdAt']) {
      assert.equal(Object.hasOwn(item, forbidden), false, forbidden);
    }
  }
});

test('LoveTree normalized limit preserves deterministic default/clamp behavior including whitespace and infinities', async () => {
  const { core, workerModule } = await loadModules();
  const cases = [
    ['', 6],
    ['?limit=', 6],
    ['?limit=%20%20', 3],
    ['?limit=0', 3],
    ['?limit=1', 3],
    ['?limit=3', 3],
    ['?limit=7', 7],
    ['?limit=12', 12],
    ['?limit=99', 12],
    ['?limit=Infinity', 12],
    ['?limit=-Infinity', 3],
    ['?limit=4&limit=9', 4]
  ];

  for (const [suffix, expectedLimit] of cases) {
    const descriptors = [];
    const query = core.createQueryCapability(async (descriptor) => {
      descriptors.push(descriptor);
      return [];
    });
    const worker = workerModule.createLovePlatformApiWorker({ query });
    const response = await worker.fetch(request(suffix));
    assert.equal(response.status, 200, suffix || 'default');
    assert.equal(descriptors.length, 1, suffix || 'default');
    assert.equal(descriptors[0].limit, expectedLimit, suffix || 'default');
  }
});

test('ambiguous NaN-producing and fractional raw limits fail closed before Query execution', async () => {
  const { core, workerModule } = await loadModules();
  for (const raw of ['abc', 'NaN', '4.5', '1.25']) {
    let queryCalls = 0;
    const query = core.createQueryCapability(async () => {
      queryCalls += 1;
      return [];
    });
    const worker = workerModule.createLovePlatformApiWorker({ query });
    const response = await worker.fetch(request(`?limit=${encodeURIComponent(raw)}`));
    assert.equal(queryCalls, 0, raw);
    assert.equal(response.status, 404, raw);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'PLATFORM_ROUTE_UNAVAILABLE',
        message: 'Platform route unavailable'
      }
    });
  }
});

test('projection preserves provider order, including full-tie input order, and invents no tertiary sort', async () => {
  const { route } = await loadModules();
  const rows = [
    row({ id: 'strict-first', likeCount: 9, createdAt: '2026-08-03T00:00:00Z' }),
    row({ id: 'tie-b', likeCount: 5, createdAt: '2026-08-02T00:00:00Z' }),
    row({ id: 'tie-a', likeCount: 5, createdAt: '2026-08-02T00:00:00Z' }),
    row({ id: 'strict-last', likeCount: 5, createdAt: '2026-08-01T00:00:00Z' })
  ];
  const projected = route.projectPublicLoveTreeGrowingRows(rows, 6);
  assert.deepEqual(projected.map((item) => item.id), [
    'strict-first',
    'tie-b',
    'tie-a',
    'strict-last'
  ]);
  assert.equal(route.PUBLIC_LOVETREE_GROWING_READ_CONTRACT.order.length, 2);
  assert.equal(route.PUBLIC_LOVETREE_GROWING_READ_CONTRACT.tertiaryOrder, null);
});

test('matched internal route fails closed when Query capability is absent', async () => {
  const { workerModule } = await loadModules();
  const response = await workerModule.default.fetch(request('', {
    headers: { 'x-lovebud-request-id': 'req-no-query' }
  }));
  assert.equal(response.status, 503);
  assert.equal(responseRequestId(response), 'req-no-query');
  assert.deepEqual(await response.json(), {
    error: {
      code: 'CAPABILITY_UNSUPPORTED',
      message: 'Required platform capability unavailable'
    }
  });
});

test('internal route identity is distinct and unknown/non-GET forms remain closed', async () => {
  const { core, route, workerModule } = await loadModules();
  let queryCalls = 0;
  const query = core.createQueryCapability(async () => {
    queryCalls += 1;
    return [];
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });
  assert.equal(route.PUBLIC_LOVETREE_GROWING_READ_PATH, '/internal/lovetree/public/browse-eligible-trees');
  assert.equal(route.PUBLIC_LOVETREE_GROWING_READ_OPERATION, 'lovetree.public.browse-eligible-trees.v1');

  for (const badRequest of [
    new Request('https://platform.invalid/internal/lovetree/public/growing-trees'),
    request('', { method: 'POST' }),
    new Request('https://platform.invalid/internal/lovetree/public/browse-eligible-trees/extra')
  ]) {
    const response = await worker.fetch(badRequest);
    assert.equal(response.status, 404);
  }
  assert.equal(queryCalls, 0);
});

test('Query/provider failures and malformed results are bounded and sanitized', async () => {
  const { core, workerModule } = await loadModules();
  const failingQuery = core.createQueryCapability(async () => {
    const error = new Error('SECRET_PROVIDER private-host');
    error.sql = 'SELECT private_column FROM private_table';
    error.details = { token: 'secret-token' };
    throw error;
  });
  let response = await workerModule.createLovePlatformApiWorker({ query: failingQuery }).fetch(request());
  let text = await response.text();
  assert.equal(response.status, 500);
  assert.deepEqual(JSON.parse(text), {
    error: { code: 'INTERNAL_ERROR', message: 'Internal platform error' }
  });
  for (const forbidden of ['SECRET_PROVIDER', 'private-host', 'SELECT private_column', 'secret-token', 'sql', 'details', 'stack']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }

  const malformedQuery = core.createQueryCapability(async () => ({ rows: [] }));
  response = await workerModule.createLovePlatformApiWorker({ query: malformedQuery }).fetch(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Internal platform error' }
  });
});

test('LoveTree sibling does not rewrite LoveBud Growing semantics', async () => {
  const { core, workerModule } = await loadModules();
  const descriptors = [];
  const query = core.createQueryCapability(async (descriptor) => {
    descriptors.push(descriptor);
    return [];
  });
  const worker = workerModule.createLovePlatformApiWorker({ query });
  const response = await worker.fetch(new Request('https://platform.invalid/api/community/growing-trees'));
  assert.equal(response.status, 200);
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].operation, 'lovebud.public-growing-tree-snapshots.v1');
  assert.deepEqual(descriptors[0].publicMemoryCount, { min: 1, max: 2 });
});

test('LoveTree source performs no Product rewiring, DB-driver selection, auth coupling, Transaction use, caller SQL, or external fetch', async () => {
  const { core, workerModule } = await loadModules();
  const source = [
    fs.readFileSync(workerPath, 'utf8'),
    fs.readFileSync(routePath, 'utf8')
  ].join('\n');

  for (const forbidden of [
    'functions/api/',
    'modal_compute',
    'firebase-admin',
    'firebase_admin',
    '@neondatabase/serverless',
    "from 'pg'",
    'DATABASE_URL',
    'DIRECT_NEON_BROWSE_DATABASE_URL',
    'HYPERDRIVE',
    'transaction.run',
    "requireCapability(context.capabilities, 'transaction')",
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
    const response = await worker.fetch(request());
    assert.equal(response.status, 200);
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('LoveTree contract test is registered exactly once as EXECUTED_FAKE with no external capabilities', () => {
  const registry = JSON.parse(fs.readFileSync(layerRegistryPath, 'utf8'));
  const matches = registry.entries.filter((entry) => entry.path === thisTestPath);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].layer, 'EXECUTED_FAKE');
  assert.deepEqual(matches[0].capabilities, []);
  assert.match(matches[0].rationale, /LoveTree-compatible public growing/i);
  assert.match(matches[0].rationale, /fake Query/i);
  assert.match(matches[0].rationale, /no real external/i);
});
