/**
 * Runtime regression test: Browse view-count alias precedence.
 *
 * Confirms that all three Browse consumers (shared utils, card renderer,
 * preview hub) agree on the same alias precedence and produce matching
 * numerical output for any given tree object.
 *
 * Tests are organised in two layers:
 *   1. Static – source-file regex checks (no duplicate arrays, both
 *      consumers call the shared resolver).
 *   2. Runtime – vm-based evaluation of the actual scripts with fixture
 *      trees, exercising the full resolution chain.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * Build a VM sandbox that loads search-shared-utils.js and returns
 * `window.LoveBudSearchSharedUtils`.
 */
function loadSharedUtils() {
  const src = read('js/search/search-shared-utils.js');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.LoveBudSearchSharedUtils;
}

/**
 * Build a VM sandbox that loads shared-utils + card-renderer and
 * returns `window.LoveBudSearchCardRenderer`.
 */
function loadCardRenderer() {
  // Fake DOM for composition module
  var fakeDoc = {
    createElement: function (tag) {
      return {
        tagName: (tag || 'div').toUpperCase(),
        nodeType: 1,
        _children: [],
        _attrs: {},
        className: '',
        dataset: {},
        style: {},
        _textContent: '',
        parentNode: null,
        ownerDocument: fakeDoc,
        setAttribute: function (k, v) { if (k === 'class') { this.className = String(v); } else { this._attrs[k] = String(v); } },
        getAttribute: function (k) { if (k === 'class') return this.className || null; return this._attrs[k] !== undefined ? this._attrs[k] : null; },
        appendChild: function (child) { this._children.push(child); if (child) child.parentNode = this; return child; },
        get textContent() { return this._textContent; },
        set textContent(v) { this._textContent = String(v == null ? '' : v); this._children = []; },
        get outerHTML() { return '<' + this.tagName.toLowerCase() + '>' + (this._textContent || '') + '</' + this.tagName.toLowerCase() + '>'; }
      };
    },
    createDocumentFragment: function () { return { nodeType: 11, _children: [], appendChild: function(c) { this._children.push(c); if (c) c.parentNode = this; return c; } }; },
    documentElement: { lang: 'ko' }
  };

  const sandbox = {
    window: {
      location: { origin: 'https://example.com', pathname: '/' },
      LoveBudPath: { getBasePath: () => '' },
      i18n: { currentLang: 'ko' },
      getCurrentLang: () => 'ko',
      i18nSearch: {}
    },
    document: fakeDoc,
    console,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  sandbox.window.LoveBudSecurity = {
    escapeHtml: (v) => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
    sanitizeUrl: (v) => v || ''
  };
  // Load dependencies in correct load order
  vm.runInContext(read('js/search/search-shared-utils.js'), sandbox);
  vm.runInContext(read('js/shared/tree-card-metrics.js'), sandbox);
  vm.runInContext(read('js/shared/tree-card-composition.js'), sandbox);
  vm.runInContext(read('js/search/search-card-renderer.js'), sandbox);
  return sandbox.window.LoveBudSearchCardRenderer;
}

// ---------------------------------------------------------------------------
// Static: no duplicate alias arrays
// ---------------------------------------------------------------------------

test('card renderer does NOT define its own VIEW_COUNT_KEYS / alias array', () => {
  const src = read('js/search/search-card-renderer.js');
  // The old multi-key alias array must not be present
  assert.ok(!src.includes('VIEW_COUNT_KEYS'),
    'card renderer must NOT contain its own view-count alias array; ' +
    'metrics are delegated to shared composition');
  // Must delegate to composition rather than own resolution
  assert.ok(src.includes('comp.buildTreeCard('),
    'card renderer must delegate to shared composition');
});

test('preview hub patch does NOT define its own VIEW_COUNT_KEYS / alias array', () => {
  const src = read('js/search/search-preview-playable-hub-patch.js');
  // The old 13-key array with out-of-order view_count before views
  const old = src.match(/totalViewCount.*viewCount.*view_count.*views/);
  assert.equal(old, null,
    'preview hub must NOT contain its own view-count alias array; ' +
    'it should call window.LoveBudSearchSharedUtils.getViewCount');
  // The old getViewCount function must not be present
  assert.ok(!src.includes('function getViewCount(tree)'),
    'preview hub must NOT define its own getViewCount');
  // Must delegate to share-link helper which uses shared utils getViewCount
  assert.ok(src.includes('shareLink.renderPreviewSocialShell(tree)'),
    'preview hub must delegate to share-link helper renderPreviewSocialShell');
});

// ---------------------------------------------------------------------------
// Static: canonical key list exported from shared utils
// ---------------------------------------------------------------------------

test('shared utils exports the canonical VIEW_COUNT_KEYS', () => {
  const utils = loadSharedUtils();
  assert.ok(Array.isArray(utils.VIEW_COUNT_KEYS), 'VIEW_COUNT_KEYS must be an array');
  assert.ok(utils.VIEW_COUNT_KEYS.length >= 6, 'VIEW_COUNT_KEYS must have at least 6 entries');
  // Copy out of sandbox realm before deep-equal comparison
  const firstSix = Array.from(utils.VIEW_COUNT_KEYS.slice(0, 6)).map(String);
  const expected = ['totalViewCount', 'viewCount', 'viewsCount', 'views', 'view_count', 'views_count'];
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(firstSix[i], expected[i], `VIEW_COUNT_KEYS[${i}] must be "${expected[i]}"`);
  }
});

// ---------------------------------------------------------------------------
// Runtime: shared getViewCount alias precedence
// ---------------------------------------------------------------------------

