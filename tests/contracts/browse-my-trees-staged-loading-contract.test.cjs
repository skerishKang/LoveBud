/**
 * LoveBud — Browse + My Trees Staged Loading Contract
 * (Issue #3693, Parent #3688 child 3)
 *
 * EXECUTED_FAKE: Executes production manager code (createBrowseLoadingManager,
 * createMyTreesLoadingManager) and preview-state hydration/degradation logic
 * in node:vm with a fake DOM and deterministic fake clock. Asserts timed state
 * transitions, hub degradation/recovery, and DOM-stage visibility without real
 * setTimeout, network, or browser.
 */
'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

function createFakeClock() {
  var now = 0;
  var timers = [];
  var nextId = 1;

  function fakeSetTimeout(cb, ms) {
    var id = nextId++;
    timers.push({ id: id, fireAt: now + ms, cb: cb });
    timers.sort(function (a, b) { return a.fireAt - b.fireAt; });
    return id;
  }

  function fakeClearTimeout(id) {
    timers = timers.filter(function (t) { return t.id !== id; });
  }

  function advance(ms) {
    if (ms <= 0) return;
    var target = now + ms;
    var fired = 0;
    while (timers.length > 0 && timers[0].fireAt <= target) {
      var timer = timers.shift();
      now = timer.fireAt;
      timer.cb();
      fired++;
    }
    now = target;
    return fired;
  }

  function getNow() { return now; }
  function pendingCount() { return timers.length; }
  function clearAll() { timers = []; }

  return {
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    advance: advance,
    now: getNow,
    pendingCount: pendingCount,
    clearAll: clearAll
  };
}

function createFakeElement(tag, className) {
  var el = {
    tagName: (tag || 'DIV').toUpperCase(),
    className: className || '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    _attrs: {},
    _children: [],
    _events: {},
    style: {},
    firstChild: null,
    parentNode: null,
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    appendChild: function (child) {
      child.parentNode = this;
      this._children.push(child);
      this.firstChild = this._children[0] || null;
      return child;
    },
    removeChild: function (child) {
      var i = this._children.indexOf(child);
      if (i !== -1) this._children.splice(i, 1);
      child.parentNode = null;
      this.firstChild = this._children[0] || null;
      return child;
    },
    replaceChildren: function () {
      this._children.forEach(function (c) { c.parentNode = null; });
      this._children = [];
      this.firstChild = null;
    },
    addEventListener: function (ev, cb) {
      if (!this._events[ev]) this._events[ev] = [];
      this._events[ev].push(cb);
    },
    dispatchEvent: function (ev) {
      var handlers = this._events[ev && ev.type];
      if (handlers) handlers.slice().forEach(function (h) { h(ev); });
    },
    classList: {
      _classes: (className || '').split(' ').filter(Boolean),
      add: function () {
        for (var i = 0; i < arguments.length; i++) {
          if (this._classes.indexOf(arguments[i]) === -1) this._classes.push(arguments[i]);
        }
      },
      remove: function () {
        for (var i = 0; i < arguments.length; i++) {
          var idx = this._classes.indexOf(arguments[i]);
          if (idx !== -1) this._classes.splice(idx, 1);
        }
      },
      contains: function (c) { return this._classes.indexOf(c) !== -1; }
    },
    querySelector: function (sel) {
      if (!sel) return null;
      var selectors = sel.split(',').map(function (s) { return s.trim(); });
      for (var s = 0; s < selectors.length; s++) {
        var selClass = selectors[s].replace(/^\./, '');
        for (var i = 0; i < this._children.length; i++) {
          var child = this._children[i];
          if (child.className && child.className.split(' ').indexOf(selClass) !== -1) return child;
        }
      }
      return null;
    },
    querySelectorAll: function () { return []; }
  };
  return el;
}

