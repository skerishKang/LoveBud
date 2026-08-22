// Deterministic contract test for the #4173 Phase-4 public Tree create
// direct-Neon candidate product adapter.
//
// All assertions run in-process with:
//   - an injected fake Firebase verifyToken (no JWK/network);
//   - an injected fake Neon WS Client via neonImporter (no real DB/network);
//   - constructed Request/env inputs;
//   - a stubbed global fetch for the trees.js route Modal fall-through tests.
//
// No real network, Neon database, browser, provider mutation, Firebase/Neon
// Auth provider mutation, or Production resource is used. This proves the
// explicit gate, the public-only route split (omitted/public -> direct
// candidate; explicit private -> null BEFORE any direct DB connection or
// transaction), auth-first behavior with zero DB client construction on auth
// failure, UID spoofing rejection, object-only bounded body parsing, strict
// #3935 Tree scalar validation BEFORE any owner-user upsert or Tree INSERT
// (zero mutation on invalid input), title/groupName/keywords normalization
// parity with modal_compute/validation.py, schema-capability-aware owner-user
// bootstrap (fail closed on unknown required non-null users columns), one
// request-scoped Neon WS interactive transaction, INSERT/canonical-reread
// owner binding with rollback on mismatch, timestamp ::text projection (no pg
// Date coercion), response DTO field parity, no direct->Modal fallback after
// direct start, unknown COMMIT outcome 502 with no blind retry, sanitized
// leak-safe errors, and no input object mutation (#4173).

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/tree-create-direct-neon.js';
const ROUTE_PATH = '../../functions/api/trees.js';
const NEON_URL = 'postgresql://ep-tree-create-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';
const MODAL_URL = 'https://modal.example';

const CREATE_PATH = '/api/trees';
const CREATE_URL = `https://lovebud.pages.dev${CREATE_PATH}`;
const SUBPATH_URL = 'https://lovebud.pages.dev/api/trees/some-tree/comments';

const AUTH_USER_ID = 'firebase-uid-verified-4173';
const TREE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const WRITER_ENV = {
  LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon',
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
  body = {}
} = {}) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  const init = { method, headers };
  if (body !== undefined && body !== null && method === 'POST') init.body = JSON.stringify(body);
  return new Request(url, init);
}

// ─── Fake Neon WS Client (transaction-aware) ──────────────────────────────

const DEFAULT_USERS_SCHEMA = [
  { column_name: 'id', is_nullable: 'NO', column_default: null },
  { column_name: 'email', is_nullable: 'YES', column_default: null },
  { column_name: 'created_at', is_nullable: 'YES', column_default: 'now()' },
  { column_name: 'updated_at', is_nullable: 'YES', column_default: 'now()' }
];

function makeCreatedTreeRow(overrides = {}) {
  return {
    id: TREE_ID,
    owner_id: AUTH_USER_ID,
    title: 'My LoveTree',
    visibility: 'public',
    group_name: null,
    keywords: [],
    created_at: '2026-08-22 01:02:03.123456+00:00',
    updated_at: '2026-08-22 01:02:03.123456+00:00',
    memory_count: 0,
    ...overrides
  };
}

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

// Full happy-path script for a fresh public Tree create.
function freshCreateScript({ usersSchema = DEFAULT_USERS_SCHEMA, treeRow } = {}) {
  return {
    'information_schema.columns': usersSchema,
    'INSERT INTO users': [],
    'INSERT INTO trees': [treeRow || makeCreatedTreeRow()],
    'COUNT(m.id)::int': [treeRow || makeCreatedTreeRow()]
  };
}

// ─── Gate / route selection ───────────────────────────────────────────────

