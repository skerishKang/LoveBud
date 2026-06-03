const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

function getBindCanvasPanBlock() {
  const start = indexOfRequired(canvasSource, 'function bindCanvasPan() {');
  const end = indexOfRequired(canvasSource.slice(start), '\n    function zoomBy(factor) {');
  return canvasSource.slice(start, start + end);
}

const bindCanvasPanBlock = getBindCanvasPanBlock();

test('editor canvas interaction delegation — bindCanvasPan prefers primary interaction runtime', () => {
  const guardIndex = indexOfRequired(bindCanvasPanBlock, "if (typeof canvasInteraction.bind === 'function') {");
  const callIndex = indexOfRequired(bindCanvasPanBlock, 'canvasInteraction.bind({');
  const returnIndex = indexOfRequired(bindCanvasPanBlock, 'return;');
  const fallbackIndex = indexOfRequired(bindCanvasPanBlock, "canvas.addEventListener('mousedown'");

  assert.ok(guardIndex < callIndex);
  assert.ok(callIndex < returnIndex);
  assert.ok(returnIndex < fallbackIndex);
});

test('editor canvas interaction delegation — primary bind receives expected dependencies', () => {
  for (const dependency of [
    'canvas,',
    'viewportState,',
    'scheduleRender:',
    'persistStoredPositions,',
    'initCanvas,',
    'getWorldPosition,',
    'getDragTargetElement:',
    'showMovedToast:'
  ]) {
    assert.match(bindCanvasPanBlock, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas interaction delegation — mouse fallback remains present for now', () => {
  assert.match(bindCanvasPanBlock, /canvas\.addEventListener\('mousedown'/);
  assert.match(bindCanvasPanBlock, /window\.addEventListener\('mousemove'/);
  assert.match(bindCanvasPanBlock, /window\.addEventListener\('mouseup'/);
  assert.match(bindCanvasPanBlock, /viewportState\.globalsBound/);
  assert.match(bindCanvasPanBlock, /persistStoredPositions\(\)/);
  assert.match(bindCanvasPanBlock, /initCanvas\(\)/);
});
