const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const STORAGE_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');

function createStorageContext() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  return context.window.LoveBudEditorCanvasLayoutStorage;
}

test('canvas layout storage helper — exposes LoveBudEditorCanvasLayoutStorage API', () => {
  const storage = createStorageContext();
  assert.ok(storage, 'namespace must exist');
  assert.equal(typeof storage.loadStoredLayout, 'function');
  assert.equal(typeof storage.loadLayoutMode, 'function');
  assert.equal(typeof storage.persistLayoutMode, 'function');
  assert.equal(typeof storage.persistStoredPositions, 'function');
});

test('canvas layout storage helper — functions accept expected parameter lengths', () => {
  const storage = createStorageContext();
  assert.equal(storage.loadStoredLayout.length, 4, 'loadStoredLayout(treeId, layoutStorageKey, canvasLayout, readOnly)');
  assert.equal(storage.loadLayoutMode.length, 2, 'loadLayoutMode(layoutModeStorageKey, readOnly)');
  assert.equal(storage.persistLayoutMode.length, 3, 'persistLayoutMode(mode, layoutModeStorageKey, canEdit)');
  assert.equal(storage.persistStoredPositions.length, 5, 'persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit)');
});

test('canvas layout storage helper — editor-canvas.js uses thin delegation wrappers', () => {
  const canvasSource = fs.readFileSync(CANVAS_PATH, 'utf8');

  // Verify that the fallback localStorage read/write logic is no longer inline in editor-canvas.js
  assert.doesNotMatch(canvasSource, /localStorage\.getItem\(layoutStorageKey\)/, 'extracted: loadStoredLayout localstorage get should not be inline');
  assert.doesNotMatch(canvasSource, /localStorage\.getItem\(layoutModeStorageKey\)/, 'extracted: loadLayoutMode localstorage get should not be inline');
  assert.doesNotMatch(canvasSource, /localStorage\.setItem\(layoutModeStorageKey,\s*mode\)/, 'extracted: persistLayoutMode localstorage set should not be inline');
  assert.doesNotMatch(canvasSource, /localStorage\.setItem\(layoutStorageKey,\s*JSON\.stringify/, 'extracted: persistStoredPositions localstorage stringify should not be inline');

  // Verify that delegation to storageUtils (LoveBudEditorCanvasLayoutStorage) is present
  assert.match(canvasSource, /storageUtils\.loadStoredLayout/, 'delegated: must delegate loadStoredLayout');
  assert.match(canvasSource, /storageUtils\.loadLayoutMode/, 'delegated: must delegate loadLayoutMode');
  assert.match(canvasSource, /storageUtils\.persistLayoutMode/, 'delegated: must delegate persistLayoutMode');
  assert.match(canvasSource, /storageUtils\.persistStoredPositions/, 'delegated: must delegate persistStoredPositions');
});

test('canvas layout storage helper — script presence in pages/editor.html', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages/editor.html'), 'utf8');
  assert.match(html, /js\/editor\/editor-canvas-layout-storage\.js/, 'editor-canvas-layout-storage.js script must be present in editor.html');
  assert.ok(html.indexOf('editor-canvas-layout-storage.js') < html.indexOf('editor-canvas.js'), 'storage helper must be loaded before main canvas script');
});
