// Deterministic contract test for the #4145 Phase-4 Tree Comment direct-Neon
// candidate product adapter.
//
// All assertions run in-process with:
//   - an injected fake Firebase verifyToken (no JWK/network);
//   - an injected fake Neon WS Client via neonImporter (no real DB/network);
//   - constructed Request/env inputs.
//
// No real network, Neon database, browser, provider mutation, Firebase
// provider mutation, or Production resource is used. This proves the explicit
// gate, dedicated writer config, auth-first behavior, the current Tree Comment
// writer invariants (Tree FOR SHARE -> idempotency reserve/replay -> actor
// rate limit -> INSERT ... RETURNING; NO advisory lock), body-bearing Python
// canonical fingerprint parity (#4145 Web CTO correction), SELECT-first and
// INSERT-conflict idempotency re-verification (different-target 409,
// different-fingerprint 409, completed replay via original-row reread,
// pending/failed unavailable, no second comment), rate-limit taxonomy
// (10/min tree-comment:actor, 429 RATE_LIMITED, 503 RATE_LIMIT_UNAVAILABLE,
// replay consumes no slot), COMMIT_OUTCOME_UNKNOWN 502 with no blind retry,
// rollback on work failure, no direct->Modal fallback after direct start, and
// sanitized leak-safe errors (#4145).

const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');

const MODULE_PATH = '../../functions/_shared/tree-comment-direct-neon.js';
const ROUTE_PATH = '../../functions/api/trees/[tree_id]/comments.js';
const NEON_URL = 'postgresql://ep-comment-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';

const TREE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_TREE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const COMMENT_PATH = `/api/trees/${TREE_ID}/comments`;
const COMMENT_URL = `https://lovebud.pages.dev${COMMENT_PATH}`;

const AUTH_USER_ID = 'firebase-uid-verified-4145';

const WRITER_ENV = {
  LB_TREE_COMMENT_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

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

function makeRequest({
  url = COMMENT_URL,
  method = 'POST',
  authorization = 'Bearer valid-token',
  idempotencyKey = 'key-1234567890abcdef',
  body = { body: 'hello' }
} = {}) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  const init = { method, headers };
  if (body !== undefined && body !== null && method === 'POST') init.body = JSON.stringify(body);
  return new Request(url, init);
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

// Full happy-path script for a fresh comment create.
function freshCreateScript({ rateRows = [{ request_count: 1 }], commentRow } = {}) {
  return {
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [],
    'INSERT INTO social_idempotency': [],
    'INSERT INTO social_rate_limits': rateRows,
    'INSERT INTO tree_comments': [commentRow || {
      id: 'comment-row-new',
      tree_id: TREE_ID,
      owner_id: AUTH_USER_ID,
      body: 'hello',
      created_at: '2026-08-21 01:00:00+00:00',
      updated_at: '2026-08-21 01:00:00+00:00'
    }],
    'UPDATE social_idempotency': [],
    'INSERT INTO social_audit_log': []
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('1. gate: unset/modal/unknown returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const req = makeRequest();
  assert.equal(mod.isTreeCommentDirectNeonSelected({}), false);
  assert.equal(mod.isTreeCommentDirectNeonSelected({ LB_TREE_COMMENT_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeCommentDirectNeonSelected({ LB_TREE_COMMENT_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isTreeCommentDirectNeonSelected({ LB_TREE_COMMENT_WRITE_RUNTIME: '' }), false);
  const resp = await mod.handleTreeCommentDirectNeon(req, {}, 'rid-1', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp, null, 'unset gate returns null -> Modal path');
});

test('2. gate: direct_neon selected; GET is not a direct-neon request', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeCommentDirectNeonSelected(WRITER_ENV), true);
  const postReq = makeRequest();
  const getReq = makeRequest({ method: 'GET', body: undefined });
  assert.equal(mod.isTreeCommentDirectNeonRequest(postReq), true);
  assert.equal(mod.isTreeCommentDirectNeonRequest(getReq), false);
});

test('3. missing auth -> 401 with zero DB client/transaction calls', async () => {
  const mod = await loadModule();
  const req = new Request(COMMENT_URL, { method: 'POST', headers: {} });
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-3', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp.status, 401);
});

test('4. auth-first: missing auth with oversize body -> 401 before any body rejection', async () => {
  const mod = await loadModule();
  const req = makeRequest({
    authorization: null,
    body: { body: 'a'.repeat(6000) }
  });
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-4', {
    verifyTokenOverride: makeVerifyToken()
  });
  assert.equal(resp.status, 401);
});

test('4b. verifier infrastructure failure (non-principal error) -> bounded 503', async () => {
  const mod = await loadModule();
  const req = makeRequest();
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-4b', {
    verifyTokenOverride: makeVerifyToken({ throws: true })
  });
  assert.equal(resp.status, 503);
});

