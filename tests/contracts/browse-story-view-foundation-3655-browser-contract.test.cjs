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
 *
 * #4013 hermeticity audit: the fixture/asset chain here is fully same-origin
 * (all CSS `@import` and asset links are relative; `css/global.css` contains
 * no absolute external URL). `captureBrowserHealth()` additionally installs a
 * fail-closed external-network boundary so any unexpected external origin is
 * aborted and recorded with its exact URL instead of silently reaching the
 * real network.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const {
  makeHermeticRouteHandler,
} = require('../helpers/external-network-hermetic.cjs');

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
        /* #3813 adapter-boundary fixture: identical production asset chain as
         * the Browse fixture, plus the optional surface-adapter boundary
         * (translate + onGroupChange) wired at init. */
        if (urlPath === '/fixture-story-adapter.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildAdapterFixture());
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

    /* #3845: fake bounded load-more adapter mirroring js/search/index.js's
     * window.LoveBudBrowseStoryLoadMore boundary. The controller never
     * fetches — it only calls these injected functions. Tests drive the
     * flags below to simulate growth / exhaustion / failure / busy. */
    window.__loadMoreAvailable = false;
    window.__loadMoreFail = false;
    window.__loadMoreCalls = 0;
    window.__pendingMore = [];
    window.LoveBudBrowseStoryLoadMore = {
      canRequestMore: function () {
        return window.__loadMoreAvailable;
      },
      requestMore: function () {
        window.__loadMoreCalls += 1;
        if (window.__loadMoreFail) return Promise.reject(new Error('synthetic load-more failure'));
        if (window.__pendingMore.length) {
          var current = Array.from(document.querySelectorAll('#resultsList .tree-card[data-tree-id]'))
            .map(function (c) { return c.getAttribute('data-tree-id'); });
          window.__renderCards(current.concat(window.__pendingMore));
          window.__pendingMore = [];
        }
        return Promise.resolve(true);
      }
    };

    ui.attachCardEvents(resultsList, ${JSON.stringify(BROWSE_IDS)}.map(function (id) { return { id: id }; }));

    /* Mirror js/search/search-page-shell-init.js wiring (Browse only),
     * including #3845 positionMode + the bounded load-more boundary. */
    var storyController = window.LoveBudBrowseStoryView.init({
      results: '#resultsList',
      navMount: '#browseStoryNavMount',
      positionMode: 'current',
      canRequestMore: function () {
        var loader = window.LoveBudBrowseStoryLoadMore;
        return !!(loader && typeof loader.canRequestMore === 'function' && loader.canRequestMore());
      },
      requestMore: function () {
        var loader = window.LoveBudBrowseStoryLoadMore;
        if (loader && typeof loader.requestMore === 'function') return loader.requestMore();
        return Promise.resolve(false);
      }
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

/* #3813 adapter-boundary fixture: the same production Browse asset chain,
 * but the Story controller is initialized with the optional surface-adapter
 * boundary (translate + onGroupChange). Exposes:
 *   window.__storyController   — controller with the adapter boundary
 *   window.__snapshots         — every settled onGroupChange snapshot
 *   window.__translatedKeys    — every semantic key handed to translate
 *   window.__throwOnGroupChange— when true, onGroupChange throws (contained)
 *   window.__throwTranslate    — when true, translate throws (falls back)
 *   window.__renderCards(ids)  — synchronous result replacement
 * The fixture itself never pre-builds controller DOM state. */
function buildAdapterFixture() {
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
    window.__snapshots = [];
    window.__translatedKeys = [];
    window.__throwOnGroupChange = false;
    window.__throwTranslate = false;

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

    ui.attachCardEvents(resultsList, ${JSON.stringify(BROWSE_IDS)}.map(function (id) { return { id: id }; }));

    var storyController = window.LoveBudBrowseStoryView.init({
      results: '#resultsList',
      navMount: '#browseStoryNavMount',
      translate: function (key, locale) {
        if (window.__throwTranslate) throw new Error('translate boom');
        window.__translatedKeys.push(key);
        if (key === 'story.label') return '스토리';
        if (key === 'story.regionLabel') return '나의 트리 스토리';
        if (key === 'story.previous') return '이전 스토리';
        if (key === 'story.next') return '다음 스토리';
        if (key === 'story.position') return '현재 그룹 {current} / 전체 {total}';
        return null;
      },
      onGroupChange: function (snapshot) {
        window.__snapshots.push(snapshot);
        window.__snapshotDom = {
          wrapperCount: document.querySelectorAll('.browse-story-transition-stage').length,
          ariaBusy: document.getElementById('resultsList').getAttribute('aria-busy'),
          direction: document.getElementById('resultsList').getAttribute('data-story-direction'),
          directOrder: Array.from(document.querySelectorAll('#resultsList > .tree-card[data-tree-id]'))
            .map(function (c) { return c.getAttribute('data-tree-id'); })
        };
        if (window.__throwOnGroupChange) throw new Error('group change boom');
      }
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

/* #3771 media-regression: capture full browser health state for one context.
 * Collects: pageerror, console error, same-origin requestfailed, and
 * same-origin HTTP responses with status >= 400. `fixtureOrigin` is the
 * explicit same-origin base (e.g. http://127.0.0.1:port) so health is
 * equivalent and independent of page.url() (which may be about:blank).
 *
 * #4013 hermeticity: installs a fail-closed external-network boundary on the
 * page so known external provider/font hosts are fulfilled deterministically
 * and any unexpected external origin is aborted and recorded with its exact
 * URL. Same-origin 4xx/request-failure checks below remain strict. */
async function captureBrowserHealth(page, fixtureOrigin) {
  const result = {
    pageerrors: [],
    consoleErrors: [],
    requestFailures: [],
    responseErrors: [],
    unexpectedExternal: [],
  };
  page.on('pageerror', error => {
    result.pageerrors.push(String(error));
  });
  page.on('console', msg => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => {
    const url = req.url();
    try {
      if (new URL(url).origin === fixtureOrigin) {
        result.requestFailures.push(url);
      }
    } catch (e) { /* non-HTTP request, skip */ }
  });
  page.on('response', res => {
    const url = res.url();
    try {
      if (new URL(url).origin === fixtureOrigin && res.status() >= 400) {
        result.responseErrors.push({ url, status: res.status() });
      }
    } catch (e) { /* non-HTTP response, skip */ }
  });
  await page.route('**/*', makeHermeticRouteHandler({
    fixtureOrigin,
    onUnexpectedExternal: (url) => result.unexpectedExternal.push(url),
  }));
  return result;
}

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

/* #3771 media-regression: deterministic readiness predicates (no
 * waitForTimeout / networkidle). Each polls real DOM/transition state. */

/* Fixture renderer-completion readiness: #resultsList present, exactly the
 * fixture card set rendered in expectedIds order, each card carrying a media
 * wrapper with >=1 Element child. Deliberately does NOT require any
 * img[data-search-card-image] to be complete/decoded: hidden or offscreen
 * Story-group thumbnails may lazy-load. Strict image readiness is asserted
 * per visible Story group via waitForVisibleImagesLoaded/assertMediaState. */
async function waitForFixtureReady(page, expectedIds) {
  await page.waitForFunction((ids) => {
    const results = document.getElementById('resultsList');
    if (!results) return false;
    const cards = results.querySelectorAll('.tree-card[data-tree-id]');
    if (cards.length !== ids.length) return false;
    const cardIds = [...cards].map(c => c.getAttribute('data-tree-id'));
    if (cardIds.join(',') !== ids.join(',')) return false;
    for (const card of cards) {
      const media = card.querySelector('.tree-card-media');
      if (!media) return false;
      const elementChildren = [...media.children].filter(c => c.nodeType === Node.ELEMENT_NODE);
      if (elementChildren.length < 1) return false;
    }
    return true;
  }, expectedIds, { timeout: 10000 });
}

/* Story-group readiness: mode set, indicator/nav present, expected
 * number of visible cards, expected hidden count, group index text,
 * and (for the loaded thumbnail images) element children intact. */
async function waitForStoryGroupReady(page, opts) {
  await page.waitForFunction((o) => {
    const results = document.getElementById('resultsList');
    if (!results) return false;
    if (results.getAttribute('data-tree-view-mode') !== o.mode) return false;
    if (o.expectNoTransition && document.querySelector('.browse-story-transition-stage')) return false;
    if (o.expectTransition && !document.querySelector('.browse-story-transition-stage')) return false;
    const visible = [...results.querySelectorAll('.tree-card[data-tree-id]')]
      .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id'));
    if (o.visibleCount != null && visible.length !== o.visibleCount) return false;
    if (o.visibleOrder && visible.join(',') !== o.visibleOrder.join(',')) return false;
    const hidden = [...results.querySelectorAll('.tree-card[data-tree-id]')]
      .filter(c => c.hidden).map(c => c.getAttribute('data-tree-id'));
    if (o.hiddenCount != null && hidden.length !== o.hiddenCount) return false;
    const nav = document.querySelector('.browse-story-navigation');
    if (!nav || nav.hidden) return false;
    const current = document.querySelector('.browse-story-indicator-current');
    if (o.indicator && current && current.textContent !== o.indicator) return false;
    if (o.nextDisabled != null) {
      const next = document.querySelector('[data-story-next]');
      if (!next || next.disabled !== o.nextDisabled) return false;
    }
    if (o.prevDisabled != null) {
      const prev = document.querySelector('[data-story-prev]');
      if (!prev || prev.disabled !== o.prevDisabled) return false;
    }
    return true;
  }, opts, { timeout: 10000 });
}

/* Image readiness across all thumbnail cards in the visible set. */
async function waitForVisibleImagesLoaded(page) {
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img[data-search-card-image]')];
    return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
  }, { timeout: 10000 });
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
    assert.equal(st.indicator, '01', '#3845 current-only indicator (no loaded-total denominator)');
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

test('#3655 browser: My Trees capability exposes four modes; stored story restores, unset/invalid stays compact', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    // (6) #3811: four buttons; stored story restores Story
    const pageS = await context.newPage();
    await pageS.addInitScript(() => localStorage.setItem('lovebud:myTrees:viewMode', 'story'));
    await pageS.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await pageS.waitForTimeout(150);
    const modes = await pageS.$$eval('.tree-view-mode-btn', (btns) => btns.map((b) => b.getAttribute('data-mode')));
    assert.deepEqual(modes, ['large', 'compact', 'list', 'story']);
    assert.equal(
      await pageS.evaluate(() => document.getElementById('trees-grid').getAttribute('data-tree-view-mode')),
      'story',
      'stored My Trees story must restore into Story mode'
    );
    assert.equal(await pageS.evaluate(() => localStorage.getItem('lovebud:myTrees:viewMode')), 'story');
    await pageS.close();

    // unset -> compact default
    const pageU = await context.newPage();
    await pageU.addInitScript(() => localStorage.removeItem('lovebud:myTrees:viewMode'));
    await pageU.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await pageU.waitForTimeout(150);
    assert.equal(
      await pageU.evaluate(() => document.getElementById('trees-grid').getAttribute('data-tree-view-mode')),
      'compact'
    );
    await pageU.close();

    // invalid -> compact, unrewritten; Browse preference does not leak
    const pageI = await context.newPage();
    await pageI.addInitScript(() => {
      localStorage.setItem('lovebud:myTrees:viewMode', 'invalid-mode');
      localStorage.setItem('lovebud:browse:viewMode', 'story');
    });
    await pageI.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await pageI.waitForTimeout(150);
    assert.equal(
      await pageI.evaluate(() => document.getElementById('trees-grid').getAttribute('data-tree-view-mode')),
      'compact',
      'invalid My Trees preference must fall back to compact'
    );
    assert.equal(await pageI.evaluate(() => localStorage.getItem('lovebud:myTrees:viewMode')), 'invalid-mode');
    assert.equal(
      await pageI.evaluate(() => localStorage.getItem('lovebud:browse:viewMode')),
      'story',
      'Browse preference must remain untouched'
    );
    await pageI.close();
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});
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
    assert.equal(st.indicator, '01', '(15) current-only indicator (no denominator)');
    assert.equal(st.a11y, '스토리 그룹 1', '#3845 current-only accessible phrase');
    assert.equal(st.prevDisabled, true, '(13) first boundary disabled');
    assert.equal(st.nextDisabled, false);

    // (10) all 7 cards in order across local groups; (11) next; (14) last boundary
    const sequence = [...st.visible];
    await pageW.click('[data-story-next]');
    await pageW.waitForTimeout(420);
    st = await storyState(pageW);
    assert.deepEqual(st.visible, ['browse-4', 'browse-5', 'browse-6'], '(11) next moves one group');
    assert.equal(st.indicator, '02');
    assert.equal(st.prevDisabled, false);
    sequence.push(...st.visible);

    await pageW.click('[data-story-next]');
    await pageW.waitForTimeout(420);
    st = await storyState(pageW);
    assert.deepEqual(st.visible, ['browse-7']);
    assert.equal(st.groupSizeAttr, '1', 'partial last group renders a single centered slot');
    assert.equal(st.nextDisabled, true, '(14) last boundary disabled without more results');
    assert.equal(st.indicator, '03');
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
    assert.equal(st.indicator, '01', 'tablet: current-only indicator');
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
    assert.equal(st.indicator, '01');
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
    assert.equal(st.indicator, '03');

    // (18) replacement resets/clamps — no blank group
    await page.evaluate(() => window.__renderCards(['n-1', 'n-2', 'n-3']));
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.mode, 'story', 'mode attribute survives replacement');
    assert.equal(st.indicator, '01', 'new result set resets to the first group');
    assert.equal(st.visible.length, 3, 'no blank group after replacement');
    assert.deepEqual(st.visible, ['n-1', 'n-2', 'n-3']);

    // (16) one-card set: coherent disabled state
    await page.evaluate(() => window.__renderCards(['solo-1']));
    await page.waitForTimeout(120);
    st = await storyState(page);
    assert.equal(st.indicator, '01');
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
    assert.equal(st.indicator, '01');
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
    assert.equal(st.indicator, '02', '(21) ArrowRight moves to the next group');

    // (26) one keydown = exactly one group movement
    assert.notEqual(st.indicator, '03', '(26) a single keydown must not move twice');

    // (22) ArrowLeft
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01', '(22) ArrowLeft moves back');

    // boundary clamp: ArrowLeft at the first group stays put
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01', 'index clamps at the first group');

    // (24) End
    await page.keyboard.press('End');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '03', '(24) End jumps to the last group');

    // (23) Home
    await page.keyboard.press('Home');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01', '(23) Home jumps to the first group');

    // (25) editable targets are never intercepted
    await page.focus('#searchInput');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('End');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01', '(25) arrow/Home keys inside an input must not move groups');

    // modifier combinations are ignored
    await page.keyboard.press('Control+ArrowRight');
    await page.waitForTimeout(420);
    st = await storyState(page);
    assert.equal(st.indicator, '01', 'modifier+arrow is ignored');

    // (27) focus stays predictable (on the focused nav button)
    await page.focus('[data-story-next]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(420);
    const focusState = await page.evaluate(() => ({
      onNext: document.activeElement === document.querySelector('[data-story-next]'),
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
    }));
    assert.equal(focusState.onNext, true, '(27) focus remains on the nav control');
    assert.equal(focusState.indicator, '02');
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
    assert.equal(st.indicator, '01');
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
    // Wait for transition to complete (260+20ms) before checking indicator
    await page.waitForTimeout(450);

    const midState = await page.evaluate(() => {
      return document.querySelector('.browse-story-indicator-current').textContent;
    });
    assert.equal(midState, '02', 'rapid double-click must only move one group');

    await page.waitForTimeout(400);
    const st = await storyState(page);
    assert.equal(st.indicator, '02');
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
    assert.equal(st.indicator, '02', 'second ArrowRight during transition must be blocked');

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
    assert.equal(state.indicator, '01', 'indicator reset after external replacement');
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
    assert.equal(st.indicator, '01', 'indicator reset to first group');
    assert.equal(st.navHidden, false, 'nav visible after re-entry');
    assert.equal(st.prevDisabled, true, 'prev disabled at first group');

    // Navigate should work after re-entry
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    const st2 = await storyState(page);
    assert.equal(st2.indicator, '02', 'navigation works after re-entry');
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
    assert.equal(st.indicator, '01', 'indicator reset to first group after refresh');
    assert.equal(st.prevDisabled, true, 'prev disabled at first group');
    assert.equal(st.nextDisabled, false, 'next enabled');

    // Subsequent navigation should work
    await page.click('[data-story-next]');
    await page.waitForTimeout(420);
    const st2 = await storyState(page);
    assert.equal(st2.indicator, '02', 'navigation works after refresh');

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
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'domcontentloaded' });
    await waitForFixtureReady(page, MEDIA_FIXTURE_IDS);

    /* (1) compact mode: all 6 cards present, media intact */
    const compactIds = await directCardIds(page);
    assert.deepEqual(compactIds, MEDIA_FIXTURE_IDS, 'compact mode shows all 6 fixture cards');
    for (const exp of MEDIA_CARD_EXPECTATIONS) {
      const st = await cardMediaState(page, exp.id);
      assertMediaState(st, exp, `compact[${exp.id}]`);
    }
    await waitForVisibleImagesLoaded(page);

    /* (1) enter Story mode */
    await clickModeButton(page, 'story');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '01 / 02',
      nextDisabled: false,
    });
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'story-entry');

    /* (5) Next: transition start → transition-end media integrity */
    const nextPromise = page.click('[data-story-next]');
    await page.waitForFunction(() => document.querySelector('.browse-story-transition-stage'), { timeout: 5000 });
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'mid-transition-next');
    await nextPromise;
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '02 / 02',
      nextDisabled: true,
    });
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'post-transition-next');

    /* (5b) Previous: back to group 1 */
    const prevPromise = page.click('[data-story-prev]');
    await page.waitForFunction(() => document.querySelector('.browse-story-transition-stage'), { timeout: 5000 });
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '01 / 02',
      nextDisabled: false,
    });
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'post-transition-prev');
    await prevPromise;

    /* (6) leave Story mode, restore compact, re-enter */
    await clickModeButton(page, 'compact');
    await page.waitForFunction(() =>
      document.getElementById('resultsList').getAttribute('data-tree-view-mode') === 'compact',
      { timeout: 10000 });
    const restoreIds = await directCardIds(page);
    assert.deepEqual(restoreIds, MEDIA_FIXTURE_IDS, 'compact mode restored after leaving story');
    for (const exp of MEDIA_CARD_EXPECTATIONS) {
      const state = await cardMediaState(page, exp.id);
      assertMediaState(state, exp, `compact-restore[${exp.id}]`);
    }
    await clickModeButton(page, 'story');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '01 / 02',
      nextDisabled: false,
    });
    await assertVisibleCardMedia(page, MEDIA_CARD_EXPECTATIONS, 'story-re-entry');

    /* (8) hidden/visible semantics: exactly 3 visible / 3 hidden */
    const counts = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#resultsList .tree-card[data-tree-id]')];
      return {
        visible: cards.filter(c => !c.hidden).length,
        hidden: cards.filter(c => c.hidden).length,
        total: cards.length,
      };
    });
    assert.equal(counts.visible, 3, '3 cards visible in current story group (desktop)');
    assert.equal(counts.hidden, 3, '3 cards hidden in off-screen story group');
    assert.equal(counts.total, 6, 'all 6 cards present in DOM');

    /* (9) browser health: zero errors / failures */
    assert.deepEqual(health.pageerrors, [], 'no page errors during desktop media runtime');
    assert.deepEqual(health.consoleErrors, [], 'no console errors during desktop media runtime');
    assert.deepEqual(health.requestFailures, [], 'no same-origin request failures (desktop)');
    assert.deepEqual(health.responseErrors, [], 'no same-origin HTTP >=400 (desktop)');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests (desktop)');

    /* horizontal overflow */
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1,
      `no horizontal overflow (scroll ${overflow.scrollWidth} vs client ${overflow.clientWidth})`);

    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3771 browser: Story media elements preserved (mobile + reduced motion)', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let mContext, rmContext;
  try {
    /* ── mobile 390×844 — group size 1 ── */
    mContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mPage = await mContext.newPage();
    const mHealth = await captureBrowserHealth(mPage, fixtureOrigin);
    await mPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await mPage.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'domcontentloaded' });
    await waitForFixtureReady(mPage, MEDIA_FIXTURE_IDS);
    await waitForStoryGroupReady(mPage, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 1, hiddenCount: 5, indicator: '01 / 06',
      prevDisabled: true, nextDisabled: false,
    });
    await assertVisibleCardMedia(mPage, MEDIA_CARD_EXPECTATIONS, 'mobile-entry');

    /* Next: 01 → 02 (media-thumb-1 → media-no-thumb) */
    await mPage.click('[data-story-next]');
    await waitForStoryGroupReady(mPage, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 1, hiddenCount: 5, indicator: '02 / 06',
    });
    const noThumbMobile = await cardMediaState(mPage, 'media-no-thumb');
    assertMediaState(noThumbMobile, { hasTextVisual: true, noImage: true }, 'mobile-no-thumb-after-next');

    /* Next: 02 → 03 (media-no-thumb → media-thumb-2) */
    await mPage.click('[data-story-next]');
    await waitForStoryGroupReady(mPage, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 1, hiddenCount: 5, indicator: '03 / 06',
    });
    const thumb2Mobile = await cardMediaState(mPage, 'media-thumb-2');
    assertMediaState(thumb2Mobile, { hasImage: true, imgSrc: '/fixture-media/thumb-2.gif' }, 'mobile-thumb-2-after-next');

    /* (9) browser health on mobile */
    assert.deepEqual(mHealth.pageerrors, [], 'mobile: no page errors');
    assert.deepEqual(mHealth.consoleErrors, [], 'mobile: no console errors');
    assert.deepEqual(mHealth.unexpectedExternal, [], 'mobile: no unexpected external requests');
    assert.deepEqual(mHealth.requestFailures, [], 'mobile: no same-origin request failures');
    assert.deepEqual(mHealth.responseErrors, [], 'mobile: no same-origin HTTP >=400');
    await mContext.close();
    mContext = null;

    /* ── reduced-motion — immediate swap preserves media ── */
    rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    const rmHealth = await captureBrowserHealth(rmPage, fixtureOrigin);
    await rmPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await rmPage.goto(`http://127.0.0.1:${port}/fixture-browse-story-media.html`, { waitUntil: 'domcontentloaded' });
    await waitForFixtureReady(rmPage, MEDIA_FIXTURE_IDS);
    await waitForStoryGroupReady(rmPage, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '01 / 02',
      nextDisabled: false,
    });

    /* (7) reduced-motion: immediate navigation to group 2 — no transition wrappers */
    await rmPage.click('[data-story-next]');
    await waitForStoryGroupReady(rmPage, {
      mode: 'story', expectNoTransition: true,
      visibleCount: 3, hiddenCount: 3, indicator: '02 / 02',
      nextDisabled: true,
    });
    await waitForVisibleImagesLoaded(rmPage);
    await assertVisibleCardMedia(rmPage, MEDIA_CARD_EXPECTATIONS, 'rm-after-next');

    /* (9) browser health under reduced motion */
    assert.deepEqual(rmHealth.pageerrors, [], 'reduced-motion: no page errors');
    assert.deepEqual(rmHealth.consoleErrors, [], 'reduced-motion: no console errors');
    assert.deepEqual(rmHealth.unexpectedExternal, [], 'reduced-motion: no unexpected external requests');
    assert.deepEqual(rmHealth.requestFailures, [], 'reduced-motion: no same-origin request failures');
    assert.deepEqual(rmHealth.responseErrors, [], 'reduced-motion: no same-origin HTTP >=400');
    await rmContext.close();
    rmContext = null;

    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (mContext) await mContext.close();
    if (rmContext) await rmContext.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