test('1. gate: unset/modal/unknown returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const req = makeRequest();
  assert.equal(mod.isTreeCreateDirectNeonSelected({}), false);
  assert.equal(mod.isTreeCreateDirectNeonSelected({ LB_TREE_CREATE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeCreateDirectNeonSelected({ LB_TREE_CREATE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isTreeCreateDirectNeonSelected({ LB_TREE_CREATE_WRITE_RUNTIME: '' }), false);
  assert.equal(mod.isTreeCreateDirectNeonSelected({ LB_TREE_CREATE_WRITE_RUNTIME: ' direct_neon ' }), true);
  const resp = await mod.handleTreeCreateDirectNeon(req, {}, 'rid-1', { verifyTokenOverride: makeVerifyToken() });
  assert.equal(resp, null, 'unset gate returns null -> Modal path');
});

test('2. gate: POST /api/trees is a direct request; subpaths are not', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeCreateDirectNeonRequest(makeRequest()), true);
  assert.equal(mod.isTreeCreateDirectNeonRequest(makeRequest({ url: `${CREATE_URL}/` })), true);
  assert.equal(mod.isTreeCreateDirectNeonRequest(makeRequest({ url: SUBPATH_URL })), false);
  assert.equal(mod.isTreeCreateDirectNeonRequest(makeRequest({ method: 'GET', body: undefined })), false);
});

// ─── Auth-first boundary (zero DB before auth) ────────────────────────────

test('3. missing auth -> 401 with zero DB clients constructed', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const req = new Request(CREATE_URL, { method: 'POST', headers: {} });
  const resp = await mod.handleTreeCreateDirectNeon(req, WRITER_ENV, 'rid-3', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 401);
  assert.equal(factory.clients.length, 0, 'no DB client before auth');
});

test('4. invalid/unverifiable token -> bounded auth failure before any DB capability', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const bad = await mod.handleTreeCreateDirectNeon(makeRequest(), WRITER_ENV, 'rid-4a', {
    verifyTokenOverride: makeVerifyToken({ returnsNull: true }),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(bad.status, 401);
  const unavailable = await mod.handleTreeCreateDirectNeon(makeRequest(), WRITER_ENV, 'rid-4b', {
    verifyTokenOverride: makeVerifyToken({ throws: true }),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(unavailable.status, 503);
  assert.equal(factory.clients.length, 0, 'no DB client on auth failure');
});

// ─── Public-only route split (private defers BEFORE any DB) ──────────────

test('5. explicit private visibility -> null BEFORE any DB connection or transaction', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: 't', visibility: 'private' } }),
    WRITER_ENV,
    'rid-5',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp, null, 'private defers to Modal');
  assert.equal(factory.clients.length, 0, 'zero DB clients for private');
  assert.equal(factory.logs.length, 0, 'zero DB queries for private');
});

test('6. omitted visibility and explicit public both run the direct candidate', async () => {
  const mod = await loadModule();
  const omitted = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: {} }),
    WRITER_ENV,
    'rid-6a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal(omitted.status, 200);
  const explicit = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { visibility: 'public' } }),
    WRITER_ENV,
    'rid-6b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal(explicit.status, 200);
  assert.equal((await explicit.json()).visibility, 'public');
});

test('7. invalid visibility values -> 400 parity, zero DB clients', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  for (const visibility of ['Public', 'PRIVATE', 123, true, [], {}]) {
    const resp = await mod.handleTreeCreateDirectNeon(
      makeRequest({ body: { visibility } }),
      WRITER_ENV,
      'rid-7',
      { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
    );
    assert.equal(resp.status, 400, `status for ${JSON.stringify(visibility)}`);
    const json = await resp.json();
    assert.equal(json.error, 'visibility: public, private');
  }
  assert.equal(factory.clients.length, 0, 'no DB for invalid visibility');
});

test('8. explicit visibility null defaults to public (validate_visibility parity)', async () => {
  const mod = await loadModule();
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { visibility: null } }),
    WRITER_ENV,
    'rid-8',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).visibility, 'public');
});

// ─── Body contract ────────────────────────────────────────────────────────

