// Contract tests for #4423 residual Memory social GET direct-Neon source candidates.
//
// Source phase only: no Production gate check-in, no Product canary.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TREE_ID = '33333333-3333-4333-8333-333333333333';

function authRequest(pathname, query = '') {
  return new Request(`https://example.test${pathname}${query}`, {
    headers: { authorization: 'Bearer opaque-firebase-token' }
  });
}

function publicRequest(pathname, query = '') {
  return new Request(`https://example.test${pathname}${query}`);
}

function authEnv(gate, extra = {}) {
  return { [gate]: 'direct_neon', FIREBASE_PROJECT_ID: 'relovetree', ...extra };
}

function publicEnv(gate, extra = {}) {
  return { [gate]: 'direct_neon', ...extra };
}

test('#4423 four read gates are exact and remain absent from Production wrangler vars', async () => {
  const cases = [
    ['memory-auth-reaction-read-direct-neon.js', 'isMemoryAuthReactionReadDirectNeonSelected', 'LB_MEMORY_AUTH_REACTION_READ_RUNTIME'],
    ['memory-auth-comment-read-direct-neon.js', 'isMemoryAuthCommentReadDirectNeonSelected', 'LB_MEMORY_AUTH_COMMENT_READ_RUNTIME'],
    ['memory-public-reaction-read-direct-neon.js', 'isMemoryPublicReactionReadDirectNeonSelected', 'LB_MEMORY_PUBLIC_REACTION_READ_RUNTIME'],
    ['memory-public-comment-read-direct-neon.js', 'isMemoryPublicCommentReadDirectNeonSelected', 'LB_MEMORY_PUBLIC_COMMENT_READ_RUNTIME']
  ];
  for (const [file, fn, gate] of cases) {
    const mod = await import('../../functions/_shared/' + file);
    assert.equal(mod[fn]({}), false);
    assert.equal(mod[fn]({ [gate]: 'modal' }), false);
    assert.equal(mod[fn]({ [gate]: 'future' }), false);
    assert.equal(mod[fn]({ [gate]: 'direct_neon' }), true);
  }

  const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
  for (const gate of cases.map((item) => item[2])) {
    assert.equal(wrangler.includes(gate), false, gate + ' must not be checked into Production in source phase');
  }
});

test('#4423 authenticated reaction summary preserves owner/public authorization and requester state', async () => {
  const direct = await import('../../functions/_shared/memory-auth-reaction-read-direct-neon.js');
  const calls = [];
  const response = await direct.handleMemoryAuthReactionReadDirectNeon(
    authRequest('/api/memories/' + MEMORY_ID + '/reactions'),
    authEnv('LB_MEMORY_AUTH_REACTION_READ_RUNTIME'),
    MEMORY_ID,
    'req-4423-auth-reaction',
    {
      verifyTokenOverride: async () => ({ uid: 'viewer-1' }),
      executorOverride: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('FROM memories')) {
          return [{
            id: MEMORY_ID,
            tree_id: TREE_ID,
            mem_visibility: 'private',
            tree_owner_id: 'viewer-1',
            tree_visibility: 'private'
          }];
        }
        return [
          { type: 'like', count: 3, requester_active: true },
          { type: 'wow', count: 2, requester_active: false }
        ];
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'memory-reaction-read-complete');
  assert.deepEqual(await response.json(), {
    counts: { like: 3, wow: 2 },
    userReactions: { like: true }
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].values, [MEMORY_ID]);
  assert.deepEqual(calls[1].values, [MEMORY_ID, 'viewer-1']);
  assert.doesNotMatch(JSON.stringify(calls), /INSERT|UPDATE|DELETE/i);
});

test('#4423 authenticated reaction non-owner on private target is leak-safe 404 before reaction query', async () => {
  const direct = await import('../../functions/_shared/memory-auth-reaction-read-direct-neon.js');
  let calls = 0;
  const response = await direct.handleMemoryAuthReactionReadDirectNeon(
    authRequest('/api/memories/' + MEMORY_ID + '/reactions'),
    authEnv('LB_MEMORY_AUTH_REACTION_READ_RUNTIME'),
    MEMORY_ID,
    'req-4423-auth-reaction-private',
    {
      verifyTokenOverride: async () => ({ uid: 'viewer-2' }),
      executorOverride: async (sql) => {
        calls += 1;
        if (sql.includes('FROM memories')) {
          return [{
            id: MEMORY_ID,
            tree_id: TREE_ID,
            mem_visibility: 'public',
            tree_owner_id: 'owner-1',
            tree_visibility: 'private'
          }];
        }
        throw new Error('reaction query must not execute');
      }
    }
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Memory not found' });
  assert.equal(calls, 1);
});

test('#4423 public reaction summary requires exact public membership and never returns viewer state', async () => {
  const direct = await import('../../functions/_shared/memory-public-reaction-read-direct-neon.js');
  const calls = [];
  const response = await direct.handleMemoryPublicReactionReadDirectNeon(
    publicRequest('/api/trees/' + TREE_ID + '/memories/' + MEMORY_ID + '/reactions'),
    publicEnv('LB_MEMORY_PUBLIC_REACTION_READ_RUNTIME'),
    TREE_ID,
    MEMORY_ID,
    'req-4423-public-reaction',
    {
      executorOverride: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('FROM memories')) return [{ id: MEMORY_ID, tree_id: TREE_ID }];
        return [{ type: 'like', count: 4 }, { type: 'wow', count: 1 }];
      }
    }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { counts: { like: 4, wow: 1 }, total: 5 });
  assert.equal(Object.hasOwn(body, 'userReactions'), false);
  assert.deepEqual(calls[0].values, [MEMORY_ID, TREE_ID]);
  assert.match(calls[0].sql, /m\.tree_id = \$2/);
  assert.match(calls[0].sql, /m\.visibility = 'public'/);
  assert.match(calls[0].sql, /t\.visibility = 'public'/);
});

