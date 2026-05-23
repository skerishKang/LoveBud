const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('LoveBudEditorCanvasViewportFit namespace file exists', () => {
  const exists = fs.existsSync(path.join(ROOT, 'js/editor/editor-canvas-viewport-fit.js'));
  assert.ok(exists, 'editor-canvas-viewport-fit.js must exist');
});

test('LoveBudEditorCanvasViewportFit namespace is declared', () => {
  const src = read('js/editor/editor-canvas-viewport-fit.js');
  assert.match(src, /window\.LoveBudEditorCanvasViewportFit\s*=/, 'must declare window.LoveBudEditorCanvasViewportFit');
});

test('LoveBudEditorCanvasViewportFit exposes getReadableViewportOffset', () => {
  const src = read('js/editor/editor-canvas-viewport-fit.js');
  assert.match(src, /getReadableViewportOffset\s*\(/, 'must expose getReadableViewportOffset');
});

test('LoveBudEditorCanvasViewportFit exposes getFitViewport', () => {
  const src = read('js/editor/editor-canvas-viewport-fit.js');
  assert.match(src, /getFitViewport\s*\(/, 'must expose getFitViewport');
});

test('LoveBudEditorCanvasViewport.getReadableViewportOffset public wrapper preserved', () => {
  const src = read('js/editor/editor-canvas-viewport.js');
  assert.match(src, /getReadableViewportOffset\s*\(options,\s*preferredScale\s*=\s*1\)/, 'public wrapper signature must be preserved');
});

test('LoveBudEditorCanvasViewport.getFitViewport public wrapper preserved', () => {
  const src = read('js/editor/editor-canvas-viewport.js');
  assert.match(src, /getFitViewport\s*\(options\)/, 'public wrapper signature must be preserved');
});

test('LoveBudEditorCanvasViewport.getReadableViewportOffset delegates to fit helper', () => {
  const src = read('js/editor/editor-canvas-viewport.js');
  assert.match(
    src,
    /LoveBudEditorCanvasViewportFit.*getReadableViewportOffset/s,
    'getReadableViewportOffset must delegate to LoveBudEditorCanvasViewportFit'
  );
});

test('LoveBudEditorCanvasViewport.getFitViewport delegates to fit helper', () => {
  const src = read('js/editor/editor-canvas-viewport.js');
  assert.match(
    src,
    /LoveBudEditorCanvasViewportFit.*getFitViewport/s,
    'getFitViewport must delegate to LoveBudEditorCanvasViewportFit'
  );
});

test('editor-canvas-viewport-fit.js is loaded in editor.html after viewport.js and before viewport-branches.js', () => {
  const html = read('pages/editor.html');
  const scripts = Array.from(html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g)).map((m) => m[1]);
  const idxViewport = scripts.findIndex((s) => s.includes('editor-canvas-viewport.js'));
  const idxFit = scripts.findIndex((s) => s.includes('editor-canvas-viewport-fit.js'));
  const idxBranches = scripts.findIndex((s) => s.includes('editor-canvas-viewport-branches.js'));

  assert.notEqual(idxViewport, -1, 'editor-canvas-viewport.js must be in editor.html');
  assert.notEqual(idxFit, -1, 'editor-canvas-viewport-fit.js must be in editor.html');
  assert.notEqual(idxBranches, -1, 'editor-canvas-viewport-branches.js must be in editor.html');
  assert.ok(idxViewport < idxFit, 'editor-canvas-viewport.js must load before editor-canvas-viewport-fit.js');
  assert.ok(idxFit < idxBranches, 'editor-canvas-viewport-fit.js must load before editor-canvas-viewport-branches.js');
});

test('viewport fit helper does not move getViewportTargets', () => {
  const fitSrc = read('js/editor/editor-canvas-viewport-fit.js');
  assert.doesNotMatch(fitSrc, /getViewportTargets\s*\(/, 'getViewportTargets must NOT be defined in viewport-fit helper');
});

test('viewport fit helper does not move prepareInitialViewport', () => {
  const fitSrc = read('js/editor/editor-canvas-viewport-fit.js');
  assert.doesNotMatch(fitSrc, /prepareInitialViewport\s*\(/, 'prepareInitialViewport must NOT be in viewport-fit helper');
});

test('viewport fit helper does not contain zoom functions', () => {
  const fitSrc = read('js/editor/editor-canvas-viewport-fit.js');
  assert.doesNotMatch(fitSrc, /getNearestZoom\s*\(scale\)/, 'getNearestZoom must NOT be defined in viewport-fit helper');
  assert.doesNotMatch(fitSrc, /getNextZoom\s*\(/, 'getNextZoom must NOT be defined in viewport-fit helper');
});

test('viewport fit helper computation does not alter padding constants', () => {
  const fitSrc = read('js/editor/editor-canvas-viewport-fit.js');
  assert.match(fitSrc, /nodeBoundsPadding\s*=\s*180/, 'nodeBoundsPadding must remain 180');
  assert.match(fitSrc, /metrics\.width\s*\*\s*0\.10/, 'padding ratio must remain 0.10');
});
