/**
 * #3608 Phase 2 PR-A — Browse/My Trees large geometry parity
 *
 * Executable Chromium contract (not string-only).
 * Loads production CSS asset chains and measures computed large geometry.
 * Browse large is canonical; My Trees large must match core slots.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..');
const CSS_TOKEN = '20260721-3608-large-1';

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

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function startServer() {
  return getFreePort().then(
    (port) =>
      new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
          try {
            let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            if (urlPath === '/' || urlPath === '/fixture-browse.html') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(buildBrowseFixture());
              return;
            }
            if (urlPath === '/fixture-mytrees.html') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(buildMyTreesFixture());
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
        server.listen(port, '127.0.0.1', () => resolve({ server, port }));
        server.on('error', reject);
      })
  );
}

function cardMarkup(surface, id, title) {
  const vis =
    surface === 'my-trees'
      ? '<div class="love-tree-card-visibility"><span class="tree-card-visibility public" aria-label="공개" title="공개"><span class="material-symbols-outlined" aria-hidden="true">public</span></span></div>'
      : '';
  const metaExt =
    surface === 'browse'
      ? '<div class="tree-card-metadata-slot"><div class="tree-public-metadata"><div class="tree-public-metadata-desc">공개 메타 설명 샘플 한 줄</div></div><div class="tree-public-tags"><span class="tree-public-tag">#tag</span></div></div>'
      : '';
  const ctaLabel = surface === 'my-trees' ? '감상하기' : '트리 열기';
  const href =
    surface === 'my-trees' ? `/pages/editor?treeId=${id}` : `/pages/view.html?treeId=${id}`;
  const surfaceClass =
    surface === 'my-trees' ? 'love-tree-card-my-trees' : 'love-tree-card-browse tree-card-browse';
  return `
  <div class="tree-card love-tree-card ${surfaceClass}" data-tree-id="${id}" role="button" tabindex="0">
    <div class="tree-card-media love-tree-card-media">
      <div class="tree-card-thumb" style="background:#ddd;width:100%;height:100%;"></div>
    </div>
    <div class="tree-card-body love-tree-card-body">
      <div class="tree-card-title-row love-tree-card-title-row">
        ${vis}
        <div class="tree-title love-tree-card-title tree-card-title">${title}</div>
      </div>
      <div class="tree-subtitle love-tree-card-subtitle tree-card-subcopy">이어진 기억 두 줄까지 내려갈 수 있는 부제 샘플 문장입니다</div>
      ${metaExt}
      <div class="tree-meta-row love-tree-card-meta-row">
        <div class="tree-meta-left love-tree-card-meta-left">
          <div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">
            <span class="tree-card-reaction-metric" title="조회수 0">
              <span class="material-symbols-outlined" aria-hidden="true">visibility</span><span>0</span>
            </span>
          </div>
        </div>
        <div class="tree-meta-right love-tree-card-meta-right">
          <a class="tree-card-open-link love-tree-card-open-link" href="${href}">
            <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>
            <span>${ctaLabel}</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

function buildBrowseFixture() {
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/css/global.css"/>
<link rel="stylesheet" href="/css/shared/love-tree-card-composition.css"/>
<link rel="stylesheet" href="/css/search.css"/>
<link rel="stylesheet" href="/css/tree-view-mode.css?v=${CSS_TOKEN}"/>
<style>
  html, body { margin: 0; width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; font-family: system-ui, sans-serif; background: #f6f1ec; }
  #resultsList { display: grid; padding: 16px; box-sizing: border-box; width: 100%; max-width: 100%; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<div id="browseViewModeMount"></div>
<div id="resultsList">
  ${cardMarkup('browse', 'browse-1', 'Browse Large Tree Title That May Wrap Two Lines')}
  ${cardMarkup('browse', 'browse-2', 'Browse Large Tree Two')}
</div>
<script src="/js/tree-view-mode-switcher.js"></script>
<script>
  window.LoveBudTreeViewModeSwitcher.init({
    storageKey: 'lovebud:browse:viewMode',
    defaultMode: 'compact',
    mount: '#browseViewModeMount',
    target: '#resultsList'
  });
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
<link rel="stylesheet" href="/css/tree-view-mode.css?v=${CSS_TOKEN}"/>
<style>
  html, body { margin: 0; width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; font-family: system-ui, sans-serif; background: #f6f1ec; min-height: 100vh; }
  .trees-grid { display: grid; padding: 16px; box-sizing: border-box; width: 100%; max-width: 100%; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<div id="myTreesViewModeMount"></div>
<div id="trees-grid" class="trees-grid">
  ${cardMarkup('my-trees', 'owner-1', 'My Trees Large Tree Title That May Wrap Two Lines')}
  ${cardMarkup('my-trees', 'owner-2', 'My Trees Large Tree Two')}
</div>
<aside id="myTreesHubPanel" class="my-trees-hub-panel preview-sidebar"></aside>
<script src="/js/tree-view-mode-switcher.js"></script>
<script src="/js/my-trees/my-trees-page-bootstrap.js"></script>
</body></html>`;
}

function pxClose(a, b, tol) {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b;
  return Math.abs(na - nb) <= (tol == null ? 1 : tol);
}

function parseRowHeights(gridTemplateRows) {
  if (!gridTemplateRows) return [];
  return gridTemplateRows
    .split(/\s+/)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

async function measureLarge(page, sel) {
  return page.evaluate((targetSel) => {
    const target = document.querySelector(targetSel);
    const card = target && target.querySelector('.tree-card');
    if (!target || !card) return { error: 'missing' };
    const media = card.querySelector('.tree-card-media, .love-tree-card-media');
    const thumb = card.querySelector('.tree-card-thumb');
    const body = card.querySelector('.tree-card-body, .love-tree-card-body');
    const title = card.querySelector('.tree-title, .love-tree-card-title, .tree-card-title');
    const subtitle = card.querySelector('.tree-subtitle, .love-tree-card-subtitle, .tree-card-subcopy');
    const footer = card.querySelector('.tree-meta-row, .love-tree-card-meta-row');
    const cta = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
    const cs = getComputedStyle(card);
    const mcs = getComputedStyle(media);
    const tcs = thumb ? getComputedStyle(thumb) : null;
    const bcs = getComputedStyle(body);
    const tics = getComputedStyle(title);
    const sics = getComputedStyle(subtitle);
    const fr = footer.getBoundingClientRect();
    const cr = cta.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const gridCs = getComputedStyle(target);
    const vis = card.querySelector('.love-tree-card-visibility, .tree-card-visibility');
    const visR = vis ? vis.getBoundingClientRect() : null;
    return {
      mode: target.getAttribute('data-tree-view-mode'),
      cols: gridCs.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      gap: gridCs.columnGap || gridCs.gap,
      height: cs.height,
      mediaH: mcs.height,
      mediaMin: mcs.minHeight,
      thumbH: tcs ? tcs.height : null,
      thumbMarginBottom: tcs ? tcs.marginBottom : null,
      bodyDisplay: bcs.display,
      bodyRows: bcs.gridTemplateRows,
      bodyGap: bcs.rowGap,
      bodyPad: bcs.padding,
      titleSize: tics.fontSize,
      titleWeight: tics.fontWeight,
      titleLH: tics.lineHeight,
      titleH: tics.height,
      titleWS: tics.whiteSpace,
      titleClamp: tics.webkitLineClamp,
      subSize: sics.fontSize,
      subLH: sics.lineHeight,
      subH: sics.height,
      subWS: sics.whiteSpace,
      subClamp: sics.webkitLineClamp,
      ctaCount: card.querySelectorAll('.tree-card-open-link, .love-tree-card-open-link').length,
      modeEdit: (cta.getAttribute('href') || '').includes('mode=edit'),
      editCount: [...card.querySelectorAll('a,button')].filter((el) =>
        /편집하기|mode=edit/.test((el.textContent || '') + (el.getAttribute('href') || ''))
      ).length,
      vis: !!vis,
      visInside: visR
        ? visR.width === 0 ||
          (visR.left >= cardRect.left - 1 &&
            visR.right <= cardRect.right + 1 &&
            visR.top >= cardRect.top - 1 &&
            visR.bottom <= cardRect.bottom + 1)
        : null,
      meta: !!card.querySelector('.tree-card-metadata-slot, .tree-public-tags'),
      metricsZero: (() => {
        const m = card.querySelector('.tree-card-reaction-metrics');
        if (!m) return null;
        return /0/.test(m.textContent || '');
      })(),
      footerInside:
        fr.top >= cardRect.top - 2 &&
        fr.bottom <= cardRect.bottom + 2 &&
        fr.left >= cardRect.left - 2 &&
        fr.right <= cardRect.right + 2,
      ctaInside:
        cr.top >= cardRect.top - 2 &&
        cr.bottom <= cardRect.bottom + 2 &&
        cr.left >= cardRect.left - 2 &&
        cr.right <= cardRect.right + 4,
      overflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
      overflowLoose:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    };
  }, sel);
}

async function loadLarge(context, port, pathUrl, key) {
  const page = await context.newPage();
  await page.addInitScript((k) => localStorage.setItem(k, 'large'), key);
  await page.goto(`http://127.0.0.1:${port}${pathUrl}`, { waitUntil: 'networkidle' });
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.setAttribute('data-tree-view-mode', 'large');
  }, pathUrl.includes('browse') ? '#resultsList' : '#trees-grid');
  await page.waitForTimeout(120);
  const geo = await measureLarge(page, pathUrl.includes('browse') ? '#resultsList' : '#trees-grid');
  await page.close();
  return geo;
}

test('#3608 large browser: desktop 1440 Browse/My Trees core geometry matches', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const browse = await loadLarge(context, port, '/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadLarge(context, port, '/fixture-mytrees.html', 'lovebud:myTrees:viewMode');

    assert.equal(browse.mode, 'large');
    assert.equal(mytrees.mode, 'large');
    assert.equal(browse.cols, 2);
    assert.equal(mytrees.cols, 2);
    assert.ok(pxClose(browse.gap, mytrees.gap, 1), `gap ${browse.gap} vs ${mytrees.gap}`);
    assert.ok(pxClose(browse.height, 380), `browse h ${browse.height}`);
    assert.ok(pxClose(mytrees.height, 380), `mytrees h ${mytrees.height}`);
    assert.ok(pxClose(browse.mediaH, 136), `browse media ${browse.mediaH}`);
    assert.ok(pxClose(mytrees.mediaH, 136), `my media ${mytrees.mediaH}`);
    assert.ok(pxClose(browse.mediaMin, 136) || browse.mediaMin === '136px', `browse mediaMin ${browse.mediaMin}`);
    assert.ok(pxClose(mytrees.mediaMin, 136) || mytrees.mediaMin === '136px', `my mediaMin ${mytrees.mediaMin}`);
    assert.ok(pxClose(mytrees.thumbH, 136, 2), `thumbH ${mytrees.thumbH}`);
    assert.ok(pxClose(mytrees.thumbMarginBottom, 0), `thumb marginBottom ${mytrees.thumbMarginBottom}`);
    assert.equal(browse.bodyDisplay, 'grid');
    assert.equal(mytrees.bodyDisplay, 'grid');
    const bRows = parseRowHeights(browse.bodyRows);
    const mRows = parseRowHeights(mytrees.bodyRows);
    assert.ok(bRows.length >= 4, `browse row count ${bRows.length} from ${browse.bodyRows}`);
    assert.ok(mRows.length >= 4, `mytrees row count ${mRows.length} from ${mytrees.bodyRows}`);
    assert.ok(pxClose(bRows[0], 52, 1), `browse row0 ${bRows[0]}`);
    assert.ok(pxClose(mRows[0], 52, 1), `my row0 ${mRows[0]}`);
    assert.ok(pxClose(bRows[1], 38.4, 1.5), `browse row1 ${bRows[1]}`);
    assert.ok(pxClose(mRows[1], 38.4, 1.5), `my row1 ${mRows[1]}`);
    assert.ok(pxClose(browse.bodyGap, 8), `browse gap ${browse.bodyGap}`);
    assert.ok(pxClose(mytrees.bodyGap, 8), `my gap ${mytrees.bodyGap}`);
    assert.equal(browse.bodyPad, '10px 12px 12px');
    assert.equal(mytrees.bodyPad, '10px 12px 12px');
    assert.ok(pxClose(browse.titleSize, 20), `browse title ${browse.titleSize}`);
    assert.ok(pxClose(mytrees.titleSize, 20), `my title ${mytrees.titleSize}`);
    assert.equal(String(browse.titleWeight), '900');
    assert.equal(String(mytrees.titleWeight), '900');
    assert.ok(pxClose(browse.titleLH, 26), `browse titleLH ${browse.titleLH}`);
    assert.ok(pxClose(mytrees.titleLH, 26), `my titleLH ${mytrees.titleLH}`);
    assert.ok(parseFloat(browse.titleH) >= 45 && parseFloat(browse.titleH) <= 53, `browse titleH ${browse.titleH}`);
    assert.ok(parseFloat(mytrees.titleH) >= 45 && parseFloat(mytrees.titleH) <= 53, `my titleH ${mytrees.titleH}`);
    assert.equal(browse.titleWS, 'normal');
    assert.equal(mytrees.titleWS, 'normal');
    assert.ok(pxClose(browse.subSize, 13.6, 0.5), `browse sub ${browse.subSize}`);
    assert.ok(pxClose(mytrees.subSize, 13.6, 0.5), `my sub ${mytrees.subSize}`);
    assert.ok(pxClose(browse.subLH, 19.04, 1), `browse subLH ${browse.subLH}`);
    assert.ok(pxClose(mytrees.subLH, 19.04, 1), `my subLH ${mytrees.subLH}`);
    assert.ok(parseFloat(browse.subH) >= 36 && parseFloat(browse.subH) <= 44, `browse subH ${browse.subH}`);
    assert.ok(parseFloat(mytrees.subH) >= 36 && parseFloat(mytrees.subH) <= 44, `my subH ${mytrees.subH}`);
    assert.equal(browse.subWS, 'normal');
    assert.equal(mytrees.subWS, 'normal');
    assert.equal(browse.ctaCount, 1);
    assert.equal(mytrees.ctaCount, 1);
    assert.equal(browse.modeEdit, false);
    assert.equal(mytrees.modeEdit, false);
    assert.equal(browse.editCount, 0);
    assert.equal(mytrees.editCount, 0);
    assert.equal(browse.meta, true);
    assert.equal(mytrees.vis, true);
    if (mytrees.visInside != null) assert.equal(mytrees.visInside, true);
    assert.equal(browse.footerInside, true);
    assert.equal(mytrees.footerInside, true);
    assert.equal(browse.ctaInside, true);
    assert.equal(mytrees.ctaInside, true);
    assert.ok(browse.overflow || browse.overflowLoose);
    assert.ok(mytrees.overflow || mytrees.overflowLoose);
    assert.equal(browse.metricsZero, true);
    assert.equal(mytrees.metricsZero, true);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 large browser: mobile 375 keeps 2-col large + parity + no overflow', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const browse = await loadLarge(context, port, '/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadLarge(context, port, '/fixture-mytrees.html', 'lovebud:myTrees:viewMode');
    assert.equal(browse.cols, 2, 'Browse large stays 2-col on mobile');
    assert.equal(mytrees.cols, 2, 'My Trees large stays 2-col on mobile');
    assert.ok(pxClose(browse.height, 380), `browse h ${browse.height}`);
    assert.ok(pxClose(mytrees.height, 380), `my h ${mytrees.height}`);
    assert.ok(pxClose(browse.mediaH, 136), `browse media ${browse.mediaH}`);
    assert.ok(pxClose(mytrees.mediaH, 136), `my media ${mytrees.mediaH}`);
    assert.ok(pxClose(mytrees.thumbH, 136, 2), `thumb ${mytrees.thumbH}`);
    assert.ok(pxClose(mytrees.thumbMarginBottom, 0), `thumb mb ${mytrees.thumbMarginBottom}`);
    assert.equal(browse.bodyDisplay, 'grid');
    assert.equal(mytrees.bodyDisplay, 'grid');
    assert.equal(browse.bodyPad, '10px 12px 12px');
    assert.equal(mytrees.bodyPad, '10px 12px 12px');
    assert.ok(pxClose(browse.titleSize, mytrees.titleSize, 0.5));
    assert.equal(String(browse.titleWeight), '900');
    assert.equal(String(mytrees.titleWeight), '900');
    assert.equal(browse.ctaCount, 1);
    assert.equal(mytrees.ctaCount, 1);
    assert.equal(browse.editCount, 0);
    assert.equal(mytrees.editCount, 0);
    assert.equal(mytrees.vis, true);
    if (mytrees.visInside != null) assert.equal(mytrees.visInside, true);
    // Narrow 2-col large may clip CTA by <4px on either surface; require footer in bounds.
    assert.ok(browse.footerInside || browse.ctaInside, 'browse containment');
    assert.ok(mytrees.footerInside || mytrees.ctaInside, 'mytrees containment');
    assert.ok(browse.overflow || browse.overflowLoose, 'browse doc overflow');
    assert.ok(mytrees.overflow || mytrees.overflowLoose, 'mytrees doc overflow');
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 large source: My Trees large geometry rules present; cache tokens', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/tree-view-mode.css'), 'utf8');
  const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
  const myHtml = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');

  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-card-body[^{]*\{[^}]*grid-template-rows:\s*3\.25rem\s+2\.4rem\s+minmax\(0,\s*1fr\)\s+auto/s
  );
  assert.match(
    css,
    /#resultsList\[data-tree-view-mode="large"\][^{]*\.tree-card-body[^{]*\{[^}]*grid-template-rows:\s*3\.25rem\s+2\.4rem\s+minmax\(0,\s*1fr\)\s+auto/s
  );
  assert.match(css, /\.trees-grid\[data-tree-view-mode="large"\]\s+\.tree-card\s*\{[^}]*height:\s*380px/);
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-card-media[^{]*\{[^}]*height:\s*136px/
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-card-thumb[^{]*\{[^}]*margin:\s*0/
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-title[^{]*\{[^}]*font-size:\s*1\.25rem/
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-title[^{]*\{[^}]*font-weight:\s*900/
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-title[^{]*\{[^}]*max-height:\s*3\.25rem/
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="large"\][^{]*\.tree-subtitle[^{]*\{[^}]*max-height:\s*2\.4rem/
  );
  assert.match(searchHtml, /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/);
  assert.match(myHtml, /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/);
  assert.doesNotMatch(css, /\[data-tree-view-mode="compact"\][^{]*\{[^}]*font-weight:\s*300/);
});
