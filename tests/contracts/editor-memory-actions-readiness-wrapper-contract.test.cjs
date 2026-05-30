const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose memory actions readiness wrapper factory', () => {
  assert.match(shellHelpersSource, /createMemoryActionsReadinessWrapper:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var getMemoryActions\s*=\s*opts\.getMemoryActions/);
  assert.match(shellHelpersSource, /var consoleRef\s*=\s*opts\.consoleRef\s*\|\|\s*console/);
  assert.match(shellHelpersSource, /return async function updateSelectedMemoryFields\(\)/);
});

test('memory actions readiness wrapper preserves guard warning and false return', () => {
  assert.match(shellHelpersSource, /var memoryActions\s*=\s*getMemoryActions\(\)/);
  assert.match(shellHelpersSource, /typeof memoryActions\.updateSelectedMemoryFields !== 'function'/);
  assert.match(shellHelpersSource, /consoleRef\.warn\('\[editor\] updateSelectedMemoryFields called before memory actions are ready'\)/);
  assert.match(shellHelpersSource, /return false/);
});

test('memory actions readiness wrapper preserves argument forwarding', () => {
  assert.match(shellHelpersSource, /Array\.prototype\.slice\.call\(arguments\)/);
  assert.match(shellHelpersSource, /memoryActions\.updateSelectedMemoryFields\.apply\(memoryActions,\s*args\)/);
});

test('editor delegates memory actions readiness wrapper with fallback', () => {
  assert.match(editorSource, /shellHelpers\.createMemoryActionsReadinessWrapper/);
  assert.match(editorSource, /const createMemoryActionsReadinessWrapper\s*=/);
  assert.match(editorSource, /const updateSelectedMemoryFields\s*=\s*createMemoryActionsReadinessWrapper\(\{/);
  assert.match(editorSource, /getMemoryActions:\s*\(\)\s*=>\s*memoryActions/);
});

test('editor no longer owns inline memory actions readiness wrapper near memoryActions declaration', () => {
  const start = editorSource.indexOf('let memoryActions = null;');
  assert.notEqual(start, -1, 'memoryActions declaration must exist');

  const end = editorSource.indexOf("if (typeof editorTreeHelpers.createInitialMemory !== 'function')", start);
  assert.notEqual(end, -1, 'createInitialMemory guard must follow memory actions readiness setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /createMemoryActionsReadinessWrapper\(\{/);
  assert.doesNotMatch(block, /const updateSelectedMemoryFields\s*=\s*async\s*\(\.\.\.args\)\s*=>/);
  assert.doesNotMatch(block, /console\.warn\('\[editor\] updateSelectedMemoryFields called before memory actions are ready'\)/);
  assert.doesNotMatch(block, /memoryActions\.updateSelectedMemoryFields\(\.\.\.args\)/);
});

test('editor keeps detail UI updateSelectedMemoryFields injection intact', () => {
  assert.match(editorSource, /window\.createEditorDetailUI\(\{/);
  assert.match(editorSource, /updateSelectedMemoryFields/);
});

test('editor keeps memory actions creation and assignment intact', () => {
  assert.match(editorSource, /memoryActions\s*=\s*window\.createEditorMemoryActions\(\{/);
  assert.match(editorSource, /const \{\s*enterEditMode,\s*exitEditMode,\s*saveMemoryEdit,\s*deleteMemory\s*\}\s*=\s*memoryActions/);
});