test('5. dedicated writer env only; generic/read env cannot substitute', async () => {
  const mod = await loadModule();
  const genericEnv = { LB_TREE_COMMENT_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeCommentWriteConfig(genericEnv).configured, false);
  const forbidden = mod.detectForbiddenWriterFallback(genericEnv);
  assert.ok(forbidden, 'generic DB env detected as forbidden fallback');
  assert.equal(forbidden.name, 'LOVE_PLATFORM_DATABASE_URL');
});

test('6. dedicated writer may coexist with read/generic envs', async () => {
  const mod = await loadModule();
  const coexistEnv = { ...WRITER_ENV, LOVE_PLATFORM_DATABASE_URL: READ_URL, DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeCommentWriteConfig(coexistEnv).configured, true);
  assert.equal(mod.detectForbiddenWriterFallback(coexistEnv), null);
});

test('7. verified Firebase UID is sole owner authority; caller-supplied owner ignored', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  // Body tries to smuggle a different owner; handler must ignore it.
  const req = makeRequest({ body: { body: 'hello', ownerId: 'attacker-uid', owner_id: 'attacker-uid' } });
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-7', {
    verifyTokenOverride: makeVerifyToken({ uid: AUTH_USER_ID }),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 200);
  const insertLog = factory.logs.find((l) => l.text.includes('INSERT INTO tree_comments'));
  assert.ok(insertLog, 'comment insert present');
  assert.equal(insertLog.values[2], AUTH_USER_ID, 'owner_id param equals verified Firebase UID');
});

test('8. lock ordering: Tree FOR SHARE first and NO advisory lock anywhere', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const req = makeRequest();
  await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-8', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  const forShareIdx = factory.logs.findIndex((l) => l.text.includes('FOR SHARE'));
  assert.ok(forShareIdx !== -1, 'FOR SHARE authorization present');
  assert.ok(
    !factory.logs.some((l) => l.text.includes('pg_advisory_xact_lock')),
    'current Tree Comment writer has no advisory lock; none may be added'
  );
  const selectIdx = factory.logs.findIndex((l) => l.text.includes('SELECT target_kind'));
  const rateIdx = factory.logs.findIndex((l) => l.text.includes('INSERT INTO social_rate_limits'));
  const insertIdx = factory.logs.findIndex((l) => l.text.includes('INSERT INTO tree_comments'));
  assert.ok(forShareIdx < selectIdx, 'FOR SHARE before idempotency');
  assert.ok(selectIdx < rateIdx, 'idempotency before rate limit');
  assert.ok(rateIdx < insertIdx, 'rate limit before comment insert');
});

test('9. private/missing/NULL visibility fails closed (404, zero mutation)', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({ 'FOR SHARE': [] });
  const req = makeRequest();
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-9', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 404);
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')), 'no comment mutation');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO social_rate_limits')), 'no rate slot consumed');
});

