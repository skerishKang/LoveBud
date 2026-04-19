const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const PUBLIC_TREE_ADAPTER_PATH = path.join(ROOT, 'js', 'api', 'public-tree-adapter.js');
const POSTGRES_CLIENT_PATH = path.join(ROOT, 'js', 'postgres-client.js');

function loadPostgresClient() {
  const authPolicySource = fs.readFileSync(AUTH_POLICY_PATH, 'utf8');
  const publicTreeAdapterSource = fs.readFileSync(PUBLIC_TREE_ADAPTER_PATH, 'utf8');
  const source = fs.readFileSync(POSTGRES_CLIENT_PATH, 'utf8');
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: {
        getItem() { return null; },
        setItem() {},
        removeItem() {},
      },
      LoveBudRuntimeFlags: null,
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
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

test('api client internals keep community endpoints outside auth-required classification', () => {
  const Internals = loadPostgresClient();
  assert.equal(Internals.endpointLikelyRequiresAuth('/community/trees'), false);
  assert.equal(Internals.endpointLikelyRequiresAuth('/community/memories'), false);
  assert.equal(Internals.endpointLikelyRequiresAuth('/trees'), true);
  assert.equal(Internals.endpointLikelyRequiresAuth('/memories'), true);
});

test('api client wait attempts stay short without confirmed auth session', () => {
  const Internals = loadPostgresClient();
  const attempts = Internals.getAuthWaitAttempts(false);
  assert.equal(attempts, 5);
});