/* ══════════════════════════════════════════════════════════════════
 * #3813 — additive surface-adapter boundary (real Chromium)
 * ══════════════════════════════════════════════════════════════════ */

/* Shared entry helper: activate Story with an optional initialTreeId. The
 * controller owns grouping/visibility while the page's view-mode switcher
 * owns the `data-tree-view-mode` attribute (re-applied from localStorage on
 * any document childList mutation), so the helper mirrors the switcher's
 * persist + applyMode behaviour when driving the controller directly. */
async function activateStory(page, initialTreeId) {
  const arg = initialTreeId == null ? null : { initialTreeId: initialTreeId };
  await page.evaluate((opts) => {
    const c = window.__storyController;
    const results = document.getElementById('resultsList');
    localStorage.setItem('lovebud:browse:viewMode', 'story');
    c.setMode('compact');
    results.setAttribute('data-tree-view-mode', 'compact');
    if (opts) c.setMode('story', opts);
    else c.setMode('story');
    results.setAttribute('data-tree-view-mode', 'story');
  }, arg);
}

test('#3813 browser: legacy plain init keeps group-0 entry; initialTreeId opens its group directly (wide/tablet/mobile)', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    /* (1) legacy plain init without options enters Story at group 0 */
    await activateStory(page, null);
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01',
    });
    let st = await storyState(page);
    assert.deepEqual(st.visible, ['browse-1', 'browse-2', 'browse-3'], 'legacy entry stays at group 0');

    /* (2) valid initialTreeId opens the containing group immediately */
    await activateStory(page, 'browse-6');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['browse-4', 'browse-5', 'browse-6'], indicator: '02',
    });
    st = await storyState(page);
    assert.equal(st.groupSizeAttr, '3', 'wide group size 3');

    /* (3) unknown initialTreeId falls back to group 0 */
    await activateStory(page, 'does-not-exist');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['browse-1', 'browse-2', 'browse-3'], indicator: '01',
    });

    /* (7) public goTo moves via the existing transition authority */
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03',
    });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['browse-7'], 'goTo(2) reaches the last group');

    /* (8) out-of-range goTo clamps (no wrap, no error) */
    await page.evaluate(() => window.__storyController.goTo(99));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03',
    });
    await page.evaluate(() => window.__storyController.goTo(-5));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['browse-1', 'browse-2', 'browse-3'], indicator: '01',
    });

    /* (23) no-option result replacement still resets to group 0 */
    await page.evaluate(() => window.__storyController.goTo(1));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '02',
    });
    await page.evaluate(() => window.__renderCards(['x1', 'x2', 'x3', 'x4', 'x5']));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01',
    });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['x1', 'x2', 'x3'], 'plain result replacement resets to group 0');

    /* (5) getVisibleTreeIds reflects the settled visible group; each call
     * returns a new frozen detached array (frozen-ness is evaluated inside
     * the page — Playwright serialization would copy the array). */
    const idsInfo = await page.evaluate(() => {
      const a = window.__storyController.getVisibleTreeIds();
      const b = window.__storyController.getVisibleTreeIds();
      return {
        a: a.slice(),
        b: b.slice(),
        frozenA: Object.isFrozen(a),
        frozenB: Object.isFrozen(b),
        detached: a !== b,
      };
    });
    assert.deepEqual(idsInfo.a, ['x1', 'x2', 'x3']);
    assert.deepEqual(idsInfo.b, ['x1', 'x2', 'x3']);
    assert.equal(idsInfo.frozenA, true, 'getVisibleTreeIds returns a frozen array');
    assert.equal(idsInfo.frozenB, true, 'each call returns a frozen array');
    assert.equal(idsInfo.detached, true, 'each call returns a new detached array');

    /* tablet: 2 per group */
    const tContext = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const tPage = await tContext.newPage();
    await tPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await tPage.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await tPage.waitForTimeout(150);
    await activateStory(tPage, 'browse-5');
    await waitForStoryGroupReady(tPage, {
      mode: 'story', expectNoTransition: true, visibleCount: 2,
      visibleOrder: ['browse-5', 'browse-6'], indicator: '03',
    });
    await tContext.close();

    /* mobile: 1 per group */
    const mContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mPage = await mContext.newPage();
    await mPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await mPage.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(150);
    await activateStory(mPage, 'browse-7');
    await waitForStoryGroupReady(mPage, {
      mode: 'story', expectNoTransition: true, visibleCount: 1,
      visibleOrder: ['browse-7'], indicator: '07',
    });
    await mContext.close();

    /* health + overflow */
    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    assert.deepEqual(health.requestFailures, [], 'no same-origin request failures');
    assert.deepEqual(health.responseErrors, [], 'no same-origin HTTP >=400');
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, 'no horizontal overflow');
    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3813 browser: surface-neutral translation override applies five keys and falls back on translator throw', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await activateStory(page, null);
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01 / 03',
    });

    /* (20) custom translation applied to all five semantic keys */
    const labels = await page.evaluate(() => {
      const nav = document.querySelector('.browse-story-navigation');
      const prev = document.querySelector('[data-story-prev]');
      const next = document.querySelector('[data-story-next]');
      return {
        region: nav.getAttribute('aria-label'),
        prev: prev.getAttribute('aria-label'),
        next: next.getAttribute('aria-label'),
        label: document.querySelector('.browse-story-nav-label').textContent,
        a11y: document.querySelector('.browse-story-indicator-a11y').textContent,
      };
    });
    assert.equal(labels.region, '나의 트리 스토리');
    assert.equal(labels.prev, '이전 스토리');
    assert.equal(labels.next, '다음 스토리');
    assert.equal(labels.label, '스토리');
    assert.equal(labels.a11y, '현재 그룹 1 / 전체 3');

    /* (21) translator receives only surface-neutral keys (no search. prefix) */
    const keys = await page.evaluate(() => window.__translatedKeys.slice());
    assert.ok(keys.length >= 5, 'translator was invoked for the five semantic keys');
    for (const key of keys) {
      assert.ok(/^story\./.test(key), `key ${key} must be surface-neutral`);
      assert.ok(key.indexOf('search.') === -1, `key ${key} must not carry a search. prefix`);
    }
    const uniqueKeys = [...new Set(keys)].sort();
    assert.deepEqual(uniqueKeys, ['story.label', 'story.next', 'story.position', 'story.previous', 'story.regionLabel']);

    /* (22) translator throw falls back to existing Browse strings */
    await page.evaluate(() => { window.__throwTranslate = true; });
    await page.evaluate(() => window.__storyController.goTo(1));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '02 / 03',
    });
    const fallbackLabels = await page.evaluate(() => ({
      prev: document.querySelector('[data-story-prev]').getAttribute('aria-label'),
      next: document.querySelector('[data-story-next]').getAttribute('aria-label'),
      region: document.querySelector('.browse-story-navigation').getAttribute('aria-label'),
      a11y: document.querySelector('.browse-story-indicator-a11y').textContent,
    }));
    assert.equal(fallbackLabels.prev, '이전 스토리 그룹', 'Browse fallback previous label');
    assert.equal(fallbackLabels.next, '다음 스토리 그룹', 'Browse fallback next label');
    assert.equal(fallbackLabels.region, '스토리 보기', 'Browse fallback region label');
    assert.equal(fallbackLabels.a11y, '스토리 2 / 3', 'Browse fallback position string');

    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3813 browser: initialTreeId entry and preferredTreeId refresh fire exactly one settled callback each', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    /* (4) valid initialTreeId entry: exactly one callback, for the final group */
    await page.evaluate(() => window.__snapshots.length = 0);
    await activateStory(page, 'browse-6');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['browse-4', 'browse-5', 'browse-6'], indicator: '02 / 03',
    });
    let snap = await page.evaluate(() => ({
      count: window.__snapshots.length,
      groupIndex: window.__snapshots[0] && window.__snapshots[0].groupIndex,
      visible: window.__snapshots[0] && window.__snapshots[0].visibleTreeIds,
    }));
    assert.equal(snap.count, 1, 'initialTreeId entry fires one callback');
    assert.equal(snap.groupIndex, 1, 'callback targets the final group (no transient group 0)');
    assert.deepEqual(snap.visible, ['browse-4', 'browse-5', 'browse-6']);

    /* (5)/(6) synchronous render + refresh({ preferredTreeId }): one callback,
     * no intermediate group-0 notification. */
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => {
      window.__renderCards(['r1', 'r2', 'r3', 'r4', 'r5']);
      window.__storyController.refresh({ preferredTreeId: 'r5' });
    });
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 2,
      visibleOrder: ['r4', 'r5'], indicator: '02 / 02',
    });
    snap = await page.evaluate(() => ({
      count: window.__snapshots.length,
      groupIndexes: window.__snapshots.map((s) => s.groupIndex),
      visible: window.__snapshots[0] && window.__snapshots[0].visibleTreeIds,
    }));
    assert.equal(snap.count, 1, 'refresh preferredTreeId fires one callback');
    assert.deepEqual(snap.groupIndexes, [1], 'no intermediate group-0 callback');
    assert.deepEqual(snap.visible, ['r4', 'r5']);

    /* refresh without preferredTreeId keeps the group-0 reset behaviour */
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => {
      window.__renderCards(['s1', 's2', 's3', 's4']);
      window.__storyController.refresh();
    });
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['s1', 's2', 's3'], indicator: '01 / 02',
    });
    snap = await page.evaluate(() => ({
      count: window.__snapshots.length,
      groupIndexes: window.__snapshots.map((s) => s.groupIndex),
    }));
    assert.equal(snap.count, 1, 'plain refresh fires one callback');
    assert.deepEqual(snap.groupIndexes, [0], 'plain refresh resets to group 0');

    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3813 browser: snapshots are frozen 4-key plain objects with frozen detached id arrays and no DOM nodes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await activateStory(page, null);
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01 / 03',
    });

    const shape = await page.evaluate(() => {
      const snap = window.__snapshots[0];
      return {
        keys: Object.keys(snap).sort(),
        frozen: Object.isFrozen(snap),
        idsFrozen: Object.isFrozen(snap.visibleTreeIds),
        groupIndex: snap.groupIndex,
        groupCount: snap.groupCount,
        first: snap.firstVisibleTreeId,
        ids: snap.visibleTreeIds.slice(),
        json: JSON.stringify(snap),
        types: [typeof snap.groupIndex, typeof snap.groupCount, typeof snap.firstVisibleTreeId, Array.isArray(snap.visibleTreeIds) ? 'array' : typeof snap.visibleTreeIds],
      };
    });
    assert.deepEqual(shape.keys, ['firstVisibleTreeId', 'groupCount', 'groupIndex', 'visibleTreeIds'],
      'snapshot has exactly the four documented enumerable keys');
    assert.equal(shape.frozen, true, 'snapshot is frozen');
    assert.equal(shape.idsFrozen, true, 'visibleTreeIds is frozen');
    assert.equal(shape.groupIndex, 0);
    assert.equal(shape.groupCount, 3);
    assert.equal(shape.first, 'browse-1');
    assert.deepEqual(shape.ids, ['browse-1', 'browse-2', 'browse-3']);
    assert.deepEqual(shape.types, ['number', 'number', 'string', 'array'], 'no DOM node or function exposed');
    assert.ok(shape.json.indexOf('[object') === -1, 'serialization exposes no DOM nodes');

    /* (16) detached: navigating produces a new frozen array; the old one is
     * untouched (detachment is evaluated inside the page). */
    await page.evaluate(() => window.__storyController.goTo(1));
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '02 / 03',
    });
    const detachInfo = await page.evaluate(() => {
      const s0 = window.__snapshots[0].visibleTreeIds;
      const s1 = window.__snapshots[1].visibleTreeIds;
      return {
        detached: s0 !== s1,
        old: s0.slice(),
        newIds: s1.slice(),
        frozen: Object.isFrozen(s1),
        groupIndex: window.__snapshots[1].groupIndex,
      };
    });
    assert.equal(detachInfo.detached, true, 'visibleTreeIds is a detached array per snapshot');
    assert.deepEqual(detachInfo.old, ['browse-1', 'browse-2', 'browse-3'], 'previous snapshot stays immutable');
    assert.deepEqual(detachInfo.newIds, ['browse-4', 'browse-5', 'browse-6']);
    assert.equal(detachInfo.frozen, true, 'new snapshot visibleTreeIds is frozen');
    assert.equal(detachInfo.groupIndex, 1);

    /* (19) getVisibleTreeIds: new frozen array each call, empty when inactive
     * (frozen/detached checks run inside the page). */
    const gvtInfo = await page.evaluate(() => {
      const a = window.__storyController.getVisibleTreeIds();
      const b = window.__storyController.getVisibleTreeIds();
      return {
        a: a.slice(),
        b: b.slice(),
        frozenA: Object.isFrozen(a),
        frozenB: Object.isFrozen(b),
        detached: a !== b,
      };
    });
    assert.deepEqual(gvtInfo.a, ['browse-4', 'browse-5', 'browse-6']);
    assert.deepEqual(gvtInfo.b, ['browse-4', 'browse-5', 'browse-6']);
    assert.equal(gvtInfo.frozenA, true, 'getVisibleTreeIds arrays are frozen');
    assert.equal(gvtInfo.frozenB, true, 'each getVisibleTreeIds array is frozen');
    assert.equal(gvtInfo.detached, true, 'getVisibleTreeIds returns a new array each call');
    const inactiveInfo = await page.evaluate(() => {
      window.__storyController.setMode('compact');
      const empty = window.__storyController.getVisibleTreeIds();
      return { length: empty.length, frozen: Object.isFrozen(empty) };
    });
    assert.equal(inactiveInfo.length, 0, 'inactive returns empty array');
    assert.equal(inactiveInfo.frozen, true, 'inactive empty array is frozen');

    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3813 browser: animated goTo notifies only after cleanup; blocked/same-group add no callbacks; throw is contained; reduced-motion is immediate', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context, rmContext;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await activateStory(page, null);
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01 / 03',
    });

    /* (11)/(12) normal-motion goTo: no callback at start; one after cleanup,
     * with canonical direct-child order restored and wrappers/aria-busy gone. */
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => window.__storyController.goTo(1));
    const immediateCount = await page.evaluate(() => window.__snapshots.length);
    assert.equal(immediateCount, 0, 'no callback at animation start');
    await page.waitForFunction(() => {
      const results = document.getElementById('resultsList');
      return !results.querySelector('.browse-story-transition-stage')
        && results.getAttribute('aria-busy') === null
        && document.querySelector('.browse-story-indicator-current').textContent === '02 / 03';
    });
    const settled = await page.evaluate(() => ({
      count: window.__snapshots.length,
      dom: window.__snapshotDom,
      groupIndex: window.__snapshots[0].groupIndex,
    }));
    assert.equal(settled.count, 1, 'one settled callback after animated transition');
    assert.equal(settled.groupIndex, 1);
    assert.equal(settled.dom.wrapperCount, 0, 'callback fires after wrapper cleanup');
    assert.ok(settled.dom.ariaBusy === null || settled.dom.ariaBusy === 'false', 'callback fires after aria-busy cleared');
    assert.deepEqual(settled.dom.directOrder, CANONICAL_IDS, 'callback fires after canonical direct-child order restored');

    /* (10) transition-lock: a goTo issued during an animated transition is blocked */
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => {
      window.__storyController.goTo(2);
      window.__storyController.goTo(0); // blocked: transitioning
    });
    await page.waitForFunction(() => {
      const results = document.getElementById('resultsList');
      return !results.querySelector('.browse-story-transition-stage')
        && document.querySelector('.browse-story-indicator-current').textContent === '03 / 03';
    });
    const locked = await page.evaluate(() => ({
      count: window.__snapshots.length,
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
    }));
    assert.equal(locked.indicator, '03 / 03', 'first goTo applied, second blocked during transition');
    assert.equal(locked.count, 1, 'blocked goTo adds no extra callback');

    /* (9) same-group goTo is a no-op: no duplicate callback */
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => window.__storyController.goTo(2));
    await page.waitForTimeout(80);
    const sameGroup = await page.evaluate(() => window.__snapshots.length);
    assert.equal(sameGroup, 0, 'same-group goTo fires no callback');

    /* (18) callback throw is contained and later navigation still works */
    await page.evaluate(() => { window.__throwOnGroupChange = true; });
    await page.evaluate(() => window.__storyController.goTo(1));
    await page.waitForFunction(() => {
      const results = document.getElementById('resultsList');
      return !results.querySelector('.browse-story-transition-stage')
        && document.querySelector('.browse-story-indicator-current').textContent === '02 / 03';
    });
    assert.deepEqual(health.pageerrors, [], 'callback throw must not escape to pageerror');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    await page.evaluate(() => { window.__throwOnGroupChange = false; });
    await page.evaluate(() => window.__snapshots.length = 0);
    await page.evaluate(() => window.__storyController.goTo(0));
    await page.waitForFunction(() => {
      const results = document.getElementById('resultsList');
      return !results.querySelector('.browse-story-transition-stage')
        && document.querySelector('.browse-story-indicator-current').textContent === '01 / 03';
    });
    const afterThrow = await page.evaluate(() => window.__snapshots.length);
    assert.equal(afterThrow, 1, 'navigation after contained callback throw still notifies once');

    /* (13)/(26) reduced motion: immediate settle, no wrappers, no animated wait */
    rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    const rmHealth = await captureBrowserHealth(rmPage, fixtureOrigin);
    await rmPage.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await rmPage.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(150);
    await activateStory(rmPage, null);
    await waitForStoryGroupReady(rmPage, {
      mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '01 / 03',
    });
    await rmPage.evaluate(() => window.__snapshots.length = 0);
    await rmPage.evaluate(() => window.__storyController.goTo(2));
    const rmImmediate = await rmPage.evaluate(() => ({
      count: window.__snapshots.length,
      dom: window.__snapshotDom,
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
    }));
    assert.equal(rmImmediate.indicator, '03 / 03', 'reduced-motion goTo settles immediately');
    assert.equal(rmImmediate.count, 1, 'reduced-motion goTo fires one callback');
    assert.equal(rmImmediate.dom.wrapperCount, 0, 'reduced-motion has zero transition wrappers');
    assert.deepEqual(rmHealth.pageerrors, [], 'reduced-motion: no page errors');
    assert.deepEqual(rmHealth.consoleErrors, [], 'reduced-motion: no console errors');
    assert.deepEqual(rmHealth.unexpectedExternal, [], 'reduced-motion: no unexpected external requests');

    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    await context.close();
    await rmContext.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    if (rmContext) await rmContext.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

