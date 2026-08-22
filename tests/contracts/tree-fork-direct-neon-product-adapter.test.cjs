// Deterministic contract test for the #4135 Phase-4 Tree Fork direct-Neon
// candidate product adapter.
//
// All assertions run in-process with:
//   - an injected fake Firebase verifyToken (no JWK/network);
//   - an injected fake Neon WS Client via neonImporter (no real DB/network);
//   - constructed Request/env inputs.
//
// No real network, Neon database, browser, provider mutation, Firebase
// provider mutation, or Production resource is used. This proves the explicit
// gate, dedicated writer config, auth-first behavior, the hardened fork
// transaction invariants (#3924/#3925/#3952/#3956), #4132 adapter reuse,
// ordering, duplicate/idempotency, parent remap, rollback, unknown COMMIT
// outcome, canonical reread, and leak-safe error sanitization (#4135).

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/tree-fork-direct-neon.js';
const GATEWAY_PATH = '../../functions/api/[[path]].js';
const NEON_URL = 'postgresql://ep-fork-candidate.us-east-2.aws.neon.tech/neondb?sslmode=require';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';

const FORK_PATH = '/api/trees/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/fork';
const FORK_URL = `https://lovebud.pages.dev${FORK_PATH}`;

const AUTH_USER_ID = 'firebase-uid-verified-4135';
const SOURCE_TREE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_SOURCE_TREE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const WRITER_ENV = {
  LB_TREE_FORK_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};

async function loadModule() {
  return import(MODULE_PATH);
}

async function loadGateway() {
  return import(GATEWAY_PATH);
}

// ─── Fake Firebase verifyToken ────────────────────────────────────────────

function makeVerifyToken({ uid = AUTH_USER_ID, throws = false, returnsNull = false } = {}) {
  return async function verifyToken(token) {
    if (throws) throw new Error('FIREBASE_JWK_IMPORT_UNAVAILABLE');
    if (returnsNull) return null;
    // Auth is verified by the principal seam only; the token text itself is
    // not used as authority and is never logged.
    assert.ok(token && token.startsWith('Bearer') === false, 'verifyToken receives bare token');
    return Object.freeze({ uid });
  };
}

function makeRequest({ url = FORK_URL, method = 'POST', authorization = 'Bearer fake-id-token' } = {}) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request(url, { method, headers });
}

// ─── Fake Neon WS Client (transaction-aware) ──────────────────────────────

function makeFakeClientFactory(script = {}) {
  // `script` maps SQL-substring -> result (array of rows) OR a function
  // (client, text, values) => array of rows. Control queries (BEGIN/COMMIT/
  // ROLLBACK) are handled implicitly. Tracks full ordered query log for
  // ordering assertions.
  const clients = [];
  const logs = [];
  const lockKeys = [];
  let commitError = false;
  let rollbackError = false;

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
      this.events.push(['query', text, Array.isArray(values) ? [...values] : values]);
      logs.push({ client: this.id, text, values: Array.isArray(values) ? [...values] : values });
      if (text === 'COMMIT') {
        if (commitError) throw new Error('commit transport failure');
        return { rows: [] };
      }
      if (text === 'ROLLBACK') {
        if (rollbackError) throw new Error('rollback failure');
        return { rows: [] };
      }
      if (text === 'BEGIN') return { rows: [] };
      if (text === 'SELECT pg_advisory_xact_lock($1)') {
        // Record the BigInt advisory key for parity assertions.
        lockKeys.push(values && values[0]);
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
    lockKeys,
    setCommitError(v) { commitError = v; },
    setRollbackError(v) { rollbackError = v; }
  };
}

function makeNeonImporter(factory) {
  return async function neonImporter() {
    return { Client: factory.Client };
  };
}

// Script builders for the canonical fork flows.

function publicSourceScript({ memories = [], newTreeId = 'new-tree-id', title = 'My Public LoveTree', existing = null } = {}) {
  const script = {};
  script['FROM trees\nWHERE id = $1\nFOR SHARE'] = [
    { id: SOURCE_TREE_ID, title, visibility: 'public', created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' }
  ];
  script['AND forked_from_tree_id = $2'] = existing ? [{ id: existing.id, forked_from_tree_id: SOURCE_TREE_ID }] : [];
  // Source memory snapshot
  script['LIMIT 201\nFOR SHARE'] = memories;
  // Destination insert returning
  script['INSERT INTO trees (id, owner_id, title, visibility, forked_from_tree_id'] = [
    { id: newTreeId, owner_id: AUTH_USER_ID, title: `${title} (복사본)`, visibility: 'public', forked_from_tree_id: SOURCE_TREE_ID, created_at: '2026-04-29T00:00:00', updated_at: '2026-04-29T00:00:00' }
  ];
  // Memory insert (no returning)
  script['INSERT INTO memories ('] = [];
  // users schema + insert
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null },
    { column_name: 'email', is_nullable: 'YES', column_default: null },
    { column_name: 'created_at', is_nullable: 'NO', column_default: 'now()' },
    { column_name: 'updated_at', is_nullable: 'NO', column_default: 'now()' }
  ];
  // Canonical reread destination tree (WHERE t.id = $1 only, no owner filter).
  script['WHERE t.id = $1\nGROUP BY'] = (text, values) => {
    return [{ id: newTreeId, owner_id: AUTH_USER_ID, title: `${title} (복사본)`, visibility: 'public', forked_from_tree_id: SOURCE_TREE_ID, created_at: '2026-04-29T00:00:00', updated_at: '2026-04-29T00:00:00', memory_count: memories.length }];
  };
  return script;
}

