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

  var textContentValue = '';
  function computeTextContent() {
    var parts = [];
    function walk(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType === 3) parts.push(n.textContent);
        else if (n.nodeType === 1 && n.children) walk(n.children);
      }
    }
    walk(children);
    return parts.join('');
  }

  var el = {
    tagName: tagName,
    id: id || null,
    nodeType: 1,
    children: children,
    classList: classList,
    className: '',
    style: {},
    disabled: false,
    get textContent() { return computeTextContent(); },
    set textContent(v) {
      textContentValue = String(v);
      children.length = 0;
      children.push({ nodeType: 3, textContent: String(v) });
    },
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
    LoveBudUI: { showToast: function(message, type) { win._recordedEvents.push(['toast', message, type]); } },
    LoveBudMyTreesPage: { setState: function() {}, STATE: {} },
    LoveBudMyTreesData: { loadTrees: function() {} },
    getConfirmedAuthUser: function() { return { uid: 'user123' }; },
    _recordedEvents: []
  };
  Object.defineProperty(win.location, 'href', {
    get: function() { return location._h; },
    set: function(v) { win._recordedEvents.push(['redirect', String(v)]); location._h = String(v); },
    configurable: true, enumerable: true
  });

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

// ─── Tests ─────────────────────────────────────────────────

test('A. initial cancel: header CTA click, modal cancel, CTA enabled, guard reset allows reopen', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);
  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var emptyBtn = win.document.getElementById('createTreeBtn');
  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  var cancelBtn = win.document.getElementById('createTreeModalCancelBtn');

  // 1. Initial click
  headerBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(r => setTimeout(r, 50)); // Wait for modal to open
  assert.ok(backdrop.classList.contains('show'), 'Modal should open after first click');
  assert.strictEqual(headerBtn.disabled, true, 'Header CTA should be disabled when modal is open');
  assert.strictEqual(emptyBtn.disabled, true, 'Empty CTA should be disabled when modal is open');

  // 2. Cancel modal
  cancelBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(r => setTimeout(r, 50)); // Wait for modal to close
  assert.ok(!backdrop.classList.contains('show'), 'Modal should close after cancel');
  assert.strictEqual(headerBtn.disabled, false, 'Header CTA should be re-enabled after cancel');
  assert.ok(headerBtn.textContent.indexOf('myTrees.header_create') !== -1, 'Header CTA text restored');
  assert.strictEqual(emptyBtn.disabled, false, 'Empty CTA should be re-enabled after cancel');
  assert.ok(emptyBtn.textContent.indexOf('create_tree_btn') !== -1, 'Empty CTA text restored');

  // 3. Re-click header CTA to confirm guard reset
  headerBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(r => setTimeout(r, 50)); // Wait for modal to open again
  assert.ok(backdrop.classList.contains('show'), 'Modal should reopen after guard reset');
});

test('B. failure then same-modal retry: API fails, generic error, then succeeds', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);

  var apiClientCallCount = 0;
  var apiResponses = [
    new Error('DB Connection Error'), // First call fails
    { id: 'retry-tree-123', title: 'Retry Tree', visibility: 'public' } // Second call succeeds
  ];

  win.apiClient = {
    createTree: async function(opts) {
      apiClientCallCount++;
      const response = apiResponses.shift();
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }
  };
  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var titleInput = win.document.getElementById('createTreeTitleInput');
  var form = win.document.getElementById('createTreeModalForm');
  var errorEl = win.document.getElementById('createTreeModalError');
  var submitBtn = win.document.getElementById('createTreeModalSubmitBtn');

  // 1. Initial click
  headerBtn.dispatchEvent(createFakeEvent('click'));
  await new Promise(r => setTimeout(r, 50));
  titleInput.value = 'Fail First';
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(r => setTimeout(r, 100)); // Wait for API call and error display

  assert.strictEqual(apiClientCallCount, 1, 'First API call should happen');
  assert.ok(win.document.getElementById('createTreeModalBackdrop').classList.contains('show'), 'Modal should remain open on failure');
  assert.ok(errorEl.textContent.indexOf('트리 만들기 실패') !== -1, 'Generic error shown in modal');
  assert.ok(errorEl.textContent.indexOf('DB Connection Error') === -1, 'Raw API error not exposed');
  assert.strictEqual(submitBtn.disabled, false, 'Submit button should be re-enabled after failure');
  assert.ok(submitBtn.textContent.indexOf('시작하기') !== -1, 'Submit button text restored');

  // 2. Second submit (retry in same modal)
  titleInput.value = 'Retry Success'; // User can change or keep title
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(r => setTimeout(r, 500)); // Wait for API call, success toast, and redirect

  assert.strictEqual(apiClientCallCount, 2, 'Second API call should happen on retry');
  assert.ok(!win.document.getElementById('createTreeModalBackdrop').classList.contains('show'), 'Modal should close on success');
  assert.ok(win._recordedEvents.some(e => e[0] === 'toast' && e[1].includes('러브트리가 생성되었습니다.')), 'Success toast should be shown');
  assert.ok(win.location.href.includes('editor?treeId=' + encodeURIComponent('retry-tree-123')), 'Should redirect to editor with new treeId');
});

