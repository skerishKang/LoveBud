const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function createMockElement(id) {
  var listeners = {};
  return {
    id: id,
    style: {},
    dataset: {},
    classList: {
      _classes: [],
      add: function(name) { if (!this._classes.includes(name)) this._classes.push(name); },
      remove: function(name) { this._classes = this._classes.filter(function(c) { return c !== name; }); },
      contains: function(name) { return this._classes.includes(name); }
    },
    disabled: false,
    textContent: '',
    innerHTML: '',
    tabIndex: 0,
    addEventListener: function(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    click: function() {
      if (!listeners['click']) return;
      var event = { preventDefault: function() {}, stopPropagation: function() {} };
      listeners['click'].forEach(function(fn) { fn(event); });
    },
    dispatchEvent: function() {},
    closest: function() { return null; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getAttribute: function(name) { return this.dataset[name]; },
    setAttribute: function(name, value) { this.dataset[name] = value; },
    appendChild: function(child) { return child; },
    insertBefore: function(child, ref) { return child; },
    remove: function() {},
    parentElement: null,
    parentNode: null,
    nextSibling: null
  };
}

function createContext(elements) {
  var doc = {
    getElementById: function(id) {
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].id === id) return elements[i];
      }
      return null;
    },
    createElement: function() { return createMockElement('dummy'); },
    createTextNode: function() { return {}; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: { setAttribute: function() {}, getAttribute: function() { return null; }, dataset: {} },
    documentElement: { dataset: {} },
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  var ctx = vm.createContext({
    window: {},
    document: doc,
    console: { error: function() {}, log: function() {}, warn: function() {} }
  });

  return ctx;
}

function loadInteractionMode(ctx) {
  vm.runInContext(fs.readFileSync('js/editor/editor-interaction-mode.js', 'utf8'), ctx);
  return ctx.window.LoveBudEditorInteractionMode;
}

function loadBindings(ctx) {
  vm.runInContext(fs.readFileSync('js/editor/editor-bindings.js', 'utf8'), ctx);
  return ctx.window.LoveBudEditorBindings;
}

// ── editable empty tree → default view mode → CTA → edit mode → form open ──

test('empty tree view mode: click addBtn switches to edit mode and calls showAddMemoryForm', function() {
  var addBtn = createMockElement('addMemoryBtn');
  var ctx = createContext([addBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var showCalled = false;
  bindings.bindMemoryCreateControls({
    addBtn: addBtn,
    showAddMemoryForm: function() { showCalled = true; },
    addMemoryFromForm: function() { return Promise.resolve(); },
    getTreeMemories: function() { return []; }
  });

  assert.equal(mode.isEditMode(), false, 'initial mode should be view');
  addBtn.click();
  assert.equal(mode.isEditMode(), true, 'mode should switch to edit after clicking add on empty tree');
  assert.equal(showCalled, true, 'showAddMemoryForm should be called');
});

test('empty tree view mode: click confirmBtn switches to edit mode and calls addMemoryFromForm', function() {
  var confirmBtn = createMockElement('confirmAddMemory');
  var ctx = createContext([confirmBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var formCalled = false;
  bindings.bindMemoryCreateControls({
    confirmBtn: confirmBtn,
    addMemoryFromForm: function() { formCalled = true; return Promise.resolve(); },
    getTreeMemories: function() { return []; }
  });

  assert.equal(mode.isEditMode(), false, 'initial mode should be view');
  confirmBtn.click();
  assert.equal(mode.isEditMode(), true, 'mode should switch to edit after confirm on empty tree');
  assert.equal(formCalled, true, 'addMemoryFromForm should be called');
});

test('empty tree view mode: detailEmptyStartBtn switches to edit mode and calls showAddMemoryForm', function() {
  var startBtn = createMockElement('detailEmptyStartBtn');
  var ctx = createContext([startBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var showCalled = false;
  bindings.bindDetailEmptyStartButton({
    showAddMemoryForm: function() { showCalled = true; },
    getTreeMemories: function() { return []; }
  });

  assert.equal(mode.isEditMode(), false, 'initial mode should be view');
  startBtn.click();
  assert.equal(mode.isEditMode(), true, 'mode should switch to edit after CTA on empty tree');
  assert.equal(showCalled, true, 'showAddMemoryForm should be called');
});

test('empty tree view mode: memoInput Enter switches to edit mode and calls addMemoryFromForm', function() {
  var memoInput = createMockElement('memoryMemoInput');
  var ctx = createContext([memoInput]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var formCalled = false;
  bindings.bindMemoryCreateControls({
    memoInput: memoInput,
    addMemoryFromForm: function() { formCalled = true; return Promise.resolve(); },
    getTreeMemories: function() { return []; }
  });

  assert.equal(mode.isEditMode(), false, 'initial mode should be view');

  var enterEvent = { key: 'Enter', shiftKey: false, preventDefault: function() {} };
  var keypressListeners = [];
  var origAddEventListener = memoInput.addEventListener;
  memoInput.addEventListener = function(type, fn) {
    if (type === 'keypress') { keypressListeners.push(fn); return; }
    origAddEventListener.call(memoInput, type, fn);
  };
  bindings.bindMemoryCreateControls({
    memoInput: memoInput,
    addMemoryFromForm: function() { formCalled = true; return Promise.resolve(); },
    getTreeMemories: function() { return []; }
  });
  keypressListeners.forEach(function(fn) { fn(enterEvent); });

  assert.equal(mode.isEditMode(), true, 'mode should switch to edit after Enter on empty tree');
  assert.equal(formCalled, true, 'addMemoryFromForm should be called');
});

// ── editable non-empty tree + view mode → 일반 add action이 자동 edit으로 바뀌지 않음 ──

test('non-empty tree view mode: addBtn does not switch to edit mode', function() {
  var addBtn = createMockElement('addMemoryBtn');
  var ctx = createContext([addBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var showCalled = false;
  bindings.bindMemoryCreateControls({
    addBtn: addBtn,
    showAddMemoryForm: function() { showCalled = true; },
    addMemoryFromForm: function() { return Promise.resolve(); },
    getTreeMemories: function() { return [{ id: 'root', title: 'Existing' }]; }
  });

  addBtn.click();
  assert.equal(mode.isEditMode(), false, 'view mode preserved for non-empty tree');
  assert.equal(showCalled, false, 'showAddMemoryForm should not be called');
});

test('non-empty tree view mode: confirmBtn does not switch to edit mode', function() {
  var confirmBtn = createMockElement('confirmAddMemory');
  var ctx = createContext([confirmBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var formCalled = false;
  bindings.bindMemoryCreateControls({
    confirmBtn: confirmBtn,
    addMemoryFromForm: function() { formCalled = true; return Promise.resolve(); },
    getTreeMemories: function() { return [{ id: 'root', title: 'Existing' }]; }
  });

  confirmBtn.click();
  assert.equal(mode.isEditMode(), false, 'view mode preserved for non-empty tree');
  assert.equal(formCalled, false, 'addMemoryFromForm should not be called');
});

// ── read-only empty tree → CTA/confirm이 생성 경로를 열거나 mode를 승격하지 않음 ──

test('read-only empty tree: addBtn does not promote when interaction mode is absent', function() {
  var addBtn = createMockElement('addMemoryBtn');

  var doc = {
    getElementById: function(id) { return id === 'addMemoryBtn' ? addBtn : null; },
    createElement: function() { return createMockElement('dummy'); },
    createTextNode: function() { return {}; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: { setAttribute: function() {}, getAttribute: function() { return null; }, dataset: {} },
    documentElement: { dataset: {} },
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  var ctx = vm.createContext({
    window: {},
    document: doc,
    console: { error: function() {}, log: function() {}, warn: function() {} }
  });

  vm.runInContext(fs.readFileSync('js/editor/editor-bindings.js', 'utf8'), ctx);
  var bindings = ctx.window.LoveBudEditorBindings;

  var showCalled = false;
  bindings.bindMemoryCreateControls({
    addBtn: addBtn,
    showAddMemoryForm: function() { showCalled = true; },
    addMemoryFromForm: function() { return Promise.resolve(); },
    getTreeMemories: function() { return []; }
  });

  addBtn.click();
  assert.equal(showCalled, false, 'without interaction mode, showAddMemoryForm should not be called');
});

test('read-only empty tree: detailEmptyStartBtn does not promote when interaction mode is absent', function() {
  var startBtn = createMockElement('detailEmptyStartBtn');

  var doc = {
    getElementById: function(id) { return id === 'detailEmptyStartBtn' ? startBtn : null; },
    createElement: function() { return createMockElement('dummy'); },
    createTextNode: function() { return {}; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: { setAttribute: function() {}, getAttribute: function() { return null; }, dataset: {} },
    documentElement: { dataset: {} },
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  var ctx = vm.createContext({
    window: {},
    document: doc,
    console: { error: function() {}, log: function() {}, warn: function() {} }
  });

  vm.runInContext(fs.readFileSync('js/editor/editor-bindings.js', 'utf8'), ctx);
  var bindings = ctx.window.LoveBudEditorBindings;

  var showCalled = false;
  bindings.bindDetailEmptyStartButton({
    showAddMemoryForm: function() { showCalled = true; },
    getTreeMemories: function() { return []; }
  });

  startBtn.click();
  assert.equal(showCalled, false, 'without interaction mode, showAddMemoryForm should not be called');
});

// ── view ↔ edit toggle → 항상 반대 mode 버튼을 클릭 가능 ──

test('editor.js toggle: view mode disables view button, enables edit button', function() {
  var ctx = createContext([]);
  var mode = loadInteractionMode(ctx);

  mode.setMode(mode.MODE_VIEW);

  var viewBtn = createMockElement('editorModeViewBtn');
  var editBtn = createMockElement('editorModeEditBtn');

  var isEdit = mode.isEditMode();
  viewBtn.disabled = !isEdit;
  editBtn.disabled = isEdit;

  assert.equal(viewBtn.disabled, true, 'view btn should be disabled in view mode');
  assert.equal(editBtn.disabled, false, 'edit btn should be enabled in view mode');
});

test('editor.js toggle: edit mode enables view button, disables edit button', function() {
  var ctx = createContext([]);
  var mode = loadInteractionMode(ctx);

  mode.setMode(mode.MODE_EDIT);

  var viewBtn = createMockElement('editorModeViewBtn');
  var editBtn = createMockElement('editorModeEditBtn');

  var isEdit = mode.isEditMode();
  viewBtn.disabled = !isEdit;
  editBtn.disabled = isEdit;

  assert.equal(viewBtn.disabled, false, 'view btn should be enabled in edit mode');
  assert.equal(editBtn.disabled, true, 'edit btn should be disabled in edit mode');
});

test('editor.js toggle: user can switch modes via interaction mode API', function() {
  var ctx = createContext([]);
  var mode = loadInteractionMode(ctx);

  mode.setMode(mode.MODE_VIEW);
  assert.equal(mode.isEditMode(), false, 'should start in view mode');

  mode.setMode(mode.MODE_EDIT);
  assert.equal(mode.isEditMode(), true, 'should switch to edit mode');

  mode.setMode(mode.MODE_VIEW);
  assert.equal(mode.isEditMode(), false, 'should switch back to view mode');
});

// ── fallback: without getTreeMemories, view mode stays ──

test('view mode: add action preserves view mode when getTreeMemories is not provided', function() {
  var addBtn = createMockElement('addMemoryBtn');
  var ctx = createContext([addBtn]);
  var mode = loadInteractionMode(ctx);
  var bindings = loadBindings(ctx);

  mode.setMode(mode.MODE_VIEW);

  var showCalled = false;
  bindings.bindMemoryCreateControls({
    addBtn: addBtn,
    showAddMemoryForm: function() { showCalled = true; },
    addMemoryFromForm: function() { return Promise.resolve(); }
  });

  addBtn.click();
  assert.equal(mode.isEditMode(), false, 'view mode preserved when getTreeMemories absent');
  assert.equal(showCalled, false, 'showAddMemoryForm should not be called');
});
