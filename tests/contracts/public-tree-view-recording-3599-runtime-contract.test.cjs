'use strict';

/**
 * LoveBud — Public tree view recording runtime contract
 * Issue #3599
 *
 * Executes the real public-canvas-init.js (active canonical appreciation
 * route entry) plus the new public-tree-view-recorder.js in node:vm with a
 * faux DOM and an intercepted fetch. Asserts that a successful public tree
 * load records exactly one POST /api/trees/:treeId/views with the required
 * anonymous payload, and that every other lifecycle event adds no request.
 *
 * Primary: EXECUTED_FAKE — runs active viewer modules in node:vm with faux DOM.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ── Faux DOM (minimal, matches the selectors public-canvas-init touches) ── */

class FauxNode {
  constructor(tagName) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.nodeName = this.tagName;
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this._hidden = false;
    this._textContent = '';
    this._classList = null;
  }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = String(v); }
  get className() { return this.attrs.class || ''; }
  set className(v) { if (v) this.attrs.class = String(v); else delete this.attrs.class; }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }
  getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return this.attrs[k] !== undefined; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); return c; }
  replaceChildren() { this.children.length = 0; }
  after() {}
  remove() {}
  cloneNode() { return new FauxNode(this.tagName); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener() {}
  get classList() {
    if (!this._classList) {
      const self = this;
      this._classList = {
        add(...cs) { const cur = (self.attrs.class || '').split(/\s+/).filter(Boolean); for (const c of cs) if (!cur.includes(c)) cur.push(c); self.attrs.class = cur.join(' '); },
        remove(...cs) { const cur = (self.attrs.class || '').split(/\s+/).filter(Boolean); self.attrs.class = cur.filter((c) => !cs.includes(c)).join(' '); },
        toggle(c) { if (this.contains(c)) { this.remove(c); return false; } this.add(c); return true; },
        contains(c) { return (self.attrs.class || '').split(/\s+/).includes(c); }
      };
    }
    return this._classList;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
}

function makeDoc() {
  const body = new FauxNode('body');
  body.id = 'body';
  body.classList.add('editor-preload');
  // common elements referenced by id in public-canvas-init
  const ids = ['canvasEmptyGuide', 'viewerSidebarMomentCount', 'publicViewerLoadingState'];
  for (const id of ids) {
    const e = new FauxNode('div');
    e.id = id;
    body.children.push(e);
  }
  const byId = { body, '': body };
  function reg(node) { if (node.id) byId[node.id] = node; }
  for (const c of body.children) reg(c);
  const doc = {
    body,
    documentElement: new FauxNode('html'),
    readyState: 'complete',
    createElement: (t) => new FauxNode(t),
    createTextNode: (t) => { const n = new FauxNode('span'); n.textContent = String(t); return n; },
    getElementById: (id) => byId[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  return { doc, byId, reg };
}

/* ── Fetch capture ── */

function createCtx(opts) {
  const requests = [];
  const fetchImpl = (url, options) => {
    requests.push({ url: String(url), method: options && options.method || 'GET', body: options && options.body || null });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  };
  const lsStore = {};
  const localStorage = {
    getItem: (k) => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: (k) => { delete lsStore[k]; }
  };

  const { doc, byId, reg } = makeDoc();
  // treeId comes from location.search
  const searchParams = new URLSearchParams(opts.search || '');
  const ctx = {
    console: { warn() {}, log() {}, error() {}, info() {} },
    Math, Number, Array, Object, String, Boolean, JSON, Date, isNaN,
    setTimeout: (fn) => { if (typeof fn === 'function') { try { fn(); } catch (e) {} } return 0; },
    clearTimeout: () => {},
    URLSearchParams, URL, encodeURIComponent: (s) => global.encodeURIComponent(s),
    fetch: fetchImpl,
    navigator: { userAgent: 'node-test' },
    crypto: { randomUUID: () => '11111111-2222-3333-4444-555555555555' }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.top = ctx;
  ctx.innerWidth = 1440;
  ctx.document = doc;
  ctx.location = {
    href: 'https://lovebud.pages.dev/pages/view.html' + (opts.search || ''),
    origin: 'https://lovebud.pages.dev',
    pathname: '/pages/view.html',
    search: opts.search || ''
  };
  ctx.window.location = ctx.location;
  try {
    Object.defineProperty(ctx, 'localStorage', { value: localStorage, configurable: true });
  } catch (e) { ctx.localStorage = localStorage; }

  vm.createContext(ctx);
  return { ctx, requests, localStorage, byId, reg };
}

function loadModules(ctx) {
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  vm.runInContext(read('js/viewer/public-canvas-init.js'), ctx);
}

/* ── Bridge stub ── */

function installBridgeStub(ctx, opts) {
  const bridge = {
    loadPublicTreeData: function (treeId) {
      if (opts.reject) return Promise.reject(new Error(opts.reject));
      if (opts.noTree) return Promise.resolve({ tree: null, memories: [] });
      if (opts.malformed) return Promise.resolve({});
      return Promise.resolve({
        tree: { id: treeId, title: opts.title || 'Test Tree', visibility: 'public' },
        memories: opts.memories || []
      });
    },
    normalizeForCanvas: function (tree, memories) {
      // mirror minimal normalized shape used by public-canvas-init
      return {
        treeData: tree ? { id: tree.id, title: tree.title || '러브트리', visibility: tree.visibility || 'public' } : { id: null },
        treeMemories: Array.isArray(memories) ? memories : []
      };
    }
  };
  ctx.window.LoveBudPublicCanvasBridge = bridge;
  // canvas-entry stub: setupPublicRoute / getPublicCanvasBridge / normalizePublicCanvasData
  ctx.window.LoveBudPublicViewerCanvasEntry = {
    setupPublicRoute: function () {
      var params = new URLSearchParams(ctx.location.search);
      return { treeId: params.get('treeId') };
    },
    getPublicCanvasBridge: function () { return bridge; },
    normalizePublicCanvasData: function (b, tree, memories) { return b.normalizeForCanvas(tree, memories); }
  };
  // public-canvas-init also references a few window helpers; provide safe no-ops
  ctx.window.LoveBudPublicCanvasErrorFallback = {
    appendMissingRouteState: function () {},
    handlePublicCanvasLoadFailure: function () {}
  };
  ctx.window.LoveBudTreeWorkspacePermission = undefined;
  return bridge;
}

/* ── Tests ── */

// Note: public-canvas-init.js auto-runs initPublicCanvas() on module load when
// document.readyState !== 'loading'. Our faux doc has readyState 'complete', so
// loading the module triggers the full load path. Bridge stub must be installed
// BEFORE loadModules().

test('1. successful active public tree load → exactly one view POST', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  // drain microtasks (fetch + promise chain)
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/api\/trees\/[^/]+\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'exactly one view POST');
  assert.match(viewPosts[0].url, /\/api\/trees\/tree-A\/views$/);
});

test('2. view POST payload: actorKey non-empty, actorKind anonymous, source public_tree_detail', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1);
  const body = JSON.parse(viewPosts[0].body);
  assert.ok(body.actorKey && body.actorKey.length > 0, 'actorKey non-empty');
  assert.equal(body.actorKind, 'anonymous');
  assert.equal(body.source, 'public_tree_detail');
});

