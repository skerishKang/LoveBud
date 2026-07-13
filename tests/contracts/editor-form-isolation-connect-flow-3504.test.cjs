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
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.dataset, name) ? this.dataset[name] : null; },
    setAttribute(name, value) { this.dataset[name] = String(value); },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.dataset, name); },
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

// ── 12. Production alias → actual DOM/source mapping ──

test('production aliases map to real CTA selectors (no ARIA tab invented)', function() {
  // Production browser report used nicknames `newMomentTab` / `connectTab`.
  // They are NOT ARIA tabs; they are two separate CTA flows in the
  // detail "이 순간에서" action card.
  var viewTpl = readSource('js/editor/templates/editor-detail-view-mode-template.js');
  var sidebarTpl = readSource('js/editor/templates/editor-sidebar-template.js');

  // new-moment authoring route: detail continue ("이 순간에서 이어가기") + sidebar ("새 순간 만들기")
  assert.ok(viewTpl.includes('id="continueFromMomentBtn"'), 'new-moment route: continueFromMomentBtn in detail view template');
  assert.ok(sidebarTpl.includes('id="addMemoryBtn"'), 'new-moment route: addMemoryBtn in sidebar template');
  assert.ok(!viewTpl.includes('role="tab"'), 'new-moment alias is not an ARIA tab');

  // connect-existing route: detail CTA ("기존 순간 연결하기")
  assert.ok(viewTpl.includes('id="connectExistingCtaBtn"'), 'connect-existing route: connectExistingCtaBtn in detail view template');
  assert.ok(viewTpl.includes('id="connectExistingCtaSection"'), 'connect-existing route: connectExistingCtaSection container');
  assert.ok(!viewTpl.includes('role="tab"'), 'connect alias is not an ARIA tab');
});

// ── 13. Connect-existing controller — real source, executed route ──

function createConnectControllerSandbox(opts) {
  opts = opts || {};
  var connectMemoryCalls = 0;

  function makeEl(id) {
    return makeClickableElement({ id: id, style: { display: 'none' } });
  }
  var els = {
    connectExistingCtaSection: makeEl('connectExistingCtaSection'),
    connectExistingCtaBtn: makeEl('connectExistingCtaBtn'),
    connectExistingPendingSection: makeEl('connectExistingPendingSection'),
    connectExistingCancelBtn: makeEl('connectExistingCancelBtn'),
    connectExistingConfirmSection: makeEl('connectExistingConfirmSection'),
    connectExistingConfirmHint: makeEl('connectExistingConfirmHint'),
    connectExistingConfirmBtn: makeEl('connectExistingConfirmBtn'),
    connectExistingConfirmCancelBtn: makeEl('connectExistingConfirmCancelBtn')
  };

  var interactionMode = {
    MODE_VIEW: 'view',
    MODE_EDIT: 'edit',
    _mode: opts.mode || 'edit',
    getMode: function() { return this._mode; },
    isEditMode: function() { return this._mode === 'edit'; },
    subscribe: function() { return function() {}; }
  };

  var editorCanvas = {
    _pendingSourceId: null,
    getPendingConnectSourceId: function() { return this._pendingSourceId; },
    setPendingConnect: function(id) { this._pendingSourceId = id; },
    clearPendingConnect: function() { this._pendingSourceId = null; },
    calcPosition: function() { return { x: 0, y: 0 }; },
    drawConnectPreview: function() {},
    setOnPendingConnectCleared: function() {}
  };

  var doc = {
    getElementById: function(id) { return els[id] || null; },
    querySelector: function() { return null; },
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  var sandbox = vm.createContext({
    window: {},
    document: doc,
    console: { warn: function() {}, log: function() {}, error: function() {}, debug: function() {} },
    setTimeout: function(fn) { fn(); },
    clearTimeout: function() {},
    Error: Error, Promise: Promise, JSON: JSON, Math: Math, Date: Date,
    RegExp: RegExp, String: String, Number: Number, Boolean: Boolean,
    Array: Array, Object: Object, Map: Map, Set: Set,
    isNaN: isNaN, isFinite: isFinite,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    parseInt: parseInt, parseFloat: parseFloat
  });
  sandbox.window = sandbox;
  sandbox.LoveBudEditorInteractionMode = interactionMode;

  vm.runInContext(readSource('js/editor/editor-bindings.js'), sandbox);

  var controller = sandbox.window.LoveBudEditorBindings.createConnectExistingController({
    canEdit: opts.canEdit !== false,
    getCurrentEditingMemory: opts.getCurrentEditingMemory || function() { return null; },
    isRootMemory: opts.isRootMemory || function() { return false; },
    getCanonicalRootId: opts.getCanonicalRootId || function() { return 'root'; },
    showToast: function() {},
    i18n: function(k) { return k; }
  });
  // Mirror editor.js wiring: canvas + late-bound connectMemory/validateConnectCandidate.
  controller.setEditorCanvas(editorCanvas);
  controller.setConnectMemory(function() {
    connectMemoryCalls++;
    return Promise.resolve(true);
  });
  controller.setValidateConnectCandidate(opts.validateConnectCandidate || function() { return { ok: true }; });
  controller.bindControls();
  controller.updateCtaNow();

  return {
    controller: controller,
    editorCanvas: editorCanvas,
    els: els,
    getConnectMemoryCalls: function() { return connectMemoryCalls; }
  };
}

test('connect-existing: allowed route executes controller and connectMemory exactly once', function() {
  var nonRootMem = { id: 'mem-child', title: 'Child' };
  var targetMem = { id: 'mem-target', title: 'Target' };

  var s = createConnectControllerSandbox({
    canEdit: true,
    mode: 'edit',
    getCurrentEditingMemory: function() { return nonRootMem; },
    isRootMemory: function(m, rootId) { return !!m && m.id === rootId; },
    getCanonicalRootId: function() { return 'root'; }
  });

  assert.notEqual(s.els.connectExistingCtaSection.style.display, 'none', 'allowed: CTA section visible');
  assert.equal(s.getConnectMemoryCalls(), 0, 'pre: no connectMemory yet');

  s.els.connectExistingCtaBtn.click();
  assert.equal(s.editorCanvas.getPendingConnectSourceId(), 'mem-child', 'CTA click → enterConnectMode → pending source set');
  assert.notEqual(s.els.connectExistingPendingSection.style.display, 'none', 'pending section visible after CTA click');

  s.controller.handleConnectTargetSelect(targetMem, { x: 1, y: 1 });
  assert.notEqual(s.els.connectExistingConfirmSection.style.display, 'none', 'confirm section reached after valid candidate');

  s.els.connectExistingConfirmBtn.click();
  assert.equal(s.getConnectMemoryCalls(),1, 'CONNECT_MEMORY_CALL_COUNT: 1 (exactly once)');
  // resetConnectFlow runs in the connectMemory().then microtask.
  return Promise.resolve().then(function() {
    assert.equal(s.editorCanvas.getPendingConnectSourceId(), null, 'connect flow reset pending after confirm');
  });
});

test('connect-existing: allowed route shows NO new-moment fallback', function() {
  var nonRootMem = { id: 'mem-child' };
  var targetMem = { id: 'mem-target' };
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return nonRootMem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  s.els.connectExistingCtaBtn.click();
  s.controller.handleConnectTargetSelect(targetMem, { x: 1, y: 1 });
  s.els.connectExistingConfirmBtn.click();

  assert.equal(s.getConnectMemoryCalls(), 1, 'connectMemory called once');
  // Controller has no addMemoryBtn / continueFromMomentBtn / showAddMemoryForm reference.
  var src = readSource('js/editor/editor-bindings.js');
  var bindStart = src.indexOf('function bindControls');
  var bindEnd = src.indexOf('function', bindStart + 20);
  var bindText = src.slice(bindStart, bindEnd);
  assert.ok(!bindText.includes('addMemoryBtn'), 'NO addMemoryBtn fallback in connect handlers');
  assert.ok(!bindText.includes('continueFromMomentBtn'), 'NO continueFromMomentBtn fallback in connect handlers');
  assert.ok(!bindText.includes('showAddMemoryForm'), 'NO showAddMemoryForm fallback in connect handlers');
});

test('connect-existing: root memory fails closed (CTA hidden, no connectMemory)', function() {
  var rootMem = { id: 'root', title: 'Root' };
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return rootMem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; },
    getCanonicalRootId: function() { return 'root'; }
  });

  assert.equal(s.els.connectExistingCtaSection.style.display, 'none', 'ROOT_FAIL_CLOSED: CTA hidden');
  s.els.connectExistingCtaBtn.click();
  assert.equal(s.editorCanvas.getPendingConnectSourceId(), null, 'root: enterConnectMode blocked');
  assert.equal(s.getConnectMemoryCalls(), 0, 'root: connectMemory 0');
});

