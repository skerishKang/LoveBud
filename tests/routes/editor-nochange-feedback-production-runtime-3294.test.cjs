const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const EDITOR_ENTRY_PATH = path.join(ROOT, 'js/editor.js');
const PAGE_HELPERS_PATH = path.join(ROOT, 'js/editor/editor-page-helpers.js');
const REFRESH_RUNTIME_PATH = path.join(ROOT, 'js/editor/editor-refresh-save-runtime.js');
const DATA_LOADER_PATH = path.join(ROOT, 'js/editor/editor-data-loader.js');
const DETAIL_UI_PATH = path.join(ROOT, 'js/editor/editor-detail-ui.js');
const MEMORY_ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-memory-actions.js');
const BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-bindings.js');
const PAGE_EVENT_BINDINGS_PATH = path.join(ROOT, 'js/editor/editor-page-event-bindings.js');
const SAVE_STATUS_PATH = path.join(ROOT, 'js/editor/editor-save-status.js');
const SAVE_STATUS_ORCHESTRATION_PATH = path.join(ROOT, 'js/editor/editor-save-status-orchestration.js');
const INTERACTION_MODE_PATH = path.join(ROOT, 'js/editor/editor-interaction-mode.js');

const editorSource = fs.readFileSync(EDITOR_ENTRY_PATH, 'utf8');

