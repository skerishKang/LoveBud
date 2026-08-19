const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const NEON_TEST_URL = 'postgresql://user:pass@ep-memory-detail-test.us-east-1.neon.tech/neondb?sslmode=require';
const REQUEST_ID = 'req-public-memory-detail-4114';

async function loadModules() {
  const [route, direct, proxy] = await Promise.all([
    import('../../functions/api/memories/[id].js'),
    import('../../functions/_shared/public-memory-detail-direct-neon.js'),
    import('../../functions/_shared/memory-route-proxy.js')
  ]);
  return { route, direct, proxy };
}

function makeContext({
  memoryId = 'mem-123',
  auth = false,
  gate,
  databaseUrl,
  modalBaseUrl = 'https://modal.example.com'
} = {}) {
  const headers = new Headers({ 'x-lovebud-request-id': REQUEST_ID });
  if (auth) headers.set('authorization', 'Bearer test-token');
  const env = {};
  if (modalBaseUrl !== null) env.MODAL_BASE_URL = modalBaseUrl;
  if (gate !== undefined) env.LB_PUBLIC_MEMORY_DETAIL_RUNTIME = gate;
  if (databaseUrl !== undefined) env.LOVE_PLATFORM_DATABASE_URL = databaseUrl;
  return {
    env,
    params: { id: memoryId },
    request: new Request(`https://api.example.com/api/memories/${memoryId}`, {
      method: 'GET',
      headers
    })
  };
}

function installFetchCapture(responseFactory = null) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (responseFactory) return responseFactory(url, options);
    return new Response(JSON.stringify({ id: 'modal-mem-123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

function makePublicRow(overrides = {}) {
  return {
    id: 'mem-123',
    tree_id: 'tree-456',
    parent_id: null,
    title: 'A public Memory',
    memo: 'A note',
    artist: 'Artist',
    source: 'YouTube',
    source_url: 'https://www.youtube.com/watch?v=example',
    source_type: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/example/hqdefault.jpg',
    emotion_tags: ['joy', 'hope'],
    timestamp: '01:23',
    visibility: 'public',
    channel_id: 'channel-1',
    channel_name: 'Channel',
    channel_url: 'https://www.youtube.com/@channel',
    created_at: '2026-08-01 10:11:12.123456+00',
    updated_at: '2026-08-02T11:12:13.654321Z',
    reaction_counts: { like: 2 },
    ...overrides
  };
}

async function runDirect({ row = makePublicRow(), memoryId = 'mem-123', executor } = {}) {
  const { route } = await loadModules();
  const calls = [];
  const fakeExecutor = executor || (async (sql, values) => {
    calls.push({ sql, values });
    return row == null ? [] : [row];
  });
  const response = await route.handleMemoryDetailGet(
    makeContext({
      memoryId,
      gate: 'direct_neon',
      databaseUrl: NEON_TEST_URL,
      modalBaseUrl: null
    }),
    { executorOverride: fakeExecutor }
  );
  return { response, calls };
}

test('#4114 anonymous default gate retains existing public Modal route', async () => {
  const { route } = await loadModules();
  const capture = installFetchCapture();
  try {
    const response = await route.onRequestGet(makeContext());
    assert.equal(response.status, 200);
    assert.equal(capture.calls.length, 1);
    assert.equal(new URL(capture.calls[0].url).pathname, '/modal/memories/mem-123');
    assert.equal(capture.calls[0].options.headers.authorization, undefined);
  } finally {
    capture.restore();
  }
});

test('#4114 unknown anonymous runtime value retains existing Modal behavior', async () => {
  const { route } = await loadModules();
  const capture = installFetchCapture();
  try {
    await route.onRequestGet(makeContext({ gate: 'future-provider' }));
    assert.equal(capture.calls.length, 1);
    assert.equal(new URL(capture.calls[0].url).pathname, '/modal/memories/mem-123');
  } finally {
    capture.restore();
  }
});

test('#4114 anonymous direct gate executes the direct-Neon read and never calls Modal', async () => {
  const capture = installFetchCapture();
  try {
    const { response, calls } = await runDirect();
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].values, ['mem-123']);
    assert.equal(capture.calls.length, 0, 'direct mode must not fall back to Modal');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-request-id'), REQUEST_ID);
  } finally {
    capture.restore();
  }
});

test('#4114 Authorization wins over direct gate and preserves private Modal authority', async () => {
  const { route } = await loadModules();
  let executorCalls = 0;
  const capture = installFetchCapture();
  try {
    const response = await route.handleMemoryDetailGet(
      makeContext({ auth: true, gate: 'direct_neon', databaseUrl: NEON_TEST_URL }),
      { executorOverride: async () => { executorCalls += 1; return []; } }
    );
    assert.equal(response.status, 200);
    assert.equal(executorCalls, 0);
    assert.equal(capture.calls.length, 1);
    assert.equal(new URL(capture.calls[0].url).pathname, '/modal/private/memories/mem-123');
    assert.equal(capture.calls[0].options.headers.authorization, 'Bearer test-token');
  } finally {
    capture.restore();
  }
});

test('#4114 direct gate with missing dedicated DB config fails closed without Modal fallback', async () => {
  const { route } = await loadModules();
  const capture = installFetchCapture();
  try {
    const response = await route.onRequestGet(makeContext({
      gate: 'direct_neon',
      databaseUrl: undefined,
      modalBaseUrl: 'https://modal.example.com'
    }));
    assert.equal(response.status, 503);
    assert.equal(capture.calls.length, 0);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'config-absent');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
  } finally {
    capture.restore();
  }
});

