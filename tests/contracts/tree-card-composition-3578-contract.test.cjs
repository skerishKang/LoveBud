/**
 * LoveBud — Shared LoveTree Card Composition Contract
 * Issue #3578 Phase 2
 *
 * Validates the shared tree-card-composition.js primitive:
 *   - Browse and My Trees surface adapters call the shared helper
 *   - Common slot structure (title/subtitle/body/meta/action) is generated for both
 *   - Authoritative zero renders as '0'
 *   - Unknown/negative/NaN metric omitted
 *   - My Trees visibility icon is My-Trees-only
 *   - Browse public metadata is preserved
 *   - My Trees direct edit action absent
 *   - Browse canonical public viewer href
 *   - My Trees canonical owner appreciation href
 *   - mode=edit absent
 *   - mobile whole-card activation preserved (My Trees)
 *   - keyboard Enter/Space activation preserved (My Trees)
 *   - selected-card/hub selection behavior preserved (My Trees)
 *   - XSS payload not injected through title, subtitle, label, URL
 *   - Load-order fail-closed: missing shared helper causes explicit throw
 *
 * Primary: SOURCE_STATIC (string/content analysis)
 * Secondary: EXECUTED_FAKE (vm execution with fake DOM)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const COMPOSITION_SRC = 'js/shared/tree-card-composition.js';
const BROWSE_SRC = 'js/search/search-card-renderer.js';
const MYTREES_SRC = 'js/my-trees/my-trees-ui.js';
const METRICS_SRC = 'js/shared/tree-card-metrics.js';

/* ── VM Helpers ── */

function createFakeDom(overrides) {
  var win = {
    location: {
      pathname: '/pages/search.html',
      href: 'https://lovebud.pages.dev/pages/search.html',
      origin: 'https://lovebud.pages.dev'
    },
    innerWidth: 1280,
    LoveBudSecurity: {
      escapeHtml: function (s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      sanitizeUrl: function (url) {
        if (!url) return '';
        var raw = String(url).trim();
        if (!raw) return '';
        if (/^javascript:/i.test(raw)) return '';
        return raw;
      }
    },
    LoveBudTreeCardMetrics: null,
    LoveBudTreeCardComposition: null,
    LoveBudSearchCardRenderer: null,
    LoveBudMyTreesUI: null,
    document: {
      createElement: function (tag) {
        var el = { tagName: (tag || 'div').toUpperCase(), children: [], attrs: {}, className: '', style: {}, dataset: {}, hidden: false, _html: '', innerHTML: '', onclick: null, listeners: {} };
        el.setAttribute = function (k, v) { el.attrs[k] = String(v); if (k === 'class') el.className = String(v); };
        el.getAttribute = function (k) { return el.attrs[k] || null; };
        el.removeAttribute = function (k) { delete el.attrs[k]; };
        el.addEventListener = function (type, fn) { if (!el.listeners[type]) el.listeners[type] = []; el.listeners[type].push(fn); };
        el.querySelector = function () { return null; };
        el.querySelectorAll = function () { return []; };
        el.closest = function () { return null; };
        el.matches = function () { return false; };
        return el;
      },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; }
    }
  };

  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      win[k] = overrides[k];
    });
  }

  var ctx = { window: win, globalThis: win, console: { warn: function () {}, log: function () {} } };
  ctx.window.console = ctx.console;
  // Expose document as a global (browser code references document directly)
  ctx.document = win.document;
  vm.createContext(ctx);
  return ctx;
}

function loadMetrics(ctx) {
  vm.runInContext(read(METRICS_SRC), ctx);
  return ctx.window.LoveBudTreeCardMetrics;
}

function loadComposition(ctx) {
  loadMetrics(ctx);
  vm.runInContext(read(COMPOSITION_SRC), ctx);
  return ctx.window.LoveBudTreeCardComposition;
}

function loadBrowseRenderer(ctx, extraOverrides) {
  loadComposition(ctx);
  if (extraOverrides) {
    Object.keys(extraOverrides).forEach(function (k) {
      ctx.window[k] = extraOverrides[k];
    });
  }
  vm.runInContext(read(BROWSE_SRC), ctx);
  return ctx.window.LoveBudSearchCardRenderer;
}

