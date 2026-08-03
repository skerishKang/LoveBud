'use strict';

// Issue #3855 — Tree-create write/read convergence contract.
//
// Executes the REAL production sources — reliability-sentinel-taxonomy.js,
// reliability-write-read-convergence-core.js, and my-trees/my-trees-actions.js
// — with injected fake transports (createTree, getTrees, release manifest
// authority). Proves the #3852 convergence core is reused through a bounded
// generalization (operationClass='TREE_CREATE_CONVERGENCE', createKey='createTree',
// ackKey='createdTree') without changing memory-create behavior, and that the
// real My Trees create path distinguishes:
//
//   REQUEST_DISPATCHED → SERVER_ACKNOWLEDGED → canonical reread →
//   PERSISTED_REREAD_CONFIRMED / CONFIRMED
//
//   transport failure -> TRANSPORT_FAILED
//   missing/malformed acknowledgement -> ACKNOWLEDGEMENT_MISSING
//   reread failure -> MONITORING_FAILED
//   malformed reread -> INSUFFICIENT_EVIDENCE
//   successful reread without the identity -> ACKNOWLEDGED_REREAD_MISSING
//
// Monitoring never blocks the redirect, never issues a second write, never
// mutates modal/cache state, and never exposes the acknowledged tree identity
// or raw errors. Stale earlier create flows' observer events are suppressed by
// a page-shared monotonic generation.
//
// Refs #3855.
// Refs #3852 — memory-create convergence core.
// Refs #3835 — taxonomy authority.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function validReleaseSha() {
  return 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
}

function settleAsync() {
  return new Promise((resolve) => {
    setTimeout(() => setTimeout(resolve, 0), 0);
  });
}

// Polls `predicate` (which may throw while polling) until it returns truthy.
// Uses a fixed wall-clock budget so tests never rely on microtask order.
async function waitForMonitoring(events, predicate, timeoutMs, label) {
  var deadline = Date.now() + (timeoutMs || 4000);
  while (Date.now() < deadline) {
    for (var i = 0; i < events.length; i++) {
      var value;
      try {
        value = predicate(events[i]);
      } catch (e) {
        value = false;
      }
      if (value) return events[i];
    }
    await new Promise(function (r) { setTimeout(r, 10); });
  }
  throw new Error('Timed out waiting for monitoring event: ' + (label || 'unknown'));
}

function createSandbox(extraGlobals) {
  return vm.createContext(Object.assign({ console }, extraGlobals || {}));
}

function defaultTaxonomy() {
  const sandbox = createSandbox({ window: {} });
  vm.runInContext(read('js/observability/reliability-sentinel-taxonomy.js'), sandbox);
  return sandbox.window.LoveBudReliabilitySentinelTaxonomy;
}

function loadConvergenceCore() {
  const sandbox = createSandbox({ window: {} });
  vm.runInContext(read('js/observability/reliability-write-read-convergence-core.js'), sandbox);
  return sandbox.window.LoveBudWriteReadConvergenceCore;
}

// Core-level defaults for the TREE_CREATE_CONVERGENCE operation.
function treeDeps(overrides) {
  return Object.assign(
    {
      operationClass: 'TREE_CREATE_CONVERGENCE',
      createKey: 'createTree',
      ackKey: 'createdTree',
      createTree: async () => ({ createdTree: { id: 'tree-1' }, useApi: true }),
      canonicalReread: async () => [{ id: 'tree-1' }],
      taxonomy: defaultTaxonomy(),
      releaseSha: validReleaseSha(),
      observer: null,
    },
    overrides || {}
  );
}

function frozenTree(taxonomy, overrides) {
  const core = loadConvergenceCore();
  return core.createConvergenceCore(treeDeps({ taxonomy, ...overrides }));
}

/* ── VM DOM harness for the real my-trees-actions.js runtime ──────────────── */

function createFakeElement(tagName, id) {
  var listeners = {};
  var attributes = {};
  var classListItems = [];
  var classList = {
    add: function (c) { if (!classListItems.includes(c)) classListItems.push(c); },
    remove: function (c) { classListItems = classListItems.filter(function (x) { return x !== c; }); },
    contains: function (c) { return classListItems.includes(c); },
    toggle: function (c) { if (classList.contains(c)) classList.remove(c); else classList.add(c); }
  };
  var children = [];
  return {
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
    getAttribute: function (name) { return attributes[name] !== undefined ? String(attributes[name]) : null; },
    setAttribute: function (name, value) { attributes[name] = String(value); },
    removeAttribute: function (name) { delete attributes[name]; },
    appendChild: function (child) { children.push(child); child._parent = this; return child; },
    replaceChildren: function () { children.length = 0; },
    addEventListener: function (type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    removeEventListener: function (type, handler) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter(function (h) { return h !== handler; });
    },
    dispatchEvent: function (event) {
      var handlers = listeners[event.type] || [];
      for (var i = 0; i < handlers.length; i++) handlers[i](event);
    },
    focus: function () {},
    select: function () {},
    querySelector: function (sel) {
      if (sel === '.create-tree-visibility') return this._createTreeVisibility || null;
      return null;
    },
    closest: function (sel) {
      if (sel === '.create-tree-field') return this._closestField || null;
      return null;
    }
  };
}

