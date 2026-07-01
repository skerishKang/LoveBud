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
 * - Plain Enter in memo textarea does NOT trigger save (Keyboard shortcut execution)
 * - Ctrl+Enter and Meta+Enter trigger save and call preventDefault
 * - Double binding does not register duplicate event handlers
 * - Interaction mode isEditMode=false prevents key shortcut execution
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
    querySelectorAll: function() { return []; },
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
    editStartTimeInput: makeFakeElement('editStartTimeInput', 'input'),
    editEndTimeInput: makeFakeElement('editEndTimeInput', 'input'),
  };
  els.editTitleInput.value = 'Test Title';
  els.editMemoInput.value = 'Test Memo';
  els.editTagsInput.value = '';
  els.editSourceUrlInput.value = '';
  els.editStartTimeInput.value = '';
  els.editEndTimeInput.value = '';
  return els;
}

// ── Module loader ─────────────────────────────────────────────────────────

function createSandbox(dom, deps) {
  const actionsCode = fs.readFileSync(ACTIONS_PATH, 'utf8');
  const bindingsCode = fs.readFileSync(BINDINGS_PATH, 'utf8');

  let editModeState = true;

  const sandbox = {
    window: {
      apiClient: deps.apiClient || null,
      LoveBudEditorInteractionMode: {
        isEditMode: () => editModeState,
        setMode: () => {},
        subscribe: () => {},
        _connectExistingSubscribed: false
      },
      LoveBudMedia: deps._LoveBudMedia || null,
      LoveBudEditorMemoryFormTime: deps._LoveBudEditorMemoryFormTime || null,
      LoveBudCache: null,
      LoveBudEditorBindings: null,
      createEditorMemoryActions: undefined
    },
    document: {
      documentElement: makeFakeElement('html', 'html'),
      getElementById: (id) => dom[id] || null,
      createElement: () => makeFakeElement('_created', 'div'),
      addEventListener: () => {},
    },
    console: { error: () => {}, log: () => {} },
    // Helpers to toggle interaction mode edit state in tests
    _setEditModeState: (s) => { editModeState = s; }
  };
  vm.createContext(sandbox);

  // Load actions
  vm.runInContext(actionsCode, sandbox);
  // Load bindings
  vm.runInContext(bindingsCode, sandbox);

  const factory = sandbox.window.createEditorMemoryActions || sandbox.createEditorMemoryActions;
  const actions = factory(deps);

  // Expose bindings control
  return {
    actions,
    sandbox,
    bindDetailControls: () => {
      sandbox.window.LoveBudEditorBindings.bindDetailActionButtons({
        detailPanel: dom.detailEditMode,
        enterEditMode: actions.enterEditMode,
        deleteMemory: actions.deleteMemory,
        exitEditMode: actions.exitEditMode,
        saveMemoryEdit: actions.saveMemoryEdit
      });
    }
  };
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
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old Title', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const { actions } = createSandbox(dom, deps);

  const savePromise = actions.saveMemoryEdit();

  await Promise.resolve();

  assert.strictEqual(apiCallCount, 1, 'API should be called exactly once');
  assert.strictEqual(dom.saveEditBtn.disabled, true, 'saveEditBtn must be disabled during save');
  assert.strictEqual(dom.cancelEditBtn.disabled, true, 'cancelEditBtn must be disabled during save');
  assert.strictEqual(dom.deleteMemoryBtn.disabled, true, 'deleteMemoryBtn must be disabled during save');
  assert.strictEqual(dom.detailEditMode.getAttribute('aria-busy'), 'true', 'aria-busy must be set on detailEditMode');

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

  const { actions } = createSandbox(dom, deps);

  const p1 = actions.saveMemoryEdit();
  const p2 = actions.saveMemoryEdit();
  const p3 = actions.saveMemoryEdit();

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

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  assert.strictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must be shown on success');
  assert.strictEqual(dom.detailEditMode.style.display, 'none', 'editMode must be hidden on success');

  assert.ok(deps._updateDetailPanelCalls.length > 0, 'updateDetailPanel must be called on success');
  assert.ok(deps._updateSidebarStatusCalls.length > 0, 'updateSidebarStatus must be called on success');
  assert.ok(deps._rerenderCanvasCalls.length > 0, 'rerenderCanvas must be called on success');
  assert.ok(deps._setCurrentEditingMemoryCalls.length > 0, 'setCurrentEditingMemory must be called on success');

  const savedStatus = deps._saveStatuses.find(s => s.status === 'saved');
  assert.ok(savedStatus, 'updateSaveStatus("saved") must be called on success');

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

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  assert.notStrictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must NOT be shown on failure');
  assert.notStrictEqual(dom.detailEditMode.style.display, 'none', 'editMode must NOT be hidden on failure');

  assert.strictEqual(dom.saveEditBtn.disabled, false, 'saveEditBtn must be re-enabled after failure');
  assert.strictEqual(dom.cancelEditBtn.disabled, false, 'cancelEditBtn must be re-enabled after failure');

  const toastMessages = deps._toasts.map(t => t.msg);
  for (const msg of toastMessages) {
    assert.ok(
      !String(msg).includes(rawErrMsg),
      `Raw API error text "${rawErrMsg}" must not be shown to user in toast`
    );
  }

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

  const { actions } = createSandbox(dom, deps);

  await actions.saveMemoryEdit();
  assert.strictEqual(callCount, 1, 'First call must fire');

  await actions.saveMemoryEdit();
  assert.strictEqual(callCount, 2, 'Retry must fire a second API call');

  const savedStatus = deps._saveStatuses.find(s => s.status === 'saved');
  assert.ok(savedStatus, 'Second attempt must succeed with saved status');
});

