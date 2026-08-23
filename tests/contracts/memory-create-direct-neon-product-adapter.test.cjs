// Deterministic contract test for the LOCAL-1 (#4178) Phase-4 explicit-public
// Memory create direct-Neon candidate product adapter.
//
// All assertions run in-process with:
//   - an injected fake Firebase verifyToken (no JWK/network);
//   - an injected fake Neon WS Client via neonImporter (no real DB/network);
//   - constructed Request/env inputs;
//   - a stubbed global fetch for the memories.js route Modal fall-through tests.
//
// No real network, Neon database, browser, provider mutation, Firebase/Neon
// Auth provider mutation, or Production resource is used. This proves the
// explicit gate and public-only route split (omitted/null/private/other ->
// null with zero DB clients BEFORE any direct DB contact), auth-before-DB,
// UID spoofing rejection, object-only bounded body parsing, strict scalar
// validation before ANY mutation (#3287/#3935/#4058 parity), legacy
// localization key guard parity on the gated path, parent Tree ownership 403,
// parentId same-tree FOR KEY SHARE membership (INVALID_PARENT_ID), the #4058
// clientKey contract incl. the 501 schema-not-activated boundary, idempotent
// convergence for concurrent same treeId+clientKey via ON CONFLICT DO NOTHING
// + canonical reread, canonical-reread-only response assembly (no request-
// payload echo), timestamp ::text projection, exact DTO keys with conditional
// clientKey, rollback on work failure, COMMIT_OUTCOME_UNKNOWN 502 with a
// single attempt and no blind retry, sanitized leak-safe errors, and route
// fall-through that preserves the buffered body (#4178).

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/memory-create-direct-neon.js';
const ROUTE_PATH = '../../functions/api/memories.js';
const NEON_URL = 'postgresql://ep-memory-create-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';
const MODAL_URL = 'https://modal.example';

const CREATE_PATH = '/api/memories';
const CREATE_URL = `https://lovebud.pages.dev${CREATE_PATH}`;
const SUBPATH_URL = 'https://lovebud.pages.dev/api/memories/some-memory';

const AUTH_USER_ID = 'firebase-uid-verified-4178';
const TREE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_MEMORY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const WRITER_ENV = {
  LB_MEMORY_CREATE_WRITE_RUNTIME: 'direct_neon',
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

function makeRequest({
  url = CREATE_URL,
  method = 'POST',
  authorization = 'Bearer valid-token',
  body = { treeId: TREE_ID, visibility: 'public', title: 'hello' }
} = {}) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  const init = { method, headers };
  if (body !== undefined && body !== null && method === 'POST') init.body = JSON.stringify(body);
  return new Request(url, init);
}

// ─── Fake Neon WS Client (transaction-aware) ──────────────────────────────

function makeMemoryRow(overrides = {}) {
  return {
    id: OTHER_MEMORY_ID,
    tree_id: TREE_ID,
    parent_id: null,
    title: 'db title',
    memo: '',
    artist: '',
    source: '',
    source_url: '',
    source_type: 'youtube',
    thumbnail: '',
    emotion_tags: [],
    timestamp: '',
    visibility: 'public',
    channel_id: null,
    channel_name: null,
    channel_url: null,
    client_key: null,
    created_at: '2026-08-23 05:06:07.654321+00:00',
    updated_at: '2026-08-23 05:06:07.654321+00:00',
    tree_owner_id: AUTH_USER_ID,
    ...overrides
  };
}

const DEFAULT_SCRIPT = () => ({
  'FROM trees': [{ id: TREE_ID, visibility: 'public' }],
  'FOR KEY SHARE;': [],
  // capability probe returns one row -> client_key column present
  "column_name = 'client_key'": [{ column_name: 'client_key' }],
  'INSERT INTO memories': [{ id: 'fresh-memory-row-id' }],
  'INNER JOIN trees t ON t.id = m.tree_id': [makeMemoryRow({ id: 'fresh-memory-row-id' })]
});

function makeFakeClientFactory(script = {}) {
  const logs = [];
  let commitError = false;
  let rollbackError = false;
  let commitOutcomeUnknown = false;
  let failOnQueryMatch = null;
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
      if (failOnQueryMatch && text.includes(failOnQueryMatch)) {
        throw new Error('simulated query failure');
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
    setCommitOutcomeUnknown(v) { commitOutcomeUnknown = v; },
    setFailOnQueryMatch(v) { failOnQueryMatch = v; }
  };
}

