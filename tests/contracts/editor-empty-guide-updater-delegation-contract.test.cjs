const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const emptyGuideSource = fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor empty guide ui exposes canvas empty guide updater helper', () => {
  assert.match(
    emptyGuideSource,
    /emptyGuideUI\.createCanvasEmptyGuideUpdater\s*=\s*function\(options\)/
  );
  assert.match(emptyGuideSource, /document\.getElementById\('canvasEmptyGuide'\)/);
  assert.match(emptyGuideSource, /editor-canvas-empty-guide-hidden/);
  assert.match(emptyGuideSource, /getTreeMemories/);
});

test('editor entrypoint delegates canvas empty guide updater to shell helper factory', () => {
  assert.match(editorSource, /const emptyGuideUIHelper\s*=\s*window\.LoveBudEditorEmptyGuideUI\s*\|\|\s*\{\}/);
  assert.match(editorSource, /createEditorCanvasEmptyGuideUpdater\(\{/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /log\s*\}/);
});

test('editor entrypoint no longer owns canvas empty guide dom toggle implementation', () => {
  assert.doesNotMatch(
    editorSource,
    /const guide\s*=\s*document\.getElementById\('canvasEmptyGuide'\)/
  );
  assert.doesNotMatch(
    editorSource,
    /guide\.classList\.toggle\('editor-canvas-empty-guide-hidden',\s*hasMoments\)/
  );
});

test('editor keeps global updateCanvasEmptyGuide bridge and call sites', () => {
  assert.match(editorSource, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}/);
  assert.match(editorSource, /updateCanvasEmptyGuide\(\);/);
  assert.match(editorSource, /updateSidebarStatus\(\);/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.exposeCanvasEmptyGuideUpdater missing/);
});

test('editor reuses one empty guide ui helper binding reference', () => {
  const helperDeclMatches = editorSource.match(/const emptyGuideUIHelper\s*=\s*window\.LoveBudEditorEmptyGuideUI\s*\|\|\s*\{\}/g) || [];
  assert.equal(helperDeclMatches.length, 1);
  assert.match(editorSource, /bindEditorPageEvents/);
});

test('editor-empty-guide-ui loads before editor entrypoint', () => {
  const emptyGuideIndex = editorHtml.indexOf('js/editor/editor-empty-guide-ui.js');
  const editorJsIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(emptyGuideIndex, -1, 'editor-empty-guide-ui.js must be loaded');
  assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
  assert.ok(emptyGuideIndex < editorJsIndex, 'empty guide UI helper must load before editor.js');
});