test('6. no-change save: API write is 0 calls, form stays open, info toast only', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async () => { apiCallCount++; return {}; }
    }
  });
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

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  assert.strictEqual(apiCallCount, 0, 'No API call should be made when nothing changed');
  assert.notStrictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must NOT be shown on no-change');

  // Info toast shown
  const infoToast = deps._toasts.find(t => t.type === 'info');
  assert.ok(infoToast, 'Info toast must be shown on no-change');

  // No saved/failed status set
  const savedOrFailed = deps._saveStatuses.some(s => s.status === 'saved' || s.status === 'failed');
  assert.ok(!savedOrFailed, 'No save status updates on no-change');

  // CTA restored
  assert.strictEqual(dom.saveEditBtn.disabled, false, 'saveEditBtn remains enabled');
});

function makeYoutubeMediaStub() {
  return {
    extractYouTubeId: (url) => {
      if (!url) return null;
      const match = url.match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
      return match ? match[1] : null;
    },
    getEmbedUrl: (url, type, options) => {
      const videoId = 'dQw4w9WgXcQ';
      let embed = 'https://www.youtube.com/embed/' + videoId;
      if (options && options.startSeconds != null) {
        embed += '?start=' + options.startSeconds;
      }
      return embed;
    },
    getThumbnailUrl: () => 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    formatYouTubeStartTime: (seconds) => {
      if (seconds == null) return '';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m + ':' + String(s).padStart(2, '0');
    },
    parseYouTubeTimeToSeconds: (val) => {
      if (!val) return null;
      if (/^\d+$/.test(val)) return Number(val);
      const parts = val.split(':');
      if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
      return null;
    }
  };
}

function makeFormTimeStub() {
  return {
    parseTime: (val) => {
      if (!val) return null;
      if (/^\d+$/.test(val)) return Number(val);
      const parts = val.split(':');
      if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
      return null;
    },
    validateEndTime: (options) => {
      const { rawEndTime, startSeconds } = options;
      if (!rawEndTime) return { ok: true, endSeconds: null };
      const parts = rawEndTime.split(':');
      const endSeconds = Number(parts[0]) * 60 + Number(parts[1]);
      if (startSeconds && endSeconds <= startSeconds) {
        return { ok: false, message: '끝 시간은 시작 시간보다 뒤여야 해요.' };
      }
      return { ok: true, endSeconds };
    }
  };
}

