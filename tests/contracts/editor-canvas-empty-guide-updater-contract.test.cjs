const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellCanvasUISource = fs.readFileSync('js/editor/editor-shell-canvas-ui.js', 'utf8');
const emptyGuideUISource = fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8');

test('canvas ui fix editor shell helpers expose canvas empty guide updater factory', () => {
  assert.match(shellCanvasUISource, /createEditorCanvasEmptyGuideUpdater:\s*function\(options\)/);
  assert.match(shellCanvasUISource, /emptyGuideUIHelper\.createCanvasEmptyGuideUpdater/);
});

test('canvas ui fix canvas empty guide updater preserves helper call', () => {
  assert.match(shellCanvasUISource, /return emptyGuideUIHelper\.createCanvasEmptyGuideUpdater\({/);
  assert.match(shellCanvasUISource, /getTreeMemories:\s*getTreeMemories/);
  assert.match(shellCanvasUISource, /log:\s*log/);
});

test('canvas empty guide updater counts only non-root moments as visible moments', () => {
  assert.match(emptyGuideUISource, /function isRootLikeMemory\(memory\)/);
  assert.match(emptyGuideUISource, /memory\.id === 'root'\s*\|\|\s*parentId === null\s*\|\|\s*parentId === undefined/);
  assert.match(emptyGuideUISource, /function hasVisibleMoment\(memories\)/);
  assert.match(emptyGuideUISource, /memories\.some\(\(memory\) => memory && !isRootLikeMemory\(memory\)\)/);
  assert.match(emptyGuideUISource, /const hasMoments = hasVisibleMoment\(memories\);/);
  assert.doesNotMatch(emptyGuideUISource, /const hasMoments = memories\.length > 0;/);
});

test('canvas ui fix canvas empty guide updater preserves warning fallback', () => {
  assert.match(shellCanvasUISource, /return function updateCanvasEmptyGuide\(\)/);
  assert.match(shellCanvasUISource, /WARNING: LoveBudEditorEmptyGuideUI\.createCanvasEmptyGuideUpdater missing/);
});

test('editor entrypoint delegates canvas empty guide updater construction to shell helper', () => {
  assert.match(editorSource, /const createEditorCanvasEmptyGuideUpdater\s*=\s*deps\.shellHelpers\.createEditorCanvasEmptyGuideUpdater/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorCanvasEmptyGuideUpdater missing/);
  assert.match(editorSource, /const updateCanvasEmptyGuide\s*=\s*createEditorCanvasEmptyGuideUpdater\(\{/);
  assert.match(editorSource, /emptyGuideUIHelper,\s*getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\),\s*log/s);
});

test('editor preserves canvas empty guide bridge exposure', () => {
  assert.match(editorSource, /exposeCanvasEmptyGuideUpdater\(\{ updateCanvasEmptyGuide \}\)/);
});

test('editor no longer owns inline canvas empty guide fallback body', () => {
  assert.doesNotMatch(editorSource, /const updateCanvasEmptyGuide\s*=\s*emptyGuideUIHelper\.createCanvasEmptyGuideUpdater/);
  assert.doesNotMatch(editorSource, /:\s*\(\)\s*=>\s*\{\s*log\('WARNING: LoveBudEditorEmptyGuideUI\.createCanvasEmptyGuideUpdater missing'\);\s*\}/);
});

test('canvas empty guide updater slice avoids canvas runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