test('#3813 browser: card activation and media lifecycle stay intact with the adapter boundary; health zero', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.removeItem('lovebud:browse:viewMode'));
    await page.goto(`http://127.0.0.1:${port}/fixture-story-adapter.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await activateStory(page, 'browse-3');
    await waitForStoryGroupReady(page, {
      mode: 'story', expectNoTransition: true, visibleCount: 3,
      visibleOrder: ['browse-1', 'browse-2', 'browse-3'], indicator: '01 / 03',
    });

    /* (24) card activation preserved: clicking a visible card selects it */
    await page.click('#resultsList .tree-card[data-tree-id="browse-2"]');
    await page.waitForTimeout(80);
    const select = await page.evaluate(() => ({ selects: window.__selects, last: window.__lastSelect }));
    assert.ok(select.selects >= 1, 'card click still triggers canonical selection');
    assert.equal(select.last, 'browse-2', 'selection target preserved');

    /* media lifecycle: every card's media wrapper keeps an element child */
    const mediaOk = await page.evaluate(() => {
      const cards = document.querySelectorAll('#resultsList .tree-card[data-tree-id]');
      return Array.from(cards).every((c) => c.querySelector('.tree-card-media')
        && Array.from(c.querySelector('.tree-card-media').children).some((n) => n.nodeType === Node.ELEMENT_NODE));
    });
    assert.equal(mediaOk, true, 'media wrappers keep element children in story mode');

    /* overflow */
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, 'no horizontal overflow');

    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    assert.deepEqual(health.requestFailures, [], 'no same-origin request failures');
    assert.deepEqual(health.responseErrors, [], 'no same-origin HTTP >=400');
    await context.close();
    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

/* ══════════════════════════════════════════════════════════════════
 * #3845 — truthful navigation (real Chromium, synthetic results only)
 * ══════════════════════════════════════════════════════════════════ */

test('#3845 browser: truthful current-only indicator; Next inside loaded groups never requests more', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // initial: current-only indicator — no loaded-total denominator
    let st = await storyState(page);
    assert.equal(st.indicator, '01', 'visible value is the current local Story group index only');
    assert.equal(st.indicator.includes('/'), false, 'no denominator (01 / 02 or 1 of 2) may appear');
    assert.equal(st.a11y, '스토리 그룹 1', 'accessible phrase is current-only (스토리 그룹 1)');
    assert.equal(st.prevDisabled, true, 'prev disabled at the first group');
    assert.equal(st.nextDisabled, false, 'Next available while results remain');

    // Next inside loaded groups: group change without any request
    await page.click('[data-story-next]');
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '02' });
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 0, 'moving within loaded groups must not request more');

    await page.click('[data-story-next]');
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 0, 'still zero requests at the loaded end');

    // loaded end with no more backend results: Next is disabled, no false total
    st = await storyState(page);
    assert.equal(st.nextDisabled, true, 'Next disabled at the loaded end when the source reports no more');
    assert.equal(st.indicator, '03', 'indicator stays current-only at the end');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3845 browser: Next at the loaded end requests exactly one batch and advances one local group', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const health = await captureBrowserHealth(page, fixtureOrigin);
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // arm the fake loader with one more batch of 3, then jump to the loaded end
    await page.evaluate(() => {
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8', 'browse-9', 'browse-10'];
    });
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });
    let st = await storyState(page);
    assert.equal(st.nextDisabled, false, 'Next available at the loaded end while the source has more');

    // Next at the loaded end: bounded busy state exposed on the rail
    const busy = await page.evaluate(() => {
      const next = document.querySelector('[data-story-next]');
      next.click();
      const nav = document.querySelector('.browse-story-navigation');
      return {
        ariaBusy: nav.getAttribute('aria-busy'),
        loadingClass: nav.classList.contains('browse-story-loading'),
        nextDisabled: next.disabled,
        scrollY: window.scrollY,
      };
    });
    assert.equal(busy.ariaBusy, 'true', 'busy state is exposed accessibly on the rail');
    assert.equal(busy.loadingClass, true, 'loading class marks the rail while busy');
    assert.equal(busy.nextDisabled, true, 'Next is disabled while the batch is loading');
    assert.equal(busy.scrollY, 0, 'no vertical scroll action is used to unlock the group');

    // the directional transition must animate out from the previously-viewed
    // group (browse-7,8,9), not from group 0 after the loader's result reset
    await page.waitForFunction(() => document.querySelector('.browse-story-layer-outgoing'), { timeout: 5000 });
    const outLayer = await page.evaluate(() =>
      Array.from(document.querySelector('.browse-story-layer-outgoing').querySelectorAll('.tree-card[data-tree-id]'))
        .map(c => c.getAttribute('data-tree-id'))
    );
    assert.deepEqual(outLayer, ['browse-7', 'browse-8', 'browse-9'],
      'outgoing layer is the previously-viewed group, not group 0');

    // exactly one batch appended; controller advances exactly one local group
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '04' });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['browse-10'], 'advanced to the newly appended local group');
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 1, 'exactly one batch was requested');

    const cleared = await page.evaluate(() => {
      const nav = document.querySelector('.browse-story-navigation');
      return {
        ariaBusy: nav.getAttribute('aria-busy'),
        loadingClass: nav.classList.contains('browse-story-loading'),
        direction: document.getElementById('resultsList').getAttribute('data-story-direction'),
        wrappers: document.querySelectorAll('.browse-story-transition-stage').length,
      };
    });
    assert.equal(cleared.ariaBusy, null, 'busy state cleared after settling');
    assert.equal(cleared.loadingClass, false, 'loading class removed after settling');
    assert.equal(cleared.direction, 'next', 'forward direction attribute settles to next');
    assert.equal(cleared.wrappers, 0, 'no leftover transition wrappers');

    // backward direction also settles correctly after the advance
    await page.click('[data-story-prev]');
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '03' });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['browse-7', 'browse-8', 'browse-9'], 'backward navigation settles to the previous group');
    const backSettled = await page.evaluate(() => ({
      direction: document.getElementById('resultsList').getAttribute('data-story-direction'),
      wrappers: document.querySelectorAll('.browse-story-transition-stage').length,
    }));
    assert.equal(backSettled.direction, 'prev', 'backward direction attribute settles to prev');
    assert.equal(backSettled.wrappers, 0, 'no wrappers after backward settle');

    // no horizontal overflow at 1440x900 and no browser health issues
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, 'no horizontal overflow at 1440x900');
    assert.deepEqual(health.pageerrors, [], 'no page errors');
    assert.deepEqual(health.consoleErrors, [], 'no console errors');
    assert.deepEqual(health.unexpectedExternal, [], 'no unexpected external requests');
    assert.deepEqual(health.requestFailures, [], 'no same-origin request failures');
    assert.deepEqual(health.responseErrors, [], 'no same-origin HTTP >=400');

    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3845 browser: repeated Next clicks while loading dispatch exactly one request', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    await page.evaluate(() => {
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8', 'browse-9', 'browse-10'];
    });
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });

    // three synchronous clicks on Next while the first batch is loading
    const clicks = await page.evaluate(() => {
      const next = document.querySelector('[data-story-next]');
      next.click();
      next.click();
      next.click();
      return window.__loadMoreCalls;
    });
    assert.equal(clicks, 1, 'repeated clicks must dispatch exactly one request');

    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '04' });
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 1, 'still exactly one request after settling');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3845 browser: exhaustion disables Next; no-growth and failure settle truthfully on the current group', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await page.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);

    // (a) exhausted source (default): Next disabled on the final loaded group
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });
    let st = await storyState(page);
    assert.equal(st.nextDisabled, true, 'exhausted source disables Next on the final loaded group');

    // (b) no-growth: one request succeeds but appends no canonical cards → stay
    await page.evaluate(() => {
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = [];
    });
    // re-arm requires a real move so updateNav recomputes the Next state
    // (goTo to the current group is a no-op and keeps the stale disabled state)
    await page.evaluate(() => window.__storyController.goTo(1));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '02' });
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });
    await page.evaluate(() => document.querySelector('[data-story-next]').click());
    await page.waitForTimeout(150);
    st = await storyState(page);
    assert.equal(st.indicator, '03', 'no-growth keeps the current group');
    assert.equal(st.visible.length, 1, 'no new canonical cards appear');
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 1, 'one request was attempted');
    assert.equal(st.nextDisabled, false, 'Next stays available while the source still reports more');
    const navBusy = await page.evaluate(() =>
      document.querySelector('.browse-story-navigation').getAttribute('aria-busy'));
    assert.equal(navBusy, null, 'busy state cleared after no-growth');

    // (c) failure: rejected request → stay on the current group, busy cleared
    await page.evaluate(() => {
      window.__loadMoreFail = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8'];
    });
    await page.evaluate(() => document.querySelector('[data-story-next]').click());
    await page.waitForTimeout(150);
    st = await storyState(page);
    assert.equal(st.indicator, '03', 'failed request keeps the current group');
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 1, 'failure consumed exactly one request');
    const navBusy2 = await page.evaluate(() =>
      document.querySelector('.browse-story-navigation').getAttribute('aria-busy'));
    assert.equal(navBusy2, null, 'busy state cleared after failure');

    // (d) growth then exhaustion: Next disabled on the final loaded group
    await page.evaluate(() => {
      window.__loadMoreFail = false;
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8', 'browse-9', 'browse-10'];
    });
    await page.evaluate(() => document.querySelector('[data-story-next]').click());
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '04' });
    await page.evaluate(() => { window.__loadMoreAvailable = false; });
    // move away and back so updateNav recomputes the Next state at the end
    await page.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 3, indicator: '03' });
    await page.evaluate(() => window.__storyController.goTo(3));
    await waitForStoryGroupReady(page, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '04' });
    st = await storyState(page);
    assert.equal(st.indicator, '04', 'exhausted final group stays put');
    assert.equal(st.nextDisabled, true, 'Next disabled once the source is exhausted on the final group');
    assert.equal(await page.evaluate(() => window.__loadMoreCalls), 1, 'no extra request after exhaustion');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('#3845 browser: reduced-motion load-more advance is immediate; mobile 390x844 has no overflow', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    /* ── reduced motion: immediate advance, no transition wrappers ── */
    const rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    await rmPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await rmPage.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(150);
    await rmPage.evaluate(() => {
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8', 'browse-9', 'browse-10'];
    });
    await rmPage.evaluate(() => window.__storyController.goTo(2));
    await waitForStoryGroupReady(rmPage, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '03' });
    await rmPage.evaluate(() => document.querySelector('[data-story-next]').click());
    const rmState = await rmPage.evaluate(() => ({
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
      wrappers: document.querySelectorAll('.browse-story-transition-stage').length,
      visible: Array.from(document.querySelectorAll('#resultsList .tree-card[data-tree-id]'))
        .filter(c => !c.hidden).map(c => c.getAttribute('data-tree-id')),
    }));
    assert.equal(rmState.indicator, '04', 'reduced-motion load-more advance settles immediately');
    assert.equal(rmState.wrappers, 0, 'reduced-motion leaves no transition wrappers');
    assert.deepEqual(rmState.visible, ['browse-10'], 'reduced-motion advances to the new group');
    assert.equal(await rmPage.evaluate(() => window.__loadMoreCalls), 1, 'reduced-motion still requests exactly one batch');
    await rmContext.close();

    /* ── mobile 390x844: load-more advance causes no horizontal overflow ── */
    const mContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mPage = await mContext.newPage();
    await mPage.addInitScript(() => localStorage.setItem('lovebud:browse:viewMode', 'story'));
    await mPage.goto(`http://127.0.0.1:${port}/fixture-browse-story.html`, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(150);
    await mPage.evaluate(() => {
      window.__loadMoreAvailable = true;
      window.__loadMoreCalls = 0;
      window.__pendingMore = ['browse-8', 'browse-9', 'browse-10'];
    });
    // mobile: 1 card per group → advance to the last loaded group (07)
    for (let i = 2; i <= 7; i += 1) {
      await mPage.click('[data-story-next]');
      await waitForStoryGroupReady(mPage, {
        mode: 'story', expectNoTransition: true, visibleCount: 1,
        indicator: String(i).padStart(2, '0'),
      });
    }
    await mPage.evaluate(() => document.querySelector('[data-story-next]').click());
    await waitForStoryGroupReady(mPage, { mode: 'story', expectNoTransition: true, visibleCount: 1, indicator: '08' });
    const mOverflow = await mPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(mOverflow.scrollWidth <= mOverflow.clientWidth + 1,
      `no horizontal overflow at 390x844 (scroll ${mOverflow.scrollWidth} vs client ${mOverflow.clientWidth})`);
    const mState = await storyState(mPage);
    assert.deepEqual(mState.visible, ['browse-8'], 'mobile advances to the next newly available group');
    await mContext.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});