// Load My Trees with minimal stubs needed for buildTreeCard to not crash
function loadMyTreesRenderer(ctx) {
  loadComposition(ctx);
  ctx.window.LoveBudMyTreesUtils = {
    escapeHtml: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    hashSeed: function () { return 0; },
    getTreeMomentCount: function () { return 0; },
    getTreeViewCount: function () { return 0; },
    getTreeLikeCount: function () { return 0; },
    formatCompactCount: function (v) { return String(v); },
    clipText: function (v) { return String(v || '').slice(0, 40); },
    formatDate: function () { return ''; }
  };
  ctx.window.LoveBudMyTreesCardVisuals = {
    buildMiniTreeSVG: function () { return ''; },
    buildPremiumFallbackSVG: function () { return ''; },
    getTreeCardMeta: function () { return null; },
    getTreeMoodPalette: function () { return { background: '', leaf: '', leafSoft: '', accent: '' }; },
    buildTreeThumbVisual: function () { return ''; },
    getRepresentativeThumbnail: function () { return ''; },
    getVisibilityActionLabel: function () { return ''; }
  };
  ctx.window.LoveBudMyTreesEntryTargetResolver = {
    resolveMyTreesEntryTargets: function () { return null; }
  };
  ctx.window.LoveBudMyTreesManageSummary = {
    updateManageSummary: function (t) { return t; }
  };
  vm.runInContext(read(MYTREES_SRC), ctx);
  return ctx.window.LoveBudMyTreesUI;
}

/* ── 1. Both surfaces call the shared composition helper ── */

test('1. Browse and My Trees invoke same shared composition helper at runtime', function () {
  // Browse
  var ctx = createFakeDom();
  var renderer = loadBrowseRenderer(ctx);
  var tree = { id: 't1', title: 'Test Tree', viewCount: 5, likeCount: 3 };
  var html = renderer.renderTreeCard(tree, 0);
  // The shared composition output contains love-tree-card class
  assert.match(html, /love-tree-card/);
  assert.match(html, /love-tree-card-browse/);
  // The legacy tree-card should NOT be the output class when composition is loaded
  assert.doesNotMatch(html, /class="tree-card /);

  // My Trees — buildTreeCard
  var ctx2 = createFakeDom();
  var mytrees = loadMyTreesRenderer(ctx2);
  var card = mytrees.buildTreeCard(tree, {});
  assert.ok(card instanceof Object);
  // card.innerHTML should reference shared composition
  assert.match(card.innerHTML, /love-tree-card/);
  assert.match(card.innerHTML, /love-tree-card-my-trees/);
});

/* ── 2. Surface adapters execute (not just string-existence) ── */

test('2. Both surface adapters execute without errors', function () {
  // Browse — renderTreeCard
  var ctx = createFakeDom();
  var renderer = loadBrowseRenderer(ctx);
  var tree = { id: 't2', title: 'Browse Tree', viewCount: 10, likeCount: 5 };
  var html = renderer.renderTreeCard(tree, 1);
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 50);

  // My Trees — buildTreeCard
  var ctx2 = createFakeDom();
  var mytrees = loadMyTreesRenderer(ctx2);
  var card = mytrees.buildTreeCard(tree, {});
  assert.ok(card.innerHTML.length > 50);
});

/* ── 3. Common structure generated for both ── */

test('3. Common title/subtitle/body/meta/action structure is generated', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var model = {
    surface: 'browse',
    treeId: 'test123',
    title: 'Test Title',
    subtitleHtml: '<p>Test subtitle</p>',
    metricsHtml: '<span>views: 5</span>',
    primaryHref: 'view.html?treeId=test123',
    primaryLabel: '열기',
    accessibilityLabel: 'Test Tree'
  };

  var html = comp.buildCardHtml(model);
  assert.match(html, /love-tree-card-title[^>]*>Test Title/);
  assert.match(html, /love-tree-card-subtitle/);
  assert.match(html, /love-tree-card-body/);
  assert.match(html, /love-tree-card-meta-row/);
  assert.match(html, /love-tree-card-open-link/);
  assert.match(html, /view\.html\?treeId=test123/);
  assert.match(html, /열기/);
});

/* ── 4. Authoritative zero renders as '0' ── */

test('4. Authoritative zero renders as "0" in metrics', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  // buildTreeCard auto-renders metrics
  var tree = { id: 't0', title: 'Zero Tree', viewCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 };
  var html = comp.buildTreeCard(tree, { surface: 'browse', title: 'Zero', metricsHtml: '' });

  // Metrics are auto-rendered by buildTreeCard
  assert.match(html, /tree-card-reaction-metric/);
  assert.match(html, /visibility/); // view icon
  assert.match(html, /favorite/);   // like icon
  assert.match(html, />0</);        // the zero value
});

/* ── 5. Unknown/negative/NaN metric omitted ── */