function makeNeonImporter(factory) {
  return async function neonImporter() {
    return { Client: factory.Client };
  };
}

async function runCandidate(mod, factory, body, requestId = 'rid') {
  return mod.handleMemoryCreateDirectNeon(
    makeRequest({ body }),
    WRITER_ENV,
    requestId,
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
}

// ─── Gate / route selection ───────────────────────────────────────────────

test('1. gate: unset/modal/unknown returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  assert.equal(mod.isMemoryCreateDirectNeonSelected({}), false);
  assert.equal(mod.isMemoryCreateDirectNeonSelected({ LB_MEMORY_CREATE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isMemoryCreateDirectNeonSelected({ LB_MEMORY_CREATE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isMemoryCreateDirectNeonSelected({ LB_MEMORY_CREATE_WRITE_RUNTIME: '' }), false);
  assert.equal(mod.isMemoryCreateDirectNeonSelected({ LB_MEMORY_CREATE_WRITE_RUNTIME: ' direct_neon ' }), true);
  const resp = await mod.handleMemoryCreateDirectNeon(makeRequest(), {}, 'rid-1', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp, null, 'unset gate returns null -> Modal path');
});

test('2. gate: POST /api/memories is a direct request; subpaths are not', async () => {
  const mod = await loadModule();
  assert.equal(mod.isMemoryCreateDirectNeonRequest(makeRequest()), true);
  assert.equal(mod.isMemoryCreateDirectNeonRequest(makeRequest({ url: `${CREATE_URL}/` })), true);
  assert.equal(mod.isMemoryCreateDirectNeonRequest(makeRequest({ url: SUBPATH_URL })), false);
  assert.equal(mod.isMemoryCreateDirectNeonRequest(makeRequest({ method: 'GET', body: undefined })), false);
});

// ─── Public-only route split (zero DB before deferral) ───────────────────

test('3. non-public visibility defers to Modal with zero DB clients', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  for (const visibility of [undefined, null, 'private', 'Public', 'PRIVATE', 123, true]) {
    const body = { treeId: TREE_ID, title: 't' };
    if (visibility !== undefined) body.visibility = visibility;
    const resp = await mod.handleMemoryCreateDirectNeon(
      makeRequest({ body }),
      WRITER_ENV,
      'rid-3',
      { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
    );
    assert.equal(resp, null, `visibility ${JSON.stringify(visibility)} defers to Modal`);
  }
  assert.equal(factory.clients.length, 0, 'no DB client for deferred requests');
  assert.equal(factory.logs.length, 0, 'zero DB queries for deferred requests');
});

// ─── Auth boundary (before any DB capability) ────────────────────────────

test('4. auth failures return before any DB client construction (explicit public)', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const publicBody = { treeId: TREE_ID, visibility: 'public', title: 't' };
  const missing = await mod.handleMemoryCreateDirectNeon(
    new Request(CREATE_URL, {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify(publicBody)
    }),
    WRITER_ENV,
    'rid-4a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(missing.status, 401);
  const invalid = await mod.handleMemoryCreateDirectNeon(
    makeRequest({ body: publicBody }),
    WRITER_ENV,
    'rid-4b',
    { verifyTokenOverride: makeVerifyToken({ returnsNull: true }), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(invalid.status, 401);
  const unavailable = await mod.handleMemoryCreateDirectNeon(
    makeRequest({ body: publicBody }),
    WRITER_ENV,
    'rid-4c',
    { verifyTokenOverride: makeVerifyToken({ throws: true }), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(unavailable.status, 503);
  assert.equal(factory.clients.length, 0, 'no DB client on auth failures');

  // Routing precedes authentication by design: an unauthenticated request
  // WITHOUT explicit public visibility defers to Modal (null) so the caller
  // keeps the exact existing Modal auth error shape.
  const deferred = await mod.handleMemoryCreateDirectNeon(
    new Request(CREATE_URL, { method: 'POST', headers: {} }),
    WRITER_ENV,
    'rid-4d',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(deferred, null, 'non-public body defers before auth');
});

// ─── Body contract ────────────────────────────────────────────────────────

test('5. JSON body contract: invalid JSON / non-object rejected; empty body defaults', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const headers = new Headers({ authorization: 'Bearer valid-token' });
  const badJson = new Request(CREATE_URL, { method: 'POST', headers, body: '{not-json' });
  const badResp = await mod.handleMemoryCreateDirectNeon(badJson, WRITER_ENV, 'rid-5a', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(badResp.status, 400);

  const arrayBody = new Request(CREATE_URL, { method: 'POST', headers, body: '[1]' });
  const arrResp = await mod.handleMemoryCreateDirectNeon(arrayBody, WRITER_ENV, 'rid-5b', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(arrResp.status, 400);
  assert.equal((await arrResp.json()).code, 'JSON_OBJECT_REQUIRED');
  assert.equal(factory.clients.length, 0, 'no DB client for rejected bodies');

  const emptyBody = new Request(CREATE_URL, { method: 'POST', headers, body: '' });
  const emptyResp = await mod.handleMemoryCreateDirectNeon(emptyBody, WRITER_ENV, 'rid-5c', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(emptyResp, null, 'empty body parses as {} -> omitted visibility defers to Modal');
});

// ─── Owner authority / spoofing ──────────────────────────────────────────

test('6. verified Firebase UID is sole owner authority; forged owner fields ignored', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const resp = await runCandidate(mod, factory, {
    treeId: TREE_ID,
    visibility: 'public',
    ownerId: 'attacker-uid',
    owner_id: 'attacker-uid'
  });
  assert.equal(resp.status, 200);
  const ownerQuery = factory.logs.find((l) => l.text.includes('FROM trees'));
  assert.ok(ownerQuery, 'tree ownership query present');
  assert.equal(ownerQuery.values[1], AUTH_USER_ID, 'owner predicate equals verified Firebase UID');
  assert.equal((await resp.json()).ownerId ?? undefined, undefined, 'memory DTO carries no ownerId echo');
});

// ─── Scalar validation before mutation ───────────────────────────────────

test('7. malformed scalars reject with zero mutation (INVALID_MEMORY_SCALAR_TYPE / oversize)', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const nonStringCases = [
    { title: 42 }, { title: true }, { title: [] },
    { memo: {} }, { artist: 7 }, { source: false },
    { sourceUrl: [] }, { sourceType: {} }, { thumbnail: 9 },
    { timestamp: [] }, { channelId: {} }, { channelName: 0 }, { channelUrl: true }
  ];
  for (const extra of nonStringCases) {
    const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public', ...extra });
    assert.equal(resp.status, 400, `status for ${JSON.stringify(extra)}`);
    const json = await resp.json();
    assert.equal(json.code, 'INVALID_MEMORY_SCALAR_TYPE', `code for ${JSON.stringify(extra)}`);
    assert.equal(json.field, Object.keys(extra)[0]);
    assert.equal(json.expected, 'string');
  }
  const oversizeCases = [
    { title: 't'.repeat(201) },
    { memo: 'm'.repeat(5001) },
    { artist: 'a'.repeat(101) },
    { sourceUrl: 'u'.repeat(1001) },
    { thumbnail: 'x'.repeat(501) },
    { timestamp: 't'.repeat(101) },
    { channelUrl: 'c'.repeat(1001) }
  ];
  for (const extra of oversizeCases) {
    const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public', ...extra });
    assert.equal(resp.status, 400, `status for ${JSON.stringify(extra)}`);
    assert.match((await resp.json()).error, /Field exceeds max/);
  }
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO memories')), 'no mutation on malformed scalars');
});

test('8. scalar normalization: trim, sourceType youtube default, channel empties to null', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const resp = await runCandidate(mod, factory, {
    treeId: TREE_ID,
    visibility: 'public',
    title: '  My Memory  ',
    sourceType: '   ',
    channelId: '  ',
    channelName: ''
  });
  assert.equal(resp.status, 200);
  const insertLog = factory.logs.find((l) => l.text.includes('INSERT INTO memories'));
  assert.equal(insertLog.values[3], 'My Memory', 'title trimmed');
  assert.equal(insertLog.values[8], 'youtube', 'sourceType empty -> youtube');
  assert.equal(insertLog.values[12], null, 'channelId empty -> null');
  assert.equal(insertLog.values[13], null, 'channelName empty -> null');
});

test('9. emotionTags contract: array-only, string items, max 20, trim/drop-empty, order kept', async () => {
  const mod = await loadModule();
  const okFactory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const invalidFactory = makeFakeClientFactory(DEFAULT_SCRIPT());

  const ok = await runCandidate(mod, okFactory, {
    treeId: TREE_ID, visibility: 'public', emotionTags: [' 기쁨 ', '', '슬픔']
  });
  assert.equal(ok.status, 200);

  const nonArray = await runCandidate(mod, invalidFactory, { treeId: TREE_ID, visibility: 'public', emotionTags: 'sad' });
  assert.equal(nonArray.status, 400);
  assert.equal((await nonArray.json()).reason, 'array_required');

  const nonStringItem = await runCandidate(mod, invalidFactory, { treeId: TREE_ID, visibility: 'public', emotionTags: ['ok', 5] });
  assert.equal(nonStringItem.status, 400);
  assert.equal((await nonStringItem.json()).reason, 'string_items_required');

  const over20 = await runCandidate(mod, invalidFactory, {
    treeId: TREE_ID, visibility: 'public', emotionTags: Array.from({ length: 21 }, (_, i) => `t${i}`)
  });
  assert.equal(over20.status, 400);
  assert.match((await over20.json()).error, /emotionTags exceeds maximum of 20 items/);

  assert.ok(!invalidFactory.logs.some((l) => l.text.includes('INSERT INTO memories')), 'no mutation on invalid tags');
});

test('10. clientKey contract: omitted->NULL create; empty->NULL; non-string/too-long 400 pre-mutation', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());

  const omitted = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(omitted.status, 200);
  const omittedInsert = factory.logs.find((l) => l.text.includes('INSERT INTO memories'));
  // Modal parity: when the column exists the keyed insert shape is used even
  // for an omitted key; client_key is bound as an explicit NULL parameter.
  assert.ok(omittedInsert.text.includes('client_key'), 'column-capable insert shape used');
  assert.ok(!factory.logs.some((l) => l.text.includes('SELECT id') && l.text.includes('client_key = $2')), 'no idempotency pre-select for omitted key');

  const empty = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public', clientKey: '   ' });
  assert.equal(empty.status, 200, 'empty clientKey treated as omitted');

  const wrongType = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public', clientKey: 42 });
  assert.equal(wrongType.status, 400);
  assert.equal((await wrongType.json()).code, 'CLIENT_KEY_INVALID_TYPE');

  const tooLong = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public', clientKey: 'k'.repeat(101) });
  assert.equal(tooLong.status, 400);
  assert.equal((await tooLong.json()).code, 'CLIENT_KEY_TOO_LONG');

  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO memories') && l.values.length > 16), 'no keyed insert from invalid keys');
});

// ─── Legacy localization key guard parity on gated path ─────────────────

test('11. legacy localization key guard applies on the gated candidate path', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const resp = await runCandidate(mod, factory, {
    treeId: TREE_ID, visibility: 'public', title: 'editor_url_only_youtube_title'
  });
  assert.equal(resp.status, 400);
  const json = await resp.json();
  assert.equal(json.error, 'legacy localization key not allowed');
  assert.equal(json.field, 'title');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO memories')), 'guard precedes mutation');
});

// ─── Tree ownership / parent membership inside transaction ──────────────

test('12. parent Tree not owned by verified UID -> 403 parity with zero mutation', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({ ...DEFAULT_SCRIPT(), 'FROM trees': [] });
  const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(resp.status, 403);
  assert.equal((await resp.json()).error, 'Access denied: not your tree');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO memories')), 'no memory mutation');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on tree-not-owned work failure');
});

test('13. parentId cross-tree / missing -> 400 INVALID_PARENT_ID under FOR KEY SHARE', async () => {
  const mod = await loadModule();
  const crossTree = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    'FOR KEY SHARE;': (text, values) => (
      text.includes('FROM memories')
        ? [{ id: PARENT_ID, tree_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }]
        : []
    )
  });
  const cross = await runCandidate(mod, crossTree, {
    treeId: TREE_ID, visibility: 'public', parentId: PARENT_ID
  });
  assert.equal(cross.status, 400);
  assert.equal((await cross.json()).code, 'INVALID_PARENT_ID');

  const missing = makeFakeClientFactory(DEFAULT_SCRIPT());
  const gone = await runCandidate(mod, missing, {
    treeId: TREE_ID, visibility: 'public', parentId: PARENT_ID
  });
  assert.equal(gone.status, 400);
  assert.equal((await gone.json()).code, 'INVALID_PARENT_ID');
  assert.ok(missing.logs.some((l) => l.text.includes('FOR KEY SHARE')), 'parent locked FOR KEY SHARE before insert');
  assert.ok(!missing.logs.some((l) => l.text.includes('INSERT INTO memories')), 'no insert after parent rejection');
  assert.ok(missing.logs.some((l) => l.text === 'ROLLBACK'));
});

test('14. parentId UUID validation and self-contained happy path ordering', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    'FOR KEY SHARE;': (text) => (
      text.includes('FROM memories') ? [{ id: PARENT_ID, tree_id: TREE_ID }] : []
    ),
    'INNER JOIN trees t ON t.id = m.tree_id': [makeMemoryRow({ id: 'fresh-memory-row-id', parent_id: PARENT_ID })]
  });

  const badParent = await runCandidate(mod, factory, {
    treeId: TREE_ID, visibility: 'public', parentId: 'not-a-uuid'
  });
  assert.equal(badParent.status, 400);
  assert.equal((await badParent.json()).error, 'Invalid parentId');

  const ok = await runCandidate(mod, factory, {
    treeId: TREE_ID, visibility: 'public', parentId: PARENT_ID.toUpperCase()
  });
  assert.equal(ok.status, 200);
  const order = factory.logs.map((l) => l.text);
  const treeIdx = order.findIndex((t) => t.includes('FROM trees'));
  const parentIdx = order.findIndex((t) => t.includes('FOR KEY SHARE') && t.includes('FROM memories'));
  const capIdx = order.findIndex((t) => t.includes("column_name = 'client_key'"));
  const insertIdx = order.findIndex((t) => t.includes('INSERT INTO memories'));
  const rereadIdx = order.findIndex((t) => t.includes('INNER JOIN trees'));
  const commitIdx = order.findIndex((t) => t === 'COMMIT');
  assert.ok(treeIdx < parentIdx, 'tree ownership before parent lock');
  assert.ok(parentIdx < capIdx, 'parent lock before capability probe');
  assert.ok(capIdx < insertIdx, 'capability before insert');
  assert.ok(rereadIdx > insertIdx, 'canonical reread after insert');
  assert.ok(commitIdx > rereadIdx, 'COMMIT after reread verification');
  assert.equal(factory.clients.length, 1, 'one request-scoped Neon client');
});

