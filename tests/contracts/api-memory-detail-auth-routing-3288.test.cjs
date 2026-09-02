// #4123 focused extension of the classified Memory-detail route contract.
// Keep the pre-#4123 #3288/#4050/#4114 suite executable without copying it.
require('../helpers/api-memory-detail-auth-routing-3288-base.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  handleMemoryDetailGet,
  onRequestGet
} = require('../../functions/api/memories/[id].js');

const OWNER_DB = 'postgresql://test@ep-owner-memory-detail-test.us-east-1.neon.tech/neondb?sslmode=require';
const REQUEST_ID = 'req-owner-memory-detail-4123';
const OWNER_UID = 'firebase-owner-4123';

async function loadDirect() {
  return import('../../functions/_shared/owner-memory-detail-direct-neon.js');
}

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `${startPattern} should exist`);

  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `${endPattern} should exist after ${startPattern}`);

  return afterStart.slice(0, end);
}

function context({
  memoryId = 'mem-owner-123',
  auth = 'Bearer owner-token-4123',
  ownerGate,
  publicGate,
  databaseUrl,
  modalBaseUrl = 'https://modal.example.com',
  extraEnv = {},
  extraHeaders = {}
} = {}) {
  const headers = new Headers({ 'x-lovebud-request-id': REQUEST_ID, ...extraHeaders });
  if (auth) headers.set('authorization', auth);
  const env = { ...extraEnv };
  if (modalBaseUrl !== null) env.MODAL_BASE_URL = modalBaseUrl;
  if (ownerGate !== undefined) env.LB_OWNER_MEMORY_DETAIL_RUNTIME = ownerGate;
  if (publicGate !== undefined) env.LB_PUBLIC_MEMORY_DETAIL_RUNTIME = publicGate;
  if (databaseUrl !== undefined) env.LOVE_PLATFORM_DATABASE_URL = databaseUrl;
  return {
    env,
    params: { id: memoryId },
    request: new Request(`https://api.example.com/api/memories/${memoryId}`, { method: 'GET', headers })
  };
}

function ownerRow(overrides = {}) {
  return {
    id: 'mem-owner-123',
    tree_id: 'tree-owner-456',
    parent_id: 'parent-1',
    title: 'Owner Memory',
    memo: 'Owner note',
    artist: 'Artist',
    source: 'YouTube',
    source_url: 'https://example.test/watch/owner',
    source_type: 'youtube',
    thumbnail: 'https://example.test/thumb/owner.jpg',
    emotion_tags: ['calm', 'hope'],
    timestamp: '02:34',
    visibility: 'private',
    channel_id: 'owner-channel',
    channel_name: 'Owner Channel',
    channel_url: 'https://example.test/channel/owner',
    client_key: 'client-key-4123',
    created_at: '2026-08-03 10:11:12.123456+00',
    updated_at: '2026-08-04T11:12:13.654321Z',
    tree_owner_id: OWNER_UID,
    tree_visibility: 'private',
    ...overrides
  };
}

function public4114Row(overrides = {}) {
  return {
    id: 'mem-owner-123',
    tree_id: 'tree-public',
    parent_id: null,
    title: 'Public Memory',
    memo: 'Public note',
    artist: '',
    source: '',
    source_url: '',
    source_type: 'youtube',
    thumbnail: '',
    emotion_tags: ['joy'],
    timestamp: '',
    visibility: 'public',
    channel_id: null,
    channel_name: null,
    channel_url: null,
    created_at: '2026-08-01 00:00:00+00',
    updated_at: '2026-08-02 00:00:00+00',
    reaction_counts: { like: 2 },
    ...overrides
  };
}

function fakeExecutor({ row = ownerRow(), fail = null } = {}) {
  const calls = [];
  return {
    calls,
    executor: async (sql, values) => {
      calls.push({ sql, values });
      if (fail) throw fail;
      return row == null ? [] : [{ ...row }];
    }
  };
}

async function directRun({
  memoryId = 'mem-owner-123',
  row = ownerRow(),
  executor,
  uid = OWNER_UID,
  contextOverrides = {}
} = {}) {
  const fake = executor ? { calls: [], executor } : fakeExecutor({ row });
  const tokens = [];
  const response = await handleMemoryDetailGet(
    context({
      memoryId,
      ownerGate: 'direct_neon',
      databaseUrl: OWNER_DB,
      modalBaseUrl: null,
      ...contextOverrides
    }),
    {
      executorOverride: fake.executor,
      verifyTokenOverride: async (token) => {
        tokens.push(token);
        return { uid };
      }
    }
  );
  return { response, calls: fake.calls, tokens };
}

function captureFetch(body = { id: 'modal-memory' }) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('#4123 anonymous requests preserve #4114 authority even when owner direct is selected', async () => {
  const cap = captureFetch();
  try {
    const modal = await onRequestGet(context({ auth: null, ownerGate: 'direct_neon', databaseUrl: OWNER_DB }));
    assert.equal(modal.status, 200);
    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/memories/mem-owner-123');
  } finally {
    cap.restore();
  }

  let verifierCalls = 0;
  const directPublic = await handleMemoryDetailGet(
    context({
      auth: null,
      ownerGate: 'direct_neon',
      publicGate: 'direct_neon',
      databaseUrl: OWNER_DB,
      modalBaseUrl: null
    }),
    {
      executorOverride: async () => [public4114Row()],
      verifyTokenOverride: async () => {
        verifierCalls += 1;
        return { uid: OWNER_UID };
      }
    }
  );
  assert.equal(directPublic.status, 200);
  assert.equal(verifierCalls, 0);
  const body = await directPublic.json();
  assert.equal(body.visibility, 'public');
  assert.deepEqual(body.reactionCounts, { like: 2, total: 2 });
  assert.equal(Object.hasOwn(body, 'clientKey'), false);
});

test('#4123 authenticated absent/default/unknown owner gate stays on private Modal', async () => {
  for (const ownerGate of [undefined, 'modal', 'future-provider']) {
    const cap = captureFetch();
    try {
      const response = await onRequestGet(context({ ownerGate }));
      assert.equal(response.status, 200);
      assert.equal(cap.calls.length, 1);
      assert.equal(new URL(cap.calls[0].url).pathname, '/modal/private/memories/mem-owner-123');
      assert.equal(cap.calls[0].options.headers.authorization, 'Bearer owner-token-4123');
    } finally {
      cap.restore();
    }
  }
});

