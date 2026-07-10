/**
 * Focused tests for the tree-level comment read/list client adapter (Issue #3414).
 *
 * These tests verify js/social/tree-comments-client.js implements the #3413
 * client integration contract using a mocked fetch inside a window sandbox.
 * No browser, production, or staging network is used.
 *
 * Refs: #3414, #3188, #3412, #3413, #3408, #3410, #3404, #3405, #3400, #3401,
 *       #3396, #3398, #3393, #3394, #3388, #3392, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-client.js');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const BASE_API_FETCH_PATH = path.join(ROOT, 'js', 'api', 'base-api-fetch.js');

const VALID_TREE_ID = '11111111-1111-4111-8111-111111111111';

function loadAdapter(fetchImpl) {
  const localStorageMock = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 200,
      __lovebudAuthReady: true,
      localStorage: localStorageMock,
      LoveBudAuthState: null,
    },
    localStorage: localStorageMock,
    console,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });
  vm.runInContext(fs.readFileSync(ADAPTER_PATH, 'utf8'), sandbox, { filename: ADAPTER_PATH });
  return sandbox.window.LoveBudTreeComments;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function makeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    const call = { url, init: init || {} };
    calls.push(call);
    return handler(url, init || {}, call);
  };
  return { fn, calls };
}

// ─── 1. Successful read/list normalization (mocked fetch) ───────────────────

test('fetchTreeComments normalizes a successful read/list payload', async () => {
  const raw = {
    comments: [
      {
        id: 'c1',
        treeId: VALID_TREE_ID,
        body: 'hello',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        authorDisplayLabel: 'anonym',
      },
    ],
  };
  const { fn, calls } = makeFetch(async () => jsonResponse(200, raw));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID, { limit: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.state, 'loaded_with_comments');
  assert.equal(result.comments.length, 1);
  assert.equal(result.comments[0].id, 'c1');
  assert.equal(result.comments[0].treeId, VALID_TREE_ID);
  assert.equal(result.comments[0].authorDisplayLabel, 'anonym');
  assert.equal(calls.length, 1);
});

test('fetchTreeComments calls exactly GET /api/trees/:treeId/comments', async () => {
  const { fn, calls } = makeFetch(async () => jsonResponse(200, { comments: [] }));
  const client = loadAdapter(fn);

  await client.fetchTreeComments(VALID_TREE_ID, { limit: 5 });
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.init.method, undefined, 'default method must be GET (no POST)');
  assert.ok(
    call.url === `/api/trees/${VALID_TREE_ID}/comments?limit=5`,
    `URL must be tree-target exactly, got ${call.url}`
  );
  assert.ok(!/memories/.test(call.url), 'must not call moment endpoint');
  assert.ok(!/memory_id/.test(call.url), 'must not include memory_id');
});

// ─── 2. Empty response normalization ────────────────────────────────────────

test('fetchTreeComments maps empty comments to loaded_empty', async () => {
  const { fn } = makeFetch(async () => jsonResponse(200, { comments: [] }));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'loaded_empty');
  assert.deepEqual(result.comments, []);
});

// ─── 3. Invalid tree id prevents network call ───────────────────────────────

test('invalid tree id returns safe state without network call', async () => {
  const { fn, calls } = makeFetch(async () => {
    assert.fail('network call must not happen for invalid tree id');
  });
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments('not-a-uuid');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'invalid_tree_id');
  assert.equal(calls.length, 0);
});

test('isValidTreeId validates UUID shape', () => {
  const client = loadAdapter(async () => jsonResponse(200, { comments: [] }));
  assert.equal(client.isValidTreeId(VALID_TREE_ID), true);
  assert.equal(client.isValidTreeId('not-a-uuid'), false);
  assert.equal(client.isValidTreeId(''), false);
  assert.equal(client.isValidTreeId(null), false);
});

// ─── 4. Limit sanitize / clamp 1..50 ────────────────────────────────────────

test('limit is sanitized/clamped to 1..50', async () => {
  const { fn, calls } = makeFetch(async () => jsonResponse(200, { comments: [] }));
  const client = loadAdapter(fn);

  await client.fetchTreeComments(VALID_TREE_ID, { limit: 0 });
  assert.ok(/\?limit=(1|20)$/.test(calls[0].url), `0 -> default/clamp, got ${calls[0].url}`);

  await client.fetchTreeComments(VALID_TREE_ID, { limit: 999 });
  assert.ok(/\?limit=50$/.test(calls[1].url), `999 -> 50, got ${calls[1].url}`);

  await client.fetchTreeComments(VALID_TREE_ID, { limit: 30 });
  assert.ok(/\?limit=30$/.test(calls[2].url), `30 -> 30, got ${calls[2].url}`);
});

test('sanitizeLimit clamps values', () => {
  const client = loadAdapter(async () => jsonResponse(200, { comments: [] }));
  assert.equal(client.sanitizeLimit(undefined), 20);
  assert.equal(client.sanitizeLimit(0), 20);
  assert.equal(client.sanitizeLimit(-5), 20);
  assert.equal(client.sanitizeLimit(1), 1);
  assert.equal(client.sanitizeLimit(50), 50);
  assert.equal(client.sanitizeLimit(51), 50);
  assert.equal(client.sanitizeLimit('10'), 10);
});

// ─── 5. No moment endpoint / no memory_id ───────────────────────────────────

test('no moment endpoint or memory_id in request', async () => {
  const { fn, calls } = makeFetch(async () => jsonResponse(200, { comments: [] }));
  const client = loadAdapter(fn);

  await client.fetchTreeComments(VALID_TREE_ID);
  assert.ok(!/memories/.test(calls[0].url), 'no /memories/ segment');
  assert.ok(!/memoryId|memory_id/.test(calls[0].url), 'no memory id');
});

// ─── 6. No write behavior: no POST / no Idempotency-Key / no auth mutation ───

test('no POST, no Idempotency-Key, no Authorization header for guest read', async () => {
  const { fn, calls } = makeFetch(async () => jsonResponse(200, { comments: [] }));
  const client = loadAdapter(fn);

  await client.fetchTreeComments(VALID_TREE_ID, { limit: 12 });
  const call = calls[0];
  assert.notEqual(call.init.method, 'POST', 'must not be a POST write');
  const headers = call.init.headers || {};
  const headerKeys = Object.keys(headers).map((k) => k.toLowerCase());
  assert.ok(!headerKeys.includes('idempotency-key'), 'must not send Idempotency-Key');
  assert.ok(!headerKeys.includes('authorization'), 'guest read must not send Authorization header');
});

// ─── 7. Not found / private / non-public collapsed state ────────────────────

test('404 collapses to not_found_private_non_public safe state', async () => {
  const { fn } = makeFetch(async () => jsonResponse(404, { error: 'Tree not found', code: 'NOT_FOUND' }));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'not_found_private_non_public');
});

// ─── 8. Upstream unavailable mapping ────────────────────────────────────────

test('503 maps to upstream_unavailable', async () => {
  const { fn } = makeFetch(async () => jsonResponse(503, { error: 'modal-unavailable', code: 'modal-unavailable' }));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'upstream_unavailable');
});

// ─── 9. Upstream timeout mapping ────────────────────────────────────────────

test('504 maps to upstream_timeout', async () => {
  const { fn } = makeFetch(async () => jsonResponse(504, { error: 'modal-timeout', code: 'modal-timeout' }));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'upstream_timeout');
});

// ─── 10. Unexpected / 401 no retry loop behavior ────────────────────────────

test('network failure maps to upstream_unavailable (no retry loop)', async () => {
  let attempts = 0;
  const { fn } = makeFetch(async () => {
    attempts += 1;
    if (attempts > 1) assert.fail('must not retry');
    throw new Error('network down');
  });
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(attempts, 1, 'single attempt, no retry loop');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'upstream_unavailable');
});

test('401 anomaly collapses to unexpected_safe_error without retry loop', async () => {
  let attempts = 0;
  const { fn } = makeFetch(async () => {
    attempts += 1;
    if (attempts > 1) assert.fail('401 must not trigger retry loop');
    return jsonResponse(401, { error: 'unauthorized' });
  });
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(attempts, 1, 'no retry on 401');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'unexpected_safe_error');
});

test('unknown 500 maps to unexpected_safe_error', async () => {
  const { fn } = makeFetch(async () => jsonResponse(500, { error: 'boom' }));
  const client = loadAdapter(fn);

  const result = await client.fetchTreeComments(VALID_TREE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'unexpected_safe_error');
});

// ─── 11. Raw account id stripped from normalized output ─────────────────────

test('raw account identifiers are stripped from normalized output', () => {
  const client = loadAdapter(async () => jsonResponse(200, { comments: [] }));
  const raw = {
    id: 'c1',
    treeId: VALID_TREE_ID,
    body: 'hi',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    authorDisplayLabel: 'anonym',
    ownerId: 'evil-owner',
    owner_id: 'evil-owner-2',
    uid: 'evil-uid',
    email: 'evil@example.com',
  };
  const normalized = client.normalizeTreeCommentRow(raw);
  for (const bad of ['ownerId', 'owner_id', 'uid', 'email']) {
    assert.ok(!(bad in normalized), `normalized must not contain raw account key ${bad}`);
  }
  for (const good of ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel']) {
    assert.ok(good in normalized, `normalized must keep safe field ${good}`);
  }
});

test('extractComments drops raw account keys from each item', () => {
  const client = loadAdapter(async () => jsonResponse(200, { comments: [] }));
  const payload = {
    comments: [
      { id: 'c1', treeId: VALID_TREE_ID, body: 'b', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a', ownerId: 'x' },
    ],
  };
  const comments = client.extractComments(payload);
  assert.equal(comments.length, 1);
  assert.ok(!('ownerId' in comments[0]), 'ownerId must be stripped');
});

// ─── 12. No UI / drawer / modal / Tree Workspace integration ────────────────

test('client adapter has no DOM/UI surface', () => {
  const src = fs.readFileSync(ADAPTER_PATH, 'utf8');
  assert.ok(!/document\.|addEventListener|createElement|drawer|modal|Tree Workspace/i.test(src),
    'client adapter must not implement UI/drawer/modal/Tree Workspace');
});

// ─── 13. No Scout / backend / moment adapter changes (scope guard) ──────────

test('no Scout files, backend route/reader, or moment adapter are modified by this PR', () => {
  const status = require('node:child_process').execSync('git status --porcelain', { cwd: ROOT }).toString();
  for (const line of status.split('\n')) {
    if (/js\/scout\//.test(line)) assert.fail(`Scout file changed: ${line}`);
    if (/functions\/api\/trees\/\[tree_id\]\/comments\.js|modal_compute\/tree_comments\.py|modal_compute\/app\.py/.test(line)) {
      assert.fail(`Backend route/reader changed: ${line}`);
    }
    if (/memories\/\[memory_id\]\/comments\.js|modal_compute\/comments\.py/.test(line)) {
      assert.fail(`Moment comment route/helper changed: ${line}`);
    }
  }
});

// ─── 14. Test stays source-only (no real network) ───────────────────────────

test('this test suite does not import runtime/network/browser clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/i.test(self), 'must not import axios');
  assert.ok(!/require\(['"]playwright['"]\)|require\(['"]puppeteer['"]\)/i.test(self), 'must not import browser automation');
  assert.ok(!/require\(['"]postgres-client['"]\)/i.test(self), 'must not import postgres-client');
});