// ─── #4058 clientKey idempotency ─────────────────────────────────────────

test('15. client_key column unavailable + explicit clientKey -> bounded 501, zero mutation', async () => {
  const mod = await loadModule();
  const noColumn = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    "column_name = 'client_key'": []
  });
  const resp = await runCandidate(mod, noColumn, {
    treeId: TREE_ID, visibility: 'public', clientKey: 'key-1234567890abcdef'
  });
  assert.equal(resp.status, 501);
  const json = await resp.json();
  assert.equal(json.code, 'MEMORY_CLIENT_KEY_SCHEMA_NOT_ACTIVATED');
  assert.match(json.reason, /cannot honor idempotency/);
  assert.ok(!noColumn.logs.some((l) => l.text.includes('INSERT INTO memories')), 'zero mutation on 501');
  assert.ok(noColumn.logs.some((l) => l.text === 'ROLLBACK'));

  // Without an explicit key the compatibility path inserts WITHOUT client_key.
  const compat = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    "column_name = 'client_key'": [],
    'INNER JOIN trees t ON t.id = m.tree_id': [makeMemoryRow({ id: 'fresh-memory-row-id', client_key: null })]
  });
  const compatResp = await runCandidate(mod, compat, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(compatResp.status, 200);
  const compatInsert = compat.logs.find((l) => l.text.includes('INSERT INTO memories'));
  assert.ok(!compatInsert.text.includes('client_key'), 'compatibility insert omits client_key column');
});