function createBrowseFakeContext(clock) {
  var spinnerEl = createFakeElement('span', 'lt-spinner');
  var copyEl = createFakeElement('span', 'browse-loading-copy');
  var errorHeadingEl = createFakeElement('p', 'lt-error-heading');
  var errorBodyEl = createFakeElement('p', 'lt-error-body');
  var retryBtnEl = createFakeElement('button', 'lt-retry-btn lt-error-retry-btn');

  var statusEl = createFakeElement('div', '');
  statusEl.hidden = true;
  statusEl.appendChild(spinnerEl);
  statusEl.appendChild(copyEl);
  statusEl.appendChild(errorHeadingEl);
  statusEl.appendChild(errorBodyEl);
  statusEl.appendChild(retryBtnEl);

  var fakeDoc = {
    getElementById: function () { return statusEl; },
    createElement: function (tag) { return createFakeElement(tag); },
    createTextNode: function (text) { return { textContent: text, parentNode: null }; }
  };

  var fakeWin = {
    document: fakeDoc,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    CustomEvent: function (type, opts) { this.type = type; this.bubbles = opts && opts.bubbles; },
    t: function (k) {
      var dict = {
        'search.loadingPublicTrees': 'Loading public trees...',
        'loading.long.wait': 'This is taking longer than usual...',
        'loading.error.primary': 'Error',
        'loading.error.body': 'Something went wrong',
        'loading.retry.action': 'Retry'
      };
      return dict[k] || k;
    }
  };

  return {
    statusEl: statusEl,
    spinnerEl: spinnerEl,
    copyEl: copyEl,
    errorHeadingEl: errorHeadingEl,
    errorBodyEl: errorBodyEl,
    retryBtnEl: retryBtnEl,
    context: {
      window: fakeWin,
      global: fakeWin,
      document: fakeDoc,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      CustomEvent: fakeWin.CustomEvent
    }
  };
}