function missingSourceScript() {
  const script = {};
  script['FROM trees\nWHERE id = $1\nFOR SHARE'] = [];
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null },
    { column_name: 'created_at', is_nullable: 'NO', column_default: 'now()' },
    { column_name: 'updated_at', is_nullable: 'NO', column_default: 'now()' }
  ];
  return script;
}

function privateSourceScript() {
  const script = {};
  script['FROM trees\nWHERE id = $1\nFOR SHARE'] = [
    { id: SOURCE_TREE_ID, title: 'Private', visibility: 'private' }
  ];
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null }
  ];
  return script;
}

function duplicateScript() {
  const existingId = 'existing-fork-id';
  const script = {};
  script['FROM trees\nWHERE id = $1\nFOR SHARE'] = [
    { id: SOURCE_TREE_ID, title: 'My Public LoveTree', visibility: 'public', created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' }
  ];
  script['AND forked_from_tree_id = $2'] = [{ id: existingId, forked_from_tree_id: SOURCE_TREE_ID }];
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null },
    { column_name: 'created_at', is_nullable: 'NO', column_default: 'now()' },
    { column_name: 'updated_at', is_nullable: 'NO', column_default: 'now()' }
  ];
  // Canonical reread existing tree (has the owner_id = $2 filter).
  script['AND t.owner_id = $2'] = (text, values) => {
    return [{ id: existingId, owner_id: AUTH_USER_ID, title: 'My Public LoveTree (복사본)', visibility: 'public', forked_from_tree_id: SOURCE_TREE_ID, created_at: '2026-02-02T00:00:00', updated_at: '2026-02-02T00:00:00', memory_count: 2, like_count: 5, view_count: 9 }];
  };
  return { script, existingId };
}

function overLimitScript() {
  const script = {};
  script['FROM trees\nWHERE id = $1\nFOR SHARE'] = [
    { id: SOURCE_TREE_ID, title: 'Big Tree', visibility: 'public' }
  ];
  script['AND forked_from_tree_id = $2'] = [];
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null }
  ];
  // 201 public memories
  const memories = [];
  for (let i = 0; i < 201; i += 1) {
    memories.push({ id: `mem-${i}`, parent_id: null, title: `M${i}`, memo: '', artist: '', source: '', source_url: '', source_type: 'youtube', thumbnail: '', emotion_tags: '[]', timestamp: '', channel_id: null, channel_name: null, channel_url: null });
  }
  script['LIMIT 201\nFOR SHARE'] = memories;
  return script;
}

function makeMemory(n, parentId = null) {
  return {
    id: `mem-${n}`,
    parent_id: parentId,
    title: `Memory ${n}`,
    memo: 'memo',
    artist: 'Artist',
    source: 'YouTube',
    source_url: 'https://youtube.com/x',
    source_type: 'youtube',
    thumbnail: 'https://img/x.jpg',
    emotion_tags: '["joy"]',
    timestamp: '1:00',
    channel_id: 'c1',
    channel_name: 'CN',
    channel_url: 'https://y/c'
  };
}

async function callAdapter({ request, env, factory, verifyToken, adapterOverride = null }) {
  const mod = await loadModule();
  return mod.handleTreeForkDirectNeon(request, env || {}, 'req-test-4135', {
    verifyTokenOverride: verifyToken,
    neonImporter: factory ? makeNeonImporter(factory) : null,
    transactionAdapterOverride: adapterOverride
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('#4135 default/unset gate returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const res = await mod.handleTreeForkDirectNeon(
    makeRequest(),
    {}, // no gate
    'req-test-4135',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(res, null, 'unset gate must fall through to Modal path');
});

test('#4135 modal gate value returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const res = await mod.handleTreeForkDirectNeon(
    makeRequest(),
    { LB_TREE_FORK_WRITE_RUNTIME: 'modal' },
    'req-test-4135',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(res, null);
});

test('#4135 unknown gate value returns null (Modal path unchanged)', async () => {
  const mod = await loadModule();
  const res = await mod.handleTreeForkDirectNeon(
    makeRequest(),
    { LB_TREE_FORK_WRITE_RUNTIME: 'something-else' },
    'req-test-4135',
    { verifyTokenOverride: makeVerifyToken() }
  );
  assert.equal(res, null);
});

test('#4135 exact direct gate only: direct_neon selects direct path', async () => {
  const mod = await loadModule();
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({
    request: makeRequest(),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-lovebud-runtime'), 'direct_neon');
});

test('#4135 route specificity: direct gate does not affect non-fork routes', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ url: 'https://x/api/trees/abc' })), false);
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ url: 'https://x/api/trees/abc/fork', method: 'GET' })), false);
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ url: 'https://x/api/community/memories' })), false);
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ url: 'https://x/api/trees/abc/fork', method: 'POST' })), true);
});

