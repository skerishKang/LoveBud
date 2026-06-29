/**
 * Contract tests for Cloudflare Pages Function catch-all router's
 * public read-only tree-read cache boundary.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';
const TEST_HOST = 'https://test5.lovebud.pages.dev';

// Mock Cache implementation
class MockCache {
  constructor() {
    this.store = new Map();
  }

  async match(request) {
    const key = typeof request === 'string' ? request : request.url;
    // Normalize url if absolute
    let cleanKey = key;
    try {
      const parsed = new URL(key);
      cleanKey = parsed.pathname + parsed.search;
    } catch (e) {}
    
    // Fallback: search key endings
    for (const [k, entry] of this.store.entries()) {
      if (k === cleanKey || k.endsWith(cleanKey) || cleanKey.endsWith(k)) {
        return entry.clone();
      }
    }
    return null;
  }

  async put(request, response) {
    const key = typeof request === 'string' ? request : request.url;
    let cleanKey = key;
    try {
      const parsed = new URL(key);
      cleanKey = parsed.pathname + parsed.search;
    } catch (e) {}
    const clonedResponse = response.clone();
    this.store.set(cleanKey, clonedResponse);
  }

  async delete(request) {
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
  fetchCalls = [];
}

async function callOnRequest(request, envOverrides) {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;
  return onRequest({
    request,
    env: { MODAL_BASE_URL, ...envOverrides },
  });
}

test('1. anonymous public tree 200: cache miss, headers validation, body preservation', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({
        id: 'tree-123',
        title: 'Fresh Public Tree',
        visibility: 'public'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'miss');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=30, must-revalidate');

    const body = await response.json();
    assert.equal(body.id, 'tree-123');
    assert.equal(body.visibility, 'public');

    // Confirm stored in mock cache
    const cached = await mockCaches.default.match(`/__cache/public/trees/tree-123`);
    assert.ok(cached);
    assert.equal(cached.headers.get('Cache-Control'), 'public, max-age=30, must-revalidate');
  } finally {
    restoreMocks();
  }
});

test('2. anonymous public tree cache hit on subsequent request', async () => {
  setupMocks();
  try {
    let mockServerCallCount = 0;
    fetchHandler = async () => {
      mockServerCallCount++;
      return new Response(JSON.stringify({
        id: 'tree-123',
        title: 'Fresh Public Tree',
        visibility: 'public'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    // First Request
    const request1 = new Request(`${TEST_HOST}/api/trees/tree-123`);
    await callOnRequest(request1);
    assert.equal(mockServerCallCount, 1);

    // Second Request
    const request2 = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response2 = await callOnRequest(request2);

    assert.equal(response2.status, 200);
    assert.equal(mockServerCallCount, 1); // No additional upstream calls
    assert.equal(response2.headers.get('x-lovebud-public-tree-cache'), 'hit');
  } finally {
    restoreMocks();
  }
});

test('3. authenticated public tree GET: bypass cache entirely', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({
        id: 'tree-123',
        title: 'Fresh Public Tree',
        visibility: 'public'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`, {
      headers: { 'authorization': 'Bearer some-user' }
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'bypass-auth');
    
    // Cache must remain empty
    const cached = await mockCaches.default.match(`/__cache/public/trees/tree-123`);
    assert.equal(cached, null);
  } finally {
    restoreMocks();
  }
});

test('4. 404 / 403 / 500 / 503 response: do not cache', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-404`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'skip-noncacheable');

    const cached = await mockCaches.default.match(`/__cache/public/trees/tree-404`);
    assert.equal(cached, null);
  } finally {
    restoreMocks();
  }
});

test('5. 200 but visibility !== public: skip caching', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({
        id: 'tree-private',
        title: 'Private Tree',
        visibility: 'private'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-private`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'skip-noncacheable');

    const cached = await mockCaches.default.match(`/__cache/public/trees/tree-private`);
    assert.equal(cached, null);
  } finally {
    restoreMocks();
  }
});

test('6. non-JSON / Set-Cookie: skip caching', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response('Not json', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'set-cookie': 'session=abc'
        }
      });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-cookie`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'skip-noncacheable');

    const cached = await mockCaches.default.match(`/__cache/public/trees/tree-cookie`);
    assert.equal(cached, null);
  } finally {
    restoreMocks();
  }
});

test('7. expired cache entry: triggers deletion and refreshes from upstream', async () => {
  setupMocks();
  try {
    let mockServerCallCount = 0;
    fetchHandler = async () => {
      mockServerCallCount++;
      return new Response(JSON.stringify({
        id: 'tree-123',
        title: 'Fresh Public Tree',
        visibility: 'public'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    // Store already expired cache entry directly
    const expiredResponse = new Response(JSON.stringify({
      id: 'tree-123',
      visibility: 'public'
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-lovebud-public-tree-cache-expires-at': String(Date.now() - 1000) // 1 second ago
      }
    });
    await mockCaches.default.put(`/__cache/public/trees/tree-123`, expiredResponse);

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(mockServerCallCount, 1);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'miss');
  } finally {
    restoreMocks();
  }
});

test('8. expired entry + Modal upstream 503: stale serving prohibited', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
    };

    // Expired entry
    const expiredResponse = new Response(JSON.stringify({
      id: 'tree-123',
      visibility: 'public'
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-lovebud-public-tree-cache-expires-at': String(Date.now() - 1000)
      }
    });
    await mockCaches.default.put(`/__cache/public/trees/tree-123`, expiredResponse);

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequest(request);

    // Stale cached data must NOT be served; upstream 503 forwarded
    assert.equal(response.status, 503);
  } finally {
    restoreMocks();
  }
});

test('9. cache put failure does not crash response delivery', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      return new Response(JSON.stringify({
        id: 'tree-123',
        title: 'Fresh Public Tree',
        visibility: 'public'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    // Override put to throw
    mockCaches.default.put = async () => {
      throw new Error('Cache Write Disk Full');
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'store-failed');
    const body = await response.json();
    assert.equal(body.id, 'tree-123');
  } finally {
    // Restore default mock behaviors
    mockCaches.default.put = MockCache.prototype.put;
    restoreMocks();
  }
});

test('10. source guard limits and cache policies stability', async () => {
  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.resolve(__dirname, '../../functions/api/[[path]].js'), 'utf8');

  // stale-while-revalidate must not exist in public tree caching block
  assert.ok(!code.includes("max-age=30, stale-while-revalidate"));
  assert.ok(code.includes("max-age=30"));
  assert.ok(code.includes("must-revalidate"));
});
