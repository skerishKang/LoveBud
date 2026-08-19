/**
 * Contract tests for Cloudflare Pages Function route-specific detail router's
 * public Tree read boundary (Issue #3933, extended by #4115).
 *
 * The explicit Cache API persistence for anonymous Tree detail has been removed:
 * a Tree's visibility may be revoked at any time, and a POP-local cache entry
 * could keep serving a stale public body after revocation. Anonymous Tree
 * detail therefore reaches the current public authority on every request and
 * successful responses are marked Cache-Control: no-store.
 *
 * #4115 adds an independently gated anonymous direct-Neon candidate. Modal is
 * still the default/rollback authority, and authenticated owner/private reads
 * remain Modal owner/private-first even when the direct gate is enabled.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';
const TEST_HOST = 'https://test5.lovebud.pages.dev';
const NEON_TEST_URL = 'postgresql://user:pass@ep-tree-detail-test.us-east-1.neon.tech/neondb?sslmode=require';

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

async function loadDirectTreeDetailQuery() {
  return import('../../functions/_shared/public-tree-detail-neon-query.js');
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

function makeDirectTreeRow(overrides = {}) {
  return {
    id: 'tree-123',
    title: 'Fresh Public Tree',
    visibility: 'public',
    created_at: '2026-08-01 10:00:00.123456+00',
    updated_at: '2026-08-02 12:00:00.654321+00',
    memory_count: 3,
    like_count: 4,
    view_count: 7,
    ...overrides,
  };
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
  assert.ok(code.includes("headers.set('Cache-Control', 'no-store')"), 'default Modal success must be no-store');
});

test('10. absent/modal/unknown direct gate preserves Modal as anonymous default', async () => {
  const direct = await loadDirectTreeDetailQuery();
  for (const gate of [undefined, 'modal', 'legacy_v1', ' direct_neon ' .replace('direct_neon', 'DIRECT_NEON')]) {
    const env = gate === undefined ? {} : { LB_PUBLIC_TREE_DETAIL_RUNTIME: gate };
    const config = direct.readPublicTreeDetailReadConfig(env);
    assert.equal(config.isDirect, false, `gate ${String(gate)} must not activate direct mode`);
  }
});

test('11. direct gate + missing dedicated DB secret fails closed with zero Modal fallback', async () => {
  setupMocks();
  try {
    fetchHandler = async () => {
      throw new Error('no upstream should be called');
    };
    const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
    const response = await callOnRequestGet(request, { id: 'tree-123' }, {
      LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_WRITER_URL: NEON_TEST_URL,
      DATABASE_URL: NEON_TEST_URL,
    });

    assert.equal(response.status, 503);
    assert.equal(fetchCalls.length, 0, 'missing dedicated config must not fall back to Modal');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-route-status'), 'config-absent');
    const body = await response.json();
    assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
  } finally {
    restoreMocks();
  }
});

test('12. anonymous direct Neon route returns exact public Tree detail DTO with social-count parity', async () => {
  setupMocks();
  try {
    fetchHandler = async (call) => {
      assert.match(call.url, /neon\.tech\/sql$/);
      return new Response(JSON.stringify({
        rows: [[
          'tree-123',
          'Fresh Public Tree',
          'public',
          '2026-08-01 10:00:00.123456+00',
          '2026-08-02 12:00:00.654321+00',
          3,
          4,
          7,
        ]],
        fields: [
          { name: 'id', dataTypeID: 25 },
          { name: 'title', dataTypeID: 25 },
          { name: 'visibility', dataTypeID: 25 },
          { name: 'created_at', dataTypeID: 25 },
          { name: 'updated_at', dataTypeID: 25 },
          { name: 'memory_count', dataTypeID: 23 },
          { name: 'like_count', dataTypeID: 23 },
          { name: 'view_count', dataTypeID: 23 },
        ],
        command: 'SELECT',
        rowCount: 1,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const request = new Request(`${TEST_HOST}/api/trees/tree-123`, {
      headers: { 'x-lovebud-request-id': 'req-direct-tree-123' },
    });
    const response = await callOnRequestGet(request, { id: 'tree-123' }, {
      MODAL_BASE_URL: undefined,
      LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1, 'direct route should perform one Neon HTTP query');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-direct-tree-123');

    const body = await response.json();
    assert.deepEqual(Object.keys(body), [
      'id', 'title', 'visibility', 'createdAt', 'updatedAt', 'memoryCount', 'likeCount', 'viewCount'
    ]);
    assert.deepEqual(body, {
      id: 'tree-123',
      title: 'Fresh Public Tree',
      visibility: 'public',
      createdAt: '2026-08-01T10:00:00.123456+00:00',
      updatedAt: '2026-08-02T12:00:00.654321+00:00',
      memoryCount: 3,
      likeCount: 4,
      viewCount: 7,
    });
    assert.equal(Object.hasOwn(body, 'ownerId'), false);
    assert.equal(Object.hasOwn(body, 'owner_id'), false);
    assert.equal(typeof body.memoryCount, 'number');
    assert.equal(typeof body.likeCount, 'number');
    assert.equal(typeof body.viewCount, 'number');
  } finally {
    restoreMocks();
  }
});

test('13. direct private/missing/deleted Tree is leak-safe 404 and never returns a private row', async () => {
  const direct = await loadDirectTreeDetailQuery();
  const request = new Request(`${TEST_HOST}/api/trees/private-tree`);
  const env = {
    LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };

  const privateResponse = await direct.handlePublicTreeDetailDirectNeon(
    request,
    'private-tree',
    env,
    'req-private',
    { executorOverride: async () => [makeDirectTreeRow({ id: 'private-tree', visibility: 'private' })] },
  );
  assert.equal(privateResponse.status, 404);
  assert.equal(privateResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await privateResponse.json(), { detail: 'Tree not found' });

  const deletedResponse = await direct.handlePublicTreeDetailDirectNeon(
    request,
    'deleted-tree',
    env,
    'req-deleted',
    { executorOverride: async () => [] },
  );
  assert.equal(deletedResponse.status, 404);
  assert.deepEqual(await deletedResponse.json(), { detail: 'Tree not found' });
});

test('14. direct visibility revocation cannot serve the previously public body', async () => {
  const direct = await loadDirectTreeDetailQuery();
  const request = new Request(`${TEST_HOST}/api/trees/revoked-tree`);
  const env = {
    LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  let readCount = 0;
  const executor = async () => {
    readCount += 1;
    return readCount === 1
      ? [makeDirectTreeRow({ id: 'revoked-tree', title: 'Previously Public' })]
      : [];
  };

  const first = await direct.handlePublicTreeDetailDirectNeon(
    request, 'revoked-tree', env, 'req-revoke-1', { executorOverride: executor },
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).title, 'Previously Public');

  const second = await direct.handlePublicTreeDetailDirectNeon(
    request, 'revoked-tree', env, 'req-revoke-2', { executorOverride: executor },
  );
  assert.equal(second.status, 404);
  assert.equal(readCount, 2, 'every direct detail request must re-read current DB authority');
  const secondBody = await second.json();
  assert.equal(secondBody.title, undefined, 'revoked public body must not persist');
});

test('15. direct path preserves non-UUID string ID acceptance and trims exactly as Modal validate_required_id', async () => {
  const direct = await loadDirectTreeDetailQuery();
  const request = new Request(`${TEST_HOST}/api/trees/tree-legacy-id`);
  const env = {
    LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
  };
  let seenValues;
  const response = await direct.handlePublicTreeDetailDirectNeon(
    request,
    '  tree-legacy-id  ',
    env,
    'req-nonuuid',
    {
      executorOverride: async (_text, values) => {
        seenValues = values;
        return [makeDirectTreeRow({ id: 'tree-legacy-id' })];
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(seenValues, ['tree-legacy-id']);

  const blank = await direct.handlePublicTreeDetailDirectNeon(
    request,
    '   ',
    env,
    'req-blank',
    { executorOverride: async () => { throw new Error('must not query'); } },
  );
  assert.equal(blank.status, 400);
  assert.deepEqual(await blank.json(), { detail: 'treeId is required' });
});

test('16. direct query errors are bounded and never expose DB URL, credentials, or raw database error', async () => {
  const direct = await loadDirectTreeDetailQuery();
  const request = new Request(`${TEST_HOST}/api/trees/tree-123`);
  const response = await direct.handlePublicTreeDetailDirectNeon(
    request,
    'tree-123',
    {
      LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    },
    'req-bounded-error',
    {
      executorOverride: async () => {
        throw new Error('password=secret postgresql://admin:secret@ep-private.neon.tech/neondb');
      },
    },
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
  const serialized = JSON.stringify(await response.json());
  assert.match(serialized, /DIRECT_NEON_QUERY_FAILED/);
  assert.doesNotMatch(serialized, /password|admin|secret|neon\.tech|postgresql:\/\//i);
});

test('17. direct SQL is static SELECT-only, parameterized, public-only, bounded, and carries both social counts', async () => {
  const direct = await loadDirectTreeDetailQuery();
  const sql = direct.PUBLIC_TREE_DETAIL_SQL;

  assert.match(sql, /^\s*SELECT\b/i);
  assert.match(sql, /WHERE\s+t\.id\s*=\s*\$1/i);
  assert.match(sql, /t\.visibility\s*=\s*'public'/i);
  assert.match(sql, /m\.visibility\s*=\s*'public'/i);
  assert.match(sql, /COALESCE\(s\.like_count,\s*0\)::int\s+AS\s+like_count/i);
  assert.match(sql, /COALESCE\(s\.view_count,\s*0\)::int\s+AS\s+view_count/i);
  assert.match(sql, /LIMIT\s+1/i);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /owner_id|email|auth_subject|firebase/i);
});

test('18. authenticated GET remains Modal owner/private-first even when direct gate is enabled', async () => {
  setupMocks();
  try {
    fetchHandler = async (call) => {
      assert.ok(call.url.includes('/modal/private/trees/private-owner-tree'));
      assert.doesNotMatch(call.url, /neon\.tech/);
      return new Response(JSON.stringify({
        id: 'private-owner-tree',
        title: 'Owner Private Tree',
        visibility: 'private',
        ownerId: 'owner-123',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const request = new Request(`${TEST_HOST}/api/trees/private-owner-tree`, {
      headers: { authorization: 'Bearer owner-token' },
    });
    const response = await callOnRequestGet(request, { id: 'private-owner-tree' }, {
      LB_PUBLIC_TREE_DETAIL_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1, 'authenticated path must make exactly one Modal owner read');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'bypass-auth');
    const body = await response.json();
    assert.equal(body.visibility, 'private');
    assert.equal(body.ownerId, 'owner-123');
  } finally {
    restoreMocks();
  }
});
