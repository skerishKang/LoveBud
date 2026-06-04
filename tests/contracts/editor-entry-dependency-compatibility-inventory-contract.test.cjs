const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must be present`);
  return index;
}

test('editor entry compatibility inventory — resolver-owned dependency fallbacks remain explicit', () => {
  const editor = read('js/editor.js');

  const resolverCallIndex = indexOfRequired(editor, 'resolveEditorEntryDependencies({');
  const depsIndex = indexOfRequired(editor, 'const deps = entryDependenciesResult.deps;');

  assert.ok(resolverCallIndex < depsIndex, 'editor.js must resolve dependencies before local aliases');

  const compatibilityAliases = [
    'const shellHelpers = window.LoveBudEditorShellHelpers || deps.shellHelpers;',
    'const editorSelectionUI = window.LoveBudEditorSelectionUI || {};',
    'const editorPageEventBindings = window.LoveBudEditorPageEventBindings || deps.editorPageEventBindings;',
    'const editorRefreshSaveRuntime = window.LoveBudEditorRefreshSaveRuntime || deps.editorRefreshSaveRuntime;',
    'const editorShellCopyApplier = window.LoveBudEditorShellCopyApplier || deps.editorShellCopyApplier;',
    'const editorDomRefsBuilder = window.LoveBudEditorDomRefsBuilder || deps.editorDomRefsBuilder;'
  ];

  for (const alias of compatibilityAliases) {
    const aliasIndex = indexOfRequired(editor, alias);
    assert.ok(depsIndex < aliasIndex, `${alias} must remain after resolver output is available`);
  }
});

test('editor entry compatibility inventory — root helper globals are still re-read locally', () => {
  const editor = read('js/editor.js');
  const depsIndex = indexOfRequired(editor, 'const deps = entryDependenciesResult.deps;');
  const rootUtilsAlias = 'const rootUtils = window.LoveBudEditorUtils || {};';
  const rootUtilsIndex = indexOfRequired(editor, rootUtilsAlias);

  assert.ok(depsIndex < rootUtilsIndex, 'root helper compatibility alias must remain after resolver output');
  assert.match(editor, /const\s+findRootMemory\s*=\s*rootUtils\.findRootMemory;/);
  assert.match(editor, /const\s+getCanonicalRootId\s*=\s*rootUtils\.getCanonicalRootId;/);
  assert.match(editor, /const\s+isRootMemory\s*=\s*rootUtils\.isRootMemory;/);
  assert.doesNotMatch(editor, /const\s+findRootMemory\s*=\s*deps\.findRootMemory;/);
  assert.doesNotMatch(editor, /const\s+getCanonicalRootId\s*=\s*deps\.getCanonicalRootId;/);
  assert.doesNotMatch(editor, /const\s+isRootMemory\s*=\s*deps\.isRootMemory;/);
});

test('editor entry compatibility inventory — resolver already returns cleanup-ready dependency aliases', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  const returnedAliases = [
    'shellHelpers,',
    'rootUtils,',
    'editorSelectionUI,',
    'editorPageEventBindings,',
    'editorRefreshSaveRuntime,',
    'editorShellCopyApplier,',
    'editorDomRefsBuilder,',
    'findRootMemory,',
    'getCanonicalRootId,',
    'isRootMemory'
  ];

  for (const alias of returnedAliases) {
    assert.match(helper, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