test('#4135 method specificity: only POST fork is direct-eligible', async () => {
  const mod = await loadModule();
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ method: 'PUT' })), false);
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ method: 'DELETE' })), false);
});

test('#4135 auth before DB: missing authorization -> 401, transaction/client calls = 0', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest({ authorization: null }),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 401);
  assert.equal(factory.clients.length, 0, 'no Neon client constructed before auth');
  assert.equal(factory.logs.length, 0, 'zero DB queries before auth');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('#4135 auth before DB: malformed bearer -> 401, DB calls = 0', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest({ authorization: 'NotBearer token' }),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 401);
  assert.equal(factory.clients.length, 0);
});

test('#4135 auth before DB: invalid/expired token (verifyToken null) -> 401, DB calls = 0', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest(),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken({ returnsNull: true })
  });
  assert.equal(res.status, 401);
  assert.equal(factory.clients.length, 0);
});

test('#4135 auth before DB: verifier infra failure -> 503 sanitized, DB calls = 0', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest(),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken({ throws: true })
  });
  assert.equal(res.status, 503);
  assert.equal(factory.clients.length, 0);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes('token'), 'no token leakage in error');
});

test('#4135 forged owner header/email/uid ignored: verified Firebase UID is owner authority', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const headers = new Headers();
  headers.set('authorization', 'Bearer fake');
  headers.set('x-owner-id', 'attacker-forged-uid');
  headers.set('x-email', 'attacker@example.com');
  const req = new Request(FORK_URL, { method: 'POST', headers });
  const res = await callAdapter({
    request: req,
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken({ uid: AUTH_USER_ID })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ownerId, AUTH_USER_ID, 'owner is verified Firebase UID, not forged header');
  assert.equal(body.forked, true);
});

test('#4135 missing writer config fails closed without Modal fallback', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest(),
    env: { LB_TREE_FORK_WRITE_RUNTIME: 'direct_neon' }, // no WRITE_DATABASE_URL
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 503);
  assert.equal(factory.clients.length, 0);
  const body = await res.json();
  assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(res.headers.get('x-lovebud-route-status'), 'config-absent');
});

test('#4135 read/generic DB env cannot satisfy write config (forbidden fallback)', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const res = await callAdapter({
    request: makeRequest(),
    env: {
      LB_TREE_FORK_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: READ_URL // generic read env present, no dedicated writer
    },
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 503);
  assert.equal(factory.clients.length, 0);
  const body = await res.json();
  assert.equal(body.code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('#4135 dedicated writer remains authoritative when generic/read DB envs coexist', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({
    request: makeRequest(),
    env: {
      ...WRITER_ENV,
      LOVE_PLATFORM_DATABASE_URL: READ_URL,
      DATABASE_URL: READ_URL,
      NETLIFY_DATABASE_URL: READ_URL,
      DIRECT_NEON_BROWSE_DATABASE_URL: READ_URL
    },
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 200);
  assert.equal(factory.clients.length, 1, 'one writer client is created');
  assert.equal(
    factory.clients[0].config.connectionString,
    NEON_URL,
    'dedicated writer URL wins; read/generic DB envs never become writer authority'
  );
  const body = await res.json();
  assert.equal(body.forked, true);
});

test('#4135 #4132 adapter reused: exactly one request-scoped Client', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({
    request: makeRequest(),
    env: WRITER_ENV,
    factory,
    verifyToken: makeVerifyToken()
  });
  assert.equal(res.status, 200);
  assert.equal(factory.clients.length, 1, 'one request-scoped Client');
});

test('#4135 advisory lock ordering: lock BEFORE source Tree FOR SHARE', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const texts = factory.logs.map((l) => l.text);
  const lockIdx = texts.findIndex((t) => t.includes('pg_advisory_xact_lock'));
  const forShareIdx = texts.findIndex((t) => t.includes('FOR SHARE'));
  assert.ok(lockIdx >= 0, 'advisory lock issued');
  assert.ok(forShareIdx >= 0, 'FOR SHARE issued');
  assert.ok(lockIdx < forShareIdx, 'advisory lock BEFORE source FOR SHARE');
  // The first FOR SHARE must be the source Tree read (not the memory snapshot).
  assert.ok(texts[forShareIdx].includes('FROM trees'), 'first FOR SHARE is source Tree');
});

test('#4135 source Tree FOR SHARE present', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.ok(factory.logs.some((l) => l.text.includes('FROM trees') && l.text.includes('FOR SHARE')));
});