test('connect-existing: missing currentEditingMemory fails closed', function() {
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return null; }
  });

  assert.equal(s.els.connectExistingCtaSection.style.display, 'none', 'MISSING_CURRENT_MEMORY_FAIL_CLOSED: CTA hidden');
  s.els.connectExistingCtaBtn.click();
  assert.equal(s.getConnectMemoryCalls(), 0, 'missing memory: connectMemory 0');
});

test('connect-existing: view mode fails closed', function() {
  var mem = { id: 'mem-child' };
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'view',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  assert.equal(s.els.connectExistingCtaSection.style.display, 'none', 'VIEW_MODE_FAIL_CLOSED: CTA hidden');
  s.els.connectExistingCtaBtn.click();
  assert.equal(s.getConnectMemoryCalls(), 0, 'view mode: connectMemory 0');
});

test('connect-existing: read-only / non-owner fails closed', function() {
  var mem = { id: 'mem-child' };
  var s = createConnectControllerSandbox({
    canEdit: false, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  assert.equal(s.els.connectExistingCtaSection.style.display, 'none', 'READONLY_NONOWNER_FAIL_CLOSED: CTA hidden');
  s.els.connectExistingCtaBtn.click();
  assert.equal(s.getConnectMemoryCalls(), 0, 'read-only: connectMemory 0');
});

test('connect-existing: invalid candidate fails closed (no confirm, no connectMemory)', function() {
  var mem = { id: 'mem-child' };
  var target = { id: 'mem-target' };
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; },
    validateConnectCandidate: function() { return { ok: false, reason: 'self_connection' }; }
  });

  s.els.connectExistingCtaBtn.click();
  s.controller.handleConnectTargetSelect(target, { x: 1, y: 1 });
  assert.equal(s.els.connectExistingConfirmSection.style.display, 'none', 'INVALID_CANDIDATE_FAIL_CLOSED: confirm not shown');
  assert.equal(s.getConnectMemoryCalls(), 0, 'invalid candidate: connectMemory 0');
});

test('connect-existing: cancel clears pending and returns to CTA', function() {
  var mem = { id: 'mem-child' };
  var s = createConnectControllerSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  s.els.connectExistingCtaBtn.click();
  assert.notEqual(s.els.connectExistingPendingSection.style.display, 'none', 'pending visible');
  s.els.connectExistingCancelBtn.click();
  assert.equal(s.editorCanvas.getPendingConnectSourceId(), null, 'MODE_SWITCH_CLEARS_CONNECT_STATE: cancel clears pending');
  assert.equal(s.els.connectExistingPendingSection.style.display, 'none', 'pending hidden after cancel');
});

// ── 14. Form isolation — executed native inert + attribute fallback ──

function createFormIsolationSandbox(opts) {
  opts = opts || {};
  var s = createFormSandbox({ canEdit: opts.canEdit !== false });
  if (opts.inertProperty === false) {
    // Simulate an element without native `inert` property support.
    delete s.detailContent.inert;
  }
  return s;
}

