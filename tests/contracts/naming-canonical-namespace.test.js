const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function runScript(file, sandbox) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(source, sandbox, { filename: file });
}

test('page-shell exposes canonical and legacy aliases', () => {
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      addEventListener() {},
    },
  };
  vm.createContext(sandbox);

  runScript('js/page-shell.js', sandbox);

  assert.ok(sandbox.window.LoveTreePageShell, 'LoveTreePageShell should exist');
  assert.ok(sandbox.window.LovetreePageShell, 'LovetreePageShell should exist');
  assert.equal(
    sandbox.window.LoveTreePageShell,
    sandbox.window.LovetreePageShell,
    'Both should reference the same object'
  );
});

test('public tree adapter exposes canonical namespace', () => {
  const sandbox = {
    window: {},
    console,
  };
  vm.createContext(sandbox);

  runScript('js/api/public-tree-adapter.js', sandbox);

  assert.ok(sandbox.window.LoveTreePublicTreeAdapter, 'LoveTreePublicTreeAdapter should exist');
});

test('postgres-client exposes legacy test hook', () => {
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

  // Note: postgres-client depends on public-tree-adapter, so load in order
  runScript('js/api/public-tree-adapter.js', sandbox);
  runScript('js/postgres-client.js', sandbox);

  assert.ok(sandbox.window.__LoveBudApiClientInternals, '__LoveBudApiClientInternals should exist');
  assert.ok(typeof sandbox.window.__LoveBudApiClientInternals.endpointLikelyRequiresAuth === 'function');
});