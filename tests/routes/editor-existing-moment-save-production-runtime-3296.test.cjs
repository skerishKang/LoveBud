const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const EDITOR_ENTRY_PATH = path.join(ROOT, 'js/editor.js');
const INTERACTION_MODE_PATH = path.join(ROOT, 'js/editor/editor-interaction-mode.js');
const PAGE_EVENTS_PATH = path.join(ROOT, 'js/editor/editor-page-event-bindings.js');
const ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-bindings.js');
const STATUS_PATH = path.join(ROOT, 'js/editor/editor-save-status.js');
const ORCHESTRATION_PATH = path.join(ROOT, 'js/editor/editor-save-status-orchestration.js');
const REFRESH_PATH = path.join(ROOT, 'js/editor/editor-refresh-save-runtime.js');
const HELPERS_PATH = path.join(ROOT, 'js/editor/editor-helpers.js');

const editorSource = fs.readFileSync(EDITOR_ENTRY_PATH, 'utf8');
const pageEventsSource = fs.readFileSync(PAGE_EVENTS_PATH, 'utf8');

function assertProductionEntrySeam() {
  assert.match(editorSource, /const bindEditorPageEvents = deps\.bindEditorPageEvents;/);
  assert.match(editorSource, /bindEditorPageEvents\(\{[\s\S]*enterEditMode,[\s\S]*saveMemoryEdit[\s\S]*\}\)/);
  assert.match(pageEventsSource, /editorBindings\.bindDetailActionButtons\(\{/);
}

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = [];

  function setTimeoutFake(fn, delay) {
    const id = nextId++;
    timers.push({
      id,
      runAt: now + Math.max(0, Number(delay) || 0),
      fn
    });
    return id;
  }

  function clearTimeoutFake(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  }

  function advanceBy(ms) {
    const target = now + Math.max(0, Number(ms) || 0);
    timers.sort((a, b) => a.runAt - b.runAt);

    while (timers.length && timers[0].runAt <= target) {
      const next = timers.shift();
      now = next.runAt;
      next.fn();
      timers.sort((a, b) => a.runAt - b.runAt);
    }

    now = target;
  }

  return {
    setTimeoutFake,
    clearTimeoutFake,
    advanceBy
  };
}

function createHarness(options = {}) {
  assertProductionEntrySeam();

  const trace = [];
  const timers = createFakeTimers();

  const makeFakeElement = (id, tagName = 'div') => {
    let internalVal = '';
    const el = {
      id,
      tagName: String(tagName).toUpperCase(),
      disabled: false,
      dataset: {},
      style: {},
      textContent: id === 'saveEditBtn' ? '저장' : '',
      _attrs: {},
      _listeners: {},
      _children: [],
      _parentNode: null,
      get value() {
        return internalVal;
      },
      set value(v) {
        if (String(tagName).toLowerCase() === 'textarea') {
          internalVal = String(v).replace(/\r\n/g, '\n');
          return;
        }
        internalVal = String(v);
      },
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
      focus() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      closest(selector) {
        if (selector === '#detailEditMode' && this._closestEditMode) {
          return this._closestEditMode;
        }
        if (selector === '.editor-form-stack') {
          return this._closestFormStack || null;
        }
        return this;
      },
      appendChild(child) {
        child._parentNode = this;
        this._children.push(child);
        return child;
      },
      insertBefore(child) {
        child._parentNode = this;
        this._children.push(child);
        return child;
      },
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
            return;
          }
          if (force) this._classes.add(c);
          else this._classes.delete(c);
        },
        contains(c) {
          return this._classes.has(c);
        }
      }
    };

    Object.defineProperty(el, 'parentNode', {
      get() {
        return this._parentNode;
      },
      set(value) {
        this._parentNode = value;
      }
    });

    return el;
  };

  const documentElement = makeFakeElement('html', 'html');
  const body = makeFakeElement('body', 'body');
  const detailPanel = makeFakeElement('detailPanel', 'div');
  const detailViewMode = makeFakeElement('detailViewMode', 'div');
  const detailEditMode = makeFakeElement('detailEditMode', 'div');
  const editMemoStack = makeFakeElement('editMemoStack', 'div');
  editMemoStack.classList.add('editor-form-stack');

  const elements = {
    detailPanel,
    detailViewMode,
    detailEditMode,
    editMemoryBtn: makeFakeElement('editMemoryBtn', 'button'),
    deleteMemoryBtn: makeFakeElement('deleteMemoryBtn', 'button'),
    cancelEditBtn: makeFakeElement('cancelEditBtn', 'button'),
    saveEditBtn: makeFakeElement('saveEditBtn', 'button'),
    editTitleInput: makeFakeElement('editTitleInput', 'input'),
    editMemoInput: makeFakeElement('editMemoInput', 'textarea'),
    editTagsInput: makeFakeElement('editTagsInput', 'input'),
    editSourceUrlInput: makeFakeElement('editSourceUrlInput', 'input'),
    editStartTimeInput: makeFakeElement('editStartTimeInput', 'input'),
    editEndTimeInput: makeFakeElement('editEndTimeInput', 'input'),
    saveStatusIndicator: makeFakeElement('saveStatusIndicator', 'div'),
    saveStatusIcon: makeFakeElement('saveStatusIcon', 'span'),
    saveStatusText: makeFakeElement('saveStatusText', 'span'),
    lastSavedTime: makeFakeElement('lastSavedTime', 'span')
  };

  detailViewMode.style.display = 'block';
  detailEditMode.style.display = 'none';
  elements.saveStatusIndicator.style.display = 'none';
  elements.lastSavedTime.style.display = 'none';

  elements.editMemoInput._closestFormStack = editMemoStack;
  elements.deleteMemoryBtn._closestEditMode = detailEditMode;

  detailPanel.appendChild(detailViewMode);
  detailPanel.appendChild(detailEditMode);
  detailEditMode.appendChild(editMemoStack);
  detailEditMode.appendChild(elements.deleteMemoryBtn);

  const dynamicElements = {};
  const doc = {
    documentElement,
    body,
    getElementById(id) {
      if (elements[id]) return elements[id];
      if (dynamicElements[id]) return dynamicElements[id];
      return null;
    },
    createElement(tagName) {
      const id = '_created_' + tagName + '_' + Object.keys(dynamicElements).length;
      const el = makeFakeElement(id, tagName);
      dynamicElements[id] = el;
      return el;
    },
    addEventListener() {}
  };

  let currentEditingMemory = { ...options.initialMemory };
  let treeMemories = [{ ...options.initialMemory }];
  const toasts = [];
  const statusCalls = [];
  const outcomes = [];
  const updateMemoryCalls = [];
  let updateDetailPanelCalls = 0;
  let updateSidebarStatusCalls = 0;
  let rerenderCanvasCalls = 0;
  let refreshMemoriesCallCount = 0;

  const MutationObserver = function (callback) {
    this.callback = callback;
  };
  MutationObserver.prototype.observe = function () {};
  MutationObserver.prototype.disconnect = function () {};

  const windowObject = {
    apiClient: {
      updateMemory: async (memoryId, payload) => {
        updateMemoryCalls.push({ memoryId, payload });
        return { id: memoryId, ...currentEditingMemory, ...payload };
      }
    },
    LoveBudMedia: {
      extractYouTubeId(url) {
        if (!url) return '';
        const match = String(url).match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
        return match ? match[1] : '';
      },
      getEmbedUrl(url, type, opts = {}) {
        const match = String(url).match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
        if (!match) return '';
        let embed = `https://www.youtube.com/embed/${match[1]}`;
        if (opts.startSeconds != null) {
          embed += `?start=${opts.startSeconds}`;
        }
        return embed;
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
      },
      formatYouTubeStartTime(seconds) {
        if (seconds == null) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
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
    LoveBudCache: { set() {} },
    LoveBudUI: {
      showToast(message, type) {
        toasts.push({ message, type });
      }
    }
  };

  const sandbox = {
    console: { ...console, error: () => {} },
    window: windowObject,
    document: doc,
    MutationObserver,
    setTimeout: timers.setTimeoutFake,
    clearTimeout: timers.clearTimeoutFake,
    URL,
    Date
  };

  vm.createContext(sandbox);

  [
    INTERACTION_MODE_PATH,
    HELPERS_PATH,
    STATUS_PATH,
    ORCHESTRATION_PATH,
    REFRESH_PATH,
    ACTIONS_PATH,
    BINDINGS_PATH,
    PAGE_EVENTS_PATH
  ].forEach((filePath) => {
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

  const mode = sandbox.window.LoveBudEditorInteractionMode;
  mode.setMode(mode.MODE_EDIT);

  const realCreateToast = sandbox.window.LoveBudEditorHelpers.createToast();
  const refreshSaveRuntime = sandbox.window.LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime({
    log: () => {},
    reportError: () => {},
    editorDataLoader: {
      createRefreshMemories: () => {
        return () => {
          refreshMemoriesCallCount += 1;
        };
      }
    },
    treeId: 'tree-1',
    apiClient: windowObject.apiClient,
    normalizeMemory: (memory) => memory,
    treeMemories: () => treeMemories,
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (memory) => {
      currentEditingMemory = memory;
    },
    isRootMemory: () => false,
    canonicalRootId: 'memory-1',
    updateDetailPanel: () => {
      updateDetailPanelCalls += 1;
    },
    updateSidebarStatus: () => {
      updateSidebarStatusCalls += 1;
    },
    initCanvas: () => {
      rerenderCanvasCalls += 1;
    },
    exposeRefreshMemoriesBridge: ({ refreshMemories }) => {
      sandbox.window.refreshMemories = refreshMemories;
    },
    resolveSaveStatusTimeFormatter: () => {
      return (date) => sandbox.window.LoveBudEditorSaveStatus.formatTimeAgo(date);
    },
    editorSaveStatus: sandbox.window.LoveBudEditorSaveStatus,
    i18n: (key) => key,
    createSaveStatusOrchestrationFallback: () => {
      return sandbox.window.LoveBudEditorSaveStatusOrchestration.createEditorSaveStatusOrchestration;
    },
    saveStatusOrchestrationHelper: sandbox.window.LoveBudEditorSaveStatusOrchestration
  });

  const updateSaveStatus = (status, message) => {
    statusCalls.push({ status, message });
    return refreshSaveRuntime.updateSaveStatus(status, message);
  };

  const actions = sandbox.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus,
    updateDetailPanel: () => {
      updateDetailPanelCalls += 1;
    },
    updateSidebarStatus: () => {
      updateSidebarStatusCalls += 1;
    },
    showToast: (message, type) => {
      realCreateToast(message, type);
    },
    reportSaveOutcome: (result) => {
      outcomes.push(result);
    },
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
    detailPanel,
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => {
      rerenderCanvasCalls += 1;
    },
    getCurrentTreeData: () => ({ id: 'tree-1', memories: treeMemories }),
    isLocalSaveMode: () => false,
    canEdit: true
  });

  const wrappedEnterEditMode = (event) => {
    trace.push({
      step: 'enterEditMode',
      modeBefore: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display,
      eventType: event && event.type ? event.type : event && event.type === '' ? '' : null
    });
    const result = actions.enterEditMode(event);
    trace.push({
      step: 'enterEditMode:after',
      modeAfter: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display
    });
    return result;
  };

  const wrappedExitEditMode = () => {
    trace.push({
      step: 'exitEditMode',
      modeBefore: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display
    });
    const result = actions.exitEditMode();
    trace.push({
      step: 'exitEditMode:after',
      modeAfter: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display
    });
    return result;
  };

  const wrappedSaveMemoryEdit = () => {
    trace.push({
      step: 'saveMemoryEdit',
      modeBefore: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display
    });
    const result = actions.saveMemoryEdit();
    trace.push({
      step: 'saveMemoryEdit:scheduled',
      modeAfterCall: mode.getMode(),
      detailViewDisplay: elements.detailViewMode.style.display,
      detailEditDisplay: elements.detailEditMode.style.display
    });
    return result;
  };

  const bindResult = sandbox.window.LoveBudEditorPageEventBindings.bindEditorPageEvents({
    canEdit: true,
    sidebarUIHelper: {},
    editorBindings: sandbox.window.LoveBudEditorBindings,
    emptyGuideUIHelper: {},
    showAddMemoryForm: () => {},
    hideAddMemoryForm: () => {},
    addMemoryFromForm: () => Promise.resolve(),
    updateSaveStatus,
    showToast: (message, type) => realCreateToast(message, type),
    i18n: (key) => key,
    getTreeMemories: () => treeMemories,
    enterEditMode: wrappedEnterEditMode,
    deleteMemory: () => {},
    exitEditMode: wrappedExitEditMode,
    saveMemoryEdit: wrappedSaveMemoryEdit
  });

  assert.equal(bindResult.detailActionButtons, true);

  return {
    elements,
    mode,
    trace,
    actions,
    advanceBy: timers.advanceBy,
    getToasts: () => toasts.slice(),
    getStatusCalls: () => statusCalls.slice(),
    getOutcomes: () => outcomes.slice(),
    getUpdateMemoryCalls: () => updateMemoryCalls.slice(),
    getUpdateDetailPanelCalls: () => updateDetailPanelCalls,
    getUpdateSidebarStatusCalls: () => updateSidebarStatusCalls,
    getRerenderCanvasCalls: () => rerenderCanvasCalls,
    getRefreshMemoriesCallCount: () => refreshMemoriesCallCount,
    getCallCounts: () => ({
      enterEditMode: trace.filter((entry) => entry.step === 'enterEditMode').length,
      exitEditMode: trace.filter((entry) => entry.step === 'exitEditMode').length,
      saveMemoryEdit: trace.filter((entry) => entry.step === 'saveMemoryEdit').length
    }),
    clickEditButton() {
      trace.push({
        step: 'editButton:before',
        modeBefore: mode.getMode(),
        detailViewDisplay: elements.detailViewMode.style.display,
        detailEditDisplay: elements.detailEditMode.style.display
      });
      elements.editMemoryBtn.dispatchEvent({
        type: 'click',
        preventDefault() {},
        stopPropagation() {}
      });
      trace.push({
        step: 'editButton:after',
        modeAfter: mode.getMode(),
        detailViewDisplay: elements.detailViewMode.style.display,
        detailEditDisplay: elements.detailEditMode.style.display
      });
      timers.advanceBy(0);
    },
    async clickSaveButton() {
      trace.push({
        step: 'saveButton:before',
        modeBefore: mode.getMode(),
        detailViewDisplay: elements.detailViewMode.style.display,
        detailEditDisplay: elements.detailEditMode.style.display
      });
      elements.saveEditBtn.dispatchEvent({
        type: 'click',
        preventDefault() {},
        stopPropagation() {}
      });
      trace.push({
        step: 'saveButton:after',
        modeAfter: mode.getMode(),
        detailViewDisplay: elements.detailViewMode.style.display,
        detailEditDisplay: elements.detailEditMode.style.display
      });
      await Promise.resolve();
      return outcomes.at(-1);
    }
  };
}

async function runUnchangedSaveCase(initialMemory, mutateHarness) {
  const harness = createHarness({ initialMemory });
  assert.equal(harness.mode.getMode(), harness.mode.MODE_EDIT, 'production-equivalent interaction mode starts in MODE_EDIT');
  assert.equal(harness.elements.detailViewMode.style.display, 'block', 'detail view starts open');
  assert.equal(harness.elements.detailEditMode.style.display, 'none', 'detail edit form starts hidden');

  harness.clickEditButton();
  if (typeof mutateHarness === 'function') {
    mutateHarness(harness);
  }

  const result = await harness.clickSaveButton();
  return { harness, result };
}

function assertUnchangedSaveBehavior(harness, result) {
  const counts = harness.getCallCounts();
  assert.equal(counts.enterEditMode, 1, 'enterEditMode called exactly once');
  assert.equal(counts.saveMemoryEdit, 1, 'saveMemoryEdit called exactly once');
  assert.equal(counts.exitEditMode, 0, 'exitEditMode not called for unchanged save');

  assert.equal(harness.getUpdateMemoryCalls().length, 0, 'updateMemory must not run for unchanged save');
  assert.equal(harness.getUpdateDetailPanelCalls(), 0, 'updateDetailPanel must not run for unchanged save');
  assert.equal(harness.getUpdateSidebarStatusCalls(), 0, 'updateSidebarStatus must not run for unchanged save');
  assert.equal(harness.getRerenderCanvasCalls(), 0, 'rerenderCanvas must not run for unchanged save');
  assert.equal(harness.getRefreshMemoriesCallCount(), 0, 'refreshMemories must not run for unchanged save');

  assert.equal(result.outcome, 'no_change');
  assert.equal(result.saveStatus, 'manual_nochange');
  assert.equal(harness.elements.saveStatusText.textContent, '변경된 내용이 없어요');
  assert.notEqual(harness.elements.saveStatusText.textContent, '저장됨');
  assert.deepEqual(harness.getToasts(), [{ message: '변경된 내용이 없어요', type: 'info' }]);

  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'edit form stays open immediately after save');
  assert.equal(harness.elements.detailViewMode.style.display, 'none', 'detail view stays hidden immediately after save');

  harness.advanceBy(250);
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'edit form stays open after 250ms');
  assert.equal(harness.elements.detailViewMode.style.display, 'none', 'detail view stays hidden after 250ms');

  harness.advanceBy(750);
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'edit form stays open after 1s');
  assert.equal(harness.elements.detailViewMode.style.display, 'none', 'detail view stays hidden after 1s');
}