test('3. repeated init via module reload → still one request per page lifecycle', async () => {
  // The recorder one-shot guard is per page lifecycle (module-level var).
  // Re-running initPublicCanvas directly is not exposed, so this test verifies
  // the recorder one-shot directly (see test 13). Here we confirm a single
  // module load yields exactly one POST even though the load path may call
  // multiple internal callbacks.
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'one POST despite multiple internal callbacks');
});

test('5. missing treeId → zero view POST', async () => {
  const { ctx, requests } = createCtx({ search: '' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 0);
});

test('6. bridge load reject → zero view POST', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, { reject: 'network failure' });
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 0);
});

test('7. malformed / no tree result → zero view POST', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, { noTree: true });
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 0, 'no tree → no view POST');
});

test('8. fetch reject → viewer initialization does not throw', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  // make fetch reject
  ctx.window.fetch = () => Promise.reject(new Error('network down'));
  let threw = false;
  try {
    loadModules(ctx);
  } catch (e) { threw = true; }
  assert.equal(threw, false, 'module load must not throw when fetch rejects');
  await new Promise((r) => setTimeout(r, 50));
  // recorder swallowed the rejection; no unhandled crash
});

test('9. same browser localStorage → same actorKey across recorder recreation', () => {
  const { ctx, localStorage } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  const key1 = ctx.window.LoveBudPublicTreeViewRecorder.getOrCreateViewActorKey();
  const key2 = ctx.window.LoveBudPublicTreeViewRecorder.getOrCreateViewActorKey();
  assert.equal(key1, key2, 'actorKey reused from localStorage');
  assert.ok(localStorage.getItem('lovebud_public_tree_view_actor_key_v1'), 'stored in localStorage');
  assert.ok(key1.startsWith('anon-'));
  assert.ok(key1.length <= 128, 'actorKey within server length limit');
});

