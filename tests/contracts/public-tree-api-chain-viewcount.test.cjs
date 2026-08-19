/**
 * Runtime API chain test: viewCount flows through getPublicTrees.
 *
 * Loads adapter + postgres-client with mock BaseApiFetch,
 * then calls window.apiClient.getPublicTrees() with controlled data.
 *
 * #4121 extends this already-executed-fake contract with the gated owner Tree
 * detail direct-Neon helper and route integration. All new DB/auth effects are
 * injected fakes; no external network, database, provider, or Production
 * resource is contacted.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const adapterSrc = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
const pgClientSrc = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');
const TREE_DETAIL_ROUTE_PATH = path.join(ROOT, 'functions/api/trees/[id].js');
const OWNER_DETAIL_HELPER_PATH = path.join(ROOT, 'functions/_shared/owner-tree-detail-direct-neon.js');
const TEST_HOST = 'https://test5.lovebud.pages.dev';
const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';
const NEON_TEST_URL = 'postgresql://user:pass@ep-owner-detail-test.us-east-1.neon.tech/neondb?sslmode=require';
const OWNER_UID = 'firebase-owner-4121';
const TREE_ID = '11111111-1111-4111-8111-111111111111';

function setupEnv(mockApiTrees) {
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      LoveBudRuntimeFlags: null,
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    URL,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  sandbox.window.LoveTreeBaseApiFetch = {
    apiFetch: async (endpoint) => {
      if (endpoint.includes('/community/trees')) return mockApiTrees;
      return [];
    }
  };
  sandbox.window.LoveTreeAuthPolicy = {
    endpointLikelyRequiresAuth: () => false,
    hasConfirmedAuthSession: () => false,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  vm.runInContext(pgClientSrc, ctx, { filename: 'postgres-client.js' });
  return ctx;
}

async function loadOwnerDetailHelper() {
  return import('../../functions/_shared/owner-tree-detail-direct-neon.js');
}

async function loadTreeDetailRoute() {
  return import('../../functions/api/trees/[id].js');
}

function directEnv(overrides = {}) {
  return {
    LB_OWNER_TREE_DETAIL_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
    ...overrides,
  };
}

function ownerTreeRow(overrides = {}) {
  return {
    id: TREE_ID,
    owner_id: OWNER_UID,
    title: 'Owner Tree',
    visibility: 'private',
    group_name: '  My Group  ',
    keywords: ['alpha', 'beta'],
    created_at: '2026-08-01 10:00:00.123456+00',
    updated_at: '2026-08-02 12:00:00.654321+00',
    memory_count: 3,
    like_count: 4,
    view_count: 7,
    ...overrides,
  };
}

function ownerExecutor({
  row = ownerTreeRow(),
  capabilities = { has_social_counts: true, has_like_count: true, has_view_count: true },
  onQuery = null,
} = {}) {
  return async (text, values) => {
    if (typeof onQuery === 'function') onQuery(text, values);
    if (/information_schema/i.test(text)) return [capabilities];
    return row ? [row] : [];
  };
}

async function callOwnerDirect({
  helper,
  treeId = TREE_ID,
  env = directEnv(),
  executor = ownerExecutor(),
  verifyToken = async () => ({ uid: OWNER_UID }),
  headers = {},
  requestId = 'req-owner-detail-4121',
} = {}) {
  const request = new Request(`${TEST_HOST}/api/trees/${TREE_ID}`, {
    headers: {
      authorization: 'Bearer verified-firebase-token',
      ...headers,
    },
  });
  return helper.handleOwnerTreeDetailDirectNeon(
    request,
    treeId,
    env,
    requestId,
    { executorOverride: executor, verifyTokenOverride: verifyToken },
  );
}

test('api chain: camelCase positive viewCount preserved', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: 3 }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, 3);
});

test('api chain: persisted zero', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: 0 }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, 0);
});

test('api chain: missing viewCount undefined', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public' }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: null viewCount undefined', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: null }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: private tree excluded', async () => {
  const ctx = setupEnv([
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 },
  ]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'pub');
});

test('api chain: invalid boolean does not produce synthetic 0', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: true }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: whitespace string does not produce synthetic 0', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: '  ' }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

// ---------------------------------------------------------------------------
// #4121 Owner Tree Detail Firebase-principal direct-Neon focused parity
// ---------------------------------------------------------------------------

test('#4121 gate absent/modal/unknown keeps authenticated Tree detail on Modal', async () => {
  const route = await loadTreeDetailRoute();
  const originalFetch = globalThis.fetch;
  try {
    for (const gate of [undefined, 'modal', 'legacy_v1', 'DIRECT_NEON']) {
      const calls = [];
      globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        return new Response(JSON.stringify({ id: TREE_ID, visibility: 'private', ownerId: OWNER_UID }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };
      const env = { MODAL_BASE_URL };
      if (gate !== undefined) env.LB_OWNER_TREE_DETAIL_RUNTIME = gate;
      const response = await route.onRequestGet({
        request: new Request(`${TEST_HOST}/api/trees/${TREE_ID}`, {
          headers: { authorization: 'Bearer modal-owner-token' },
        }),
        params: { id: TREE_ID },
        env,
      });
      assert.equal(response.status, 200, `gate=${String(gate)}`);
      assert.equal(calls.length, 1, `gate=${String(gate)} must make one Modal owner call`);
      assert.match(calls[0].url, new RegExp(`/modal/private/trees/${TREE_ID}$`));
      assert.equal(calls[0].options.headers.authorization, 'Bearer modal-owner-token');
      assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4121 direct gate derives owner authority only from verified Firebase principal', async () => {
  const helper = await loadOwnerDetailHelper();
  const queries = [];
  const response = await callOwnerDirect({
    helper,
    headers: {
      'x-owner-id': 'attacker-owner',
      'x-user-id': 'attacker-user',
      'x-email': 'attacker@example.invalid',
    },
    executor: ownerExecutor({
      onQuery: (text, values) => queries.push({ text, values }),
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(queries.length, 2, 'capability read + bounded owner detail read');
  assert.deepEqual(queries[1].values, [TREE_ID, OWNER_UID]);
  assert.doesNotMatch(JSON.stringify(queries[1].values), /attacker/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-public-tree-cache'), 'bypass-auth');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-owner-detail-4121');
});

test('#4121 direct private owner Tree returns exact owner DTO/type/timestamp parity', async () => {
  const helper = await loadOwnerDetailHelper();
  const response = await callOwnerDirect({ helper });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), [
    'id', 'title', 'visibility', 'createdAt', 'updatedAt', 'memoryCount',
    'ownerId', 'groupName', 'keywords', 'likeCount', 'viewCount'
  ]);
  assert.deepEqual(body, {
    id: TREE_ID,
    title: 'Owner Tree',
    visibility: 'private',
    createdAt: '2026-08-01T10:00:00.123456+00:00',
    updatedAt: '2026-08-02T12:00:00.654321+00:00',
    memoryCount: 3,
    ownerId: OWNER_UID,
    groupName: 'My Group',
    keywords: ['alpha', 'beta'],
    likeCount: 4,
    viewCount: 7,
  });
  assert.equal(typeof body.memoryCount, 'number');
  assert.equal(typeof body.likeCount, 'number');
  assert.equal(typeof body.viewCount, 'number');
});

test('#4121 optional social-count capabilities omit unsupported fields without breaking owner DTO', async () => {
  const helper = await loadOwnerDetailHelper();

  const none = await callOwnerDirect({
    helper,
    executor: ownerExecutor({
      capabilities: { has_social_counts: false, has_like_count: false, has_view_count: false },
      row: ownerTreeRow({ like_count: undefined, view_count: undefined }),
    }),
  });
  const noneBody = await none.json();
  assert.equal(none.status, 200);
  assert.equal(Object.hasOwn(noneBody, 'likeCount'), false);
  assert.equal(Object.hasOwn(noneBody, 'viewCount'), false);
  assert.equal(noneBody.ownerId, OWNER_UID);
  assert.equal(noneBody.memoryCount, 3);

  const likeOnly = await callOwnerDirect({
    helper,
    executor: ownerExecutor({
      capabilities: { has_social_counts: true, has_like_count: true, has_view_count: false },
      row: ownerTreeRow({ view_count: undefined }),
    }),
  });
  const likeBody = await likeOnly.json();
  assert.equal(likeBody.likeCount, 4);
  assert.equal(Object.hasOwn(likeBody, 'viewCount'), false);
});

test('#4121 non-owner/missing/deleted owner lookup is leak-safe owner-not-found for public compatibility fallback', async () => {
  const helper = await loadOwnerDetailHelper();
  const response = await callOwnerDirect({
    helper,
    executor: ownerExecutor({ row: null }),
  });
  assert.equal(response.status, 404);
  assert.equal(helper.isOwnerTreeDetailPublicFallbackResponse(response), true);
  assert.deepEqual(await response.json(), { detail: 'Tree not found' });
});

test('#4121 owner-not-found route performs only the proven public Modal fallback', () => {
  const routeSource = fs.readFileSync(TREE_DETAIL_ROUTE_PATH, 'utf8');
  const directFallback = routeSource.slice(
    routeSource.indexOf('if (ownerDirectResponse)'),
    routeSource.indexOf('} else {', routeSource.indexOf('if (ownerDirectResponse)')),
  );
  assert.match(directFallback, /\/modal\/trees\/\$\{treeId\}/);
  assert.doesNotMatch(directFallback, /\/modal\/private\/trees/);
  assert.match(routeSource, /isOwnerTreeDetailPublicFallbackResponse\(ownerDirectResponse\)/);
});

test('#4121 owner UUID/path semantics mirror Modal validate_required_uuid', async () => {
  const helper = await loadOwnerDetailHelper();
  const compact = TREE_ID.replace(/-/g, '');
  const braced = `{${TREE_ID.toUpperCase()}}`;
  const urn = `urn:uuid:${TREE_ID.toUpperCase()}`;
  for (const value of [TREE_ID, compact, braced, urn, `  ${TREE_ID.toUpperCase()}  `]) {
    assert.equal(helper.normalizeOwnerTreeDetailId(value), TREE_ID);
  }

  const invalid = await callOwnerDirect({ helper, treeId: 'legacy-tree-string' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { detail: 'Invalid treeId' });

  const blank = await callOwnerDirect({ helper, treeId: '   ' });
  assert.equal(blank.status, 400);
  assert.deepEqual(await blank.json(), { detail: 'treeId is required' });
});

test('#4121 Firebase verification failure remains 401 and never queries owner DB', async () => {
  const helper = await loadOwnerDetailHelper();
  let queryCount = 0;
  const response = await callOwnerDirect({
    helper,
    verifyToken: async () => null,
    executor: async () => {
      queryCount += 1;
      return [];
    },
  });
  assert.equal(response.status, 401);
  assert.equal(queryCount, 0);
  const body = await response.json();
  assert.equal(body.error.code, 'FIREBASE_VERIFICATION_FAILED');
  assert.doesNotMatch(JSON.stringify(body), /verified-firebase-token|firebase-owner-4121/);
});

test('#4121 missing/invalid dedicated DB config fails closed; generic/writer env cannot satisfy it', async () => {
  const helper = await loadOwnerDetailHelper();
  for (const env of [
    { LB_OWNER_TREE_DETAIL_RUNTIME: 'direct_neon' },
    {
      LB_OWNER_TREE_DETAIL_RUNTIME: 'direct_neon',
      DATABASE_URL: NEON_TEST_URL,
      NETLIFY_DATABASE_URL: NEON_TEST_URL,
      LOVE_PLATFORM_DATABASE_WRITER_URL: NEON_TEST_URL,
    },
    {
      LB_OWNER_TREE_DETAIL_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: 'postgresql://user:pass@example.com/not-neon',
    },
  ]) {
    const response = await callOwnerDirect({ helper, env, executor: null });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'config-absent');
    assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  }
});

test('#4121 direct query failure is bounded, sanitized, no-store, and never direct->Modal fallback', async () => {
  const helper = await loadOwnerDetailHelper();
  const response = await callOwnerDirect({
    helper,
    executor: async (text) => {
      if (/information_schema/i.test(text)) {
        return [{ has_social_counts: true, has_like_count: true, has_view_count: true }];
      }
      throw new Error('password=secret postgresql://admin:secret@ep-private.neon.tech/neondb raw SQL');
    },
  });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
  const body = JSON.stringify(await response.json());
  assert.equal(body, JSON.stringify({ detail: 'Internal server error' }));
  assert.doesNotMatch(body, /password|secret|admin|postgresql|neon\.tech|raw SQL/i);
});

test('#4121 owner detail SQL is trusted static SELECT-only, parameterized, owner-scoped, bounded', async () => {
  const helper = await loadOwnerDetailHelper();
  for (const capabilities of [
    { hasSocialCounts: false, hasLikeCount: false, hasViewCount: false },
    { hasSocialCounts: true, hasLikeCount: true, hasViewCount: false },
    { hasSocialCounts: true, hasLikeCount: true, hasViewCount: true },
  ]) {
    const query = helper.buildOwnerTreeDetailSql(capabilities);
    assert.match(query.text, /^\s*SELECT\b/i);
    assert.match(query.text, /WHERE\s+t\.id\s*=\s*\$1/i);
    assert.match(query.text, /AND\s+t\.owner_id\s*=\s*\$2/i);
    assert.match(query.text, /COUNT\(m\.id\)::int\s+AS\s+memory_count/i);
    assert.match(query.text, /LIMIT\s+1/i);
    assert.doesNotMatch(query.text, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
  }
  assert.match(helper.OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL, /^\s*SELECT\b/i);
  assert.doesNotMatch(helper.OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test('#4121 anonymous/public #4115 branch remains independent from owner direct gate', async () => {
  const route = await loadTreeDetailRoute();
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ id: 'legacy-public-id', visibility: 'public' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const response = await route.onRequestGet({
      request: new Request(`${TEST_HOST}/api/trees/legacy-public-id`),
      params: { id: 'legacy-public-id' },
      env: {
        MODAL_BASE_URL,
        LB_OWNER_TREE_DETAIL_RUNTIME: 'direct_neon',
        LOVE_PLATFORM_DATABASE_URL: NEON_TEST_URL,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/modal\/trees\/legacy-public-id$/);
    assert.doesNotMatch(calls[0].url, /private|neon\.tech|googleapis/);
    assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4121 PUT/DELETE remain Modal-backed and owner direct runtime is GET-only', () => {
  const routeSource = fs.readFileSync(TREE_DETAIL_ROUTE_PATH, 'utf8');
  const helperSource = fs.readFileSync(OWNER_DETAIL_HELPER_PATH, 'utf8');
  const putStart = routeSource.indexOf('export async function onRequestPut');
  const deleteStart = routeSource.indexOf('export async function onRequestDelete');
  const putSource = routeSource.slice(putStart, deleteStart);
  const deleteSource = routeSource.slice(deleteStart);

  assert.match(putSource, /\/modal\/private\/trees\/\$\{treeId\}/);
  assert.match(deleteSource, /\/modal\/private\/trees\/\$\{treeId\}/);
  assert.doesNotMatch(putSource, /handleOwnerTreeDetailDirectNeon|LB_OWNER_TREE_DETAIL_RUNTIME/);
  assert.doesNotMatch(deleteSource, /handleOwnerTreeDetailDirectNeon|LB_OWNER_TREE_DETAIL_RUNTIME/);
  assert.match(helperSource, /method:\s*'GET'/);
  assert.doesNotMatch(helperSource, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});
