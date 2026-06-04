const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function scriptSources() {
  const html = read('pages/editor.html');
  return Array.from(html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g))
    .map((match) => match[1]);
}

function sourceIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

test('editor root helpers load before editor utils and editor entry', () => {
  const sources = scriptSources();
  const rootHelpers = sourceIndex(sources, 'js/editor/editor-root-helpers.js');
  const editorUtils = sourceIndex(sources, 'js/editor/editor-utils.js');
  const editorEntry = sourceIndex(sources, 'js/editor.js');

  assert.notEqual(rootHelpers, -1, 'editor-root-helpers.js must be loaded');
  assert.notEqual(editorUtils, -1, 'editor-utils.js must be loaded');
  assert.notEqual(editorEntry, -1, 'editor.js must be loaded');
  assert.ok(rootHelpers < editorUtils, 'root helpers must load before editor utils');
  assert.ok(editorUtils < editorEntry, 'editor utils must load before editor entry');
});

test('root helpers export root utilities and editor utils preserve the namespace', () => {
  const context = { window: {} };
  vm.createContext(context);

  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  assert.equal(typeof context.window.LoveBudEditorUtils.findRootMemory, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.getRootId, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.getCanonicalRootId, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.isRootMemory, 'function');

  const rootFindRootMemory = context.window.LoveBudEditorUtils.findRootMemory;
  vm.runInContext(read('js/editor/editor-utils.js'), context);

  assert.equal(context.window.LoveBudEditorUtils.findRootMemory, rootFindRootMemory);
  assert.equal(typeof context.window.LoveBudEditorUtils.getYouTubeInputErrorMessage, 'function');

  const editorUtils = read('js/editor/editor-utils.js');
  assert.match(editorUtils, /const\s+utils\s*=\s*window\.LoveBudEditorUtils\s*\|\|\s*\{\}/);
  assert.match(editorUtils, /window\.LoveBudEditorUtils\s*=\s*utils/);
});

test('editor entry requires preloaded root helper utilities without inline fallbacks', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /const\s+rootUtils\s*=\s*deps\.rootUtils;/);
  assert.match(editor, /findRootMemory\s*=\s*rootUtils\.findRootMemory/);
  assert.match(editor, /getCanonicalRootId\s*=\s*rootUtils\.getCanonicalRootId/);
  assert.match(editor, /isRootMemory\s*=\s*rootUtils\.isRootMemory/);
  assert.match(editor, /const\s+missingRootHelpers\s*=\s*\[/);
  assert.match(editor, /LoveBudEditorUtils\.findRootMemory/);
  assert.match(editor, /LoveBudEditorUtils\.getCanonicalRootId/);
  assert.match(editor, /LoveBudEditorUtils\.isRootMemory/);
  assert.match(editor, /\[editor-main\] ERROR: /);

  assert.doesNotMatch(editor, /rootHelperWarningShown/);
  assert.doesNotMatch(editor, /warnRootHelperFallback/);
  assert.doesNotMatch(editor, /LoveBudEditorUtils not loaded, using local fallback for root helpers/);
  assert.doesNotMatch(editor, /const\s+findRootMemory\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+getRootId\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+getCanonicalRootId\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+isRootMemory\s*=\s*function/);
});

test('editor entry keeps root helper usage contracts', () => {
  const editor = read('js/editor.js');
  const refreshSaveRuntime = read('js/editor/editor-refresh-save-runtime.js');
  const runtimeSources = `${editor}\n${refreshSaveRuntime}`;

  assert.match(editor, /createInitialMemory[\s\S]*findRootMemory/);
  assert.match(editor, /canonicalRootId\s*=\s*getCanonicalRootId\(treeMemories\(\)\)/);
  assert.match(editor, /applyEditorInitialSelection\(\);/);
  assert.match(runtimeSources, /isRootMemory\(refreshedEditingMemory,\s*canonicalRootId\)/);
  assert.match(editor, /memoryActions[\s\S]*isRootMemory[\s\S]*findRootMemory/);
  assert.match(editor, /detailUI[\s\S]*isRootMemory/);
  assert.match(editor, /editorCanvas[\s\S]*isRootMemory/);
});
