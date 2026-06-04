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

test('editor entry compatibility paths removed — no redundant window global re-reads', () => {
  const editor = read('js/editor.js');

  const removedPatterns = [
    /window\.LoveBudEditorShellHelpers\s*\|\|\s*deps\./,
    /window\.LoveBudEditorSelectionUI\s*\|\|\s*\{}/,
    /window\.LoveBudEditorPageEventBindings\s*\|\|\s*deps\./,
    /window\.LoveBudEditorRefreshSaveRuntime\s*\|\|\s*deps\./,
    /window\.LoveBudEditorShellCopyApplier\s*\|\|\s*deps\./,
    /window\.LoveBudEditorDomRefsBuilder\s*\|\|\s*deps\./
  ];

  for (const pattern of removedPatterns) {
    assert.doesNotMatch(editor, pattern, `compatibility path pattern ${pattern} must be removed`);
  }
});

test('editor entry compatibility — shellHelpers and root helpers resolved exclusively from deps', () => {
  const editor = read('js/editor.js');
  const depsIndex = indexOfRequired(editor, 'const deps = entryDependenciesResult.deps;');

  const shellAliasIndex = indexOfRequired(editor, 'const shellHelpers = deps.shellHelpers;');
  assert.ok(depsIndex < shellAliasIndex, 'shellHelpers alias must come after deps resolution');

  // rootUtils intermediate alias has been removed; root helpers read directly from deps
  assert.match(editor, /const getYouTubeInputErrorMessage = deps\.getYouTubeInputErrorMessage;/);
  assert.match(editor, /const findRootMemory = deps\.findRootMemory;/);
  assert.match(editor, /const getCanonicalRootId = deps\.getCanonicalRootId;/);
  assert.match(editor, /const isRootMemory = deps\.isRootMemory;/);

  assert.doesNotMatch(editor, /window\.LoveBudEditorShellHelpers/);
  assert.doesNotMatch(editor, /window\.LoveBudEditorUtils/);
  assert.doesNotMatch(editor, /const rootUtils = deps\.rootUtils;/);
});

test('editor entry compatibility — editor-specific modules resolved exclusively from deps', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /const editorSelectionUI = deps\.editorSelectionUI;/);
  assert.match(editor, /const editorPageEventBindings = deps\.editorPageEventBindings;/);
  assert.match(editor, /const editorRefreshSaveRuntime = deps\.editorRefreshSaveRuntime;/);
  assert.match(editor, /const editorShellCopyApplier = deps\.editorShellCopyApplier;/);
  assert.match(editor, /const editorDomRefsBuilder = deps\.editorDomRefsBuilder;/);

  assert.doesNotMatch(editor, /window\.LoveBudEditorSelectionUI/);
  assert.doesNotMatch(editor, /window\.LoveBudEditorPageEventBindings/);
  assert.doesNotMatch(editor, /window\.LoveBudEditorRefreshSaveRuntime/);
  assert.doesNotMatch(editor, /window\.LoveBudEditorShellCopyApplier/);
  assert.doesNotMatch(editor, /window\.LoveBudEditorDomRefsBuilder/);
});

test('editor entry compatibility — root helper method aliases use deps directly', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /const findRootMemory = deps\.findRootMemory;/);
  assert.match(editor, /const getCanonicalRootId = deps\.getCanonicalRootId;/);
  assert.match(editor, /const isRootMemory = deps\.isRootMemory;/);

  assert.doesNotMatch(editor, /const rootUtils = deps\.rootUtils;/);
  assert.doesNotMatch(editor, /rootUtils\.findRootMemory/);
  assert.doesNotMatch(editor, /rootUtils\.getCanonicalRootId/);
  assert.doesNotMatch(editor, /rootUtils\.isRootMemory/);
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
