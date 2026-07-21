/**
 * #3581 — pure layout policy matrix + storage isolation contract.
 * No network. No secrets. VM + source checks only for policy module.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-policy.js');
const STORAGE_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js');
const CANVAS_PATH = path.join(ROOT, 'js/editor/editor-canvas.js');
const EDITOR_PATH = path.join(ROOT, 'js/editor.js');
const TOPBAR_PATH = path.join(ROOT, 'js/editor/templates/editor-canvas-topbar-template.js');
const PUBLIC_TOPBAR_PATH = path.join(ROOT, 'js/viewer/public-viewer-canvas-topbar-template.js');

function loadPolicy() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(POLICY_PATH, 'utf8'), context);
  return context.window.LoveBudEditorCanvasLayoutPolicy;
}

function loadStorage(localStorageImpl) {
  const context = {
    window: {},
    localStorage: localStorageImpl
  };
  context.window.localStorage = localStorageImpl;
  // Storage module references bare localStorage (not window.localStorage).
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), context);
  assert.ok(
    context.window.LoveBudEditorCanvasLayoutStorage,
    'LoveBudEditorCanvasLayoutStorage must register on window'
  );
  return context.window.LoveBudEditorCanvasLayoutStorage;
}

test('#3581 policy: public view is ephemeral structured', () => {
  const p = loadPolicy().resolveLayoutPolicy({
    canEditTree: false,
    interactionMode: 'view',
    authority: 'public'
  });
  assert.equal(p.storageScope, 'ephemeral_appreciation');
  assert.equal(p.initialLayoutMode, 'structured');
  assert.equal(p.layoutReadOnly, true);
  assert.equal(p.allowNodeDrag, false);
  assert.equal(p.allowPersistMode, false);
  assert.equal(p.allowPersistPositions, false);
});

test('#3581 policy: owner view (appreciation) is ephemeral structured', () => {
  const p = loadPolicy().resolveLayoutPolicy({
    canEditTree: true,
    interactionMode: 'view',
    authority: 'owner'
  });
  assert.equal(p.storageScope, 'ephemeral_appreciation');
  assert.equal(p.initialLayoutMode, 'structured');
  assert.equal(p.layoutReadOnly, true);
  assert.equal(p.allowNodeDrag, false);
  assert.equal(p.allowPersistMode, false);
  assert.equal(p.allowPersistPositions, false);
});

test('#3581 policy: owner edit restores preference and may persist', () => {
  const p = loadPolicy().resolveLayoutPolicy({
    canEditTree: true,
    interactionMode: 'edit',
    authority: 'owner'
  });
  assert.equal(p.storageScope, 'owner_edit_local');
  assert.equal(p.initialLayoutMode, 'restore_owner_preference');
  assert.equal(p.layoutReadOnly, false);
  assert.equal(p.allowNodeDrag, true);
  assert.equal(p.allowPersistMode, true);
  assert.equal(p.allowPersistPositions, true);
});

test('#3581 policy: non-owner requested edit stays ephemeral', () => {
  const p = loadPolicy().resolveLayoutPolicy({
    canEditTree: false,
    interactionMode: 'edit',
    authority: 'public'
  });
  assert.equal(p.storageScope, 'ephemeral_appreciation');
  assert.equal(p.layoutReadOnly, true);
  assert.equal(p.allowNodeDrag, false);
});

test('#3581 policy: drag only in free + allowNodeDrag', () => {
  const api = loadPolicy();
  const ownerEdit = api.resolveLayoutPolicy({
    canEditTree: true,
    interactionMode: 'edit',
    authority: 'owner'
  });
  assert.equal(api.canDragNodes(ownerEdit, 'free'), true);
  assert.equal(api.canDragNodes(ownerEdit, 'structured'), false);
  const ownerView = api.resolveLayoutPolicy({
    canEditTree: true,
    interactionMode: 'view',
    authority: 'owner'
  });
  assert.equal(api.canDragNodes(ownerView, 'free'), false);
});

test('#3581 policy: invalid stored mode normalizes to structured', () => {
  const api = loadPolicy();
  assert.equal(api.normalizeStoredMode('organic'), 'structured');
  assert.equal(api.normalizeStoredMode('hierarchy'), 'structured');
  assert.equal(api.normalizeStoredMode('free'), 'free');
  assert.equal(api.normalizeStoredMode('structured'), 'structured');
});

test('#3581 storage: readOnly blocks get and returns structured mode', () => {
  let getCount = 0;
  let setCount = 0;
  const ls = {
    getItem() {
      getCount += 1;
      return 'free';
    },
    setItem() {
      setCount += 1;
    },
    removeItem() {}
  };
  const storage = loadStorage(ls);
  const layout = storage.loadStoredLayout('t1', 'lovebud_tree_layout_v2_t1', null, true);
  assert.ok(layout && typeof layout.positions === 'object', 'positions object required');
  assert.equal(Object.keys(layout.positions).length, 0);
  assert.equal(layout.offsetX, 0);
  assert.equal(storage.loadLayoutMode('lovebud_tree_layout_mode_t1', true), 'structured');
  assert.equal(getCount, 0, 'readOnly must not touch localStorage');
  storage.persistLayoutMode('free', 'lovebud_tree_layout_mode_t1', false);
  storage.persistStoredPositions(
    { layoutMode: 'free', positions: { a: { x: 1, y: 2 } }, offsetX: 9, offsetY: 8, scale: 2 },
    't1',
    'lovebud_tree_layout_v2_t1',
    null,
    false
  );
  assert.equal(setCount, 0, 'persist blocked when canEdit/persist flag false');
});

test('#3581 storage: owner-edit persist writes free mode and positions', () => {
  const store = {};
  const ls = {
    getItem(k) {
      return store[k] || null;
    },
    setItem(k, v) {
      store[k] = String(v);
    },
    removeItem(k) {
      delete store[k];
    }
  };
  const storage = loadStorage(ls);
  storage.persistLayoutMode('free', 'lovebud_tree_layout_mode_t1', true);
  storage.persistStoredPositions(
    {
      layoutMode: 'free',
      positions: { m1: { x: 10, y: 20 } },
      offsetX: 3,
      offsetY: 4,
      scale: 1.2
    },
    't1',
    'lovebud_tree_layout_v2_t1',
    null,
    true
  );
  assert.equal(store['lovebud_tree_layout_mode_t1'], 'free');
  const parsed = JSON.parse(store['lovebud_tree_layout_v2_t1']);
  assert.equal(parsed.positions.m1.x, 10);
  assert.equal(parsed.offsetX, 3);
  // structured must not persist positions
  storage.persistStoredPositions(
    { layoutMode: 'structured', positions: { m1: { x: 99, y: 99 } }, offsetX: 0, offsetY: 0, scale: 1 },
    't1',
    'lovebud_tree_layout_v2_t1',
    null,
    true
  );
  const after = JSON.parse(store['lovebud_tree_layout_v2_t1']);
  assert.equal(after.positions.m1.x, 10, 'structured must not overwrite free positions');
});

test('#3581 source: canvas uses layout policy readOnly (not bare canEdit===false only)', () => {
  const src = fs.readFileSync(CANVAS_PATH, 'utf8');
  assert.match(src, /LoveBudEditorCanvasLayoutPolicy|resolveLayoutPolicy|layoutPolicy\.layoutReadOnly/);
  assert.match(src, /syncInteractionLayoutMode/);
  assert.match(src, /layoutPolicy\.layoutReadOnly\s*===\s*true/);
  assert.doesNotMatch(
    src,
    /storageUtils\.loadStoredLayout\s*\(\s*treeId\s*,\s*layoutStorageKey\s*,\s*canvasLayout\s*,\s*canEdit\s*===\s*false\s*\)/
  );
});

test('#3581 source: editor.js sets interaction mode before createEditorCanvas', () => {
  const src = fs.readFileSync(EDITOR_PATH, 'utf8');
  const createIdx = src.indexOf('createEditorCanvas({');
  const modeIdx = src.indexOf('initialInteractionMode');
  assert.ok(modeIdx !== -1 && createIdx !== -1);
  assert.ok(modeIdx < createIdx, 'initialInteractionMode must be computed before createEditorCanvas');
  assert.match(src, /interactionMode:\s*initialInteractionMode/);
  assert.match(src, /syncInteractionLayoutMode/);
});

test('#3581 source: topbars static first paint is structured (정리된 트리)', () => {
  const editorTop = fs.readFileSync(TOPBAR_PATH, 'utf8');
  const publicTop = fs.readFileSync(PUBLIC_TOPBAR_PATH, 'utf8');
  assert.match(editorTop, /layoutModeToggleLabel[^>]*>\s*정리된 트리/);
  assert.match(editorTop, /account_tree/);
  assert.match(editorTop, /aria-pressed="true"/);
  assert.match(publicTop, /정리된 트리/);
  assert.match(publicTop, /account_tree/);
  assert.doesNotMatch(
    editorTop,
    /layoutModeToggleLabel[^>]*>\s*자유 배치/
  );
});

test('#3581 source: policy module file exists and exports resolver', () => {
  assert.ok(fs.existsSync(POLICY_PATH));
  const src = fs.readFileSync(POLICY_PATH, 'utf8');
  assert.match(src, /resolveLayoutPolicy/);
  assert.match(src, /ephemeral_appreciation/);
  assert.match(src, /owner_edit_local/);
});
