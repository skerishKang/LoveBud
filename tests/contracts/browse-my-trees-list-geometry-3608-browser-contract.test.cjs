/**
 * #3608 Phase 2 PR-B — Browse/My Trees list geometry parity
 *
 * Executable Chromium contract (not string-only).
 * Loads production CSS asset chains and measures computed list geometry.
 * Browse list is canonical; My Trees list must match core body/media grammar.
 * Card auto-height is content-driven and not forced equal across surfaces.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..');
const CSS_TOKEN = '20260721-3608-list-1';
const TOKEN_FAMILY = /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/;

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
      ? '<div class="tree-card-metadata-slot"><div class="tree-public-metadata"><div class="tree-public-metadata-desc">공개 메타 설명 샘플 한 줄 이상의 내용</div></div><div class="tree-public-tags"><span class="tree-public-tag">#tag</span></div></div>'
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
      <div class="tree-subtitle love-tree-card-subtitle tree-card-subcopy">이어진 기억 한 줄 부제 샘플</div>
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
  ${cardMarkup('browse', 'browse-1', 'Browse List Tree Title')}
  ${cardMarkup('browse', 'browse-2', 'Browse List Tree Two')}
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
  ${cardMarkup('my-trees', 'owner-1', 'My Trees List Tree Title')}
  ${cardMarkup('my-trees', 'owner-2', 'My Trees List Tree Two')}
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

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

async function measureList(page, sel) {
  return page.evaluate((targetSel) => {
    const target = document.querySelector(targetSel);
    const card = target && target.querySelector('.tree-card');
    if (!target || !card) return { error: 'missing' };
    const media = card.querySelector('.tree-card-media, .love-tree-card-media');
    const thumb = card.querySelector('.tree-card-thumb');
    const body = card.querySelector('.tree-card-body, .love-tree-card-body');
    const title = card.querySelector('.tree-title, .love-tree-card-title, .tree-card-title');
    const footer = card.querySelector('.tree-meta-row, .love-tree-card-meta-row');
    const cta = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
    const vis = card.querySelector('.love-tree-card-visibility, .tree-card-visibility');
    const meta = card.querySelector('.tree-card-metadata-slot, .tree-public-tags');
    const cs = getComputedStyle(card);
    const mcs = media ? getComputedStyle(media) : null;
    const tcs = thumb ? getComputedStyle(thumb) : null;
    const bcs = body ? getComputedStyle(body) : null;
    const tics = title ? getComputedStyle(title) : null;
    const gridCs = getComputedStyle(target);
    const cardRect = card.getBoundingClientRect();
    const mediaRect = media ? media.getBoundingClientRect() : null;
    const thumbRect = thumb ? thumb.getBoundingClientRect() : null;
    const fr = footer ? footer.getBoundingClientRect() : null;
    const cr = cta ? cta.getBoundingClientRect() : null;
    const vr = vis ? vis.getBoundingClientRect() : null;
    const inside = (r, pad = 2) =>
      !!r &&
      r.top >= cardRect.top - pad &&
      r.bottom <= cardRect.bottom + pad &&
      r.left >= cardRect.left - pad &&
      r.right <= cardRect.right + pad + 2;
    const colsRaw = (gridCs.gridTemplateColumns || '').trim();
    const cardColsRaw = (cs.gridTemplateColumns || '').trim();
    const cardColParts = cardColsRaw.split(/\s+/).filter(Boolean);
    return {
      mode: target.getAttribute('data-tree-view-mode'),
      cols: colsRaw.split(/\s+/).filter(Boolean).length,
      gap: gridCs.columnGap || gridCs.gap,
      cardDisplay: cs.display,
      cardCols: cardColsRaw,
      cardColCount: cardColParts.length,
      cardFirstCol: cardColParts[0] || null,
      cardH: cs.height,
      cardMinH: cs.minHeight,
      cardPad: cs.padding,
      mediaW: mcs ? mcs.width : null,
      mediaH: mcs ? mcs.height : null,
      mediaMinH: mcs ? mcs.minHeight : null,
      mediaRadius: mcs ? mcs.borderRadius : null,
      mediaRectH: mediaRect ? mediaRect.height : null,
      cardRectH: cardRect.height,
      thumbH: tcs ? tcs.height : null,
      thumbMb: tcs ? tcs.marginBottom : null,
      thumbInsideMedia: !!(
        thumbRect &&
        mediaRect &&
        thumbRect.top >= mediaRect.top - 1 &&
        thumbRect.bottom <= mediaRect.bottom + 1 &&
        thumbRect.left >= mediaRect.left - 1 &&
        thumbRect.right <= mediaRect.right + 1
      ),
      bodyDisplay: bcs ? bcs.display : null,
      bodyDir: bcs ? bcs.flexDirection : null,
      bodyJustify: bcs ? bcs.justifyContent : null,
      bodyPad: bcs ? bcs.padding : null,
      bodyH: bcs ? bcs.height : null,
      bodyOverflow: bcs ? bcs.overflow : null,
      titleSize: tics ? tics.fontSize : null,
      titleWeight: tics ? tics.fontWeight : null,
      footerInside: fr ? inside(fr) : null,
      ctaInside: cr ? inside(cr) : null,
      visPresent: !!vis,
      visInside: vr ? inside(vr, 3) : null,
      metaPresent: !!meta,
      ctaCount: card.querySelectorAll('.tree-card-open-link, .love-tree-card-open-link').length,
      modeEdit: (cta && (cta.getAttribute('href') || '').includes('mode=edit')) || false,
      editCount: [...card.querySelectorAll('a,button')].filter((el) =>
        /편집하기|mode=edit/.test((el.textContent || '') + (el.getAttribute('href') || ''))
      ).length,
      metricsZero: (() => {
        const m = card.querySelector('.tree-card-reaction-metrics');
        return m ? /0/.test(m.textContent || '') : null;
      })(),
      overflowEqual:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      cardRows: cs.gridTemplateRows,
    };
  }, sel);
}

async function loadList(context, port, pathUrl, key) {
  const page = await context.newPage();
  await page.addInitScript((k) => localStorage.setItem(k, 'list'), key);
  await page.goto(`http://127.0.0.1:${port}${pathUrl}`, { waitUntil: 'networkidle' });
  const sel = pathUrl.includes('browse') ? '#resultsList' : '#trees-grid';
  await page.evaluate((targetSel) => {
    const el = document.querySelector(targetSel);
    if (el) el.setAttribute('data-tree-view-mode', 'list');
    const btn = document.querySelector('.tree-view-mode-btn[data-mode="list"]');
    if (btn) btn.click();
  }, sel);
  await page.waitForTimeout(150);
  await page.evaluate((targetSel) => {
    const el = document.querySelector(targetSel);
    if (el && el.getAttribute('data-tree-view-mode') !== 'list') {
      el.setAttribute('data-tree-view-mode', 'list');
    }
  }, sel);
  await page.waitForTimeout(120);
  const geo = await measureList(page, sel);
  await page.close();
  return geo;
}

function assertDesktopCore(browse, mytrees) {
  assert.equal(browse.mode, 'list');
  assert.equal(mytrees.mode, 'list');
  assert.equal(browse.cols, 1);
  assert.equal(mytrees.cols, 1);
  assert.ok(pxClose(browse.gap, 14, 1), `gap ${browse.gap}`);
  assert.ok(pxClose(mytrees.gap, 14, 1), `my gap ${mytrees.gap}`);
  assert.equal(browse.cardDisplay, 'grid');
  assert.equal(mytrees.cardDisplay, 'grid');
  assert.ok(pxClose(browse.cardFirstCol, 160, 2), `browse first col ${browse.cardFirstCol}`);
  assert.ok(pxClose(mytrees.cardFirstCol, 160, 2), `my first col ${mytrees.cardFirstCol}`);
  assert.ok(browse.cardColCount >= 2, `browse card cols ${browse.cardCols}`);
  assert.ok(mytrees.cardColCount >= 2, `my card cols ${mytrees.cardCols}`);
  assert.equal(browse.cardPad, '0px');
  assert.equal(mytrees.cardPad, '0px');
  assert.ok(parseFloat(browse.cardMinH) >= 110 || parseFloat(browse.cardH) >= 110);
  assert.ok(parseFloat(mytrees.cardMinH) >= 110 || parseFloat(mytrees.cardH) >= 110);
  // media ~160 wide, min-height >= 110, stretched near card height
  assert.ok(pxClose(browse.mediaW, 160, 4), `browse mediaW ${browse.mediaW}`);
  assert.ok(pxClose(mytrees.mediaW, 160, 4), `my mediaW ${mytrees.mediaW}`);
  assert.ok(parseFloat(browse.mediaMinH) >= 110, `browse mediaMin ${browse.mediaMinH}`);
  assert.ok(parseFloat(mytrees.mediaMinH) >= 110, `my mediaMin ${mytrees.mediaMinH}`);
  assert.ok(
    Math.abs(parseFloat(browse.mediaRectH) - parseFloat(browse.cardRectH)) <= 3,
    `browse media stretch ${browse.mediaRectH} vs card ${browse.cardRectH}`
  );
  assert.ok(
    Math.abs(parseFloat(mytrees.mediaRectH) - parseFloat(mytrees.cardRectH)) <= 3,
    `my media stretch ${mytrees.mediaRectH} vs card ${mytrees.cardRectH}`
  );
  // body core parity
  assert.equal(browse.bodyDisplay, 'flex');
  assert.equal(mytrees.bodyDisplay, 'flex');
  assert.equal(browse.bodyDir, 'column');
  assert.equal(mytrees.bodyDir, 'column');
  assert.ok(
    browse.bodyJustify === 'center' || browse.bodyJustify === 'normal',
    `browse justify ${browse.bodyJustify}`
  );
  // canonical is center; My Trees must match
  assert.equal(mytrees.bodyJustify, 'center');
  assert.equal(browse.bodyJustify, 'center');
  assert.equal(browse.bodyPad, '14px 16px');
  assert.equal(mytrees.bodyPad, '14px 16px');
  assert.ok(browse.bodyOverflow === 'hidden' || browse.bodyOverflow === 'clip');
  assert.ok(mytrees.bodyOverflow === 'hidden' || mytrees.bodyOverflow === 'clip');
  // My Trees thumb
  assert.ok(pxClose(mytrees.thumbMb, 0, 1), `thumb mb ${mytrees.thumbMb}`);
  assert.equal(mytrees.thumbInsideMedia, true);
  assert.equal(mytrees.visPresent, true);
  if (mytrees.visInside != null) assert.equal(mytrees.visInside, true);
  // Browse metadata
  assert.equal(browse.metaPresent, true);
  // shared guards
  assert.equal(browse.footerInside, true);
  assert.equal(mytrees.footerInside, true);
  assert.equal(browse.ctaInside, true);
  assert.equal(mytrees.ctaInside, true);
  assert.equal(browse.ctaCount, 1);
  assert.equal(mytrees.ctaCount, 1);
  assert.equal(browse.editCount, 0);
  assert.equal(mytrees.editCount, 0);
  assert.equal(browse.modeEdit, false);
  assert.equal(mytrees.modeEdit, false);
  assert.equal(browse.metricsZero, true);
  assert.equal(mytrees.metricsZero, true);
  assert.equal(browse.overflowEqual, true);
  assert.equal(mytrees.overflowEqual, true);
}

test('#3608 list browser: desktop 1440 body/media core parity', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const browse = await loadList(context, port, '/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadList(context, port, '/fixture-mytrees.html', 'lovebud:myTrees:viewMode');
    assert.notEqual(browse.error, 'missing', JSON.stringify(browse));
    assert.notEqual(mytrees.error, 'missing', JSON.stringify(mytrees));
    assertDesktopCore(browse, mytrees);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 list browser: tablet 768 side-by-side 110px media', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 768, height: 900 } });
    const browse = await loadList(context, port, '/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadList(context, port, '/fixture-mytrees.html', 'lovebud:myTrees:viewMode');
    assert.equal(browse.mode, 'list');
    assert.equal(mytrees.mode, 'list');
    assert.ok(pxClose(browse.cardFirstCol, 110, 3), `browse first ${browse.cardFirstCol}`);
    assert.ok(pxClose(mytrees.cardFirstCol, 110, 3), `my first ${mytrees.cardFirstCol}`);
    assert.ok(parseFloat(browse.mediaMinH) >= 110, browse.mediaMinH);
    assert.ok(parseFloat(mytrees.mediaMinH) >= 110, mytrees.mediaMinH);
    assert.equal(browse.bodyDisplay, 'flex');
    assert.equal(mytrees.bodyDisplay, 'flex');
    assert.equal(browse.footerInside, true);
    assert.equal(mytrees.footerInside, true);
    assert.equal(browse.ctaInside, true);
    assert.equal(mytrees.ctaInside, true);
    assert.equal(browse.overflowEqual, true);
    assert.equal(mytrees.overflowEqual, true);
    assert.ok(pxClose(mytrees.thumbMb, 0, 1), mytrees.thumbMb);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 list browser: mobile 375 stacked 140px media + flex body', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const browse = await loadList(context, port, '/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadList(context, port, '/fixture-mytrees.html', 'lovebud:myTrees:viewMode');
    assert.equal(browse.mode, 'list');
    assert.equal(mytrees.mode, 'list');
    assert.equal(browse.cols, 1);
    assert.equal(mytrees.cols, 1);
    // vertical stack: first track media 140
    assert.ok(pxClose(browse.mediaH, 140, 2), `browse mediaH ${browse.mediaH}`);
    assert.ok(pxClose(mytrees.mediaH, 140, 2), `my mediaH ${mytrees.mediaH}`);
    assert.ok(/140px/.test(browse.cardRows || '') || pxClose(browse.mediaH, 140, 2));
    assert.ok(/140px/.test(mytrees.cardRows || '') || pxClose(mytrees.mediaH, 140, 2));
    assert.equal(browse.bodyDisplay, 'flex');
    assert.equal(mytrees.bodyDisplay, 'flex');
    assert.equal(browse.bodyDir, 'column');
    assert.equal(mytrees.bodyDir, 'column');
    assert.equal(browse.bodyPad, '12px 14px 14px');
    assert.equal(mytrees.bodyPad, '12px 14px 14px');
    assert.equal(browse.ctaCount, 1);
    assert.equal(mytrees.ctaCount, 1);
    assert.equal(browse.editCount, 0);
    assert.equal(mytrees.editCount, 0);
    assert.equal(browse.modeEdit, false);
    assert.equal(mytrees.modeEdit, false);
    assert.equal(mytrees.visPresent, true);
    if (mytrees.visInside != null) assert.equal(mytrees.visInside, true);
    assert.ok(browse.footerInside || browse.ctaInside);
    assert.ok(mytrees.footerInside || mytrees.ctaInside);
    assert.equal(browse.overflowEqual, true);
    assert.equal(mytrees.overflowEqual, true);
    assert.ok(pxClose(mytrees.thumbMb, 0, 1), mytrees.thumbMb);
    // title sizes recorded only — no forced equality
    assert.ok(browse.titleSize);
    assert.ok(mytrees.titleSize);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 list source: My Trees list body flex + cache tokens', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/tree-view-mode.css'), 'utf8');
  const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
  const myHtml = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');

  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="list"\][^{]*\.tree-card-body[^{]*\{[^}]*display:\s*flex/s
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="list"\][^{]*\.tree-card-body[^{]*\{[^}]*justify-content:\s*center/s
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="list"\][^{]*\.tree-card-body[^{]*\{[^}]*padding:\s*14px\s+16px/s
  );
  assert.match(
    css,
    /#resultsList\[data-tree-view-mode="list"\][^{]*\.tree-card-body[^{]*\{[^}]*display:\s*flex/s
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="list"\][^{]*\.tree-card-thumb[^{]*\{[^}]*margin:\s*0/s
  );
  assert.match(
    css,
    /\.trees-grid\[data-tree-view-mode="list"\][^{]*\.love-tree-card-media/
  );
  // compact/large not regressed by this PR
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card\s*\{[^}]*height:\s*380px/);
  assert.match(css, /\.trees-grid\[data-tree-view-mode="large"\]\s+\.tree-card\s*\{[^}]*height:\s*380px/);
  assert.doesNotMatch(css, /\[data-tree-view-mode="compact"\][^{]*\{[^}]*font-weight:\s*300/);

  assert.match(searchHtml, TOKEN_FAMILY);
  assert.match(myHtml, TOKEN_FAMILY);
  assert.match(searchHtml, /tree-view-mode\.css\?v=20260721-3608-list-1/);
  assert.match(myHtml, /tree-view-mode\.css\?v=20260721-3608-list-1/);
});