test('6b. no-change save with YouTube source + start/end segments: 0 API calls, info toast, form stays open, no refresh', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;

  const deps = makeBaseDeps({
    _LoveBudMedia: makeYoutubeMediaStub(),
    _LoveBudEditorMemoryFormTime: makeFormTimeStub(),
    apiClient: {
      updateMemory: async () => { apiCallCount++; return {}; }
    }
  });

  const sameSource = 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=20&end=30';
  deps.getCurrentEditingMemory = () => ({
    id: 'mem-1',
    title: 'Same Title',
    memo: 'Same Memo',
    emotionTags: [],
    sourceUrl: sameSource
  });

  dom.editTitleInput.value = 'Same Title';
  dom.editMemoInput.value = 'Same Memo';
  dom.editTagsInput.value = '';
  dom.editSourceUrlInput.value = sameSource;
  dom.editStartTimeInput.value = '0:20';
  dom.editEndTimeInput.value = '0:30';

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  // updateMemory 호출 0회
  assert.strictEqual(apiCallCount, 0, 'No API call when nothing changed (YouTube + segments)');

  // edit form 유지
  assert.notStrictEqual(dom.detailViewMode.style.display, 'block', 'viewMode must NOT be shown');
  assert.notStrictEqual(dom.detailEditMode.style.display, 'none', 'editMode must NOT be hidden');

  // saved/failed status 없음
  const hasSavedOrFailed = deps._saveStatuses.some(s => s.status === 'saved' || s.status === 'failed');
  assert.ok(!hasSavedOrFailed, 'No saved/failed status on no-change');

  // info feedback 존재
  const infoToast = deps._toasts.find(t => t.type === 'info');
  assert.ok(infoToast, 'Info toast must be shown on no-change');

  // detail refresh 0회
  assert.strictEqual(deps._updateDetailPanelCalls.length, 0, 'No detail panel refresh');
  // sidebar refresh 0회
  assert.strictEqual(deps._updateSidebarStatusCalls.length, 0, 'No sidebar refresh');
  // canvas rerender 0회
  assert.strictEqual(deps._rerenderCanvasCalls.length, 0, 'No canvas rerender');

  // CTA 정상 복구
  assert.strictEqual(dom.saveEditBtn.disabled, false, 'saveEditBtn re-enabled');
  assert.strictEqual(dom.cancelEditBtn.disabled, false, 'cancelEditBtn re-enabled');
  assert.strictEqual(dom.deleteMemoryBtn.disabled, false, 'deleteMemoryBtn re-enabled');

  // aria-busy 정상 복구
  assert.strictEqual(dom.detailEditMode.getAttribute('aria-busy'), undefined, 'aria-busy removed');
});

test('6c. segment time change still triggers API write 1회', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;

  const deps = makeBaseDeps({
    _LoveBudMedia: makeYoutubeMediaStub(),
    _LoveBudEditorMemoryFormTime: makeFormTimeStub(),
    apiClient: {
      updateMemory: async (id, payload) => {
        apiCallCount++;
        return { id, ...payload, title: payload.title, memo: payload.memo, emotionTags: payload.emotionTags || [] };
      }
    }
  });

  const originalSource = 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=20&end=30';
  deps.getCurrentEditingMemory = () => ({
    id: 'mem-1',
    title: 'Same Title',
    memo: 'Same Memo',
    emotionTags: [],
    sourceUrl: originalSource
  });

  dom.editTitleInput.value = 'Same Title';
  dom.editMemoInput.value = 'Same Memo';
  dom.editTagsInput.value = '';
  dom.editSourceUrlInput.value = originalSource;
  dom.editStartTimeInput.value = '0:25'; // changed
  dom.editEndTimeInput.value = '0:35';   // changed

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  assert.strictEqual(apiCallCount, 1, 'Segment change must trigger exactly 1 API call');
  assert.strictEqual(dom.detailViewMode.style.display, 'block', 'viewMode shown on success');
  assert.strictEqual(dom.detailEditMode.style.display, 'none', 'editMode hidden on success');
});

