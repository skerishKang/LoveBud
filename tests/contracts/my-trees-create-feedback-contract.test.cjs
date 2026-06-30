const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../../');

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

// ─── Minimal Fake DOM ──────────────────────────────────────────
function createFakeDocument() {
  var elements = new Map();
  var handlers = {};

  var doc = {
    _elements: elements,
    _handlers: handlers,
    getElementById: function(id) { return elements.get(id) || null; },
    createElement: function(tagName) { return createFakeElement(tagName, null); },
    createTextNode: function(text) { return { nodeType: 3, textContent: String(text) }; },
    querySelector: function(sel) {
      if (sel === '.my-trees-dashboard-grid-shell') return createFakeElement('div', null);
      if (sel === '#sortTreesSelect') return null;
      if (sel === '.create-tree-visibility') {
        var vis = createFakeElement('div', null);
        vis.className = 'create-tree-visibility';
        vis._closestField = createFakeElement('div', null);
        vis._closestField.className = 'create-tree-field';
        return vis;
      }
      return null;
    },
    addEventListener: function(type, handler) { handlers[type] = handler; },
    removeEventListener: function() {},
    dispatchEvent: function() {},
    body: createFakeElement('body', null),
    head: createFakeElement('head', null),
    createEvent: function() { return { initEvent: function() {} }; },
    activeElement: { focus: function() {}, select: function() {} }
  };
  doc.body.ownerDocument = doc;
  doc.head.ownerDocument = doc;
  return doc;
}

function createFakeElement(tagName, id) {
  var listeners = {};
  var children = [];
  var attributes = {};
  var classList = {
    _items: [],
    add: function(c) { if (!classList._items.includes(c)) classList._items.push(c); },
    remove: function(c) { classList._items = classList._items.filter(function(x) { return x !== c; }); },
    contains: function(c) { return classList._items.includes(c); },
    toggle: function(c) { if (classList.contains(c)) classList.remove(c); else classList.add(c); }
  };

  var el = {
    tagName: tagName,
    id: id || null,
    nodeType: 1,
    children: children,
    classList: classList,
    className: '',
    style: {},
    disabled: false,
    textContent: '',
    value: '',
    innerHTML: '',
    _listeners: listeners,
    _attributes: attributes,
    _parent: null,
    ownerDocument: null,
    ownerSVGElement: null,

    getAttribute: function(name) { return attributes[name] !== undefined ? String(attributes[name]) : null; },
    setAttribute: function(name, value) { attributes[name] = String(value); },
    removeAttribute: function(name) { delete attributes[name]; },

    appendChild: function(child) {
      children.push(child);
      child._parent = el;
      return child;
    },

    replaceChildren: function() { children.length = 0; },

    addEventListener: function(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },

    removeEventListener: function(type, handler) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter(function(h) { return h !== handler; });
    },

    dispatchEvent: function(event) {
      (listeners[event.type] || []).forEach(function(h) { h(event); });
    },

    focus: function() {},
    select: function() {},

    querySelector: function(sel) {
      if (sel === '.create-tree-visibility') return el._createTreeVisibility || null;
      return null;
    },

    closest: function(sel) {
      if (sel === '.create-tree-field') return el._closestField || null;
      return null;
    }
  };
  return el;
}

function createFakeEvent(type) {
  return {
    type: type,
    defaultPrevented: false,
    stopPropagation: function() {},
    preventDefault: function() { this.defaultPrevented = true; },
    key: '',
    target: null
  };
}

function setupDefaultElements(doc) {
  var ids = [
    'createTreeModalBackdrop', 'createTreeModalForm', 'createTreeTitleInput',
    'createTreeModalError', 'createTreeModalCancelBtn', 'createTreeModalCloseBtn',
    'createTreeModalSubmitBtn', 'headerCreateTreeBtn', 'createTreeBtn'
  ];
  var tagMap = {
    'createTreeModalForm': 'form',
    'createTreeTitleInput': 'input'
  };
  ids.forEach(function(id) {
    var tag = tagMap[id] || (id.endsWith('Btn') ? 'button' : 'div');
    var el = createFakeElement(tag, id);
    doc._elements.set(id, el);
    el.ownerDocument = doc;
  });

  var form = doc._elements.get('createTreeModalForm');
  var submitBtn = doc._elements.get('createTreeModalSubmitBtn');
  submitBtn._form = form;
  doc._elements.get('createTreeModalSubmitBtn')._form = form;
}

function fireDOMContentLoaded(win) {
  if (win.document._handlers.DOMContentLoaded) {
    win.document._handlers.DOMContentLoaded();
  }
}