test('16. existing same treeId+clientKey converges to the persisted canonical Memory', async () => {
  const mod = await loadModule();
  const existingRow = makeMemoryRow({
    id: 'persisted-canonical-id',
    title: 'persisted title',
    client_key: 'key-1234567890abcdef'
  });
  // Key order matters: the fake client resolves scripts by first matching
  // substring, so the most distinctive selectors come first.
  const factory = makeFakeClientFactory({
    'SELECT id': [{ id: 'persisted-canonical-id' }],
    'FROM trees': [{ id: TREE_ID, visibility: 'public' }],
    "column_name = 'client_key'": [{ column_name: 'client_key' }],
    'WHERE m.tree_id = $1': [existingRow]
  });
  const resp = await runCandidate(mod, factory, {
    treeId: TREE_ID, visibility: 'public', clientKey: 'key-1234567890abcdef', title: 'request title that must NOT be echoed'
  });
  assert.equal(resp.status, 200);
  const dto = await resp.json();
  assert.equal(dto.id, 'persisted-canonical-id');
  assert.equal(dto.title, 'persisted title', 'canonical DB value wins over request payload');
  assert.equal(dto.clientKey, 'key-1234567890abcdef');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO memories')), 'no second INSERT on convergence');
});

test('17. concurrent lost race: INSERT affects zero rows -> canonical reread of winner', async () => {
  const mod = await loadModule();
  const winner = makeMemoryRow({ id: 'winner-canonical-id', client_key: 'race-key-123456789' });
  const factory = makeFakeClientFactory({
    'INSERT INTO memories': [], // ON CONFLICT DO NOTHING -> zero RETURNING rows
    'FROM trees': [{ id: TREE_ID, visibility: 'public' }],
    "column_name = 'client_key'": [{ column_name: 'client_key' }],
    'WHERE m.tree_id = $1': [winner]
  });
  const resp = await runCandidate(mod, factory, {
    treeId: TREE_ID, visibility: 'public', clientKey: 'race-key-123456789', title: 'loser payload'
  });
  assert.equal(resp.status, 200);
  const dto = await resp.json();
  assert.equal(dto.id, 'winner-canonical-id', 'converges to the winning canonical row');
  assert.equal(dto.title, 'db title');
  assert.ok(
    factory.logs.find((l) => l.text.includes('ON CONFLICT (tree_id, client_key) DO NOTHING')),
    'insert uses ON CONFLICT DO NOTHING convergence strategy'
  );
});

