const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const fs = require('node:fs');

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

// #4113 — public Community Memories direct-Neon source contract.
async function loadCommunityMemoriesDirect() {
  return import('../../functions/_shared/public-community-memories-direct-neon.js');
}

function makeCommunityMemoryRow(overrides = {}) {
  return {
    id: 'memory-1',
    tree_id: 'tree-1',
    parent_id: null,
    title: 'Public Memory',
    memo: 'memo',
    artist: 'artist',
    source: 'source',
    source_url: 'https://example.invalid/source',
    source_type: 'youtube',
    thumbnail: 'https://example.invalid/thumb',
    emotion_tags: ['joy', 'hope'],
    timestamp: '00:12',
    visibility: 'public',
    channel_id: 'channel-1',
    channel_name: 'Channel',
    channel_url: 'https://example.invalid/channel',
    created_at: '2026-08-19 01:02:03.123456+00',
    updated_at: '2026-08-19 02:03:04+00',
    ...overrides,
  };
}

test('#4113 absent/unknown gate preserves the existing Modal Community Memories route', async () => {
  const community = await loadCommunityMemoriesDirect();
  const { pathModule } = await loadModules();
  const request = new Request('https://lovebud.test/api/community/memories?treeId= tree-a &limit=12');

  assert.equal(community.isPublicCommunityMemoriesDirectNeonSelected({}), false);
  assert.equal(community.isPublicCommunityMemoriesDirectNeonSelected({ LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'legacy_v1' }), false);
  assert.equal(community.isPublicCommunityMemoriesDirectNeonSelected({ LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon' }), true);

  const modalUrl = pathModule.buildModalUrl(request, { MODAL_BASE_URL: 'https://modal.test' });
  assert.equal(modalUrl.pathname, '/modal/community/memories');
  assert.equal(modalUrl.searchParams.get('treeId'), ' tree-a ');
  assert.equal(modalUrl.searchParams.get('limit'), '12');
});

test('#4113 direct gate accepts only LOVE_PLATFORM_DATABASE_URL and fails closed when it is absent', async () => {
  const community = await loadCommunityMemoriesDirect();
  const request = new Request('https://lovebud.test/api/community/memories');

  assert.equal(community.readCommunityMemoriesDirectConfig({ DATABASE_URL: NEON_TEST_URL }).configured, false);
  assert.equal(community.readCommunityMemoriesDirectConfig({ NETLIFY_DATABASE_URL: NEON_TEST_URL }).configured, false);
  assert.equal(community.readCommunityMemoriesDirectConfig({ LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL }).configured, true);

  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    request,
    { LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon', MODAL_BASE_URL: 'https://modal.test' },
    'req-4113-config'
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'config-absent');
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('#4113 modern direct query enforces Memory+Tree public intersection, treeId trim, ordering, limit and DTO parity', async () => {
  const community = await loadCommunityMemoriesDirect();
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values });
    if (text.includes("to_regclass('public.memories')")) {
      return [{
        has_memories: true,
        has_tree_title: true,
        has_tree_visibility: true,
        has_tree_name: false,
        has_tree_is_public: false,
      }];
    }
    return [makeCommunityMemoryRow()];
  };

  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    new Request('https://lovebud.test/api/community/memories?treeId=%20tree-1%20&limit=12'),
    {
      LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-4113-modern',
    { executorOverride: executor }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4113-modern');
  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /m\.visibility = 'public'/);
  assert.match(calls[1].text, /t\.visibility = 'public'/);
  assert.match(calls[1].text, /INNER JOIN trees t/);
  assert.match(calls[1].text, /ORDER BY m\.created_at DESC/);
  assert.match(calls[1].text, /LIMIT \$2/);
  assert.deepEqual(calls[1].values, ['tree-1', 12]);

  assert.deepEqual(await response.json(), [{
    id: 'memory-1',
    treeId: 'tree-1',
    parentId: null,
    title: 'Public Memory',
    memo: 'memo',
    artist: 'artist',
    source: 'source',
    sourceUrl: 'https://example.invalid/source',
    sourceType: 'youtube',
    thumbnail: 'https://example.invalid/thumb',
    emotionTags: ['joy', 'hope'],
    timestamp: '00:12',
    visibility: 'public',
    channelId: 'channel-1',
    channelName: 'Channel',
    channelUrl: 'https://example.invalid/channel',
    createdAt: '2026-08-19T01:02:03.123456+00:00',
    updatedAt: '2026-08-19T02:03:04+00:00',
  }]);
});

test('#4113 limit parity clamps first and rejects only fractional values that survive the edge clamp', async () => {
  const community = await loadCommunityMemoriesDirect();
  assert.equal(community.normalizeCommunityMemoriesLimit(null), 100);
  assert.equal(community.normalizeCommunityMemoriesLimit('0'), 100);
  assert.equal(community.normalizeCommunityMemoriesLimit('-1.5'), 1);
  assert.equal(community.normalizeCommunityMemoriesLimit('0.5'), 1);
  assert.equal(community.normalizeCommunityMemoriesLimit('200.5'), 200);
  assert.equal(community.hasFractionalCommunityMemoriesLimit('-1.5'), false);
  assert.equal(community.hasFractionalCommunityMemoriesLimit('200.5'), false);
  assert.equal(community.hasFractionalCommunityMemoriesLimit('1.5'), true);

  let executorCalls = 0;
  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    new Request('https://lovebud.test/api/community/memories?limit=1.5'),
    {
      LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-4113-limit',
    { executorOverride: async () => { executorCalls += 1; return []; } }
  );
  assert.equal(response.status, 422);
  assert.equal(executorCalls, 0);
  assert.deepEqual(await response.json(), {
    detail: [{
      type: 'int_parsing',
      loc: ['query', 'limit'],
      msg: 'Input should be a valid integer, unable to parse string as an integer',
      input: '1.5',
    }],
  });
});

test('#4113 whitespace-only treeId is leak-safe 400 before DB work while non-UUID IDs remain accepted', async () => {
  const community = await loadCommunityMemoriesDirect();
  assert.deepEqual(community.normalizeCommunityMemoriesTreeId(' non-uuid-id '), { ok: true, value: 'non-uuid-id' });

  let executorCalls = 0;
  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    new Request('https://lovebud.test/api/community/memories?treeId=%20%20%20'),
    {
      LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-4113-tree-id',
    { executorOverride: async () => { executorCalls += 1; return []; } }
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { detail: 'Invalid treeId' });
  assert.equal(executorCalls, 0);
});

test('#4113 legacy fallback preserves public-node filtering, per-tree limit and legacy node order', async () => {
  const community = await loadCommunityMemoriesDirect();
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values });
    if (text.includes("to_regclass('public.memories')")) {
      return [{
        has_memories: false,
        has_tree_title: true,
        has_tree_visibility: true,
        has_tree_name: false,
        has_tree_is_public: false,
      }];
    }
    return [{
      id: 'tree-legacy',
      payload: {
        nodes: [
          { id: 'private-node', visibility: 'private', order: 0, title: 'PRIVATE' },
          { id: 'public-later', visibility: 'public', order: 2, title: 'Later' },
          { id: 'public-first', order: 1, label: 'First', emotionTags: ['legacy'] },
        ],
      },
      created_at: '2026-08-18 01:00:00+00',
      updated_at: '2026-08-18 02:00:00+00',
    }];
  };

  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    new Request('https://lovebud.test/api/community/memories?treeId=tree-legacy&limit=1'),
    {
      LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-4113-legacy',
    { executorOverride: executor }
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /t\.visibility = 'public'/);
  assert.deepEqual(calls[1].values, ['tree-legacy', 1]);
  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].id, 'public-first');
  assert.equal(body[0].title, 'First');
  assert.equal(body[0].visibility, 'public');
  assert.deepEqual(body[0].emotionTags, ['legacy']);
});

