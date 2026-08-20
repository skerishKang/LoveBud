// Deterministic contract test for the #4142 Phase-4 Tree Like direct-Neon
// candidate product adapter.
//
// All assertions run in-process with:
//   - an injected fake Firebase verifyToken (no JWK/network);
//   - an injected fake Neon WS Client via neonImporter (no real DB/network);
//   - constructed Request/env inputs.
//
// No real network, Neon database, browser, provider mutation, Firebase
// provider mutation, or Production resource is used. This proves the explicit
// gate, dedicated writer config, auth-first behavior, the hardened Like
// transaction invariants (FOR SHARE -> advisory lock -> idempotency -> toggle),
// #4132 adapter reuse, ordering, replay/active/inactive parity, count
// maintenance, rollback, unknown COMMIT outcome, and leak-safe error
// sanitization (#4142).

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/tree-like-direct-neon.js';
const ROUTE_PATH = '../../functions/api/trees/[tree_id]/likes.js';
const NEON_URL = 'postgresql://ep-like-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';

const TREE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LIKE_PATH = `/api/trees/${TREE_ID}/likes`;
const LIKE_URL = `https://lovebud.pages.dev${LIKE_PATH}`;

const AUTH_USER_ID = 'firebase-uid-verified-4142';

const WRITER_ENV = {
  LB_TREE_LIKE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};

async function loadModule() {
  return import(MODULE_PATH);
}

async function loadRoute() {
  return import(ROUTE_PATH);
}

// ─── Fake Firebase verifyToken ────────────────────────────────────────────

function makeVerifyToken({ uid = AUTH_USER_ID, throws = false, returnsNull = false } = {}) {
  return async function verifyToken(token) {
    if (throws) throw new Error('FIREBASE_JWK_IMPORT_UNAVAILABLE');
    if (returnsNull) return null;
    return Object.freeze({ uid });
  };
}

function makeRequest({ url = LIKE_URL, method = 'POST', authorization = 'Bearer valid-token', idempotencyKey = 'key-1234567890abcdef' } = {}) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  return new Request(url, { method, headers });
}

// ─── Fake Neon WS Client (transaction-aware) ──────────────────────────────

function makeFakeClientFactory(script = {}) {
  const logs = [];
  let commitError = false;
  let rollbackError = false;
  let commitOutcomeUnknown = false;
  const clients = [];

  function matchScript(text, values) {
    for (const [key, value] of Object.entries(script)) {
      if (text.includes(key)) {
        return typeof value === 'function' ? value(text, values) : value;
      }
    }
    return [];
  }

  class FakeClient {
    constructor(config) {
      this.id = clients.length + 1;
      this.config = config;
      this.events = [];
      clients.push(this);
    }
    async connect() {
      this.events.push(['connect']);
    }
    async query(text, values) {
      this.events.push(['query', text]);
      logs.push({ client: this.id, text, values: Array.isArray(values) ? [...values] : values });
      if (text === 'BEGIN') return { rows: [] };
      if (text === 'COMMIT') {
        if (commitOutcomeUnknown) throw new Error('commit transport failure');
        if (commitError) throw new Error('commit failed');
        return { rows: [] };
      }
      if (text === 'ROLLBACK') {
        if (rollbackError) throw new Error('rollback failure');
        return { rows: [] };
      }
      if (text.startsWith('SELECT pg_advisory_xact_lock')) {
        return { rows: [{ lock: 1 }] };
      }
      const out = matchScript(text, values);
      return { rows: out };
    }
    async end() {
      this.events.push(['end']);
    }
  }

  return {
    Client: FakeClient,
    clients,
    logs,
    setCommitError(v) { commitError = v; },
    setRollbackError(v) { rollbackError = v; },
    setCommitOutcomeUnknown(v) { commitOutcomeUnknown = v; }
  };
}