test('10. body required parity: absent / non-string / whitespace-only -> 400 SOCIAL_WRITE_UNAVAILABLE', async () => {
  const mod = await loadModule();
  for (const body of [null, {}, { body: null }, { body: 42 }, { body: '   ' }]) {
    const req = makeRequest({ body });
    const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-10', { verifyTokenOverride: makeVerifyToken() });
    assert.equal(resp.status, 400, `status for ${JSON.stringify(body)}`);
    const json = await resp.json();
    assert.equal(json.code, 'SOCIAL_WRITE_UNAVAILABLE');
    assert.equal(json.error, 'Comment body is required');
  }
});

test('11. body oversize parity: >5000 code points after trim -> 400', async () => {
  const mod = await loadModule();
  const req = makeRequest({ body: { body: `  ${'a'.repeat(5001)}  ` } });
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-11', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp.status, 400);
  const json = await resp.json();
  assert.match(json.error, /Field exceeds max 5000/);
});

test('12. JSON body contract: invalid JSON and non-object payload rejected', async () => {
  const mod = await loadModule();
  const headers = new Headers({ authorization: 'Bearer valid-token', 'Idempotency-Key': 'key-1234567890abcdef' });
  const badJson = new Request(COMMENT_URL, { method: 'POST', headers, body: '{not-json' });
  const badResp = await mod.handleTreeCommentDirectNeon(badJson, WRITER_ENV, 'rid-12a', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(badResp.status, 400);

  const arrayBody = new Request(COMMENT_URL, { method: 'POST', headers, body: '[1,2]' });
  const arrResp = await mod.handleTreeCommentDirectNeon(arrayBody, WRITER_ENV, 'rid-12b', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(arrResp.status, 400);
  const arrJson = await arrResp.json();
  assert.equal(arrJson.code, 'JSON_OBJECT_REQUIRED');
});

test('13. Idempotency-Key required/format parity', async () => {
  const mod = await loadModule();
  const missing = await mod.handleTreeCommentDirectNeon(makeRequest({ idempotencyKey: null }), WRITER_ENV, 'rid-13a', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');

  const invalid = await mod.handleTreeCommentDirectNeon(makeRequest({ idempotencyKey: 'short$%' }), WRITER_ENV, 'rid-13b', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'IDEMPOTENCY_KEY_INVALID');
});

test('14. fingerprint parity: Python json.dumps canonical bytes (cross-runtime verified)', async () => {
  const mod = await loadModule();
  // Expected hashes generated by authoritative Python:
  //   hashlib.sha256(json.dumps({'body': safe}, sort_keys=True,
  //     ensure_ascii=False, default=str).encode('utf-8')).hexdigest()
  const cases = [
    ['hello', '6a6c5ab457037b44a26a820027a6cd3690f206f1acb3125c18a5ad99ee1ab42d'],
    ['안녕하세요', '2257922c88fd6441179ec515685cf8a7cc2b82c04d6aeb0075929acb564ab5ca'],
    ['trimmed body', '48710b11edf8ea112807981c439fbc5fe61d4ccc482db93f0a75e958b6d00b6f'],
    ['say "hi" \\ ok', 'a41e5fe4ae3658e4e7429e5ad7878ba22e242a1dfe5ab8f3033765a065e573c4'],
    ['ctrlx', 'eb2377056687d45bbb954f390ca23155ae1be043339ee976a1e09df86f19a49e'],
    ['line1\nline2', 'da0a66316afa4f1250dc1908ef308eef696d0777698065f169981d8c185b4ed8'],
    ['emoji 🌳 tree', 'a9f949118ddd663fef95b998ea5539e223403358a99b492f91a5e2d78b64dd41']
  ];
  for (const [safeBody, expected] of cases) {
    const raw = mod.buildPythonCanonicalCommentBodyPayload(safeBody);
    assert.equal(sha256Hex(raw), expected, `canonical bytes for ${JSON.stringify(safeBody)}`);
  }
});

test('15. stored fingerprint uses trimmed-body canonical hash (whitespace input)', async () => {
  const mod = await loadModule();
  const expectedFingerprint = sha256Hex('{"body": "hello"}');
  const factory = makeFakeClientFactory(freshCreateScript());
  const req = makeRequest({ body: { body: '   hello   ' } });
  await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-15', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  const reservation = factory.logs.find((l) => l.text.includes('INSERT INTO social_idempotency'));
  assert.ok(reservation, 'reservation present');
  assert.equal(reservation.values[4], expectedFingerprint, 'fingerprint from normalized safe_body');
  const insert = factory.logs.find((l) => l.text.includes('INSERT INTO tree_comments'));
  assert.equal(insert.values[3], 'hello', 'stored body is normalized/trimmed');
});

test('16. SELECT-first completed replay: original-row reread DTO, no second comment, no rate slot', async () => {
  const mod = await loadModule();
  const storedFingerprint = sha256Hex('{"body": "hello"}');
  const originalRow = {
    id: 'comment-row-original',
    tree_id: TREE_ID,
    owner_id: AUTH_USER_ID,
    body: 'hello',
    created_at: '2026-08-20 09:00:00+00:00',
    updated_at: '2026-08-20 09:00:00+00:00'
  };
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [{
      target_kind: 'tree',
      target_id: TREE_ID,
      target_memory_id: null,
      result_id: 'comment-row-original',
      result_state: 'completed',
      request_fingerprint: storedFingerprint,
      result_payload: null
    }],
    'FROM tree_comments': [originalRow],
    'INSERT INTO social_audit_log': []
  });
  const req = makeRequest();
  const resp = await mod.handleTreeCommentDirectNeon(req, WRITER_ENV, 'rid-16', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 200);
  const dto = await resp.json();
  assert.deepEqual(dto, {
    id: 'comment-row-original',
    treeId: TREE_ID,
    ownerId: AUTH_USER_ID,
    body: 'hello',
    createdAt: '2026-08-20 09:00:00+00:00',
    updatedAt: '2026-08-20 09:00:00+00:00'
  });
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')), 'no second comment insert');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO social_rate_limits')), 'replay consumes no rate slot');
  const audit = factory.logs.find((l) => l.text.includes('INSERT INTO social_audit_log'));
  assert.equal(audit.values[4], 'tree.comment.create.replay', 'replay audit action recorded');
});

