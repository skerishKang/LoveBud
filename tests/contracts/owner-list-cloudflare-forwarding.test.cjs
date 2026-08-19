// Contract tests for #3944 Cloudflare same-origin forwarding of owner-list
// cursor pagination and #4116 gated owner Tree direct-Neon read parity.
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