'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Source contract helpers ──────────────────────────────────────────

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function makeClickableElement(overrides) {
  var listeners = {};
  return Object.assign({
    id: '',
    style: {},
    dataset: {},
    disabled: false,
    hidden: false,
    tabIndex: 0,
    textContent: '',
    innerHTML: '',
    value: '',
    inert: false,
    classList: {
      _classes: [],
      add(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove(name) { this._classes = this._classes.filter(function(c) { return c !== name; }); },
      contains(name) { return this._classes.includes(name); },
      toggle(name, force) {
        if (force === true) { this.add(name); return true; }
        if (force === false) { this.remove(name); return false; }
        var idx = this._classes.indexOf(name);
        if (idx >= 0) { this._classes.splice(idx, 1); return false; }
        this._classes.push(name); return true;
      }
    },
    getAttribute(name) { return this.dataset[name] || null; },
    setAttribute(name, value) { this.dataset[name] = String(value); },
    removeAttribute(name) { delete this.dataset[name]; },
    addEventListener: function(type, handler) {
      (listeners[type] = listeners[type] || []).push(handler);
    },
    removeEventListener: function(type, handler) {
      var arr = listeners[type];
      if (!arr) return;
      var idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
    click: function() {
      if (this.disabled) return;
      var ev = { preventDefault: function() {}, stopPropagation: function() {} };
      var arr = listeners.click;
      if (arr) { for (var i = 0; i < arr.length; i++) arr[i](ev); }
    },
    dispatchEvent() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(c) { return c; },
    insertBefore(c, r) { return c; },
    remove() {},
    focus() {},
    contains() { return false; },
    _listeners: listeners
  }, overrides);
}

function createInteractionModeMock() {
  var mode = 'view';
  var listeners = [];
  return {
    MODE_VIEW: 'view',
    MODE_EDIT: 'edit',
    getMode: function() { return mode; },
    isEditMode: function() { return mode === 'edit'; },
    setMode: function(m) { mode = m; applyBodyAttribute(m); notifyListeners(m); },
    subscribe: function(fn) { listeners.push(fn); return function() {}; },
    _listeners: listeners
  };
  function applyBodyAttribute(m) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-editor-interaction-mode', m);
    }
  }
  function notifyListeners(m) {
    listeners.slice().forEach(function(fn) {
      try { fn(m); } catch(e) {}
    });
  }
}

// ── 1. CSS-level isolation contracts ──────────────────────

