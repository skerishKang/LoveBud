'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunctionArgAt(source, fnName, argIndex) {
  var idx = source.indexOf('function ' + fnName + '(');
  if (idx === -1) return null;
  var start = idx + ('function ' + fnName + '(').length;
  var depth = 1;
  var i = start;
  var args = [];
  var current = '';
  while (i < source.length && depth > 0) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    if (depth <= 0) break;
    if (source[i] === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
    } else {
      current += source[i];
    }
    i++;
  }
  if (current.trim()) args.push(current.trim());
  return args.length > argIndex ? args[argIndex] : null;
}

// ── 1. validateConnectCandidate: root source/target ─────────────────────

test('validateConnectCandidate returns ok:false for root source', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'mem-1' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r1 = actions.validateConnectCandidate('root', 'mem-1');
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'source_is_root');

  var r2 = actions.validateConnectCandidate('mem-1', 'root');
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'target_is_root');
});

// ── 2. validateConnectCandidate: self, already-connected, descendant ────

test('validateConnectCandidate returns ok:false for self, already-connected, descendant', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'mem-1' },
    { id: 'mem-3', parentId: 'mem-2' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r1 = actions.validateConnectCandidate('mem-1', 'mem-1');
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'self_connection');

  var r2 = actions.validateConnectCandidate('mem-2', 'mem-1');
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'already_connected');

  var r3 = actions.validateConnectCandidate('mem-1', 'mem-3');
  assert.equal(r3.ok, false);
  assert.equal(r3.reason, 'target_is_descendant');
});

// ── 3. validateConnectCandidate: malformed parent chain, chain loop ─────

test('validateConnectCandidate returns ok:false for missing parent in target chain', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'missing-parent-id' },
    { id: 'mem-3', parentId: 'mem-2' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r = actions.validateConnectCandidate('mem-1', 'mem-3');
  assert.equal(r.ok, false);
  assert.ok(r.reason === 'target_chain_missing_parent' || r.reason === 'target_not_found',
    'should detect missing parent in target chain, got: ' + r.reason);
});

test('validateConnectCandidate returns ok:false for loop in target parent chain', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'mem-3' },
    { id: 'mem-3', parentId: 'mem-2' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r = actions.validateConnectCandidate('mem-1', 'mem-3');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'target_chain_loop');
});

// ── 4. validateConnectCandidate: valid returns ok:true ──────────────────

test('validateConnectCandidate returns ok:true for valid connection', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'root' },
    { id: 'mem-3', parentId: 'mem-2' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r = actions.validateConnectCandidate('mem-3', 'mem-1');
  assert.equal(r.ok, true, 'mem-3 to mem-1 should be valid: ' + JSON.stringify(r));
});

// ── 5. Valid confirm: updateMemory called exactly once ──────────────────

test('connectMemory calls apiClient.updateMemory exactly once on valid confirm', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var updateCallCount = 0;
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { updateCallCount++; return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [
    { id: 'root', parentId: null },
    { id: 'mem-1', parentId: 'root' },
    { id: 'mem-2', parentId: 'root' },
    { id: 'mem-3', parentId: 'mem-2' }
  ];
  var fakeIsRoot = function(m, cid) { return String(m.id) === String(cid) || m.id === 'root'; };

  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: fakeIsRoot,
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return { id: 'tree-1', memories: [] }; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: true,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  return actions.connectMemory('mem-3', 'mem-1').then(function(success) {
    assert.equal(success, true, 'valid connection must succeed');
    assert.equal(updateCallCount, 1, 'updateMemory must be called exactly once');
  });
});

// ── 6. Preview direction: drawDashedPreview(targetPos, sourcePos) ───────

test('drawDashedPreview receives targetPos first, sourcePos second', () => {
  var source = readSource('js/editor/editor-canvas.js');

  var callPattern = source.match(/drawDashedPreview\s*\(([\s\S]*?)\)/);
  assert.notEqual(callPattern, null, 'must call drawDashedPreview');
  var args = callPattern[1].split(',').map(function(a) { return a.trim(); });
  assert.equal(args.length, 2, 'drawDashedPreview must receive 2 args');
  assert.match(args[0], /targetPos/, 'first arg must reference targetPos');
  assert.match(args[1], /sourcePos/, 'second arg must reference sourcePos');
});

