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
const SAVE_STATUS_PATH = path.join(ROOT, 'js/editor/editor-save-status.js');
const SAVE_STATUS_ORCHESTRATION_PATH = path.join(ROOT, 'js/editor/editor-save-status-orchestration.js');
const INTERACTION_MODE_PATH = path.join(ROOT, 'js/editor/editor-interaction-mode.js');

const editorSource = fs.readFileSync(EDITOR_ENTRY_PATH, 'utf8');

function assertEditorEntrySeam() {
  assert.match(editorSource, /deps\.registerEditorAuthStart\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(/);
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
    DETAIL_UI_PATH
  ].forEach((filePath) => {
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

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

  const startEditor = async () => {
    startEditorCalls += 1;
    trace.push({
      type: 'startEditor',
      count: startEditorCalls
    });

    currentTreeMemories = [{ ...treeFixture }];
    sandbox.window.currentTreeMemories = currentTreeMemories;
    currentEditingMemory = { ...treeFixture };
    selectedNodeId = treeFixture.id;

    const detailUI = sandbox.window.createEditorDetailUI({
      detailPanel,
      i18n: (key) => key,
      resolveTreeTitleText() { return '트리 제목'; },
      resolveHintText() { return ''; },
      resolveInfoText() { return ''; },
      resolveMemoryThumbnail() { return ''; },
      escapeHtml(value) { return String(value || ''); },
      isRootMemory() { return false; },
      getCanonicalRootId() { return 'root'; },
      getSelectedNodeId() { return selectedNodeId; },
      getTreeMemories() { return currentTreeMemories; },
      getCurrentTreeData() { return { id: 'tree-1' }; },
      getLocalSaveMode() { return false; },
      showToast(message, type) {
        trace.push({ type: 'showToast', message, toastType: type });
        toasts.push({ message, type });
      },
      updateTreeVisibility() {},
      openCurrentMomentDetail() {},
      focusSelectedMoment() {},
      updateSelectedMemoryFields() {},
      canEdit: true,
      openRenameTree() {}
    });

    const originalSetDetailEmptyState = detailUI.setDetailEmptyState;
    detailUI.setDetailEmptyState = function wrappedSetDetailEmptyState(isEmpty) {
      trace.push({
        type: 'setDetailEmptyState',
        isEmpty
      });
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

    const refreshRuntime = sandbox.window.LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime({
      log() {},
      reportError(message) {
        trace.push({ type: 'reportError', message });
      },
      editorDataLoader: wrappedDataLoader,
      treeId: 'tree-1',
      apiClient: sandbox.window.apiClient,
      normalizeMemory: (memory) => memory,
      treeMemories: () => currentTreeMemories,
      getCurrentEditingMemory: () => currentEditingMemory,
      setCurrentEditingMemory(memory) {
        currentEditingMemory = memory;
      },
      isRootMemory() { return false; },
      canonicalRootId: 'root',
      updateDetailPanel: detailUI.updateDetailPanel,
      updateSidebarStatus() {},
      initCanvas() {},
      exposeRefreshMemoriesBridge({ refreshMemories }) {
        sandbox.window.refreshMemories = async () => {
          trace.push({ type: 'window.refreshMemories:start' });
          const result = await refreshMemories();
          trace.push({ type: 'window.refreshMemories:done' });
          return result;
        };
      },
      resolveSaveStatusTimeFormatter() {
        return () => '';
      },
      editorSaveStatus: sandbox.window.LoveBudEditorSaveStatus,
      i18n: (key) => key,
      createSaveStatusOrchestrationFallback() {
        return sandbox.window.LoveBudEditorSaveStatusOrchestration.createEditorSaveStatusOrchestration;
      },
      saveStatusOrchestrationHelper: sandbox.window.LoveBudEditorSaveStatusOrchestration
    });

    const updateSaveStatus = (status, message) => {
      trace.push({ type: 'updateSaveStatus', status, message });
      statusCalls.push({ status, message });
      return refreshRuntime.updateSaveStatus(status, message);
    };

    const actions = sandbox.window.createEditorMemoryActions({
      i18n: (key) => key,
      updateSaveStatus,
      updateDetailPanel: detailUI.updateDetailPanel,
      updateSidebarStatus() {},
      showToast(message, type) {
        trace.push({ type: 'showToast', message, toastType: type });
        toasts.push({ message, type });
      },
      getCurrentEditingMemory: () => currentEditingMemory,
      setCurrentEditingMemory(memory) {
        currentEditingMemory = memory;
      },
      getTreeMemories: () => currentTreeMemories,
      setTreeMemories(memories) {
        currentTreeMemories = memories;
        sandbox.window.currentTreeMemories = memories;
      },
      getSelectedNodeId: () => selectedNodeId,
      setSelectedNodeId(value) {
        selectedNodeId = value;
      },
      getCanonicalRootId() { return 'root'; },
      isRootMemory() { return false; },
      findRootMemory() { return null; },
      detailPanel,
      svg: null,
      calcPosition() { return { x: 0, y: 0 }; },
      setDetailEmptyState: detailUI.setDetailEmptyState,
      rerenderCanvas() {},
      getCurrentTreeData() { return { id: 'tree-1', memories: currentTreeMemories }; },
      isLocalSaveMode() { return false; },
      canEdit: true
    });

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

    sandbox.window.LoveBudEditorBindings.bindDetailActionButtons({
      enterEditMode: actions.enterEditMode,
      deleteMemory() {},
      exitEditMode: actions.exitEditMode,
      saveMemoryEdit: actions.saveMemoryEdit
    });

    detailUI.updateDetailPanel(currentEditingMemory);
  };

  const registerEditorAuthStart = sandbox.window.LoveBudEditorPageHelpers.registerEditorAuthStart;
  registerEditorAuthStart({
    windowRef: sandbox.window,
    startEditor,
    redirectToEditorLogin() {
      trace.push({ type: 'redirectToEditorLogin' });
    },
    readConfirmedAuthCache() {
      return { uid: 'user-1' };
    }
  });

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

test('auth-refresh candidate repro: second auth callback must preserve active edit state after unchanged save', async () => {
  const harness = createHarness();
  const authUser = { uid: 'user-1' };
  const authReady = harness.getAuthReadyCallback();

  try {
    traceInvoke(harness.trace, 'auth-ready:first');
    authReady(authUser);
    await flushMicrotasks();

    assert.equal(harness.getStartEditorCalls(), 1, 'first auth-ready callback should start editor exactly once');
    assert.ok(harness.getDetailUI(), 'detail UI should be created on first start');
    assert.ok(harness.getActions(), 'memory actions should be created on first start');

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

    assert.equal(harness.getUpdateMemoryCalls(), 0, 'unchanged save must not call updateMemory');
    assert.deepEqual(harness.getToasts(), [{ message: '변경된 내용이 없어요', type: 'info' }], 'unchanged save should emit one info toast');
    assert.equal(harness.saveStatusText.textContent, '변경된 내용이 없어요', 'unchanged save should show manual_nochange text before refresh');

    traceInvoke(harness.trace, 'auth-ready:second');
    authReady(authUser);

    const immediateState = readPanelState(harness, 'immediate');

    harness.advanceBy(250);
    await flushMicrotasks();
    const state250 = readPanelState(harness, '250ms');

    harness.advanceBy(750);
    await flushMicrotasks();
    const state1000 = readPanelState(harness, '1000ms');

    assert.equal(harness.getStartEditorCalls(), 1, 'second auth-ready callback must stay on existing-started branch');
    assert.equal(harness.getRefreshRequestCount(), 1, 'existing-started branch should trigger one refreshMemories request');
    assert.equal(harness.getRefreshResolveCount(), 1, 'refresh request should resolve once');

    assert.equal(immediateState.editDisplay, 'block', 'edit form must stay visible immediately after second auth callback');
    assert.equal(immediateState.viewDisplay, 'none', 'detail view must stay hidden immediately after second auth callback');
    assert.equal(state250.editDisplay, 'block', 'edit form must stay visible at 250ms');
    assert.equal(state250.viewDisplay, 'none', 'detail view must stay hidden at 250ms');

    const firstCloseWriter = findFirstFormCloseWriter(harness.trace);
    assert.equal(
      state1000.editDisplay,
      'block',
      'edit form must stay visible at 1s. first close writer=' + JSON.stringify(firstCloseWriter) + '\n' + summarizeTrace(harness.trace)
    );
    assert.equal(
      state1000.viewDisplay,
      'none',
      'detail view must stay hidden at 1s. first close writer=' + JSON.stringify(firstCloseWriter) + '\n' + summarizeTrace(harness.trace)
    );
    assert.equal(
      state1000.statusText,
      '변경된 내용이 없어요',
      'status text must keep manual_nochange at 1s. trace=\n' + summarizeTrace(harness.trace)
    );
    assert.notEqual(state1000.statusText, '저장됨', 'stale 저장됨 must not reappear');
    assert.deepEqual(harness.getStatusCalls().at(-1), {
      status: 'manual_nochange',
      message: '변경된 내용이 없어요'
    });
  } finally {
    harness.advanceBy(5000);
    await flushMicrotasks();
  }
});

function traceInvoke(trace, label) {
  trace.push({
    type: 'invoke',
    label
  });
}
