// Focused contract test for the #4000 Tree Comment LIST (read) direct-Neon
// candidate.
//
// All assertions run in-process with an injected fake executor (no real DB,
// network, browser, provider mutation, Firebase mutation, or Production
// resource). This proves:
//   A. import purity (no network/DB/secret mutation at import or on unset gate)
//   B. SQL read semantics (visibility-first, SELECT-only projection,
//      parameterized tree id, ordering, no soft-delete predicate, public DTO,
//      empty list)
//   C. route gate matrix (unset/modal/unknown -> null/Modal; direct_neon -> candidate)
//   D. failure behavior (missing read cred -> bounded 503; direct execution
//      failure -> 500, NO blind Modal fallback; invalid treeId -> 400;
//      private/missing tree -> 404 leak-safe; invalid cursor -> 400;
//      forbidden write/generic fallback -> 503)
//   E. readiness matrix representation (row present, vocabulary, gate not
//      checked in, gate absent from wrangler.toml, proven privilege)
//   F. regression (write helper still loadable; route still exports GET/POST)
//
// The candidate mirrors modal_compute/tree_comments.py::fetch_tree_comments.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = '../../functions/_shared/tree-comment-read-direct-neon.js';
const ROUTE_PATH = '../../functions/api/trees/[tree_id]/comments.js';
const MATRIX_PATH = path.resolve(REPO_ROOT, 'docs', 'architecture', 'direct-neon-readiness-matrix-4311.json');

const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';
const WRITE_URL = 'postgresql://ep-writer.us-east-2.neon.tech/neondb?sslmode=require';

const TREE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRIVATE_TREE_ID = '99999999-9999-9999-9999-999999999999';
const OTHER_TREE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const READ_PATH = `/api/trees/${TREE_ID}/comments`;
const READ_URL_STR = `https://lovebud.pages.dev${READ_PATH}`;

const READ_ENV = {
  LB_TREE_COMMENT_READ_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_DATABASE_URL: READ_URL
};

async function loadModule() {
  return import(MODULE_PATH);
}

async function loadRoute() {
  return import(ROUTE_PATH);
}

function makeReadExecutor({ treeRow = { id: TREE_ID, visibility: 'public' }, commentRows = [], throws = false } = {}) {
  const calls = [];
  const executor = async (text, values) => {
    calls.push({ text, values: Array.isArray(values) ? [...values] : values });
    if (throws) throw new Error('read executor down');
    if (text.includes('FROM trees')) return treeRow ? [treeRow] : [];
    if (text.includes('FROM tree_comments')) return commentRows;
    return [];
  };
  return { calls, executor };
}

function makeGetRequest({ treeId = TREE_ID, query = '' } = {}) {
  const url = `https://lovebud.pages.dev/api/trees/${treeId}/comments${query}`;
  return new Request(url, { method: 'GET', headers: new Headers() });
}

// ─── A. import purity ──────────────────────────────────────────────────────

test('A1. import has no network/DB/secret side effects; exports are functions', async () => {
  const mod = await loadModule();
  assert.equal(typeof mod.handleTreeCommentReadDirectNeon, 'function');
  assert.equal(typeof mod.isTreeCommentReadDirectNeonSelected, 'function');
  assert.equal(typeof mod.isTreeCommentReadDirectNeonRequest, 'function');
  assert.equal(typeof mod.createTreeCommentReadExecutor, 'function');
  assert.equal(typeof mod.normalizePublicTreeCommentRow, 'function');
  // No top-level neon import side effects: createTreeCommentReadExecutor with no
  // connection string must throw before any network use.
  await assert.rejects(
    () => mod.createTreeCommentReadExecutor({ connectionString: '' }),
    /TREE_COMMENT_READ_DIRECT_NEON_CONFIG_INVALID/
  );
});

test('A2. unset/unknown gate returns null WITHOUT touching any executor (no DB)', async () => {
  const mod = await loadModule();
  const { calls, executor } = makeReadExecutor();
  const req = makeGetRequest();
  const respUnset = await mod.handleTreeCommentReadDirectNeon(req, {}, 'rid-a2a', { executorOverride: executor });
  assert.equal(respUnset, null, 'unset gate -> null (Modal path)');
  const respModal = await mod.handleTreeCommentReadDirectNeon(req, { LB_TREE_COMMENT_READ_RUNTIME: 'modal' }, 'rid-a2b', { executorOverride: executor });
  assert.equal(respModal, null, 'modal gate -> null');
  const respUnknown = await mod.handleTreeCommentReadDirectNeon(req, { LB_TREE_COMMENT_READ_RUNTIME: 'weird' }, 'rid-a2c', { executorOverride: executor });
  assert.equal(respUnknown, null, 'unknown gate -> null');
  assert.equal(calls.length, 0, 'executor never invoked while gate is not selected');
});

