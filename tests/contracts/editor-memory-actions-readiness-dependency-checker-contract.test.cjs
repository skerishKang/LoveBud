const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates memory actions readiness dependency check before wrapper creation', () => {
  assert.match(
    editorSource,
    /const checkEditorMemoryActionsReadinessDependencies\s*=\s*createEditorStartDependencyChecker\(\{/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorMemoryActionsReadinessDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorMemoryActionsReadinessDependencies');
  const createIndex = editorSource.indexOf('const updateSelectedMemoryFields = createMemoryActionsReadinessWrapper({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(createIndex, -1);
  assert.ok(checkerIndex < createIndex);
});

test('editor preserves memory actions readiness dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createMemoryActionsReadinessWrapper missing/);
});

test('editor no longer owns inline memory actions readiness dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createMemoryActionsReadinessWrapper, 'LoveBudEditorShellHelpers\.createMemoryActionsReadinessWrapper missing'\)\) return;/
  );
});

test('memory actions readiness dependency delegation preserves wrapper construction path', () => {
  assert.match(editorSource, /let memoryActions\s*=\s*null;/);
  assert.match(editorSource, /const updateSelectedMemoryFields\s*=\s*createMemoryActionsReadinessWrapper\(\{/);
  assert.match(editorSource, /getMemoryActions:\s*\(\)\s*=>\s*memoryActions/);
});

test('memory actions readiness dependency slice leaves provider and runtime boundaries intact', () => {
  assert.match(editorSource, /checkEditorMemoryProviderDependencies\(\)/);
  assert.match(editorSource, /createEditorInitialMemoryProvider\(\{/);
  assert.match(editorSource, /createEditorNextMemoryIdProvider\(\{/);
  assert.match(editorSource, /runEditorInitialLoadFlow\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