test('form isolation: native inert path open/close + active form stays operable', function() {
  var s = createFormIsolationSandbox({ canEdit: true, inertProperty: true });

  assert.equal('inert' in s.detailContent, true, 'NATIVE_INERT_PATH: native inert supported');
  assert.equal(s.detailContent.inert, false, 'pre: detail not inert');

  s.formApi.showAddMemoryForm();
  assert.equal(s.detailContent.inert, true, 'open: detailContent.inert = true');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'true', 'open: detail aria-hidden = true');
  assert.notEqual(s.formEl.inert, true, 'ACTIVE_FORM_NOT_INERT: form remains operable');
  assert.ok(!s.detailContent.contains(s.formEl), 'FORM_NOT_DESCENDANT: form is sibling outside #detailContent');

  s.formApi.hideAddMemoryForm();
  assert.equal(s.detailContent.inert, false, 'close: detailContent.inert = false');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'false', 'close restores aria-hidden (established contract)');
});

test('form isolation: attribute fallback path when inert property unsupported', function() {
  var s = createFormIsolationSandbox({ canEdit: true, inertProperty: false });

  assert.equal('inert' in s.detailContent, false, 'ATTRIBUTE_FALLBACK_PATH: no native inert property');
  assert.equal(s.detailContent.inert, undefined, 'pre: native inert unused');

  s.formApi.showAddMemoryForm();
  assert.equal(s.detailContent.inert, undefined, 'open: native inert still unused');
  assert.equal(s.detailContent.hasAttribute('inert'), true, 'open: inert attribute set (fallback)');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'true', 'open: detail aria-hidden = true');
  assert.ok(!s.detailContent.contains(s.formEl), 'FORM_NOT_DESCENDANT: form outside #detailContent');

  s.formApi.hideAddMemoryForm();
  assert.equal(s.detailContent.hasAttribute('inert'), false, 'close: inert attribute removed');
});

test('form isolation: canEdit=false does not apply inert or aria-hidden', function() {
  var s = createFormIsolationSandbox({ canEdit: false, inertProperty: true });
  s.formApi.showAddMemoryForm();
  assert.equal(s.detailContent.inert, false, 'canEdit=false: detail not made inert');
  assert.notEqual(s.detailContent.getAttribute('aria-hidden'), 'true', 'canEdit=false: detail aria-hidden not applied');
});

// ── 15. Focus trap — executed Tab/Shift+Tab within form inputs ──

function createFocusTrapSandbox() {
  var keydownHandlers = [];

  function makeInput(id) {
    var el = makeClickableElement({ id: id, value: '' });
    var focusCalls = 0;
    el.focus = function() { focusCalls++; el.__focused = true; };
    el.getFocusCalls = function() { return focusCalls; };
    return el;
  }

  var inputs = {
    memoryUrlInput: makeInput('memoryUrlInput'),
    memoryStartTimeInput: makeInput('memoryStartTimeInput'),
    memoryEndTimeInput: makeInput('memoryEndTimeInput'),
    memoryTitleInput: makeInput('memoryTitleInput'),
    memoryTagsInput: makeInput('memoryTagsInput'),
    memoryMemoInput: makeInput('memoryMemoInput')
  };

  var detailContent = makeClickableElement({ id: 'detailContent', inert: false });
  var canvasArea = makeClickableElement({ id: 'canvasArea', classList: { _classes: ['canvas-area'], add: function(n){this._classes.push(n);}, remove: function(n){this._classes=this._classes.filter(function(c){return c!==n;});}, contains: function(n){return this._classes.indexOf(n)>=0;}, toggle: function(n){} } });
  var editorLayout = makeClickableElement({ id: 'editorLayout', classList: { _classes: ['editor-layout'], add: function(n){this._classes.push(n);}, remove: function(n){this._classes=this._classes.filter(function(c){return c!==n;});}, contains: function(n){return this._classes.indexOf(n)>=0;}, toggle: function(n){} } });
  var canvasTopbar = makeClickableElement({ className: 'editor-canvas-topbar' });
  var canvasEmptyGuide = makeClickableElement({ id: 'canvasEmptyGuide', classList: { _classes: [], add: function(){}, remove: function(){}, contains: function(){return false;}, toggle: function(){return false;} } });
  var addMemoryForm = makeClickableElement({ id: 'addMemoryForm', style: { display: 'none' } });

  inputs.memoryUrlInput.closest = function(sel) {
    if (sel === '.canvas-area') return canvasArea;
    if (sel === '.editor-layout') return editorLayout;
    return null;
  };
  addMemoryForm.closest = function(sel) {
    if (sel === '.canvas-area') return canvasArea;
    if (sel === '.editor-layout') return editorLayout;
    return null;
  };

  var elementMap = {
    addMemoryForm: addMemoryForm,
    detailContent: detailContent,
    canvasArea: canvasArea,
    canvasEmptyGuide: canvasEmptyGuide,
    memoryUrlInput: inputs.memoryUrlInput,
    memoryStartTimeInput: inputs.memoryStartTimeInput,
    memoryEndTimeInput: inputs.memoryEndTimeInput,
    memoryTitleInput: inputs.memoryTitleInput,
    memoryTagsInput: inputs.memoryTagsInput,
    memoryMemoInput: inputs.memoryMemoInput,
    memoryUrlField: makeClickableElement({ id: 'memoryUrlField' }),
    memoryModeLinkBtn: makeClickableElement({ id: 'memoryModeLinkBtn' }),
    memoryModeTextBtn: makeClickableElement({ id: 'memoryModeTextBtn' }),
    memoryFormSupportNoteText: makeClickableElement({ id: 'memoryFormSupportNoteText' }),
    memoryStartTimeField: makeClickableElement({ id: 'memoryStartTimeField' }),
    memoryVideoSegmentGrid: makeClickableElement({ id: 'memoryVideoSegmentGrid' }),
    memoryStartTimeHint: makeClickableElement({ id: 'memoryStartTimeHint' }),
    memoryEndTimeInput: inputs.memoryEndTimeInput,
    addMemoryFormEyebrow: makeClickableElement({ id: 'addMemoryFormEyebrow' }),
    addMemoryFormTitle: makeClickableElement({ id: 'addMemoryFormTitle' }),
    addMemoryFormIntro: makeClickableElement({ id: 'addMemoryFormIntro' }),
    memoryUrlLabel: makeClickableElement({ id: 'memoryUrlLabel' }),
    memoryTitleLabel: makeClickableElement({ id: 'memoryTitleLabel' }),
    memoryTagsLabel: makeClickableElement({ id: 'memoryTagsLabel' }),
    memoryMemoLabel: makeClickableElement({ id: 'memoryMemoLabel' }),
    confirmAddMemory: makeClickableElement({ id: 'confirmAddMemory' }),
    memoryLinkPreview: makeClickableElement({ id: 'memoryLinkPreview', classList: { _classes: [], add: function(){}, remove: function(){}, contains: function(){return false;}, toggle: function(){return false;} } }),
    memoryPreviewThumb: makeClickableElement({ id: 'memoryPreviewThumb' }),
    memoryPreviewBadge: makeClickableElement({ id: 'memoryPreviewBadge' }),
    memoryPreviewTitle: makeClickableElement({ id: 'memoryPreviewTitle' }),
    memoryPreviewHint: makeClickableElement({ id: 'memoryPreviewHint' })
  };

  var activeElement = null;
  var doc = {
    getElementById: function(id) { return elementMap[id] || null; },
    querySelector: function(sel) {
      if (sel === '.editor-canvas-topbar') return canvasTopbar;
      return null;
    },
    addEventListener: function(type, handler) { if (type === 'keydown') keydownHandlers.push(handler); },
    removeEventListener: function(type, handler) {
      if (type === 'keydown') keydownHandlers = keydownHandlers.filter(function(h){ return h !== handler; });
    },
    createElement: function() { return makeClickableElement({}); },
    body: makeClickableElement({ dataset: {} }),
    get activeElement() { return activeElement; },
    set activeElement(v) { activeElement = v; }
  };

  var sandbox = vm.createContext({
    window: {},
    document: doc,
    console: { warn: function() {}, log: function() {}, error: function() {}, debug: function() {} },
    setTimeout: function(fn) { fn(); },
    clearTimeout: function() {},
    requestAnimationFrame: function(fn) { fn(); },
    fetch: function() { return Promise.resolve({ json: function() { return Promise.resolve({}); } }); },
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
    currentTreeMemories: [{ id: 'mem-root', title: 'Root' }],
    currentTreeData: null,
    setCachedMemories: function() {},
    refreshMemories: function() {},
    errors: [],
    Error: Error, Promise: Promise, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat,
    Math: Math, Date: Date, RegExp: RegExp, String: String, Number: Number,
    Boolean: Boolean, Array: Array, Object: Object, Map: Map, Set: Set,
    isNaN: isNaN, isFinite: isFinite, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent
  });
  sandbox.window = sandbox;

  vm.runInContext(readSource('js/editor/editor-memory-form.js'), sandbox);

  var deps = {
    i18n: function(k) { return k; },
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
    canEdit: true
  };

  var formApi = vm.runInContext('window.createEditorMemoryForm(deps)', Object.assign(sandbox, { deps }));

  return {
    sandbox: sandbox, doc: doc, formApi: formApi, inputs: inputs,
    getKeydownHandlers: function() { return keydownHandlers; }
  };
}

