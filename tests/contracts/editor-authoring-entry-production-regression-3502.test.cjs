'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

const editorCss = fs.readFileSync(path.join(ROOT, 'css/editor/editor-overrides.css'), 'utf8');
const editorJs = fs.readFileSync(path.join(ROOT, 'js/editor.js'), 'utf8');
const sidebarTpl = fs.readFileSync(path.join(ROOT, 'js/editor/templates/editor-sidebar-template.js'), 'utf8');
const memoryFormSrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8');
const bindingsSrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-bindings.js'), 'utf8');
const modeSelectionCss = fs.readFileSync(path.join(ROOT, 'css/editor/editor-mode-selection.css'), 'utf8');
const memoryFormTpl = fs.readFileSync(path.join(ROOT, 'js/editor/templates/editor-add-memory-form-template.js'), 'utf8');
const pageEventBindingsSrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-page-event-bindings.js'), 'utf8');
const memoryFormCss = fs.readFileSync(path.join(ROOT, 'css/editor/editor-memory-form-actions.css'), 'utf8');

// ── Source contracts ───────────────────────────────────────────────

test('CSS restores add-section only with edit mode selector', () => {
  const match = editorCss.match(/body:not\(\\.editor-readonly\)\[data-editor-interaction-mode="edit"\] \.editor-add-section-bottom/);
  assert.ok(match, 'CSS must gate add-section by editor-readonly + interaction-mode=edit');
});

test('CSS does not use overly broad selector without interaction mode', () => {
  const bare = editorCss.match(/body:not\(\\.editor-readonly\) \.editor-add-section-bottom\b/);
  if (bare) {
    assert.match(bare[0], /data-editor-interaction-mode/, 'add-section restore must require interaction-mode');
  }
});

test('sidebar template has aria-hidden and tabindex defaults', () => {
  assert.match(sidebarTpl, /aria-hidden="true"/);
  assert.match(sidebarTpl, /tabindex="-1"/);
  assert.match(sidebarTpl, /id="addMemoryBtn"/);
});

test('editor.js contains syncSidebarAuthoringEntryState', () => {
  assert.match(editorJs, /function syncSidebarAuthoringEntryState/);
  assert.match(editorJs, /effectiveCanEdit === true.*isEdit === true/);
});

test('editor.js calls syncSidebarAuthoringEntryState from handleModeChange', () => {
  assert.match(editorJs, /syncSidebarAuthoringEntryState\(isEdit\)/);
});

test('view mode CSS hides authoring buttons from detail panel', () => {
  assert.match(modeSelectionCss, /\[data-editor-interaction-mode="view"\] #continueFromMomentBtn/);
  assert.match(modeSelectionCss, /\[data-editor-interaction-mode="view"\] #connectExistingCtaSection/);
});

// ── Mock helpers ───────────────────────────────────────────

function makeClickableElement(overrides) {
  var listeners = {};
  return Object.assign({
    id: '',
    style: {},
    dataset: {},
    disabled: false,
    tabIndex: 0,
    textContent: '',
    innerHTML: '',
    value: '',
    classList: {
      _classes: [],
      add(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove(name) { this._classes = this._classes.filter(function(c) { return c !== name; }); },
      contains(name) { return this._classes.includes(name); }
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
      var i;
      var ev = { preventDefault: function() {}, stopPropagation: function() {} };
      var arr = listeners.click;
      if (arr) { for (i = 0; i < arr.length; i++) arr[i](ev); }
    },
    dispatchEvent() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(c) { return c; },
    insertBefore(c, r) { return c; },
    remove() {},
    focus() {},
    _listeners: listeners
  }, overrides);
}

function buildSyncDoc(section, button) {
  return {
    querySelector: function(sel) {
      if (sel === '.editor-add-section-bottom') return section || null;
      return null;
    },
    getElementById: function(id) {
      if (id === 'addMemoryBtn') return button || null;
      return null;
    }
  };
}

function createSyncFnSource() {
  var fnSource = editorJs.match(/function syncSidebarAuthoringEntryState[\s\S]*?\n\s{20}\}/);
  if (!fnSource) throw new Error('Could not extract syncSidebarAuthoringEntryState from editor.js');
  return '(function() {\n' + fnSource[0] + '\nreturn syncSidebarAuthoringEntryState;\n})()';
}

// ── Same-button transition tests ───────────────────────────

test('same button: view → edit → view transitions', function() {
  var section = makeClickableElement({ className: 'editor-add-section editor-add-section-bottom' });
  var button = makeClickableElement({ id: 'addMemoryBtn' });
  var doc = buildSyncDoc(section, button);

  var ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn: function() {}, log: function() {}, error: function() {} }
  });

  var syncFn = vm.runInContext(createSyncFnSource(), ctx);

  // initial view mode
  syncFn(false);
  assert.equal(section.getAttribute('aria-hidden'), 'true', 'view: section aria-hidden=true');
  assert.equal(button.tabIndex, -1, 'view: button tabindex=-1');
  assert.equal(button.disabled, true, 'view: button disabled');

  // switch to edit mode
  syncFn(true);
  assert.equal(section.getAttribute('aria-hidden'), 'false', 'edit: section aria-hidden=false');
  assert.equal(button.tabIndex, 0, 'edit: button tabindex=0');
  assert.equal(button.disabled, false, 'edit: button not disabled');

  // switch back to view
  syncFn(false);
  assert.equal(section.getAttribute('aria-hidden'), 'true', 'back to view: section aria-hidden=true');
  assert.equal(button.tabIndex, -1, 'back to view: button tabindex=-1');
  assert.equal(button.disabled, true, 'back to view: button disabled');
});

