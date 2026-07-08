const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

const SCRIPTS = [
  'js/editor/editor-helpers.js',
  'js/editor/editor-interaction-mode.js',
  'js/editor/editor-save-status.js',
  'js/editor/editor-save-status-orchestration.js',
  'js/editor/editor-refresh-save-runtime.js',
  'js/editor/editor-startup-context.js',
  'js/editor/editor-dom-refs-builder.js',
  'js/editor/editor-bindings.js',
  'js/editor/editor-page-event-bindings.js',
  'js/editor/editor-entry-dependencies.js',
  'js/editor/editor-memory-actions.js'
];

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createTimers() {
  let now = 0;
  let nextId = 1;
  const timers = [];

  function setTimeoutFake(fn, delay) {
    const id = nextId++;
    timers.push({ id, at: now + Number(delay || 0), fn });
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    return id;
  }

  function clearTimeoutFake(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  }

  function advanceBy(ms) {
    const target = now + Number(ms || 0);
    while (timers.length && timers[0].at <= target) {
      const timer = timers.shift();
      now = timer.at;
      timer.fn();
    }
    now = target;
  }

  return { setTimeoutFake, clearTimeoutFake, advanceBy };
}

function createClassList(element) {
  const classes = new Set();
  return {
    add(...items) { items.forEach((item) => classes.add(String(item))); sync(); },
    remove(...items) { items.forEach((item) => classes.delete(String(item))); sync(); },
    contains(item) { return classes.has(String(item)); },
    toggle(item, force) {
      const key = String(item);
      const next = force === undefined ? !classes.has(key) : !!force;
      if (next) classes.add(key);
      else classes.delete(key);
      sync();
      return next;
    },
    toString() { return Array.from(classes).join(' '); },
    _set(value) {
      classes.clear();
      String(value || '').split(/\s+/).filter(Boolean).forEach((item) => classes.add(item));
      sync();
    }
  };

  function sync() {
    element._className = Array.from(classes).join(' ');
  }
}

function matchesSelector(element, selector) {
  return String(selector || '').split(',').some((part) => matchesSimpleSelector(element, part.trim()));
}

function matchesSimpleSelector(element, selector) {
  if (!element || !selector) return false;
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  if (selector === '[contenteditable="true"]') return element.getAttribute('contenteditable') === 'true';
  return String(element.tagName || '').toLowerCase() === selector.toLowerCase();
}

function queryAll(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
  const results = [];
  visit(root, 0);
  return results;

  function visit(node, index) {
    (node.children || []).forEach((child) => {
      if (matchesSelector(child, parts[index])) {
        if (index === parts.length - 1) results.push(child);
        else visit(child, index + 1);
      }
      visit(child, index);
    });
  }
}