test('focus trap: executed Tab/Shift+Tab wraps within form inputs', function() {
  var ft = createFocusTrapSandbox();
  var f = ft.formApi;
  f.showAddMemoryForm();

  var handlers = ft.getKeydownHandlers();
  assert.ok(handlers.length >= 1, 'FOCUS_TRAP_EXECUTED: keydown handler registered');
  // focusTrap is the first keydown handler registered by showAddMemoryForm.
  var focusTrap = handlers[0];

  var first = ft.inputs.memoryUrlInput;
  var middle = ft.inputs.memoryTitleInput;
  var last = ft.inputs.memoryMemoInput;

  // showAddMemoryForm focuses the first input once; capture baselines.
  var firstBaseline = first.getFocusCalls();
  var lastBaseline = last.getFocusCalls();
  var middleBaseline = middle.getFocusCalls();

  function dispatch(evt) {
    var prevented = false;
    focusTrap(Object.assign({ preventDefault: function() { prevented = true; } }, evt));
    return prevented;
  }

  // last input + Tab → wrap to first input
  ft.doc.activeElement = last;
  var p1 = dispatch({ key: 'Tab' });
  assert.equal(p1, true, 'last + Tab: preventDefault');
  assert.equal(first.getFocusCalls(), firstBaseline + 1, 'last + Tab → first input focused');

  // first input + Shift+Tab → wrap to last input
  ft.doc.activeElement = first;
  var p2 = dispatch({ key: 'Tab', shiftKey: true });
  assert.equal(p2, true, 'first + Shift+Tab: preventDefault');
  assert.equal(last.getFocusCalls(), lastBaseline + 1, 'first + Shift+Tab → last input focused');

  // middle input + Tab → normal flow, no preventDefault
  ft.doc.activeElement = middle;
  var p3 = dispatch({ key: 'Tab' });
  assert.equal(p3, false, 'middle + Tab: no preventDefault (normal flow)');
  assert.equal(middle.getFocusCalls(), middleBaseline, 'middle + Tab: middle not re-focused');

  // When form is closed, focus trap is removed → dispatch is a no-op.
  f.hideAddMemoryForm();
  var handlersAfter = ft.getKeydownHandlers();
  assert.equal(handlersAfter.indexOf(focusTrap), -1, 'CANCEL_RESTORES_ISOLATION: trap removed after close');
});

// ── 16. Form-level existing-moment connection entry integration ──
// Executes the real editor-memory-form.js, editor-bindings.js (connect
// controller) and editor-page-event-bindings.js together in one VM so the
// form-level connect entry routes through the existing guarded controller.

