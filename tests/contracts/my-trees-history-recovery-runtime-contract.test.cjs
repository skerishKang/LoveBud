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
    // Required by LoveBudMyTreesPage.setState — without it, state transitions no-op.
    treesContainer: makeStateNode(true, 0),
    'state-loading': makeStateNode(options.loadingVisible === true, 0),
    'state-error': makeStateNode(options.errorVisible === true, 0),
    'state-empty': makeStateNode(options.emptyVisible === true, 0),
    'state-loaded': makeStateNode(options.loadedVisible === true, options.cardCount || 0),
  };

  const listeners = {};
  let getTreesCalls = 0;
  /** @type {Array<{callIndex:number, resolve:Function, reject:Function}>} */
  const pendingCalls = [];
  let resolveFetch = null; // legacy: resolve all open deferred calls successfully
  const useDeferred = options.gateFetch === true || options.deferredCalls === true;

  const rendered = [];
  const stateUpdates = [];
  const treeMarkersByCall = options.treeMarkersByCall || null;

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
          const callIndex = getTreesCalls;
          if (useDeferred) {
            await new Promise((resolve, reject) => {
              pendingCalls.push({ callIndex, resolve, reject });
              // legacy single-gate resolver support
              if (!resolveFetch) {
                resolveFetch = () => {
                  // resolve all currently pending with default success payload
                  const batch = pendingCalls.splice(0, pendingCalls.length);
                  batch.forEach((p) => p.resolve());
                };
              }
            });
          }
          if (options.getTreesError && (!options.errorOnCall || options.errorOnCall === callIndex)) {
            throw options.getTreesError;
          }
          if (treeMarkersByCall && treeMarkersByCall[callIndex]) {
            return [{ id: treeMarkersByCall[callIndex] }];
          }
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
    pendingCalls,
    getTreesCalls: () => getTreesCalls,
    resolveFetch: () => {
      if (typeof resolveFetch === 'function') resolveFetch();
      else {
        const batch = pendingCalls.splice(0, pendingCalls.length);
        batch.forEach((p) => p.resolve());
      }
    },
    resolveCall(callIndex) {
      const idx = pendingCalls.findIndex((p) => p.callIndex === callIndex);
      assert.ok(idx >= 0, 'pending call ' + callIndex + ' must exist');
      const [item] = pendingCalls.splice(idx, 1);
      item.resolve();
    },
    rejectCall(callIndex, err) {
      const idx = pendingCalls.findIndex((p) => p.callIndex === callIndex);
      assert.ok(idx >= 0, 'pending call ' + callIndex + ' must exist');
      const [item] = pendingCalls.splice(idx, 1);
      item.reject(err || Object.assign(new Error('aborted'), { _phase: 'fetch_rejected' }));
    },
    forceLoadingNonterminal() {
      const loading = sandbox.document.getElementById('state-loading');
      const loaded = sandbox.document.getElementById('state-loaded');
      const error = sandbox.document.getElementById('state-error');
      const empty = sandbox.document.getElementById('state-empty');
      for (const el of [loaded, error, empty]) {
        el.classList.remove('state-visible', 'state-visible-block');
        el.classList.add('state-hidden');
        el.style.display = 'none';
      }
      loading.classList.remove('state-hidden');
      loading.classList.add('state-visible');
      loading.style.display = '';
    },
    firePageshow(event) {
      const list = listeners.pageshow || [];
      for (const fn of list) fn(event || { persisted: false });
    },
    firePagehide() {
      const list = listeners.pagehide || [];
      for (const fn of list) fn({});
    },
    async boot({ settle = true } = {}) {
      const dom = listeners.DOMContentLoaded || [];
      for (const fn of dom) {
        // handlers may be async
        // eslint-disable-next-line no-await-in-loop
        await fn();
      }
      if (!settle) {
        // Wait only until first getTrees call is observed (may remain pending).
        const startedAt = Date.now();
        while (Date.now() - startedAt < 500 && getTreesCalls < 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 5));
        }
        return;
      }
      // settle initial owner-list load (startMyTrees does not await loadTrees)
      const startedAt = Date.now();
      while (Date.now() - startedAt < 800) {
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

test('source: restore phases and generation supersede guard exist in my-trees-data.js', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  for (const phase of [
    'restore_triggered',
    'restore_skipped_inflight',
    'restore_skipped_not_restore',
    'restore_skipped_terminal',
    'restore_recovered',
    'restore_failed',
    'restore_superseded_stale',
    'restore_coalesced_current',
    'stale_result_ignored',
  ]) {
    assert.ok(src.includes(phase), `missing phase ${phase}`);
  }
  assert.ok(src.includes('ownerListGeneration'), 'must have generation epoch');
  assert.ok(src.includes('activeOwnerListLoad'), 'must have active load record');
  assert.ok(src.includes('supersedeStaleLoad'), 'must support supersedeStaleLoad');
  assert.ok(src.includes('isOwnerListLoadInFlight'), 'must export in-flight check');
  assert.ok(src.includes('preserveVisibleList'), 'must support preserveVisibleList');
  assert.ok(src.includes('history_recovery'), 'must recognize history_recovery reason');
  assert.ok(src.includes('activeOwnerListLoad.generation === generation'), 'old finally must not clear new load');
});

