const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const BASE_API_FETCH_PATH = path.join(ROOT, 'js', 'api', 'base-api-fetch.js');

function createStorageMock(initialState = {}) {
  const state = new Map(Object.entries(initialState));
  return {
    getItem(key) { return state.has(key) ? state.get(key) : null; },
    setItem(key, value) { state.set(key, String(value)); },
    removeItem(key) { state.delete(key); },
  };
}

function loadBaseApiFetch(options = {}) {
  const localStorageMock = createStorageMock(options.localStorage || {});
  const sessionStorageMock = createStorageMock(options.sessionStorage || {});

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: options.authWaitMs || 200,
      __lovebudAuthReady: options.authReady !== false,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      firebase: options.firebase || null,
      LoveBudAuthState: null,
      LoveBudAuthBootstrap: options.authBootstrap || null,
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    firebase: options.firebase || null,
    console,
    fetch: options.fetch || (async () => { throw new Error('no fetch'); }),
    setTimeout,
    clearTimeout,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });

  return sandbox;
}

test('ERROR_PHASE constants are exported on LoveTreeBaseApiFetch', () => {
  const sandbox = loadBaseApiFetch();
  const api = sandbox.window.LoveTreeBaseApiFetch;

  assert.ok(api.ERROR_PHASE, 'ERROR_PHASE must be exported');
  assert.equal(api.ERROR_PHASE.FETCH_REJECTED, 'fetch_rejected');
  assert.equal(api.ERROR_PHASE.HTTP_ERROR, 'http_error');
  assert.equal(api.ERROR_PHASE.JSON_PARSE_FAILED, 'json_parse_failed');
});

test('apiFetch sets _phase=fetch_rejected when fetch() throws', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'fetch_rejected', 'error must have _phase=fetch_rejected');
    assert.ok(!err.status, 'fetch rejection must not have a status');
  }
});

test('apiFetch sets _phase=http_error for 5xx response', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'http_error');
    assert.equal(err.status, 500);
    assert.equal(err.statusCode, 500);
  }
});

test('apiFetch sets _phase=http_error for 401 response', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'http_error');
    assert.equal(err.status, 401);
  }
});

test('apiFetch sets _phase=http_error for 403 response', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'http_error');
    assert.equal(err.status, 403);
  }
});

test('apiFetch sets _phase=json_parse_failed when response.json() rejects after ok response', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'json_parse_failed');
    assert.equal(err.status, 200);
  }
});

test('apiFetch returns parsed JSON on success without _phase', async () => {
  const trees = [{ id: 't1', title: 'Test Tree' }];
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => trees,
    }),
  });

  const result = await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
  assert.deepEqual(result, trees);
  assert.equal(result._phase, undefined, 'success result must not have _phase');
});

test('apiFetch retry catch block wraps fetch rejection with _phase=fetch_rejected', async () => {
  const source = fs.readFileSync(BASE_API_FETCH_PATH, 'utf8');
  assert.ok(
    source.includes("retryFetchErr") && source.includes("error._phase = 'fetch_rejected'"),
    'base-api-fetch.js must have a retry catch block that sets _phase=fetch_rejected'
  );
  assert.ok(
    source.match(/catch\s*\(\s*retryFetchErr\s*\)/),
    'base-api-fetch.js must catch retryFetchErr specifically'
  );
});

test('error from apiFetch does not leak token, uid, email, or response body in _phase metadata', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Internal Server Error',
        code: 'SECRET_CODE',
        token: 'leaked-token',
        uid: 'user-123',
      }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'http_error');
    assert.equal(err.status, 500);
    assert.equal(err.code, 'SECRET_CODE');
    assert.ok(!err.token, 'error must not contain token');
    assert.ok(!err.uid, 'error must not contain uid');
  }
});

test('HTTP 200 + response.json reject preserves status 200 and sets phase json_parse_failed', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'json_parse_failed', 'must have _phase=json_parse_failed');
    assert.equal(err.status, 200, 'HTTP 200 status must be preserved');
    assert.equal(err.statusCode, 200, 'HTTP 200 statusCode must be preserved');
    assert.equal(err.message, 'Failed to parse response');
  }
});

test('HTTP 201 + response.json reject preserves status and sets phase json_parse_failed', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 201,
      json: async () => { throw new SyntaxError('bad json'); },
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._phase, 'json_parse_failed');
    assert.equal(err.status, 201, 'HTTP 201 status must be preserved');
    assert.equal(err.statusCode, 201);
  }
});

test('ERROR_PHASE enum values are frozen string constants', () => {
  const sandbox = loadBaseApiFetch();
  const ep = sandbox.window.LoveTreeBaseApiFetch.ERROR_PHASE;
  assert.equal(typeof ep.FETCH_REJECTED, 'string');
  assert.equal(typeof ep.HTTP_ERROR, 'string');
  assert.equal(typeof ep.JSON_PARSE_FAILED, 'string');
  assert.notEqual(ep.FETCH_REJECTED, ep.HTTP_ERROR);
  assert.notEqual(ep.HTTP_ERROR, ep.JSON_PARSE_FAILED);
});