test('9. JSON body contract: invalid JSON and non-object payload rejected with zero DB', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const headers = new Headers({ authorization: 'Bearer valid-token' });
  const badJson = new Request(CREATE_URL, { method: 'POST', headers, body: '{not-json' });
  const badResp = await mod.handleTreeCreateDirectNeon(badJson, WRITER_ENV, 'rid-9a', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(badResp.status, 400);

  const arrayBody = new Request(CREATE_URL, { method: 'POST', headers, body: '[1,2]' });
  const arrResp = await mod.handleTreeCreateDirectNeon(arrayBody, WRITER_ENV, 'rid-9b', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(arrResp.status, 400);
  const arrJson = await arrResp.json();
  assert.equal(arrJson.code, 'JSON_OBJECT_REQUIRED');
  assert.equal(factory.clients.length, 0, 'no DB client for rejected bodies');

  const emptyBody = new Request(CREATE_URL, { method: 'POST', headers, body: '' });
  const emptyResp = await mod.handleTreeCreateDirectNeon(emptyBody, WRITER_ENV, 'rid-9c', {
    verifyTokenOverride: makeVerifyToken(),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(emptyResp.status, 200, 'empty body parses as {} with defaults');
});

// ─── UID spoofing / owner authority ───────────────────────────────────────

test('10. verified Firebase UID is sole owner authority; caller-supplied owner ignored', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const req = makeRequest({
    body: { ownerId: 'attacker-uid', owner_id: 'attacker-uid', ownerUid: 'attacker-uid', email: 'attacker@example.com' }
  });
  const resp = await mod.handleTreeCreateDirectNeon(req, WRITER_ENV, 'rid-10', {
    verifyTokenOverride: makeVerifyToken({ uid: AUTH_USER_ID }),
    neonImporter: makeNeonImporter(factory)
  });
  assert.equal(resp.status, 200);
  const treeInsert = factory.logs.find((l) => l.text.includes('INSERT INTO trees'));
  assert.ok(treeInsert, 'tree insert present');
  assert.equal(treeInsert.values[1], AUTH_USER_ID, 'owner_id param equals verified Firebase UID');
  assert.equal((await resp.json()).ownerId, AUTH_USER_ID);
});

// ─── Strict scalar validation BEFORE any mutation ────────────────────────

test('11. title parity: omitted/null -> My LoveTree; non-string -> 400 INVALID_TREE_SCALAR_TYPE', async () => {
  const mod = await loadModule();
  const defaulted = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: {} }),
    WRITER_ENV,
    'rid-11a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal((await defaulted.json()).title, 'My LoveTree');

  const explicitNull = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: null } }),
    WRITER_ENV,
    'rid-11b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal((await explicitNull.json()).title, 'My LoveTree');

  const factory = makeFakeClientFactory(freshCreateScript());
  for (const title of [42, true, [], {}, { length: 0 }]) {
    const resp = await mod.handleTreeCreateDirectNeon(
      makeRequest({ body: { title } }),
      WRITER_ENV,
      'rid-11c',
      { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
    );
    assert.equal(resp.status, 400, `status for ${JSON.stringify(title)}`);
    const json = await resp.json();
    assert.equal(json.code, 'INVALID_TREE_SCALAR_TYPE');
    assert.equal(json.field, 'title');
    assert.equal(json.expected, 'string');
  }
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO users')), 'no user upsert on invalid title');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO trees')), 'no tree insert on invalid title');
});

test('12. title trim and code-point bound: 200 ok (emoji), 201 code points -> 400', async () => {
  const mod = await loadModule();
  const trimmed = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: '  padded title  ' } }),
    WRITER_ENV,
    'rid-12a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript({ treeRow: makeCreatedTreeRow({ title: 'padded title' }) }))) }
  );
  assert.equal((await trimmed.json()).title, 'padded title');

  const emoji200 = '😀'.repeat(200); // 200 code points (400 UTF-16 units) -> exactly at max
  const okResp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: emoji200 } }),
    WRITER_ENV,
    'rid-12b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript({ treeRow: makeCreatedTreeRow({ title: emoji200 }) }))) }
  );
  assert.equal(okResp.status, 200, 'code-point semantics accept 200 emoji');

  const emoji201 = '😀'.repeat(201); // 201 code points -> over max 200
  const overResp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: emoji201 } }),
    WRITER_ENV,
    'rid-12c',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal(overResp.status, 400);
  assert.match((await overResp.json()).error, /title exceeds max 200 characters/);
});

