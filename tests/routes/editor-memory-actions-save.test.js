const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createMemoryActionsWithStubs(overrides = {}) {
  const context = {
    console: { ...console, error: () => {} },
    window: {
      apiClient: {
        updateMemory: async () => ({})
      },
      LoveBudCache: {
        set: () => {}
      }
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-actions.js'), 'utf8');
  vm.runInContext(source, context);

  let currentEditingMemory = { id: 'memory-1', treeId: 'tree-1', title: 'Before', memo: 'before' };
  let treeMemories = [{ ...currentEditingMemory }];
  const currentTreeData = { id: 'tree-1', memories: [{ ...currentEditingMemory }] };
  const statuses = [];
  const detailUpdates = [];
  const cacheWrites = [];

  context.window.apiClient.updateMemory = overrides.updateMemory || (async (memoryId, payload) => ({
    id: memoryId,
    ...payload,
    updatedAt: 'updated'
  }));
  context.window.LoveBudCache.set = (key, value) => cacheWrites.push({ key, value });

  const actions = context.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: (status) => statuses.push(status),
    updateDetailPanel: (memory) => detailUpdates.push(memory),
    updateSidebarStatus: () => {},
    showToast: () => {},
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
    getTreeMemories: () => treeMemories,
    setTreeMemories: (value) => { treeMemories = value; },
    getSelectedNodeId: () => 'memory-1',
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'memory-1',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: null,
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => {},
    getCurrentTreeData: () => currentTreeData,
    isLocalSaveMode: () => false
  });

  return {
    actions,
    get currentEditingMemory() { return currentEditingMemory; },
    get treeMemories() { return treeMemories; },
    currentTreeData,
    statuses,
    detailUpdates,
    cacheWrites
  };
}

test('editor inline memo save persists through API and refreshes current moment UI state', async () => {
  let sentRequest = null;
  const harness = createMemoryActionsWithStubs({
    updateMemory: async (memoryId, payload) => {
      sentRequest = { memoryId, payload };
      return { id: memoryId, memo: payload.memo, title: 'Before', updatedAt: 'server-time' };
    }
  });

  const result = await harness.actions.updateSelectedMemoryFields({ memo: 'after' });

  assert.equal(result, true);
  assert.equal(sentRequest.memoryId, 'memory-1');
  assert.equal(sentRequest.payload.memo, 'after');
  assert.equal(harness.treeMemories[0].memo, 'after');
  assert.equal(harness.currentTreeData.memories[0].memo, 'after');
  assert.equal(harness.currentEditingMemory.memo, 'after');
  assert.equal(harness.detailUpdates.at(-1).memo, 'after');
  assert.equal(harness.cacheWrites.at(-1).key, 'memories_tree-1');
  assert.deepEqual(harness.statuses, ['saving', 'saved']);
});

test('editor inline memo save failure keeps existing state and reports failed status', async () => {
  const harness = createMemoryActionsWithStubs({
    updateMemory: async () => {
      throw new Error('update failed');
    }
  });

  const result = await harness.actions.updateSelectedMemoryFields({ memo: 'after' });

  assert.equal(result, false);
  assert.equal(harness.treeMemories[0].memo, 'before');
  assert.equal(harness.currentEditingMemory.memo, 'before');
  assert.equal(harness.detailUpdates.length, 0);
  assert.deepEqual(harness.statuses, ['saving', 'failed']);
});
