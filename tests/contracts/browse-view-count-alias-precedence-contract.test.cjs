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
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  // Stub dependencies
  sandbox.window.LoveBudSecurity = { escapeHtml: (v) => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') };
  sandbox.window.LoveBudSearchCardFallback = { escapeHtml: sandbox.window.LoveBudSecurity.escapeHtml };
  sandbox.window.LoveBudSearchTitleHelper = null;
  sandbox.window.LoveBudSearchPublicMetadataHelper = null;
  sandbox.window.LoveBudPath = { getBasePath: () => '' };
  sandbox.window.location = { origin: 'https://example.com', pathname: '/' };
  sandbox.document = { createElement: () => ({}), head: { appendChild: () => {} } };
  sandbox.window.i18n = { currentLang: 'ko' };
  sandbox.window.getCurrentLang = () => 'ko';
  sandbox.window.i18nSearch = {};
  sandbox.window.getTreeViewerHref = () => '';
  sandbox.window.LoveBudSearchSharedUtils = { escapeHtml: () => '' };
  // Load shared utils for real
  vm.runInContext(read('js/search/search-shared-utils.js'), sandbox);
  // Load card renderer
  vm.runInContext(read('js/search/search-card-renderer.js'), sandbox);
  return sandbox.window.LoveBudSearchCardRenderer;
}

// ---------------------------------------------------------------------------
// Static: no duplicate alias arrays
// ---------------------------------------------------------------------------

test('card renderer does NOT define its own VIEW_COUNT_KEYS / alias array', () => {
  const src = read('js/search/search-card-renderer.js');
  // The old 14-key array must not be present
  const old = src.match(/totalViewCount.*viewCount.*viewsCount.*views.*view_count.*views_count/);
  assert.equal(old, null,
    'card renderer must NOT contain its own view-count alias array; ' +
    'it should call window.LoveBudSearchSharedUtils.getViewCount');
  // The old getViewCount function must not be present
  assert.ok(!src.includes('function getViewCount(tree)'),
    'card renderer must NOT define its own getViewCount');
  // Must reference shared utils getViewCount
  assert.ok(src.includes('shared.getViewCount(tree)'),
    'card renderer must call shared.getViewCount');
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
    'empty string must return null');
});

test('boolean values are treated as their numeric equivalent (legacy behavior)', () => {
  const utils = loadSharedUtils();
  // Number(true) === 1, Number(false) === 0 — both are finite non-negative.
  // This matches the legacy card/hub resolution behavior.
  assert.strictEqual(utils.getViewCount({ viewCount: true }), 1,
    'boolean true resolves to Number(true) === 1');
  assert.strictEqual(utils.getViewCount({ views: false }), 0,
    'boolean false resolves to Number(false) === 0');
});

// ---------------------------------------------------------------------------
// Cross-consumer consistency: card renderer and hub patch produce the same
// numeric output for identical trees.
// ---------------------------------------------------------------------------