// ─── B. SQL read semantics ────────────────────────────────────────────────

test('B1. visibility gate runs BEFORE the comments read (SELECT order)', async () => {
  const mod = await loadModule();
  const { calls, executor } = makeReadExecutor({
    commentRows: [
      { id: 'c-1', tree_id: TREE_ID, body: 'first', created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' }
    ]
  });
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b1', { executorOverride: executor });
  const visIdx = calls.findIndex((c) => c.text.includes('FROM trees'));
  const cmtIdx = calls.findIndex((c) => c.text.includes('FROM tree_comments'));
  assert.ok(visIdx !== -1 && cmtIdx !== -1, 'both queries executed');
  assert.ok(visIdx < cmtIdx, 'visibility check precedes comments read');
});

test('B2. SELECT-only projection: id/tree_id/body/created_at/updated_at, no owner_id, no writes', async () => {
  const mod = await loadModule();
  const { calls, executor } = makeReadExecutor();
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b2', { executorOverride: executor });
  const cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.ok(cmt, 'comments query present');
  assert.ok(/SELECT id, tree_id, body, created_at::text AS created_at, updated_at::text AS updated_at/.test(cmt.text), 'exact safe projection');
  assert.ok(!/owner_id/.test(cmt.text), 'no owner_id selected (leak-safe)');
  assert.ok(!/\bINSERT\b/.test(cmt.text) && !/\bUPDATE\b/.test(cmt.text) && !/\bDELETE\b/.test(cmt.text), 'read is SELECT-only');
});

test('B3. no soft-delete predicate on tree_comments (matches Modal fetch_tree_comments)', async () => {
  const mod = await loadModule();
  const { calls, executor } = makeReadExecutor();
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b3', { executorOverride: executor });
  const cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.ok(!/deleted_at/.test(cmt.text), 'tree_comments has no soft-delete column; no deleted_at filter');
});

test('B4. parameterized tree id and stable ordering clause', async () => {
  const mod = await loadModule();
  const { calls, executor } = makeReadExecutor();
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: TREE_ID }), READ_ENV, 'rid-b4', { executorOverride: executor });
  const cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.ok(cmt.text.includes('WHERE tree_id = $1'), 'parameterized tree id');
  assert.ok(cmt.text.includes('ORDER BY created_at ASC, id ASC'), 'oldest-first stable ordering');
  assert.deepEqual(cmt.values.slice(0, 1), [TREE_ID], 'tree id bound to $1');
});

test('B5. public DTO excludes owner; adds authorDisplayLabel; exact shape', async () => {
  const mod = await loadModule();
  const { executor } = makeReadExecutor({
    commentRows: [
      { id: 'c-1', tree_id: TREE_ID, owner_id: 'some-owner', body: 'hi', created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' }
    ]
  });
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b5', { executorOverride: executor });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.deepEqual(body.comments, [{
    id: 'c-1',
    treeId: TREE_ID,
    body: 'hi',
    createdAt: '2026-01-01T00:00:00+00:00',
    updatedAt: '2026-01-01T00:00:00+00:00',
    authorDisplayLabel: 'anonymous'
  }]);
  assert.equal(Object.hasOwn(body.comments[0], 'ownerId'), false, 'owner id never leaked');
});

test('B6. empty list -> { comments: [], nextCursor: null }', async () => {
  const mod = await loadModule();
  const { executor } = makeReadExecutor({ commentRows: [] });
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b6', { executorOverride: executor });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.deepEqual(body, { comments: [], nextCursor: null });
});

test('B7. bounded limit default 20 and clamps to 1..50 (LIMIT param = limit+1)', async () => {
  const mod = await loadModule();
  // default
  let { calls, executor } = makeReadExecutor();
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-b7a', { executorOverride: executor });
  let cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.equal(cmt.values[cmt.values.length - 1], 21, 'default limit 20 -> LIMIT 21');

  // clamp high
  ({ calls, executor } = makeReadExecutor());
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ query: '?limit=999' }), READ_ENV, 'rid-b7b', { executorOverride: executor });
  cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.equal(cmt.values[cmt.values.length - 1], 51, 'limit 999 clamps to 50 -> LIMIT 51');

  // clamp low
  ({ calls, executor } = makeReadExecutor());
  await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ query: '?limit=0' }), READ_ENV, 'rid-b7c', { executorOverride: executor });
  cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.equal(cmt.values[cmt.values.length - 1], 2, 'limit 0 clamps to 1 -> LIMIT 2');
});

