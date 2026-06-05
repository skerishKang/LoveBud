const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor-shell-copy-applier.js exists and exposes correct namespace', () => {
    const js = fs.readFileSync('js/editor/editor-shell-copy-applier.js', 'utf8');

    assert.ok(js.includes('window.LoveBudEditorShellCopyApplier = {'), 'must expose namespace');
    assert.ok(js.includes('createEditorShellCopyApplier'), 'must contain createEditorShellCopyApplier');
    assert.ok(js.includes('createPrepareEditorShell'), 'must contain createPrepareEditorShell');
    assert.ok(js.includes('textBindings.forEach'), 'must contain textBindings application');
    assert.ok(js.includes('placeholderBindings.forEach'), 'must contain placeholderBindings application');
});

test('editor.html loads editor-shell-copy-applier.js before editor.js', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const applierIndex = html.indexOf('js/editor/editor-shell-copy-applier.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(applierIndex, -1, 'applier script must be loaded');
    assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
    assert.ok(applierIndex < editorJsIndex, 'applier must load before editor.js');
});

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

test('editor.js delegates createPrepareEditorShell through required deps pattern', () => {
  assert.match(
    editorSource,
    /deps\.createPrepareEditorShell\(\{/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createPrepareEditorShell\s*=\s*deps\.createPrepareEditorShell\s*\|\|/
  );
  assert.doesNotMatch(
    editorSource,
    /LoveBudEditorShellCopyApplier\.createPrepareEditorShell missing/
  );
});

test('editor.js no longer guards missing createPrepareEditorShell before call (resolved through deps)', () => {
  assert.equal(
    editorSource.indexOf('LoveBudEditorShellCopyApplier.createPrepareEditorShell missing'),
    -1,
    'missing createPrepareEditorShell guard must not exist'
  );
  // The call still exists with direct deps
  assert.notEqual(
    editorSource.indexOf('deps.createPrepareEditorShell({'),
    -1,
    'createPrepareEditorShell call must exist'
  );
  assert.ok(editorSource.includes('applyEditorShellCopy: deps.applyEditorShellCopy'), 'applyEditorShellCopy passed to createPrepareEditorShell');
});

test('editor.js delegates applyEditorShellCopy through required deps pattern', () => {
  assert.match(
    editorSource,
    /deps\.applyEditorShellCopy\(deps\.safeI18nText,\s*deps\.i18n\)/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+applyEditorShellCopy\s*=\s*deps\.applyEditorShellCopy\s*\|\|/
  );
  assert.doesNotMatch(
    editorSource,
    /createEditorShellCopyApplier\(/
  );
  assert.doesNotMatch(
    editorSource,
    /LoveBudEditorShellHelpers\.applyEditorShellCopy missing/
  );
  assert.match(
    editorSource,
    /applyEditorShellCopy:\s*deps\.applyEditorShellCopy/
  );
  assert.match(
    editorSource,
    /deps\.createPrepareEditorShell\(\{\s*applyEditorShellCopy:\s*deps\.applyEditorShellCopy,\s*safeI18nText:\s*deps\.safeI18nText,\s*i18n:\s*deps\.i18n,\s*getMyTreesHref:\s*deps\.getMyTreesHref\s*\}\)/
  );
});

test('editor.js no longer guards missing applyEditorShellCopy before call (resolved through deps)', () => {
  assert.equal(
    editorSource.indexOf('LoveBudEditorShellHelpers.applyEditorShellCopy missing'),
    -1,
    'missing applyEditorShellCopy guard must not exist'
  );
  assert.notEqual(
    editorSource.indexOf('deps.applyEditorShellCopy(deps.safeI18nText, deps.i18n)'),
    -1,
    'applyEditorShellCopy call must exist'
  );
});