test('#4123 authenticated direct verifies Firebase principal, performs one bounded Neon read, and returns exact private DTO', async () => {
  const cap = captureFetch();
  try {
    const { response, calls, tokens } = await directRun();
    assert.equal(response.status, 200);
    assert.equal(cap.calls.length, 0, 'no hidden Modal fallback');
    assert.deepEqual(tokens, ['owner-token-4123']);
    assert.equal(calls.length, 1, 'one bounded owner detail query');
    assert.deepEqual(calls[0].values, ['mem-owner-123']);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('x-lovebud-request-id'), REQUEST_ID);
    assert.deepEqual(await response.json(), {
      id: 'mem-owner-123',
      treeId: 'tree-owner-456',
      parentId: 'parent-1',
      title: 'Owner Memory',
      memo: 'Owner note',
      artist: 'Artist',
      source: 'YouTube',
      sourceUrl: 'https://example.test/watch/owner',
      sourceType: 'youtube',
      thumbnail: 'https://example.test/thumb/owner.jpg',
      emotionTags: ['calm', 'hope'],
      timestamp: '02:34',
      visibility: 'private',
      channelId: 'owner-channel',
      channelName: 'Owner Channel',
      channelUrl: 'https://example.test/channel/owner',
      createdAt: '2026-08-03T10:11:12.123456+00:00',
      updatedAt: '2026-08-04T11:12:13.654321+00:00',
      clientKey: 'client-key-4123'
    });
  } finally {
    cap.restore();
  }
});

test('#4123 owner read is independent of Memory and parent Tree visibility', async () => {
  for (const [memoryVisibility, treeVisibility] of [['private', 'public'], ['public', 'private']]) {
    const { response, calls } = await directRun({
      row: ownerRow({ visibility: memoryVisibility, tree_visibility: treeVisibility })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).visibility, memoryVisibility);
    assert.doesNotMatch(calls[0].sql, /(?:m|t)\.visibility\s*=\s*'public'/i);
  }
});

test('#4123 parent Tree ownership preserves non-owner 403 and missing/deleted 404', async () => {
  const denied = await directRun({ row: ownerRow({ tree_owner_id: 'different-owner' }) });
  assert.equal(denied.response.status, 403);
  assert.deepEqual(await denied.response.json(), { detail: 'Access denied: not your memory' });

  const missing = await directRun({ row: null });
  assert.equal(missing.response.status, 404);
  assert.deepEqual(await missing.response.json(), { detail: 'Memory not found' });
});

test('#4123 client-controlled owner metadata cannot replace verified Firebase legacyOwnerId', async () => {
  const { response } = await directRun({
    row: ownerRow({ tree_owner_id: 'spoofed-owner' }),
    contextOverrides: {
      extraHeaders: {
        'x-owner-id': 'spoofed-owner',
        'x-user-id': 'spoofed-owner',
        'x-user-email': 'spoofed@example.test'
      }
    }
  });
  assert.equal(response.status, 403);
});

test('#4123 clientKey is capability-safe for present, legacy-absent, and NULL values', async () => {
  const direct = await loadDirect();
  assert.match(direct.OWNER_MEMORY_DETAIL_SQL, /to_jsonb\(m\)\s*->>\s*'client_key'\s+AS\s+client_key/i);
  assert.doesNotMatch(direct.OWNER_MEMORY_DETAIL_SQL, /\bm\.client_key\b/i);

  assert.equal((await (await directRun()).response.json()).clientKey, 'client-key-4123');
  const legacy = await directRun({ row: (() => { const r = ownerRow(); delete r.client_key; return r; })() });
  assert.equal(Object.hasOwn(await legacy.response.json(), 'clientKey'), false);
  const nullKey = await directRun({ row: ownerRow({ client_key: null }) });
  assert.equal(Object.hasOwn(await nullKey.response.json(), 'clientKey'), false);
});

test('#4123 private projection excludes parent ownership internals and public reaction decoration', async () => {
  const { response } = await directRun({
    row: ownerRow({ reaction_counts: { like: 99 }, email: 'private@example.test' })
  });
  const body = await response.json();
  for (const key of ['tree_owner_id', 'tree_visibility', 'ownerId', 'owner_id', 'email', 'reactionCounts']) {
    assert.equal(Object.hasOwn(body, key), false, `${key} must not leak`);
  }
});

test('#4123 ID/path parity keeps non-UUID IDs, trims decoded IDs after Firebase verification, and rejects malformed encoding before auth/DB', async () => {
  const encoded = await directRun({
    memoryId: '%20non-uuid-owner-id%20',
    row: ownerRow({ id: 'non-uuid-owner-id' })
  });
  assert.equal(encoded.response.status, 200);
  assert.deepEqual(encoded.calls[0].values, ['non-uuid-owner-id']);

  let verifyCalls = 0;
  let dbCalls = 0;
  const malformed = await handleMemoryDetailGet(
    context({
      memoryId: '%E0%A4%A',
      ownerGate: 'direct_neon',
      databaseUrl: OWNER_DB,
      modalBaseUrl: null
    }),
    {
      verifyTokenOverride: async () => { verifyCalls += 1; return { uid: OWNER_UID }; },
      executorOverride: async () => { dbCalls += 1; return []; }
    }
  );
  assert.equal(malformed.status, 400);
  assert.equal(verifyCalls, 0);
  assert.equal(dbCalls, 0);
  assert.equal(malformed.headers.get('x-lovebud-route-status'), 'invalid-path-encoding');
});