test('#4113 direct query errors are bounded and do not leak DB secret material', async () => {
  const community = await loadCommunityMemoriesDirect();
  const response = await community.handlePublicCommunityMemoriesDirectNeon(
    new Request('https://lovebud.test/api/community/memories'),
    {
      LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-4113-error',
    {
      executorOverride: async () => {
        throw new Error('postgresql://private:secret@ep-growing-test.us-east-1.neon.tech/neondb');
      }
    }
  );
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
  const text = await response.text();
  assert.match(text, /DIRECT_NEON_QUERY_FAILED/);
  assert.doesNotMatch(text, /private|secret|neon\.tech/);
});

test('#4113 catch-all direct gate fails closed without invoking Modal and unrelated route mapping remains intact', async () => {
  const { pathModule } = await loadModules();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Modal must not be used when direct gate is selected');
  };
  try {
    const response = await pathModule.onRequest({
      request: new Request('https://lovebud.test/api/community/memories', {
        headers: { 'x-lovebud-request-id': 'req-4113-route' }
      }),
      env: {
        LB_COMMUNITY_MEMORIES_READ_RUNTIME: 'direct_neon',
        MODAL_BASE_URL: 'https://modal.test',
      },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4113-route');
    assert.equal(fetchCalls, 0);

    const growing = pathModule.buildModalUrl(
      new Request('https://lovebud.test/api/community/growing-trees'),
      { MODAL_BASE_URL: 'https://modal.test' }
    );
    assert.equal(growing.pathname, '/modal/browse/growing');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ─── #4311 readiness matrix representation (Growing Production-live attestation) ──────────

test('#4311 readiness matrix records the Growing Production-live attestation', () => {
  const matrix = JSON.parse(fs.readFileSync(path.resolve(root, 'docs', 'architecture', 'direct-neon-readiness-matrix-4311.json'), 'utf8'));
  const vocab = matrix.classification_vocabulary;
  const row = matrix.routes.find((entry) => entry.id === 'growing');
  assert.ok(row, 'growing row present');
  assert.equal(row.source_helper, 'functions/_shared/love-platform-api-growing-neon-query.js');
  assert.equal(row.runtime_gate, 'LB_GROWING_READ_RUNTIME');
  assert.equal(row.method, 'GET');
  assert.equal(row.credential_boundary, 'direct_neon_runtime');
  // Production-live attestation state (CENTRAL accepted 2026-09-11, report
  // LOVEBUD_4000_GROWING_DIRECT_NEON_LIVE_VERIFY_REPORT): functional proof PASS,
  // exactly one target GET at the source-canonical minimum limit=3, one control read.
  assert.equal(row.source_state, 'SOURCE_READY');
  assert.equal(row.source_parity, 'PASS_AT_CITED_SHA');
  assert.equal(row.privilege_state, 'PRIVILEGE_PROVEN_AT_CITED_SHA');
  assert.equal(row.checked_in_gate, 'CHECKED_IN_PRODUCTION_GATE');
  assert.equal(row.live_provider_state, 'LIVE_PROVEN_AT_CITED_SHA');
  assert.equal(row.live_gate_state, 'LIVE_GATE_VERIFIED');
  assert.equal(row.production_live, 'PRODUCTION_LIVE');
  assert.equal(row.diagnostic_execution_authorized, 'NOT_AUTHORIZED');
  assert.equal(row.modal_retained_by_design, false);
  assert.deepEqual(row.required_objects, { trees: ['SELECT'], memories: ['SELECT'] }, 'the read path needs SELECT only');
  assert.ok(vocab.source_state.includes(row.source_state));
  assert.ok(vocab.source_parity.includes(row.source_parity));
  assert.ok(vocab.privilege_state.includes(row.privilege_state));
  assert.ok(vocab.live_provider_state.includes(row.live_provider_state));
  assert.ok(vocab.checked_in_gate.includes(row.checked_in_gate));
  assert.ok(vocab.live_gate_state.includes(row.live_gate_state));
  assert.ok(vocab.production_live.includes(row.production_live));
  assert.ok(vocab.diagnostic_execution_authorized.includes(row.diagnostic_execution_authorized));
  // Bounded live evidence pinned to the attested main SHA; must not silently lose protocol facts.
  assert.equal(row.last_exact_head_evidence.main_sha, '1c09ebc90bc577bb7ba4dc9e58d99f6edcdd3eed', 'live evidence bound to attested main SHA');
  for (const marker of [
    'FUNCTIONAL_LIVE_PROOF=PASS',
    'ACTUAL_TARGET_GET_COUNT=1',
    'ONE_SHOT_PROTOCOL_COMPLIANCE=PASS',
    'CONTROL_READ_COUNT=1',
    'HTTP=200',
    'x-lovebud-upstream=direct-neon',
    'x-lovebud-runtime=direct_neon',
    'no-store',
    'request-id',
    'route-status absent on success by current source',
    'shape=PASS',
    'Modal fallback=NO',
    'secret leak=NO',
    'retry=NO',
    '#4111',
    'limit=3',
  ]) {
    assert.ok(row.disposition_note.includes(marker), `disposition_note retains: ${marker}`);
  }
  // Steady-state next_action: monitoring/regression only, invalidation rule stated, no new canary.
  assert.ok(row.next_action.includes('monitoring/regression'), 'next_action is monitoring/regression steady state');
  assert.ok(row.next_action.includes('invalidates this live attestation'), 'next_action states the invalidation rule');
  assert.ok(!row.next_action.includes('Fresh live Cloudflare provider read'), 'next_action no longer requests another Growing canary');
  // JSON/Markdown parity for the attested row (MD is a rendering of the authoritative JSON).
  const md = fs.readFileSync(path.resolve(root, 'docs', 'architecture', 'DIRECT_NEON_READINESS_MATRIX_4311.md'), 'utf8');
  const mdRow = md.split(/\r?\n/).find((line) => line.startsWith('| growing |'));
  assert.ok(mdRow, 'markdown rendering contains the growing row');
  for (const marker of ['LIVE_PROVEN_AT_CITED_SHA', 'LIVE_GATE_VERIFIED', 'PRODUCTION_LIVE', 'FUNCTIONAL_LIVE_PROOF=PASS', 'ACTUAL_TARGET_GET_COUNT=1', 'ONE_SHOT_PROTOCOL_COMPLIANCE=PASS', 'CONTROL_READ_COUNT=1', '#4111']) {
    assert.ok(mdRow.includes(marker), `markdown growing row retains: ${marker}`);
  }
});
