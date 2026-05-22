const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadAdapter() {
  const source = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveTreePublicTreeAdapter;
}

test('public tree adapter normalizes camelCase tree record', () => {
  const adapter = loadAdapter();
  const tree = adapter.normalizeBrowseTreeRecord({
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

test('transitional compatibility: public tree adapter normalizes legacy wrapped data', () => {
  const adapter = loadAdapter();
  const tree = adapter.normalizeBrowseTreeRecord({
    data: { id: 't1', visibility: 'public', created_at: '2026-04-20T00:00:00Z' }
  });

  assert.equal(tree.id, 't1');
  assert.equal(tree.visibility, 'public');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
});

test('transitional compatibility: public tree adapter normalizes snake_case memory fields', () => {
  const adapter = loadAdapter();
  const memory = adapter.normalizeBrowseMemoryRecord({
    data: {
      id: 'm1',
      tree_id: 't1',
      created_at: '2026-04-20T00:00:00Z',
      emotion_tags: ['legacy']
    }
  });

  assert.equal(memory.treeId, 't1');
  assert.equal(memory.createdAt, '2026-04-20T00:00:00Z');
  assert.deepEqual(memory.emotionTags, ['legacy']);
});

test('public tree adapter builds browse models from camelCase-normalized data', () => {
  const adapter = loadAdapter();
  const result = adapter.buildPublicTreeViewModels(
    [{ id: 't1', title: 'Tree', visibility: 'public' }],
    [{ id: 'm1', treeId: 't1', emotionTags: ['happy'], timestamp: '2024-01' }]
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].memoryCount, 1);
});