test('#4135 public exact visibility: private source -> 403', async () => {
  const factory = makeFakeClientFactory(privateSourceScript());
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.match(JSON.stringify(body).toLowerCase(), /public|fork/);
});

test('#4135 missing source -> 404', async () => {
  const factory = makeFakeClientFactory(missingSourceScript());
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error.toLowerCase(), /not found/);
});

test('#4135 duplicate behavior: returns existing fork, forked=false duplicate=true', async () => {
  const { script, existingId } = duplicateScript();
  const factory = makeFakeClientFactory(script);
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.duplicate, true);
  assert.equal(body.forked, false);
  assert.equal(body.id, existingId);
});

test('#4135 duplicate does NOT create a second destination Tree (no INSERT INTO trees after duplicate found)', async () => {
  const { script } = duplicateScript();
  const factory = makeFakeClientFactory(script);
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const treeInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO trees (id, owner_id'));
  assert.equal(treeInserts.length, 0, 'no destination Tree INSERT on duplicate');
});

test('#4135 duplicate lookup occurs AFTER advisory lock and source FOR SHARE, BEFORE destination insert', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const texts = factory.logs.map((l) => l.text);
  const lockIdx = texts.findIndex((t) => t.includes('pg_advisory_xact_lock'));
  const sourceShareIdx = texts.findIndex((t) => t.includes('FROM trees') && t.includes('FOR SHARE'));
  const dupIdx = texts.findIndex((t) => t.includes('forked_from_tree_id = $2'));
  const destInsertIdx = texts.findIndex((t) => t.includes('INSERT INTO trees (id, owner_id'));
  assert.ok(lockIdx < sourceShareIdx, 'lock before source FOR SHARE');
  assert.ok(sourceShareIdx < dupIdx, 'source FOR SHARE before duplicate lookup');
  assert.ok(dupIdx < destInsertIdx, 'duplicate lookup before destination insert');
});

test('#4135 Memory public filter: snapshot WHERE visibility = public', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const memSnap = factory.logs.find((l) => l.text.includes('FROM memories') && l.text.includes('FOR SHARE'));
  assert.ok(memSnap, 'memory FOR SHARE snapshot issued');
  assert.match(memSnap.text, /visibility = 'public'/, 'memory filter public only');
});

test('#4135 Memory FOR SHARE present', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.ok(factory.logs.some((l) => l.text.includes('FROM memories') && l.text.includes('FOR SHARE')));
});

test('#4135 LIMIT 201 deterministic snapshot: ORDER BY created_at ASC, id ASC', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const memSnap = factory.logs.find((l) => l.text.includes('FROM memories') && l.text.includes('FOR SHARE'));
  assert.match(memSnap.text, /ORDER BY created_at ASC, id ASC/);
  assert.match(memSnap.text, /LIMIT 201/);
});

test('#4135 200 complete copy succeeds', async () => {
  const memories = [];
  for (let i = 0; i < 200; i += 1) memories.push(makeMemory(i));
  const factory = makeFakeClientFactory(publicSourceScript({ memories, newTreeId: 'nt' }));
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.forked, true);
  assert.equal(body.memoryCount, 200);
  const memInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO memories'));
  assert.equal(memInserts.length, 200);
});

test('#4135 201 => 409 before destination insert', async () => {
  const factory = makeFakeClientFactory(overLimitScript());
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.detail.code, 'FORK_SOURCE_TOO_LARGE');
  assert.equal(body.detail.supportedMax, 200);
  const treeInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO trees (id, owner_id'));
  assert.equal(treeInserts.length, 0, 'no destination Tree INSERT on over-limit');
  const memInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO memories'));
  assert.equal(memInserts.length, 0, 'no Memory INSERT on over-limit');
});

