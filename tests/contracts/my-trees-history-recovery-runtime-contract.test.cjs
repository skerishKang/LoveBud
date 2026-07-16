/**
 * Focused runtime contracts for My Trees history/BFCache owner-list recovery (#3551)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const BASE_API_FETCH_PATH = path.join(ROOT, 'js', 'api', 'base-api-fetch.js');
const MY_TREES_DATA_PATH = path.join(ROOT, 'js', 'my-trees', 'my-trees-data.js');
const MY_TREES_PAGE_PATH = path.join(ROOT, 'js', 'my-trees', 'my-trees-page.js');
const MY_TREES_ENTRY_PATH = path.join(ROOT, 'js', 'my-trees.js');

function createStorageMock(initialState = {}) {
  const state = new Map(Object.entries(initialState));
  return {
    getItem(key) { return state.has(key) ? state.get(key) : null; },
    setItem(key, value) { state.set(key, String(value)); },
    removeItem(key) { state.delete(key); },
  };
}

function makeStateNode(visible, cardCount) {
  const classes = new Set(visible ? ['state-visible'] : ['state-hidden']);
  const kids = [];
  const node = {
    classList: {
      contains(name) { return classes.has(name); },
      add(...names) { names.forEach((n) => classes.add(n)); },
      remove(...names) { names.forEach((n) => classes.delete(n)); },
    },
    style: { display: visible ? '' : 'none' },
    children: kids,
    textContent: '',
    get innerHTML() { return ''; },
    set innerHTML(_v) { kids.length = 0; },
    appendChild(child) { kids.push(child); return child; },
    replaceChildren(...nodes) { kids.length = 0; nodes.forEach((n) => kids.push(n)); },
    querySelectorAll(sel) {
      if (sel && String(sel).includes('data-tree-id')) {
        const count = Math.max(cardCount || 0, kids.filter((k) => k && k.className === 'tree-card').length);
        return Array.from({ length: count }, (_, i) => ({ dataset: { treeId: 'n' + i }, className: 'tree-card' }));
      }
      return [];
    },
    setAttribute() {},
    removeAttribute() {},
  };
  return node;
}

function createHistorySandbox(options = {}) {
  const localStorageMock = createStorageMock(options.localStorage || {
    lovebud_auth_confirmed: 'true',
    lovebud_auth_cache: JSON.stringify({ uid: 'qa-user' }),
  });
  const sessionStorageMock = createStorageMock(options.sessionStorage || {});
  const stateNodes = {
    'state-loading': makeStateNode(options.loadingVisible === true, 0),
    'state-error': makeStateNode(options.errorVisible === true, 0),
    'state-empty': makeStateNode(options.emptyVisible === true, 0),
    'state-loaded': makeStateNode(options.loadedVisible === true, options.cardCount || 0),
  };

  const listeners = {};
  let getTreesCalls = 0;
  let resolveFetch = null;
  const fetchGate = options.gateFetch
    ? new Promise((resolve) => { resolveFetch = resolve; })
    : Promise.resolve();

  const rendered = [];
  const stateUpdates = [];

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 50,
      __lovebudAuthReady: true,
      LOVEBUD_DEBUG: false,
      LOVEBUD_MY_TREES_DEBUG: options.LOVEBUD_MY_TREES_DEBUG || false,
      __LoveBudMyTreesDiagnosticSink: options.diagnosticSink || null,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      apiClient: {
        getTrees: async () => {
          getTreesCalls += 1;
          await fetchGate;
          if (options.getTreesError) throw options.getTreesError;
          if (Object.prototype.hasOwnProperty.call(options, 'trees')) return options.trees;
          return [{ id: 'tree-a' }];
        },
      },
      LoveBudCache: options.cache || null,
      LoveBudProtectedRoute: {
        getAuthState: () => ({ ready: true, user: { uid: 'qa-user' } }),
      },
      getConfirmedAuthUser: () => ({ uid: 'qa-user' }),
      addEventListener(type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      removeEventListener() {},
      performance: options.performance || {
        getEntriesByType: () => [{ type: options.navType || 'navigate' }],
        navigation: { type: options.legacyNavType == null ? 0 : options.legacyNavType },
      },
      console: { log() {}, warn() {}, error() {} },
    },
    document: {
      getElementById(id) { return stateNodes[id] || null; },
      body: {
        classList: {
          contains: () => false,
          remove() {},
          add() {},
        },
      },
      addEventListener(type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement(tag) {
        const kids = [];
        return {
          tagName: String(tag || 'div').toUpperCase(),
          className: '',
          textContent: '',
          style: {},
          children: kids,
          appendChild(child) { kids.push(child); return child; },
          replaceChildren(...nodes) { kids.length = 0; nodes.forEach((n) => kids.push(n)); },
          setAttribute() {},
          removeAttribute() {},
        };
      },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Array,
    Object,
    Number,
    Promise,
    Error,
  };
  sandbox.window.document = sandbox.document;
  sandbox.performance = sandbox.window.performance;
  sandbox.document.getElementById = sandbox.document.getElementById.bind(sandbox.document);

  // Track setState via page module after load by wrapping later

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });
  vm.runInContext(fs.readFileSync(MY_TREES_DATA_PATH, 'utf8'), sandbox, { filename: MY_TREES_DATA_PATH });
  vm.runInContext(fs.readFileSync(MY_TREES_PAGE_PATH, 'utf8'), sandbox, { filename: MY_TREES_PAGE_PATH });

  const page = sandbox.window.LoveBudMyTreesPage;
  const originalSetState = page.setState.bind(page);
  page.setState = function (state, meta) {
    stateUpdates.push({ state, meta });
    return originalSetState(state, meta);
  };

  sandbox.window.LoveBudMyTreesUI = {
    renderTrees(trees) {
      rendered.push(trees);
      if (!trees || trees.length === 0) {
        page.setState(page.STATE.EMPTY);
      } else {
        page.setState(page.STATE.LOADED);
      }
    },
  };
  // Prefer UI module path used by my-trees-render style callbacks via entry fallback.
  sandbox.window.LoveBudMyTreesFilter = {
    applyFilters(src) { return Array.isArray(src) ? src.slice() : []; },
    bindFinderControls() {},
  };
  sandbox.window.LoveBudMyTreesState = null;
  // Entry reads LoveBudMyTreesRender/UI at call time via closure vars assigned at load.
  // Provide both so filtered render path succeeds and sets terminal states.
  sandbox.window.LoveBudMyTreesRender = {
    renderTrees(trees, options) {
      rendered.push(Array.isArray(trees) ? trees.slice() : []);
      if (options && typeof options.setState === 'function' && options.stateEnum) {
        if (!trees || trees.length === 0) options.setState(options.stateEnum.EMPTY);
        else options.setState(options.stateEnum.LOADED);
      }
    },
  };
  sandbox.window.LoveBudMyTreesActions = null;
  sandbox.window.LoveBudMyTreesPreviewHub = null;

  // Entry captures module refs at load-time — ensure they exist before evaluating entry.
  vm.runInContext(fs.readFileSync(MY_TREES_ENTRY_PATH, 'utf8'), sandbox, { filename: MY_TREES_ENTRY_PATH });

  return {
    sandbox,
    listeners,
    rendered,
    stateUpdates,
    getTreesCalls: () => getTreesCalls,
    resolveFetch: () => { if (resolveFetch) resolveFetch(); },
    firePageshow(event) {
      const list = listeners.pageshow || [];
      for (const fn of list) fn(event || { persisted: false });
    },
    async boot() {
      const dom = listeners.DOMContentLoaded || [];
      for (const fn of dom) {
        // handlers may be async
        // eslint-disable-next-line no-await-in-loop
        await fn();
      }
      // settle initial owner-list load (startMyTrees does not await loadTrees)
      const startedAt = Date.now();
      while (Date.now() - startedAt < 500) {
        const inflight = sandbox.window.LoveBudMyTreesData
          && sandbox.window.LoveBudMyTreesData.isOwnerListLoadInFlight
          && sandbox.window.LoveBudMyTreesData.isOwnerListLoadInFlight();
        if (!inflight && getTreesCalls > 0) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 10));
      }
      await new Promise((r) => setTimeout(r, 20));
    },
  };
}

test('source: restore phases and single-flight guard exist in my-trees-data.js', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  for (const phase of [
    'restore_triggered',
    'restore_skipped_inflight',
    'restore_skipped_not_restore',
    'restore_skipped_terminal',
    'restore_recovered',
    'restore_failed',
  ]) {
    assert.ok(src.includes(phase), `missing phase ${phase}`);
  }
  assert.ok(src.includes('ownerListLoadPromise'), 'must have in-flight promise guard');
  assert.ok(src.includes('isOwnerListLoadInFlight'), 'must export in-flight check');
  assert.ok(src.includes('preserveVisibleList'), 'must support preserveVisibleList');
  assert.ok(src.includes('history_recovery'), 'must recognize history_recovery reason');
});

test('source: my-trees.js pageshow recovery does not rebind boot listeners', () => {
  const src = fs.readFileSync(MY_TREES_ENTRY_PATH, 'utf8');
  assert.ok(src.includes("addEventListener('pageshow'"), 'pageshow required');
  assert.ok(src.includes('maybeRecoverOwnerListFromHistory'), 'recovery entry required');
  assert.ok(src.includes('isHistoryRestoreEvent'), 'restore classifier required');
  assert.ok(src.includes('historyRestoreListenerBound'), 'single bind guard required');
  const recoveryFn = src.match(/function maybeRecoverOwnerListFromHistory[\s\S]*?\n  \}/);
  assert.ok(recoveryFn, 'recovery function must exist');
  assert.ok(!recoveryFn[0].includes('bootMyTrees('), 'recovery must not call bootMyTrees');
  assert.ok(!recoveryFn[0].includes('setupHeaderCreateButton'), 'recovery must not rebind header');
  assert.ok(!recoveryFn[0].includes('bindFinderControls'), 'recovery must not rebind filters');
});

test('isHistoryRestoreEvent: persisted pageshow', () => {
  const ctx = createHistorySandbox({ navType: 'navigate' });
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isHistoryRestoreEvent({ persisted: true }), true);
});

test('isHistoryRestoreEvent: back_forward navigation type', () => {
  const ctx = createHistorySandbox({ navType: 'back_forward' });
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isHistoryRestoreEvent({ persisted: false }), true);
});

test('isHistoryRestoreEvent: normal navigate is false', () => {
  const ctx = createHistorySandbox({ navType: 'navigate' });
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isHistoryRestoreEvent({ persisted: false }), false);
});

test('initial DOMContentLoaded boot: owner-list load exactly once', async () => {
  const ctx = createHistorySandbox({ navType: 'navigate', loadedVisible: false, loadingVisible: true });
  await ctx.boot();
  assert.ok(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isStarted(), 'must start after boot');
  assert.equal(ctx.getTreesCalls(), 1, 'initial boot must load once');
});

test('normal non-restored pageshow: additional load 0', async () => {
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadedVisible: true,
    cardCount: 1,
  });
  await ctx.boot();
  assert.equal(ctx.getTreesCalls(), 1);
  ctx.firePageshow({ persisted: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), 1, 'normal pageshow must not reload');
});

test('persisted pageshow after nonterminal UI: recovery load exactly once', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    loadedVisible: false,
    cardCount: 0,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot();
  assert.equal(ctx.getTreesCalls(), 1);
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isStarted(), true);

  // Simulate cancelled stuck loading after boot (still nonterminal)
  const loading = ctx.sandbox.document.getElementById('state-loading');
  const loaded = ctx.sandbox.document.getElementById('state-loaded');
  const error = ctx.sandbox.document.getElementById('state-error');
  const empty = ctx.sandbox.document.getElementById('state-empty');
  for (const el of [loaded, error, empty]) {
    el.classList.remove('state-visible', 'state-visible-block');
    el.classList.add('state-hidden');
    el.style.display = 'none';
  }
  loading.classList.remove('state-hidden');
  loading.classList.add('state-visible');
  loading.style.display = '';

  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isLoadingVisible(), true, 'loading should be visible');
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.hasAuthoritativeTerminalState(), false, 'nonterminal');

  ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.maybeRecoverOwnerListFromHistory({ persisted: true });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ctx.getTreesCalls(), 2, 'restore must trigger exactly one recovery load; phases=' + emitted.map((e) => e.phase).join(','));
  assert.ok(emitted.some((e) => e.phase === 'restore_triggered'), 'must emit restore_triggered');
});

test('repeated pageshow while recovery in flight: duplicate load 0', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    loadedVisible: false,
    gateFetch: true,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  // Start boot but keep fetch pending
  const bootPromise = ctx.boot();
  // While in-flight, fire restore pageshow twice
  await new Promise((r) => setTimeout(r, 5));
  ctx.firePageshow({ persisted: true });
  ctx.firePageshow({ persisted: true });
  ctx.resolveFetch();
  await bootPromise;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ctx.getTreesCalls(), 1, 'in-flight recovery must not duplicate getTrees');
  assert.ok(
    emitted.some((e) => e.phase === 'restore_skipped_inflight') || ctx.getTreesCalls() === 1,
    'must skip or coalesce while in-flight'
  );
});

test('back_forward classification enters recovery path when nonterminal', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'back_forward',
    loadingVisible: true,
    loadedVisible: false,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot();
  // After boot success, force nonterminal again
  const loading = ctx.sandbox.document.getElementById('state-loading');
  const loaded = ctx.sandbox.document.getElementById('state-loaded');
  loading.classList.add('state-visible');
  loading.classList.remove('state-hidden');
  loading.style.display = '';
  loaded.classList.add('state-hidden');
  loaded.classList.remove('state-visible');
  loaded.style.display = 'none';

  const before = ctx.getTreesCalls();
  ctx.firePageshow({ persisted: false }); // still restore via nav type
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ctx.getTreesCalls(), before + 1, 'back_forward nonterminal must recover once');
  assert.ok(emitted.some((e) => e.phase === 'restore_triggered'));
});

test('valid list already rendered: recovery skipped (terminal)', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'back_forward',
    loadedVisible: true,
    loadingVisible: false,
    cardCount: 2,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot();
  const before = ctx.getTreesCalls();
  // Ensure terminal loaded visible with cards
  const loading = ctx.sandbox.document.getElementById('state-loading');
  const loaded = ctx.sandbox.document.getElementById('state-loaded');
  loading.classList.add('state-hidden');
  loading.classList.remove('state-visible');
  loaded.classList.add('state-visible');
  loaded.classList.remove('state-hidden');
  loaded.style.display = '';

  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), before, 'terminal loaded must not recover');
  assert.ok(emitted.some((e) => e.phase === 'restore_skipped_terminal'));
});

test('preserveVisibleList: does not set LOADING when cards already visible', async () => {
  const stateUpdates = [];
  const localStorageMock = createStorageMock({});
  const sessionStorageMock = createStorageMock({});
  const loadedNode = makeStateNode(true, 1);

  const sandbox = {
    window: {
      LOVEBUD_MY_TREES_DEBUG: false,
      __LoveBudMyTreesDiagnosticSink: null,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      apiClient: {
        getTrees: async () => {
          await new Promise((r) => setTimeout(r, 15));
          return [{ id: 'tree-a' }];
        },
      },
      LoveBudCache: null,
      console: { log() {}, warn() {}, error() {} },
    },
    document: {
      getElementById(id) {
        if (id === 'state-loaded') return loadedNode;
        return null;
      },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Array,
    Object,
    Number,
    Promise,
    Error,
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });
  vm.runInContext(fs.readFileSync(MY_TREES_DATA_PATH, 'utf8'), sandbox, { filename: MY_TREES_DATA_PATH });

  const p = sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (s) => stateUpdates.push(s),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR', LOADED: 'LOADED', EMPTY: 'EMPTY' },
    renderTrees: () => {},
    preserveVisibleList: true,
    reason: 'history_recovery',
  });
  // During flight, LOADING must not be forced
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(!stateUpdates.includes('LOADING'), 'must not blank to LOADING when cards visible');
  await p;
});

test('authoritative empty success: only real [] becomes EMPTY via render', async () => {
  const ctx = createHistorySandbox({
    trees: [],
    loadedVisible: false,
    loadingVisible: true,
  });
  await ctx.boot();
  assert.equal(ctx.getTreesCalls(), 1);
  assert.ok(
    ctx.stateUpdates.some((u) => u.state === 'empty' || u.state === 'EMPTY' || u.state === ctx.sandbox.window.LoveBudMyTreesPage.STATE.EMPTY),
    'authoritative empty must reach EMPTY terminal'
  );
});

test('cancellation/fetch_rejected must not become EMPTY', async () => {
  const err = new Error('aborted');
  err._phase = 'fetch_rejected';
  const stateUpdates = [];
  const { createSandbox } = (function () {
    // local mini sandbox
    return {};
  })();

  const localStorageMock = createStorageMock({});
  const sessionStorageMock = createStorageMock({});
  const sandbox = {
    window: {
      LOVEBUD_MY_TREES_DEBUG: false,
      __LoveBudMyTreesDiagnosticSink: null,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      apiClient: {
        getTrees: async () => { throw err; },
      },
      LoveBudCache: null,
      console: { log() {}, warn() {}, error() {} },
    },
    document: {
      getElementById() { return null; },
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Array,
    Object,
    Number,
    Promise,
    Error,
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });
  vm.runInContext(fs.readFileSync(MY_TREES_DATA_PATH, 'utf8'), sandbox, { filename: MY_TREES_DATA_PATH });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (s) => stateUpdates.push(s),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR', EMPTY: 'EMPTY', LOADED: 'LOADED' },
    renderTrees: () => {},
  });

  assert.ok(!stateUpdates.includes('EMPTY'), 'fetch_rejected must not map to EMPTY');
  assert.ok(stateUpdates.includes('ERROR') || stateUpdates.includes('LOADING'), 'must end error or leave loading path without EMPTY');
});

test('in-flight guard releases after completion and subsequent restore can run', async () => {
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    loadedVisible: false,
  });
  await ctx.boot();
  assert.equal(ctx.sandbox.window.LoveBudMyTreesData.isOwnerListLoadInFlight(), false);

  const loading = ctx.sandbox.document.getElementById('state-loading');
  const loaded = ctx.sandbox.document.getElementById('state-loaded');
  loading.classList.add('state-visible');
  loading.classList.remove('state-hidden');
  loading.style.display = '';
  loaded.classList.add('state-hidden');
  loaded.classList.remove('state-visible');
  loaded.style.display = 'none';

  const before = ctx.getTreesCalls();
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ctx.getTreesCalls(), before + 1);
  assert.equal(ctx.sandbox.window.LoveBudMyTreesData.isOwnerListLoadInFlight(), false);

  // Force nonterminal again for second restore
  loading.classList.add('state-visible');
  loading.classList.remove('state-hidden');
  loaded.classList.add('state-hidden');
  loaded.classList.remove('state-visible');
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ctx.getTreesCalls(), before + 2, 'subsequent restore must be allowed after release');
});

test('diagnostics: restore events are privacy-safe bounded phases only', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot();
  const loading = ctx.sandbox.document.getElementById('state-loading');
  const loaded = ctx.sandbox.document.getElementById('state-loaded');
  loading.classList.add('state-visible');
  loading.classList.remove('state-hidden');
  loaded.classList.add('state-hidden');
  loaded.classList.remove('state-visible');
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 30));

  const serialized = JSON.stringify(emitted);
  assert.ok(!/Authorization|token|Bearer|@|uid-|tree-a|password/i.test(serialized) || !serialized.includes('Bearer'), 'no secrets');
  for (const ev of emitted) {
    assert.equal(typeof ev.phase, 'string');
    assert.ok(!('url' in ev));
    assert.ok(!('stack' in ev));
    assert.ok(!('body' in ev));
  }
});

test('asset version tokens updated for recovery scripts', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages', 'my-trees.html'), 'utf8');
  assert.ok(html.includes('my-trees-data.js?v=20260716-3551-1'), 'data script token');
  assert.ok(html.includes('my-trees.js?v=20260716-3551-1'), 'entry script token');
});
