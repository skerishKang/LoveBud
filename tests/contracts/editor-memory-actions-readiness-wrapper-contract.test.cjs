const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellMemorySource = fs.readFileSync('js/editor/editor-shell-memory.js', 'utf8');

test('memory fix editor shell helpers expose memory actions readiness wrapper factory', () => {
  assert.match(shellMemorySource, /createMemoryActionsReadinessWrapper:\s*function\(options\)/);
  assert.match(shellMemorySource, /var getMemoryActions\s*=\s*opts\.getMemoryActions/);
  assert.match(shellMemorySource, /var consoleRef\s*=\s*opts\.consoleRef\s*\|\|\s*console/);
  assert.match(shellMemorySource, /return async function updateSelectedMemoryFields\(\)/);
});

test('memory fix memory actions readiness wrapper preserves guard warning and false return', () => {
  assert.match(shellMemorySource, /var memoryActions\s*=\s*getMemoryActions\(\)/);
  assert.match(shellMemorySource, /typeof memoryActions\.updateSelectedMemoryFields !== 'function'/);
  assert.match(shellMemorySource, /consoleRef\.warn\('\[editor\] updateSelectedMemoryFields called before memory actions are ready'\)/);
  assert.match(shellMemorySource, /return false/);
});

test('memory fix memory actions readiness wrapper preserves argument forwarding', () => {
  assert.match(shellMemorySource, /Array\.prototype\.slice\.call\(arguments\)/);
  assert.match(shellMemorySource, /memoryActions\.updateSelectedMemoryFields\.apply\(memoryActions,\s*args\)/);
});

test('editor delegates memory actions readiness wrapper through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+createMemoryActionsReadinessWrapper\s*=\s*deps\.createMemoryActionsReadinessWrapper/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createMemoryActionsReadinessWrapper\s*=\s*deps\.createMemoryActionsReadinessWrapper\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createMemoryActionsReadinessWrapper missing/
  );
  assert.match(
    editorSource,
    /const\s+updateSelectedMemoryFields\s*=\s*createMemoryActionsReadinessWrapper\(\{/
  );
  assert.match(
    editorSource,
    /getMemoryActions:\s*\(\)\s*=>\s*memoryActions/
  );
});

test('editor no longer owns inline memory actions readiness wrapper near memoryActions declaration', () => {
  const start = editorSource.indexOf('let memoryActions = null;');
  assert.notEqual(start, -1, 'memoryActions declaration must exist');

  const end = editorSource.indexOf("checkEditorMemoryProviderDependencies", start);
  assert.notEqual(end, -1, 'memory provider dependency checker must follow memory actions readiness setup');

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
  assert.match(editorSource, /const \{\s*enterEditMode,\s*exitEditMode,\s*saveMemoryEdit,\s*deleteMemory(?:\s*,\s*disconnectMemory)?(?:\s*,\s*connectMemory)?\s*\}\s*=\s*memoryActions/);
});

test('editor delegates missing memory actions readiness wrapper guard before creation', () => {
  const checkerIndex = editorSource.indexOf('checkEditorMemoryActionsReadinessDependencies');
  const createIndex = editorSource.indexOf('const updateSelectedMemoryFields = createMemoryActionsReadinessWrapper({');

  assert.ok(checkerIndex !== -1, 'memory actions readiness dependency checker must exist');
  assert.ok(createIndex !== -1, 'updateSelectedMemoryFields creation must exist');
  assert.ok(checkerIndex < createIndex, 'dependency checker must run before updateSelectedMemoryFields creation');

  assert.match(editorSource, /LoveBudEditorShellHelpers\.createMemoryActionsReadinessWrapper missing/);
});
