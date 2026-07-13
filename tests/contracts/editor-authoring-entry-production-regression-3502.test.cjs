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
const modeSelectionCss = fs.readFileSync(path.join(ROOT, 'css/editor/editor-mode-selection.css'), 'utf8');

// ── Source contracts ───────────────────────────────────────────────

test('CSS restores add-section only with edit mode selector', () => {
  const match = editorCss.match(/body:not\(\.editor-readonly\)\[data-editor-interaction-mode="edit"\] \.editor-add-section-bottom/);
  assert.ok(match, 'CSS must gate add-section by editor-readonly + interaction-mode=edit');
});

test('CSS does not use overly broad selector without interaction mode', () => {
  const bare = editorCss.match(/body:not\(\.editor-readonly\) \.editor-add-section-bottom\b/);
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

// ── Executed sandbox: syncSidebarAuthoringEntryState ────────

function makeMockElement(overrides) {
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
      remove(name) { this._classes = this._classes.filter(c => c !== name); },
      contains(name) { return this._classes.includes(name); }
    },
    getAttribute(name) { return this.dataset[name] || null; },
    setAttribute(name, value) { this.dataset[name] = String(value); },
    removeAttribute(name) { delete this.dataset[name]; },
    addEventListener() {},
    click() {},
    dispatchEvent() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(c) { return c; },
    insertBefore(c, r) { return c; },
    remove() {},
    focus() {}
  }, overrides);
}

function createSyncFnSource() {
  const fnSource = editorJs.match(/function syncSidebarAuthoringEntryState[\s\S]*?\n\s{20}\}/);
  if (!fnSource) throw new Error('Could not extract syncSidebarAuthoringEntryState from editor.js');
  return '(function() {\n' + fnSource[0] + '\nreturn syncSidebarAuthoringEntryState;\n})()';
}

test('syncSidebarAuthoringEntryState: owner edit mode makes section accessible', () => {
  const section = makeMockElement({ className: 'editor-add-section editor-add-section-bottom' });
  const button = makeMockElement({ id: 'addMemoryBtn' });

  const doc = {
    querySelector(sel) {
      if (sel === '.editor-add-section-bottom') return section;
      return null;
    },
    getElementById(id) {
      if (id === 'addMemoryBtn') return button;
      return null;
    }
  };

  const ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn() {}, log() {}, error() {} }
  });

  const syncFn = vm.runInContext(createSyncFnSource(), ctx);

  // owner + edit
  syncFn(true);

  assert.equal(section.getAttribute('aria-hidden'), 'false', 'edit mode: section aria-hidden=false');
  assert.equal(button.tabIndex, 0, 'edit mode: button tabindex=0');
  assert.equal(button.disabled, false, 'edit mode: button not disabled');
});

test('syncSidebarAuthoringEntryState: owner view mode hides section', () => {
  const section = makeMockElement({ className: 'editor-add-section editor-add-section-bottom' });
  const button = makeMockElement({ id: 'addMemoryBtn' });

  const doc = {
    querySelector(sel) {
      if (sel === '.editor-add-section-bottom') return section;
      return null;
    },
    getElementById(id) {
      if (id === 'addMemoryBtn') return button;
      return null;
    }
  };

  const ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn() {}, log() {}, error() {} }
  });

  const syncFn = vm.runInContext(createSyncFnSource(), ctx);

  // owner + view
  syncFn(false);

  assert.equal(section.getAttribute('aria-hidden'), 'true', 'view mode: section aria-hidden=true');
  assert.equal(button.tabIndex, -1, 'view mode: button tabindex=-1');
  assert.equal(button.disabled, true, 'view mode: button disabled');
});

test('syncSidebarAuthoringEntryState: elements missing does not throw', () => {
  const doc = {
    querySelector() { return null; },
    getElementById() { return null; }
  };

  const ctx = vm.createContext({
    document: doc,
    effectiveCanEdit: true,
    console: { warn() {}, log() {}, error() {} }
  });

  const syncFn = vm.runInContext(createSyncFnSource(), ctx);
  assert.doesNotThrow(() => syncFn(true));
  assert.doesNotThrow(() => syncFn(false));
});

// ── Executed DOM: showAddMemoryForm lifecycle ───────────────