function createMyTreesFakeContext(clock) {
  var loadingTextEl = createFakeElement('span', 'loading-text');
  var spinnerEl = createFakeElement('div', 'lt-spinner');

  var loadingEl = createFakeElement('div', 'trees-loading');
  loadingEl.appendChild(loadingTextEl);
  loadingEl.appendChild(spinnerEl);

  var errorEl = createFakeElement('div', 'error-state');
  var errorH2 = createFakeElement('h2', '');
  var errorP = createFakeElement('p', '');
  errorEl.appendChild(errorH2);
  errorEl.appendChild(errorP);

  var emptyEl = createFakeElement('div', 'empty-state');
  var loadedEl = createFakeElement('div', 'loaded-state');
  var containerEl = createFakeElement('div', '');

  var elements = {
    'state-loading': loadingEl,
    'state-error': errorEl,
    'state-empty': emptyEl,
    'state-loaded': loadedEl,
    'treesContainer': containerEl
  };

  var fakeDoc = {
    getElementById: function (id) { return elements[id] || null; },
    createElement: function (tag) { return createFakeElement(tag); },
    createTextNode: function (text) { return { textContent: text, parentNode: null }; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };

  var fakeWin = {
    document: fakeDoc,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    t: function (k) {
      var dict = {
        'myTrees.loading': '내 러브트리를 불러오고 있어요',
        'loading.long.wait': '평소보다 오래 걸리고 있어요. 잠시만 기다려 주세요.'
      };
      return dict[k] || k;
    },
    LoveBudUI: null,
    LOVEBUD_DEBUG: false
  };

  return {
    loadingEl: loadingEl,
    loadingTextEl: loadingTextEl,
    spinnerEl: spinnerEl,
    errorEl: errorEl,
    emptyEl: emptyEl,
    loadedEl: loadedEl,
    containerEl: containerEl,
    elements: elements,
    context: {
      window: fakeWin,
      global: fakeWin,
      document: fakeDoc,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout
    }
  };
}

function createHubDegradationContext(clock) {
  var degradedCalls = [];
  var showContentCalls = [];

  var fakeHub = {
    showDegraded: function (tree) { degradedCalls.push(tree); },
    showContent: function (tree) { showContentCalls.push(tree); },
    showLoading: function () {},
    showPlaceholder: function () {},
    onCardClick: function () {},
    init: function () {},
    setTreeGridContainer: function () {},
    rebindFlowStages: function () {}
  };

  var degradedNode = null;
  var fakeDoc = {
    getElementById: function () { return null; },
    createElement: function (tag) { return createFakeElement(tag); },
    createTextNode: function (text) { return { textContent: text, parentNode: null }; },
    querySelector: function (sel) {
      if (sel === '.my-trees-hub-degraded') return degradedNode;
      return null;
    },
    querySelectorAll: function () { return []; }
  };

  var apiReject = false;
  var fakeWin = {
    document: fakeDoc,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    apiClient: {
      getMemoriesByTree: function () {
        if (apiReject) return Promise.reject(new Error('network'));
        return Promise.resolve([]);
      }
    },
    LoveBudMyTreesPreviewHub: fakeHub,
    LoveTreeMyTreesPreviewHub: null,
    LoveBudMyTreesData: null,
    LoveBudMyTreesUtils: null,
    LoveBudNormalize: null,
    t: function (k) { return k; }
  };

  return {
    fakeHub: fakeHub,
    degradedCalls: degradedCalls,
    showContentCalls: showContentCalls,
    setApiReject: function (v) { apiReject = v; },
    setDegradedNode: function (n) { degradedNode = n; },
    context: {
      window: fakeWin,
      global: fakeWin,
      document: fakeDoc,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      localStorage: fakeWin.localStorage,
      Promise: Promise
    }
  };
}

// ── Config ───────────────────────────────────────────────────

const SEARCH_DATA = 'js/search/search-data.js';
const SEARCH_ORCHESTRATOR = 'js/search.js';
const MY_TREES_PAGE = 'js/my-trees/my-trees-page.js';
const MY_TREES_ORCHESTRATOR = 'js/my-trees.js';
const MY_TREES_HUB = 'js/my-trees/my-trees-preview-hub.js';
const MY_TREES_PREVIEW_STATE = 'js/my-trees/my-trees-preview-state.js';
const SEARCH_HTML = 'pages/search.html';
const MY_TREES_HTML = 'pages/my-trees.html';
const I18N_SEARCH = 'js/i18n/i18n-search.js';
const I18N_MY_TREES = 'js/i18n/i18n-my-trees.js';

// ── Browse timed loading manager ─────────────────────────────

describe('Browse timed loading manager (EXECUTED_FAKE)', () => {

  it('1. 499ms — indicator hidden', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(499);
    assert.strictEqual(ctx.statusEl.hidden, true);
    assert.strictEqual(clock.pendingCount(), 1);
  });

  it('2. 500ms — spinner visible', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(500);
    assert.strictEqual(ctx.statusEl.hidden, false);
    assert.strictEqual(ctx.spinnerEl.hidden, false);
    assert.strictEqual(ctx.copyEl.textContent, '');
  });

  it('3. 1799ms — copy not yet shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(1799);
    assert.strictEqual(ctx.copyEl.textContent, '');
  });

  it('4. 1800ms — search.loadingPublicTrees copy shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(1800);
    assert.ok(ctx.copyEl.textContent.length > 0);
  });

  it('5. 8000ms — long-wait class', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(8000);
    assert.ok(ctx.statusEl.className.includes('lt-long-wait'));
  });

  it('6. 15000ms — error shell with heading/body/retry', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(15000);
    assert.ok(!ctx.statusEl.hidden);
    assert.ok(ctx.statusEl.className.includes('lt-error-shell'));
    assert.ok(!ctx.errorHeadingEl.hidden);
    assert.ok(!ctx.errorBodyEl.hidden);
    assert.ok(!ctx.retryBtnEl.hidden);
  });

  it('7. ready clears timers and hides', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);
    mgr.ready(gen);
    assert.strictEqual(clock.pendingCount(), 0);
    assert.strictEqual(ctx.statusEl.hidden, true);
  });

  it('8. stale ready cannot hide current generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen1 = mgr.start();
    clock.advance(500);
    var gen2 = mgr.start();
    clock.advance(500);
    mgr.ready(gen1);
    assert.strictEqual(ctx.statusEl.hidden, false);
    mgr.ready(gen2);
    assert.strictEqual(ctx.statusEl.hidden, true);
  });

  it('9. retry generates new superseding generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen1 = mgr.start();
    mgr.error(gen1);
    var gen2 = mgr.start();
    clock.advance(500);
    mgr.ready(gen1);
    assert.strictEqual(ctx.statusEl.hidden, false);
    mgr.ready(gen2);
    assert.strictEqual(ctx.statusEl.hidden, true);
  });

  it('10. late success accepted for same generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(15000);
    var accepted = mgr.lateSuccess(gen);
    assert.strictEqual(accepted, true);
    assert.strictEqual(ctx.statusEl.hidden, true);
  });

  it('11. late success rejected for stale generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen1 = mgr.start();
    clock.advance(500);
    mgr.start();
    var accepted = mgr.lateSuccess(gen1);
    assert.strictEqual(accepted, false);
  });

  it('12. dispose clears timers and hides', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);
    mgr.dispose(gen);
    assert.strictEqual(clock.pendingCount(), 0);
    assert.strictEqual(ctx.statusEl.hidden, true);
  });

  it('13. retry button dispatches lovetree-retry event', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(15000);
    var retryFired = false;
    ctx.statusEl.addEventListener('lovetree-retry', function () { retryFired = true; });
    ctx.retryBtnEl.onclick();
    assert.strictEqual(retryFired, true);
  });
});