// Modal parity for limit normalization. modal_compute/tree_comments.py::
// fetch_tree_comments uses `int(limit)` inside try/except (TypeError, ValueError)
// -> 20, then clamps to 1..50. Query params arrive as strings, so Python int()
// REJECTS fractional and exponent forms outright instead of truncating or
// exponentiating them. SQL binds LIMIT = safe_limit + 1.
test('B7b. limit normalization matches Python int() (no float/exponent coercion)', async () => {
  const mod = await loadModule();
  const cases = [
    // [query, expected safe_limit, expected LIMIT param, label]
    [null, 20, 21, 'missing limit -> default 20'],
    ['?limit=', 20, 21, 'empty limit -> default 20'],
    ['?limit=1', 1, 2, 'plain integer 1'],
    ['?limit=20', 20, 21, 'plain integer 20 passes through'],
    ['?limit=+5', 5, 6, 'signed +5 parses under int() parity'],
    ['?limit=-1', 1, 2, 'signed -1 parses then clamps to 1'],
    ['?limit=0', 1, 2, '0 parses then clamps to 1'],
    ['?limit=51', 50, 51, '51 parses then clamps to 50'],
    ['?limit=1.9', 20, 21, '1.9 is NOT a Python int -> default 20 (never 1)'],
    ['?limit=1e2', 20, 21, '1e2 is NOT a Python int -> default 20 (never 100/50)'],
    ['?limit=abc', 20, 21, 'abc is NOT a Python int -> default 20'],
    ['?limit=0x1f', 20, 21, 'hex form is NOT a Python int -> default 20'],
    ['?limit=  ', 20, 21, 'whitespace-only limit -> default 20']
  ];

  for (const [index, [query, expectedLimit, expectedSqlLimit, label]] of cases.entries()) {
    const { calls, executor } = makeReadExecutor();
    const opts = query === null ? {} : { query };
    const resp = await mod.handleTreeCommentReadDirectNeon(
      makeGetRequest(opts),
      READ_ENV,
      `rid-b7b-${index}`,
      { executorOverride: executor }
    );
    assert.equal(resp.status, 200, `${label}: request must succeed`);
    const cmt = calls.find((c) => c.text.includes('FROM tree_comments'));
    assert.ok(cmt, `${label}: comment read query issued`);
    const sqlLimit = cmt.values[cmt.values.length - 1];
    assert.equal(sqlLimit, expectedSqlLimit, `${label}: LIMIT param = safe_limit + 1`);
    assert.equal(sqlLimit - 1, expectedLimit, `${label}: safe_limit parity`);
  }
});

test('B8. cursor pagination: hasMore -> nextCursor encoded; second page consumes cursor, no overlap', async () => {
  const mod = await loadModule();
  const page1 = [
    { id: 'c-1', tree_id: TREE_ID, body: 'a', created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
    { id: 'c-2', tree_id: TREE_ID, body: 'b', created_at: '2026-01-01T00:01:00+00:00', updated_at: '2026-01-01T00:01:00+00:00' }
  ];
  let { calls, executor } = makeReadExecutor({ commentRows: page1 });
  const r1 = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ query: '?limit=1' }), READ_ENV, 'rid-b8a', { executorOverride: executor });
  const b1 = await r1.json();
  assert.equal(b1.comments.length, 1);
  assert.equal(b1.comments[0].id, 'c-1');
  assert.ok(typeof b1.nextCursor === 'string' && b1.nextCursor.length > 0, 'hasMore -> nextCursor present');
  // page 1 has NO cursor, so the cursor predicate must NOT be present yet.
  const cmt1 = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.ok(!cmt1.text.includes('created_at > $2'), 'page 1 (no cursor) has no cursor predicate');
  assert.equal(cmt1.values.length, 2, 'page 1 binds only [tree_id, limit+1]');
  assert.equal(cmt1.values[0], TREE_ID, 'page 1 binds tree_id to $1');
  assert.equal(cmt1.values[1], 2, 'page 1 LIMIT param = limit+1 = 2');

  // second page consumes the cursor -> cursor predicate present, no overlap.
  const page2 = [
    { id: 'c-2', tree_id: TREE_ID, body: 'b', created_at: '2026-01-01T00:01:00+00:00', updated_at: '2026-01-01T00:01:00+00:00' }
  ];
  ({ calls, executor } = makeReadExecutor({ commentRows: page2 }));
  const r2 = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ query: `?limit=1&cursor=${encodeURIComponent(b1.nextCursor)}` }), READ_ENV, 'rid-b8b', { executorOverride: executor });
  const b2 = await r2.json();
  assert.equal(b2.comments.length, 1);
  assert.equal(b2.comments[0].id, 'c-2', 'second page returns the remaining row, no overlap');
  assert.equal(b2.nextCursor, null, 'last page -> nextCursor null');
  const cmt2 = calls.find((c) => c.text.includes('FROM tree_comments'));
  assert.ok(cmt2.text.includes('created_at > $2'), 'cursor predicate present on page 2 query');
  assert.equal(cmt2.values[0], TREE_ID, 'tree id still bound to $1');
  assert.equal(cmt2.values[1], '2026-01-01T00:00:00+00:00', 'cursor created_at bound to $2');
  assert.equal(cmt2.values[2], 'c-1', 'cursor id bound to $3');
  assert.equal(cmt2.values[3], 2, 'page 2 LIMIT param = limit+1 = 2');
});

