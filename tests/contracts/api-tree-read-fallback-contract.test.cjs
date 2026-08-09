/**
 * Contract tests for Cloudflare Pages Function catch-all router's
 * GET /api/trees/:id private → public fallback boundary.
 *
 * The catch-all [[path]].js buildModalUrl routes:
 *   - GET /api/trees/:id with Authorization → /modal/private/trees/:id
 *   - GET /api/trees/:id without Authorization → /modal/trees/:id (public)
 *
 * The fallback in tryModalRead:
 *   - 404 from /modal/private/trees/:id + auth header → fallback to /modal/trees/:id
 *   - 403 from /modal/private/trees/:id → no fallback (unauthorized private resource)
 *   - 200 from /modal/private/trees/:id → no fallback (owner read)
 *
 * Policy:
 *   - 403 from /modal/private/trees/:id means "known private resource but unauthorized"
 *     and must NOT fallback to public.
 *   - 404 from /modal/private/trees/:id may fallback to public route for authenticated
 *     users opening public trees.
 *   - Public route must not expose private tree data.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';
const TEST_HOST = 'https://test5.lovebud.pages.dev';

/**
 * Records each globalThis.fetch call during a test.
 * Returns restore function for teardown.
 */
function mockFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: typeof url === 'string' ? url : url.toString(), options };
    calls.push(call);
    return handler(call, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/**
 * Wrapper around [[path]].js onRequest.
 * Import is async so each test re-imports to avoid stale module state.
 */
async function callOnRequest(request, envOverrides) {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;
  return onRequest({
    request,
    env: { MODAL_BASE_URL, ...envOverrides },
  });
}

// ─── Test 1: Owner reading own private tree ────────────────────────────────

test('owner reading own private tree returns private tree data', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({
      id: 'private-owner-tree',
      title: 'Owner Private Tree',
      visibility: 'private',
      ownerId: 'owner-123',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/private-owner-tree`, {
      headers: { 'authorization': 'Bearer owner-token' },
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200, 'owner read must return 200');
    assert.equal(calls.length, 1, 'must make exactly one Modal call');
    assert.ok(calls[0].url.includes('/modal/private/trees/private-owner-tree'),
      'first call must target private tree route');
    assert.ok(!calls[0].url.includes('/modal/trees/'),
      'must not call public fallback');

    const body = await response.json();
    assert.equal(body.id, 'private-owner-tree', 'must return private tree data');
    assert.equal(body.visibility, 'private');
  } finally {
    restore();
  }
});

// ─── Test 2: Authenticated non-owner reading private tree ──────────────────

test('authenticated non-owner reading private tree does not leak through public fallback', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({
      error: 'Forbidden',
      detail: 'You do not have access to this private tree',
    }), { status: 403, headers: { 'content-type': 'application/json' } });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/private-other-user-tree`, {
      headers: { 'authorization': 'Bearer non-owner-token' },
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 403, 'unauthorized private access must return 403');
    assert.equal(calls.length, 1, 'must make exactly one Modal call (no fallback)');
    assert.ok(calls[0].url.includes('/modal/private/trees/private-other-user-tree'),
      'must only call private route');
    assert.ok(!calls[0].url.includes('/modal/trees/'),
      'must not fallback to public route');

    const body = await response.json();
    assert.notEqual(body.id, 'private-other-user-tree',
      'must not expose private tree data');
  } finally {
    restore();
  }
});

// ─── Test 3: Authenticated user reading a public tree succeeds ─────────────

test('authenticated user reading a public tree succeeds through intended fallback', async () => {
  let callIndex = 0;
  const { calls, restore } = mockFetch(async (call) => {
    callIndex++;
    if (callIndex === 1) {
      return new Response(JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      id: 'public-tree',
      title: 'Public Tree',
      visibility: 'public',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/public-tree`, {
      headers: { 'authorization': 'Bearer signed-in-user' },
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200, 'public tree fallback must return 200');
    assert.equal(calls.length, 2, 'must make exactly two Modal calls');

    assert.ok(calls[0].url.includes('/modal/private/trees/public-tree'),
      'first call must target private route');
    assert.ok(calls[1].url.includes('/modal/trees/public-tree'),
      'second call must target public route');

    const body = await response.json();
    assert.equal(body.id, 'public-tree', 'must return public tree data');
    assert.equal(body.visibility, 'public');
  } finally {
    restore();
  }
});

// ─── Test 4: Unauthenticated user reading private tree ID ──────────────────

test('unauthenticated user reading private tree ID does not leak data', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'content-type': 'application/json' } });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/private-tree`);
    // No authorization header
    const response = await callOnRequest(request);

    assert.equal(response.status, 404, 'unauthenticated access must return 404');
    assert.equal(calls.length, 1, 'must make exactly one Modal call');
    assert.ok(calls[0].url.includes('/modal/trees/private-tree'),
      'must only call public route (no auth → no private route attempted)');
    assert.ok(!calls[0].url.includes('/modal/private/'),
      'must not call private endpoint');

    const body = await response.json();
    assert.notEqual(body.id, 'private-tree',
      'must not expose private tree data');
  } finally {
    restore();
  }
});


// ─── #3933: catch-all no longer persists Tree-detail cache ────────────────

class MockCache3933 {
  constructor() { this.store = new Map(); this.matchCalls = 0; this.putCalls = 0; }
  async match(request) {
    this.matchCalls += 1;
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try { const parsed = new URL(key); cleanKey = parsed.pathname + parsed.search; } catch (e) {}
    for (const [k, entry] of this.store.entries()) {
      if (k === cleanKey || k.endsWith(cleanKey) || cleanKey.endsWith(k)) return entry.clone();
    }
    return null;
  }
  async put(request, response) {
    this.putCalls += 1;
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try { const parsed = new URL(key); cleanKey = parsed.pathname + parsed.search; } catch (e) {}
    this.store.set(cleanKey, response.clone());
  }
}

function staleTreeDetailResponse() {
  return new Response(JSON.stringify({ id: 'revoked-tree', title: 'STALE PRE-REVOCATION BODY', visibility: 'public' }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-lovebud-public-tree-cache-expires-at': String(Date.now() + 60000)
    }
  });
}

test('#3933 catch-all: anonymous Tree detail never uses cache.match/put', async () => {
  const mockCaches = { default: new MockCache3933() };
  const prevCaches = globalThis.caches;
  globalThis.caches = mockCaches;
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ id: 'public-tree', title: 'Public Tree', visibility: 'public' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  });
  try {
    const request = new Request(`${TEST_HOST}/api/trees/public-tree`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'anonymous Tree detail must reach Modal exactly once');
    assert.ok(calls[0].url.includes('/modal/trees/public-tree'), 'must hit public authority');
    assert.equal(mockCaches.default.matchCalls, 0, 'no cache.match on anonymous Tree detail');
    assert.equal(mockCaches.default.putCalls, 0, 'no cache.put on anonymous Tree detail');
    assert.equal(response.headers.get('Cache-Control'), 'no-store', 'anonymous Tree detail is no-store');
    assert.equal(response.headers.get('x-lovebud-public-tree-cache-expires-at'), null, 'no 30s expiry header');
  } finally {
    restore();
    if (prevCaches === undefined) delete globalThis.caches; else globalThis.caches = prevCaches;
  }
});

