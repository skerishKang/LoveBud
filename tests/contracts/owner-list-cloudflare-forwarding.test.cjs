// Contract tests for #3944 Cloudflare same-origin forwarding of owner-list
// cursor pagination, #4116 owner Tree direct-Neon, and #4122 owner Memory parity.
//
// Run: node --test tests/contracts/owner-list-cloudflare-forwarding.test.cjs

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MODAL = "https://modal.example";
const ROOT = path.resolve(__dirname, '..', '..');

function paramsOf(urlString) {
  return Object.fromEntries(new URL(urlString).searchParams.entries());
}

function directEnv(extra = {}) {
  return {
    LB_OWNER_TREES_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: 'postgresql://reader:secret@ep-test.neon.tech/neondb?sslmode=require',
    FIREBASE_PROJECT_ID: 'relovetree',
    ...extra
  };
}

function directRequest(search = '', headers = {}) {
  return new Request(`https://example.test/api/trees${search}`, {
    headers: {
      authorization: 'Bearer opaque-firebase-token',
      'x-lovebud-request-id': 'req-4116-safe',
      ...headers
    }
  });
}

function ownerRow(overrides = {}) {
  return {
    id: 'tree-1',
    owner_id: 'owner-a',
    title: 'Owner Tree',
    visibility: 'private',
    group_name: '  Group A  ',
    keywords: ['one', 'two'],
    created_at: '2026-08-19 03:02:01.123456+00',
    updated_at: '2026-08-19 03:03:01+00',
    memory_count: 2,
    like_count: 4,
    view_count: 9,
    ...overrides
  };
}

function makeExecutor({ rows = [ownerRow()], capabilities = null } = {}) {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values: Array.isArray(values) ? [...values] : values });
    if (text.includes('information_schema.tables')) {
      return [capabilities || {
        has_social_counts: true,
        has_like_count: true,
        has_view_count: true
      }];
    }
    return rows;
  };
  return { executor, calls };
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function signFirebaseToken({ privateKey, kid, projectId, sub, nowSeconds, overrides = {} }) {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT', kid });
  const payload = base64UrlJson({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub,
    iat: nowSeconds - 30,
    exp: nowSeconds + 3600,
    auth_time: nowSeconds - 60,
    ...overrides
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

test("memory collection forwards pagination/cursor/treeId/limit", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const request = new Request(
    "https://example.test/api/memories?treeId=T1&pagination=cursor&cursor=ENC&limit=50"
  );
  const target = memoryProxy.buildMemoryCollectionModalUrl(request, { MODAL_BASE_URL: MODAL });
  assert.ok(target, "target url built");
  const p = paramsOf(target.toString());
  assert.equal(p.treeId, "T1");
  assert.equal(p.pagination, "cursor");
  assert.equal(p.cursor, "ENC");
  assert.equal(p.limit, "50");
});

test("memory collection legacy request does not add pagination/cursor", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const request = new Request("https://example.test/api/memories?treeId=T1&limit=100");
  const target = memoryProxy.buildMemoryCollectionModalUrl(request, { MODAL_BASE_URL: MODAL });
  const p = paramsOf(target.toString());
  assert.equal(p.treeId, "T1");
  assert.equal(p.limit, "100");
  assert.equal(p.pagination, undefined);
  assert.equal(p.cursor, undefined);
});

test("trees route forwards pagination/cursor/limit", async () => {
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request(
    "https://example.test/api/trees?pagination=cursor&cursor=XYZ&limit=75"
  );
  const target = treesProxy.buildPrivateTreesModalUrl(request, { MODAL_BASE_URL: MODAL });
  assert.ok(target, "target url built");
  const p = paramsOf(target.toString());
  assert.equal(p.pagination, "cursor");
  assert.equal(p.cursor, "XYZ");
  assert.equal(p.limit, "75");
});

test("trees route legacy request does not add pagination/cursor", async () => {
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request("https://example.test/api/trees?limit=200");
  const target = treesProxy.buildPrivateTreesModalUrl(request, { MODAL_BASE_URL: MODAL });
  const p = paramsOf(target.toString());
  assert.equal(p.limit, "200");
  assert.equal(p.pagination, undefined);
  assert.equal(p.cursor, undefined);
});

test("builders return null when MODAL_BASE_URL missing", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request("https://example.test/api/trees?pagination=cursor&cursor=Z");
  assert.equal(treesProxy.buildPrivateTreesModalUrl(request, {}), null);
  assert.equal(memoryProxy.buildMemoryCollectionModalUrl(request, {}), null);
});

