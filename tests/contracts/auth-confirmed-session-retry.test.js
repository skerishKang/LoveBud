const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const BASE_API_FETCH_PATH = path.join(ROOT, 'js', 'api', 'base-api-fetch.js');
const PUBLIC_TREE_ADAPTER_PATH = path.join(ROOT, 'js', 'api', 'public-tree-adapter.js');
const POSTGRES_CLIENT_PATH = path.join(ROOT, 'js', 'postgres-client.js');

function loadInternals(options = {}) {
  const localStorageState = new Map(
    Object.entries(options.localStorage || {})
  );

  const localStorageMock = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    },
    removeItem(key) {
      localStorageState.delete(key);
    },
  };

  // Load sources
  const authPolicySource = fs.readFileSync(AUTH_POLICY_PATH, 'utf8');
  const publicTreeAdapterSource = fs.readFileSync(PUBLIC_TREE_ADAPTER_PATH, 'utf8');
  const source = fs.readFileSync(POSTGRES_CLIENT_PATH, 'utf8');
  
  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: options.authWaitMs || 2000,
      __lovebudAuthReady: options.authReady === true,
      location: {
        hostname: 'localhost',
        search: '',
      },
      localStorage: localStorageMock,
      LoveBudRuntimeFlags: null,
      apiClient: null,
      __LoveBudApiClientInternals: null,
    },
    localStorage: localStorageMock,
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    firebase: options.firebase,
  };

  vm.createContext(sandbox);
  
  // Load auth policy first
  vm.runInContext(authPolicySource, sandbox, { filename: AUTH_POLICY_PATH });
  // Load public tree adapter
  vm.runInContext(publicTreeAdapterSource, sandbox, { filename: PUBLIC_TREE_ADAPTER_PATH });
  // Load postgres-client.js
  vm.runInContext(source, sandbox, { filename: POSTGRES_CLIENT_PATH });

  return sandbox.window.__LoveBudApiClientInternals;
}

test('confirmed-session retry policy keeps short wait without confirmed auth session', () => {
  const internals = loadInternals({
    localStorage: {},
    authWaitMs: 2000,
  });

  assert.equal(internals.hasConfirmedAuthSession(), false);
  assert.equal(internals.getAuthWaitAttempts(false), 5);
});

test('confirmed-session retry policy uses longer wait when forced', () => {
  const internals = loadInternals({
    localStorage: {},
    authWaitMs: 2000,
  });

  assert.ok(internals.getAuthWaitAttempts(true) > internals.getAuthWaitAttempts(false));
});

test('confirmed-session retry policy detects confirmed auth cache', () => {
  const internals = loadInternals({
    localStorage: {
      lovebud_auth_confirmed: 'true',
      lovebud_auth_cache: JSON.stringify({
        uid: 'user-1',
        email: 'user@example.com',
      }),
    },
    authWaitMs: 2000,
  });

  assert.equal(internals.hasConfirmedAuthSession(), true);
  assert.ok(internals.getAuthWaitAttempts(false) > 5);
});

test('community endpoints stay outside auth-required classification', () => {
  const internals = loadInternals();

  assert.equal(internals.endpointLikelyRequiresAuth('/community/trees'), false);
  assert.equal(internals.endpointLikelyRequiresAuth('/community/memories'), false);
  assert.equal(internals.endpointLikelyRequiresAuth('/trees'), true);
  assert.equal(internals.endpointLikelyRequiresAuth('/memories'), true);
});

test('auth headers wait for currentUser when confirmed cache exists', async () => {
  const localStorageState = new Map([
    ['lovebud_auth_confirmed', 'true'],
    ['lovebud_auth_cache', JSON.stringify({ uid: 'test-user' })],
  ]);
  const localStorageMock = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    },
    removeItem(key) {
      localStorageState.delete(key);
    },
  };
  const authUser = {
    uid: 'test-user',
    getIdTokenResult: async () => ({
      token: 'test-token',
      expirationTime: new Date(Date.now() + 60000).toISOString(),
    }),
  };
  let authReadCount = 0;
  const firebaseMock = {
    auth: () => ({
      get currentUser() {
        authReadCount += 1;
        return authReadCount === 1 ? null : authUser;
      },
    }),
  };

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 200,
      __lovebudAuthReady: true,
      LoveBudAuthBootstrap: {
        getSnapshot: () => ({ ready: true, user: null }),
        whenReady: () => Promise.resolve(null),
      },
      localStorage: localStorageMock,
      firebase: firebaseMock,
      LoveBudAuthState: null,
    },
    localStorage: localStorageMock,
    firebase: firebaseMock,
    console,
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

  const headers = await sandbox.window.LoveTreeBaseApiFetch.getAuthHeaders({
    forceLongWait: true,
    requireAuth: true,
  });

  assert.equal(headers.Authorization, 'Bearer test-token');
  assert.ok(authReadCount > 1);
});

test('public-read api fetch omits authorization for tree detail even with cached token', async () => {
  const localStorageState = new Map([
    ['lovebud_auth_token', JSON.stringify({
      uid: 'safe-test-user',
      token: 'safe-test-token',
      expiresAt: Date.now() + 60000,
    })],
  ]);
  const localStorageMock = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    },
    removeItem(key) {
      localStorageState.delete(key);
    },
  };
  let capturedHeaders = null;
  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 200,
      __lovebudAuthReady: true,
      localStorage: localStorageMock,
      firebase: null,
      LoveBudAuthState: null,
    },
    localStorage: localStorageMock,
    firebase: null,
    console,
    fetch: async (_url, config) => {
      capturedHeaders = config.headers;
      return { ok: true, json: async () => ({ ok: true }) };
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

  await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees/safe-public-tree', { publicRead: true });

  assert.equal(capturedHeaders.Authorization, undefined);
  assert.equal(capturedHeaders.authorization, undefined);
});

test('private tree api fetch still attaches authorization from cached token', async () => {
  const localStorageState = new Map([
    ['lovebud_auth_token', JSON.stringify({
      uid: 'safe-test-user',
      token: 'safe-test-token',
      expiresAt: Date.now() + 60000,
    })],
  ]);
  const localStorageMock = {
    getItem(key) {
      return localStorageState.has(key) ? localStorageState.get(key) : null;
    },
    setItem(key, value) {
      localStorageState.set(key, String(value));
    },
    removeItem(key) {
      localStorageState.delete(key);
    },
  };
  let capturedHeaders = null;
  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 200,
      __lovebudAuthReady: true,
      localStorage: localStorageMock,
      firebase: null,
      LoveBudAuthState: null,
    },
    localStorage: localStorageMock,
    firebase: null,
    console,
    fetch: async (_url, config) => {
      capturedHeaders = config.headers;
      return { ok: true, json: async () => ({ ok: true }) };
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

  await sandbox.window.LoveTreeBaseApiFetch.apiFetch('/trees');

  assert.equal(capturedHeaders.Authorization, 'Bearer safe-test-token');
});
