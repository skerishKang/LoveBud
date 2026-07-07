const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-bindings.js');
const STATUS_PATH = path.join(ROOT, 'js/editor/editor-save-status.js');
const ORCHESTRATION_PATH = path.join(ROOT, 'js/editor/editor-save-status-orchestration.js');
const REFRESH_PATH = path.join(ROOT, 'js/editor/editor-refresh-save-runtime.js');
const HELPERS_PATH = path.join(ROOT, 'js/editor/editor-helpers.js');

function createHarness(options = {}) {
  const makeFakeElement = (id, tagName = 'div') => {
    let internalVal = '';
    const el = {
      id,
      tagName: String(tagName).toUpperCase(),
      disabled: false,
      get value() {
        return internalVal;
      },
      set value(v) {
        if (tagName.toLowerCase() === 'textarea') {
          internalVal = String(v).replace(/\r\n/g, '\n');
        } else {
          internalVal = v;
        }
      },
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
      focus() {
        // Mock focus method
      },
      closest() {
        return el;
      },
      querySelectorAll() {
        return [];
      },
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this._classes.add(c);
            else this._classes.delete(c);
          } else {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
          }
        },
        contains(c) {
          return this._classes.has(c);
        }
      }
    };
    el.parentNode = {
      insertBefore(newNode, refNode) {
        // Mock insertBefore
      }
    };
    return el;
  };

  const documentElement = makeFakeElement('html', 'html');
  const elements = {
    detailPanel: makeFakeElement('detailPanel', 'div'),
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
    editEndTimeInput: makeFakeElement('editEndTimeInput', 'input'),
    saveStatusIndicator: makeFakeElement('saveStatusIndicator', 'div'),
    saveStatusText: makeFakeElement('saveStatusText', 'span')
  };

  elements.detailViewMode.style.display = 'block';
  elements.detailEditMode.style.display = 'none';

  const doc = {
    documentElement,
    body: makeFakeElement('body', 'body'),
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = makeFakeElement(id, id.includes('Input') ? 'input' : 'div');
      }
      return elements[id];
    },
    createElement(tagName) {
      return makeFakeElement('_created_' + tagName, tagName);
    },
    addEventListener() {}
  };

  const toasts = [];
  const statusCalls = [];
  const outcomes = [];

  let currentEditingMemory = options.initialMemory;
  let treeMemories = currentEditingMemory ? [{ ...currentEditingMemory }] : [];
  let updateMemoryCalls = [];

  let modeState = 'edit';

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
        if (opts.startSeconds) {
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
        if (seconds === null || seconds === undefined) return '';
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
    LoveBudCache: {
      set() {}
    },
    LoveBudUI: {
      showToast(message, type) {
        toasts.push({ message, type });
      }
    },
    LoveBudEditorInteractionMode: {
      isEditMode() {
        return modeState === 'edit';
      },
      setMode(m) {
        modeState = m === 'edit' ? 'edit' : 'view';
      },
      MODE_EDIT: 'edit',
      MODE_VIEW: 'view'
    }
  };

  const sandbox = {
    console: { ...console, error: () => {} },
    document: doc,
    setTimeout,
    clearTimeout,
    window: windowObject
  };

  vm.createContext(sandbox);

  // Load implementation files
  vm.runInContext(fs.readFileSync(HELPERS_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(STATUS_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(ORCHESTRATION_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(REFRESH_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(BINDINGS_PATH, 'utf8'), sandbox);

  // We obtain the real createToast from LoveBudEditorHelpers
  const realCreateToast = sandbox.window.LoveBudEditorHelpers.createToast();

  // Set up save status orchestration via the real createEditorRefreshSaveRuntime
  const refreshSaveRuntime = sandbox.window.LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime({
    log: () => {},
    reportError: () => {},
    editorDataLoader: {
      createRefreshMemories: () => {
        return () => {};
      }
    },
    treeId: 'tree-1',
    apiClient: windowObject.apiClient,
    normalizeMemory: (m) => m,
    treeMemories: () => treeMemories,
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (m) => { currentEditingMemory = m; },
    isRootMemory: () => false,
    canonicalRootId: 'memory-1',
    updateDetailPanel: () => {},
    updateSidebarStatus: () => {},
    initCanvas: () => {},
    exposeRefreshMemoriesBridge: () => {},
    resolveSaveStatusTimeFormatter: () => {
      return (d) => sandbox.window.LoveBudEditorSaveStatus.formatTimeAgo(d);
    },
    editorSaveStatus: sandbox.window.LoveBudEditorSaveStatus,
    i18n: (key) => key,
    createSaveStatusOrchestrationFallback: () => {
      return sandbox.window.LoveBudEditorSaveStatusOrchestration.createEditorSaveStatusOrchestration;
    },
    saveStatusOrchestrationHelper: sandbox.window.LoveBudEditorSaveStatusOrchestration
  });
  const updateSaveStatus = refreshSaveRuntime.updateSaveStatus;

  // Real actions setup
  const actions = sandbox.window.createEditorMemoryActions({
    i18n: (key) => key,
    updateSaveStatus: (status, message) => {
      statusCalls.push({ status, message });
      updateSaveStatus(status, message);
    },
    updateDetailPanel: () => {},
    updateSidebarStatus: () => {},
    showToast: (msg, type) => {
      realCreateToast(msg, type);
    },
    reportSaveOutcome: (res) => outcomes.push(res),
    getCurrentEditingMemory: () => currentEditingMemory,
    setCurrentEditingMemory: (m) => { currentEditingMemory = m; },
    getTreeMemories: () => treeMemories,
    setTreeMemories: (m) => { treeMemories = m; },
    getSelectedNodeId: () => currentEditingMemory && currentEditingMemory.id,
    setSelectedNodeId: () => {},
    getCanonicalRootId: () => 'memory-1',
    isRootMemory: () => false,
    findRootMemory: () => null,
    detailPanel: elements.detailPanel,
    svg: null,
    calcPosition: () => ({ x: 0, y: 0 }),
    setDetailEmptyState: () => {},
    rerenderCanvas: () => {},
    getCurrentTreeData: () => ({ id: 'tree-1', memories: treeMemories }),
    isLocalSaveMode: () => false,
    canEdit: true
  });

  // Bind UI elements
  sandbox.window.LoveBudEditorBindings.bindDetailActionButtons({
    detailPanel: elements.detailPanel,
    enterEditMode: () => {
      actions.enterEditMode();
    },
    deleteMemory: () => {},
    exitEditMode: () => {
      actions.exitEditMode();
    },
    saveMemoryEdit: () => {
      return actions.saveMemoryEdit();
    }
  });

  return {
    actions,
    elements,
    getToasts: () => toasts.slice(),
    getStatusCalls: () => statusCalls.slice(),
    getOutcomes: () => outcomes.slice(),
    getUpdateMemoryCalls: () => updateMemoryCalls.slice(),
    triggerEnterEditMode: () => {
      elements.editMemoryBtn.dispatchEvent({ type: 'click' });
    },
    triggerSaveClick: async () => {
      // Production path: click bound saveEditBtn
      elements.saveEditBtn.dispatchEvent({ type: 'click' });
      // We must wait for any promise microtasks since saveMemoryEdit is async
      await new Promise(resolve => setTimeout(resolve, 0));
      // Return the save outcome (recorded in outcomes)
      return outcomes.at(-1);
    }
  };
}

test('Case 1: Plain title/memo/tags unchanged save', async () => {
  const initialMemory = {
    id: 'memory-1',
    treeId: 'tree-1',
    title: '동일제목',
    memo: '동일메모',
    emotionTags: ['태그1', '태그2'],
    sourceUrl: ''
  };

  const harness = createHarness({ initialMemory });
  harness.triggerEnterEditMode();

  const res = await harness.triggerSaveClick();

  assert.equal(harness.getUpdateMemoryCalls().length, 0, 'Should call updateMemory 0 times');
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'detailEditMode remains open');
  assert.equal(harness.elements.detailViewMode.style.display, 'none', 'detailViewMode remains hidden');
  
  assert.equal(res.outcome, 'no_change');
  assert.equal(harness.elements.saveStatusText.textContent, '변경된 내용이 없어요');
  assert.deepEqual(harness.getToasts(), [{ message: '변경된 내용이 없어요', type: 'info' }]);
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

  const harness = createHarness({ initialMemory });
  harness.triggerEnterEditMode();

  const res = await harness.triggerSaveClick();

  assert.equal(harness.getUpdateMemoryCalls().length, 0, 'Should call updateMemory 0 times when CRLF is unchanged');
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'detailEditMode remains open');
  assert.equal(res.outcome, 'no_change');
  assert.equal(harness.elements.saveStatusText.textContent, '변경된 내용이 없어요');
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

  const harness = createHarness({ initialMemory });
  harness.triggerEnterEditMode();

  harness.elements.editTagsInput.value = '  태그B, 태그A  ';

  const res = await harness.triggerSaveClick();

  assert.equal(harness.getUpdateMemoryCalls().length, 0, 'Should call updateMemory 0 times when tags are normalized-identical');
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'detailEditMode remains open');
  assert.equal(res.outcome, 'no_change');
  assert.equal(harness.elements.saveStatusText.textContent, '변경된 내용이 없어요');
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

  const harness = createHarness({ initialMemory });
  harness.triggerEnterEditMode();

  assert.equal(harness.elements.editStartTimeInput.value, '1:23');
  assert.equal(harness.elements.editEndTimeInput.value, '2:05');

  const res = await harness.triggerSaveClick();

  assert.equal(harness.getUpdateMemoryCalls().length, 0, 'Should call updateMemory 0 times when YouTube segment is unchanged');
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'detailEditMode remains open');
  assert.equal(res.outcome, 'no_change');
  assert.equal(harness.elements.saveStatusText.textContent, '변경된 내용이 없어요');
});
