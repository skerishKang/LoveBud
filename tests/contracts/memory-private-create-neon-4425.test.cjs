// #4425 deterministic source-only contract for private / inherited-private
// Memory Create. No network or Production resource is used.

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE_PATH = '../../functions/_shared/memory-create-direct-neon.js';
const CREATE_URL = 'https://lovebud.pages.dev/api/memories';
const NEON_URL = ['postgresql://', 'ep-unit-test.us-east-2.aws.neon.tech', '/neondb?sslmode=require'].join('');
const OWNER_ID = 'firebase-owner-4425';
const TREE_ID = '11111111-1111-1111-1111-111111111111';
const MEMORY_ID = '22222222-2222-2222-2222-222222222222';

const PUBLIC_ENV = {
  LB_MEMORY_CREATE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};

const PRIVATE_ENV = {
  LB_MEMORY_PRIVATE_CREATE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};

async function loadModule() {
  return import(MODULE_PATH);
}

function request(body) {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.set('authorization', ['Bearer', 'unit-test-token'].join(' '));
  return new Request(CREATE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

function verifyToken() {
  return Promise.resolve(Object.freeze({ uid: OWNER_ID }));
}

function memoryRow(visibility) {
  return {
    id: MEMORY_ID,
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
    visibility,
    channel_id: null,
    channel_name: null,
    channel_url: null,
    client_key: null,
    created_at: '2026-09-19 00:00:00.123456+00:00',
    updated_at: '2026-09-19 00:00:00.123456+00:00',
    tree_owner_id: OWNER_ID
  };
}

function makeAdapter({
  treeVisibility = 'public',
  ownerExists = true,
  entitled = false,
  entitlementThrows = false,
  responseVisibility = treeVisibility
} = {}) {
  const logs = [];
  const tx = {
    async query(sql, values = []) {
      logs.push({ kind: 'query', sql, values: [...values] });
      if (sql.includes('FROM trees t') && sql.includes('t.owner_id = $2')) {
        return ownerExists ? [{ id: TREE_ID, visibility: treeVisibility }] : [];
      }
      if (sql.includes('FROM public.users')) {
        if (entitlementThrows) throw new Error('synthetic entitlement read failure');
        return [{ private_storage_enabled: entitled }];
      }
      if (sql.includes('FOR KEY SHARE') && sql.includes('FROM memories')) {
        return [];
      }
      if (sql.includes('information_schema.columns')) {
        return [{ column_name: 'client_key' }];
      }
      if (sql.includes('FROM pg_catalog.pg_index')) {
        return [{ unique_capability: 1 }];
      }
      if (sql.includes('INSERT INTO memories')) {
        return [{ id: MEMORY_ID }];
      }
      return [];
    },
    async canonicalReread(sql, values = []) {
      logs.push({ kind: 'canonical', sql, values: [...values] });
      return [memoryRow(responseVisibility)];
    }
  };
  return {
    logs,
    adapter: {
      async runTransaction(work) {
        return { value: await work(tx) };
      }
    }
  };
}

async function invoke(mod, env, body, setup) {
  return mod.handleMemoryCreateDirectNeon(
    request(body),
    env,
    'rid-4425',
    {
      verifyTokenOverride: verifyToken,
      transactionAdapterOverride: setup.adapter
    }
  );
}

function hasQuery(setup, needle) {
  return setup.logs.some((entry) => entry.sql.includes(needle));
}

function queryIndex(setup, needle) {
  return setup.logs.findIndex((entry) => entry.sql.includes(needle));
}

test('private create gate is independent from the existing public create gate', async () => {
  const mod = await loadModule();

  assert.equal(mod.isMemoryCreateDirectNeonSelected(PUBLIC_ENV), true);
  assert.equal(mod.isMemoryPrivateCreateDirectNeonSelected(PUBLIC_ENV), false);
  assert.equal(mod.isAnyMemoryCreateDirectNeonSelected(PUBLIC_ENV), true);

  assert.equal(mod.isMemoryCreateDirectNeonSelected(PRIVATE_ENV), false);
  assert.equal(mod.isMemoryPrivateCreateDirectNeonSelected(PRIVATE_ENV), true);
  assert.equal(mod.isAnyMemoryCreateDirectNeonSelected(PRIVATE_ENV), true);

  const privateOnly = makeAdapter();
  const explicitPublic = await invoke(
    mod,
    PRIVATE_ENV,
    { treeId: TREE_ID, visibility: 'public' },
    privateOnly
  );
  assert.equal(explicitPublic, null);
  assert.equal(privateOnly.logs.length, 0);

  const publicOnly = makeAdapter();
  const explicitPrivate = await invoke(
    mod,
    PUBLIC_ENV,
    { treeId: TREE_ID, visibility: 'private' },
    publicOnly
  );
  assert.equal(explicitPrivate, null);
  assert.equal(publicOnly.logs.length, 0);

  const inherited = await invoke(mod, PUBLIC_ENV, { treeId: TREE_ID }, publicOnly);
  assert.equal(inherited, null);
  assert.equal(publicOnly.logs.length, 0);
});

test('private path checks owner before entitlement and performs zero mutation on owner denial', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({ ownerExists: false, treeVisibility: 'private', entitled: true });
  const resp = await invoke(
    mod,
    PRIVATE_ENV,
    { treeId: TREE_ID, visibility: 'private' },
    setup
  );
  assert.equal(resp.status, 403);
  assert.equal((await resp.json()).error, 'Access denied: not your tree');
  assert.equal(hasQuery(setup, 'FROM public.users'), false);
  assert.equal(hasQuery(setup, 'INSERT INTO memories'), false);
});

test('explicit private requires Neon entitlement before later scalar validation or INSERT', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({ treeVisibility: 'public', entitled: false, responseVisibility: 'private' });
  const resp = await invoke(
    mod,
    PRIVATE_ENV,
    { treeId: TREE_ID, visibility: 'private', title: 42 },
    setup
  );
  assert.equal(resp.status, 403);
  const body = await resp.json();
  assert.equal(body.code, 'PLUS_REQUIRED_PRIVATE_STORAGE');
  assert.equal(body.upgradeRequired, true);
  assert.ok(queryIndex(setup, 'FROM public.users') > queryIndex(setup, 'FROM trees t'));
  assert.equal(hasQuery(setup, 'INSERT INTO memories'), false);
});