function createFormConnectIntegrationSandbox(opts) {
  opts = opts || {};
  var canEdit = opts.canEdit !== false;

  var counters = {
    showAddMemoryForm: 0,
    hideAddMemoryForm: 0,
    connectStart: 0,
    connectMemory: 0,
    newMomentCreate: 0
  };

  function classListStub(classes) {
    var arr = classes || [];
    return {
      _classes: arr,
      add: function(n) { if (arr.indexOf(n) === -1) arr.push(n); },
      remove: function(n) { arr = arr.filter(function(c) { return c !== n; }); this._classes = arr; },
      contains: function(n) { return arr.indexOf(n) >= 0; },
      toggle: function(n, f) {
        if (f === true) { this.add(n); return true; }
        if (f === false) { this.remove(n); return false; }
        if (this.contains(n)) { this.remove(n); return false; }
        this.add(n); return true;
      }
    };
  }

  var canvasArea = makeClickableElement({ id: 'canvasArea', classList: classListStub(['canvas-area']) });
  var editorLayout = makeClickableElement({ id: 'editorLayout', classList: classListStub(['editor-layout']) });
  var canvasTopbar = makeClickableElement({ className: 'editor-canvas-topbar' });

  var formEl = makeClickableElement({
    id: 'addMemoryForm',
    style: { display: 'none' },
    classList: classListStub([]),
    closest: function(sel) {
      if (sel === '.canvas-area') return canvasArea;
      if (sel === '.editor-layout') return editorLayout;
      return null;
    },
    contains: function() { return false; }
  });

  var detailContent = makeClickableElement({ id: 'detailContent', inert: false });

  var elementMap = {
    addMemoryForm: formEl,
    detailContent: detailContent,
    canvasEmptyGuide: makeClickableElement({ id: 'canvasEmptyGuide', classList: classListStub([]) }),
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
    memoryLinkPreview: makeClickableElement({ id: 'memoryLinkPreview', classList: classListStub([]) }),
    memoryPreviewThumb: makeClickableElement({ id: 'memoryPreviewThumb' }),
    memoryPreviewBadge: makeClickableElement({ id: 'memoryPreviewBadge' }),
    memoryPreviewTitle: makeClickableElement({ id: 'memoryPreviewTitle' }),
    memoryPreviewHint: makeClickableElement({ id: 'memoryPreviewHint' }),
    editorMemoryFormContext: null,
    addMemoryBtn: makeClickableElement({ id: 'addMemoryBtn', disabled: false }),
    cancelAddMemory: makeClickableElement({ id: 'cancelAddMemory' }),
    connectExistingFromFormBtn: makeClickableElement({ id: 'connectExistingFromFormBtn', hidden: false, closest: function(sel) { return sel === '.editor-memory-form-modal' ? formEl : null; } }),
    detailPanel: makeClickableElement({ id: 'detailPanel' }),
    connectExistingCtaSection: makeClickableElement({ id: 'connectExistingCtaSection', style: { display: 'none' } }),
    connectExistingCtaBtn: makeClickableElement({ id: 'connectExistingCtaBtn', style: { display: 'none' } }),
    connectExistingPendingSection: makeClickableElement({ id: 'connectExistingPendingSection', style: { display: 'none' } }),
    connectExistingCancelBtn: makeClickableElement({ id: 'connectExistingCancelBtn', style: { display: 'none' } }),
    connectExistingConfirmSection: makeClickableElement({ id: 'connectExistingConfirmSection', style: { display: 'none' } }),
    connectExistingConfirmHint: makeClickableElement({ id: 'connectExistingConfirmHint', style: { display: 'none' } }),
    connectExistingConfirmBtn: makeClickableElement({ id: 'connectExistingConfirmBtn', style: { display: 'none' } }),
    connectExistingConfirmCancelBtn: makeClickableElement({ id: 'connectExistingConfirmCancelBtn', style: { display: 'none' } })
  };

  var docListeners = {};
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
    addEventListener: function(type, handler) { (docListeners[type] = docListeners[type] || []).push(handler); },
    removeEventListener: function(type, handler) {
      var arr = docListeners[type];
      if (!arr) return;
      var idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
    activeElement: null,
    createElement: function() { return makeClickableElement({}); },
    documentElement: makeClickableElement({ dataset: {} }),
    body: makeClickableElement({ dataset: {} })
  };

  var modeListeners = [];
  var modeValue = opts.mode || 'edit';
  var interactionMode = {
    MODE_VIEW: 'view',
    MODE_EDIT: 'edit',
    _mode: modeValue,
    getMode: function() { return modeValue; },
    isEditMode: function() { return modeValue === 'edit'; },
    setMode: function(m) {
      modeValue = m;
      modeListeners.slice().forEach(function(fn) { try { fn(m); } catch (e) {} });
    },
    subscribe: function(fn) { modeListeners.push(fn); return function() {}; }
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
    LoveBudEditorInteractionMode: interactionMode,
    LoveBudCache: null,
    LoveBudNormalize: null,
    currentTreeMemories: [],
    currentTreeData: null,
    setCachedMemories: function() {},
    refreshMemories: function() {},
    errors: [],
    Error: Error, Promise: Promise, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat,
    Math: Math, Date: Date, RegExp: RegExp, String: String, Number: Number,
    Boolean: Boolean, Array: Array, Object: Object, Map: Map, Set: Set,
    isNaN: isNaN, isFinite: isFinite, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent
  });
  sandbox.window = sandbox;

  vm.runInContext(readSource('js/editor/editor-bindings.js'), sandbox);
  vm.runInContext(readSource('js/editor/editor-memory-form.js'), sandbox);
  vm.runInContext(readSource('js/editor/editor-page-event-bindings.js'), sandbox);

  var deps = {
    i18n: function(k) { return k; },
    treeId: 'test-tree-id',
    getSelectedNodeId: function() { return 'mem-root'; },
    getCanonicalRootId: function() { return opts.getCanonicalRootId || 'root'; },
    resolveParentIdForCreate: function() { return 'mem-root'; },
    updateSaveStatus: function() {},
    showToast: function() {},
    getYouTubeInputErrorMessage: function() { return null; },
    nextMemoryId: function() { return 'mem-2'; },
    normalizeMemory: function(m) { return m; },
    getTreeMemories: function() { return []; },
    setTreeMemories: function() {},
    setLocalSaveMode: function() {},
    drawNode: function() {},
    drawBranch: function() {},
    calcPosition: function() {},
    updateSidebarStatus: function() {},
    updateFocusSelectedBtn: function() {},
    setDetailEmptyState: function() {},
    selectNode: function() {},
    treeMemories: function() { return []; },
    setCachedMemories: function() {},
    rerenderCanvas: function() {},
    focusNodeById: function() {},
    canEdit: canEdit
  };

  var formApi = vm.runInContext('window.createEditorMemoryForm(deps)', Object.assign(sandbox, { deps }));

  var editorCanvas = {
    _pendingSourceId: null,
    getPendingConnectSourceId: function() { return this._pendingSourceId; },
    setPendingConnect: function(id) { this._pendingSourceId = id; },
    clearPendingConnect: function() { this._pendingSourceId = null; },
    calcPosition: function() { return { x: 0, y: 0 }; },
    drawConnectPreview: function() {},
    setOnPendingConnectCleared: function() {}
  };

  var controller = sandbox.window.LoveBudEditorBindings.createConnectExistingController({
    canEdit: canEdit,
    getCurrentEditingMemory: opts.getCurrentEditingMemory || function() { return null; },
    isRootMemory: opts.isRootMemory || function() { return false; },
    getCanonicalRootId: function() { return opts.getCanonicalRootId || 'root'; },
    showToast: function() {},
    i18n: function(k) { return k; }
  });
  controller.setEditorCanvas(editorCanvas);
  controller.setConnectMemory(function() { counters.connectMemory++; return Promise.resolve(true); });
  controller.setValidateConnectCandidate(opts.validateConnectCandidate || function() { return { ok: true }; });
  controller.bindControls();
  controller.updateCtaNow();

  // Counting wrappers (bound before page-event wiring so the form-level
  // entry handler uses the counted versions).
  var origStart = controller.startConnectMode;
  controller.startConnectMode = function() {
    var result = origStart.apply(controller, arguments);
    if (result === true) counters.connectStart++;
    return result;
  };
  var rawShow = formApi.showAddMemoryForm;
  formApi.showAddMemoryForm = function() { counters.showAddMemoryForm++; return rawShow.apply(formApi, arguments); };
  var rawHide = formApi.hideAddMemoryForm;
  formApi.hideAddMemoryForm = function() { counters.hideAddMemoryForm++; return rawHide.apply(formApi, arguments); };

  sandbox.window.LoveBudEditorPageEventBindings.bindEditorPageEvents({
    canEdit: canEdit,
    sidebarUIHelper: {},
    editorBindings: sandbox.window.LoveBudEditorBindings,
    emptyGuideUIHelper: {},
    getTreeId: function() { return 'test-tree-id'; },
    updateTreeVisibility: function() {},
    showToast: function() {},
    safeI18nText: function(k) { return k; },
    i18n: function(k) { return k; },
    getHttpStatus: function() { return 200; },
    updateSidebarStatus: function() {},
    showAddMemoryForm: formApi.showAddMemoryForm,
    hideAddMemoryForm: formApi.hideAddMemoryForm,
    addMemoryFromForm: function() { counters.newMomentCreate++; return Promise.resolve(); },
    updateSaveStatus: function() {},
    getEditorCanvas: function() { return editorCanvas; },
    getTreeMemories: function() { return []; },
    enterEditMode: function() {},
    deleteMemory: function() {},
    exitEditMode: function() {},
    saveMemoryEdit: function() {},
    connectExistingController: controller
  });

  return {
    sandbox: sandbox, doc: doc, formApi: formApi, controller: controller,
    editorCanvas: editorCanvas, elementMap: elementMap, counters: counters,
    interactionMode: interactionMode, detailContent: detailContent, formEl: formEl
  };
}