function createDom() {
  const registry = Object.create(null);
  const documentListeners = Object.create(null);

  function register(element) {
    if (element.id) registry[element.id] = element;
    return element;
  }

  function createElement(tagName, id) {
    let internalValue = '';
    const element = {
      id: id || '',
      tagName: String(tagName || 'div').toUpperCase(),
      dataset: {},
      style: { setProperty(name, value) { this[name] = value; } },
      children: [],
      parentElement: null,
      parentNode: null,
      attributes: {},
      _listeners: Object.create(null),
      _className: '',
      disabled: false,
      hidden: false,
      textContent: '',
      innerHTML: '',
      tabIndex: 0,
      get className() { return this._className; },
      set className(value) { this.classList._set(value); },
      get value() { return internalValue; },
      set value(value) {
        internalValue = this.tagName === 'TEXTAREA'
          ? String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          : String(value || '');
      },
      appendChild(child) {
        child.parentElement = this;
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, before) {
        child.parentElement = this;
        child.parentNode = this;
        const index = this.children.indexOf(before);
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
      },
      replaceChildren(...nodes) {
        this.children = [];
        nodes.forEach((node) => this.appendChild(node));
      },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(type, handler) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(handler);
      },
      dispatchEvent(event) {
        if (!event.target) event.target = this;
        if (!event.preventDefault) event.preventDefault = function() {};
        const originalStop = event.stopPropagation || function() {};
        event.stopPropagation = function() {
          event.__stopped = true;
          originalStop.call(event);
        };
        event.currentTarget = this;
        (this._listeners[event.type] || []).slice().forEach((handler) => handler(event));
        if (!event.__stopped && event.bubbles !== false && this.parentElement) {
          this.parentElement.dispatchEvent(event);
        }
        return !event.defaultPrevented;
      },
      click() { this.dispatchEvent({ type: 'click', bubbles: true, target: this }); },
      focus() {},
      contains(node) {
        for (let current = node; current; current = current.parentElement) {
          if (current === this) return true;
        }
        return false;
      },
      closest(selector) {
        for (let current = this; current; current = current.parentElement) {
          if (matchesSelector(current, selector)) return current;
        }
        return null;
      },
      querySelector(selector) { return queryAll(this, selector)[0] || null; },
      querySelectorAll(selector) { return queryAll(this, selector); }
    };
    element.classList = createClassList(element);
    return register(element);
  }

  const documentElement = createElement('html', 'documentElement');
  const body = createElement('body', 'body');
  const detailPanel = createElement('aside', 'detailPanel');
  const detailContent = createElement('div', 'detailContent');
  const detailViewMode = createElement('div', 'detailViewMode');
  const detailEditMode = createElement('div', 'detailEditMode');
  const editMemoryBtn = createElement('button', 'editMemoryBtn');
  const deleteMemoryBtn = createElement('button', 'deleteMemoryBtn');
  const cancelEditBtn = createElement('button', 'cancelEditBtn');
  const saveEditBtn = createElement('button', 'saveEditBtn');
  const titleInput = createElement('input', 'editTitleInput');
  const sourceGroup = createElement('div', 'editSourceUrlGroup');
  const sourceInput = createElement('input', 'editSourceUrlInput');
  const segmentGrid = createElement('div', 'editVideoSegmentGrid');
  const startInput = createElement('input', 'editStartTimeInput');
  const endInput = createElement('input', 'editEndTimeInput');
  const memoGroup = createElement('div', 'editMemoGroup');
  const memoInput = createElement('textarea', 'editMemoInput');
  const tagsInput = createElement('input', 'editTagsInput');
  const indicator = createElement('div', 'saveStatusIndicator');
  const icon = createElement('span', 'saveStatusIcon');
  const text = createElement('span', 'saveStatusText');
  const time = createElement('span', 'lastSavedTime');
  const canvas = createElement('div', 'canvasArea');
  const svg = createElement('svg', 'canvasSvg');
  const addBtn = createElement('button', 'addMemoryBtn');

  detailViewMode.style.display = 'block';
  detailEditMode.style.display = 'none';
  sourceGroup.className = 'editor-form-stack';
  memoGroup.className = 'editor-form-stack';
  indicator.style.display = 'none';
  text.textContent = '저장됨';

  documentElement.appendChild(body);
  body.appendChild(canvas);
  body.appendChild(svg);
  body.appendChild(addBtn);
  body.appendChild(detailPanel);
  detailPanel.appendChild(detailContent);
  detailContent.appendChild(detailViewMode);
  detailContent.appendChild(detailEditMode);
  detailViewMode.appendChild(editMemoryBtn);
  detailEditMode.appendChild(titleInput);
  detailEditMode.appendChild(sourceGroup);
  sourceGroup.appendChild(sourceInput);
  detailEditMode.appendChild(segmentGrid);
  segmentGrid.appendChild(startInput);
  segmentGrid.appendChild(endInput);
  detailEditMode.appendChild(memoGroup);
  memoGroup.appendChild(memoInput);
  detailEditMode.appendChild(tagsInput);
  detailEditMode.appendChild(cancelEditBtn);
  detailEditMode.appendChild(saveEditBtn);
  detailEditMode.appendChild(deleteMemoryBtn);
  detailPanel.appendChild(indicator);
  indicator.appendChild(icon);
  indicator.appendChild(text);
  indicator.appendChild(time);

  const document = {
    documentElement,
    body,
    getElementById(id) { return registry[id] || null; },
    createElement(tagName) { return createElement(tagName, ''); },
    querySelector(selector) { return queryAll(body, selector)[0] || null; },
    querySelectorAll(selector) { return queryAll(body, selector); },
    addEventListener(type, handler) {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(handler);
    },
    dispatchEvent(event) {
      (documentListeners[event.type] || []).slice().forEach((handler) => handler(event));
    }
  };

  return {
    document,
    elements: { detailViewMode, detailEditMode, editMemoryBtn, saveEditBtn, sourceInput, startInput, endInput, indicator, text }
  };
}