test('#4423 authenticated comments preserve legacy raw-array mode and safe isOwn DTO', async () => {
  const direct = await import('../../functions/_shared/memory-auth-comment-read-direct-neon.js');
  const calls = [];
  const response = await direct.handleMemoryAuthCommentReadDirectNeon(
    authRequest('/api/memories/' + MEMORY_ID + '/comments', '?limit=1'),
    authEnv('LB_MEMORY_AUTH_COMMENT_READ_RUNTIME'),
    MEMORY_ID,
    'req-4423-auth-comments',
    {
      verifyTokenOverride: async () => ({ uid: 'viewer-1' }),
      executorOverride: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('FROM memories')) {
          return [{
            id: MEMORY_ID,
            tree_id: TREE_ID,
            mem_visibility: 'public',
            tree_owner_id: 'other-owner',
            tree_visibility: 'public'
          }];
        }
        return [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          memory_id: MEMORY_ID,
          owner_id: 'viewer-1',
          body: 'hello',
          created_at: '2026-09-17 01:02:03.123456+00',
          updated_at: '2026-09-17 01:03:04.654321+00'
        }];
      }
    }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
  assert.deepEqual(body, [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    memoryId: MEMORY_ID,
    body: 'hello',
    createdAt: '2026-09-17T01:02:03.123456+00:00',
    updatedAt: '2026-09-17T01:03:04.654321+00:00',
    isOwn: true
  }]);
  assert.equal(Object.hasOwn(body[0], 'ownerId'), false);
  assert.equal(calls[1].values.at(-1), 50, 'legacy mode validates ?limit but fetches legacy default 50');
  assert.match(calls[1].sql, /status = 'visible'/);
  assert.match(calls[1].sql, /deleted_at IS NULL/);
  assert.match(calls[1].sql, /ORDER BY created_at ASC, id ASC/);
});

test('#4423 authenticated cursor comments return envelope + target-bound cursor', async () => {
  const direct = await import('../../functions/_shared/memory-auth-comment-read-direct-neon.js');
  const row1 = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    memory_id: MEMORY_ID,
    owner_id: 'viewer-1',
    body: 'one',
    created_at: '2026-09-17 01:00:00.000001+00',
    updated_at: '2026-09-17 01:00:01.000001+00'
  };
  const row2 = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    memory_id: MEMORY_ID,
    owner_id: 'other',
    body: 'two',
    created_at: '2026-09-17 01:00:02.000001+00',
    updated_at: '2026-09-17 01:00:03.000001+00'
  };
  const response = await direct.handleMemoryAuthCommentReadDirectNeon(
    authRequest('/api/memories/' + MEMORY_ID + '/comments', '?pagination=cursor&limit=1'),
    authEnv('LB_MEMORY_AUTH_COMMENT_READ_RUNTIME'),
    MEMORY_ID,
    'req-4423-auth-comments-page',
    {
      verifyTokenOverride: async () => ({ uid: 'viewer-1' }),
      executorOverride: async (sql) => sql.includes('FROM memories')
        ? [{ id: MEMORY_ID, tree_id: TREE_ID, mem_visibility: 'public', tree_owner_id: 'other', tree_visibility: 'public' }]
        : [row1, row2]
    }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.comments.map((x) => x.body), ['one']);
  assert.equal(typeof body.nextCursor, 'string');
  assert.ok(body.nextCursor.length > 0);

  let dataCalls = 0;
  const second = await direct.handleMemoryAuthCommentReadDirectNeon(
    authRequest('/api/memories/' + MEMORY_ID + '/comments', '?pagination=cursor&limit=1&cursor=' + encodeURIComponent(body.nextCursor)),
    authEnv('LB_MEMORY_AUTH_COMMENT_READ_RUNTIME'),
    MEMORY_ID,
    'req-4423-auth-comments-page-2',
    {
      verifyTokenOverride: async () => ({ uid: 'viewer-1' }),
      executorOverride: async (sql, values) => {
        if (sql.includes('FROM memories')) return [{ id: MEMORY_ID, tree_id: TREE_ID, mem_visibility: 'public', tree_owner_id: 'other', tree_visibility: 'public' }];
        dataCalls += 1;
        assert.equal(values[0], MEMORY_ID);
        assert.equal(values[2], row1.id);
        assert.equal(values[3], 2);
        return [row2];
      }
    }
  );
  assert.equal(second.status, 200);
  assert.equal(dataCalls, 1);
  assert.deepEqual((await second.json()).comments.map((x) => x.body), ['two']);
});

