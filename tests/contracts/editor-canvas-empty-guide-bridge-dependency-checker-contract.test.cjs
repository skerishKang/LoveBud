const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates canvas empty guide bridge dependency check before exposure', () => {
  assert.match(
    editorSource,
    /const checkEditorCanvasEmptyGuideBridgeDependencies\s*=\s*createEditorStartDependencyChecker\(\{/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorCanvasEmptyGuideBridgeDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorCanvasEmptyGuideBridgeDependencies');
  const exposeIndex = editorSource.indexOf('exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(exposeIndex, -1);
  assert.ok(checkerIndex < exposeIndex);
});

test('editor preserves canvas empty guide bridge dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.exposeCanvasEmptyGuideUpdater missing/);
});

test('editor no longer owns inline canvas empty guide bridge dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(exposeCanvasEmptyGuideUpdater, 'LoveBudEditorShellHelpers\.exposeCanvasEmptyGuideUpdater missing'\)\) return;/
  );
});

test('canvas empty guide bridge dependency delegation preserves bridge exposure path', () => {
  assert.match(editorSource, /const updateCanvasEmptyGuide\s*=\s*createEditorCanvasEmptyGuideUpdater\(\{/);
  assert.match(editorSource, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}\);/);
  assert.match(editorSource, /const selectNode\s*=\s*createEditorSelectNodeHandler\(\{/);
});

test('canvas empty guide bridge dependency slice leaves focus and detail opener guards intact', () => {
  assert.match(
    editorSource,
    /checkEditorSelectedMomentFocusDependencies\(\)/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createSelectedMomentFocusHandler missing/
  );
  assert.match(
    editorSource,
    /ensureStartEditorDependency\(createCurrentMomentDetailOpener, 'LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing'\)/
  );
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