function installProjectStubs(sandbox, memory, trace) {
  const win = sandbox.window;
  let currentMemories = [{ ...memory }];
  let currentEditingMemory = null;
  let authReadyCallback = null;
  const apiCalls = [];
  const cacheWrites = [];
  const toasts = [];
  const statusCalls = [];
  const clearCacheCalls = [];

  win.t = (key) => ({
    save_no_change: '변경된 내용이 없어요',
    save_saved: '저장됨',
    memory_updated: '순간을 수정했어요'
  }[key] || key);
  win.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  win.LoveBudUI = { showToast(message, type) { toasts.push({ message, type }); } };
  win.LoveBudCache = { set(key, value) { cacheWrites.push({ key, value }); } };
  win.apiClient = {
    async updateMemory(id, payload) {
      apiCalls.push({ id, payload });
      return { id, ...payload };
    },
    clearCommunityCaches() { clearCacheCalls.push(true); }
  };
  win.LoveBudMedia = {
    extractYouTubeId(url) { return ((String(url || '').match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/) || [])[1] || ''); },
    parseYouTubeTimeToSeconds(value) {
      if (!value) return null;
      const parts = String(value).split(':').map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(value);
    },
    formatYouTubeStartTime(seconds) {
      if (seconds === null || seconds === undefined) return '';
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    },
    getEmbedUrl(url, type, opts = {}) {
      const id = this.extractYouTubeId(url);
      return id ? `https://www.youtube.com/embed/${id}${opts.startSeconds ? `?start=${opts.startSeconds}` : ''}` : '';
    },
    getThumbnailUrl(url) {
      const id = this.extractYouTubeId(url);
      return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
    }
  };
  win.LoveBudEditorMemoryFormTime = {
    parseTime: win.LoveBudMedia.parseYouTubeTimeToSeconds,
    validateEndTime({ rawEndTime, startSeconds, invalidMessage, rangeMessage }) {
      const endSeconds = win.LoveBudMedia.parseYouTubeTimeToSeconds(rawEndTime);
      if (Number.isNaN(endSeconds)) return { ok: false, message: invalidMessage };
      if (startSeconds != null && endSeconds <= startSeconds) return { ok: false, message: rangeMessage };
      return { ok: true, endSeconds };
    }
  };

  win.LoveBudEditorUtils = {
    findRootMemory() { return null; },
    getCanonicalRootId() { return 'root'; },
    isRootMemory() { return false; }
  };
  win.LoveBudEditorTreeHelpers = {
    syncCurrentTreeData(tree) { win.currentTreeData = tree; },
    resolveParentIdForCreate() { return 'root'; },
    nextMemoryIdFromMemories() { return 'memory-next'; },
    createInitialMemory() { return { id: 'root', treeId: 'tree-1' }; },
    applyUpdatedTreeVisibility() {},
    createTreeVisibilityUpdater() { return async function updateTreeVisibility() {}; }
  };
  win.LoveBudEditorPageHelpers = {
    redirectToEditorLogin() {},
    getMyTreesHref() { return '/pages/my-trees.html'; },
    renderTreeLoadError() {},
    buildTreeLoadErrorCopy() { return {}; },
    registerEditorAuthStart(options) {
      trace.push({ type: 'registerEditorAuthStart', hasStartEditor: typeof options.startEditor === 'function' });
      authReadyCallback = function authReady() {
        trace.push({ type: 'authReadyCallback' });
        return options.startEditor();
      };
    }
  };
  win.LoveBudEditorShellCopyApplier = {
    createPrepareEditorShell() { return function prepareEditorShell() {}; }
  };
  win.LoveBudEditorShellHelpers = {
    createInlineShowToastFallback() { return function noopToast() {}; },
    getI18n() { return win.t; },
    getEditorBasePath() { return '/pages/'; },
    getYouTubeInputErrorMessageFallback() { return 'invalid'; },
    applyEditorShellCopy() {},
    markEditorReady() { trace.push({ type: 'markEditorReady' }); },
    applyEditorEditabilityState() {},
    getHttpStatus(error) { return error && error.status; },
    createEditorDebugReporter() { return { log() {}, reportError(message) { trace.push({ type: 'reportError', message }); } }; },
    createEditorStartupDependencyWaiter() { return async function waitForGlobal() { return true; }; },
    createEditorRequiredGlobalWaiter() { return async function waitForRequiredGlobals() { return true; }; },
    createEditorStartDependencyGuard() { return function ensureDependency(value) { return typeof value === 'function'; }; },
    createEditorStartDependencyChecker({ dependencies }) {
      return function checkDependencies() {
        const missing = dependencies.filter((entry) => typeof entry.value !== 'function');
        missing.forEach((entry) => trace.push({ type: 'missingDependency', message: entry.message }));
        return missing.length === 0;
      };
    },
    createEditorStartupShellApplier({ prepareEditorShell }) { return function applyShell() { prepareEditorShell(); }; },
    createEditorCanvasEmptyGuideUpdater() { return function updateCanvasEmptyGuide() {}; },
    exposeCanvasEmptyGuideUpdater() {},
    createEditorSelectNodeHandler() { return function selectNode() {}; },
    createSelectedMomentFocusHandler() { return function focusSelectedMoment() {}; },
    createCurrentMomentDetailOpener() { return function openCurrentMomentDetail() {}; },
    createSidebarTreeActionsUpdater() { return function updateSidebarTreeActions() {}; },
    createEditorSidebarStatusUpdater({ updateSidebarStatusBase }) { return function updateSidebarStatus() { updateSidebarStatusBase(); }; },
    exposeDetailPanelUpdater() {},
    createMemoryActionsReadinessWrapper() { return async function updateSelectedMemoryFields() {}; },
    createEditorInitialMemoryProvider() { return function createInitialMemory() { return { id: 'root', treeId: 'tree-1' }; }; },
    createEditorNextMemoryIdProvider() { return function nextMemoryId() { return 'memory-next'; }; },
    createEditorInitialSelectionApplier(options) {
      return function applyInitialSelection() {
        options.setSelectedNodeId(memory.id);
        currentEditingMemory = { ...memory };
        options.setCurrentEditingMemory(currentEditingMemory);
        options.setDetailEmptyState(false);
      };
    },
    createEditorReadyFinalizer({ markEditorReady }) { return function finalizeEditorReady() { markEditorReady(); }; },
    createSaveStatusOrchestrationFallback() { return win.LoveBudEditorSaveStatusOrchestration.createEditorSaveStatusOrchestration; },
    exposeRefreshMemoriesBridge({ refreshMemories }) { win.refreshMemories = refreshMemories; },
    resolveSaveStatusTimeFormatter({ editorSaveStatus }) { return editorSaveStatus.formatTimeAgo; }
  };
  win.LoveBudEditorDataLoader = {
    createRefreshMemories(options) {
      return async function refreshMemories() {
        trace.push({ type: 'refreshMemories' });
        options.onMemoriesUpdated(currentMemories.map((item) => ({ ...item })));
      };
    }
  };
  win.LoveBudEditorInitialLoadFlow = {
    async runEditorInitialLoadFlow() {
      win.currentTreeMemories = currentMemories;
      win.currentTreeData = { id: 'tree-1', memories: currentMemories };
      return { status: 'ready', treeId: 'tree-1', tree: win.currentTreeData, normalizeMemory: (item) => item, treeMemories: () => currentMemories };
    }
  };
  win.createEditorDetailUI = function createEditorDetailUI() {
    return {
      setDetailEmptyState(isEmpty) {
        sandbox.document.getElementById('detailViewMode').style.display = isEmpty ? 'none' : 'block';
        sandbox.document.getElementById('detailEditMode').style.display = 'none';
      },
      updateFocusSelectedBtn() {},
      updateSidebarStatus() {},
      updateDetailPanel(data) {
        trace.push({ type: 'updateDetailPanel', id: data && data.id });
        sandbox.document.getElementById('detailViewMode').style.display = 'block';
        sandbox.document.getElementById('detailEditMode').style.display = 'none';
      }
    };
  };
  win.createEditorCanvas = function createEditorCanvas() {
    return { calcPosition() { return { x: 0, y: 0 }; }, drawBranch() {}, drawNode() {}, initCanvas() {}, focusNodeById() {}, updateAffordance() {}, clearGrowthAffordance() {}, clearEdgeSelection() {} };
  };
  win.createEditorMemoryForm = function createEditorMemoryForm() {
    return { showAddMemoryForm() {}, hideAddMemoryForm() {}, async addMemoryFromForm() {}, async addMemoryFromScoutPayload() {} };
  };
  win.LoveBudTreeWorkspacePermission = { resolveTreeWorkspaceCanEdit() { return true; } };
  win.LoveBudEditorSidebarUI = {};
  win.LoveBudEditorEmptyGuideUI = {};

  return {
    getAuthReadyCallback: () => authReadyCallback,
    getApiCalls: () => apiCalls.slice(),
    getCacheWrites: () => cacheWrites.slice(),
    getClearCacheCalls: () => clearCacheCalls.slice(),
    getToasts: () => toasts.slice(),
    getStatusCalls: () => statusCalls.slice(),
    recordStatus(status, message) { statusCalls.push({ status, message }); },
    getCurrentEditingMemory: () => currentEditingMemory
  };
}