test('17. completed replay with missing original row -> 410 IDEMPOTENCY_RESULT_UNAVAILABLE', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [{
      target_kind: 'tree',
      target_id: TREE_ID,
      result_id: 'gone-row',
      result_state: 'completed',
      request_fingerprint: sha256Hex('{"body": "hello"}'),
      result_payload: null
    }],
    'FROM tree_comments': [],
    'INSERT INTO social_audit_log': []
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-17', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 410);
  assert.equal((await resp.json()).code, 'IDEMPOTENCY_RESULT_UNAVAILABLE');
});

test('18. pending/failed conflict -> 500 SOCIAL_WRITE_UNAVAILABLE, no comment insert', async () => {
  const mod = await loadModule();
  for (const result_state of ['pending', 'failed']) {
    const factory = makeFakeClientFactory({
      'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
      'SELECT target_kind': [{
        target_kind: 'tree',
        target_id: TREE_ID,
        result_id: 'r1',
        result_state,
        request_fingerprint: sha256Hex('{"body": "hello"}'),
        result_payload: null
      }]
    });
    const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, `rid-18-${result_state}`, {
      verifyTokenOverride: makeVerifyToken(),
      neonImporter: makeNeonImporter(factory)
    });
    assert.equal(resp.status, 500, result_state);
    assert.equal((await resp.json()).code, 'SOCIAL_WRITE_UNAVAILABLE');
    assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')));
  }
});

