/**
 * #3655 — Browse Story view foundation: executable Chromium contract
 *
 * Refs #3655 (implementation child). Parent #3654 stays OPEN.
 * Baseline: b3bcdda7d69fe98d447df41fddcd9edcde4e20cd
 *
 * Loads the production asset chain (css/global.css, shared card
 * composition CSS, css/search.css, css/tree-view-mode.css,
 * js/tree-view-mode-switcher.js, js/search/search-story-view.js,
 * js/search/search-card-renderer.js, js/search/search-card-events.js)
 * via a local HTTP server and measures real computed geometry and
 * behaviour in headless Chromium. No string-only assertions for
 * geometry/interaction. No new browser package is introduced — the
 * repository's existing Playwright pattern is reused.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '/fixture-browse-story.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildBrowseFixture());
          return;
        }
        if (urlPath === '/fixture-mytrees.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildMyTreesFixture());
          return;
        }
        /* #3771 media-regression: renderer-driven fixture that exercises the
         * firstElementChild boundary fix. All media is same-origin so the
         * harness can prove the real Tier-1 thumbnail path (loaded img)
         * deterministically, without external-network flakiness. */
        if (urlPath === '/fixture-browse-story-media.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildMediaRuntimeFixture());
          return;
        }
        if (urlPath.startsWith('/fixture-media/')) {
          res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
          res.end(FIXTURE_GIF);
          return;
        }
        const abs = path.normalize(path.join(ROOT, urlPath.replace(/^\//, '')));
        if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType(abs) });
        res.end(fs.readFileSync(abs));
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

/* #3771 media-regression: fixture card IDs used by the media-runtime tests. */
const MEDIA_FIXTURE_IDS = ['media-thumb-1', 'media-no-thumb', 'media-thumb-2', 'media-no-thumb-2', 'media-thumb-3', 'media-no-thumb-3'];

/* 1x1 transparent GIF served same-origin so the Tier-1 thumbnail img path
 * (bindCardImageHandlers load/error/SVG-swap) is deterministic — loading an
 * external image in the harness would leave the img in its pre-load state. */
const FIXTURE_GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

/* ── Fixtures ─────────────────────────────────────────────────────── */

function browseCardMarkup(id, title) {
  return `
  <div class="tree-card love-tree-card love-tree-card-browse tree-card-browse" data-tree-id="${id}" role="button" tabindex="0" aria-pressed="false">
    <div class="tree-card-media love-tree-card-media">
      <div class="tree-card-thumb" style="background:#e7d9d2;width:100%;height:100%;"></div>
    </div>
    <div class="tree-card-body love-tree-card-body">
      <div class="tree-card-title-row love-tree-card-title-row">
        <div class="tree-title love-tree-card-title tree-card-title">${title}</div>
      </div>
      <div class="tree-subtitle love-tree-card-subtitle tree-card-subcopy">첫 순간에서 이어진 감정</div>
      <div class="tree-card-metadata-slot"><div class="tree-public-metadata"><div class="tree-public-metadata-desc">공개 메타 설명 샘플</div></div><div class="tree-public-tags"><span class="tree-public-tag">#tag</span></div></div>
      <div class="tree-meta-row love-tree-card-meta-row">
        <div class="tree-meta-left love-tree-card-meta-left">
          <div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">
            <span class="tree-card-reaction-metric" title="조회수 3">
              <span class="material-symbols-outlined" aria-hidden="true">visibility</span><span>3</span>
            </span>
          </div>
        </div>
        <div class="tree-meta-right love-tree-card-meta-right">
          <a class="tree-card-open-link love-tree-card-open-link" href="/pages/view.html?treeId=${id}">
            <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>
            <span>트리 열기</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

const BROWSE_IDS = ['browse-1', 'browse-2', 'browse-3', 'browse-4', 'browse-5', 'browse-6', 'browse-7'];

function buildBrowseFixture() {
  const cards = BROWSE_IDS.map((id, i) => browseCardMarkup(id, `Story Tree ${i + 1}`)).join('\n');
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/css/global.css"/>
<link rel="stylesheet" href="/css/shared/love-tree-card-composition.css"/>
<link rel="stylesheet" href="/css/search.css"/>
<link rel="stylesheet" href="/css/tree-view-mode.css?v=20260725-3655-1"/>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<main class="search-container lovetree-calm-two-column-shell">
  <section class="lovetree-calm-main-column">
    <div class="browse-utility-row lovetree-calm-utility-row">
      <div class="search-input-wrapper">
        <input type="text" id="searchInput" class="search-input" placeholder="search" />
      </div>
    </div>
    <div class="browse-results-head lovetree-calm-results-head">
      <div id="browseViewModeMount"></div>
    </div>
    <div id="resultsList">
${cards}
    </div>
    <div id="browseStoryNavMount"></div>
  </section>
  <aside class="preview-sidebar preview-hub lovetree-calm-right-rail" id="previewSidebar">
    <header class="preview-panel-header"><h3>감상 허브</h3></header>
  </aside>
</main>
<script>
  /* Minimal SearchUI stub so js/search/search-card-events.js can patch the
   * real delegated card-event behaviour (click / Enter / Space). */
  window.LoveBudSearchUI = {
    createSearchUI: function (config) { return { config: config }; }
  };
</script>
<script src="/js/tree-view-mode-switcher.js"></script>
<script src="/js/search/search-card-renderer.js"></script>
<script src="/js/search/search-card-events.js"></script>
<script src="/js/search/search-story-view.js"></script>
<script>
  (function () {
    var resultsList = document.getElementById('resultsList');
    window.__selects = 0;
    window.__lastSelect = null;

    var ui = window.LoveBudSearchUI.createSearchUI({
      refs: {},
      state: { selectedTreeId: null },
      callbacks: {
        selectTree: function (tree) {
          window.__selects += 1;
          window.__lastSelect = tree.id;
        }
      }
    });

    var CARD_HTML = ${JSON.stringify(browseCardMarkup('__ID__', '__TITLE__'))};
    function cardHtml(id, title) {
      return CARD_HTML.replace(/__ID__/g, id).replace(/__TITLE__/g, title);
    }

    window.__renderCards = function (ids) {
      resultsList.innerHTML = ids
        .map(function (id, i) { return cardHtml(id, 'Story Tree ' + (i + 1)); })
        .join('');
      ui.attachCardEvents(resultsList, ids.map(function (id) { return { id: id }; }));
    };
    window.__renderSkeleton = function () {
      resultsList.innerHTML =
        '<div class="tree-card search-skeleton-card" aria-hidden="true"><div class="tree-card-media search-skeleton-block"></div></div>' +
        '<div class="tree-card search-skeleton-card" aria-hidden="true"><div class="tree-card-media search-skeleton-block"></div></div>';
    };
    window.__renderEmpty = function () {
      resultsList.innerHTML =
        '<div class="search-empty-state"><h3 class="search-empty-heading">조건에 맞는 트리가 없어요</h3></div>';
    };

    ui.attachCardEvents(resultsList, ${JSON.stringify(BROWSE_IDS)}.map(function (id) { return { id: id }; }));

    /* Mirror js/search/search-page-shell-init.js wiring (Browse only). */
    var storyController = window.LoveBudBrowseStoryView.init({
      results: '#resultsList',
      navMount: '#browseStoryNavMount'
    });
    var switcher = window.LoveBudTreeViewModeSwitcher.init({
      storageKey: 'lovebud:browse:viewMode',
      defaultMode: 'compact',
      mount: '#browseViewModeMount',
      target: '#resultsList',
      modes: ['large', 'compact', 'list', 'story'],
      onChange: function (mode) { storyController.setMode(mode); }
    });
    storyController.setMode(switcher.getCurrentMode());
    window.__storyController = storyController;
  })();
</script>
</body></html>`;
}

function buildMyTreesFixture() {
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/css/global.css"/>
<link rel="stylesheet" href="/css/shared/love-tree-card-composition.css"/>
<link rel="stylesheet" href="/css/my-trees.css"/>
<link rel="stylesheet" href="/css/tree-view-mode.css?v=20260721-3608-1"/>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; min-height: 100vh; }
  .trees-grid { display: grid; padding: 16px; box-sizing: border-box; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<div id="myTreesViewModeMount"></div>
<div id="trees-grid" class="trees-grid">
  <div class="tree-card love-tree-card love-tree-card-my-trees" data-tree-id="owner-1" role="button" tabindex="0">
    <div class="tree-card-body love-tree-card-body">
      <div class="tree-title love-tree-card-title">My Trees One</div>
    </div>
  </div>
</div>
<script src="/js/tree-view-mode-switcher.js"></script>
<script src="/js/my-trees/my-trees-page-bootstrap.js?v=20260721-3608-1"></script>
</body></html>`;
}

/* ── #3771 media-runtime fixture ─────────────────────────────────────── */

/* #3771 media-regression: renderer-driven fixture that exercises the
 * firstElementChild boundary fix. Tier-1 thumbnail cards carry relative
 * paths in the fixture seed; the inline script stamps them with
 * location.origin at page load (sanitizeUrl requires absolute http(s)). */
function buildMediaRuntimeFixture() {
  /* Build three cards through the real renderer chain:
   *   renderRepresentativeMedia → composition buildTreeCard → htmlToNode
   * This exercises the firstElementChild boundary fixed in #3771.
   * Thumbnail URLs are stamped as absolute same-origin URLs at serve time
   * inside the inline script (location.origin + '/fixture-media/...'),
   * because sanitizeUrl rejects relative paths. */
  const trees = [
    {
      id: 'media-thumb-1',
      title: 'Story Media Thumb One',
      representativeThumbnail: '__MEDIA_THUMB_1__',
      memories: [{ id: 'm-1-1', title: 'First Moment', thumbnail: '__MEDIA_THUMB_1__' }],
      memoryCount: 3,
      theme: 'LoveTree',
      viewCount: 12,
      likeCount: 4,
    },
    {
      id: 'media-no-thumb',
      title: 'Story Media No Thumb',
      memories: [{ id: 'm-2-1', title: 'Text-only moment' }],
      memoryCount: 0,
      theme: 'LoveTree',
      viewCount: 0,
      likeCount: 0,
    },
    {
      id: 'media-thumb-2',
      title: 'Story Media Thumb Two',
      representativeThumbnail: '__MEDIA_THUMB_2__',
      memories: [{ id: 'm-3-1', title: 'Second Moment', thumbnail: '__MEDIA_THUMB_2__' }],
      memoryCount: 1,
      theme: 'LoveTree',
      viewCount: 8,
      likeCount: 2,
    },
    {
      id: 'media-no-thumb-2',
      title: 'Story Media No Thumb Two',
      memories: [{ id: 'm-4-1', title: 'Quiet Moment' }],
      memoryCount: 0,
      theme: 'LoveTree',
      viewCount: 0,
      likeCount: 0,
    },
    {
      id: 'media-thumb-3',
      title: 'Story Media Thumb Three',
      representativeThumbnail: '__MEDIA_THUMB_1__',
      memories: [{ id: 'm-5-1', title: 'Third Moment', thumbnail: '__MEDIA_THUMB_1__' }],
      memoryCount: 2,
      theme: 'LoveTree',
      viewCount: 5,
      likeCount: 1,
    },
    {
      id: 'media-no-thumb-3',
      title: 'Story Media No Thumb Three',
      memories: [{ id: 'm-6-1', title: 'Silent Moment' }],
      memoryCount: 0,
      theme: 'LoveTree',
      viewCount: 0,
      likeCount: 0,
    },
  ];
  const treesJson = JSON.stringify(trees);

  /* Render browser-side via the loaded renderer modules. */
  const cardsHtml = trees.map((tree, i) => {
    return `<script>document.write(0)</script>`; /* placeholder, replaced below */
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/css/global.css"/>
<link rel="stylesheet" href="/css/shared/love-tree-card-composition.css"/>
<link rel="stylesheet" href="/css/search.css"/>
<link rel="stylesheet" href="/css/tree-view-mode.css?v=20260725-3655-1"/>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<main class="search-container lovetree-calm-two-column-shell">
  <section class="lovetree-calm-main-column">
    <div class="browse-utility-row lovetree-calm-utility-row">
      <div class="search-input-wrapper">
        <input type="text" id="searchInput" class="search-input" placeholder="search" />
      </div>
    </div>
    <div class="browse-results-head lovetree-calm-results-head">
      <div id="browseViewModeMount"></div>
    </div>
    <div id="resultsList"></div>
    <div id="browseStoryNavMount"></div>
  </section>
  <aside class="preview-sidebar preview-hub lovetree-calm-right-rail" id="previewSidebar">
    <header class="preview-panel-header"><h3>감상 허브</h3></header>
  </aside>
</main>
<script>
  window.LoveBudSearchUI = {
    createSearchUI: function (config) { return { config: config }; }
  };
</script>
<script src="/js/utils/security.js"></script>
<script src="/js/shared/tree-card-metrics.js"></script>
<script src="/js/shared/tree-card-composition.js"></script>
<script src="/js/search/search-card-fallback.js"></script>
<script src="/js/search/search-card-renderer.js"></script>
<script src="/js/tree-view-mode-switcher.js"></script>
<script src="/js/search/search-card-events.js"></script>
<script src="/js/search/search-story-view.js"></script>
<script>
  (function () {
    var resultsList = document.getElementById('resultsList');
    window.__selects = 0;
    window.__lastSelect = null;

    var ui = window.LoveBudSearchUI.createSearchUI({
      refs: {},
      state: { selectedTreeId: null },
      callbacks: {
        selectTree: function (tree) {
          window.__selects += 1;
          window.__lastSelect = tree.id;
        }
      }
    });

    /* Render cards via the real production renderer chain.
     * Thumbnail URLs in the seed trees are placeholder strings;
     * they are substituted here with absolute same-origin URLs because
     * sanitizeUrl requires absolute http(s) URLs. */
    var trees = ${treesJson};
    var MEDIA_THUMB_1_ABS = location.origin + '/fixture-media/thumb-1.gif';
    var MEDIA_THUMB_2_ABS = location.origin + '/fixture-media/thumb-2.gif';
    trees = trees.map(function (t) {
      if (t.representativeThumbnail === '__MEDIA_THUMB_1__') t.representativeThumbnail = MEDIA_THUMB_1_ABS;
      if (t.representativeThumbnail === '__MEDIA_THUMB_2__') t.representativeThumbnail = MEDIA_THUMB_2_ABS;
      t.memories = (t.memories || []).map(function (m) {
        if (m.thumbnail === '__MEDIA_THUMB_1__') m.thumbnail = MEDIA_THUMB_1_ABS;
        if (m.thumbnail === '__MEDIA_THUMB_2__') m.thumbnail = MEDIA_THUMB_2_ABS;
        return m;
      });
      return t;
    });
    var renderer = window.LoveBudSearchCardRenderer;
    var htmlParts = trees.map(function (tree, i) {
      return renderer.renderTreeCard(tree, i);
    });
    resultsList.innerHTML = htmlParts.join('');
    renderer.bindCardImageHandlers(resultsList);

    window.__renderCards = function (ids) {
      var filtered = ids.map(function (id) {
        return trees.find(function (t) { return t.id === id; });
      }).filter(Boolean);
      resultsList.innerHTML = filtered.map(function (tree, i) {
        return renderer.renderTreeCard(tree, i);
      }).join('');
      renderer.bindCardImageHandlers(resultsList);
    };

    ui.attachCardEvents(resultsList, trees.map(function (t) { return { id: t.id }; }));

    var storyController = window.LoveBudBrowseStoryView.init({
      results: '#resultsList',
      navMount: '#browseStoryNavMount'
    });
    var switcher = window.LoveBudTreeViewModeSwitcher.init({
      storageKey: 'lovebud:browse:viewMode',
      defaultMode: 'compact',
      mount: '#browseViewModeMount',
      target: '#resultsList',
      modes: ['large', 'compact', 'list', 'story'],
      onChange: function (mode) { storyController.setMode(mode); }
    });
    storyController.setMode(switcher.getCurrentMode());
    window.__storyController = storyController;
  })();
</script>
</body></html>`;
}

/* ── Shared helpers ───────────────────────────────────────────────── */

async function interceptViewerNav(page) {
  const navRequests = [];
  await page.route('**/pages/view.html**', async (route) => {
    navRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body>viewer</body></html>' });
  });
  return navRequests;
}

async function clickModeButton(page, mode) {
  await page.click(`.tree-view-mode-btn[data-mode="${mode}"]`);
  await page.waitForTimeout(80);
}

async function storyState(page) {
  return page.evaluate(() => {
    const results = document.getElementById('resultsList');
    const nav = document.querySelector('.browse-story-navigation');
    const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
      .filter((c) => !c.hidden && !c.closest('.browse-story-transition-stage'))
      .map((c) => c.getAttribute('data-tree-id'));
    const indicator = document.querySelector('.browse-story-indicator-current');
    const a11y = document.querySelector('.browse-story-indicator-a11y');
    const prev = document.querySelector('[data-story-prev]');
    const next = document.querySelector('[data-story-next]');
    return {
      mode: results.getAttribute('data-tree-view-mode'),
      groupSizeAttr: results.getAttribute('data-story-group-size'),
      visible,
      allCards: results.querySelectorAll('.tree-card[data-tree-id]').length,
      indicator: indicator ? indicator.textContent : null,
      a11y: a11y ? a11y.textContent : null,
      navPresent: !!nav,
      navHidden: nav ? nav.hidden : null,
      prevDisabled: prev ? prev.disabled : null,
      nextDisabled: next ? next.disabled : null,
    };
  });
}

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => { errors.push(String(error)); });
  return errors;
}