test('#4123 explicit direct config failure verifies Firebase then fails closed; generic DB envs cannot satisfy config', async () => {
  const cap = captureFetch();
  const verifyTokenOverride = async () => ({ uid: OWNER_UID });
  try {
    const missing = await handleMemoryDetailGet(
      context({ ownerGate: 'direct_neon' }),
      { verifyTokenOverride }
    );
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');

    const generic = await handleMemoryDetailGet(
      context({
        ownerGate: 'direct_neon',
        extraEnv: {
          DATABASE_URL: OWNER_DB,
          NETLIFY_DATABASE_URL: OWNER_DB,
          NEON_DATABASE_URL: OWNER_DB
        }
      }),
      { verifyTokenOverride }
    );
    assert.equal(generic.status, 503);
    assert.equal((await generic.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('#4123 Firebase rejection/unavailability is bounded, sanitized, and no-store', async () => {
  const rejected = await handleMemoryDetailGet(
    context({ ownerGate: 'direct_neon', databaseUrl: OWNER_DB, modalBaseUrl: null }),
    {
      verifyTokenOverride: async () => null,
      executorOverride: async () => { throw new Error('DB must not execute'); }
    }
  );
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.get('cache-control'), 'no-store');
  assert.equal((await rejected.json()).error.code, 'FIREBASE_VERIFICATION_FAILED');

  const unavailable = await handleMemoryDetailGet(
    context({ ownerGate: 'direct_neon', databaseUrl: OWNER_DB, modalBaseUrl: null }),
    {
      verifyTokenOverride: async () => { throw new Error('private-auth-sentinel'); },
      executorOverride: async () => { throw new Error('DB must not execute'); }
    }
  );
  assert.equal(unavailable.status, 503);
  const text = await unavailable.text();
  assert.match(text, /FIREBASE_VERIFIER_UNAVAILABLE/);
  assert.doesNotMatch(text, /private-auth-sentinel/);
});

test('#4123 DB error is bounded/sanitized/no-store and never falls back to Modal', async () => {
  const cap = captureFetch();
  try {
    const { response } = await directRun({ executor: async () => { throw new Error('private-db-sentinel'); } });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'query-failed');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(cap.calls.length, 0);
    const text = await response.text();
    assert.deepEqual(JSON.parse(text), { detail: 'Internal server error' });
    assert.doesNotMatch(text, /private-db-sentinel/);
  } finally {
    cap.restore();
  }
});

test('#4123 SQL is one static parameterized SELECT, parent-owner aware, visibility-independent, and write-free', async () => {
  const direct = await loadDirect();
  const sql = direct.OWNER_MEMORY_DETAIL_SQL;
  assert.match(sql, /^\s*SELECT\b/i);
  assert.equal((sql.match(/\$1/g) || []).length, 1);
  assert.match(sql, /INNER\s+JOIN\s+trees\s+t/i);
  assert.match(sql, /t\.owner_id::text\s+AS\s+tree_owner_id/i);
  assert.match(sql, /WHERE\s+m\.id\s*=\s*\$1/i);
  assert.doesNotMatch(sql, /(?:m|t)\.visibility\s*=/i);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|BEGIN|CALL|DO)\b/i);
  assert.equal(direct.OWNER_MEMORY_DETAIL_DIRECT_NEON_CONTRACT.boundedQueryCount, 1);
});

test('#4123 dedicated DB source and route source keep writes/public helper outside owner direct authority', () => {
  const root = path.resolve(__dirname, '..', '..');
  const helper = fs.readFileSync(path.join(root, 'functions/_shared/owner-memory-detail-direct-neon.js'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'functions/api/memories/[id].js'), 'utf8');
  const publicHelper = fs.readFileSync(path.join(root, 'functions/_shared/public-memory-detail-direct-neon.js'), 'utf8');
  assert.match(helper, /LOVE_PLATFORM_DATABASE_URL/);
  assert.doesNotMatch(helper, /env\.(?:DATABASE_URL|NETLIFY_DATABASE_URL|NEON_DATABASE_URL)|process\.env/);
  assert.match(route, /LB_OWNER_MEMORY_DETAIL_RUNTIME/);
  assert.match(route, /LB_PUBLIC_MEMORY_DETAIL_RUNTIME/);
  assert.match(route, /export async function onRequestPut\(context\)[\s\S]*proxyMemoryRouteRequest/);
  assert.match(route, /export async function onRequestDelete\(context\)[\s\S]*proxyMemoryRouteRequest/);
  assert.match(publicHelper, /m\.visibility\s*=\s*'public'/);
  assert.match(publicHelper, /t\.visibility\s*=\s*'public'/);
  assert.doesNotMatch(publicHelper, /LB_OWNER_MEMORY_DETAIL_RUNTIME/);
});

test('#4123 Neon serverless executor uses the HTTP SQL query path without a write operation', async () => {
  const direct = await loadDirect();
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body });
    return new Response(JSON.stringify({
      rows: [],
      fields: [],
      command: 'SELECT',
      rowCount: 0
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const executor = await direct.createOwnerMemoryDetailDirectExecutor({ connectionString: OWNER_DB });
    const rows = await executor(direct.OWNER_MEMORY_DETAIL_SQL, ['mem-owner-123']);
    assert.deepEqual(rows, []);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /neon\.tech\/sql$/);
  } finally {
    globalThis.fetch = original;
  }
});

// ─── #4232 owner Memory update direct-Neon candidate ──────────────────────

const ROOT = path.resolve(__dirname, '..', '..');
const UPDATE_MEMORY_ID = '11111111-1111-4111-8111-111111111111';
const UPDATE_TREE_ID = '22222222-2222-4222-8222-222222222222';
const UPDATE_PARENT_ID = '33333333-3333-4333-8333-333333333333';
const UPDATE_OWNER_UID = 'firebase-owner-4232';
const UPDATE_DB = 'postgresql://ep-memory-update-4232.us-east-1.neon.tech/neondb?sslmode=require';