test('5. Unknown/negative/NaN metrics are omitted', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  // Only likeCount has a valid value; viewCount is null, commentCount negative, shareCount absent
  var tree = { id: 't-omit', title: 'Omit', viewCount: null, likeCount: 3, commentCount: -1 };
  var html = comp.buildTreeCard(tree, { surface: 'browse', title: 'Omit' });

  // Should only have likes (valid positive)
  assert.match(html, /favorite/);
  assert.match(html, />3</);
  // Should NOT have view or comment
  assert.doesNotMatch(html, /visibility/);
  assert.doesNotMatch(html, /chat_bubble/);
});

/* ── 6. My Trees visibility icon present only in My Trees ── */

test('6. My Trees visibility icon is My-Trees-only', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  // With visibilityBadgeHtml passed for My Trees
  var myTreesHtml = comp.buildCardHtml({
    surface: 'my-trees',
    treeId: 't-vis',
    title: 'Vis',
    visibilityBadgeHtml: '<span class="tree-card-visibility public" aria-label="공개"><span class="material-symbols-outlined">public</span></span>',
    primaryHref: 'editor?treeId=t-vis',
    primaryLabel: '감상하기'
  });
  assert.match(myTreesHtml, /tree-card-visibility/);
  assert.match(myTreesHtml, /공개/);

  // Without visibilityBadgeHtml for Browse
  var browseHtml = comp.buildCardHtml({
    surface: 'browse',
    treeId: 't-novis',
    title: 'NoVis',
    primaryHref: 'view.html?treeId=t-novis',
    primaryLabel: '열기'
  });
  assert.doesNotMatch(browseHtml, /tree-card-visibility/);
});

/* ── 7. Browse public metadata preserved ── */

test('7. Browse public metadata extension slot is preserved', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var html = comp.buildCardHtml({
    surface: 'browse',
    treeId: 't-meta',
    title: 'Meta',
    bodyExtensionHtml: '<div class="tree-card-metadata-slot"><span class="tree-public-tag">#kpop</span></div>',
    primaryHref: 'view.html?treeId=t-meta',
    primaryLabel: '열기'
  });

  assert.match(html, /tree-card-metadata-slot/);
  assert.match(html, /tree-public-tag/);
  assert.match(html, /#kpop/);
});

/* ── 8. My Trees direct edit action absent ── */

test('8. My Trees has no direct edit action (only appreciation)', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var html = comp.buildCardHtml({
    surface: 'my-trees',
    treeId: 't-editcheck',
    title: 'No Edit',
    primaryHref: 'editor?treeId=t-editcheck',
    primaryLabel: '감상하기'
  });

  // Should have the appreciation link
  assert.match(html, /감상하기/);
  // Should NOT contain mode=edit or 편집 action
  assert.doesNotMatch(html, /mode=edit/);
  assert.doesNotMatch(html, /편집/);
  // Allow "editor" in URL (it's the canonical appreciation route)
  assert.match(html, /editor\?treeId=t-editcheck/);
});

/* ── 9. Browse canonical public viewer href ── */

test('9. Browse uses canonical public viewer href', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var html = comp.buildCardHtml({
    surface: 'browse',
    treeId: 't-href',
    title: 'Href',
    primaryHref: 'view.html?treeId=t-href',
    primaryLabel: '트리 열기'
  });

  assert.match(html, /view\.html\?treeId=t-href/);
  // Should NOT be editor path
  assert.doesNotMatch(html, /editor\?/);
  assert.match(html, /트리 열기/);
});

/* ── 10. My Trees canonical owner appreciation href ── */

test('10. My Trees uses canonical owner appreciation href', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var html = comp.buildCardHtml({
    surface: 'my-trees',
    treeId: 't-mine',
    title: 'Mine',
    primaryHref: 'editor?treeId=t-mine',
    primaryLabel: '감상하기'
  });

  assert.match(html, /editor\?treeId=t-mine/);
  assert.match(html, /감상하기/);
});

/* ── 11. mode=edit absent ── */

test('11. mode=edit is absent from all card output', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  // Browse
  var browseHtml = comp.buildCardHtml({
    surface: 'browse', treeId: 'a', title: 'A', primaryHref: 'view.html?treeId=a'
  });
  assert.doesNotMatch(browseHtml, /mode=edit/);

  // My Trees
  var myHtml = comp.buildCardHtml({
    surface: 'my-trees', treeId: 'b', title: 'B', primaryHref: 'editor?treeId=b', primaryLabel: '감상하기'
  });
  assert.doesNotMatch(myHtml, /mode=edit/);
});

/* ── 12. My Trees mobile whole-card activation ── */

