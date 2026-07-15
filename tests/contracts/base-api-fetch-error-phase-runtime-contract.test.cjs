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

test('error from fetch_rejection includes _attempt=1, _retried=false, _authHeaderPresent', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._attempt, 1);
    assert.equal(err._retried, false);
    assert.equal(typeof err._authHeaderPresent, 'boolean');
  }
});

test('error from http_error includes _attempt, _retried, _authHeaderPresent', async () => {
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
    assert.equal(err._attempt, 1);
    assert.equal(err._retried, false);
    assert.equal(typeof err._authHeaderPresent, 'boolean');
  }
});

test('error from json_parse_failed includes _attempt, _retried, _authHeaderPresent', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('bad json'); },
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err._attempt, 1);
    assert.equal(err._retried, false);
    assert.equal(typeof err._authHeaderPresent, 'boolean');
  }
});

test('onLifecycle callback receives response_ok on success', async () => {
  const events = [];
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 't1' }],
    }),
  });

  await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
    onLifecycle: function(meta) { events.push(meta); },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].phase, 'response_ok');
  assert.equal(events[0].attempt, 1);
  assert.equal(events[0].retried, false);
  assert.equal(events[0].statusClass, 'success');
  assert.equal(typeof events[0].authHeaderPresent, 'boolean');
});

test('onLifecycle callback receives fetch_rejected on fetch failure', async () => {
  const events = [];
  const sandbox = loadBaseApiFetch({
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(events.length, 1);
    assert.equal(events[0].phase, 'fetch_rejected');
    assert.equal(events[0].statusClass, 'none');
  }
});

test('onLifecycle callback receives http_error for 5xx', async () => {
  const events = [];
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(events.length >= 1);
    assert.equal(events[0].phase, 'http_error');
    assert.equal(events[0].statusClass, 'server');
  }
});

test('onLifecycle callback receives http_error for 4xx', async () => {
  const events = [];
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Unprocessable' }),
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(events.length >= 1);
    assert.equal(events[0].phase, 'http_error');
    assert.equal(events[0].statusClass, 'client');
  }
});

test('onLifecycle callback receives json_parse_failed for response.json() rejection', async () => {
  const events = [];
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('bad'); },
    }),
  });

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(events.length >= 1);
    assert.equal(events[0].phase, 'json_parse_failed');
    assert.equal(events[0].statusClass, 'success');
  }
});

test('onLifecycle is not passed to fetch() config', async () => {
  let capturedConfig = null;
  const sandbox = loadBaseApiFetch({
    fetch: async (_url, config) => {
      capturedConfig = config;
      return { ok: true, json: async () => ({}) };
    },
  });

  await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
    onLifecycle: function() {},
  });

  assert.ok(capturedConfig);
  assert.equal(capturedConfig.onLifecycle, undefined, 'onLifecycle must not leak into fetch config');
});

test('onLifecycle callback error does not affect apiFetch behavior', async () => {
  const sandbox = loadBaseApiFetch({
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 't1' }],
    }),
  });

  const result = await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
    onLifecycle: function() { throw new Error('callback error'); },
  });

  assert.ok(Array.isArray(result));
  assert.equal(result[0].id, 't1');
});

test('auth retry: initial 401 + retry success delivers attempt=2, retried=true via lifecycle', async () => {
  let callCount = 0;
  let authReadCount = 0;
  const events = [];

  const localStorageMock = createStorageMock({
    lovebud_auth_confirmed: 'true',
    lovebud_auth_cache: JSON.stringify({ uid: 'test-user' }),
  });
  const sessionStorageMock = createStorageMock();
  const authUser = {
    uid: 'test-user',
    getIdTokenResult: async () => ({
      token: 'retry-token',
      expirationTime: new Date(Date.now() + 60000).toISOString(),
    }),
  };
  const firebaseMock = {
    auth: () => ({
      get currentUser() {
        authReadCount += 1;
        return authReadCount <= 1 ? null : authUser;
      },
    }),
  };

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 50,
      __lovebudAuthReady: true,
      LOVEBUD_AUTH_WAIT_MS: 50,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      firebase: firebaseMock,
      LoveBudAuthState: null,
      LoveBudAuthBootstrap: { getSnapshot: () => ({ ready: true }), whenReady: () => Promise.resolve() },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    firebase: firebaseMock,
    console,
    fetch: async (_url, config) => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
      }
      return { ok: true, status: 200, json: async () => [{ id: 'retry-tree' }] };
    },
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

  const result = await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
    onLifecycle: function(meta) { events.push(meta); },
  });

  assert.equal(callCount, 2, 'must make 2 fetch calls');
  assert.deepEqual(result, [{ id: 'retry-tree' }]);

  const okEvent = events.find(e => e.phase === 'response_ok');
  assert.ok(okEvent, 'must emit response_ok lifecycle');
  assert.equal(okEvent.attempt, 2, 'must report attempt=2');
  assert.equal(okEvent.retried, true, 'must report retried=true');
  assert.equal(okEvent.authHeaderPresent, true, 'must report authHeaderPresent=true');
});