test('#4114 direct gate rejects a non-Neon or generic-looking DB URL', async () => {
  const { route, direct } = await loadModules();
  assert.equal(direct.isNeonDatabaseUrl('postgresql://user:pass@db.example.com/lovebud'), false);
  assert.equal(direct.isNeonDatabaseUrl(NEON_TEST_URL), true);
  const response = await route.onRequestGet(makeContext({
    gate: 'direct_neon',
    databaseUrl: 'postgresql://user:pass@db.example.com/lovebud',
    modalBaseUrl: null
  }));
  assert.equal(response.status, 503);
});

test('#4114 public Tree + public Memory returns Modal-compatible public detail DTO', async () => {
  const { response } = await runDirect();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 'mem-123',
    treeId: 'tree-456',
    parentId: null,
    title: 'A public Memory',
    memo: 'A note',
    artist: 'Artist',
    source: 'YouTube',
    sourceUrl: 'https://www.youtube.com/watch?v=example',
    sourceType: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/example/hqdefault.jpg',
    emotionTags: ['joy', 'hope'],
    timestamp: '01:23',
    visibility: 'public',
    channelId: 'channel-1',
    channelName: 'Channel',
    channelUrl: 'https://www.youtube.com/@channel',
    createdAt: '2026-08-01T10:11:12.123456+00:00',
    updatedAt: '2026-08-02T11:12:13.654321+00:00',
    reactionCounts: { like: 2, total: 2 }
  });
});

test('#4114 SQL requires both public Memory and public parent Tree before projection', async () => {
  const { direct } = await loadModules();
  const sql = direct.PUBLIC_MEMORY_DETAIL_SQL;
  assert.match(sql, /INNER\s+JOIN\s+trees\s+t/i);
  assert.match(sql, /m\.id\s*=\s*\$1/i);
  assert.match(sql, /m\.visibility\s*=\s*'public'/i);
  assert.match(sql, /t\.visibility\s*=\s*'public'/i);
  assert.match(sql, /LIMIT\s+1/i);
});

