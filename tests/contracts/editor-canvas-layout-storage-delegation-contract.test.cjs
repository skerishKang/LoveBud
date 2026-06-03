const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8');
const storageSource = fs.readFileSync('js/editor/editor-canvas-layout-storage.js', 'utf8');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

function getBlock(source, startNeedle, endNeedle) {
  const start = indexOfRequired(source, startNeedle);
  const relativeEnd = indexOfRequired(source.slice(start), endNeedle);
  return source.slice(start, start + relativeEnd);
}

const loadStoredLayoutBlock = getBlock(
  canvasSource,
  'function loadStoredLayout() {',
  '\n\n    function loadLayoutMode() {'
);
const loadLayoutModeBlock = getBlock(
  canvasSource,
  'function loadLayoutMode() {',
  '\n\n    function persistLayoutMode(mode) {'
);
const persistLayoutModeBlock = getBlock(
  canvasSource,
  'function persistLayoutMode(mode) {',
  '\n\n    const storedLayout = loadStoredLayout();'
);
const persistStoredPositionsBlock = getBlock(
  canvasSource,
  'function persistStoredPositions() {',
  '\n\n    function fitViewportToTree() {'
);

test('editor canvas layout storage delegation — loadStoredLayout prefers storage helper', () => {
  const guardIndex = indexOfRequired(loadStoredLayoutBlock, "if (typeof storageUtils.loadStoredLayout === 'function') {");
  const helperCallIndex = indexOfRequired(loadStoredLayoutBlock, 'return storageUtils.loadStoredLayout(treeId, layoutStorageKey, canvasLayout);');
  const localStoreIndex = indexOfRequired(loadStoredLayoutBlock, "if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {");
  const defaultIndex = indexOfRequired(loadStoredLayoutBlock, 'return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };');

  assert.ok(guardIndex < helperCallIndex);
  assert.ok(helperCallIndex < localStoreIndex);
  assert.ok(localStoreIndex < defaultIndex);
});

test('editor canvas layout storage delegation — loadLayoutMode prefers storage helper', () => {
  const guardIndex = indexOfRequired(loadLayoutModeBlock, "if (typeof storageUtils.loadLayoutMode === 'function') {");
  const helperCallIndex = indexOfRequired(loadLayoutModeBlock, 'return storageUtils.loadLayoutMode(layoutModeStorageKey);');
  const defaultIndex = indexOfRequired(loadLayoutModeBlock, "return 'free';");

  assert.ok(guardIndex < helperCallIndex);
  assert.ok(helperCallIndex < defaultIndex);
});

test('editor canvas layout storage delegation — persistLayoutMode prefers storage helper after edit guard', () => {
  const editGuardIndex = indexOfRequired(persistLayoutModeBlock, 'if (canEdit === false) return;');
  const helperGuardIndex = indexOfRequired(persistLayoutModeBlock, "if (typeof storageUtils.persistLayoutMode === 'function') {");
  const helperCallIndex = indexOfRequired(persistLayoutModeBlock, 'return storageUtils.persistLayoutMode(mode, layoutModeStorageKey, canEdit);');

  assert.ok(editGuardIndex < helperGuardIndex);
  assert.ok(helperGuardIndex < helperCallIndex);
});

test('editor canvas layout storage delegation — persistStoredPositions prefers storage helper before local store', () => {
  const editGuardIndex = indexOfRequired(persistStoredPositionsBlock, 'if (canEdit === false) return;');
  const helperGuardIndex = indexOfRequired(persistStoredPositionsBlock, "if (typeof storageUtils.persistStoredPositions === 'function') {");
  const helperCallIndex = indexOfRequired(persistStoredPositionsBlock, 'return storageUtils.persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit);');
  const structuredGuardIndex = indexOfRequired(persistStoredPositionsBlock, "if (viewportState.layoutMode === 'structured') return;");
  const localStoreIndex = indexOfRequired(persistStoredPositionsBlock, "if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {");

  assert.ok(editGuardIndex < helperGuardIndex);
  assert.ok(helperGuardIndex < helperCallIndex);
  assert.ok(helperCallIndex < structuredGuardIndex);
  assert.ok(structuredGuardIndex < localStoreIndex);
});

test('editor canvas layout storage delegation — local compatibility paths remain present', () => {
  assert.match(loadStoredLayoutBlock, /canvasLayout\.createLayoutStore\(treeId\)/);
  assert.match(loadStoredLayoutBlock, /return \{ positions: \{\}, offsetX: 0, offsetY: 0, scale: 1 \};/);
  assert.match(loadLayoutModeBlock, /return 'free';/);
  assert.match(persistStoredPositionsBlock, /canvasLayout\.createLayoutStore\(treeId\)/);
  assert.match(persistStoredPositionsBlock, /store\.persist\(viewportState\);/);
});

test('editor canvas layout storage helper exposes expected methods', () => {
  assert.match(storageSource, /window\.LoveBudEditorCanvasLayoutStorage = \{/);
  for (const method of [
    'loadStoredLayout,',
    'loadLayoutMode,',
    'persistLayoutMode,',
    'persistStoredPositions'
  ]) {
    assert.match(storageSource, new RegExp(method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