test('13. groupName parity: non-string 400; trim; empty -> null; >80 -> 400', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript({
    treeRow: makeCreatedTreeRow({ group_name: 'my group' })
  }));

  const normalized = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { groupName: '  my group  ' } }),
    WRITER_ENV,
    'rid-13a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal((await normalized.json()).groupName, 'my group');

  const invalidFactory = makeFakeClientFactory(freshCreateScript());
  const nullCaseFactory = makeFakeClientFactory(freshCreateScript());
  const emptyToNull = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { groupName: '   ' } }),
    WRITER_ENV,
    'rid-13b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(nullCaseFactory) }
  );
  assert.equal((await emptyToNull.json()).groupName, null);

  for (const groupName of [42, true, [], {}]) {
    const resp = await mod.handleTreeCreateDirectNeon(
      makeRequest({ body: { groupName } }),
      WRITER_ENV,
      'rid-13c',
      { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
    );
    assert.equal(resp.status, 400, `status for ${JSON.stringify(groupName)}`);
    const json = await resp.json();
    assert.equal(json.code, 'INVALID_TREE_SCALAR_TYPE');
    assert.equal(json.field, 'groupName');
  }

  const over = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { groupName: 'g'.repeat(81) } }),
    WRITER_ENV,
    'rid-13d',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
  );
  assert.equal(over.status, 400);
  assert.match((await over.json()).error, /groupName exceeds max 80 characters/);

  assert.ok(!invalidFactory.logs.some((l) => l.text.includes('INSERT INTO users')), 'no user upsert on invalid groupName');
  assert.ok(!invalidFactory.logs.some((l) => l.text.includes('INSERT INTO trees')), 'no tree insert on invalid groupName');
});

test('14. keywords parity: array-only, string items, trim, dedupe, max 5 x max 24', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript({
    treeRow: makeCreatedTreeRow({ keywords: ['a', 'b', 'c'] })
  }));
  const invalidFactory = makeFakeClientFactory(freshCreateScript());

  const normalized = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: [' a ', 'a', '', '  ', 'b', 'c', 'b'] } }),
    WRITER_ENV,
    'rid-14a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.deepEqual((await normalized.json()).keywords, ['a', 'b', 'c'], 'trim + order-preserving dedupe');

  const nonArray = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: 'not-an-array' } }),
    WRITER_ENV,
    'rid-14b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
  );
  assert.equal(nonArray.status, 400);
  assert.equal((await nonArray.json()).error, 'keywords must be an array');

  const nonStringItem = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: ['ok', 42] } }),
    WRITER_ENV,
    'rid-14c',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
  );
  assert.equal(nonStringItem.status, 400);
  assert.equal((await nonStringItem.json()).error, 'each keyword must be a string');

  const over24 = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: ['k'.repeat(25)] } }),
    WRITER_ENV,
    'rid-14d',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
  );
  assert.equal(over24.status, 400);
  assert.match((await over24.json()).error, /exceeds max 24 characters/);

  const emoji24 = '😀'.repeat(12); // 12 code points, 24 UTF-16 units -> OK
  const emojiOk = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: [emoji24] } }),
    WRITER_ENV,
    'rid-14e',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(emojiOk.status, 200, 'keyword bound counts code points');

  const five = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: ['a', ' a ', 'b', 'c', 'd', 'e'] } }),
    WRITER_ENV,
    'rid-14f',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(five.status, 200, 'dedupe collapses duplicates before max 5');

  const six = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { keywords: ['a', 'b', 'c', 'd', 'e', 'f'] } }),
    WRITER_ENV,
    'rid-14g',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(invalidFactory) }
  );
  assert.equal(six.status, 400);
  assert.equal((await six.json()).error, 'keywords exceeds max 5');

  assert.ok(!invalidFactory.logs.some((l) => l.text.includes('INSERT INTO users')), 'no user upsert on invalid keywords');
  assert.ok(!invalidFactory.logs.some((l) => l.text.includes('INSERT INTO trees')), 'no tree insert on invalid keywords');
});

