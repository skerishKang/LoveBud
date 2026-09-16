// Contract tests for #4424 private Tree capability direct-Neon source candidate.
//
// Run: node --test tests/contracts/private-tree-capability-direct-neon.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TREE_ID = '11111111-1111-4111-8111-111111111111';
const DB = 'postgresql://reader:secret@ep-capability-test.neon.tech/neondb?sslmode=require';

function env(extra = {}) {
  return {
    LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: DB,
    FIREBASE_PROJECT_ID: 'relovetree',
    ...extra
  };
}

function request(auth = 'Bearer opaque-firebase-token') {
  const headers = {};
  if (auth !== null) headers.authorization = auth;
  return new Request('https://example.test/api/private/trees/' + TREE_ID + '/capability', { headers });
}

test('#4424 gate is exact and uses the existing read-only DB binding only', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');
  assert.equal(direct.isPrivateTreeCapabilityDirectNeonSelected({}), false);
  assert.equal(direct.isPrivateTreeCapabilityDirectNeonSelected({ LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME: 'modal' }), false);
  assert.equal(direct.isPrivateTreeCapabilityDirectNeonSelected({ LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME: 'future' }), false);
  assert.equal(direct.isPrivateTreeCapabilityDirectNeonSelected(env()), true);
  assert.equal(direct.readPrivateTreeCapabilityConfig({ DATABASE_URL: DB }).configured, false);
  assert.equal(direct.readPrivateTreeCapabilityConfig({ NETLIFY_DATABASE_URL: DB }).configured, false);
  assert.equal(direct.readPrivateTreeCapabilityConfig(env()).configured, true);
});

test('#4424 verified Firebase legacyOwnerId is the sole SQL owner authority', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');
  const calls = [];
  const response = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(),
    TREE_ID,
    env(),
    'req-cap-owner',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner', email: 'ignored@example.invalid' }),
      executorOverride: async (text, values) => {
        calls.push({ text, values });
        return [{ viewer_can_edit: true }];
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'tree-capability-complete');
  assert.deepEqual(await response.json(), { viewerCanEdit: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, [TREE_ID, 'verified-owner']);
  assert.match(calls[0].text, /FROM trees/);
  assert.match(calls[0].text, /owner_id = \$2/);
  assert.doesNotMatch(calls[0].text, /INSERT|UPDATE|DELETE/i);
});

test('#4424 non-owner remains a bounded 200 false capability', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');
  const response = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(), TREE_ID, env(), 'req-cap-no',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-non-owner' }),
      executorOverride: async () => [{ viewer_can_edit: false }]
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { viewerCanEdit: false });
});

test('#4424 malformed/rejected bearer collapses to false but verifier outage fails closed', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');

  const malformed = await direct.handlePrivateTreeCapabilityDirectNeon(
    request('Bearer token extra'), TREE_ID, env(), 'req-cap-malformed',
    {
      verifyTokenOverride: async () => {
        throw new Error('must not be called for malformed authorization');
      },
      executorOverride: async () => {
        throw new Error('DB must not execute');
      }
    }
  );
  assert.equal(malformed.status, 200);
  assert.deepEqual(await malformed.json(), { viewerCanEdit: false });

  const rejected = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(), TREE_ID, env(), 'req-cap-rejected',
    {
      verifyTokenOverride: async () => null,
      executorOverride: async () => {
        throw new Error('DB must not execute');
      }
    }
  );
  assert.equal(rejected.status, 200);
  assert.deepEqual(await rejected.json(), { viewerCanEdit: false });

  const unavailable = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(), TREE_ID, env(), 'req-cap-unavailable',
    {
      verifyTokenOverride: async () => {
        throw new Error('private verifier detail');
      },
      executorOverride: async () => {
        throw new Error('DB must not execute');
      }
    }
  );
  assert.equal(unavailable.status, 503);
  const text = await unavailable.text();
  assert.match(text, /FIREBASE_VERIFIER_UNAVAILABLE/);
  assert.doesNotMatch(text, /private verifier detail/);
});

test('#4424 malformed/non-UUID tree id returns false without DB work', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');
  let dbCalls = 0;
  const response = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(), 'not-a-uuid', env(), 'req-cap-id',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner' }),
      executorOverride: async () => {
        dbCalls += 1;
        return [];
      }
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { viewerCanEdit: false });
  assert.equal(dbCalls, 0);
});

test('#4424 missing direct DB config fails closed after verified auth', async () => {
  const direct = await import('../../functions/_shared/private-tree-capability-direct-neon.js');
  const response = await direct.handlePrivateTreeCapabilityDirectNeon(
    request(), TREE_ID,
    {
      LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME: 'direct_neon',
      FIREBASE_PROJECT_ID: 'relovetree'
    },
    'req-cap-config',
    { verifyTokenOverride: async () => ({ uid: 'verified-owner' }) }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
});

test('#4424 catch-all route wires only GET capability into the gated direct helper', () => {
  const routeSource = fs.readFileSync(path.join(ROOT, 'functions/api/[[path]].js'), 'utf8');
  assert.match(routeSource, /private-tree-capability-direct-neon\.js/);
  assert.match(routeSource, /isPrivateTreeCapabilityDirectNeonSelected\(env \|\| \{\}\)/);
  assert.match(routeSource, /handlePrivateTreeCapabilityDirectNeon/);
  assert.match(routeSource, /LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME/);
  assert.match(routeSource, /if \(isPrivateTreeCapabilityRequest\(request\)/);
});

test('#4424 helper is read-only and exposes only viewerCanEdit on successful capability decisions', () => {
  const source = fs.readFileSync(path.join(ROOT, 'functions/_shared/private-tree-capability-direct-neon.js'), 'utf8');
  assert.match(source, /SELECT EXISTS/);
  assert.match(source, /FROM trees/);
  for (const forbidden of ['INSERT INTO', 'UPDATE trees', 'DELETE FROM', 'BEGIN;', 'COMMIT;', 'ROLLBACK;', 'MODAL_BASE_URL']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /viewerCanEdit/);
  assert.doesNotMatch(source, /ownerId\s*:/);
});
