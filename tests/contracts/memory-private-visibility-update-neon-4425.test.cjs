// #4425 deterministic source-only contract for private Memory visibility update.
//
// No network, real database, provider, Product request, or Production mutation.
// Uses constructed Request/env inputs, injected Firebase verification, bounded
// body bytes, and a fake Direct-Neon transaction adapter only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const MODULE = '../../functions/_shared/memory-update-direct-neon.js';
const MEMORY_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = 'firebase-owner-memory-private-4425';
const NEON_URL = 'postgresql://user:pass@ep-memory-private-update.us-east-1.aws.neon.tech/neondb?sslmode=require';

const ORDINARY_ENV = {
  LB_MEMORY_UPDATE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};
const PRIVATE_ENV = {
  LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};
const BOTH_ENV = {
  ...ORDINARY_ENV,
  LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME: 'direct_neon'
};

async function mod() {
  return import(MODULE);
}

function request() {
  return new Request(`https://lovebud.pages.dev/api/memories/${MEMORY_ID}`, {
    method: 'PUT',
    headers: { authorization: 'Bearer opaque-test-token' }
  });
}

function bodyResult(payload) {
  return {
    status: 'ok',
    body: new TextEncoder().encode(JSON.stringify(payload))
  };
}

function verifier(uid = OWNER_ID) {
  return async () => Object.freeze({ uid });
}

function memoryRow(visibility = 'private') {
  return {
    id: MEMORY_ID,
    tree_id: TREE_ID,
    parent_id: null,
    title: 'Memory',
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
    created_at: '2026-09-19 00:00:00.000001+00',
    updated_at: '2026-09-19 00:00:01.000001+00'
  };
}

function makeAdapter({
  ownerId = OWNER_ID,
  entitled = true,
  entitlementThrows = false,
  responseVisibility = 'private'
} = {}) {
  const logs = [];
  let calls = 0;
  const adapter = {
    async runTransaction(work) {
      calls += 1;
      const tx = {
        async query(sql, values = []) {
          logs.push({ sql, values: [...values] });
          if (sql.includes('INNER JOIN trees t ON t.id = m.tree_id')) {
            return [{
              id: MEMORY_ID,
              tree_id: TREE_ID,
              parent_id: null,
              tree_owner_id: ownerId
            }];
          }
          if (sql.includes('FROM public.users')) {
            if (entitlementThrows) throw new Error('synthetic-private-provider-detail');
            return [{ private_storage_enabled: entitled }];
          }
          if (sql.includes('UPDATE memories')) {
            return [memoryRow(responseVisibility)];
          }
          return [];
        }
      };
      return { value: await work(tx) };
    }
  };
  return { adapter, logs, get calls() { return calls; } };
}

function queries(fake) {
  return fake.logs.map((entry) => entry.sql);
}

async function invoke(m, env, payload, fake, requestId = 'rid-memory-private-4425') {
  return m.handleMemoryUpdateDirectNeon(
    request(),
    MEMORY_ID,
    env,
    requestId,
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult(payload)
    }
  );
}

test('private visibility gate is independent from ordinary Memory update gate', async () => {
  const m = await mod();
  assert.equal(m.isMemoryUpdateDirectNeonSelected(ORDINARY_ENV), true);
  assert.equal(m.isMemoryPrivateVisibilityUpdateDirectNeonSelected(ORDINARY_ENV), false);
  assert.equal(m.isMemoryPrivateVisibilityUpdateDirectNeonSelected(PRIVATE_ENV), true);
  assert.equal(m.isAnyMemoryUpdateDirectNeonSelected(PRIVATE_ENV), true);
  assert.equal(m.isAnyMemoryUpdateDirectNeonSelected({}), false);
});

test('ordinary gate only keeps explicit private Memory update on Modal before DB acquisition', async () => {
  const m = await mod();
  const fake = makeAdapter();
  const resp = await invoke(m, ORDINARY_ENV, { visibility: 'private' }, fake);
  assert.equal(resp, null);
  assert.equal(fake.calls, 0);
});

test('private-only gate does not steal ordinary Memory update', async () => {
  const m = await mod();
  const fake = makeAdapter({ responseVisibility: 'public' });
  const resp = await invoke(m, PRIVATE_ENV, { title: 'ordinary' }, fake);
  assert.equal(resp, null);
  assert.equal(fake.calls, 0);
});

test('owner authorization precedes private entitlement and mutation', async () => {
  const m = await mod();
  const fake = makeAdapter({ ownerId: 'different-owner', entitled: true });
  const resp = await invoke(m, BOTH_ENV, { visibility: 'private' }, fake);
  assert.equal(resp.status, 403);
  assert.deepEqual(await resp.json(), { detail: 'Access denied: not your memory' });
  const q = queries(fake);
  assert.equal(q.some((sql) => sql.includes('FROM public.users')), false);
  assert.equal(q.some((sql) => sql.includes('UPDATE memories')), false);
});

