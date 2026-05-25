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
