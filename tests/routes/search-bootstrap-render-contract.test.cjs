/**
 * Contract test: Browse initial rendering bootstrap (#2772).
 *
 * Validates that `js/search/index.js` no longer calls the removed
 * `ui.bindShareCopyHandler()`, uses optional guards for mobile handler
 * binding, and connects the share handler through
 * `LoveBudSearchShareLink.bindPreviewShareHandler()` as the single
 * source of truth.
 *
 * When the share-link helper is absent, the bootstrap must still
 * proceed to `dataApi.loadPublicTrees(...)` so the initial tree list
 * renders.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// Static source checks
// ---------------------------------------------------------------------------

test('index.js does NOT call ui.bindShareCopyHandler()', () => {
  const src = read('js/search/index.js');
  assert.ok(!src.includes('bindShareCopyHandler'),
    'index.js must not reference ui.bindShareCopyHandler');
});

test('index.js guards ui.bindMobilePreviewHandlers with typeof check', () => {
  const src = read('js/search/index.js');
  assert.ok(src.includes("typeof ui.bindMobilePreviewHandlers === 'function'"),
    'bindMobilePreviewHandlers must be guarded by typeof check');
  assert.ok(src.includes('ui.bindMobilePreviewHandlers()'),
    'bindMobilePreviewHandlers must still be called when function exists');
});

test('index.js uses LoveBudSearchShareLink.bindPreviewShareHandler with optional guard', () => {
  const src = read('js/search/index.js');
  assert.ok(src.includes('var shareLink = window.LoveBudSearchShareLink'),
    'must reference LoveBudSearchShareLink');
  assert.ok(src.includes("typeof shareLink.bindPreviewShareHandler === 'function'"),
    'must guard bindPreviewShareHandler with typeof');
  assert.ok(src.includes('shareLink.bindPreviewShareHandler()'),
    'must call bindPreviewShareHandler when function exists');
});

test('index.js still calls dataApi.loadPublicTrees after share handler binding', () => {
  const src = read('js/search/index.js');
  // ensure the loadPublicTrees call still exists after the share handler block
  const shareBlockEnd = src.indexOf('shareLink.bindPreviewShareHandler()');
  const loadCall = src.indexOf('await dataApi.loadPublicTrees({ resetSelection: true })');
  assert.ok(shareBlockEnd >= 0, 'shareLink.bindPreviewShareHandler must exist');
  assert.ok(loadCall >= 0, 'dataApi.loadPublicTrees must exist');
  assert.ok(shareBlockEnd < loadCall,
    'share handler binding must appear before dataApi.loadPublicTrees');
});

test('search.html has index.js with new cache version', () => {
  const html = read('pages/search.html');
  const match = html.match(/search\/index\.js\?v=([\w-]+)/);
  assert.ok(match, 'index.js must have cache version');
  assert.strictEqual(match[1], '20260713-3482-1',
    'index.js cache version must be 20260713-3482-1');
});

test('search.html loads search-share-link.js before index.js', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script[^>]*\s+src\s*=\s*"([^"]+)"/gi)].map(m => m[1]);
  const shareIdx = scripts.findIndex(s => s.includes('search-share-link.js'));
  const indexIdx = scripts.findIndex(s => s.includes('search/index.js'));
  assert.ok(shareIdx >= 0, 'search-share-link.js must be present');
  assert.ok(indexIdx >= 0, 'search/index.js must be present');
  assert.ok(shareIdx < indexIdx,
    'search-share-link.js must load before search/index.js');
});

// ---------------------------------------------------------------------------
// Runtime: bootstrap does not throw when bindShareCopyHandler is absent
// ---------------------------------------------------------------------------

/**
 * Build a minimal VM sandbox that simulates the Bootstrap environment.
 *
 * In `vm.createContext` the sandbox IS the global object, so all module
 * references are placed at the top level. The global `window` is set
 * to point to the sandbox itself (for code that accesses `window.X`).
 */