test('#4116 direct gate is exact and dedicated DB config has no generic fallback', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  assert.equal(direct.isOwnerTreesDirectNeonSelected({}), false);
  assert.equal(direct.isOwnerTreesDirectNeonSelected({ LB_OWNER_TREES_READ_RUNTIME: 'modal' }), false);
  assert.equal(direct.isOwnerTreesDirectNeonSelected({ LB_OWNER_TREES_READ_RUNTIME: 'direct_neon' }), true);
  assert.equal(direct.readOwnerTreesDirectConfig({ DATABASE_URL: directEnv().LOVE_PLATFORM_DATABASE_URL }).configured, false);
  assert.equal(direct.readOwnerTreesDirectConfig({ NETLIFY_DATABASE_URL: directEnv().LOVE_PLATFORM_DATABASE_URL }).configured, false);
  assert.equal(direct.readOwnerTreesDirectConfig(directEnv()).configured, true);
});

test('#4116 verified Firebase legacyOwnerId is the only owner SQL authority and owner sees public/private rows', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  const { executor, calls } = makeExecutor({
    rows: [
      ownerRow({ id: 'tree-private', visibility: 'private', owner_id: 'verified-owner' }),
      ownerRow({ id: 'tree-public', visibility: 'public', owner_id: 'verified-owner' })
    ]
  });
  let verifierToken = null;
  const response = await direct.handleOwnerTreesDirectNeon(
    directRequest('?uid=attacker&limit=2', {
      'x-owner-id': 'attacker-owner',
      'x-user-id': 'attacker-user',
      'x-user-email': 'attacker@example.invalid'
    }),
    directEnv(),
    'req-4116-safe',
    {
      executorOverride: executor,
      verifyTokenOverride: async (token) => {
        verifierToken = token;
        return { uid: 'verified-owner', email: 'ignored@example.invalid' };
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4116-safe');
  assert.equal(verifierToken, 'opaque-firebase-token');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].values[0], 'verified-owner');
  assert.equal(calls[1].values[1], 2);
  assert.match(calls[1].text, /WHERE t\.owner_id = \$1/);
  assert.doesNotMatch(calls[1].text, /visibility\s*=\s*['"]public['"]/i);

  const body = await response.json();
  assert.deepEqual(body.map((item) => item.id), ['tree-private', 'tree-public']);
  assert.deepEqual(body.map((item) => item.visibility), ['private', 'public']);
  assert.equal(body[0].ownerId, 'verified-owner');
  assert.equal(body[0].groupName, 'Group A');
  assert.deepEqual(body[0].keywords, ['one', 'two']);
  assert.equal(body[0].memoryCount, 2);
  assert.equal(body[0].likeCount, 4);
  assert.equal(body[0].viewCount, 9);
  assert.equal(body[0].createdAt, '2026-08-19T03:02:01.123456+00:00');
});

test('#4116 missing/malformed/rejected Firebase auth fails closed and verifier failure is sanitized', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  const { executor } = makeExecutor();
  let verifierCalls = 0;
  const verifier = async () => {
    verifierCalls += 1;
    return { uid: 'owner-a' };
  };

  const missing = await direct.handleOwnerTreesDirectNeon(
    new Request('https://example.test/api/trees'), directEnv(), 'req-missing',
    { executorOverride: executor, verifyTokenOverride: verifier }
  );
  assert.equal(missing.status, 401);

  const malformed = await direct.handleOwnerTreesDirectNeon(
    new Request('https://example.test/api/trees', { headers: { authorization: 'Bearer token extra' } }),
    directEnv(), 'req-malformed',
    { executorOverride: executor, verifyTokenOverride: verifier }
  );
  assert.equal(malformed.status, 401);
  assert.equal(verifierCalls, 0);

  const rejected = await direct.handleOwnerTreesDirectNeon(
    directRequest(), directEnv(), 'req-rejected',
    { executorOverride: executor, verifyTokenOverride: async () => null }
  );
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error.code, 'FIREBASE_VERIFICATION_FAILED');

  const unavailable = await direct.handleOwnerTreesDirectNeon(
    directRequest(), directEnv(), 'req-unavailable',
    {
      executorOverride: executor,
      verifyTokenOverride: async () => {
        throw new Error('PRIVATE firebase-token secret@example.invalid');
      }
    }
  );
  assert.equal(unavailable.status, 503);
  const unavailableText = await unavailable.text();
  assert.match(unavailableText, /FIREBASE_VERIFIER_UNAVAILABLE/);
  assert.doesNotMatch(unavailableText, /PRIVATE|firebase-token|secret@example\.invalid/);
});

test('#4116 direct mode with missing dedicated DB fails closed without executing a query', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  let executorCalls = 0;
  const response = await direct.handleOwnerTreesDirectNeon(
    directRequest(),
    { LB_OWNER_TREES_READ_RUNTIME: 'direct_neon' },
    'req-config',
    {
      verifyTokenOverride: async () => ({ uid: 'owner-a' }),
      executorOverride: null
    }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(executorCalls, 0);
});

