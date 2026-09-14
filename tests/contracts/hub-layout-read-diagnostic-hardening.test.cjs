// Focused contract test for Hub Layout GET direct-Neon diagnostic hardening (#4000).
//
// Proves stage separation (visibility-query, hub-layout-query, response-normalization),
// error-class classification, SQLSTATE sanitization, and non-leakage of raw errors/secrets
// while strictly preserving tree-not-found (404), not-owner (403),
// hub-layout-not-found (404), and successful load (200) contracts.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const MODULE_PATH = '../../functions/_shared/hub-layout-read-direct-neon.js';

const TREE_ID = 'tree-diagnostic-4000';
const OWNER_ID = 'verified-owner-4000';
const OTHER_OWNER_ID = 'different-owner-9999';
const READ_URL = 'postgresql://ep-read-only.us-east-1.neon.tech/neondb?sslmode=require';

const READ_ENV = Object.freeze({
  LB_HUB_LAYOUT_READ_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_DATABASE_URL: READ_URL
});

const SECRET_SENTINEL = 'NOT_A_REAL_SECRET';
const FORBIDDEN_OUTPUT_SUBSTRINGS = Object.freeze([
  'postgres://',
  'postgresql://',
  'neon.tech',
  'password=',
  'DATABASE_URL',
  'LOVE_PLATFORM_DATABASE_URL',
  SECRET_SENTINEL,
  TREE_ID
]);

function makeRequest(url = `https://lovebud.pages.dev/api/trees/${TREE_ID}/hub-layout`) {
  return new Request(url, {
    method: 'GET',
    headers: {
      authorization: 'Bearer valid-firebase-token'
    }
  });
}

function verifyTokenPass() {
  return async () => ({ uid: OWNER_ID });
}

function leakyError({ code, message = null, name = 'Error' } = {}) {
  const error = new Error(
    message ||
    `permission denied for relation public.tree_hub_layouts: ` +
    `postgresql://user:${SECRET_SENTINEL}@ep-leak.us-east-1.neon.tech/neondb ` +
    `DATABASE_URL=... password=${SECRET_SENTINEL} tree=${TREE_ID}`
  );
  error.name = name;
  error.stack = `Error: postgresql://${SECRET_SENTINEL}@ep-leak.us-east-1.neon.tech ` +
    `LOVE_PLATFORM_DATABASE_URL password=${SECRET_SENTINEL}\n    at neon (node_modules/@neondatabase/serverless)`;
  error.detail = `detail ${SECRET_SENTINEL} postgres://x neon.tech`;
  error.hint = `hint ${SECRET_SENTINEL}`;
  error.where = `where ${SECRET_SENTINEL}`;
  error.schema = 'public';
  error.table = 'tree_hub_layouts';
  if (code !== undefined) error.code = code;
  return error;
}

async function collectResponseOutput(resp) {
  const body = await resp.clone().text();
  const headerText = [...resp.headers].map(([k, v]) => `${k}:${v}`).join('\n');
  return `${body}\n${headerText}`;
}

test('#4000 diagnostic constants and error codes are exported, frozen, and match canonical vocabulary', async () => {
  const mod = await import(MODULE_PATH);

  assert.ok(Object.isFrozen(mod.DIAGNOSTIC_STAGES));
  assert.deepEqual([...mod.DIAGNOSTIC_STAGES], [
    'executor-init',
    'visibility-query',
    'hub-layout-query',
    'response-normalization',
    'unknown'
  ]);

  assert.ok(Object.isFrozen(mod.HUB_LAYOUT_READ_ERROR_CODES));
  assert.equal(mod.HUB_LAYOUT_READ_ERROR_CODES.VISIBILITY_QUERY_FAILED, 'VISIBILITY_QUERY_FAILED');
  assert.equal(mod.HUB_LAYOUT_READ_ERROR_CODES.HUB_LAYOUT_QUERY_FAILED, 'HUB_LAYOUT_QUERY_FAILED');
  assert.equal(mod.HUB_LAYOUT_READ_ERROR_CODES.RESPONSE_NORMALIZATION_FAILED, 'RESPONSE_NORMALIZATION_FAILED');
  assert.equal(mod.HUB_LAYOUT_READ_ERROR_CODES.EXECUTOR_INIT_FAILED, 'EXECUTOR_INIT_FAILED');
  assert.equal(mod.HUB_LAYOUT_READ_ERROR_CODES.DIRECT_NEON_QUERY_FAILED, 'DIRECT_NEON_QUERY_FAILED');

  assert.ok(Object.isFrozen(mod.DIAGNOSTIC_ERROR_CLASS_WHITELIST));
  assert.equal(mod.DIAGNOSTIC_ERROR_CLASS_FALLBACK, 'UnknownError');
});