function createContextifiedWindow(docOnly) {
  var doc = createFakeDocument();
  setupDefaultElements(doc);
  var location = { _h: 'http://localhost/' };
  Object.defineProperty(location, 'href', {
    get: function() { return location._h; },
    set: function(v) { location._h = String(v); },
    configurable: true, enumerable: true
  });
  location.replace = function(url) { location.href = url; };

  var win = {
    window: null, self: null, globalThis: null, document: doc,
    location: location, top: null, parent: null,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    console: console, Math: Math, Date: Date, JSON: JSON,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    String: String, Array: Array, Object: Object, Boolean: Boolean,
    Number: Number, Promise: Promise, Error: Error, parseInt: parseInt,
    parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, RegExp: RegExp,
    Event: function(type) { return createFakeEvent(type); },
    CustomEvent: function(type) { return createFakeEvent(type); },
    localStorage: (function() {
      var store = {};
      return { getItem: function(k) { return store[k] !== undefined ? store[k] : null; },
               setItem: function(k, v) { store[k] = String(v); },
               removeItem: function(k) { delete store[k]; } };
    })(),
    t: function(k) { return k; },
    LoveBudUI: { showToast: function() {} },
    LoveBudMyTreesPage: { setState: function() {}, STATE: {} },
    LoveBudMyTreesData: { loadTrees: function() {} },
    getConfirmedAuthUser: function() { return { uid: 'user123' }; },
    _redirectUrl: ''
  };
  win.window = win;
  win.self = win;
  win.top = win;
  win.parent = win;
  win.globalThis = win;

  if (!docOnly) {
    vm.createContext(win);
  }
  return win;
}

function loadActionsScript(win) {
  vm.runInContext(read('js/my-trees/my-trees-actions.js'), win);
}

function loadPageScript(win) {
  vm.runInContext(read('js/my-trees.js'), win);
}

function setupSlowApi(win, delay) {
  win.apiClient = {
    createTree: function() {
      return new Promise(function(resolve) {
        setTimeout(function() { resolve({ id: 't1' }); }, delay || 100);
      });
    }
  };
}

// ─── Tests ─────────────────────────────────────────────────

test('warm module rapid header+empty click -> create 1회', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);
  setupSlowApi(win, 50);
  fireDOMContentLoaded(win);

  var callCount = 0;
  var origCreate = win.LoveBudMyTreesActions.createNewTree;
  win.LoveBudMyTreesActions.createNewTree = function(opts) {
    callCount++;
    return origCreate.call(win.LoveBudMyTreesActions, opts);
  };

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var emptyBtn = win.document.getElementById('createTreeBtn');

  headerBtn.dispatchEvent(createFakeEvent('click'));
  emptyBtn.dispatchEvent(createFakeEvent('click'));
  headerBtn.dispatchEvent(createFakeEvent('click'));
  emptyBtn.dispatchEvent(createFakeEvent('click'));

  // Wait for modal to open
  await new Promise(function(r) { setTimeout(r, 50); });

  // Close modal to let create proceed
  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  if (backdrop && backdrop.classList.contains('show')) {
    var cancelBtn = win.document.getElementById('createTreeModalCancelBtn');
    cancelBtn.dispatchEvent(createFakeEvent('click'));
  }

  await new Promise(function(r) { setTimeout(r, 200); });
  assert.strictEqual(callCount, 1, 'Should only create one tree despite rapid clicks');
});

test('delayed module rapid header+empty click -> create 1회', async function(t) {
  var win = createContextifiedWindow();
  loadPageScript(win);
  setupSlowApi(win, 50);
  fireDOMContentLoaded(win);

  var callCount = 0;

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var emptyBtn = win.document.getElementById('createTreeBtn');

  headerBtn.dispatchEvent(createFakeEvent('click'));
  emptyBtn.dispatchEvent(createFakeEvent('click'));

  // Inject actions after click (delayed module)
  loadActionsScript(win);

  var origCreate = win.LoveBudMyTreesActions.createNewTree;
  win.LoveBudMyTreesActions.createNewTree = function(opts) {
    callCount++;
    return origCreate.call(win.LoveBudMyTreesActions, opts);
  };

  // Wait for polling to find module
  await new Promise(function(r) { setTimeout(r, 300); });

  assert.strictEqual(callCount, 1, 'Should only create one tree despite rapid clicks with delayed module');
});