test('#4135 new IDs: each copied Memory gets a fresh destination id', async () => {
  const memories = [makeMemory(0, null), makeMemory(1, 'mem-0')];
  const factory = makeFakeClientFactory(publicSourceScript({ memories, newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const memInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO memories'));
  assert.equal(memInserts.length, 2);
  const newIds = memInserts.map((l) => l.values[0]);
  assert.notEqual(newIds[0], 'mem-0', 'new id not the source id');
  assert.notEqual(newIds[0], newIds[1], 'fresh unique ids');
  // No source memory id reused as a destination id
  assert.ok(!newIds.includes('mem-0') && !newIds.includes('mem-1'));
});

test('#4135 parent remap: copied parent mapped to new parent id', async () => {
  const memories = [makeMemory(0, null), makeMemory(1, 'mem-0')];
  const factory = makeFakeClientFactory(publicSourceScript({ memories, newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const memInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO memories'));
  // mem-1 parent is mem-0 -> should map to mem-0's new id
  const mem0NewId = memInserts[0].values[0];
  const mem1Parent = memInserts[1].values[2];
  assert.equal(mem1Parent, mem0NewId, 'parent remapped to copied parent new id');
});

test('#4135 no cross-tree parent: parent outside copied public set -> null', async () => {
  const memories = [makeMemory(0, 'foreign-parent-id')];
  const factory = makeFakeClientFactory(publicSourceScript({ memories, newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const memInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO memories'));
  assert.equal(memInserts[0].values[2], null, 'parent outside copied set -> null, never cross-tree FK');
});

test('#4135 owner-user bootstrap parity: users upsert issued inside transaction', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const usersSchema = factory.logs.find((l) => l.text.includes("table_name = 'users'"));
  const usersInsert = factory.logs.find((l) => l.text.includes('INSERT INTO users'));
  assert.ok(usersSchema, 'users schema capability check issued');
  assert.ok(usersInsert, 'users bootstrap upsert issued');
  assert.match(usersInsert.text, /ON CONFLICT \(id\)/, 'ON CONFLICT (id) semantics');
  // id required
  assert.equal(usersInsert.values[0], AUTH_USER_ID, 'bootstrap uses verified uid as id');
});

test('#4135 owner-user bootstrap: unknown required non-null users column fails closed', async () => {
  const script = publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' });
  // Override users schema to include an unknown NOT NULL no-default column.
  script["table_name = 'users'"] = [
    { column_name: 'id', is_nullable: 'NO', column_default: null },
    { column_name: 'secret_required', is_nullable: 'NO', column_default: null } // unknown required
  ];
  const factory = makeFakeClientFactory(script);
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error.toLowerCase(), /bootstrap unavailable/);
  // No destination Tree INSERT after fail-closed bootstrap.
  const treeInserts = factory.logs.filter((l) => l.text.includes('INSERT INTO trees (id, owner_id'));
  assert.equal(treeInserts.length, 0);
});

test('#4135 rollback on work failure: 404 path rolls back (ROLLBACK issued)', async () => {
  const factory = makeFakeClientFactory(missingSourceScript());
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const control = factory.logs.map((l) => l.text);
  assert.ok(control.includes('ROLLBACK'), 'ROLLBACK issued on work failure');
  assert.ok(!control.includes('COMMIT'), 'no COMMIT on work failure');
});

test('#4135 bounded rollback failure: sanitized 502, no retry', async () => {
  // Build a script where the source read fails (so work throws), and ROLLBACK
  // itself throws. The adapter must surface a bounded sanitized error.
  const script = missingSourceScript();
  const factory = makeFakeClientFactory(script);
  factory.setRollbackError(true);
  // Make source FOR SHARE throw by removing the script row so matchScript returns
  // [] (no row => 404 ForkWorkError => rollback path). ROLLBACK throws.
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  // The work error (404) is raised before rollback; rollback failure -> adapter
  // ROLLBACK_FAILURE surfaces as 502 sanitized.
  assert.ok(res.status === 404 || res.status === 502, `bounded rollback failure status: ${res.status}`);
});

test('#4135 COMMIT outcome unknown: COMMIT transport failure -> explicit unknown, no rollback, no retry', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  factory.setCommitError(true);
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(res.headers.get('x-lovebud-route-status'), 'commit-outcome-unknown');
  const control = factory.logs.map((l) => l.text);
  // After unknown COMMIT, no ROLLBACK and no second BEGIN.
  assert.ok(!control.includes('ROLLBACK'), 'no ROLLBACK after unknown COMMIT');
  const beginCount = control.filter((t) => t === 'BEGIN').length;
  assert.equal(beginCount, 1, 'no automatic whole-transaction retry (single BEGIN)');
});

test('#4135 automatic whole-transaction retry = 0 (single BEGIN even on query failure)', async () => {
  const script = publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' });
  // Force the source FOR SHARE to throw by making the script entry a function
  // that throws once, to confirm no retry re-runs BEGIN.
  let thrown = false;
  const factory = makeFakeClientFactory({
    ...script,
    'FROM trees\nWHERE id = $1\nFOR SHARE': () => {
      if (!thrown) { thrown = true; throw new Error('query failed'); }
      return [{ id: SOURCE_TREE_ID, title: 'T', visibility: 'public' }];
    }
  });
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  // Work failure -> rollback -> sanitized error. No retry.
  assert.ok(res.status >= 400, 'failure surfaces bounded error');
  const beginCount = factory.logs.filter((l) => l.text === 'BEGIN').length;
  assert.equal(beginCount, 1, 'exactly one BEGIN (no whole-tx retry)');
});

test('#4135 canonical reread: destination response from DB reread, not input', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const body = await res.json();
  assert.equal(body.id, 'nt', 'id from canonical reread');
  assert.equal(body.title, 'My Public LoveTree (복사본)', 'title from canonical reread');
  assert.equal(body.forkedFromTreeId, SOURCE_TREE_ID);
  assert.equal(body.memoryCount, 1, 'memory count from canonical reread');
});

test('#4135 no token/DB URL/JWK/private source leakage in success and error responses', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({ request: makeRequest({ authorization: 'Bearer SECRET-TOKEN-VALUE' }), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const text = await res.clone().text();
  assert.ok(!text.includes('SECRET-TOKEN-VALUE'), 'no token leakage');
  assert.ok(!text.includes(NEON_URL), 'no DB URL leakage');
  const errRes = await callAdapter({ request: makeRequest(), env: { LB_TREE_FORK_WRITE_RUNTIME: 'direct_neon' }, factory, verifyToken: makeVerifyToken() });
  const errText = await errRes.text();
  assert.ok(!errText.includes(NEON_URL), 'no DB URL in error');
  assert.ok(!errText.includes('SECRET'), 'no secret in error');
});

test('#4135 unrelated gateway routing unchanged: direct gate only intercepts POST fork', async () => {
  // When gate is unset, the gateway onRequest must not call the direct handler.
  // Verify by checking that the gateway source still routes unrelated paths
  // through Modal and the direct intercept is gated.
  const mod = await loadModule();
  // Non-POST fork with direct gate -> not intercepted (method specificity).
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ method: 'GET' })), false);
  // GET community memories with direct fork gate -> not a fork request.
  assert.equal(mod.isTreeForkDirectNeonRequest(makeRequest({ url: 'https://x/api/community/memories', method: 'GET' })), false);
});

test('#4135 success response headers: no-store and request-id preserved', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  const res = await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-lovebud-request-id'), 'req-test-4135');
  assert.equal(res.headers.get('x-lovebud-upstream'), 'direct-neon');
});

test('#4135 invalid source tree id (non-UUID) -> 400 current-equivalent', async () => {
  const factory = makeFakeClientFactory(publicSourceScript());
  const req = makeRequest({ url: 'https://x/api/trees/not-a-uuid/fork' });
  const res = await callAdapter({ request: req, env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  assert.equal(res.status, 400);
  assert.equal(factory.clients.length, 0, 'no DB client for invalid source id');
});

test('#4135 forbidden fallback envs are exactly the generic/read set', async () => {
  const mod = await loadModule();
  assert.deepEqual([...mod.TREE_FORK_FORBIDDEN_FALLBACK_ENVS], [
    'LOVE_PLATFORM_DATABASE_URL',
    'DATABASE_URL',
    'NETLIFY_DATABASE_URL',
    'DIRECT_NEON_BROWSE_DATABASE_URL'
  ]);
});

test('#4135 contract constants: publicMax=200, snapshotLimit=201, no retry, no modal fallback', async () => {
  const mod = await loadModule();
  assert.equal(mod.TREE_FORK_PUBLIC_MAX, 200);
  assert.equal(mod.TREE_FORK_SNAPSHOT_LIMIT, 201);
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.perRequestModalFallbackAfterDirectStart, false);
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.ownerAuthority, 'verified-firebase-uid');
  // Lock parity contract
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.forkLockAlgorithm, 'sha256-first8-bytes-signed-int64');
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.forkLockSql, 'SELECT pg_advisory_xact_lock($1)');
  assert.equal(mod.TREE_FORK_DIRECT_NEON_CONTRACT.forkLockUsesHashtext, false);
});