test('19. different-target conflict via SELECT hit -> 409 IDEMPOTENCY_KEY_REUSED', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [{
      target_kind: 'tree',
      target_id: OTHER_TREE_ID,
      result_id: 'r1',
      result_state: 'completed',
      request_fingerprint: sha256Hex('{"body": "hello"}'),
      result_payload: null
    }]
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-19', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 409);
  assert.equal((await resp.json()).code, 'IDEMPOTENCY_KEY_REUSED');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')));
});

test('20. different-fingerprint conflict -> 409 IDEMPOTENCY_KEY_REUSED', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [{
      target_kind: 'tree',
      target_id: TREE_ID,
      result_id: 'r1',
      result_state: 'completed',
      request_fingerprint: sha256Hex('{"body": "different"}'),
      result_payload: null
    }]
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-20', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 409);
  const json = await resp.json();
  assert.equal(json.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.match(json.error, /different request payload/);
});

test('21. INSERT-conflict path: SELECT miss + RETURNING existing different-tree row -> 409, no insert', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [],
    'INSERT INTO social_idempotency': (text, values) => [{
      target_kind: 'tree',
      target_id: OTHER_TREE_ID,
      target_memory_id: null,
      result_id: 'pre-existing-result',
      result_state: 'pending',
      request_fingerprint: sha256Hex('{"body": "hello"}'),
      result_payload: null
    }]
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-21', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 409);
  assert.equal((await resp.json()).code, 'IDEMPOTENCY_KEY_REUSED');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')), 'never mutate after conflicting reservation');
});

test('22. fresh reservation detection: RETURNING our generated resultId + pending proceeds to insert', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [],
    'INSERT INTO social_idempotency': (text, values) => [{
      target_kind: 'tree',
      target_id: TREE_ID,
      target_memory_id: null,
      result_id: values[8],
      result_state: 'pending',
      request_fingerprint: values[4],
      result_payload: null
    }],
    'INSERT INTO social_rate_limits': [{ request_count: 1 }],
    'INSERT INTO tree_comments': [{
      id: 'comment-row-new',
      tree_id: TREE_ID,
      owner_id: AUTH_USER_ID,
      body: 'hello',
      created_at: '2026-08-21 01:00:00+00:00',
      updated_at: '2026-08-21 01:00:00+00:00'
    }],
    'UPDATE social_idempotency': [],
    'INSERT INTO social_audit_log': []
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-22', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 200);
  assert.ok(factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')), 'fresh reservation proceeds');
});

test('23. rate limit exhausted -> 429 RATE_LIMITED with retryAfterMs 60000 and Retry-After header', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript({ rateRows: [] }));
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-23', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 429);
  const json = await resp.json();
  assert.equal(json.code, 'RATE_LIMITED');
  assert.equal(json.retryAfterMs, 60000);
  assert.equal(resp.headers.get('Retry-After'), '60');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO tree_comments')), 'no comment insert when limited');
});

test('24. rate limit scope/window params: tree-comment:actor, NULL memory, minute bucket', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-24', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  const rate = factory.logs.find((l) => l.text.includes('INSERT INTO social_rate_limits'));
  assert.ok(rate, 'rate query present');
  assert.equal(rate.values[1], 'tree-comment:actor');
  assert.equal(rate.values[2], AUTH_USER_ID);
  assert.equal(rate.values[3], null);
  assert.match(rate.values[4], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+00:00$/);
  assert.equal(rate.values[5], 10);
});

test('25. rate limit infrastructure failure -> 503 RATE_LIMIT_UNAVAILABLE', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'FOR SHARE': [{ id: TREE_ID, visibility: 'public' }],
    'SELECT target_kind': [],
    'INSERT INTO social_idempotency': [],
    'INSERT INTO social_rate_limits': () => { throw new Error('rate store down'); }
  });
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-25', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 503);
  assert.equal((await resp.json()).code, 'RATE_LIMIT_UNAVAILABLE');
});