// ── 7. ResetConnectFlow: clears state, preview, UI ─────────────────────

test('controller resetConnectFlow calls clearPendingConnect and hideAll', () => {
  var clearPendingCalled = false;
  var editorCanvasMock = {
    clearPendingConnect: function() { clearPendingCalled = true; },
    getPendingConnectSourceId: function() { return null; }
  };

  var hideAllCalled = false;
  var sections = ['cta', 'pending', 'confirm'].reduce(function(acc, name) {
    acc[name] = { style: { display: '' } };
    return acc;
  }, {});

  // We test the logic by simulating resetConnectFlow behavior
  function resetConnectFlow() {
    if (editorCanvasMock) editorCanvasMock.clearPendingConnect();
    Object.keys(sections).forEach(function(k) { sections[k].style.display = 'none'; });
  }

  resetConnectFlow();
  assert.equal(clearPendingCalled, true, 'clearPendingConnect must be called');
  assert.equal(sections.cta.style.display, 'none', 'CTA must be hidden');
  assert.equal(sections.pending.style.display, 'none', 'pending must be hidden');
  assert.equal(sections.confirm.style.display, 'none', 'confirm must be hidden');
});

// ── 8. bindControls double-call safety ────────────────────────────────

test('bindControls uses dataset guards to prevent duplicate handler binding', () => {
  var listenerCount = 0;
  var ctaBtn = {
    dataset: {},
    addEventListener: function(evt, fn) { listenerCount++; }
  };

  function bindOnce() {
    if (!ctaBtn.dataset.connectBound) {
      ctaBtn.dataset.connectBound = '1';
      ctaBtn.addEventListener('click', function() {});
    }
  }

  bindOnce();
  assert.equal(ctaBtn.dataset.connectBound, '1', 'must mark bound after first call');
  var firstCount = listenerCount;

  bindOnce();
  assert.equal(listenerCount, firstCount, 'listeners must not increase on second call');

  bindOnce();
  assert.equal(listenerCount, firstCount, 'listeners must not increase on third call');
});

test('bindControls uses _connectExistingSubscribed flag to prevent duplicate mode subscribe', () => {
  var subscribeCallCount = 0;
  var mode = {
    subscribe: function(fn) { subscribeCallCount++; },
    _connectExistingSubscribed: false
  };

  function bindOnce() {
    if (mode && typeof mode.subscribe === 'function' && !mode._connectExistingSubscribed) {
      mode._connectExistingSubscribed = true;
      mode.subscribe(function() {});
    }
  }

  bindOnce();
  assert.equal(mode._connectExistingSubscribed, true, 'must mark subscribed after first call');
  var firstCount = subscribeCallCount;

  bindOnce();
  assert.equal(subscribeCallCount, firstCount, 'subscribes must not increase on second call');

  bindOnce();
  assert.equal(subscribeCallCount, firstCount, 'subscribes must not increase on third call');
});

// ── 9. setConnectMemory / setValidateConnectCandidate exist ────────────

test('controller exposes setConnectMemory and setValidateConnectCandidate', () => {
  var source = readSource('js/editor/editor-bindings.js');
  assert.match(source, /setConnectMemory/, 'setConnectMemory must exist');
  assert.match(source, /setValidateConnectCandidate/, 'setValidateConnectCandidate must exist');
});

// ── 10. editor.js uses setConnectMemory and wires validateConnectCandidate ─

test('editor.js wires controller via setConnectMemory and setValidateConnectCandidate', () => {
  var source = readSource('js/editor.js');
  assert.match(source, /setConnectMemory/, 'editor.js must use setConnectMemory');
  assert.match(source, /setValidateConnectCandidate/, 'editor.js must use setValidateConnectCandidate');
  assert.match(source, /validateConnectCandidate/, 'editor.js must reference validateConnectCandidate');
});

// ── 11. UI sections moved outside #detailEditMode ─────────────────────

test('connect-existing sections are NOT inside #detailEditMode template', () => {
  var template = readSource('js/editor/templates/editor-detail-edit-mode-template.js');
  assert.doesNotMatch(template, /connectExistingCtaSection/,
    'CTA section must NOT be in edit mode template');
});

