const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates startup shell dependency check before startup shell applier', () => {
  assert.match(
    editorSource,
    /const checkEditorStartupShellDependencies\s*=\s*createEditorStartDependencyChecker\(\{/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorStartupShellDependencies\(\)\) return;/);

  const checkerIndex = editorSource.indexOf('checkEditorStartupShellDependencies');
  const applierIndex = editorSource.indexOf('const applyEditorStartupShell = createEditorStartupShellApplier({');

  assert.notEqual(checkerIndex, -1);
  assert.notEqual(applierIndex, -1);
  assert.ok(checkerIndex < applierIndex);
});

test('editor preserves startup shell dependency message inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.applyEditorEditabilityState missing/);
});

test('editor no longer owns inline startup shell dependency check', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(applyEditorEditabilityState, 'LoveBudEditorShellHelpers\.applyEditorEditabilityState missing'\)\) return;/
  );
});

test('startup shell dependency delegation preserves startup shell application path', () => {
  assert.match(editorSource, /const applyEditorStartupShell\s*=\s*createEditorStartupShellApplier\(\{/);
  assert.match(editorSource, /prepareEditorShell,\s*applyEditorEditabilityState,\s*canEdit:\s*false,\s*log/s);
  assert.match(editorSource, /applyEditorStartupShell\(\);/);
});