function createFakeEvent(type) {
  return {
    type: type,
    defaultPrevented: false,
    stopPropagation: function () {},
    preventDefault: function () { this.defaultPrevented = true; },
    key: '',
    target: null
  };
}

function createFakeDocument() {
  var elements = new Map();
  var doc = {
    _elements: elements,
    getElementById: function (id) { return elements.get(id) || null; },
    createElement: function (tagName) { return createFakeElement(tagName, null); },
    createTextNode: function (text) { return { nodeType: 3, textContent: String(text) }; },
    addEventListener: function (type, handler) { doc['_on' + type] = handler; },
    removeEventListener: function (type, handler) {},
    dispatchEvent: function () {},
    querySelector: function (sel) {
      if (sel === '.my-trees-dashboard-grid-shell') return createFakeElement('div', null);
      if (sel === '#sortTreesSelect') return null;
      return null;
    },
    body: createFakeElement('body', null),
    head: createFakeElement('head', null),
    activeElement: createFakeElement('div', 'create-invoker'),
    createEvent: function () { return { initEvent: function () {} }; }
  };
  doc.body.ownerDocument = doc;
  doc.head.ownerDocument = doc;
  return doc;
}

function setupDefaultElements(doc) {
  var ids = [
    'createTreeModalBackdrop',
    'createTreeModalForm',
    'createTreeTitleInput',
    'createTreeModalError',
    'createTreeModalCancelBtn',
    'createTreeModalCloseBtn',
    'createTreeModalSubmitBtn',
    'headerCreateTreeBtn',
    'createTreeBtn'
  ];
  var tagMap = { createTreeModalForm: 'form', createTreeTitleInput: 'input' };
  ids.forEach(function (id) {
    var tag = tagMap[id] || 'div';
    if (id.endsWith('Btn')) tag = 'button';
    var el = createFakeElement(tag, id);
    doc._elements.set(id, el);
    el.ownerDocument = doc;
  });
  var form = doc._elements.get('createTreeModalForm');
  var visibilityDiv = createFakeElement('div', null);
  visibilityDiv.className = 'create-tree-visibility';
  visibilityDiv._closestField = createFakeElement('div', null);
  visibilityDiv._closestField.className = 'create-tree-field';
  form._createTreeVisibility = visibilityDiv;
  form.appendChild(visibilityDiv);
}

function createActionsWindow() {
  var doc = createFakeDocument();
  setupDefaultElements(doc);
  var _hrefValue = 'http://localhost/';
  var location = {
    get href() { return _hrefValue; },
    set href(v) { _hrefValue = String(v); },
    replace: function (url) { _hrefValue = String(url); },
    toString: function () { return _hrefValue; }
  };
  // Controllable timers: the product schedules a 1200 ms redirect via
  // setTimeout; faking the queue keeps the suite deterministic and fast while
  // still exercising the exact scheduling call site. Tests flush on demand.
  var timerQueue = [];
  var timerIdCounter = 1;
  function fakeSetTimeout(fn, ms) {
    var id = timerIdCounter++;
    timerQueue.push({ id: id, fn: fn, ms: ms });
    return id;
  }
  function fakeClearTimeout(id) {
    for (var i = 0; i < timerQueue.length; i++) {
      if (timerQueue[i].id === id) { timerQueue.splice(i, 1); return; }
    }
  }
  function fakeSetInterval(fn, ms) { return fakeSetTimeout(fn, ms); }
  function fakeClearInterval(id) { fakeClearTimeout(id); }
  function flushTimers() {
    var pending = timerQueue.slice();
    timerQueue.length = 0;
    for (var i = 0; i < pending.length; i++) {
      try { pending[i].fn(); } catch (e) {}
    }
  }
  var win = {
    window: null,
    document: doc,
    self: null,
    globalThis: null,
    location: location,
    localStorage: (function () {
      var store = {};
      return {
        getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      };
    })(),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: fakeSetInterval,
    clearInterval: fakeClearInterval,
    __flushTimers: flushTimers,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    encodeURIComponent: encodeURIComponent,
    String: String,
    Array: Array,
    Object: Object,
    Boolean: Boolean,
    Number: Number,
    Promise: Promise,
    Error: Error,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    RegExp: RegExp,
    Event: function (type) { return createFakeEvent(type); },
    CustomEvent: function (type) { return createFakeEvent(type); },
    _redirectUrl: ''
  };
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.t = function (k) { return k; };
  win.getConfirmedAuthUser = function () { return { uid: 'user123' }; };
  win.LoveBudUI = { showToast: function () {} };
  win.LoveBudMyTreesPage = { setState: function () {}, STATE: {} };
  win.LoveBudMyTreesData = { loadTrees: function () {} };
  return win;
}