// ─── C. route gate matrix ─────────────────────────────────────────────────

test('C1. direct_neon read gate selected -> route dispatches to direct handler (upstream direct-neon)', async () => {
  const route = await loadRoute();
  const resp = await route.onRequestGet({ request: makeGetRequest(), env: { LB_TREE_COMMENT_READ_RUNTIME: 'direct_neon' } });
  // No read DB credential in this env -> bounded 503 from the direct handler
  // (proof the GET was dispatched to the candidate, NOT Modal).
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.status, 503);
  const json = await resp.json();
  assert.equal(json.code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('C2. unset read gate -> route keeps Modal path (upstream modal)', async () => {
  const route = await loadRoute();
  const resp = await route.onRequestGet({ request: makeGetRequest(), env: {} });
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal', 'unset read gate -> Modal proxy path');
});

test('C3. gate selection parity: only direct_neon selects; POST write gate does not affect GET', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeCommentReadDirectNeonSelected({}), false);
  assert.equal(mod.isTreeCommentReadDirectNeonSelected({ LB_TREE_COMMENT_READ_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeCommentReadDirectNeonSelected({ LB_TREE_COMMENT_READ_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isTreeCommentReadDirectNeonSelected(READ_ENV), true);
  // GET is a read-neon request; POST is not governed by the read gate.
  assert.equal(mod.isTreeCommentReadDirectNeonRequest(makeGetRequest()), true);
});

// ─── D. failure behavior ───────────────────────────────────────────────────

test('D1. missing read credential at direct start -> bounded 503, no Modal fallback', async () => {
  const mod = await loadModule();
  const env = { LB_TREE_COMMENT_READ_RUNTIME: 'direct_neon' }; // no LOVE_PLATFORM_DATABASE_URL
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), env, 'rid-d1');
  assert.equal(resp.status, 503);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
});

test('D2. forbidden write/generic DB fallback rejected (fail closed)', async () => {
  const mod = await loadModule();
  const env = { LB_TREE_COMMENT_READ_RUNTIME: 'direct_neon', LOVE_PLATFORM_WRITE_DATABASE_URL: WRITE_URL };
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), env, 'rid-d2');
  assert.equal(resp.status, 503);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');
});

test('D3. direct execution failure -> 500, NO blind Modal fallback', async () => {
  const mod = await loadModule();
  const { executor } = makeReadExecutor({ throws: true });
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest(), READ_ENV, 'rid-d3', { executorOverride: executor });
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_QUERY_FAILED');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon', 'fails closed, does not fall back to modal');
});

test('D4. invalid treeId -> 400', async () => {
  const mod = await loadModule();
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: 'not-a-uuid' }), READ_ENV, 'rid-d4', { executorOverride: (() => []) });
  assert.equal(resp.status, 400);
  assert.equal((await resp.json()).detail, 'Invalid treeId');
});

test('D5. missing/empty treeId -> 400 required', async () => {
  const mod = await loadModule();
  const resp = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: '' }), READ_ENV, 'rid-d5', { executorOverride: (() => []) });
  assert.equal(resp.status, 400);
  assert.equal((await resp.json()).detail, 'treeId is required');
});

test('D6. private/missing tree -> 404 leak-safe (never 403; indistinguishable from not-found)', async () => {
  const mod = await loadModule();
  // private
  const { executor: e1 } = makeReadExecutor({ treeRow: { id: PRIVATE_TREE_ID, visibility: 'private' } });
  const r1 = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: PRIVATE_TREE_ID }), READ_ENV, 'rid-d6a', { executorOverride: e1 });
  assert.equal(r1.status, 404);
  assert.equal((await r1.json()).detail, 'Tree not found');
  // missing
  const { executor: e2 } = makeReadExecutor({ treeRow: null });
  const r2 = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: OTHER_TREE_ID }), READ_ENV, 'rid-d6b', { executorOverride: e2 });
  assert.equal(r2.status, 404);
  assert.equal((await r2.json()).detail, 'Tree not found');
});