function makeSandbox(shareLinkPresent) {
  var counters = { loadTrees: 0, shareBind: 0, mobileBind: 0 };

  var sandbox = {
    // `window` property points to the sandbox (the global object)
    window: null, // will be set to sandbox itself after createContext

    // popstate listener (accessed via window.addEventListener at bootstrap end)
    addEventListener: function(event, handler) {
      if (event === 'popstate') sandbox._popstateHandler = handler;
    },

    // document stub — captures DOMContentLoaded
    document: {
      addEventListener: function(event, handler) {
        if (event === 'DOMContentLoaded') {
          sandbox._domReadyHandler = handler;
        }
      },
      getElementById: function() {
        // Return a DOM-like element stub; index.js sets innerHTML on some refs
        return { innerHTML: '', style: {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; } };
      },
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      documentElement: { lang: 'ko' }
    },

    // Browser built-ins
    console: console,
    setTimeout: setTimeout,
    CSS: { escape: function(v) { return v; } },
    URL: URL,
    URLSearchParams: URLSearchParams,
    location: { search: '', pathname: '/pages/search.html' },

    // Dependencies
    LoveBudSearchCardRenderer: {
      init: function() {},
      renderLoading: function() { return ''; },
      renderResults: function() { return ''; },
      renderNoTreesState: function() { return ''; },
      renderEmptySearchState: function() { return ''; }
    },
    LoveBudSearchPreviewRenderer: {
      init: function() {},
      updatePreview: function() {}
    },
    LoveBudSearchAdapter: {
      filterTrees: function() { return []; }
    },
    LoveBudSearchUI: {
      createSearchUI: function() {
        return {
          markActiveCard: function() {},
          isMobilePreviewMode: function() { return false; },
          setMobilePreviewOpen: function() {},
          syncActiveCard: function() {},
          clearSelectedPreview: function() {},
          syncStaticBrowseCopy: function() {},
          syncPreviewVisibility: function() {},
          syncBrowseHead: function() {},
          syncControlsFromState: function() {},
          attachCardEvents: function() {},
          renderLoadErrorState: function() {},
          bindMobilePreviewHandlers: function() { counters.mobileBind++; }
        };
      }
    },
    LoveBudSearchPreviewCache: {
      createPreviewCache: function() {
        return {
          readPreviewCache: function() {},
          writePreviewCache: function() {},
          hasPreviewCache: function() {}
        };
      }
    },
    LoveBudSearchUrlState: {
      createSearchUrlState: function() {
        return { restoreStateFromUrl: function() {}, updateUrlState: function() {} };
      }
    },
    LoveBudSearchData: {
      createSearchData: function() {
        return {
          loadPublicTrees: function() { counters.loadTrees++; return Promise.resolve(); },
          hydrateSelectedTreePreview: function() {},
          dedupeTreesById: function() { return []; }
        };
      }
    },
    LoveBudSearchControls: {
      createSearchControls: function() {
        return { bind: function() {}, syncControlsFromState: function() {} };
      }
    },
    LoveBudCache: {},
    matchMedia: function() { return { addEventListener: function() {} }; },
    onLangChange: null,

    // tracking
    _counters: counters,
    _domReadyHandler: null
  };

  if (shareLinkPresent) {
    sandbox.LoveBudSearchShareLink = {
      bindPreviewShareHandler: function() { counters.shareBind++; }
    };
  }

  return sandbox;
}

test('bootstrap does NOT throw when bindShareCopyHandler is absent from UI', async () => {
  var sandbox = makeSandbox(true);
  var ctx = vm.createContext(sandbox);
  // After createContext, set window to point to the global object
  ctx.window = ctx;

  var src = read('js/search/index.js');
  vm.runInContext(src, ctx);

  var handler = ctx._domReadyHandler;
  assert.ok(handler, 'DOMContentLoaded handler must be captured');
  await handler();

  assert.ok(ctx._counters.loadTrees >= 1,
    'dataApi.loadPublicTrees must be called during bootstrap');
  assert.ok(ctx._counters.mobileBind >= 1,
    'bindMobilePreviewHandlers must be called (function exists)');
  assert.ok(ctx._counters.shareBind >= 1,
    'bindPreviewShareHandler must be called (helper present)');
});

test('bootstrap continues when LoveBudSearchShareLink is absent (no crash)', async () => {
  var sandbox = makeSandbox(false);
  var ctx = vm.createContext(sandbox);
  ctx.window = ctx;

  var src = read('js/search/index.js');
  vm.runInContext(src, ctx);

  var handler = ctx._domReadyHandler;
  assert.ok(handler, 'DOMContentLoaded handler must be captured');
  await handler();

  assert.ok(ctx._counters.loadTrees >= 1,
    'dataApi.loadPublicTrees must be called even when share helper is absent');
  assert.strictEqual(ctx._counters.shareBind, 0,
    'bindPreviewShareHandler must NOT be called when helper is absent');
});

test('bootstrap continues when bindMobilePreviewHandlers is absent from UI', async () => {
  var sandbox = makeSandbox(false);
  // Override UI factory — no bindMobilePreviewHandlers
  sandbox.LoveBudSearchUI.createSearchUI = function() {
    return {
      markActiveCard: function() {},
      isMobilePreviewMode: function() { return false; },
      setMobilePreviewOpen: function() {},
      syncActiveCard: function() {},
      clearSelectedPreview: function() {},
      syncStaticBrowseCopy: function() {},
      syncPreviewVisibility: function() {},
      syncBrowseHead: function() {},
      syncControlsFromState: function() {},
      attachCardEvents: function() {},
      renderLoadErrorState: function() {}
    };
  };

  var ctx = vm.createContext(sandbox);
  ctx.window = ctx;

  var src = read('js/search/index.js');
  vm.runInContext(src, ctx);

  var handler = ctx._domReadyHandler;
  assert.ok(handler, 'DOMContentLoaded handler must be captured');
  await handler();

  assert.ok(ctx._counters.loadTrees >= 1,
    'dataApi.loadPublicTrees must be called even when mobile handler is absent');
});
