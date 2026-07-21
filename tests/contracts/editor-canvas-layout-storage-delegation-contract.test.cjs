const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8').replace(/\r\n/g, '\n');
const storageSource = fs.readFileSync('js/editor/editor-canvas-layout-storage.js', 'utf8').replace(/\r\n/g, '\n');

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
  '\n\n    function canDragCurrentLayout() {'
);

test('editor canvas layout storage delegation — loadStoredLayout prefers storage helper', () => {
  const guardIndex = indexOfRequired(loadStoredLayoutBlock, "if (typeof storageUtils.loadStoredLayout === 'function') {");
  const helperCallIndex = indexOfRequired(loadStoredLayoutBlock, 'storageUtils.loadStoredLayout(');
  const policyIndex = indexOfRequired(loadStoredLayoutBlock, 'layoutPolicy.layoutReadOnly === true');
  assert.ok(guardIndex < helperCallIndex);
  assert.ok(helperCallIndex < policyIndex || loadStoredLayoutBlock.includes('layoutPolicy.layoutReadOnly'));
});

test('editor canvas layout storage delegation — loadLayoutMode prefers storage helper', () => {
  const guardIndex = indexOfRequired(loadLayoutModeBlock, "if (typeof storageUtils.loadLayoutMode === 'function') {");
  const helperCallIndex = indexOfRequired(loadLayoutModeBlock, 'storageUtils.loadLayoutMode(');
  assert.ok(guardIndex < helperCallIndex);
  assert.ok(loadLayoutModeBlock.includes('layoutPolicy.layoutReadOnly === true'));
});

test('editor canvas layout storage delegation — persistLayoutMode prefers storage helper after policy guard', () => {
  const policyGuardIndex = indexOfRequired(persistLayoutModeBlock, 'if (layoutPolicy.allowPersistMode !== true) return;');
  const helperGuardIndex = indexOfRequired(persistLayoutModeBlock, "if (typeof storageUtils.persistLayoutMode === 'function') {");
  const helperCallIndex = indexOfRequired(persistLayoutModeBlock, 'storageUtils.persistLayoutMode(');
  assert.ok(policyGuardIndex < helperGuardIndex);
  assert.ok(helperGuardIndex < helperCallIndex);
});

test('editor canvas layout storage delegation — persistStoredPositions prefers storage helper after policy guard', () => {
  const policyGuardIndex = indexOfRequired(persistStoredPositionsBlock, 'if (layoutPolicy.allowPersistPositions !== true) return;');
  const helperGuardIndex = indexOfRequired(persistStoredPositionsBlock, "if (typeof storageUtils.persistStoredPositions === 'function') {");
  const helperCallIndex = indexOfRequired(persistStoredPositionsBlock, 'storageUtils.persistStoredPositions(');
  assert.ok(policyGuardIndex < helperGuardIndex);
  assert.ok(helperGuardIndex < helperCallIndex);
});

test('editor canvas layout storage delegation — local store direct paths stay removed', () => {
  assert.doesNotMatch(loadStoredLayoutBlock, /canvasLayout\.createLayoutStore\(treeId\)/);
  assert.doesNotMatch(persistStoredPositionsBlock, /canvasLayout\.createLayoutStore\(treeId\)/);
  assert.doesNotMatch(persistStoredPositionsBlock, /store\.persist\(viewportState\);/);
  // Fail-closed default when helper missing is allowed.
  assert.match(loadStoredLayoutBlock, /return \{ positions: \{\}, offsetX: 0, offsetY: 0, scale: 1 \};/);
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
