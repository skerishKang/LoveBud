const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-bindings.js');

function makeFakeElement(id, tagName = 'div') {
  return {
    id,
    tagName: String(tagName).toUpperCase(),
    disabled: false,
    value: '',
    textContent: id === 'saveEditBtn' ? '저장' : '',
    dataset: {},
    style: {},
    _attrs: {},
    _listeners: {},
    addEventListener(eventName, handler) {
      this._listeners[eventName] = this._listeners[eventName] || [];
      this._listeners[eventName].push(handler);
    },
    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      handlers.forEach((handler) => handler(event));
    },
    getAttribute(name) {
      return this._attrs[name];
    },
    setAttribute(name, value) {
      this._attrs[name] = value;
    },
    removeAttribute(name) {
      delete this._attrs[name];
    },
    closest() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      }
    }
  };
}

function createDom() {
  const documentElement = makeFakeElement('html', 'html');
  documentElement.dataset = {};

  const detailPanel = makeFakeElement('detailPanel', 'div');
  detailPanel.dataset = {};

  const elements = {
    detailPanel,
    detailViewMode: makeFakeElement('detailViewMode', 'div'),
    detailEditMode: makeFakeElement('detailEditMode', 'div'),
    editMemoryBtn: makeFakeElement('editMemoryBtn', 'button'),
    deleteMemoryBtn: makeFakeElement('deleteMemoryBtn', 'button'),
    cancelEditBtn: makeFakeElement('cancelEditBtn', 'button'),
    saveEditBtn: makeFakeElement('saveEditBtn', 'button'),
    editTitleInput: makeFakeElement('editTitleInput', 'input'),
    editMemoInput: makeFakeElement('editMemoInput', 'textarea'),
    editTagsInput: makeFakeElement('editTagsInput', 'input'),
    editSourceUrlInput: makeFakeElement('editSourceUrlInput', 'input'),
    editStartTimeInput: makeFakeElement('editStartTimeInput', 'input'),
    editEndTimeInput: makeFakeElement('editEndTimeInput', 'input')
  };

  elements.detailViewMode.style.display = 'none';
  elements.detailEditMode.style.display = 'block';

  return {
    documentElement,
    elements,
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tagName) {
      return makeFakeElement('_created_' + tagName, tagName);
    },
    addEventListener() {}
  };
}

