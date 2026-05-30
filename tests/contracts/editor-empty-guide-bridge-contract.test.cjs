const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose canvas empty guide bridge helper', () => {
  assert.match(shellHelpersSource, /exposeCanvasEmptyGuideUpdater:\s*function\(options\)/);
  assert.match(shellHelpersSource, /window\.LoveBudEditor\s*=\s*window\.LoveBudEditor\s*\|\|\s*\{\}/);
  assert.match(shellHelpersSource, /editorNamespace\.updateCanvasEmptyGuide\s*=\s*updateCanvasEmptyGuide/);
  assert.match(shellHelpersSource, /return editorNamespace/);
});

test('canvas empty guide bridge helper keeps testable namespace hook', () => {
  assert.match(shellHelpersSource, /opts\.editorNamespace/);
  assert.match(shellHelpersSource, /opts\.updateCanvasEmptyGuide/);
});

test('editor delegates canvas empty guide bridge with fallback', () => {
  assert.match(editorSource, /shellHelpers\.exposeCanvasEmptyGuideUpdater/);
  assert.match(editorSource, /const exposeCanvasEmptyGuideUpdater\s*=/);
  assert.match(editorSource, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}\)/);
  assert.match(editorSource, /editorNamespace\.updateCanvasEmptyGuide\s*=\s*opts\.updateCanvasEmptyGuide/);
});

test('editor no longer assigns canvas empty guide bridge inline', () => {
  const start = editorSource.indexOf('const updateCanvasEmptyGuide =');
  assert.notEqual(start, -1, 'updateCanvasEmptyGuide setup must exist');

  const end = editorSource.indexOf('const selectNode =', start);
  assert.notEqual(end, -1, 'selectNode must follow empty guide bridge setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}\)/);
  assert.doesNotMatch(block, /window\.LoveBudEditor\.updateCanvasEmptyGuide\s*=\s*updateCanvasEmptyGuide/);
});

test('editor keeps empty guide updater creation and event binding intact', () => {
  assert.match(editorSource, /emptyGuideUIHelper\.createCanvasEmptyGuideUpdater/);
  assert.match(editorSource, /bindEditorPageEvents/);
  assert.match(editorSource, /updateCanvasEmptyGuide\(\)/);
});

test('editor detail panel bridge is delegated to required shell helper in this slice', () => {
  assert.match(editorSource, /exposeDetailPanelUpdater\(\{\s*updateDetailPanel\s*\}/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.exposeDetailPanelUpdater missing/);
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
