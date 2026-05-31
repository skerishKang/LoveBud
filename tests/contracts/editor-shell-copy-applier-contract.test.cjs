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

test('editor.js delegates createPrepareEditorShell through required shell copy applier', () => {
  assert.match(
    editorSource,
    /const\s+createPrepareEditorShell\s*=\s*editorShellCopyApplier\.createPrepareEditorShell/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createPrepareEditorShell\s*=\s*editorShellCopyApplier\.createPrepareEditorShell\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellCopyApplier\.createPrepareEditorShell missing/
  );
});

test('editor.js guards missing createPrepareEditorShell before call and without reportError', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellCopyApplier.createPrepareEditorShell missing');
  const callIndex = editorSource.indexOf('createPrepareEditorShell({ applyEditorShellCopy, safeI18nText, i18n, getMyTreesHref })');

  assert.ok(guardIndex !== -1, 'missing createPrepareEditorShell guard must exist');
  assert.ok(callIndex !== -1, 'createPrepareEditorShell call must exist');
  assert.ok(guardIndex < callIndex, 'guard must run before createPrepareEditorShell call');

  const guardBlock = editorSource.slice(guardIndex - 100, guardIndex + 200);
  assert.doesNotMatch(guardBlock, /reportError\(/);
});

test('editor.js delegates applyEditorShellCopy through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+applyEditorShellCopy\s*=\s*shellHelpers\.applyEditorShellCopy/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+applyEditorShellCopy\s*=\s*shellHelpers\.applyEditorShellCopy\s*\|\|/
  );
  assert.doesNotMatch(
    editorSource,
    /createEditorShellCopyApplier\(\{\s*safeI18nText,\s*i18n\s*\}\)/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.applyEditorShellCopy missing/
  );
  assert.match(
    editorSource,
    /applyEditorShellCopy\(safeI18nText,\s*i18n\)/
  );
  assert.match(
    editorSource,
    /createPrepareEditorShell\(\{\s*applyEditorShellCopy,\s*safeI18nText,\s*i18n,\s*getMyTreesHref\s*\}/
  );
});

test('editor.js guards missing applyEditorShellCopy before call and without reportError', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.applyEditorShellCopy missing');
  const callIndex = editorSource.indexOf('applyEditorShellCopy(safeI18nText, i18n)');

  assert.ok(guardIndex !== -1, 'missing applyEditorShellCopy guard must exist');
  assert.ok(callIndex !== -1, 'applyEditorShellCopy call must exist');
  assert.ok(guardIndex < callIndex, 'guard must run before applyEditorShellCopy call');

  const guardBlock = editorSource.slice(guardIndex - 100, guardIndex + 200);
  assert.doesNotMatch(guardBlock, /reportError\(/);
});