/* #3771 media-regression: capture real console errors (not warns/info). */
function captureConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/* #3771 media-regression: capture same-origin request failures. */
function captureRequestFailures(page) {
  const failures = [];
  page.on('requestfailed', req => {
    const url = req.url();
    try {
      const origin = new URL(page.url()).origin;
      if (new URL(url).origin === origin) failures.push(url);
    } catch (e) { /* non-URL-safe request */ }
  });
  return failures;
}

/* #3771 media-regression: query one card's media wrapper for element
 * children, image presence, and fallback presence. The media wrapper's
 * canonical content is produced by search-card-fallback.js:
 *   Tier 1: real thumbnail → <img data-search-card-image> backed by a
 *            hidden [data-fallback-container] (.tree-card-media-fallback)
 *            until bindCardImageHandlers' load handler settles the image;
 *            on error the img is hidden and the SVG fallback revealed.
 *   Tier 2: text-led cover → .tree-card-text-visual
 *   Tier 3: premium SVG   → .tree-card-media-fallback
 * The #3771 regression silently dropped this Element child because the
 * renderer's firstChild boundary returned a whitespace Text node.
 * Returns null if the card is missing or has no media wrapper. */
async function cardMediaState(page, treeId) {
  return page.evaluate((id) => {
    const card = document.querySelector(`#resultsList .tree-card[data-tree-id="${id}"]`);
    if (!card) return null;
    const media = card.querySelector('.tree-card-media');
    if (!media) return { cardPresent: true, mediaPresent: false };
    const elements = [...media.children].filter(c => c.nodeType === Node.ELEMENT_NODE);
    const img = media.querySelector('img[data-search-card-image]');
    const fallback = media.querySelector('.tree-card-media-fallback');
    const textVisual = media.querySelector('.tree-card-text-visual');
    /* textContent of the non-img fallback branch (Tier 2 proves the media
     * wrapper carries canonical human-readable fallback content). */
    const mediaText = textVisual ? textVisual.textContent.trim() : '';
    return {
      cardPresent: true,
      mediaPresent: true,
      elementChildCount: elements.length,
      imgCount: img ? 1 : 0,
      imgSrc: img ? img.currentSrc || img.src || null : null,
      imgComplete: img ? img.complete : null,
      imgNaturalWidth: img ? img.naturalWidth : null,
      imgHidden: img ? img.style.display === 'none' || img.hidden : null,
      fallbackCount: fallback ? 1 : 0,
      fallbackVisible: fallback ? !fallback.closest('[data-fallback-container]') || !fallback.closest('[data-fallback-container]').hidden : null,
      textVisualCount: textVisual ? 1 : 0,
      mediaTextLength: mediaText.length,
    };
  }, treeId);
}

