// Synthetic route-contract tests for #3288: align memory-detail GET routing with auth policy.
// Extended by #4114 for the anonymous public Memory detail direct-Neon candidate.
//
// Proves the explicit contract for GET /api/memories/:id:
//   - signed-in (Authorization header present) detail read -> /modal/private/memories/:id
//   - anonymous detail read                          -> /modal/memories/:id (public-compatible)
//   - PUT / DELETE                                   -> /modal/private/memories/:id (unchanged)
//   - existing public detail URLs remain compatible (no path rewrite on the public side)
//
// Uses the exported buildModalUrl from the Cloudflare catch-all proxy so the actual
// route-selection logic is exercised, not a text snapshot.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildModalUrl, onRequest: onCatchAllRequest } = require('../../functions/api/[[path]].js');
const { handleMemoryDetailGet, onRequestGet } = require('../../functions/api/memories/[id].js');
const {
  prepareMemoryWriteProxyRequest,
  proxyMemoryRouteRequest
} = require('../../functions/_shared/memory-route-proxy.js');
const {
  INVALID_PATH_ENCODING_CODE,
  normalizeEncodedPathSegment
} = require('../../functions/_shared/path-segment.js');
const { onRequestPost: onTreeLikePost } = require('../../functions/api/trees/[tree_id]/likes.js');
const {
  onRequestGet: onTreeCommentGet,
  onRequestPost: onTreeCommentPost
} = require('../../functions/api/trees/[tree_id]/comments.js');
const { onRequestPost: onTreeViewPost } = require('../../functions/api/trees/[tree_id]/views.js');

function makeRequest({ method = 'GET', path = '/api/memories/abc', auth = false } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', 'Bearer test-token');
  return new Request(`https://api.example.com${path}`, { method, headers });
}

const ENV = { MODAL_BASE_URL: 'https://modal.example.com/' };

function pathOf(request) {
  const url = buildModalUrl(request, ENV);
  assert.ok(url, `buildModalUrl should resolve a target for ${request.method} ${new URL(request.url).pathname}`);
  return url.pathname;
}

test('#3288 GET /api/memories/:id with Authorization routes to authenticated private detail endpoint', () => {
  const path = pathOf(makeRequest({ method: 'GET', path: '/api/memories/mem-123', auth: true }));
  assert.equal(path, '/modal/private/memories/mem-123');
});

test('#3288 GET /api/memories/:id without Authorization routes to public detail endpoint', () => {
  const path = pathOf(makeRequest({ method: 'GET', path: '/api/memories/mem-123', auth: false }));
  assert.equal(path, '/modal/memories/mem-123');
});

test('#3288 PUT /api/memories/:id routes to private detail endpoint (unchanged)', () => {
  const path = pathOf(makeRequest({ method: 'PUT', path: '/api/memories/mem-123', auth: true }));
  assert.equal(path, '/modal/private/memories/mem-123');
});

test('#3288 DELETE /api/memories/:id routes to private detail endpoint (unchanged)', () => {
  const path = pathOf(makeRequest({ method: 'DELETE', path: '/api/memories/mem-123', auth: true }));
  assert.equal(path, '/modal/private/memories/mem-123');
});

test('#3288 anonymous PUT /api/memories/:id still routes to private detail endpoint', () => {
  const path = pathOf(makeRequest({ method: 'PUT', path: '/api/memories/mem-123', auth: false }));
  assert.equal(path, '/modal/private/memories/mem-123');
});

test('#3288 does not rewrite the public detail path (existing public URLs remain compatible)', () => {
  // The public detail URL seen by clients is /api/memories/:id unchanged; the proxy
  // continues to map anonymous reads to the same /modal/memories/:id endpoint.
  const path = pathOf(makeRequest({ method: 'GET', path: '/api/memories/mem-123', auth: false }));
  assert.equal(path, '/modal/memories/mem-123');
});