test('D7. invalid pagination cursor -> 400', async () => {
  const mod = await loadModule();
  const resp = await mod.handleTreeCommentReadDirectNeon(
    makeGetRequest({ query: '?cursor=not-base64-json!!!' }),
    READ_ENV,
    'rid-d7',
    { executorOverride: (() => []) }
  );
  assert.equal(resp.status, 400);
  assert.equal((await resp.json()).detail, 'Invalid pagination cursor');
});

test('D8. cursor target mismatch -> 400 (cannot read another tree page)', async () => {
  const mod = await loadModule();
  // Build a valid cursor for a DIFFERENT tree, then request a different tree.
  const { executor } = makeReadExecutor();
  const created = await mod.handleTreeCommentReadDirectNeon(makeGetRequest({ treeId: TREE_ID, query: '?limit=1' }), READ_ENV, 'rid-d8a', {
    executorOverride: async (text, values) => {
      if (text.includes('FROM trees')) return [{ id: TREE_ID, visibility: 'public' }];
      return [{ id: 'c-1', tree_id: TREE_ID, body: 'a', created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' }];
    }
  });
  const body = await created.json();
  const resp = await mod.handleTreeCommentReadDirectNeon(
    makeGetRequest({ treeId: OTHER_TREE_ID, query: `?limit=1&cursor=${encodeURIComponent(body.nextCursor)}` }),
    READ_ENV,
    'rid-d8b',
    { executorOverride: executor }
  );
  assert.equal(resp.status, 400, 'cursor bound to one tree must reject cross-tree use');
});

// ─── E. readiness matrix representation ───────────────────────────────────

test('E1. matrix row present, vocabulary-valid, gate not checked in, proven privilege', async () => {
  const mod = await loadModule();
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const vocab = matrix.classification_vocabulary;
  const row = matrix.routes.find((r) => r.id === 'tree-comment-read');
  assert.ok(row, 'tree-comment-read row exists');
  assert.equal(row.source_helper, 'functions/_shared/tree-comment-read-direct-neon.js');
  assert.equal(row.runtime_gate, 'LB_TREE_COMMENT_READ_RUNTIME');
  assert.equal(row.method, 'GET');
  assert.equal(row.family, 'READ');
  assert.equal(row.credential_boundary, 'direct_neon_runtime');
  assert.ok(vocab.source_state.includes(row.source_state));
  assert.ok(vocab.privilege_state.includes(row.privilege_state));
  assert.equal(row.privilege_state, 'PRIVILEGE_PROVEN_AT_CITED_SHA');
  assert.equal(row.checked_in_gate, 'NOT_CHECKED_IN');
  assert.equal(row.production_live, 'NOT_PRODUCTION_LIVE');
  assert.deepEqual(row.required_objects, { trees: ['SELECT'], tree_comments: ['SELECT'] });
  const gateInWrangler = fs.readFileSync(path.resolve(REPO_ROOT, 'wrangler.toml'), 'utf8').includes('LB_TREE_COMMENT_READ_RUNTIME');
  assert.equal(gateInWrangler, false, 'gate must NOT be checked into wrangler.toml');
  // the source helper file actually exists on disk
  assert.ok(fs.existsSync(path.resolve(REPO_ROOT, row.source_helper)), 'source helper exists on disk');
});

// ─── F. regression ────────────────────────────────────────────────────────

test('F1. existing write helper still loads; route still exports GET/POST handlers', async () => {
  const writeMod = await import('../../functions/_shared/tree-comment-direct-neon.js');
  assert.equal(typeof writeMod.handleTreeCommentDirectNeon, 'function');
  assert.equal(typeof writeMod.isTreeCommentDirectNeonSelected, 'function');
  const route = await loadRoute();
  assert.equal(typeof route.onRequestGet, 'function');
  assert.equal(typeof route.onRequestPost, 'function');
  // Regression: the GET read gate must NEVER own POST. Under an unset read
  // gate (and no Authorization header) a POST is handled by the existing
  // write/Modal path (cloudflare/modal upstream), never by the direct-neon read
  // adapter. Assert the response is not produced by the read adapter.
  const postResp = await route.onRequestPost({ request: new Request(READ_URL_STR, { method: 'POST', headers: new Headers() }), env: {} });
  assert.notEqual(postResp.headers.get('x-lovebud-upstream'), 'direct-neon', 'read gate does not intercept POST; write path unaffected');
});
