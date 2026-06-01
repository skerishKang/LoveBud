const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose select node handler factory', () => {
  assert.match(shellHelpersSource, /createEditorSelectNodeHandler:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function selectNode\(el,\s*data\)/);
  assert.match(shellHelpersSource, /if \(!data\) return;/);
});

test('select node handler preserves state update callbacks', () => {
  assert.match(shellHelpersSource, /setSelectedNodeId\(data\.id\)/);
  assert.match(shellHelpersSource, /setCurrentEditingMemory\(data\)/);
});

test('select node handler preserves delegated UI and save-status flow', () => {
  assert.match(shellHelpersSource, /editorSelectionUI\.applySelectedMemoryNode\(el\)/);
  assert.match(shellHelpersSource, /LoveBudEditorSelectionUI\.applySelectedMemoryNode missing/);
  assert.match(shellHelpersSource, /editorSaveStatus\.hideSaveStatusIndicator\(getSaveStatusData\(\)\)/);
  assert.match(shellHelpersSource, /updateDetailPanel\(data\)/);
  assert.match(shellHelpersSource, /updateFocusSelectedBtn\(\)/);
  assert.match(shellHelpersSource, /setDetailEmptyState\(false\)/);
});

test('select node handler preserves canvas affordance refresh guard', () => {
  assert.match(shellHelpersSource, /var editorCanvas\s*=\s*getEditorCanvas\(\)/);
  assert.match(shellHelpersSource, /editorCanvas && typeof editorCanvas\.updateAffordance === 'function'/);
  assert.match(shellHelpersSource, /editorCanvas\.updateAffordance\(\)/);
});

test('editor entrypoint delegates selectNode construction to shell helper', () => {
  assert.match(editorSource, /const createEditorSelectNodeHandler\s*=\s*shellHelpers\.createEditorSelectNodeHandler/);
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
