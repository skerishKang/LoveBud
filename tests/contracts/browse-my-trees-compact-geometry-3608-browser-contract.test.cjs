/**
 * #3608 Phase 1 — Browse/My Trees compact geometry + default mode
 *
 * Executable Chromium contract (not string-only).
 * Loads production CSS/JS asset chains and measures computed geometry.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

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
      ? '<div class="tree-card-metadata-slot"><div class="tree-public-metadata"><div class="tree-public-metadata-desc">공개 메타 설명 샘플</div></div><div class="tree-public-tags"><span class="tree-public-tag">#tag</span></div></div>'
      : '';
  const ctaLabel = surface === 'my-trees' ? '감상하기' : '트리 열기';
  const href =
    surface === 'my-trees'
      ? `/pages/editor?treeId=${id}`
      : `/pages/view.html?treeId=${id}`;
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
      <div class="tree-subtitle love-tree-card-subtitle tree-card-subcopy">이어진 기억 한 줄</div>
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
<link rel="stylesheet" href="/css/tree-view-mode.css?v=20260721-3608-1"/>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; }
  #resultsList { display: grid; padding: 16px; box-sizing: border-box; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<div id="browseViewModeMount"></div>
<div id="resultsList">
  ${cardMarkup('browse', 'browse-1', 'Browse Compact Tree')}
  ${cardMarkup('browse', 'browse-2', 'Browse Compact Tree Two')}
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
  ${cardMarkup('my-trees', 'owner-1', 'My Trees Compact Tree')}
  ${cardMarkup('my-trees', 'owner-2', 'My Trees Compact Tree Two')}
</div>
<aside id="myTreesHubPanel" class="my-trees-hub-panel preview-sidebar"></aside>
<script src="/js/tree-view-mode-switcher.js"></script>
<script src="/js/my-trees/my-trees-page-bootstrap.js?v=20260721-3608-1"></script>
</body></html>`;
}

function measureScript(targetSel) {
  return () => {
    const target = document.querySelector(arguments[0] || targetSel);
    const card = target && target.querySelector('.tree-card[data-tree-id], .love-tree-card[data-tree-id]');
    if (!target || !card) return { error: 'missing' };
    const media = card.querySelector('.tree-card-media, .love-tree-card-media');
    const thumb = card.querySelector('.tree-card-thumb');
    const body = card.querySelector('.tree-card-body, .love-tree-card-body');
    const title = card.querySelector('.tree-title, .love-tree-card-title, .tree-card-title');
    const subtitle = card.querySelector('.tree-subtitle, .love-tree-card-subtitle, .tree-card-subcopy');
    const footer = card.querySelector('.tree-meta-row, .love-tree-card-meta-row');
    const cta = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
    const ctas = card.querySelectorAll('.tree-card-open-link, .love-tree-card-open-link');
    const edits = [...card.querySelectorAll('a,button')].filter((el) =>
      /편집하기|mode=edit/.test((el.textContent || '') + (el.getAttribute('href') || ''))
    );
    const vis = card.querySelector('.love-tree-card-visibility, .tree-card-visibility');
    const tags = card.querySelector('.tree-public-tags, .tree-card-metadata-slot');
    const cs = getComputedStyle(card);
    const mcs = media ? getComputedStyle(media) : null;
    const tcs = thumb ? getComputedStyle(thumb) : null;
    const bcs = body ? getComputedStyle(body) : null;
    const titleCs = title ? getComputedStyle(title) : null;
    const subCs = subtitle ? getComputedStyle(subtitle) : null;
    const fr = footer ? footer.getBoundingClientRect() : null;
    const cr = cta ? cta.getBoundingClientRect() : null;
    const gridCs = getComputedStyle(target);
    const cols = gridCs.gridTemplateColumns.split(' ').filter(Boolean).length;
    return {
      mode: target.getAttribute('data-tree-view-mode'),
      gridColumns: cols,
      gridGap: gridCs.gap || gridCs.columnGap,
      card: {
        height: cs.height,
        minHeight: cs.minHeight,
        padding: cs.padding,
        display: cs.display,
        flexDirection: cs.flexDirection,
        boxSizing: cs.boxSizing,
        width: cs.width,
      },
      media: mcs
        ? { height: mcs.height, minHeight: mcs.minHeight, maxHeight: mcs.maxHeight, margin: mcs.margin, padding: mcs.padding }
        : null,
      thumb: tcs
        ? { height: tcs.height, minHeight: tcs.minHeight, margin: tcs.margin, padding: tcs.padding }
        : null,
      body: bcs
        ? {
            display: bcs.display,
            gridTemplateRows: bcs.gridTemplateRows,
            rowGap: bcs.rowGap,
            padding: bcs.padding,
            minHeight: bcs.minHeight,
          }
        : null,
      title: titleCs
        ? {
            fontSize: titleCs.fontSize,
            fontWeight: titleCs.fontWeight,
            lineHeight: titleCs.lineHeight,
            height: titleCs.height,
            whiteSpace: titleCs.whiteSpace,
          }
        : null,
      subtitle: subCs
        ? { fontSize: subCs.fontSize, lineHeight: subCs.lineHeight, height: subCs.height }
        : null,
      footer: fr ? { top: fr.top, bottom: fr.bottom } : null,
      cta: cr
        ? {
            top: cr.top,
            bottom: cr.bottom,
            count: ctas.length,
            href: cta.getAttribute('href') || '',
            modeEdit: (cta.getAttribute('href') || '').includes('mode=edit'),
          }
        : { count: ctas.length },
      editCount: edits.length,
      visibilityPresent: !!vis,
      browseMetaPresent: !!tags,
      overflow: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      activeControl: (() => {
        const btn = document.querySelector('.tree-view-mode-btn.is-active, .tree-view-mode-btn[aria-checked="true"]');
        return btn ? btn.getAttribute('data-mode') || btn.getAttribute('aria-checked') : null;
      })(),
    };
  };
}

function pxClose(a, b, tol) {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b;
  return Math.abs(na - nb) <= (tol == null ? 1 : tol);
}

test('#3608 browser: empty storage defaults both surfaces to compact', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.clearCookies();
    // empty storage
    const pageB = await context.newPage();
    await pageB.addInitScript(() => {
      try {
        localStorage.removeItem('lovebud:browse:viewMode');
        localStorage.removeItem('lovebud:myTrees:viewMode');
      } catch (_) {}
    });
    await pageB.goto(`http://127.0.0.1:${port}/fixture-browse.html`, { waitUntil: 'networkidle' });
    await pageB.waitForTimeout(150);
    const browseMode = await pageB.evaluate(() => ({
      attr: document.getElementById('resultsList').getAttribute('data-tree-view-mode'),
      storage: localStorage.getItem('lovebud:browse:viewMode'),
      active: document.querySelector('.tree-view-mode-btn.is-active')?.getAttribute('data-mode') || null,
    }));
    assert.equal(browseMode.attr, 'compact');
    assert.equal(browseMode.active, 'compact');

    const pageM = await context.newPage();
    await pageM.addInitScript(() => {
      try {
        localStorage.removeItem('lovebud:browse:viewMode');
        localStorage.removeItem('lovebud:myTrees:viewMode');
      } catch (_) {}
    });
    await pageM.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await pageM.waitForTimeout(150);
    const myMode = await pageM.evaluate(() => ({
      attr: document.getElementById('trees-grid').getAttribute('data-tree-view-mode'),
      storage: localStorage.getItem('lovebud:myTrees:viewMode'),
      active: document.querySelector('.tree-view-mode-btn.is-active')?.getAttribute('data-mode') || null,
    }));
    assert.equal(myMode.attr, 'compact', 'My Trees empty storage must default to compact');
    assert.equal(myMode.active, 'compact');
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 browser: valid independent saved preferences preserved', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageB = await context.newPage();
    await pageB.addInitScript(() => {
      localStorage.setItem('lovebud:browse:viewMode', 'large');
      localStorage.setItem('lovebud:myTrees:viewMode', 'list');
    });
    await pageB.goto(`http://127.0.0.1:${port}/fixture-browse.html`, { waitUntil: 'networkidle' });
    await pageB.waitForTimeout(150);
    assert.equal(
      await pageB.evaluate(() => document.getElementById('resultsList').getAttribute('data-tree-view-mode')),
      'large'
    );
    assert.equal(
      await pageB.evaluate(() => localStorage.getItem('lovebud:myTrees:viewMode')),
      'list',
      'browse page must not clobber myTrees storage key'
    );

    const pageM = await context.newPage();
    await pageM.addInitScript(() => {
      localStorage.setItem('lovebud:browse:viewMode', 'large');
      localStorage.setItem('lovebud:myTrees:viewMode', 'list');
    });
    await pageM.goto(`http://127.0.0.1:${port}/fixture-mytrees.html`, { waitUntil: 'networkidle' });
    await pageM.waitForTimeout(150);
    assert.equal(
      await pageM.evaluate(() => document.getElementById('trees-grid').getAttribute('data-tree-view-mode')),
      'list'
    );
    assert.equal(await pageM.evaluate(() => localStorage.getItem('lovebud:browse:viewMode')), 'large');
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 browser: invalid storage falls back to compact', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const [url, targetId, key] of [
      ['/fixture-browse.html', 'resultsList', 'lovebud:browse:viewMode'],
      ['/fixture-mytrees.html', 'trees-grid', 'lovebud:myTrees:viewMode'],
    ]) {
      const page = await context.newPage();
      await page.addInitScript((k) => {
        localStorage.setItem(k, 'invalid-mode');
      }, key);
      await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);
      const mode = await page.evaluate((id) => document.getElementById(id).getAttribute('data-tree-view-mode'), targetId);
      assert.equal(mode, 'compact', `${key} invalid must fall back to compact`);
      await page.close();
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 browser: desktop 1440 compact Browse/My Trees core geometry matches', { timeout: 90000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    async function loadCompact(path, forceKey) {
      const page = await context.newPage();
      await page.addInitScript((k) => {
        localStorage.setItem(k, 'compact');
      }, forceKey);
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      // force attr if needed
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('data-tree-view-mode', 'compact');
      }, path.includes('browse') ? '#resultsList' : '#trees-grid');
      await page.waitForTimeout(50);
      const geo = await page.evaluate((sel) => {
        const target = document.querySelector(sel);
        const card = target.querySelector('.tree-card');
        const media = card.querySelector('.tree-card-media, .love-tree-card-media');
        const thumb = card.querySelector('.tree-card-thumb');
        const body = card.querySelector('.tree-card-body, .love-tree-card-body');
        const title = card.querySelector('.tree-title, .love-tree-card-title, .tree-card-title');
        const subtitle = card.querySelector('.tree-subtitle, .love-tree-card-subtitle, .tree-card-subcopy');
        const footer = card.querySelector('.tree-meta-row');
        const cta = card.querySelector('.tree-card-open-link');
        const cs = getComputedStyle(card);
        const mcs = getComputedStyle(media);
        const tcs = thumb ? getComputedStyle(thumb) : null;
        const bcs = getComputedStyle(body);
        const tics = getComputedStyle(title);
        const sics = getComputedStyle(subtitle);
        const fr = footer.getBoundingClientRect();
        const cr = cta.getBoundingClientRect();
        const gridCs = getComputedStyle(target);
        return {
          cols: gridCs.gridTemplateColumns.split(' ').filter(Boolean).length,
          gap: gridCs.columnGap || gridCs.gap,
          height: cs.height,
          minHeight: cs.minHeight,
          mediaH: mcs.height,
          mediaMin: mcs.minHeight,
          thumbH: tcs ? tcs.height : null,
          thumbPad: tcs ? tcs.padding : null,
          bodyDisplay: bcs.display,
          bodyRows: bcs.gridTemplateRows,
          bodyGap: bcs.rowGap,
          bodyPad: bcs.padding,
          titleSize: tics.fontSize,
          titleWeight: tics.fontWeight,
          titleLH: tics.lineHeight,
          titleH: tics.height,
          subSize: sics.fontSize,
          subLH: sics.lineHeight,
          subH: sics.height,
          footerTop: fr.top,
          footerBottom: fr.bottom,
          ctaTop: cr.top,
          ctaBottom: cr.bottom,
          ctaCount: card.querySelectorAll('.tree-card-open-link').length,
          modeEdit: (cta.getAttribute('href') || '').includes('mode=edit'),
          editCount: [...card.querySelectorAll('a,button')].filter((el) => /편집하기/.test(el.textContent || '')).length,
          vis: !!card.querySelector('.love-tree-card-visibility, .tree-card-visibility'),
          meta: !!card.querySelector('.tree-card-metadata-slot, .tree-public-tags'),
          overflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
        };
      }, path.includes('browse') ? '#resultsList' : '#trees-grid');
      await page.close();
      return geo;
    }

    const browse = await loadCompact('/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await loadCompact('/fixture-mytrees.html', 'lovebud:myTrees:viewMode');

    assert.equal(browse.cols, 3);
    assert.equal(mytrees.cols, 3);
    assert.ok(pxClose(browse.height, '290px') || pxClose(browse.height, 290), `browse height ${browse.height}`);
    assert.ok(pxClose(mytrees.height, browse.height), `height browse ${browse.height} vs mytrees ${mytrees.height}`);
    assert.ok(pxClose(browse.mediaH, '100px') || pxClose(browse.mediaH, 100), `browse media ${browse.mediaH}`);
    assert.ok(pxClose(mytrees.mediaH, browse.mediaH, 1), `mediaH mismatch ${browse.mediaH} vs ${mytrees.mediaH}`);
    // inner thumb must not exceed media
    if (mytrees.thumbH) {
      assert.ok(parseFloat(mytrees.thumbH) <= parseFloat(mytrees.mediaH) + 1, `thumb ${mytrees.thumbH} > media ${mytrees.mediaH}`);
    }
    assert.equal(browse.bodyDisplay, 'grid');
    assert.equal(mytrees.bodyDisplay, 'grid');
    assert.ok(pxClose(browse.bodyGap, mytrees.bodyGap, 0.5) || browse.bodyGap === mytrees.bodyGap);
    assert.ok(pxClose(browse.titleSize, mytrees.titleSize, 0.5) || browse.titleSize === mytrees.titleSize);
    // Canonical title weight is owned by surface/shared CSS (900), not view-mode overrides.
    assert.equal(String(browse.titleWeight), '900', `browse title fontWeight ${browse.titleWeight}`);
    assert.equal(String(mytrees.titleWeight), '900', `mytrees title fontWeight ${mytrees.titleWeight}`);
    assert.equal(String(browse.titleWeight), String(mytrees.titleWeight));
    assert.ok(pxClose(browse.subSize, mytrees.subSize, 0.5) || browse.subSize === mytrees.subSize);
    assert.equal(browse.ctaCount, 1);
    assert.equal(mytrees.ctaCount, 1);
    assert.equal(browse.modeEdit, false);
    assert.equal(mytrees.modeEdit, false);
    assert.equal(browse.editCount, 0);
    assert.equal(mytrees.editCount, 0);
    assert.equal(mytrees.vis, true);
    assert.equal(browse.meta, true);
    assert.equal(browse.overflow, true);
    assert.equal(mytrees.overflow, true);
    // footer roughly aligned within card (same relative stacking)
    assert.ok(Math.abs(browse.footerBottom - browse.ctaBottom) < 40);
    assert.ok(Math.abs(mytrees.footerBottom - mytrees.ctaBottom) < 40);

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 browser: mobile 375 compact geometry + no horizontal overflow', { timeout: 90000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    async function load(path, key) {
      const page = await context.newPage();
      await page.addInitScript((k) => localStorage.setItem(k, 'compact'), key);
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('data-tree-view-mode', 'compact');
      }, path.includes('browse') ? '#resultsList' : '#trees-grid');
      await page.waitForTimeout(80);
      const geo = await page.evaluate((sel) => {
        const target = document.querySelector(sel);
        const card = target.querySelector('.tree-card');
        const media = card.querySelector('.tree-card-media, .love-tree-card-media');
        const title = card.querySelector('.tree-title, .love-tree-card-title, .tree-card-title');
        const cs = getComputedStyle(card);
        const mcs = getComputedStyle(media);
        const tics = title ? getComputedStyle(title) : null;
        const gridCs = getComputedStyle(target);
        const cardRect = card.getBoundingClientRect();
        // Visible overflow: children whose painted box extends past the card.
        // scrollWidth can exceed clientWidth even with overflow:hidden clipping.
        let visibleChildOverflow = false;
        card.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return;
          if (r.right > cardRect.right + 1.5 || r.left < cardRect.left - 1.5) {
            visibleChildOverflow = true;
          }
        });
        return {
          cols: gridCs.gridTemplateColumns.split(' ').filter(Boolean).length,
          gap: gridCs.columnGap || gridCs.gap,
          height: cs.height,
          mediaH: mcs.height,
          titleWeight: tics ? tics.fontWeight : null,
          overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          cardOverflow: !visibleChildOverflow,
          cardOverflowX: cs.overflowX === 'hidden' || cs.overflow === 'hidden',
        };
      }, path.includes('browse') ? '#resultsList' : '#trees-grid');
      await page.close();
      return geo;
    }
    const browse = await load('/fixture-browse.html', 'lovebud:browse:viewMode');
    const mytrees = await load('/fixture-mytrees.html', 'lovebud:myTrees:viewMode');
    assert.equal(browse.cols, 2);
    assert.equal(mytrees.cols, 2);
    assert.ok(pxClose(browse.gap, '10px') || pxClose(browse.gap, 10), `browse gap ${browse.gap}`);
    assert.ok(pxClose(mytrees.gap, browse.gap, 1), `gap ${browse.gap} vs ${mytrees.gap}`);
    assert.ok(pxClose(browse.height, '260px') || pxClose(browse.height, 260), `browse h ${browse.height}`);
    assert.ok(pxClose(mytrees.height, browse.height, 1), `height ${browse.height} vs ${mytrees.height}`);
    assert.ok(pxClose(browse.mediaH, '80px') || pxClose(browse.mediaH, 80), `browse media ${browse.mediaH}`);
    assert.ok(pxClose(mytrees.mediaH, browse.mediaH, 1), `media ${browse.mediaH} vs ${mytrees.mediaH}`);
    assert.equal(String(browse.titleWeight), '900', `browse mobile title fontWeight ${browse.titleWeight}`);
    assert.equal(String(mytrees.titleWeight), '900', `mytrees mobile title fontWeight ${mytrees.titleWeight}`);
    assert.equal(String(browse.titleWeight), String(mytrees.titleWeight));
    assert.equal(browse.overflow, true);
    assert.equal(mytrees.overflow, true);
    // Prefer zero visible child overflow; allow overflow:hidden clipping as last resort.
    assert.ok(
      browse.cardOverflow || browse.cardOverflowX,
      `browse card visible overflow (overflowX hidden=${browse.cardOverflowX})`
    );
    assert.ok(
      mytrees.cardOverflow || mytrees.cardOverflowX,
      `mytrees card visible overflow (overflowX hidden=${mytrees.cardOverflowX})`
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3608 source: My Trees default is compact; obsolete asymmetry gone', () => {
  const bootstrap = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-page-bootstrap.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/tree-view-mode.css'), 'utf8');
  const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
  const myHtml = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');
  assert.match(bootstrap, /defaultMode:\s*['"]compact['"]/);
  assert.doesNotMatch(bootstrap, /defaultMode:\s*['"]large['"]/);
  // Compact title geometry only — must not override canonical font-weight 900.
  assert.doesNotMatch(
    css,
    /\[data-tree-view-mode="compact"\][^{]*\{[^}]*font-weight:\s*300/
  );
  // List mode may still use 140px stacked media — forbid only My Trees compact asymmetry.
  assert.doesNotMatch(
    css,
    /\.trees-grid\[data-tree-view-mode="compact"\][^{]*\.tree-card-thumb[^{]*\{[^}]*height:\s*140px/
  );
  assert.doesNotMatch(
    css,
    /\.trees-grid\[data-tree-view-mode="compact"\][^{]*\.tree-card-title[^{]*\{[^}]*font-size:\s*0\.95rem/
  );
  assert.doesNotMatch(
    css,
    /\.trees-grid\[data-tree-view-mode="compact"\][^{]*\.tree-card\s*\{[^}]*height:\s*auto/
  );
  // Cache token may advance with later Phase 2 large geometry PR (same stylesheet chain).
  assert.match(searchHtml, /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/);
  assert.match(myHtml, /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/);
  assert.match(myHtml, /my-trees-page-bootstrap\.js\?v=20260721-3608-1/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\],\s*\.trees-grid\[data-tree-view-mode="compact"\]/);
});