test('#4423 public comments enforce bounded FastAPI limit before DB and return guest-safe envelope', async () => {
  const direct = await import('../../functions/_shared/memory-public-comment-read-direct-neon.js');
  let dbCalls = 0;
  const bad = await direct.handleMemoryPublicCommentReadDirectNeon(
    publicRequest('/api/trees/' + TREE_ID + '/memories/' + MEMORY_ID + '/comments', '?limit=51'),
    publicEnv('LB_MEMORY_PUBLIC_COMMENT_READ_RUNTIME'),
    TREE_ID,
    MEMORY_ID,
    'req-4423-public-comments-bad',
    {
      executorOverride: async () => { dbCalls += 1; return []; }
    }
  );
  assert.equal(bad.status, 422);
  assert.equal(dbCalls, 0);

  const good = await direct.handleMemoryPublicCommentReadDirectNeon(
    publicRequest('/api/trees/' + TREE_ID + '/memories/' + MEMORY_ID + '/comments', '?limit=1'),
    publicEnv('LB_MEMORY_PUBLIC_COMMENT_READ_RUNTIME'),
    TREE_ID,
    MEMORY_ID,
    'req-4423-public-comments',
    {
      executorOverride: async (sql) => {
        if (sql.includes('FROM memories')) return [{ id: MEMORY_ID, tree_id: TREE_ID }];
        return [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          body: 'guest safe',
          created_at: '2026-09-17 01:00:00.000001+00'
        }];
      }
    }
  );
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.deepEqual(body, {
    comments: [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      body: 'guest safe',
      createdAt: '2026-09-17T01:00:00.000001+00:00'
    }],
    nextCursor: null
  });
  for (const forbidden of ['ownerId', 'memoryId', 'updatedAt', 'isOwn']) {
    assert.equal(Object.hasOwn(body.comments[0], forbidden), false, forbidden);
  }
});

test('#4423 direct failures fail closed and helper/core source contains no write SQL or Modal fallback', async () => {
  const direct = await import('../../functions/_shared/memory-public-reaction-read-direct-neon.js');
  const response = await direct.handleMemoryPublicReactionReadDirectNeon(
    publicRequest('/api/trees/' + TREE_ID + '/memories/' + MEMORY_ID + '/reactions'),
    publicEnv('LB_MEMORY_PUBLIC_REACTION_READ_RUNTIME'),
    TREE_ID,
    MEMORY_ID,
    'req-4423-query-fail',
    { executorOverride: async () => { throw new Error('private db detail'); } }
  );
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.match(text, /DIRECT_NEON_QUERY_FAILED/);
  assert.doesNotMatch(text, /private db detail/);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');

  const sources = [
    'memory-social-read-core.js',
    'memory-auth-reaction-read-direct-neon.js',
    'memory-auth-comment-read-direct-neon.js',
    'memory-public-reaction-read-direct-neon.js',
    'memory-public-comment-read-direct-neon.js'
  ].map((name) => fs.readFileSync(path.join(ROOT, 'functions', '_shared', name), 'utf8')).join('\n');

  assert.equal(sources.includes('MODAL_BASE_URL'), false);
  for (const forbidden of ['INSERT INTO', 'UPDATE comments', 'UPDATE reactions', 'DELETE FROM', 'BEGIN;', 'COMMIT;', 'ROLLBACK;']) {
    assert.equal(sources.includes(forbidden), false, forbidden);
  }
});

test('#4423 four edge routes wire direct GET candidates while retaining existing Modal paths', () => {
  const cases = [
    ['functions/api/memories/[id]/reactions.js', 'isMemoryAuthReactionReadDirectNeonSelected', '/modal/private/memories/'],
    ['functions/api/memories/[id]/comments.js', 'isMemoryAuthCommentReadDirectNeonSelected', '/modal/private/memories/'],
    ['functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js', 'isMemoryPublicReactionReadDirectNeonSelected', '/modal/public/trees/'],
    ['functions/api/trees/[tree_id]/memories/[memory_id]/comments.js', 'isMemoryPublicCommentReadDirectNeonSelected', '/modal/public/trees/']
  ];
  for (const [rel, selector, modalMarker] of cases) {
    const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(source.includes(selector), rel + ' direct selector');
    assert.ok(source.includes('directNeonTestOverrides'), rel + ' deterministic injection');
    assert.ok(source.includes(modalMarker), rel + ' retains Modal fallback source');
  }
});