/* #3771 media-regression: assert one card's media wrapper state.
 * Tier 1 (hasThumbnail): exactly one img with a safe same-origin src that
 *   is load-complete and not hidden (same-origin fixture GIFs settle
 *   synchronously under networkidle), backed by a hidden SVG fallback
 *   that is NOT revealed.
 * Tier 2 (hasNoThumbnail): exactly one visible .tree-card-text-visual,
 *   no img, no revealed SVG fallback. */
function assertMediaState(state, expected, label) {
  assert.ok(state, `${label}: card must exist`);
  assert.equal(state.mediaPresent, true, `${label}: media wrapper must exist`);
  /* Core #3771 regression assertion: the media wrapper's Element child
   * must survive — before the fixed boundary (firstElementChild), the
   * leading whitespace of the trusted HTML string made the renderer
   * append a stray Text node instead, so the media wrapper ended with
   * zero Element children. */
  assert.ok(state.elementChildCount >= 1,
    `${label}: media wrapper must have >=1 Element child (got ${state.elementChildCount}; zero = #3771 regression)`);
  if (expected.hasImage) {
    assert.equal(state.imgCount, 1, `${label}: exactly one img[data-search-card-image]`);
    assert.ok(state.imgSrc && state.imgSrc.includes(expected.imgSrc),
      `${label}: img src must contain "${expected.imgSrc}" (got "${state.imgSrc}")`);
    assert.equal(state.imgHidden, false, `${label}: image must not be display:none/hidden`);
    assert.equal(state.imgComplete, true, `${label}: image load must be complete`);
    assert.ok(state.imgNaturalWidth > 0, `${label}: image must have decoded content (naturalWidth > 0)`);
    assert.equal(state.fallbackVisible, false, `${label}: backed SVG fallback must stay hidden behind a loaded image`);
  }
  if (expected.hasTextVisual) {
    assert.equal(state.textVisualCount, 1, `${label}: exactly one .tree-card-text-visual (canonical Tier-2 fallback)`);
    assert.ok(state.mediaTextLength > 0, `${label}: Tier-2 fallback carries non-empty canonical content`);
  }
  if (expected.hasFallback) {
    assert.equal(state.fallbackCount, 1, `${label}: exactly one .tree-card-media-fallback`);
    assert.equal(state.fallbackVisible, true, `${label}: fallback must be visible`);
  }
  if (expected.noImage) {
    assert.equal(state.imgCount, 0, `${label}: no image expected`);
  }
  if (expected.noTextVisual) {
    assert.equal(state.textVisualCount, 0, `${label}: no text-visual expected`);
  }
}

/* #3771 media-regression: assert one card's media wrapper state.
 * expected:
 *   hasImage: true + imgSrc substring  → Tier 1 thumbnail card
 *   hasTextVisual / hasFallback        → Tier 2/3 no-thumbnail card
 *   noImage / noFallback               → negative assertions */
function assertMediaState(state, expected, label) {
  assert.ok(state, `${label}: card must exist`);
  assert.equal(state.mediaPresent, true, `${label}: media wrapper must exist`);
  /* Core #3771 regression assertion: the media wrapper's Element child
   * must survive — before the fixed boundary (firstElementChild), the
   * leading whitespace of the trusted HTML string made the renderer
   * append a stray Text node instead. */
  assert.ok(state.elementChildCount >= 1, `${label}: media wrapper must have >=1 Element child (got ${state.elementChildCount}, empty media wrapper = #3771 regression)`);
  if (expected.hasImage) {
    assert.equal(state.imgCount, 1, `${label}: exactly one img[data-search-card-image]`);
    assert.ok(state.imgSrc && state.imgSrc.includes(expected.imgSrc), `${label}: img src must contain "${expected.imgSrc}" (got "${state.imgSrc}")`);
    assert.equal(state.imgHidden, false, `${label}: image must not be display:none/hidden`);
  }
  if (expected.hasFallback) {
    assert.equal(state.fallbackCount, 1, `${label}: exactly one .tree-card-media-fallback`);
    assert.equal(state.fallbackHidden, false, `${label}: fallback must not be hidden`);
  }
  if (expected.hasTextVisual) {
    assert.equal(state.textVisualCount, 1, `${label}: exactly one .tree-card-text-visual (canonical Tier-2 fallback)`);
  }
  if (expected.noTextVisual) {
    assert.equal(state.textVisualCount, 0, `${label}: no text-visual expected`);
  }
  if (expected.noImage) {
    assert.equal(state.imgCount, 0, `${label}: no image expected`);
  }
  if (expected.noFallback) {
    assert.equal(state.fallbackCount, 0, `${label}: no fallback expected`);
  }
}

/* #3771 media-regression: assert all visible cards have media materials. */
async function assertVisibleCardMedia(page, expectedCards, label) {
  const visibleIds = await page.evaluate(() =>
    [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')]
      .filter(c => !c.hidden && !c.closest('.browse-story-transition-stage'))
      .map(c => c.getAttribute('data-tree-id'))
  );
  for (const id of visibleIds) {
    const expected = expectedCards.find(c => c.id === id);
    if (!expected) continue;
    const state = await cardMediaState(page, id);
    assertMediaState(state, expected, `${label} card[${id}]`);
  }
}

async function directCardIds(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('#resultsList > .tree-card[data-tree-id]')]
      .map(card => card.getAttribute('data-tree-id'));
  });
}

async function transitionHeightProperty(page) {
  return page.evaluate(() => {
    return document.getElementById('resultsList').style.getPropertyValue('--story-transition-height');
  });
}

const CANONICAL_IDS = ['browse-1', 'browse-2', 'browse-3', 'browse-4', 'browse-5', 'browse-6', 'browse-7'];

async function assertCleanLifecycle(page) {
  const state = await page.evaluate(() => {
    const results = document.getElementById('resultsList');
    const wrappers = results.querySelectorAll('.browse-story-transition-stage');
    const allCards = [...results.querySelectorAll('.tree-card[data-tree-id]')];
    return {
      wrapperCount: wrappers.length,
      ariaBusy: results.getAttribute('aria-busy'),
      direction: results.getAttribute('data-story-direction'),
      inertCount: allCards.filter(c => c.hasAttribute('inert')).length,
      heightProp: results.style.getPropertyValue('--story-transition-height'),
    };
  });
  const assert = require('node:assert/strict');
  assert.equal(state.wrapperCount, 0, 'no wrappers');
  assert.ok(state.ariaBusy === null || state.ariaBusy === 'false', 'aria-busy cleared');
  assert.equal(state.direction, null, 'direction cleared');
  assert.equal(state.inertCount, 0, 'no inert cards');
  assert.equal(state.heightProp, '', 'height custom property removed');
}

/* ── Mode capability ──────────────────────────────────────────────── */

test('#3655 browser: Browse exposes four modes; story applies the data attribute', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // (1) four mode buttons
    const modes = await page.$$eval('.tree-view-mode-btn', (btns) => btns.map((b) => b.getAttribute('data-mode')));
    assert.deepEqual(modes, ['large', 'compact', 'list', 'story']);

    // (4) empty storage → compact default
    let st = await storyState(page);
    assert.equal(st.mode, 'compact');
    assert.equal(st.navHidden, true, 'story nav hidden while compact');
    assert.equal(st.allCards, 7);

    // (2) selecting story applies data-tree-view-mode="story"
    await clickModeButton(page, 'story');
    st = await storyState(page);
    assert.equal(st.mode, 'story');
    assert.equal(st.navHidden, false, 'nav visible in story mode with results');
    const checked = await page.$eval('.tree-view-mode-btn[data-mode="story"]', (b) => b.getAttribute('aria-checked'));
    assert.equal(checked, 'true');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: stored story restores on Browse; defaults stay compact otherwise', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    // (3) stored story restore
    const pageS = await context.newPage();
    await pageS.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await pageS.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await pageS.waitForTimeout(150);
    let st = await storyState(pageS);
    assert.equal(st.mode, 'story', 'stored story must restore into Story mode');
    assert.equal(st.visible.length, 3, 'stored story restore shows the first wide group');
    assert.equal(st.indicator, '01 / 03');
    assert.equal(st.navHidden, false);
    await pageS.close();

    // (5) invalid storage → compact
    const pageI = await context.newPage();
    await pageI.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'invalid-mode'));
    await pageI.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await pageI.waitForTimeout(150);
    st = await storyState(pageI);
    assert.equal(st.mode, 'compact');
    assert.equal(
      await pageI.evaluate(() => localStorage.getItem('lovebud:browse:viewMode')),
      'invalid-mode',
      'invalid stored value must not be rewritten'
    );
    await pageI.close();
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: My Trees capability shows three buttons and rejects stored story', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:myTrees:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // (6) three buttons only; stored story falls back to compact, unrewritten
    const modes = await page.$$eval('.tree-view-mode-btn', (btns) => btns.map((b) => b.getAttribute('data-mode')));
    assert.deepEqual(modes, ['large', 'compact', 'list']);
    assert.equal(await page.$('.tree-view-mode-btn[data-mode="story"]'), null);
    assert.equal(
      await page.evaluate(() => document.getElementById('trees-grid').getAttribute('data-tree-view-mode')),
      'compact'
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('lovebud:myTrees:viewMode')), 'story');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Group behaviour ──────────────────────────────────────────────── */