test('#4116 limit/default/min/max and legacy ordering match Modal owner list', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  assert.equal(direct.normalizeOwnerTreeLimit(null), 100);
  assert.equal(direct.normalizeOwnerTreeLimit('0'), 100);
  assert.equal(direct.normalizeOwnerTreeLimit('-5'), 1);
  assert.equal(direct.normalizeOwnerTreeLimit('999'), 200);

  for (const [search, expected] of [['', 100], ['?limit=-5', 1], ['?limit=999', 200]]) {
    const fixture = makeExecutor({ rows: [] });
    const response = await direct.handleOwnerTreesDirectNeon(
      directRequest(search), directEnv(), 'req-limit',
      { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
    );
    assert.equal(response.status, 200);
    assert.equal(fixture.calls[1].values.at(-1), expected);
    assert.match(fixture.calls[1].text, /ORDER BY t\.created_at DESC\s+LIMIT \$2;/);
    assert.doesNotMatch(fixture.calls[1].text, /t\.id DESC/);
  }
});

test('#4116 fractional finite limit preserves FastAPI integer validation and avoids auth/DB work', async () => {
  const treesRoute = await import('../../functions/api/trees.js');
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fractional limit must fail before Firebase metadata or DB work');
  };
  try {
    const response = await treesRoute.onRequestGet({
      request: directRequest('?limit=1.5'),
      env: directEnv()
    });
    assert.equal(response.status, 422);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('x-lovebud-route-status'), 'invalid-limit');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4116-safe');
    assert.deepEqual(await response.json(), {
      detail: [{
        type: 'int_parsing',
        loc: ['query', 'limit'],
        msg: 'Input should be a valid integer, unable to parse string as an integer',
        input: '1.5'
      }]
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4116 cursor mode preserves keyset predicate, created_at/id ordering, limit+1, and nextCursor', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  const firstFixture = makeExecutor({
    rows: [
      ownerRow({ id: 'tree-c', created_at: '2026-08-19 03:00:03+00' }),
      ownerRow({ id: 'tree-b', created_at: '2026-08-19 03:00:02+00' }),
      ownerRow({ id: 'tree-a', created_at: '2026-08-19 03:00:01+00' })
    ]
  });
  const first = await direct.handleOwnerTreesDirectNeon(
    directRequest('?pagination=cursor&cursor=&limit=2'), directEnv(), 'req-page-1',
    { executorOverride: firstFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(first.status, 200);
  assert.match(firstFixture.calls[1].text, /ORDER BY t\.created_at DESC, t\.id DESC/);
  assert.equal(firstFixture.calls[1].values.at(-1), 3);
  const firstBody = await first.json();
  assert.deepEqual(firstBody.items.map((item) => item.id), ['tree-c', 'tree-b']);
  assert.ok(firstBody.nextCursor);
  const decoded = direct.decodeOwnerTreeCursor(firstBody.nextCursor);
  assert.deepEqual(decoded, {
    createdAt: '2026-08-19T03:00:02+00:00',
    id: 'tree-b'
  });

  const secondFixture = makeExecutor({ rows: [] });
  const second = await direct.handleOwnerTreesDirectNeon(
    directRequest(`?pagination=cursor&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`),
    directEnv(), 'req-page-2',
    { executorOverride: secondFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(second.status, 200);
  assert.match(secondFixture.calls[1].text, /t\.created_at < \$2/);
  assert.match(secondFixture.calls[1].text, /t\.created_at = \$2 AND t\.id < \$3/);
  assert.deepEqual(secondFixture.calls[1].values, [
    'owner-a',
    '2026-08-19T03:00:02+00:00',
    'tree-b',
    3
  ]);
  assert.deepEqual(await second.json(), { items: [], nextCursor: null });
});

test('#4116 malformed cursor is rejected before any DB query', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  let queryCalls = 0;
  const response = await direct.handleOwnerTreesDirectNeon(
    directRequest('?pagination=cursor&cursor=not-base64-json'), directEnv(), 'req-bad-cursor',
    {
      executorOverride: async () => { queryCalls += 1; return []; },
      verifyTokenOverride: async () => ({ uid: 'owner-a' })
    }
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { detail: 'Invalid pagination cursor' });
  assert.equal(queryCalls, 0);
});

test('#4116 social-count DTO fields are additive only when canonical columns exist', async () => {
  const direct = await import('../../functions/_shared/owner-tree-list-direct-neon.js');
  const fixture = makeExecutor({
    capabilities: {
      has_social_counts: false,
      has_like_count: false,
      has_view_count: false
    },
    rows: [ownerRow()]
  });
  const response = await direct.handleOwnerTreesDirectNeon(
    directRequest(), directEnv(), 'req-social',
    { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  const body = await response.json();
  assert.equal(Object.hasOwn(body[0], 'likeCount'), false);
  assert.equal(Object.hasOwn(body[0], 'viewCount'), false);
  assert.doesNotMatch(fixture.calls[1].text, /tree_social_counts s/);
});

test('#4116 native Firebase verifier validates RS256 signature and canonical Firebase claims without provider SDK', async () => {
  const verifierModule = await import('../../functions/_shared/firebase-id-token-verifier.js');
  verifierModule.clearFirebaseJwkCacheForTests();

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'firebase-test-kid';
  const projectId = 'relovetree';
  const nowSeconds = 1_786_000_000;
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  let fetchCalls = 0;

  const verifier = verifierModule.createFirebaseIdTokenVerifier({
    projectId,
    now: () => nowSeconds * 1000,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=600'
        }
      });
    }
  });

  const token = await signFirebaseToken({ privateKey, kid, projectId, sub: 'verified-firebase-uid', nowSeconds });
  assert.deepEqual(await verifier(token), { uid: 'verified-firebase-uid' });
  assert.deepEqual(await verifier(token), { uid: 'verified-firebase-uid' });
  assert.equal(fetchCalls, 1, 'JWK metadata must be cached');

  const wrongAudience = await signFirebaseToken({
    privateKey, kid, projectId, sub: 'verified-firebase-uid', nowSeconds,
    overrides: { aud: 'other-project' }
  });
  assert.equal(await verifier(wrongAudience), null);

  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(await verifier(tampered), null);
});

