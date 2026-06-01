const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates current moment detail dependency check before opener creation', () => {
  assert.match(
    editorSource,
    /const checkEditorCurrentMomentDetailDependencies\s*=\s*createEditorStartDependencyChecker\(/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorCurrentMomentDetailDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorCurrentMomentDetailDependencies');
  const createIndex = editorSource.indexOf('const openCurrentMomentDetail = createCurrentMomentDetailOpener({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(createIndex, -1);
  assert.ok(checkerIndex < createIndex);
});

test('editor preserves current moment detail dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing/);
});

test('editor no longer owns inline current moment detail dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createCurrentMomentDetailOpener, 'LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing'\)\) return;/
  );
});

test('current moment detail dependency delegation preserves opener construction path', () => {
  assert.match(editorSource, /const focusSelectedMoment\s*=\s*createSelectedMomentFocusHandler\(/);
  assert.match(editorSource, /const openCurrentMomentDetail\s*=\s*createCurrentMomentDetailOpener\(/);
  assert.match(editorSource, /getCurrentEditingMemory:\s*\(\)\s*=>\s*currentEditingMemory/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
  assert.match(editorSource, /createInitialMemory/);
});

test('current moment detail dependency slice leaves sidebar guard and downstream detail UI intact', () => {
  assert.match(
    editorSource,
    /checkEditorSidebarTreeActionsDependencies\(\)/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createSidebarTreeActionsUpdater missing/
  );
  assert.match(editorSource, /const updateTreeVisibility\s*=\s*editorTreeHelpers\.createTreeVisibilityUpdater\(/);
  assert.match(editorSource, /window\.createEditorDetailUI\(/);
  assert.match(editorSource, /openCurrentMomentDetail/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