test('route seam proof: editor.js binds detail edit/save through bindEditorPageEvents', () => {
  assertProductionEntrySeam();
});

test('Case 1: Plain title/memo/tags unchanged save', async () => {
  const initialMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: '동일제목',
    memo: '동일메모',
    emotionTags: ['태그1', '태그2'],
    sourceUrl: ''
  };

  const { harness, result } = await runUnchangedSaveCase(initialMemory);
  assertUnchangedSaveBehavior(harness, result);
});

test('Case 2: Memo with CRLF line breaks unchanged save', async () => {
  const initialMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: '제목',
    memo: '첫 줄\r\n둘째 줄',
    emotionTags: [],
    sourceUrl: ''
  };

  const { harness, result } = await runUnchangedSaveCase(initialMemory);
  assertUnchangedSaveBehavior(harness, result);
});

test('Case 3: Tags with whitespace/order variation unchanged save', async () => {
  const initialMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: '제목',
    memo: '메모',
    emotionTags: ['태그A', '태그B'],
    sourceUrl: ''
  };

  const { harness, result } = await runUnchangedSaveCase(initialMemory, (ctx) => {
    ctx.elements.editTagsInput.value = '  태그B, 태그A  ';
  });

  assertUnchangedSaveBehavior(harness, result);
});

test('Case 4: YouTube source URL with start/end segment unchanged save', async () => {
  const initialMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: '제목',
    memo: '메모',
    emotionTags: [],
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=83&end=125'
  };

  const { harness, result } = await runUnchangedSaveCase(initialMemory);

  assert.equal(harness.elements.editStartTimeInput.value, '1:23');
  assert.equal(harness.elements.editEndTimeInput.value, '2:05');
  assertUnchangedSaveBehavior(harness, result);
});
