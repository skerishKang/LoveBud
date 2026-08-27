const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `${startPattern} should exist`);

  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `${endPattern} should exist after ${startPattern}`);

  return afterStart.slice(0, end);
}

test('static contract: functions/api/[[path]].js delegates Content-Length early rejection to the shared bounded reader', () => {
  const source = readFile(CATCHALL_JS);

  assert.match(source, /import\s*\{\s*readBoundedRequestBody\s*\}\s*from\s*['"]\.\.\/_shared\/bounded-request-body\.js['"]/);
  assert.doesNotMatch(source, /function\s+getContentLengthBytes\s*\(/);
  assert.doesNotMatch(source, /function\s+isWriteContentLengthTooLarge\s*\(/);
  assert.doesNotMatch(source, /const\s+MAX_WRITE_BODY_BYTES\s*=/);
  assert.doesNotMatch(source, /async\s+function\s+readBoundedWriteBody\s*\(/);

  const writeBlock = sliceBetween(
    source,
    /async\s+function\s+tryModalWrite\s*\(/,
    /export\s+async\s+function\s+onRequest\s*\(/
  );

  assert.match(writeBlock, /await\s+readBoundedRequestBody\(request\)/);
  assert.match(writeBlock, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(writeBlock, /return\s+buildBodyReadFailedResponse\(requestId\)/);
});

test('runtime: early rejection returns 413 without reading the body when content-length is too large', { timeout: 10_000 }, async () => {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;

  let textWasRead = false;

  const request = {
    method: 'POST',
    url: 'https://test5.lovebud.pages.dev/api/trees',
    headers: {
      get(name) {
        const hdrs = {
          'content-type': 'application/json',
          'content-length': String((128 * 1024) + 1),
          'authorization': 'mock-auth-token',
          'x-lovebud-request-id': 'content-length-test'
        };
        return hdrs[name.toLowerCase()] || null;
      }
    },
    async text() {
      textWasRead = true;
      throw new Error('Should not read body');
    }
  };

  const env = {
    MODAL_BASE_URL: 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run'
  };

  const response = await onRequest({ request, env });

  assert.equal(response.status, 413);
  assert.equal(textWasRead, false);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'payload-too-large');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'content-length-test');
});

// ─── #4217 Hub Layout direct-Neon candidate ────────────────────────────────

const HUB_LAYOUT_ROUTE = path.join(
  ROOT,
  'functions/api/trees/[tree_id]/hub-layout.js'
);
const HUB_LAYOUT_DIRECT = path.join(
  ROOT,
  'functions/_shared/hub-layout-direct-neon.js'
);
const HUB_LAYOUT_URL = 'https://example.test/api/trees/tree-4217/hub-layout';
const HUB_LAYOUT_NEON_URL =
  'postgresql://writer:synthetic@ep-hub-layout-4217.us-east-1.neon.tech/neondb?sslmode=require';

function hubLayoutEnv(extra = {}) {
  return {
    LB_HUB_LAYOUT_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_WRITE_DATABASE_URL: HUB_LAYOUT_NEON_URL,
    ...extra
  };
}

function hubLayoutRequest({
  method = 'PUT',
  body = JSON.stringify({
    baseRevision: 0,
    layoutMode: 'manual',
    manualPositions: []
  }),
  authorization = 'Bearer fake-firebase-token',
  headers = {}
} = {}) {
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    'x-lovebud-request-id': 'req-4217',
    ...headers
  });
  if (authorization) requestHeaders.set('authorization', authorization);
  const init = { method, headers: requestHeaders };
  if (!['GET', 'HEAD'].includes(method)) init.body = body;
  return new Request(HUB_LAYOUT_URL, init);
}

function makeHubLayoutTransactionAdapter({
  ownerId = 'verified-owner-4217',
  latestRevision = 0,
  updatedAt = '2026-08-25 05:00:00.123456+00'
} = {}) {
  const calls = [];
  let runCalls = 0;

  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async query(text, values = []) {
          calls.push({
            text,
            values: Array.isArray(values) ? [...values] : values
          });
          if (text.includes('FROM trees')) {
            if (ownerId === null) return [];
            return [{ id: 'tree-4217', owner_id: ownerId }];
          }
          if (text.includes('SELECT pg_advisory_xact_lock')) return [];
          if (text.includes('FROM tree_hub_layouts')) {
            return latestRevision === 0 ? [] : [{ revision: latestRevision }];
          }
          if (text.includes('INSERT INTO tree_hub_layouts')) {
            return [{
              revision: latestRevision + 1,
              updated_at: updatedAt
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
    get runCalls() {
      return runCalls;
    }
  };
}

test('#4217 source shape uses a specific Hub Layout route, preserves catch-all fallback, and reuses canonical boundaries', () => {
  const route = readFile(HUB_LAYOUT_ROUTE);
  const direct = readFile(HUB_LAYOUT_DIRECT);

  assert.match(route, /from\s+['"]\.\.\/\.\.\/\[\[path\]\]\.js['"]/);
  assert.match(route, /catchAllOnRequest\(context\)/);
  assert.match(route, /isHubLayoutDirectNeonWriteRequest\(request\)/);
  assert.match(route, /isHubLayoutDirectNeonSelected\(env\s*\|\|\s*\{\}\)/);

  assert.match(direct, /readBoundedRequestBody/);
  assert.match(direct, /resolveFirebaseReadPrincipal/);
  assert.match(direct, /principal\.legacyOwnerId/);
  assert.match(direct, /createNeonWsTransactionAdapter/);
  assert.match(direct, /LOVE_PLATFORM_WRITE_DATABASE_URL/);
  assert.match(direct, /LB_HUB_LAYOUT_WRITE_RUNTIME/);
  assert.match(direct, /SELECT pg_advisory_xact_lock\(\$1\)/);
  assert.match(direct, /hub-layout:\$\{treeId\}/);
  assert.doesNotMatch(direct, /hashtext\s*\(/i);
  assert.doesNotMatch(direct, /request\.text\s*\(/);
  assert.doesNotMatch(direct, /request\.json\s*\(/);
});

test('#4217 exact gate intercepts only PUT; default PUT and direct-mode GET stay on the existing Modal catch-all', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/hub-layout.js');
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');

  assert.equal(direct.isHubLayoutDirectNeonSelected({}), false);
  assert.equal(
    direct.isHubLayoutDirectNeonSelected({
      LB_HUB_LAYOUT_WRITE_RUNTIME: 'modal'
    }),
    false
  );
  assert.equal(
    direct.isHubLayoutDirectNeonSelected({
      LB_HUB_LAYOUT_WRITE_RUNTIME: 'unknown'
    }),
    false
  );
  assert.equal(direct.isHubLayoutDirectNeonSelected(hubLayoutEnv()), true);
  assert.equal(
    direct.isHubLayoutDirectNeonWriteRequest(hubLayoutRequest()),
    true
  );
  assert.equal(
    direct.isHubLayoutDirectNeonWriteRequest(
      hubLayoutRequest({ method: 'GET', body: undefined })
    ),
    false
  );

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const defaultPut = await route.handleHubLayoutRoute({
      request: hubLayoutRequest(),
      env: { MODAL_BASE_URL: 'https://modal.example' }
    });
    assert.equal(defaultPut.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/modal\/private\/trees\/tree-4217\/hub-layout$/);
    assert.equal(calls[0].options.method, 'POST');

    const directGet = await route.handleHubLayoutRoute({
      request: hubLayoutRequest({ method: 'GET', body: undefined }),
      env: {
        ...hubLayoutEnv(),
        MODAL_BASE_URL: 'https://modal.example'
      }
    });
    assert.equal(directGet.status, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/modal\/private\/trees\/tree-4217\/hub-layout$/);
    assert.ok(
      calls[1].options.method === undefined || calls[1].options.method === 'GET'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4217 direct PUT verifies Firebase owner, preserves exact lock identity/order, and returns saved revision parity', async () => {
  const crypto = require('node:crypto');
  const route = await import('../../functions/api/trees/[tree_id]/hub-layout.js');
  const fixture = makeHubLayoutTransactionAdapter();
  let verifierToken = null;

  const response = await route.handleHubLayoutRoute(
    {
      request: hubLayoutRequest({
        body: JSON.stringify({
          baseRevision: 0,
          layoutMode: 'manual',
          manualPositions: [{
            memoryId: 'memory-a',
            position: { x: 12.5, y: -8 }
          }]
        }),
        headers: {
          'x-owner-id': 'attacker-owner',
          'x-user-email': 'attacker@example.invalid'
        }
      }),
      env: hubLayoutEnv()
    },
    {
      verifyTokenOverride: async (token) => {
        verifierToken = token;
        return { uid: 'verified-owner-4217', email: 'ignored@example.invalid' };
      },
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 200);
  assert.equal(verifierToken, 'fake-firebase-token');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4217');

  assert.equal(fixture.runCalls, 1);
  assert.equal(fixture.calls.length, 4);
  assert.match(fixture.calls[0].text, /FROM trees/);
  assert.match(fixture.calls[1].text, /SELECT pg_advisory_xact_lock\(\$1\)/);
  assert.match(fixture.calls[2].text, /FROM tree_hub_layouts/);
  assert.match(fixture.calls[3].text, /INSERT INTO tree_hub_layouts/);

  const digest = crypto
    .createHash('sha256')
    .update('hub-layout:tree-4217', 'utf8')
    .digest();
  const expectedLockKey = digest.readBigInt64BE(0);
  assert.equal(fixture.calls[1].values[0], expectedLockKey);
  assert.equal(typeof fixture.calls[1].values[0], 'bigint');

  const body = await response.json();
  assert.deepEqual(body, {
    revision: 1,
    updatedAt: '2026-08-25T05:00:00.123456+00:00',
    positions: [{
      memoryId: 'memory-a',
      position: { x: 12.5, y: -8 }
    }]
  });
});

test('#4217 auth is before body/DB and the shared 128 KiB reader rejects direct oversized writes before transaction start', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');

  const unauthFixture = makeHubLayoutTransactionAdapter();
  const unauth = await direct.handleHubLayoutDirectNeon(
    hubLayoutRequest({
      authorization: null,
      body: 'x'.repeat((129 * 1024))
    }),
    hubLayoutEnv(),
    'req-4217',
    {
      verifyTokenOverride: async () => {
        throw new Error('must not verify absent authorization');
      },
      transactionAdapterOverride: unauthFixture.adapter
    }
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauthFixture.runCalls, 0);
  assert.equal(
    unauth.headers.get('x-lovebud-upstream'),
    'direct-neon'
  );

  const oversizedFixture = makeHubLayoutTransactionAdapter();
  const oversized = await direct.handleHubLayoutDirectNeon(
    hubLayoutRequest({ body: 'y'.repeat(129 * 1024) }),
    hubLayoutEnv(),
    'req-4217',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      transactionAdapterOverride: oversizedFixture.adapter
    }
  );
  assert.equal(oversized.status, 413);
  assert.equal(oversizedFixture.runCalls, 0);
  assert.equal(oversized.headers.get('x-lovebud-route-status'), 'payload-too-large');
  assert.doesNotMatch(await oversized.text(), /y{10,}/);
});

test('#4217 direct config never falls back to generic/read database URLs', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');
  const fixture = makeHubLayoutTransactionAdapter();

  const response = await direct.handleHubLayoutDirectNeon(
    hubLayoutRequest(),
    {
      LB_HUB_LAYOUT_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: HUB_LAYOUT_NEON_URL,
      DATABASE_URL: HUB_LAYOUT_NEON_URL
    },
    'req-4217',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 503);
  assert.equal(fixture.runCalls, 0);
  assert.equal(
    (await response.json()).code,
    'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
  );
});

test('#4217 payload validator pins revision, mode, manual-position bounds, duplicate IDs, and safe defaults', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');

  assert.deepEqual(
    direct.validateHubLayoutPayload({ baseRevision: 0 }),
    {
      baseRevision: 0,
      layoutMode: 'manual',
      manualPositions: []
    }
  );

  assert.throws(
    () => direct.validateHubLayoutPayload({}),
    /baseRevision is required/
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({ baseRevision: -1 }),
    /non-negative integer/
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({
      baseRevision: 0,
      layoutMode: 'free'
    }),
    /layoutMode/
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({
      baseRevision: 0,
      manualPositions: {}
    }),
    /must be an array/
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({
      baseRevision: 0,
      manualPositions: [
        { memoryId: 'same', position: { x: 0, y: 0 } },
        { memoryId: 'same', position: { x: 1, y: 1 } }
      ]
    }),
    /Duplicate memoryId/
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({
      baseRevision: 0,
      manualPositions: [
        {
          memoryId: 'wrong-type',
          position: { x: 'nope', y: 0 }
        }
      ]
    }),
    (error) => error.message ===
      'manualPositions[0].position x and y must be numbers'
  );
  assert.throws(
    () => direct.validateHubLayoutPayload({
      baseRevision: 0,
      manualPositions: [
        {
          memoryId: 'too-far',
          position: { x: 1_000_001, y: 0 }
        }
      ]
    }),
    (error) => error.message ===
      'manualPositions[0].position coordinates exceed limit of 1000000'
  );
});

test('#4217 malformed path encoding remains a 400 boundary before auth/body/DB work', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');
  const fixture = makeHubLayoutTransactionAdapter();
  let verifierCalls = 0;

  const request = new Request(
    'https://example.test/api/trees/%ZZ/hub-layout',
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-lovebud-request-id': 'req-4217-malformed'
      },
      body: 'z'.repeat(129 * 1024)
    }
  );

  const response = await direct.handleHubLayoutDirectNeon(
    request,
    hubLayoutEnv(),
    'req-4217-malformed',
    {
      verifyTokenOverride: async () => {
        verifierCalls += 1;
        return { uid: 'verified-owner-4217' };
      },
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'invalid-path-encoding');
  assert.equal(verifierCalls, 0);
  assert.equal(fixture.runCalls, 0);
  assert.doesNotMatch(await response.text(), /%ZZ|z{10,}/);
});

test('#4217 owner failure and stale revision fail before INSERT with bounded 404/403/409 parity', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');

  for (const [fixtureOptions, expectedStatus] of [
    [{ ownerId: null }, 404],
    [{ ownerId: 'different-owner' }, 403],
    [{ latestRevision: 2 }, 409]
  ]) {
    const fixture = makeHubLayoutTransactionAdapter(fixtureOptions);
    const baseRevision = expectedStatus === 409 ? 1 : 0;
    const response = await direct.handleHubLayoutDirectNeon(
      hubLayoutRequest({
        body: JSON.stringify({
          baseRevision,
          layoutMode: 'manual',
          manualPositions: []
        })
      }),
      hubLayoutEnv(),
      'req-4217',
      {
        verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, expectedStatus);
    assert.equal(
      fixture.calls.some((call) => call.text.includes('INSERT INTO tree_hub_layouts')),
      false
    );
  }
});

test('#4217 unknown COMMIT outcome is explicit, sanitized, and never marked retry-safe', async () => {
  const direct = await import('../../functions/_shared/hub-layout-direct-neon.js');
  const transaction = await import(
    '../../functions/_shared/db/neon-ws-transaction-adapter.js'
  );

  const response = await direct.handleHubLayoutDirectNeon(
    hubLayoutRequest(),
    hubLayoutEnv(),
    'req-4217',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      transactionAdapterOverride: {
        async runTransaction() {
          throw new transaction.NeonWsTransactionError(
            transaction.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'PRIVATE connection secret must never surface',
            {
              status: 502,
              transactionState:
                transaction.NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN,
              commitOutcome:
                transaction.NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN
            }
          );
        }
      }
    }
  );

  assert.equal(response.status, 502);
  const text = await response.text();
  assert.match(text, /COMMIT_OUTCOME_UNKNOWN/);
  assert.match(text, /"commitOutcome":"unknown"/);
  assert.match(text, /"wholeTransactionRetrySafe":false/);
  assert.doesNotMatch(text, /PRIVATE|connection secret/);
});

// ─── #4230 Tree DELETE direct-Neon candidate ───────────────────────────────

const TREE_DELETE_ROUTE = path.join(ROOT, 'functions/api/trees/[id].js');
const TREE_DELETE_DIRECT = path.join(ROOT, 'functions/_shared/tree-delete-direct-neon.js');
const TREE_DELETE_ID = '11111111-1111-4111-8111-111111111111';
const TREE_DELETE_OWNER = 'verified-owner-4230';
const TREE_DELETE_URL = `https://lovebud.pages.dev/api/trees/${TREE_DELETE_ID}`;
const TREE_DELETE_NEON_URL =
  'postgresql://writer:synthetic@ep-tree-delete-4230.us-east-1.neon.tech/neondb?sslmode=require';

function treeDeleteEnv(extra = {}) {
  return {
    LB_TREE_DELETE_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_WRITE_DATABASE_URL: TREE_DELETE_NEON_URL,
    ...extra
  };
}

function treeDeleteRequest({ authorization = 'Bearer fake-firebase-token', headers = {} } = {}) {
  const requestHeaders = new Headers({
    'x-lovebud-request-id': 'req-4230',
    ...headers
  });
  if (authorization) requestHeaders.set('authorization', authorization);
  return new Request(TREE_DELETE_URL, { method: 'DELETE', headers: requestHeaders });
}

function makeTreeDeleteTransactionAdapter({
  ownerId = TREE_DELETE_OWNER,
  deletedId = TREE_DELETE_ID
} = {}) {
  const calls = [];
  let runCalls = 0;
  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async query(text, values = []) {
          calls.push({ text, values: Array.isArray(values) ? [...values] : values });
          if (text.includes('FROM trees')) {
            return ownerId === null ? [] : [{ id: TREE_DELETE_ID, owner_id: ownerId }];
          }
          if (text.includes('UPDATE memories')) return [];
          if (text.includes('DELETE FROM memories')) return [];
          if (text.includes('DELETE FROM trees')) {
            return deletedId === null ? [] : [{ id: deletedId }];
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
    get runCalls() {
      return runCalls;
    }
  };
}

test('#4230 source shape keeps GET/PUT outside the delete gate and preserves the exact Modal delete sequence', async () => {
  const route = readFile(TREE_DELETE_ROUTE);
  const directSource = readFile(TREE_DELETE_DIRECT);
  const direct = await import('../../functions/_shared/tree-delete-direct-neon.js');

  const putBlock = sliceBetween(
    route,
    /export\s+async\s+function\s+onRequestPut\s*\(/,
    /export\s+async\s+function\s+onRequestDelete\s*\(/
  );
  const getBlock = sliceBetween(
    route,
    /export\s+async\s+function\s+onRequestGet\s*\(/,
    /function\s+hasAuthorizationHeader\s*\(/
  );
  const deleteStart = route.search(/export\s+async\s+function\s+onRequestDelete\s*\(/);
  assert.notEqual(deleteStart, -1);
  const deleteBlock = route.slice(deleteStart);

  assert.doesNotMatch(getBlock, /isTreeDeleteDirectNeonSelected|LB_TREE_DELETE_WRITE_RUNTIME/);
  assert.doesNotMatch(putBlock, /isTreeDeleteDirectNeonSelected|LB_TREE_DELETE_WRITE_RUNTIME/);
  assert.match(deleteBlock, /isTreeDeleteDirectNeonSelected\(context\.env\)/);
  assert.match(deleteBlock, /handleTreeDeleteDirectNeon/);
  assert.ok(
    deleteBlock.indexOf('handleTreeDeleteDirectNeon') < deleteBlock.indexOf('MODAL_BASE_URL'),
    'direct DELETE must execute before Modal configuration is required'
  );

  assert.deepEqual(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.modalDeleteSequence, [
    'owner-check',
    'clear-memory-parent-id',
    'delete-memories',
    'delete-owner-tree-returning-id'
  ]);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.getUnchanged, true);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.putUnchanged, true);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.productionDeletePrivilegeAuthorized, false);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(direct.TREE_DELETE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);

  assert.doesNotMatch(
    directSource,
    /DELETE\s+FROM\s+(?:tree_hub_layouts|tree_comments|tree_likes|tree_social_counts|tree_view_dedup_events|tree_appreciation_orders)/i,
    'source candidate must not invent optional child-table cleanup'
  );
});

test('#4230 direct DELETE uses verified Firebase legacyOwnerId and exact owner-bounded SQL ordering', async () => {
  const direct = await import('../../functions/_shared/tree-delete-direct-neon.js');
  const fixture = makeTreeDeleteTransactionAdapter();
  let verifiedToken = null;

  const response = await direct.handleTreeDeleteDirectNeon(
    treeDeleteRequest({
      headers: {
        'x-owner-id': 'attacker-owner',
        'x-user-email': 'attacker@example.invalid'
      }
    }),
    TREE_DELETE_ID,
    treeDeleteEnv(),
    'req-4230',
    {
      verifyTokenOverride: async (token) => {
        verifiedToken = token;
        return { uid: TREE_DELETE_OWNER, email: 'ignored@example.invalid' };
      },
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 200);
  assert.equal(verifiedToken, 'fake-firebase-token');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('x-lovebud-request-id'), 'req-4230');
  assert.equal(fixture.runCalls, 1);
  assert.equal(fixture.calls.length, 4);

  assert.match(fixture.calls[0].text, /SELECT[\s\S]*FROM trees[\s\S]*WHERE id = \$1/i);
  assert.deepEqual(fixture.calls[0].values, [TREE_DELETE_ID]);
  assert.match(fixture.calls[1].text, /UPDATE memories[\s\S]*SET parent_id = NULL[\s\S]*WHERE tree_id = \$1/i);
  assert.deepEqual(fixture.calls[1].values, [TREE_DELETE_ID]);
  assert.match(fixture.calls[2].text, /DELETE FROM memories[\s\S]*WHERE tree_id = \$1/i);
  assert.deepEqual(fixture.calls[2].values, [TREE_DELETE_ID]);
  assert.match(fixture.calls[3].text, /DELETE FROM trees[\s\S]*WHERE id = \$1[\s\S]*AND owner_id = \$2[\s\S]*RETURNING id/i);
  assert.deepEqual(fixture.calls[3].values, [TREE_DELETE_ID, TREE_DELETE_OWNER]);

  assert.deepEqual(await response.json(), {
    deleted: true,
    id: TREE_DELETE_ID
  });
});

test('#4230 auth and dedicated-writer config fail before transaction work', async () => {
  const direct = await import('../../functions/_shared/tree-delete-direct-neon.js');

  const unauthFixture = makeTreeDeleteTransactionAdapter();
  const unauth = await direct.handleTreeDeleteDirectNeon(
    treeDeleteRequest({ authorization: null }),
    TREE_DELETE_ID,
    treeDeleteEnv(),
    'req-4230',
    {
      verifyTokenOverride: async () => {
        throw new Error('must not verify an absent bearer token');
      },
      transactionAdapterOverride: unauthFixture.adapter
    }
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauthFixture.runCalls, 0);

  const configFixture = makeTreeDeleteTransactionAdapter();
  const badConfig = await direct.handleTreeDeleteDirectNeon(
    treeDeleteRequest(),
    TREE_DELETE_ID,
    {
      LB_TREE_DELETE_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: TREE_DELETE_NEON_URL,
      DATABASE_URL: TREE_DELETE_NEON_URL
    },
    'req-4230',
    {
      verifyTokenOverride: async () => ({ uid: TREE_DELETE_OWNER }),
      transactionAdapterOverride: configFixture.adapter
    }
  );
  assert.equal(badConfig.status, 503);
  assert.equal(configFixture.runCalls, 0);
  assert.equal(
    (await badConfig.json()).code,
    'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
  );
});

test('#4230 missing/non-owner Tree fails before destructive SQL and does not leak row content', async () => {
  const direct = await import('../../functions/_shared/tree-delete-direct-neon.js');

  for (const [ownerId, expectedStatus] of [
    [null, 404],
    ['different-owner', 403]
  ]) {
    const fixture = makeTreeDeleteTransactionAdapter({ ownerId });
    const response = await direct.handleTreeDeleteDirectNeon(
      treeDeleteRequest(),
      TREE_DELETE_ID,
      treeDeleteEnv(),
      'req-4230',
      {
        verifyTokenOverride: async () => ({ uid: TREE_DELETE_OWNER }),
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, expectedStatus);
    assert.equal(fixture.runCalls, 1);
    assert.equal(fixture.calls.length, 1);
    assert.match(fixture.calls[0].text, /FROM trees/);
    const text = await response.text();
    assert.doesNotMatch(text, /different-owner|verified-owner-4230|fake-firebase-token|postgresql:/);
  }
});

test('#4230 unknown COMMIT outcome is explicit and never falls back or retries', async () => {
  const direct = await import('../../functions/_shared/tree-delete-direct-neon.js');
  const transaction = await import('../../functions/_shared/db/neon-ws-transaction-adapter.js');
  let runCalls = 0;

  const response = await direct.handleTreeDeleteDirectNeon(
    treeDeleteRequest(),
    TREE_DELETE_ID,
    treeDeleteEnv(),
    'req-4230',
    {
      verifyTokenOverride: async () => ({ uid: TREE_DELETE_OWNER }),
      transactionAdapterOverride: {
        async runTransaction() {
          runCalls += 1;
          throw new transaction.NeonWsTransactionError(
            transaction.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'PRIVATE connection secret must never surface',
            {
              status: 502,
              transactionState: transaction.NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN,
              commitOutcome: transaction.NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN
            }
          );
        }
      }
    }
  );

  assert.equal(runCalls, 1);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('x-lovebud-route-status'), 'commit-outcome-unknown');
  const text = await response.text();
  assert.match(text, /COMMIT_OUTCOME_UNKNOWN/);
  assert.doesNotMatch(text, /PRIVATE|connection secret|postgresql:|modal/i);
});

// ─── #4238 Hub Layout GET direct-Neon candidate ────────────────────────────

const HUB_LAYOUT_READ_DIRECT = path.join(
  ROOT,
  'functions/_shared/hub-layout-read-direct-neon.js'
);
const HUB_LAYOUT_READ_NEON_URL =
  'postgresql://ep-hub-layout-read-4238.us-east-1.neon.tech/neondb?sslmode=require';

function hubLayoutReadEnv(extra = {}) {
  return {
    LB_HUB_LAYOUT_READ_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: HUB_LAYOUT_READ_NEON_URL,
    ...extra
  };
}

function makeHubLayoutReadExecutor({
  ownerId = 'verified-owner-4217',
  layoutRow = {
    revision: 7,
    layout_mode: 'manual',
    manual_positions: [
      { memoryId: 'memory-read-a', position: { x: 4, y: -2 } }
    ],
    updated_at: '2026-08-27 07:00:00.123456+00'
  },
  throwMessage = null
} = {}) {
  const calls = [];
  let callCount = 0;
  const executor = async (text, values = []) => {
    callCount += 1;
    calls.push({ text, values: Array.isArray(values) ? [...values] : values });
    if (throwMessage) throw new Error(throwMessage);
    if (text.includes('FROM trees')) {
      return ownerId === null ? [] : [{ id: 'tree-4217', owner_id: ownerId }];
    }
    if (text.includes('FROM tree_hub_layouts')) {
      return layoutRow === null ? [] : [layoutRow];
    }
    throw new Error('unexpected query');
  };
  return {
    executor,
    calls,
    get callCount() {
      return callCount;
    }
  };
}

test('#4238 source shape is GET/read-only, uses the dedicated read DB boundary, and preserves the existing PUT helper', async () => {
  const routeSource = readFile(HUB_LAYOUT_ROUTE);
  const directSource = readFile(HUB_LAYOUT_READ_DIRECT);
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  assert.match(routeSource, /hub-layout-read-direct-neon\.js/);
  assert.match(routeSource, /isHubLayoutDirectNeonReadRequest\(request\)/);
  assert.match(routeSource, /isHubLayoutReadDirectNeonSelected\(env\s*\|\|\s*\{\}\)/);
  assert.match(routeSource, /isHubLayoutDirectNeonWriteRequest\(request\)/);
  assert.match(routeSource, /isHubLayoutDirectNeonSelected\(env\s*\|\|\s*\{\}\)/);

  assert.match(directSource, /LB_HUB_LAYOUT_READ_RUNTIME/);
  assert.match(directSource, /LOVE_PLATFORM_DATABASE_URL/);
  assert.match(directSource, /principal\.legacyOwnerId/);
  assert.match(directSource, /updated_at::text AS updated_at/);
  assert.match(directSource, /ORDER BY revision DESC[\s\S]*LIMIT 1/);
  assert.doesNotMatch(directSource, /readBoundedRequestBody|request\.text\s*\(|request\.json\s*\(/);
  assert.doesNotMatch(directSource, /createNeonWsTransactionAdapter|pg_advisory_xact_lock/);
  assert.doesNotMatch(directSource, /\b(?:INSERT|UPDATE|DELETE)\b\s+(?:INTO|FROM|trees|tree_hub_layouts)/i);

  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.method, 'GET');
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.ownerAuthority, 'principal.legacyOwnerId');
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.selectOnly, true);
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.transaction, false);
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.advisoryLock, false);
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.productionReadPrivilegeAuthorized, false);
  assert.equal(direct.HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
});

test('#4238 exact GET gate selects direct-Neon; unset/modal/unknown remain on the existing Modal catch-all', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/hub-layout.js');
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  assert.equal(direct.isHubLayoutReadDirectNeonSelected({}), false);
  assert.equal(direct.isHubLayoutReadDirectNeonSelected({ LB_HUB_LAYOUT_READ_RUNTIME: 'modal' }), false);
  assert.equal(direct.isHubLayoutReadDirectNeonSelected({ LB_HUB_LAYOUT_READ_RUNTIME: 'unknown' }), false);
  assert.equal(direct.isHubLayoutReadDirectNeonSelected(hubLayoutReadEnv()), true);
  assert.equal(
    direct.isHubLayoutDirectNeonReadRequest(hubLayoutRequest({ method: 'GET', body: undefined })),
    true
  );
  assert.equal(direct.isHubLayoutDirectNeonReadRequest(hubLayoutRequest()), false);

  const originalFetch = globalThis.fetch;
  const modalCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    modalCalls.push({ url: String(url), options });
    return new Response(JSON.stringify({ revision: 3 }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    for (const gate of [undefined, 'modal', 'unknown']) {
      const env = { MODAL_BASE_URL: 'https://modal.example' };
      if (gate !== undefined) env.LB_HUB_LAYOUT_READ_RUNTIME = gate;
      const response = await route.handleHubLayoutRoute({
        request: hubLayoutRequest({ method: 'GET', body: undefined }),
        env
      });
      assert.equal(response.status, 200);
    }
    assert.equal(modalCalls.length, 3);
    for (const call of modalCalls) {
      assert.match(call.url, /\/modal\/private\/trees\/tree-4217\/hub-layout$/);
      assert.ok(call.options.method === undefined || call.options.method === 'GET');
    }

    const fixture = makeHubLayoutReadExecutor();
    const directResponse = await route.handleHubLayoutRoute(
      {
        request: hubLayoutRequest({ method: 'GET', body: undefined }),
        env: hubLayoutReadEnv()
      },
      {
        verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
        executorOverride: fixture.executor
      }
    );
    assert.equal(directResponse.status, 200);
    assert.equal(directResponse.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(directResponse.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(directResponse.headers.get('cache-control'), 'no-store');
    assert.equal(modalCalls.length, 3, 'explicit direct GET must not fall back to Modal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4238 malformed path and Firebase failures occur before DB work; verified legacyOwnerId is the sole owner authority', async () => {
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  const malformedFixture = makeHubLayoutReadExecutor();
  let malformedVerifierCalls = 0;
  const malformed = await direct.handleHubLayoutReadDirectNeon(
    new Request('https://example.test/api/trees/%ZZ/hub-layout', {
      method: 'GET',
      headers: { authorization: 'Bearer fake-firebase-token' }
    }),
    hubLayoutReadEnv(),
    'req-4238-malformed',
    {
      verifyTokenOverride: async () => {
        malformedVerifierCalls += 1;
        return { uid: 'verified-owner-4217' };
      },
      executorOverride: malformedFixture.executor
    }
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformedVerifierCalls, 0);
  assert.equal(malformedFixture.callCount, 0);

  const unauthFixture = makeHubLayoutReadExecutor();
  const unauth = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined, authorization: null }),
    hubLayoutReadEnv(),
    'req-4238-unauth',
    {
      verifyTokenOverride: async () => {
        throw new Error('absent bearer token must fail before verifier invocation');
      },
      executorOverride: unauthFixture.executor
    }
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauthFixture.callCount, 0);

  const invalidFixture = makeHubLayoutReadExecutor();
  const invalid = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-invalid',
    {
      verifyTokenOverride: async () => ({ uid: ' untrusted-owner ' }),
      executorOverride: invalidFixture.executor
    }
  );
  assert.equal(invalid.status, 401);
  assert.equal(invalidFixture.callCount, 0);

  const ownerFixture = makeHubLayoutReadExecutor();
  const owner = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({
      method: 'GET',
      body: undefined,
      headers: {
        'x-owner-id': 'attacker-owner',
        'x-user-email': 'attacker@example.invalid',
        'x-account-id': 'attacker-account'
      }
    }),
    hubLayoutReadEnv(),
    'req-4238-owner',
    {
      verifyTokenOverride: async () => ({
        uid: 'verified-owner-4217',
        email: 'ignored@example.invalid'
      }),
      executorOverride: ownerFixture.executor
    }
  );
  assert.equal(owner.status, 200);
  assert.equal(ownerFixture.calls.length, 2);
  assert.deepEqual(ownerFixture.calls[0].values, ['tree-4217']);
});

test('#4238 preserves two-stage owner semantics, latest-revision query ordering, exact no-layout 404, and persisted DTO parity', async () => {
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  const successFixture = makeHubLayoutReadExecutor();
  const success = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-success',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      executorOverride: successFixture.executor
    }
  );
  assert.equal(success.status, 200);
  assert.equal(successFixture.calls.length, 2);
  assert.match(successFixture.calls[0].text, /SELECT[\s\S]*id, owner_id[\s\S]*FROM trees[\s\S]*WHERE id = \$1[\s\S]*LIMIT 1/i);
  assert.match(successFixture.calls[1].text, /FROM tree_hub_layouts[\s\S]*WHERE tree_id = \$1[\s\S]*ORDER BY revision DESC[\s\S]*LIMIT 1/i);
  assert.match(successFixture.calls[1].text, /updated_at::text AS updated_at/);
  assert.deepEqual(await success.json(), {
    revision: 7,
    layoutMode: 'manual',
    positions: [
      { memoryId: 'memory-read-a', position: { x: 4, y: -2 } }
    ],
    updatedAt: '2026-08-27T07:00:00.123456+00:00'
  });

  const missingFixture = makeHubLayoutReadExecutor({ ownerId: null });
  const missing = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-missing',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      executorOverride: missingFixture.executor
    }
  );
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { detail: 'Tree not found' });
  assert.equal(missingFixture.calls.length, 1);

  const foreignFixture = makeHubLayoutReadExecutor({ ownerId: 'different-owner' });
  const foreign = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-foreign',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      executorOverride: foreignFixture.executor
    }
  );
  assert.equal(foreign.status, 403);
  assert.deepEqual(await foreign.json(), { detail: 'Access denied: not your tree' });
  assert.equal(foreignFixture.calls.length, 1);

  const noLayoutFixture = makeHubLayoutReadExecutor({ layoutRow: null });
  const noLayout = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-no-layout',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      executorOverride: noLayoutFixture.executor
    }
  );
  assert.equal(noLayout.status, 404);
  assert.deepEqual(await noLayout.json(), {
    error: 'Hub layout not found',
    code: 'HUB_LAYOUT_NOT_FOUND'
  });
  assert.equal(noLayoutFixture.calls.length, 2);
});

