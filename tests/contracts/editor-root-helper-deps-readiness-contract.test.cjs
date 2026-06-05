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

test('editor entrypoint now reads root helpers directly from deps', () => {
  const editor = read('js/editor.js');

  // root helpers are now read directly from deps (no rootUtils intermediate)
  assert.match(editor, /deps\.getYouTubeInputErrorMessage/);
  assert.match(editor, /deps\.findRootMemory/);
  assert.match(editor, /deps\.getCanonicalRootId/);
  assert.match(editor, /deps\.isRootMemory/);

  // rootUtils alias is completely removed
  assert.equal(editor.includes('const rootUtils = deps.rootUtils;'), false);

  // No residual rootUtils.* usage for root helpers
  assert.equal(editor.includes('rootUtils.getYouTubeInputErrorMessage'), false);
  assert.equal(editor.includes('rootUtils.findRootMemory'), false);
  assert.equal(editor.includes('rootUtils.getCanonicalRootId'), false);
  assert.equal(editor.includes('rootUtils.isRootMemory'), false);
});

test('editor entrypoint does not re-read rootUtils from window global', () => {
  const editor = read('js/editor.js');

  assert.doesNotMatch(editor, /const rootUtils = window\.LoveBudEditorUtils/);
});

test('editor entrypoint uses root helpers from deps for downstream calls', () => {
  const editor = read('js/editor.js');

  // Downstream sites still pass root helper values (now from deps) as arguments
  assert.match(editor, /createEditorRefreshSaveRuntime\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /createEditorRefreshSaveRuntime\(\{[\s\S]*?canonicalRootId/);
  assert.match(editor, /window\.createEditorMemoryActions\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /window\.createEditorMemoryActions\(\{[\s\S]*?findRootMemory/);
  assert.match(editor, /window\.createEditorDetailUI\(\{[\s\S]*?isRootMemory/);
  assert.match(editor, /getYouTubeInputErrorMessage\(deps\.i18n/);
  assert.match(editor, /getCanonicalRootId\(treeMemories\(\)\)/);
});
