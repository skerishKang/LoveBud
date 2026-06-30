/**
 * Contract Test: Editor Moment Save Feedback
 *
 * Verifies moment-edit save flow UX guarantees:
 * - Busy/disabled state during save
 * - Duplicate-submit prevention
 * - Confirmed success closes edit mode and refreshes panels
 * - API failure keeps edit mode open and restores CTA
 * - Retry after failure triggers a new API call
 * - No-change guard prevents API write
 * - Plain Enter in memo textarea does NOT trigger save
 * - Raw provider/API error text is not forwarded to user feedback
 * - Response ID and field acknowledgement guards are maintained
 * - #1882 closing keyword guard
 *
 * Refs #3070
 * Refs #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../../');
const ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-bindings.js');

// ── Fake DOM helpers ──────────────────────────────────────────────────────

function makeFakeElement(id, tag = 'button') {
  return {
    id,
    tagName: tag.toUpperCase(),
    disabled: false,
    textContent: id === 'saveEditBtn' ? '저장' : '',
    value: '',
    dataset: {},
    style: {},
    getAttribute: function(attr) { return this._attrs && this._attrs[attr]; },
    setAttribute: function(attr, val) { this._attrs = this._attrs || {}; this._attrs[attr] = val; },
    removeAttribute: function(attr) { if (this._attrs) delete this._attrs[attr]; },
    _attrs: {},
    _listeners: {},
    addEventListener: function(evt, fn) {
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    },
    dispatchEvent: function(evt) {
      const handlers = this._listeners[evt.type] || [];
      handlers.forEach(fn => fn(evt));
    },
    closest: function() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
}

function makeFakeDOM() {
  const els = {
    saveEditBtn: makeFakeElement('saveEditBtn', 'button'),
    cancelEditBtn: makeFakeElement('cancelEditBtn', 'button'),
    deleteMemoryBtn: makeFakeElement('deleteMemoryBtn', 'button'),
    detailEditMode: makeFakeElement('detailEditMode', 'div'),
    detailViewMode: makeFakeElement('detailViewMode', 'div'),
    editTitleInput: makeFakeElement('editTitleInput', 'input'),
    editMemoInput: makeFakeElement('editMemoInput', 'textarea'),
    editTagsInput: makeFakeElement('editTagsInput', 'input'),
    editSourceUrlInput: makeFakeElement('editSourceUrlInput', 'input'),
    editStartTimeInput: null,
    editEndTimeInput: null,
  };
  els.editTitleInput.value = 'Test Title';
  els.editMemoInput.value = 'Test Memo';
  els.editTagsInput.value = '';
  els.editSourceUrlInput.value = '';
  return els;
}

// ── Module loader ─────────────────────────────────────────────────────────

function loadActionsInSandbox(dom, deps) {
  const code = fs.readFileSync(ACTIONS_PATH, 'utf8');

  const sandbox = {
    window: {
      apiClient: deps.apiClient || null,
      LoveBudEditorInteractionMode: {
        isEditMode: () => true,
        setMode: () => {},
        subscribe: () => {}
      },
      LoveBudMedia: null,
      LoveBudEditorMemoryFormTime: null,
      LoveBudCache: null,
      createEditorMemoryActions: undefined
    },
    document: {
      getElementById: (id) => dom[id] || null,
      createElement: () => makeFakeElement('_created', 'div'),
    },
    console: { error: () => {}, log: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const factory = sandbox.window.createEditorMemoryActions || sandbox.createEditorMemoryActions;
  return factory(deps);
}

function makeBaseDeps(overrides = {}) {
  const memory = { id: 'mem-1', title: 'Test Title', memo: 'Test Memo', emotionTags: [], sourceUrl: '' };
  let currentEditingMemory = { ...memory };
  const toasts = [];
  const saveStatuses = [];
  const updateDetailPanelCalls = [];
  const updateSidebarStatusCalls = [];
  const rerenderCanvasCalls = [];
  const setCurrentEditingMemoryCalls = [];
  const exitEditModeCalls = [];

  const deps = {
    i18n: (key) => key,
    updateSaveStatus: (status, msg) => saveStatuses.push({ status, msg }),
    updateDetailPanel: (mem) => updateDetailPanelCalls.push(mem),
    updateSidebarStatus: () => updateSidebarStatusCalls.push(true),
    showToast: (msg, type) => toasts.push({ msg, type }),
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (m) => { setCurrentEditingMemoryCalls.push(m); currentEditingMemory = m; },
    getTreeMemories: () => [{ ...memory }],
    setTreeMemories: () => {},
    getSelectedNodeId: () => 'mem-1',
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'root',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: null,
    svg: null,
    calcPosition: null,
    setDetailEmptyState: () => {},
    rerenderCanvas: () => rerenderCanvasCalls.push(true),
    getCurrentTreeData: () => ({ id: 'tree-1', memories: [{ ...memory }] }),
    isLocalSaveMode: () => false,
    canEdit: true,
    _toasts: toasts,
    _saveStatuses: saveStatuses,
    _updateDetailPanelCalls: updateDetailPanelCalls,
    _updateSidebarStatusCalls: updateSidebarStatusCalls,
    _rerenderCanvasCalls: rerenderCanvasCalls,
    _setCurrentEditingMemoryCalls: setCurrentEditingMemoryCalls,
    _exitEditModeCalls: exitEditModeCalls,
    ...overrides
  };
  return deps;
}

// ── Tests ─────────────────────────────────────────────────────────────────

test('1. save in-flight: API call is exactly one, save/cancel/delete disabled, aria-busy=true', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;
  let resolveApi;
  const pendingApiPromise = new Promise(res => { resolveApi = res; });

  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async (id, payload) => {
        apiCallCount++;
        await pendingApiPromise;
        return { id, ...payload, title: payload.title, memo: payload.memo, emotionTags: payload.emotionTags || [] };
      }
    }
  });
  // Make title different so no-change guard doesn't trigger
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old Title', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);

  const savePromise = actions.saveMemoryEdit();

  // Immediately after call starts, check UI busy state
  await Promise.resolve(); // flush microtask

  assert.strictEqual(apiCallCount, 1, 'API should be called exactly once');
  assert.strictEqual(dom.saveEditBtn.disabled, true, 'saveEditBtn must be disabled during save');
  assert.strictEqual(dom.cancelEditBtn.disabled, true, 'cancelEditBtn must be disabled during save');
  assert.strictEqual(dom.deleteMemoryBtn.disabled, true, 'deleteMemoryBtn must be disabled during save');
  assert.strictEqual(dom.detailEditMode.getAttribute('aria-busy'), 'true', 'aria-busy must be set on detailEditMode');

  // Resolve and clean up
  resolveApi();
  await savePromise;
});

test('2. duplicate submit prevention: multiple triggers produce exactly one API call', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;
  let resolveApi;
  const pendingApiPromise = new Promise(res => { resolveApi = res; });

  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async (id, payload) => {
        apiCallCount++;
        await pendingApiPromise;
        return { id, ...payload, title: payload.title, memo: payload.memo, emotionTags: payload.emotionTags || [] };
      }
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);

  // Simulate pointer click + Ctrl+Enter + Meta+Enter (all call saveMemoryEdit)
  const p1 = actions.saveMemoryEdit();
  const p2 = actions.saveMemoryEdit(); // duplicate pointer
  const p3 = actions.saveMemoryEdit(); // duplicate keyboard shortcut

  resolveApi();
  await Promise.all([p1, p2, p3]);

  assert.strictEqual(apiCallCount, 1, 'Only one API call should fire even with duplicate submits');
});

test('3. confirmed success: edit mode closes, detail/sidebar/canvas refreshed, saved status', async () => {
  const dom = makeFakeDOM();
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async (id, payload) => ({
        id,
        title: payload.title,
        memo: payload.memo,
        emotionTags: payload.emotionTags || []
      })
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);
  await actions.saveMemoryEdit();

  // Edit mode should be closed (viewMode shown, editMode hidden)
  assert.strictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must be shown on success');
  assert.strictEqual(dom.detailEditMode.style.display, 'none', 'editMode must be hidden on success');

  // Detail and sidebar refreshed
  assert.ok(deps._updateDetailPanelCalls.length > 0, 'updateDetailPanel must be called on success');
  assert.ok(deps._updateSidebarStatusCalls.length > 0, 'updateSidebarStatus must be called on success');
  assert.ok(deps._rerenderCanvasCalls.length > 0, 'rerenderCanvas must be called on success');
  assert.ok(deps._setCurrentEditingMemoryCalls.length > 0, 'setCurrentEditingMemory must be called on success');

  // Saved status
  const savedStatus = deps._saveStatuses.find(s => s.status === 'saved');
  assert.ok(savedStatus, 'updateSaveStatus("saved") must be called on success');

  // CTA restored
  assert.strictEqual(dom.saveEditBtn.disabled, false, 'saveEditBtn must be re-enabled after success');
  assert.strictEqual(dom.cancelEditBtn.disabled, false, 'cancelEditBtn must be re-enabled after success');
  assert.strictEqual(dom.detailEditMode.getAttribute('aria-busy'), undefined, 'aria-busy must be removed on success');
});

test('4. API reject: edit mode stays open, CTA restored, no raw error exposed', async () => {
  const dom = makeFakeDOM();
  const rawErrMsg = 'INTERNAL_DB_SECRET_ERROR';
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async () => { throw new Error(rawErrMsg); }
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);
  await actions.saveMemoryEdit();

  // Edit mode must remain open
  assert.notStrictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must NOT be shown on failure');
  assert.notStrictEqual(dom.detailEditMode.style.display, 'none', 'editMode must NOT be hidden on failure');

  // CTA restored
  assert.strictEqual(dom.saveEditBtn.disabled, false, 'saveEditBtn must be re-enabled after failure');
  assert.strictEqual(dom.cancelEditBtn.disabled, false, 'cancelEditBtn must be re-enabled after failure');

  // Raw error text must NOT appear in any toast
  const toastMessages = deps._toasts.map(t => t.msg);
  for (const msg of toastMessages) {
    assert.ok(
      !String(msg).includes(rawErrMsg),
      `Raw API error text "${rawErrMsg}" must not be shown to user in toast`
    );
  }

  // Failed status set
  const failStatus = deps._saveStatuses.find(s => s.status === 'failed');
  assert.ok(failStatus, 'updateSaveStatus("failed") must be called on API reject');
});

test('5. retry after failure: new API call succeeds', async () => {
  const dom = makeFakeDOM();
  let callCount = 0;
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async (id, payload) => {
        callCount++;
        if (callCount === 1) throw new Error('first fail');
        return { id, title: payload.title, memo: payload.memo, emotionTags: payload.emotionTags || [] };
      }
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);

  // First attempt fails
  await actions.saveMemoryEdit();
  assert.strictEqual(callCount, 1, 'First call must fire');

  // Retry should work
  await actions.saveMemoryEdit();
  assert.strictEqual(callCount, 2, 'Retry must fire a second API call');

  const savedStatus = deps._saveStatuses.find(s => s.status === 'saved');
  assert.ok(savedStatus, 'Second attempt must succeed with saved status');
});

test('6. no-change save: API write is 0 calls, form stays open', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async () => { apiCallCount++; return {}; }
    }
  });
  // Set inputs to SAME values as current memory (no change)
  const sameTitle = 'Same Title';
  const sameMemo = 'Same Memo';
  deps.getCurrentEditingMemory = () => ({
    id: 'mem-1',
    title: sameTitle,
    memo: sameMemo,
    emotionTags: [],
    sourceUrl: ''
  });
  dom.editTitleInput.value = sameTitle;
  dom.editMemoInput.value = sameMemo;
  dom.editTagsInput.value = '';

  const actions = loadActionsInSandbox(dom, deps);
  await actions.saveMemoryEdit();

  assert.strictEqual(apiCallCount, 0, 'No API call should be made when nothing changed');
  // Edit mode must NOT be closed (no exitEditMode triggered)
  assert.notStrictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must NOT be shown on no-change');

  // No "saved" toast
  const successToast = deps._toasts.find(t => t.type === 'success');
  assert.ok(!successToast, 'No success toast on no-change');
});

test('7. plain Enter in editMemoInput does NOT trigger save', async () => {
  // Verify via editor-bindings.js source that keydown guard is Ctrl+Enter or Meta+Enter only
  const bindingsSrc = fs.readFileSync(BINDINGS_PATH, 'utf8');

  // Must have the saveShortcutBound guard
  assert.ok(bindingsSrc.includes('saveShortcutBound'), 'Bindings must have saveShortcutBound guard');

  // Must require ctrlKey or metaKey
  assert.ok(
    bindingsSrc.includes('ctrlKey') && bindingsSrc.includes('metaKey'),
    'Keyboard shortcut must check for ctrlKey and metaKey'
  );

  // Plain Enter (without modifier) must NOT call save - verified by guard structure
  // The listener only fires when (e.ctrlKey || e.metaKey) - plain Enter does NOT match
  assert.ok(
    bindingsSrc.includes("e.key === 'Enter' && (e.ctrlKey || e.metaKey)"),
    "Guard must be: e.key === 'Enter' && (e.ctrlKey || e.metaKey)"
  );
});

test('8. raw provider/API error text not forwarded to user feedback', async () => {
  // Error thrown with specific internal string
  const dom = makeFakeDOM();
  const INTERNAL_ERR = 'neon_connection_error_5432';
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async () => { throw new Error(INTERNAL_ERR); }
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const actions = loadActionsInSandbox(dom, deps);
  await actions.saveMemoryEdit();

  for (const toast of deps._toasts) {
    assert.ok(!String(toast.msg).includes(INTERNAL_ERR), 'Internal error string must not appear in any toast message');
  }
});

test('9. response ID and field acknowledgement guards', async () => {
  const dom = makeFakeDOM();

  // Case A: response ID mismatch -> error stays in catch, edit mode stays open
  const depsA = makeBaseDeps({
    apiClient: {
      updateMemory: async () => ({ id: 'WRONG-ID', title: 'New Title', memo: 'New Memo', emotionTags: [] })
    }
  });
  depsA.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';
  const domA = makeFakeDOM();
  domA.editTitleInput.value = 'New Title';
  domA.editMemoInput.value = 'New Memo';

  const actionsA = loadActionsInSandbox(domA, depsA);
  await actionsA.saveMemoryEdit();

  // Edit mode must not close on ID mismatch
  const savedA = depsA._saveStatuses.find(s => s.status === 'saved');
  assert.ok(!savedA, 'Saved status must NOT be set when response ID mismatches');

  // Case B: title not acknowledged -> failure
  const depsB = makeBaseDeps({
    apiClient: {
      updateMemory: async (id) => ({
        id,
        title: 'WRONG TITLE ECHO', // different from payload
        memo: 'New Memo',
        emotionTags: []
      })
    }
  });
  depsB.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  const domB = makeFakeDOM();
  domB.editTitleInput.value = 'My New Title';
  domB.editMemoInput.value = 'New Memo';

  const actionsB = loadActionsInSandbox(domB, depsB);
  await actionsB.saveMemoryEdit();

  const savedB = depsB._saveStatuses.find(s => s.status === 'saved');
  assert.ok(!savedB, 'Saved status must NOT be set when title acknowledgement fails');
});

test('10. #1882 closing keyword guard (actions + bindings source files)', () => {
  const verbList = ['Clo' + 'ses', 'Fi' + 'xes', 'Reso' + 'lves'];
  const pattern = new RegExp('(' + verbList.join('|') + ')\\s+#1882', 'i');

  const actionsSrc = fs.readFileSync(ACTIONS_PATH, 'utf8');
  assert.ok(!pattern.test(actionsSrc),
    'editor-memory-actions.js must not contain forbidden closing keyword for #1882');

  const bindingsSrc = fs.readFileSync(BINDINGS_PATH, 'utf8');
  assert.ok(!pattern.test(bindingsSrc),
    'editor-bindings.js must not contain forbidden closing keyword for #1882');

  const testSrc = fs.readFileSync(__filename, 'utf8');
  assert.ok(!pattern.test(testSrc),
    'This test file must not contain forbidden closing keyword for #1882');
});
