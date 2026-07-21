/**
 * #3582 pure persistence contract — production storage module in VM.
 * No second test-only persistence implementation.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const STORAGE_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js');
const LAYOUT_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout.js');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const AUTH_FIREBASE_PATH = path.join(ROOT, 'js/auth/auth-firebase.js');
const AUTH_JS_PATH = path.join(ROOT, 'js/auth.js');

function createMemoryLocalStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(String(k), String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    get length() {
      return map.size;
    },
    _map: map
  };
}

function loadProductionStorage(localStorage) {
  const context = {
    window: {},
    localStorage,
    console
  };
  context.window.localStorage = localStorage;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  // Also load layout store (createLayoutStore path)
  vm.runInContext(fs.readFileSync(LAYOUT_PATH, 'utf8'), context);
  return {
    storage: context.window.LoveBudEditorCanvasLayoutStorage,
    layout: context.window.LoveBudEditorCanvasLayout,
    localStorage
  };
}

/** Cross-realm safe deep equality (VM objects vs host objects). */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeep(actual, expected, message) {
  assert.deepEqual(cloneJson(actual), cloneJson(expected), message);
}

test('#3582 keys are tree-specific and stable', () => {
  const treeA = 'tree-A';
  const treeB = 'tree-B';
  assert.equal(`lovebud_tree_layout_v2_${treeA}`, 'lovebud_tree_layout_v2_tree-A');
  assert.equal(`lovebud_tree_layout_mode_${treeA}`, 'lovebud_tree_layout_mode_tree-A');
  assert.notEqual(`lovebud_tree_layout_v2_${treeA}`, `lovebud_tree_layout_v2_${treeB}`);
  assert.notEqual(`lovebud_tree_layout_mode_${treeA}`, `lovebud_tree_layout_mode_${treeB}`);
  // UID namespacing must not be required by production key contract
  const canvasSrc = fs.readFileSync(CANVAS_PATH, 'utf8');
  assert.match(canvasSrc, /lovebud_tree_layout_v2_/);
  assert.match(canvasSrc, /lovebud_tree_layout_mode_/);
  assert.doesNotMatch(canvasSrc, /lovebud_tree_layout_v3_/);
});

test('#3582 mode validation accepts free/structured only', () => {
  const ls = createMemoryLocalStorage();
  const { storage } = loadProductionStorage(ls);
  const modeKey = 'lovebud_tree_layout_mode_t1';
  storage.persistLayoutMode('free', modeKey, true);
  assert.equal(ls.getItem(modeKey), 'free');
  storage.persistLayoutMode('structured', modeKey, true);
  assert.equal(ls.getItem(modeKey), 'structured');
  storage.persistLayoutMode('banana', modeKey, true);
  assert.equal(ls.getItem(modeKey), 'structured', 'invalid mode must not overwrite');
  ls.setItem(modeKey, 'organic');
  assert.equal(storage.loadLayoutMode(modeKey, false), 'structured');
  assert.equal(storage.loadLayoutMode(modeKey, true), 'structured', 'readOnly always structured');
});