// ─── Canonical reread authority / failure paths ──────────────────────────

test('18. canonical reread mismatch/failure -> rollback with bounded error', async () => {
  const mod = await loadModule();

  const emptyReread = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    'INNER JOIN trees t ON t.id = m.tree_id': []
  });
  const missing = await runCandidate(mod, emptyReread, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(missing.status, 500);
  assert.equal((await missing.json()).error, 'Memory creation failed');
  assert.ok(emptyReread.logs.some((l) => l.text === 'ROLLBACK'));
  assert.ok(!emptyReread.logs.some((l) => l.text === 'COMMIT'));

  const ownerMismatch = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    'INNER JOIN trees t ON t.id = m.tree_id': [makeMemoryRow({ tree_owner_id: 'someone-else' })]
  });
  const mismatch = await runCandidate(mod, ownerMismatch, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(mismatch.status, 500);
  assert.equal((await mismatch.json()).error, 'Memory creation failed');
  assert.ok(ownerMismatch.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on reread owner mismatch');
  assert.ok(!ownerMismatch.logs.some((l) => l.text === 'COMMIT'), 'no COMMIT after mismatch');
});

test('19. INSERT failure mid-work -> rollback + sanitized bounded error', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  factory.setFailOnQueryMatch('INSERT INTO memories');
  const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(resp.status, 502); // #4132 adapter taxonomy: query failure -> QUERY_FAILURE/502
  const json = await resp.json();
  assert.equal(json.code, 'QUERY_FAILURE');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on insert failure');
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'), 'no COMMIT after failure');
});