function createHarness(memory) {
  const trace = [];
  const timers = createTimers();
  const { document, elements } = createDom();
  const sandbox = {
    console: { ...console, error() {}, warn() {} },
    document,
    window: {
      location: { search: `?treeId=tree-1&memoryId=${encodeURIComponent(memory.id)}`, origin: 'https://lovebud.pages.dev' },
      addEventListener() {},
      removeEventListener() {}
    },
    URL,
    URLSearchParams,
    setTimeout: timers.setTimeoutFake,
    clearTimeout: timers.clearTimeoutFake
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = document;
  sandbox.window.setTimeout = timers.setTimeoutFake;
  sandbox.window.clearTimeout = timers.clearTimeoutFake;

  vm.createContext(sandbox);
  SCRIPTS.forEach((script) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, script), 'utf8'), sandbox, { filename: script });
  });

  const stubs = installProjectStubs(sandbox, memory, trace);

  const originalResolver = sandbox.window.LoveBudEditorEntryDependencies.resolveEditorEntryDependencies;
  sandbox.window.LoveBudEditorEntryDependencies = {
    resolveEditorEntryDependencies(options) {
      trace.push({ type: 'resolveEditorEntryDependencies' });
      return originalResolver(options);
    }
  };

  const originalBindPageEvents = sandbox.window.LoveBudEditorPageEventBindings.bindEditorPageEvents;
  sandbox.window.LoveBudEditorPageEventBindings = {
    bindEditorPageEvents(options) {
      trace.push({ type: 'bindEditorPageEvents' });
      return originalBindPageEvents(options);
    }
  };

  const originalUpdateSaveStatus = sandbox.window.LoveBudEditorSaveStatus.updateSaveStatus;
  sandbox.window.LoveBudEditorSaveStatus.updateSaveStatus = function wrappedUpdateSaveStatus(state, options) {
    trace.push({ type: 'stateMachine.updateSaveStatus', status: options && options.status });
    return originalUpdateSaveStatus.call(this, state, options);
  };

  const originalCreateActions = sandbox.window.createEditorMemoryActions;
  sandbox.window.createEditorMemoryActions = function tracedCreateEditorMemoryActions(options) {
    const actions = originalCreateActions({
      ...options,
      updateSaveStatus(status, message) {
        trace.push({ type: 'updateSaveStatus', status, message });
        stubs.recordStatus(status, message);
        return options.updateSaveStatus(status, message);
      }
    });
    ['enterEditMode', 'exitEditMode', 'saveMemoryEdit'].forEach((name) => {
      const original = actions[name];
      actions[name] = function tracedAction() {
        trace.push({ type: name });
        return original.apply(this, arguments);
      };
    });
    return actions;
  };

  let domContentLoaded = null;
  const originalAddEventListener = document.addEventListener;
  document.addEventListener = function addEventListener(type, handler) {
    if (type === 'DOMContentLoaded') domContentLoaded = handler;
    return originalAddEventListener.call(this, type, handler);
  };

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor.js'), 'utf8'), sandbox, { filename: 'js/editor.js' });
  assert.equal(typeof domContentLoaded, 'function', 'js/editor.js must register DOMContentLoaded');
  domContentLoaded();

  return {
    trace,
    timers,
    window: sandbox.window,
    elements,
    getAuthReadyCallback: stubs.getAuthReadyCallback,
    getApiCalls: stubs.getApiCalls,
    getCacheWrites: stubs.getCacheWrites,
    getClearCacheCalls: stubs.getClearCacheCalls,
    getToasts: stubs.getToasts,
    getStatusCalls: stubs.getStatusCalls
  };
}

