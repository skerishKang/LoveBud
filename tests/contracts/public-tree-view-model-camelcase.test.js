const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadInternals() {
  // Load postgres-client.js first to create __LoveBudApiClientInternals
  const postgresSource = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');
  // Load adapter to add adapter functions to internals (for backward compatibility)
  const adapterSource = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      LoveBudRuntimeFlags: null,
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  // Load postgres-client.js first (creates __LoveBudApiClientInternals)
  vm.runInContext(postgresSource, sandbox);
  // Then load adapter (extends __LoveBudApiClientInternals for backward compatibility)
  vm.runInContext(adapterSource, sandbox);
  return sandbox.window.__LoveBudApiClientInternals;
}

test('browse tree helper normalizes camelCase tree record', () => {
  const I = loadInternals();
  const tree = I.normalizeBrowseTreeRecord({
    id: 't1',
    title: 'Tree',
    visibility: 'public',
    createdAt: '2026-04-20T00:00:00Z',
    ownerId: 'u1',
  });

  assert.equal(tree.id, 't1');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
  assert.equal(tree.ownerId, 'u1');
});

test('browse memory helper normalizes legacy wrapped snake_case record', () => {
  const I = loadInternals();
  const memory = I.normalizeBrowseMemoryRecord({
    data: {
      id: 'm1',
      tree_id: 't1',
      created_at: '2026-04-20T00:00:00Z',
      emotion_tags: ['legacy'],
    }
  });

  assert.equal(memory.treeId, 't1');
  assert.equal(memory.createdAt, '2026-04-20T00:00:00Z');
  assert.deepEqual(memory.emotionTags, ['legacy']);
});