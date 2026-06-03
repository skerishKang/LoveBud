const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8');
const viewportSource = fs.readFileSync('js/editor/editor-canvas-viewport.js', 'utf8');
const viewportFitSource = fs.readFileSync('js/editor/editor-canvas-viewport-fit.js', 'utf8');
const viewportStateSource = fs.readFileSync('js/editor/editor-canvas-viewport-state.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

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

const fitViewportBlock = getFunctionBlock(
  canvasSource,
  '\n    function fitViewportToTree() {',
  '\n    function switchToFreeMode() {'
);

const inputDeps = [
  'getTreeMemories,',
  'getCanonicalRootId,',
  'isRootMemory,',
  'getWorldPosition,',
  'getMetrics,',
  'viewportState'
];

// ── 1. delegation order inside fitViewportToTree ──────────────────────────

test('editor canvas fit viewport delegation — panzoomUtils path remains primary', () => {
  assert.match(fitViewportBlock, /panzoomUtils\.getFitViewportIfAvailable\(canvasViewport, \{/);
});

test('editor canvas fit viewport delegation — panzoomUtils path receives the 6 dependency inputs', () => {
  const panzoomBlockStart = indexOfRequired(fitViewportBlock, 'panzoomUtils.getFitViewportIfAvailable(canvasViewport, {');
  const panzoomBlockEnd = indexOfRequired(fitViewportBlock.slice(panzoomBlockStart), '});');
  const panzoomInputs = fitViewportBlock.slice(panzoomBlockStart, panzoomBlockStart + panzoomBlockEnd);

  for (const dep of inputDeps) {
    assert.match(panzoomInputs, new RegExp(dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

// ── 2. apply path ────────────────────────────────────────────────────────

test('editor canvas fit viewport delegation — applyViewport called with (viewportState, nextViewport, true)', () => {
  assert.match(fitViewportBlock, /canvasViewport\.applyViewport\(viewportState,\s*nextViewport,\s*true\);/);
});

// ── 3. secondary compatibility paths still exist ─────────────────────────

test('editor canvas fit viewport delegation — secondary canvasViewport.getFitViewport path stays removed', () => {
  assert.doesNotMatch(fitViewportBlock, /canvasViewport\.getFitViewport\(\{/);
});

test('editor canvas fit viewport delegation — direct viewportState mutation paths stay removed', () => {
  assert.doesNotMatch(fitViewportBlock, /viewportState\.scale\s*=\s*nextViewport\.scale/);
  assert.doesNotMatch(fitViewportBlock, /viewportState\.offsetX\s*=\s*nextViewport\.offsetX/);
  assert.doesNotMatch(fitViewportBlock, /viewportState\.offsetY\s*=\s*nextViewport\.offsetY/);
});

// ── 4. helper / load order ──────────────────────────────────────────────

test('editor canvas fit viewport delegation — viewport helper has getFitViewport wrapper', () => {
  assert.match(viewportSource, /getFitViewport\(\s*options\s*\)\s*\{/);
  assert.match(viewportSource, /window\.LoveBudEditorCanvasViewportFit\.getFitViewport\(this,\s*options\)/);
});

test('editor canvas fit viewport delegation — viewport helper has applyViewport wrapper', () => {
  assert.match(viewportSource, /applyViewport\(\s*viewportState,\s*nextViewport/);
  assert.match(viewportSource, /window\.LoveBudEditorCanvasViewportState\.applyViewport\(this,\s*viewportState,\s*nextViewport/);
});

test('editor canvas fit viewport delegation — viewport-state has applyViewport implementation', () => {
  assert.match(viewportStateSource, /applyViewport\(\s*viewportApi,\s*viewportState,\s*nextViewport,\s*useFitScale\s*\)/);
});

test('editor canvas fit viewport delegation — viewport-fit has getFitViewport implementation', () => {
  assert.match(viewportFitSource, /getFitViewport\(\s*viewportApi,\s*options\s*\)\s*\{/);
});

test('editor canvas fit viewport delegation — editor.html loads viewport-state before editor-canvas.js', () => {
  const viewportStateIndex = indexOfRequired(editorHtml, 'editor-canvas-viewport-state.js');
  const canvasIndex = indexOfRequired(editorHtml, 'editor-canvas.js');
  assert.ok(viewportStateIndex < canvasIndex,
    'editor-canvas-viewport-state.js must load before editor-canvas.js');
});

test('editor canvas fit viewport delegation — editor.html loads viewport-fit before editor-canvas.js', () => {
  const viewportFitIndex = indexOfRequired(editorHtml, 'editor-canvas-viewport-fit.js');
  const canvasIndex = indexOfRequired(editorHtml, 'editor-canvas.js');
  assert.ok(viewportFitIndex < canvasIndex,
    'editor-canvas-viewport-fit.js must load before editor-canvas.js');
});