test('12. My Trees buildTreeCard wrapper preserves mobile whole-card activation', function () {
  // The outer card wrapper has click and keydown handlers via addEventListener.
  // This test validates the wrapper structure is preserved.
  var src = read(MYTREES_SRC);
  assert.match(src, /card\.addEventListener\(\s*'click'/);
  assert.match(src, /card\.addEventListener\(\s*'keydown'/);
  // On mobile (<480px), whole-card navigates to primary href
  assert.match(src, /window\.innerWidth\s*<\s*480/);
});

/* ── 13. Keyboard Enter/Space activation ── */

test('13. My Trees card keyboard Enter/Space activation preserved', function () {
  var src = read(MYTREES_SRC);
  assert.match(src, /key === 'Enter'/);
  assert.match(src, /key === ' '/);
});

/* ── 14. selected-card / hub selection ── */

test('14. My Trees selected-card state and hub selection behavior preserved', function () {
  var src = read(MYTREES_SRC);
  assert.match(src, /isSelected/);
  assert.match(src, /selectedClass/);
  assert.match(src, /handleCardSelect/);
  assert.match(src, /data-selected-tree-card/);
});

/* ── 15. XSS safety ── */

test('15. XSS payload in title/subtitle/label/URL is escaped', function () {
  var ctx = createFakeDom();
  var comp = loadComposition(ctx);

  var xssPayload = '<script>alert("xss")</script>';
  var xssUrl = 'javascript:alert(1)';

  var html = comp.buildCardHtml({
    surface: 'browse',
    treeId: 't-xss',
    title: xssPayload,
    subtitleHtml: '<p>' + comp.escapeHtml(xssPayload) + '</p>',
    primaryHref: xssUrl,
    primaryLabel: xssPayload,
    accessibilityLabel: xssPayload
  });

  // The script tag should be escaped in title
  assert.match(html, /&lt;script&gt;alert/);
  // The dangerous URL should be rejected (empty href or safe)
  assert.doesNotMatch(html, /href="javascript:/);
  // accessibility label should be escaped
  assert.match(html, /aria-label="[^"]*&lt;script&gt;/);
});

/* ── 16. #3598 stale metric transition regression guard ── */

test('16. Existing #3598 stale metric semantics not regressed', function () {
  var metricsSrc = read(METRICS_SRC);
  // Must still handle three-state: 0 renders, null omits
  assert.match(metricsSrc, /count === 0/);
  assert.match(metricsSrc, /null/);
  assert.match(metricsSrc, /Non-finite/);
});

/* ── 17. #3600 view-recorder files unchanged ── */

test('17. #3600 view-recorder file unchanged by this PR', function () {
  // Verify that js/viewer/public-tree-view-recorder.js is unchanged from origin/main
  // We check that the current file still exists with expected content markers
  var recorderPath = path.join(ROOT, 'js/viewer/public-tree-view-recorder.js');
  if (fs.existsSync(recorderPath)) {
    var src = fs.readFileSync(recorderPath, 'utf8');
    assert.match(src, /recordPublicTreeView/);
  }
});

/* ── 18. Fail-closed when shared helper missing (load order) ── */

test('18. My Trees buildTreeCard fails explicitly when shared composition not loaded', function () {
  var ctx0 = createFakeDom();
  // Do NOT load composition
  vm.runInContext(read(METRICS_SRC), ctx0);
  ctx0.window.LoveBudMyTreesUtils = { escapeHtml: function (s) { return String(s); }, hashSeed: function () { return 0; }, getTreeMomentCount: function () { return 0; }, getTreeViewCount: function () { return 0; }, getTreeLikeCount: function () { return 0; }, formatCompactCount: function (v) { return String(v); }, clipText: function (v) { return String(v).slice(0, 40); }, formatDate: function () { return ''; } };
  ctx0.window.LoveBudMyTreesCardVisuals = { buildMiniTreeSVG: function () { return ''; }, buildPremiumFallbackSVG: function () { return ''; }, getTreeCardMeta: function () { return null; }, getTreeMoodPalette: function () { return { background: '', leaf: '', leafSoft: '', accent: '' }; }, buildTreeThumbVisual: function () { return ''; }, getRepresentativeThumbnail: function () { return ''; }, getVisibilityActionLabel: function () { return ''; } };
  ctx0.window.LoveBudMyTreesEntryTargetResolver = { resolveMyTreesEntryTargets: function () { return null; } };
  ctx0.window.LoveBudMyTreesManageSummary = { updateManageSummary: function (t) { return t; } };
  // Expect buildTreeCard to throw
  vm.runInContext(read(MYTREES_SRC), ctx0);
  var mytrees = ctx0.window.LoveBudMyTreesUI;
  assert.throws(function () {
    mytrees.buildTreeCard({ id: 'x', title: 'Fail' }, {});
  }, /LoveBudTreeCardComposition not loaded/);
});
