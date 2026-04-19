const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadPostgresClient() {
  const source = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');
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
  vm.runInContext(source, sandbox);
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