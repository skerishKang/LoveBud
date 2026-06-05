const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose canvas empty guide updater factory', () => {
  assert.match(shellHelpersSource, /createEditorCanvasEmptyGuideUpdater:\s*function\(options\)/);
  assert.match(shellHelpersSource, /emptyGuideUIHelper\.createCanvasEmptyGuideUpdater/);
});

test('canvas empty guide updater preserves helper call', () => {
  assert.match(shellHelpersSource, /return emptyGuideUIHelper\.createCanvasEmptyGuideUpdater\(\{/);
  assert.match(shellHelpersSource, /getTreeMemories:\s*getTreeMemories/);
  assert.match(shellHelpersSource, /log:\s*log/);
});

test('canvas empty guide updater preserves warning fallback', () => {
  assert.match(shellHelpersSource, /return function updateCanvasEmptyGuide\(\)/);
  assert.match(shellHelpersSource, /WARNING: LoveBudEditorEmptyGuideUI\.createCanvasEmptyGuideUpdater missing/);
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
