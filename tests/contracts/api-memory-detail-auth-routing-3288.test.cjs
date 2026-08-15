// Synthetic route-contract tests for #3288: align memory-detail GET routing with auth policy.
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
const { onRequestGet } = require('../../functions/api/memories/[id].js');
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