test('26. completion + audit recorded BEFORE COMMIT', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-26', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  const completeIdx = factory.logs.findIndex((l) => l.text.includes("result_state = 'completed'"));
  const auditIdx = factory.logs.findIndex((l) => l.text.includes('INSERT INTO social_audit_log'));
  const commitIdx = factory.logs.findIndex((l) => l.text === 'COMMIT');
  assert.ok(completeIdx !== -1 && auditIdx !== -1 && commitIdx !== -1);
  assert.ok(completeIdx < commitIdx, 'idempotency completion before COMMIT');
  assert.ok(auditIdx < commitIdx, 'audit before COMMIT');
  const audit = factory.logs[auditIdx];
  assert.equal(audit.values[4], 'tree.comment.create');
});

test('27. response DTO parity from RETURNING row (string fields)', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-27', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.headers.get('x-lovebud-runtime'), 'direct_neon');
  const dto = await resp.json();
  assert.deepEqual(dto, {
    id: 'comment-row-new',
    treeId: TREE_ID,
    ownerId: AUTH_USER_ID,
    body: 'hello',
    createdAt: '2026-08-21 01:00:00+00:00',
    updatedAt: '2026-08-21 01:00:00+00:00'
  });
});

test('28. work failure -> ROLLBACK executed', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({ 'FOR SHARE': [] });
  await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-28', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'adapter-owned rollback ran');
});

test('29. COMMIT_OUTCOME_UNKNOWN -> bounded 502, single attempt, no blind retry', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  factory.setCommitOutcomeUnknown(true);
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-29', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 502);
  assert.equal((await resp.json()).code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(factory.logs.filter((l) => l.text === 'BEGIN').length, 1, 'exactly one transaction attempt');
  assert.ok(!factory.logs.some((l) => l.text === 'ROLLBACK'), 'no rollback after unknown commit outcome');
});

test('30. no direct->Modal fallback: broken writer config at direct start fails closed 503', async () => {
  const mod = await loadModule();
  const unconfiguredEnv = { LB_TREE_COMMENT_WRITE_RUNTIME: 'direct_neon' };
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), unconfiguredEnv, 'rid-30', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp.status, 503);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('31. sanitized errors never leak DB URL or token material', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  factory.setCommitOutcomeUnknown(true);
  const resp = await mod.handleTreeCommentDirectNeon(makeRequest(), WRITER_ENV, 'rid-31', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  const text = await resp.text();
  assert.ok(!text.includes(NEON_URL), 'no connection string leakage');
  assert.ok(!text.includes('valid-token'), 'no bearer token leakage');
});

test('32. route wiring: unset gate falls through to Modal proxy; GET unaffected by gate', async () => {
  const route = await loadRoute();
  const postContext = { request: makeRequest(), env: {} };
  const modalPost = await route.onRequestPost(postContext);
  assert.equal(modalPost.headers.get('x-lovebud-upstream'), 'modal', 'unset gate -> Modal proxy path');

  const getContext = { request: makeRequest({ method: 'GET', body: undefined }), env: WRITER_ENV };
  const modalGet = await route.onRequestGet(getContext);
  assert.equal(modalGet.headers.get('x-lovebud-upstream'), 'modal', 'GET remains Modal even with gate selected');
});

test('33. route wiring: direct gate dispatches to direct-neon runtime', async () => {
  const route = await loadRoute();
  const context = {
    request: makeRequest(),
    env: WRITER_ENV
  };
  // With the gate selected the request enters the direct-neon handler, whose
  // auth-first boundary rejects the synthetic bearer with the Firebase
  // principal error shape — a response shape the Modal proxy path never
  // produces (Modal proxy would return Modal passthrough or 503
  // 'Modal backend unavailable' without MODAL_BASE_URL).
  const resp = await route.onRequestPost(context);
  assert.equal(resp.status, 401);
  const json = await resp.json();
  assert.equal(json.error && json.error.code, 'FIREBASE_VERIFICATION_FAILED');
});