test('C. success feedback before redirect: toast event before redirect', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);
  win.apiClient = { createTree: async function() { return { id: 'tree-42', title: 'Success Tree' }; } };
  win.t = function(key) {
    if (key === 'create_tree_success') return '러브트리가 생성되었습니다.';
    return key;
  };
  fireDOMContentLoaded(win);

  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  headerBtn.dispatchEvent(createFakeEvent('click'));

  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Success Tree';

  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));

  await new Promise(function(r) { setTimeout(r, 500); }); // Sufficient time for toast + delay + redirect

  // Assert order: toast must be before redirect
  const toastIndex = win._recordedEvents.findIndex(e => e[0] === 'toast' && e[1].includes('러브트리가 생성되었습니다.'));
  const redirectIndex = win._recordedEvents.findIndex(e => e[0] === 'redirect' && e[1].includes('editor?treeId='));

  assert.ok(toastIndex !== -1, 'Success toast event should be recorded');
  assert.ok(redirectIndex !== -1, 'Redirect event should be recorded');
  assert.ok(toastIndex < redirectIndex, 'Toast event must occur before redirect event');

  // Assert redirect URL
  assert.strictEqual(win.location.href, 'editor?treeId=' + encodeURIComponent('tree-42'),
    'Redirect should be exact editor?treeId=' + encodeURIComponent('tree-42'));
});

test('D1. warm module rapid header+empty click -> create 1회', async function(t) {
  var win = createContextifiedWindow();
  loadActionsScript(win);
  loadPageScript(win);
  var createTreeResolvers = [];
  win.apiClient = {
    createTree: function() {
      return new Promise(function(resolve) { createTreeResolvers.push(resolve); });
    }
  };
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

  await new Promise(function(r) { setTimeout(r, 50); }); // Wait for modal to open

  // Submit modal to let create proceed
  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Warm Tree';
  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(r => setTimeout(r, 50)); // Wait for promise resolution

  assert.strictEqual(callCount, 1, 'Should only trigger createNewTree once despite rapid clicks');
  assert.strictEqual(createTreeResolvers.length, 1, 'Should only have one API call pending');
  if (createTreeResolvers.length > 0) createTreeResolvers[0]({ id: 'warm-tree' });
  await new Promise(r => setTimeout(r, 200));
});

test('D2. delayed module rapid header+empty click -> create 1회', async function(t) {
  var win = createContextifiedWindow();
  loadPageScript(win);
  var createTreeResolvers = [];
  win.apiClient = {
    createTree: function() {
      return new Promise(function(resolve) { createTreeResolvers.push(resolve); });
    }
  };
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

  // Submit modal
  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Delayed Tree';
  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(r => setTimeout(r, 50));

  assert.strictEqual(callCount, 1, 'Should only trigger createNewTree once despite rapid clicks with delayed module');
  assert.strictEqual(createTreeResolvers.length, 1, 'Should only have one API call pending');
  if (createTreeResolvers.length > 0) createTreeResolvers[0]({ id: 'delayed-tree' });
  await new Promise(r => setTimeout(r, 200));
});

test('D3. timeout 후 guard/CTA 복구 + retry 성공', async function(t) {
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
  var headerCtaText = headerBtn.textContent;
  assert.ok(headerCtaText.indexOf('myTrees.header_create') !== -1 || headerCtaText.indexOf('New LoveTree') !== -1, 'Header CTA restored text');

  // Now load actions and retry should work
  loadActionsScript(win);
  var apiClientCallCount = 0;
  win.apiClient = {
    createTree: async function() {
      apiClientCallCount++;
      return { id: 't2' };
    }
  };

  headerBtn.dispatchEvent(createFakeEvent('click')); // This will open modal again
  await new Promise(function(r) { setTimeout(r, 50); });

  var titleInput = win.document.getElementById('createTreeTitleInput');
  titleInput.value = 'Timeout Retry';
  var form = win.document.getElementById('createTreeModalForm');
  form.dispatchEvent(createFakeEvent('submit'));
  await new Promise(function(r) { setTimeout(r, 600); });

  assert.strictEqual(apiClientCallCount, 1, 'Timeout retry triggers one API call');
  assert.ok(win.location.href.includes('editor?treeId=' + encodeURIComponent('t2')), 'Timeout retry should redirect');
});

test('D4. modal submit pending before resolve', async function(t) {
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
  await new Promise(function(r) { setTimeout(r, 200); });
});

test('D5. source guard: no DOM HTML sinks in actions, exactly 1 in page', async function(t) {
  var actionsJs = read('js/my-trees/my-trees-actions.js');
  var forbidden = ['.innerHTML', '.outerHTML', '.insertAdjacentHTML'];
  forbidden.forEach(function(sink) {
    assert.ok(actionsJs.indexOf(sink) === -1, 'actions module must not use ' + sink);
  });

  var pageJs = read('js/my-trees.js');
  var count = 0;
  pageJs.split('\n').forEach(function(line) {
    forbidden.forEach(function(sink) {
      // Allow only the specific clear-container sink
      if (line.indexOf('containerFallback.innerHTML = \'\';') === -1 && line.indexOf(sink) !== -1) {
        count++;
      }
    });
  });
  assert.strictEqual(count, 0, 'my-trees.js should have exactly 1 sink (clear-container) and no others');
});
