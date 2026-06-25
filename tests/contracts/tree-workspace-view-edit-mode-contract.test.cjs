const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Bridge normalizeForCanvas tests ──

function loadBridge() {
  const source = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-bridge.js'), 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveBudPublicCanvasBridge;
}

test('normalizeForCanvas: tree.ownerId is top priority', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    ownerId: 'u-camel-top',
    owner_id: 'u-snake-top',
    data: {
      ownerId: 'u-camel-data',
      owner_id: 'u-snake-data'
    }
  }, []);
  assert.equal(result.treeData.ownerId, 'u-camel-top');
});

test('normalizeForCanvas: tree.owner_id fallback when tree.ownerId missing', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    owner_id: 'u-snake-top',
    data: {
      ownerId: 'u-camel-data',
      owner_id: 'u-snake-data'
    }
  }, []);
  assert.equal(result.treeData.ownerId, 'u-snake-top');
});

test('normalizeForCanvas: tree.data.ownerId fallback when top-level owner missing', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    data: {
      ownerId: 'u-camel-data',
      owner_id: 'u-snake-data'
    }
  }, []);
  assert.equal(result.treeData.ownerId, 'u-camel-data');
});

test('normalizeForCanvas: tree.data.owner_id fallback when all higher missing', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    data: {
      owner_id: 'u-snake-data'
    }
  }, []);
  assert.equal(result.treeData.ownerId, 'u-snake-data');
});

test('normalizeForCanvas: ownerId defaults to empty string when no owner field present', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({ id: 't1', data: {} }, []);
  assert.equal(result.treeData.ownerId, '');
});

test('normalizeForCanvas: ownerId defaults to empty string when no data and no owner', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({ id: 't1' }, []);
  assert.equal(result.treeData.ownerId, '');
});

test('normalizeForCanvas: description preserved at top-level and inside data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    description: 'A beautiful tree',
    data: {}
  }, []);
  assert.equal(result.treeData.description, 'A beautiful tree');
  assert.equal(result.treeData.data.description, 'A beautiful tree');
});

test('normalizeForCanvas: description falls back from tree.data.description', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    data: { description: 'Data description' }
  }, []);
  assert.equal(result.treeData.description, 'Data description');
  assert.equal(result.treeData.data.description, 'Data description');
});

test('normalizeForCanvas: summary preserved at top-level and inside data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    summary: 'Short summary',
    data: {}
  }, []);
  assert.equal(result.treeData.summary, 'Short summary');
  assert.equal(result.treeData.data.summary, 'Short summary');
});

test('normalizeForCanvas: summary falls back from tree.data.summary', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    data: { summary: 'Data summary' }
  }, []);
  assert.equal(result.treeData.summary, 'Data summary');
  assert.equal(result.treeData.data.summary, 'Data summary');
});

test('normalizeForCanvas: memo preserved at top-level and inside data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    memo: 'Personal memo',
    data: {}
  }, []);
  assert.equal(result.treeData.memo, 'Personal memo');
  assert.equal(result.treeData.data.memo, 'Personal memo');
});

test('normalizeForCanvas: memo falls back from tree.data.memo', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    data: { memo: 'Data memo' }
  }, []);
  assert.equal(result.treeData.memo, 'Data memo');
  assert.equal(result.treeData.data.memo, 'Data memo');
});

test('normalizeForCanvas: privateToken excluded from treeData.data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    ownerId: 'u1',
    data: {
      privateToken: 'tok-abc',
      description: 'Desc'
    }
  }, []);
  assert.equal(result.treeData.data.privateToken, undefined);
  assert.equal(result.treeData.data.description, 'Desc');
});

test('normalizeForCanvas: secret field excluded from treeData.data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    ownerId: 'u1',
    data: {
      secret: 's-c0ffee',
      description: 'Desc'
    }
  }, []);
  assert.equal(result.treeData.data.secret, undefined);
  assert.equal(result.treeData.data.description, 'Desc');
});

test('normalizeForCanvas: arbitrary raw nested field excluded from treeData.data', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas({
    id: 't1',
    ownerId: 'u1',
    data: {
      description: 'Desc',
      summary: 'Sum',
      memo: 'Memo',
      privatePayload: { x: 1 },
      rawServerField: 'should-not-leak',
      extraConfig: { debug: true }
    }
  }, []);
  const keys = Object.keys(result.treeData.data);
  assert.deepEqual(keys.sort(), ['description', 'memo', 'ownerId', 'summary']);
});

test('normalizeForCanvas: raw input object is not reference-copied into result', () => {
  const bridge = loadBridge();
  const raw = {
    id: 't1',
    ownerId: 'u1',
    description: 'Desc',
    data: { description: 'Desc', extra: 'x' }
  };
  const result = bridge.normalizeForCanvas(raw, []);
  assert.notEqual(result.treeData, raw);
  assert.notEqual(result.treeData.data, raw.data);
  raw.ownerId = 'u-modified';
  assert.equal(result.treeData.ownerId, 'u1', 'mutating raw input must not affect result');
});

test('normalizeForCanvas: memory array length reflects count', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas(
    { id: 't1', ownerId: 'u1', data: {} },
    [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
  );
  assert.equal(result.treeData.memoryCount, 3);
  assert.equal(result.treeMemories.length, 3);
});