// ─── Dedicated writer config (fail closed, no Modal fallback) ────────────

test('15. dedicated writer env only; generic/read env cannot substitute', async () => {
  const mod = await loadModule();
  const genericEnv = { LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeCreateWriteConfig(genericEnv).configured, false);
  const forbidden = mod.detectForbiddenWriterFallback(genericEnv);
  assert.ok(forbidden, 'generic DB env detected as forbidden fallback');
  assert.equal(forbidden.name, 'LOVE_PLATFORM_DATABASE_URL');
});

test('16. dedicated writer may coexist with read/generic envs', async () => {
  const mod = await loadModule();
  const coexistEnv = { ...WRITER_ENV, LOVE_PLATFORM_DATABASE_URL: READ_URL, DATABASE_URL: READ_URL };
  assert.equal(mod.readTreeCreateWriteConfig(coexistEnv).configured, true);
  assert.equal(mod.detectForbiddenWriterFallback(coexistEnv), null);
});

test('17. config absent -> bounded 503 DIRECT_NEON_CONFIG_ABSENT with no Modal fallback', async () => {
  const mod = await loadModule();
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    { LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon' },
    'rid-17',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(resp.status, 503);
  const json = await resp.json();
  assert.equal(json.code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon', 'stays on direct runtime');
});

test('18. forbidden fallback detection: every generic/read env name; writer absence takes precedence', async () => {
  const mod = await loadModule();
  for (const name of ['LOVE_PLATFORM_DATABASE_URL', 'DATABASE_URL', 'NETLIFY_DATABASE_URL', 'DIRECT_NEON_BROWSE_DATABASE_URL']) {
    const forbidden = mod.detectForbiddenWriterFallback({
      LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon',
      [name]: READ_URL
    });
    assert.ok(forbidden, `${name} detected as forbidden fallback`);
    assert.equal(forbidden.name, name);
  }
  // Handler precedence matches the merged fork/comment adapters: with the
  // dedicated writer absent the bounded CONFIG_ABSENT response is returned
  // (fail closed) even when a generic env is also present.
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    { LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon', DATABASE_URL: READ_URL },
    'rid-18',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(resp.status, 503);
  assert.equal((await resp.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
});

// ─── Transaction work: bootstrap, insert, binding, reread ────────────────

test('19. happy path ordering: users bootstrap -> tree insert -> canonical reread -> COMMIT', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { title: '  My Tree  ', groupName: 'G', keywords: ['k1'] } }),
    WRITER_ENV,
    'rid-19',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 200);
  const usersIdx = factory.logs.findIndex((l) => l.text.includes('INSERT INTO users'));
  const insertIdx = factory.logs.findIndex((l) => l.text.includes('INSERT INTO trees'));
  const rereadIdx = factory.logs.findIndex((l) => l.text.includes('COUNT(m.id)::int'));
  const beginIdx = factory.logs.findIndex((l) => l.text === 'BEGIN');
  const commitIdx = factory.logs.findIndex((l) => l.text === 'COMMIT');
  assert.ok(beginIdx !== -1, 'BEGIN present');
  assert.ok(commitIdx !== -1, 'COMMIT present');
  assert.ok(usersIdx !== -1, 'owner-user bootstrap present');
  assert.ok(usersIdx < insertIdx, 'users bootstrap before tree insert');
  assert.ok(insertIdx < rereadIdx, 'tree insert before canonical reread');
  assert.ok(rereadIdx < commitIdx, 'canonical reread before COMMIT');
  assert.equal(factory.clients.length, 1, 'one request-scoped Neon client');
  const insertLog = factory.logs[insertIdx];
  assert.equal(insertLog.values[1], AUTH_USER_ID, 'insert owner binding');
  assert.equal(insertLog.values[2], 'My Tree', 'trimmed title param');
  assert.equal(insertLog.values[4][0], 'k1', 'keywords array param');
});

test('20. users bootstrap is schema-capability aware; unknown required column fails closed', async () => {
  const mod = await loadModule();
  const unknownColumnSchema = [
    ...DEFAULT_USERS_SCHEMA,
    { column_name: 'mystery_required', is_nullable: 'NO', column_default: null }
  ];
  const factory = makeFakeClientFactory(freshCreateScript({ usersSchema: unknownColumnSchema }));
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-20',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).error, 'Owner user bootstrap unavailable');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on fail-closed bootstrap');
  assert.ok(!factory.logs.some((l) => l.text.includes('INSERT INTO trees')), 'no tree insert');
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'), 'no COMMIT');
});

