const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor guards missing canvas empty guide updater factory', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorCanvasEmptyGuideUpdater missing/);
});

test('editor delegates canvas empty guide updater creation to shell helper', () => {
  assert.match(editorSource, /const updateCanvasEmptyGuide\s*=\s*createEditorCanvasEmptyGuideUpdater\(\{/);
  assert.match(editorSource, /emptyGuideUIHelper/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
});

test('editor canvas empty guide updater block follows empty guide UI helper and precedes selectNode', () => {
  const guideHelperIndex = editorSource.indexOf('const emptyGuideUIHelper');
  assert.ok(guideHelperIndex !== -1, 'emptyGuideUIHelper must exist');

  const updaterCreateIndex = editorSource.indexOf('const updateCanvasEmptyGuide = createEditorCanvasEmptyGuideUpdater({');
  assert.ok(updaterCreateIndex !== -1, 'updater creation must exist');
  assert.ok(guideHelperIndex < updaterCreateIndex, 'updater creation must follow empty guide UI helper');

  const exposeIndex = editorSource.indexOf('exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide })');
  assert.ok(exposeIndex !== -1, 'exposeCanvasEmptyGuideUpdater call must exist');

  const selectNodeIndex = editorSource.indexOf('const selectNode =', exposeIndex);
  assert.ok(selectNodeIndex !== -1, 'selectNode must follow empty guide bridge setup');
  assert.ok(exposeIndex < selectNodeIndex, 'bridge exposure must precede selectNode');
});

test('editor empty guide updater block delegates bridge exposure via helper', () => {
  const start = editorSource.indexOf('const updateCanvasEmptyGuide = createEditorCanvasEmptyGuideUpdater({');
  assert.ok(start !== -1, 'must find updater creation');

  const end = editorSource.indexOf('const selectNode =', start);
  assert.ok(end !== -1, 'selectNode must follow empty guide bridge setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}/);
});

test('editor delegates missing canvas empty guide bridge guard before exposure', () => {
  const checkerIndex = editorSource.indexOf('checkEditorCanvasEmptyGuideBridgeDependencies');
  const exposeIndex = editorSource.indexOf('exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });');

  assert.ok(checkerIndex !== -1, 'canvas empty guide bridge dependency checker must exist');
  assert.ok(exposeIndex !== -1, 'canvas empty guide bridge exposure must exist');
  assert.ok(checkerIndex < exposeIndex, 'dependency checker must run before canvas empty guide bridge exposure');

  assert.match(editorSource, /LoveBudEditorShellHelpers\.exposeCanvasEmptyGuideUpdater missing/);
});

test('editor keeps empty guide updater creation and finalCanvasInit call intact', () => {
  assert.match(editorSource, /createEditorCanvasEmptyGuideUpdater\(/);
  assert.match(editorSource, /updateCanvasEmptyGuide\(\)/);
});
