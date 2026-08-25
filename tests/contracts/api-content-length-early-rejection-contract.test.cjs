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
          memoryId: 'too-far',
          position: { x: 1_000_001, y: 0 }
        }
      ]
    }),
    /coordinates exceed limit/
  );
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