test('21. users insert shape follows present columns only; missing users table fails closed', async () => {
  const mod = await loadModule();
  const minimalSchema = [{ column_name: 'id', is_nullable: 'NO', column_default: null }];
  const minimalFactory = makeFakeClientFactory(freshCreateScript({ usersSchema: minimalSchema }));
  const minimal = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-21a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(minimalFactory) }
  );
  assert.equal(minimal.status, 200);
  const minimalInsert = minimalFactory.logs.find((l) => l.text.includes('INSERT INTO users'));
  assert.match(minimalInsert.text, /^INSERT INTO users \(id\) VALUES \(\$1\) ON CONFLICT \(id\) DO NOTHING;$/);

  const noTableFactory = makeFakeClientFactory(freshCreateScript({ usersSchema: [] }));
  const noTable = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-21b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(noTableFactory) }
  );
  assert.equal(noTable.status, 500);
  assert.equal((await noTable.json()).error, 'Owner user bootstrap unavailable');
});

test('22. timestamp projection: ::text casts in insert and reread; response timestamps normalized text', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-22',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  const insertLog = factory.logs.find((l) => l.text.includes('INSERT INTO trees'));
  assert.match(insertLog.text, /created_at::text AS created_at/);
  assert.match(insertLog.text, /updated_at::text AS updated_at/);
  const rereadLog = factory.logs.find((l) => l.text.includes('COUNT(m.id)::int'));
  assert.match(rereadLog.text, /created_at::text AS created_at/);
  assert.match(rereadLog.text, /updated_at::text AS updated_at/);

  const dto = await resp.json();
  assert.equal(dto.createdAt, '2026-08-22T01:02:03.123456+00:00', 'no pg Date coercion; text preserved and normalized');
  assert.equal(dto.updatedAt, '2026-08-22T01:02:03.123456+00:00');
});

test('23. response DTO field parity: exactly the nine canonical fields from reread', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript({
    treeRow: makeCreatedTreeRow({ group_name: '  Group A  ', keywords: ['x', 'y'] })
  }));
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-23',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 200);
  const dto = await resp.json();
  assert.deepEqual(
    Object.keys(dto).sort(),
    ['createdAt', 'groupName', 'id', 'keywords', 'memoryCount', 'ownerId', 'title', 'updatedAt', 'visibility']
  );
  assert.equal(dto.id, TREE_ID);
  assert.equal(dto.title, 'My LoveTree');
  assert.equal(dto.visibility, 'public');
  assert.equal(dto.memoryCount, 0, 'fresh tree has zero memories from canonical reread COUNT');
  assert.equal(dto.ownerId, AUTH_USER_ID);
  assert.equal(dto.groupName, 'Group A', 'stored group_name normalized on output');
  assert.deepEqual(dto.keywords, ['x', 'y']);
  assert.equal(resp.headers.get('cache-control'), 'no-store');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(resp.headers.get('x-lovebud-request-id'), 'rid-23');
});