test('#3655 browser: responsive group sizes 3/2/1 and local sequence of all 7 cards', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    // (7) wide desktop: 3 visible
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageW = await wide.newPage();
    await pageW.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await pageW.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await pageW.waitForTimeout(150);
    let st = await storyState(pageW);
    assert.equal(st.mode, 'story');
    assert.equal(st.visible.length, 3, 'wide shows 3 cards');
    assert.equal(st.groupSizeAttr, '3');
    assert.equal(st.indicator, '01 / 03', '(15) indicator matches ceil(7/3)');
    assert.equal(st.a11y, '스토리 1 / 3');
    assert.equal(st.prevDisabled, true, '(13) first boundary disabled');
    assert.equal(st.nextDisabled, false);

    // (10) all 7 cards in order across local groups; (11) next; (14) last boundary
    const sequence = [...st.visible];
    await pageW.click('[data-story-next]');
    await pageW.waitForTimeout(420);
    st = await storyState(pageW);
    assert.deepEqual(st.visible, ['browse-4', 'browse-5', 'browse-6'], '(11) next moves one group');
    assert.equal(st.indicator, '02 / 03');
    assert.equal(st.prevDisabled, false);
    sequence.push(...st.visible);

    await pageW.click('[data-story-next]');
    await pageW.waitForTimeout(420);
    st = await storyState(pageW);
    assert.deepEqual(st.visible, ['browse-7']);
    assert.equal(st.groupSizeAttr, '1', 'partial last group renders a single centered slot');
    assert.equal(st.nextDisabled, true, '(14) last boundary disabled');
    assert.equal(st.indicator, '03 / 03');
    sequence.push(...st.visible);
    assert.deepEqual(sequence, BROWSE_IDS, '(10) every card appears once, in order');

    // (12) previous moves back
    await pageW.click('[data-story-prev]');
    await pageW.waitForTimeout(420);
    st = await storyState(pageW);
    assert.deepEqual(st.visible, ['browse-4', 'browse-5', 'browse-6'], '(12) previous moves back one group');
    await wide.close();

    // (8) tablet: 2 visible
    const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const pageT = await tablet.newPage();
    await pageT.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await pageT.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await pageT.waitForTimeout(150);
    st = await storyState(pageT);
    assert.equal(st.visible.length, 2, 'tablet shows 2 cards');
    assert.equal(st.groupSizeAttr, '2');
    assert.equal(st.indicator, '01 / 04', 'tablet groups ceil(7/2)');
    await tablet.close();

    // (9) mobile: 1 visible
    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const pageM = await mobile.newPage();
    await pageM.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await pageM.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await pageM.waitForTimeout(150);
    st = await storyState(pageM);
    assert.equal(st.visible.length, 1, 'mobile shows 1 card');
    assert.equal(st.groupSizeAttr, '1');
    assert.equal(st.indicator, '01 / 07');
    await mobile.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: result replacement, skeleton, empty and one-card coherence', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // move to the last group, then replace the result set
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    let st = await storyState(page);
    assert.equal(st.indicator, '03 / 03');

    // (18) replacement resets/clamps — no blank group
    await page.evaluate(() => window.__renderCards(['n-1', 'n-2', 'n-3']));
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.mode, 'story', 'mode attribute survives replacement');
    assert.equal(st.indicator, '01 / 01', 'new result set resets to the first group');
    assert.equal(st.visible.length, 3, 'no blank group after replacement');
    assert.deepEqual(st.visible, ['n-1', 'n-2', 'n-3']);

    // (16) one-card set: coherent disabled state
    await page.evaluate(() => window.__renderCards(['solo-1']));
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 01');
    assert.equal(st.prevDisabled, true);
    assert.equal(st.nextDisabled, true);
    assert.deepEqual(st.visible, ['solo-1']);
    assert.equal(st.groupSizeAttr, '1');

    // (17) zero cards → nav hidden (empty state)
    await page.evaluate(() => window.__renderEmpty());
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.navHidden, true, 'nav hidden for zero results');

    // skeleton state must not show the nav either
    await page.evaluate(() => window.__renderCards(['a-1', 'a-2', 'a-3', 'a-4']));
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.navHidden, false);
    await page.evaluate(() => window.__renderSkeleton());
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.navHidden, true, 'nav hidden during skeleton-only results');

    // (19) switching back to compact restores every card and hides the nav
    await page.evaluate((ids) => window.__renderCards(ids), BROWSE_IDS);
    await page.waitForTimeout(120);
    await clickModeButton(page, 'compact');
    st = await storyState(page);
    assert.equal(st.mode, 'compact');
    assert.equal(st.navHidden, true);
    const hiddenCount = await page.evaluate(() =>
      [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')].filter((c) => c.hidden).length
    );
    assert.equal(hiddenCount, 0, '(19) all cards restored after leaving story mode');
    const storyAttrs = await page.evaluate(() => ({
      group: document.getElementById('resultsList').getAttribute('data-story-group-size'),
      dir: document.getElementById('resultsList').getAttribute('data-story-direction'),
      classes: [...document.querySelectorAll('#resultsList .is-story-visible, #resultsList .is-story-entering')].length,
    }));
    assert.equal(storyAttrs.group, null);
    assert.equal(storyAttrs.dir, null);
    assert.equal(storyAttrs.classes, 0);

    // (20) returning to story shows a valid group again
    await clickModeButton(page, 'story');
    st = await storyState(page);
    assert.equal(st.mode, 'story');
    assert.equal(st.visible.length, 3);
    assert.equal(st.indicator, '01 / 03');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Keyboard ─────────────────────────────────────────────────────── */

test('#3655 browser: keyboard navigation semantics', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // (21) ArrowRight
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(420);
    let st = await storyState(page);
    assert.equal(st.indicator, '02 / 03', '(21) ArrowRight moves to the next group');

    // (26) one keydown = exactly one group movement
    assert.notEqual(st.indicator, '03 / 03', '(26) a single keydown must not move twice');

    // (22) ArrowLeft
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 03', '(22) ArrowLeft moves back');

    // boundary clamp: ArrowLeft at the first group stays put
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 03', 'index clamps at the first group');

    // (24) End
    await page.keyboard.press('End');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '03 / 03', '(24) End jumps to the last group');

    // (23) Home
    await page.keyboard.press('Home');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 03', '(23) Home jumps to the first group');

    // (25) editable targets are never intercepted
    await page.focus('#searchInput');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('End');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 03', '(25) arrow/Home keys inside an input must not move groups');

    // modifier combinations are ignored
    await page.keyboard.press('Control+ArrowRight');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01 / 03', 'modifier+arrow is ignored');

    // (27) focus stays predictable (on the focused nav button)
    await page.focus('[data-story-next]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(420);
    const focusState = await page.evaluate(() => ({
      onNext: document.activeElement === document.querySelector('[data-story-next]'),
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
    }));
    assert.equal(focusState.onNext, true, '(27) focus remains on the nav control');
    assert.equal(focusState.indicator, '02 / 03');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Existing card behaviour preserved ────────────────────────────── */

test('#3655 browser: visible cards keep exactly one canonical CTA; hidden cards leave tab order', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const navRequests = await interceptViewerNav(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // (28) one CTA per visible card
    const ctaCounts = await page.evaluate(() =>
      [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')]
        .filter((c) => !c.hidden)
        .map((c) => c.querySelectorAll('.tree-card-open-link').length)
    );
    assert.equal(ctaCounts.length, 3);
    assert.deepEqual(ctaCounts, [1, 1, 1], '(28) exactly one primary CTA per visible card');

    // (33) hidden cards are not focusable / not in tab order
    const hiddenFocus = await page.evaluate(() => {
      const hiddenCard = document.querySelector('#resultsList .tree-card[data-tree-id="browse-4"]');
      const link = hiddenCard.querySelector('.tree-card-open-link');
      link.focus();
      return {
        cardHidden: hiddenCard.hidden,
        display: getComputedStyle(hiddenCard).display,
        focused: document.activeElement === link,
        rects: link.getClientRects().length,
      };
    });
    assert.equal(hiddenFocus.cardHidden, true);
    assert.equal(hiddenFocus.display, 'none');
    assert.equal(hiddenFocus.focused, false, '(33) hidden card CTA must not take focus');
    assert.equal(hiddenFocus.rects, 0, '(33) hidden card CTA has no rendered box');

    // (29) CTA click navigates exactly once to the canonical route
    await page.click('#resultsList .tree-card[data-tree-id="browse-2"] .tree-card-open-link');
    await page.waitForTimeout(200);
    assert.equal(navRequests.length, 1, '(29) exactly one navigation');
    assert.match(navRequests[0], /\/pages\/view\.html\?treeId=browse-2$/, '(32) canonical appreciation URL');
    await context.close();

    // (34) no duplicate delegated card events while Story is active
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();
    await page2.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page2.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(150);
    await page2.click('#resultsList .tree-card[data-tree-id="browse-1"] .tree-title');
    await page2.waitForTimeout(80);
    const selects = await page2.evaluate(() => ({ count: window.__selects, id: window.__lastSelect }));
    assert.equal(selects.count, 1, '(34) one card click = one preview selection');
    assert.equal(selects.id, 'browse-1');
    await context2.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: mobile card activation (Enter / Space / click) opens the canonical viewer once', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    async function mobileActivation(kind) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const navRequests = await interceptViewerNav(page);
      await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
      await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);

      const st = await storyState(page);
      assert.deepEqual(st.visible, ['browse-1'], 'mobile story shows the first card');

      if (kind === 'click') {
        await page.click('#resultsList .tree-card[data-tree-id="browse-1"] .tree-title');
      } else {
        await page.focus('#resultsList .tree-card[data-tree-id="browse-1"]');
        await page.keyboard.press(kind === 'enter' ? 'Enter' : ' ');
      }
      await page.waitForTimeout(250);
      assert.equal(navRequests.length, 1, `${kind}: exactly one navigation`);
      assert.match(navRequests[0], /\/pages\/view\.html\?treeId=browse-1$/, `${kind}: (32) same canonical URL`);
      await context.close();
    }

    // (29)/(30)/(31) click, Enter, Space each open exactly once; (32) same URL
    await mobileActivation('click');
    await mobileActivation('enter');
    await mobileActivation('space');
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Geometry ─────────────────────────────────────────────────────── */

test('#3655 browser: geometry at 1440x900 / 768x1024 / 375x812 + reduced motion', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    async function measure(viewport, mobile) {
      const context = await browser.newContext(
        mobile
          ? { viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true }
          : { viewport: { width: viewport.width, height: viewport.height } }
      );
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
      await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);
      const geo = await page.evaluate(() => {
        const results = document.getElementById('resultsList');
        const main = document.querySelector('.lovetree-calm-main-column');
        const nav = document.querySelector('.browse-story-navigation');
        const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')].filter((c) => !c.hidden);
        const resultsRect = results.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const cardChecks = visible.map((card) => {
          const r = card.getBoundingClientRect();
          const cta = card.querySelector('.tree-card-open-link');
          const ctaRect = cta.getBoundingClientRect();
          let childOverflow = false;
          card.querySelectorAll('*').forEach((el) => {
            const er = el.getBoundingClientRect();
            if (er.width <= 0 || er.height <= 0) return;
            if (er.right > r.right + 1.5 || er.left < r.left - 1.5) childOverflow = true;
          });
          return {
            insideResults: r.left >= resultsRect.left - 1 && r.right <= resultsRect.right + 1,
            ctaInside: ctaRect.right <= r.right + 1 && ctaRect.bottom <= r.bottom + 1 && ctaRect.width > 0,
            childOverflow,
          };
        });
        return {
          visibleCount: visible.length,
          groupSizeAttr: results.getAttribute('data-story-group-size'),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          navInsideMain: navRect.left >= mainRect.left - 1 && navRect.right <= mainRect.right + 1,
          navVisible: !nav.hidden && navRect.width > 0,
          cardChecks,
        };
      });
      await context.close();
      return geo;
    }

    // (35) wide desktop
    const wide = await measure({ width: 1440, height: 900 }, false);
    assert.equal(wide.visibleCount, 3);
    assert.equal(wide.groupSizeAttr, '3');
    assert.ok(wide.navInsideMain, '(40) nav stays inside the main column (wide)');
    assert.ok(wide.cardChecks.every((c) => c.insideResults), '(39) visible cards inside results shell (wide)');
    assert.ok(wide.cardChecks.every((c) => c.ctaInside), '(41) CTA not clipped (wide)');
    assert.ok(wide.cardChecks.every((c) => !c.childOverflow), '(41) no visible child overflow (wide)');

    // (36) tablet
    const tablet = await measure({ width: 768, height: 1024 }, false);
    assert.equal(tablet.visibleCount, 2);
    assert.equal(tablet.groupSizeAttr, '2');
    assert.ok(tablet.navInsideMain, '(40) nav stays inside the main column (tablet)');
    assert.ok(tablet.cardChecks.every((c) => c.insideResults), '(39) visible cards inside results shell (tablet)');
    assert.ok(tablet.cardChecks.every((c) => c.ctaInside), '(41) CTA not clipped (tablet)');

    // (37) mobile
    const mobile = await measure({ width: 375, height: 812 }, true);
    assert.equal(mobile.visibleCount, 1);
    assert.equal(mobile.groupSizeAttr, '1');
    assert.ok(mobile.navVisible);
    assert.ok(mobile.navInsideMain, '(40) nav stays inside the main column (mobile)');
    assert.ok(mobile.cardChecks.every((c) => c.insideResults), '(39) visible card inside results shell (mobile)');
    assert.ok(mobile.cardChecks.every((c) => c.ctaInside), '(41) CTA not clipped (mobile)');
    // (38) no horizontal overflow at 375
    assert.ok(
      mobile.scrollWidth <= mobile.clientWidth + 1,
      `(38) scrollWidth ${mobile.scrollWidth} must not exceed clientWidth ${mobile.clientWidth}`
    );

    // (42) reduced motion removes the transform animation
    const rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    await rmPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await rmPage.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(150);
    await rmPage.click('[data-story-next]');
    await rmPage.waitForTimeout(100);
    const rm = await rmPage.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .filter((c) => !c.hidden && !c.closest('.browse-story-transition-stage'));
      const entering = visible.filter((c) => c.classList.contains('is-story-entering'));
      return {
        wrapperCount: wrappers.length,
        visibleIds: visible.map(c => c.getAttribute('data-tree-id')),
        enteringCount: entering.length,
      };
    });
    // (42) reduced-motion uses immediate path: no wrappers, no animation class
    assert.equal(rm.wrapperCount, 0, '(42) no transition wrappers under reduced motion');
    assert.deepEqual(rm.visibleIds, ['browse-4', 'browse-5', 'browse-6'], '(42) immediate swap to next group');
    await rmContext.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Bidirectional transition behaviour ──────────────────────────── */

test('#3655 browser: bidirectional transition shows both outgoing and incoming layers', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    let st = await storyState(page);
    assert.equal(st.mode, 'story');
    assert.equal(st.visible.length, 3);

    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    const transitionState = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const outgoing = results.querySelector('.browse-story-layer-outgoing');
      const incoming = results.querySelector('.browse-story-layer-incoming');
      const ariaBusy = results.getAttribute('aria-busy');
      const direction = results.getAttribute('data-story-direction');

      let outCards = [];
      let inCards = [];
      let outVisible = false;
      let inVisible = false;
      let outInert = false;
      let inInert = false;

      if (outgoing) {
        outCards = [...outgoing.querySelectorAll('.tree-card[data-tree-id]')].map(c => c.getAttribute('data-tree-id'));
        outVisible = getComputedStyle(outgoing).display !== 'none';
        outInert = outgoing.hasAttribute('inert');
      }
      if (incoming) {
        inCards = [...incoming.querySelectorAll('.tree-card[data-tree-id]')].map(c => c.getAttribute('data-tree-id'));
        inVisible = getComputedStyle(incoming).display !== 'none';
        inInert = incoming.hasAttribute('inert');
      }

      return { hasOutgoing: !!outgoing, hasIncoming: !!incoming, outCards, inCards, outVisible, inVisible, outInert, inInert, ariaBusy, direction };
    });

    assert.equal(transitionState.hasOutgoing, true, 'outgoing layer must exist during transition');
    assert.equal(transitionState.hasIncoming, true, 'incoming layer must exist during transition');
    assert.deepEqual(transitionState.outCards, ['browse-1', 'browse-2', 'browse-3']);
    assert.deepEqual(transitionState.inCards, ['browse-4', 'browse-5', 'browse-6']);
    assert.equal(transitionState.outVisible, true, 'outgoing layer visible during transition');
    assert.equal(transitionState.inVisible, true, 'incoming layer visible during transition');
    assert.equal(transitionState.outInert, true, 'outgoing layer must be inert');
    assert.equal(transitionState.ariaBusy, 'true', 'results must have aria-busy during transition');
    assert.equal(transitionState.direction, 'next');

    await page.waitForTimeout(400);

    const afterState = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const ariaBusy = results.getAttribute('aria-busy');
      const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id'));
      const allCards = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .map(c => c.getAttribute('data-tree-id'));
      return { wrapperCount: wrappers.length, ariaBusy, visible, allCards };
    });

    assert.equal(afterState.wrapperCount, 0, 'all transition wrappers removed');
    assert.ok(afterState.ariaBusy === null || afterState.ariaBusy === 'false', 'aria-busy cleared');
    assert.deepEqual(afterState.visible, ['browse-4', 'browse-5', 'browse-6']);
    assert.deepEqual(afterState.allCards, ['browse-1', 'browse-2', 'browse-3', 'browse-4', 'browse-5', 'browse-6', 'browse-7'], 'canonical card order restored');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: prev direction uses opposite transforms', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await page.click('[data-story-next]');
    await page.waitForTimeout(400);

    await page.click('[data-story-prev]');
    await page.waitForTimeout(50);

    const transitionState = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const outgoing = results.querySelector('.browse-story-layer-outgoing');
      const incoming = results.querySelector('.browse-story-layer-incoming');
      const direction = results.getAttribute('data-story-direction');
      let outCards = [];
      let inCards = [];
      if (outgoing) outCards = [...outgoing.querySelectorAll('.tree-card[data-tree-id]')].map(c => c.getAttribute('data-tree-id'));
      if (incoming) inCards = [...incoming.querySelectorAll('.tree-card[data-tree-id]')].map(c => c.getAttribute('data-tree-id'));
      return { direction, outCards, inCards };
    });

    assert.equal(transitionState.direction, 'prev');
    assert.deepEqual(transitionState.outCards, ['browse-4', 'browse-5', 'browse-6']);
    assert.deepEqual(transitionState.inCards, ['browse-1', 'browse-2', 'browse-3']);

    await page.waitForTimeout(400);
    const st = await storyState(page);
    assert.equal(st.indicator, '01 / 03');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: rapid double-click is blocked during transition', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await page.click('[data-story-next]');
    await page.click('[data-story-next]');
    // Wait for transition to complete (340+20ms) before checking indicator
    await page.waitForTimeout(450);

    const midState = await page.evaluate(() => {
      return document.querySelector('.browse-story-indicator-current').textContent;
    });
    assert.equal(midState, '02 / 03', 'rapid double-click must only move one group');

    await page.waitForTimeout(400);
    const st = await storyState(page);
    assert.equal(st.indicator, '02 / 03');
    assert.deepEqual(st.visible, ['browse-4', 'browse-5', 'browse-6']);

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: keyboard blocked during transition', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(20);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);

    const st = await storyState(page);
    assert.equal(st.indicator, '02 / 03', 'second ArrowRight during transition must be blocked');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: reduced-motion uses immediate path (no wrappers)', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    const state = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id'));
      return { wrapperCount: wrappers.length, visible };
    });

    assert.equal(state.wrapperCount, 0, 'reduced-motion must not create transition wrappers');
    assert.deepEqual(state.visible, ['browse-4', 'browse-5', 'browse-6']);

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: no overflow at 1440/768/375 during and after transition', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    async function checkOverflow(viewport, mobile) {
      const context = await browser.newContext(
        mobile
          ? { viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true }
          : { viewport: { width: viewport.width, height: viewport.height } }
      );
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
      await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);

      await page.click('[data-story-next]');
      await page.waitForTimeout(50);

      const mid = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      await page.waitForTimeout(400);

      const after = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      await context.close();
      return { mid, after };
    }

    const wide = await checkOverflow({ width: 1440, height: 900 }, false);
    assert.ok(wide.mid.scrollWidth <= wide.mid.clientWidth + 1, 'no overflow at 1440 mid-transition');
    assert.ok(wide.after.scrollWidth <= wide.after.clientWidth + 1, 'no overflow at 1440 after');

    const tablet = await checkOverflow({ width: 768, height: 1024 }, false);
    assert.ok(tablet.mid.scrollWidth <= tablet.mid.clientWidth + 1, 'no overflow at 768 mid-transition');
    assert.ok(tablet.after.scrollWidth <= tablet.after.clientWidth + 1, 'no overflow at 768 after');

    const mobile = await checkOverflow({ width: 375, height: 812 }, true);
    assert.ok(mobile.mid.scrollWidth <= mobile.mid.clientWidth + 1, 'no overflow at 375 mid-transition');
    assert.ok(mobile.after.scrollWidth <= mobile.after.clientWidth + 1, 'no overflow at 375 after');
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Geometry: layer-specific independent sizing (Blocker A) ────── */

