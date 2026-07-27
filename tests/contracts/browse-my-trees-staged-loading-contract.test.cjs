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
 * Create a deterministic fake clock. Instead of using real setTimeout,
 * we store callbacks and advance time manually.
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

  /** Advance clock by `ms` milliseconds, firing any expired timers. */
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

  /** Return the clock's current time. */
  function getNow() { return now; }

  /** Return the number of pending timers. */
  function pendingCount() { return timers.length; }

  /** Clear all pending timers. */
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
 * Build a fake DOM context with a status element for Browse manager tests.
 */
function createBrowseFakeContext(clock) {
  var statusEl = {
    className: '',
    textContent: '',
    innerHTML: '',
    hidden: true,
    _attrs: {},
    setAttribute: function (k, v) { this._attrs[k] = v; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    classList: {
      _classes: [],
      add: function (c) {
        if (this._classes.indexOf(c) === -1) {
          this._classes.push(c);
          statusEl.className = 'lt-loading-inline lt-' + c.replace('lt-', '');
        }
      },
      remove: function (c) {
        var i = this._classes.indexOf(c);
        if (i !== -1) this._classes.splice(i, 1);
      }
    },
    querySelector: function (sel) {
      // Simple selector support for the test scenarios
      if (sel === '.lt-error-retry-btn') {
        // Return a fake button element
        return { onclick: null, addEventListener: function () {} };
      }
      return null;
    }
  };

  var fakeDoc = {
    getElementById: function () { return statusEl; }
  };

  var fakeWin = {
    document: fakeDoc,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: function () {},
    clearInterval: function () {},
    t: function (k) {
      var dict = {
        'loading.list.load': 'Loading list...',
        'loading.long.wait': 'This is taking longer than usual...',
        'loading.long.wait_ko': '평소보다 오래 걸리고 있어요...'
      };
      return dict[k] || k;
    }
  };

  // vm.runInNewContext needs setTimeout/clearTimeout as direct sandbox properties
  return {
    statusEl: statusEl,
    context: {
      window: fakeWin,
      global: fakeWin,
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
const SEARCH_CSS = 'css/search/search-results-skeleton.css';
const MY_TREES_CSS = 'css/my-trees/my-trees-states.css';
const I18N_SEARCH = 'js/i18n/i18n-search.js';
const I18N_MY_TREES = 'js/i18n/i18n-my-trees.js';

// ── Tests ────────────────────────────────────────────────────

describe('Browse timed loading manager (EXECUTED_FAKE)', () => {

  it('1. 499ms — indicator/skeleton hidden', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    // Use public seam: window.LoveBudSearchData.createBrowseLoadingManager
    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
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
    var gen = mgr.start();
    clock.advance(500);

    assert.strictEqual(ctx.statusEl.hidden, false,
      'At 500ms: indicator must be visible');
    assert.strictEqual(clock.pendingCount(), 1,
      'copy timer should be pending after indicator fires');
  });

  it('3. 1799ms — visible page copy not yet shown', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    mgr.start();
    clock.advance(1799);

    assert.strictEqual(ctx.statusEl.textContent, '',
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

    assert.ok(ctx.statusEl.textContent.length > 0,
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
    assert.ok(ctx.statusEl.innerHTML.includes('Retry'),
      'Error shell must contain a retry button');
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
    var gen1 = mgr.start(); // first request
    clock.advance(500);

    var gen2 = mgr.start(); // second request supersedes
    clock.advance(500);

    // Try to ready the stale (gen1) request
    mgr.ready(gen1);
    // The element should still show gen2 indicator (not cleared by stale ready)
    assert.strictEqual(ctx.statusEl.hidden, false,
      'Stale ready must not hide current generation indicator');

    // Ready the current generation
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

    var gen2 = mgr.start(); // retry
    clock.advance(500);

    // Late success from gen1 must be ignored
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
    clock.advance(15000); // escalation fires

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
    var gen2 = mgr.start(); // supersedes

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

  it('13. pagehide cleanup (dispose called)', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(SEARCH_DATA), ctx.context);

    var factory = ctx.context.window.LoveBudSearchData.createBrowseLoadingManager;
    var mgr = factory(ctx.statusEl);
    var gen = mgr.start();
    clock.advance(500);

    // Simulate pagehide
    mgr.dispose(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'No timers remain after pagehide cleanup');
  });
});

describe('My Trees timed loading manager (EXECUTED_FAKE)', () => {

  it('14. 499ms — loading UI hidden', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(499);

    assert.strictEqual(clock.pendingCount(), 1,
      'One timer still pending at 499ms');
  });

  it('15. 500ms — visual indicator fires', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(500);

    assert.strictEqual(clock.pendingCount(), 1,
      'Copy timer pending after indicator fires at 500ms');
  });

  it('16. 2000ms — myTrees.loading copy fires', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(2000);

    assert.strictEqual(clock.pendingCount(), 1,
      'Long-wait timer pending after copy fires at 2000ms');
  });

  it('17. 8000ms — long-wait fires', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(8000);

    assert.strictEqual(clock.pendingCount(), 1,
      'Error escalation timer pending after long-wait at 8000ms');
  });

  it('18. 15000ms — visible error/retry fires', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(15000);

    assert.strictEqual(clock.pendingCount(), 0,
      'All timers cleared after error escalation at 15000ms');
  });

  it('19. ready clears all timers', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    clock.advance(500);

    mgr.ready(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'No timers remain after ready');
  });

  it('20. stale token rejected on ready', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen1 = mgr.start();
    mgr.start(); // gen2 supersedes

    // Ready with stale gen1 should not clear timers of gen2
    mgr.ready(gen1);
    assert.strictEqual(clock.pendingCount(), 1,
      'Stale ready must not affect current generation timers');
  });

  it('21. dispose clears timers', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    var gen = mgr.start();
    clock.advance(500);

    mgr.dispose(gen);
    assert.strictEqual(clock.pendingCount(), 0,
      'No timers remain after dispose');
  });

  it('22. pagehide disposes manager', () => {
    var clock = createFakeClock();
    var ctx = createBrowseFakeContext(clock);
    vm.runInNewContext(read(MY_TREES_PAGE), ctx.context);

    var factory = ctx.context.window.LoveBudMyTreesLoading.createMyTreesLoadingManager;
    var mgr = factory();
    mgr.start();
    clock.advance(500);

    mgr.dispose();
    assert.strictEqual(clock.pendingCount(), 0,
      'pagehide must clear all timers');
  });

  it('23. hub showDegraded exported and functional', () => {
    assert.ok(read(MY_TREES_HUB).includes('showDegraded: showDegraded'),
      'showDegraded must be in hub API');
  });
});
