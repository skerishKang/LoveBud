const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBridge(windowOverrides = {}) {
  const source = fs.readFileSync('js/viewer/public-canvas-bridge.js', 'utf8');
  const windowObject = {
    LoveTreePublicTreeAdapter: {
      unwrapMemoryRecord(memory) {
        return memory && memory.data ? memory.data : memory;
      }
    },
    ...windowOverrides
  };
  const sandbox = {
    window: windowObject,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveBudPublicCanvasBridge;
}

function loadSidebarUpdater(documentObject) {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
  const windowObject = {};
  const sandbox = {
    window: windowObject,
    document: documentObject,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveBudPublicViewerDetailUI.createPublicViewerSidebarStatusUpdater;
}

function createDocument() {
  const elements = {
    viewerSidebarMomentCount: { textContent: '0개의 순간' }
  };
  return {
    elements,
    getElementById(id) {
      return elements[id] || null;
    }
  };
}

function buildUpdaterScenario(rawMemories, treeMemoryCount) {
  const bridge = loadBridge();
  const normalized = bridge.normalizeForCanvas(
    { id: 'tree-1', title: 'Viewer Tree', memoryCount: treeMemoryCount || 0 },
    rawMemories
  );
  const documentObject = createDocument();
  const createUpdater = loadSidebarUpdater(documentObject);
  const updater = createUpdater({
    getTreeMemories() {
      return normalized.treeMemories;
    },
    getCanonicalRootId() {
      return 'root';
    },
    isRootMemory(memory, rootId) {
      return !!(memory && memory.id === rootId);
    }
  });

  updater();

  return {
    normalized,
    countText: documentObject.elements.viewerSidebarMomentCount.textContent
  };
}

test('cold direct load: wrapped community memories render non-root public count instead of tree.memoryCount shortcut', () => {
  const result = buildUpdaterScenario([
    { data: { id: 'root', treeId: 'tree-1', parentId: null, title: 'Root' } },
    { data: { id: 'm-1', treeId: 'tree-1', parentId: 'root', title: 'Moment 1' } },
    { data: { id: 'm-2', treeId: 'tree-1', parentId: 'm-1', title: 'Moment 2' } },
    { data: { id: 'm-3', treeId: 'tree-1', parentId: 'm-2', title: 'Moment 3' } }
  ], 99);

  assert.equal(result.normalized.treeMemories.length, 4, 'wrapped direct-load memories must survive normalization');
  assert.equal(result.countText, '3개의 순간');
});

test('hub-preloaded/cache path: flat memories render the same non-root count', () => {
  const result = buildUpdaterScenario([
    { id: 'root', treeId: 'tree-1', parentId: null, title: 'Root' },
    { id: 'm-1', treeId: 'tree-1', parentId: 'root', title: 'Moment 1' },
    { id: 'm-2', treeId: 'tree-1', parentId: 'm-1', title: 'Moment 2' },
    { id: 'm-3', treeId: 'tree-1', parentId: 'm-2', title: 'Moment 3' }
  ], 7);

  assert.equal(result.countText, '3개의 순간');
});

test('true empty public tree: sidebar count stays at 0', () => {
  const result = buildUpdaterScenario([], 12);
  assert.equal(result.normalized.treeMemories.length, 0);
  assert.equal(result.countText, '0개의 순간');
});

test('root memory only: root exclusion keeps sidebar count at 0', () => {
  const result = buildUpdaterScenario([
    { data: { id: 'root', treeId: 'tree-1', parentId: null, title: 'Root' } }
  ], 5);

  assert.equal(result.normalized.treeMemories.length, 1);
  assert.equal(result.countText, '0개의 순간');
});

test('count source guard: tree.memoryCount alone never populates sidebar count', () => {
  const result = buildUpdaterScenario([
    { data: { id: 'root', treeId: 'tree-1', parentId: null, title: 'Root' } }
  ], 42);

  assert.equal(result.countText, '0개의 순간');
});