// ─── Owner binding / canonical reread failures (rollback) ────────────────

test('24. INSERT RETURNING owner mismatch -> 500 owner binding failed + rollback, no COMMIT', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript({
    treeRow: makeCreatedTreeRow({ owner_id: 'different-uid' })
  }));
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-24',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).error, 'Tree owner binding failed');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on owner mismatch');
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'), 'no COMMIT after owner mismatch');
});

test('25. canonical reread owner mismatch -> 500 owner binding failed + rollback', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'information_schema.columns': DEFAULT_USERS_SCHEMA,
    'INSERT INTO users': [],
    'INSERT INTO trees': [makeCreatedTreeRow()],
    'COUNT(m.id)::int': [makeCreatedTreeRow({ owner_id: 'reread-mismatch-uid' })]
  });
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-25',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).error, 'Tree owner binding failed');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'));
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'));
});

test('26. canonical reread empty -> 500 canonical-missing + rollback', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory({
    'information_schema.columns': DEFAULT_USERS_SCHEMA,
    'INSERT INTO users': [],
    'INSERT INTO trees': [makeCreatedTreeRow()],
    'COUNT(m.id)::int': []
  });
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-26',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 500);
  assert.equal((await resp.json()).error, 'Tree creation failed');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'));
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'));
});

test('27. work failure mid-transaction -> rollback + sanitized bounded error', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  factory.setFailOnQueryMatch('INSERT INTO trees');
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-27',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  // The #4132 adapter's bounded taxonomy maps in-transaction query failures to
  // QUERY_FAILURE with status 502 (merged fork/comment precedent); the work
  // failure still triggers the adapter rollback path.
  assert.equal(resp.status, 502);
  const json = await resp.json();
  assert.equal(json.error, 'Tree create direct-Neon transaction failed');
  assert.equal(json.code, 'QUERY_FAILURE');
  assert.ok(factory.logs.some((l) => l.text === 'ROLLBACK'), 'rollback on work failure');
  assert.ok(!factory.logs.some((l) => l.text === 'COMMIT'), 'no COMMIT after work failure');
});

// ─── COMMIT ambiguity / no blind retry ───────────────────────────────────

test('28. unknown COMMIT outcome -> 502 COMMIT_OUTCOME_UNKNOWN, single attempt, no blind retry', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  factory.setCommitOutcomeUnknown(true);
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-28',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(resp.status, 502);
  assert.equal((await resp.json()).code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(factory.clients.length, 1, 'exactly one transaction attempt');
  assert.equal(factory.logs.filter((l) => l.text === 'BEGIN').length, 1, 'no automatic retry BEGIN');
});

test('29. sanitized errors never leak DB URL or token material', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(freshCreateScript());
  factory.setCommitOutcomeUnknown(true);
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    WRITER_ENV,
    'rid-29',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  const text = await resp.text();
  assert.ok(!text.includes(NEON_URL), 'no connection string leakage');
  assert.ok(!text.includes('valid-token'), 'no bearer token leakage');
});

// ─── Input immutability ──────────────────────────────────────────────────

test('30. input object is never mutated by the handler', async () => {
  const mod = await loadModule();
  const payload = Object.freeze({
    title: '  T  ',
    groupName: '  G  ',
    keywords: Object.freeze([' a ', 'a']),
    ownerId: 'attacker-uid'
  });
  const snapshot = JSON.stringify(payload);
  const resp = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: JSON.parse(snapshot) }),
    WRITER_ENV,
    'rid-30',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(makeFakeClientFactory(freshCreateScript())) }
  );
  assert.equal(resp.status, 200);
  assert.equal(JSON.stringify(payload), snapshot, 'input object unchanged');
});

// ─── Route wiring (trees.js) ─────────────────────────────────────────────

