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

test('editor delegates canvas empty guide bridge through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+exposeCanvasEmptyGuideUpdater\s*=\s*shellHelpers\.exposeCanvasEmptyGuideUpdater/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+exposeCanvasEmptyGuideUpdater\s*=\s*shellHelpers\.exposeCanvasEmptyGuideUpdater\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.exposeCanvasEmptyGuideUpdater missing/
  );
  assert.match(
    editorSource,
    /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}\)/
  );
});

test('editor no longer assigns canvas empty guide bridge inline', () => {
  const start = editorSource.indexOf('const updateCanvasEmptyGuide =');
  assert.notEqual(start, -1, 'updateCanvasEmptyGuide setup must exist');

  const end = editorSource.indexOf('const selectNode =', start);
  assert.notEqual(end, -1, 'selectNode must follow empty guide bridge setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}/);
  assert.doesNotMatch(block, /window\.LoveBudEditor\.updateCanvasEmptyGuide\s*=\s*updateCanvasEmptyGuide/);
  assert.doesNotMatch(block, /editorNamespace\.updateCanvasEmptyGuide\s*=/);
});

test('editor guards missing canvas empty guide bridge before exposure', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.exposeCanvasEmptyGuideUpdater missing');
  const exposeIndex = editorSource.indexOf('exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });');

  assert.ok(guardIndex !== -1, 'missing canvas empty guide bridge guard must exist');
  assert.ok(exposeIndex !== -1, 'canvas empty guide bridge exposure must exist');
  assert.ok(guardIndex < exposeIndex, 'guard must run before canvas empty guide bridge exposure');
});

test('editor keeps empty guide updater creation and event binding intact', () => {
  assert.match(editorSource, /createEditorCanvasEmptyGuideUpdater\(/);
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