// ── My Trees timed loading manager with DOM stages ───────────

describe('My Trees timed loading manager DOM stages (EXECUTED_FAKE)', () => {

  it('14. LOADING init: state-loading hidden at 0ms', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    assert.ok(ctx.loadingEl.classList.contains('state-hidden'));
  });

  it('15. 499ms: still hidden, no copy', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(499);
    assert.ok(ctx.loadingEl.classList.contains('state-hidden'));
    assert.strictEqual(ctx.loadingTextEl.textContent, '');
  });

  it('16. 500ms: visible with spinner, no copy', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(500);
    assert.ok(!ctx.loadingEl.classList.contains('state-hidden'));
    assert.ok(ctx.loadingEl.classList.contains('state-visible'));
    assert.strictEqual(ctx.loadingTextEl.textContent, '');
  });

  it('17. 1999ms: still no copy', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(1999);
    assert.strictEqual(ctx.loadingTextEl.textContent, '');
  });

  it('18. 2000ms: myTrees.loading copy shown', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(2000);
    assert.ok(ctx.loadingTextEl.textContent.length > 0);
  });

  it('19. 8000ms: lt-long-wait class added and text non-empty', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(8000);
    assert.ok(ctx.loadingEl.classList.contains('lt-long-wait'));
    assert.ok(ctx.loadingTextEl.textContent.length > 0);
  });

  it('20. 15000ms: loading hidden, error visible', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(15000);
    assert.ok(ctx.loadingEl.classList.contains('state-hidden'));
    assert.ok(ctx.errorEl.classList.contains('state-visible'));
  });

  it('21. READY: timers 0, loading hidden, loaded visible', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(500);
    page.setState('loaded');
    assert.strictEqual(clock.pendingCount(), 0);
    assert.ok(ctx.loadingEl.classList.contains('state-hidden'));
    assert.ok(ctx.loadedEl.classList.contains('state-visible-block'));
  });

  it('22. EMPTY: timers 0, empty visible, not error', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(500);
    page.setState('empty');
    assert.strictEqual(clock.pendingCount(), 0);
    assert.ok(ctx.emptyEl.classList.contains('state-visible'));
    assert.ok(ctx.errorEl.classList.contains('state-hidden'));
  });

  it('23. ERROR: error visible, not empty', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var page = ctx.context.window.LoveBudMyTreesPage;
    page.initLoadingManager();
    page.setState('loading');
    clock.advance(500);
    page.setState('error', { errorType: 'auth' });
    assert.strictEqual(clock.pendingCount(), 0);
    assert.ok(ctx.errorEl.classList.contains('state-visible'));
    assert.ok(ctx.emptyEl.classList.contains('state-hidden'));
  });
});

// ── My Trees manager token semantics ─────────────────────────

describe('My Trees manager token semantics (EXECUTED_FAKE)', () => {

  it('24. stale ready does not clear current timers', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen1 = mgr.start();
    mgr.start();
    mgr.ready(gen1);
    assert.strictEqual(clock.pendingCount(), 1);
  });

  it('25. current ready clears all timers', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    mgr.ready(gen);
    assert.strictEqual(clock.pendingCount(), 0);
  });

  it('26. error clears all timers', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    mgr.error(gen);
    assert.strictEqual(clock.pendingCount(), 0);
  });

  it('27. overlapping loads: second supersedes first', () => {
    var clock = createFakeClock();
    var ctx = createMyTreesFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);
    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen1 = mgr.start();
    clock.advance(500);
    var gen2 = mgr.start();
    mgr.ready(gen1);
    assert.strictEqual(clock.pendingCount(), 1);
    mgr.ready(gen2);
    assert.strictEqual(clock.pendingCount(), 0);
  });
});