// ─── Timestamp projection / DTO shape ────────────────────────────────────

test('20. timestamp text parity: ::text casts in every projection; normalized response text', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' });
  assert.equal(resp.status, 200);
  for (const log of factory.logs.filter((l) => l.text.includes('created_at::text'))) {
    assert.match(log.text, /created_at::text AS created_at/);
    assert.match(log.text, /updated_at::text AS updated_at/);
  }
  assert.ok(factory.logs.some((l) => l.text.includes('created_at::text')), '::text projections present');
  const dto = await resp.json();
  assert.equal(dto.createdAt, '2026-08-23T05:06:07.654321+00:00');
  assert.equal(dto.updatedAt, '2026-08-23T05:06:07.654321+00:00');
});

test('21. exact DTO keys: normalize_memory_row parity; conditional clientKey only when persisted', async () => {
  const mod = await loadModule();
  const withoutKey = makeFakeClientFactory(DEFAULT_SCRIPT());
  const r1 = await runCandidate(mod, withoutKey, { treeId: TREE_ID, visibility: 'public' });
  const dto1 = await r1.json();
  assert.deepEqual(Object.keys(dto1).sort(), [
    'artist', 'channelId', 'channelName', 'channelUrl', 'createdAt', 'emotionTags',
    'id', 'memo', 'parentId', 'source', 'sourceType', 'sourceUrl', 'thumbnail',
    'timestamp', 'title', 'treeId', 'updatedAt', 'visibility'
  ]);
  assert.equal(dto1.sourceType, 'youtube');
  assert.equal(dto1.clientKey, undefined, 'no fabricated clientKey');

  const withKey = makeFakeClientFactory({
    ...DEFAULT_SCRIPT(),
    'INNER JOIN trees t ON t.id = m.tree_id': [makeMemoryRow({ id: 'fresh-memory-row-id', client_key: 'persisted-key-12345678' })]
  });
  const r2 = await runCandidate(mod, withKey, {
    treeId: TREE_ID, visibility: 'public', clientKey: 'request-key-1234567890'
  });
  const dto2 = await r2.json();
  assert.equal(dto2.clientKey, 'persisted-key-12345678', 'DTO echoes only the persisted key');
  assert.equal(respHeadersNoStore(r2), 'no-store');
  assert.equal(r2.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(r2.headers.get('x-lovebud-request-id'), 'rid');
});

function respHeadersNoStore(resp) {
  return resp.headers.get('cache-control');
}

// ─── COMMIT ambiguity / sanitization / input immutability ────────────────

test('22. unknown COMMIT outcome -> 502 COMMIT_OUTCOME_UNKNOWN, single attempt, no blind retry', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  factory.setCommitOutcomeUnknown(true);
  const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' }, 'rid-22');
  assert.equal(resp.status, 502);
  assert.equal((await resp.json()).code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(factory.clients.length, 1, 'exactly one transaction attempt');
  assert.equal(factory.logs.filter((l) => l.text === 'BEGIN').length, 1, 'no automatic retry BEGIN');
});

test('23. sanitized errors never leak DB URL or token material', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(DEFAULT_SCRIPT());
  factory.setCommitOutcomeUnknown(true);
  const resp = await runCandidate(mod, factory, { treeId: TREE_ID, visibility: 'public' });
  const text = await resp.text();
  assert.ok(!text.includes(NEON_URL), 'no connection string leakage');
  assert.ok(!text.includes('valid-token'), 'no bearer token leakage');
});