test('31. route wiring: unset gate keeps Modal POST behavior unchanged', async () => {
  const route = await loadRoute();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: 'modal-tree' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const context = {
      request: makeRequest({ body: { title: 't' } }),
      env: { MODAL_BASE_URL: MODAL_URL }
    };
    const resp = await route.onRequestPost(context);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('x-lovebud-upstream'), 'modal', 'unset gate -> Modal proxy path');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith(`${MODAL_URL}/modal/private/trees`), 'Modal create URL preserved');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('32. route wiring: gate selected dispatches to the direct runtime auth boundary (no Modal fetch)', async () => {
  const route = await loadRoute();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({}), { status: 200 });
  };
  try {
    // The production route wires the real Firebase verifier, so a synthetic
    // bearer reaches the direct handler's auth-first boundary and is rejected
    // with the Firebase principal error shape — a shape the Modal proxy path
    // never produces. Zero global fetch calls prove the gated request never
    // fell through to the Modal proxy.
    for (const [label, body] of [['private', { title: 't', visibility: 'private' }], ['public', { title: 't' }]]) {
      const context = {
        request: makeRequest({ body }),
        env: { ...WRITER_ENV, MODAL_BASE_URL: MODAL_URL }
      };
      const resp = await route.onRequestPost(context);
      assert.equal(resp.status, 401, `${label} body auth boundary status`);
      const json = await resp.json();
      assert.equal(json.error && json.error.code, 'FIREBASE_VERIFICATION_FAILED', `${label} body direct auth shape`);
    }
    assert.equal(calls.length, 0, 'no Modal proxy fetch from the gated route');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('33. authenticated private defers pre-DB and public config-absence stays direct (composition)', async () => {
  const mod = await loadModule();
  // Composition of the two post-auth route-split behaviors the synthetic-token
  // route test above cannot reach:
  //   a) an AUTHENTICATED private create returns null (route falls through to
  //      Modal) with zero DB clients/queries (unit proof of test 32's contract);
  //   b) an authenticated public create with absent writer config stays on the
  //      direct runtime with its own bounded 503 (no Modal fallback).
  const factory = makeFakeClientFactory(freshCreateScript());
  const deferred = await mod.handleTreeCreateDirectNeon(
    makeRequest({ body: { visibility: 'private' } }),
    WRITER_ENV,
    'rid-33a',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(deferred, null, 'authenticated private -> null before any DB');
  assert.equal(factory.clients.length, 0);

  const stayedDirect = await mod.handleTreeCreateDirectNeon(
    makeRequest(),
    { LB_TREE_CREATE_WRITE_RUNTIME: 'direct_neon' },
    'rid-33b',
    { verifyTokenOverride: makeVerifyToken(), neonImporter: makeNeonImporter(factory) }
  );
  assert.equal(stayedDirect.status, 503);
  assert.equal((await stayedDirect.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(stayedDirect.headers.get('x-lovebud-upstream'), 'direct-neon');
});

test('34. contract surface: bounded frozen metadata', async () => {
  const mod = await loadModule();
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.gateEnv, 'LB_TREE_CREATE_WRITE_RUNTIME');
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.databaseEnv, 'LOVE_PLATFORM_WRITE_DATABASE_URL');
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.routeSplit.explicitPrivate, 'modal-before-any-db-connection-or-transaction');
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.defaultTitle, 'My LoveTree');
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.perRequestModalFallbackAfterDirectStart, false);
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);
  assert.equal(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.scalarValidationBeforeOwnerUserUpsert, true);
  assert.match(mod.TREE_CREATE_DIRECT_NEON_CONTRACT.timestampProjection, /created_at::text AS created_at/);
  assert.deepEqual(
    [...mod.TREE_CREATE_DIRECT_NEON_CONTRACT.responseFields],
    ['id', 'title', 'visibility', 'createdAt', 'updatedAt', 'memoryCount', 'ownerId', 'groupName', 'keywords']
  );
});
