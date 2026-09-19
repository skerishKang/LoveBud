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

test('Modal field order is preserved around private entitlement', async () => {
  const m = await mod();

  // title is processed before visibility in Modal, so malformed title wins and
  // entitlement is never queried.
  const badTitle = makeAdapter({ entitled: false });
  const titleResp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-order-title',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: badTitle.adapter,
      boundedBodyResult: bodyResult({ title: 42, visibility: 'private' })
    }
  );
  assert.equal(titleResp.status, 400);
  assert.equal(texts(badTitle.logs).some(x => x.includes('SELECT private_storage_enabled')), false);

  // groupName is processed after visibility in Modal, so a non-Plus denial
  // wins before later groupName validation.
  const badGroup = makeAdapter({ entitled: false });
  const groupResp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-order-group',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: badGroup.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private', groupName: true })
    }
  );
  assert.equal(groupResp.status, 403);
  assert.equal((await groupResp.json()).code, 'PLUS_REQUIRED_PRIVATE_STORAGE');
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

// --- #4460 SQL placeholder regression contracts --------------------------
//
// This file previously asserted only that an UPDATE happened after
// entitlement. It never inspected the generated assignment placeholders, so
// the shared `${column} = ${values.length}` regression went undetected here.

function privateUpdateEntry(logs) {
  return logs.find((entry) => entry.kind === 'query' && entry.sql.includes('UPDATE trees'));
}

function privateAssignmentClause(sql) {
  const match = /SET ([\s\S]*?), updated_at = NOW\(\)/.exec(sql);
  assert.ok(match, `UPDATE trees SET clause not found in: ${sql}`);
  return match[1];
}

test('#4460 private visibility update binds $1 and tree/owner as $2/$3', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: true, canonicalVisibility: 'private' });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-4460-private-single',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ visibility: 'private' })
    }
  );
  assert.equal(resp.status, 200);

  const update = privateUpdateEntry(fake.logs);
  assert.ok(update, 'UPDATE trees must execute');

  assert.equal(privateAssignmentClause(update.sql), 'visibility = $1');
  // Negative control: the pre-#4460 regression rendered `visibility = 1`.
  assert.doesNotMatch(update.sql, /visibility = \d/);

  assert.match(update.sql, /WHERE id = \$2\s+AND owner_id = \$3/);
  assert.deepEqual(update.values, ['private', TREE_ID, OWNER_ID]);
});

test('#4460 private mixed payload numbers title/visibility then tree/owner', async () => {
  const m = await mod();
  const fake = makeAdapter({ entitled: true, canonicalVisibility: 'private' });
  const resp = await m.handleTreeUpdateDirectNeon(
    request(), TREE_ID, BOTH_ENV, 'rid-4460-private-mixed',
    {
      verifyTokenOverride: verifier(),
      transactionAdapterOverride: fake.adapter,
      boundedBodyResult: bodyResult({ title: 'Private Tree', visibility: 'private' })
    }
  );
  assert.equal(resp.status, 200);

  const update = privateUpdateEntry(fake.logs);
  assert.ok(update, 'UPDATE trees must execute');

  assert.equal(privateAssignmentClause(update.sql), 'title = $1, visibility = $2');
  assert.doesNotMatch(update.sql, /(?:title|visibility) = \d/);

  assert.match(update.sql, /WHERE id = \$3\s+AND owner_id = \$4/);
  assert.deepEqual(update.values, ['Private Tree', 'private', TREE_ID, OWNER_ID]);
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