test('normalizeForCanvas: memory normalize handles null/invalid entries safely', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas(
    { id: 't1', ownerId: 'u1', data: {} },
    [null, undefined, { id: 'm1' }, null]
  );
  assert.equal(result.treeMemories.length, 1);
  assert.equal(result.treeMemories[0].id, 'm1');
});

// ── Canvas entry selector runtime tests ──

function loadCanvasEntry(rootUtils) {
  const source = fs.readFileSync(
    path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'),
    'utf8'
  );
  const sandbox = {
    window: {
      LoveBudEditorUtils: rootUtils || {}
    },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveBudPublicViewerCanvasEntry;
}

test('entry: canonical root r1 is excluded; others remain', () => {
  const entry = loadCanvasEntry({});
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' },
    { id: 'm2', parentId: 'r1', createdAt: '2026-01-03' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, 'r1');
  assert.equal(selectors.isRootMemory({ id: 'r1' }, rootId), true);
  assert.equal(selectors.isRootMemory({ id: 'm1' }, rootId), false);
  assert.equal(selectors.isRootMemory({ id: 'm2' }, rootId), false);
});

test('entry: self-parent memory is not excluded unless canonical root', () => {
  const entry = loadCanvasEntry({});
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 's1', parentId: 's1', createdAt: '2026-01-02' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-03' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, 'r1');
  assert.equal(selectors.isRootMemory({ id: 's1' }, rootId), false);
});

test('entry: rootUtils returns "root" but no memory id "root" → null', () => {
  const entry = loadCanvasEntry({
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: function(mem, rootId) { return mem && mem.id === rootId; }
  });
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null, 'phantom "root" sentinel rejected');
});

test('entry: rootUtils returns "ghost" sentinel → null', () => {
  const entry = loadCanvasEntry({
    getCanonicalRootId: function() { return 'ghost'; },
    isRootMemory: function(mem, rootId) { return mem && mem.id === rootId; }
  });
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null, 'phantom "ghost" sentinel rejected');
});

test('entry: rootUtils returns "root" and legacy root memory exists → "root" kept', () => {
  const entry = loadCanvasEntry({
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: function(mem, rootId) { return mem && mem.id === rootId; }
  });
  const selectors = entry.createMemorySelectors([
    { id: 'root', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'root', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, 'root', 'real legacy root memory keeps "root" id');
  assert.equal(selectors.isRootMemory({ id: 'root' }, rootId), true);
});

test('entry: no roots → null, all memories kept in non-root count', () => {
  const entry = loadCanvasEntry({});
  const selectors = entry.createMemorySelectors([
    { id: 'm1', parentId: 'p1', createdAt: '2026-01-01' },
    { id: 'm2', parentId: 'p1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null);
  const nonRootCount = selectors.findFirstSelectableMemory(rootId)
    ? selectors.findFirstSelectableMemory(rootId) : null;
  assert.ok(nonRootCount !== null, 'still find first memory');
});

test('entry: count computed via actual isRootMemory excludes only canonical root', () => {
  const entry = loadCanvasEntry({});
  const mems = [
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' },
    { id: 'm2', parentId: 'r1', createdAt: '2026-01-03' }
  ];
  const selectors = entry.createMemorySelectors(mems);
  const rootId = selectors.getCanonicalRootId();
  const nonRoot = mems.filter(function(m) { return !selectors.isRootMemory(m, rootId); });
  assert.equal(nonRoot.length, 2);
});

test('entry: empty memory array → null rootId', () => {
  const entry = loadCanvasEntry({});
  const selectors = entry.createMemorySelectors([]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null);
});

test('entry: rootUtils returns null → null propagated', () => {
  const entry = loadCanvasEntry({
    getCanonicalRootId: function() { return null; },
    isRootMemory: function(mem, rootId) { return mem && mem.id === rootId; }
  });
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null);
});

test('entry: rootUtils returns undefined → null propagated', () => {
  const entry = loadCanvasEntry({
    getCanonicalRootId: function() { return undefined; },
    isRootMemory: function(mem, rootId) { return mem && mem.id === rootId; }
  });
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, null);
});

test('entry: local fallback filter finds root from memories', () => {
  const entry = loadCanvasEntry({});
  const selectors = entry.createMemorySelectors([
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'r2', parentId: null, createdAt: '2026-01-00' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ]);
  const rootId = selectors.getCanonicalRootId();
  assert.equal(rootId, 'r2', 'earliest null-parent is canonical root');
});

// ── public-canvas-init.js sentinel contract ──

test('init: resolveExistingMemoryId helper exists', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(
    src.includes('function resolveExistingMemoryId(candidateId)'),
    'init fallback must have a sentinel validation helper'
  );
  assert.ok(
    src.includes('return resolveExistingMemoryId(rootUtils.getCanonicalRootId(treeMemories))'),
    'rootUtils.getCanonicalRootId result must pass through resolveExistingMemoryId'
  );
});

test('init: no literal "root" fallback', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(
    !src.includes("roots.length === 0) return 'root'"),
    'init fallback must not return literal "root" when no roots found'
  );
});

test('init: entry path delegates to canvasEntry.getCanonicalRootId', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(
    src.includes('memorySelectors.getCanonicalRootId()'),
    'init must prefer entry selector getCanonicalRootId'
  );
});

test('init: resolveExistingMemoryId validates against treeMemories array', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(
    src.includes('treeMemories.some(function(m) { return m && m.id === candidateId; })'),
    'resolveExistingMemoryId must check treeMemories for actual id presence'
  );
});
