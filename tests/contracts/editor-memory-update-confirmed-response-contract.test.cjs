/**
 * editor-memory-update-confirmed-response-contract.test.cjs
 *
 * Contract test for confirmed-response guard in editor-memory-actions.js
 * Tests connectMemory and disconnectMemory with server response validation.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');

function readSource(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function makeSandbox(apiClientMock = {}) {
  const sandbox = {
    window: {
      apiClient: {
        updateMemory: apiClientMock.updateMemory || (async () => {}),
        deleteMemory: apiClientMock.deleteMemory || (async () => {})
      },
      LoveBudCache: { set: () => {}, get: () => null },
      LoveBudEditorInteractionMode: { isEditMode: () => true }
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
    setTimeout: (fn) => fn(),
    Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  return sandbox;
}

function runSourceInSandbox(source, sandbox) {
  vm.runInContext(source, sandbox);
  return sandbox.window.createEditorMemoryActions;
}

function createMemoryActions(createEditorMemoryActions, overrides = {}) {
  const mems = overrides.memories || [
    { id: 'root', parentId: null, title: 'Root' },
    { id: 'mem-1', parentId: 'root', title: 'Memory 1' },
    { id: 'mem-2', parentId: 'root', title: 'Memory 2' },
    { id: 'mem-3', parentId: 'mem-2', title: 'Memory 3' }
  ];

  const fakeIsRoot = (m, cid) => String(m.id) === String(cid) || m.id === 'root';

  return createEditorMemoryActions({
    i18n: (k) => k,
    getCanonicalRootId: () => 'root',
    isRootMemory: fakeIsRoot,
    findRootMemory: () => mems.find(m => m.id === 'root'),
    getTreeMemories: () => mems,
    setTreeMemories: overrides.setTreeMemories || (() => {}),
    getCurrentTreeData: () => ({ id: 'tree-1', memories: mems }),
    updateSaveStatus: overrides.updateSaveStatus || (() => {}),
    updateDetailPanel: overrides.updateDetailPanel || (() => {}),
    updateSidebarStatus: overrides.updateSidebarStatus || (() => {}),
    showToast: overrides.showToast || (() => {}),
    setDetailEmptyState: () => {},
    rerenderCanvas: overrides.rerenderCanvas || (() => {}),
    canEdit: true,
    isLocalSaveMode: () => false,
    getCurrentEditingMemory: () => null,
    setCurrentEditingMemory: overrides.setCurrentEditingMemory || (() => {}),
    getSelectedNodeId: () => null,
    setSelectedNodeId: () => {}
  });
}

test('connectMemory: confirmed response with parentId === targetId returns true and applies local state', async () => {
  let updateCallCount = 0;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      return { parentId: payload.parentId };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions);

  const result = await actions.connectMemory('mem-3', 'mem-1');

  assert.strictEqual(result, true, 'should return true on confirmed response');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
});

test('connectMemory: mismatched parentId in response returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  let updateDetailPanelCalled = false;
  let rerenderCanvasCalled = false;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      // Server returns different parentId than requested
      return { parentId: 'other-id' };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; },
    updateDetailPanel: () => { updateDetailPanelCalled = true; },
    rerenderCanvas: () => { rerenderCanvasCalled = true; }
  });

  const result = await actions.connectMemory('mem-3', 'mem-1');

  assert.strictEqual(result, false, 'should return false on parentId mismatch');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
  assert.strictEqual(updateDetailPanelCalled, false, 'updateDetailPanel not called');
  assert.strictEqual(rerenderCanvasCalled, false, 'rerenderCanvas not called');
});

test('connectMemory: response missing parentId returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      // Server response missing parentId
      return { title: 'updated' };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; }
  });

  const result = await actions.connectMemory('mem-3', 'mem-1');

  assert.strictEqual(result, false, 'should return false when parentId missing');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
});

test('connectMemory: API throws returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  let updateSaveStatusCalledWith = null;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      throw new Error('Network error');
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; },
    updateSaveStatus: (status) => { updateSaveStatusCalledWith = status; }
  });

  const result = await actions.connectMemory('mem-3', 'mem-1');

  assert.strictEqual(result, false, 'should return false on API error');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
  assert.strictEqual(updateSaveStatusCalledWith, 'checkpoint_failed', 'updateSaveStatus called with failed');
});

test('disconnectMemory: confirmed response with parentId === null returns true and applies local state', async () => {
  let updateCallCount = 0;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      return { parentId: null };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions);

  const result = await actions.disconnectMemory('mem-3');

  assert.strictEqual(result, true, 'should return true on confirmed null response');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
});

test('disconnectMemory: response with parentId !== null returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  let rerenderCanvasCalled = false;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      // Server returns non-null parentId (not disconnected)
      return { parentId: 'still-connected' };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; },
    rerenderCanvas: () => { rerenderCanvasCalled = true; }
  });

  const result = await actions.disconnectMemory('mem-3');

  assert.strictEqual(result, false, 'should return false when parentId not null');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
  assert.strictEqual(rerenderCanvasCalled, false, 'rerenderCanvas not called');
});

test('disconnectMemory: response missing parentId returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      // Server response missing parentId
      return { title: 'updated' };
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; }
  });

  const result = await actions.disconnectMemory('mem-3');

  assert.strictEqual(result, false, 'should return false when parentId missing');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
});

test('disconnectMemory: API throws returns false and does not apply local state', async () => {
  let updateCallCount = 0;
  let setTreeMemoriesCalled = false;
  let updateSaveStatusCalledWith = null;
  const source = readSource('js/editor/editor-memory-actions.js');
  const sandbox = makeSandbox({
    updateMemory: async (id, payload) => {
      updateCallCount++;
      throw new Error('Network error');
    }
  });
  const createEditorMemoryActions = runSourceInSandbox(source, sandbox);
  const actions = createMemoryActions(createEditorMemoryActions, {
    setTreeMemories: () => { setTreeMemoriesCalled = true; },
    updateSaveStatus: (status) => { updateSaveStatusCalledWith = status; }
  });

  const result = await actions.disconnectMemory('mem-3');

  assert.strictEqual(result, false, 'should return false on API error');
  assert.strictEqual(updateCallCount, 1, 'updateMemory called once');
  assert.strictEqual(setTreeMemoriesCalled, false, 'setTreeMemories not called');
  assert.strictEqual(updateSaveStatusCalledWith, 'checkpoint_failed', 'updateSaveStatus called with failed');
});