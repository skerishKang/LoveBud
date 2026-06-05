const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellCanvasUISource = fs.readFileSync('js/editor/editor-shell-canvas-ui.js', 'utf8');

test('canvas ui fix editor shell helpers expose sidebar status updater factory', () => {
  assert.match(shellCanvasUISource, /createEditorSidebarStatusUpdater:\s*function\(options\)/);
  assert.match(shellCanvasUISource, /return function updateSidebarStatus\(\)/);
});

test('canvas ui fix sidebar status updater preserves call order', () => {
  const start = shellCanvasUISource.indexOf('createEditorSidebarStatusUpdater: function(options)');
  assert.notEqual(start, -1, 'sidebar status updater factory must exist');

  const end = shellCanvasUISource.indexOf('    },', shellCanvasUISource.indexOf('return function updateSidebarStatus()', start));
  assert.notEqual(end, -1, 'sidebar status updater factory must close');

  const block = shellCanvasUISource.slice(start, end);
  const baseIndex = block.indexOf('updateSidebarStatusBase();');
  const guideIndex = block.indexOf('updateCanvasEmptyGuide();');
  const actionsIndex = block.indexOf('updateSidebarTreeActions();');

  assert.ok(baseIndex !== -1, 'must call updateSidebarStatusBase');
  assert.ok(guideIndex !== -1, 'must call updateCanvasEmptyGuide');
  assert.ok(actionsIndex !== -1, 'must call updateSidebarTreeActions');
  assert.ok(baseIndex < guideIndex, 'base status must update before empty guide');
  assert.ok(guideIndex < actionsIndex, 'empty guide must update before sidebar actions');
});

test('editor entrypoint delegates sidebar status updater construction to shell helper', () => {
  assert.match(editorSource, /const createEditorSidebarStatusUpdater\s*=\s*deps\.shellHelpers\.createEditorSidebarStatusUpdater/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorSidebarStatusUpdater missing/);
  assert.match(editorSource, /const updateSidebarStatus\s*=\s*createEditorSidebarStatusUpdater\(\{/);
  assert.match(editorSource, /updateSidebarStatusBase,\s*updateCanvasEmptyGuide,\s*updateSidebarTreeActions/s);
});

test('editor no longer owns inline updateSidebarStatus wrapper body', () => {
  assert.doesNotMatch(
    editorSource,
    /const updateSidebarStatus\s*=\s*\(\)\s*=>\s*\{\s*updateSidebarStatusBase\(\);\s*updateCanvasEmptyGuide\(\);\s*updateSidebarTreeActions\(\);\s*\};/
  );
});

test('sidebar status updater slice avoids canvas runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