test('10. localStorage unavailable → non-blocking fallback (no throw)', () => {
  const { ctx } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  // remove localStorage access to force catch path
  Object.defineProperty(ctx.window, 'localStorage', {
    get() { throw new Error('localStorage unavailable'); },
    configurable: true
  });
  loadModules(ctx);
  let key = null;
  let threw = false;
  try {
    key = ctx.window.LoveBudPublicTreeViewRecorder.getOrCreateViewActorKey();
  } catch (e) { threw = true; }
  assert.equal(threw, false, 'must not throw when localStorage unavailable');
  assert.ok(key && key.startsWith('anon-'), 'ephemeral fallback key generated');
});

test('11. active pages/view.html → recorder dependency present, legacy public-tree-viewer absent', () => {
  const html = read('pages/view.html');
  assert.ok(/js\/viewer\/public-tree-view-recorder\.js/.test(html), 'view.html must load recorder');
  assert.ok(!/js\/viewer\/public-tree-viewer\.js/.test(html), 'view.html must NOT load legacy public-tree-viewer.js');
  // recorder must load before init
  const recIdx = html.indexOf('public-tree-view-recorder.js');
  const initIdx = html.indexOf('public-canvas-init.js');
  assert.ok(recIdx > -1 && initIdx > -1 && recIdx < initIdx, 'recorder must load before public-canvas-init.js');
});

test('12. no requests to likes / comments / memories reactions', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  loadModules(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const forbidden = requests.filter((r) => /\/likes$/.test(r.url) || /\/comments$/.test(r.url) || /\/memories\/[^/]+\/reactions$/.test(r.url));
  assert.equal(forbidden.length, 0, 'no like/comment/moment-reaction requests');
});

test('13. recorder one-shot: recordPublicTreeView twice → one fetch', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  loadModules(ctx);
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  await new Promise((r) => setTimeout(r, 30));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'one-shot guard prevents duplicate POSTs for same treeId');
});

test('14. direct recorder call never throws on bad input', () => {
  const { ctx } = createCtx({ search: '?treeId=tree-A' });
  loadModules(ctx);
  let threw = false;
  try {
    ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView(null);
    ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('');
    ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView(undefined);
  } catch (e) { threw = true; }
  assert.equal(threw, false, 'null/empty treeId must be a no-op, not a throw');
});

/* ── #3599 hardening: double-evaluation / window-global state / stable key ── */

test('15. global marker blocks second script evaluation in same window', async () => {
  const { ctx } = createCtx({ search: '?treeId=tree-A' });
  // first evaluation installs API + marker
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  assert.equal(ctx.window.LoveBudPublicTreeViewRecorderLoaded, true, 'marker set after first eval');
  const apiFirst = ctx.window.LoveBudPublicTreeViewRecorder;
  assert.ok(apiFirst, 'API present after first eval');
  // second evaluation must short-circuit (no throw, no new object)
  let threw = false;
  try { vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx); } catch (e) { threw = true; }
  assert.equal(threw, false, 'second evaluation must not throw');
  assert.equal(ctx.window.LoveBudPublicTreeViewRecorder, apiFirst, 'API object identity preserved across duplicate eval');
  assert.equal(ctx.window.LoveBudPublicTreeViewRecorderLoaded, true, 'marker still set');
});

