const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const POSTGRES_CLIENT_PATH = path.join(ROOT, 'js', 'postgres-client.js');

function loadApiClient() {
  const calls = [];
  const sandbox = {
    window: {
      location: { hostname: 'localhost' },
      LoveTreePublicTreeAdapter: null,
      LoveTreeAuthPolicy: null,
      LoveTreeBaseApiFetch: {
        async apiFetch(endpoint) {
          calls.push(endpoint);
          return [{ id: 'memory-1' }];
        },
      },
      apiClient: null,
      __LoveBudApiClientInternals: null,
    },
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(POSTGRES_CLIENT_PATH, 'utf8'), sandbox, {
    filename: POSTGRES_CLIENT_PATH,
  });

  return {
    apiClient: sandbox.window.apiClient,
    internals: sandbox.window.__LoveBudApiClientInternals,
    calls,
  };
}

test('getMemoriesByTree skips public demo tree ids without calling private memories API', async () => {
  const { apiClient, calls } = loadApiClient();

  const result = await apiClient.getMemoriesByTree('public-midnight-vibes');

  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});

test('getMemoriesByTree preserves normal user tree memory API calls', async () => {
  const { apiClient, calls } = loadApiClient();

  const result = await apiClient.getMemoriesByTree('user-tree-1');

  assert.deepEqual(result, [{ id: 'memory-1' }]);
  assert.deepEqual(calls, ['/memories?treeId=user-tree-1']);
});

test('public demo guard is available in local internals for diagnostics', () => {
  const { internals } = loadApiClient();

  assert.equal(typeof internals.isPublicDemoTreeId, 'function');
  assert.equal(internals.isPublicDemoTreeId('public-iu-comfort'), true);
  assert.equal(internals.isPublicDemoTreeId('user-tree-1'), false);
});