test('#4238 dedicated read config never substitutes writer/generic URLs and query failures are sanitized without Modal fallback', async () => {
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  const badConfig = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    {
      LB_HUB_LAYOUT_READ_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_WRITE_DATABASE_URL: HUB_LAYOUT_READ_NEON_URL,
      DATABASE_URL: HUB_LAYOUT_READ_NEON_URL
    },
    'req-4238-config',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' })
    }
  );
  assert.equal(badConfig.status, 503);
  assert.equal((await badConfig.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');

  const failingFixture = makeHubLayoutReadExecutor({
    throwMessage: 'PRIVATE SQL secret postgresql://must-not-leak'
  });
  const failed = await direct.handleHubLayoutReadDirectNeon(
    hubLayoutRequest({ method: 'GET', body: undefined }),
    hubLayoutReadEnv(),
    'req-4238-failed',
    {
      verifyTokenOverride: async () => ({ uid: 'verified-owner-4217' }),
      executorOverride: failingFixture.executor
    }
  );
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get('x-lovebud-route-status'), 'query-failed');
  const text = await failed.text();
  assert.doesNotMatch(text, /PRIVATE|postgresql:|must-not-leak|modal/i);
});

test('#4238 unsupported methods retain catch-all 405 / Allow: GET, PUT and the read gate never captures PUT', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/hub-layout.js');
  const direct = await import('../../functions/_shared/hub-layout-read-direct-neon.js');

  assert.equal(direct.isHubLayoutDirectNeonReadRequest(hubLayoutRequest()), false);

  const response = await route.handleHubLayoutRoute({
    request: hubLayoutRequest({ method: 'POST', body: '{}' }),
    env: {
      ...hubLayoutReadEnv(),
      MODAL_BASE_URL: 'https://modal.example'
    }
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, PUT');
});

// ─── #4237 Appreciation Order POST direct-Neon candidate ───────────────────

const APPRECIATION_ORDER_ROUTE = path.join(
  ROOT,
  'functions/api/trees/[tree_id]/appreciation-order.js'
);
const APPRECIATION_ORDER_DIRECT = path.join(
  ROOT,
  'functions/_shared/appreciation-order-direct-neon.js'
);
const APPRECIATION_ORDER_URL =
  'https://example.test/api/trees/tree-4237/appreciation-order';
const APPRECIATION_ORDER_NEON_URL =
  'postgresql://ep-appreciation-order-4237.us-east-1.neon.tech/neondb?sslmode=require';
const APPRECIATION_ORDER_OWNER = 'verified-owner-4237';

function appreciationOrderEnv(extra = {}) {
  return {
    LB_APPRECIATION_ORDER_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_WRITE_DATABASE_URL: APPRECIATION_ORDER_NEON_URL,
    ...extra
  };
}

function appreciationOrderRequest({
  method = 'POST',
  body = JSON.stringify({ order: ['memory-a', 'memory-b'] }),
  authorization = 'Bearer fake-firebase-token',
  headers = {},
  url = APPRECIATION_ORDER_URL
} = {}) {
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    'x-lovebud-request-id': 'req-4237',
    ...headers
  });
  if (authorization) requestHeaders.set('authorization', authorization);
  const init = { method, headers: requestHeaders };
  if (!['GET', 'HEAD'].includes(method)) init.body = body;
  return new Request(url, init);
}

