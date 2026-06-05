const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

function loadShellHelpers() {
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('editor shell helpers expose initial selection applier factory', () => {
  assert.match(shellHelpersSource, /createEditorInitialSelectionApplier:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function applyEditorInitialSelection\(\)/);
});

test('initial selection applier sets non-root selected memory and logs it', () => {
  const shellHelpers = loadShellHelpers();
  const applied = [];
  const logs = [];

  const applyEditorInitialSelection = shellHelpers.createEditorInitialSelectionApplier({
    getTreeMemories: () => [{ id: 'root' }, { id: 'm2' }],
    getSelectedNodeId: () => 'm2',
    createInitialMemory: () => ({ id: 'root' }),
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
    getCanonicalRootId: () => 'root',
    setCurrentEditingMemory: (value) => applied.push(value),
    log: (message) => logs.push(message)
  });

  const result = applyEditorInitialSelection();

  assert.deepEqual(result, { id: 'm2' });
  assert.deepEqual(applied, [{ id: 'm2' }]);
  assert.deepEqual(logs, ['Initial selection set: m2']);
});

test('initial selection applier does not set root memory', () => {
  const shellHelpers = loadShellHelpers();
  const applied = [];

  const applyEditorInitialSelection = shellHelpers.createEditorInitialSelectionApplier({
    getTreeMemories: () => [{ id: 'root' }],
    getSelectedNodeId: () => 'root',
    createInitialMemory: () => ({ id: 'root' }),
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
    getCanonicalRootId: () => 'root',
    setCurrentEditingMemory: (value) => applied.push(value),
    log: () => {}
  });

  const result = applyEditorInitialSelection();

  assert.deepEqual(result, { id: 'root' });
  assert.deepEqual(applied, []);
});

test('initial selection applier falls back to createInitialMemory when selected memory is missing', () => {
  const shellHelpers = loadShellHelpers();
  const applied = [];

  const applyEditorInitialSelection = shellHelpers.createEditorInitialSelectionApplier({
    getTreeMemories: () => [],
    getSelectedNodeId: () => 'missing',
    createInitialMemory: () => ({ id: 'root' }),
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
    getCanonicalRootId: () => 'root',
    setCurrentEditingMemory: (value) => applied.push(value),
    log: () => {}
  });

  const result = applyEditorInitialSelection();

  assert.deepEqual(result, { id: 'root' });
  assert.deepEqual(applied, []);
});

test('editor entrypoint delegates initial selection application to shell helper', () => {
  assert.match(editorSource, /const createEditorInitialSelectionApplier\s*=\s*deps\.shellHelpers\.createEditorInitialSelectionApplier/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorInitialSelectionApplier missing/);
  assert.match(editorSource, /const applyEditorInitialSelection\s*=\s*createEditorInitialSelectionApplier\(\{/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
  assert.match(editorSource, /setCurrentEditingMemory:\s*\(value\)\s*=>\s*\{\s*currentEditingMemory\s*=\s*value;\s*\}/);
  assert.match(editorSource, /applyEditorInitialSelection\(\);/);
});

test('editor no longer owns inline initial selection application block', () => {
  assert.doesNotMatch(
    editorSource,
    /const initialSelection\s*=\s*treeMemories\(\)\.find\(\(memory\)\s*=>\s*memory\.id\s*===\s*selectedNodeId\)\s*\|\|\s*createInitialMemory\(\)/
  );
  assert.doesNotMatch(
    editorSource,
    /currentEditingMemory\s*=\s*initialSelection/
  );
});

test('initial selection applier slice avoids canvas and refresh-save runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
});