function assertEditorEntrySeam() {
  assert.match(editorSource, /deps\.registerEditorAuthStart\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
  assert.match(editorSource, /const isDetailEditActive = \(\) => \{/);
  assert.match(editorSource, /isDetailEditActive, updateDetailPanel/);
  assert.match(editorSource, /window\.createEditorDetailUI\(/);
  assert.match(editorSource, /window\.createEditorMemoryActions\(/);
  assert.match(editorSource, /bindEditorPageEvents\(\{/);
  assert.match(editorSource, /saveMemoryEdit/);
}

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = [];

  function schedule(fn, delay) {
    const id = nextId++;
    pending.push({
      id,
      runAt: now + Math.max(0, Number(delay) || 0),
      fn
    });
    return id;
  }

  function cancel(id) {
    const index = pending.findIndex((timer) => timer.id === id);
    if (index >= 0) pending.splice(index, 1);
  }

  function advanceBy(ms) {
    const target = now + Math.max(0, Number(ms) || 0);
    pending.sort((a, b) => a.runAt - b.runAt);

    while (pending.length && pending[0].runAt <= target) {
      const timer = pending.shift();
      now = timer.runAt;
      timer.fn();
      pending.sort((a, b) => a.runAt - b.runAt);
    }

    now = target;
  }

  return {
    setTimeoutFake: schedule,
    clearTimeoutFake: cancel,
    advanceBy
  };
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function summarizeTrace(trace) {
  return trace.map((entry) => {
    return JSON.stringify(entry);
  }).join('\n');
}

function findFirstFormCloseWriter(trace) {
  return trace.find((entry) => {
    return entry.type === 'style-write' && entry.id === 'detailEditMode' && entry.value === 'none';
  }) || null;
}

function createStyleProxy(trace, id, writerRef) {
  const values = Object.create(null);
  return new Proxy(values, {
    get(target, prop) {
      if (prop === 'setProperty') {
        return (name, value) => {
          target[name] = value;
          if (name === 'display') {
            trace.push({
              type: 'style-write',
              id,
              prop: 'display',
              value,
              writer: writerRef.current
            });
          }
        };
      }
      return target[prop] || '';
    },
    set(target, prop, value) {
      target[prop] = value;
      if (prop === 'display') {
        trace.push({
          type: 'style-write',
          id,
          prop: 'display',
          value,
          writer: writerRef.current
        });
      }
      return true;
    }
  });
}

function createClassList() {
  const values = new Set();
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
        return;
      }
      if (force) values.add(name);
      else values.delete(name);
    }
  };
}

function matchesSimpleSelector(element, selector) {
  if (!element) return false;
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (selector.startsWith('.')) return element.classList && element.classList.contains(selector.slice(1));
  if (selector === 'h3') return element.tagName === 'H3';
  if (selector === 'img') return element.tagName === 'IMG';
  if (selector === 'button') return element.tagName === 'BUTTON';
  if (selector === 'textarea') return element.tagName === 'TEXTAREA';
  if (selector === '[data-editor-detail-player="1"]') {
    return element.dataset && element.dataset.editorDetailPlayer === '1';
  }
  return false;
}

function queryDescendants(root, selectorParts) {
  if (!root) return null;
  const [first, ...rest] = selectorParts;
  const queue = Array.isArray(root.children) ? root.children.slice() : [];

  while (queue.length) {
    const node = queue.shift();
    if (matchesSimpleSelector(node, first)) {
      if (rest.length === 0) return node;
      const nested = queryDescendants(node, rest);
      if (nested) return nested;
    }
    if (node.children && node.children.length) {
      queue.push(...node.children);
    }
  }

  return null;
}

function queryAllDescendants(root, selectorParts, results) {
  const queue = Array.isArray(root.children) ? root.children.slice() : [];

  while (queue.length) {
    const node = queue.shift();
    if (matchesSimpleSelector(node, selectorParts[0])) {
      if (selectorParts.length === 1) {
        results.push(node);
      } else {
        const nested = queryDescendants(node, selectorParts.slice(1));
        if (nested) results.push(nested);
      }
    }
    if (node.children && node.children.length) {
      queue.push(...node.children);
    }
  }
}

function createElement(tagName, id, trace, writerRef) {
  const element = {
    id: id || '',
    tagName: String(tagName || 'div').toUpperCase(),
    dataset: {},
    style: createStyleProxy(trace, id || tagName || 'anon', writerRef),
    classList: createClassList(),
    children: [],
    parentElement: null,
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    innerHTML: '',
    attributes: {},
    _listeners: Object.create(null),
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, before) {
      child.parentElement = this;
      if (!before) {
        this.children.push(child);
        return child;
      }
      const index = this.children.indexOf(before);
      if (index === -1) {
        this.children.push(child);
        return child;
      }
      this.children.splice(index, 0, child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = [];
      nodes.forEach((node) => {
        node.parentElement = this;
        this.children.push(node);
      });
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentElement = null;
      }
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.removeChild(this);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    addEventListener(type, handler) {
      this._listeners[type] = this._listeners[type] || [];
      this._listeners[type].push(handler);
    },
    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      handlers.forEach((handler) => handler(event));
    },
    focus() {},
    contains(child) {
      let current = child;
      while (current) {
        if (current === this) return true;
        current = current.parentElement;
      }
      return false;
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (matchesSimpleSelector(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelector(selector) {
      const selectorParts = selector.trim().split(/\s+/);
      return queryDescendants(this, selectorParts);
    },
    querySelectorAll(selector) {
      const selectorParts = selector.trim().split(/\s+/);
      const results = [];
      queryAllDescendants(this, selectorParts, results);
      return results;
    }
  };

  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML || '';
    },
    set(value) {
      this._innerHTML = String(value);
      if (String(value).includes('detailEmptyStartBtn') && !this.querySelector('#detailEmptyStartBtn')) {
        const startBtn = createElement('button', 'detailEmptyStartBtn', trace, writerRef);
        this.appendChild(startBtn);
      }
    }
  });

  return element;
}

function createHarness() {
  assertEditorEntrySeam();

  const trace = [];
  const writerRef = { current: 'bootstrap' };
  const timers = createFakeTimers();
  const registry = Object.create(null);
  let authReadyCallback = null;
  let currentEditingMemory = null;
  let currentTreeMemories = [];
  let selectedNodeId = null;
  let startEditorCalls = 0;
  let updateMemoryCalls = 0;
  let refreshRequestCount = 0;
  let refreshResolveCount = 0;
  const toasts = [];
  const statusCalls = [];
  let toastRenderCount = 0;

  function registerElement(element) {
    if (element.id) registry[element.id] = element;
    return element;
  }

  const documentElement = registerElement(createElement('html', 'documentElement', trace, writerRef));
  const body = registerElement(createElement('body', 'body', trace, writerRef));

  const detailPanel = registerElement(createElement('aside', 'detailPanel', trace, writerRef));
  const panelHeader = registerElement(createElement('div', 'panelHeader', trace, writerRef));
  const panelTitle = registerElement(createElement('h3', 'panelTitle', trace, writerRef));
  const detailContent = registerElement(createElement('div', 'detailContent', trace, writerRef));
  const detailViewMode = registerElement(createElement('div', 'detailViewMode', trace, writerRef));
  const detailEditMode = registerElement(createElement('div', 'detailEditMode', trace, writerRef));
  const detailPanelFooter = registerElement(createElement('div', 'detailPanelFooter', trace, writerRef));
  const saveStatusIndicator = registerElement(createElement('div', 'saveStatusIndicator', trace, writerRef));
  const saveStatusIcon = registerElement(createElement('span', 'saveStatusIcon', trace, writerRef));
  const saveStatusText = registerElement(createElement('span', 'saveStatusText', trace, writerRef));
  const lastSavedTime = registerElement(createElement('span', 'lastSavedTime', trace, writerRef));
  const detailTreeMetaMount = registerElement(createElement('div', 'detailTreeMetaMount', trace, writerRef));
  const detailCurrentMomentBadge = registerElement(createElement('div', 'detailCurrentMomentBadge', trace, writerRef));
  const detailCurrentMomentTitle = registerElement(createElement('h4', 'detailCurrentMomentTitle', trace, writerRef));
  const detailCurrentMomentHint = registerElement(createElement('p', 'detailCurrentMomentHint', trace, writerRef));
  const detailDateText = registerElement(createElement('p', 'detailDateText', trace, writerRef));
  const detailEntitySearchMount = registerElement(createElement('div', 'detailEntitySearchMount', trace, writerRef));
  const detailMemoLabel = registerElement(createElement('label', 'detailMemoLabel', trace, writerRef));
  const detailMemo = registerElement(createElement('div', 'detailMemo', trace, writerRef));
  const detailAtlasPreviewMount = registerElement(createElement('div', 'detailAtlasPreviewMount', trace, writerRef));
  const momentReactionsCard = registerElement(createElement('div', 'momentReactionsCard', trace, writerRef));
  const momentLikeBtn = registerElement(createElement('button', 'momentLikeBtn', trace, writerRef));
  const momentLikeIcon = registerElement(createElement('span', 'momentLikeIcon', trace, writerRef));
  const momentLikeCount = registerElement(createElement('span', 'momentLikeCount', trace, writerRef));
  const momentCommentBtn = registerElement(createElement('button', 'momentCommentBtn', trace, writerRef));
  const momentCommentCount = registerElement(createElement('span', 'momentCommentCount', trace, writerRef));
  const viewMomentDetailBtn = registerElement(createElement('button', 'viewMomentDetailBtn', trace, writerRef));
  const continueFromMomentBtn = registerElement(createElement('button', 'continueFromMomentBtn', trace, writerRef));
  const editMemoryBtn = registerElement(createElement('button', 'editMemoryBtn', trace, writerRef));
  const deleteMemoryBtn = registerElement(createElement('button', 'deleteMemoryBtn', trace, writerRef));
  const cancelEditBtn = registerElement(createElement('button', 'cancelEditBtn', trace, writerRef));
  const saveEditBtn = registerElement(createElement('button', 'saveEditBtn', trace, writerRef));
  const editTitleInput = registerElement(createElement('input', 'editTitleInput', trace, writerRef));
  const editMemoInput = registerElement(createElement('textarea', 'editMemoInput', trace, writerRef));
  const editTagsInput = registerElement(createElement('input', 'editTagsInput', trace, writerRef));
  const editSourceUrlGroup = registerElement(createElement('div', 'editSourceUrlGroup', trace, writerRef));
  const editSourceUrlInput = registerElement(createElement('input', 'editSourceUrlInput', trace, writerRef));
  const editVideoSegmentGrid = registerElement(createElement('div', 'editVideoSegmentGrid', trace, writerRef));
  const editStartTimeInput = registerElement(createElement('input', 'editStartTimeInput', trace, writerRef));
  const editEndTimeInput = registerElement(createElement('input', 'editEndTimeInput', trace, writerRef));
  const focusSelectedBtn = registerElement(createElement('button', 'focusSelectedBtn', trace, writerRef));
  const detailTags = registerElement(createElement('div', 'detailTags', trace, writerRef));
  const diaryNote = registerElement(createElement('div', 'diaryNote', trace, writerRef));
  const memoryActions = registerElement(createElement('div', 'memoryActions', trace, writerRef));
  const mediaWrap = registerElement(createElement('div', 'mediaWrap', trace, writerRef));
  const detailImg = registerElement(createElement('img', 'detailImg', trace, writerRef));
  const previewOverlay = registerElement(createElement('div', 'previewOverlay', trace, writerRef));
  const playBtn = registerElement(createElement('button', 'playBtn', trace, writerRef));
  const memoGroup = registerElement(createElement('div', 'memoGroup', trace, writerRef));

  panelHeader.appendChild(panelTitle);
  detailPanel.appendChild(panelHeader);
  detailPanel.appendChild(detailContent);
  detailPanel.appendChild(saveStatusIndicator);
  detailPanel.appendChild(detailPanelFooter);

  detailContent.appendChild(detailViewMode);
  detailContent.appendChild(detailEditMode);
  detailContent.appendChild(memoryActions);
  detailContent.appendChild(detailAtlasPreviewMount);

  saveStatusIndicator.appendChild(saveStatusIcon);
  saveStatusIndicator.appendChild(saveStatusText);
  saveStatusIndicator.appendChild(lastSavedTime);

  detailViewMode.appendChild(detailTreeMetaMount);
  detailViewMode.appendChild(detailCurrentMomentBadge);
  detailViewMode.appendChild(editMemoryBtn);
  detailViewMode.appendChild(detailCurrentMomentTitle);
  detailViewMode.appendChild(detailCurrentMomentHint);
  detailViewMode.appendChild(mediaWrap);
  detailViewMode.appendChild(viewMomentDetailBtn);
  detailViewMode.appendChild(continueFromMomentBtn);
  detailViewMode.appendChild(detailDateText);
  detailViewMode.appendChild(detailTags);
  detailViewMode.appendChild(detailEntitySearchMount);
  detailViewMode.appendChild(detailMemoLabel);
  detailViewMode.appendChild(diaryNote);
  detailViewMode.appendChild(momentReactionsCard);

  mediaWrap.classList.add('detail-video');
  mediaWrap.appendChild(detailImg);
  previewOverlay.classList.add('memory-preview-overlay');
  playBtn.classList.add('play-btn');
  previewOverlay.appendChild(playBtn);
  mediaWrap.appendChild(previewOverlay);

  momentLikeIcon.classList.add('editor-reaction-like-icon');
  momentReactionsCard.appendChild(momentLikeBtn);
  momentLikeBtn.appendChild(momentLikeIcon);
  momentLikeBtn.appendChild(momentLikeCount);
  momentCommentBtn.appendChild(momentCommentCount);
  momentReactionsCard.appendChild(momentCommentBtn);

  memoGroup.classList.add('editor-form-stack');
  memoGroup.appendChild(editMemoInput);

  editSourceUrlGroup.appendChild(editSourceUrlInput);
  editVideoSegmentGrid.appendChild(editStartTimeInput);
  editVideoSegmentGrid.appendChild(editEndTimeInput);
  detailEditMode.appendChild(editTitleInput);
  detailEditMode.appendChild(editSourceUrlGroup);
  detailEditMode.appendChild(editVideoSegmentGrid);
  detailEditMode.appendChild(memoGroup);
  detailEditMode.appendChild(editTagsInput);
  detailEditMode.appendChild(cancelEditBtn);
  detailEditMode.appendChild(saveEditBtn);
  detailEditMode.appendChild(deleteMemoryBtn);

  detailMemoLabel.parentElement = memoGroup;
  detailMemo.classList.add('diary-note');
  detailTags.classList.add('tags-container');
  memoryActions.classList.add('memory-actions');

  detailViewMode.style.display = 'block';
  detailEditMode.style.display = 'none';
  saveStatusIndicator.style.display = 'none';
  lastSavedTime.style.display = 'none';
  previewOverlay.hidden = false;

  const documentMock = {
    body,
    documentElement,
    activeElement: body,
    getElementById(id) {
      return registry[id] || null;
    },
    createElement(tagName) {
      return createElement(tagName, '', trace, writerRef);
    },
    querySelector(selector) {
      if (selector === '.diary-note') return detailMemo;
      if (selector === '.detail-video') return mediaWrap;
      if (selector === '.detail-video img') return detailImg;
      if (selector === '#detailPanel h3' || selector === 'h3') return panelTitle;
      return body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return body.querySelectorAll(selector);
    },
    addEventListener() {}
  };

  const secondRefreshDelayMs = 1000;
  let refreshGeneration = 0;
  const treeFixture = {
    id: 'mem-1',
    treeId: 'tree-1',
    parentId: null,
    title: '기존 순간',
    memo: '변경 없는 메모',
    emotionTags: ['첫장면'],
    sourceUrl: '',
    sourceType: 'other',
    thumbnail: '',
    timestamp: '2026-07-07'
  };

  const windowObject = {
    location: {
      search: '?treeId=tree-1',
      pathname: '/pages/editor.html',
      origin: 'https://lovebud.pages.dev'
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    registerOnAuthReady(callback) {
      authReadyCallback = callback;
    },
    LoveBudAuthBootstrap: {
      getSnapshot() {
        return { ready: true, user: { uid: 'user-1' } };
      }
    },
    LoveBudMedia: {
      extractYouTubeId() {
        return '';
      },
      parseYouTubeTimeToSeconds(value) {
        if (!value) return null;
        if (/^\d+$/.test(String(value))) return Number(value);
        const parts = String(value).split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return null;
      },
      formatYouTubeStartTime(value) {
        if (value == null) return '';
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
      }
    },
    LoveBudEditorKnowledgeLinkUI: {
      renderEntitySearch() {}
    },
    createEditorDetailUIBuilders() {
      return {
        createInlineIcon() {
          return createElement('span', '', trace, writerRef);
        },
        getDisplayEmotionTags(data) {
          return Array.isArray(data && data.emotionTags) ? data.emotionTags : [];
        },
        getMemoFallbackText() {
          return '아직 메모가 남겨지지 않았어요';
        }
      };
    },
    createEditorMemoryAtlasPreviewPanel() {
      return {
        render() {}
      };
    },
    createEditorDetailTreeMetaBoundary() {
      return {
        buildTreeMetaRenderModel() {
          return {};
        },
        renderTreeMetaBoundary() {}
      };
    },
    createEditorDetailInlineEditBoundary() {
      return {
        createTitleEditBoundary() {},
        createMemoEditBoundary() {}
      };
    },
    createEditorDetailSidebarStatusBoundary() {
      return {
        updateSidebarStatus() {}
      };
    },
    apiClient: {
      updateMemory: async () => {
        updateMemoryCalls += 1;
        trace.push({ type: 'apiClient.updateMemory' });
        return treeFixture;
      },
      getMemoriesByTree: async () => {
        refreshRequestCount += 1;
        const generation = ++refreshGeneration;
        trace.push({
          type: 'apiClient.getMemoriesByTree',
          generation
        });
        return new Promise((resolve) => {
          timers.setTimeoutFake(() => {
            refreshResolveCount += 1;
            trace.push({
              type: 'apiClient.getMemoriesByTree:resolve',
              generation
            });
            resolve([{ ...treeFixture }]);
          }, secondRefreshDelayMs);
        });
      }
    }
  };

  windowObject.LoveBudUI = {
    showToast(message, type) {
      toastRenderCount += 1;
      trace.push({ type: 'toast.presenter', message, toastType: type });
      toasts.push({ message, type });
    }
  };

  const sandbox = {
    console: { ...console, warn() {}, error() {} },
    window: windowObject,
    document: documentMock,
    localStorage: windowObject.localStorage,
    URL,
    URLSearchParams,
    Date,
    setTimeout: timers.setTimeoutFake,
    clearTimeout: timers.clearTimeoutFake
  };
  sandbox.window.window = sandbox.window;

  vm.createContext(sandbox);
  [
    INTERACTION_MODE_PATH,
    SAVE_STATUS_PATH,
    SAVE_STATUS_ORCHESTRATION_PATH,
    DATA_LOADER_PATH,
    REFRESH_RUNTIME_PATH,
    PAGE_HELPERS_PATH,
    MEMORY_ACTIONS_PATH,
    BINDINGS_PATH,
    PAGE_EVENT_BINDINGS_PATH,
    DETAIL_UI_PATH
  ].forEach((filePath) => {
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

  const originalStateMachineUpdateSaveStatus = sandbox.window.LoveBudEditorSaveStatus.updateSaveStatus;
  sandbox.window.LoveBudEditorSaveStatus.updateSaveStatus = function patchedSaveStatusStateMachine(state, options) {
    trace.push({
      type: 'LoveBudEditorSaveStatus.updateSaveStatus',
      status: options && options.status,
      message: options && options.message
    });
    return originalStateMachineUpdateSaveStatus.call(this, state, options);
  };

  const originalUpdateUI = sandbox.window.LoveBudEditorSaveStatus.updateUI;
  sandbox.window.LoveBudEditorSaveStatus.updateUI = function patchedUpdateUI(state, options) {
    trace.push({
      type: 'LoveBudEditorSaveStatus.updateUI',
      phase: state && state.phase,
      saveType: state && state.type,
      message: options && options.message
    });
    return originalUpdateUI.call(this, state, options);
  };

  const mode = sandbox.window.LoveBudEditorInteractionMode;
  const originalSetMode = mode.setMode;
  mode.setMode = function patchedSetMode(nextMode) {
    trace.push({
      type: 'interaction-mode.setMode',
      nextMode
    });
    return originalSetMode.call(this, nextMode);
  };
  mode.subscribe(function onModeChange(nextMode) {
    trace.push({
      type: 'interaction-mode.subscriber',
      nextMode
    });
  });

  const actualCreateRefreshMemories = sandbox.window.LoveBudEditorDataLoader.createRefreshMemories;
  const wrappedDataLoader = {
    createRefreshMemories(options) {
      return actualCreateRefreshMemories({
        ...options,
        onMemoriesUpdated(memories) {
          trace.push({
            type: 'handleMemoriesUpdated',
            count: Array.isArray(memories) ? memories.length : -1
          });
          return options.onMemoriesUpdated(memories);
        }
      });
    }
  };

  let detailUIRef = null;
  let actionsRef = null;
  let domContentLoadedHandler = null;
  documentMock.addEventListener = function addEventListener(type, handler) {
    if (type === 'DOMContentLoaded') {
      domContentLoadedHandler = handler;
    }
  };
  sandbox.window.addEventListener = function() {};

  const actualCreateEditorDetailUI = sandbox.window.createEditorDetailUI;
  sandbox.window.createEditorDetailUI = function createTracedDetailUI(options) {
    trace.push({ type: 'createEditorDetailUI' });
    const detailUI = actualCreateEditorDetailUI(options);

    const originalSetDetailEmptyState = detailUI.setDetailEmptyState;
    detailUI.setDetailEmptyState = function wrappedSetDetailEmptyState(isEmpty) {
      trace.push({ type: 'setDetailEmptyState', isEmpty });
      const previousWriter = writerRef.current;
      writerRef.current = 'setDetailEmptyState';
      try {
        return originalSetDetailEmptyState.call(this, isEmpty);
      } finally {
        writerRef.current = previousWriter;
      }
    };

    const originalUpdateDetailPanel = detailUI.updateDetailPanel;
    detailUI.updateDetailPanel = function wrappedUpdateDetailPanel(data) {
      trace.push({
        type: 'updateDetailPanel',
        id: data && data.id ? data.id : null
      });
      const previousWriter = writerRef.current;
      writerRef.current = 'updateDetailPanel';
      try {
        return originalUpdateDetailPanel.call(this, data);
      } finally {
        writerRef.current = previousWriter;
      }
    };

    detailUIRef = detailUI;
    sandbox.window.__testActiveDetailPanelUpdate = detailUI.updateDetailPanel;
    return detailUI;
  };

  const actualCreateEditorMemoryActions = sandbox.window.createEditorMemoryActions;
  sandbox.window.createEditorMemoryActions = function createTracedMemoryActions(options) {
    trace.push({ type: 'createEditorMemoryActions' });
    const wrappedOptions = {
      ...options,
      updateSaveStatus(status, message) {
        trace.push({ type: 'updateSaveStatus', status, message });
        statusCalls.push({ status, message });
        return options.updateSaveStatus(status, message);
      },
      showToast(message, type) {
        trace.push({ type: 'showToast', message, toastType: type });
        return options.showToast(message, type);
      }
    };
    const actions = actualCreateEditorMemoryActions(wrappedOptions);
    const originalEnterEditMode = actions.enterEditMode;
    actions.enterEditMode = function wrappedEnterEditMode() {
      trace.push({ type: 'enterEditMode' });
      return originalEnterEditMode.apply(this, arguments);
    };

    const originalExitEditMode = actions.exitEditMode;
    actions.exitEditMode = function wrappedExitEditMode() {
      trace.push({ type: 'exitEditMode' });
      return originalExitEditMode.apply(this, arguments);
    };

    const originalSaveMemoryEdit = actions.saveMemoryEdit;
    actions.saveMemoryEdit = function wrappedSaveMemoryEdit() {
      trace.push({ type: 'saveMemoryEdit' });
      return originalSaveMemoryEdit.apply(this, arguments);
    };

    actionsRef = actions;
    return actions;
  };

  sandbox.window.createEditorMemoryForm = function createEditorMemoryFormStub() {
    return {
      showAddMemoryForm() {},
      hideAddMemoryForm() {},
      async addMemoryFromForm() {},
      async addMemoryFromScoutPayload() {}
    };
  };

  sandbox.window.createEditorCanvas = function createEditorCanvasStub() {
    return {
      calcPosition() { return { x: 0, y: 0 }; },
      drawBranch() {},
      drawNode() {},
      initCanvas() {},
      focusNodeById() {},
      updateAffordance() {},
      clearGrowthAffordance() {},
      clearEdgeSelection() {}
    };
  };

  sandbox.window.LoveBudTreeWorkspacePermission = {
    resolveTreeWorkspaceCanEdit() {
      return true;
    }
  };
  sandbox.window.LoveBudEditorSidebarUI = {};
  sandbox.window.LoveBudEditorEmptyGuideUI = {};

  sandbox.window.LoveBudEditorEntryDependencies = {
    resolveEditorEntryDependencies() {
      const deps = {
        bindEditorPageEvents: sandbox.window.LoveBudEditorPageEventBindings.bindEditorPageEvents,
        runEditorInitialLoadFlow: async function runEditorInitialLoadFlow() {
          startEditorCalls += 1;
          trace.push({
            type: 'startEditor',
            count: startEditorCalls
          });
          currentTreeMemories = [{ ...treeFixture }];
          sandbox.window.currentTreeMemories = currentTreeMemories;
          sandbox.window.currentTreeData = { id: 'tree-1' };
          return {
            status: 'ready',
            treeId: 'tree-1',
            tree: { id: 'tree-1' },
            normalizeMemory: (memory) => memory,
            treeMemories: () => currentTreeMemories
          };
        },
        createEditorRefreshSaveRuntime: sandbox.window.LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime,
        createEditorStartupContext: function createEditorStartupContext() {
          return {
            canvas: null,
            svg: null,
            detailPanel,
            addBtn: null,
            urlTreeId: 'tree-1',
            canEdit: true,
            mode: null,
            memoryId: treeFixture.id
          };
        },
        registerEditorAuthStart: sandbox.window.LoveBudEditorPageHelpers.registerEditorAuthStart,
        applyEditorShellCopy() {},
        createPrepareEditorShell() {
          return function() {};
        },
        markEditorReady() {},
        applyEditorEditabilityState() {},
        createEditorDomRefs() {
          return {};
        },
        shellHelpers: {
          createEditorStartDependencyGuard() {
            return function() { return true; };
          },
          createEditorStartDependencyChecker() {
            return function() { return true; };
          },
          createEditorRequiredGlobalWaiter() {
            return async function() { return true; };
          },
          createEditorStartupShellApplier() {
            return function() {};
          },
          createEditorCanvasEmptyGuideUpdater() {
            return function() {};
          },
          createEditorSelectNodeHandler(options) {
            return function(memory) {
              if (!memory) return;
              options.setSelectedNodeId(memory.id);
              options.setCurrentEditingMemory(memory);
              options.updateDetailPanel(memory);
            };
          },
          createEditorSidebarStatusUpdater(options) {
            return function() {
              return options.updateSidebarStatusBase();
            };
          },
          createEditorInitialMemoryProvider() {
            return function() { return null; };
          },
          createEditorNextMemoryIdProvider() {
            return function() { return 'mem-2'; };
          },
          createEditorInitialSelectionApplier(options) {
            return function() {
              const nextMemory = (options.getTreeMemories() || [])[0] || null;
              options.setSelectedNodeId(nextMemory ? nextMemory.id : null);
              options.setCurrentEditingMemory(nextMemory);
              options.setDetailEmptyState(false);
              if (nextMemory && typeof sandbox.window.__testActiveDetailPanelUpdate === 'function') {
                sandbox.window.__testActiveDetailPanelUpdate(nextMemory);
              }
            };
          },
          createEditorReadyFinalizer() {
            return function() {};
          }
        },
        createEditorStartupDependencyWaiter() {
          return async function() { return true; };
        },
        exposeCanvasEmptyGuideUpdater() {},
        exposeDetailPanelUpdater() {},
        createSelectedMomentFocusHandler() {
          return function() {};
        },
        createSidebarTreeActionsUpdater() {
          return function() {};
        },
        createMemoryActionsReadinessWrapper() {
          return function() {};
        },
        createCurrentMomentDetailOpener() {
          return function() {};
        },
        resolveSaveStatusTimeFormatter() {
          return function() { return ''; };
        },
        editorSaveStatus: sandbox.window.LoveBudEditorSaveStatus,
        editorPageHelpers: sandbox.window.LoveBudEditorPageHelpers,
        editorTreeHelpers: {
          createInitialMemory() {
            return null;
          },
          nextMemoryIdFromMemories() {
            return 'mem-2';
          },
          createTreeVisibilityUpdater() {
            return function() {};
          },
          applyUpdatedTreeVisibility() {},
          resolveParentIdForCreate() {
            return null;
          }
        },
        editorSelectionUI: {},
        editorBindings: sandbox.window.LoveBudEditorBindings,
        editorDataLoader: wrappedDataLoader,
        getConfirmedSessionUser() {
          return { uid: 'user-1' };
        },
        getHttpStatus() {
          return 200;
        },
        showToast(message, type) {
          trace.push({ type: 'showToast', message, toastType: type });
          if (sandbox.window.LoveBudUI && typeof sandbox.window.LoveBudUI.showToast === 'function') {
            sandbox.window.LoveBudUI.showToast(message, type);
          }
        },
        i18n(key) {
          return key;
        },
        getEditorBasePath() {
          return '/pages/editor.html';
        },
        getMyTreesHref() {
          return '/pages/my-trees.html';
        },
        redirectToEditorLogin() {
          trace.push({ type: 'redirectToEditorLogin' });
        },
        safeI18nText(_i18n, _key, fallback) {
          return fallback;
        },
        resolveHintText() {
          return '';
        },
        resolveTreeTitleText() {
          return '트리 제목';
        },
        resolveInfoText() {
          return '';
        },
        syncCurrentTreeData() {},
        escapeHtml(value) {
          return String(value || '');
        },
        resolveMemoryThumbnail() {
          return '';
        },
        getYouTubeInputErrorMessage() {
          return '';
        },
        renderTreeLoadError() {},
        buildTreeLoadErrorCopy() {
          return {};
        },
        createEditorDebugReporter() {
          return {
            log() {},
            reportError(message) {
              trace.push({ type: 'reportError', message });
            }
          };
        },
        createSaveStatusOrchestrationFallback() {
          return sandbox.window.LoveBudEditorSaveStatusOrchestration.createEditorSaveStatusOrchestration;
        },
        exposeRefreshMemoriesBridge({ refreshMemories }) {
          sandbox.window.refreshMemories = async () => {
            trace.push({ type: 'window.refreshMemories:start' });
            const result = await refreshMemories();
            trace.push({ type: 'window.refreshMemories:done' });
            return result;
          };
        },
        findRootMemory() {
          return null;
        },
        getCanonicalRootId() {
          return 'root';
        },
        isRootMemory() {
          return false;
        }
      };

      return {
        status: 'ready',
        deps
      };
    }
  };

  vm.runInContext(fs.readFileSync(EDITOR_ENTRY_PATH, 'utf8'), sandbox, { filename: EDITOR_ENTRY_PATH });
  assert.equal(typeof domContentLoadedHandler, 'function', 'editor.js must register DOMContentLoaded bootstrap');
  domContentLoadedHandler();
  assert.equal(typeof authReadyCallback, 'function', 'registerEditorAuthStart must register auth-ready callback');

  return {
    trace,
    treeFixture,
    documentMock,
    windowObject: sandbox.window,
    mode,
    detailViewMode,
    detailEditMode,
    saveStatusIndicator,
    saveStatusText,
    editMemoryBtn,
    saveEditBtn,
    getStatusCalls: () => statusCalls.slice(),
    getToasts: () => toasts.slice(),
    getToastRenderCount: () => toastRenderCount,
    getUpdateMemoryCalls: () => updateMemoryCalls,
    getRefreshRequestCount: () => refreshRequestCount,
    getRefreshResolveCount: () => refreshResolveCount,
    getStartEditorCalls: () => startEditorCalls,
    getAuthReadyCallback: () => authReadyCallback,
    getCurrentEditingMemory: () => currentEditingMemory,
    getCurrentTreeMemories: () => currentTreeMemories,
    getDetailUI: () => detailUIRef,
    getActions: () => actionsRef,
    advanceBy(ms) {
      timers.advanceBy(ms);
    }
  };
}

function readPanelState(harness, label) {
  return {
    label,
    editDisplay: harness.detailEditMode.style.display,
    viewDisplay: harness.detailViewMode.style.display,
    statusDisplay: harness.saveStatusIndicator.style.display,
    statusText: harness.saveStatusText.textContent
  };
}

test('production runtime: unchanged save from active edit form surfaces visible status and info toast', async () => {
  const harness = createHarness();
  const authUser = { uid: 'user-1' };
  const authReady = harness.getAuthReadyCallback();

  try {
    traceInvoke(harness.trace, 'auth-ready:first');
    authReady(authUser);
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(harness.getStartEditorCalls(), 1, 'first auth-ready callback should start editor exactly once. trace=\n' + summarizeTrace(harness.trace));
    assert.ok(harness.getDetailUI(), 'detail UI should be created on first start. trace=\n' + summarizeTrace(harness.trace));
    assert.ok(harness.getActions(), 'memory actions should be created on first start. trace=\n' + summarizeTrace(harness.trace));

    harness.saveEditBtn._listeners.click = (harness.saveEditBtn._listeners.click || []).map((handler) => {
      return function tracedSaveClickListener(event) {
        harness.trace.push({ type: 'saveEditBtn.listener' });
        return handler(event);
      };
    });

    harness.mode.setMode(harness.mode.MODE_EDIT);
    harness.editMemoryBtn.dispatchEvent({
      type: 'click',
      preventDefault() {},
      stopPropagation() {}
    });
    harness.advanceBy(0);
    await flushMicrotasks();

    assert.equal(harness.detailEditMode.style.display, 'block', 'edit form should open through the real edit control');
    assert.equal(harness.detailViewMode.style.display, 'none', 'detail view should hide while editing');

    harness.saveEditBtn.dispatchEvent({
      type: 'click',
      preventDefault() {},
      stopPropagation() {}
    });
    await flushMicrotasks();

    const immediateState = readPanelState(harness, 'immediate');

    harness.advanceBy(250);
    await flushMicrotasks();
    const state250 = readPanelState(harness, '250ms');

    harness.advanceBy(750);
    await flushMicrotasks();
    const state1000 = readPanelState(harness, '1000ms');

    assert.equal(harness.getUpdateMemoryCalls(), 0, 'unchanged save must not call updateMemory');
    assert.equal(immediateState.editDisplay, 'block', 'edit form must stay visible immediately after unchanged save');
    assert.equal(immediateState.viewDisplay, 'none', 'detail view must stay hidden immediately after unchanged save');
    assert.equal(state250.editDisplay, 'block', 'edit form must stay visible at 250ms');
    assert.equal(state250.viewDisplay, 'none', 'detail view must stay hidden at 250ms');
    assert.equal(
      state1000.editDisplay,
      'block',
      'edit form must stay visible at 1s. trace=\n' + summarizeTrace(harness.trace)
    );
    assert.equal(
      state1000.viewDisplay,
      'none',
      'detail view must stay hidden at 1s. trace=\n' + summarizeTrace(harness.trace)
    );
    assert.equal(
      state1000.statusText,
      '변경된 내용이 없어요',
      'status text must keep manual_nochange at 1s. trace=\n' + summarizeTrace(harness.trace)
    );
    assert.notEqual(state1000.statusText, '저장됨', 'stale 저장됨 must not reappear');
    assert.equal(immediateState.statusDisplay, 'flex', 'save status indicator must be visible immediately after unchanged save. trace=\n' + summarizeTrace(harness.trace));
    assert.equal(state250.statusDisplay, 'flex', 'save status indicator must stay visible at 250ms. trace=\n' + summarizeTrace(harness.trace));
    assert.equal(state1000.statusDisplay, 'flex', 'save status indicator must stay visible at 1s. trace=\n' + summarizeTrace(harness.trace));
    assert.deepEqual(harness.getStatusCalls().at(-1), {
      status: 'manual_nochange',
      message: '변경된 내용이 없어요'
    });
    assert.deepEqual(harness.getToasts(), [{ message: '변경된 내용이 없어요', type: 'info' }], 'unchanged save should emit exactly one info toast. trace=\n' + summarizeTrace(harness.trace));
    assert.equal(harness.getToastRenderCount(), 1, 'toast presenter should render exactly one toast. trace=\n' + summarizeTrace(harness.trace));

    assert.ok(harness.trace.some((entry) => entry.type === 'saveEditBtn.listener'), 'save click must pass through the real save button listener. trace=\n' + summarizeTrace(harness.trace));
    assert.ok(harness.trace.some((entry) => entry.type === 'saveMemoryEdit'), 'real save button listener must invoke saveMemoryEdit. trace=\n' + summarizeTrace(harness.trace));
    assert.ok(
      harness.trace.some((entry) => entry.type === 'updateSaveStatus' && entry.status === 'manual_nochange'),
      'unchanged save must emit manual_nochange through orchestration. trace=\n' + summarizeTrace(harness.trace)
    );
    assert.ok(
      harness.trace.some((entry) => entry.type === 'LoveBudEditorSaveStatus.updateSaveStatus' && entry.status === 'manual_nochange'),
      'shared save-status state machine must receive manual_nochange. trace=\n' + summarizeTrace(harness.trace)
    );
  } finally {
    harness.advanceBy(5000);
    await flushMicrotasks();
  }
});

test('shell template structural hierarchy: #saveStatusIndicator is outside #detailContent, and #detailViewMode/#detailEditMode are absent', () => {
  const SHELL_TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-detail-panel-shell-template.js');
  const source = fs.readFileSync(SHELL_TEMPLATE_PATH, 'utf8');
  const templateMatch = source.match(/return\s*`([\s\S]*?)`\s*;/);
  assert.ok(templateMatch, 'template string must be extractable from source');
  const html = templateMatch[1];

  // Verify the shell template does NOT contain view/edit mode containers
  // (they are mounted into #detailContent by separate template files)
  assert.ok(!html.includes('detailViewMode'), 'detailViewMode must not appear in shell template');
  assert.ok(!html.includes('detailEditMode'), 'detailEditMode must not appear in shell template');

  // Locate key sections in the template output
  const detailContentOpen = '<div class="detail-content" id="detailContent">';
  const saveStatusCardOpen = '<div class="editor-save-status-card">';
  const contentOpenIdx = html.indexOf(detailContentOpen);
  assert.ok(contentOpenIdx >= 0, 'detailContent opening tag must be present');

  const cardIdx = html.indexOf(saveStatusCardOpen);
  assert.ok(cardIdx >= 0, 'editor-save-status-card must be present');

  // The save-status section starts after detailContent closes
  const contentSection = html.slice(contentOpenIdx, cardIdx);
  assert.ok(!contentSection.includes('saveStatusIndicator'),
    '#saveStatusIndicator must NOT be inside #detailContent');

  // The card section contains saveStatusIndicator
  const cardSection = html.slice(cardIdx);
  assert.ok(cardSection.includes('id="saveStatusIndicator"'),
    'editor-save-status-card section must contain #saveStatusIndicator');

  // Verify detailPanel is the direct container for both
  const asideOpenMatch = html.match(/<aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel"[^>]*>/);
  assert.ok(asideOpenMatch, 'detailPanel aside must be present');
  const asideOpen = asideOpenMatch[0];
  const asideIdx = html.indexOf(asideOpen);

  const asideClose = '</aside>';
  const asideCloseIdx = html.indexOf(asideClose);
  assert.ok(asideCloseIdx > asideIdx, 'aside close tag must be found after open tag');

  const insideAside = html.slice(asideIdx + asideOpen.length, asideCloseIdx);
  assert.ok(insideAside.includes(detailContentOpen),
    'detailContent must be inside detailPanel');
  assert.ok(insideAside.includes(saveStatusCardOpen),
    'editor-save-status-card must be inside detailPanel');
});

test('editor.html references shell template with matching SHA256 fingerprint', () => {
  const EDITOR_PATH = path.join(ROOT, 'pages/editor.html');
  const SHELL_TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-detail-panel-shell-template.js');
  const { createHash } = require('node:crypto');

  const editorHtml = fs.readFileSync(EDITOR_PATH, 'utf8');

  // Extract the v parameter from the shell template script tag
  const shellScriptRe = /src="\.\.\/js\/editor\/templates\/editor-detail-panel-shell-template\.js\?v=([a-f0-9]+)"/;
  const scriptMatch = editorHtml.match(shellScriptRe);
  assert.ok(scriptMatch,
    `shell template script tag with v parameter must exist in editor.html`);

  const fingerprintFromHtml = scriptMatch[1];

  // Compute SHA256 of current shell template file
  const shellSource = fs.readFileSync(SHELL_TEMPLATE_PATH, 'utf8');
  const computedFingerprint = createHash('sha256').update(shellSource).digest('hex').slice(0, 12);

  assert.equal(fingerprintFromHtml, computedFingerprint,
    `shell template fingerprint in editor.html (${fingerprintFromHtml}) must match computed SHA256[:12] (${computedFingerprint})`);
});

test('editor.html references js/editor.js with a non-empty cache-bust and no stale 3294 suffix', () => {
  const EDITOR_PATH = path.join(ROOT, 'pages/editor.html');
  const editorHtml = fs.readFileSync(EDITOR_PATH, 'utf8');

  // Find the js/editor.js script tag
  const editorJsRe = /src="(\.\.\/js\/editor\.js\?v=[^"]+)"/;
  const jsMatch = editorHtml.match(editorJsRe);
  assert.ok(jsMatch, 'js/editor.js script tag must exist in editor.html');

  const url = jsMatch[1];
  assert.ok(url.startsWith('../js/editor.js?v='),
    `js/editor.js URL must use the exact cache-bust prefix: ${url}`);
  const value = url.slice('../js/editor.js?v='.length);
  assert.ok(value.length > 0,
    `js/editor.js cache-bust value must be non-empty: ${url}`);
  assert.ok(!url.includes('3294'),
    `js/editor.js URL must not contain stale 3294 suffix: ${url}`);
});

function traceInvoke(trace, label) {
  trace.push({
    type: 'invoke',
    label
  });
}