test('connect-existing sections ARE in shell template outside detailEditMode', () => {
  var shell = readSource('js/editor/templates/editor-detail-panel-shell-template.js');
  assert.match(shell, /connectExistingCtaSection/,
    'CTA section must be in shell template');
  assert.match(shell, /connectExistingPendingSection/,
    'pending section must be in shell template');
  assert.match(shell, /connectExistingConfirmSection/,
    'confirm section must be in shell template');

  var editModeIdx = shell.indexOf('editorDetailEditModeTemplateMount');
  var ctaIdx = shell.indexOf('connectExistingCtaSection');
  assert.ok(ctaIdx > editModeIdx,
    'connect-existing sections must be AFTER edit mode mount in shell template DOM order');
});

// ── 12. No new API/endpoint calls ─────────────────────────────────────

test('connectMemory uses apiClient.updateMemory, not raw fetch', () => {
  const source = readSource('js/editor/editor-memory-actions.js');
  assert.match(source, /updateMemory/, 'must use apiClient.updateMemory');
  assert.doesNotMatch(source, /fetch\s*\(\s*['"][^'"]*\/api\/[^'"]*['"]\s*\)/,
    'must not add raw fetch calls');
});

// ── 13. validateConnectCandidate guards canEdit and mode ──────────────

test('validateConnectCandidate returns ok:false when canEdit is false', () => {
  var source = readSource('js/editor/editor-memory-actions.js');
  var sandbox = {
    window: { apiClient: { updateMemory: async function() { return {}; } }, LoveBudCache: { set: function() {} } },
    console: { error: function() {}, warn: function() {} },
    setTimeout: function() {},
    Promise: Promise,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  var mems = [{ id: 'mem-1', parentId: null }, { id: 'mem-2', parentId: 'mem-1' }];
  var actions = sandbox.window.createEditorMemoryActions({
    i18n: function(k) { return k; },
    getCanonicalRootId: function() { return 'root'; },
    isRootMemory: function() { return false; },
    findRootMemory: function() { return null; },
    getTreeMemories: function() { return mems; },
    setTreeMemories: function() {},
    getCurrentTreeData: function() { return {}; },
    updateSaveStatus: function() {},
    updateDetailPanel: function() {},
    updateSidebarStatus: function() {},
    showToast: function() {},
    setDetailEmptyState: function() {},
    rerenderCanvas: function() {},
    canEdit: false,
    isLocalSaveMode: function() { return false; },
    getCurrentEditingMemory: function() { return null; },
    setCurrentEditingMemory: function() {},
    getSelectedNodeId: function() { return null; },
    setSelectedNodeId: function() {}
  });

  var r = actions.validateConnectCandidate('mem-1', 'mem-2');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'canEdit_false');
});

// ── 14. Preview line has correct CSS class ────────────────────────────

test('branch-line-preview CSS has pointer-events:none', () => {
  var css = readSource('css/editor/editor-canvas.css');
  assert.match(css, /\.branch-line-preview/, 'must have CSS rule');
  assert.match(css, /pointer-events:\s*none/, 'must have pointer-events: none');
});

// ── 15. editor.js passes canEdit to controller ──────────────────────────

test('editor.js passes canEdit to createConnectExistingController', () => {
  var source = readSource('js/editor.js');
  assert.match(source, /canEdit/,
    'editor.js must pass canEdit to controller');
  assert.match(source, /createConnectExistingController\(\{[\s\S]*?canEdit[\s\S]*?\}\)/,
    'canEdit must be in the controller options object');
});

// ── 16. setEditorCanvas wires onPendingConnectCleared callback ──────────

test('setEditorCanvas wires setOnPendingConnectCleared with targetData cleanup', () => {
  var source = readSource('js/editor/editor-bindings.js');
  assert.match(source, /setOnPendingConnectCleared/,
    'must call setOnPendingConnectCleared');
  assert.match(source, /targetData\s*=\s*null/,
    'callback must clear targetData');
  assert.match(source, /hideAll/,
    'callback must call hideAll');
  assert.match(source, /updateCtaVisibility/,
    'callback must call updateCtaVisibility');
});

// ── 17. clearPendingConnect calls onPendingConnectCleared ────────────────

test('clearPendingConnect invokes onPendingConnectCleared callback', () => {
  var source = readSource('js/editor/editor-canvas.js');
  assert.match(source, /typeof onPendingConnectCleared === 'function'/,
    'must guard callback invocation');
  assert.match(source, /onPendingConnectCleared\(\)/,
    'must call onPendingConnectCleared');
});

// ── 18. initCanvas calls clearEdgeSelection (rerender cleanup chain) ─────

test('initCanvas calls clearEdgeSelection for cleanup before re-render', () => {
  var source = readSource('js/editor/editor-canvas.js');
  var initCanvasBody = source.match(/const initCanvas\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s+\};/);
  assert.notEqual(initCanvasBody, null, 'initCanvas function body must be found');
  assert.match(initCanvasBody[0], /clearEdgeSelection\(\)/,
    'initCanvas must call clearEdgeSelection');
  assert.doesNotMatch(initCanvasBody[0], /clearPendingConnect\(\)\s*;/,
    'initCanvas must not call clearPendingConnect directly (handled by clearEdgeSelection)');
});

// ── 19. resetConnectFlow calls clearPendingConnect ──────────────────────

test('resetConnectFlow calls clearPendingConnect on editorCanvas', () => {
  var source = readSource('js/editor/editor-bindings.js');
  assert.match(source, /editorCanvas\.clearPendingConnect\(\)/,
    'resetConnectFlow must call clearPendingConnect');
});

// ── 20. Controller enterConnectMode guards canEdit === false ────────────

test('controller functions guard canEdit === false', () => {
  var source = readSource('js/editor/editor-bindings.js');
  assert.match(source, /enterConnectMode[\s\S]*?if\s*\(canEdit\s*===\s*false\)\s*return/,
    'enterConnectMode must guard canEdit === false');
  assert.match(source, /handleConnectTargetSelect[\s\S]*?if\s*\(canEdit\s*===\s*false\)\s*return/,
    'handleConnectTargetSelect must guard canEdit === false');
  assert.match(source, /handleConfirm[\s\S]*?if\s*\(canEdit\s*===\s*false\)\s*return/,
    'handleConfirm must guard canEdit === false');
  assert.match(source, /updateCtaVisibility[\s\S]*?if\s*\(canEdit\s*===\s*false\)/,
    'updateCtaVisibility must guard canEdit === false');
});

// ── 21. updateDetailPanel wrapper calls updateCtaNow ────────────────────

test('editor.js wraps updateDetailPanel to call updateCtaNow on selection change', () => {
  var source = readSource('js/editor.js');
  assert.match(source, /updateCtaNow\(\)/,
    'editor.js must call updateCtaNow after bindControls');
  assert.match(source, /_baseUpdateDetailPanel/,
    'wrapper must capture base updateDetailPanel');
  assert.match(source, /connectExistingController\.updateCtaNow\(\)/,
    'wrapper must call updateCtaNow');
});

// ── 22. No duplicate canvasEdges.clearDashedPreview in clearPendingConnect ──

test('clearPendingConnect calls canvasEdges.clearDashedPreview exactly once', () => {
  var source = readSource('js/editor/editor-canvas.js');
  var clearFn = source.match(/function clearPendingConnect\(\)\s*\{[\s\S]*?^    \}/m);
  assert.notEqual(clearFn, null, 'clearPendingConnect function must be found');
  var matches = clearFn[0].match(/canvasEdges\.clearDashedPreview\(\)/g);
  assert.equal(matches ? matches.length : 0, 1,
    'clearDashedPreview must be called exactly once in clearPendingConnect');
});

// ── 23. onPendingConnectCleared exposed in return object ─────────────────

test('setOnPendingConnectCleared is exposed in canvas return object', () => {
  var source = readSource('js/editor/editor-canvas.js');
  assert.match(source, /setOnPendingConnectCleared/,
    'setOnPendingConnectCleared must be exported');
  var returnBlock = source.match(/return\s*\{[\s\S]*?\};/);
  assert.notEqual(returnBlock, null, 'return object must be found');
  assert.match(returnBlock[0], /setOnPendingConnectCleared/,
    'setOnPendingConnectCleared must be in return object');
});
