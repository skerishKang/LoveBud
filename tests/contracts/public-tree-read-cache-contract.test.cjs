/**
 * Contract tests for Cloudflare Pages Function route-specific detail router's
 * public Tree read boundary (Issue #3933).
 *
 * The explicit Cache API persistence for anonymous Tree detail has been removed:
 * a Tree's visibility may be revoked at any time, and a POP-local cache entry
 * could keep serving a stale public body after revocation. Anonymous Tree
 * detail therefore reaches the current public Modal authority on every request
 * and successful responses are marked Cache-Control: no-store.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';
const TEST_HOST = 'https://test5.lovebud.pages.dev';

// Mock Cache implementation (proves the route never touches it)
class MockCache {
  constructor() {
    this.store = new Map();
    this.matchCalls = 0;
    this.putCalls = 0;
    this.deleteCalls = 0;
  }

  async match(request) {
    this.matchCalls += 1;
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try {
      const parsed = new URL(key);
      cleanKey = parsed.pathname + parsed.search;
    } catch (e) {}
    for (const [k, entry] of this.store.entries()) {
      if (k === cleanKey || k.endsWith(cleanKey) || cleanKey.endsWith(k)) {
        return entry.clone();
      }
    }
    return null;
  }

  async put(request, response) {
    this.putCalls += 1;
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try {
      const parsed = new URL(key);
      cleanKey = parsed.pathname + parsed.search;
    } catch (e) {}
    this.store.set(cleanKey, response.clone());
  }

  async delete(request) {
    this.deleteCalls += 1;
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try {
      const parsed = new URL(key);
      cleanKey = parsed.pathname + parsed.search;
    } catch (e) {}
    return this.store.delete(cleanKey);
  }
}

// Global environment setup for tests
let fetchCalls = [];
let fetchHandler = () => {};
const mockCaches = {
  default: new MockCache()
};

function setupMocks() {
  globalThis.caches = mockCaches;
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: typeof url === 'string' ? url : url.toString(), options };
    fetchCalls.push(call);
    return fetchHandler(call, fetchCalls.length);
  };
}

function restoreMocks() {
  delete globalThis.caches;
  delete globalThis.fetch;
  mockCaches.default.store.clear();
  mockCaches.default.matchCalls = 0;
  mockCaches.default.putCalls = 0;
  mockCaches.default.deleteCalls = 0;
  fetchCalls = [];
}

async function callOnRequestGet(request, params = { id: 'tree-123' }, envOverrides = {}) {
  const mod = await import('../../functions/api/trees/[id].js');
  const { onRequestGet } = mod;
  return onRequestGet({
    request,
    params,
    env: { MODAL_BASE_URL, ...envOverrides },
  });
}

function buildPublicTreeResponse() {
  return new Response(JSON.stringify({
    id: 'tree-123',
    title: 'Fresh Public Tree',
    visibility: 'public'
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function staleCachedPublicTree() {
  return new Response(JSON.stringify({
    id: 'tree-123',
    title: 'STALE PRE-REVOCATION BODY',
    visibility: 'public'
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-lovebud-public-tree-cache-expires-at': String(Date.now() + 60000) // still fresh by old rules
    }
  });
}

test('1. anonymous public tree 200: single Modal call, no cache use, no-store', async () => {
  setupMocks();
  try {
    fetchHandler = async () => buildPublicTreeResponse();

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequestGet(request, { id: 'tree-123' });

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-public-tree-cache-expires-at'), null);
    assert.ok(response.headers.get('x-lovebud-request-id'));

    const body = await response.json();
    assert.equal(body.id, 'tree-123');
    assert.equal(body.visibility, 'public');

    // Nothing may be persisted to the Cache API
    assert.equal(mockCaches.default.putCalls, 0, 'no cache.put must occur');
    const cached = await mockCaches.default.match('/__cache/public/trees/tree-123');
    assert.equal(cached, null, 'no Tree-detail entry may be stored');
  } finally {
    restoreMocks();
  }
});

test('2. second request calls the Modal authority again (no cache hit)', async () => {
  setupMocks();
  try {
    let mockServerCallCount = 0;
    fetchHandler = async () => {
      mockServerCallCount++;
      return buildPublicTreeResponse();
    };

    const request1 = new Request(`${TEST_HOST}/api/trees/tree-123`);
    await callOnRequestGet(request1, { id: 'tree-123' });
    assert.equal(mockServerCallCount, 1);

    const request2 = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response2 = await callOnRequestGet(request2, { id: 'tree-123' });

    assert.equal(response2.status, 200);
    assert.equal(mockServerCallCount, 2, 'every anonymous GET must hit Modal again');
    assert.equal(response2.headers.get('Cache-Control'), 'no-store');
  } finally {
    restoreMocks();
  }
});

test('3. preloaded stale public cache entry is ignored (revocation not masked)', async () => {
  setupMocks();
  try {
    // A stale public body exists in the (legacy) mock cache.
    await mockCaches.default.put('/__cache/public/trees/tree-123', staleCachedPublicTree());

    // Authority now reports the Tree as not-found (revoked).
    fetchHandler = async () => {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequestGet(request, { id: 'tree-123' });

    // Must reflect the current authority, never the stale public body.
    assert.equal(response.status, 404, 'authority 404 must be returned');
    assert.equal(mockCaches.default.matchCalls, 0, 'no cache.match may be attempted');
    const body = await response.json();
    assert.equal(body.error, 'Not Found');
    assert.notEqual(body.title, 'STALE PRE-REVOCATION BODY', 'old public body must never leak');
  } finally {
    restoreMocks();
  }
});

test('4. preloaded stale cache ignored when authority returns leak-safe 404', async () => {
  setupMocks();
  try {
    await mockCaches.default.put('/__cache/public/trees/tree-123', staleCachedPublicTree());

    // Authority now reports the Tree as revoked (leak-safe 404 for anonymous).
    fetchHandler = async () => {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequestGet(request, { id: 'tree-123' });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.title, undefined, 'stale public title must not surface');
  } finally {
    restoreMocks();
  }
});

test('5. authenticated public tree GET: owner route first, cache-independent bypass-auth', async () => {
  setupMocks();
  try {
    fetchHandler = async (call) => {
      if (call.url.includes('/modal/private/trees/tree-123')) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
      }
      return buildPublicTreeResponse();
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`, {
      headers: { 'authorization': 'Bearer some-user' }
    });
    const response = await callOnRequestGet(request, { id: 'tree-123' });

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 2, 'owner 404 then public fallback');
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'bypass-auth');
    assert.equal(mockCaches.default.matchCalls, 0, 'authenticated path must not consult cache');

    const cached = await mockCaches.default.match('/__cache/public/trees/tree-123');
    assert.equal(cached, null);
  } finally {
    restoreMocks();
  }
});

test('6. authenticated non-owner private denial: no public fallback (403)', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    };

    const request = new Request(`${TEST_HOST}/api/trees/private-other`, {
      headers: { 'authorization': 'Bearer non-owner' }
    });
    const response = await callOnRequestGet(request, { id: 'private-other' });

    assert.equal(response.status, 403, '403 must not fall back to public');
    assert.equal(fetchCalls.length, 1);
  } finally {
    restoreMocks();
  }
});

test('7. 404 / 403 / 500 / 503 bodies and status pass through unchanged', async () => {
  setupMocks();
  try {
    for (const [status, body, label] of [
      [404, { error: 'Not Found' }, '404'],
      [500, { error: 'Internal' }, '500'],
      [503, { error: 'Unavailable' }, '503']
    ]) {
      fetchHandler = async () => new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      });

      const request = new Request(`${TEST_HOST}/api/trees/tree-status-${label}`);
      const response = await callOnRequestGet(request, { id: `tree-status-${label}` });

      assert.equal(response.status, status, `${label} status must pass through`);
      assert.equal(response.headers.get('Cache-Control'), 'no-store', `${label} also no-store`);
      const parsed = await response.json();
      assert.deepEqual(parsed, body, `${label} body must pass through unchanged`);
    }
  } finally {
    restoreMocks();
  }
});

test('8. Modal fetch failure returns 503 without cache fallback', async () => {
  setupMocks();
  try {
    await mockCaches.default.put('/__cache/public/trees/tree-123', staleCachedPublicTree());
    fetchHandler = async () => {
      throw new Error('Modal unreachable');
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequestGet(request, { id: 'tree-123' });

    assert.equal(response.status, 503, 'no stale serving on upstream failure');
    const body = await response.json();
    assert.equal(body.error, 'Modal backend unavailable');
  } finally {
    restoreMocks();
  }
});

test('9. source guard: no Cache API persistence remains for Tree detail', () => {
  const code = fs.readFileSync(path.resolve(__dirname, '../../functions/api/trees/[id].js'), 'utf8');

  assert.ok(!code.includes('caches.default'), 'no Cache API access in dedicated route');
  assert.ok(!code.includes('__cache/public/trees'), 'no Tree-detail cache key persistence');
  assert.ok(!code.includes('x-lovebud-public-tree-cache-expires-at'), 'no 30s expiry header');
  assert.ok(!code.includes('max-age=30'), 'no 30-second cache lifetime');
  assert.ok(!code.includes('cache.put'), 'no cache.put');
  assert.ok(!code.includes('cache.match'), 'no cache.match');
  assert.ok(code.includes("headers.set('Cache-Control', 'no-store')"), 'anonymous success must be no-store');
});