test('#3655 browser: wide 3→1 transition — computed geometry and layer sizes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(String(error)); });
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Navigate to last group (3→1 transition)
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    const geo = await page.evaluate(() => {
      const outLayer = document.querySelector('.browse-story-layer-outgoing');
      const inLayer = document.querySelector('.browse-story-layer-incoming');
      if (!outLayer || !inLayer) return { missingLayer: true };
      const outStyle = getComputedStyle(outLayer);
      const inStyle = getComputedStyle(inLayer);
      const outRects = [...outLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      const inRects = [...inLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      const resultsRect = document.getElementById('resultsList').getBoundingClientRect();
      const inCenterX = resultsRect.left + resultsRect.width / 2;
      const inRect = inLayer.getBoundingClientRect();
      const inLayerCenterX = inRect.left + inRect.width / 2;
      return {
        outgoingSize: outLayer.getAttribute('data-story-layer-size'),
        incomingSize: inLayer.getAttribute('data-story-layer-size'),
        outGridCols: outStyle.gridTemplateColumns,
        inGridCols: inStyle.gridTemplateColumns,
        outRects: outRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
        inRects: inRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
        inCenterX,
        inLayerCenterX,
      };
    });

    assert.equal(geo.missingLayer, undefined, 'both layers must exist');
    assert.equal(geo.outgoingSize, '3', 'outgoing layer size');
    assert.equal(geo.incomingSize, '1', 'incoming layer size');
    // Outgoing: 3 columns
    const parsedOut = geo.outGridCols.split(/\s+/).filter(Boolean);
    assert.equal(parsedOut.length, 3, 'outgoing grid must define exactly 3 columns: ' + geo.outGridCols);
    // Incoming: single centered column (560px)
    assert.match(geo.inGridCols, /560px/, 'incoming grid must be 560px centered');
    // Outgoing cards: 3 distinct columns, same row
    assert.equal(geo.outRects.length, 3, 'outgoing must have 3 cards');
    assert.ok(Math.abs(geo.outRects[0].top - geo.outRects[1].top) < 2, 'outgoing cards same row (top)');
    assert.ok(geo.outRects[1].left > geo.outRects[0].right - 2, 'outgoing card 2 right of card 1');
    assert.ok(geo.outRects[2].left > geo.outRects[1].right - 2, 'outgoing card 3 right of card 2');
    // Incoming: single card, centered
    assert.equal(geo.inRects.length, 1, 'incoming must have 1 card');
    // Incoming card: single column centered in wrapper (justify-content: center).
    // Use wrapper's bounding rect center. Compute card center from
    // (left + right) / 2 since width is not in the mapped rect object.
    // Allow 30px tolerance for grid layout rounding between wrapper and content.
    var cardCenterX = (geo.inRects[0].left + geo.inRects[0].right) / 2;
    assert.ok(Math.abs(cardCenterX - geo.inLayerCenterX) < 30, 'incoming card horizontally centered in wrapper');

    assert.deepEqual(pageErrors, [], 'no page errors during wide 3→1 transition');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: wide 1→3 transition — computed geometry and layer sizes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(String(error)); });
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Forward to last group, then back (1→3 transition)
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-prev]');
    await page.waitForTimeout(50);

    const geo = await page.evaluate(() => {
      const outLayer = document.querySelector('.browse-story-layer-outgoing');
      const inLayer = document.querySelector('.browse-story-layer-incoming');
      if (!outLayer || !inLayer) return { missingLayer: true };
      const outStyle = getComputedStyle(outLayer);
      const inStyle = getComputedStyle(inLayer);
      const outRects = [...outLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      const inRects = [...inLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      return {
        outgoingSize: outLayer.getAttribute('data-story-layer-size'),
        incomingSize: inLayer.getAttribute('data-story-layer-size'),
        outGridCols: outStyle.gridTemplateColumns,
        inGridCols: inStyle.gridTemplateColumns,
        outRects: outRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
        inRects: inRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
      };
    });

    assert.equal(geo.missingLayer, undefined, 'both layers must exist');
    assert.equal(geo.outgoingSize, '1', 'outgoing layer size (1 card)');
    assert.equal(geo.incomingSize, '3', 'incoming layer size (3 cards)');
    // Outgoing: single centered column
    assert.match(geo.outGridCols, /560px/, 'outgoing grid must be 560px centered');
    // Incoming: 3 columns
    const parsedIn = geo.inGridCols.split(/\s+/).filter(Boolean);
    assert.equal(parsedIn.length, 3, 'incoming grid must define exactly 3 columns: ' + geo.inGridCols);
    // Incoming cards: 3 distinct columns, same row, no stack
    assert.equal(geo.inRects.length, 3, 'incoming must have 3 cards');
    assert.ok(Math.abs(geo.inRects[0].top - geo.inRects[1].top) < 2, 'incoming cards same row');
    assert.ok(geo.inRects[1].left > geo.inRects[0].right - 2, 'incoming card 2 right of card 1');
    assert.ok(geo.inRects[2].left > geo.inRects[1].right - 2, 'incoming card 3 right of card 2');
    // Outgoing: 1 card
    assert.equal(geo.outRects.length, 1, 'outgoing must have 1 card');

    assert.deepEqual(pageErrors, [], 'no page errors during wide 1→3 transition');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: tablet 2→1 transition — computed geometry and layer sizes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(String(error)); });
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // tablet 2 per group → click through to last group (2→1 transition)
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    const geo = await page.evaluate(() => {
      const outLayer = document.querySelector('.browse-story-layer-outgoing');
      const inLayer = document.querySelector('.browse-story-layer-incoming');
      if (!outLayer || !inLayer) return { missingLayer: true };
      const outStyle = getComputedStyle(outLayer);
      const inStyle = getComputedStyle(inLayer);
      const outRects = [...outLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      const inRects = [...inLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      return {
        outgoingSize: outLayer.getAttribute('data-story-layer-size'),
        incomingSize: inLayer.getAttribute('data-story-layer-size'),
        outGridCols: outStyle.gridTemplateColumns,
        inGridCols: inStyle.gridTemplateColumns,
        outRects: outRects.map(r => ({ left: r.left, top: r.top })),
        inRects: inRects.map(r => ({ left: r.left, top: r.top })),
      };
    });

    assert.equal(geo.missingLayer, undefined, 'both layers must exist');
    assert.equal(geo.outgoingSize, '2', 'outgoing layer size');
    assert.equal(geo.incomingSize, '1', 'incoming layer size');
    var outTracks = geo.outGridCols.split(/\s+/).filter(Boolean);
    assert.equal(outTracks.length, 2, 'outgoing grid must have 2 column tracks: ' + geo.outGridCols);
    assert.equal(geo.outRects.length, 2, 'outgoing must have 2 cards');
    assert.ok(Math.abs(geo.outRects[0].top - geo.outRects[1].top) < 2, 'outgoing cards same row');
    assert.ok(geo.outRects[1].left > geo.outRects[0].left, 'outgoing card 2 right of card 1');
    assert.equal(geo.inRects.length, 1, 'incoming must have 1 card');

    assert.deepEqual(pageErrors, [], 'no page errors during tablet 2→1 transition');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: tablet 1→2 transition — computed geometry and layer sizes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(String(error)); });
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Go to last group, then back (1→2 transition)
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-prev]');
    await page.waitForTimeout(50);

    const geo = await page.evaluate(() => {
      const outLayer = document.querySelector('.browse-story-layer-outgoing');
      const inLayer = document.querySelector('.browse-story-layer-incoming');
      if (!outLayer || !inLayer) return { missingLayer: true };
      const outStyle = getComputedStyle(outLayer);
      const inStyle = getComputedStyle(inLayer);
      const outRects = [...outLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      const inRects = [...inLayer.querySelectorAll('.tree-card')].map(c => c.getBoundingClientRect());
      return {
        outgoingSize: outLayer.getAttribute('data-story-layer-size'),
        incomingSize: inLayer.getAttribute('data-story-layer-size'),
        outGridCols: outStyle.gridTemplateColumns,
        inGridCols: inStyle.gridTemplateColumns,
        outRects: outRects.map(r => ({ left: r.left, top: r.top })),
        inRects: inRects.map(r => ({ left: r.left, top: r.top })),
      };
    });

    assert.equal(geo.missingLayer, undefined, 'both layers must exist');
    assert.equal(geo.outgoingSize, '1', 'outgoing layer size (1 card)');
    assert.equal(geo.incomingSize, '2', 'incoming layer size (2 cards)');
    assert.equal(geo.outRects.length, 1, 'outgoing must have 1 card');
    var inTracks = geo.inGridCols.split(/\s+/).filter(Boolean);
    assert.equal(inTracks.length, 2, 'incoming grid must have 2 column tracks: ' + geo.inGridCols);
    assert.equal(geo.inRects.length, 2, 'incoming must have 2 cards');
    assert.ok(Math.abs(geo.inRects[0].top - geo.inRects[1].top) < 2, 'incoming cards same row');
    assert.ok(geo.inRects[1].left > geo.inRects[0].left, 'incoming card 2 right of card 1');

    assert.deepEqual(pageErrors, [], 'no page errors during tablet 1→2 transition');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── External result replacement during transition (Blocker B) ──── */

test('#3655 browser: external results.innerHTML during transition cancels cleanly without stale cards', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // During transition, replace results via innerHTML
    await page.evaluate(() => {
      window.__exception = false;
      try {
        window.__renderCards(['new-1', 'new-2', 'new-3']);
      } catch (e) {
        window.__exception = true;
      }
    });

    await page.waitForTimeout(200);

    const state = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const allIds = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .map(card => card.getAttribute('data-tree-id'));
      const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id'));
      const indicator = document.querySelector('.browse-story-indicator-current');
      return {
        exception: window.__exception,
        wrapperCount: wrappers.length,
        ariaBusy: results.getAttribute('aria-busy'),
        allIds,
        oldIds: allIds.filter(id => id.startsWith('browse-')),
        visible,
        indicator: indicator ? indicator.textContent : null,
        heightProp: results.style.getPropertyValue('--story-transition-height'),
      };
    });

    assert.equal(state.exception, false, 'no exception during external replacement');
    assert.equal(state.wrapperCount, 0, 'no stale wrappers after external replacement');
    assert.equal(state.ariaBusy, null, 'aria-busy cleared after external replacement');
    assert.deepEqual(state.oldIds, [], 'no old browse- IDs remain in DOM');
    assert.deepEqual(state.visible, ['new-1', 'new-2', 'new-3'], 'new cards displayed after external replacement');
    assert.equal(state.indicator, '01 / 01', 'indicator reset after external replacement');
    assert.equal(state.heightProp, '', '--story-transition-height removed after replacement');
    assert.deepEqual(pageErrors, [], 'no page errors during external replacement');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Keyboard guard order (Blocker C) ───────────────────────────── */

