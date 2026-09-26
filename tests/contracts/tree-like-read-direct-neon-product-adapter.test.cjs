'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const TREE_ID = '44940000-0000-4000-8000-000000000001';
const ACTOR_ID = 'firebase-owner-4494';
const READ_DB = 'postgresql://reader@ep-tree-like-read-4494.us-east-1.neon.tech/neondb?sslmode=require';
const URL = `https://lovebud.pages.dev/api/trees/${TREE_ID}/likes`;

function request({ treeId = TREE_ID, auth = 'Bearer tree-like-read-4494' } = {}) {
  const headers = new Headers({ 'x-lovebud-request-id': 'req-tree-like-read-4494' });
  if (auth) headers.set('authorization', auth);
  return new Request(`https://lovebud.pages.dev/api/trees/${treeId}/likes`, {
    method: 'GET',
    headers
  });
}

function env(extra = {}) {
  return {
    LB_TREE_LIKE_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: READ_DB,
    ...extra
  };
}

async function load() {
  return import('../../functions/_shared/tree-like-read-direct-neon.js');
}

test('1. #4494 read gate is independent, read-authority-only, and source-only', async () => {
  const mod = await load();
  assert.equal(mod.isTreeLikeReadDirectNeonSelected({}), false);
  assert.equal(mod.isTreeLikeReadDirectNeonSelected({ LB_TREE_LIKE_READ_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeLikeReadDirectNeonSelected({ LB_TREE_LIKE_READ_RUNTIME: 'future' }), false);
  assert.equal(mod.isTreeLikeReadDirectNeonSelected({ LB_TREE_LIKE_READ_RUNTIME: ' direct_neon ' }), true);

  const c = mod.TREE_LIKE_READ_DIRECT_NEON_CONTRACT;
  assert.equal(c.method, 'GET');
  assert.equal(c.path, '/api/trees/:id/likes');
  assert.equal(c.gateEnv, 'LB_TREE_LIKE_READ_RUNTIME');
  assert.equal(c.databaseEnv, 'LOVE_PLATFORM_DATABASE_URL');
  assert.equal(c.writes, false);
  assert.equal(c.productionAclAuthorized, false);
  assert.equal(c.productionGateActivationAuthorized, false);
  assert.equal(c.providerMutationAuthorized, false);
  assert.equal(c.rawLogBodyReadAuthorized, false);
  assert.equal(c.perRequestModalFallbackAfterDirectStart, false);
  assert.deepEqual(c.requiredObjects, {
    trees: ['SELECT'],
    tree_likes: ['SELECT'],
    tree_social_counts: ['SELECT']
  });
});

test('2. public Tree returns Modal-visible parity using one SELECT-only query', async () => {
  const mod = await load();
  const calls = [];
  let verifiedToken = null;
  const response = await mod.handleTreeLikeReadDirectNeon(
    request(),
    env(),
    'req-tree-like-read-4494',
    {
      verifyTokenOverride: async (token) => {
        verifiedToken = token;
        return { uid: ACTOR_ID };
      },
      executorOverride: async (text, values) => {
        calls.push({ text, values });
        return [{ tree_id: TREE_ID, active: true, like_count: 7 }];
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(verifiedToken, 'tree-like-read-4494');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, [TREE_ID, ACTOR_ID]);
  assert.match(calls[0].text, /FROM trees/i);
  assert.match(calls[0].text, /FROM tree_likes/i);
  assert.match(calls[0].text, /LEFT JOIN tree_social_counts/i);
  assert.match(calls[0].text, /visibility = 'public'/i);
  assert.doesNotMatch(calls[0].text, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCOMMIT\b|\bBEGIN\b/i);
  assert.deepEqual(await response.json(), { treeId: TREE_ID, active: true, likeCount: 7 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
});

test('3. missing aggregate is represented as likeCount zero without a write', async () => {
  const mod = await load();
  const calls = [];
  const response = await mod.handleTreeLikeReadDirectNeon(
    request(), env(), 'req-zero-4494',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID }),
      executorOverride: async (text) => {
        calls.push(text);
        return [{ tree_id: TREE_ID, active: false, like_count: 0 }];
      }
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { treeId: TREE_ID, active: false, likeCount: 0 });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
});

test('4. missing/private Tree remains hidden as 404', async () => {
  const mod = await load();
  const response = await mod.handleTreeLikeReadDirectNeon(
    request(), env(), 'req-not-found-4494',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID }),
      executorOverride: async () => []
    }
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Tree not found' });
});

test('5. invalid UUID fails after auth and before DB executor work', async () => {
  const mod = await load();
  let verified = 0;
  let executed = 0;
  const response = await mod.handleTreeLikeReadDirectNeon(
    request({ treeId: 'not-a-uuid' }), env(), 'req-invalid-4494',
    {
      verifyTokenOverride: async () => {
        verified += 1;
        return { uid: ACTOR_ID };
      },
      executorOverride: async () => {
        executed += 1;
        return [];
      }
    }
  );
  assert.equal(response.status, 400);
  assert.equal(verified, 1);
  assert.equal(executed, 0);
});

test('6. missing authorization is rejected before read capability', async () => {
  const mod = await load();
  let executed = 0;
  const response = await mod.handleTreeLikeReadDirectNeon(
    request({ auth: null }), env(), 'req-auth-4494',
    {
      verifyTokenOverride: async () => {
        throw new Error('verifyToken must not receive an absent token');
      },
      executorOverride: async () => {
        executed += 1;
        return [];
      }
    }
  );
  assert.equal(response.status, 401);
  assert.equal(executed, 0);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
});

test('7. absent read config fails closed and does not fall back to writer/generic legacy envs', async () => {
  const mod = await load();
  const response = await mod.handleTreeLikeReadDirectNeon(
    request(),
    {
      LB_TREE_LIKE_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: READ_DB,
      DATABASE_URL: READ_DB,
      NETLIFY_DATABASE_URL: READ_DB
    },
    'req-config-4494',
    { verifyTokenOverride: async () => ({ uid: ACTOR_ID }) }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('8. query errors are sanitized', async () => {
  const mod = await load();
  const response = await mod.handleTreeLikeReadDirectNeon(
    request(), env(), 'req-query-4494',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID }),
      executorOverride: async () => {
        throw new Error('private query sentinel postgresql://secret');
      }
    }
  );
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.match(text, /DIRECT_NEON_QUERY_FAILED/);
  assert.doesNotMatch(text, /private query sentinel|postgresql:\/\/secret|tree-like-read-4494/);
});

test('9. route gates GET independently and preserves existing POST writer path', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'functions', 'api', 'trees', '[tree_id]', 'likes.js'),
    'utf8'
  );
  assert.match(source, /isTreeLikeReadDirectNeonSelected/);
  assert.match(source, /handleTreeLikeReadDirectNeon/);
  assert.match(source, /isTreeLikeDirectNeonSelected/);
  assert.match(source, /handleTreeLikeDirectNeon/);
  assert.match(source, /export async function onRequestGet/);
  assert.match(source, /export async function onRequestPost/);
  assert.match(source, /\/modal\/private\/trees\/\$\{treeId\}\/likes/);
});

test('10. unset read gate still uses Modal GET path', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/likes.js');
  const response = await route.onRequestGet({
    request: new Request(URL, {
      method: 'GET',
      headers: { authorization: 'Bearer token' }
    }),
    env: { MODAL_BASE_URL: '' }
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
});