test('#4116 GET routing adds direct branch only while POST remains Modal-backed under the read gate', async () => {
  const treeSource = fs.readFileSync(path.join(ROOT, 'functions/api/trees.js'), 'utf8');
  const directSource = fs.readFileSync(path.join(ROOT, 'functions/_shared/owner-tree-list-direct-neon.js'), 'utf8');
  const verifierSource = fs.readFileSync(path.join(ROOT, 'functions/_shared/firebase-id-token-verifier.js'), 'utf8');

  const getStart = treeSource.indexOf('export async function onRequestGet');
  const postStart = treeSource.indexOf('export async function onRequestPost');
  assert.ok(getStart >= 0 && postStart > getStart);
  const getBlock = treeSource.slice(getStart, postStart);
  const postBlock = treeSource.slice(postStart);

  assert.match(getBlock, /isOwnerTreesDirectNeonSelected\(context\.env\)/);
  assert.match(getBlock, /handleOwnerTreesDirectNeon\(request, context\.env, requestId\)/);
  assert.match(getBlock, /fetchModalWithTimeout/);
  assert.doesNotMatch(postBlock, /handleOwnerTreesDirectNeon|isOwnerTreesDirectNeonSelected|LOVE_PLATFORM_DATABASE_URL/);
  assert.match(postBlock, /\/modal\/private\/trees/);

  const productionSource = `${directSource}\n${verifierSource}`;
  for (const forbidden of [
    'INSERT INTO',
    'UPDATE trees',
    'DELETE FROM',
    'BEGIN;',
    'COMMIT;',
    'ROLLBACK;',
    'NETLIFY_DATABASE_URL',
    "env.DATABASE_URL",
    'privateStorageEnabled',
    'Firestore',
    'neon_auth',
    'app_account'
  ]) {
    assert.equal(productionSource.includes(forbidden), false, forbidden);
  }
  assert.match(directSource, /LOVE_PLATFORM_DATABASE_URL/);
  assert.match(directSource, /WHERE t\.owner_id = \$1/);
  assert.match(verifierSource, /RS256/);
});

// ---------------------------------------------------------------------------
// #4122 authenticated owner Memory collection direct-Neon parity
// ---------------------------------------------------------------------------

const OWNER_MEMORY_TREE_ID = '11111111-1111-4111-8111-111111111111';

function ownerMemoryEnv(extra = {}) {
  return {
    LB_OWNER_MEMORIES_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: 'postgresql://reader:secret@ep-memory-list-test.neon.tech/neondb?sslmode=require',
    FIREBASE_PROJECT_ID: 'relovetree',
    ...extra
  };
}

function ownerMemoryRequest(search = '', headers = {}) {
  return new Request(`https://example.test/api/memories${search}`, {
    headers: {
      authorization: 'Bearer opaque-firebase-token',
      'x-lovebud-request-id': 'req-4122-safe',
      ...headers
    }
  });
}

function ownerMemoryRow(overrides = {}) {
  return {
    id: 'memory-1',
    tree_id: OWNER_MEMORY_TREE_ID,
    parent_id: null,
    title: 'Owner Memory',
    memo: 'memo',
    artist: 'artist',
    source: 'youtube',
    source_url: 'https://example.invalid/watch?v=1',
    source_type: 'youtube',
    thumbnail: 'https://example.invalid/thumb.jpg',
    emotion_tags: ['joy', 'calm'],
    timestamp: '00:42',
    visibility: 'private',
    channel_id: 'channel-1',
    channel_name: 'Channel',
    channel_url: 'https://example.invalid/channel/1',
    created_at: '2026-08-19 04:00:01.123456+00',
    updated_at: '2026-08-19 04:01:01+00',
    ...overrides
  };
}