test('#3933 catch-all: second anonymous Tree detail calls Modal authority again', async () => {
  const mockCaches = { default: new MockCache3933() };
  const prevCaches = globalThis.caches;
  globalThis.caches = mockCaches;
  let serverCalls = 0;
  const { calls, restore } = mockFetch(async (call) => {
    serverCalls += 1;
    return new Response(JSON.stringify({ id: 'public-tree', title: 'Public Tree', visibility: 'public' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  });
  try {
    await callOnRequest(new Request(`${TEST_HOST}/api/trees/public-tree`));
    await callOnRequest(new Request(`${TEST_HOST}/api/trees/public-tree`));
    assert.equal(serverCalls, 2, 'every anonymous Tree detail must re-query Modal');
    assert.equal(mockCaches.default.matchCalls, 0);
    assert.equal(mockCaches.default.putCalls, 0);
    assert.equal(calls.length, 2);
  } finally {
    restore();
    if (prevCaches === undefined) delete globalThis.caches; else globalThis.caches = prevCaches;
  }
});

test('#3933 catch-all: preloaded stale Tree-detail cache is ignored after revocation', async () => {
  const mockCaches = { default: new MockCache3933() };
  const prevCaches = globalThis.caches;
  globalThis.caches = mockCaches;
  await mockCaches.default.put('/__cache/public/trees/revoked-tree', staleTreeDetailResponse());
  const { restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404, headers: { 'content-type': 'application/json' }
    });
  });
  try {
    const response = await callOnRequest(new Request(`${TEST_HOST}/api/trees/revoked-tree`));
    assert.equal(response.status, 404, 'authority 404 must be returned, not stale 200 body');
    const body = await response.json();
    assert.equal(body.title, undefined, 'stale public body must never leak');
  } finally {
    restore();
    if (prevCaches === undefined) delete globalThis.caches; else globalThis.caches = prevCaches;
  }
});

test('#3933 catch-all source guard: no Tree-detail cache persistence remains', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const code = fs.readFileSync(path.resolve(__dirname, '../../functions/api/[[path]].js'), 'utf8');
  assert.ok(!code.includes('__cache/public/trees'), 'no Tree-detail cache key in catch-all');
  assert.ok(!code.includes('x-lovebud-public-tree-cache-expires-at'), 'no 30s expiry header');
  assert.ok(!code.includes('isVerifiedPublicTreeCacheCandidate'), 'no Tree-detail cache candidate logic');
  assert.ok(code.includes('/__cache/community/trees'), 'Browse summary cache must remain');
  assert.ok(code.includes("headers.set('Cache-Control', 'no-store')"), 'anonymous Tree detail is no-store');
});
// ─── Test 5: Existing public behavior remains unchanged ────────────────────

test('existing public access to public tree returns 200', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({
      id: 'public-tree',
      title: 'Public Tree',
      visibility: 'public',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/public-tree`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200, 'public tree without auth must return 200');
    assert.equal(calls.length, 1, 'must make exactly one Modal call');
    assert.ok(calls[0].url.includes('/modal/trees/public-tree'),
      'must target public Modal route');

    const body = await response.json();
    assert.equal(body.id, 'public-tree', 'must return public tree data');
  } finally {
    restore();
  }
});