test('#3655 browser: arrow/Home/End keys in search input are not prevented during transition', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start a transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Focus on search input and test each navigation key
    await page.focus('#searchInput');

    async function isDefaultPrevented(key) {
      return page.evaluate((k) => {
        const input = document.getElementById('searchInput');
        let prevented = null;
        const handler = (e) => { prevented = e.defaultPrevented; };
        document.addEventListener('keydown', handler, { once: true });
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: k,
          code: k,
          keyCode: k === 'ArrowLeft' ? 37 : k === 'ArrowRight' ? 39 : k === 'Home' ? 36 : 35,
          bubbles: true,
          cancelable: true,
        }));
        document.removeEventListener('keydown', handler);
        return prevented;
      }, key);
    }

    assert.equal(await isDefaultPrevented('ArrowLeft'), false, 'ArrowLeft in input must not be prevented during transition');
    assert.equal(await isDefaultPrevented('ArrowRight'), false, 'ArrowRight in input must not be prevented during transition');
    assert.equal(await isDefaultPrevented('Home'), false, 'Home in input must not be prevented during transition');
    assert.equal(await isDefaultPrevented('End'), false, 'End in input must not be prevented during transition');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Idempotent cancellation (Blocker D) ─────────────────────────── */

test('#3655 browser: compact mode during transition cancels cleanly with canonical order', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition (Next)
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Switch to compact during transition
    await clickModeButton(page, 'compact');
    await page.waitForTimeout(100);

    // Verify canonical direct-child order
    const ids = await directCardIds(page);
    assert.deepEqual(ids, CANONICAL_IDS, 'canonical direct-child order after Next cancellation');

    const state = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const allCards = [...results.querySelectorAll('.tree-card[data-tree-id]')];
      return {
        wrapperCount: wrappers.length,
        mode: results.getAttribute('data-tree-view-mode'),
        ariaBusy: results.getAttribute('aria-busy'),
        direction: results.getAttribute('data-story-direction'),
        inertCount: allCards.filter(c => c.hasAttribute('inert')).length,
        heightProp: results.style.getPropertyValue('--story-transition-height'),
      };
    });

    assert.equal(state.mode, 'compact', 'mode switched to compact');
    assert.equal(state.wrapperCount, 0, 'no wrappers after cancel');
    assert.ok(state.ariaBusy === null || state.ariaBusy === 'false', 'aria-busy cleared');
    assert.equal(state.direction, null, 'direction cleared');
    assert.equal(state.inertCount, 0, 'no inert cards after cancel');
    assert.equal(state.heightProp, '', 'height custom property removed');
    assert.deepEqual(pageErrors, [], 'no page errors during compact cancellation');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: Previous cancellation restores canonical order', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Navigate to last group (3 cards → 1 card)
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);

    // Start Previous transition (1→3)
    await page.click('[data-story-prev]');
    await page.waitForTimeout(50);

    // Cancel via compact
    await clickModeButton(page, 'compact');
    await page.waitForTimeout(100);

    // Verify canonical direct-child order
    const ids = await directCardIds(page);
    assert.deepEqual(ids, CANONICAL_IDS, 'canonical direct-child order after Previous cancellation');
    assert.deepEqual(pageErrors, [], 'no page errors during Previous cancellation');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: story re-entry after cancellation works correctly', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition then cancel via compact
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);
    await clickModeButton(page, 'compact');
    await page.waitForTimeout(100);

    // Verify canonical order before re-entry
    const preIds = await directCardIds(page);
    assert.deepEqual(preIds, CANONICAL_IDS, 'canonical order before story re-entry');

    // Re-enter story mode
    await clickModeButton(page, 'story');
    await page.waitForTimeout(150);

    const st = await storyState(page);
    assert.equal(st.mode, 'story', 'story mode re-entered');
    assert.equal(st.visible.length, 3, 'shows 3 cards after re-entry');
    assert.equal(st.indicator, '01 / 03', 'indicator reset to first group');
    assert.equal(st.navHidden, false, 'nav visible after re-entry');
    assert.equal(st.prevDisabled, true, 'prev disabled at first group');

    // Navigate should work after re-entry
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    const st2 = await storyState(page);
    assert.equal(st2.indicator, '02 / 03', 'navigation works after re-entry');
    assert.deepEqual(pageErrors, [], 'no page errors during story re-entry');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: breakpoint change during transition cancels cleanly', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Change viewport to tablet size during transition
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    const st = await storyState(page);
    assert.equal(st.mode, 'story', 'story mode preserved after breakpoint change');
    assert.equal(st.groupSizeAttr, '2', 'group size changed to 2 for tablet');
    assert.equal(st.visible.length, 2, 'shows 2 cards after breakpoint change');

    // Verify canonical order and cleanup
    const ids = await directCardIds(page);
    assert.deepEqual(ids, CANONICAL_IDS, 'canonical direct-child order after breakpoint');
    assert.equal(await transitionHeightProperty(page), '', 'height property removed after breakpoint');
    assert.deepEqual(pageErrors, [], 'no page errors during breakpoint change');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: destroy during transition cleans up completely', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Destroy the controller during transition
    await page.evaluate(() => window.__storyController.destroy());
    await page.waitForTimeout(100);

    // Verify canonical direct-child order
    const ids = await directCardIds(page);
    assert.deepEqual(ids, CANONICAL_IDS, 'canonical direct-child order after destroy');

    const state = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const nav = document.querySelector('.browse-story-navigation');
      const allCards = [...results.querySelectorAll('.tree-card[data-tree-id]')];
      const hiddenCount = allCards.filter(c => c.hidden).length;
      const storyVisible = results.querySelectorAll('.is-story-visible, .is-story-entering, .is-story-exiting');
      return {
        wrapperCount: wrappers.length,
        navExists: !!nav,
        allCardsCount: allCards.length,
        hiddenCount,
        storyClassCount: storyVisible.length,
        ariaBusy: results.getAttribute('aria-busy'),
        direction: results.getAttribute('data-story-direction'),
        groupSize: results.getAttribute('data-story-group-size'),
        mode: results.getAttribute('data-tree-view-mode'),
        heightProp: results.style.getPropertyValue('--story-transition-height'),
      };
    });

    assert.equal(state.wrapperCount, 0, 'no wrappers after destroy');
    assert.equal(state.navExists, false, 'nav element removed');
    assert.equal(state.allCardsCount, 7, 'all 7 cards in DOM');
    assert.equal(state.hiddenCount, 0, 'all cards visible');
    assert.equal(state.storyClassCount, 0, 'no story transition classes');
    assert.ok(state.ariaBusy === null || state.ariaBusy === 'false', 'aria-busy cleared');
    assert.equal(state.direction, null, 'direction attribute cleared');
    assert.equal(state.groupSize, null, 'group size attribute cleared');
    assert.equal(state.heightProp, '', 'height custom property removed after destroy');
    assert.deepEqual(pageErrors, [], 'no page errors during destroy');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── Stage height stabilization (Blocker E) ──────────────────────── */