function readPanel(harness) {
  return {
    editDisplay: harness.elements.detailEditMode.style.display,
    viewDisplay: harness.elements.detailViewMode.style.display,
    statusDisplay: harness.elements.indicator.style.display,
    statusText: harness.elements.text.textContent
  };
}

function countTrace(harness, type) {
  return harness.trace.filter((entry) => entry.type === type).length;
}

async function exerciseNoChangeSave(memory) {
  const harness = createHarness(memory);
  const authReady = harness.getAuthReadyCallback();
  assert.equal(typeof authReady, 'function', 'auth startup must register startEditor callback');

  await authReady({ uid: 'user-1' });
  await flushMicrotasks();
  assert.ok(
    harness.trace.some((entry) => entry.type === 'resolveEditorEntryDependencies'),
    'must use actual editor entry dependency resolver. trace=' + JSON.stringify(harness.trace)
  );
  assert.ok(
    harness.trace.some((entry) => entry.type === 'bindEditorPageEvents'),
    'must bind through page event boundary. trace=' + JSON.stringify(harness.trace)
  );

  harness.window.LoveBudEditorInteractionMode.setMode(harness.window.LoveBudEditorInteractionMode.MODE_EDIT);
  assert.deepEqual(readPanel(harness), { editDisplay: 'none', viewDisplay: 'block', statusDisplay: 'none', statusText: '저장됨' });

  harness.elements.editMemoryBtn.click();
  harness.timers.advanceBy(0);
  await flushMicrotasks();
  assert.equal(countTrace(harness, 'enterEditMode'), 1, 'view-mode edit click must enter edit mode exactly once');
  assert.equal(harness.elements.detailEditMode.style.display, 'block', 'edit form must open from real edit control');
  assert.equal(harness.elements.detailViewMode.style.display, 'none', 'detail view must hide from real edit control');

  const saveStartIndex = harness.trace.length;
  harness.timers.setTimeoutFake(() => { harness.window.refreshMemories(); }, 500);
  harness.elements.saveEditBtn.click();
  const immediate = readPanel(harness);

  assert.equal(countTrace(harness, 'saveMemoryEdit'), 1, 'one Save click must invoke saveMemoryEdit exactly once');
  assert.equal(harness.getApiCalls().length, 0, 'unchanged save must not call apiClient.updateMemory');
  assert.equal(immediate.editDisplay, 'block', 'edit form must remain open immediately after Save');
  assert.equal(immediate.viewDisplay, 'none', 'detail view must remain hidden immediately after Save');
  assert.equal(immediate.statusDisplay, 'flex', 'manual_nochange status must be visible immediately');
  assert.equal(immediate.statusText, '변경된 내용이 없어요', 'active status must show no-change copy immediately');

  harness.timers.advanceBy(250);
  await flushMicrotasks();
  const state250 = readPanel(harness);
  assert.equal(state250.editDisplay, 'block', 'edit form must remain open at about 250ms');
  assert.equal(state250.viewDisplay, 'none', 'detail view must remain hidden at about 250ms');
  assert.equal(state250.statusText, '변경된 내용이 없어요', 'no-change status must remain at about 250ms');

  harness.timers.advanceBy(750);
  await flushMicrotasks();
  const state1000 = readPanel(harness);
  const postSaveTrace = harness.trace.slice(saveStartIndex);

  assert.equal(state1000.editDisplay, 'block', 'edit form must remain open at about 1s');
  assert.equal(state1000.viewDisplay, 'none', 'detail view must remain hidden at about 1s');
  assert.equal(state1000.statusDisplay, 'flex', 'manual_nochange status must remain visible at about 1s');
  assert.equal(state1000.statusText, '변경된 내용이 없어요', 'stale 저장됨 state must not replace no-change status');
  assert.equal(countTrace(harness, 'enterEditMode'), 1, 'Save and delayed refresh must not re-enter edit mode');
  assert.equal(countTrace(harness, 'exitEditMode'), 0, 'unchanged save must not call exitEditMode');
  assert.equal(postSaveTrace.filter((entry) => entry.type === 'updateDetailPanel').length, 0, 'delayed refresh must not restore detail view while edit form is active');
  assert.equal(harness.getApiCalls().length, 0, 'unchanged path must keep write calls at zero');
  assert.equal(harness.getCacheWrites().length, 0, 'unchanged path must not write local cache');
  assert.equal(harness.getClearCacheCalls().length, 0, 'unchanged path must not clear public/community caches');
  assert.deepEqual(harness.getStatusCalls().at(-1), { status: 'manual_nochange', message: '변경된 내용이 없어요' });
  assert.deepEqual(harness.getToasts(), [{ message: '변경된 내용이 없어요', type: 'info' }], 'toast adapter must receive exactly one info no-change toast');
  assert.ok(postSaveTrace.some((entry) => entry.type === 'stateMachine.updateSaveStatus' && entry.status === 'manual_nochange'), 'save-status state machine must receive manual_nochange');
  assert.ok(!postSaveTrace.some((entry) => entry.status === 'manual_saved'), 'stale 저장됨/manual_saved status must not be emitted');
}

const cases = [
  {
    name: 'plain title memo tags',
    memory: { id: 'memory-1', treeId: 'tree-1', title: '동일제목', memo: '동일메모', emotionTags: ['태그1', '태그2'], sourceUrl: '' }
  },
  {
    name: 'multiline memo with CRLF',
    memory: { id: 'memory-2', treeId: 'tree-1', title: '제목', memo: '첫 줄\r\n둘째 줄', emotionTags: ['태그'], sourceUrl: '' }
  },
  {
    name: 'YouTube source with start/end segment',
    memory: { id: 'memory-3', treeId: 'tree-1', title: '제목', memo: '메모', emotionTags: ['영상'], sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=83&end=125' }
  },
  {
    name: 'tags requiring trim/order normalization',
    memory: { id: 'memory-4', treeId: 'tree-1', title: '제목', memo: '메모', emotionTags: ['  태그B', '태그A  '], sourceUrl: '' }
  }
];

cases.forEach(({ name, memory }) => {
  test(`production entry unchanged Save keeps edit UI open after delayed refresh: ${name}`, async () => {
    await exerciseNoChangeSave(memory);
  });
});
