const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');

async function loadModules() {
  const [core, growingContract, growingQuery, pathModule] = await Promise.all([
    import('../../workers/love-platform-api/core.js'),
    import('../../workers/love-platform-api/public-growing-read.js'),
    import('../../functions/_shared/love-platform-api-growing-neon-query.js'),
    import('../../functions/api/[[path]].js')
  ]);
  return { core, growingContract, growingQuery, pathModule };
}

const NEON_TEST_URL = 'postgresql://user:pass@ep-growing-test.us-east-1.neon.tech/neondb?sslmode=require';

function makeSyntheticRow(overrides = {}) {
  return {
    id: 'tree-101',
    title: 'Growing Hope',
    visibility: 'public',
    created_at: '2026-08-01 10:00:00.123456+00',
    updated_at: '2026-08-02 12:00:00.654321+00',
    public_memory_count: 1,
    emotion_tags: [['joy', 'hope']],
    representative_thumbnail: 'https://media.invalid/thumb.jpg',
    representative_memory_source_url: 'https://media.invalid/source',
    representative_memory_visibility: 'public',
    ...overrides,
  };
}

test('1. Default / absent gate leaves route Modal-backed', async () => {
  const { growingQuery, pathModule } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = { MODAL_BASE_URL: 'https://modal.test' };
  
  const config = growingQuery.readGrowingReadConfig(env);
  assert.equal(config.isDirect, false);

  const modalUrl = pathModule.buildModalUrl(req, env);
  assert.ok(modalUrl);
  assert.equal(modalUrl.pathname, '/modal/browse/growing');
  assert.equal(modalUrl.searchParams.get('limit'), '6');
});

test('2. Gate = modal leaves route Modal-backed', async () => {
  const { growingQuery, pathModule } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = { LB_GROWING_READ_RUNTIME: 'modal', MODAL_BASE_URL: 'https://modal.test' };
  
  const config = growingQuery.readGrowingReadConfig(env);
  assert.equal(config.isDirect, false);

  const modalUrl = pathModule.buildModalUrl(req, env);
  assert.ok(modalUrl);
  assert.equal(modalUrl.pathname, '/modal/browse/growing');
});

test('3. Unknown gate value leaves route Modal-backed', async () => {
  const { growingQuery } = await loadModules();
  const env = { LB_GROWING_READ_RUNTIME: 'legacy_v1', MODAL_BASE_URL: 'https://modal.test' };
  const config = growingQuery.readGrowingReadConfig(env);
  assert.equal(config.isDirect, false);
});

test('4. Gate = direct_neon activates direct query adapter for Growing route', async () => {
  const { growingQuery } = await loadModules();
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const config = growingQuery.readGrowingReadConfig(env);
  assert.equal(config.isDirect, true);
  assert.equal(config.configured, true);
  assert.equal(config.connectionString, NEON_TEST_URL);
});

test('5. Direct gate + missing dedicated DB secret fails closed without Modal fallback', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    MODAL_BASE_URL: 'https://modal.test',
  };
  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-fail-closed-1');
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(res.headers.get('x-lovebud-route-status'), 'config-absent');
  assert.equal(res.headers.get('x-lovebud-request-id'), 'req-fail-closed-1');
  const body = await res.json();
  assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('6. Generic DATABASE_URL or other envs cannot satisfy direct Neon config', async () => {
  const { growingQuery } = await loadModules();
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    DATABASE_URL: NEON_TEST_URL,
    NETLIFY_DATABASE_URL: NEON_TEST_URL,
    DIRECT_NEON_BROWSE_DATABASE_URL: NEON_TEST_URL,
    DB_TRANSPORT_COMPAT_NEON_DATABASE_URL: NEON_TEST_URL,
  };
  const config = growingQuery.readGrowingReadConfig(env);
  assert.equal(config.isDirect, true);
  assert.equal(config.configured, false);
  assert.equal(config.connectionString, '');
});

test('7. Direct adapter returns 200 with canonical public DTO and no private leaks', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees?limit=6', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const mockExecutor = async (text, values) => {
    assert.match(text, /WHERE visibility = 'public'/);
    assert.match(text, /HAVING count\(\*\) BETWEEN 1 AND 2/);
    assert.deepEqual(values, [6]);
    return [
      makeSyntheticRow({
        id: 'tree-good-1',
        title: 'Spring Tree',
        public_memory_count: 2,
        created_at: '2026-08-01 12:00:00.123456+00',
        updated_at: '2026-08-02 15:30:00.654321+00',
      })
    ];
  };

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-direct-200', { executorOverride: mockExecutor });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(res.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(res.headers.get('x-lovebud-request-id'), 'req-direct-200');

  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
  const item = body[0];
  assert.equal(item.id, 'tree-good-1');
  assert.equal(item.title, 'Spring Tree');
  assert.equal(item.visibility, 'public');
  assert.equal(item.createdAt, '2026-08-01T12:00:00.123456+00:00');
  assert.equal(item.updatedAt, '2026-08-02T15:30:00.654321+00:00');
  assert.equal(item.memoryCount, 2);
  assert.equal(item.stage, 'growing');
  assert.equal(item.theme, 'LoveTree');
  assert.equal(item.timeRange, '');
  assert.equal(item.representativeThumbnail, 'https://media.invalid/thumb.jpg');
  assert.equal(item.representativeMemorySourceUrl, 'https://media.invalid/source');
  assert.deepEqual(item.emotionTags, ['hope', 'joy']);

  // Verify zero private leakage
  for (const forbiddenKey of ['ownerId', 'owner_id', 'memberId', 'authSubject', 'email', 'password']) {
    assert.equal(Object.hasOwn(item, forbiddenKey), false);
  }
});