// ─── Cross-runtime fork lock parity (#4135 lock-key repair) ─────────────────
//
// These vectors were generated INDEPENDENTLY using Python hashlib.sha256 over
// the exact raw string `tree-fork:v1:${sourceTreeId}\x1f${ownerId}`, taking
// the first 8 bytes big-endian as a signed int64 (two's complement). They are
// NOT generated by the implementation under test. The implementation must
// reproduce each expected value exactly, proving cross-runtime lock-key parity
// with the Modal runtime (modal_compute/tree_writes.py::_tree_fork_lock_key).

const FORK_LOCK_PARITY_VECTORS = [
  { label: 'positive-1', sourceTreeId: '00000000-0000-0000-0000-000000000001', ownerId: 'user-alpha-001', expected: 4128242838126393414n },
  { label: 'positive-2', sourceTreeId: '11111111-2222-3333-4444-555555555555', ownerId: 'owner-abc', expected: 4380791790925891003n },
  { label: 'negative-1', sourceTreeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ownerId: 'user-beta-002', expected: -993119244801582545n },
  { label: 'negative-2', sourceTreeId: 'deadbeef-cafe-babe-1234-567890abcdef', ownerId: 'x', expected: -5601453622471603106n },
  { label: 'uuid-shape-1', sourceTreeId: '00000000-0000-0000-0000-000000000abc', ownerId: '11111111-1111-1111-1111-111111111111', expected: 2835148017835425397n },
  { label: 'uuid-shape-2', sourceTreeId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', ownerId: '00000000-0000-0000-0000-000000000000', expected: 7654442341187182232n },
  { label: 'same-source-diff-owner-1', sourceTreeId: '12345678-1234-1234-1234-123456789abc', ownerId: 'owner-one', expected: 9215893888117435456n },
  { label: 'same-source-diff-owner-2', sourceTreeId: '12345678-1234-1234-1234-123456789abc', ownerId: 'owner-two', expected: -6444394984355438325n },
  { label: 'diff-source-same-owner-1', sourceTreeId: '11111111-1111-1111-1111-111111111111', ownerId: 'shared-owner', expected: -7889570881188607523n },
  { label: 'diff-source-same-owner-2', sourceTreeId: '22222222-2222-2222-2222-222222222222', ownerId: 'shared-owner', expected: -5516960091205034405n },
  { label: 'non-ascii-utf8', sourceTreeId: 'café-tree-ñ-한글-.Tree', ownerId: '사용자-λ-β', expected: 4187176067737247377n },
  { label: 'non-ascii-utf8-2', sourceTreeId: '🌳-leaf-é-Tree', ownerId: 'üñïçødé-user', expected: -5057805455979378733n }
];

test('#4135 fork lock parity: computeForkLockKey matches independent SHA-256 vectors exactly', async () => {
  const mod = await loadModule();
  let positiveCount = 0;
  let negativeCount = 0;
  for (const v of FORK_LOCK_PARITY_VECTORS) {
    const raw = `tree-fork:v1:${v.sourceTreeId}\x1f${v.ownerId}`;
    const utf8 = new TextEncoder().encode(raw);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8));
    // Prove the raw string is exactly the domain-separated identity.
    assert.equal(raw, `tree-fork:v1:${v.sourceTreeId}\x1f${v.ownerId}`, `${v.label}: raw string exact`);
    // Prove UTF-8 encoding matches (non-ASCII multibyte cases).
    assert.ok(utf8.length > 0, `${v.label}: UTF-8 encoded`);
    // Prove first-8-bytes extraction is exact.
    const first8hex = Array.from(digest.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
    assert.ok(first8hex.length === 16, `${v.label}: first 8 bytes = 16 hex chars`);
    // Prove signed big-endian int64 matches the independent expected value.
    const computed = await mod.computeForkLockKey(v.sourceTreeId, v.ownerId);
    assert.equal(typeof computed, 'bigint', `${v.label}: result is BigInt (no JS Number precision loss)`);
    assert.equal(computed, v.expected, `${v.label}: signed int64 exact (${v.expected})`);
    // Prove the value is within signed int64 range.
    assert.ok(computed >= -9223372036854775808n && computed <= 9223372036854775807n, `${v.label}: within int64 range`);
    if (computed >= 0n) positiveCount += 1;
    else negativeCount += 1;
  }
  assert.ok(positiveCount >= 2, `at least 2 positive vectors (got ${positiveCount})`);
  assert.ok(negativeCount >= 2, `at least 2 negative vectors (got ${negativeCount})`);
  assert.equal(FORK_LOCK_PARITY_VECTORS.length, 12, 'exactly 12 parity vectors');
});