test('#4000 classifyHubLayoutReadErrorClass strictly enforces whitelist and falls back to UnknownError without reflecting untrusted names', async () => {
  const mod = await import(MODULE_PATH);

  assert.equal(mod.classifyHubLayoutReadErrorClass(new Error('test')), 'Error');
  assert.equal(mod.classifyHubLayoutReadErrorClass(new TypeError('test')), 'TypeError');
  assert.equal(mod.classifyHubLayoutReadErrorClass(new RangeError('test')), 'RangeError');
  assert.equal(mod.classifyHubLayoutReadErrorClass(new SyntaxError('test')), 'SyntaxError');
  assert.equal(mod.classifyHubLayoutReadErrorClass(new ReferenceError('test')), 'ReferenceError');

  // Custom/untrusted classes resolve to fallback, never reflected
  class CustomDatabaseLeakError extends Error {}
  assert.equal(mod.classifyHubLayoutReadErrorClass(new CustomDatabaseLeakError('leak')), 'UnknownError');

  const forged = { name: 'SuperAdminSecretError', constructor: { name: 'SuperAdminSecretError' } };
  assert.equal(mod.classifyHubLayoutReadErrorClass(forged), 'UnknownError');

  // Throwing getters or null/undefined
  assert.equal(mod.classifyHubLayoutReadErrorClass(null), 'UnknownError');
  assert.equal(mod.classifyHubLayoutReadErrorClass(undefined), 'UnknownError');
  const throwingGetter = {};
  Object.defineProperty(throwingGetter, 'name', { get() { throw new Error('getter bomb'); } });
  assert.equal(mod.classifyHubLayoutReadErrorClass(throwingGetter), 'UnknownError');
});

test('#4000 sanitizeHubLayoutReadFailure validates SQLSTATE and canonicalizes stage', async () => {
  const mod = await import(MODULE_PATH);

  const clean = mod.sanitizeHubLayoutReadFailure(leakyError({ code: '42501' }), 'hub-layout-query');
  assert.equal(clean.stage, 'hub-layout-query');
  assert.equal(clean.errorClass, 'Error');
  assert.equal(clean.sqlstate, '42501');

  // Unknown stage falls back to 'unknown'
  const unknownStage = mod.sanitizeHubLayoutReadFailure(new Error(), 'nonexistent-stage');
  assert.equal(unknownStage.stage, 'unknown');

  // Invalid SQLSTATE codes are neutralized to null
  for (const badCode of ['4250', '425011', '4250a', '     ', 'postgresql://x', '?????', null, 12345]) {
    const sanitized = mod.sanitizeHubLayoutReadFailure({ code: badCode }, 'visibility-query');
    assert.equal(sanitized.sqlstate, null);
  }
});

test('#4000 G1: trees query failure -> stage=visibility-query, code=VISIBILITY_QUERY_FAILED, SQLSTATE retained', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) throw leakyError({ code: '42501' });
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g1',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 500);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'query-failed');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), 'visibility-query');
  assert.equal(resp.headers.get('x-lovebud-error-class'), 'Error');
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), '42501');

  const body = await resp.json();
  assert.equal(body.detail, 'Internal server error');
  assert.equal(body.code, 'VISIBILITY_QUERY_FAILED');
});

test('#4000 G2: tree_hub_layouts query failure -> stage=hub-layout-query, code=HUB_LAYOUT_QUERY_FAILED, SQLSTATE retained', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) {
      return [{ id: TREE_ID, owner_id: OWNER_ID }];
    }
    if (text.includes('FROM tree_hub_layouts')) {
      throw leakyError({ code: '42P01' });
    }
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g2',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 500);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'query-failed');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), 'hub-layout-query');
  assert.equal(resp.headers.get('x-lovebud-error-class'), 'Error');
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), '42P01');

  const body = await resp.json();
  assert.equal(body.detail, 'Internal server error');
  assert.equal(body.code, 'HUB_LAYOUT_QUERY_FAILED');
});

test('#4000 G3: response-normalization failure -> stage=response-normalization, code=RESPONSE_NORMALIZATION_FAILED, no SQLSTATE', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) {
      return [{ id: TREE_ID, owner_id: OWNER_ID }];
    }
    if (text.includes('FROM tree_hub_layouts')) {
      // Return invalid revision to trigger TypeError in projectHubLayoutReadRow
      return [{
        revision: -1,
        layout_mode: 'manual',
        manual_positions: [],
        updated_at: '2026-08-28 07:00:00+00'
      }];
    }
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g3',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 500);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'query-failed');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), 'response-normalization');
  assert.equal(resp.headers.get('x-lovebud-error-class'), 'TypeError');
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null, 'no sqlstate on normalization failure');

  const body = await resp.json();
  assert.equal(body.detail, 'Internal server error');
  assert.equal(body.code, 'RESPONSE_NORMALIZATION_FAILED');
});

test('#4000 G4: executor-init failure -> stage=executor-init, code=EXECUTOR_INIT_FAILED, error-class=TypeError', async () => {
  const mod = await import(MODULE_PATH);

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    { LB_HUB_LAYOUT_READ_RUNTIME: 'direct_neon' },
    'req-g4',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: { not: 'a function' }
    }
  );

  assert.equal(resp.status, 500);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'query-failed');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), 'executor-init');
  assert.equal(resp.headers.get('x-lovebud-error-class'), 'TypeError');
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null);

  const body = await resp.json();
  assert.equal(body.detail, 'Internal server error');
  assert.equal(body.code, 'EXECUTOR_INIT_FAILED');
});