test('8. Growing eligibility: public Memory count 1 and 2 eligible; 0 and >=3 excluded', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const mockExecutor = async () => [
    makeSyntheticRow({ id: 'tree-count-0', public_memory_count: 0 }),
    makeSyntheticRow({ id: 'tree-count-1', public_memory_count: 1 }),
    makeSyntheticRow({ id: 'tree-count-2', public_memory_count: 2 }),
    makeSyntheticRow({ id: 'tree-count-3', public_memory_count: 3 }),
  ];

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-eligibility', { executorOverride: mockExecutor });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
  assert.deepEqual(body.map((t) => t.id), ['tree-count-1', 'tree-count-2']);
});

test('9. Private tree or non-public representative memory excluded from output', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const mockExecutor = async () => [
    makeSyntheticRow({ id: 'private-tree', visibility: 'private' }),
    makeSyntheticRow({ id: 'private-media-tree', representative_memory_visibility: 'private' }),
    makeSyntheticRow({ id: 'valid-tree', visibility: 'public', representative_memory_visibility: 'public' }),
  ];

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-privacy', { executorOverride: mockExecutor });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].id, 'valid-tree');
});

test('10. Limit normalization: default 6, clamp 3..12', async () => {
  const { growingContract } = await loadModules();
  assert.equal(growingContract.normalizePublicGrowingLimit(undefined), 6);
  assert.equal(growingContract.normalizePublicGrowingLimit(null), 6);
  assert.equal(growingContract.normalizePublicGrowingLimit(''), 6);
  assert.equal(growingContract.normalizePublicGrowingLimit(0), 6);
  assert.equal(growingContract.normalizePublicGrowingLimit(1), 3);
  assert.equal(growingContract.normalizePublicGrowingLimit(2), 3);
  assert.equal(growingContract.normalizePublicGrowingLimit(5), 5);
  assert.equal(growingContract.normalizePublicGrowingLimit(12), 12);
  assert.equal(growingContract.normalizePublicGrowingLimit(50), 12);
});

test('11. Direct Neon error sanitization: database errors do not leak connection strings', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const failingExecutor = async () => {
    throw new Error('Connection refused to postgresql://secret:pass@ep-growing-test.us-east-1.neon.tech/neondb');
  };

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-error-sanitized', { executorOverride: failingExecutor });
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('x-lovebud-upstream'), 'direct-neon');
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message, 'Internal platform error');
  assert.doesNotMatch(JSON.stringify(body), /secret|pass|neon\.tech/);
});

test('12. Direct executor verifies driver contract via sql.query without network', async () => {
  const { growingQuery } = await loadModules();
  const calls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts?.body });
    return new Response(JSON.stringify({
      rows: [[ 'tree-drv-1', 'Title', 'public', '2026-08-01 00:00:00+00', '2026-08-02 00:00:00+00', 1, JSON.stringify(["joy"]), 'thumb.jpg', 'source.mp4', 'public' ]],
      fields: [
        { name: 'id', dataTypeID: 25 },
        { name: 'title', dataTypeID: 25 },
        { name: 'visibility', dataTypeID: 25 },
        { name: 'created_at', dataTypeID: 25 },
        { name: 'updated_at', dataTypeID: 25 },
        { name: 'public_memory_count', dataTypeID: 23 },
        { name: 'emotion_tags', dataTypeID: 3802 },
        { name: 'representative_thumbnail', dataTypeID: 25 },
        { name: 'representative_memory_source_url', dataTypeID: 25 },
        { name: 'representative_memory_visibility', dataTypeID: 25 }
      ],
      command: 'SELECT',
      rowCount: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const executor = await growingQuery.createDirectNeonGrowingExecutor({ connectionString: NEON_TEST_URL });
    const rows = await executor(growingQuery.GROWING_TREES_SQL, [6]);
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 1);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /neon\.tech\/sql$/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('13. Empty query result returns empty array with 200 and no-store', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const mockExecutor = async () => [];

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-empty', { executorOverride: mockExecutor });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(body, []);
});

test('14. Unrelated routes are not intercepted by direct Growing gate', async () => {
  const { pathModule } = await loadModules();
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    MODAL_BASE_URL: 'https://modal.test',
  };

  const treeReq = new Request('https://lovebud.test/api/community/trees?view=summary', { method: 'GET' });
  const treeModalUrl = pathModule.buildModalUrl(treeReq, env);
  assert.ok(treeModalUrl);
  assert.equal(treeModalUrl.pathname, '/modal/browse/latest');

  const memReq = new Request('https://lovebud.test/api/community/memories?treeId=t1', { method: 'GET' });
  const memModalUrl = pathModule.buildModalUrl(memReq, env);
  assert.ok(memModalUrl);
  assert.equal(memModalUrl.pathname, '/modal/community/memories');
});

test('15. Ordering preservation: multiple eligible rows retain updated_at/created_at order', async () => {
  const { growingQuery } = await loadModules();
  const req = new Request('https://lovebud.test/api/community/growing-trees', { method: 'GET' });
  const env = {
    LB_GROWING_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  const mockExecutor = async () => [
    makeSyntheticRow({ id: 'tree-newest', updated_at: '2026-08-10 00:00:00+00' }),
    makeSyntheticRow({ id: 'tree-middle', updated_at: '2026-08-05 00:00:00+00' }),
    makeSyntheticRow({ id: 'tree-oldest', updated_at: '2026-08-01 00:00:00+00' }),
  ];

  const res = await growingQuery.handlePublicGrowingDirectNeon(req, env, 'req-order', { executorOverride: mockExecutor });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.map((t) => t.id), ['tree-newest', 'tree-middle', 'tree-oldest']);
});