test('16. window-global state shape exists and is reused', () => {
  const { ctx } = createCtx({ search: '?treeId=tree-A' });
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  // state is created lazily on first use (no allocation before a real call)
  assert.equal(ctx.window.__lovebudPublicTreeViewRecorderState, undefined, 'state not allocated before first call');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  const state = ctx.window.__lovebudPublicTreeViewRecorderState;
  assert.ok(state, 'window-global state object created on first call');
  assert.ok(state.sentTreeIds && typeof state.sentTreeIds === 'object', 'sentTreeIds map present');
  assert.equal('ephemeralActorKey' in state, true, 'ephemeralActorKey field present');
  assert.equal(state.sentTreeIds['tree-A'], true, 'tree-A marked sent in window-global state');
  // duplicate script evaluation reuses the SAME state object (not a fresh one)
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  assert.equal(ctx.window.__lovebudPublicTreeViewRecorderState, state, 'state object reused across evals');
});

test('17. duplicate script evaluation → same tree still only one POST', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  // simulate the recorder <script> being evaluated twice (e.g. HMR / double include)
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  loadModulesInitOnly(ctx);
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'duplicate recorder eval does not add a second POST for same tree');
});

test('18. A → A yields exactly one POST (treeId-keyed one-shot)', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  await new Promise((r) => setTimeout(r, 30));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'A→A = 1 POST');
});

test('19. A → B → A yields exactly two POSTs', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-B');
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  await new Promise((r) => setTimeout(r, 30));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 2, 'A→B→A = 2 POSTs');
  const trees = viewPosts.map((r) => r.url.replace(/.*\/api\/trees\//, '').replace(/\/views$/, ''));
  assert.ok(trees.includes('tree-A'), 'tree-A posted');
  assert.ok(trees.includes('tree-B'), 'tree-B posted');
});

test('20. localStorage throw → ephemeral actor key created once and reused', () => {
  const { ctx } = createCtx({ search: '?treeId=tree-A' });
  // force localStorage access to throw on both read and write
  Object.defineProperty(ctx.window, 'localStorage', {
    get() { throw new Error('localStorage unavailable'); },
    configurable: true
  });
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  const k1 = ctx.window.LoveBudPublicTreeViewRecorder.getOrCreateViewActorKey();
  const k2 = ctx.window.LoveBudPublicTreeViewRecorder.getOrCreateViewActorKey();
  assert.ok(k1 && k1.startsWith('anon-'), 'ephemeral key generated');
  assert.equal(k1, k2, 'same key reused across calls despite localStorage throw');
  assert.ok(k1.length <= 128, 'key within 128-char limit');
});

test('21. fetch reject → no automatic retry within lifecycle', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  // reject AFTER recording the request, so we can assert the POST was attempted
  ctx.window.fetch = (url, options) => {
    requests.push({ url: String(url), method: options && options.method || 'GET', body: options && options.body || null });
    return Promise.reject(new Error('network down'));
  };
  let threw = false;
  try { loadModules(ctx); } catch (e) { threw = true; }
  assert.equal(threw, false, 'module load must not throw when fetch rejects');
  await new Promise((r) => setTimeout(r, 50));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'one POST attempted despite fetch reject');
  // re-trigger the active load path for the SAME tree → still no second POST
  ctx.window.LoveBudPublicTreeViewRecorder.recordPublicTreeView('tree-A');
  await new Promise((r) => setTimeout(r, 30));
  const viewPosts2 = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts2.length, 1, 'no automatic retry for already-sent treeId');
});

test('22. duplicate public-canvas-init evaluation → same tree still one POST', async () => {
  const { ctx, requests } = createCtx({ search: '?treeId=tree-A' });
  installBridgeStub(ctx, {});
  // load recorder once, then evaluate the active init module twice (HMR / re-include)
  vm.runInContext(read('js/viewer/public-tree-view-recorder.js'), ctx);
  vm.runInContext(read('js/viewer/public-canvas-init.js'), ctx);
  vm.runInContext(read('js/viewer/public-canvas-init.js'), ctx);
  await new Promise((r) => setTimeout(r, 60));
  const viewPosts = requests.filter((r) => r.method === 'POST' && /\/views$/.test(r.url));
  assert.equal(viewPosts.length, 1, 'duplicate public-canvas-init eval → same tree = 1 POST');
});

/* helper: load the active init module only (recorder already loaded separately) */
function loadModulesInitOnly(ctx) {
  vm.runInContext(read('js/viewer/public-canvas-init.js'), ctx);
}