test('entitled explicit-private create stores private visibility and returns canonical private DTO', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({ treeVisibility: 'public', entitled: true, responseVisibility: 'private' });
  const resp = await invoke(
    mod,
    PRIVATE_ENV,
    { treeId: TREE_ID, visibility: 'private', title: ' private memory ' },
    setup
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.visibility, 'private');

  const entitlementIndex = queryIndex(setup, 'FROM public.users');
  const insertIndex = queryIndex(setup, 'INSERT INTO memories');
  assert.ok(entitlementIndex >= 0);
  assert.ok(insertIndex > entitlementIndex);
  const insert = setup.logs[insertIndex];
  assert.match(insert.sql, /'private'/);
  assert.equal(insert.values[3], 'private memory');
});

test('omitted visibility inherits public without any entitlement read', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({ treeVisibility: 'public', entitled: false, responseVisibility: 'public' });
  const resp = await invoke(mod, PRIVATE_ENV, { treeId: TREE_ID, title: 'inherited public' }, setup);
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).visibility, 'public');
  assert.equal(hasQuery(setup, 'FROM public.users'), false);
  const insert = setup.logs.find((entry) => entry.sql.includes('INSERT INTO memories'));
  assert.ok(insert);
  assert.match(insert.sql, /'public'/);
});

test('omitted visibility inherits private and requires entitlement', async () => {
  const mod = await loadModule();
  const denied = makeAdapter({ treeVisibility: 'private', entitled: false, responseVisibility: 'private' });
  const deniedResp = await invoke(mod, PRIVATE_ENV, { treeId: TREE_ID, title: 'x' }, denied);
  assert.equal(deniedResp.status, 403);
  assert.equal((await deniedResp.json()).code, 'PLUS_REQUIRED_PRIVATE_STORAGE');
  assert.equal(hasQuery(denied, 'INSERT INTO memories'), false);

  const allowed = makeAdapter({ treeVisibility: 'private', entitled: true, responseVisibility: 'private' });
  const allowedResp = await invoke(mod, PRIVATE_ENV, { treeId: TREE_ID, title: 'x' }, allowed);
  assert.equal(allowedResp.status, 200);
  assert.equal((await allowedResp.json()).visibility, 'private');
  assert.ok(queryIndex(allowed, 'FROM public.users') > queryIndex(allowed, 'FROM trees t'));
  assert.ok(queryIndex(allowed, 'INSERT INTO memories') > queryIndex(allowed, 'FROM public.users'));
});

test('unresolved inherited Tree visibility fails closed before entitlement or mutation', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({ treeVisibility: null, entitled: true });
  const resp = await invoke(mod, PRIVATE_ENV, { treeId: TREE_ID }, setup);
  assert.equal(resp.status, 400);
  assert.deepEqual(await resp.json(), { detail: { code: 'TREE_VISIBILITY_UNRESOLVED' } });
  assert.equal(hasQuery(setup, 'FROM public.users'), false);
  assert.equal(hasQuery(setup, 'INSERT INTO memories'), false);
});

test('entitlement provider failure is distinct 503 and never inserts', async () => {
  const mod = await loadModule();
  const setup = makeAdapter({
    treeVisibility: 'private',
    entitlementThrows: true,
    responseVisibility: 'private'
  });
  const resp = await invoke(
    mod,
    PRIVATE_ENV,
    { treeId: TREE_ID, visibility: 'private' },
    setup
  );
  assert.equal(resp.status, 503);
  const body = await resp.json();
  assert.equal(body.code, 'ENTITLEMENT_CHECK_UNAVAILABLE');
  assert.equal(body.upgradeRequired, false);
  assert.equal(hasQuery(setup, 'INSERT INTO memories'), false);
});

test('invalid visibility still defers to Modal with zero direct transaction', async () => {
  const mod = await loadModule();
  const setup = makeAdapter();
  for (const visibility of ['PRIVATE', 'Public', true, 1, {}]) {
    const resp = await invoke(mod, PRIVATE_ENV, { treeId: TREE_ID, visibility }, setup);
    assert.equal(resp, null);
  }
  assert.equal(setup.logs.length, 0);
});

test('contract declares Neon entitlement and independent private gate', async () => {
  const mod = await loadModule();
  const contract = mod.MEMORY_CREATE_DIRECT_NEON_CONTRACT;
  assert.equal(contract.privateGateEnv, 'LB_MEMORY_PRIVATE_CREATE_WRITE_RUNTIME');
  assert.equal(contract.privateEntitlementSource, 'neon.public.users.private_storage_enabled');
  assert.equal(contract.privateEntitlementAfterOwnerBeforeMutation, true);
  assert.equal(contract.inheritedPublicEntitlementReads, 0);
});