function memoryUpdateContext({
  body = { title: 'Updated title' },
  auth = 'Bearer update-token-4232',
  gate = 'direct_neon',
  modalBaseUrl = null,
  extraEnv = {},
  extraHeaders = {}
} = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-lovebud-request-id': 'req-memory-update-4232',
    ...extraHeaders
  });
  if (auth) headers.set('authorization', auth);
  const env = {
    LB_MEMORY_UPDATE_WRITE_RUNTIME: gate,
    LOVE_PLATFORM_WRITE_DATABASE_URL: UPDATE_DB,
    ...extraEnv
  };
  if (modalBaseUrl !== null) env.MODAL_BASE_URL = modalBaseUrl;
  return {
    env,
    params: { id: UPDATE_MEMORY_ID },
    request: new Request(`https://lovebud.pages.dev/api/memories/${UPDATE_MEMORY_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    })
  };
}

function memoryUpdateRow(overrides = {}) {
  return {
    id: UPDATE_MEMORY_ID,
    tree_id: UPDATE_TREE_ID,
    parent_id: null,
    title: 'Updated title',
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
    created_at: '2026-08-20 01:02:03.123456+00',
    updated_at: '2026-08-26 05:20:30.654321+00',
    ...overrides
  };
}

function makeMemoryUpdateAdapter({
  ownerId = UPDATE_OWNER_UID,
  updateRow = memoryUpdateRow(),
  targetRow = { id: UPDATE_PARENT_ID, tree_id: UPDATE_TREE_ID, parent_id: null },
  ancestorRows = [{ parent_id: null }]
} = {}) {
  const calls = [];
  let runCalls = 0;
  let ancestorIndex = 0;
  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async query(text, values = []) {
          calls.push({ text, values: Array.isArray(values) ? [...values] : values });
          if (/SELECT pg_advisory_xact_lock\(\$1\)/.test(text)) return [];
          if (/UPDATE memories\s+SET/i.test(text)) return updateRow ? [{ ...updateRow }] : [];
          if (/SELECT parent_id::text AS parent_id\s+FROM memories/i.test(text)) {
            return ancestorRows[ancestorIndex++] || [];
          }
          if (/SELECT id::text AS id, tree_id::text AS tree_id, parent_id::text AS parent_id\s+FROM memories/i.test(text)) {
            return targetRow ? [{ ...targetRow }] : [];
          }
          if (/INNER JOIN trees t ON t\.id = m\.tree_id/i.test(text)) {
            if (ownerId === null) return [];
            return [{
              id: UPDATE_MEMORY_ID,
              tree_id: UPDATE_TREE_ID,
              parent_id: null,
              visibility: 'public',
              tree_owner_id: ownerId
            }];
          }
          return [];
        }
      };
      return { value: await work(tx), outcome: 'committed' };
    }
  };
  return {
    adapter,
    calls,
    get runCalls() { return runCalls; }
  };
}

function makeTransactionClientFactory({
  ownerId = UPDATE_OWNER_UID,
  updateRow = memoryUpdateRow(),
  commitFails = false
} = {}) {
  const logs = [];
  const clients = [];
  class FakeClient {
    constructor(config) {
      this.config = config;
      clients.push(this);
    }
    async connect() {
      logs.push({ text: 'CONNECT', values: [] });
    }
    async query(text, values = []) {
      logs.push({ text, values: Array.isArray(values) ? [...values] : values });
      if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] };
      if (text === 'COMMIT') {
        if (commitFails) throw new Error('private commit transport sentinel');
        return { rows: [] };
      }
      if (/UPDATE memories\s+SET/i.test(text)) return { rows: [{ ...updateRow }] };
      if (/INNER JOIN trees t ON t\.id = m\.tree_id/i.test(text)) {
        return { rows: ownerId === null ? [] : [{
          id: UPDATE_MEMORY_ID,
          tree_id: UPDATE_TREE_ID,
          parent_id: null,
          tree_owner_id: ownerId
        }] };
      }
      return { rows: [] };
    }
    async end() {
      logs.push({ text: 'END', values: [] });
    }
  }
  return { Client: FakeClient, logs, clients };
}

function makeUpdateNeonImporter(factory) {
  return async () => ({ Client: factory.Client });
}

test('#4232 gate/source contract keeps GET+DELETE independent and Production/provider activation unauthorized', async () => {
  const direct = await import('../../functions/_shared/memory-update-direct-neon.js');
  const routeSource = fs.readFileSync(path.join(ROOT, 'functions/api/memories/[id].js'), 'utf8');

  assert.equal(direct.isMemoryUpdateDirectNeonSelected({}), false);
  assert.equal(direct.isMemoryUpdateDirectNeonSelected({ LB_MEMORY_UPDATE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(direct.isMemoryUpdateDirectNeonSelected({ LB_MEMORY_UPDATE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(direct.isMemoryUpdateDirectNeonSelected({ LB_MEMORY_UPDATE_WRITE_RUNTIME: ' direct_neon ' }), true);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.clientKeyMutable, false);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.getUnchanged, true);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.deleteUnchanged, true);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.providerMutationAuthorized, false);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(direct.MEMORY_UPDATE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);

  const getBlock = sliceBetween(routeSource, /export async function handleMemoryDetailGet/, /export async function onRequestGet/);
  const deleteStart = routeSource.search(/export async function onRequestDelete/);
  assert.notEqual(deleteStart, -1);
  const deleteBlock = routeSource.slice(deleteStart);
  assert.doesNotMatch(getBlock, /LB_MEMORY_UPDATE_WRITE_RUNTIME|handleMemoryUpdateDirectNeon/);
  assert.doesNotMatch(deleteBlock, /LB_MEMORY_UPDATE_WRITE_RUNTIME|handleMemoryUpdateDirectNeon/);
});

test('#4232 direct update uses verified Firebase owner, owner-first SQL, and DB-authoritative DTO without Modal', async () => {
  const route = await import('../../functions/api/memories/[id].js');
  const fixture = makeMemoryUpdateAdapter();
  let verifiedToken = null;
  const cap = captureFetch();
  try {
    const response = await route.handleMemoryDetailPut(
      memoryUpdateContext({
        body: { title: 'Updated title', visibility: 'public' },
        extraHeaders: {
          'x-owner-id': 'attacker-owner',
          'x-user-email': 'attacker@example.invalid'
        }
      }),
      {
        verifyTokenOverride: async (token) => {
          verifiedToken = token;
          return { uid: UPDATE_OWNER_UID, email: 'ignored@example.invalid' };
        },
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, 200);
    assert.equal(verifiedToken, 'update-token-4232');
    assert.equal(cap.calls.length, 0, 'eligible direct update must never fall back to Modal');
    assert.equal(fixture.runCalls, 1);
    assert.equal(fixture.calls.length, 2);
    assert.match(fixture.calls[0].text, /INNER JOIN trees/);
    assert.deepEqual(fixture.calls[0].values, [UPDATE_MEMORY_ID]);
    assert.match(fixture.calls[1].text, /UPDATE memories[\s\S]*AND t\.owner_id = \$\d+/i);
    assert.equal(fixture.calls[1].values.at(-2), UPDATE_MEMORY_ID);
    assert.equal(fixture.calls[1].values.at(-1), UPDATE_OWNER_UID);
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.deepEqual(await response.json(), {
      id: UPDATE_MEMORY_ID,
      treeId: UPDATE_TREE_ID,
      parentId: null,
      title: 'Updated title',
      memo: '',
      artist: '',
      source: '',
      sourceUrl: '',
      sourceType: 'youtube',
      thumbnail: '',
      emotionTags: [],
      timestamp: '',
      visibility: 'public',
      channelId: null,
      channelName: null,
      channelUrl: null,
      createdAt: '2026-08-20T01:02:03.123456+00:00',
      updatedAt: '2026-08-26T05:20:30.654321+00:00'
    });
  } finally {
    cap.restore();
  }
});

test('#4232 missing auth keeps existing edge 401; explicit private visibility preserves Modal body and performs zero direct transaction', async () => {
  const route = await import('../../functions/api/memories/[id].js');

  let verifierCalls = 0;
  let transactionCalls = 0;
  const noAuth = await route.handleMemoryDetailPut(
    memoryUpdateContext({ auth: null }),
    {
      verifyTokenOverride: async () => { verifierCalls += 1; return { uid: UPDATE_OWNER_UID }; },
      transactionAdapterOverride: {
        async runTransaction() { transactionCalls += 1; throw new Error('must not run'); }
      }
    }
  );
  assert.equal(noAuth.status, 401);
  assert.equal(noAuth.headers.get('x-lovebud-route-status'), 'missing-authorization');
  assert.equal(verifierCalls, 0);
  assert.equal(transactionCalls, 0);

  const cap = captureFetch({ id: UPDATE_MEMORY_ID, visibility: 'private' });
  try {
    const privateFixture = makeMemoryUpdateAdapter();
    const privateResponse = await route.handleMemoryDetailPut(
      memoryUpdateContext({
        body: { title: 'Private retained', visibility: 'private' },
        modalBaseUrl: 'https://modal.example'
      }),
      {
        verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
        transactionAdapterOverride: privateFixture.adapter
      }
    );
    assert.equal(privateResponse.status, 200);
    assert.equal(privateFixture.runCalls, 0);
    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, `/modal/private/memories/${UPDATE_MEMORY_ID}`);
    assert.equal(cap.calls[0].options.method, 'PUT');
    const forwarded = JSON.parse(new TextDecoder().decode(cap.calls[0].options.body));
    assert.deepEqual(forwarded, { title: 'Private retained', visibility: 'private' });
  } finally {
    cap.restore();
  }
});

test('#4232 owner failure and unsupported clientKey fail before UPDATE; generic/read DB env cannot substitute', async () => {
  const direct = await import('../../functions/_shared/memory-update-direct-neon.js');

  for (const [ownerId, expectedStatus] of [[null, 404], ['different-owner', 403]]) {
    const fixture = makeMemoryUpdateAdapter({ ownerId });
    const response = await direct.handleMemoryUpdateDirectNeon(
      memoryUpdateContext().request,
      UPDATE_MEMORY_ID,
      memoryUpdateContext().env,
      'req-4232',
      {
        verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
        transactionAdapterOverride: fixture.adapter
      }
    );
    assert.equal(response.status, expectedStatus);
    assert.equal(fixture.calls.some((call) => /UPDATE memories/.test(call.text)), false);
  }

  const unsupported = makeMemoryUpdateAdapter();
  const unsupportedContext = memoryUpdateContext({ body: { clientKey: 'immutable-key' } });
  const unsupportedResponse = await direct.handleMemoryUpdateDirectNeon(
    unsupportedContext.request,
    UPDATE_MEMORY_ID,
    unsupportedContext.env,
    'req-4232',
    {
      verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
      transactionAdapterOverride: unsupported.adapter
    }
  );
  assert.equal(unsupportedResponse.status, 400);
  assert.equal((await unsupportedResponse.json()).detail.code, 'UNSUPPORTED_MEMORY_UPDATE_FIELDS');
  assert.equal(unsupported.calls.some((call) => /UPDATE memories/.test(call.text)), false);

  const configContext = memoryUpdateContext({
    extraEnv: {
      LOVE_PLATFORM_WRITE_DATABASE_URL: '',
      LOVE_PLATFORM_DATABASE_URL: UPDATE_DB,
      DATABASE_URL: UPDATE_DB
    }
  });
  const configFixture = makeMemoryUpdateAdapter();
  const configResponse = await direct.handleMemoryUpdateDirectNeon(
    configContext.request,
    UPDATE_MEMORY_ID,
    configContext.env,
    'req-4232',
    {
      verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
      transactionAdapterOverride: configFixture.adapter
    }
  );
  assert.equal(configResponse.status, 503);
  assert.equal((await configResponse.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');
  assert.equal(configFixture.runCalls, 0);
});

test('#4232 non-null reparent uses exact SHA256 signed-int64 tree lock and validates graph before owner-predicated UPDATE', async () => {
  const crypto = require('node:crypto');
  const direct = await import('../../functions/_shared/memory-update-direct-neon.js');
  const fixture = makeMemoryUpdateAdapter();
  const ctx = memoryUpdateContext({ body: { parentId: UPDATE_PARENT_ID } });

  const response = await direct.handleMemoryUpdateDirectNeon(
    ctx.request,
    UPDATE_MEMORY_ID,
    ctx.env,
    'req-4232',
    {
      verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
      transactionAdapterOverride: fixture.adapter
    }
  );
  assert.equal(response.status, 200);

  const lockIndex = fixture.calls.findIndex((call) => /pg_advisory_xact_lock/.test(call.text));
  const targetIndex = fixture.calls.findIndex((call) => /SELECT id::text AS id, tree_id::text AS tree_id/.test(call.text));
  const ancestorIndex = fixture.calls.findIndex((call) => /SELECT parent_id::text AS parent_id/.test(call.text));
  const updateIndex = fixture.calls.findIndex((call) => /UPDATE memories/.test(call.text));
  assert.ok(lockIndex > 0);
  assert.ok(targetIndex > lockIndex);
  assert.ok(ancestorIndex > targetIndex);
  assert.ok(updateIndex > ancestorIndex);

  const expectedKey = crypto
    .createHash('sha256')
    .update(`memory-parent-graph:${UPDATE_TREE_ID}`, 'utf8')
    .digest()
    .readBigInt64BE(0);
  assert.equal(fixture.calls[lockIndex].values[0], expectedKey);
  assert.equal(typeof fixture.calls[lockIndex].values[0], 'bigint');
});

test('#4232 source acknowledgement divergence rolls back before COMMIT; unknown COMMIT is explicit with no rollback/retry', async () => {
  const direct = await import('../../functions/_shared/memory-update-direct-neon.js');

  const divergentFactory = makeTransactionClientFactory({
    updateRow: memoryUpdateRow({ source_url: 'persisted-stale-synthetic' })
  });
  const divergentCtx = memoryUpdateContext({ body: { sourceUrl: 'requested-new-synthetic' } });
  const divergent = await direct.handleMemoryUpdateDirectNeon(
    divergentCtx.request,
    UPDATE_MEMORY_ID,
    divergentCtx.env,
    'req-4232-divergent',
    {
      verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
      neonImporter: makeUpdateNeonImporter(divergentFactory)
    }
  );
  assert.equal(divergent.status, 409);
  const divergentBody = await divergent.json();
  assert.equal(divergentBody.detail.code, 'SOURCE_WRITE_ACK_DIVERGENCE');
  assert.equal(divergentBody.detail.field, 'sourceUrl');
  assert.equal(divergentBody.detail.classification, 'STALE_SOURCE_ACKNOWLEDGEMENT');
  assert.equal(divergentFactory.logs.filter((entry) => entry.text === 'ROLLBACK').length, 1);
  assert.equal(divergentFactory.logs.filter((entry) => entry.text === 'COMMIT').length, 0);
  assert.doesNotMatch(JSON.stringify(divergentBody), /requested-new-synthetic|persisted-stale-synthetic/);

  const unknownFactory = makeTransactionClientFactory({
    updateRow: memoryUpdateRow({ title: 'Commit ambiguous' }),
    commitFails: true
  });
  const unknownCtx = memoryUpdateContext({ body: { title: 'Commit ambiguous' } });
  const unknown = await direct.handleMemoryUpdateDirectNeon(
    unknownCtx.request,
    UPDATE_MEMORY_ID,
    unknownCtx.env,
    'req-4232-unknown',
    {
      verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
      neonImporter: makeUpdateNeonImporter(unknownFactory)
    }
  );
  assert.equal(unknown.status, 502);
  assert.equal(unknown.headers.get('x-lovebud-route-status'), 'commit-outcome-unknown');
  assert.equal(unknownFactory.clients.length, 1);
  assert.equal(unknownFactory.logs.filter((entry) => entry.text === 'COMMIT').length, 1);
  assert.equal(unknownFactory.logs.filter((entry) => entry.text === 'ROLLBACK').length, 0);
  const unknownText = await unknown.text();
  assert.match(unknownText, /COMMIT_OUTCOME_UNKNOWN/);
  assert.doesNotMatch(unknownText, /private commit transport sentinel|postgresql:|update-token-4232/);
});

test('#4281 regression: successful direct update with BigInt/Date driver values serializes without uncaught platform 500', async () => {
  const direct = await import('../../functions/_shared/memory-update-direct-neon.js');
  const rowWithNonJson = memoryUpdateRow({
    title: 'BigInt Date test',
    channel_id: 9007199254740993n,
    channel_name: 'test-channel',
    channel_url: 'https://example.invalid/channel',
    created_at: new Date('2026-09-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T14:14:00.000Z'),
    emotion_tags: JSON.stringify(['tag1', 'tag2']),
  });
  const fixture = makeMemoryUpdateAdapter({ updateRow: rowWithNonJson });
  const ctx = memoryUpdateContext({ body: { title: 'BigInt Date test' } });
  const cap = captureFetch();
  try {
    const response = await direct.handleMemoryUpdateDirectNeon(
      ctx.request,
      UPDATE_MEMORY_ID,
      ctx.env,
      'req-memory-update-4232',
      {
        verifyTokenOverride: async () => ({ uid: UPDATE_OWNER_UID }),
        transactionAdapterOverride: fixture.adapter
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-memory-update-4232');
    assert.equal(response.headers.get('x-lovebud-route-status'), 'memory-update-complete');
    assert.equal(cap.calls.length, 0, 'BigInt/Date success must not fall back to Modal');
    const body = await response.json();
    assert.equal(body.id, UPDATE_MEMORY_ID);
    assert.equal(body.title, 'BigInt Date test');
    // BigInt channel_id must be stringified
    assert.equal(body.channelId, '9007199254740993');
    // Date timestamps must be ISO strings
    assert.match(body.createdAt, /2026-09-01T00:00:00/);
    assert.match(body.updatedAt, /2026-09-01T14:14:00/);
    // emotionTags normalized
    assert.deepEqual(body.emotionTags, ['tag1', 'tag2']);
    // No uncaught serialization error — response is valid JSON, not plain text
    assert.doesNotMatch(JSON.stringify(body), /Internal Server Error/);
  } finally {
    cap.restore();
  }
});

// ─── #4234 owner Memory DELETE direct-Neon candidate ──────────────────────

const DELETE_MEMORY_ID = '44444444-4444-4444-8444-444444444444';
const DELETE_TREE_ID = '55555555-5555-4555-8555-555555555555';
const DELETE_OWNER_UID = 'firebase-owner-4234';
const DELETE_DB = 'postgresql://ep-memory-delete-4234.us-east-1.neon.tech/neondb?sslmode=require';

function memoryDeleteContext({
  memoryId = DELETE_MEMORY_ID,
  auth = 'Bearer delete-token-4234',
  gate = 'direct_neon',
  modalBaseUrl = null,
  extraEnv = {},
  extraHeaders = {}
} = {}) {
  const headers = new Headers({
    'x-lovebud-request-id': 'req-memory-delete-4234',
    ...extraHeaders
  });
  if (auth) headers.set('authorization', auth);
  const env = {
    LB_MEMORY_DELETE_WRITE_RUNTIME: gate,
    LOVE_PLATFORM_WRITE_DATABASE_URL: DELETE_DB,
    ...extraEnv
  };
  if (modalBaseUrl !== null) env.MODAL_BASE_URL = modalBaseUrl;
  return {
    env,
    params: { id: memoryId },
    request: new Request(`https://lovebud.pages.dev/api/memories/${memoryId}`, {
      method: 'DELETE',
      headers
    })
  };
}

