const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates memory provider dependency checks before provider construction', () => {
  assert.match(
    editorSource,
    /const checkEditorMemoryProviderDependencies\s*=\s*createEditorStartDependencyChecker\(\{/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorMemoryProviderDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorMemoryProviderDependencies');
  const initialProviderIndex = editorSource.indexOf('const createInitialMemory = createEditorInitialMemoryProvider({');
  const nextProviderIndex = editorSource.indexOf('const nextMemoryId = createEditorNextMemoryIdProvider({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(initialProviderIndex, -1);
  assert.notEqual(nextProviderIndex, -1);
  assert.ok(checkerIndex < initialProviderIndex);
  assert.ok(checkerIndex < nextProviderIndex);
});

test('editor preserves memory provider dependency messages inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorTreeHelpers\.createInitialMemory missing/);
  assert.match(editorSource, /LoveBudEditorTreeHelpers\.nextMemoryIdFromMemories missing/);
});

test('editor no longer owns inline memory provider dependency checks', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(editorTreeHelpers\.createInitialMemory, 'LoveBudEditorTreeHelpers\.createInitialMemory missing'\)\) return;/
  );
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(nextMemoryIdFromMemories, 'LoveBudEditorTreeHelpers\.nextMemoryIdFromMemories missing'\)\) return;/
  );
});

test('memory provider dependency delegation preserves provider construction paths', () => {
  assert.match(editorSource, /const createInitialMemory\s*=\s*createEditorInitialMemoryProvider\(\{/);
  assert.match(editorSource, /editorTreeHelpers,\s*getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\),\s*findRootMemory,\s*canonicalRootId,\s*treeId,\s*i18n/s);

  assert.match(editorSource, /const nextMemoryId\s*=\s*createEditorNextMemoryIdProvider\(\{/);
  assert.match(editorSource, /nextMemoryIdFromMemories,\s*getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/s);
});

test('memory provider dependency slice leaves readiness wrapper and runtime boundaries intact', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createMemoryActionsReadinessWrapper missing/);
  assert.match(editorSource, /checkEditorMemoryActionsReadinessDependencies\(\)/);
  assert.match(editorSource, /createMemoryActionsReadinessWrapper\(\{\s*getMemoryActions:\s*\(\)\s*=>\s*memoryActions\s*\}\)/s);
  assert.match(editorSource, /runEditorInitialLoadFlow\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
