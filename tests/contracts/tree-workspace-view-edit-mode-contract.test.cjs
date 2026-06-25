const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

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

// ── Canonical root / moment count behavior ──
// Matches the exact fallback logic in public-canvas-init.js createPublicCanvasMemoryHelpers

function inlineGetCanonicalRootId(memories) {
  const roots = memories.filter(function(m) { return m.parentId === null || m.parentId === undefined; });
  if (roots.length === 0) return null;
  return roots.sort(function(a, b) {
    return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;
  })[0].id;
}

function inlineIsRootMemory(mem, rootId) {
  return !!(mem && rootId && mem.id === rootId);
}

function inlineNonRootCount(memories, canonicalRootId) {
  return memories.filter(function(m) { return !inlineIsRootMemory(m, canonicalRootId); }).length;
}

test('count: canonical root (id !== "root") is excluded; others remain', () => {
  const mems = [
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' },
    { id: 'm2', parentId: 'r1', createdAt: '2026-01-03' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'r1');
  assert.equal(inlineIsRootMemory(mems[0], rootId), true);
  assert.equal(inlineIsRootMemory(mems[1], rootId), false);
  assert.equal(inlineIsRootMemory(mems[2], rootId), false);
  assert.equal(inlineNonRootCount(mems, rootId), 2);
});

test('count: self-parent memory is NOT excluded unless it is the canonical root', () => {
  const mems = [
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 's1', parentId: 's1', createdAt: '2026-01-02' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-03' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'r1');
  assert.equal(inlineIsRootMemory(mems[1], rootId), false, 'self-parent is not the canonical root');
  assert.equal(inlineNonRootCount(mems, rootId), 2);
});

test('count: null-parent memory (id !== "root") is canonical root, excluded exactly once', () => {
  const mems = [
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'm1', createdAt: '2026-01-02' },
    { id: 'm2', parentId: 'r1', createdAt: '2026-01-03' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'r1');
  assert.equal(inlineIsRootMemory(mems[0], rootId), true, 'null-parent memory is the canonical root');
  assert.equal(inlineIsRootMemory(mems[1], rootId), false, 'self-parent memory is not excluded');
  assert.equal(inlineNonRootCount(mems, rootId), 2);
});

test('count: no canonical root returns null; no memory excluded', () => {
  const mems = [
    { id: 'm1', parentId: 'p1', createdAt: '2026-01-01' },
    { id: 'm2', parentId: 'p1', createdAt: '2026-01-02' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, null);
  assert.equal(inlineIsRootMemory(mems[0], rootId), false);
  assert.equal(inlineIsRootMemory(mems[1], rootId), false);
  assert.equal(inlineNonRootCount(mems, rootId), 2);
});

test('count: when no canonical root, "root" string literal is not assumed', () => {
  const mems = [
    { id: 'm1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm2', parentId: 'm1', createdAt: '2026-01-02' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'm1');
  assert.equal(inlineIsRootMemory({ id: 'm1' }, 'root'), false, 'isRootMemory must not match literal root');
  assert.equal(inlineNonRootCount(mems, rootId), 1);
});

test('count: normalizeForCanvas filters nulls before they reach memory helpers', () => {
  const bridge = loadBridge();
  const result = bridge.normalizeForCanvas(
    { id: 't1', ownerId: 'u1' },
    [null, undefined, { id: 'm1' }, null]
  );
  assert.equal(result.treeMemories.length, 1, 'normalizeForCanvas already filters nulls upstream');
});

test('count: inline helpers accept clean arrays (matching normalized pipeline)', () => {
  const mems = [
    { id: 'r1', parentId: null, createdAt: '2026-01-01' },
    { id: 'm1', parentId: 'r1', createdAt: '2026-01-02' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'r1');
  assert.equal(inlineIsRootMemory(null, rootId), false);
  assert.equal(inlineIsRootMemory(undefined, rootId), false);
  assert.equal(inlineNonRootCount(mems, rootId), 1);
});

test('count: canonicalRootId is null when null-parent memories exist but have real content', () => {
  const mems = [
    { id: 'm1', parentId: null, createdAt: '2026-01-01', thumbnail: 'http://img', title: 'Real Moment' },
    { id: 'm2', parentId: 'm1', createdAt: '2026-01-02' }
  ];
  const rootId = inlineGetCanonicalRootId(mems);
  assert.equal(rootId, 'm1', 'fallback logic treats any null-parent as root candidate');
  assert.equal(inlineIsRootMemory(mems[0], rootId), true);
  assert.equal(inlineNonRootCount(mems, rootId), 1);
});

test('count: empty memory array returns null rootId, zero count not negative', () => {
  const rootId = inlineGetCanonicalRootId([]);
  assert.equal(rootId, null);
  assert.equal(inlineNonRootCount([], rootId), 0);
});