// Loads the REAL taxonomy, REAL convergence core, and REAL my-trees actions
// into one VM context with the fake DOM. Returns the contextified window.
function loadActionsRuntime(extraGlobals) {
  var win = createActionsWindow();
  Object.assign(win, extraGlobals || {});
  vm.createContext(win);
  vm.runInContext(read('js/observability/reliability-sentinel-taxonomy.js'), win);
  vm.runInContext(read('js/observability/reliability-write-read-convergence-core.js'), win);
  vm.runInContext(read('js/my-trees/my-trees-actions.js'), win);
  return win;
}

function mockReleaseReady(sha) {
  sha = sha || validReleaseSha();
  return {
    getState: function () { return 'READY'; },
    getCurrent: function () { return { ok: true, releaseSha: sha }; },
    whenReady: function () { return Promise.resolve({ ok: true, releaseSha: sha }); }
  };
}

function mockReleaseUnavailable() {
  return {
    getState: function () { return 'UNAVAILABLE'; },
    getCurrent: function () { return { ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }; },
    whenReady: function () { return Promise.resolve({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }); }
  };
}

// Starts the real createNewTree flow. The modal opens synchronously (the
// backdrop 'show' class and the submit listener are installed before
// createNewTree's first await), so the caller can immediately set the title and
// dispatch the submit event. Returns the createNewTree promise.
function startCreateFlow(win, options) {
  return win.LoveBudMyTreesActions.createNewTree(
    Object.assign({ i18n: win.t, convergenceObserver: (options && options.observer) || null }, options || {})
  );
}

function submitCreateForm(win, title) {
  win.document.getElementById('createTreeTitleInput').value = title || 'My New Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));
}

// Convenience wrapper: start the flow and submit in one call.
function driveCreateFlow(win, title, options) {
  var flow = startCreateFlow(win, options);
  submitCreateForm(win, title);
  return flow;
}

/* ── Core-level TREE_CREATE_CONVERGENCE scenarios ─────────────────────────── */

test('tree core: module exposes createConvergenceCore with bounded generalization', () => {
  const core = loadConvergenceCore();
  assert.equal(typeof core.createConvergenceCore, 'function');
  assert.equal(core.CONTRACT_VERSION, '1');
});

