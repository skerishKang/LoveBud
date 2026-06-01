const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates detail panel exposure dependency check before exposure call', () => {
  assert.match(
    editorSource,
    /const checkEditorDetailPanelExposureDependencies\s*=\s*createEditorStartDependencyChecker\(/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorDetailPanelExposureDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorDetailPanelExposureDependencies');
  const exposeIndex = editorSource.indexOf('exposeDetailPanelUpdater({ updateDetailPanel });');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(exposeIndex, -1);
  assert.ok(checkerIndex < exposeIndex);
});

test('editor preserves detail panel exposure dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.exposeDetailPanelUpdater missing/);
});

test('editor no longer owns inline detail panel exposure dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(exposeDetailPanelUpdater, 'LoveBudEditorShellHelpers\.exposeDetailPanelUpdater missing'\)\) return;/
  );
});

test('detail panel exposure dependency delegation preserves detail UI construction path', () => {
  assert.match(editorSource, /const detailUI\s*=\s*window\.createEditorDetailUI\(\{/);
  assert.match(
    editorSource,
    /const \{ setDetailEmptyState, updateFocusSelectedBtn, updateSidebarStatus: updateSidebarStatusBase, updateDetailPanel \}\s*=\s*detailUI;/
  );
  assert.match(editorSource, /exposeDetailPanelUpdater\(\{ updateDetailPanel \}\);/);
});

test('detail panel exposure dependency slice leaves sidebar and event binding boundaries intact', () => {
  assert.match(editorSource, /checkEditorSidebarTreeActionsDependencies\(\)/);
  assert.match(editorSource, /const updateSidebarTreeActions\s*=\s*createSidebarTreeActionsUpdater\(/);
  assert.match(
    editorSource,
    /ensureStartEditorDependency\(getHttpStatus, 'LoveBudEditorShellHelpers\.getHttpStatus missing'\)/
  );
  assert.match(editorSource, /bindEditorPageEvents\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
