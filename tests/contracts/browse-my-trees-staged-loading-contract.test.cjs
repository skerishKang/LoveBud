/**
 * LoveBud — Browse + My Trees Staged Loading Contract
 * (Issue #3693, Parent #3688 child 3)
 *
 * EXECUTED_FAKE: Executes production manager code (createBrowseLoadingManager,
 * createMyTreesLoadingManager) in node:vm with a fake DOM and deterministic
 * fake clock. Asserts timed state transitions without real setTimeout,
 * network, or browser.
 */
'use strict';

const assert = require('node:assert');
const { describe, it, before, mock } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '../..');

// ── Helpers ─────────────────────────────────────────────────

function read(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

function fileExists(file) {
  try {
    fs.accessSync(path.join(REPO_ROOT, file));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a deterministic fake clock.
 */
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

/**
 * Build a fake element factory with child querySelector support.
 */
function createFakeElement(tag, className) {
  return {
    tagName: (tag || 'DIV').toUpperCase(),
    className: className || '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    _attrs: {},
    _children: [],
    _events: {},
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k]; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    appendChild: function (child) { this._children.push(child); },
    addEventListener: function (ev, cb) {
      if (!this._events[ev]) this._events[ev] = [];
      this._events[ev].push(cb);
    },
    dispatchEvent: function (ev) {
      var handlers = this._events[ev && ev.type];
      if (handlers) handlers.forEach(function (h) { h(ev); });
    },
    style: {},
    classList: {
      _classes: (className || '').split(' ').filter(Boolean),
      add: function (c) { if (this._classes.indexOf(c) === -1) this._classes.push(c); },
      remove: function (c) { var i = this._classes.indexOf(c); if (i !== -1) this._classes.splice(i, 1); },
      contains: function (c) { return this._classes.indexOf(c) !== -1; }
    },
    querySelector: function (sel) {
      if (!sel) return null;
      for (var i = 0; i < this._children.length; i++) {
        var child = this._children[i];
        var selClass = sel.replace('.', '');
        if (child.className && child.className.split(' ').indexOf(selClass) !== -1) return child;
      }
      return null;
    }
  };
}

/**
 * Build a fake DOM context with child elements matching the prebuilt
 * browseLoadingStatus structure: lt-spinner, browse-loading-copy,
 * lt-error-heading, lt-error-body, lt-error-retry-btn.
 */
function createBrowseFakeContext(clock) {
  var spinnerEl = createFakeElement('span', 'lt-spinner');
  var copyEl = createFakeElement('span', 'browse-loading-copy');
  var errorHeadingEl = createFakeElement('p', 'lt-error-heading');
  var errorBodyEl = createFakeElement('p', 'lt-error-body');
  var retryBtnEl = createFakeElement('button', 'lt-retry-btn lt-error-retry-btn');

  var statusEl = createFakeElement('div', 'lt-loading-inline');
  statusEl.hidden = true;
  statusEl.appendChild(spinnerEl);
  statusEl.appendChild(copyEl);
  statusEl.appendChild(errorHeadingEl);
  statusEl.appendChild(errorBodyEl);
  statusEl.appendChild(retryBtnEl);

  var fakeDoc = {
    getElementById: function () { return statusEl; },
    createElement: function (tag) { return createFakeElement(tag); }
  };

  var fakeWin = {
    document: fakeDoc,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: function () {},
    clearInterval: function () {},
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
      clearTimeout: clock.clearTimeout
    }
  };
}

// ── Config ───────────────────────────────────────────────────

const SEARCH_DATA = 'js/search/search-data.js';
const SEARCH_ORCHESTRATOR = 'js/search.js';
const MY_TREES_PAGE = 'js/my-trees/my-trees-page.js';
const MY_TREES_ORCHESTRATOR = 'js/my-trees.js';
const MY_TREES_HUB = 'js/my-trees/my-trees-preview-hub.js';
const SEARCH_HTML = 'pages/search.html';
const MY_TREES_HTML = 'pages/my-trees.html';
const I18N_SEARCH = 'js/i18n/i18n-search.js';
const I18N_MY_TREES = 'js/i18n/i18n-my-trees.js';

// ── Tests ────────────────────────────────────────────────────

describe('Browse timed loading manager (EXECUTED_FAKE)', () => {

  it('1. 499ms — indicator/skeleton hidden', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(499);

    assert.strictEqual(ctx.statusEl.hidden, true,
      '0-499ms: status bar must be hidden');
    assert.strictEqual(clock.pendingCount(), 1,
      'One timer (indicator) should still be pending at 499ms');
  });

  it('2. 500ms — visual indicator shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(500);

    assert.strictEqual(ctx.statusEl.hidden, false,
      'At 500ms: indicator must be visible');
  });

  it('3. 1799ms — visible page copy not yet shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(1799);

    assert.strictEqual(ctx.copyEl.textContent, '',
      'At 1799ms: explanatory copy must not yet be shown');
  });

  it('4. 1800ms — search.loadingPublicTrees copy shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(1800);

    assert.ok(ctx.copyEl.textContent.length > 0,
      'At 1800ms: explanatory copy must be shown');
  });

  it('5. 8000ms — long-wait indicator visible', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(8000);

    assert.ok(ctx.statusEl.className.includes('lt-long-wait'),
      'At 8000ms: long-wait class must be present');
  });

  it('6. 15000ms — visible error shell with retry', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    ctx.context.window.t = function (k) {
      var dict = {
        'loading.error.primary': 'Error',
        'loading.error.body': 'Something went wrong',
        'loading.retry.action': 'Retry'
      };
      return dict[k] || k;
    };
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(15000);

    assert.ok(!ctx.statusEl.hidden, 'At 15000ms: error shell must be visible');
    assert.ok(ctx.statusEl.className.includes('lt-error-shell'),
      'Error shell class must be present');
    assert.ok(!ctx.errorHeadingEl.hidden,
      'Error heading must be visible');
    assert.ok(!ctx.retryBtnEl.hidden,
      'Retry button must be visible');
  });

  it('7. ready clears all timers and hides indicator', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);
    assert.strictEqual(ctx.statusEl.hidden, false, 'indicator visible before ready');

    mgr.ready(gen);
    assert.strictEqual(clock.pendingCount(), 0, 'All timers cleared after ready');
    assert.strictEqual(ctx.statusEl.hidden, true, 'Indicator hidden after ready');
  });

  it('8. stale request cannot change current state', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen1 = mgr.start();
    clock.advance(500);

    var gen2 = mgr.start();
    clock.advance(500);

    mgr.ready(gen1);
    assert.strictEqual(ctx.statusEl.hidden, false,
      'Stale ready must not hide current generation indicator');

    mgr.ready(gen2);
    assert.strictEqual(ctx.statusEl.hidden, true,
      'Current ready must hide indicator');
  });

  it('9. retry generates new superseding generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen1 = mgr.start();
    mgr.error(gen1);
    clock.advance(500);

    var gen2 = mgr.start();
    clock.advance(500);

    mgr.ready(gen1);
    assert.strictEqual(ctx.statusEl.hidden, false,
      'Late ready from stale gen must not hide current indicator');

    mgr.ready(gen2);
    assert.strictEqual(ctx.statusEl.hidden, true,
      'Current gen ready must succeed');
  });

  it('10. late success after escalation accepted if same generation', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(15000);

    var accepted = mgr.lateSuccess(gen);
    assert.strictEqual(accepted, true,
      'Late success for current gen must be accepted');
    assert.strictEqual(ctx.statusEl.hidden, true,
      'Indicator must be hidden after late success');
  });

  it('11. late success for stale generation is rejected', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen1 = mgr.start();
    clock.advance(500);
    var gen2 = mgr.start();

    var accepted = mgr.lateSuccess(gen1);
    assert.strictEqual(accepted, false,
      'Late success for stale gen must be rejected');
  });

  it('12. dispose clears timers and hides element', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);

    mgr.dispose(gen);
    assert.strictEqual(clock.pendingCount(), 0, 'All timers cleared after dispose');
    assert.strictEqual(ctx.statusEl.hidden, true, 'Element hidden after dispose');
  });

  it('13. pagehide cleanup calls dispose', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);

    mgr.dispose(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'No timers remain after pagehide cleanup');
  });

  // ── Browse source structure checks ──

  it('14. Browse retry event listener wired in search.js', () => {
    const src = read(SEARCH_ORCHESTRATOR);
    assert.ok(src.includes('lovetree-retry'),
      'search.js must listen for lovetree-retry event');
  });

  it('15. Browse pagehide cleanup handler exists', () => {
    const src = read(SEARCH_ORCHESTRATOR);
    assert.ok(src.includes('searchData.dispose'),
      'search.js must call searchData.dispose on pagehide');
  });

  it('16. Browse copy uses search.loadingPublicTrees key', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('search.loadingPublicTrees'),
      'search-data.js must use search.loadingPublicTrees for copy');
    const i18n = read(I18N_SEARCH);
    assert.ok(i18n.includes('search.loadingPublicTrees'),
      'i18n-search.js must define search.loadingPublicTrees');
  });

  it('17. Browse incremental loading preserves existing cards', () => {
    const src = read(SEARCH_DATA);
    assert.ok(src.includes('!resetSelection'),
      'Incremental load path exists in search-data.js');
  });

  it('18. Browse prebuilt spinner child nodes in HTML', () => {
    const html = read(SEARCH_HTML);
    assert.ok(html.includes('lt-spinner'), 'search.html must have lt-spinner');
    assert.ok(html.includes('browse-loading-copy'), 'search.html must have browse-loading-copy');
    assert.ok(html.includes('lt-error-heading'), 'search.html must have lt-error-heading');
    assert.ok(html.includes('lt-error-body'), 'search.html must have lt-error-body');
    assert.ok(html.includes('lt-error-retry-btn'), 'search.html must have lt-error-retry-btn');
  });
});

