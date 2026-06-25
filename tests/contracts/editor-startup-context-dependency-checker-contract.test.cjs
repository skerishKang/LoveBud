const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor delegates startup context dependency checks after required globals', () => {
  assert.match(
    editorSource,
    /if \(!await waitForEditorRequiredGlobals\(\)\) return;\s+const checkEditorStartupContextDependencies\s*=\s*createEditorStartDependencyChecker\(\{/
  );
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorStartupContextDependencies\(\)\) return;/);
});

test('editor preserves startup context dependency messages inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorDomRefsBuilder\.createEditorDomRefs missing/);
  assert.match(editorSource, /LoveBudEditorStartupContext\.createEditorStartupContext missing/);
});

test('editor no longer owns repeated inline startup context dependency checks', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createEditorDomRefs, 'LoveBudEditorDomRefsBuilder\.createEditorDomRefs missing'\)\) return;/
  );
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createEditorStartupContext, 'LoveBudEditorStartupContext\.createEditorStartupContext missing'\)\) return;/
  );
});

test('startup context dependency delegation preserves startup context creation path', () => {
  assert.match(editorSource, /const \{\s*canvas,\s*svg,\s*detailPanel,\s*addBtn,\s*urlTreeId,\s*canEdit,\s*mode,\s*memoryId\s*\}\s*=\s*createEditorStartupContext\(\{/s);
  assert.match(editorSource, /createEditorDomRefs,\s*locationRef:\s*window\.location,\s*URLSearchParamsRef:\s*URLSearchParams/s);
});