test('auth retry: initial 401 + retry fetch rejection delivers attempt=2, retried=true on error', async () => {
  let callCount = 0;
  let authReadCount = 0;
  const events = [];

  const localStorageMock = createStorageMock({
    lovebud_auth_confirmed: 'true',
    lovebud_auth_cache: JSON.stringify({ uid: 'test-user' }),
  });
  const sessionStorageMock = createStorageMock();
  const authUser = {
    uid: 'test-user',
    getIdTokenResult: async () => ({
      token: 'retry-token',
      expirationTime: new Date(Date.now() + 60000).toISOString(),
    }),
  };
  const firebaseMock = {
    auth: () => ({
      get currentUser() {
        authReadCount += 1;
        return authReadCount <= 1 ? null : authUser;
      },
    }),
  };

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 50,
      __lovebudAuthReady: true,
      LOVEBUD_AUTH_WAIT_MS: 50,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      firebase: firebaseMock,
      LoveBudAuthState: null,
      LoveBudAuthBootstrap: { getSnapshot: () => ({ ready: true }), whenReady: () => Promise.resolve() },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    firebase: firebaseMock,
    console,
    fetch: async (_url, config) => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
      }
      throw new TypeError('retry network failure');
    },
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

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(callCount, 2, 'must make 2 fetch calls');
    assert.equal(err._attempt, 2, 'error must have _attempt=2');
    assert.equal(err._retried, true, 'error must have _retried=true');
    assert.equal(err._authHeaderPresent, true, 'error must have _authHeaderPresent=true');

    const rejectedEvent = events.find(e => e.phase === 'fetch_rejected');
    assert.ok(rejectedEvent, 'must emit fetch_rejected lifecycle');
    assert.equal(rejectedEvent.attempt, 2);
    assert.equal(rejectedEvent.retried, true);
  }
});

test('auth retry: initial 401 + retry parse failure delivers attempt=2, retried=true', async () => {
  let callCount = 0;
  let authReadCount = 0;
  const events = [];

  const localStorageMock = createStorageMock({
    lovebud_auth_confirmed: 'true',
    lovebud_auth_cache: JSON.stringify({ uid: 'test-user' }),
  });
  const sessionStorageMock = createStorageMock();
  const authUser = {
    uid: 'test-user',
    getIdTokenResult: async () => ({
      token: 'retry-token',
      expirationTime: new Date(Date.now() + 60000).toISOString(),
    }),
  };
  const firebaseMock = {
    auth: () => ({
      get currentUser() {
        authReadCount += 1;
        return authReadCount <= 1 ? null : authUser;
      },
    }),
  };

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 50,
      __lovebudAuthReady: true,
      LOVEBUD_AUTH_WAIT_MS: 50,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      firebase: firebaseMock,
      LoveBudAuthState: null,
      LoveBudAuthBootstrap: { getSnapshot: () => ({ ready: true }), whenReady: () => Promise.resolve() },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    firebase: firebaseMock,
    console,
    fetch: async (_url, config) => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
      }
      return { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
    },
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

  try {
    await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees', {
      onLifecycle: function(meta) { events.push(meta); },
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(callCount, 2);
    assert.equal(err._attempt, 2);
    assert.equal(err._retried, true);
    assert.equal(err._phase, 'json_parse_failed');

    const parseEvent = events.find(e => e.phase === 'json_parse_failed');
    assert.ok(parseEvent, 'must emit json_parse_failed lifecycle');
    assert.equal(parseEvent.attempt, 2);
    assert.equal(parseEvent.retried, true);
  }
});