test('#3582 layout payload validation and neutral fallbacks', () => {
  const ls = createMemoryLocalStorage();
  const { storage } = loadProductionStorage(ls);
  const posKey = 'lovebud_tree_layout_v2_t1';

  ls.setItem(posKey, '{bad');
  assertDeep(storage.loadStoredLayout('t1', posKey, null, false), {
    positions: {},
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  ls.setItem(posKey, 'null');
  assertDeep(storage.loadStoredLayout('t1', posKey, null, false), {
    positions: {},
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  ls.setItem(posKey, JSON.stringify({ offsetX: 5 }));
  const missing = storage.loadStoredLayout('t1', posKey, null, false);
  assertDeep(missing.positions, {});
  assert.equal(missing.offsetX, 5);

  ls.setItem(
    posKey,
    JSON.stringify({ positions: { a: { x: 1, y: 2 } }, offsetX: 'x', offsetY: null, scale: 'nope' })
  );
  const bad = storage.loadStoredLayout('t1', posKey, null, false);
  assertDeep(bad.positions, { a: { x: 1, y: 2 } });
  assert.equal(bad.offsetX, 0);
  assert.equal(bad.offsetY, 0);
  assert.equal(bad.scale, 1);
});

test('#3582 structured does not overwrite free positions via persistStoredPositions', () => {
  const ls = createMemoryLocalStorage();
  const { storage } = loadProductionStorage(ls);
  const posKey = 'lovebud_tree_layout_v2_t1';
  const payload = {
    positions: { 'A-one': { x: 11, y: 22 } },
    offsetX: 3,
    offsetY: 4,
    scale: 1.5
  };
  ls.setItem(posKey, JSON.stringify(payload));
  storage.persistStoredPositions(
    {
      layoutMode: 'structured',
      positions: { 'A-one': { x: 999, y: 999 } },
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    't1',
    posKey,
    null,
    true
  );
  assert.equal(ls.getItem(posKey), JSON.stringify(payload));
});

test('#3582 free persist writes payload; canEdit false skips write', () => {
  const ls = createMemoryLocalStorage();
  const { storage } = loadProductionStorage(ls);
  const posKey = 'lovebud_tree_layout_v2_t1';
  storage.persistStoredPositions(
    {
      layoutMode: 'free',
      positions: { 'A-one': { x: 50, y: 60 } },
      offsetX: 1,
      offsetY: 2,
      scale: 1.25
    },
    't1',
    posKey,
    null,
    true
  );
  assertDeep(JSON.parse(ls.getItem(posKey)), {
    positions: { 'A-one': { x: 50, y: 60 } },
    offsetX: 1,
    offsetY: 2,
    scale: 1.25
  });

  const before = ls.getItem(posKey);
  storage.persistStoredPositions(
    {
      layoutMode: 'free',
      positions: { leak: { x: 1, y: 1 } },
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    't1',
    posKey,
    null,
    false
  );
  assert.equal(ls.getItem(posKey), before);
  storage.persistLayoutMode('structured', 'lovebud_tree_layout_mode_t1', false);
  assert.equal(ls.getItem('lovebud_tree_layout_mode_t1'), null);
});

test('#3582 getItem throw / setItem throw safe failure', () => {
  const ls = createMemoryLocalStorage({
    lovebud_tree_layout_v2_t1: JSON.stringify({
      positions: { keep: { x: 7, y: 8 } },
      offsetX: 1,
      offsetY: 1,
      scale: 1
    }),
    lovebud_tree_layout_mode_t1: 'free'
  });
  const { storage } = loadProductionStorage(ls);
  const posKey = 'lovebud_tree_layout_v2_t1';
  const modeKey = 'lovebud_tree_layout_mode_t1';

  const origGet = ls.getItem.bind(ls);
  ls.getItem = () => {
    throw new Error('get boom');
  };
  assertDeep(storage.loadStoredLayout('t1', posKey, null, false), {
    positions: {},
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });
  assert.equal(storage.loadLayoutMode(modeKey, false), 'structured');
  ls.getItem = origGet;

  const before = ls.getItem(posKey);
  const beforeMode = ls.getItem(modeKey);
  const origSet = ls.setItem.bind(ls);
  ls.setItem = () => {
    throw new Error('set boom');
  };
  storage.persistLayoutMode('structured', modeKey, true);
  storage.persistStoredPositions(
    {
      layoutMode: 'free',
      positions: { z: { x: 9, y: 9 } },
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    't1',
    posKey,
    null,
    true
  );
  ls.setItem = origSet;
  assert.equal(ls.getItem(posKey), before, 'write failure must not remove existing value');
  assert.equal(ls.getItem(modeKey), beforeMode);
});

test('#3582 read-only / appreciation does not read owner draft', () => {
  const ls = createMemoryLocalStorage({
    lovebud_tree_layout_v2_t1: JSON.stringify({
      positions: { leak: { x: 99, y: 99 } },
      offsetX: 9,
      offsetY: 9,
      scale: 2
    }),
    lovebud_tree_layout_mode_t1: 'free'
  });
  const { storage } = loadProductionStorage(ls);
  const loaded = storage.loadStoredLayout('t1', 'lovebud_tree_layout_v2_t1', null, true);
  assertDeep(loaded.positions, {});
  assert.equal(loaded.offsetX, 0);
  assert.equal(loaded.scale, 1);
  assert.equal(storage.loadLayoutMode('lovebud_tree_layout_mode_t1', true), 'structured');
});

test('#3582 createLayoutStore path tree isolation', () => {
  const ls = createMemoryLocalStorage();
  const { layout } = loadProductionStorage(ls);
  const storeA = layout.createLayoutStore('tree-A');
  const storeB = layout.createLayoutStore('tree-B');
  storeA.persist({
    positions: { 'A-one': { x: 1, y: 2 } },
    offsetX: 10,
    offsetY: 20,
    scale: 1.1
  });
  storeB.persist({
    positions: { 'B-one': { x: 3, y: 4 } },
    offsetX: 30,
    offsetY: 40,
    scale: 1.2
  });
  assert.equal(ls.getItem('lovebud_tree_layout_v2_tree-A').includes('A-one'), true);
  assert.equal(ls.getItem('lovebud_tree_layout_v2_tree-B').includes('B-one'), true);
  assert.equal(ls.getItem('lovebud_tree_layout_v2_tree-A').includes('B-one'), false);
  const a = storeA.createInitialViewportState();
  const b = storeB.createInitialViewportState();
  assertDeep(a.positions['A-one'], { x: 1, y: 2 });
  assertDeep(b.positions['B-one'], { x: 3, y: 4 });
  assert.equal(a.positions['B-one'], undefined);
});

test('#3582 logout boundary source does not remove layout keys', () => {
  const authFirebase = fs.readFileSync(AUTH_FIREBASE_PATH, 'utf8');
  const authJs = fs.readFileSync(AUTH_JS_PATH, 'utf8');
  assert.match(authFirebase, /clearAuthDependentCaches/);
  assert.match(authFirebase, /function signOut/);
  assert.doesNotMatch(authFirebase, /lovebud_tree_layout_v2_/);
  assert.doesNotMatch(authFirebase, /lovebud_tree_layout_mode_/);
  assert.doesNotMatch(authJs, /lovebud_tree_layout_v2_/);
  assert.doesNotMatch(authJs, /lovebud_tree_layout_mode_/);
  // clearPrivateCaches is optional call; must not be a layout wipe of known keys in-source
  assert.match(authFirebase, /clearPrivateCaches/);
});