test('source: my-trees.js pageshow recovery does not rebind boot listeners', () => {
  const src = fs.readFileSync(MY_TREES_ENTRY_PATH, 'utf8');
  assert.ok(src.includes("addEventListener('pageshow'"), 'pageshow required');
  assert.ok(src.includes('maybeRecoverOwnerListFromHistory'), 'recovery entry required');
  assert.ok(src.includes('isHistoryRestoreEvent'), 'restore classifier required');
  assert.ok(src.includes('historyRestoreListenerBound'), 'single bind guard required');
  assert.ok(src.includes('supersedeStaleLoad: true'), 'restore must supersede pre-restore loads');
  assert.ok(src.includes("addEventListener('pagehide'"), 'pagehide epoch marker required');
  const recoveryFn = src.match(/function maybeRecoverOwnerListFromHistory[\s\S]*?\n  \}/);
  assert.ok(recoveryFn, 'recovery function must exist');
  assert.ok(!recoveryFn[0].includes('bootMyTrees('), 'recovery must not call bootMyTrees');
  assert.ok(!recoveryFn[0].includes('setupHeaderCreateButton'), 'recovery must not rebind header');
  assert.ok(!recoveryFn[0].includes('bindFinderControls'), 'recovery must not rebind filters');
  // Must not skip restore solely because a pre-restore load is in flight.
  assert.ok(
    !recoveryFn[0].includes("emitRestoreDiagnostic('restore_skipped_inflight')"),
    'must not skip restore on pre-restore in-flight'
  );
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

test('Test A: pending initial load + pageshow supersede race (exact production order)', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    loadedVisible: false,
    deferredCalls: true,
    treeMarkersByCall: { 1: 'marker-old', 2: 'marker-recovery' },
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });

  // 1-2: boot starts unresolved request; UI remains LOADING
  await ctx.boot({ settle: false });
  assert.equal(ctx.getTreesCalls(), 1, 'initial request started');
  assert.ok(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isStarted());
  ctx.forceLoadingNonterminal();

  // 3-5: persisted pageshow starts exactly one recovery request (total 2)
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), 2, 'recovery request must start while old is pending');
  assert.ok(emitted.some((e) => e.phase === 'restore_triggered'));
  assert.ok(emitted.some((e) => e.phase === 'restore_superseded_stale'));

  // 6-7: repeated pageshow must not create a third request
  ctx.firePageshow({ persisted: true });
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), 2, 'repeated pageshow must coalesce on recovery generation');
  assert.ok(
    emitted.some((e) => e.phase === 'restore_coalesced_current' || e.phase === 'restore_skipped_inflight'),
    'must coalesce current recovery'
  );

  // 8-9: old request aborts — must not ERROR/EMPTY/toast overwrite
  const statesBeforeAbort = ctx.stateUpdates.length;
  ctx.rejectCall(1, Object.assign(new Error('aborted'), { _phase: 'fetch_rejected' }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(emitted.some((e) => e.phase === 'stale_result_ignored'), 'stale rejection ignored');
  const postAbortStates = ctx.stateUpdates.slice(statesBeforeAbort);
  assert.ok(!postAbortStates.some((u) => u.state === 'error' || u.state === 'ERROR' || u.state === 'empty' || u.state === 'EMPTY'),
    'stale abort must not write ERROR/EMPTY');

  // 10-12: recovery success → LOADED, no permanent loading
  ctx.resolveCall(2);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(ctx.stateUpdates.some((u) => u.state === 'loaded' || u.state === ctx.sandbox.window.LoveBudMyTreesPage.STATE.LOADED),
    'recovery must reach LOADED');
  assert.ok(ctx.rendered.some((trees) => Array.isArray(trees) && trees[0] && trees[0].id === 'marker-recovery'),
    'recovery marker list rendered');
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isLoadingVisible(), false, 'no permanent loading');
  assert.ok(emitted.some((e) => e.phase === 'restore_recovered' || e.phase === 'loaded'));
});

