const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor page mounts viewport control buttons with accessible labels', () => {
  const html = read('pages/editor.html') + read('js/editor/templates/editor-canvas-topbar-template.js');

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

test('editor canvas viewport module owns fit-safe zoom and focus math', () => {
  const source = read('js/editor/editor-canvas-viewport.js');
  const actionsSource = read('js/editor/editor-canvas-viewport-actions.js');
  const initialSource = read('js/editor/editor-canvas-viewport-initial.js');
  const scaleSource = read('js/editor/editor-canvas-viewport-scale.js');

  assert.match(source, /minScale:\s*0\.2/, 'viewport must allow small zoom for large whole-tree fit');
  assert.match(source, /maxScale:\s*1\.5/, 'viewport must bound zoom-in scale');
  assert.match(source, /zoomLevels:\s*\[\s*0\.2,\s*0\.35,\s*0\.5,\s*0\.75,\s*1,\s*1\.25,\s*1\.5\s*\]/, 'viewport must define preset zoom levels including small whole-tree fit levels');
  assert.match(source, /getFitZoom\s*\(/, 'viewport must expose a fit-safe zoom selector');
  assert.match(scaleSource, /candidate <= clamped && candidate > best/, 'fit zoom must not round upward and risk clipping');
  assert.match(source, /projectWorldPosition\s*\(/, 'viewport must project world positions through scale and offset');
  assert.match(source, /getFitViewport\s*\(/, 'viewport must compute fit-whole-tree state');
  assert.match(source, /prepareInitialViewport\s*\(/, 'viewport must own initial viewport preparation');
  assert.match(initialSource, /viewportApi\.applyViewport\(viewportState, viewportApi\.getFitViewport\(options\), true\)/, 'initial no-stored viewport must use whole-tree fit');
  assert.match(initialSource, /viewportApi\.applyViewport\(viewportState, viewportApi\.getFitViewport\(options\), true\)/, 'offscreen fallback must use whole-tree fit');
  assert.match(source, /recenterViewport\s*\(/, 'viewport must own recenter behavior');
  assert.match(source, /focusNodeById\s*\(/, 'viewport must preserve explicit selected/current moment focus');
  assert.match(source, /getNextZoom/, 'zoom in must delegate to getNextZoom');
  // The zoomBy implementation moved to editor-canvas-viewport-actions.js (Stage 36)
  assert.match(actionsSource, /getNextZoom\(oldScale,\s*factor\s*>=\s*1\s*\?\s*1\s*:\s*-1\)/, 'zoom controls must use directional getNextZoom calls (in actions helper)');
});

test('editor layout switching fits the tree instead of centering selected node by default', () => {
  const canvas = read('js/editor/editor-canvas.js');
  const transition = read('js/editor/editor-canvas-layout-transition.js');

  assert.match(canvas, /function\s+fitViewportToTree\s*\(/, 'canvas must expose a layout-switch tree-fit helper');
  // After delegation to layoutModeSwitcher, switchToFreeMode/switchToStructuredMode delegate to factory
  assert.match(canvas, /layoutModeSwitcher\.switchToFreeMode\(\)/, 'switchToFreeMode must delegate to layoutModeSwitcher');
  assert.match(canvas, /layoutModeSwitcher\.switchToStructuredMode\(\)/, 'switchToStructuredMode must delegate to layoutModeSwitcher');
  // The factory ensures fitViewportToTree runs before applyLayoutModeClasses
  assert.match(transition, /fitViewportToTree[^)]*\)[\s\S]*applyLayoutModeClasses/, 'factory must fit the tree before applying layout classes');
  assert.doesNotMatch(canvas, /function\s+centerViewportOnSelection\s*\(/, 'layout switching must not use selected-node centering by default');
});

test('editor canvas persists scale and keeps node dragging scale-aware', () => {
  const canvas = read('js/editor/editor-canvas.js');
  const layout = read('js/editor/editor-canvas-layout.js');
  const interaction = read('js/editor/editor-canvas-interaction.js');
  const canvasNode = read('js/editor/editor-canvas-node.js');
  const canvasUtils = read('js/editor/editor-canvas-utils.js');

  assert.match(
    canvas,
    /scale:\s*useStoredViewport\s*\?\s*storedLayout\.scale \|\| 1\s*:\s*1|scale:\s*storedLayout\.scale \|\| 1/,
    'canvas state must initialize viewport scale from stored layout when policy allows'
  );
  assert.match(canvas, /utils\.calcPosition\(mem/, 'canvas must delegate position calculation to utils');
  assert.match(canvasUtils, /projectWorldPosition\(world,\s*viewportState\)/, 'calc position must render through viewport projection');
  assert.match(canvasNode, /nodeEl\.style\.transform = 'scale\(/ , 'node cards must visually scale with viewport (delegated to canvas-node)');
  assert.match(canvas, /function\s+zoomBy\s*\(factor\)/, 'canvas must expose zoom action');
  assert.match(canvas, /persistStoredPositions\(\)/, 'viewport control changes must persist safely');
  assert.match(layout, /scale:\s*typeof parsed\.scale === 'number' \? parsed\.scale : 1/, 'layout store must read persisted scale defensively');
  assert.match(layout, /scale:\s*viewportState\.scale \|\| 1/, 'layout store must persist viewport scale');
  assert.match(interaction, /dx \/ scale/, 'primary node drag must account for zoom scale');
});

test('editor viewport controls stay scoped away from branch slot implementation', () => {
  const html = read('pages/editor.html');
  const canvas = read('js/editor/editor-canvas.js');
  const viewport = read('js/editor/editor-canvas-viewport.js');

  assert.doesNotMatch(`${html}\n${canvas}\n${viewport}`, /branch slot|branchSlot|slot affordance/i);
});