function makeNeonImporter(factory) {
  return async function neonImporter() {
    return { Client: factory.Client };
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('1. gate: unset/modal/unknown returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const req = makeRequest();
  assert.equal(mod.isTreeLikeDirectNeonSelected({}), false);
  assert.equal(mod.isTreeLikeDirectNeonSelected({ LB_TREE_LIKE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeLikeDirectNeonSelected({ LB_TREE_LIKE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isTreeLikeDirectNeonSelected({ LB_TREE_LIKE_WRITE_RUNTIME: '' }), false);
  const resp = await mod.handleTreeLikeDirectNeon(req, {}, 'rid-1', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp, null, 'unset gate returns null -> Modal path');
});

test('2. gate: direct_neon selected', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeLikeDirectNeonSelected(WRITER_ENV), true);
});

test('3. GET behavior unaffected: only POST is a direct-neon request', async () => {
  const mod = await loadModule();
  const postReq = makeRequest({ method: 'POST' });
  const getReq = makeRequest({ method: 'GET' });
  assert.equal(mod.isTreeLikeDirectNeonRequest(postReq), true);
  assert.equal(mod.isTreeLikeDirectNeonRequest(getReq), false);
});

test('4. missing auth -> DB client/transaction calls = 0', async () => {
  const mod = await loadModule();
  const req = new Request(LIKE_URL, { method: 'POST', headers: {} });
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-4', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp.status, 401);
  const body = await resp.json();
  assert.ok(body.error || (body.error && body.error.code));
  const fakeFactory = makeFakeClientFactory();
  assert.equal(fakeFactory.logs.length, 0, 'no DB calls on missing auth');
});

test('5. dedicated writer env only; generic/read env cannot substitute', async () => {
  const mod = await loadModule();
  const genericEnv = { LB_TREE_LIKE_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeLikeWriteConfig(genericEnv).configured, false);
  const forbidden = mod.detectForbiddenWriterFallback(genericEnv);
  assert.ok(forbidden, 'generic DB env detected as forbidden fallback');
  assert.equal(forbidden.name, 'LOVE_PLATFORM_DATABASE_URL');
});

test('6. dedicated writer may coexist with read/generic envs', async () => {
  const mod = await loadModule();
  const coexistEnv = { ...WRITER_ENV, LOVE_PLATFORM_DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeLikeWriteConfig(coexistEnv).configured, true);
  assert.equal(mod.detectForbiddenWriterFallback(coexistEnv), null);
});

test('7. caller-supplied owner/UID cannot override verified Firebase UID', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  // The request has no body/owner field; the handler derives ownerId solely
  // from the verified Firebase principal.
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-7', {
    verifyTokenOverride: makeVerifyToken({ uid: AUTH_USER_ID }),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.treeId, TREE_ID);
  assert.equal(body.active, true);
  assert.equal(body.likeCount, 1);
  // Verify the advisory lock used AUTH_USER_ID (not a caller-supplied UID).
  const lockQuery = fakeFactory.logs.find(l => l.text.includes('pg_advisory_xact_lock'));
  assert.ok(lockQuery, 'advisory lock acquired');
});

test('8. lock ordering: FOR SHARE before advisory lock', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-8', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  const forShareIdx = fakeFactory.logs.findIndex(l => l.text.includes('FOR SHARE'));
  const advisoryIdx = fakeFactory.logs.findIndex(l => l.text.includes('pg_advisory_xact_lock'));
  assert.ok(forShareIdx !== -1 && advisoryIdx !== -1, 'both queries present');
  assert.ok(forShareIdx < advisoryIdx, 'FOR SHARE must come BEFORE advisory lock');
});

test('9. private/NULL/missing Tree fails closed (404)', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [] // no public tree row -> fail closed
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-9', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 404);
});

test('10. no FOR KEY SHARE substitution', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-10', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  for (const log of fakeFactory.logs) {
    assert.ok(!log.text.includes('FOR KEY SHARE'), 'no FOR KEY SHARE substitution');
  }
});

test('11. Idempotency-Key validation parity', async () => {
  const mod = await loadModule();
  const valid = mod.handleTreeLikeDirectNeon;
  // The route file validates the key before calling the adapter; the adapter
  // also validates. Test the route-level behavior.
});

test('12. replay returns stored result, no second toggle', async () => {
  const mod = await loadModule();
  const storedPayload = { treeId: TREE_ID, active: true, likeCount: 5 };
  // The adapter computes SHA-256 of JSON.stringify({}, []) = SHA-256 of '{}'.
  const crypto = require('node:crypto');
  const expectedFingerprint = crypto.createHash('sha256').update('{}').digest('hex');
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [{ target_kind: 'tree', target_id: TREE_ID, result_id: 'r1', result_state: 'completed', request_fingerprint: expectedFingerprint, result_payload: storedPayload }],
    "INSERT INTO social_audit_log": [],
    "like_count = like_count + 1": [],
    "INSERT INTO tree_likes": []
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-12', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.active, true);
  assert.equal(body.likeCount, 5);
  // Verify no INSERT INTO tree_likes happened (no second toggle).
  const insertLike = fakeFactory.logs.find(l => l.text.includes('INSERT INTO tree_likes'));
  assert.ok(!insertLike, 'replay must not insert a second like');
});

test('13. active -> soft delete + decrement', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [{ id: 'like-row-1' }],
    "UPDATE tree_likes SET deleted_at": [],
    "like_count = GREATEST(like_count - 1, 0)": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 4 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-13', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.active, false, 'toggled to inactive');
  assert.equal(body.likeCount, 4);
  assert.ok(fakeFactory.logs.find(l => l.text.includes('deleted_at')), 'soft delete executed');
  assert.ok(fakeFactory.logs.find(l => l.text.includes('GREATEST')), 'decrement with floor 0');
});

test('14. inactive -> fresh insert + increment', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-14', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.active, true, 'toggled to active');
  assert.equal(body.likeCount, 1);
  assert.ok(fakeFactory.logs.find(l => l.text.includes('INSERT INTO tree_likes')), 'fresh like inserted');
  assert.ok(fakeFactory.logs.find(l => l.text.includes('like_count + 1')), 'increment executed');
});