test('#3288 mirrors /api/trees/:id auth-aware split for GET', () => {
  // Consistency check: trees already split private/public by auth; memories must too.
  const treeAuthed = pathOf(makeRequest({ method: 'GET', path: '/api/trees/tree-1', auth: true }));
  const treeAnon = pathOf(makeRequest({ method: 'GET', path: '/api/trees/tree-1', auth: false }));
  assert.equal(treeAuthed, '/modal/private/trees/tree-1');
  assert.equal(treeAnon, '/modal/trees/tree-1');

  const memAuthed = pathOf(makeRequest({ method: 'GET', path: '/api/memories/mem-1', auth: true }));
  const memAnon = pathOf(makeRequest({ method: 'GET', path: '/api/memories/mem-1', auth: false }));
  assert.equal(memAuthed, '/modal/private/memories/mem-1');
  assert.equal(memAnon, '/modal/memories/mem-1');
});

// ─── onRequestGet (concrete memory-detail route handler) ────────────────────

function installFetchCapture() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return new Response(JSON.stringify({ id: 'mem-123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return {
    calls,
    restore() { globalThis.fetch = originalFetch; },
  };
}

function makeContext({ auth = false, memoryId = 'mem-123' } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', 'Bearer test-token');
  return {
    env: { MODAL_BASE_URL: 'https://modal.example.com' },
    params: { id: memoryId },
    request: new Request(`https://api.example.com/api/memories/${memoryId}`, { method: 'GET', headers }),
  };
}

test('#3288 onRequestGet signed-in read targets authenticated private detail endpoint', async () => {
  const cap = installFetchCapture();
  try {
    await onRequestGet(makeContext({ auth: true }));
    assert.equal(cap.calls.length, 1, 'must issue exactly one upstream fetch');
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/private/memories/mem-123');
    assert.equal(typeof cap.calls[0].opts.headers.authorization, 'string', 'auth header forwarded');
  } finally {
    cap.restore();
  }
});

test('#3288 onRequestGet anonymous read targets public detail endpoint', async () => {
  const cap = installFetchCapture();
  try {
    await onRequestGet(makeContext({ auth: false }));
    assert.equal(cap.calls.length, 1, 'must issue exactly one upstream fetch');
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/memories/mem-123');
    assert.equal(cap.calls[0].opts.headers.authorization, undefined, 'no auth header for anonymous read');
  } finally {
    cap.restore();
  }
});

test('#3288 onRequestGet missing MODAL_BASE_URL yields 503 (unchanged behavior)', async () => {
  const cap = installFetchCapture();
  try {
    const res = await onRequestGet({ env: {}, params: { id: 'mem-123' }, request: new Request('https://api.example.com/api/memories/mem-123', { method: 'GET' }) });
    assert.equal(res.status, 503);
    assert.equal(cap.calls.length, 0, 'should not fetch when modal base url is unconfigured');
  } finally {
    cap.restore();
  }
});

// ─── #4050 malformed percent-encoded dynamic path taxonomy ─────────────────

const MALFORMED_SEGMENTS = ['%ZZ', '%', '%E0%A4%A'];
const MALFORMED_SEGMENT = MALFORMED_SEGMENTS[2];
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

async function assertInvalidPathResponse(response, label) {
  assert.equal(response.status, 400, `${label}: malformed path must return 400`);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare', `${label}: edge owns malformed-path failure`);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'invalid-path-encoding', `${label}: typed route status`);
  assert.ok(response.headers.get('x-lovebud-request-id'), `${label}: request-id must be retained`);
  const body = await response.json();
  assert.equal(body.code, INVALID_PATH_ENCODING_CODE, `${label}: typed error code`);
  assert.equal(body.error, 'Invalid path encoding', `${label}: stable safe error`);
  for (const malformed of MALFORMED_SEGMENTS) {
    assert.ok(!JSON.stringify(body).includes(malformed), `${label}: malformed input must not be echoed`);
  }
}

test('#4050 shared path decoder catches the required malformed forms, URIError only, and preserves valid IDs', () => {
  assert.equal(normalizeEncodedPathSegment(VALID_UUID), VALID_UUID, 'plain UUID-shaped ID must remain unchanged');
  assert.equal(normalizeEncodedPathSegment('%E2%9C%93'), '%E2%9C%93', 'valid percent-encoded segment must remain canonical');

  for (const malformed of MALFORMED_SEGMENTS) {
    assert.throws(
      () => normalizeEncodedPathSegment(malformed),
      (error) => error && error.code === INVALID_PATH_ENCODING_CODE,
      `${malformed} must produce the typed malformed-path error`
    );
  }

  const encodedTreeTarget = buildModalUrl(
    makeRequest({ method: 'GET', path: '/api/trees/%E2%9C%93', auth: false }),
    ENV
  );
  assert.equal(encodedTreeTarget.pathname, '/modal/trees/%E2%9C%93', 'valid encoded route segment keeps decode/re-encode behavior');
  const uuidTreeTarget = buildModalUrl(
    makeRequest({ method: 'GET', path: `/api/trees/${VALID_UUID}`, auth: false }),
    ENV
  );
  assert.equal(uuidTreeTarget.pathname, `/modal/trees/${VALID_UUID}`);

  const originalDecodeURIComponent = globalThis.decodeURIComponent;
  try {
    globalThis.decodeURIComponent = () => { throw new Error('non-uri-sentinel'); };
    assert.throws(
      () => normalizeEncodedPathSegment('tree-1'),
      /non-uri-sentinel/,
      'unexpected non-URI errors must not be reclassified as malformed paths'
    );
  } finally {
    globalThis.decodeURIComponent = originalDecodeURIComponent;
  }
});

test('#4050 catch-all returns typed 400 for malformed Tree fork/capability/hub-layout/detail and Memory detail routes', async () => {
  const cases = [
    { method: 'POST', path: `/api/trees/${MALFORMED_SEGMENT}/fork`, auth: true, body: '{}' },
    { method: 'GET', path: `/api/private/trees/${MALFORMED_SEGMENT}/capability`, auth: true },
    { method: 'PUT', path: `/api/trees/${MALFORMED_SEGMENT}/hub-layout`, auth: true, body: '{}' },
    { method: 'GET', path: `/api/trees/${MALFORMED_SEGMENT}`, auth: false },
    { method: 'GET', path: `/api/memories/${MALFORMED_SEGMENT}`, auth: false },
  ];

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 200 });
  };
  try {
    for (const item of cases) {
      const headers = new Headers({ 'x-lovebud-request-id': 'req-4050-catchall' });
      if (item.auth) headers.set('authorization', 'Bearer test-token');
      if (item.body !== undefined) headers.set('content-type', 'application/json');
      const request = new Request(`https://api.example.com${item.path}`, {
        method: item.method,
        headers,
        ...(item.body !== undefined ? { body: item.body } : {})
      });
      const response = await onCatchAllRequest({ request, env: ENV });
      await assertInvalidPathResponse(response, `${item.method} ${item.path}`);
      assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4050-catchall', 'existing request-id must be preserved');
    }
    assert.equal(fetchCalls, 0, 'malformed catch-all paths must fail before Modal fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4050 Memory proxy returns typed 400 for malformed GET and authorized DELETE while preserving auth-first write denial', async () => {
  const malformedUrl = `https://api.example.com/api/memories/${MALFORMED_SEGMENT}`;
  const getResponse = await proxyMemoryRouteRequest({
    request: new Request(malformedUrl, { method: 'GET' }),
    env: ENV
  }, { requestId: 'req-4050-memory-get' });
  await assertInvalidPathResponse(getResponse, 'Memory GET');
  assert.equal(getResponse.headers.get('x-lovebud-request-id'), 'req-4050-memory-get');

  const unauthDelete = await prepareMemoryWriteProxyRequest(
    new Request(malformedUrl, { method: 'DELETE' }),
    ENV,
    { requestId: 'req-4050-memory-noauth' }
  );
  assert.equal(unauthDelete.response.status, 401, 'Memory write auth check must run before malformed path classification');
  assert.equal(unauthDelete.response.headers.get('x-lovebud-route-status'), 'missing-authorization');

  const authDelete = await prepareMemoryWriteProxyRequest(
    new Request(malformedUrl, {
      method: 'DELETE',
      headers: { authorization: 'Bearer test-token' }
    }),
    ENV,
    { requestId: 'req-4050-memory-auth' }
  );
  await assertInvalidPathResponse(authDelete.response, 'Memory authorized DELETE');
});

test('#4050 Tree like/comment social writes keep auth-first ordering before malformed path classification', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  try {
    const likeUrl = `https://api.example.com/api/trees/${MALFORMED_SEGMENT}/likes`;
    const likeNoAuth = await onTreeLikePost({ request: new Request(likeUrl, { method: 'POST' }), env: ENV });
    assert.equal(likeNoAuth.status, 401, 'Tree like must reject missing auth before decoding malformed tree ID');
    assert.equal(likeNoAuth.headers.get('x-lovebud-route-status'), 'missing-authorization');

    const likeAuth = await onTreeLikePost({
      request: new Request(likeUrl, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'Idempotency-Key': 'like-key-4050'
        }
      }),
      env: ENV
    });
    await assertInvalidPathResponse(likeAuth, 'Tree like authorized POST');

    const commentUrl = `https://api.example.com/api/trees/${MALFORMED_SEGMENT}/comments`;
    const commentNoAuth = await onTreeCommentPost({
      request: new Request(commentUrl, { method: 'POST', body: '{}' }),
      env: ENV
    });
    assert.equal(commentNoAuth.status, 401, 'Tree comment must reject missing auth before decoding malformed tree ID');
    assert.equal(commentNoAuth.headers.get('x-lovebud-route-status'), 'missing-authorization');

    const commentAuth = await onTreeCommentPost({
      request: new Request(commentUrl, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'Idempotency-Key': 'comment-key-4050',
          'content-type': 'application/json'
        },
        body: '{}'
      }),
      env: ENV
    });
    await assertInvalidPathResponse(commentAuth, 'Tree comment authorized POST');

    const commentRead = await onTreeCommentGet({
      request: new Request(commentUrl, { method: 'GET' }),
      env: ENV
    });
    await assertInvalidPathResponse(commentRead, 'Tree comment GET');

    assert.equal(fetchCalls, 0, 'malformed Tree social paths must fail before Modal fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4050 Tree view returns typed 400 for malformed path without reaching Modal', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  try {
    const response = await onTreeViewPost({
      request: new Request(`https://api.example.com/api/trees/${MALFORMED_SEGMENT}/views`, {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
        body: '{}'
      }),
      env: {
        ...ENV,
        TREE_VIEW_AUTHORITY_SECRET: 'test-only-secret-4050'
      }
    });
    await assertInvalidPathResponse(response, 'Tree view POST');
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4050 source guard: affected routing authorities no longer compose raw decodeURIComponent inside encodeURIComponent', () => {
  const root = path.resolve(__dirname, '..', '..');
  const files = [
    'functions/api/[[path]].js',
    'functions/_shared/memory-route-proxy.js',
    'functions/api/trees/[tree_id]/likes.js',
    'functions/api/trees/[tree_id]/comments.js',
    'functions/api/trees/[tree_id]/views.js'
  ];

  for (const relative of files) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(
      source,
      /encodeURIComponent\s*\(\s*decodeURIComponent\s*\(/,
      `${relative} must use the typed shared path-segment decoder`
    );
  }
});

// ─── #4114 anonymous public Memory detail direct-Neon candidate ─────────────

const MEMORY_DETAIL_NEON_TEST_URL = 'postgresql://user:pass@ep-memory-detail-test.us-east-1.neon.tech/neondb?sslmode=require';
const MEMORY_DETAIL_REQUEST_ID = 'req-public-memory-detail-4114';

async function loadPublicMemoryDetailDirectModule() {
  return import('../../functions/_shared/public-memory-detail-direct-neon.js');
}

function make4114Context({
  memoryId = 'mem-123',
  auth = false,
  gate,
  databaseUrl,
  modalBaseUrl = 'https://modal.example.com'
} = {}) {
  const headers = new Headers({ 'x-lovebud-request-id': MEMORY_DETAIL_REQUEST_ID });
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

function make4114PublicRow(overrides = {}) {
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

async function run4114Direct({ row = make4114PublicRow(), memoryId = 'mem-123', executor } = {}) {
  const calls = [];
  const fakeExecutor = executor || (async (sql, values) => {
    calls.push({ sql, values });
    return row == null ? [] : [row];
  });
  const response = await handleMemoryDetailGet(
    make4114Context({
      memoryId,
      gate: 'direct_neon',
      databaseUrl: MEMORY_DETAIL_NEON_TEST_URL,
      modalBaseUrl: null
    }),
    { executorOverride: fakeExecutor }
  );
  return { response, calls };
}

test('#4114 anonymous default gate retains existing public Modal authority', async () => {
  const cap = installFetchCapture();
  try {
    const response = await onRequestGet(make4114Context());
    assert.equal(response.status, 200);
    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/memories/mem-123');
    assert.equal(cap.calls[0].opts.headers.authorization, undefined);
  } finally {
    cap.restore();
  }
});

test('#4114 unknown gate retains existing public Modal authority', async () => {
  const cap = installFetchCapture();
  try {
    await onRequestGet(make4114Context({ gate: 'future-provider' }));
    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/memories/mem-123');
  } finally {
    cap.restore();
  }
});

test('#4114 anonymous direct gate executes direct Neon and never calls Modal', async () => {
  const cap = installFetchCapture();
  try {
    const { response, calls } = await run4114Direct();
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].values, ['mem-123']);
    assert.equal(cap.calls.length, 0, 'direct mode must not fall back to Modal');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-request-id'), MEMORY_DETAIL_REQUEST_ID);
  } finally {
    cap.restore();
  }
});

test('#4114 Authorization wins over direct gate and keeps private Modal behavior unchanged', async () => {
  let executorCalls = 0;
  const cap = installFetchCapture();
  try {
    const response = await handleMemoryDetailGet(
      make4114Context({ auth: true, gate: 'direct_neon', databaseUrl: MEMORY_DETAIL_NEON_TEST_URL }),
      { executorOverride: async () => { executorCalls += 1; return []; } }
    );
    assert.equal(response.status, 200);
    assert.equal(executorCalls, 0);
    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/private/memories/mem-123');
    assert.equal(cap.calls[0].opts.headers.authorization, 'Bearer test-token');
  } finally {
    cap.restore();
  }
});

test('#4114 direct gate with missing or invalid dedicated DB config fails closed', async () => {
  const cap = installFetchCapture();
  try {
    const missing = await onRequestGet(make4114Context({ gate: 'direct_neon' }));
    assert.equal(missing.status, 503);
    assert.equal(missing.headers.get('x-lovebud-route-status'), 'config-absent');
    assert.equal(missing.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    assert.equal((await missing.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');

    const invalid = await onRequestGet(make4114Context({
      gate: 'direct_neon',
      databaseUrl: 'postgresql://user:pass@db.example.com/lovebud',
      modalBaseUrl: 'https://modal.example.com'
    }));
    assert.equal(invalid.status, 503);
    assert.equal(cap.calls.length, 0, 'fail-closed direct config must never fall back to Modal');
  } finally {
    cap.restore();
  }
});

test('#4114 public Tree + public Memory returns exact current public detail DTO and reaction decoration', async () => {
  const { response } = await run4114Direct();
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

test('#4114 static SQL requires both public Memory and public parent Tree', async () => {
  const direct = await loadPublicMemoryDetailDirectModule();
  const sql = direct.PUBLIC_MEMORY_DETAIL_SQL;
  assert.match(sql, /INNER\s+JOIN\s+trees\s+t/i);
  assert.match(sql, /m\.id\s*=\s*\$1/i);
  assert.match(sql, /m\.visibility\s*=\s*'public'/i);
  assert.match(sql, /t\.visibility\s*=\s*'public'/i);
  assert.match(sql, /LIMIT\s+1/i);
});

test('#4114 private parent Tree + public Memory is indistinguishable from not found', async () => {
  const { response } = await run4114Direct({
    executor: async (sql) => {
      assert.match(sql, /t\.visibility\s*=\s*'public'/i);
      return [];
    }
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 public parent Tree + private Memory is indistinguishable from not found', async () => {
  const { response } = await run4114Direct({
    executor: async (sql) => {
      assert.match(sql, /m\.visibility\s*=\s*'public'/i);
      return [];
    }
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 defense-in-depth refuses a non-public injected row', async () => {
  const { response } = await run4114Direct({
    row: make4114PublicRow({ visibility: 'private' })
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 missing or deleted Memory preserves current public 404 semantics', async () => {
  const { response } = await run4114Direct({ row: null });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
});

test('#4114 reactionCounts keeps per-type counts plus current total decoration', async () => {
  const { response } = await run4114Direct({
    row: make4114PublicRow({ reaction_counts: { applaud: 1, like: 3 } })
  });
  assert.deepEqual((await response.json()).reactionCounts, { applaud: 1, like: 3, total: 4 });
});

test('#4114 field types, emotion tags, defaults, and microsecond timestamps preserve Modal normalization', async () => {
  const { response } = await run4114Direct({
    row: make4114PublicRow({
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

test('#4114 public projection never exposes owner/client/private metadata', async () => {
  const { response } = await run4114Direct({
    row: make4114PublicRow({
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

test('#4114 preserves current non-UUID string-ID scope and malformed-percent taxonomy', async () => {
  const valuesSeen = [];
  const encodedId = '%E2%9C%93-memory';
  const ok = await handleMemoryDetailGet(
    make4114Context({
      memoryId: encodedId,
      gate: 'direct_neon',
      databaseUrl: MEMORY_DETAIL_NEON_TEST_URL,
      modalBaseUrl: null
    }),
    {
      executorOverride: async (_sql, values) => {
        valuesSeen.push(...values);
        return [make4114PublicRow({ id: '✓-memory' })];
      }
    }
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(valuesSeen, ['✓-memory']);

  let invalidExecutorCalls = 0;
  const malformed = await handleMemoryDetailGet(
    make4114Context({
      memoryId: '%E0%A4%A',
      gate: 'direct_neon',
      databaseUrl: MEMORY_DETAIL_NEON_TEST_URL,
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

test('#4114 direct SQL is static, parameterized, read-only, and contains no private owner metadata', async () => {
  const direct = await loadPublicMemoryDetailDirectModule();
  const sql = direct.PUBLIC_MEMORY_DETAIL_SQL;
  assert.match(sql, /^\s*SELECT\b/i);
  assert.equal((sql.match(/\$1/g) || []).length, 1, 'Memory id must use one positional bind');
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|BEGIN|CALL|DO)\b/i);
  assert.doesNotMatch(sql, /owner_id|client_key/i);
});

test('#4114 query failure is sanitized, no-store, and never falls back to Modal', async () => {
  const cap = installFetchCapture();
  try {
    const { response } = await run4114Direct({
      executor: async () => {
        throw new Error('secret database host password=do-not-leak');
      }
    });
    assert.equal(response.status, 500);
    assert.equal(cap.calls.length, 0);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const text = await response.text();
    assert.match(text, /DIRECT_NEON_QUERY_FAILED/);
    assert.doesNotMatch(text, /password|do-not-leak|database host/i);
  } finally {
    cap.restore();
  }
});

test('#4114 adapter reads only LOVE_PLATFORM_DATABASE_URL and has no generic DB fallback', async () => {
  const direct = await loadPublicMemoryDetailDirectModule();
  assert.equal(direct.isNeonDatabaseUrl('postgresql://user:pass@db.example.com/lovebud'), false);
  assert.equal(direct.isNeonDatabaseUrl(MEMORY_DETAIL_NEON_TEST_URL), true);

  const source = fs.readFileSync(
    path.join(path.resolve(__dirname, '..', '..'), 'functions/_shared/public-memory-detail-direct-neon.js'),
    'utf8'
  );
  assert.match(source, /LOVE_PLATFORM_DATABASE_URL/);
  assert.doesNotMatch(source, /env\.(?:DATABASE_URL|POSTGRES_URL|NEON_DATABASE_URL)/);
  assert.doesNotMatch(source, /process\.env/);
});

test('#4114 unrelated Memory writes remain on the shared proxy and route ownership stays narrow', () => {
  const root = path.resolve(__dirname, '..', '..');
  const routeSource = fs.readFileSync(path.join(root, 'functions/api/memories/[id].js'), 'utf8');
  assert.match(routeSource, /export async function onRequestPut\(context\)[\s\S]*proxyMemoryRouteRequest\(context, withMemoryId\(context\)\)/);
  assert.match(routeSource, /export async function onRequestDelete\(context\)[\s\S]*proxyMemoryRouteRequest\(context, withMemoryId\(context\)\)/);

  const forbiddenTouchedRoutes = [
    'functions/api/[[path]].js',
    'functions/api/trees/[id].js',
    'functions/api/trees.js'
  ];
  for (const relative of forbiddenTouchedRoutes) {
    assert.ok(fs.existsSync(path.join(root, relative)), `${relative} remains present and owned by its existing lane`);
  }
});