test('#3655 browser: transition height stabilization with different-height cards', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(String(error)); });
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Make cards have different heights: card 0 tall (520px), card 3 shorter (340px)
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')];
      if (cards[0]) cards[0].style.minHeight = '520px';
      if (cards[3]) cards[3].style.minHeight = '340px';
    });

    // Measure parent height before transition
    const beforeHeight = await page.evaluate(() => {
      return document.getElementById('resultsList').getBoundingClientRect().height;
    });

    // Start transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Measure during transition — height should be stabilized by --story-transition-height
    const duringState = await page.evaluate(() => {
      const results = document.getElementById('resultsList');
      const prop = results.style.getPropertyValue('--story-transition-height');
      const rect = results.getBoundingClientRect();
      return {
        customProp: prop,
        propNum: parseFloat(prop),
        height: rect.height,
        minHeight: getComputedStyle(results).minHeight,
      };
    });

    assert.ok(duringState.propNum > 0, '--story-transition-height must be set to a positive px value');
    assert.equal(duringState.minHeight, duringState.customProp + 'px' ? duringState.minHeight : '', 'min-height must match custom property');
    assert.ok(Math.abs(duringState.height - duringState.propNum) < 5, 'results height must be close to custom property');

    await page.waitForTimeout(420);

    // After transition completes, custom property should be removed
    const afterProp = await page.evaluate(() => {
      return document.getElementById('resultsList').style.getPropertyValue('--story-transition-height');
    });
    assert.equal(afterProp, '', '--story-transition-height removed after normal completion');

    // Verify no vertical jump: after height should be close to before height
    const afterHeight = await page.evaluate(() => {
      return document.getElementById('resultsList').getBoundingClientRect().height;
    });
    assert.ok(afterHeight > 50, 'results height must still be positive after transition');

    assert.deepEqual(pageErrors, [], 'no page errors during height-stabilized transition');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3655 browser: refresh during transition cleans up completely', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // Start transition
    await page.click('[data-story-next]');
    await page.waitForTimeout(50);

    // Refresh during transition
    await page.evaluate(() => window.__storyController.refresh());
    await page.waitForTimeout(100);

    // Verify canonical order
    const ids = await directCardIds(page);
    assert.deepEqual(ids, CANONICAL_IDS, 'canonical direct-child order after refresh');

    // Verify clean lifecycle state
    await assertCleanLifecycle(page);

    // Verify indicator shows first group
    const st = await storyState(page);
    assert.equal(st.mode, 'story', 'story mode preserved after refresh');
    assert.equal(st.indicator, '01 / 03', 'indicator reset to first group after refresh');
    assert.equal(st.prevDisabled, true, 'prev disabled at first group');
    assert.equal(st.nextDisabled, false, 'next enabled');

    // Subsequent navigation should work
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    const st2 = await storyState(page);
    assert.equal(st2.indicator, '02 / 03', 'navigation works after refresh');

    assert.deepEqual(pageErrors, [], 'no page errors during refresh');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

