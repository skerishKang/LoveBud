const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates selected moment focus dependency check before focus handler creation', () => {
  assert.match(
    editorSource,
    /const checkEditorSelectedMomentFocusDependencies\s*=\s*createEditorStartDependencyChecker\(/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorSelectedMomentFocusDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorSelectedMomentFocusDependencies');
  const createIndex = editorSource.indexOf('const focusSelectedMoment = createSelectedMomentFocusHandler({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(createIndex, -1);
  assert.ok(checkerIndex < createIndex);
});

test('editor preserves selected moment focus dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createSelectedMomentFocusHandler missing/);
});

test('editor no longer owns inline selected moment focus dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createSelectedMomentFocusHandler, 'LoveBudEditorShellHelpers\.createSelectedMomentFocusHandler missing'\)\) return;/
  );
});

test('selected moment focus dependency delegation preserves focus handler construction path', () => {
  assert.match(editorSource, /const selectNode\s*=\s*createEditorSelectNodeHandler\(/);
  assert.match(editorSource, /const focusSelectedMoment\s*=\s*createSelectedMomentFocusHandler\(/);
  assert.match(editorSource, /getEditorCanvas:\s*\(\)\s*=>\s*editorCanvas/);
  assert.match(editorSource, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
});

test('selected moment focus dependency slice leaves detail opener and sidebar guards intact', () => {
  assert.match(
    editorSource,
    /ensureStartEditorDependency\(createCurrentMomentDetailOpener, 'LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing'\)/
  );
  assert.match(
    editorSource,
    /ensureStartEditorDependency\(createSidebarTreeActionsUpdater, 'LoveBudEditorShellHelpers\.createSidebarTreeActionsUpdater missing'\)/
  );
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