test('7. Keyboard shortcut execution: plain Enter, Ctrl+Enter, Meta+Enter, click, duplicate binding, and isEditMode checks', async () => {
  const dom = makeFakeDOM();
  let apiCallCount = 0;
  const deps = makeBaseDeps({
    apiClient: {
      updateMemory: async (id, payload) => {
        apiCallCount++;
        return { id, ...payload };
      }
    }
  });
  deps.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [] });
  dom.editTitleInput.value = 'New Title';
  dom.editMemoInput.value = 'New Memo';

  const { bindDetailControls, sandbox } = createSandbox(dom, deps);

  // Bind elements
  bindDetailControls();

  // Reference elements & check bindings
  const saveBtn = dom.saveEditBtn;
  const memoTextarea = dom.editMemoInput;

  assert.ok(saveBtn._listeners['click'], 'Save button should have click listener bound');
  assert.ok(memoTextarea._listeners['keydown'], 'Memo textarea should have keydown listener bound');

  // Helper to make fake KeyboardEvent
  function triggerKeyEvent(key, modifiers = {}) {
    let preventDefaultCalled = 0;
    const evt = {
      type: 'keydown',
      key,
      ctrlKey: !!modifiers.ctrlKey,
      metaKey: !!modifiers.metaKey,
      preventDefault: () => { preventDefaultCalled++; }
    };
    memoTextarea.dispatchEvent(evt);
    return preventDefaultCalled;
  }

  // --- 1. Plain Enter: No save, no preventDefault ---
  apiCallCount = 0;
  let pdefs = triggerKeyEvent('Enter');
  assert.strictEqual(apiCallCount, 0, 'Plain Enter must not call saveMemoryEdit');
  assert.strictEqual(pdefs, 0, 'Plain Enter must not call preventDefault');

  // --- 2. Ctrl+Enter: Triggers save, calls preventDefault ---
  dom.editTitleInput.value = 'Ctrl Title';
  apiCallCount = 0;
  pdefs = triggerKeyEvent('Enter', { ctrlKey: true });
  await new Promise(r => setTimeout(r, 0)); // flush async save call and finally blocks
  assert.strictEqual(apiCallCount, 1, 'Ctrl+Enter must trigger saveMemoryEdit');
  assert.strictEqual(pdefs, 1, 'Ctrl+Enter must call preventDefault once');

  // Reset flag for subsequent tests
  dom.saveEditBtn.disabled = false;
  dom.cancelEditBtn.disabled = false;

  // --- 3. Meta+Enter: Triggers save, calls preventDefault ---
  dom.editTitleInput.value = 'Meta Title';
  apiCallCount = 0;
  pdefs = triggerKeyEvent('Enter', { metaKey: true });
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(apiCallCount, 1, 'Meta+Enter must trigger saveMemoryEdit');
  assert.strictEqual(pdefs, 1, 'Meta+Enter must call preventDefault once');

  dom.saveEditBtn.disabled = false;
  dom.cancelEditBtn.disabled = false;

  // --- 4. Save button click: Triggers save ---
  dom.editTitleInput.value = 'Click Title';
  apiCallCount = 0;
  saveBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(apiCallCount, 1, 'Save button click must trigger saveMemoryEdit');

  dom.saveEditBtn.disabled = false;
  dom.cancelEditBtn.disabled = false;

  // --- 5. Double binding call: guards prevent duplicate listeners ---
  const initialClickCount = saveBtn._listeners['click'].length;
  const initialKeydownCount = memoTextarea._listeners['keydown'].length;

  bindDetailControls(); // call bind again

  assert.strictEqual(saveBtn._listeners['click'].length, initialClickCount, 'Click listener should not be duplicated');
  assert.strictEqual(memoTextarea._listeners['keydown'].length, initialKeydownCount, 'Keydown listener should not be duplicated');

  dom.editTitleInput.value = 'Double Title';
  apiCallCount = 0;
  triggerKeyEvent('Enter', { ctrlKey: true });
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(apiCallCount, 1, 'Event trigger must run only once after duplicate bindings call');

  dom.saveEditBtn.disabled = false;
  dom.cancelEditBtn.disabled = false;

  // --- 6. isEditMode false check ---
  sandbox._setEditModeState(false); // disable editMode mock in interactionMode
  apiCallCount = 0;
  triggerKeyEvent('Enter', { ctrlKey: true });
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(apiCallCount, 0, 'Ctrl+Enter must be ignored if isEditMode() is false');

  saveBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(apiCallCount, 0, 'Save button click must be ignored if isEditMode() is false');
});

test('8. raw provider/API error text not forwarded to user feedback', async () => {
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

  const { actions } = createSandbox(dom, deps);
  await actions.saveMemoryEdit();

  for (const toast of deps._toasts) {
    assert.ok(!String(toast.msg).includes(INTERNAL_ERR), 'Internal error string must not appear in any toast message');
  }
});

test('9. response ID and field acknowledgement guards', async () => {
  const dom = makeFakeDOM();

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

  const { actions: actionsA } = createSandbox(domA, depsA);
  await actionsA.saveMemoryEdit();

  const savedA = depsA._saveStatuses.find(s => s.status === 'saved');
  assert.ok(!savedA, 'Saved status must NOT be set when response ID mismatches');

  const depsB = makeBaseDeps({
    apiClient: {
      updateMemory: async (id) => ({
        id,
        title: 'WRONG TITLE ECHO',
        memo: 'New Memo',
        emotionTags: []
      })
    }
  });
  depsB.getCurrentEditingMemory = () => ({ id: 'mem-1', title: 'Old', memo: 'Old Memo', emotionTags: [], sourceUrl: '' });
  const domB = makeFakeDOM();
  domB.editTitleInput.value = 'My New Title';
  domB.editMemoInput.value = 'New Memo';

  const { actions: actionsB } = createSandbox(domB, depsB);
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
