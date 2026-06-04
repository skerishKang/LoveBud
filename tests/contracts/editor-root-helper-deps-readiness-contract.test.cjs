const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('editor entry dependencies already returns root helpers via deps', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  assert.match(helper, /getYouTubeInputErrorMessage,/);
  assert.match(helper, /findRootMemory,/);
  assert.match(helper, /getCanonicalRootId,/);
  assert.match(helper, /isRootMemory/);
});

test('editor entry dependencies resolver validates root helpers before returning', () => {
  const helper = read('js/editor/editor-entry-dependencies.js');

  assert.match(helper, /typeof rootUtils\.getYouTubeInputErrorMessage === 'function'/);
  assert.match(helper, /findRootMemory.*=.*rootUtils\.findRootMemory/);
  assert.match(helper, /getCanonicalRootId.*=.*rootUtils\.getCanonicalRootId/);
  assert.match(helper, /isRootMemory.*=.*rootUtils\.isRootMemory/);
});

test('editor entrypoint still reads root helpers through rootUtils intermediate alias', () => {
  const editor = read('js/editor.js');

  // rootUtils is resolved from deps (not window global)
  assert.match(editor, /const rootUtils = deps\.rootUtils;/);

  // The 4 root helpers are still read through rootUtils.*
  assert.match(editor, /typeof rootUtils\.getYouTubeInputErrorMessage === 'function'/);
  assert.match(editor, /const findRootMemory = rootUtils\.findRootMemory;/);
  assert.match(editor, /const getCanonicalRootId = rootUtils\.getCanonicalRootId;/);
  assert.match(editor, /const isRootMemory = rootUtils\.isRootMemory;/);

  // They are NOT yet read directly from deps
  assert.doesNotMatch(editor, /const findRootMemory = deps\.findRootMemory;/);
  assert.doesNotMatch(editor, /const getCanonicalRootId = deps\.getCanonicalRootId;/);
  assert.doesNotMatch(editor, /const isRootMemory = deps\.isRootMemory;/);
});

test('editor entrypoint does not re-read rootUtils from window global', () => {
  const editor = read('js/editor.js');

  assert.doesNotMatch(editor, /const rootUtils = window\.LoveBudEditorUtils/);
});

test('editor entrypoint uses rootUtils intermediate alias for downstream calls', () => {
  const editor = read('js/editor.js');

  // Downstream sites pass rootUtils-derived helpers as arguments
  assert.match(editor, /createEditorRefreshSaveRuntime\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /createEditorRefreshSaveRuntime\(\{[\s\S]*?canonicalRootId/);
  assert.match(editor, /window\.createEditorMemoryActions\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /window\.createEditorMemoryActions\(\{[\s\S]*?findRootMemory/);
  assert.match(editor, /window\.createEditorDetailUI\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /getYouTubeInputErrorMessage\(i18n/);
  assert.match(editor, /getCanonicalRootId\(treeMemories\(\)\)/);
});