test('tree core: identity present in reread -> CONFIRMED with TREE_CREATE_CONVERGENCE class', async () => {
  const taxonomy = defaultTaxonomy();
  const events = [];
  const convergence = frozenTree(taxonomy, {
    observer: (s) => events.push(s.outcome_code)
  });
  const summary = await convergence.converge({ title: 'A' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(summary.operation_class, taxonomy.OPERATION_CLASSES.TREE_CREATE_CONVERGENCE);
  assert.equal(summary.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.equal(summary.release_sha, validReleaseSha());
  // Progress summaries (REQUEST_DISPATCHED / SERVER_ACKNOWLEDGED) carry no
  // outcome_code; only the final summary does.
  assert.equal(events[events.length - 1], taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.ok(Object.isFrozen(summary), 'summary must be frozen');
});

test('tree core: identity absent in successful reread -> ACKNOWLEDGED_REREAD_MISSING', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => [{ id: 'other-tree' }]
  });
  const summary = await convergence.converge({ title: 'A' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
  assert.equal(summary.stage, taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED);
});

test('tree core: same-title different-id row is NOT the identity (title is never identity)', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => [{ id: 'other-tree', title: 'My New Tree' }]
  });
  const summary = await convergence.converge({ title: 'My New Tree' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('tree core: createTree rejection -> TRANSPORT_FAILED', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    createTree: async () => { throw new Error('network failure'); }
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.TRANSPORT_FAILED);
});

test('tree core: missing ack record -> ACKNOWLEDGEMENT_MISSING', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    createTree: async () => ({ useApi: true })
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('tree core: ack record without id -> ACKNOWLEDGEMENT_MISSING', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    createTree: async () => ({ createdTree: { title: 'No ID' }, useApi: true })
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('tree core: reread rejection -> MONITORING_FAILED', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => { throw new Error('reread failure'); }
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
  assert.notEqual(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('tree core: malformed reread (non-array) -> INSUFFICIENT_EVIDENCE', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => ({ trees: [{ id: 'tree-1' }] })
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE);
});

test('tree core: REQUEST_DISPATCHED recorded before createTree settlement', async () => {
  const taxonomy = defaultTaxonomy();
  const events = [];
  let resolveCreate;
  const convergence = frozenTree(taxonomy, {
    createTree: async () => {
      events.push('create-called');
      return new Promise((resolve) => { resolveCreate = resolve; });
    },
    observer: (s) => events.push('observer:' + s.stage)
  });
  const promise = convergence.converge({});
  await settleAsync();
  // The core records REQUEST_DISPATCHED synchronously before awaiting the
  // create dispatch, so the observer sees it even before the transport runs.
  assert.deepEqual(events, ['observer:REQUEST_DISPATCHED', 'create-called'],
    'REQUEST_DISPATCHED must be observed before the create transport settles');
  resolveCreate({ createdTree: { id: 'tree-1' }, useApi: true });
  const summary = await promise;
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('tree core: createTree dispatch executed exactly once per converge', async () => {
  const taxonomy = defaultTaxonomy();
  let createCalls = 0;
  const convergence = frozenTree(taxonomy, {
    createTree: async () => { createCalls += 1; return { createdTree: { id: 'tree-1' }, useApi: true }; }
  });
  await convergence.converge({});
  await convergence.converge({});
  assert.equal(createCalls, 2, 'one dispatch per converge call (never a monitoring second write)');
});

test('tree core: canonical reread executed at most once after acknowledgement', async () => {
  const taxonomy = defaultTaxonomy();
  let rereadCalls = 0;
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => { rereadCalls += 1; return [{ id: 'tree-1' }]; }
  });
  await convergence.converge({});
  assert.equal(rereadCalls, 1, 'at most one canonical reread');
});

test('tree core: missing release SHA without readiness seam fails closed', () => {
  assert.throws(
    () => frozenTree(defaultTaxonomy(), { releaseSha: undefined }),
    /MISSING_RELEASE_SHA/
  );
});

test('tree core: invalid release SHA fails closed', () => {
  assert.throws(
    () => frozenTree(defaultTaxonomy(), { releaseSha: 'not-a-valid-sha' }),
    /INVALID_RELEASE_SHA/
  );
});

test('tree core: release readiness unavailable -> MONITORING_FAILED, never CONFIRMED', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    releaseSha: undefined,
    releaseReadiness: async () => ({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' })
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
  assert.notEqual(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.ok(!('release_sha' in summary), 'release_sha key omitted while unavailable');
});

test('tree core: deferred release SHA resolved after REQUEST_DISPATCHED -> CONFIRMED carries SHA', async () => {
  const taxonomy = defaultTaxonomy();
  const events = [];
  const convergence = frozenTree(taxonomy, {
    releaseSha: undefined,
    releaseReadiness: async () => ({ ok: true, releaseSha: validReleaseSha() }),
    observer: (s) => events.push(s.stage)
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(summary.release_sha, validReleaseSha());
  assert.deepEqual(events, [
    taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
    taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
    taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED
  ]);
});

test('tree core: taxonomy Proxy get traps never invoked', async () => {
  const taxonomy = defaultTaxonomy();
  let getterCount = 0;
  const proxyTaxonomy = new Proxy(taxonomy, {
    get(target, prop) { getterCount += 1; return Reflect.get(target, prop); }
  });
  const convergence = loadConvergenceCore().createConvergenceCore(
    treeDeps({ taxonomy: proxyTaxonomy })
  );
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(getterCount, 0, 'taxonomy get traps must never be invoked');
});

test('tree core: reread rows accessor getter never invoked', async () => {
  const taxonomy = defaultTaxonomy();
  let getterCount = 0;
  const row = { id: 'tree-1' };
  Object.defineProperty(row, 'id', {
    enumerable: true,
    get() { getterCount += 1; return 'tree-1'; }
  });
  const convergence = frozenTree(taxonomy, {
    canonicalReread: async () => [row]
  });
  const summary = await convergence.converge({});
  assert.equal(getterCount, 0, 'row id getter must not be invoked');
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('tree core: acknowledged identity accessor getter never invoked', async () => {
  const taxonomy = defaultTaxonomy();
  let getterCount = 0;
  const ack = { title: 'X' };
  Object.defineProperty(ack, 'id', {
    enumerable: true,
    get() { getterCount += 1; return 'tree-1'; }
  });
  const convergence = frozenTree(taxonomy, {
    createTree: async () => ({ createdTree: ack, useApi: true })
  });
  const summary = await convergence.converge({});
  assert.equal(getterCount, 0, 'ack identity getter must not be invoked');
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('tree core: throwing getPrototypeOf Proxy input fails closed without raw leakage', async () => {
  const taxonomy = defaultTaxonomy();
  const evil = new Proxy({}, { getPrototypeOf() { throw new Error('secret leak'); } });
  const convergence = loadConvergenceCore().createConvergenceCore(
    treeDeps({ createTree: async () => evil })
  );
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
  assert.ok(!JSON.stringify(summary).includes('secret leak'), 'no raw error leakage');
});

test('tree core: stale earlier completion rejected and never reaches observer', async () => {
  const taxonomy = defaultTaxonomy();
  const events = [];
  const resolvers = [];
  const convergence = frozenTree(taxonomy, {
    createTree: async () => {
      const gate = new Promise((resolve) => { resolvers.push(resolve); });
      await gate;
      return { createdTree: { id: 'tree-1' }, useApi: true };
    },
    observer: (s) => events.push(s.outcome_code)
  });
  const p1 = convergence.converge({});
  const p2 = convergence.converge({});
  resolvers[1](); // second completes first
  await p2;
  resolvers[0](); // first completes later (stale)
  await p1;
  const confirmed = events.filter((c) => c === taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(confirmed.length, 1, 'only the latest completion may reach the observer');
});

test('tree core: observer throwing never propagates to the save result', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {
    observer: () => { throw new Error('observer exploded'); }
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('tree core: output is frozen and byte-stable across identical runs', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = frozenTree(taxonomy, {});
  const a = await convergence.converge({});
  const b = await convergence.converge({});
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'byte-stable output');
  assert.ok(Object.isFrozen(a));
  const keys = Object.keys(a);
  for (const key of keys) {
    assert.ok(Object.isFrozen(a[key]), 'nested value frozen: ' + key);
  }
});

test('tree core: unknown operation class fails closed', () => {
  assert.throws(
    () => loadConvergenceCore().createConvergenceCore(
      treeDeps({ operationClass: 'DOES_NOT_EXIST' })
    ),
    /UNKNOWN_OPERATION_CLASS/
  );
});

test('tree core: memory defaults remain byte-identical (#3852 regression)', async () => {
  const taxonomy = defaultTaxonomy();
  const convergence = loadConvergenceCore().createConvergenceCore({
    createMemory: async () => ({ createdMemory: { id: 'mem-1' }, useApi: true }),
    canonicalReread: async () => ({ memories: [{ id: 'mem-1' }] }),
    taxonomy: taxonomy,
    releaseSha: validReleaseSha()
  });
  const summary = await convergence.converge({});
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(summary.operation_class, taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE);
});

/* ── Real My Trees create integration ─────────────────────────────────────── */

test('integration: success flow -> exactly one createTree write, CONFIRMED, redirecting', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let getTreesCalls = 0;
  win.apiClient = {
    createTree: async (payload) => {
      createCalls += 1;
      return { id: 'tree-created-1', title: payload.title, visibility: payload.visibility };
    },
    getTrees: async () => { getTreesCalls += 1; return [{ id: 'tree-created-1' }]; }
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const events = [];
  const flow = driveCreateFlow(win, 'My New Tree', { observer: (s) => events.push(s) });

  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'UI result must be redirecting');
  await waitForMonitoring(
    events,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED,
    4000,
    'CONFIRMED final event'
  );
  assert.equal(createCalls, 1, 'createTree must be called exactly once');
  assert.equal(getTreesCalls, 2, 'one snapshot + one canonical reread (no second write)');

  const stages = events.map((e) => e.stage);
  assert.deepEqual(stages, [
    taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
    taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
    taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED
  ]);
  const last = events[events.length - 1];
  assert.equal(last.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(last.operation_class, taxonomy.OPERATION_CLASSES.TREE_CREATE_CONVERGENCE);
  assert.equal(last.release_sha, validReleaseSha());
  assert.ok(!JSON.stringify(last).includes('tree-created-1'), 'tree identity must not leak');
});

test('integration: REQUEST_DISPATCHED observed before the create transport settles', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let resolveCreate;
  const order = [];
  win.apiClient = {
    createTree: () => {
      order.push('create-called');
      return new Promise((resolve) => { resolveCreate = resolve; });
    },
    getTrees: async () => { order.push('getTrees'); return []; }
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const events = [];
  const flow = driveCreateFlow(win, 'Pending Tree', {
    observer: (s) => { order.push('observer:' + s.stage); events.push(s); }
  });

  await waitForMonitoring(
    events,
    (e) => e.stage === taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
    4000,
    'REQUEST_DISPATCHED'
  );
  assert.ok(order.includes('create-called'), 'create transport was invoked');
  assert.ok(
    order.indexOf('observer:REQUEST_DISPATCHED') !== -1,
    'REQUEST_DISPATCHED must be observed while the API promise is still pending'
  );
  // Settlement happens only after the test resolves the transport.
  resolveCreate({ id: 'tree-pending-1' });
  const result = await flow;
  assert.equal(result.outcome, 'redirecting');
  assert.ok(events.some((s) => s.stage === taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED));
});

test('integration: create rejection with ambiguous status -> check mode, TRANSPORT_FAILED, no redirect', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  win.apiClient = {
    createTree: async () => {
      createCalls += 1;
      throw new Error('Network Error');
    },
    getTrees: async () => []
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const events = [];
  // NOT awaited: the product flow legitimately enters check mode and waits for
  // another modal round, so the createNewTree promise stays pending.
  driveCreateFlow(win, 'Ambiguous Tree', { observer: (s) => events.push(s) });

  await waitForMonitoring(
    events,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.TRANSPORT_FAILED,
    4000,
    'TRANSPORT_FAILED'
  );
  assert.equal(createCalls, 1, 'exactly one write attempt');
  const submitBtn = win.document.getElementById('createTreeModalSubmitBtn');
  assert.ok(
    String(submitBtn.textContent).indexOf('check_status') !== -1 ||
      String(submitBtn.textContent).indexOf('확인') !== -1,
    'UI must enter check mode (existing product behavior preserved)'
  );
  const transport = events.filter((e) => e.outcome_code === taxonomy.OUTCOME_CODES.TRANSPORT_FAILED);
  assert.equal(transport.length, 1, 'monitoring records TRANSPORT_FAILED for the rejected write');
  assert.equal(win.location.href, 'http://localhost/', 'no redirect on ambiguous transport failure');
});

test('integration: identity absent in reread -> ACKNOWLEDGED_REREAD_MISSING, redirect unchanged', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  win.apiClient = {
    createTree: async () => ({ id: 'tree-gone', title: 'Gone' }),
    getTrees: async () => []
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const events = [];
  const flow = driveCreateFlow(win, 'Gone', { observer: (s) => events.push(s) });

  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'UI still redirects');
  const last = await waitForMonitoring(
    events,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING,
    4000,
    'ACKNOWLEDGED_REREAD_MISSING'
  );
  assert.equal(last.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('integration: reread rejection -> MONITORING_FAILED, redirect unchanged', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let getTreesCalls = 0;
  win.apiClient = {
    createTree: async () => ({ id: 'tree-ok', title: 'OK' }),
    getTrees: async () => {
      getTreesCalls += 1;
      if (getTreesCalls > 1) throw new Error('reread transport failure');
      return [];
    }
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const events = [];
  const flow = driveCreateFlow(win, 'OK', { observer: (s) => events.push(s) });

  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'UI still redirects');
  const last = await waitForMonitoring(
    events,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.MONITORING_FAILED,
    4000,
    'MONITORING_FAILED'
  );
  assert.equal(last.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
  assert.notEqual(last.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('integration: release authority unavailable -> zero monitoring events, write still exactly once', async () => {
  const win = loadActionsRuntime();
  let createCalls = 0;
  win.apiClient = {
    createTree: async () => { createCalls += 1; return { id: 'tree-no-sha', title: 'NoSHA' }; },
    getTrees: async () => [{ id: 'tree-no-sha' }]
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseUnavailable();
  const events = [];
  const flow = driveCreateFlow(win, 'NoSHA', { observer: (s) => events.push(s) });

  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'save not blocked');
  assert.equal(createCalls, 1, 'exactly one write');
  assert.equal(events.length, 0, 'UNAVAILABLE release state safe-skips with zero events');
  assert.ok(!JSON.stringify(events).includes('CONFIRMED'), 'never CONFIRMED without a valid SHA');
});

test('integration: observer missing -> monitoring safe, create + redirect unchanged', async () => {
  const win = loadActionsRuntime();
  win.apiClient = {
    createTree: async () => ({ id: 'tree-no-observer', title: 'NoObserver' }),
    getTrees: async () => [{ id: 'tree-no-observer' }]
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const flow = driveCreateFlow(win, 'NoObserver', { observer: null });
  const result = await flow;
  assert.equal(result.outcome, 'redirecting');
});

test('integration: observer throwing does not block create or redirect', async () => {
  const win = loadActionsRuntime();
  win.apiClient = {
    createTree: async () => ({ id: 'tree-throw-obs', title: 'ThrowObs' }),
    getTrees: async () => [{ id: 'tree-throw-obs' }]
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const flow = driveCreateFlow(win, 'ThrowObs', {
    observer: () => { throw new Error('observer exploded'); }
  });
  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'observer failure must not alter create or redirect');
});

test('integration: monitoring slower than redirect -> redirect completes first', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let resolveReread = null;
  let getTreesCalls = 0;
  const observed = [];
  win.apiClient = {
    createTree: async () => ({ id: 'tree-slow', title: 'Slow' }),
    getTrees: async () => {
      getTreesCalls += 1;
      if (getTreesCalls > 1) return new Promise((resolve) => { resolveReread = resolve; });
      return [];
    }
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const flow = driveCreateFlow(win, 'Slow', { observer: (s) => observed.push(s.stage) });

  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'UI redirect not blocked by slow monitoring');
  await new Promise(function (r) { setTimeout(r, 20); });
  assert.ok(resolveReread, 'reread must be gated while monitoring is slower');
  assert.ok(
    !observed.includes(taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED),
    'final summary not yet delivered while reread is pending'
  );
  resolveReread([{ id: 'tree-slow' }]);
  await waitForMonitoring(
    observed,
    (s) => s === taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED,
    4000,
    'final after reread resolve'
  );
});

test('integration: stale cross-save generation suppresses earlier flow final event', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  let createCall = 0;
  let rereadResolverA = null;
  let getTreesCalls = 0;
  const eventsA = [];
  const eventsB = [];

  win.apiClient = {
    createTree: async () => {
      createCall += 1;
      if (createCall === 1) return { id: 'tree-flow-A', title: 'FlowA' };
      return { id: 'tree-flow-B', title: 'FlowB' };
    },
    getTrees: async () => {
      getTreesCalls += 1;
      if (getTreesCalls === 2) {
        // Flow A's canonical reread (the monitoring reread right after the
        // snapshot) stays pending until after flow B completes. The snapshot
        // is getTrees call 1; flow B's snapshot is call 3 and its reread is
        // call 4, so the gate is unambiguous per flow.
        return new Promise((resolve) => { rereadResolverA = resolve; });
      }
      if (getTreesCalls === 4) return [{ id: 'tree-flow-B' }];
      return [];
    }
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();

  // Flow A
  const flowA = driveCreateFlow(win, 'FlowA', { observer: (s) => eventsA.push(s) });
  const resultA = await flowA;
  assert.equal(resultA.outcome, 'redirecting', 'flow A redirects (UI not blocked by monitoring)');
  await new Promise(function (r) { setTimeout(r, 20); });
  assert.ok(rereadResolverA, 'flow A reread should still be pending');

  // Flow B begins after flow A redirected (generation 2 supersedes generation 1).
  win.__myTreesCreateFlowActive = false;
  const flowB = driveCreateFlow(win, 'FlowB', { observer: (s) => eventsB.push(s) });
  const resultB = await flowB;
  assert.equal(resultB.outcome, 'redirecting', 'flow B redirects');

  await waitForMonitoring(
    eventsB,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED,
    4000,
    'flow B CONFIRMED'
  );

  // Let flow A's stale reread complete now; its final event must be suppressed.
  const aCountBefore = eventsA.length;
  rereadResolverA([{ id: 'tree-flow-A' }]);
  await new Promise(function (r) { setTimeout(r, 30); });

  const confirmedB = eventsB.filter((e) => e.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(confirmedB.length, 1, 'latest flow B final CONFIRMED delivered exactly once');
  assert.equal(eventsA.length, aCountBefore, 'stale flow A final CONFIRMED must be suppressed');
  assert.ok(
    !eventsA.some((e) => e.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED),
    'no stale flow A CONFIRMED'
  );
});

test('integration: no apiClient.createTree -> demo fallback, zero monitoring, redirect to editor', async () => {
  const win = loadActionsRuntime();
  const events = [];
  win.apiClient = {};
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const flow = driveCreateFlow(win, 'Demo Tree', { observer: (s) => events.push(s) });
  const result = await flow;
  assert.equal(result.outcome, 'redirecting', 'demo fallback still redirects');
  assert.equal(events.length, 0, 'no monitoring events without a real write');
  win.__flushTimers();
  assert.ok(
    win.location.href.indexOf('editor?treeId=tree-') === 0,
    'demo fallback redirects to editor with a local synthetic tree id'
  );
});

test('integration: privacy - tree id, raw error, payload absent from all summaries', async () => {
  const win = loadActionsRuntime();
  const taxonomy = win.LoveBudReliabilitySentinelTaxonomy;
  const events = [];
  win.apiClient = {
    createTree: async () => ({ id: 'super-secret-tree-id', title: 'Secret' }),
    getTrees: async () => [{ id: 'super-secret-tree-id' }]
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  const flow = driveCreateFlow(win, 'Secret', { observer: (s) => events.push(s) });
  await flow;
  await waitForMonitoring(
    events,
    (e) => e.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED,
    4000,
    'final event'
  );

  const json = JSON.stringify(events);
  assert.ok(!json.includes('super-secret-tree-id'), 'tree identity must never leak');
  assert.ok(!json.includes('Secret'), 'title must never leak');
  assert.ok(!json.includes('network failure'), 'raw errors must never leak');
  for (const event of events) {
    assert.ok(!('createdTree' in event), 'raw tree object must never appear');
    assert.ok(!('apiClient' in event), 'apiClient must never appear');
    assert.ok(!('payload' in event), 'payload must never appear');
  }
});

test('integration: monitoring never mutates modal state or cache', async () => {
  const win = loadActionsRuntime();
  const backdrop = win.document.getElementById('createTreeModalBackdrop');
  win.apiClient = {
    createTree: async () => ({ id: 'tree-cache', title: 'CacheSafe' }),
    getTrees: async () => [{ id: 'tree-cache' }]
  };
  win.LoveBudReleaseManifestAuthority = mockReleaseReady();
  win.LoveBudCache = { clear: function () { throw new Error('cache must not be touched by monitoring'); } };
  const flow = driveCreateFlow(win, 'CacheSafe', { observer: () => {} });
  const result = await flow;
  assert.equal(result.outcome, 'redirecting');
  assert.equal(backdrop.classList.contains('show'), false, 'modal closed normally by the product flow');
  assert.equal(win.localStorage.getItem('lovebud_my_trees_list_cache'), null,
    'monitoring never writes the persistent trees cache');
});

test('integration: actions source keeps one redirect assignment and redirecting outcome contract', () => {
  const source = read('js/my-trees/my-trees-actions.js');
  const redirectMatches = source.match(/window\.location\.href = redirectTarget/g) || [];
  assert.equal(redirectMatches.length, 1, 'exactly one redirect assignment preserved');
  assert.match(source, /return \{ outcome: 'redirecting' \};/, 'redirecting outcome preserved');
  assert.match(source, /takeSnapshot\(\);/, 'pre-create snapshot preserved');
  assert.match(source, /dispatchTreeCreateOnce\(/, 'exactly-once dispatch helper wired');
  assert.match(source, /monitorTreeCreateConvergence\(/, 'monitoring wired at dispatch time');
  assert.match(source, /operationClass: 'TREE_CREATE_CONVERGENCE'/, 'tree operation class used');
});

test('integration: my-trees.html forbids inline scripts; release authority registered by the actions module before create flows', () => {
  const html = read('pages/my-trees.html');
  const source = read('js/my-trees/my-trees-actions.js');
  // my-trees.html has an existing no-inline-script contract, so the bounded
  // release authority must live in the actions module (loaded before any
  // create flow can run), not in an inline page block.
  const scriptTags = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  for (const [, attrs, content] of scriptTags) {
    if (!attrs.includes('src=')) {
      assert.equal(String(content).trim(), '', 'my-trees.html must not contain active inline script blocks');
    }
  }
  assert.ok(html.indexOf('my-trees-actions.js?v=') !== -1, 'actions script tag present');
  assert.ok(html.indexOf('reliability-sentinel-taxonomy.js') !== -1, 'taxonomy script loaded before actions');
  assert.ok(html.indexOf('reliability-write-read-convergence-core.js') !== -1, 'convergence core loaded before actions');
  const actionsIndex = html.indexOf('my-trees-actions.js?v=');
  const taxonomyIndex = html.indexOf('reliability-sentinel-taxonomy.js');
  const coreIndex = html.indexOf('reliability-write-read-convergence-core.js');
  assert.ok(taxonomyIndex < actionsIndex && coreIndex < actionsIndex,
    'taxonomy and core must load before the actions runtime');
  assert.ok(source.indexOf('window.LoveBudReleaseManifestAuthority') !== -1,
    'actions module must register the release authority');
  const registrationIndex = source.indexOf('window.LoveBudReleaseManifestAuthority');
  const monitorIndex = source.indexOf('function monitorTreeCreateConvergence');
  assert.ok(registrationIndex !== -1 && monitorIndex !== -1 && registrationIndex < monitorIndex,
    'release authority must be registered before the monitoring runtime');
});
