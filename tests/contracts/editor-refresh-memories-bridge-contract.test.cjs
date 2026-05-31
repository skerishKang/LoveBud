const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const refreshSaveRuntimeSource = fs.readFileSync('js/editor/editor-refresh-save-runtime.js', 'utf8');

test('editor shell helpers expose refresh memories bridge helper', () => {
  assert.match(shellHelpersSource, /exposeRefreshMemoriesBridge:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var windowRef\s*=\s*opts\.windowRef\s*\|\|\s*window/);
  assert.match(shellHelpersSource, /var refreshMemories\s*=\s*opts\.refreshMemories/);
  assert.match(shellHelpersSource, /windowRef\.refreshMemories\s*=\s*refreshMemories/);
  assert.match(shellHelpersSource, /return windowRef/);
});

test('refresh memories bridge helper keeps testable window hook', () => {
  assert.match(shellHelpersSource, /opts\.windowRef/);
  assert.match(shellHelpersSource, /opts\.refreshMemories/);
});

test('editor delegates refresh memories bridge through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+exposeRefreshMemoriesBridge\s*=\s*shellHelpers\.exposeRefreshMemoriesBridge/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+exposeRefreshMemoriesBridge\s*=\s*shellHelpers\.exposeRefreshMemoriesBridge\s*\|\|/
  );
  assert.match(refreshSaveRuntimeSource, /LoveBudEditorShellHelpers\.exposeRefreshMemoriesBridge missing/);
  assert.match(
    refreshSaveRuntimeSource,
    /exposeRefreshMemoriesBridge\(\{\s*refreshMemories\s*\}\)/
  );
});

test('refresh save runtime assigns refresh memories bridge without inline window mutation', () => {
  const start = refreshSaveRuntimeSource.indexOf('const refreshMemories = editorDataLoader.createRefreshMemories');
  assert.notEqual(start, -1, 'refreshMemories creation must exist');

  const end = refreshSaveRuntimeSource.indexOf('const formatTimeAgo =', start);
  assert.notEqual(end, -1, 'formatTimeAgo setup must follow refresh bridge setup');

  const block = refreshSaveRuntimeSource.slice(start, end);
  assert.match(block, /exposeRefreshMemoriesBridge\(\{\s*refreshMemories\s*\}\)/);
  assert.doesNotMatch(block, /window\.refreshMemories\s*=\s*refreshMemories/);
  assert.doesNotMatch(block, /windowRef\.refreshMemories\s*=/);
  assert.doesNotMatch(editorSource, /const\s+refreshMemories\s*=\s*editorDataLoader\.createRefreshMemories/);
});

test('refresh save runtime keeps refresh memories factory invocation intact', () => {
  assert.match(refreshSaveRuntimeSource, /typeof editorDataLoader\.createRefreshMemories !== 'function'/);
  assert.match(refreshSaveRuntimeSource, /LoveBudEditorDataLoader\.createRefreshMemories missing/);
  assert.match(
    refreshSaveRuntimeSource,
    /const refreshMemories\s*=\s*editorDataLoader\.createRefreshMemories\(\{\s*treeId,\s*apiClient,\s*normalizeMemory,\s*onMemoriesUpdated:\s*handleMemoriesUpdated\s*\}\)/
  );
});

test('refresh save runtime keeps handleMemoriesUpdated orchestration intact', () => {
  const start = refreshSaveRuntimeSource.indexOf('const handleMemoriesUpdated =');
  assert.notEqual(start, -1, 'handleMemoriesUpdated must exist');

  const end = refreshSaveRuntimeSource.indexOf('const refreshMemories = editorDataLoader.createRefreshMemories', start);
  assert.notEqual(end, -1, 'refresh factory guard must follow handleMemoriesUpdated');

  const block = refreshSaveRuntimeSource.slice(start, end);
  assert.match(block, /log\('Memories updated externally\. Rerendering\.\.\.'\)/);
  assert.match(block, /initCanvas\(\)/);
  assert.match(block, /updateSidebarStatus\(\)/);
  assert.match(block, /setCurrentEditingMemory\(refreshedEditingMemory\)/);
  assert.match(block, /updateDetailPanel\(refreshedEditingMemory\)/);
});

test('refresh save runtime guards missing refresh memories bridge before exposure', () => {
  const guardIndex = refreshSaveRuntimeSource.indexOf('LoveBudEditorShellHelpers.exposeRefreshMemoriesBridge missing');
  const exposeIndex = refreshSaveRuntimeSource.indexOf('exposeRefreshMemoriesBridge({ refreshMemories });');

  assert.ok(guardIndex !== -1, 'missing refresh memories bridge guard must exist');
  assert.ok(exposeIndex !== -1, 'refresh memories bridge exposure must exist');
  assert.ok(guardIndex < exposeIndex, 'guard must run before refresh memories bridge exposure');
});