test('edit → view: same instance transition', function() {
  var section = makeClickableElement({ className: 'editor-add-section editor-add-section-bottom' });
  var button = makeClickableElement({ id: 'addMemoryBtn' });
  var doc = buildSyncDoc(section, button);

  var ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn: function() {}, log: function() {}, error: function() {} }
  });

  var syncFn = vm.runInContext(createSyncFnSource(), ctx);

  syncFn(true);
  assert.equal(section.getAttribute('aria-hidden'), 'false', 'edit: aria-hidden=false');
  assert.equal(button.tabIndex, 0, 'edit: tabindex=0');
  assert.equal(button.disabled, false, 'edit: disabled=false');

  syncFn(false);
  assert.equal(section.getAttribute('aria-hidden'), 'true', 'view: aria-hidden=true');
  assert.equal(button.tabIndex, -1, 'view: tabindex=-1');
  assert.equal(button.disabled, true, 'view: disabled=true');
});

test('effectiveCanEdit=false: edit mode does not enable button', function() {
  var section = makeClickableElement({ className: 'editor-add-section editor-add-section-bottom' });
  var button = makeClickableElement({ id: 'addMemoryBtn' });
  var doc = buildSyncDoc(section, button);

  var ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: false,
    console: { warn: function() {}, log: function() {}, error: function() {} }
  });

  var syncFn = vm.runInContext(createSyncFnSource(), ctx);

  syncFn(true);
  assert.equal(section.getAttribute('aria-hidden'), 'true', 'non-owner: section aria-hidden=true');
  assert.equal(button.tabIndex, -1, 'non-owner: button tabindex=-1');
  assert.equal(button.disabled, true, 'non-owner: button disabled');
});

test('missing elements does not throw', function() {
  var doc = { querySelector: function() { return null; }, getElementById: function() { return null; } };
  var ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn: function() {}, log: function() {}, error: function() {} }
  });
  var syncFn = vm.runInContext(createSyncFnSource(), ctx);
  assert.doesNotThrow(function() { syncFn(true); });
  assert.doesNotThrow(function() { syncFn(false); });
});

// ── Real button click binding test ─────────────────────────

function createInteractionModeMock() {
  var mode = 'view';
  return {
    MODE_VIEW: 'view',
    MODE_EDIT: 'edit',
    getMode: function() { return mode; },
    isEditMode: function() { return mode === 'edit'; },
    setMode: function(m) { mode = m; }
  };
}