test('allowlist and pre-visibility validation preserve Modal precedence before entitlement', async () => {
  const m = await mod();

  const unsupported = makeAdapter({ entitled: false });
  const unsupportedResp = await invoke(
    m,
    BOTH_ENV,
    { visibility: 'private', clientKey: 'immutable' },
    unsupported
  );
  assert.equal(unsupportedResp.status, 400);
  assert.equal((await unsupportedResp.json()).detail.code, 'UNSUPPORTED_MEMORY_UPDATE_FIELDS');
  assert.equal(queries(unsupported).some((sql) => sql.includes('FROM public.users')), false);

  const badTitle = makeAdapter({ entitled: false });
  const badTitleResp = await invoke(
    m,
    BOTH_ENV,
    { title: 42, visibility: 'private' },
    badTitle
  );
  assert.equal(badTitleResp.status, 400);
  assert.equal(queries(badTitle).some((sql) => sql.includes('FROM public.users')), false);

  const badEmotion = makeAdapter({ entitled: false });
  const badEmotionResp = await invoke(
    m,
    BOTH_ENV,
    { visibility: 'private', emotionTags: 'not-an-array' },
    badEmotion
  );
  assert.equal(badEmotionResp.status, 400);
  assert.equal(queries(badEmotion).some((sql) => sql.includes('FROM public.users')), false);
});

test('private entitlement precedes Modal post-visibility validation', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: false });
  const resp = await invoke(
    m,
    BOTH_ENV,
    { visibility: 'private', channelId: 42 },
    fake
  );
  assert.equal(resp.status, 403);
  assert.equal((await resp.json()).code, 'PLUS_REQUIRED_PRIVATE_STORAGE');
  assert.equal(queries(fake).some((sql) => sql.includes('UPDATE memories')), false);
});

test('non-Plus private update returns stable 403 with zero UPDATE', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: false });
  const resp = await invoke(m, BOTH_ENV, { visibility: 'private' }, fake);
  assert.equal(resp.status, 403);
  assert.deepEqual(await resp.json(), {
    error: 'Private storage requires Plus.',
    code: 'PLUS_REQUIRED_PRIVATE_STORAGE',
    upgradeRequired: true
  });
  const q = queries(fake);
  const owner = q.findIndex((sql) => sql.includes('INNER JOIN trees'));
  const entitlement = q.findIndex((sql) => sql.includes('FROM public.users'));
  assert.ok(owner >= 0 && entitlement > owner);
  assert.equal(q.some((sql) => sql.includes('UPDATE memories')), false);
});

test('entitlement lookup outage returns stable 503 and leaks no provider detail', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitlementThrows: true });
  const resp = await invoke(m, BOTH_ENV, { visibility: 'private' }, fake);
  assert.equal(resp.status, 503);
  const json = await resp.json();
  assert.deepEqual(json, {
    error: 'Entitlement check temporarily unavailable.',
    code: 'ENTITLEMENT_CHECK_UNAVAILABLE',
    upgradeRequired: false
  });
  assert.doesNotMatch(JSON.stringify(json), /synthetic-private-provider-detail/);
  assert.equal(queries(fake).some((sql) => sql.includes('UPDATE memories')), false);
});

test('Plus private update performs entitlement before UPDATE and returns canonical private DTO', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: true, responseVisibility: 'private' });
  const resp = await invoke(
    m,
    BOTH_ENV,
    { title: 'Private memory', visibility: 'private' },
    fake
  );
  assert.equal(resp.status, 200);
  const json = await resp.json();
  assert.equal(json.id, MEMORY_ID);
  assert.equal(json.visibility, 'private');

  const q = queries(fake);
  const owner = q.findIndex((sql) => sql.includes('INNER JOIN trees'));
  const entitlement = q.findIndex((sql) => sql.includes('FROM public.users'));
  const update = q.findIndex((sql) => sql.includes('UPDATE memories'));
  assert.ok(owner >= 0 && entitlement > owner && update > entitlement);
});

test('ordinary public update performs zero private-entitlement reads even when both gates exist', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: false, responseVisibility: 'public' });
  const resp = await invoke(m, BOTH_ENV, { visibility: 'public' }, fake);
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).visibility, 'public');
  assert.equal(queries(fake).some((sql) => sql.includes('FROM public.users')), false);
});

test('contract and source configuration keep private visibility source-only', async () => {
  const m = await mod();
  const c = m.MEMORY_UPDATE_DIRECT_NEON_CONTRACT;
  assert.equal(c.privateVisibilityGateEnv, 'LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME');
  assert.equal(c.privateEntitlementSource, 'neon.public.users.private_storage_enabled');
  assert.equal(c.privateEntitlementAfterOwnerAndPreVisibilityValidationBeforeMutation, true);
  assert.equal(c.privatePlusRequiredCode, 'PLUS_REQUIRED_PRIVATE_STORAGE');
  assert.equal(c.privateEntitlementUnavailableCode, 'ENTITLEMENT_CHECK_UNAVAILABLE');
  assert.equal(c.privateVisibilityGateCheckedIn, false);

  const root = path.resolve(__dirname, '..', '..');
  const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  assert.doesNotMatch(wrangler, /LB_MEMORY_PRIVATE_VISIBILITY_WRITE_RUNTIME/);

  const route = fs.readFileSync(path.join(root, 'functions/api/memories/[id].js'), 'utf8');
  assert.match(route, /isAnyMemoryUpdateDirectNeonSelected/);
});