// ── Hub degradation runtime ──────────────────────────────────

describe('Hub degradation runtime (EXECUTED_FAKE)', () => {

  it('28. selected tree hydration reject → showDegraded called once', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1);
    assert.strictEqual(ctx.degradedCalls[0].id, 'tree-1');
  });

  it('29. primary list render remains READY (not degraded)', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    var result = await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
  });

  it('30. repeated failure → no duplicate showDegraded', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.applyHubDegradationIfNeeded(0);
    var fakeNode = createFakeElement('div', 'my-trees-hub-degraded');
    ctx.setDegradedNode(fakeNode);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1);
  });

  it('31. stale rejection does not degrade newer selection', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.setSelectedTree({ id: 'tree-2', title: 'Other' });
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 0);
  });

  it('32. subsequent success clears failure marker', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    assert.strictEqual(api.getHydrationFailures()['tree-1'], true);
    ctx.setApiReject(false);
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    assert.strictEqual(api.getHydrationFailures()['tree-1'], undefined);
  });

  it('33. showContent clears degraded node', () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    var hub = ctx.context.window.LoveBudMyTreesPreviewHub;
    var fakeNode = createFakeElement('div', 'my-trees-hub-degraded');
    var parent = createFakeElement('div', 'summary-parent');
    parent.appendChild(fakeNode);
    ctx.setDegradedNode(fakeNode);
    hub.showContent({ id: 'tree-1', title: 'Test' });
    assert.strictEqual(fakeNode.parentNode, null);
  });

  it('34. non-selected tree failure does not degrade hub', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-2', title: 'Other' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.applyHubDegradationIfNeeded(1);
    assert.strictEqual(ctx.degradedCalls.length, 0);
  });

  it('35. raw error not exposed in degraded call', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1);
    var callArg = ctx.degradedCalls[0];
    assert.strictEqual(callArg.id, 'tree-1');
    assert.strictEqual(Object.keys(callArg).length <= 3, true);
  });
});

// ── Browse orchestration source structure ────────────────────

describe('Browse orchestration source structure (SOURCE_STATIC)', () => {

  it('36. pagehide handler calls searchData.dispose', () => {
    const src = read(SEARCH_ORCHESTRATOR);
    assert.ok(src.includes('pagehide'));
    assert.ok(src.includes('searchData.dispose'));
  });

  it('37. retry event listener wired', () => {
    const src = read(SEARCH_ORCHESTRATOR);
    assert.ok(src.includes('lovetree-retry'));
  });

  it('38. incremental load path exists', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('!resetSelection'));
  });

  it('39. Browse copy uses search.loadingPublicTrees', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('search.loadingPublicTrees'));
    const i18n = read(I18N_SEARCH);
    assert.ok(i18n.includes('search.loadingPublicTrees'));
  });

  it('40. prebuilt shared spinner/error nodes in search.html', () => {
    const html = read(SEARCH_HTML);
    assert.ok(html.includes('lt-spinner'));
    assert.ok(html.includes('browse-loading-copy'));
    assert.ok(html.includes('lt-error-heading'));
    assert.ok(html.includes('lt-retry-btn'));
    assert.ok(html.includes('lt-loading-inline'));
  });

  it('41. My Trees pagehide disposes manager', () => {
    const src = read(MY_TREES_ORCHESTRATOR);
    assert.ok(src.includes('mgr.dispose'));
  });

  it('42. My Trees init order: manager before loadTrees', () => {
    const orch = read(MY_TREES_ORCHESTRATOR);
    var startBody = orch.substring(orch.indexOf('function startMyTrees'));
    var initPos = startBody.indexOf('initLoadingManager');
    var loadPos = startBody.indexOf('loadTrees');
    assert.ok(initPos >= 0);
    assert.ok(loadPos > initPos);
  });

  it('43. My Trees HTML has empty/error/loaded state sections', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('id="state-empty"'));
    assert.ok(html.includes('id="state-error"'));
    assert.ok(html.includes('id="state-loaded"'));
  });

  it('44. hub showDegraded exported in API', () => {
    assert.ok(read(MY_TREES_HUB).includes('showDegraded: showDegraded'));
  });
});