function makeOwnerMemoryExecutor({ rows = [ownerMemoryRow()], hasClientKey = false, dataError = null } = {}) {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values: Array.isArray(values) ? [...values] : values });
    if (text.includes('information_schema.columns')) {
      return [{ has_client_key: hasClientKey }];
    }
    if (dataError) throw dataError;
    return rows;
  };
  return { executor, calls };
}

test('#4122 absent/unknown owner Memory gate keeps existing Modal collection authority', async () => {
  const memoriesRoute = await import('../../functions/api/memories.js');
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    for (const env of [
      { MODAL_BASE_URL: MODAL },
      { MODAL_BASE_URL: MODAL, LB_OWNER_MEMORIES_READ_RUNTIME: 'future-runtime' }
    ]) {
      const response = await memoriesRoute.onRequestGet({
        request: ownerMemoryRequest('?limit=50'),
        env
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    }
    assert.equal(calls.length, 2);
    for (const call of calls) {
      const target = new URL(call.url);
      assert.equal(target.pathname, '/modal/private/memories');
      assert.equal(target.searchParams.get('limit'), '50');
      assert.equal(call.options.headers.authorization, 'Bearer opaque-firebase-token');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4122 direct gate/dedicated DB boundary is exact and generic DB envs are rejected', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  assert.equal(direct.isOwnerMemoriesDirectNeonSelected({}), false);
  assert.equal(direct.isOwnerMemoriesDirectNeonSelected({ LB_OWNER_MEMORIES_READ_RUNTIME: 'modal' }), false);
  assert.equal(direct.isOwnerMemoriesDirectNeonSelected({ LB_OWNER_MEMORIES_READ_RUNTIME: 'direct_neon' }), true);
  assert.equal(direct.readOwnerMemoriesDirectConfig({ DATABASE_URL: ownerMemoryEnv().LOVE_PLATFORM_DATABASE_URL }).configured, false);
  assert.equal(direct.readOwnerMemoriesDirectConfig({ NETLIFY_DATABASE_URL: ownerMemoryEnv().LOVE_PLATFORM_DATABASE_URL }).configured, false);
  assert.equal(direct.readOwnerMemoriesDirectConfig(ownerMemoryEnv()).configured, true);
});

test('#4122 verified Firebase principal.legacyOwnerId is the only owner SQL authority', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const fixture = makeOwnerMemoryExecutor({ rows: [ownerMemoryRow({ visibility: 'private' }), ownerMemoryRow({ id: 'memory-public', visibility: 'public' })] });
  let verifiedToken = null;
  const response = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest('?uid=attacker&limit=2', {
      'x-owner-id': 'attacker-owner',
      'x-user-id': 'attacker-user',
      'x-user-email': 'attacker@example.invalid'
    }),
    ownerMemoryEnv(),
    'req-4122-safe',
    {
      executorOverride: fixture.executor,
      verifyTokenOverride: async (token) => {
        verifiedToken = token;
        return { uid: 'verified-owner', email: 'ignored@example.invalid' };
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4122-safe');
  assert.equal(verifiedToken, 'opaque-firebase-token');
  assert.equal(fixture.calls.length, 2);
  assert.deepEqual(fixture.calls[1].values, ['verified-owner', 2]);
  assert.match(fixture.calls[1].text, /INNER JOIN trees t[\s\S]*WHERE t\.owner_id = \$1/);
  assert.doesNotMatch(fixture.calls[1].text, /owner_id\s*=\s*['"]/i);
  assert.doesNotMatch(fixture.calls[1].text, /visibility\s*=\s*['"]public['"]/i);
  const body = await response.json();
  assert.deepEqual(body.map((item) => item.visibility), ['private', 'public']);
});

test('#4122 missing/malformed/rejected Firebase auth and verifier failure fail closed', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const fixture = makeOwnerMemoryExecutor();
  let verifierCalls = 0;
  const verifier = async () => {
    verifierCalls += 1;
    return { uid: 'owner-a' };
  };

  const missing = await direct.handleOwnerMemoriesDirectNeon(
    new Request('https://example.test/api/memories'), ownerMemoryEnv(), 'req-missing',
    { executorOverride: fixture.executor, verifyTokenOverride: verifier }
  );
  assert.equal(missing.status, 401);

  const malformed = await direct.handleOwnerMemoriesDirectNeon(
    new Request('https://example.test/api/memories', { headers: { authorization: 'Bearer token extra' } }),
    ownerMemoryEnv(), 'req-malformed',
    { executorOverride: fixture.executor, verifyTokenOverride: verifier }
  );
  assert.equal(malformed.status, 401);
  assert.equal(verifierCalls, 0);

  const rejected = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(), ownerMemoryEnv(), 'req-rejected',
    { executorOverride: fixture.executor, verifyTokenOverride: async () => null }
  );
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error.code, 'FIREBASE_VERIFICATION_FAILED');

  const unavailable = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(), ownerMemoryEnv(), 'req-unavailable',
    {
      executorOverride: fixture.executor,
      verifyTokenOverride: async () => { throw new Error('PRIVATE token secret@example.invalid'); }
    }
  );
  assert.equal(unavailable.status, 503);
  const text = await unavailable.text();
  assert.match(text, /FIREBASE_VERIFIER_UNAVAILABLE/);
  assert.doesNotMatch(text, /PRIVATE|token secret|secret@example\.invalid/);
});

test('#4122 explicit direct mode with missing/invalid dedicated DB config fails closed', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  for (const env of [
    { LB_OWNER_MEMORIES_READ_RUNTIME: 'direct_neon' },
    { LB_OWNER_MEMORIES_READ_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: 'postgresql://reader@not-neon.example/db' },
    { LB_OWNER_MEMORIES_READ_RUNTIME: 'direct_neon', DATABASE_URL: ownerMemoryEnv().LOVE_PLATFORM_DATABASE_URL }
  ]) {
    const response = await direct.handleOwnerMemoriesDirectNeon(
      ownerMemoryRequest(), env, 'req-config',
      { verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  }
});

test('#4122 optional treeId preserves UUID validation/canonicalization and owner-scoped filtering', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const compactUuid = OWNER_MEMORY_TREE_ID.replace(/-/g, '');
  const fixture = makeOwnerMemoryExecutor({ rows: [] });
  const response = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(`?treeId=${compactUuid}&limit=10`), ownerMemoryEnv(), 'req-tree',
    { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.deepEqual(fixture.calls[1].values, ['owner-a', OWNER_MEMORY_TREE_ID, 10]);
  assert.match(fixture.calls[1].text, /WHERE t\.owner_id = \$1[\s\S]*AND m\.tree_id = \$2/);

  const invalidFixture = makeOwnerMemoryExecutor();
  const invalid = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest('?treeId=not-a-uuid'), ownerMemoryEnv(), 'req-invalid-tree',
    { executorOverride: invalidFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { detail: 'Invalid treeId' });
  assert.equal(invalidFixture.calls.length, 0);

  const authFirst = await direct.handleOwnerMemoriesDirectNeon(
    new Request('https://example.test/api/memories?treeId=not-a-uuid'), ownerMemoryEnv(), 'req-auth-first',
    { executorOverride: invalidFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(authFirst.status, 401, 'owner auth must precede optional treeId validation');
});

test('#4122 limit default/clamp/nonnumeric and raw-array ordering match current Edge->FastAPI behavior', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  assert.equal(direct.normalizeOwnerMemoryLimit(null), 100);
  assert.equal(direct.normalizeOwnerMemoryLimit(''), 100);
  assert.equal(direct.normalizeOwnerMemoryLimit('0'), 100);
  assert.equal(direct.normalizeOwnerMemoryLimit('nonnumeric'), 100);
  assert.equal(direct.normalizeOwnerMemoryLimit('-5'), 1);
  assert.equal(direct.normalizeOwnerMemoryLimit('999'), 200);
  assert.equal(direct.normalizeOwnerMemoryLimit('0.5'), 1);
  assert.equal(direct.normalizeOwnerMemoryLimit('200.5'), 200);

  for (const [search, expected] of [
    ['', 100], ['?limit=0', 100], ['?limit=nonnumeric', 100], ['?limit=-5', 1], ['?limit=999', 200]
  ]) {
    const fixture = makeOwnerMemoryExecutor({ rows: [] });
    const response = await direct.handleOwnerMemoriesDirectNeon(
      ownerMemoryRequest(search), ownerMemoryEnv(), 'req-limit',
      { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
    );
    assert.equal(response.status, 200);
    assert.equal(fixture.calls[1].values.at(-1), expected);
    assert.match(fixture.calls[1].text, /ORDER BY m\.created_at DESC\s+LIMIT \$2;/);
    assert.doesNotMatch(fixture.calls[1].text, /m\.id DESC/);
    assert.deepEqual(await response.json(), []);
  }
});

test('#4122 surviving fractional limit preserves FastAPI 422 before Firebase/DB work', async () => {
  const memoriesRoute = await import('../../functions/api/memories.js');
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fractional limit must fail before auth/provider/DB work');
  };
  try {
    const response = await memoriesRoute.onRequestGet({
      request: ownerMemoryRequest('?limit=1.5'),
      env: ownerMemoryEnv()
    });
    assert.equal(response.status, 422);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('x-lovebud-route-status'), 'invalid-limit');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4122-safe');
    assert.deepEqual(await response.json(), {
      detail: [{
        type: 'int_parsing',
        loc: ['query', 'limit'],
        msg: 'Input should be a valid integer, unable to parse string as an integer',
        input: '1.5'
      }]
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4122 raw-array DTO preserves fields/types and capability-safe clientKey projection', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const withKey = makeOwnerMemoryExecutor({
    hasClientKey: true,
    rows: [ownerMemoryRow({ client_key: 'client-key-1' }), ownerMemoryRow({ id: 'memory-2', client_key: null })]
  });
  const response = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest('?limit=2'), ownerMemoryEnv(), 'req-dto',
    { executorOverride: withKey.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(response.status, 200);
  assert.match(withKey.calls[1].text, /m\.client_key/);
  const body = await response.json();
  assert.equal(Array.isArray(body), true);
  assert.deepEqual(Object.keys(body[0]), [
    'id', 'treeId', 'parentId', 'title', 'memo', 'artist', 'source', 'sourceUrl',
    'sourceType', 'thumbnail', 'emotionTags', 'timestamp', 'visibility', 'channelId',
    'channelName', 'channelUrl', 'createdAt', 'updatedAt', 'clientKey'
  ]);
  assert.equal(body[0].clientKey, 'client-key-1');
  assert.equal(Object.hasOwn(body[1], 'clientKey'), false, 'NULL client_key must not fabricate clientKey');
  assert.equal(body[0].createdAt, '2026-08-19T04:00:01.123456+00:00');
  assert.equal(body[0].updatedAt, '2026-08-19T04:01:01+00:00');
  assert.deepEqual(body[0].emotionTags, ['joy', 'calm']);

  const withoutKey = makeOwnerMemoryExecutor({ hasClientKey: false, rows: [ownerMemoryRow()] });
  const noKeyResponse = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(), ownerMemoryEnv(), 'req-no-key',
    { executorOverride: withoutKey.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  const noKeyBody = await noKeyResponse.json();
  assert.equal(Object.hasOwn(noKeyBody[0], 'clientKey'), false);
  assert.doesNotMatch(withoutKey.calls[1].text, /m\.client_key/);
});

test('#4122 cursor mode preserves tree binding, keyset order, limit+1, continuation and terminal shape', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const firstFixture = makeOwnerMemoryExecutor({
    rows: [
      ownerMemoryRow({ id: 'memory-c', created_at: '2026-08-19 04:00:03+00' }),
      ownerMemoryRow({ id: 'memory-b', created_at: '2026-08-19 04:00:02+00' }),
      ownerMemoryRow({ id: 'memory-a', created_at: '2026-08-19 04:00:01+00' })
    ]
  });
  const first = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(`?treeId=${OWNER_MEMORY_TREE_ID}&pagination=cursor&cursor=&limit=2`),
    ownerMemoryEnv(), 'req-page-1',
    { executorOverride: firstFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(first.status, 200);
  assert.match(firstFixture.calls[1].text, /ORDER BY m\.created_at DESC, m\.id DESC/);
  assert.deepEqual(firstFixture.calls[1].values, ['owner-a', OWNER_MEMORY_TREE_ID, 3]);
  const firstBody = await first.json();
  assert.deepEqual(firstBody.items.map((item) => item.id), ['memory-c', 'memory-b']);
  assert.ok(firstBody.nextCursor);
  assert.deepEqual(direct.decodeOwnerMemoryCursor(firstBody.nextCursor), {
    createdAt: '2026-08-19T04:00:02+00:00',
    id: 'memory-b',
    treeId: OWNER_MEMORY_TREE_ID
  });

  const secondFixture = makeOwnerMemoryExecutor({ rows: [] });
  const second = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest(`?treeId=${OWNER_MEMORY_TREE_ID}&pagination=cursor&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`),
    ownerMemoryEnv(), 'req-page-2',
    { executorOverride: secondFixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(second.status, 200);
  assert.match(secondFixture.calls[1].text, /m\.created_at < \$3/);
  assert.match(secondFixture.calls[1].text, /m\.created_at = \$4 AND m\.id < \$5/);
  assert.deepEqual(secondFixture.calls[1].values, [
    'owner-a', OWNER_MEMORY_TREE_ID,
    '2026-08-19T04:00:02+00:00', '2026-08-19T04:00:02+00:00', 'memory-b', 3
  ]);
  assert.deepEqual(await second.json(), { items: [], nextCursor: null });
});

test('#4122 cursor scope mismatch/malformed cursor fail before any DB capability or data query', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const treeCursor = direct.encodeOwnerMemoryCursor('2026-08-19T04:00:02+00:00', 'memory-b', OWNER_MEMORY_TREE_ID);
  for (const search of [
    `?pagination=cursor&cursor=${encodeURIComponent(treeCursor)}`,
    `?treeId=22222222-2222-4222-8222-222222222222&pagination=cursor&cursor=${encodeURIComponent(treeCursor)}`,
    '?pagination=cursor&cursor=not-base64-json'
  ]) {
    let queryCalls = 0;
    const response = await direct.handleOwnerMemoriesDirectNeon(
      ownerMemoryRequest(search), ownerMemoryEnv(), 'req-bad-cursor',
      {
        executorOverride: async () => { queryCalls += 1; return []; },
        verifyTokenOverride: async () => ({ uid: 'owner-a' })
      }
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { detail: 'Invalid pagination cursor' });
    assert.equal(queryCalls, 0);
  }
});

test('#4122 unscoped cursor mode and empty-page behavior remain additive to legacy raw arrays', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const fixture = makeOwnerMemoryExecutor({ rows: [] });
  const response = await direct.handleOwnerMemoriesDirectNeon(
    ownerMemoryRequest('?pagination=cursor&limit=100'), ownerMemoryEnv(), 'req-empty',
    { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [], nextCursor: null });
  assert.deepEqual(fixture.calls[1].values, ['owner-a', 101]);
  assert.match(fixture.calls[1].text, /ORDER BY m\.created_at DESC, m\.id DESC/);
});

test('#4122 current owner Memory schema authority has no legacy payload fallback; 42P01/42703 stay sanitized', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  for (const code of ['42P01', '42703']) {
    const error = new Error(`PRIVATE ${code} schema detail secret@example.invalid`);
    error.code = code;
    const fixture = makeOwnerMemoryExecutor({ dataError: error });
    const response = await direct.handleOwnerMemoriesDirectNeon(
      ownerMemoryRequest(), ownerMemoryEnv(), `req-${code}`,
      { executorOverride: fixture.executor, verifyTokenOverride: async () => ({ uid: 'owner-a' }) }
    );
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
    const body = await response.text();
    assert.equal(body, JSON.stringify({ detail: 'Internal server error' }));
    assert.doesNotMatch(body, /PRIVATE|42P01|42703|secret@example\.invalid/);
    assert.equal(fixture.calls.length, 2, 'capability read plus one owner query only; no fallback query');
    assert.equal(fixture.calls.some((call) => /payload/i.test(call.text)), false);
  }
});

test('#4122 SQL is parameterized SELECT-only and POST remains exclusively Modal-backed', async () => {
  const direct = await import('../../functions/_shared/owner-memory-list-direct-neon.js');
  const memoriesRoute = await import('../../functions/api/memories.js');
  const routeSource = fs.readFileSync(path.join(ROOT, 'functions/api/memories.js'), 'utf8');
  const directSource = fs.readFileSync(path.join(ROOT, 'functions/_shared/owner-memory-list-direct-neon.js'), 'utf8');

  const sqlVariants = [
    direct.OWNER_MEMORY_CAPABILITY_SQL,
    direct.buildOwnerMemoryListSql({}).text,
    direct.buildOwnerMemoryListSql({ hasClientKey: true, treeId: OWNER_MEMORY_TREE_ID }).text,
    direct.buildOwnerMemoryListSql({ cursorMode: true, cursor: { createdAt: '2026-08-19T04:00:00+00:00', id: 'm1', treeId: null } }).text
  ];
  for (const sql of sqlVariants) {
    assert.match(sql, /^\s*SELECT\b/i);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  }
  assert.match(sqlVariants[1], /WHERE t\.owner_id = \$1/);
  assert.doesNotMatch(directSource, /NETLIFY_DATABASE_URL|env\.DATABASE_URL|neon_auth|app_account/);
  assert.match(directSource, /LOVE_PLATFORM_DATABASE_URL/);

  const getStart = routeSource.indexOf('export async function onRequestGet');
  const postStart = routeSource.indexOf('export async function onRequestPost');
  assert.ok(getStart >= 0 && postStart > getStart);
  const getBlock = routeSource.slice(getStart, postStart);
  const postBlock = routeSource.slice(postStart);
  assert.match(getBlock, /isOwnerMemoriesDirectNeonSelected\(env\)/);
  assert.match(getBlock, /handleOwnerMemoriesDirectNeon\(request, env \|\| \{\}, requestId\)/);
  assert.doesNotMatch(postBlock, /handleOwnerMemoriesDirectNeon|isOwnerMemoriesDirectNeonSelected|LOVE_PLATFORM_DATABASE_URL/);
  assert.match(postBlock, /proxyMemoryRouteRequest\(context\)/);

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: 'created-memory' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const postResponse = await memoriesRoute.onRequestPost({
      request: new Request('https://example.test/api/memories', {
        method: 'POST',
        headers: {
          authorization: 'Bearer opaque-firebase-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ title: 'Moment', memo: 'memo' })
      }),
      env: { ...ownerMemoryEnv(), MODAL_BASE_URL: MODAL }
    });
    assert.equal(postResponse.status, 200);
    assert.equal(postResponse.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, '/modal/private/memories');
    assert.equal(calls[0].options.method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