function makeMemoryDeleteAdapter({
  ownerId = DELETE_OWNER_UID,
  ownerPresent = true,
  deletedId = DELETE_MEMORY_ID
} = {}) {
  const calls = [];
  let runCalls = 0;
  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async query(text, values = []) {
          calls.push({ text, values: Array.isArray(values) ? [...values] : values });
          if (/INNER JOIN trees t ON t\.id = m\.tree_id/i.test(text)) {
            if (!ownerPresent) return [];
            return [{
              id: DELETE_MEMORY_ID,
              tree_id: DELETE_TREE_ID,
              tree_owner_id: ownerId
            }];
          }
          if (/UPDATE memories\s+SET parent_id = NULL/i.test(text)) return [];
          if (/DELETE FROM memories/i.test(text)) {
            return deletedId ? [{ id: deletedId }] : [];
          }
          return [];
        }
      };
      return { value: await work(tx), outcome: 'committed' };
    }
  };
  return {
    adapter,
    calls,
    get runCalls() { return runCalls; }
  };
}

function makeDeleteTransactionClientFactory({
  ownerId = DELETE_OWNER_UID,
  ownerCheckFails = false,
  clearChildParentFails = false,
  deleteFails = false,
  commitFails = false
} = {}) {
  const logs = [];
  const clients = [];
  class FakeClient {
    constructor(config) {
      this.config = config;
      clients.push(this);
    }
    async connect() {
      logs.push({ text: 'CONNECT', values: [] });
    }
    async query(text, values = []) {
      logs.push({ text, values: Array.isArray(values) ? [...values] : values });
      if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] };
      if (text === 'COMMIT') {
        if (commitFails) throw new Error('private delete commit transport sentinel');
        return { rows: [] };
      }
      if (/INNER JOIN trees t ON t\.id = m\.tree_id/i.test(text)) {
        if (ownerCheckFails) throw new Error('private owner check query sentinel');
        return { rows: [{
          id: DELETE_MEMORY_ID,
          tree_id: DELETE_TREE_ID,
          tree_owner_id: ownerId
        }] };
      }
      if (/UPDATE memories\s+SET parent_id = NULL/i.test(text)) {
        if (clearChildParentFails) throw new Error('private clear child parent query sentinel');
        return { rows: [] };
      }
      if (/DELETE FROM memories/i.test(text)) {
        if (deleteFails) throw new Error('private delete query sentinel');
        return { rows: [{ id: DELETE_MEMORY_ID }] };
      }
      return { rows: [] };
    }
    async end() {
      logs.push({ text: 'END', values: [] });
    }
  }
  return { Client: FakeClient, logs, clients };
}