test('CSS blocks pointer events on detailContent with inert attribute', function() {
  var css = readSource('css/editor/editor-mode-selection.css');
  assert.match(css, /#detailContent\[inert\]/);
  assert.match(css, /#detailContent\[aria-hidden="true"\]/);
  assert.match(css, /pointer-events:\s*none/);
});

test('CSS floats toolbar hidden when memory form is open', function() {
  var css = readSource('css/editor/editor-mode-selection.css');
  assert.match(css, /\.editor-layout\.is-memory-form-open \.editor-floating-toolbar/);
  assert.match(css, /visibility:\s*hidden/);
});

test('CSS hides canvas topbar when memory form is open', function() {
  var css = readSource('css/editor/editor-memory-form-canvas.css');
  assert.match(css, /\.canvas-area\.is-memory-form-open \.editor-canvas-topbar/);
  assert.match(css, /pointer-events:\s*none/);
});

test('CSS hides canvas empty guide when form is open', function() {
  var css = readSource('css/editor/editor-memory-form-canvas.css');
  assert.match(css, /\.canvas-area\.is-memory-form-open \.editor-canvas-empty-guide/);
  assert.match(css, /display:\s*none/);
});

// ── 2. Detail view-mode template: connect-existing sections ──

test('detail view-mode template contains connect-existing sections', function() {
  var tpl = readSource('js/editor/templates/editor-detail-view-mode-template.js');
  assert.match(tpl, /connectExistingCtaSection/);
  assert.match(tpl, /connectExistingCtaBtn/);
  assert.match(tpl, /connectExistingPendingSection/);
  assert.match(tpl, /connectExistingConfirmSection/);
  assert.match(tpl, /continueFromMomentBtn/);
  assert.ok(!tpl.includes('role="tab"'), 'no ARIA tab role used; existing button section pattern retained');
});

test('connect-existing sections are NOT inside #detailEditMode template', function() {
  var editTpl = readSource('js/editor/templates/editor-detail-edit-mode-template.js');
  assert.ok(!editTpl.includes('connectExistingCtaSection'), 'connect-existing not in edit mode template');
  assert.ok(!editTpl.includes('connectExistingCtaBtn'), 'connect-existing btn not in edit mode template');
});

// ── 3. Editor-bindings connect-existing controller ────────

test('editor-bindings exposes createConnectExistingController', function() {
  var src = readSource('js/editor/editor-bindings.js');
  assert.match(src, /function createConnectExistingController/);
  assert.match(src, /window\.LoveBudEditorBindings/);
  assert.match(src, /createConnectExistingController/);
});

test('createConnectExistingController has all required guard gates', function() {
  var src = readSource('js/editor/editor-bindings.js');
  assert.match(src, /canEdit === false/, 'gates on canEdit === false');
  assert.match(src, /isEditMode/, 'gates on isEditMode');
  assert.match(src, /isRoot/, 'gates on isRoot memory');
  assert.match(src, /getCurrentEditingMemory/, 'gates on currentEditingMemory');
  assert.match(src, /validateConnectCandidate/, 'uses validateConnectCandidate');
});

test('updateCtaVisibility fails closed for: canEdit=false, view mode, root, missing memory', function() {
  var src = readSource('js/editor/editor-bindings.js');
  assert.match(src, /canEdit === false.*hideAll/, 'canEdit=false → hideAll');
  assert.match(src, /isEdit.*hideAll/, 'not edit mode → hideAll');
  assert.match(src, /!mem.*hideAll/, 'missing memory → hideAll');
  assert.match(src, /isRoot.*hideAll/, 'root → hideAll');
});

test('enterConnectMode fails closed for: canEdit=false, root, missing memory', function() {
  var src = readSource('js/editor/editor-bindings.js');

  var fnStart = src.indexOf('function enterConnectMode');
  var fnEnd = src.indexOf('\n    function ', fnStart + 10);
  var fnText = fnEnd > fnStart ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  assert.ok(fnText, 'enterConnectMode source found');
  assert.match(fnText, /canEdit === false/, 'canEdit=false → return');
  assert.match(fnText, /루트 순간은 연결할 수 없어요/, 'root → toast');
  assert.match(fnText, /!mem.*return/, 'missing memory → return');
  assert.ok(!fnText.includes('addMemoryBtn'), 'no addMemoryBtn fallback in enterConnectMode');
  assert.ok(!fnText.includes('continueFromMomentBtn'), 'no continueFromMomentBtn fallback in enterConnectMode');
  assert.ok(!fnText.includes('showAddMemoryForm'), 'no showAddMemoryForm fallback');
  assert.ok(!fnText.includes('addMemoryFromForm'), 'no addMemoryFromForm fallback');
});

test('createConnectExistingController bindControls guards: no new-moment fallback in connect handlers', function() {
  var src = readSource('js/editor/editor-bindings.js');
  assert.match(src, /enterConnectMode/, 'ctaBtn routes to enterConnectMode');
  assert.match(src, /handleCancel/, 'cancel buttons route to handleCancel');
  assert.match(src, /handleConfirm/, 'confirm routes to handleConfirm');

  var bindStart = src.indexOf('function bindControls');
  var bindEnd = src.indexOf('function', bindStart + 20);
  var bindText = bindEnd > bindStart ? src.slice(bindStart, bindEnd) : src.slice(bindStart);
  assert.ok(bindText, 'bindControls source found');
  assert.ok(!bindText.includes('addMemoryBtn'), 'no addMemoryBtn fallback in bindControls');
  assert.ok(!bindText.includes('showAddMemoryForm'), 'no showAddMemoryForm fallback in bindControls');
  assert.ok(!bindText.includes('addMemoryFromForm'), 'no addMemoryFromForm fallback in bindControls');
  assert.ok(!bindText.includes('continueFromMomentBtn'), 'no continueFromMomentBtn fallback in bindControls');
});

test('handleConfirm routes to connectMemory, not new-moment creation', function() {
  var src = readSource('js/editor/editor-bindings.js');

  var fnStart = src.indexOf('function handleConfirm');
  var fnEnd = src.indexOf('function', fnStart + 20);
  var fnText = fnEnd > fnStart ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
  assert.ok(fnText, 'handleConfirm source found');
  assert.match(fnText, /canEdit === false/, 'fail closed on canEdit');
  assert.match(fnText, /connectMemory/, 'routes to connectMemory');
  assert.ok(!fnText.includes('addMemoryFromForm'), 'no addMemoryFromForm fallback');
  assert.ok(!fnText.includes('createMemory'), 'no createMemory call');
  assert.ok(!fnText.includes('addMemoryBtn'), 'no addMemoryBtn fallback');
});

// ── 4. Editor-memory-form interaction isolation ────────────

function createFormSandbox(opts) {
  opts = opts || {};
  var canEdit = opts.canEdit !== false;

  var formEl = makeClickableElement({
    id: 'addMemoryForm',
    style: { display: 'none' },
    closest: function(sel) {
      if (sel === '.canvas-area') return canvasArea;
      if (sel === '.editor-layout') return editorLayout;
      return null;
    },
    contains: function() { return false; }
  });

  var detailContent = makeClickableElement({ id: 'detailContent', inert: false });
  var editorLayout = makeClickableElement({
    classList: {
      _classes: ['editor-layout'],
      add: function(n) { this._classes.push(n); },
      remove: function(n) { this._classes = this._classes.filter(function(c) { return c !== n; }); },
      contains: function(n) { return this._classes.indexOf(n) >= 0; },
      toggle: function(n, f) {
        if (f === true) { this.add(n); return true; }
        if (f === false) { this.remove(n); return false; }
        return false;
      }
    }
  });
  var canvasArea = makeClickableElement({
    id: 'canvasArea',
    classList: {
      _classes: ['canvas-area'],
      add: function(n) { this._classes.push(n); },
      remove: function(n) { this._classes = this._classes.filter(function(c) { return c !== n; }); },
      contains: function(n) { return this._classes.indexOf(n) >= 0; },
      toggle: function(n, f) {
        if (f === true) { this.add(n); return true; }
        if (f === false) { this.remove(n); return false; }
        return false;
      }
    }
  });
  var canvasTopbar = makeClickableElement({ className: 'editor-canvas-topbar' });
  var canvasEmptyGuide = makeClickableElement({
    id: 'canvasEmptyGuide',
    classList: { _classes: [], add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() { return false; } }
  });

  var elementMap = {
    addMemoryForm: formEl,
    detailContent: detailContent,
    canvasEmptyGuide: canvasEmptyGuide,
    memoryUrlInput: makeClickableElement({ id: 'memoryUrlInput', value: '' }),
    memoryTitleInput: makeClickableElement({ id: 'memoryTitleInput', value: '' }),
    memoryMemoInput: makeClickableElement({ id: 'memoryMemoInput', value: '' }),
    memoryUrlField: makeClickableElement({ id: 'memoryUrlField' }),
    memoryModeLinkBtn: makeClickableElement({ id: 'memoryModeLinkBtn' }),
    memoryModeTextBtn: makeClickableElement({ id: 'memoryModeTextBtn' }),
    memoryFormSupportNoteText: makeClickableElement({ id: 'memoryFormSupportNoteText' }),
    memoryStartTimeField: makeClickableElement({ id: 'memoryStartTimeField' }),
    memoryVideoSegmentGrid: makeClickableElement({ id: 'memoryVideoSegmentGrid' }),
    memoryStartTimeInput: makeClickableElement({ id: 'memoryStartTimeInput', value: '' }),
    memoryStartTimeHint: makeClickableElement({ id: 'memoryStartTimeHint' }),
    memoryEndTimeInput: makeClickableElement({ id: 'memoryEndTimeInput', value: '' }),
    addMemoryFormEyebrow: makeClickableElement({ id: 'addMemoryFormEyebrow' }),
    addMemoryFormTitle: makeClickableElement({ id: 'addMemoryFormTitle' }),
    addMemoryFormIntro: makeClickableElement({ id: 'addMemoryFormIntro' }),
    memoryUrlLabel: makeClickableElement({ id: 'memoryUrlLabel' }),
    memoryTitleLabel: makeClickableElement({ id: 'memoryTitleLabel' }),
    memoryTagsInput: makeClickableElement({ id: 'memoryTagsInput', value: '' }),
    memoryTagsLabel: makeClickableElement({ id: 'memoryTagsLabel' }),
    memoryMemoLabel: makeClickableElement({ id: 'memoryMemoLabel' }),
    confirmAddMemory: makeClickableElement({ id: 'confirmAddMemory' }),
    memoryLinkPreview: makeClickableElement({ id: 'memoryLinkPreview', classList: { _classes: [], add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() { return false; } } }),
    memoryPreviewThumb: makeClickableElement({ id: 'memoryPreviewThumb' }),
    memoryPreviewBadge: makeClickableElement({ id: 'memoryPreviewBadge' }),
    memoryPreviewTitle: makeClickableElement({ id: 'memoryPreviewTitle' }),
    memoryPreviewHint: makeClickableElement({ id: 'memoryPreviewHint' }),
    editorMemoryFormContext: null
  };

  var doc = {
    getElementById: function(id) { return elementMap[id] || null; },
    querySelector: function(sel) {
      if (sel === '.editor-canvas-topbar') return canvasTopbar;
      if (sel === '#memoryLinkPreview .memory-link-preview__thumb-wrap') return makeClickableElement({});
      if (sel === '#memoryLinkPreview .memory-link-preview__play-icon') return makeClickableElement({});
      if (sel === '#memoryLinkPreview .memory-link-preview__body') return makeClickableElement({});
      if (sel === '.editor-floating-toolbar') return makeClickableElement({});
      return null;
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    activeElement: null,
    createElement: function() { return makeClickableElement({}); },
    body: makeClickableElement({ dataset: {} })
  };

  var sandbox = vm.createContext({
    window: {},
    document: doc,
    console: { warn: function() {}, log: function() {}, error: function() {}, debug: function() {} },
    setTimeout: function(fn) { fn(); },
    clearTimeout: function() {},
    fetch: function() { return Promise.resolve({ json: function() { return Promise.resolve({}); } }); },
    requestAnimationFrame: function(fn) { fn(); },
    URLSearchParams: function() { return { get: function() { return null; } }; },
    LoveBudEditorMemoryFormMode: { setInputMode: function() { return 'link'; } },
    LoveBudEditorMemoryFormPreview: { hide: function() {}, update: function() {} },
    LoveBudEditorMemoryFormTime: { autofillStartFromUrl: function() {} },
    LoveBudEditorMemoryFormSave: function() {
      return {
        enrichPayloadChannelMetadata: function(p) { return Promise.resolve(p); },
        createMemoryWithFallback: function() { return Promise.resolve({ createdMemory: { id: 'mem-2' }, useApi: false }); },
        commitMemoryToTree: function() {}
      };
    },
    LoveBudEditorMemoryFormPayload: null,
    LoveBudEditorInteractionMode: null,
    LoveBudCache: null,
    LoveBudNormalize: null,
    currentTreeMemories: [],
    currentTreeData: null,
    setCachedMemories: function() {},
    refreshMemories: function() {},
    errors: [],
    Error: Error,
    Promise: Promise,
    JSON: JSON,
    parseInt: parseInt,
    parseFloat: parseFloat,
    Math: Math,
    Date: Date,
    RegExp: RegExp,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    Map: Map,
    Set: Set,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent
  });

  sandbox.window = sandbox;

  var memoryFormSrc = readSource('js/editor/editor-memory-form.js');
  vm.runInContext(memoryFormSrc, sandbox);

  var deps = {
    i18n: function(key) { return key; },
    treeId: 'test-tree-id',
    getSelectedNodeId: function() { return 'mem-root'; },
    getCanonicalRootId: function() { return 'root'; },
    resolveParentIdForCreate: function() { return 'mem-root'; },
    updateSaveStatus: function() {},
    showToast: function() {},
    getYouTubeInputErrorMessage: function() { return null; },
    nextMemoryId: function() { return 'mem-2'; },
    normalizeMemory: function(m) { return m; },
    getTreeMemories: function() { return [{ id: 'mem-root', title: 'Root' }]; },
    setTreeMemories: function() {},
    setLocalSaveMode: function() {},
    drawNode: function() {},
    drawBranch: function() {},
    calcPosition: function() {},
    updateSidebarStatus: function() {},
    updateFocusSelectedBtn: function() {},
    setDetailEmptyState: function() {},
    selectNode: function() {},
    treeMemories: function() { return [{ id: 'mem-root', title: 'Root' }]; },
    setCachedMemories: function() {},
    rerenderCanvas: function() {},
    focusNodeById: function() {},
    canEdit: canEdit
  };

  var formApi = vm.runInContext('window.createEditorMemoryForm(deps)', Object.assign(sandbox, { deps }));

  return { sandbox, doc, formEl, detailContent, canvasArea, editorLayout, canvasTopbar, formApi, elementMap };
}

test('form open: detailContent gets inert + aria-hidden', function() {
  var s = createFormSandbox({ canEdit: true });
  var initialInert = s.detailContent.inert;
  var initialAria = s.detailContent.getAttribute('aria-hidden');
  assert.equal(initialInert, false, 'initial: detail not inert');
  assert.equal(initialAria, null, 'initial: detail no aria-hidden');

  s.formApi.showAddMemoryForm();

  assert.equal(s.detailContent.inert, true, 'open: detail inert');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'true', 'open: detail aria-hidden=true');
  assert.ok(s.formEl.style.display === 'block' || s.formEl.style.display === '', 'open: form visible');
  assert.ok(s.formEl.classList.contains('is-open'), 'open: form has is-open class');
});

test('form open: active form is not inside inert subtree', function() {
  var s = createFormSandbox({ canEdit: true });
  s.formApi.showAddMemoryForm();
  assert.equal(s.detailContent.inert, true, 'detail is inert');
  assert.notEqual(s.formEl.inert, true, 'form is not inert');
});

test('form open: canvas-area and editor-layout get is-memory-form-open class', function() {
  var s = createFormSandbox({ canEdit: true });
  assert.ok(!s.canvasArea.classList.contains('is-memory-form-open'), 'initial: no class on canvas-area');
  assert.ok(!s.editorLayout.classList.contains('is-memory-form-open'), 'initial: no class on editor-layout');

  s.formApi.showAddMemoryForm();

  assert.ok(s.canvasArea.classList.contains('is-memory-form-open'), 'open: canvas-area has class');
  assert.ok(s.editorLayout.classList.contains('is-memory-form-open'), 'open: editor-layout has class');
});

test('form open: canvas topbar gets aria-hidden=true', function() {
  var s = createFormSandbox({ canEdit: true });
  s.formApi.showAddMemoryForm();
  assert.equal(s.canvasTopbar.getAttribute('aria-hidden'), 'true', 'topbar aria-hidden=true');
});

test('form cancel: restores detailContent inert and aria-hidden', function() {
  var s = createFormSandbox({ canEdit: true });
  s.formApi.showAddMemoryForm();
  assert.equal(s.detailContent.inert, true, 'open: inert');

  s.formApi.hideAddMemoryForm();

  assert.equal(s.detailContent.inert, false, 'cancel: inert removed');
  assert.notEqual(s.detailContent.getAttribute('aria-hidden'), 'true', 'cancel: aria-hidden removed');
  assert.ok(!s.formEl.classList.contains('is-open'), 'cancel: is-open removed');
  assert.ok(s.canvasArea.classList.contains('is-memory-form-open') === false, 'cancel: class removed from canvas-area');
});

test('canEdit=false: showAddMemoryForm does not open form or change isolation', function() {
  var s = createFormSandbox({ canEdit: false });
  s.formApi.showAddMemoryForm();

  assert.notEqual(s.formEl.style.display, 'block', 'canEdit=false: form not opened');
  assert.equal(s.detailContent.inert, false, 'canEdit=false: detail not made inert');
});

// ── 5. Connect-existing sidebar/template contract ────────

test('editor-overrides CSS has mode-dependent connect-existing section visibility', function() {
  var css = readSource('css/editor/editor-mode-selection.css');
  assert.match(css, /\[data-editor-interaction-mode="view"\].*connectExistingCtaSection/);
  assert.match(css, /\[data-editor-interaction-mode="view"\].*connectExistingCtaBtn/);
});

test('editor.js wires connect controller via setConnectMemory and setValidateConnectCandidate', function() {
  var editorJs = readSource('js/editor.js');
  assert.match(editorJs, /connectExistingController\.setConnectMemory/);
  assert.match(editorJs, /connectExistingController\.setValidateConnectCandidate/);
});

test('editor.js passes canEdit to createConnectExistingController', function() {
  var editorJs = readSource('js/editor.js');
  assert.match(editorJs, /createConnectExistingController/);
  assert.match(editorJs, /canEdit/);
});

test('editor.js calls updateCtaNow on selection change via wrapped updateDetailPanel', function() {
  var editorJs = readSource('js/editor.js');
  assert.match(editorJs, /updateCtaNow/);
  assert.match(editorJs, /connectExistingController/);
});

// ── 6. Floating toolbar visibility gating ─────────────────

test('floating toolbar visibility: form-open returns false', function() {
  var src = readSource('js/editor/editor-floating-toolbar-visibility.js');

  var canvasArea = makeClickableElement({
    id: 'canvasArea',
    classList: {
      _classes: [],
      contains: function(n) { return this._classes.indexOf(n) >= 0; },
      add: function() {},
      remove: function() {}
    }
  });
  canvasArea.classList._classes.push('is-memory-form-open');

  var editorLayout = makeClickableElement({
    classList: {
      _classes: [],
      contains: function(n) { return this._classes.indexOf(n) >= 0; },
      add: function() {},
      remove: function() {}
    }
  });

  var sandbox = vm.createContext({
    window: { innerWidth: 1200 },
    document: {
      getElementById: function(id) {
        if (id === 'detailEditMode') return makeClickableElement({ style: { display: 'none' } });
        if (id === 'canvasEmptyGuide') return makeClickableElement({ classList: { contains: function() { return true; } } });
        return null;
      },
      querySelector: function(sel) {
        if (sel === '.canvas-area.is-memory-form-open') return canvasArea;
        if (sel === '.editor-layout.is-memory-form-open') return editorLayout;
        if (sel === '.editor-canvas-toolbar') return null;
        return null;
      },
      body: { getAttribute: function() { return 'edit'; }, classList: { contains: function() { return false; } } }
    },
    console: { log: function() {}, warn: function() {} },
    Error: Error,
    Array: Array,
    Object: Object,
    Function: Function,
    String: String,
    Number: Number,
    Boolean: Boolean
  });

  vm.runInContext(src, sandbox);
  var shouldShow = vm.runInContext('window.LoveBudFloatingToolbarVisibility.shouldShow', sandbox);

  var result = shouldShow({
    getSelectedNode: function() { return makeClickableElement({ className: 'memory-node selected' }); }
  });

  assert.equal(result, false, 'toolbar hidden when form is open');
});

// ── 7. Failure-closed negative matrix (source contract) ──

test('connect-existing: root memory CTA hidden in controller', function() {
  var src = readSource('js/editor/editor-bindings.js');
  assert.match(src, /isRoot/, 'controller checks isRoot');
});

test('connect-existing: mode switch exits connect mode', function() {
  var editorJs = readSource('js/editor.js');
  assert.match(editorJs, /connectExistingController\.exitConnectMode/);
  assert.match(editorJs, /handleModeChange/);
});

test('floating toolbar affordance: branch btn routes to connectExistingCtaBtn only, not addMemoryBtn', function() {
  var src = readSource('js/editor/editor-floating-toolbar-affordance.js');
  assert.match(src, /connectExistingMoment/, 'branch btn routes to connectExistingMoment');
  assert.match(src, /connectExistingCtaBtn/, 'uses connectExistingCtaBtn');
  assert.ok(!src.match(/function connectExistingMoment[\s\S]*?addMemoryBtn/), 'no addMemoryBtn in connect route');
});

test('floating toolbar affordance: canActivateConnectButton checks disabled/hidden/aria-hidden/section display', function() {
  var src = readSource('js/editor/editor-floating-toolbar-affordance.js');
  assert.match(src, /button\.disabled/, 'checks disabled');
  assert.match(src, /button\.hidden/, 'checks hidden');
  assert.match(src, /aria-hidden/, 'checks aria-hidden');
  assert.match(src, /section\.style\.display === .none./, 'checks section display:none');
});

test('floating toolbar actions: continue routes to continueFromMomentBtn or addMemoryBtn (new moment, not connect)', function() {
  var src = readSource('js/editor/editor-floating-toolbar-actions.js');
  assert.match(src, /continueFromMomentBtn/, 'uses continueFromMomentBtn');
  assert.match(src, /addMemoryBtn/, 'addMemoryBtn fallback');
  assert.ok(!src.includes('connectExistingCtaBtn'), 'no connect fallback in continue action');
});

// ── 8. Focus management ──────────────────────────────────

test('memory form implements focus trap for Tab within form inputs', function() {
  var src = readSource('js/editor/editor-memory-form.js');
  assert.match(src, /focusTrap/, 'focusTrap defined');
  assert.match(src, /e\.key !== .Tab./, 'traps Tab key');
  assert.match(src, /formInputs/, 'traps within form inputs');
});

test('memory form outside click handler does not close on addMemoryBtn clicks', function() {
  var src = readSource('js/editor/editor-memory-form.js');
  assert.match(src, /addMemoryBtn/, 'excludes addMemoryBtn clicks');
  assert.match(src, /memory-add-affordance/, 'excludes affordance clicks');
});

test('memory form restores focus to invoker on close', function() {
  var src = readSource('js/editor/editor-memory-form.js');
  assert.match(src, /restoreFocusToInvoker/, 'restoreFocusToInvoker defined');
  assert.match(src, /\.focus\(\)/, 'calls focus');
});

// ── 9. Template contract: no duplicate semantic tab pattern ──

test('editor templates do not introduce ARIA tab pattern for moment/connect routing', function() {
  var tplFiles = [
    'js/editor/templates/editor-detail-view-mode-template.js',
    'js/editor/templates/editor-sidebar-template.js',
    'js/editor/templates/editor-add-memory-form-template.js',
    'js/editor/templates/editor-detail-panel-shell-template.js'
  ];
  tplFiles.forEach(function(f) {
    var content = readSource(f);
    assert.ok(!content.includes('role="tab"'), f + ': no role="tab"');
    assert.ok(!content.includes('role="tablist"'), f + ': no role="tablist"');
    assert.ok(!content.includes('role="tabpanel"'), f + ': no role="tabpanel"');
  });
});

// ── 10. Editor page-event-bindings wraps show/hide with history ──

test('editor-page-event-bindings wraps showAddMemoryForm and hideAddMemoryForm', function() {
  var src = readSource('js/editor/editor-page-event-bindings.js');
  assert.match(src, /wrappedShowAddMemoryForm/, 'wrapped show');
  assert.match(src, /wrappedHideAddMemoryForm/, 'wrapped hide');
  assert.match(src, /panelHistory/, 'panel history integration');
});

// ── 11. Editor floating toolbar visibility: interactive audit ──

test('floating toolbar visibility returns false for: no selection, view mode, readonly, detail edit open', function() {
  var src = readSource('js/editor/editor-floating-toolbar-visibility.js');

  function makeCtx(overrides) {
    return Object.assign({
      mobileBreakpoint: 480,
      compactClass: 'is-compact',
      getSelectedNode: function() { return null; }
    }, overrides);
  }

  var sandbox = vm.createContext({
    window: { innerWidth: 1200 },
    document: {
      getElementById: function(id) {
        if (id === 'detailEditMode') return makeClickableElement({ style: { display: 'none' } });
        if (id === 'canvasEmptyGuide') return makeClickableElement({ classList: { contains: function() { return true; } } });
        return null;
      },
      querySelector: function(sel) {
        if (sel === '.canvas-area.is-memory-form-open') return null;
        if (sel === '.editor-layout.is-memory-form-open') return null;
        if (sel === '.editor-canvas-toolbar') return null;
        return null;
      },
      body: { getAttribute: function() { return 'view'; }, classList: { contains: function() { return false; } } }
    },
    console: { log: function() {}, warn: function() {} },
    Error: Error,
    Array: Array,
    Object: Object,
    Function: Function,
    String: String,
    Number: Number,
    Boolean: Boolean
  });

  vm.runInContext(src, sandbox);
  var shouldShow = vm.runInContext('window.LoveBudFloatingToolbarVisibility.shouldShow', sandbox);

  assert.equal(shouldShow(makeCtx({})), false, 'no selection: hidden');

  sandbox.document.body.getAttribute = function() { return 'view'; };
  sandbox.document.body.classList.contains = function() { return false; };
  assert.equal(shouldShow(makeCtx({ getSelectedNode: function() { return {}; } })), false, 'view mode: hidden');

  sandbox.document.body.getAttribute = function() { return 'edit'; };
  sandbox.document.getElementById = function(id) {
    if (id === 'detailEditMode') return makeClickableElement({ style: { display: '' } });
    if (id === 'canvasEmptyGuide') return makeClickableElement({ classList: { contains: function() { return false; } } });
    return null;
  };
  assert.equal(shouldShow(makeCtx({ getSelectedNode: function() { return {}; } })), false, 'detail edit mode open: hidden');

  sandbox.document.body.getAttribute = function() { return 'edit'; };
  sandbox.document.body.classList.contains = function() { return false; };
  sandbox.document.getElementById = function(id) {
    if (id === 'detailEditMode') return makeClickableElement({ style: { display: 'none' } });
    if (id === 'canvasEmptyGuide') return makeClickableElement({ classList: { contains: function() { return true; } } });
    return null;
  };
  var editModeHiddenResult = shouldShow(makeCtx({ getSelectedNode: function() { return {}; } }));
  assert.equal(editModeHiddenResult, true, 'edit mode + selection + no conflicts: visible');
});