test('24. request payload is never mutated by the handler', async () => {
  const mod = await loadModule();
  const payload = Object.freeze({
    treeId: TREE_ID,
    visibility: 'public',
    title: '  T  ',
    emotionTags: Object.freeze([' a ']),
    ownerId: 'attacker-uid'
  });
  const snapshot = JSON.stringify(payload);
  const resp = await runCandidate(mod, makeFakeClientFactory(DEFAULT_SCRIPT()), JSON.parse(snapshot));
  assert.equal(resp.status, 200);
  assert.equal(JSON.stringify(payload), snapshot, 'input object unchanged');
});

// ─── Dedicated writer config ─────────────────────────────────────────────

test('25. dedicated writer config: forbidden fallback detection and absent-config precedence', async () => {
  const mod = await loadModule();
  const genericEnv = { LB_MEMORY_CREATE_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: READ_URL };
  assert.equal(mod.readMemoryCreateWriteConfig(genericEnv).configured, false);
  const forbidden = mod.detectForbiddenWriterFallback(genericEnv);
  assert.ok(forbidden);
  assert.equal(forbidden.name, 'LOVE_PLATFORM_DATABASE_URL');

  const coexistEnv = { ...WRITER_ENV, LOVE_PLATFORM_DATABASE_URL: READ_URL, DATABASE_URL: READ_URL };
  assert.equal(mod.readMemoryCreateWriteConfig(coexistEnv).configured, true);
  assert.equal(mod.detectForbiddenWriterFallback(coexistEnv), null);

  const absent = await mod.handleMemoryCreateDirectNeon(
    makeRequest(),
    { LB_MEMORY_CREATE_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: READ_URL },
    'rid-25',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(absent.status, 503);
  assert.equal((await absent.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(absent.headers.get('x-lovebud-upstream'), 'direct-neon', 'stays on direct runtime');
});

// ─── Route wiring (memories.js) ──────────────────────────────────────────

function stubGlobalFetch(record) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    record.push({ url: String(url), options });
    return new Response(JSON.stringify({ proxied: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return () => { globalThis.fetch = originalFetch; };
}

test('26. route wiring: unset gate keeps Modal POST behavior unchanged', async () => {
  const route = await loadRoute();
  const calls = [];
  const restore = stubGlobalFetch(calls);
  try {
    const context = {
      request: makeRequest({ body: { treeId: TREE_ID, visibility: 'private' } }),
      env: { MODAL_BASE_URL: MODAL_URL }
    };
    const resp = await route.onRequestPost(context);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal', 'unset gate -> Modal proxy path');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith(`${MODAL_URL}/modal/private/memories`), 'Modal collection URL preserved');
    const forwardedText = Buffer.from(calls[0].options.body).toString('utf8');
    assert.ok(forwardedText.includes('"visibility":"private"'), 'body forwarded intact');
  } finally {
    restore();
  }
});

test('27. route wiring: gate + non-public bodies reach the Modal proxy with buffered body intact', async () => {
  const route = await loadRoute();
  const calls = [];
  const restore = stubGlobalFetch(calls);
  try {
    for (const visibility of ['private', undefined, null]) {
      const body = { treeId: TREE_ID, title: 'deferred' };
      if (visibility !== undefined) body.visibility = visibility;
      calls.length = 0;
      const context = {
        request: makeRequest({ body }),
        env: { ...WRITER_ENV, MODAL_BASE_URL: MODAL_URL }
      };
      const resp = await route.onRequestPost(context);
      assert.equal(resp.status, 200, `status for visibility=${JSON.stringify(visibility)}`);
      assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal', 'deferral reaches unchanged Modal path');
      assert.equal(calls.length, 1, 'Modal fetched exactly once for deferred request');
      const forwarded = JSON.parse(Buffer.from(calls[0].options.body).toString('utf8'));
      assert.deepEqual(forwarded, body, 'buffered body forwarded byte-equivalent');
    }
  } finally {
    restore();
  }
});

test('28. route wiring: gate + public body dispatches to the direct runtime (auth boundary, no Modal fetch)', async () => {
  const route = await loadRoute();
  const calls = [];
  const restore = stubGlobalFetch(calls);
  try {
    const context = {
      request: makeRequest({ body: { treeId: TREE_ID, visibility: 'public' } }),
      env: { ...WRITER_ENV, MODAL_BASE_URL: MODAL_URL }
    };
    const resp = await route.onRequestPost(context);
    assert.equal(resp.status, 401, 'synthetic bearer hits the direct runtime Firebase verifier');
    const json = await resp.json();
    assert.equal(json.error && json.error.code, 'FIREBASE_VERIFICATION_FAILED');
    assert.equal(calls.length, 0, 'gated public create never falls through to Modal');
  } finally {
    restore();
  }
});

test('29. contract surface: bounded frozen metadata', async () => {
  const mod = await loadModule();
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.gateEnv, 'LB_MEMORY_CREATE_WRITE_RUNTIME');
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.databaseEnv, 'LOVE_PLATFORM_WRITE_DATABASE_URL');
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.routeSplit.explicitPublicOnly, 'direct-neon-candidate');
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.parentLock, 'FOR_KEY_SHARE_BEFORE_INSERT_3918_PARITY');
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.clientKeySchemaNotActivated, 501);
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.responseFromCanonicalRereadOnly, true);
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.perRequestModalFallbackAfterDirectStart, false);
  assert.equal(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);
  assert.match(mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT.timestampProjection, /created_at::text AS created_at/);
});