test('FORM_TO_CONNECT_CONTROLLER_ROUTE: allowed owner/edit/non-root routes form → connect controller', function() {
  var mem = { id: 'mem-child', title: 'Child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; },
    getCanonicalRootId: 'root'
  });

  // Open the new-moment form through the wired addMemoryBtn (wrapped show).
  s.elementMap.addMemoryBtn.click();
  assert.equal(s.counters.showAddMemoryForm, 1, 'form opened via wired entry');
  assert.equal(s.formEl.style.display, 'block', 'form visible');
  assert.equal(s.detailContent.inert, true, 'detail inert while form open (#3503 isolation preserved)');

  // Form-level connect entry must be visible + enabled for non-root edit.
  var connectBtn = s.elementMap.connectExistingFromFormBtn;
  assert.equal(connectBtn.hidden, false, 'FORM_CONNECT_ENTRY_ALLOWED_STATE: visible');
  assert.equal(connectBtn.disabled, false, 'FORM_CONNECT_ENTRY_ALLOWED_STATE: enabled');

  // Click the form-level connect entry.
  connectBtn.click();

  assert.equal(s.counters.connectStart, 1, 'CONNECT_START_COUNT: 1');
  assert.equal(s.counters.connectMemory, 0, 'CONNECT_MEMORY_CALL_COUNT_BEFORE_CONFIRM: 0');
  assert.equal(s.counters.newMomentCreate, 0, 'NEW_MOMENT_CREATE_COUNT: 0');
  assert.equal(s.formApi.isFormOpen(), false, 'FORM_CLOSES_BEFORE_CONNECT_MODE: form closed');
  assert.equal(s.detailContent.inert, false, 'CONNECT detail isolation released');
  assert.notEqual(s.elementMap.connectExistingPendingSection.style.display, 'none', 'PENDING_SECTION_VISIBLE: pending connect shown');

  // Confirm route: candidate select → confirm → connectMemory exactly once.
  s.controller.handleConnectTargetSelect({ id: 'mem-target', title: 'Target' }, { x: 1, y: 1 });
  assert.notEqual(s.elementMap.connectExistingConfirmSection.style.display, 'none', 'CONFIRM_SECTION_REACHED');
  s.elementMap.connectExistingConfirmBtn.click();
  assert.equal(s.counters.connectMemory, 1, 'CONNECT_MEMORY_CALL_COUNT: 1');
  assert.equal(s.counters.newMomentCreate, 0, 'NO_NEW_MOMENT_FALLBACK after confirm');

  // No new-moment / addMemory / continueFromMoment fallback during the route.
  assert.equal(s.counters.showAddMemoryForm, 1, 'NO new-moment form re-open (SHOW_ADD_MEMORY_FORM_FALLBACK_COUNT: 0)');
});

