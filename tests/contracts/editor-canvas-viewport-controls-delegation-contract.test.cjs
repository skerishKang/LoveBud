const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8');
const viewportSource = fs.readFileSync('js/editor/editor-canvas-viewport.js', 'utf8');
const controlsSource = fs.readFileSync('js/editor/editor-canvas-viewport-controls.js', 'utf8');

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

const bindViewportControlsBlock = getFunctionBlock(
  canvasSource,
  'function bindViewportControls() {',
  '\n    function bindLayoutModeToggle() {'
);

test('editor canvas viewport controls delegation — bindViewportControls prefers viewport controls runtime', () => {
  const guardIndex = indexOfRequired(bindViewportControlsBlock, "if (typeof canvasViewport.bindControls === 'function') {");
  const callIndex = indexOfRequired(bindViewportControlsBlock, 'canvasViewport.bindControls({');
  const returnIndex = indexOfRequired(bindViewportControlsBlock, 'return;');

  assert.ok(guardIndex < callIndex);
  assert.ok(callIndex < returnIndex);
});

test('editor canvas viewport controls delegation — primary bind receives expected dependencies', () => {
  for (const dependency of [
    'viewportState,',
    'focusNodeById,',
    'recenterViewport,',
    'zoomBy'
  ]) {
    assert.match(bindViewportControlsBlock, new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('editor canvas viewport controls delegation — legacy secondary path stays removed', () => {
  assert.doesNotMatch(bindViewportControlsBlock, /uiHelpers\.bindViewportControlsFallback\(\{/);
  assert.doesNotMatch(bindViewportControlsBlock, /getSelectedMemoryId:/);
});

test('editor canvas viewport controls delegation — viewport bindControls wrapper exists', () => {
  assert.match(viewportSource, /bindControls\(\s*options\s*\)\s*\{/);
});

test('editor canvas viewport controls delegation — viewport wrapper safely returns when controls helper absent', () => {
  const guardIndices = [
    indexOfRequired(viewportSource, 'typeof window.LoveBudEditorCanvasViewportControls.bindControls'),
    indexOfRequired(viewportSource, "!window.LoveBudEditorCanvasViewportControls")
  ];
  for (const idx of guardIndices) {
    const returnIndex = indexOfRequired(viewportSource.slice(idx), 'return;');
    assert.ok(returnIndex >= 0);
  }
});

test('editor canvas viewport controls delegation — viewport wrapper delegates to controls runtime', () => {
  assert.match(viewportSource, /window\.LoveBudEditorCanvasViewportControls\.bindControls\(this,\s*options\)/);
});

test('editor canvas viewport controls delegation — viewport controls runtime bindControls exists', () => {
  assert.match(controlsSource, /bindControls\(\s*viewportApi,\s*options\s*\)\s*\{/);
  assert.match(controlsSource, /viewportState\.controlsBound/);
});
