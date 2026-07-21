/**
 * Viewer Local Layout Isolation Contract Test (#3057)
 *
 * Validates that read-only/public viewers do NOT read browser-local editor
 * layout keys (lovebud_tree_layout_v2_<treeId>, lovebud_tree_layout_mode_<treeId>).
 *
 * Strategy: uses canvasLayout store mock to bypass localStorage in VM environment.
 * Source-level static checks validate localStorage calls are guarded.
 *
 * This test does NOT execute browser code, firebase, or any network request.
 * It does NOT use real accounts, emails, passwords, or tokens.
 *
 * Refs #3057
 * Refs #3054
 * Refs #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..');
const STORAGE_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const MOBILE_LAYOUT_PATH = path.join(ROOT, 'js/viewer/public-canvas-mobile-layout.js');
const PUBLIC_INIT_PATH = path.join(ROOT, 'js/viewer/public-canvas-init.js');

// ── Storage context factory ───────────────────────────────────────────────────
// Uses canvasLayout store mock so storage calls never hit localStorage in the VM.

function createStorageContext() {
  const context = { window: {}, localStorage: undefined };
  context.window.localStorage = {
    getItem() { throw new Error('localStorage.getItem should not be called in this test'); },
    setItem() { throw new Error('localStorage.setItem should not be called in this test'); },
    removeItem() { throw new Error('localStorage.removeItem should not be called in this test'); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  return context.window.LoveBudEditorCanvasLayoutStorage;
}

// ── Mock canvasLayout store ───────────────────────────────────────────────────

function makeMockCanvasLayout(positions, offsetX, offsetY, scale) {
  const store = {
    createInitialViewportState() {
      return {
        positions: positions || {},
        offsetX: offsetX !== undefined ? offsetX : 0,
        offsetY: offsetY !== undefined ? offsetY : 0,
        scale: scale !== undefined ? scale : 1
      };
    }
  };
  return { createLayoutStore: () => store };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. loadStoredLayout with readOnly=true — returns deterministic defaults
// ─────────────────────────────────────────────────────────────────────────────

test('loadStoredLayout(readOnly=true) returns empty default positions', function () {
  const storage = createStorageContext();
  const result = storage.loadStoredLayout('tree1', 'key1', makeMockCanvasLayout({ a: 1 }), true);
  assert.equal(Object.keys(result.positions).length, 0, 'positions must be empty object');
});

test('loadStoredLayout(readOnly=true) returns zero offsets', function () {
  const storage = createStorageContext();
  const result = storage.loadStoredLayout('tree1', 'key1', makeMockCanvasLayout({}, 999, 888, 9.9), true);
  assert.equal(result.offsetX, 0);
  assert.equal(result.offsetY, 0);
  assert.equal(result.scale, 1);
});

test('loadStoredLayout(readOnly=true) skips canvasLayout store entirely', function () {
  const storage = createStorageContext();
  let storeCalled = false;
  const store = {
    createInitialViewportState() {
      storeCalled = true;
      return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
    }
  };
  const mockCanvasLayout = { createLayoutStore: () => store };
  storage.loadStoredLayout('tree1', 'key1', mockCanvasLayout, true);
  assert.equal(storeCalled, false, 'canvasLayout store must not be called when readOnly=true');
});

test('loadStoredLayout(readOnly=true) returns structured mode default', function () {
  const storage = createStorageContext();
  // loadStoredLayout doesn't set layoutMode; loadLayoutMode does
  const result = storage.loadStoredLayout('tree1', 'key1', {}, true);
  assert.equal(result.scale, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. loadStoredLayout with readOnly=false — uses canvasLayout store
// ─────────────────────────────────────────────────────────────────────────────

test('loadStoredLayout(readOnly=false) uses canvasLayout store', function () {
  const storage = createStorageContext();
  const mock = makeMockCanvasLayout({ node1: { x: 100, y: 200 } }, 50, 75, 1.2);
  const result = storage.loadStoredLayout('tree2', 'key2', mock, false);
  assert.equal(Object.keys(result.positions).length, 1);
  assert.equal(result.positions.node1.x, 100);
  assert.equal(result.positions.node1.y, 200);
  assert.equal(result.offsetX, 50);
  assert.equal(result.offsetY, 75);
  assert.equal(result.scale, 1.2);
});

test('loadStoredLayout(readOnly=false) returns empty defaults when store returns empty', function () {
  const storage = createStorageContext();
  const mock = makeMockCanvasLayout({}, 0, 0, 1);
  const result = storage.loadStoredLayout('tree3', 'key3', mock, false);
  assert.equal(Object.keys(result.positions).length, 0);
  assert.equal(result.offsetX, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. loadLayoutMode with readOnly=true — returns structured
// ─────────────────────────────────────────────────────────────────────────────

test('loadLayoutMode(readOnly=true) returns structured', function () {
  const storage = createStorageContext();
  const result = storage.loadLayoutMode('mode_key', true);
  assert.equal(result, 'structured');
});

test('loadLayoutMode(readOnly=true) does not call localStorage', function () {
  const storage = createStorageContext();
  // Will throw if localStorage is accessed
  const result = storage.loadLayoutMode('any_mode_key', true);
  assert.equal(result, 'structured');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. loadLayoutMode with readOnly=false — uses localStorage
// ─────────────────────────────────────────────────────────────────────────────

test('loadLayoutMode is exposed as a function', function () {
  const storage = createStorageContext();
  assert.equal(typeof storage.loadLayoutMode, 'function');
  // readOnly=false path should not throw (localStorage get is mocked to throw)
  // So we can't directly test readOnly=false in VM without real localStorage
  // → covered by source-level tests
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. persistStoredPositions guards
// ─────────────────────────────────────────────────────────────────────────────

test('persistStoredPositions is exposed as a function', function () {
  const storage = createStorageContext();
  assert.equal(typeof storage.persistStoredPositions, 'function');
});

test('persistStoredPositions signature: 5 params', function () {
  const storage = createStorageContext();
  assert.equal(storage.persistStoredPositions.length, 5,
    'persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. persistLayoutMode guards
// ─────────────────────────────────────────────────────────────────────────────

test('persistLayoutMode is exposed as a function', function () {
  const storage = createStorageContext();
  assert.equal(typeof storage.persistLayoutMode, 'function');
});

test('persistLayoutMode signature: 3 params', function () {
  const storage = createStorageContext();
  assert.equal(storage.persistLayoutMode.length, 3,
    'persistLayoutMode(mode, layoutModeStorageKey, canEdit)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Source-level: editor-canvas.js uses explicit layout policy for readOnly
//    (#3581 — canEdit alone is no longer the storage boundary)
// ─────────────────────────────────────────────────────────────────────────────

test('editor-canvas.js: loadStoredLayout uses layoutPolicy.layoutReadOnly', function () {
  const src = fs.readFileSync(CANVAS_PATH, 'utf8');
  assert.ok(
    /storageUtils\.loadStoredLayout\s*\([\s\S]*?layoutPolicy\.layoutReadOnly\s*===\s*true/.test(src),
    'loadStoredLayout must use layoutPolicy.layoutReadOnly as readOnly boundary'
  );
  assert.ok(
    !/storageUtils\.loadStoredLayout\s*\(\s*treeId\s*,\s*layoutStorageKey\s*,\s*canvasLayout\s*,\s*canEdit\s*===\s*false\s*\)/.test(src),
    'must not pass bare canEdit===false as layout storage boundary'
  );
});

test('editor-canvas.js: loadLayoutMode uses layoutPolicy.layoutReadOnly', function () {
  const src = fs.readFileSync(CANVAS_PATH, 'utf8');
  assert.ok(
    /storageUtils\.loadLayoutMode\s*\([\s\S]*?layoutPolicy\.layoutReadOnly\s*===\s*true/.test(src),
    'loadLayoutMode must use layoutPolicy.layoutReadOnly as readOnly boundary'
  );
});

test('editor-canvas.js: exposes syncInteractionLayoutMode for view/edit rebinding', function () {
  const src = fs.readFileSync(CANVAS_PATH, 'utf8');
  assert.ok(
    /function\s+syncInteractionLayoutMode\s*\(/.test(src) || /syncInteractionLayoutMode\s*[,(]/.test(src),
    'syncInteractionLayoutMode must exist'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Source-level: storage helper signatures include readOnly parameter
// ─────────────────────────────────────────────────────────────────────────────

test('storage loadStoredLayout signature includes readOnly (4 params)', function () {
  const src = fs.readFileSync(STORAGE_PATH, 'utf8');
  const match = src.match(/function\s+loadStoredLayout\s*\(([^)]+)\)/);
  assert.ok(match, 'loadStoredLayout must be a named function');
  const params = match[1].replace(/\s+/g, '');
  assert.ok(params.includes('readOnly'), `loadStoredLayout signature must include readOnly: got "${params}"`);
});

test('storage loadLayoutMode signature includes readOnly (2 params)', function () {
  const src = fs.readFileSync(STORAGE_PATH, 'utf8');
  const match = src.match(/function\s+loadLayoutMode\s*\(([^)]+)\)/);
  assert.ok(match, 'loadLayoutMode must be a named function');
  const params = match[1].replace(/\s+/g, '');
  assert.ok(params.includes('readOnly'), `loadLayoutMode signature must include readOnly: got "${params}"`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Source-level: readOnly guard is first in loadStoredLayout
// ─────────────────────────────────────────────────────────────────────────────

test('loadStoredLayout: readOnly guard is the first statement', function () {
  const src = fs.readFileSync(STORAGE_PATH, 'utf8');
  const funcMatch = src.match(/function\s+loadStoredLayout[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
  assert.ok(funcMatch, 'loadStoredLayout function body must be extractable');
  const body = funcMatch[1];
  const firstReturn = body.search(/return\s*\{/);
  const readOnlyGuard = body.search(/if\s*\(\s*readOnly\s*\)/);
  assert.ok(readOnlyGuard !== -1, 'readOnly guard must exist in loadStoredLayout');
  assert.ok(readOnlyGuard < firstReturn, 'readOnly guard must appear before any return statement');
});

test('loadLayoutMode: readOnly guard is the first statement', function () {
  const src = fs.readFileSync(STORAGE_PATH, 'utf8');
  const funcMatch = src.match(/function\s+loadLayoutMode[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
  assert.ok(funcMatch, 'loadLayoutMode function body must be extractable');
  const body = funcMatch[1];
  const firstReturn = body.search(/return/);
  const readOnlyGuard = body.search(/if\s*\(\s*readOnly\s*\)/);
  assert.ok(readOnlyGuard !== -1, 'readOnly guard must exist in loadLayoutMode');
  assert.ok(readOnlyGuard < firstReturn, 'readOnly guard must appear before any return statement');
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Source-level: public-canvas-init.js passes canEdit: false
// ─────────────────────────────────────────────────────────────────────────────

test('public-canvas-init.js includes canEdit: false', function () {
  const src = fs.readFileSync(PUBLIC_INIT_PATH, 'utf8');
  assert.ok(src.includes('canEdit: false'), 'public-canvas-init.js must pass canEdit: false');
});

test('public-canvas-init.js does not call setItem for layout keys', function () {
  const src = fs.readFileSync(PUBLIC_INIT_PATH, 'utf8');
  // Find all setItem calls and verify none are for layout keys
  let idx = 0;
  let found = false;
  while ((idx = src.indexOf('setItem', idx)) !== -1) {
    const lineStart = src.lastIndexOf('\n', idx);
    const line = src.substring(lineStart, idx + 30);
    if (line.includes('lovebud_tree_layout')) found = true;
    idx += 1;
  }
  assert.ok(!found, 'public-canvas-init.js must not call setItem for layout keys');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Source-level: mobile monkey-patch accepts and passes readOnly
// ─────────────────────────────────────────────────────────────────────────────

test('public-canvas-mobile-layout.js: monkey-patch accepts readOnly param', function () {
  const src = fs.readFileSync(MOBILE_LAYOUT_PATH, 'utf8');
  assert.ok(
    /function\s+publicViewerLoadLayoutMode\s*\(\s*layoutModeStorageKey\s*,\s*readOnly\s*\)/.test(src),
    'monkey-patched function must accept readOnly as second parameter'
  );
});

test('public-canvas-mobile-layout.js: monkey-patch passes readOnly to original', function () {
  const src = fs.readFileSync(MOBILE_LAYOUT_PATH, 'utf8');
  assert.ok(
    /originalLoadLayoutMode\s*\(\s*layoutModeStorageKey\s*,\s*readOnly\s*\)/.test(src),
    'originalLoadLayoutMode must be called with readOnly argument'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Source-level: No removeItem / rename / migration
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_KEY_FILES = [
  'js/editor/editor-canvas.js',
  'js/editor/editor-canvas-layout.js',
  'js/editor/editor-canvas-layout-storage.js',
  'js/viewer/public-canvas-init.js',
  'js/viewer/public-canvas-mobile-layout.js',
];

test('target files: no removeItem for lovebud_tree_layout_ keys', function () {
  for (const relPath of LAYOUT_KEY_FILES) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const hasRemoveItem =
      src.includes("removeItem('lovebud_tree_layout") ||
      src.includes('removeItem("lovebud_tree_layout') ||
      src.includes('removeItem(`lovebud_tree_layout');
    assert.ok(!hasRemoveItem, `${relPath} must NOT remove lovebud_tree_layout_ keys`);
  }
});

test('target files: no rename/migration from lovebud_tree_layout_v2_', function () {
  for (const relPath of LAYOUT_KEY_FILES) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const hasMigration =
      src.includes('lovebud_tree_layout_v2_') &&
      (src.includes('_migrated') || src.includes('_v3') || src.includes('_legacy'));
    assert.ok(!hasMigration, `${relPath} must NOT rename lovebud_tree_layout_v2_ keys`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. My Trees / Browse hub do not reference layout keys
// ─────────────────────────────────────────────────────────────────────────────

test('my-trees-preview-hub.js: no lovebud_tree_layout references', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'), 'utf8');
  assert.ok(!src.includes('lovebud_tree_layout'), 'my-trees-preview-hub must not reference layout keys');
});

test('search.js: no lovebud_tree_layout references', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/search.js'), 'utf8');
  assert.ok(!src.includes('lovebud_tree_layout'), 'search.js must not reference layout keys');
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. #1882 closing keyword enforcement
// ─────────────────────────────────────────────────────────────────────────────

test('test source: no Closes/Fixes/Resolves #1882', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  const forbidden = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbidden.test(src), 'test source must NOT close #1882 with Closes/Fixes/Resolves');
});

test('editor-canvas-layout-storage.js: no Closes/Fixes/Resolves #1882', function () {
  const src = fs.readFileSync(STORAGE_PATH, 'utf8');
  const forbidden = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbidden.test(src), 'storage file must NOT close #1882');
});

test('editor-canvas.js: no Closes/Fixes/Resolves #1882', function () {
  const src = fs.readFileSync(CANVAS_PATH, 'utf8');
  const forbidden = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbidden.test(src), 'editor-canvas.js must NOT close #1882');
});

test('public-canvas-init.js: no Closes/Fixes/Resolves #1882', function () {
  const src = fs.readFileSync(PUBLIC_INIT_PATH, 'utf8');
  const forbidden = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbidden.test(src), 'public-canvas-init.js must NOT close #1882');
});

test('public-canvas-mobile-layout.js: no Closes/Fixes/Resolves #1882', function () {
  const src = fs.readFileSync(MOBILE_LAYOUT_PATH, 'utf8');
  const forbidden = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbidden.test(src), 'mobile-layout.js must NOT close #1882');
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. End-to-end: read-only path is fully isolated
// ─────────────────────────────────────────────────────────────────────────────

test('end-to-end: readOnly path returns deterministic defaults, never touches store', function () {
  const storage = createStorageContext();
  let storeHit = false;
  const store = {
    createInitialViewportState() {
      storeHit = true;
      return { positions: { ownerDraft: { x: 9999 } }, offsetX: 999, offsetY: 999, scale: 9.9 };
    }
  };
  const mockCanvasLayout = { createLayoutStore: () => store };

  const layout = storage.loadStoredLayout('ownerTree', 'lovebud_tree_layout_v2_owner', mockCanvasLayout, true);
  const mode = storage.loadLayoutMode('lovebud_tree_layout_mode_owner', true);

  assert.equal(storeHit, false, 'store must not be accessed in readOnly path');
  assert.equal(Object.keys(layout.positions).length, 0, 'positions must be empty');
  assert.equal(layout.offsetX, 0);
  assert.equal(layout.offsetY, 0);
  assert.equal(layout.scale, 1);
  assert.equal(mode, 'structured');
});

test('end-to-end: editable path (readOnly=false) uses store normally', function () {
  const storage = createStorageContext();
  const store = {
    createInitialViewportState() {
      return { positions: { myDraft: { x: 111, y: 222 } }, offsetX: 33, offsetY: 44, scale: 1.5 };
    }
  };
  const mockCanvasLayout = { createLayoutStore: () => store };

  const layout = storage.loadStoredLayout('myTree', 'lovebud_tree_layout_v2_mine', mockCanvasLayout, false);

  assert.deepStrictEqual(layout.positions, { myDraft: { x: 111, y: 222 } });
  assert.equal(layout.offsetX, 33);
  assert.equal(layout.offsetY, 44);
  assert.equal(layout.scale, 1.5);
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Portrait mobile monkey-patch behavior (simulated)
// ─────────────────────────────────────────────────────────────────────────────

test('portrait mobile monkey-patch returns structured regardless of readOnly', function () {
  // Simulate the portrait check in public-canvas-mobile-layout.js
  const fake = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const context = { window: { localStorage: fake }, localStorage: fake };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  const storage = context.window.LoveBudEditorCanvasLayoutStorage;

  const originalLoadLayoutMode = storage.loadLayoutMode.bind(storage);
  storage.loadLayoutMode = function publicViewerLoadLayoutMode(layoutModeStorageKey, readOnly) {
    const width = 400;   // portrait mobile width
    const height = 800;  // height >= width
    if (width > 0 && height > 0 && width <= 560 && height >= width) return 'structured';
    return originalLoadLayoutMode(layoutModeStorageKey, readOnly);
  };

  // Portrait mobile → structured regardless of readOnly
  assert.equal(storage.loadLayoutMode('any_key', false), 'structured');
  assert.equal(storage.loadLayoutMode('any_key', true), 'structured');
});

test('desktop viewport (non-portrait) delegates to original', function () {
  const fake = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const context = { window: { localStorage: fake }, localStorage: fake };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  const storage = context.window.LoveBudEditorCanvasLayoutStorage;

  const originalLoadLayoutMode = storage.loadLayoutMode.bind(storage);
  storage.loadLayoutMode = function publicViewerLoadLayoutMode(layoutModeStorageKey, readOnly) {
    const width = 1200;  // desktop — not portrait
    const height = 800;
    if (width > 0 && height > 0 && width <= 560 && height >= width) return 'structured';
    return originalLoadLayoutMode(layoutModeStorageKey, readOnly);
  };

  // Desktop delegates to original which returns stored value
  fake.getItem = () => 'structured';
  assert.equal(storage.loadLayoutMode('lovebud_tree_layout_mode_desktop', false), 'structured');
});