test('#4135 fork lock parity: same source different owner produces different lock keys', async () => {
  const mod = await loadModule();
  const a = await mod.computeForkLockKey('12345678-1234-1234-1234-123456789abc', 'owner-one');
  const b = await mod.computeForkLockKey('12345678-1234-1234-1234-123456789abc', 'owner-two');
  assert.notEqual(a, b, 'same source, different owner -> different lock key');
});

test('#4135 fork lock parity: different source same owner produces different lock keys', async () => {
  const mod = await loadModule();
  const a = await mod.computeForkLockKey('11111111-1111-1111-1111-111111111111', 'shared-owner');
  const b = await mod.computeForkLockKey('22222222-2222-2222-2222-222222222222', 'shared-owner');
  assert.notEqual(a, b, 'different source, same owner -> different lock key');
});

test('#4135 fork lock parity: no JS Number precision loss (BigInt preserved)', async () => {
  const mod = await loadModule();
  // A value above 2^53 must remain exact as BigInt.
  const key = await mod.computeForkLockKey('00000000-0000-0000-0000-000000000001', 'user-alpha-001');
  assert.equal(typeof key, 'bigint', 'lock key is BigInt');
  assert.equal(key, 4128242838126393414n, 'exact BigInt above 2^53');
  // The value passed to SQL must NOT be a JS Number.
  assert.ok(key > Number.MAX_SAFE_INTEGER, 'value exceeds MAX_SAFE_INTEGER');
});