test('FORM_CLOSES_BEFORE_CONNECT_MODE: form closed and detail released before connect pending set', function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });
  s.elementMap.addMemoryBtn.click();
  var showBefore = s.counters.showAddMemoryForm;

  s.elementMap.connectExistingFromFormBtn.click();

  assert.equal(s.formApi.isFormOpen(), false, 'form not open after connect entry click');
  assert.equal(s.detailContent.inert, false, 'detail inert removed before connect mode');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'false', 'detail aria restored before connect mode');
  assert.equal(s.counters.showAddMemoryForm, showBefore, 'form not re-opened during transition');
  assert.equal(s.editorCanvas.getPendingConnectSourceId(), 'mem-child', 'pending connect source set after close');
});

test('NO_NEW_MOMENT_FALLBACK: connect entry never creates a new moment', function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });
  s.elementMap.addMemoryBtn.click();
  s.elementMap.connectExistingFromFormBtn.click();
  s.controller.handleConnectTargetSelect({ id: 'mem-target' }, { x: 1, y: 1 });
  s.elementMap.connectExistingConfirmBtn.click();

  assert.equal(s.counters.newMomentCreate, 0, 'NEW_MOMENT_CREATE_COUNT: 0');
  assert.equal(s.counters.connectMemory, 1, 'connectMemory used instead');
});

test('CONNECT_CONFIRM_ONCE: confirm calls connectMemory exactly once', async function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });
  s.elementMap.addMemoryBtn.click();
  s.elementMap.connectExistingFromFormBtn.click();
  s.controller.handleConnectTargetSelect({ id: 'mem-target' }, { x: 1, y: 1 });
  s.elementMap.connectExistingConfirmBtn.click();
  // Drain microtasks so resetConnectFlow runs (connectMemory().then resets).
  await Promise.resolve();
  s.elementMap.connectExistingConfirmBtn.click(); // second click — flow already reset
  // After reset, handleConfirm should return early (no targetData).

  assert.equal(s.counters.connectMemory, 1, 'CONNECT_CONFIRM_ONCE: exactly once');
});

test('CONNECT_CANCEL_RESTORE: cancel clears pending and restores detail without reopening form', function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });
  s.elementMap.addMemoryBtn.click();
  s.elementMap.connectExistingFromFormBtn.click();
  assert.notEqual(s.elementMap.connectExistingPendingSection.style.display, 'none', 'pending visible');

  s.elementMap.connectExistingCancelBtn.click();

  assert.equal(s.editorCanvas.getPendingConnectSourceId(), null, 'CONNECT_CANCEL_CLEARS_PENDING');
  assert.equal(s.elementMap.connectExistingPendingSection.style.display, 'none', 'pending hidden after cancel');
  assert.equal(s.formApi.isFormOpen(), false, 'FORM_AUTOREOPEN_AFTER_CONNECT_CANCEL: false');
  assert.equal(s.detailContent.inert, false, 'CONNECT_CANCEL_RESTORES_DETAIL');
  assert.notEqual(s.detailContent.getAttribute('aria-hidden'), 'true', 'detail aria not hidden after cancel');
});

test('NO_DUPLICATE_LISTENER: form-level connect entry binds exactly once across re-binds', function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  // Re-run page-event binding (simulating re-entrancy / mode switch re-bind).
  s.sandbox.window.LoveBudEditorPageEventBindings.bindEditorPageEvents({
    canEdit: true,
    sidebarUIHelper: {},
    editorBindings: s.sandbox.window.LoveBudEditorBindings,
    emptyGuideUIHelper: {},
    getTreeId: function() { return 'test-tree-id'; },
    updateTreeVisibility: function() {},
    showToast: function() {},
    safeI18nText: function(k) { return k; },
    i18n: function(k) { return k; },
    getHttpStatus: function() { return 200; },
    updateSidebarStatus: function() {},
    showAddMemoryForm: s.formApi.showAddMemoryForm,
    hideAddMemoryForm: s.formApi.hideAddMemoryForm,
    addMemoryFromForm: function() {},
    updateSaveStatus: function() {},
    getEditorCanvas: function() { return s.editorCanvas; },
    getTreeMemories: function() { return []; },
    enterEditMode: function() {},
    deleteMemory: function() {},
    exitEditMode: function() {},
    saveMemoryEdit: function() {},
    connectExistingController: s.controller
  });

  s.elementMap.addMemoryBtn.click();
  s.elementMap.connectExistingFromFormBtn.click();

  assert.equal(s.counters.connectStart, 1, 'NO_DUPLICATE_LISTENER: handler fired once');
});

test('FORM_CONNECT_ENTRY_ALLOWED_STATE: owner/edit/non-root entry is visible, enabled, keyboard-focusable', function() {
  var mem = { id: 'mem-child', title: 'Child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; },
    getCanonicalRootId: 'root'
  });

  var connectBtn = s.elementMap.connectExistingFromFormBtn;
  // Before any form open, no memory-driven visibility update has run.
  assert.equal(connectBtn.hidden, false, 'ALLOWED_STATE: entry present in DOM');

  // Open the new-moment form (wrapped show updates the entry visibility).
  s.elementMap.addMemoryBtn.click();

  assert.equal(s.controller.isConnectEntryAvailable(), true, 'ALLOWED_STATE: controller predicate true');
  assert.equal(connectBtn.hidden, false, 'OWNER_EDIT_NONROOT_ENTRY_VISIBLE: visible');
  assert.equal(connectBtn.disabled, false, 'OWNER_EDIT_NONROOT_ENTRY_ENABLED: enabled');
  assert.equal(connectBtn.getAttribute('aria-hidden'), 'false', 'ALLOWED_STATE: aria-hidden=false');
  assert.equal(connectBtn.tabIndex, 0, 'ALLOWED_STATE: natural keyboard focus');
});