function makeAppreciationOrderTransactionAdapter({
  ownerId = APPRECIATION_ORDER_OWNER,
  foundIds = ['memory-a', 'memory-b'],
  persistedOrder = null
} = {}) {
  const calls = [];
  let runCalls = 0;
  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async forShare(text, values = []) {
          calls.push({
            kind: 'forShare',
            text,
            values: Array.isArray(values) ? [...values] : values
          });
          if (text.includes('FROM trees')) {
            return ownerId === null
              ? []
              : [{ id: 'tree-4237', owner_id: ownerId }];
          }
          if (text.includes('FROM memories')) {
            return foundIds.map((id) => ({ id }));
          }
          throw new Error('unexpected FOR SHARE query');
        },
        async query(text, values = []) {
          calls.push({
            kind: 'query',
            text,
            values: Array.isArray(values) ? [...values] : values
          });
          if (text.includes('INSERT INTO tree_appreciation_orders')) {
            const requested = JSON.parse(values[1]);
            return [{ ordered_ids: persistedOrder ?? requested }];
          }
          throw new Error('unexpected write query');
        }
      };
      return { value: await work(tx), outcome: 'committed' };
    }
  };
  return {
    adapter,
    calls,
    get runCalls() {
      return runCalls;
    }
  };
}

test('#4237 source shape keeps direct interception POST-only and pins the dedicated writer/transaction boundaries', async () => {
  const routeSource = readFile(APPRECIATION_ORDER_ROUTE);
  const directSource = readFile(APPRECIATION_ORDER_DIRECT);
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');

  assert.match(routeSource, /catchAllOnRequest\(context\)/);
  assert.match(routeSource, /isAppreciationOrderDirectNeonWriteRequest\(request\)/);
  assert.match(routeSource, /isAppreciationOrderDirectNeonSelected\(env\s*\|\|\s*\{\}\)/);
  assert.match(directSource, /LB_APPRECIATION_ORDER_WRITE_RUNTIME/);
  assert.match(directSource, /LOVE_PLATFORM_WRITE_DATABASE_URL/);
  assert.match(directSource, /readBoundedRequestBody/);
  assert.match(directSource, /resolveFirebaseReadPrincipal/);
  assert.match(directSource, /principal\.legacyOwnerId/);
  assert.match(directSource, /createNeonWsTransactionAdapter/);
  assert.match(directSource, /FOR SHARE OF t/);
  assert.match(directSource, /FOR SHARE OF m/);
  assert.match(directSource, /INSERT INTO tree_appreciation_orders/);
  assert.match(directSource, /ON CONFLICT \(tree_id\)/);
  assert.match(directSource, /RETURNING ordered_ids/);
  assert.doesNotMatch(directSource, /MODAL_BASE_URL/);

  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.method, 'POST');
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.ownerAuthority, 'principal.legacyOwnerId');
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.maxOrderItems, 500);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.transaction, true);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.modalFallbackAfterDirectStart, false);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.productionWritePrivilegeAuthorized, false);
  assert.equal(direct.APPRECIATION_ORDER_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
});