test('#4114 private Tree + otherwise public Memory is not exposed', async () => {
  const { response } = await runDirect({
    executor: async (sql) => {
      assert.match(sql, /t\.visibility\s*=\s*'public'/i);
      return [];
    }
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 public Tree + private Memory is not exposed', async () => {
  const { response } = await runDirect({
    executor: async (sql) => {
      assert.match(sql, /m\.visibility\s*=\s*'public'/i);
      return [];
    }
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 missing or deleted Memory keeps current public 404 semantics', async () => {
  const { response } = await runDirect({ row: null });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 reaction decoration matches current aggregate reactionCounts + total shape', async () => {
  const { response } = await runDirect({
    row: makePublicRow({ reaction_counts: { applaud: 1, like: 3 } })
  });
  const body = await response.json();
  assert.deepEqual(body.reactionCounts, { applaud: 1, like: 3, total: 4 });
});

test('#4114 emotion tags and timestamp field types preserve current public normalizer behavior', async () => {
  const { response } = await runDirect({
    row: makePublicRow({
      emotion_tags: '["joy",7,"hope"]',
      source_type: '',
      channel_id: '',
      created_at: '2026-08-01 10:11:12+00'
    })
  });
  const body = await response.json();
  assert.deepEqual(body.emotionTags, ['joy', '7', 'hope']);
  assert.equal(body.sourceType, 'youtube');
  assert.equal(body.channelId, null);
  assert.equal(body.createdAt, '2026-08-01T10:11:12+00:00');
  assert.equal(typeof body.id, 'string');
  assert.equal(typeof body.treeId, 'string');
  assert.equal(typeof body.title, 'string');
  assert.equal(typeof body.reactionCounts.total, 'number');
});

test('#4114 direct DTO never exposes owner ID, clientKey, or unknown private metadata', async () => {
  const { response } = await runDirect({
    row: makePublicRow({
      owner_id: 'private-owner',
      client_key: 'private-client-key',
      email: 'private@example.com',
      private_metadata: { secret: true }
    })
  });
  const body = await response.json();
  for (const key of ['ownerId', 'owner_id', 'clientKey', 'client_key', 'email', 'private_metadata']) {
    assert.equal(Object.prototype.hasOwnProperty.call(body, key), false, `${key} must not leak`);
  }
});

test('#4114 preserves existing string-ID scope and encoded-path validation without UUID tightening', async () => {
  const { route } = await loadModules();
  const valuesSeen = [];
  const unicodeId = '%E2%9C%93-memory';
  const ok = await route.handleMemoryDetailGet(
    makeContext({
      memoryId: unicodeId,
      gate: 'direct_neon',
      databaseUrl: NEON_TEST_URL,
      modalBaseUrl: null
    }),
    {
      executorOverride: async (_sql, values) => {
        valuesSeen.push(...values);
        return [makePublicRow({ id: '✓-memory' })];
      }
    }
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(valuesSeen, ['✓-memory']);

  let invalidExecutorCalls = 0;
  const malformed = await route.handleMemoryDetailGet(
    makeContext({
      memoryId: '%E0%A4%A',
      gate: 'direct_neon',
      databaseUrl: NEON_TEST_URL,
      modalBaseUrl: null
    }),
    {
      executorOverride: async () => {
        invalidExecutorCalls += 1;
        return [];
      }
    }
  );
  assert.equal(malformed.status, 400);
  assert.equal(invalidExecutorCalls, 0);
  assert.equal(malformed.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(malformed.headers.get('x-lovebud-route-status'), 'invalid-path-encoding');
  assert.deepEqual(await malformed.json(), {
    error: 'Invalid path encoding',
    code: 'INVALID_PATH_ENCODING'
  });
});

test('#4114 direct SQL is one static parameterized read with no write/DDL/transaction statements', async () => {
  const { direct } = await loadModules();
  const sql = direct.PUBLIC_MEMORY_DETAIL_SQL;
  assert.match(sql, /^\s*SELECT\b/i);
  assert.equal((sql.match(/\$1/g) || []).length, 1, 'Memory id must have one positional bind');
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|BEGIN|CALL|DO)\b/i);
  assert.doesNotMatch(sql, /owner_id|client_key/i, 'private owner/idempotency metadata must not be selected');
});

test('#4114 query failure is sanitized and never falls back to Modal', async () => {
  const capture = installFetchCapture();
  try {
    const { response } = await runDirect({
      executor: async () => {
        throw new Error('secret database host password=do-not-leak');
      }
    });
    assert.equal(response.status, 500);
    assert.equal(capture.calls.length, 0);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    const text = await response.text();
    assert.match(text, /DIRECT_NEON_QUERY_FAILED/);
    assert.doesNotMatch(text, /password|do-not-leak|database host/i);
  } finally {
    capture.restore();
  }
});

test('#4114 adapter reads only LOVE_PLATFORM_DATABASE_URL and does not grow generic DB fallback surface', () => {
  const source = fs.readFileSync(
    path.join(root, 'functions/_shared/public-memory-detail-direct-neon.js'),
    'utf8'
  );
  assert.match(source, /LOVE_PLATFORM_DATABASE_URL/);
  assert.doesNotMatch(source, /env\.(?:DATABASE_URL|POSTGRES_URL|NEON_DATABASE_URL)/);
  assert.doesNotMatch(source, /process\.env/);
});

test('#4114 lane leaves PUT/DELETE on the existing shared Memory proxy', () => {
  const source = fs.readFileSync(path.join(root, 'functions/api/memories/[id].js'), 'utf8');
  assert.match(source, /export async function onRequestPut\(context\)[\s\S]*proxyMemoryRouteRequest\(context, withMemoryId\(context\)\)/);
  assert.match(source, /export async function onRequestDelete\(context\)[\s\S]*proxyMemoryRouteRequest\(context, withMemoryId\(context\)\)/);
});