function makeDeleteNeonImporter(factory) {
  return async () => ({ Client: factory.Client });
}

test('#4234 gate/source contract keeps GET+PUT independent and Production/provider/DELETE authority disabled', async () => {
  const direct = await import('../../functions/_shared/memory-delete-direct-neon.js');
  const routeSource = fs.readFileSync(path.join(ROOT, 'functions/api/memories/[id].js'), 'utf8');

  assert.equal(direct.isMemoryDeleteDirectNeonSelected({}), false);
  assert.equal(direct.isMemoryDeleteDirectNeonSelected({ LB_MEMORY_DELETE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(direct.isMemoryDeleteDirectNeonSelected({ LB_MEMORY_DELETE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(direct.isMemoryDeleteDirectNeonSelected({ LB_MEMORY_DELETE_WRITE_RUNTIME: ' direct_neon ' }), true);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.getUnchanged, true);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.putUnchanged, true);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.productionDeletePrivilegeAuthorized, false);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.providerMutationAuthorized, false);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(direct.MEMORY_DELETE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);

  const getBlock = sliceBetween(routeSource, /export async function handleMemoryDetailGet/, /export async function onRequestGet/);
  const putBlock = sliceBetween(routeSource, /export async function handleMemoryDetailPut/, /export async function onRequestPut/);
  assert.doesNotMatch(getBlock, /LB_MEMORY_DELETE_WRITE_RUNTIME|handleMemoryDeleteDirectNeon/);
  assert.doesNotMatch(putBlock, /LB_MEMORY_DELETE_WRITE_RUNTIME|handleMemoryDeleteDirectNeon/);
});

test('#4234 direct DELETE verifies Firebase owner and preserves owner-check -> child detach -> owner-predicated delete ordering', async () => {
  const route = await import('../../functions/api/memories/[id].js');
  const fixture = makeMemoryDeleteAdapter();
  let verifiedToken = null;
  const cap = captureFetch();
  try {
    const response = await route.handleMemoryDetailDelete(
      memoryDeleteContext({
        extraHeaders: {
          'x-owner-id': 'attacker-owner',
          'x-user-email': 'attacker@example.invalid'
        }
      }),
      {
        verifyTokenOverride: async (token) => {
          verifiedToken = token;
          return { uid: DELETE_OWNER_UID, email: 'ignored@example.invalid' };
        },
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, 200);
    assert.equal(verifiedToken, 'delete-token-4234');
    assert.equal(cap.calls.length, 0, 'direct DELETE must never fall back to Modal');
    assert.equal(fixture.runCalls, 1);
    assert.equal(fixture.calls.length, 3);
    assert.match(fixture.calls[0].text, /INNER JOIN trees/);
    assert.deepEqual(fixture.calls[0].values, [DELETE_MEMORY_ID]);
    assert.match(fixture.calls[1].text, /UPDATE memories[\s\S]*SET parent_id = NULL[\s\S]*WHERE tree_id = \$1[\s\S]*AND parent_id = \$2/i);
    assert.deepEqual(fixture.calls[1].values, [DELETE_TREE_ID, DELETE_MEMORY_ID]);
    assert.match(fixture.calls[2].text, /DELETE FROM memories[\s\S]*AND t\.owner_id = \$2[\s\S]*RETURNING id::text AS id/i);
    assert.deepEqual(fixture.calls[2].values, [DELETE_MEMORY_ID, DELETE_OWNER_UID]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.deepEqual(await response.json(), {
      deleted: true,
      id: DELETE_MEMORY_ID,
      treeId: DELETE_TREE_ID
    });
  } finally {
    cap.restore();
  }
});

test('#4234 missing auth and absent/modal/unknown gate preserve the existing Modal edge path with zero direct transaction', async () => {
  const route = await import('../../functions/api/memories/[id].js');
  let verifierCalls = 0;
  let transactionCalls = 0;
  const noAuth = await route.handleMemoryDetailDelete(
    memoryDeleteContext({ auth: null }),
    {
      verifyTokenOverride: async () => { verifierCalls += 1; return { uid: DELETE_OWNER_UID }; },
      transactionAdapterOverride: {
        async runTransaction() { transactionCalls += 1; throw new Error('must not run'); }
      }
    }
  );
  assert.equal(noAuth.status, 401);
  assert.equal(noAuth.headers.get('x-lovebud-route-status'), 'missing-authorization');
  assert.equal(verifierCalls, 0);
  assert.equal(transactionCalls, 0);

  for (const gate of [undefined, 'modal', 'future-provider']) {
    const cap = captureFetch({ deleted: true, id: DELETE_MEMORY_ID, treeId: DELETE_TREE_ID });
    try {
      const ctx = memoryDeleteContext({
        gate,
        modalBaseUrl: 'https://modal.example'
      });
      if (gate === undefined) delete ctx.env.LB_MEMORY_DELETE_WRITE_RUNTIME;
      const response = await route.onRequestDelete(ctx);
      assert.equal(response.status, 200);
      assert.equal(cap.calls.length, 1);
      assert.equal(new URL(cap.calls[0].url).pathname, `/modal/private/memories/${DELETE_MEMORY_ID}`);
      assert.equal(cap.calls[0].options.method, 'DELETE');
    } finally {
      cap.restore();
    }
  }
});

test('#4234 missing/non-owner Memory fails before destructive SQL and caller ownership metadata cannot override principal', async () => {
  const direct = await import('../../functions/_shared/memory-delete-direct-neon.js');

  for (const fixture of [
    makeMemoryDeleteAdapter({ ownerPresent: false }),
    makeMemoryDeleteAdapter({ ownerId: 'different-owner' })
  ]) {
    const response = await direct.handleMemoryDeleteDirectNeon(
      memoryDeleteContext().request,
      DELETE_MEMORY_ID,
      memoryDeleteContext().env,
      'req-4234-owner',
      {
        verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
        transactionAdapterOverride: fixture.adapter
      }
    );
    assert.ok([403, 404].includes(response.status));
    assert.equal(fixture.calls.some((call) => /UPDATE memories|DELETE FROM memories/.test(call.text)), false);
  }

  const forged = makeMemoryDeleteAdapter({ ownerId: 'attacker-owner' });
  const forgedCtx = memoryDeleteContext({
    extraHeaders: {
      'x-owner-id': 'attacker-owner',
      'x-user-id': 'attacker-owner',
      'x-user-email': 'attacker@example.invalid'
    }
  });
  const forgedResponse = await direct.handleMemoryDeleteDirectNeon(
    forgedCtx.request,
    DELETE_MEMORY_ID,
    forgedCtx.env,
    'req-4234-forged',
    {
      verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
      transactionAdapterOverride: forged.adapter
    }
  );
  assert.equal(forgedResponse.status, 403);
  assert.equal(forged.calls.some((call) => /UPDATE memories|DELETE FROM memories/.test(call.text)), false);
});

test('#4234 invalid Memory ID and forbidden generic/read DB fallback fail before transaction work', async () => {
  const direct = await import('../../functions/_shared/memory-delete-direct-neon.js');

  let invalidRuns = 0;
  const invalid = await direct.handleMemoryDeleteDirectNeon(
    memoryDeleteContext({ memoryId: 'not-a-uuid' }).request,
    'not-a-uuid',
    memoryDeleteContext().env,
    'req-4234-invalid',
    {
      verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
      transactionAdapterOverride: {
        async runTransaction() { invalidRuns += 1; throw new Error('must not run'); }
      }
    }
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalidRuns, 0);

  const configCtx = memoryDeleteContext({
    extraEnv: {
      LOVE_PLATFORM_WRITE_DATABASE_URL: '',
      LOVE_PLATFORM_DATABASE_URL: DELETE_DB,
      DATABASE_URL: DELETE_DB
    }
  });
  let configRuns = 0;
  const forbidden = await direct.handleMemoryDeleteDirectNeon(
    configCtx.request,
    DELETE_MEMORY_ID,
    configCtx.env,
    'req-4234-config',
    {
      verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
      transactionAdapterOverride: {
        async runTransaction() { configRuns += 1; throw new Error('must not run'); }
      }
    }
  );
  assert.equal(forbidden.status, 503);
  assert.equal((await forbidden.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');
  assert.equal(configRuns, 0);
});

test('#4234 query failure rolls back; unknown COMMIT outcome is explicit with no rollback or blind retry', async () => {
  const direct = await import('../../functions/_shared/memory-delete-direct-neon.js');

  const failedFactory = makeDeleteTransactionClientFactory({ deleteFails: true });
  const failedCtx = memoryDeleteContext();
  const failed = await direct.handleMemoryDeleteDirectNeon(
    failedCtx.request,
    DELETE_MEMORY_ID,
    failedCtx.env,
    'req-4234-failed',
    {
      verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
      neonImporter: makeDeleteNeonImporter(failedFactory)
    }
  );
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('x-lovebud-route-status'), 'query-failed-delete-memory');
  assert.equal(failedFactory.clients.length, 1);
  assert.equal(failedFactory.logs.filter((entry) => entry.text === 'ROLLBACK').length, 1);
  assert.equal(failedFactory.logs.filter((entry) => entry.text === 'COMMIT').length, 0);
  assert.doesNotMatch(await failed.text(), /private delete query sentinel|postgresql:|delete-token-4234/);

  const unknownFactory = makeDeleteTransactionClientFactory({ commitFails: true });
  const unknownCtx = memoryDeleteContext();
  const unknown = await direct.handleMemoryDeleteDirectNeon(
    unknownCtx.request,
    DELETE_MEMORY_ID,
    unknownCtx.env,
    'req-4234-unknown',
    {
      verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
      neonImporter: makeDeleteNeonImporter(unknownFactory)
    }
  );
  assert.equal(unknown.status, 502);
  assert.equal(unknown.headers.get('x-lovebud-route-status'), 'commit-outcome-unknown');
  assert.equal(unknownFactory.clients.length, 1);
  assert.equal(unknownFactory.logs.filter((entry) => entry.text === 'COMMIT').length, 1);
  assert.equal(unknownFactory.logs.filter((entry) => entry.text === 'ROLLBACK').length, 0);
  const unknownText = await unknown.text();
  assert.match(unknownText, /COMMIT_OUTCOME_UNKNOWN/);
  assert.doesNotMatch(unknownText, /private delete commit transport sentinel|postgresql:|delete-token-4234/);
});

test('#4334 query failure reports safe query failure stage for owner-check, clear-child-parent, and delete-memory without leaking secrets', async () => {
  const direct = await import('../../functions/_shared/memory-delete-direct-neon.js');

  const stageCases = [
    {
      flag: { ownerCheckFails: true },
      expectedRouteStatus: 'query-failed-owner-check',
      sentinel: 'private owner check query sentinel'
    },
    {
      flag: { clearChildParentFails: true },
      expectedRouteStatus: 'query-failed-clear-child-parent',
      sentinel: 'private clear child parent query sentinel'
    },
    {
      flag: { deleteFails: true },
      expectedRouteStatus: 'query-failed-delete-memory',
      sentinel: 'private delete query sentinel'
    }
  ];

  for (const item of stageCases) {
    const factory = makeDeleteTransactionClientFactory(item.flag);
    const response = await direct.handleMemoryDeleteDirectNeon(
      memoryDeleteContext().request,
      DELETE_MEMORY_ID,
      memoryDeleteContext().env,
      'req-4334-stage',
      {
        verifyTokenOverride: async () => ({ uid: DELETE_OWNER_UID }),
        neonImporter: makeDeleteNeonImporter(factory)
      }
    );

    assert.equal(response.status, 502);
    assert.equal(response.headers.get('x-lovebud-route-status'), item.expectedRouteStatus);
    const body = await response.json();
    assert.equal(body.code, 'QUERY_FAILURE');
    assert.equal(body.error, 'Memory delete direct-Neon transaction failed');
    assert.equal(factory.clients.length, 1);
    assert.equal(factory.logs.filter((entry) => entry.text === 'ROLLBACK').length, 1);
    assert.equal(factory.logs.filter((entry) => entry.text === 'COMMIT').length, 0);

    const bodyStr = JSON.stringify(body);
    assert.doesNotMatch(bodyStr, new RegExp(item.sentinel));
    assert.doesNotMatch(bodyStr, /postgresql:|delete-token-4234/);
  }
});