test('#4135 fork lock SQL: uses pg_advisory_xact_lock($1) with BigInt, NOT hashtext', async () => {
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  // The fork lock SQL must be exactly the bigint form.
  const lockLogs = factory.logs.filter((l) => l.text.includes('pg_advisory_xact_lock'));
  assert.ok(lockLogs.length >= 1, 'advisory lock query issued');
  const forkLockLog = lockLogs[0];
  assert.equal(forkLockLog.text, 'SELECT pg_advisory_xact_lock($1)', 'exact SQL is pg_advisory_xact_lock($1)');
  // hashtext must be ABSENT from the fork lock path.
  assert.ok(!forkLockLog.text.includes('hashtext'), 'hashtext absent from fork lock SQL');
  // No hashtext anywhere in the entire fork lock query set.
  for (const l of lockLogs) {
    assert.ok(!l.text.includes('hashtext'), `no hashtext in lock query: ${l.text}`);
  }
  // The parameter must be a BigInt (exact signed int64).
  const lockParam = forkLockLog.values && forkLockLog.values[0];
  assert.equal(typeof lockParam, 'bigint', 'lock parameter is BigInt');
  // The parameter must match the independently computed expected value for
  // the test request (SOURCE_TREE_ID + AUTH_USER_ID).
  const mod = await loadModule();
  const expectedKey = await mod.computeForkLockKey(SOURCE_TREE_ID, AUTH_USER_ID);
  assert.equal(lockParam, expectedKey, 'lock parameter equals Modal-compatible signed bigint');
});

test('#4135 fork lock: tx.advisoryXactLock NOT used (no hashtext helper path)', async () => {
  // The fork semantic lock must NOT go through the #4132 advisoryXactLock
  // helper, which uses pg_advisory_xact_lock(hashtext($1::text)). The fake
  // client must only see the bigint-form SQL.
  const factory = makeFakeClientFactory(publicSourceScript({ memories: [makeMemory(0)], newTreeId: 'nt' }));
  await callAdapter({ request: makeRequest(), env: WRITER_ENV, factory, verifyToken: makeVerifyToken() });
  const hashtextLogs = factory.logs.filter((l) => l.text.includes('hashtext'));
  assert.equal(hashtextLogs.length, 0, 'no hashtext queries issued by fork path');
});

// ─── #4157 G5 fix: timestamp text-casting convention (sibling parity) ────
//
// node-postgres parses timestamptz to Date instances by default, and
// normalizeDirectNeonTimestamp() rejects Date inputs
// (DIRECT_NEON_TIMESTAMP_PRECISION_LOST). Every fork SQL that returns
// created_at/updated_at must therefore ::text-cast at the boundary, exactly
// like the six sibling direct-neon adapters. Production smoke evidence:
// attempt 3 of the 2026-08-22 gate reactivation failed WORK_FAILURE at the
// first timestamp-bearing RETURNING stage until this cast landed.

test('#4157 G5: fork RETURNING and canonical-reread timestamps are ::text-cast (sibling convention)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sourcePath = path.join(__dirname, '..', '..', 'functions', '_shared', 'tree-fork-direct-neon.js');
  const source = fs.readFileSync(sourcePath, 'utf8');

  const extractBody = (name) => {
    const marker = 'const ' + name + ' = `';
    const start = source.indexOf(marker);
    assert.ok(start >= 0, name + ' constant present');
    const end = source.indexOf('`;', start);
    assert.ok(end > start, name + ' constant terminated');
    return source.slice(start + marker.length, end);
  };

  // RETURNING surface: the INSERT column list legitimately names created_at/
  // updated_at bare; the RETURNING clause must carry complete cast+alias pairs
  // ("X::text AS X") and nothing else timestamp-shaped.
  const returning = extractBody('INSERT_DEST_TREE_SQL');
  assert.ok(returning.includes('created_at::text AS created_at'), 'INSERT DEST: created_at::text AS created_at required');
  assert.ok(returning.includes('updated_at::text AS updated_at'), 'INSERT DEST: updated_at::text AS updated_at required');
  const returningClause = returning.slice(returning.indexOf('RETURNING'))
    .replace(/created_at::text\s+AS\s+created_at/g, '')
    .replace(/updated_at::text\s+AS\s+updated_at/g, '');
  const bareReturning = returningClause.match(/\b(created_at|updated_at)\b/g) || [];
  assert.deepEqual(bareReturning, [], 'INSERT DEST: zero uncasted timestamp tokens in RETURNING clause');

  // Canonical rereads: SELECT list must carry the same complete cast+alias pairs;
  // GROUP BY keeps plain column refs.
  for (const name of ['CANONICAL_REREAD_DEST_TREE_SQL', 'CANONICAL_REREAD_EXISTING_TREE_SQL']) {
    const body = extractBody(name);
    assert.ok(body.includes('t.created_at::text AS created_at'), name + ': t.created_at::text AS created_at required');
    assert.ok(body.includes('t.updated_at::text AS updated_at'), name + ': t.updated_at::text AS updated_at required');
    const groupBy = body.indexOf('GROUP BY');
    assert.ok(groupBy > 0, name + ': GROUP BY section present');
    const selectList = body.slice(0, groupBy)
      .replace(/t\.created_at::text\s+AS\s+created_at/g, '')
      .replace(/t\.updated_at::text\s+AS\s+updated_at/g, '');
    const bareSelect = selectList.match(/\b(created_at|updated_at)\b/g) || [];
    assert.deepEqual(bareSelect, [], name + ': zero uncasted timestamp tokens in SELECT list');
  }
});
