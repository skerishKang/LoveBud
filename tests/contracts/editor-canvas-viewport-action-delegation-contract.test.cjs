const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8').replace(/\r\n/g, '\n');
const viewportSource = fs.readFileSync('js/editor/editor-canvas-viewport.js', 'utf8').replace(/\r\n/g, '\n');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

function getFunctionBlock(source, signature, nextSignature) {
  const start = indexOfRequired(source, signature);
  const end = indexOfRequired(source.slice(start), nextSignature);
  return source.slice(start, start + end);
}

const focusNodeByIdBlock = getFunctionBlock(
  canvasSource,
  'function focusNodeById(nodeId) {',
  '\n    function recenterViewport() {'
);
const recenterViewportBlock = getFunctionBlock(
  canvasSource,
  'function recenterViewport() {',
  '\n    /**\n     * EVENT LIFECYCLE BOUNDARY'
);
const zoomByBlock = getFunctionBlock(
  canvasSource,
  'function zoomBy(factor) {',
  '\n    function addNodePosition(memoryId, pos) {'
);

test('editor canvas viewport action delegation — focusNodeById prefers viewport action runtime', () => {
  const guardIndex = indexOfRequired(focusNodeByIdBlock, "if (typeof canvasViewport.focusNodeById === 'function') {");
  const callIndex = indexOfRequired(focusNodeByIdBlock, 'canvasViewport.focusNodeById({');
  const persistIndex = indexOfRequired(focusNodeByIdBlock, 'persistStoredPositions();');
  const returnIndex = indexOfRequired(focusNodeByIdBlock, 'return;');

  assert.ok(guardIndex < callIndex);
  assert.ok(callIndex < persistIndex);
  assert.ok(persistIndex < returnIndex);
});

test('editor canvas viewport action delegation — focusNodeById passes expected dependencies', () => {
  for (const dependency of [
    'nodeId,',
    'getTreeMemories,',
    'getCanonicalRootId,',
    'isRootMemory,',
    'getWorldPosition,',
    'getMetrics,',
    'viewportState,',
    'initCanvas: scheduleRender,',
    'reapplySelection',
    'findMemoryNodeById: selectionUtils.findMemoryNodeById'
  ]) {
    assert.match(focusNodeByIdBlock, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas viewport action delegation — recenterViewport prefers viewport action runtime', () => {
  const guardIndex = indexOfRequired(recenterViewportBlock, "if (typeof canvasViewport.recenterViewport === 'function') {");
  const callIndex = indexOfRequired(recenterViewportBlock, 'canvasViewport.recenterViewport({');
  const persistIndex = indexOfRequired(recenterViewportBlock, 'persistStoredPositions();');
  const returnIndex = indexOfRequired(recenterViewportBlock, 'return;');

  assert.ok(guardIndex < callIndex);
  assert.ok(callIndex < persistIndex);
  assert.ok(persistIndex < returnIndex);
});

test('editor canvas viewport action delegation — recenterViewport passes expected dependencies', () => {
  for (const dependency of [
    'getTreeMemories,',
    'getCanonicalRootId,',
    'isRootMemory,',
    'getWorldPosition,',
    'getMetrics,',
    'viewportState,',
    'initCanvas: scheduleRender'
  ]) {
    assert.match(recenterViewportBlock, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas viewport action delegation — zoomBy prefers viewport action runtime', () => {
  const guardIndex = indexOfRequired(zoomByBlock, "if (typeof canvasViewport.zoomBy === 'function') {");
  const callIndex = indexOfRequired(zoomByBlock, 'canvasViewport.zoomBy({');
  const persistIndex = indexOfRequired(zoomByBlock, 'persistStoredPositions();');
  const returnIndex = indexOfRequired(zoomByBlock, 'return;');

  assert.ok(guardIndex < callIndex);
  assert.ok(callIndex < persistIndex);
  assert.ok(persistIndex < returnIndex);
});

test('editor canvas viewport action delegation — zoomBy passes expected dependencies', () => {
  for (const dependency of [
    'factor,',
    'viewportState,',
    'getMetrics,',
    'initCanvas: scheduleRender'
  ]) {
    assert.match(zoomByBlock, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas viewport action delegation — legacy secondary paths stay removed', () => {
  assert.doesNotMatch(focusNodeByIdBlock, /panzoomUtils\.focusNodeByIdFallback\(\{/);
  assert.doesNotMatch(recenterViewportBlock, /panzoomUtils\.recenterViewportFallback\(\{/);
  assert.doesNotMatch(zoomByBlock, /panzoomUtils\.zoomByFallback\(\{/);
});

test('editor canvas viewport action wrappers remain exposed', () => {
  for (const method of [
    'focusNodeById(options) {',
    'recenterViewport(options) {',
    'zoomBy(options) {'
  ]) {
    assert.match(viewportSource, new RegExp(method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas viewport action wrappers safely return when action helper is unavailable', () => {
  for (const guard of [
    "typeof window.LoveBudEditorCanvasViewportActions.focusNodeById !== 'function'",
    "typeof window.LoveBudEditorCanvasViewportActions.recenterViewport !== 'function'",
    "typeof window.LoveBudEditorCanvasViewportActions.zoomBy !== 'function'"
  ]) {
    const guardIndex = indexOfRequired(viewportSource, guard);
    const returnIndex = indexOfRequired(viewportSource.slice(guardIndex), 'return;');
    assert.ok(returnIndex >= 0);
  }
});