function createHarness(options = {}) {
  const doc = createDom();
  const toasts = [];
  const statuses = [];
  const outcomes = [];
  const detailUpdates = [];
  const sidebarUpdates = [];
  const rerenders = [];

  let apiCallCount = 0;
  let currentEditingMemory = options.initialMemory === undefined
    ? { id: 'memory-1', treeId: 'tree-1', title: 'Old title', memo: 'Old memo', emotionTags: [], sourceUrl: '' }
    : options.initialMemory;
  let treeMemories = currentEditingMemory ? [{ ...currentEditingMemory }] : [];
  const currentTreeData = currentEditingMemory ? { id: 'tree-1', memories: [{ ...currentEditingMemory }] } : { id: 'tree-1', memories: [] };

  let deferredResolve;
  let deferredReject;
  let deferredPromise = null;
  if (options.useDeferred) {
    deferredPromise = new Promise((resolve, reject) => {
      deferredResolve = resolve;
      deferredReject = reject;
    });
  }

  const sandbox = {
    console: { ...console, error: () => {} },
    document: doc,
    setTimeout,
    clearTimeout,
    window: {
      apiClient: {
        updateMemory: async (memoryId, payload) => {
          apiCallCount += 1;
          if (typeof options.updateMemory === 'function') {
            return options.updateMemory(memoryId, payload);
          }
          if (deferredPromise) {
            return deferredPromise;
          }
          return { id: memoryId, ...currentEditingMemory, ...payload };
        }
      },
      LoveBudMedia: {
        extractYouTubeId(url) {
          if (!url) return '';
          const match = String(url).match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
          return match ? match[1] : '';
        },
        getEmbedUrl(url) {
          const match = String(url).match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
          return match ? `https://www.youtube.com/embed/${match[1]}` : '';
        },
        getThumbnailUrl(url) {
          const match = String(url).match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
          return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
        },
        parseYouTubeTimeToSeconds(value) {
          if (!value) return null;
          const parts = String(value).split(':').map(Number);
          if (parts.length === 2) return (parts[0] * 60) + parts[1];
          return Number(value);
        }
      },
      LoveBudEditorMemoryFormTime: {
        parseTime(value) {
          if (!value) return null;
          const parts = String(value).split(':').map(Number);
          if (parts.length === 2) return (parts[0] * 60) + parts[1];
          return Number(value);
        },
        validateEndTime({ rawEndTime, startSeconds, invalidMessage, rangeMessage }) {
          if (!rawEndTime || !String(rawEndTime).trim()) return { ok: true, endSeconds: null };
          const parts = String(rawEndTime).split(':').map(Number);
          const endSeconds = parts.length === 2 ? (parts[0] * 60) + parts[1] : Number(rawEndTime);
          if (Number.isNaN(endSeconds)) return { ok: false, message: invalidMessage };
          if (startSeconds != null && endSeconds <= startSeconds) return { ok: false, message: rangeMessage };
          return { ok: true, endSeconds };
        }
      },
      LoveBudEditorInteractionMode: {
        isEditMode: () => options.isEditMode !== false
      },
      LoveBudCache: {
        set() {}
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(BINDINGS_PATH, 'utf8'), sandbox);

  const actions = sandbox.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: (status, message) => statuses.push({ status, message }),
    updateDetailPanel: (memory) => detailUpdates.push(memory),
    updateSidebarStatus: () => sidebarUpdates.push(true),
    showToast: (message, type) => toasts.push({ message, type }),
    reportSaveOutcome: (result) => outcomes.push(result),
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (memory) => {
      currentEditingMemory = memory;
    },
    getTreeMemories: () => treeMemories,
    setTreeMemories: (memories) => {
      treeMemories = memories;
    },
    getSelectedNodeId: () => currentEditingMemory && currentEditingMemory.id,
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'memory-1',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: doc.elements.detailPanel,
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => rerenders.push(true),
    getCurrentTreeData: () => currentTreeData,
    isLocalSaveMode: () => false,
    canEdit: options.canEdit !== false
  });

  return {
    actions,
    dom: doc.elements,
    bindings: sandbox.window.LoveBudEditorBindings,
    getApiCallCount: () => apiCallCount,
    getToasts: () => toasts.slice(),
    getStatuses: () => statuses.slice(),
    getOutcomes: () => outcomes.slice(),
    getDetailUpdates: () => detailUpdates.slice(),
    getSidebarUpdates: () => sidebarUpdates.slice(),
    getRerenders: () => rerenders.slice(),
    getCurrentEditingMemory: () => currentEditingMemory,
    resolveDeferred: (value) => deferredResolve && deferredResolve(value),
    rejectDeferred: (error) => deferredReject && deferredReject(error)
  };
}

test('single authoritative save gate remains in actions, not button wrapper', () => {
  const doc = createDom();
  let saveCalls = 0;
  const sandbox = {
    window: {
      LoveBudEditorInteractionMode: {
        isEditMode: () => false
      }
    },
    document: doc,
    MutationObserver: undefined
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(BINDINGS_PATH, 'utf8'), sandbox);

  sandbox.window.LoveBudEditorBindings.bindDetailActionButtons({
    detailPanel: doc.elements.detailPanel,
    enterEditMode: () => {},
    deleteMemory: () => {},
    exitEditMode: () => {},
    saveMemoryEdit: () => { saveCalls += 1; }
  });

  doc.elements.saveEditBtn.dispatchEvent({ type: 'click' });

  assert.equal(saveCalls, 1, 'save button wrapper must delegate without its own mode gate');
});

test('blocked_mode is observable, visible, and skips updateMemory', async () => {
  const harness = createHarness({ isEditMode: false });

  const result = await harness.actions.saveMemoryEdit();

  assert.equal(result.outcome, 'blocked_mode');
  assert.equal(harness.getApiCallCount(), 0);
  assert.equal(harness.dom.detailEditMode.style.display, 'block');
  assert.equal(harness.getOutcomes().at(-1).outcome, 'blocked_mode');
  assert.equal(harness.getToasts().at(-1).type, 'info');
  assert.deepEqual(
    harness.getStatuses().map((entry) => entry.status),
    ['manual_blocked']
  );
});

test('blocked_missing_memory is observable, visible, and keeps edit form open', async () => {
  const harness = createHarness({ initialMemory: null });

  const result = await harness.actions.saveMemoryEdit();

  assert.equal(result.outcome, 'blocked_missing_memory');
  assert.equal(harness.getApiCallCount(), 0);
  assert.equal(harness.dom.detailEditMode.style.display, 'block');
  assert.equal(harness.getOutcomes().at(-1).outcome, 'blocked_missing_memory');
  assert.equal(harness.getToasts().at(-1).type, 'info');
  assert.deepEqual(
    harness.getStatuses().map((entry) => entry.status),
    ['manual_blocked']
  );
});

