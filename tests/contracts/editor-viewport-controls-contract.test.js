const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor page mounts viewport control buttons with accessible labels', () => {
  const html = read('pages/editor.html');

  for (const id of [
    'zoomOutCanvasBtn',
    'zoomInCanvasBtn',
    'recenterCanvasBtn',
    'focusSelectedBtn',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} must be mounted in editor toolbar`);
  }

  assert.match(html, /role=["']toolbar["']/, 'canvas controls must expose toolbar semantics');
  assert.match(html, /aria-label=["']축소["']/, 'zoom out must have an accessible label');
  assert.match(html, /aria-label=["']확대["']/, 'zoom in must have an accessible label');
  assert.match(html, /aria-label=["']트리 한눈에 보기["']/, 'fit whole tree must have an accessible label');
  assert.match(html, /aria-label=["']선택한 순간 보기["']/, 'focus selected moment must have an accessible label');
});

test('editor canvas viewport module owns zoom, fit, and focus math', () => {
  const source = read('js/editor/editor-canvas-viewport.js');

  assert.match(source, /minScale:\s*0\.5/, 'viewport must bound zoom-out scale');
  assert.match(source, /maxScale:\s*1\.5/, 'viewport must bound zoom-in scale');
  assert.match(source, /zoomLevels:\s*\[\s*0\.5,\s*0\.75,\s*1,\s*1\.25,\s*1\.5\s*\]/, 'viewport must define preset zoom levels');
  assert.match(source, /projectWorldPosition\s*\(/, 'viewport must project world positions through scale and offset');
  assert.match(source, /getFitViewport\s*\(/, 'viewport must compute fit-whole-tree state');
  assert.match(source, /focusNodeById\s*\(/, 'viewport must preserve selected/current moment focus');
  assert.match(source, /getNextZoom/, 'zoom in must delegate to getNextZoom');
  assert.match(source, /this\.getNextZoom\(.*,\s*factor\s*>=\s*1\s*\?\s*1\s*:\s*-1\)/, 'zoom controls must use directional getNextZoom calls');
});

test('editor canvas persists scale and keeps node dragging scale-aware', () => {
  const canvas = read('js/editor/editor-canvas.js');
  const layout = read('js/editor/editor-canvas-layout.js');
  const interaction = read('js/editor/editor-canvas-interaction.js');
  const fallbackInteraction = read('js/editor/editor-canvas-interaction-helpers.js');
  const canvasNode = read('js/editor/editor-canvas-node.js');

  assert.match(canvas, /scale:\s*storedLayout\.scale \|\| 1/, 'canvas state must initialize viewport scale');
  assert.match(canvas, /projectWorldPosition\(world,\s*viewportState\)/, 'canvas must render through viewport projection');
  assert.match(canvasNode, /nodeEl\.style\.transform = 'scale\(/ , 'node cards must visually scale with viewport (delegated to canvas-node)');
  assert.match(canvas, /function\s+zoomBy\s*\(factor\)/, 'canvas must expose zoom action');
  assert.match(canvas, /persistStoredPositions\(\)/, 'viewport control changes must persist safely');
  assert.match(layout, /scale:\s*typeof parsed\.scale === 'number' \? parsed\.scale : 1/, 'layout store must read persisted scale defensively');
  assert.match(layout, /scale:\s*viewportState\.scale \|\| 1/, 'layout store must persist viewport scale');
  assert.match(interaction, /dx \/ scale/, 'primary node drag must account for zoom scale');
  assert.match(fallbackInteraction, /dx \/ scale/, 'fallback node drag must account for zoom scale');
});

test('editor viewport controls stay scoped away from branch slot implementation', () => {
  const html = read('pages/editor.html');
  const canvas = read('js/editor/editor-canvas.js');
  const viewport = read('js/editor/editor-canvas-viewport.js');

  assert.doesNotMatch(`${html}\n${canvas}\n${viewport}`, /branch slot|branchSlot|slot affordance/i);
});