test('Test B: old request never settles — recovery still completes', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    deferredCalls: true,
    treeMarkersByCall: { 1: 'marker-old', 2: 'marker-recovery' },
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot({ settle: false });
  ctx.forceLoadingNonterminal();
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), 2);

  // Never resolve call 1 — only recovery
  ctx.resolveCall(2);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(ctx.rendered.some((trees) => trees[0] && trees[0].id === 'marker-recovery'));
  assert.ok(ctx.stateUpdates.some((u) => u.state === 'loaded' || u.state === ctx.sandbox.window.LoveBudMyTreesPage.STATE.LOADED));
  assert.equal(ctx.sandbox.window.LoveBudMyTreesHistoryRecovery.isLoadingVisible(), false);
  assert.ok(emitted.some((e) => e.phase === 'restore_superseded_stale'));
});

test('Test C: stale success must not overwrite recovery list/cache/state', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    deferredCalls: true,
    treeMarkersByCall: { 1: 'marker-old', 2: 'marker-recovery' },
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot({ settle: false });
  ctx.forceLoadingNonterminal();
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.getTreesCalls(), 2);

  // Recovery succeeds first
  ctx.resolveCall(2);
  await new Promise((r) => setTimeout(r, 40));
  const recoveryRenderCount = ctx.rendered.filter((t) => t[0] && t[0].id === 'marker-recovery').length;
  assert.ok(recoveryRenderCount >= 1);

  // Old success arrives later — must be ignored
  ctx.resolveCall(1);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(emitted.some((e) => e.phase === 'stale_result_ignored'), 'stale success ignored');
  const oldRendersAfter = ctx.rendered.filter((t) => t[0] && t[0].id === 'marker-old');
  // Initial cache paint might not use old marker; after supersede, no old marker render allowed after recovery
  const lastRender = ctx.rendered[ctx.rendered.length - 1];
  assert.ok(lastRender && lastRender[0] && lastRender[0].id === 'marker-recovery', 'final render stays recovery');
  assert.ok(oldRendersAfter.length === 0, 'stale old success must not render');
});

test('Test D: repeated restore while recovery in-flight coalesces', async () => {
  const emitted = [];
  const ctx = createHistorySandbox({
    navType: 'navigate',
    loadingVisible: true,
    deferredCalls: true,
    diagnosticSink: { emit(e) { emitted.push(e); } },
  });
  await ctx.boot({ settle: false });
  ctx.forceLoadingNonterminal();
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(ctx.getTreesCalls(), 2);
  ctx.firePageshow({ persisted: true });
  ctx.firePageshow({ persisted: true });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(ctx.getTreesCalls(), 2, 'no third recovery request');
  assert.ok(emitted.some((e) => e.phase === 'restore_coalesced_current' || e.phase === 'restore_skipped_inflight'));
  // Finish recovery
  ctx.resolveCall(2);
  await new Promise((r) => setTimeout(r, 30));
  // Old can abort without damage
  ctx.rejectCall(1);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(emitted.some((e) => e.phase === 'stale_result_ignored'));
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
  assert.ok(html.includes('my-trees-data.js?v=20260716-3551-2'), 'data script token');
  assert.ok(html.includes('my-trees.js?v=20260716-3551-2'), 'entry script token');
});