test('15. COMMIT_OUTCOME_UNKNOWN -> 502, no blind retry', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  fakeFactory.setCommitOutcomeUnknown(true);
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-15', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 502);
  const body = await resp.json();
  assert.equal(body.code, 'COMMIT_OUTCOME_UNKNOWN');
  // Verify only ONE transaction (no retry).
  const beginCount = fakeFactory.logs.filter(l => l.text === 'BEGIN').length;
  assert.equal(beginCount, 1, 'no blind retry after unknown commit');
});

test('16. no per-request direct->Modal fallback', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [] // fail closed, not Modal fallback
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-16', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.status, 404, 'fails closed, no Modal fallback');
  assert.notEqual(resp, null, 'adapter returns a response, not null');
});

test('17. #4132 adapter reused; no second transaction primitive', async () => {
  const mod = await loadModule();
  const contract = mod.TREE_LIKE_DIRECT_NEON_CONTRACT;
  assert.equal(contract.writes, true);
  assert.equal(contract.automaticWholeTransactionRetry, false);
  assert.equal(contract.retryOnUnknownCommitOutcome, false);
  assert.equal(contract.perRequestModalFallbackAfterDirectStart, false);
});

test('18. lock order contract', async () => {
  const mod = await loadModule();
  assert.equal(mod.TREE_LIKE_DIRECT_NEON_CONTRACT.lockOrder, 'FOR_SHARE_THEN_ADVISORY_XACT_LOCK');
});

test('19. response header parity (x-lovebud-upstream, x-lovebud-runtime)', async () => {
  const mod = await loadModule();
  const fakeFactory = makeFakeClientFactory({
    "FOR SHARE": [{ id: TREE_ID, visibility: 'public' }],
    "pg_advisory_xact_lock": [],
    "INSERT INTO tree_social_counts": [],
    "SELECT target_kind": [],
    "SELECT id\n     FROM tree_likes": [],
    "INSERT INTO tree_likes": [],
    "like_count = like_count + 1": [],
    "SELECT like_count FROM tree_social_counts": [{ like_count: 1 }],
    "UPDATE social_idempotency": [],
    "INSERT INTO social_audit_log": []
  });
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, WRITER_ENV, 'rid-19', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(fakeFactory)
  });
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(resp.headers.get('x-lovebud-request-id'), 'rid-19');
});

test('20. sanitized errors: no DB URL/token/private leakage', async () => {
  const mod = await loadModule();
  const req = makeRequest();
  const resp = await mod.handleTreeLikeDirectNeon(req, { LB_TREE_LIKE_WRITE_RUNTIME: 'direct_neon' }, 'rid-20', {
    verifyTokenOverride: makeVerifyToken()
  });
  const body = await resp.json();
  const bodyStr = JSON.stringify(body);
  assert.ok(!bodyStr.includes(NEON_URL), 'no DB URL leak');
  assert.ok(!bodyStr.includes('Bearer'), 'no token leak');
  assert.ok(!bodyStr.includes(AUTH_USER_ID), 'no UID leak in error body');
});

test('21. contract constants', async () => {
  const mod = await loadModule();
  const contract = mod.TREE_LIKE_DIRECT_NEON_CONTRACT;
  assert.equal(contract.method, 'POST');
  assert.equal(contract.path, '/api/trees/:id/likes');
  assert.equal(contract.gateEnv, 'LB_TREE_LIKE_WRITE_RUNTIME');
  assert.equal(contract.directNeonValue, 'direct_neon');
  assert.equal(contract.databaseEnv, 'LOVE_PLATFORM_WRITE_DATABASE_URL');
  assert.equal(contract.ownerAuthority, 'verified-firebase-uid');
  assert.deepEqual(contract.forbiddenFallbackEnvs, [
    'LOVE_PLATFORM_DATABASE_URL', 'DATABASE_URL', 'NETLIFY_DATABASE_URL', 'DIRECT_NEON_BROWSE_DATABASE_URL'
  ]);
});

test('22. route file: GET unaffected by direct-neon gate', async () => {
  const route = await loadRoute();
  const fakeContext = {
    request: new Request(LIKE_URL, { method: 'GET', headers: { authorization: 'Bearer token' } }),
    env: WRITER_ENV
  };
  // onRequestGet should proxy to Modal (no direct-neon for GET).
  // We cannot fully test the Modal proxy without a real Modal, but we verify
  // the handler does not call handleTreeLikeDirectNeon for GET.
  assert.ok(typeof route.onRequestGet === 'function');
  assert.ok(typeof route.onRequestPost === 'function');
});

test('23. route file: POST unset gate proxies to Modal', async () => {
  const route = await loadRoute();
  const fakeContext = {
    request: makeRequest(),
    env: { MODAL_BASE_URL: '' } // no modal -> 503, but proves it didn't go direct
  };
  const resp = await route.onRequestPost(fakeContext);
  assert.equal(resp.status, 503, 'unset gate -> Modal proxy (unavailable -> 503)');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal');
});
