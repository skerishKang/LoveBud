/**
 * Focused executed tests for tree-level comment authenticated write adapter (#3527).
 *
 * Exercises js/social/tree-comments-write-client.js with a mocked LoveTreeBaseApiFetch.
 * No production/staging network.
 *
 * Refs #3527, #3188, #3354, #3075, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const WRITE_CLIENT_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-write-client.js');
const READ_CLIENT_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-client.js');

const VALID_TREE_ID = '11111111-1111-4111-8111-111111111111';
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function loadWriteClient(apiFetchImpl) {
  const sandbox = {
    window: {
      LoveTreeBaseApiFetch: {
        apiFetch: apiFetchImpl
      }
    },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WRITE_CLIENT_PATH, 'utf8'), sandbox, {
    filename: WRITE_CLIENT_PATH
  });
  return sandbox.window.LoveBudTreeCommentsWrite;
}

function loadWriteClientNoTransport() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WRITE_CLIENT_PATH, 'utf8'), sandbox, {
    filename: WRITE_CLIENT_PATH
  });
  return sandbox.window.LoveBudTreeCommentsWrite;
}

// ─── Surface / validation ───────────────────────────────────────────────────

test('write client exposes createTreeComment and helpers', () => {
  const client = loadWriteClient(async () => ({}));
  assert.equal(typeof client.createTreeComment, 'function');
  assert.equal(typeof client.isValidTreeId, 'function');
  assert.equal(typeof client.isValidIdempotencyKey, 'function');
  assert.equal(typeof client.generateIdempotencyKey, 'function');
  assert.equal(typeof client.normalizeTreeCommentRow, 'function');
  assert.equal(client.MAX_BODY, 5000);
});

test('invalid tree id returns invalid_tree_id with POST 0', async () => {
  let calls = 0;
  const client = loadWriteClient(async () => {
    calls += 1;
    return {};
  });
  const result = await client.createTreeComment('not-a-uuid', 'hello', 'idem-key-01');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'invalid_tree_id');
  assert.equal(calls, 0);
});

test('empty / whitespace body returns empty_body with POST 0', async () => {
  let calls = 0;
  const client = loadWriteClient(async () => {
    calls += 1;
    return {};
  });
  const r1 = await client.createTreeComment(VALID_TREE_ID, '   ', 'idem-key-02');
  const r2 = await client.createTreeComment(VALID_TREE_ID, '', 'idem-key-03');
  assert.equal(r1.ok, false);
  assert.equal(r1.state, 'empty_body');
  assert.equal(r2.state, 'empty_body');
  assert.equal(calls, 0);
});

test('body over 5000 returns body_too_long with POST 0', async () => {
  let calls = 0;
  const client = loadWriteClient(async () => {
    calls += 1;
    return {};
  });
  const result = await client.createTreeComment(
    VALID_TREE_ID,
    'x'.repeat(5001),
    'idem-key-04'
  );
  assert.equal(result.ok, false);
  assert.equal(result.state, 'body_too_long');
  assert.equal(calls, 0);
});

test('invalid idempotency key returns idempotency_key_invalid with POST 0', async () => {
  let calls = 0;
  const client = loadWriteClient(async () => {
    calls += 1;
    return {};
  });
  const result = await client.createTreeComment(VALID_TREE_ID, 'hi', 'short');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'idempotency_key_invalid');
  assert.equal(calls, 0);
});

test('generateIdempotencyKey matches Cloudflare pattern', () => {
  const client = loadWriteClient(async () => ({}));
  for (let i = 0; i < 20; i += 1) {
    const key = client.generateIdempotencyKey();
    assert.ok(KEY_PATTERN.test(key), `key must match pattern: ${key}`);
  }
});

// ─── Valid POST contract ────────────────────────────────────────────────────

test('valid submit POSTs tree comment route once with body and Idempotency-Key', async () => {
  const calls = [];
  const client = loadWriteClient(async (endpoint, opts) => {
    calls.push({ endpoint, opts });
    return {
      id: 'c-new',
      treeId: VALID_TREE_ID,
      body: 'tree whole comment',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      authorDisplayLabel: 'fan',
      ownerId: 'must-not-leak',
      email: 'x@y.z'
    };
  });

  const key = 'tc-idem-valid-0001';
  const result = await client.createTreeComment(VALID_TREE_ID, '  tree whole comment  ', key);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, `/trees/${VALID_TREE_ID}/comments`);
  assert.ok(!/memories|memory/.test(calls[0].endpoint), 'must not use moment endpoint');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['Idempotency-Key'], key);
  assert.ok(KEY_PATTERN.test(calls[0].opts.headers['Idempotency-Key']));
  assert.equal(JSON.parse(calls[0].opts.body).body, 'tree whole comment');
  assert.equal(result.ok, true);
  assert.equal(result.state, 'created');
  assert.equal(result.comment.id, 'c-new');
  assert.equal(result.comment.body, 'tree whole comment');
  assert.equal(result.comment.ownerId, undefined);
  assert.equal(result.comment.email, undefined);
  assert.equal(result.idempotencyKey, key);
});

test('missing transport returns transport_unavailable with POST 0', async () => {
  const client = loadWriteClientNoTransport();
  const result = await client.createTreeComment(VALID_TREE_ID, 'hi', 'idem-key-05');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'transport_unavailable');
});

test('maps 401/403/404/429/503 to safe states without raw backend text', async () => {
  async function mapStatus(status) {
    const client = loadWriteClient(async () => {
      const err = new Error('RAW BACKEND SECRET DETAIL');
      err.status = status;
      err.code = status === 400 ? 'OTHER' : undefined;
      throw err;
    });
    return client.createTreeComment(VALID_TREE_ID, 'hi', 'idem-key-map1');
  }
  assert.equal((await mapStatus(401)).state, 'unauthorized');
  assert.equal((await mapStatus(403)).state, 'forbidden');
  assert.equal((await mapStatus(404)).state, 'not_found');
  assert.equal((await mapStatus(429)).state, 'rate_limited');
  assert.equal((await mapStatus(503)).state, 'upstream_unavailable');
  const r = await mapStatus(500);
  assert.equal(r.state, 'unexpected_safe_error');
  assert.ok(!JSON.stringify(r).includes('RAW BACKEND'));
});

test('normalizeTreeCommentRow strips raw account ids', () => {
  const client = loadWriteClient(async () => ({}));
  const row = client.normalizeTreeCommentRow({
    id: 'c1',
    treeId: VALID_TREE_ID,
    body: 'x',
    ownerId: 'acc-1',
    uid: 'u1',
    email: 'a@b.c',
    authorDisplayLabel: 'fan'
  });
  assert.equal(row.ownerId, undefined);
  assert.equal(row.uid, undefined);
  assert.equal(row.email, undefined);
  assert.equal(row.authorDisplayLabel, 'fan');
});

// ─── Read adapter remains GET-only (regression surface) ─────────────────────

test('read client source remains POST-free (GET-only public boundary)', () => {
  const src = fs.readFileSync(READ_CLIENT_PATH, 'utf8');
  assert.ok(src.includes('fetchTreeComments'));
  assert.ok(!/\bmethod\s*:\s*['"]POST['"]/.test(src), 'read client must not POST');
  assert.ok(!/createTreeComment/.test(src), 'read client must not own createTreeComment');
});
