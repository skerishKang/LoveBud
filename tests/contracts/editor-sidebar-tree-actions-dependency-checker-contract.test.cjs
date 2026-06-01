const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates sidebar tree actions dependency check before updater creation', () => {
  assert.match(
    editorSource,
    /const checkEditorSidebarTreeActionsDependencies\s*=\s*createEditorStartDependencyChecker\(/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorSidebarTreeActionsDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorSidebarTreeActionsDependencies');
  const createIndex = editorSource.indexOf('const updateSidebarTreeActions = createSidebarTreeActionsUpdater({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(createIndex, -1);
  assert.ok(checkerIndex < createIndex);
});

test('editor preserves sidebar tree actions dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createSidebarTreeActionsUpdater missing/);
});

test('editor no longer owns inline sidebar tree actions dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createSidebarTreeActionsUpdater, 'LoveBudEditorShellHelpers\.createSidebarTreeActionsUpdater missing'\)\) return;/
  );
});

test('sidebar tree actions dependency delegation preserves updater construction path', () => {
  assert.match(editorSource, /const sidebarUIHelper\s*=\s*window\.LoveBudEditorSidebarUI\s*\|\|\s*\{\}/);
  assert.match(editorSource, /const updateSidebarTreeActions\s*=\s*createSidebarTreeActionsUpdater\(/);
  assert.match(editorSource, /sidebarUIHelper/);
  assert.match(editorSource, /i18n/);
  assert.match(editorSource, /safeI18nText/);
  assert.match(editorSource, /getTreeId:\s*\(\)\s*=>\s*treeId/);
});

test('sidebar tree actions dependency slice leaves upstream detail and downstream runtime boundaries intact', () => {
  assert.match(editorSource, /const updateTreeVisibility\s*=\s*editorTreeHelpers\.createTreeVisibilityUpdater\(/);
  assert.match(editorSource, /window\.createEditorDetailUI\(/);
  assert.match(editorSource, /exposeDetailPanelUpdater\(\{ updateDetailPanel \}\)/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
  assert.match(editorSource, /updateSidebarTreeActions/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