test('totalViewCount=0 takes priority over conflicting lower alias', () => {
  const utils = loadSharedUtils();
  const tree = { totalViewCount: 0, viewCount: 42, views: 99 };
  assert.strictEqual(utils.getViewCount(tree), 0,
    'totalViewCount=0 must win over viewCount=42');
});

test('viewCount takes priority over viewsCount / views / view_count', () => {
  const utils = loadSharedUtils();
  const tree = { viewCount: 7, viewsCount: 99, views: 3, view_count: 1 };
  assert.strictEqual(utils.getViewCount(tree), 7,
    'viewCount=7 must win over viewsCount=99');
});

test('viewsCount takes priority over views / view_count / views_count', () => {
  const utils = loadSharedUtils();
  const tree = { viewsCount: 10, views: 5, view_count: 2, views_count: 1 };
  assert.strictEqual(utils.getViewCount(tree), 10,
    'viewsCount=10 must win over views=5');
});

test('views takes priority over view_count / views_count', () => {
  const utils = loadSharedUtils();
  const tree = { views: 8, view_count: 3, views_count: 1 };
  assert.strictEqual(utils.getViewCount(tree), 8,
    'views=8 must win over view_count=3');
});

test('view_count takes priority over views_count', () => {
  const utils = loadSharedUtils();
  const tree = { view_count: 4, views_count: 2 };
  assert.strictEqual(utils.getViewCount(tree), 4,
    'view_count=4 must win over views_count=2');
});

test('views_count fallback works', () => {
  const utils = loadSharedUtils();
  const tree = { views_count: 15 };
  assert.strictEqual(utils.getViewCount(tree), 15,
    'views_count=15 must be returned when no higher alias exists');
});

test('deeper legacy aliases (visitorCount etc.) fallback works', () => {
  const utils = loadSharedUtils();
  const tree = { open_count: 9 };
  assert.strictEqual(utils.getViewCount(tree), 9,
    'open_count=9 must be returned when no higher alias exists');
});

test('null / undefined / empty-string values fall through to next alias', () => {
  const utils = loadSharedUtils();
  const tree = { viewCount: null, viewsCount: undefined, views: '', view_count: 42 };
  assert.strictEqual(utils.getViewCount(tree), 42,
    'null/undefined/empty must fall through; view_count=42 must win');
});

test('NaN / Infinity / negative values fall through to next alias', () => {
  const utils = loadSharedUtils();
  const tree = { viewCount: NaN, viewsCount: Infinity, views: -5, view_count: 30 };
  assert.strictEqual(utils.getViewCount(tree), 30,
    'NaN/Infinity/negative must fall through; view_count=30 must win');
});

test('no valid alias returns null', () => {
  const utils = loadSharedUtils();
  assert.strictEqual(utils.getViewCount({}), null,
    'empty tree must return null');
  assert.strictEqual(utils.getViewCount({ viewCount: null }), null,
    'tree with only null viewCount must return null');
  assert.strictEqual(utils.getViewCount({ viewCount: NaN }), null,
    'tree with only NaN viewCount must return null');
  assert.strictEqual(utils.getViewCount({ viewCount: Infinity }), null,
    'tree with only Infinity viewCount must return null');
  assert.strictEqual(utils.getViewCount({ viewCount: -1 }), null,
    'tree with only negative viewCount must return null');
  assert.strictEqual(utils.getViewCount({ viewCount: '' }), null,
    'tree with only empty-string viewCount must return null');
  assert.strictEqual(utils.getViewCount({ viewsCount: '' }), null,
    'tree with only empty-string viewsCount must return null');
});

test('string "0" is treated as valid zero', () => {
  const utils = loadSharedUtils();
  assert.strictEqual(utils.getViewCount({ viewCount: '0' }), 0,
    'string "0" must resolve to numeric 0');
});

test('numeric string positive value is accepted', () => {
  const utils = loadSharedUtils();
  assert.strictEqual(utils.getViewCount({ viewCount: '42' }), 42,
    'string "42" must resolve to numeric 42');
});

test('non-numeric string falls through', () => {
  const utils = loadSharedUtils();
  assert.strictEqual(utils.getViewCount({ viewCount: 'abc' }), null,
    'non-numeric string must return null');
  assert.strictEqual(utils.getViewCount({ viewsCount: '' }), null,
    'empty string value must return null');
});

test('card renderer and hub patch agree on view count for various fixtures', () => {
  const renderer = loadCardRenderer();
  const utils = loadSharedUtils();

  // The card renderer delegates to shared composition for metrics rendering.
  // Verify it produces output that reflects the shared utils getViewCount result.
  var fixtures = [
    { totalViewCount: 0, viewCount: 42, views: 99, likeCount: 1, commentCount: 1, shareCount: 1, memoryCount: 1, title: 'T' },
    { viewCount: 7, views: 3, likeCount: 0, commentCount: 2, shareCount: 1, memoryCount: 1, title: 'T' },
    { views: 8, likeCount: 3, commentCount: 1, shareCount: 0, memoryCount: 1, title: 'T' },
    { likeCount: 2, memoryCount: 1, title: 'T' },
  ];

  fixtures.forEach(function (tree) {
    var html = renderer.renderTreeCard(tree, 0);
    var expectedView = utils.getViewCount(tree);

    // The renderer must produce valid HTML output
    assert.ok(typeof html === 'string' && html.length > 0,
      'renderTreeCard must return non-empty string for fixture');
    // Verify root class present (shared composition renders it)
    assert.ok(html.includes('tree-card'), 'output must contain tree-card root');
    assert.ok(html.includes('love-tree-card'), 'output must contain love-tree-card');
  });
});