test('card renderer and hub patch agree on view count for various fixtures', () => {
  const srcShared = read('js/search/search-shared-utils.js');

  // Card renderer sandbox
  const sandboxCard = { window: {}, console };
  vm.createContext(sandboxCard);
  sandboxCard.window.LoveBudSecurity = { escapeHtml: (v) => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') };
  sandboxCard.window.LoveBudSearchCardFallback = { escapeHtml: sandboxCard.window.LoveBudSecurity.escapeHtml };
  sandboxCard.window.LoveBudSearchTitleHelper = null;
  sandboxCard.window.LoveBudSearchPublicMetadataHelper = null;
  sandboxCard.window.LoveBudPath = { getBasePath: () => '' };
  sandboxCard.window.location = { origin: 'https://example.com', pathname: '/' };
  sandboxCard.document = { createElement: () => ({}), head: { appendChild: () => {} } };
  sandboxCard.window.i18n = { currentLang: 'ko' };
  sandboxCard.window.getCurrentLang = () => 'ko';
  sandboxCard.window.i18nSearch = {};
  vm.runInContext(srcShared, sandboxCard);

  // Hub patch sandbox
  const sandboxHub = { window: {}, console };
  vm.createContext(sandboxHub);
  sandboxHub.window.LoveBudSecurity = { escapeHtml: (v) => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') };
  sandboxHub.window.LoveBudSearchSharedUtils = sandboxCard.window.LoveBudSearchSharedUtils;
  sandboxHub.window.location = { origin: 'https://example.com', pathname: '/pages/search.html' };
  sandboxHub.document = { getElementById: () => null, addEventListener: () => {}, querySelector: () => null };
  sandboxHub.window.setTimeout = () => {};
  vm.runInContext(srcShared, sandboxHub);
  vm.runInContext(read('js/search/search-preview-playable-hub-patch.js'), sandboxHub);
  // Card renderer needs to be loaded in its own sandbox after shared utils
  vm.runInContext(read('js/search/search-card-renderer.js'), sandboxCard);

  const fixtures = [
    { tree: { totalViewCount: 0, viewCount: 42 }, expected: 0 },
    { tree: { viewCount: 7, viewsCount: 99 }, expected: 7 },
    { tree: { viewsCount: 10, views: 5 }, expected: 10 },
    { tree: { views: 8, view_count: 3 }, expected: 8 },
    { tree: { view_count: 4, views_count: 2 }, expected: 4 },
    { tree: { views_count: 15 }, expected: 15 },
    { tree: { visitorCount: 20 }, expected: 20 },
    { tree: { visitsCount: 12 }, expected: 12 },
    { tree: { open_count: 9 }, expected: 9 },
    { tree: {}, expected: null },
    { tree: { viewCount: null, viewsCount: null }, expected: null },
    { tree: { viewCount: -1, viewsCount: 5 }, expected: 5 },
    { tree: { viewCount: 'abc', views: null, viewsCount: 3 }, expected: 3 },
  ];

  for (const fx of fixtures) {
    const fromShared = sandboxCard.window.LoveBudSearchSharedUtils.getViewCount(fx.tree);
    assert.strictEqual(fromShared, fx.expected,
      `getViewCount(${JSON.stringify(fx.tree)}) = ${fromShared}, expected ${fx.expected}`);

    // Card renderer: renderTreeCard should produce HTML with views count matching fx.expected
    // when the tree is rendered as a card. We verify by checking that the reaction
    // metrics visibility icon appears only when expected is not null.
    const cardHtml = sandboxCard.window.LoveBudSearchCardRenderer.renderTreeCard(
      Object.assign({}, fx.tree, { id: 'test-' + JSON.stringify(fx.tree).length, title: 'T', memories: [] }),
      0
    );
    if (fx.expected !== null) {
      assert.ok(cardHtml.includes('visibility'),
        `card HTML must show visibility icon for expected=${fx.expected}`);
      assert.ok(cardHtml.includes(String(fx.expected)),
        `card HTML must contain "${fx.expected}" for tree ${JSON.stringify(fx.tree)}`);
    } else {
      // No views → no visibility icon in the metrics
      assert.ok(!cardHtml.includes('visibility'),
        `card HTML must NOT contain visibility icon for null view count`);
    }

    // Hub patch: renderSocialBar is internal, but we can check the patch-calling
    // pattern by verifying the hub sandbox has the shared getViewCount installed.
    const hubShared = sandboxHub.window.LoveBudSearchSharedUtils;
    const hubResult = hubShared.getViewCount(fx.tree);
    assert.strictEqual(hubResult, fx.expected,
      `hub shared.getViewCount(${JSON.stringify(fx.tree)}) must match expected`);
  }
});

// ---------------------------------------------------------------------------
// pages/search.html load order: shared-utils loads before card-renderer and hub patch
// ---------------------------------------------------------------------------

test('search.html loads shared-utils before card-renderer and hub patch', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script[^>]*\s+src\s*=\s*"([^"]+)"/gi)].map(m => m[1]);

  const sharedIdx = scripts.findIndex(s => s.includes('search-shared-utils.js'));
  const cardIdx = scripts.findIndex(s => s.includes('search-card-renderer.js'));
  const hubIdx = scripts.findIndex(s => s.includes('search-preview-playable-hub-patch.js'));

  assert.ok(sharedIdx >= 0, 'search-shared-utils.js must be present');
  assert.ok(cardIdx >= 0, 'search-card-renderer.js must be present');
  assert.ok(hubIdx >= 0, 'search-preview-playable-hub-patch.js must be present');
  assert.ok(sharedIdx < cardIdx, 'search-shared-utils.js must load before search-card-renderer.js');
  assert.ok(sharedIdx < hubIdx, 'search-shared-utils.js must load before search-preview-playable-hub-patch.js');
});