test('#4237 exact POST gate selects direct-Neon while GET and unset/modal/unknown POST retain existing Modal behavior', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/appreciation-order.js');
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');

  assert.equal(direct.isAppreciationOrderDirectNeonSelected({}), false);
  assert.equal(direct.isAppreciationOrderDirectNeonSelected({ LB_APPRECIATION_ORDER_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(direct.isAppreciationOrderDirectNeonSelected({ LB_APPRECIATION_ORDER_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(direct.isAppreciationOrderDirectNeonSelected(appreciationOrderEnv()), true);
  assert.equal(direct.isAppreciationOrderDirectNeonWriteRequest(appreciationOrderRequest()), true);
  assert.equal(
    direct.isAppreciationOrderDirectNeonWriteRequest(
      appreciationOrderRequest({ method: 'GET', body: undefined })
    ),
    false
  );

  const originalFetch = globalThis.fetch;
  const modalCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    modalCalls.push({ url: String(url), options });
    return new Response(JSON.stringify({ orderedIds: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    for (const gate of [undefined, 'modal', 'unknown']) {
      const env = { MODAL_BASE_URL: 'https://modal.example' };
      if (gate !== undefined) env.LB_APPRECIATION_ORDER_WRITE_RUNTIME = gate;
      const response = await route.handleAppreciationOrderRoute({
        request: appreciationOrderRequest(),
        env
      });
      assert.equal(response.status, 200);
    }

    const getResponse = await route.handleAppreciationOrderRoute({
      request: appreciationOrderRequest({ method: 'GET', body: undefined }),
      env: {
        ...appreciationOrderEnv(),
        MODAL_BASE_URL: 'https://modal.example'
      }
    });
    assert.equal(getResponse.status, 200);
    assert.equal(modalCalls.length, 4);

    const fixture = makeAppreciationOrderTransactionAdapter();
    const directResponse = await route.handleAppreciationOrderRoute(
      {
        request: appreciationOrderRequest(),
        env: appreciationOrderEnv()
      },
      {
        verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
        transactionAdapterOverride: fixture.adapter
      }
    );
    assert.equal(directResponse.status, 200);
    assert.equal(directResponse.headers.get('x-lovebud-upstream'), 'direct-neon');
    assert.equal(directResponse.headers.get('x-lovebud-runtime'), 'direct_neon');
    assert.equal(modalCalls.length, 4, 'direct POST must never fall back to Modal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('#4237 malformed path and Firebase auth fail before body/DB; verified legacyOwnerId is the sole owner authority', async () => {
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');

  const malformedFixture = makeAppreciationOrderTransactionAdapter();
  let verifierCalls = 0;
  const malformed = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({
      url: 'https://example.test/api/trees/%ZZ/appreciation-order',
      body: 'x'.repeat(129 * 1024)
    }),
    appreciationOrderEnv(),
    'req-4237-malformed',
    {
      verifyTokenOverride: async () => {
        verifierCalls += 1;
        return { uid: APPRECIATION_ORDER_OWNER };
      },
      transactionAdapterOverride: malformedFixture.adapter
    }
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get('x-lovebud-route-status'), 'invalid-path-encoding');
  assert.equal(verifierCalls, 0);
  assert.equal(malformedFixture.runCalls, 0);

  const unauthFixture = makeAppreciationOrderTransactionAdapter();
  const unauth = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({
      authorization: null,
      body: 'y'.repeat(129 * 1024)
    }),
    appreciationOrderEnv(),
    'req-4237-unauth',
    {
      verifyTokenOverride: async () => {
        throw new Error('must not verify missing bearer token');
      },
      transactionAdapterOverride: unauthFixture.adapter
    }
  );
  assert.equal(unauth.status, 401);
  assert.equal(unauthFixture.runCalls, 0);

  const invalidFixture = makeAppreciationOrderTransactionAdapter();
  const invalid = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest(),
    appreciationOrderEnv(),
    'req-4237-invalid',
    {
      verifyTokenOverride: async () => ({ uid: ' invalid-owner ' }),
      transactionAdapterOverride: invalidFixture.adapter
    }
  );
  assert.equal(invalid.status, 401);
  assert.equal(invalidFixture.runCalls, 0);

  const ownerFixture = makeAppreciationOrderTransactionAdapter();
  const owner = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({
      headers: {
        'x-owner-id': 'attacker-owner',
        'x-user-email': 'attacker@example.invalid',
        'x-account-id': 'attacker-account'
      }
    }),
    appreciationOrderEnv(),
    'req-4237-owner',
    {
      verifyTokenOverride: async () => ({
        uid: APPRECIATION_ORDER_OWNER,
        email: 'ignored@example.invalid'
      }),
      transactionAdapterOverride: ownerFixture.adapter
    }
  );
  assert.equal(owner.status, 200);
  assert.deepEqual(ownerFixture.calls[0].values, ['tree-4237']);
});

test('#4237 payload parity canonicalizes trim, rejects unknown/duplicate/oversized shapes, and bounds body before DB', async () => {
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');

  assert.deepEqual(
    direct.validateAppreciationOrderPayload({ order: [' memory-a ', 'memory-b'] }),
    ['memory-a', 'memory-b']
  );
  assert.deepEqual(direct.validateAppreciationOrderPayload({ order: [] }), []);

  for (const [payload, expectedDetail] of [
    [null, { code: 'APPRECIATION_ORDER_OBJECT_REQUIRED' }],
    [{}, { code: 'APPRECIATION_ORDER_REQUIRED', field: 'order' }],
    [{ order: [], extra: true }, { code: 'APPRECIATION_ORDER_UNKNOWN_FIELD', fields: ['extra'] }]
  ]) {
    assert.throws(
      () => direct.validateAppreciationOrderPayload(payload),
      (error) => assert.deepEqual(error.detail, expectedDetail) === undefined
    );
  }
  assert.throws(() => direct.validateAppreciationOrderPayload({ order: 'x' }), /payload invalid/);
  assert.throws(() => direct.validateAppreciationOrderPayload({ order: ['  '] }), /payload invalid/);
  assert.throws(
    () => direct.validateAppreciationOrderPayload({ order: ['memory-a', ' memory-a '] }),
    /payload invalid/
  );
  assert.throws(
    () => direct.validateAppreciationOrderPayload({ order: Array(501).fill('x').map((value, index) => `${value}-${index}`) }),
    /payload invalid/
  );

  const fixture = makeAppreciationOrderTransactionAdapter();
  const oversized = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({ body: 'z'.repeat(129 * 1024) }),
    appreciationOrderEnv(),
    'req-4237-oversized',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
      transactionAdapterOverride: fixture.adapter
    }
  );
  assert.equal(oversized.status, 413);
  assert.equal(fixture.runCalls, 0);
  assert.equal(oversized.headers.get('x-lovebud-route-status'), 'payload-too-large');
});

test('#4237 owner -> membership -> UPSERT ordering is one request transaction and success returns persisted RETURNING order', async () => {
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');
  const fixture = makeAppreciationOrderTransactionAdapter({
    persistedOrder: ['memory-b', 'memory-a']
  });

  const response = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({
      body: JSON.stringify({ order: [' memory-a ', 'memory-b'] })
    }),
    appreciationOrderEnv(),
    'req-4237-success',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 200);
  assert.equal(fixture.runCalls, 1);
  assert.equal(fixture.calls.length, 3);
  assert.equal(fixture.calls[0].kind, 'forShare');
  assert.match(fixture.calls[0].text, /FROM trees t[\s\S]*LIMIT 1[\s\S]*FOR SHARE OF t/i);
  assert.deepEqual(fixture.calls[0].values, ['tree-4237']);
  assert.equal(fixture.calls[1].kind, 'forShare');
  assert.match(fixture.calls[1].text, /FROM memories m[\s\S]*m\.id = ANY\(\$2\)[\s\S]*FOR SHARE OF m/i);
  assert.deepEqual(fixture.calls[1].values, ['tree-4237', ['memory-a', 'memory-b']]);
  assert.equal(fixture.calls[2].kind, 'query');
  assert.match(fixture.calls[2].text, /INSERT INTO tree_appreciation_orders[\s\S]*ON CONFLICT \(tree_id\)[\s\S]*RETURNING ordered_ids/i);
  assert.deepEqual(fixture.calls[2].values, ['tree-4237', JSON.stringify(['memory-a', 'memory-b'])]);
  assert.deepEqual(await response.json(), { orderedIds: ['memory-b', 'memory-a'] });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('#4237 owner/membership/storage failures stop before unauthorized mutation and empty order intentionally skips membership', async () => {
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');

  for (const [fixtureOptions, expectedStatus, expectedCalls] of [
    [{ ownerId: null }, 404, 1],
    [{ ownerId: 'different-owner' }, 403, 1],
    [{ foundIds: ['memory-a'] }, 400, 2]
  ]) {
    const fixture = makeAppreciationOrderTransactionAdapter(fixtureOptions);
    const response = await direct.handleAppreciationOrderDirectNeon(
      appreciationOrderRequest(),
      appreciationOrderEnv(),
      'req-4237-failure',
      {
        verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
        transactionAdapterOverride: fixture.adapter
      }
    );
    assert.equal(response.status, expectedStatus);
    assert.equal(fixture.calls.length, expectedCalls);
    assert.equal(
      fixture.calls.some((call) => call.text.includes('INSERT INTO tree_appreciation_orders')),
      false
    );
  }

  const emptyFixture = makeAppreciationOrderTransactionAdapter({ foundIds: [] });
  const empty = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest({ body: JSON.stringify({ order: [] }) }),
    appreciationOrderEnv(),
    'req-4237-empty',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
      transactionAdapterOverride: emptyFixture.adapter
    }
  );
  assert.equal(empty.status, 200);
  assert.equal(emptyFixture.calls.length, 2);
  assert.match(emptyFixture.calls[0].text, /FROM trees/);
  assert.match(emptyFixture.calls[1].text, /INSERT INTO tree_appreciation_orders/);
  assert.deepEqual(await empty.json(), { orderedIds: [] });

  const storageFixture = makeAppreciationOrderTransactionAdapter({ persistedOrder: null });
  storageFixture.adapter.runTransaction = async (work) => {
    const tx = {
      async forShare(text) {
        if (text.includes('FROM trees')) return [{ id: 'tree-4237', owner_id: APPRECIATION_ORDER_OWNER }];
        return [{ id: 'memory-a' }, { id: 'memory-b' }];
      },
      async query() {
        return [{ ordered_ids: 'not-an-array' }];
      }
    };
    return { value: await work(tx), outcome: 'committed' };
  };
  const storage = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest(),
    appreciationOrderEnv(),
    'req-4237-storage',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
      transactionAdapterOverride: storageFixture.adapter
    }
  );
  assert.equal(storage.status, 500);
  assert.deepEqual(await storage.json(), {
    detail: { code: 'APPRECIATION_ORDER_STORAGE_INVALID' }
  });
});