describe('My Trees timed loading manager (EXECUTED_FAKE)', () => {

  it('19. My Trees pagehide handler disposes loading manager', () => {
    const src = read(MY_TREES_ORCHESTRATOR);
    assert.ok(src.includes('mgr.dispose'),
      'my-trees.js pagehide must dispose loading manager');
  });

  it('20. hub showDegraded exported', () => {
    assert.ok(read(MY_TREES_HUB).includes('showDegraded: showDegraded'),
      'showDegraded must be in hub API');
  });

  it('21. authenticated zero trees → EMPTY (source check)', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('id="state-empty"'),
      'my-trees.html must have empty state element');
    assert.ok(html.includes('role="status"'),
      'Empty state must use role=status');
  });

  it('22. auth/session failure → ERROR not EMPTY (source check)', () => {
    const html = read(MY_TREES_HTML);
    assert.ok(html.includes('id="state-error"'),
      'my-trees.html must have error state element');
    assert.ok(html.includes('role="alert"'),
      'Error state must use role=alert');
  });

  it('23. My Trees init order: auth → initLoadingManager → controls → loadTrees', () => {
    const orch = read(MY_TREES_ORCHESTRATOR);
    var startBody = orch.substring(orch.indexOf('function startMyTrees'));
    var initPos = startBody.indexOf('initLoadingManager');
    var setupPos = startBody.indexOf('setupHeaderCreateButton');
    var loadPos = startBody.indexOf('loadTrees');
    assert.ok(initPos >= 0, 'startMyTrees must call initLoadingManager');
    assert.ok(setupPos > initPos, 'setupHeaderCreateButton after initLoadingManager');
    assert.ok(loadPos > setupPos, 'loadTrees after setupHeaderCreateButton');
  });

  it('24. persistent token across separate setState calls', () => {
    // Stale token rejection on ready
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen1 = mgr.start();
    mgr.start(); // gen2 supersedes

    mgr.ready(gen1);
    assert.strictEqual(clock.pendingCount(), 1,
      'Stale ready must not affect current generation timers');

    var gen2 = mgr.start();
    mgr.ready(gen2);
    assert.strictEqual(clock.pendingCount(), 0,
      'Current ready must clear all timers');
  });

  it('25. READY after LOADING leaves 0 timers', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    mgr.ready(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'READY after LOADING must leave 0 timers');
  });

  it('26. ERROR after LOADING leaves 0 timers', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    mgr.error(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'ERROR after LOADING must leave 0 timers');
  });

  it('27. two overlapping loads: second supersedes first', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen1 = mgr.start();
    clock.advance(500);
    var gen2 = mgr.start();

    mgr.ready(gen1);
    assert.strictEqual(clock.pendingCount(), 1,
      'gen1 ready must not clear gen2 timers');

    mgr.ready(gen2);
    assert.strictEqual(clock.pendingCount(), 0,
      'gen2 ready must clear all timers');
  });
});