test('timeout 후 guard/CTA 복구 + retry 성공', async function(t) {
  var win = createContextifiedWindow();
  loadPageScript(win);
  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var emptyBtn = win.document.getElementById('createTreeBtn');

  headerBtn.dispatchEvent(createFakeEvent('click'));
  assert.strictEqual(headerBtn.disabled, true, 'Header btn disabled immediately');

  // Wait for timeout (20 * 100ms = 2s) + buffer
  await new Promise(function(r) { setTimeout(r, 2600); });

  assert.strictEqual(headerBtn.disabled, false, 'Header btn restored after timeout');
  var childText = '';
  headerBtn.children.forEach(function(c) {
    if (c.nodeType === 3) childText += c.textContent;
  });
  assert.ok(childText.indexOf('myTrees.header_create') !== -1, 'CTA restored after timeout');

  // Now load actions and retry should work
  loadActionsScript(win);
  var callCount = 0;
  var origCreate = win.LoveBudMyTreesActions.createNewTree;
  win.LoveBudMyTreesActions.createNewTree = function(opts) {
    callCount++;
    return origCreate.call(win.LoveBudMyTreesActions, opts);
  };

  win.apiClient = { createTree: async function() { return { id: 't2' }; } };

  headerBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(function(r) { setTimeout(r, 150); });

  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  if (backdrop && backdrop.classList.contains('show')) {
    var cancelBtn = win.document.getElementById('createTreeModalCancelBtn');
    cancelBtn.dispatchEvent(createFakeEvent('click'));
  }
  await new Promise(function(r) { setTimeout(r, 200); });

  assert.strictEqual(callCount, 1, 'Retry should succeed after timeout');
});

test('modal submit pending before resolve', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);

  var resolveHolder = null;
  win.apiClient = {
    createTree: function() {
      return new Promise(function(resolve) { resolveHolder = resolve; });
    }
  };

  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  headerBtn.dispatchEvent(createFakeEvent('click'));

  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  assert.ok(backdrop.classList.contains('show'), 'Modal should open');

  var submitBtn = win.document.getElementById('createTreeModalSubmitBtn');
  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'My Tree';

  // Submit
  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));

  // Give event loop tick for modal promise to resolve and setSubmitting to fire
  await new Promise(function(r) { setTimeout(r, 10); });

  // API pending - should be in submitting state
  assert.strictEqual(submitBtn.disabled, true, 'Submit btn disabled while pending');

  // Resolve API
  if (resolveHolder) resolveHolder({ id: 't3' });
  await new Promise(function(r) { setTimeout(r, 50); });
});

test('success feedback + exact redirect', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);
  win.apiClient = { createTree: async function() { return { id: 'tree-42' }; } };
  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  headerBtn.dispatchEvent(createFakeEvent('click'));

  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Success Tree';

  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));

  await new Promise(function(r) { setTimeout(r, 150); });

  assert.strictEqual(win.location.href, 'editor?treeId=' + encodeURIComponent('tree-42'),
    'Redirect should be exact editor?treeId=' + encodeURIComponent('tree-42'));
});

test('failure generic UI only + retry', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);

  var callCount = 0;
  win.apiClient = {
    createTree: async function() {
      callCount++;
      throw new Error('DB Connection Error');
    }
  };

  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  headerBtn.dispatchEvent(createFakeEvent('click'));

  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Fail Tree';

  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(function(r) { setTimeout(r, 100); });

  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  assert.ok(backdrop.classList.contains('show'), 'Modal should remain open on failure');
  var errorEl = win.document.getElementById('createTreeModalError');
  assert.ok(errorEl.textContent.indexOf('실패했습니다') !== -1, 'Generic error shown');
  assert.ok(errorEl.textContent.indexOf('DB Connection Error') === -1, 'Raw error not exposed');

  // Close modal (cancel) to reset flow
  var cancelBtn = win.document.getElementById('createTreeModalCancelBtn');
  cancelBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(function(r) { setTimeout(r, 50); });

  // Re-trigger createNewTree (page guard is now false after finally)
  headerBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(function(r) { setTimeout(r, 100); });

  backdrop = win.document.getElementById('createTreeModalBackdrop');
  assert.ok(backdrop.classList.contains('show'), 'Modal should open on retry');
  var newTitleInput = win.document.getElementById('createTreeTitleInput');
  newTitleInput.value = 'Retry Tree';
  newTitleInput.dispatchEvent(createFakeEvent('input'));
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(function(r) { setTimeout(r, 100); });

  assert.strictEqual(callCount, 2, 'Retry triggers one more API call');
});

test('source guard: no DOM HTML sinks in actions, exactly 1 in page', async function(t) {
  var actionsJs = read('js/my-trees/my-trees-actions.js');
  var forbidden = ['.innerHTML', '.outerHTML', '.insertAdjacentHTML'];
  forbidden.forEach(function(sink) {
    assert.ok(actionsJs.indexOf(sink) === -1, 'actions module must not use ' + sink);
  });

  var pageJs = read('js/my-trees.js');
  var count = 0;
  pageJs.split('\n').forEach(function(line) {
    forbidden.forEach(function(sink) {
      if (line.indexOf(sink) !== -1) count++;
    });
  });
  assert.strictEqual(count, 1, 'my-trees.js should have exactly 1 sink (clear-container)');
});
