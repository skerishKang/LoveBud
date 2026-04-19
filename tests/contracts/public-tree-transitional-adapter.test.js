const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadInternals() {
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

test('transitional adapter unwraps flat tree record', () => {
  const I = loadInternals();
  const result = I.unwrapTreeRecord({ id: 't1', visibility: 'public' });
  assert.equal(result.id, 't1');
  assert.equal(result.visibility, 'public');
});

test('transitional adapter unwraps legacy wrapped tree record', () => {
  const I = loadInternals();
  const result = I.unwrapTreeRecord({ id: 'outer', data: { id: 't2', visibility: 'public' } });
  assert.equal(result.id, 't2');
});

test('transitional adapter resolves camelCase and snake_case tree ids', () => {
  const I = loadInternals();
  assert.equal(I.getRecordTreeId({ treeId: 't1' }), 't1');
  assert.equal(I.getRecordTreeId({ tree_id: 't2' }), 't2');
});