test('#4000 G5: malicious error message/stack/URL/credential never appear in body or headers', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) {
      throw leakyError({ code: '42501' });
    }
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g5',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 500);
  const output = await collectResponseOutput(resp);

  for (const forbidden of FORBIDDEN_OUTPUT_SUBSTRINGS) {
    assert.ok(!output.includes(forbidden), `output must not contain ${JSON.stringify(forbidden)}`);
  }

  for (const name of ['x-lovebud-error-stage', 'x-lovebud-error-class', 'x-lovebud-sqlstate']) {
    const value = resp.headers.get(name);
    if (value !== null) {
      assert.match(value, /^[A-Za-z0-9_-]{1,64}$/, `${name} must be a safe fixed token`);
    }
  }
});

test('#4000 G6: invalid SQLSTATE values are neutralized (header omitted)', async () => {
  const mod = await import(MODULE_PATH);
  const invalidCodes = ['4250', '425011', '4250a', '     ', 'postgresql://x', '?????'];

  for (const code of invalidCodes) {
    const executor = async (text) => {
      if (text.includes('FROM trees')) {
        throw leakyError({ code });
      }
      return [];
    };

    const resp = await mod.handleHubLayoutReadDirectNeon(
      makeRequest(),
      READ_ENV,
      `req-g6-${code.length}`,
      {
        verifyTokenOverride: verifyTokenPass(),
        executorOverride: executor
      }
    );

    assert.equal(resp.status, 500);
    assert.equal(resp.headers.get('x-lovebud-sqlstate'), null, `invalid code ${JSON.stringify(code)} must be omitted`);
    assert.equal(resp.headers.get('x-lovebud-error-stage'), 'visibility-query');
  }
});

test('#4000 G7: tree-not-found contract preserved (404, tree-not-found, no diagnostic error headers)', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async () => [];

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g7',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 404);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'tree-not-found');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), null);
  assert.equal(resp.headers.get('x-lovebud-error-class'), null);
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null);
  assert.deepEqual(await resp.json(), { detail: 'Tree not found' });
});

test('#4000 G8: not-owner contract preserved (403, not-owner, no diagnostic error headers)', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async () => [{ id: TREE_ID, owner_id: OTHER_OWNER_ID }];

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g8',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 403);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'not-owner');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), null);
  assert.equal(resp.headers.get('x-lovebud-error-class'), null);
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null);
  assert.deepEqual(await resp.json(), { detail: 'Access denied: not your tree' });
});

test('#4000 G9: hub-layout-not-found contract preserved (404, hub-layout-not-found, no diagnostic error headers)', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) {
      return [{ id: TREE_ID, owner_id: OWNER_ID }];
    }
    if (text.includes('FROM tree_hub_layouts')) {
      return [];
    }
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g9',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 404);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'hub-layout-not-found');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), null);
  assert.equal(resp.headers.get('x-lovebud-error-class'), null);
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null);
  assert.deepEqual(await resp.json(), {
    error: 'Hub layout not found',
    code: 'HUB_LAYOUT_NOT_FOUND'
  });
});

test('#4000 G10: success contract preserved (200, loaded, direct_neon, no diagnostic headers, valid DTO shape)', async () => {
  const mod = await import(MODULE_PATH);

  const executor = async (text) => {
    if (text.includes('FROM trees')) {
      return [{ id: TREE_ID, owner_id: OWNER_ID }];
    }
    if (text.includes('FROM tree_hub_layouts')) {
      return [{
        revision: 2,
        layout_mode: 'manual',
        manual_positions: [{ memoryId: 'mem-1', position: { x: 10, y: 20 } }],
        updated_at: '2026-08-28 12:34:56.123456+00'
      }];
    }
    return [];
  };

  const resp = await mod.handleHubLayoutReadDirectNeon(
    makeRequest(),
    READ_ENV,
    'req-g10',
    {
      verifyTokenOverride: verifyTokenPass(),
      executorOverride: executor
    }
  );

  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('x-lovebud-route-status'), 'loaded');
  assert.equal(resp.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(resp.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(resp.headers.get('cache-control'), 'no-store');
  assert.equal(resp.headers.get('x-lovebud-error-stage'), null);
  assert.equal(resp.headers.get('x-lovebud-error-class'), null);
  assert.equal(resp.headers.get('x-lovebud-sqlstate'), null);
  assert.equal(resp.headers.get('Access-Control-Expose-Headers'), 'x-lovebud-request-id');

  const body = await resp.json();
  assert.deepEqual(body, {
    revision: 2,
    layoutMode: 'manual',
    positions: [{ memoryId: 'mem-1', position: { x: 10, y: 20 } }],
    updatedAt: '2026-08-28T12:34:56.123456+00:00'
  });
});
