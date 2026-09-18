// #4425 source-only contract for private Tree visibility update on Direct-Neon.
//
// No network/database/provider/Product request. Uses injected Firebase verifier,
// transaction adapter, and bounded body bytes only.

const assert = require('node:assert/strict');
const test = require('node:test');

const MODULE = '../../functions/_shared/tree-update-direct-neon.js';
const TREE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'firebase-owner-4425';
const NEON_URL = 'postgresql://user:pass@ep-tree-private-update.us-east-1.aws.neon.tech/neondb?sslmode=require';

const ORDINARY_ENV = {
  LB_TREE_UPDATE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};
const PRIVATE_ENV = {
  LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: NEON_URL
};
const BOTH_ENV = {
  ...ORDINARY_ENV,
  LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME: 'direct_neon'
};

async function mod() {
  return import(MODULE);
}

function request() {
  return new Request(`https://lovebud.pages.dev/api/trees/${TREE_ID}`, {
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

function makeAdapter({
  ownerId = OWNER_ID,
  entitled = true,
  entitlementThrows = false,
  canonicalVisibility = 'private'
} = {}) {
  const logs = [];
  let calls = 0;
  const adapter = {
    async runTransaction(work) {
      calls += 1;
      const tx = {
        async query(sql, values) {
          logs.push({ kind: 'query', sql, values });
          if (sql.includes('FROM trees') && sql.includes('owner_id::text AS owner_id')) {
            return [{ id: TREE_ID, owner_id: ownerId }];
          }
          if (sql.includes('SELECT private_storage_enabled')) {
            if (entitlementThrows) throw new Error('provider-private-detail');
            return [{ private_storage_enabled: entitled }];
          }
          if (sql.includes('UPDATE trees')) {
            return [{ id: TREE_ID }];
          }
          if (sql.includes('has_social_counts')) {
            return [{ has_social_counts: false, has_like_count: false, has_view_count: false }];
          }
          return [];
        },
        async canonicalReread(sql, values) {
          logs.push({ kind: 'canonical', sql, values });
          return [{
            id: TREE_ID,
            owner_id: OWNER_ID,
            title: 'Tree',
            visibility: canonicalVisibility,
            group_name: null,
            keywords: [],
            created_at: '2026-09-18 10:00:00.000001+00',
            updated_at: '2026-09-18 10:00:01.000001+00',
            memory_count: 0
          }];
        }
      };
      return { value: await work(tx) };
    }
  };
  return { adapter, logs, get calls() { return calls; } };
}

function texts(logs) {
  return logs.filter(x => x.kind === 'query').map(x => x.sql);
}

test('private visibility gate is independent from ordinary Tree update gate', async () => {
  const m = await mod();
  assert.equal(m.isTreeUpdateDirectNeonSelected(ORDINARY_ENV), true);
  assert.equal(m.isTreePrivateVisibilityUpdateDirectNeonSelected(ORDINARY_ENV), false);
  assert.equal(m.isTreePrivateVisibilityUpdateDirectNeonSelected(PRIVATE_ENV), true);
  assert.equal(m.isAnyTreeUpdateDirectNeonSelected(PRIVATE_ENV), true);
  assert.equal(m.isAnyTreeUpdateDirectNeonSelected({}), false);
});

test('ordinary gate only keeps explicit private update on Modal before DB acquisition', async () => {
  const m = await mod();
  const fake = makeAdapter();
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, ORDINARY_ENV, 'rid-private-off',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private' })
    }
  );
  assert.equal(resp, null);
  assert.equal(fake.calls, 0);
});

test('private-only gate does not steal ordinary public/title update', async () => {
  const m = await mod();
  const fake = makeAdapter({ canonicalVisibility: 'public' });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, PRIVATE_ENV, 'rid-ordinary-off',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ title: 'Updated' })
    }
  );
  assert.equal(resp, null);
  assert.equal(fake.calls, 0);
});

