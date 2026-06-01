const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates page event status dependency check before event binding', () => {
  assert.match(
    editorSource,
    /const checkEditorPageEventStatusDependencies\s*=\s*createEditorStartDependencyChecker\(/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorPageEventStatusDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorPageEventStatusDependencies');
  const bindIndex = editorSource.indexOf('bindEditorPageEvents({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(bindIndex, -1);
  assert.ok(checkerIndex < bindIndex);
});

test('editor preserves page event status dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.getHttpStatus missing/);
});

test('editor no longer owns inline getHttpStatus start dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(getHttpStatus, 'LoveBudEditorShellHelpers\.getHttpStatus missing'\)\) return;/
  );
});

test('page event status dependency delegation preserves event binding payload', () => {
  assert.match(editorSource, /if \(typeof bindEditorPageEvents === 'function'\) \{/);
  assert.match(editorSource, /bindEditorPageEvents\(\{/);
  assert.match(editorSource, /getHttpStatus,/);
  assert.match(editorSource, /showAddMemoryForm,/);
  assert.match(editorSource, /hideAddMemoryForm,/);
  assert.match(editorSource, /addMemoryFromForm,/);
  assert.match(editorSource, /updateSaveStatus,/);
  assert.match(editorSource, /getEditorCanvas:\s*\(\)\s*=>\s*editorCanvas/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /enterEditMode,/);
  assert.match(editorSource, /deleteMemory,/);
  assert.match(editorSource, /exitEditMode,/);
  assert.match(editorSource, /saveMemoryEdit/);
});

test('page event status dependency slice leaves runtime and canvas boundaries intact', () => {
  assert.match(editorSource, /const refreshSaveRuntime\s*=\s*createEditorRefreshSaveRuntime\(\{/);
  assert.match(editorSource, /memoryActions\s*=\s*window\.createEditorMemoryActions\(\{/);
  assert.match(editorSource, /const memoryForm\s*=\s*window\.createEditorMemoryForm\(\{/);
  assert.match(editorSource, /const \{ showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm \}\s*=\s*memoryForm;/);
  assert.match(editorSource, /initCanvas\(\);/);
  assert.match(editorSource, /updateCanvasEmptyGuide\(\);/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
