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

const { buildModalUrl } = require('../../functions/api/[[path]].js');
const { onRequestGet } = require('../../functions/api/memories/[id].js');

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