test('FORM_CONNECT_ENTRY_NEGATIVE_MATRIX: root / missing / view / readonly fail closed', function() {
  function runRootCase() {
    var s = createFormConnectIntegrationSandbox({
      canEdit: true, mode: 'edit',
      getCurrentEditingMemory: function() { return { id: 'root' }; },
      isRootMemory: function(m, rootId) { return m && m.id === rootId; },
      getCanonicalRootId: 'root'
    });
    // For root moments the form CAN open (to add children). Opening triggers
    // the visibility update which should hide the connect entry.
    s.elementMap.addMemoryBtn.click();
    var connectBtn = s.elementMap.connectExistingFromFormBtn;
    return {
      hidden: connectBtn.hidden, disabled: connectBtn.disabled,
      available: s.controller.isConnectEntryAvailable(),
      startResult: s.controller.startConnectMode(),
      connectStart: s.counters.connectStart, connectMemory: s.counters.connectMemory
    };
  }
  function runMissingCase() {
    var s = createFormConnectIntegrationSandbox({
      canEdit: true, mode: 'edit',
      getCurrentEditingMemory: function() { return null; },
      isRootMemory: function(m, rootId) { return m && m.id === rootId; }
    });
    s.elementMap.addMemoryBtn.click();
    var connectBtn = s.elementMap.connectExistingFromFormBtn;
    return {
      hidden: connectBtn.hidden, disabled: connectBtn.disabled,
      available: s.controller.isConnectEntryAvailable(),
      startResult: s.controller.startConnectMode(),
      connectMemory: s.counters.connectMemory
    };
  }
  function runViewCase() {
    var s = createFormConnectIntegrationSandbox({
      canEdit: true, mode: 'view',
      getCurrentEditingMemory: function() { return { id: 'mem-child' }; },
      isRootMemory: function(m, rootId) { return m && m.id === rootId; }
    });
    // View mode: form does not open via addMemoryBtn (gated by isEditMode).
    var connectBtn = s.elementMap.connectExistingFromFormBtn;
    return {
      hidden: connectBtn.hidden, disabled: connectBtn.disabled,
      available: s.controller.isConnectEntryAvailable(),
      startResult: s.controller.startConnectMode(),
      connectMemory: s.counters.connectMemory
    };
  }
  function runReadonlyCase() {
    var s = createFormConnectIntegrationSandbox({
      canEdit: false, mode: 'edit',
      getCurrentEditingMemory: function() { return { id: 'mem-child' }; },
      isRootMemory: function(m, rootId) { return m && m.id === rootId; }
    });
    // Read-only: form does not open (canEdit false).
    var connectBtn = s.elementMap.connectExistingFromFormBtn;
    return {
      hidden: connectBtn.hidden, disabled: connectBtn.disabled,
      available: s.controller.isConnectEntryAvailable(),
      startResult: s.controller.startConnectMode(),
      connectMemory: s.counters.connectMemory
    };
  }

  // root moment
  var root = runRootCase();
  assert.equal(root.available, false, 'ROOT_FAIL_CLOSED: not available');
  assert.equal(root.hidden, true, 'ROOT_FAIL_CLOSED: hidden');
  assert.equal(root.startResult, false, 'ROOT_FAIL_CLOSED: direct start false');
  assert.equal(root.connectStart, 0, 'root: connectStart 0');
  assert.equal(root.connectMemory, 0, 'root: connectMemory 0');

  // missing currentEditingMemory
  var missing = runMissingCase();
  assert.equal(missing.available, false, 'MISSING_FAIL_CLOSED: not available');
  assert.equal(missing.hidden, true, 'MISSING_FAIL_CLOSED: hidden');
  assert.equal(missing.startResult, false, 'MISSING_FAIL_CLOSED: direct start false');
  assert.equal(missing.connectMemory, 0, 'missing memory: connectMemory 0');

  // view mode
  var view = runViewCase();
  assert.equal(view.available, false, 'VIEW_FAIL_CLOSED: not available');
  assert.equal(view.startResult, false, 'VIEW_FAIL_CLOSED: direct start false');
  assert.equal(view.connectMemory, 0, 'view mode: connectMemory 0');

  // read-only / non-owner
  var readonly = runReadonlyCase();
  assert.equal(readonly.available, false, 'READONLY_FAIL_CLOSED: not available');
  assert.equal(readonly.startResult, false, 'READONLY_FAIL_CLOSED: direct start false');
  assert.equal(readonly.connectMemory, 0, 'read-only: connectMemory 0');
});

test('PR_3503_REGRESSION_PRESERVED: form-level connect entry lives in active form, not inert detail', function() {
  var mem = { id: 'mem-child' };
  var s = createFormConnectIntegrationSandbox({
    canEdit: true, mode: 'edit',
    getCurrentEditingMemory: function() { return mem; },
    isRootMemory: function(m, rootId) { return m && m.id === rootId; }
  });

  // The connect entry must NOT be inside #detailContent (which becomes inert).
  assert.notEqual(s.detailContent.contains(s.elementMap.connectExistingFromFormBtn), true, 'form-level connect entry not inside inert detail');
  assert.equal(s.elementMap.connectExistingFromFormBtn.closest('.editor-memory-form-modal'), s.formEl, 'entry is inside the active form modal');

  // Opening the form still inerts detail (isolation contract preserved).
  s.elementMap.addMemoryBtn.click();
  assert.equal(s.detailContent.inert, true, 'form open keeps detail inert (#3503)');
  assert.equal(s.detailContent.getAttribute('aria-hidden'), 'true', 'form open keeps detail aria-hidden (#3503)');
  assert.equal(s.formEl.inert, false, 'active form not inert');
});