function createFormSandbox(canEdit) {
  const formEl = makeMockElement({
    id: 'addMemoryForm',
    style: { display: 'none' },
    classList: {
      _classes: [],
      add(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove(name) { this._classes = this._classes.filter(c => c !== name); },
      contains(name) { return this._classes.includes(name); },
      toggle(name, force) {
        if (force === true) { this.add(name); return true; }
        if (force === false) { this.remove(name); return false; }
        const idx = this._classes.indexOf(name);
        if (idx >= 0) { this._classes.splice(idx, 1); return false; }
        this._classes.push(name); return true;
      }
    },
    closest(sel) {
      if (sel === '.canvas-area') return canvasArea;
      if (sel === '.editor-layout') return editorLayout;
      return null;
    },
    contains() { return false; }
  });

  const canvasArea = makeMockElement({
    id: 'canvasArea',
    classList: { _classes: [], add() {}, remove() {}, contains() { return false; }, toggle(name, force) { return !!force; } }
  });

  const editorLayout = makeMockElement({
    className: 'editor-layout',
    classList: {
      _classes: [],
      add(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove(name) { this._classes = this._classes.filter(c => c !== name); },
      contains(name) { return this._classes.includes(name); },
      toggle(name, force) {
        if (force === true) { this.add(name); return true; }
        if (force === false) { this.remove(name); return false; }
        return false;
      }
    }
  });

  const detailContent = makeMockElement({
    id: 'detailContent',
    inert: false
  });

  const canvasTopbar = makeMockElement({});
  const canvasEmptyGuide = makeMockElement({
    id: 'canvasEmptyGuide',
    classList: {
      _classes: [],
      add(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove(name) { this._classes = this._classes.filter(c => c !== name); },
      contains(name) { return this._classes.includes(name); },
      toggle(name, force) {
        if (force === true) { this.add(name); return true; }
        if (force === false) { this.remove(name); return false; }
        return false;
      }
    }
  });

  const toolbar = makeMockElement({ className: 'editor-floating-toolbar' });

  const elementMap = {
    addMemoryForm: formEl,
    detailContent: detailContent,
    canvasEmptyGuide: canvasEmptyGuide,
    memoryUrlInput: makeMockElement({ id: 'memoryUrlInput', value: '' }),
    memoryTitleInput: makeMockElement({ id: 'memoryTitleInput', value: '' }),
    memoryMemoInput: makeMockElement({ id: 'memoryMemoInput', value: '' }),
    memoryUrlField: makeMockElement({ id: 'memoryUrlField' }),
    memoryModeLinkBtn: makeMockElement({ id: 'memoryModeLinkBtn' }),
    memoryModeTextBtn: makeMockElement({ id: 'memoryModeTextBtn' }),
    memoryFormSupportNoteText: makeMockElement({ id: 'memoryFormSupportNoteText' }),
    memoryStartTimeField: makeMockElement({ id: 'memoryStartTimeField' }),
    memoryVideoSegmentGrid: makeMockElement({ id: 'memoryVideoSegmentGrid' }),
    memoryStartTimeInput: makeMockElement({ id: 'memoryStartTimeInput', value: '' }),
    memoryStartTimeHint: makeMockElement({ id: 'memoryStartTimeHint' }),
    memoryEndTimeInput: makeMockElement({ id: 'memoryEndTimeInput', value: '' }),
    canvasEmptyGuide: canvasEmptyGuide,
    addMemoryFormEyebrow: makeMockElement({ id: 'addMemoryFormEyebrow' }),
    addMemoryFormTitle: makeMockElement({ id: 'addMemoryFormTitle' }),
    addMemoryFormIntro: makeMockElement({ id: 'addMemoryFormIntro' }),
    memoryUrlLabel: makeMockElement({ id: 'memoryUrlLabel' }),
    memoryTitleLabel: makeMockElement({ id: 'memoryTitleLabel' }),
    memoryTagsInput: makeMockElement({ id: 'memoryTagsInput', value: '' }),
    memoryTagsLabel: makeMockElement({ id: 'memoryTagsLabel' }),
    memoryMemoLabel: makeMockElement({ id: 'memoryMemoLabel' }),
    confirmAddMemory: makeMockElement({ id: 'confirmAddMemory' }),
    memoryLinkPreview: makeMockElement({ id: 'memoryLinkPreview', classList: { _classes: [], add() {}, remove() {}, contains() { return false; }, toggle() { return false; } } }),
    memoryPreviewThumb: makeMockElement({ id: 'memoryPreviewThumb' }),
    memoryPreviewBadge: makeMockElement({ id: 'memoryPreviewBadge' }),
    memoryPreviewTitle: makeMockElement({ id: 'memoryPreviewTitle' }),
    memoryPreviewHint: makeMockElement({ id: 'memoryPreviewHint' }),
    editorMemoryFormContext: null
  };

  const memoryFormContext = makeMockElement({ className: 'editor-memory-form-modal' });

  const doc = {
    getElementById(id) {
      return elementMap[id] || null;
    },
    querySelector(sel) {
      if (sel === '.editor-canvas-topbar') return canvasTopbar;
      if (sel === '#memoryLinkPreview .memory-link-preview__thumb-wrap') return makeMockElement({});
      if (sel === '#memoryLinkPreview .memory-link-preview__play-icon') return makeMockElement({});
      if (sel === '#memoryLinkPreview .memory-link-preview__body') return makeMockElement({});
      if (sel === '.editor-floating-toolbar') return toolbar;
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
    createElement() { return makeMockElement({}); }
  };

  const HelperRecord = {
    createEditorMemoryFormMode: {
      setInputMode(opts) { return 'link'; }
    },
    createEditorMemoryFormPreview: {
      hide() {},
      update() {}
    },
    createEditorMemoryFormTime: {
      autofillStartFromUrl() {}
    },
    createEditorMemoryFormPayload: null,
    createEditorMemoryFormSave: function() {
      return {
        enrichPayloadChannelMetadata: async (p) => p,
        createMemoryWithFallback: async (p) => ({ createdMemory: { id: 'new-root' }, useApi: false }),
        commitMemoryToTree() {}
      };
    }
  };

  const sandbox = vm.createContext({
    window: {},
    document: doc,
    console: { warn() {}, log() {}, error() {}, debug() {} },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
    requestAnimationFrame: (fn) => fn(),
    URLSearchParams: () => ({ get: () => null }),
    LoveBudEditorMemoryFormMode: HelperRecord.createEditorMemoryFormMode,
    LoveBudEditorMemoryFormPreview: HelperRecord.createEditorMemoryFormPreview,
    LoveBudEditorMemoryFormTime: HelperRecord.createEditorMemoryFormTime,
    LoveBudEditorMemoryFormSave: HelperRecord.createEditorMemoryFormSave,
    LoveBudEditorMemoryFormPayload: null,
    LoveBudEditorInteractionMode: null,
    LoveBudCache: null,
    LoveBudNormalize: null,
    currentTreeMemories: [],
    currentTreeData: null,
    setCachedMemories() {},
    refreshMemories() {},
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

  const deps = {
    i18n(key) { return key; },
    treeId: 'test-tree-id',
    getSelectedNodeId() { return 'root'; },
    getCanonicalRootId() { return 'root'; },
    resolveParentIdForCreate() { return 'root'; },
    updateSaveStatus() {},
    showToast() {},
    getYouTubeInputErrorMessage() { return null; },
    nextMemoryId: () => 'mem-2',
    normalizeMemory(m) { return m; },
    getTreeMemories() { return [{ id: 'root', title: 'First' }]; },
    setTreeMemories() {},
    setLocalSaveMode() {},
    drawNode() {},
    drawBranch() {},
    calcPosition() {},
    updateSidebarStatus() {},
    updateFocusSelectedBtn() {},
    setDetailEmptyState() {},
    selectNode() {},
    treeMemories: () => [{ id: 'root', title: 'First' }],
    setCachedMemories() {},
    canvasArea: canvasArea,
    rerenderCanvas() {},
    focusNodeById() {},
    canEdit: canEdit !== false
  };

  vm.runInContext(memoryFormSrc, sandbox);

  const formApi = vm.runInContext('window.createEditorMemoryForm(deps)', Object.assign(sandbox, { deps }));

  return { sandbox, doc, formEl, detailContent, formApi };
}

test('showAddMemoryForm opens form and gates detail/toolbar', () => {
  const { formEl, detailContent, formApi } = createFormSandbox(true);

  formApi.showAddMemoryForm();

  assert.equal(formEl.style.display, 'block', 'form display should be block');
  assert.ok(formEl.classList.contains('is-open'), 'form should have is-open class');
  assert.equal(detailContent.getAttribute('aria-hidden'), 'true', 'detail should be aria-hidden');
  assert.equal(detailContent.inert, true, 'detail should be inert');
});

test('showAddMemoryForm canEdit=false returns silently', () => {
  const { formEl, formApi } = createFormSandbox(false);

  formApi.showAddMemoryForm();

  assert.notEqual(formEl.style.display, 'block', 'form should not open when canEdit is false');
});