test('no_change is observable, visible, and leaves edit form open', async () => {
  const harness = createHarness();

  harness.dom.editTitleInput.value = 'Old title';
  harness.dom.editMemoInput.value = 'Old memo';
  harness.dom.editTagsInput.value = '';
  harness.dom.editSourceUrlInput.value = '';

  const result = await harness.actions.saveMemoryEdit();

  assert.equal(result.outcome, 'no_change');
  assert.equal(harness.getApiCallCount(), 0);
  assert.equal(harness.dom.detailEditMode.style.display, 'block');
  assert.equal(harness.getOutcomes().at(-1).outcome, 'no_change');
  assert.equal(harness.getToasts().at(-1).message, '변경된 내용이 없어요');
  assert.deepEqual(
    harness.getStatuses().map((entry) => entry.status),
    ['manual_nochange']
  );
});

test('blocked_in_flight is observable and does not trigger duplicate updateMemory calls', async () => {
  const harness = createHarness({ useDeferred: true });

  harness.dom.editTitleInput.value = 'Updated title';
  harness.dom.editMemoInput.value = 'Updated memo';

  const firstSavePromise = harness.actions.saveMemoryEdit();
  assert.equal(harness.getApiCallCount(), 1);

  const secondResult = await harness.actions.saveMemoryEdit();
  assert.equal(secondResult.outcome, 'blocked_in_flight');
  assert.equal(harness.getApiCallCount(), 1);
  assert.equal(harness.dom.detailEditMode.style.display, 'block');
  assert.deepEqual(
    harness.getStatuses().map((entry) => entry.status),
    ['manual_saving', 'manual_blocked']
  );

  harness.resolveDeferred({
    id: 'memory-1',
    treeId: 'tree-1',
    title: 'Updated title',
    memo: 'Updated memo',
    emotionTags: [],
    sourceUrl: ''
  });
  const firstResult = await firstSavePromise;

  assert.equal(firstResult.outcome, 'saved');
  assert.deepEqual(
    harness.getOutcomes().map((entry) => entry.outcome),
    ['saving', 'blocked_in_flight', 'saved']
  );
});

test('successful changed save reports saving then saved and closes edit form', async () => {
  const harness = createHarness();

  harness.dom.editTitleInput.value = 'Updated title';
  harness.dom.editMemoInput.value = 'Updated memo';

  const result = await harness.actions.saveMemoryEdit();

  assert.equal(result.outcome, 'saved');
  assert.equal(harness.getApiCallCount(), 1);
  assert.equal(harness.dom.detailEditMode.style.display, 'none');
  assert.equal(harness.dom.detailViewMode.style.display, 'block');
  assert.deepEqual(
    harness.getOutcomes().map((entry) => entry.outcome),
    ['saving', 'saved']
  );
  assert.equal(harness.getStatuses().at(-1).status, 'manual_saved');
});

test('failed save reports failed and resets the in-flight guard for retry', async () => {
  let shouldFail = true;
  const harness = createHarness({
    updateMemory: async (memoryId, payload) => {
      if (shouldFail) {
        throw new Error('synthetic failure');
      }
      return { id: memoryId, treeId: 'tree-1', sourceUrl: '', emotionTags: [], ...payload };
    }
  });

  harness.dom.editTitleInput.value = 'Retry title';
  harness.dom.editMemoInput.value = 'Retry memo';

  const failedResult = await harness.actions.saveMemoryEdit();

  assert.equal(failedResult.outcome, 'failed');
  assert.equal(harness.getApiCallCount(), 1);
  assert.equal(harness.dom.detailEditMode.style.display, 'block');
  assert.equal(harness.getOutcomes().at(-1).outcome, 'failed');

  shouldFail = false;
  const retryResult = await harness.actions.saveMemoryEdit();

  assert.equal(retryResult.outcome, 'saved');
  assert.equal(harness.getApiCallCount(), 2);
  assert.equal(harness.dom.detailEditMode.style.display, 'none');
  assert.deepEqual(
    harness.getOutcomes().map((entry) => entry.outcome),
    ['saving', 'failed', 'saving', 'saved']
  );
});
