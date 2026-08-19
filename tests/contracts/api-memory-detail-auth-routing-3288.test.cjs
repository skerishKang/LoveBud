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