test('#4237 dedicated writer config cannot substitute read/generic URLs and unknown COMMIT is explicit, sanitized, and non-retryable', async () => {
  const direct = await import('../../functions/_shared/appreciation-order-direct-neon.js');
  const transaction = await import('../../functions/_shared/db/neon-ws-transaction-adapter.js');

  const badConfig = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest(),
    {
      LB_APPRECIATION_ORDER_WRITE_RUNTIME: 'direct_neon',
      LOVE_PLATFORM_DATABASE_URL: APPRECIATION_ORDER_NEON_URL,
      DATABASE_URL: APPRECIATION_ORDER_NEON_URL
    },
    'req-4237-config',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER })
    }
  );
  assert.equal(badConfig.status, 503);
  assert.equal((await badConfig.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');

  const unknown = await direct.handleAppreciationOrderDirectNeon(
    appreciationOrderRequest(),
    appreciationOrderEnv(),
    'req-4237-unknown',
    {
      verifyTokenOverride: async () => ({ uid: APPRECIATION_ORDER_OWNER }),
      transactionAdapterOverride: {
        async runTransaction() {
          throw new transaction.NeonWsTransactionError(
            transaction.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'PRIVATE_DB_SECRET_SHOULD_NOT_LEAK',
            {
              status: 502,
              transactionState: transaction.NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN,
              commitOutcome: transaction.NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN
            }
          );
        }
      }
    }
  );
  assert.equal(unknown.status, 502);
  const unknownText = await unknown.text();
  assert.match(unknownText, /COMMIT_OUTCOME_UNKNOWN/);
  assert.match(unknownText, /"commitOutcome":"unknown"/);
  assert.match(unknownText, /"wholeTransactionRetrySafe":false/);
  assert.doesNotMatch(unknownText, /PRIVATE_DB_SECRET_SHOULD_NOT_LEAK/);
});

test('#4237 unsupported methods retain catch-all 405 / Allow: GET, POST', async () => {
  const route = await import('../../functions/api/trees/[tree_id]/appreciation-order.js');

  const response = await route.handleAppreciationOrderRoute({
    request: appreciationOrderRequest({ method: 'PUT', body: '{}' }),
    env: {
      ...appreciationOrderEnv(),
      MODAL_BASE_URL: 'https://modal.example'
    }
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST');
});