test('owner authorization precedes private entitlement lookup', async () => {
  const m = await mod();
  const fake = makeAdapter({ ownerId: 'another-owner', entitled: true });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-owner-first',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private' })
    }
  );
  assert.equal(resp.status, 403);
  assert.deepEqual(await resp.json(), { detail: 'Access denied: not your tree' });
  const q = texts(fake.logs);
  assert.equal(q.some(x => x.includes('SELECT private_storage_enabled')), false);
  assert.equal(q.some(x => x.includes('UPDATE trees')), false);
});

test('unsupported payload fields fail after owner check but before entitlement lookup', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: true });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-allowlist-first',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private', ownerId: 'spoof' })
    }
  );
  assert.equal(resp.status, 400);
  const json = await resp.json();
  assert.equal(json.detail.code, 'UNSUPPORTED_TREE_UPDATE_FIELDS');
  assert.deepEqual(json.detail.fields, ['ownerId']);
  const q = texts(fake.logs);
  assert.equal(q.some(x => x.includes('SELECT private_storage_enabled')), false);
  assert.equal(q.some(x => x.includes('UPDATE trees')), false);
});

test('non-Plus private update returns stable 403 and performs no UPDATE', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: false });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-free',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private' })
    }
  );
  assert.equal(resp.status, 403);
  assert.deepEqual(await resp.json(), {
    error: 'Private storage requires Plus.',
    code: 'PLUS_REQUIRED_PRIVATE_STORAGE',
    upgradeRequired: true
  });
  const q = texts(fake.logs);
  const owner = q.findIndex(x => x.includes('owner_id::text AS owner_id'));
  const entitlement = q.findIndex(x => x.includes('SELECT private_storage_enabled'));
  assert.ok(owner >= 0 && entitlement > owner);
  assert.equal(q.some(x => x.includes('UPDATE trees')), false);
});

test('entitlement lookup failure returns stable 503 and leaks no raw detail', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitlementThrows: true });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-outage',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private' })
    }
  );
  assert.equal(resp.status, 503);
  const json = await resp.json();
  assert.deepEqual(json, {
    error: 'Entitlement check temporarily unavailable.',
    code: 'ENTITLEMENT_CHECK_UNAVAILABLE',
    upgradeRequired: false
  });
  assert.doesNotMatch(JSON.stringify(json), /provider-private-detail/);
  assert.equal(texts(fake.logs).some(x => x.includes('UPDATE trees')), false);
});

test('Plus private update checks entitlement before UPDATE and returns private canonical DTO', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: true, canonicalVisibility: 'private' });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-plus',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private', title: 'Private Tree' })
    }
  );
  assert.equal(resp.status, 200);
  const json = await resp.json();
  assert.equal(json.id, TREE_ID);
  assert.equal(json.ownerId, OWNER_ID);
  assert.equal(json.visibility, 'private');

  const q = texts(fake.logs);
  const owner = q.findIndex(x => x.includes('owner_id::text AS owner_id'));
  const entitlement = q.findIndex(x => x.includes('SELECT private_storage_enabled'));
  const update = q.findIndex(x => x.includes('UPDATE trees'));
  assert.ok(owner >= 0 && entitlement > owner && update > entitlement);
});

test('ordinary public update performs zero entitlement reads', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: false, canonicalVisibility: 'public' });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-public',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'public' })
    }
  );
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).visibility, 'public');
  assert.equal(texts(fake.logs).some(x => x.includes('SELECT private_storage_enabled')), false);
});

test('contract metadata binds private visibility to Neon entitlement and independent gate', async () => {
  const m = await mod();
  const c = m.TREE_UPDATE_DIRECT_NEON_CONTRACT;
  assert.equal(c.privateVisibilityGateEnv, 'LB_TREE_PRIVATE_VISIBILITY_WRITE_RUNTIME');
  assert.equal(c.privateEntitlementSource, 'neon.public.users.private_storage_enabled');
  assert.equal(c.privateEntitlementAfterOwnerAndAllowlistBeforeMutation, true);
  assert.equal(c.privatePlusRequiredCode, 'PLUS_REQUIRED_PRIVATE_STORAGE');
  assert.equal(c.privateEntitlementUnavailableCode, 'ENTITLEMENT_CHECK_UNAVAILABLE');
});