// ── Hub reject-to-recovery sequence ─────────────────────────

describe('Hub reject-to-recovery sequence (EXECUTED_FAKE)', () => {

  it('45. reject → degraded → resolve → normal recovery (single sequence)', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    var hub = ctx.context.window.LoveBudMyTreesPreviewHub;
    api.setSelectedTree({ id: 'tree-1', title: 'Test' });

    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1, 'showDegraded called once on reject');
    assert.strictEqual(api.getHydrationFailures()['tree-1'], true, 'failure marker recorded');

    var fakeNode = createFakeElement('div', 'my-trees-hub-degraded');
    var parent = createFakeElement('div', 'summary-parent');
    parent.appendChild(fakeNode);
    ctx.setDegradedNode(fakeNode);

    ctx.setApiReject(false);
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Test' }]);
    assert.strictEqual(api.getHydrationFailures()['tree-1'], undefined, 'failure marker cleared on success');

    hub.showContent({ id: 'tree-1', title: 'Test' });
    assert.strictEqual(fakeNode.parentNode, null, 'degraded node removed on recovery');
    assert.strictEqual(ctx.showContentCalls.length, 1, 'normal showContent restored');
  });

  it('46. stale previous selection success does not change current hub', async () => {
    var clock = createFakeClock();
    var ctx = createHubDegradationContext(clock);
    ctx.setApiReject(true);
    vm.runInNewContext(read(MY_TREES_PREVIEW_STATE), ctx.context);
    var api = ctx.context.window.LoveBudMyTreesPreviewState;
    api.setSelectedTree({ id: 'tree-1', title: 'Old' });
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Old' }]);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1);

    api.setSelectedTree({ id: 'tree-2', title: 'New' });
    ctx.setApiReject(false);
    await api.hydrateTreesWithCreatedMoments([{ id: 'tree-1', title: 'Old' }]);
    api.applyHubDegradationIfNeeded(0);
    assert.strictEqual(ctx.degradedCalls.length, 1, 'no new degradation for different selection');
  });
});

// ── Shared primitive adoption and reduced-motion ─────────────

describe('Shared primitive adoption (SOURCE_STATIC)', () => {

  it('47. Browse 500ms shared lt-spinner visible', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(500);
    assert.strictEqual(ctx.statusEl.hidden, false);
    assert.strictEqual(ctx.spinnerEl.hidden, false, 'shared lt-spinner visible at 500ms');
  });

  it('48. Browse 15s lt-error-shell and lt-retry-btn focusable', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);
    var mgr = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager(ctx.statusEl);
    mgr.start();
    clock.advance(15000);
    assert.ok(ctx.statusEl.className.includes('lt-error-shell'));
    assert.ok(!ctx.retryBtnEl.hidden, 'lt-retry-btn visible');
    assert.strictEqual(ctx.retryBtnEl.tagName, 'BUTTON', 'retry is focusable button');
  });

  it('49. My Trees shared lt-spinner in HTML', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('lt-spinner'), 'my-trees.html adopts lt-spinner');
    assert.ok(html.includes('lt-loading-compact'), 'my-trees.html adopts lt-loading-compact');
    assert.ok(html.includes('lt-error-shell'), 'my-trees.html adopts lt-error-shell');
    assert.ok(html.includes('lt-retry-btn'), 'my-trees.html adopts lt-retry-btn');
  });

  it('50. reduced-motion: shared CSS targets lt-spinner', () => {
    const cssPath = path.join(REPO_ROOT, 'css', 'global', 'lovetree-loading-states.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    assert.ok(css.includes('prefers-reduced-motion'), 'shared CSS has reduced-motion media query');
    var motionBlock = css.substring(css.indexOf('prefers-reduced-motion'));
    assert.ok(motionBlock.includes('.lt-spinner'), 'reduced-motion targets .lt-spinner');
    assert.ok(motionBlock.includes('animation') && motionBlock.includes('none'), 'animation set to none');
  });
});