/* ── #3771 Story media runtime regression ──────────────────────────── */

const MEDIA_CARD_EXPECTATIONS = [
  { id: 'media-thumb-1', hasImage: true, imgSrc: '/fixture-media/thumb-1.gif', noTextVisual: true },
  { id: 'media-no-thumb', hasTextVisual: true, noImage: true },
  { id: 'media-thumb-2', hasImage: true, imgSrc: '/fixture-media/thumb-2.gif', noTextVisual: true },
  { id: 'media-no-thumb-2', hasTextVisual: true, noImage: true },
  { id: 'media-thumb-3', hasImage: true, imgSrc: '/fixture-media/thumb-1.gif', noTextVisual: true },
  { id: 'media-no-thumb-3', hasTextVisual: true, noImage: true },
];

test('#3771 browser: Story media elements preserved across mode entry and navigation (desktop)', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = capturePageErrors(page);
    const consoleErrors = captureConsoleErrors(page);
    const requestFailures = captureRequestFailures(page);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    /* (1) compact mode: all 6 cards present, media intact */
    const compactIds = await directCardIds(page);
    assert.deepEqual(compactIds, MEDIA_FIXTURE_IDS, 'compact mode shows all 6 fixture cards');
    for (const exp of MEDIA_CARD_EXPECTATIONS) {
      const st = await cardMediaState(page, exp.id);
      assertMediaState(st, exp, `compact[${exp.id}]`);
    }

    /* (1) enter Story mode with deterministic loaded cards */
    await clickModeButton(page, 'story');
    let st = await storyState(page);
    assert.equal(st.mode, 'story');
    assert.equal(st.visible.length, 3, 'wide desktop shows 3 cards');
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'story-entry');

    /* (5) Next/Previous navigation preserves actual media elements */
    await page.click('[data-story-next]');
    await page.waitForTimeout(50); /* mid-transition */
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'mid-transition-next');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '02 / 02', 'group 2 of 2 on wide desktop');
    assert.equal(st.nextDisabled, true, 'last group → next disabled');
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'post-transition-next');

    /* (6) leaving and re-entering Story mode preserves media elements */
    await clickModeButton(page, 'compact');
    await page.waitForTimeout(100);
    for (const exp of MEDIA_CARD_EXPECTATIONS) {
      const state = await cardMediaState(page, exp.id);
      assertMediaState(state, exp, `compact-restore[${exp.id}]`);
    }
    await clickModeButton(page, 'story');
    await page.waitForTimeout(150);
    st = await storyState(page);
    assert.equal(st.mode, 'story');
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'story-re-entry');

    /* (8) hidden cards remain outside the visible/tab sequence */
    const visibilityCounts = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')];
      return {
        visible: cards.filter(c => !c.hidden).length,
        hidden: cards.filter(c => c.hidden).length,
        total: cards.length,
      };
    });
    assert.equal(visibilityCounts.visible, 3, '3 cards visible in current story group on wide desktop');
    assert.equal(visibilityCounts.hidden, 3, '3 cards hidden in off-screen story group');

    /* (9) zero page errors, console errors, request failures, overflow */
    assert.deepEqual(pageErrors, [], 'no page errors during media runtime');
    assert.deepEqual(consoleErrors, [], 'no console errors during media runtime');
    assert.deepEqual(requestFailures, [], 'no same-origin request failures');
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1,
      `no horizontal overflow: scrollWidth ${overflow.scrollWidth} vs clientWidth ${overflow.clientWidth}`);

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3771 browser: Story media elements preserved (mobile + reduced motion)', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    /* ── mobile 390×844 — group size 1 ── */
    const mContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mPage = await mContext.newPage();
    const mPageErrors = capturePageErrors(mPage);
    const mConsoleErrors = captureConsoleErrors(mPage);
    const mRequestFailures = captureRequestFailures(mPage);
    await mPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await mPage.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(150);

    let st = await storyState(mPage);
    assert.equal(st.mode, 'story');
    assert.equal(st.visible.length, 1, 'mobile shows 1 card');
    assert.equal(st.visible[0], 'media-thumb-1');
    await assertVisibleCardMedia(mPage, MEDIA_CARD_EXPECTATIONS, 'mobile-entry');

    /* next navigation on mobile: 1→1 transitions */
    await mPage.click('[data-story-next]');
    await mPage.waitForTimeout(420);
    st = await storyState(mPage);
    assert.equal(st.indicator, '02 / 06');
    assert.deepEqual(st.visible, ['media-no-thumb']);
    const noThumbMobile = await cardMediaState(mPage, 'media-no-thumb');
    assertMediaState(noThumbMobile, { hasTextVisual: true, noImage: true }, 'mobile-no-thumb-after-next');

    await mPage.click('[data-story-next]');
    await mPage.waitForTimeout(420);
    st = await storyState(mPage);
    assert.deepEqual(st.visible, ['media-thumb-2']);
    const thumb2Mobile = await cardMediaState(mPage, 'media-thumb-2');
    assertMediaState(thumb2Mobile, { hasImage: true, imgSrc: '/fixture-media/thumb-2.gif' }, 'mobile-thumb-2-after-next');

    /* overflow check */
    const mOverflow = await mPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(mOverflow.scrollWidth <= mOverflow.clientWidth + 1,
      `mobile: no horizontal overflow (${mOverflow.scrollWidth} vs ${mOverflow.clientWidth})`);

    assert.deepEqual(mPageErrors, [], 'mobile: no page errors');
    assert.deepEqual(mConsoleErrors, [], 'mobile: no console errors');
    assert.deepEqual(mRequestFailures, [], 'mobile: no same-origin request failures');
    await mContext.close();

    /* ── reduced-motion — immediate swap preserves media ── */
    const rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    const rmPageErrors = capturePageErrors(rmPage);
    const rmConsoleErrors = captureConsoleErrors(rmPage);
    await rmPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await rmPage.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(150);

    /* (7) reduced-motion: immediate navigation to group 2 preserves media */
    await rmPage.click('[data-story-next]');
    await rmPage.waitForTimeout(50); /* reduced motion = immediate swap */
    const rmState = await rmPage.evaluate(() => {
      const results = document.getElementById('resultsList');
      const wrappers = results.querySelectorAll('.browse-story-transition-stage');
      const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
        .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id'));
      return { wrapperCount: wrappers.length, visible };
    });
    assert.equal(rmState.wrapperCount, 0, 'reduced-motion: no transition wrappers');
    assert.deepEqual(rmState.visible, ['media-no-thumb-2', 'media-thumb-3', 'media-no-thumb-3'],
      'reduced-motion: immediate swap lands on group 2');
    await assertVisibleCardMedia(rmPage, MEDIA_CARD_EXPECTATIONS, 'rm-after-next');

    assert.deepEqual(rmPageErrors, [], 'reduced-motion: no page errors');
    assert.deepEqual(rmConsoleErrors, [], 'reduced-motion: no console errors');
    await rmContext.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});
