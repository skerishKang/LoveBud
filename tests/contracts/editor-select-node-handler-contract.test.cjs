const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellCanvasUISource = fs.readFileSync('js/editor/editor-shell-canvas-ui.js', 'utf8');

test('canvas ui fix editor shell helpers expose select node handler factory', () => {
  assert.match(shellCanvasUISource, /createEditorSelectNodeHandler:\s*function\(options\)/);
  assert.match(shellCanvasUISource, /return function selectNode\(el,\s*data\)/);
  assert.match(shellCanvasUISource, /if \(!data\) return;/);
});

test('canvas ui fix select node handler preserves state update callbacks', () => {
  assert.match(shellCanvasUISource, /setSelectedNodeId\(data\.id\)/);
  assert.match(shellCanvasUISource, /setCurrentEditingMemory\(data\)/);
});

test('canvas ui fix select node handler preserves delegated UI and save-status flow', () => {
  assert.match(shellCanvasUISource, /editorSelectionUI\.applySelectedMemoryNode\(el\)/);
  assert.match(shellCanvasUISource, /LoveBudEditorSelectionUI\.applySelectedMemoryNode missing/);
  assert.match(shellCanvasUISource, /editorSaveStatus\.hideSaveStatusIndicator\(getSaveStatusData\(\)\)/);
  assert.match(shellCanvasUISource, /updateDetailPanel\(data\)/);
  assert.match(shellCanvasUISource, /updateFocusSelectedBtn\(\)/);
  assert.match(shellCanvasUISource, /setDetailEmptyState\(false\)/);
});

test('canvas ui fix select node handler preserves canvas affordance refresh guard', () => {
  assert.match(shellCanvasUISource, /var editorCanvas\s*=\s*getEditorCanvas\(\)/);
  assert.match(shellCanvasUISource, /editorCanvas && typeof editorCanvas\.updateAffordance === 'function'/);
  assert.match(shellCanvasUISource, /editorCanvas\.updateAffordance\(\)/);
});

test('editor entrypoint delegates selectNode construction to shell helper', () => {
  assert.match(editorSource, /const createEditorSelectNodeHandler\s*=\s*deps\.shellHelpers\.createEditorSelectNodeHandler/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorSelectNodeHandler missing/);
  assert.match(editorSource, /const selectNode\s*=\s*createEditorSelectNodeHandler\(\{/);
  assert.match(editorSource, /getEditorCanvas:\s*\(\)\s*=>\s*editorCanvas/);
  assert.match(editorSource, /getSaveStatusData:\s*\(\)\s*=>\s*saveStatusData/);
  assert.match(editorSource, /setSelectedNodeId:\s*\(value\)\s*=>\s*\{\s*selectedNodeId\s*=\s*value;\s*\}/);
  assert.match(editorSource, /setCurrentEditingMemory:\s*\(value\)\s*=>\s*\{\s*currentEditingMemory\s*=\s*value;\s*\}/);
});

test('editor no longer owns inline selectNode body', () => {
  assert.doesNotMatch(editorSource, /const selectNode\s*=\s*\(el,\s*data\)\s*=>\s*\{/);
  assert.doesNotMatch(editorSource, /selectedNodeId\s*=\s*data\.id;\s*\n\s*currentEditingMemory\s*=\s*data;/);
});

test('select node handler slice avoids canvas runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