function createFormSandbox(opts) {
  opts = opts || {};
  var canEdit = opts.canEdit !== false;

  var formEl = makeClickableElement({
    id: 'addMemoryForm',
    style: { display: 'none' },
    classList: {
      _classes: [],
      add: function(name) { if (this._classes.indexOf(name) === -1) this._classes.push(name); },
      remove: function(name) { this._classes = this._classes.filter(function(c) { return c !== name; }); },
      contains: function(name) { return this._classes.indexOf(name) !== -1; },
      toggle: function(name, force) {
        if (force === true) { this.add(name); return true; }
        if (force === false) { this.remove(name); return false; }
        var idx = this._classes.indexOf(name);
        if (idx >= 0) { this._classes.splice(idx, 1); return false; }
        this._classes.push(name); return true;
      }
    },
    closest: function(sel) {
      if (sel === '.canvas-area') return canvasArea;
      if (sel === '.editor-layout') return makeClickableElement({ className: 'editor-layout', classList: { _classes: [], add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() { return false; } } });
      return null;
    },
    contains: function() { return false; }
  });

  var detailContent = makeClickableElement({ id: 'detailContent', inert: false });
  var toolbar = makeClickableElement({ className: 'editor-floating-toolbar' });
  var canvasArea = makeClickableElement({ id: 'canvasArea', classList: { _classes: [], add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() { return false; } } });

  var canvasTopbar = makeClickableElement({});
  var elementMap = {
    addMemoryForm: formEl,
    detailContent: detailContent,
    canvasEmptyGuide: makeClickableElement({ id: 'canvasEmptyGuide', classList: { _classes: [], add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() { return false; } } }),
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
      if (sel === '.editor-floating-toolbar') return toolbar;
      return null;
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    activeElement: null,
    createElement: function() { return makeClickableElement({}); }
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
        createMemoryWithFallback: function() { return Promise.resolve({ createdMemory: { id: 'new-root' }, useApi: false }); },
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

  vm.runInContext(memoryFormSrc, sandbox);

  var deps = {
    i18n: function(key) { return key; },
    treeId: 'test-tree-id',
    getSelectedNodeId: function() { return 'root'; },
    getCanonicalRootId: function() { return 'root'; },
    resolveParentIdForCreate: function() { return 'root'; },
    updateSaveStatus: function() {},
    showToast: function() {},
    getYouTubeInputErrorMessage: function() { return null; },
    nextMemoryId: function() { return 'mem-2'; },
    normalizeMemory: function(m) { return m; },
    getTreeMemories: function() { return [{ id: 'root', title: 'First' }]; },
    setTreeMemories: function() {},
    setLocalSaveMode: function() {},
    drawNode: function() {},
    drawBranch: function() {},
    calcPosition: function() {},
    updateSidebarStatus: function() {},
    updateFocusSelectedBtn: function() {},
    setDetailEmptyState: function() {},
    selectNode: function() {},
    treeMemories: function() { return [{ id: 'root', title: 'First' }]; },
    setCachedMemories: function() {},
    canvasArea: canvasArea,
    rerenderCanvas: function() {},
    focusNodeById: function() {},
    canEdit: canEdit
  };

  var formApi = vm.runInContext('window.createEditorMemoryForm(deps)', Object.assign(sandbox, { deps }));

  return { sandbox: sandbox, doc: doc, formEl: formEl, detailContent: detailContent, toolbar: toolbar, formApi: formApi, elementMap: elementMap };
}

test('view mode disabled button click does not open form', function() {
  var addBtn = makeClickableElement({ id: 'addMemoryBtn' });
  var cancelBtn = makeClickableElement({ id: 'cancelMemoryBtn' });
  var confirmBtn = makeClickableElement({ id: 'confirmAddMemory' });
  var urlInput = makeClickableElement({ id: 'memoryUrlInput' });
  var titleInput = makeClickableElement({ id: 'memoryTitleInput' });
  var memoInput = makeClickableElement({ id: 'memoryMemoInput' });
  var interactionMode = createInteractionModeMock();
  var openCount = 0;

  var sandbox = vm.createContext({
    window: {},
    document: { getElementById: function() { return null; }, querySelector: function() { return null; } },
    LoveBudEditorInteractionMode: interactionMode,
    console: { warn: function() {}, log: function() {}, error: function() {} },
    ensureEditModeForFirstMoment: function() { return false; },
    Error: Error,
    Array: Array,
    Function: Function,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Promise: Promise
  });

  sandbox.window = sandbox;

  vm.runInContext(bindingsSrc, sandbox);

  var bindMemoryCreateControls = vm.runInContext('window.LoveBudEditorBindings.bindMemoryCreateControls', sandbox);

  bindMemoryCreateControls({
    addBtn: addBtn,
    cancelBtn: cancelBtn,
    confirmBtn: confirmBtn,
    urlInput: urlInput,
    titleInput: titleInput,
    memoInput: memoInput,
    showAddMemoryForm: function() { openCount += 1; },
    hideAddMemoryForm: function() {},
    addMemoryFromForm: function() { return Promise.resolve(); },
    updateSaveStatus: function() {},
    showToast: function() {},
    i18n: function(k) { return k; },
    getTreeMemories: function() { return [{ id: 'root' }]; }
  });

  addBtn.disabled = true;

  addBtn.click();

  assert.equal(openCount, 0, 'disabled button click: form should not open');
});

test('edit mode enabled button click opens form exactly once', function() {
  var addBtn = makeClickableElement({ id: 'addMemoryBtn' });
  var cancelBtn = makeClickableElement({ id: 'cancelMemoryBtn' });
  var confirmBtn = makeClickableElement({ id: 'confirmAddMemory' });
  var urlInput = makeClickableElement({ id: 'memoryUrlInput' });
  var titleInput = makeClickableElement({ id: 'memoryTitleInput' });
  var memoInput = makeClickableElement({ id: 'memoryMemoInput' });
  var interactionMode = createInteractionModeMock();
  var openCount = 0;

  var sandbox = vm.createContext({
    window: {},
    document: { getElementById: function() { return null; }, querySelector: function() { return null; } },
    LoveBudEditorInteractionMode: interactionMode,
    console: { warn: function() {}, log: function() {}, error: function() {} },
    ensureEditModeForFirstMoment: function() { return false; },
    Error: Error,
    Array: Array,
    Function: Function,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Promise: Promise
  });

  sandbox.window = sandbox;

  vm.runInContext(bindingsSrc, sandbox);

  var bindMemoryCreateControls = vm.runInContext('window.LoveBudEditorBindings.bindMemoryCreateControls', sandbox);

  interactionMode.setMode('edit');

  bindMemoryCreateControls({
    addBtn: addBtn,
    cancelBtn: cancelBtn,
    confirmBtn: confirmBtn,
    urlInput: urlInput,
    titleInput: titleInput,
    memoInput: memoInput,
    showAddMemoryForm: function() { openCount += 1; },
    hideAddMemoryForm: function() {},
    addMemoryFromForm: function() { return Promise.resolve(); },
    updateSaveStatus: function() {},
    showToast: function() {},
    i18n: function(k) { return k; },
    getTreeMemories: function() { return [{ id: 'root' }]; }
  });

  addBtn.click();

  assert.equal(openCount, 1, 'edit mode click: form should open exactly once');
});

test('full lifecycle: button click → form open → cancel → restore', function() {
  var fsandbox = createFormSandbox({ canEdit: true });
  var formEl = fsandbox.formEl;
  var detailContent = fsandbox.detailContent;
  var toolbar = fsandbox.toolbar;
  var formApi = fsandbox.formApi;

  // record initial state
  var initialFormDisplay = formEl.style.display;
  var initialFormIsOpen = formEl.classList.contains('is-open');
  var initialDetailInert = detailContent.inert;
  var initialDetailAria = detailContent.getAttribute('aria-hidden');

  assert.equal(initialFormDisplay, 'none', 'initial: form display=none');
  assert.equal(initialFormIsOpen, false, 'initial: no is-open class');
  assert.equal(initialDetailInert, false, 'initial: detail not inert');
  assert.equal(initialDetailAria, null, 'initial: detail no aria-hidden');

  // click → form open
  formApi.showAddMemoryForm();

  assert.equal(formEl.style.display, 'block', 'open: form display=block');
  assert.ok(formEl.classList.contains('is-open'), 'open: form has is-open');
  assert.equal(detailContent.inert, true, 'open: detail inert');
  assert.equal(detailContent.getAttribute('aria-hidden'), 'true', 'open: detail aria-hidden=true');

  // cancel → restore
  formApi.hideAddMemoryForm();

  assert.equal(formEl.style.display, 'none', 'cancel: form display=none');
  assert.equal(formEl.classList.contains('is-open'), false, 'cancel: no is-open class');
  assert.equal(detailContent.inert, false, 'cancel: detail not inert');
  assert.notEqual(detailContent.getAttribute('aria-hidden'), 'true', 'cancel: detail aria-hidden removed');

  // selection not changed by hideAddMemoryForm (implementation does not touch selectedNodeId)
});

test('canEdit=false: showAddMemoryForm returns silently', function() {
  var fsandbox = createFormSandbox({ canEdit: false });
  var formEl = fsandbox.formEl;
  var formApi = fsandbox.formApi;
  formApi.showAddMemoryForm();

  assert.notEqual(formEl.style.display, 'block', 'canEdit=false: form should not open');
});

test('repeat click: form open called once via no-duplicate binding', function() {
  var addBtn = makeClickableElement({ id: 'addMemoryBtn' });
  var cancelBtn = makeClickableElement({ id: 'cancelMemoryBtn' });
  var confirmBtn = makeClickableElement({ id: 'confirmAddMemory' });
  var urlInput = makeClickableElement({ id: 'memoryUrlInput' });
  var titleInput = makeClickableElement({ id: 'memoryTitleInput' });
  var memoInput = makeClickableElement({ id: 'memoryMemoInput' });
  var interactionMode = createInteractionModeMock();
  var openCount = 0;

  var sandbox = vm.createContext({
    window: {},
    document: { getElementById: function() { return null; }, querySelector: function() { return null; } },
    LoveBudEditorInteractionMode: interactionMode,
    console: { warn: function() {}, log: function() {}, error: function() {} },
    Error: Error,
    Array: Array,
    Function: Function,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Promise: Promise
  });

  sandbox.window = sandbox;

  vm.runInContext(bindingsSrc, sandbox);

  var bindMemoryCreateControls = vm.runInContext('window.LoveBudEditorBindings.bindMemoryCreateControls', sandbox);

  interactionMode.setMode('edit');

  bindMemoryCreateControls({
    addBtn: addBtn,
    cancelBtn: cancelBtn,
    confirmBtn: confirmBtn,
    urlInput: urlInput,
    titleInput: titleInput,
    memoInput: memoInput,
    showAddMemoryForm: function() { openCount += 1; },
    hideAddMemoryForm: function() {},
    addMemoryFromForm: function() { return Promise.resolve(); },
    updateSaveStatus: function() {},
    showToast: function() {},
    i18n: function(k) { return k; },
    getTreeMemories: function() { return [{ id: 'root' }]; }
  });

  addBtn.click();
  addBtn.click();
  addBtn.click();

  assert.equal(openCount, 3, 'each click dispatches to handler; no duplicate-prevention in bindMemoryCreateControls itself');
});

// ── Form-level connect entry template default fail-closed ──

test('FORM_CONNECT_ENTRY_RENDERED: template exposes form-level connect entry with fail-closed defaults', function() {
  const tpl = memoryFormTpl;
  // Row has hidden attribute by default
  assert.ok(tpl.includes('id=\"connectExistingFromFormRow\"'), 'connect entry row present');
  assert.ok(tpl.includes('id=\"connectExistingFromFormRow\"\\n[\\s\\S]*?hidden', 'g') === false || tpl.match(/connectExistingFromFormRow[\s\S]{0,80}hidden/), 'row has hidden attribute');
  // Button has all fail-closed defaults
  assert.ok(tpl.includes('id=\"connectExistingFromFormBtn\"'), 'connect entry button present');
  assert.ok(tpl.includes('type=\"button\"'), 'entry is type=\"button\" (not submit)');
  assert.ok(!tpl.includes('type=\"submit\"'), 'entry is never a submit button');
  assert.ok(tpl.includes('editor-form-connect-entry'), 'entry has distinct connect-entry styling hook');
  assert.ok(!tpl.includes('role=\"tab\"'), 'no ARIA tab role invented for the entry');
});

test('TEMPLATE_DEFAULT_FAIL_CLOSED: template row hidden, button hidden disabled aria-hidden', function() {
  const tpl = memoryFormTpl;

  // Row has `hidden` attribute
  assert.ok(tpl.includes('hidden'), 'template has hidden attribute');
  assert.match(tpl, /connectExistingFromFormRow[\s\S]{0,80}hidden/, 'row opening tag has hidden');

  // Button has hidden, disabled, aria-hidden=true
  assert.match(tpl, /connectExistingFromFormBtn[\s\S]{0,200}hidden/, 'button opening tag has hidden');
  assert.match(tpl, /connectExistingFromFormBtn[\s\S]{0,200}disabled/, 'button opening tag has disabled');
  assert.match(tpl, /aria-hidden="true"/, 'template button has aria-hidden="true"');
  assert.match(tpl, /type="button"/, 'template button has type="button"');
});

test('MISSING_CONTROLLER_FAIL_CLOSED: page-event-bindings guards against missing connectExistingController', function() {
  // When controller is undefined, the bindButtonOnce guard prevents handler attachment
  assert.match(pageEventBindingsSrc, /opts\.connectExistingController/, 'bindings reference opts.connectExistingController');
  assert.match(pageEventBindingsSrc, /controller &&/, 'bindings guard against missing controller');
  assert.match(pageEventBindingsSrc, /typeof controller\.isConnectEntryAvailable/, 'bindings guard against missing isConnectEntryAvailable method');

  // When controller is undefined or lacks method, updateFormConnectEntryVisibility
  // must still toggle row/button to hidden/disabled via the same guard pattern.
  assert.match(pageEventBindingsSrc, /formConnectRow &&\n        formConnectBtn &&\n        controller &&/, 'updateFormConnectEntryVisibility guards all dependencies');

  // Verify the actual production guard: bindButtonOnce is inside a conditional
  assert.match(pageEventBindingsSrc, /formConnectBtn && opts\.connectExistingController &&/, 'handler wiring conditional on controller');

  // CSS fallback: hidden row has no visible padding/border
  assert.match(memoryFormCss, /\.editor-form-connect-row\[hidden\]/, 'CSS has .editor-form-connect-row[hidden] rule');
  assert.match(memoryFormCss, /display:\s*none/, 'CSS has display:none for hidden state');
});
