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
const {
  createSameOriginNavigationFailureTracker,
} = require('../helpers/same-origin-navigation-failure-tracker.cjs');
const {
  makeHermeticRouteHandler,
  defaultFulfillExternal,
} = require('../helpers/external-network-hermetic.cjs');

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
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
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
    await closeServer(server);
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
    await closeServer(server);
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
    await closeServer(server);
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
    await closeServer(server);
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
    await closeServer(server);
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
  assert.match(searchHtml, /tree-view-mode\.css\?v=(?:20260721-3608(?:-large|-list)?|20260725-3655)-\d+/);
  assert.match(myHtml, /tree-view-mode\.css\?v=20260721-3608(?:-large|-list)?-\d+/);
  assert.match(myHtml, /my-trees-page-bootstrap\.js\?v=20260721-3608-1/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\],\s*\.trees-grid\[data-tree-view-mode="compact"\]/);
});

test('#3688 browser: canonical staged loading skeleton runtime', { timeout: 90000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const contexts = [
      { name: 'Browse desktop normal', path: '/pages/search.html', isMyTrees: false, viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
      { name: 'Browse mobile reduced-motion', path: '/pages/search.html', isMyTrees: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
      { name: 'My Trees desktop normal', path: '/pages/my-trees.html', isMyTrees: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
      { name: 'My Trees mobile reduced-motion', path: '/pages/my-trees.html', isMyTrees: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
    ];

    for (const ctx of contexts) {
      const context = await browser.newContext({
        viewport: ctx.viewport,
        reducedMotion: ctx.reducedMotion,
        isMobile: ctx.viewport.width < 768,
        hasTouch: ctx.viewport.width < 768,
      });

      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('requestfailed', request => {
        const url = request.url();
        if (url.startsWith(`http://127.0.0.1:${port}`) && request.failure()) {
          errors.push(`requestfailed: ${url} - ${request.failure().errorText}`);
        }
      });
      page.on('response', response => {
        const url = response.url();
        if (url.startsWith(`http://127.0.0.1:${port}`) && response.status() >= 400) {
          errors.push(`response status ${response.status()}: ${url}`);
        }
      });

      await page.route('**/*', makeHermeticRouteHandler({
        fixtureOrigin: `http://127.0.0.1:${port}`,
        onUnexpectedExternal: (url) => errors.push('unexpected external: ' + url),
        onSameOrigin: async (route, target) => {
          const pathname = target.pathname;
          if (pathname === '/js/search/index.js' || pathname === '/js/my-trees/my-trees-page-bootstrap.js' || pathname === '/js/my-trees.js') {
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* inert */' });
            return true;
          }
          if (pathname.startsWith('/api/')) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            return true;
          }
          return false;
        },
      }));

      await page.goto(`http://127.0.0.1:${port}${ctx.path}`, { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(({ isMyTrees, reducedMotion }) => {
        const gridSel = isMyTrees ? '.trees-skeleton-grid' : '#resultsList';
        const grid = document.querySelector(gridSel);
        if (!grid) return false;

        const cardSel = isMyTrees ? '.trees-skeleton-grid .search-skeleton-card' : '#resultsList .search-skeleton-card';
        const card = document.querySelector(cardSel);
        if (!card) return false;

        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const skeletonBase = card.querySelector('.lt-skeleton');
        const skeletonMedia = card.querySelector('.lt-skeleton-media');
        const skeletonTitle = card.querySelector('.lt-skeleton-title');
        const skeletonText = card.querySelector('.lt-skeleton-text');

        if (!skeletonBase || !skeletonMedia || !skeletonTitle || !skeletonText) return false;

        const mediaCs = getComputedStyle(skeletonMedia);
        if (reducedMotion === 'reduce') {
          if (mediaCs.animationName !== 'none') return false;
        } else {
          if (!mediaCs.animationName || !mediaCs.animationName.includes('lt-shimmer')) return false;
        }

        return true;
      }, { isMyTrees: ctx.isMyTrees, reducedMotion: ctx.reducedMotion }, { timeout: 10000 });

      const result = await page.evaluate((isMyTrees) => {
        const gridSel = isMyTrees ? '.trees-skeleton-grid' : '#resultsList';
        const grid = document.querySelector(gridSel);

        const cardSel = isMyTrees ? '.trees-skeleton-grid .search-skeleton-card' : '#resultsList .search-skeleton-card';
        const cards = document.querySelectorAll(cardSel);

        if (!grid || cards.length === 0) {
          return { error: 'Missing grid or cards' };
        }

        const card = cards[0];
        const rect = card.getBoundingClientRect();
        const skeletonBase = card.querySelector('.lt-skeleton');
        const skeletonMedia = card.querySelector('.lt-skeleton-media');
        const skeletonTitle = card.querySelector('.lt-skeleton-title');
        const skeletonText = card.querySelector('.lt-skeleton-text');

        const mediaCs = skeletonMedia ? getComputedStyle(skeletonMedia) : null;

        return {
          gridFound: !!grid,
          cardCount: cards.length,
          width: rect.width,
          height: rect.height,
          ariaHidden: card.getAttribute('aria-hidden'),
          hasSkeletonBase: !!skeletonBase,
          hasSkeletonMedia: !!skeletonMedia,
          hasSkeletonTitle: !!skeletonTitle,
          hasSkeletonText: !!skeletonText,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          animName: mediaCs ? mediaCs.animationName : null
        };
      }, ctx.isMyTrees);

      assert.ok(!result.error, `${ctx.name} setup failed: ${result.error}`);
      assert.ok(result.cardCount >= 1, `${ctx.name} missing skeleton cards`);
      assert.ok(result.width > 0 && result.height > 0, `${ctx.name} skeleton dimensions zero`);
      assert.equal(result.ariaHidden, 'true', `${ctx.name} missing aria-hidden=true`);
      assert.ok(result.hasSkeletonBase, `${ctx.name} missing .lt-skeleton`);
      assert.ok(result.hasSkeletonMedia, `${ctx.name} missing .lt-skeleton-media`);
      assert.ok(result.hasSkeletonTitle, `${ctx.name} missing .lt-skeleton-title`);
      assert.ok(result.hasSkeletonText, `${ctx.name} missing .lt-skeleton-text`);
      assert.equal(result.overflow, false, `${ctx.name} has horizontal overflow`);

      if (ctx.reducedMotion === 'reduce') {
        assert.ok(result.animName === 'none' || !result.animName, `${ctx.name} animation must be none, got ${result.animName}`);
      } else {
        assert.ok(result.animName && result.animName.includes('lt-shimmer'), `${ctx.name} must use canonical lt-shimmer, got ${result.animName}`);
      }
      assert.ok(!result.animName || !result.animName.includes('searchSkeletonPulse'), `${ctx.name} forbidden searchSkeletonPulse found`);

      assert.equal(errors.length, 0, `${ctx.name} errors found: ${errors.join(', ')}`);

      await context.close();
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

test('Browse filter-chip keyboard accessibility', { timeout: 120000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();

  // Deterministic synthetic public trees: 2 per stage so category filters are meaningful.
  const syntheticTrees = [
    { id: 'a11y-1', title: '입덕 트리 알파', visibility: 'public', stage: '입덕', memoryCount: 1, theme: 'first moments', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'a11y-2', title: '입덕 트리 베타', visibility: 'public', stage: '입덕', memoryCount: 2, theme: 'first moments', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'a11y-3', title: '성장 트리 감마', visibility: 'public', stage: '성장', memoryCount: 3, theme: 'growing', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'a11y-4', title: '성장 트리 델타', visibility: 'public', stage: '성장', memoryCount: 4, theme: 'growing', createdAt: '2026-01-04T00:00:00Z' },
    { id: 'a11y-5', title: '최애 트리 엡실론', visibility: 'public', stage: '최애', memoryCount: 5, theme: 'deep love', createdAt: '2026-01-05T00:00:00Z' },
    { id: 'a11y-6', title: '최애 트리 제타', visibility: 'public', stage: '최애', memoryCount: 6, theme: 'deep love', createdAt: '2026-01-06T00:00:00Z' },
  ];

  const chipStateReader = (page) => () => page.evaluate(() => {
    const chips = [...document.querySelectorAll('.filter-row .tag-chip')];
    const cat = (c) => c.getAttribute('data-category');
    let category = null;
    try { category = new URLSearchParams(window.location.search).get('category'); } catch (e) {}
    return {
      active: chips.filter(c => c.classList.contains('active')).map(cat),
      checked: chips.filter(c => c.getAttribute('aria-checked') === 'true').map(cat),
      tabZero: chips.filter(c => c.getAttribute('tabindex') === '0').map(cat),
      activeElement: document.activeElement && document.activeElement.getAttribute
        ? document.activeElement.getAttribute('data-category')
        : null,
      cards: [...document.querySelectorAll('#resultsList .tree-card')].map(c => c.textContent.trim()),
      cardCount: [...document.querySelectorAll('#resultsList .tree-card')].length,
      category,
    };
  });

  const assertInvariant = (label, s, expected) => {
    assert.deepEqual(s.active, [expected], `${label}: active=${s.active.join(',') || '(none)'}`);
    assert.deepEqual(s.checked, [expected], `${label}: aria-checked=true=${s.checked.join(',') || '(none)'}`);
    assert.deepEqual(s.tabZero, [expected], `${label}: tabindex=0=${s.tabZero.join(',') || '(none)'}`);
    assert.equal(s.activeElement, expected, `${label}: focused chip=${s.activeElement}`);
  };

  const assertCards = (label, s, expectedCount, keyword) => {
    assert.equal(s.cardCount, expectedCount, `${label}: cardCount=${s.cardCount}`);
    if (keyword) {
      for (const text of s.cards) {
        assert.ok(text.includes(keyword), `${label}: card "${text.slice(0, 30)}" must include ${keyword}`);
      }
    }
  };

  const waitActive = (page, expected) => page.waitForFunction((exp) => {
    const act = [...document.querySelectorAll('.filter-row .tag-chip')].filter(c => c.classList.contains('active'));
    return act.length === 1 && act[0].getAttribute('data-category') === exp;
  }, expected, { timeout: 5000 });

  try {
    for (const vp of [
      { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
    ]) {
      const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await context.newPage();
      const health = { pageErrors: [], consoleErrors: [], sameOriginFailures: [], http4xx: [], stubbedApi: [], external: 0, unexpectedExternal: [] };
      const navigationFailureTracker = createSameOriginNavigationFailureTracker(
        page,
        `http://127.0.0.1:${port}`,
        health.sameOriginFailures
      );
      page.on('pageerror', (err) => health.pageErrors.push(String((err && err.message) || err)));
      page.on('console', (msg) => { if (msg.type() === 'error') health.consoleErrors.push(msg.text()); });
      page.on('response', (response) => {
        const url = response.url();
        if (url.startsWith(`http://127.0.0.1:${port}`) && response.status() >= 400) {
          health.http4xx.push(`${response.status()}: ${url}`);
        }
      });

      await page.route('**/*', makeHermeticRouteHandler({
        fixtureOrigin: `http://127.0.0.1:${port}`,
        onUnexpectedExternal: (url) => health.unexpectedExternal.push(url),
        onSameOrigin: async (route, target) => {
          const pathname = target.pathname;
          if (pathname === '/api/community/trees') {
            health.stubbedApi.push(pathname);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syntheticTrees) });
            return true;
          }
          if (pathname.startsWith('/api/')) {
            health.stubbedApi.push(pathname);
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
            return true;
          }
          return false;
        },
        fulfillExternal: async (route, target) => {
          health.external += 1;
          await defaultFulfillExternal(route, target);
        },
      }));

      await page.goto(`http://127.0.0.1:${port}/pages/search.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.querySelectorAll('#resultsList .tree-card').length >= 6,
        null,
        { timeout: 20000 }
      );

      const read = chipStateReader(page);

      // ── A. Initial radio-group semantics ──
      const s0 = await read();
      assert.equal(s0.activeElement, null, `${vp.name}: nothing focused initially`);
      assert.deepEqual(s0.active, ['전체'], `${vp.name}: initial active`);
      assert.deepEqual(s0.checked, ['전체'], `${vp.name}: initial aria-checked=true`);
      assert.deepEqual(s0.tabZero, ['전체'], `${vp.name}: initial tabindex=0`);
      assert.equal(s0.cardCount, 6, `${vp.name}: initial card count`);
      assert.equal(s0.category, null, `${vp.name}: initial URL category absent`);

      const markup = await page.evaluate(() => {
        const chips = [...document.querySelectorAll('.filter-row .tag-chip')];
        const row = document.querySelector('.filter-row');
        const rr = row.getBoundingClientRect();
        return {
          chipCount: chips.length,
          allButtons: chips.every(c => c.tagName === 'BUTTON'),
          allTypeButton: chips.every(c => c.getAttribute('type') === 'button'),
          allRoleRadio: chips.every(c => c.getAttribute('role') === 'radio'),
          rowRole: row.getAttribute('role'),
          rowLabel: row.getAttribute('aria-label'),
          categories: chips.map(c => c.getAttribute('data-category')),
          clipping: chips.map(c => {
            const r = c.getBoundingClientRect();
            return { cat: c.getAttribute('data-category'), left: r.left, right: r.right, rowLeft: rr.left, rowRight: rr.right };
          }),
        };
      });
      assert.equal(markup.chipCount, 4, `${vp.name}: chip count`);
      assert.equal(markup.allButtons, true, `${vp.name}: chips must be BUTTON`);
      assert.equal(markup.allTypeButton, true, `${vp.name}: chips must be type=button`);
      assert.equal(markup.allRoleRadio, true, `${vp.name}: chips must be role=radio`);
      assert.equal(markup.rowRole, 'radiogroup', `${vp.name}: filter-row role`);
      assert.equal(markup.rowLabel, '감상 보조 필터', `${vp.name}: filter-row label`);
      assert.deepEqual(markup.categories, ['전체', '입덕', '성장', '최애'], `${vp.name}: taxonomy`);
      for (const c of markup.clipping) {
        assert.ok(c.left >= c.rowLeft - 1, `${vp.name}: ${c.cat} not clipped left`);
        assert.ok(c.right <= c.rowRight + 1, `${vp.name}: ${c.cat} not clipped right`);
      }

      // ── B. Tab reaches the selected chip ──
      await page.click('#searchInput');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => {
        const el = document.activeElement;
        return el && el.classList && el.classList.contains('tag-chip');
      }, null, { timeout: 5000 });
      const tabCat = await page.evaluate(() =>
        document.activeElement && document.activeElement.getAttribute('data-category')
      );
      assert.equal(tabCat, '전체', `${vp.name}: Tab must land on the selected chip`);

      // ── C. focus() succeeds and focused chip stays inside viewport ──
      const focusInfo = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.filter-row .tag-chip')].find(c => c.getAttribute('data-category') === '성장');
        chip.focus();
        const r = chip.getBoundingClientRect();
        return { ok: document.activeElement === chip, cat: chip.getAttribute('data-category'), x: r.left, right: r.right, vw: window.innerWidth };
      });
      assert.equal(focusInfo.ok, true, `${vp.name}: focus() must succeed on a chip`);
      assert.equal(focusInfo.cat, '성장', `${vp.name}: focus() target`);
      assert.ok(focusInfo.x >= -1, `${vp.name}: focused chip left >= -1`);
      assert.ok(focusInfo.right <= focusInfo.vw + 1, `${vp.name}: focused chip right within viewport`);

      // ── D. ArrowLeft: previous (성장 -> 입덕) with full sync ──
      await page.keyboard.press('ArrowLeft');
      await waitActive(page, '입덕');
      const sD = await read();
      assertInvariant(`${vp.name} ArrowLeft->입덕`, sD, '입덕');
      assert.equal(sD.category, '입덕', `${vp.name}: ArrowLeft URL sync`);
      assertCards(`${vp.name} ArrowLeft->입덕`, sD, 2, '입덕 트리');

      // ── E. ArrowLeft prev (입덕 -> 전체) then wrap prev (전체 -> 최애) ──
      await page.keyboard.press('ArrowLeft');
      await waitActive(page, '전체');
      let sE = await read();
      assertInvariant(`${vp.name} ArrowLeft->전체`, sE, '전체');
      assert.equal(sE.cardCount, 6, `${vp.name}: 전체 cards`);
      await page.keyboard.press('ArrowLeft');
      await waitActive(page, '최애');
      sE = await read();
      assertInvariant(`${vp.name} ArrowLeft wrap->최애`, sE, '최애');
      assert.equal(sE.category, '최애', `${vp.name}: wrap URL sync`);
      assertCards(`${vp.name} ArrowLeft wrap->최애`, sE, 2, '최애 트리');

      // ── F. ArrowRight wrap (최애 -> 전체) ──
      await page.keyboard.press('ArrowRight');
      await waitActive(page, '전체');
      const sF = await read();
      assertInvariant(`${vp.name} ArrowRight wrap->전체`, sF, '전체');
      assert.equal(sF.cardCount, 6, `${vp.name}: wrap back to 전체`);

      // ── G. End / Home ──
      await page.keyboard.press('End');
      await waitActive(page, '최애');
      let sG = await read();
      assertInvariant(`${vp.name} End->최애`, sG, '최애');
      await page.keyboard.press('Home');
      await waitActive(page, '전체');
      sG = await read();
      assertInvariant(`${vp.name} Home->전체`, sG, '전체');

      // ── H. ArrowDown / ArrowUp ──
      await page.keyboard.press('ArrowDown');
      await waitActive(page, '입덕');
      let sH = await read();
      assertInvariant(`${vp.name} ArrowDown->입덕`, sH, '입덕');
      await page.keyboard.press('ArrowUp');
      await waitActive(page, '전체');
      sH = await read();
      assertInvariant(`${vp.name} ArrowUp->전체`, sH, '전체');

      // ── I. Enter activation (native button click, single activation) ──
      const enterCat = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.filter-row .tag-chip')].find(c => c.getAttribute('data-category') === '성장');
        chip.focus();
        return chip.getAttribute('data-category');
      });
      assert.equal(enterCat, '성장', `${vp.name}: Enter focus target`);
      await page.keyboard.press('Enter');
      await waitActive(page, '성장');
      let sI = await read();
      assertInvariant(`${vp.name} Enter->성장`, sI, '성장');
      assert.equal(sI.category, '성장', `${vp.name}: Enter URL sync`);
      assertCards(`${vp.name} Enter->성장`, sI, 2, '성장 트리');
      await page.keyboard.press('Enter');
      await waitActive(page, '성장');
      sI = await read();
      assertInvariant(`${vp.name} Enter again (no toggle)`, sI, '성장');
      assert.equal(sI.cardCount, 2, `${vp.name}: Enter double activation 0`);

      // ── J. Space activation (native button click, single activation) ──
      const spaceCat = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.filter-row .tag-chip')].find(c => c.getAttribute('data-category') === '최애');
        chip.focus();
        return chip.getAttribute('data-category');
      });
      assert.equal(spaceCat, '최애', `${vp.name}: Space focus target`);
      await page.keyboard.press('Space');
      await waitActive(page, '최애');
      let sJ = await read();
      assertInvariant(`${vp.name} Space->최애`, sJ, '최애');
      assert.equal(sJ.category, '최애', `${vp.name}: Space URL sync`);
      assertCards(`${vp.name} Space->최애`, sJ, 2, '최애 트리');
      await page.keyboard.press('Space');
      await waitActive(page, '최애');
      sJ = await read();
      assertInvariant(`${vp.name} Space again (no toggle)`, sJ, '최애');
      assert.equal(sJ.cardCount, 2, `${vp.name}: Space double activation 0`);

      // ── K. Final single-selection invariant + browser health ──
      const finalState = await read();
      assert.equal(finalState.active.length, 1, `${vp.name}: exactly one active`);
      assert.equal(finalState.checked.length, 1, `${vp.name}: exactly one aria-checked=true`);
      assert.equal(finalState.tabZero.length, 1, `${vp.name}: exactly one tabindex=0`);

      assert.ok(health.stubbedApi.length >= 1, `${vp.name}: deterministic API stub used`);
      assert.equal(health.pageErrors.length, 0, `${vp.name}: pageerrors ${health.pageErrors.join(' | ')}`);
      assert.equal(health.consoleErrors.length, 0, `${vp.name}: console errors ${health.consoleErrors.join(' | ')}`);
      assert.equal(health.sameOriginFailures.length, 0, `${vp.name}: same-origin failures ${health.sameOriginFailures.join(' | ')}`);
      assert.equal(health.http4xx.length, 0, `${vp.name}: HTTP>=400 ${health.http4xx.join(' | ')}`);
      assert.equal(health.unexpectedExternal.length, 0, `${vp.name}: unexpected external ${health.unexpectedExternal.join(' | ')}`);

      // ── L. Initial invalid URL fails closed to 전체 ──
      health.pageErrors.length = 0;
      health.consoleErrors.length = 0;
      health.sameOriginFailures.length = 0;
      health.http4xx.length = 0;
      health.stubbedApi.length = 0;
      health.external = 0;
      // Issue #3899: Space-key activation earlier in this test sets the
      // scroll-load intent, and the scroll-load sentinel sits inside the
      // viewport, so loadMorePublicTrees keeps starting limit=16 fetches.
      // One of those can fire in the gap between beginIntentionalNavigation()
      // and page.goto() and be cancelled by the intentional navigation. That
      // is a legitimate post-snapshot abort per the tracker contract, so the
      // harness disables the scroll-load sentinel gate for the navigation
      // window. Keyboard accessibility assertions are unaffected.
      await page.evaluate(() => {
        if (window.LoveBudSearchScrollLoad && typeof window.LoveBudSearchScrollLoad.isSentinelNearViewport === 'function') {
          window.LoveBudSearchScrollLoad.isSentinelNearViewport = function () { return false; };
        }
      });
      navigationFailureTracker.beginIntentionalNavigation();
      try {
        await page.goto(`http://127.0.0.1:${port}/pages/search.html?category=__invalid_category__`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => {
          const chips = [...document.querySelectorAll('.filter-row .tag-chip')];
          const act = chips.filter(c => c.classList.contains('active'));
          let category = null;
          try { category = new URLSearchParams(window.location.search).get('category'); } catch (e) {}
          return document.querySelectorAll('#resultsList .tree-card').length >= 6
            && act.length === 1
            && act[0].getAttribute('data-category') === '전체'
            && category === null;
        }, null, { timeout: 20000 });
      } finally {
        navigationFailureTracker.endIntentionalNavigation();
      }
      const sL = await read();
      assert.deepEqual(sL.active, ['전체'], `${vp.name}: L initial-invalid active`);
      assert.deepEqual(sL.checked, ['전체'], `${vp.name}: L initial-invalid checked`);
      assert.deepEqual(sL.tabZero, ['전체'], `${vp.name}: L initial-invalid tabindex`);
      assert.equal(sL.cardCount, 6, `${vp.name}: L initial-invalid default results`);
      assert.equal(sL.category, null, `${vp.name}: L initial-invalid category removed from URL`);
      assert.equal(health.pageErrors.length, 0, `${vp.name}: L pageerrors ${health.pageErrors.join(' | ')}`);
      assert.equal(health.consoleErrors.length, 0, `${vp.name}: L console errors ${health.consoleErrors.join(' | ')}`);
      assert.equal(health.sameOriginFailures.length, 0, `${vp.name}: L same-origin failures ${health.sameOriginFailures.join(' | ')}`);
      assert.equal(health.http4xx.length, 0, `${vp.name}: L HTTP>=400 ${health.http4xx.join(' | ')}`);

      // ── M. Invalid popstate restore fails closed to 전체 ──
      health.pageErrors.length = 0;
      health.consoleErrors.length = 0;
      health.sameOriginFailures.length = 0;
      health.http4xx.length = 0;
      await page.evaluate(() => {
        const invalidUrl = window.location.pathname + '?category=__invalid_category__';
        history.pushState(null, '', invalidUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForFunction(() => {
        const chips = [...document.querySelectorAll('.filter-row .tag-chip')];
        const act = chips.filter(c => c.classList.contains('active'));
        let category = null;
        try { category = new URLSearchParams(window.location.search).get('category'); } catch (e) {}
        return document.querySelectorAll('#resultsList .tree-card').length >= 6
          && act.length === 1
          && act[0].getAttribute('data-category') === '전체'
          && category === null;
      }, null, { timeout: 10000 });
      const sM = await read();
      assert.deepEqual(sM.active, ['전체'], `${vp.name}: M popstate-invalid active`);
      assert.deepEqual(sM.checked, ['전체'], `${vp.name}: M popstate-invalid checked`);
      assert.deepEqual(sM.tabZero, ['전체'], `${vp.name}: M popstate-invalid tabindex`);
      assert.equal(sM.cardCount, 6, `${vp.name}: M popstate-invalid default results restored`);
      assert.equal(sM.category, null, `${vp.name}: M popstate-invalid category removed`);
      const focusInvariantM = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.filter-row .tag-chip')].find(c => c.getAttribute('data-category') === '전체');
        chip.focus();
        return document.activeElement === chip;
      });
      assert.equal(focusInvariantM, true, `${vp.name}: M chip focus/keyboard invariant maintained`);
      assert.equal(health.pageErrors.length, 0, `${vp.name}: M pageerrors ${health.pageErrors.join(' | ')}`);
      assert.equal(health.consoleErrors.length, 0, `${vp.name}: M console errors ${health.consoleErrors.join(' | ')}`);
      assert.equal(health.sameOriginFailures.length, 0, `${vp.name}: M same-origin failures ${health.sameOriginFailures.join(' | ')}`);
      assert.equal(health.http4xx.length, 0, `${vp.name}: M HTTP>=400 ${health.http4xx.join(' | ')}`);

      navigationFailureTracker.dispose();
      await context.close();
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ---------------------------------------------------------------------------
// Group: Browse real-page structural baseline (#3863)
//
// Loads the ACTUAL repository /pages/search.html (never /fixture-browse.html)
// through the same local server, so every same-origin repository asset
// (CSS/JS) is fetched over the real server chain. Everything else is stubbed
// deterministically by the harness — never by production code:
//   * external origins (Google Fonts, Firebase SDK on gstatic) receive
//     fulfilled stub responses, so there is no real external network
//     dependency and no authenticated session is ever created;
//   * the same-origin /api/community/trees feed is fulfilled with fixed
//     synthetic public trees (deterministic title/stage/count), and every
//     other /api/* request is fulfilled with an empty JSON array.
// Intentionally stubbed requests are aggregated separately and are never
// counted as product failures or presented as real network success.
// ---------------------------------------------------------------------------
const BASELINE_SYNTHETIC_TREES = [
  { id: 'baseline-1', title: '기준 트리 하나', visibility: 'public', stage: '입덕', memoryCount: 3, theme: 'first moments', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'baseline-2', title: '기준 트리 둘', visibility: 'public', stage: '성장', memoryCount: 5, theme: 'growing', createdAt: '2026-01-02T00:00:00Z' },
  { id: 'baseline-3', title: '기준 트리 셋', visibility: 'public', stage: '최애', memoryCount: 7, theme: 'deep love', createdAt: '2026-01-03T00:00:00Z' },
];

const BASELINE_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

async function newRealBrowsePage(browser, vp, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'no-preference',
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const sameOriginFailures = [];
  const http4xx = [];
  const stubbed = { apiTrees: 0, apiOther: 0, external: 0 };
  const sameOriginApiRequests = [];
  const sameOriginRequests = [];
  const unexpectedExternal = [];
  page.on('request', (request) => {
    let u;
    try {
      u = new URL(request.url());
    } catch (e) {
      return;
    }
    if (u.hostname !== '127.0.0.1') return;
    const entry = { method: request.method(), pathname: u.pathname };
    sameOriginRequests.push(entry);
    if (u.pathname.startsWith('/api/')) {
      sameOriginApiRequests.push(entry);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (req) => {
    try {
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') {
        sameOriginFailures.push(req.url() + ' :: ' + ((req.failure() && req.failure().errorText) || 'unknown'));
      }
    } catch (e) { /* ignore */ }
  });
  page.on('response', (r) => {
    try {
      const u = new URL(r.url());
      if (u.hostname === '127.0.0.1' && r.status() >= 400) {
        http4xx.push(r.status() + ' ' + r.url());
      }
    } catch (e) { /* ignore */ }
  });
  await page.route('**/*', makeHermeticRouteHandler({
    fixtureOrigin: baseUrl,
    onUnexpectedExternal: (url) => unexpectedExternal.push(url),
    onSameOrigin: async (route, target) => {
      const pathname = target.pathname;
      if (pathname === '/api/community/trees') {
        stubbed.apiTrees += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BASELINE_SYNTHETIC_TREES) });
        return true;
      }
      if (pathname.startsWith('/api/')) {
        stubbed.apiOther += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return true;
      }
      return false;
    },
    fulfillExternal: async (route, target) => {
      // Zero real external network: every known external request is stubbed.
      stubbed.external += 1;
      await defaultFulfillExternal(route, target);
    },
  }));
  await page.goto(baseUrl + '/pages/search.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  return { context, page, pageErrors, consoleErrors, sameOriginFailures, http4xx, stubbed, sameOriginApiRequests, sameOriginRequests, unexpectedExternal };
}

async function teardownRealBrowse(env) {
  try { await env.context.close(); } catch (e) { /* ignore */ }
}

async function captureBrowseBaseline(page) {
  return page.evaluate(() => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, visible, display: cs.display, hiddenAttr: el.hasAttribute('hidden') };
    };
    const region = (sel) => rectOf(document.querySelector(sel));
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const accessibleName = (el) => {
      if (!el) return '';
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const ref = document.getElementById(labelledby);
        if (ref) return (ref.textContent || '').trim();
      }
      if (el.labels && el.labels.length) return (el.labels[0].textContent || '').trim();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
      }
      if (el.getAttribute('title')) return el.getAttribute('title').trim();
      return (el.textContent || '').trim();
    };
    const chips = Array.from(document.querySelectorAll('.filter-row .tag-chip')).map((c) => {
      const r = c.getBoundingClientRect();
      return {
        category: c.getAttribute('data-category'),
        text: (c.textContent || '').trim(),
        r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
        visible: r.width > 0 && r.height > 0,
      };
    });
    const cards = Array.from(document.querySelectorAll('#resultsList .tree-card'))
      .filter((c) => c.getAttribute('data-tree-id'))
      .map((c) => {
        const r = c.getBoundingClientRect();
        return {
          id: c.getAttribute('data-tree-id'),
          title: ((c.querySelector('.tree-title') || {}).textContent || '').trim(),
          r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
          visible: r.width > 0 && r.height > 0,
        };
      });
    const viewButtons = Array.from(document.querySelectorAll('#browseViewModeMount .tree-view-mode-btn')).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        mode: b.getAttribute('data-mode'),
        label: b.getAttribute('aria-label'),
        checked: b.getAttribute('aria-checked'),
        r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
        visible: r.width > 0 && r.height > 0,
      };
    });
    const sortSelect = document.querySelector('#browseSortSelect');
    const inputEl = document.querySelector('#searchInput');
    const inputRect = rectOf(inputEl);
    const sortRect = rectOf(sortSelect);
    const firstCard = cards.length ? cards[0] : null;
    const controls = [
      { name: 'searchInput', r: inputRect },
      { name: 'sortSelect', r: sortRect },
      ...viewButtons.map((b, i) => ({ name: 'viewModeBtn' + i, r: b.r })),
      ...chips.map((c, i) => ({ name: 'chip' + i, r: c.r })),
    ];
    return {
      identity: {
        title: document.title,
        pathname: window.location.pathname,
        lang: document.documentElement.lang,
        hasEyebrowContainer: !!document.querySelector('.search-panel-eyebrow'),
        hasEyebrowKey: !!document.querySelector('.search-panel-header [data-i18n="search.eyebrow"]'),
        eyebrowText: ((document.querySelector('.search-panel-header [data-i18n="search.eyebrow"]') || {}).textContent || '').trim(),
        hasTitle: !!document.querySelector('.search-panel-header h1[data-i18n="search.title"]'),
        titleText: ((document.querySelector('.search-panel-header h1[data-i18n="search.title"]') || {}).textContent || '').trim(),
        hasSubtitle: !!document.querySelector('.search-panel-header p[data-i18n="search.subtitle"]'),
        subtitleText: ((document.querySelector('.search-panel-header p[data-i18n="search.subtitle"]') || {}).textContent || '').trim(),
        bodyText: (document.body.textContent || ''),
      },
      regions: {
        sharedHeader: region('#shared-header'),
        panelHeader: region('.search-panel-header'),
        searchInput: inputRect,
        filterRow: region('.filter-row'),
        resultsHead: region('.browse-results-head'),
        sortControls: region('#browseSortControls'),
        viewModeMount: region('#browseViewModeMount'),
        ownerCtaSlot: region('.browse-results-owner-cta-slot'),
        resultsList: region('#resultsList'),
        rightRail: region('.lovetree-calm-right-rail'),
        loadingStatus: region('#browseLoadingStatus'),
      },
      chips,
      cards,
      viewButtons,
      sortSelectInfo: sortSelect
        ? { tag: sortSelect.tagName, id: sortSelect.id, label: sortSelect.getAttribute('aria-label'), name: accessibleName(sortSelect) }
        : null,
      searchInputName: accessibleName(inputEl),
      firstViewButtonName: viewButtons.length
        ? accessibleName(document.querySelector('#browseViewModeMount .tree-view-mode-btn'))
        : '',
      firstChipName: chips.length ? accessibleName(document.querySelector('.filter-row .tag-chip')) : '',
      order: {
        header: region('#shared-header') && region('#shared-header').y,
        panel: region('.search-panel-header') && region('.search-panel-header').y,
        utility: region('.browse-utility-row') && region('.browse-utility-row').y,
        resultsHead: region('.browse-results-head') && region('.browse-results-head').y,
        list: region('#resultsList') && region('#resultsList').y,
      },
      domOrder: (() => {
        const precedes = (first, second) => {
          if (!first || !second) return false;
          return Boolean(
            first.compareDocumentPosition(second) &
              Node.DOCUMENT_POSITION_FOLLOWING
          );
        };
        const header = document.querySelector('#shared-header');
        const panel = document.querySelector('.search-panel-header');
        const utility = document.querySelector('.browse-utility-row');
        const resultsHead = document.querySelector('.browse-results-head');
        const list = document.querySelector('#resultsList');
        return {
          headerPrecedesPanel: precedes(header, panel),
          panelPrecedesUtility: precedes(panel, utility),
          panelPrecedesResultsHead: precedes(panel, resultsHead),
          panelPrecedesList: precedes(panel, list),
          utilityPrecedesResultsHead: precedes(utility, resultsHead),
          resultsHeadPrecedesList: precedes(resultsHead, list),
        };
      })(),
      overlaps: {
        listRail: overlapArea(region('#resultsList'), region('.lovetree-calm-right-rail')),
        mainRail: overlapArea(region('.lovetree-calm-main-column'), region('.lovetree-calm-right-rail')),
        headFirstCard: firstCard ? overlapArea(region('.browse-results-head'), firstCard.r) : 0,
        controlsFirstCard: firstCard ? controls.map((c) => ({ name: c.name, area: overlapArea(c.r, firstCard.r) })) : [],
      },
      overflow: {
        html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      },
      viewportWidth: window.innerWidth,
      storageKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
    };
  });
}

async function captureBrowseFocus(page) {
  return page.evaluate(() => {
    const accessibleName = (el) => {
      if (!el) return '';
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const ref = document.getElementById(labelledby);
        if (ref) return (ref.textContent || '').trim();
      }
      if (el.labels && el.labels.length) return (el.labels[0].textContent || '').trim();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
      }
      if (el.getAttribute('title')) return el.getAttribute('title').trim();
      return (el.textContent || '').trim();
    };
    const probe = (el) => {
      if (!el) return { ok: false, name: '', left: 0, right: 0, vw: window.innerWidth };
      let ok = false;
      try {
        el.focus();
        ok = document.activeElement === el;
      } catch (e) { /* not focusable */ }
      const r = el.getBoundingClientRect();
      return { ok, name: accessibleName(el), left: r.left, right: r.right, vw: window.innerWidth };
    };
    return {
      searchInput: probe(document.querySelector('#searchInput')),
      sortSelect: probe(document.querySelector('#browseSortSelect')),
      viewModeBtn: probe(document.querySelector('#browseViewModeMount .tree-view-mode-btn')),
      chip: probe(document.querySelector('.filter-row .tag-chip')),
    };
  });
}

test('Browse real-page structural baseline', { timeout: 120000 }, async (t) => {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await closeServer(server);
  });

  for (const vp of BASELINE_VIEWPORTS) {
    await t.test(`viewport ${vp.name} (${vp.width}x${vp.height})`, async (t) => {
      const browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
      t.after(async () => {
        await browser.close();
      });

      const env = await newRealBrowsePage(browser, vp, baseUrl);
      try {
        const { page, pageErrors, consoleErrors, sameOriginFailures, http4xx, stubbed, sameOriginApiRequests, sameOriginRequests, unexpectedExternal } = env;

        // Deterministic readiness: the real API feed is stubbed and the page
        // has rendered at least one real (non-skeleton) tree card.
        await page.waitForFunction(() => {
          return Array.from(document.querySelectorAll('#resultsList .tree-card'))
            .some((c) => c.getAttribute('data-tree-id'));
        }, null, { timeout: 20000 });

        const snap = await captureBrowseBaseline(page);
        const focus = await captureBrowseFocus(page);

        await t.test('A. real-page identity', () => {
          assert.equal(snap.identity.pathname, '/pages/search.html', 'must inspect the real repository /pages/search.html, not the fixture');
          assert.equal(snap.identity.title, '러브트리 둘러보기 | 러브트리', 'real Browse document title');
          assert.equal(snap.identity.lang, 'ko', 'real Browse document lang');
          assert.equal(snap.identity.hasEyebrowContainer, true, '.search-panel-eyebrow region present');
          assert.equal(snap.identity.hasEyebrowKey, true, '[data-i18n="search.eyebrow"] present inside the panel header');
          assert.equal(snap.identity.hasTitle, true, '.search-panel-header h1[data-i18n="search.title"] present');
          assert.equal(snap.identity.hasSubtitle, true, '.search-panel-header p[data-i18n="search.subtitle"] present');
          assert.ok(snap.identity.eyebrowText.length > 0, 'visible eyebrow text non-empty');
          assert.ok(snap.identity.titleText.length > 0, 'visible title text non-empty');
          assert.ok(snap.identity.subtitleText.length > 0, 'visible subtitle text non-empty');
          assert.notEqual(snap.identity.title, 'Browse Compact Tree', 'real document title is not the fixture title');
          assert.ok(!snap.identity.bodyText.includes('Browse Compact Tree'), 'fixture-only browse card copy absent');
          assert.ok(!snap.identity.bodyText.includes('Home Modal Test Fixture'), 'fixture-only home copy absent');
        });

        await t.test('B. public-route boundary', () => {
          const owner = snap.regions.ownerCtaSlot;
          assert.ok(owner, 'owner CTA slot region present');
          assert.equal(owner.hiddenAttr, true, 'owner CTA slot hidden on public baseline');
          assert.equal(owner.display, 'none', 'owner CTA slot display none on public baseline');
          const authLike = (k) => /auth|firebase|token|session|user/i.test(k);
          assert.deepEqual(snap.storageKeys.filter(authLike), [], 'no authenticated fixture/session in localStorage');
          assert.deepEqual(snap.sessionKeys.filter(authLike), [], 'no authenticated fixture/session in sessionStorage');
          assert.equal(snap.identity.pathname, '/pages/search.html', 'no login/page navigation from Browse');
        });

        await t.test('C. required regions present', () => {
          const required = [
            'sharedHeader', 'panelHeader', 'searchInput', 'filterRow', 'resultsHead',
            'sortControls', 'viewModeMount', 'ownerCtaSlot', 'resultsList', 'rightRail', 'loadingStatus',
          ];
          for (const name of required) {
            assert.ok(snap.regions[name], `required region ${name} present`);
          }
          assert.ok(snap.chips.length >= 1, `at least 1 visible filter chip, got ${snap.chips.length}`);
          assert.ok(snap.cards.length >= 1, `at least 1 real tree card, got ${snap.cards.length}`);
          assert.ok(snap.viewButtons.length >= 1, 'view-mode control buttons present');
          assert.ok(snap.sortSelectInfo, 'browse sort select present');
        });

        await t.test('D. region geometry positive and in-bounds', () => {
          const vw = snap.viewportWidth;
          const checkVisibleRegion = (name, r) => {
            assert.ok(r, `${name} rect exists`);
            assert.equal(r.visible, true, `${name} visible`);
            assert.ok(r.w > 0 && r.h > 0, `${name} positive geometry`);
            assert.ok(r.x >= -1, `${name} left >= -1 (x=${r.x})`);
            assert.ok(r.right <= vw + 1, `${name} right within viewport (right=${r.right}, vw=${vw})`);
          };
          checkVisibleRegion('shared header', snap.regions.sharedHeader);
          checkVisibleRegion('search panel header', snap.regions.panelHeader);
          checkVisibleRegion('search input', snap.regions.searchInput);
          checkVisibleRegion('filter row', snap.regions.filterRow);
          for (const chip of snap.chips) {
            assert.equal(chip.visible, true, `chip ${chip.category} visible`);
            assert.ok(chip.r.w > 0 && chip.r.h > 0, `chip ${chip.category} positive geometry`);
            assert.ok(chip.r.x >= -1 && chip.r.right <= vw + 1, `chip ${chip.category} in horizontal bounds`);
          }
          checkVisibleRegion('results header', snap.regions.resultsHead);
          checkVisibleRegion('sort controls', snap.regions.sortControls);
          checkVisibleRegion('view-mode controls', snap.regions.viewModeMount);
          checkVisibleRegion('results list', snap.regions.resultsList);
          for (const card of snap.cards) {
            assert.equal(card.visible, true, `card ${card.id} visible`);
            assert.ok(card.r.w > 0 && card.r.h > 0, `card ${card.id} positive geometry`);
            assert.ok(card.r.x >= -1 && card.r.right <= vw + 1, `card ${card.id} in horizontal bounds`);
          }
          // Right rail geometry applies only where the rail is actually visible.
          if (snap.regions.rightRail && snap.regions.rightRail.visible) {
            checkVisibleRegion('right rail', snap.regions.rightRail);
          }
          assert.ok(snap.regions.loadingStatus, 'loading status region present (hidden after successful load)');
        });

        await t.test('E. focus and accessible names', () => {
          const assertControl = (label, info) => {
            assert.equal(info.ok, true, `${label} focus() succeeds and becomes activeElement`);
            assert.ok(info.name.length > 0, `${label} accessible name non-empty`);
            assert.ok(info.left >= -1, `${label} left >= -1 (x=${info.left})`);
            assert.ok(info.right <= info.vw + 1, `${label} right within viewport (right=${info.right}, vw=${info.vw})`);
          };
          assertControl('search input (#searchInput)', focus.searchInput);
          assertControl('sort control (#browseSortSelect)', focus.sortSelect);
          assertControl('view-mode control', focus.viewModeBtn);
          assertControl('filter chip', focus.chip);
          assert.ok(snap.searchInputName.length > 0, 'search input accessible name from page snapshot non-empty');
          assert.equal(snap.sortSelectInfo.label, '정렬 기준', 'sort select aria-label preserved');
        });

        await t.test('F. result/card structure', () => {
          assert.equal(snap.regions.resultsList.visible, true, '#resultsList visible');
          assert.ok(snap.cards.length >= 1, `at least 1 visible real .tree-card, got ${snap.cards.length}`);
          for (const card of snap.cards) {
            assert.ok(card.r.w > 0 && card.r.h > 0, `card ${card.id} width/height positive (${card.r.w}x${card.r.h})`);
            assert.ok(card.r.x >= -1 && card.r.right <= snap.viewportWidth + 1, `card ${card.id} inside horizontal bounds`);
          }
          assert.ok(snap.regions.resultsHead.visible && snap.regions.resultsHead.w > 0 && snap.regions.resultsHead.h > 0, 'results header positive geometry');
          assert.ok(snap.regions.resultsList.w > 0 && snap.regions.resultsList.h > 0, 'results list positive geometry');
        });

        await t.test('G. reading order and overlap', () => {
          const o = snap.order;
          const dom = snap.domOrder;
          if (vp.name === 'desktop') {
            assert.ok(o.panel < o.utility, `search panel header < utility controls (${o.panel} < ${o.utility})`);
            assert.ok(o.utility < o.resultsHead, `utility controls < results header (${o.utility} < ${o.resultsHead})`);
            assert.ok(o.resultsHead < o.list, `results header < results list (${o.resultsHead} < ${o.list})`);
            assert.equal(dom.panelPrecedesUtility, true, '.search-panel-header must precede .browse-utility-row in DOM order');
            assert.equal(dom.panelPrecedesResultsHead, true, '.search-panel-header must precede .browse-results-head in DOM order');
            assert.equal(dom.panelPrecedesList, true, '.search-panel-header must precede #resultsList in DOM order');
            assert.equal(dom.utilityPrecedesResultsHead, true, '.browse-utility-row must precede .browse-results-head in DOM order');
            assert.equal(dom.resultsHeadPrecedesList, true, '.browse-results-head must precede #resultsList in DOM order');
            assert.ok(snap.overlaps.listRail <= 1, `main results / visible right rail material overlap ~0, got ${snap.overlaps.listRail}`);
            assert.ok(snap.overlaps.mainRail <= 1, `main column / right rail overlap ~0, got ${snap.overlaps.mainRail}`);
            assert.ok(snap.overlaps.headFirstCard <= 1, `results header / first card overlap ~0, got ${snap.overlaps.headFirstCard}`);
          } else {
            assert.ok(o.header < o.panel, `header < title (${o.header} < ${o.panel})`);
            assert.ok(o.panel < o.utility, `title < search input / filter controls (${o.panel} < ${o.utility})`);
            assert.ok(o.utility < o.resultsHead, `search input / filter controls < results header (${o.utility} < ${o.resultsHead})`);
            assert.ok(o.resultsHead < o.list, `results header < results list (${o.resultsHead} < ${o.list})`);
            assert.equal(dom.headerPrecedesPanel, true, '#shared-header must precede .search-panel-header in DOM order');
            assert.equal(dom.panelPrecedesUtility, true, '.search-panel-header must precede .browse-utility-row in DOM order');
            assert.equal(dom.utilityPrecedesResultsHead, true, '.browse-utility-row must precede .browse-results-head in DOM order');
            assert.equal(dom.resultsHeadPrecedesList, true, '.browse-results-head must precede #resultsList in DOM order');
            const badOverlap = snap.overlaps.controlsFirstCard.filter((c) => c.area > 1);
            assert.deepEqual(badOverlap, [], `visible controls vs first card overlap ~0, got ${JSON.stringify(badOverlap)}`);
            const rail = snap.regions.rightRail;
            if (rail && rail.visible) {
              assert.ok(snap.overlaps.listRail <= 1, `mobile right rail must not cover main results, got ${snap.overlaps.listRail}`);
            } else {
              assert.equal(rail.visible, false, 'mobile right rail is collapsed (hidden)');
              assert.equal(snap.overlaps.listRail, 0, 'collapsed mobile right rail cannot cover main results');
            }
          }
        });

        await t.test('H. overflow and browser health', () => {
          assert.ok(snap.overflow.html <= 1, `documentElement horizontal overflow ~0, got ${snap.overflow.html}`);
          assert.ok(snap.overflow.body <= 1, `body horizontal overflow ~0, got ${snap.overflow.body}`);
          assert.strictEqual(pageErrors.length, 0, `pageerror zero, got: ${pageErrors.join(', ')}`);
          assert.strictEqual(consoleErrors.length, 0, `unexpected console error zero, got: ${consoleErrors.join(', ')}`);
          assert.strictEqual(sameOriginFailures.length, 0, `same-origin request failure zero, got: ${sameOriginFailures.join(', ')}`);
          assert.strictEqual(http4xx.length, 0, `same-origin HTTP>=400 zero, got: ${http4xx.join(', ')}`);
          // Deterministic data boundary: the synthetic public trees feed was
          // used. Stubbed traffic is aggregated separately and is never
          // presented as real network success.
          assert.ok(stubbed.apiTrees >= 1, `deterministic /api/community/trees stub used (${stubbed.apiTrees} fulfillment)`);
          assert.ok(stubbed.external >= 1, `external requests all stubbed (${stubbed.external} fulfilled, 0 real external network)`);
          assert.deepEqual(unexpectedExternal, [], `no unexpected external origin escape, got: ${JSON.stringify(unexpectedExternal)}`);
        });

        await t.test('I. public-route API request allowlist', () => {
          // Exact positive allowlist: the public Browse page may call only the
          // public community trees feed over the same-origin API boundary.
          const requestSet = Array.from(
            new Set(sameOriginApiRequests.map(({ method, pathname }) => `${method} ${pathname}`))
          ).sort();
          assert.deepEqual(
            requestSet,
            ['GET /api/community/trees'],
            `same-origin API request set must be exactly GET /api/community/trees, got: ${JSON.stringify(requestSet)}`
          );
          // No other /api/* request may have been stubbed with an empty body.
          assert.equal(stubbed.apiOther, 0, `non-tree /api/* stub fulfillments must be 0, got ${stubbed.apiOther}`);

          // Prohibited-category assertion across every same-origin request
          // (auth/login/session/user/private routes must never be touched).
          const forbiddenPathname = (pathname) => {
            const forbiddenPrefixes = ['/api/auth', '/api/login', '/api/session', '/api/user', '/modal/private'];
            return forbiddenPrefixes.some(
              (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
            );
          };
          const forbiddenRequests = sameOriginRequests.filter(({ pathname }) => forbiddenPathname(pathname));
          assert.deepEqual(
            forbiddenRequests,
            [],
            `no auth/login/session/private/owner-profile same-origin request, got: ${JSON.stringify(forbiddenRequests)}`
          );
        });
      } finally {
        await teardownRealBrowse(env);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Group: My Trees real-page structural baseline (#3888) + mobile view-mode
// bounds (#3892)
//
// Loads the ACTUAL repository /pages/my-trees.html (never /fixture-mytrees.html)
// through the same local server, so every same-origin repository asset
// (CSS/JS) is fetched over the real server chain. Firebase SDK transport is
// replaced with a controlled local fixture so a token-less synthetic
// authenticated identity renders the owner page without any real network:
//   * external origins (Google Fonts, Firebase SDK on gstatic) receive
//     fulfilled stub responses, so there is no real external network
//     dependency and no authenticated session is ever created;
//   * the same-origin /api/trees feed is fulfilled with a fixed synthetic
//     owner tree, /api/trees/mt-tree-3888-1 with its detail, and
//     /api/memories with its moments; every other /api/* request is
//     fulfilled with an empty JSON array.
// The synthetic user exposes token methods that resolve to null so the real
// auth/bootstrap boundary resolves a confirmed session without ever attaching
// an Authorization header or writing a token record.
// ---------------------------------------------------------------------------
const MY_TREES_SYNTHETIC_USER_BASE = {
  uid: 'mt-owner-3888',
  displayName: 'Synthetic My Trees Owner',
  email: 'synthetic-owner-3888@local.invalid'
};

const MY_TREES_SYNTHETIC_TREE = {
  id: 'mt-tree-3888-1',
  title: '기준 러브트리 하나',
  visibility: 'public',
  stage: '입덕',
  memoryCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  memories: [
    {
      id: 'mt-memory-3888-1',
      title: '첫 순간',
      memo: '기준 첫 순간 기록',
      createdAt: '2026-01-01T00:00:00Z',
      thumbnail: '',
      sourceUrl: ''
    }
  ]
};

const MY_TREES_TREE_DETAIL = Object.assign({}, MY_TREES_SYNTHETIC_TREE, {
  memories: MY_TREES_SYNTHETIC_TREE.memories.slice()
});
const MY_TREES_MEMORIES = MY_TREES_SYNTHETIC_TREE.memories.slice();

const MY_TREES_VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 844, isMobile: true },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },
  { name: 'mobile-414', width: 414, height: 896, isMobile: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
];

function myTreesAuthFixtureScript(payload) {
  const baseUser = payload.user;
  // Token methods resolve to null: the real auth/bootstrap boundary marks the
  // confirmed session ready without ever producing a usable Authorization
  // header or persisting a token record.
  const fixtureUser = Object.assign({}, baseUser, {
    photoURL: null,
    providerData: [],
    getIdToken: function () {
      return Promise.resolve(null);
    },
    getIdTokenResult: function () {
      return Promise.resolve({ token: null, expirationTime: Date.now() });
    }
  });
  localStorage.setItem('lovebud_lang', payload.lang);
  localStorage.setItem('lovebud_auth_confirmed', 'true');
  localStorage.setItem('lovebud_auth_cache', JSON.stringify(baseUser));

  const authInstance = {
    currentUser: fixtureUser,
    onAuthStateChanged: function (callback) {
      Promise.resolve().then(function () {
        callback(fixtureUser);
      });
      return function () {};
    },
    signOut: function () {
      return Promise.resolve();
    },
    setPersistence: function () {
      return Promise.resolve();
    },
    getRedirectResult: function () {
      return Promise.resolve({ user: null });
    }
  };
  function auth() {
    return authInstance;
  }
  auth.Auth = { Persistence: { LOCAL: 'local' } };
  window.firebase = {
    apps: [{}],
    auth: auth,
    initializeApp: function () {
      return {};
    }
  };

  window.LoveBudProtectedRoute = {
    getAuthState: function () {
      return { ready: true, user: fixtureUser };
    },
    getAuthenticatedUser: function () {
      return fixtureUser;
    },
    requireAuthenticatedPage: function (options) {
      if (options && typeof options.onAuthenticated === 'function') {
        options.onAuthenticated(fixtureUser);
      }
    }
  };
}

async function newRealMyTreesPage(browser, vp, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'no-preference',
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const sameOriginFailures = [];
  const http4xx = [];
  const stubbed = { apiTrees: 0, apiDetail: 0, apiMemories: 0, apiOther: 0, external: 0 };
  const sameOriginApiRequests = [];
  const sameOriginRequests = [];
  const unexpectedExternal = [];
  page.on('request', (request) => {
    let u;
    try {
      u = new URL(request.url());
    } catch (e) {
      return;
    }
    if (u.hostname !== '127.0.0.1') return;
    const headers = request.headers() || {};
    const hasAuthorization = Object.keys(headers).some((k) => String(k).toLowerCase() === 'authorization');
    const queryParams = Array.from(new URLSearchParams(u.search).entries())
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('&');
    const entry = {
      method: request.method(),
      pathname: u.pathname,
      query: queryParams,
      hasAuthorization,
    };
    sameOriginRequests.push(entry);
    if (u.pathname.startsWith('/api/')) {
      sameOriginApiRequests.push(entry);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (req) => {
    try {
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1') {
        sameOriginFailures.push(req.url() + ' :: ' + ((req.failure() && req.failure().errorText) || 'unknown'));
      }
    } catch (e) { /* ignore */ }
  });
  page.on('response', (r) => {
    try {
      const u = new URL(r.url());
      if (u.hostname === '127.0.0.1' && r.status() >= 400) {
        http4xx.push(r.status() + ' ' + r.url());
      }
    } catch (e) { /* ignore */ }
  });
  await page.route('**/*', makeHermeticRouteHandler({
    fixtureOrigin: baseUrl,
    onUnexpectedExternal: (url) => unexpectedExternal.push(url),
    onSameOrigin: async (route, target) => {
      const pathname = target.pathname;
      if (pathname === '/api/trees') {
        stubbed.apiTrees += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MY_TREES_SYNTHETIC_TREE]) });
        return true;
      }
      if (pathname === '/api/trees/mt-tree-3888-1') {
        stubbed.apiDetail += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MY_TREES_TREE_DETAIL) });
        return true;
      }
      if (pathname === '/api/memories') {
        stubbed.apiMemories += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: MY_TREES_MEMORIES, nextCursor: null }) });
        return true;
      }
      if (pathname.startsWith('/api/')) {
        stubbed.apiOther += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return true;
      }
      return false;
    },
    fulfillExternal: async (route, target) => {
      // Zero real external network: every known external request is stubbed.
      stubbed.external += 1;
      await defaultFulfillExternal(route, target);
    },
  }));
  await page.addInitScript(myTreesAuthFixtureScript, { user: MY_TREES_SYNTHETIC_USER_BASE, lang: 'ko' });
  await page.goto(baseUrl + '/pages/my-trees.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  return { context, page, pageErrors, consoleErrors, sameOriginFailures, http4xx, stubbed, sameOriginApiRequests, sameOriginRequests, unexpectedExternal };
}

async function teardownRealMyTrees(env) {
  try {
    await env.context.close();
  } catch (e) { /* ignore */ }
}

async function waitForMyTreesApiRequests(env, expectedCounts, maxMs) {
  const started = Date.now();
  const keyOf = (entry) => entry.method + ' ' + entry.pathname + (entry.query ? '?' + entry.query : '');
  for (;;) {
    const counts = {};
    env.sameOriginApiRequests.forEach((entry) => {
      const key = keyOf(entry);
      counts[key] = (counts[key] || 0) + 1;
    });
    const matches = Object.keys(expectedCounts).every((key) => counts[key] === expectedCounts[key]);
    if (matches) return counts;
    if (Date.now() - started > maxMs) {
      throw new Error(
        'My Trees API request set did not settle within ' + maxMs + 'ms. Got: ' + JSON.stringify(counts)
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function captureMyTreesBaseline(page) {
  return page.evaluate(() => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, top: r.top, visible, display: cs.display, hiddenAttr: el.hasAttribute('hidden') };
    };
    const region = (sel) => rectOf(document.querySelector(sel));
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const accessibleName = (el) => {
      if (!el) return '';
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const ref = document.getElementById(labelledby);
        if (ref) return (ref.textContent || '').trim();
      }
      if (el.labels && el.labels.length) return (el.labels[0].textContent || '').trim();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
      }
      if (el.getAttribute('title')) return el.getAttribute('title').trim();
      return (el.textContent || '').trim();
    };
    const chips = Array.from(document.querySelectorAll('#myTreesFilterChips .my-trees-filter-chip')).map((c) => {
      const r = c.getBoundingClientRect();
      return {
        filter: c.getAttribute('data-filter'),
        text: (c.textContent || '').trim(),
        r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, top: r.top },
        visible: r.width > 0 && r.height > 0,
      };
    });
    const cards = Array.from(document.querySelectorAll('#trees-grid .tree-card'))
      .filter((c) => c.getAttribute('data-tree-id'))
      .map((c) => {
        const r = c.getBoundingClientRect();
        return {
          id: c.getAttribute('data-tree-id'),
          title: ((c.querySelector('.tree-title') || {}).textContent || '').trim(),
          r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
          visible: r.width > 0 && r.height > 0,
        };
      });
    const viewButtons = Array.from(document.querySelectorAll('#myTreesViewModeMount .tree-view-mode-btn')).map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return {
        mode: b.getAttribute('data-mode'),
        label: b.getAttribute('aria-label'),
        checked: b.getAttribute('aria-checked'),
        r: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, top: r.top },
        visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0,
        pointerEvents: cs.pointerEvents,
      };
    });
    const treesContainer = document.getElementById('treesContainer');
    const hubPanel = document.getElementById('myTreesHubPanel');
    const hubContent = document.getElementById('myTreesHubContent');
    const hubSummary = document.getElementById('myTreesHubSummary');
    const hubTreeTitle = document.getElementById('myTreesHubTreeTitle');
    const mountEl = document.getElementById('myTreesViewModeMount');
    const controlEl = mountEl ? mountEl.querySelector('.tree-view-mode-control') : null;
    const sortEl = document.getElementById('sortTreesSelect');
    const createEl = document.getElementById('headerCreateTreeBtn');
    const mountRect = rectOf(mountEl);
    const controlRect = rectOf(controlEl);
    let clippedByAncestor = false;
    let clipAncestor = null;
    if (mountRect) {
      let el = mountEl.parentElement;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (['auto', 'scroll', 'hidden', 'clip'].includes(cs.overflowX)) {
          const er = el.getBoundingClientRect();
          if (mountRect.right > er.right + 0.5 || mountRect.x < er.left - 0.5) {
            clippedByAncestor = true;
            clipAncestor = el.tagName + '.' + (el.className || '').split(' ').join('.') + ' overflowX=' + cs.overflowX;
          }
          break;
        }
        el = el.parentElement;
      }
    }
    const firstCard = cards.length ? cards[0] : null;
    const mainCol = region('.lovetree-calm-main-column');
    const controls = [
      { name: 'searchInput', r: rectOf(document.getElementById('myTreesSearchInput')) },
      { name: 'sortSelect', r: rectOf(sortEl) },
      ...viewButtons.map((b, i) => ({ name: 'viewModeBtn' + i, r: b.r })),
      ...chips.map((c, i) => ({ name: 'chip' + i, r: c.r })),
    ];
    const hubComputedStyle = hubPanel ? getComputedStyle(hubPanel) : null;
    return {
      identity: {
        title: document.title,
        pathname: window.location.pathname,
        lang: document.documentElement.lang,
        eyebrowText: ((document.getElementById('myTreesPageEyebrow') || {}).textContent || '').trim(),
        titleText: ((document.getElementById('myTreesPageTitle') || {}).textContent || '').trim(),
        descText: ((document.getElementById('myTreesPageDesc') || {}).textContent || '').trim(),
        bodyText: (document.body.textContent || ''),
      },
      regions: {
        sharedHeader: region('#shared-header'),
        panelHeader: region('.search-panel-header'),
        eyebrow: region('#myTreesPageEyebrow'),
        title: region('#myTreesPageTitle'),
        desc: region('#myTreesPageDesc'),
        finder: region('#myTreesFinder'),
        searchInput: rectOf(document.getElementById('myTreesSearchInput')),
        filterChips: region('#myTreesFilterChips'),
        resultsHead: region('.my-trees-results-head'),
        headerCreateBtn: rectOf(createEl),
        sortSelect: rectOf(sortEl),
        viewModeMount: mountRect,
        viewModeControl: controlRect,
        treesContainer: region('#treesContainer'),
        treesGrid: region('#trees-grid'),
        stateLoading: region('#state-loading'),
        stateEmpty: region('#state-empty'),
        stateError: region('#state-error'),
        stateLoaded: region('#state-loaded'),
        hubPanel: rectOf(hubPanel),
        hubContent: rectOf(hubContent),
        hubTreeTitle: rectOf(hubTreeTitle),
        hubFlow: region('#myTreesHubFlow'),
        hubFlowList: region('#myTreesHubFlowList'),
        hubSummary: rectOf(hubSummary),
        hubClose: rectOf(document.getElementById('myTreesHubClose')),
      },
      state: {
        ariaBusyCleared: !!(treesContainer && !treesContainer.hasAttribute('aria-busy')),
        stateLoadedHidden: !!(document.getElementById('state-loaded') && document.getElementById('state-loaded').hidden),
        stateErrorHidden: !!(document.getElementById('state-error') && document.getElementById('state-error').hidden),
        stateEmptyHidden: !!(document.getElementById('state-empty') && document.getElementById('state-empty').hidden),
        stateLoadingHidden: !!(document.getElementById('state-loading') && document.getElementById('state-loading').hidden),
      },
      chips,
      cards,
      viewButtons,
      viewMode: {
        controlWrap: controlEl ? getComputedStyle(controlEl).flexWrap : '',
        clippedByAncestor,
        clipAncestor,
        overlapSortControl: overlapArea(mountRect, rectOf(sortEl)),
        overlapCreate: overlapArea(mountRect, rectOf(createEl)),
      },
      sortSelectInfo: (() => {
        const sel = document.getElementById('sortTreesSelect');
        return sel
          ? { tag: sel.tagName, id: sel.id, label: sel.getAttribute('aria-label'), name: accessibleName(sel), value: sel.value }
          : null;
      })(),
      searchInputName: accessibleName(document.getElementById('myTreesSearchInput')),
      firstViewButtonName: viewButtons.length
        ? accessibleName(document.querySelector('#myTreesViewModeMount .tree-view-mode-btn'))
        : '',
      firstChipName: chips.length ? accessibleName(document.querySelector('#myTreesFilterChips .my-trees-filter-chip')) : '',
      hub: {
        treeTitleText: hubTreeTitle ? (hubTreeTitle.textContent || '').trim() : '',
        summaryText: hubSummary ? (hubSummary.textContent || '').trim() : '',
        flowStageCount: document.querySelectorAll('#myTreesHubFlowList .my-trees-hub-flow-stage, #myTreesHubFlowList .preview-flow-stage').length,
        panelLoaded: !!(hubPanel && hubPanel.classList.contains('is-loaded')),
        panelEmpty: !!(hubPanel && hubPanel.classList.contains('is-empty')),
        panelOpen: !!(hubPanel && hubPanel.classList.contains('is-open')),
        contentVisible: !!(hubContent && !hubContent.hidden),
        flowVisible: !!document.getElementById('myTreesHubFlow') && !document.getElementById('myTreesHubFlow').hidden,
        summaryVisible: !!(hubSummary && !hubSummary.hidden && hubSummary.getBoundingClientRect().width > 0),
        position: hubComputedStyle ? hubComputedStyle.position : '',
        maxHeight: hubComputedStyle ? hubComputedStyle.maxHeight : '',
        display: hubComputedStyle ? hubComputedStyle.display : '',
      },
      sheet: {
        overlayPresent: !!document.querySelector('.preview-sheet-overlay'),
        bodySheetOpen: document.body.classList.contains('preview-sheet-open'),
        bodyTop: document.body.style.top,
      },
      order: {
        header: region('#shared-header') && region('#shared-header').y,
        panel: region('.search-panel-header') && region('.search-panel-header').y,
        finder: region('#myTreesFinder') && region('#myTreesFinder').y,
        resultsHead: region('.my-trees-results-head') && region('.my-trees-results-head').y,
        trees: region('#treesContainer') && region('#treesContainer').y,
        hub: rectOf(hubPanel) && rectOf(hubPanel).y,
      },
      domOrder: (() => {
        const precedes = (first, second) => {
          if (!first || !second) return false;
          return Boolean(
            first.compareDocumentPosition(second) &
              Node.DOCUMENT_POSITION_FOLLOWING
          );
        };
        const header = document.querySelector('#shared-header');
        const panel = document.querySelector('.search-panel-header');
        const finder = document.querySelector('#myTreesFinder');
        const resultsHead = document.querySelector('.my-trees-results-head');
        const trees = document.querySelector('#treesContainer');
        const hub = document.querySelector('#myTreesHubPanel');
        return {
          headerPrecedesPanel: precedes(header, panel),
          panelPrecedesFinder: precedes(panel, finder),
          finderPrecedesResultsHead: precedes(finder, resultsHead),
          panelPrecedesResultsHead: precedes(panel, resultsHead),
          resultsHeadPrecedesTrees: precedes(resultsHead, trees),
          panelPrecedesTrees: precedes(panel, trees),
          treesPrecedesHub: precedes(trees, hub),
        };
      })(),
      overlaps: {
        mainRail: overlapArea(mainCol, rectOf(hubPanel)),
        treesHub: overlapArea(region('#treesContainer'), rectOf(hubPanel)),
        headFirstCard: firstCard ? overlapArea(region('.my-trees-results-head'), firstCard.r) : 0,
        controlsFirstCard: firstCard ? controls.map((c) => ({ name: c.name, area: overlapArea(c.r, firstCard.r) })) : [],
      },
      overflow: {
        html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      },
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      storageKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
    };
  });
}

async function captureMyTreesFocus(page) {
  return page.evaluate(() => {
    const accessibleName = (el) => {
      if (!el) return '';
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const ref = document.getElementById(labelledby);
        if (ref) return (ref.textContent || '').trim();
      }
      if (el.labels && el.labels.length) return (el.labels[0].textContent || '').trim();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
      }
      if (el.getAttribute('title')) return el.getAttribute('title').trim();
      return (el.textContent || '').trim();
    };
    const probe = (el) => {
      if (!el) return { ok: false, name: '', left: 0, right: 0, vw: window.innerWidth };
      let ok = false;
      try {
        el.focus({ preventScroll: true });
        ok = document.activeElement === el;
      } catch (e) { /* not focusable */ }
      const r = el.getBoundingClientRect();
      return { ok, name: accessibleName(el), left: r.left, right: r.right, vw: window.innerWidth };
    };
    const buttons = {};
    Array.from(document.querySelectorAll('#myTreesViewModeMount .tree-view-mode-btn')).forEach((b) => {
      buttons[b.getAttribute('data-mode')] = probe(b);
    });
    return {
      searchInput: probe(document.querySelector('#myTreesSearchInput')),
      sortSelect: probe(document.querySelector('#sortTreesSelect')),
      viewModeButtons: buttons,
      chip: probe(document.querySelector('#myTreesFilterChips .my-trees-filter-chip')),
      headerCreateBtn: probe(document.querySelector('#headerCreateTreeBtn')),
      hubClose: probe(document.querySelector('#myTreesHubClose')),
    };
  });
}

test('My Trees real-page structural baseline', { timeout: 150000 }, async (t) => {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await closeServer(server);
  });

  for (const vp of MY_TREES_VIEWPORTS) {
    await t.test(`viewport ${vp.name} (${vp.width}x${vp.height})`, async (t) => {
      const browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
      t.after(async () => {
        await browser.close();
      });

      const env = await newRealMyTreesPage(browser, vp, baseUrl);
      try {
        const { page, pageErrors, consoleErrors, sameOriginFailures, http4xx, stubbed, sameOriginApiRequests, sameOriginRequests, unexpectedExternal } = env;

        // Deterministic readiness: the real owner API feed is stubbed and the
        // page has rendered at least one real (non-skeleton) tree card while
        // the auto-selected first tree populated the continuation hub.
        await page.waitForFunction(() => {
          const cards = Array.from(document.querySelectorAll('#trees-grid .tree-card'))
            .filter((c) => c.getAttribute('data-tree-id'));
          const hubContent = document.getElementById('myTreesHubContent');
          const hubPanel = document.getElementById('myTreesHubPanel');
          return cards.length >= 1
            && hubContent && hubContent.hidden === false
            && hubPanel && hubPanel.classList.contains('is-loaded');
        }, null, { timeout: 30000 });

        // Deterministic data boundary: wait until the owner list, first-tree
        // detail, and the memory read have all settled through the stubbed
        // same-origin API. The #3944 bounded-page bridge single-flights the
        // preview-media hydrate + preload pair into exactly one cursor-page
        // request, so the memories endpoint is hit once.
        const apiCounts = await waitForMyTreesApiRequests(env, {
          'GET /api/trees?pagination=cursor': 1,
          'GET /api/trees/mt-tree-3888-1': 1,
          'GET /api/memories?limit=100&pagination=cursor&treeId=mt-tree-3888-1': 1,
        }, 15000);

        const snap = await captureMyTreesBaseline(page);
        const focus = await captureMyTreesFocus(page);

        await t.test('A. real-page identity', () => {
          assert.equal(snap.identity.pathname, '/pages/my-trees.html', 'must inspect the real repository /pages/my-trees.html, not the fixture');
          assert.equal(snap.identity.title, '내 러브트리 | LoveTree', 'real My Trees document title');
          assert.equal(snap.identity.lang, 'ko', 'real My Trees document lang');
          assert.ok(snap.identity.eyebrowText.length > 0, 'visible eyebrow text non-empty');
          assert.ok(snap.identity.titleText.length > 0, 'visible title text non-empty');
          assert.ok(snap.identity.descText.length > 0, 'visible description text non-empty');
          assert.ok(!snap.identity.bodyText.includes('Browse Compact Tree'), 'fixture-only browse card copy absent');
          assert.ok(!snap.identity.bodyText.includes('Home Modal Test Fixture'), 'fixture-only home copy absent');
        });

        await t.test('B. authenticated owner boundary', () => {
          assert.equal(snap.identity.pathname, '/pages/my-trees.html', 'no login/navigation redirect from My Trees');
          assert.equal(snap.state.ariaBusyCleared, true, '#treesContainer aria-busy cleared after successful load');
          const authLike = (k) => /auth|firebase|token|session|user/i.test(k);
          assert.deepEqual(
            snap.storageKeys.filter(authLike).sort(),
            ['lovebud_auth_cache', 'lovebud_auth_confirmed'],
            'only the confirmed-session cache keys are present in localStorage (no token record)'
          );
          assert.equal(snap.storageKeys.includes('lovebud_auth_token'), false, 'lovebud_auth_token absent from localStorage');
          assert.deepEqual(snap.sessionKeys.filter(authLike), [], 'no authenticated fixture/session in sessionStorage');
          const apiEntriesWithAuth = sameOriginApiRequests.filter((r) => r.hasAuthorization === true);
          assert.deepEqual(apiEntriesWithAuth, [], 'no API request carries an Authorization header');
        });

        await t.test('C. required regions present', () => {
          const required = [
            'sharedHeader', 'panelHeader', 'eyebrow', 'title', 'desc', 'finder',
            'searchInput', 'filterChips', 'resultsHead', 'headerCreateBtn', 'sortSelect',
            'viewModeMount', 'viewModeControl', 'treesContainer', 'treesGrid', 'stateLoading', 'stateLoaded',
            'hubPanel', 'hubContent', 'hubSummary',
          ];
          for (const name of required) {
            assert.ok(snap.regions[name], `required region ${name} present`);
          }
          assert.ok(snap.chips.length >= 1, `at least 1 visible filter chip, got ${snap.chips.length}`);
          assert.ok(snap.cards.length >= 1, `at least 1 real tree card, got ${snap.cards.length}`);
          assert.ok(snap.viewButtons.length >= 1, 'view-mode control buttons present');
          assert.ok(snap.sortSelectInfo, 'my trees sort select present');
        });

        await t.test('D. region geometry positive and in-bounds', () => {
          const vw = snap.viewportWidth;
          const checkVisibleRegion = (name, r) => {
            assert.ok(r, `${name} rect exists`);
            assert.equal(r.visible, true, `${name} visible`);
            assert.ok(r.w > 0 && r.h > 0, `${name} positive geometry`);
            assert.ok(r.x >= -1, `${name} left >= -1 (x=${r.x})`);
            assert.ok(r.right <= vw + 1, `${name} right within viewport (right=${r.right}, vw=${vw})`);
          };
          checkVisibleRegion('shared header', snap.regions.sharedHeader);
          checkVisibleRegion('search panel header', snap.regions.panelHeader);
          checkVisibleRegion('search input', snap.regions.searchInput);
          checkVisibleRegion('filter chips', snap.regions.filterChips);
          for (const chip of snap.chips) {
            assert.equal(chip.visible, true, `chip ${chip.filter} visible`);
            assert.ok(chip.r.w > 0 && chip.r.h > 0, `chip ${chip.filter} positive geometry`);
            assert.ok(chip.r.x >= -1 && chip.r.right <= vw + 1, `chip ${chip.filter} in horizontal bounds`);
          }
          checkVisibleRegion('results header', snap.regions.resultsHead);
          checkVisibleRegion('sort control', snap.regions.sortSelect);
          checkVisibleRegion('view-mode mount', snap.regions.viewModeMount);
          checkVisibleRegion('view-mode control', snap.regions.viewModeControl);
          checkVisibleRegion('trees container', snap.regions.treesContainer);
          checkVisibleRegion('trees grid', snap.regions.treesGrid);
          for (const card of snap.cards) {
            assert.equal(card.visible, true, `card ${card.id} visible`);
            assert.ok(card.r.w > 0 && card.r.h > 0, `card ${card.id} positive geometry`);
            assert.ok(card.r.x >= -1 && card.r.right <= vw + 1, `card ${card.id} in horizontal bounds`);
          }
          checkVisibleRegion('hub panel', snap.regions.hubPanel);
          assert.ok(snap.regions.stateLoaded.visible === true, 'state-loaded section visible');
          assert.ok(snap.regions.stateLoading.visible === false, 'state-loading hidden after successful load');
          assert.ok(snap.regions.stateError.visible === false, 'state-error hidden after successful load');
          assert.ok(snap.regions.stateEmpty.visible === false, 'state-empty hidden after successful load');
        });

        await t.test('E. view-mode control: all four buttons in-bounds and operable', () => {
          const vw = snap.viewportWidth;
          assert.equal(snap.viewMode.controlWrap, 'wrap', 'My Trees mobile/bounded segmented control may wrap but never clips (control wrap enabled)');
          assert.equal(snap.viewMode.clippedByAncestor, false, `no ancestor clips the view-mode control (${snap.viewMode.clipAncestor || 'none'})`);
          const modes = snap.viewButtons.map((b) => b.mode);
          for (const expected of ['large', 'compact', 'list', 'story']) {
            assert.ok(modes.includes(expected), `view-mode mode ${expected} present`);
          }
          assert.equal(snap.viewButtons.length, 4, `exactly 4 view-mode buttons rendered, got ${snap.viewButtons.length}`);
          for (const b of snap.viewButtons) {
            assert.equal(b.visible, true, `view-mode button ${b.mode} visible`);
            assert.ok(b.r.w > 0, `view-mode button ${b.mode} width > 0 (${b.r.w})`);
            assert.ok(b.r.h > 0, `view-mode button ${b.mode} height > 0 (${b.r.h})`);
            assert.ok(b.r.x >= -1, `view-mode button ${b.mode} left >= -1 (x=${b.r.x})`);
            assert.ok(b.r.right <= vw + 1, `view-mode button ${b.mode} right within viewport (right=${b.r.right}, vw=${vw})`);
            assert.ok(b.pointerEvents !== 'none', `view-mode button ${b.mode} is pointer-interactive`);
          }
          assert.ok(snap.regions.viewModeControl.x >= -1 && snap.regions.viewModeControl.right <= vw + 1, 'control bounding box inside the viewport');
          if (vp.name !== 'desktop') {
            const tops = snap.viewButtons.map((b) => b.r.top);
            const maxTop = Math.max.apply(null, tops);
            const minTop = Math.min.apply(null, tops);
            assert.ok(maxTop - minTop > 1, `mobile bounded wrap produces a second row (row tops differ by ${maxTop - minTop}px)`);
          } else {
            const tops = snap.viewButtons.map((b) => b.r.top);
            const maxTop = Math.max.apply(null, tops);
            const minTop = Math.min.apply(null, tops);
            assert.ok(maxTop - minTop <= 1, `desktop keeps a single row (row tops within ${maxTop - minTop}px)`);
          }
        });

        await t.test('F. focus and accessible names', () => {
          const assertControl = (label, info) => {
            assert.equal(info.ok, true, `${label} focus() succeeds and becomes activeElement`);
            assert.ok(info.name.length > 0, `${label} accessible name non-empty`);
            assert.ok(info.left >= -1, `${label} left >= -1 (x=${info.left})`);
            assert.ok(info.right <= info.vw + 1, `${label} right within viewport (right=${info.right}, vw=${info.vw})`);
          };
          assertControl('search input (#myTreesSearchInput)', focus.searchInput);
          assertControl('sort control (#sortTreesSelect)', focus.sortSelect);
          assertControl('filter chip', focus.chip);
          assertControl('header create button (#headerCreateTreeBtn)', focus.headerCreateBtn);
          for (const expected of ['large', 'compact', 'list', 'story']) {
            assert.ok(focus.viewModeButtons[expected], `view-mode button ${expected} focus probed`);
            assertControl(`view-mode button ${expected}`, focus.viewModeButtons[expected]);
          }
          assert.ok(snap.searchInputName.length > 0, 'search input accessible name from page snapshot non-empty');
          assert.equal(snap.sortSelectInfo.label, '정렬 기준', 'sort select aria-label preserved');
          assert.equal(snap.sortSelectInfo.value, 'recent', 'sort select defaults to 최신순 (recent)');
        });

        await t.test('G. result/card structure', () => {
          assert.equal(snap.regions.treesGrid.visible, true, '#trees-grid visible');
          assert.ok(snap.cards.length >= 1, `at least 1 visible real .tree-card, got ${snap.cards.length}`);
          for (const card of snap.cards) {
            assert.ok(card.r.w > 0 && card.r.h > 0, `card ${card.id} width/height positive (${card.r.w}x${card.r.h})`);
            assert.ok(card.r.x >= -1 && card.r.right <= snap.viewportWidth + 1, `card ${card.id} inside horizontal bounds`);
          }
          assert.ok(snap.regions.treesContainer.w > 0 && snap.regions.treesContainer.h > 0, 'trees container positive geometry');
          assert.equal(snap.state.stateLoadedHidden, false, '#state-loaded not hidden');
          assert.equal(snap.state.stateErrorHidden, true, '#state-error hidden');
          assert.equal(snap.state.stateEmptyHidden, true, '#state-empty hidden');
          assert.equal(snap.state.stateLoadingHidden, true, '#state-loading hidden');
        });

        await t.test('H. reading order and overlap', () => {
          const o = snap.order;
          const dom = snap.domOrder;
          assert.equal(dom.headerPrecedesPanel, true, '#shared-header must precede .search-panel-header in DOM order');
          assert.equal(dom.panelPrecedesFinder, true, '.search-panel-header must precede #myTreesFinder in DOM order');
          assert.equal(dom.finderPrecedesResultsHead, true, '#myTreesFinder must precede .my-trees-results-head in DOM order');
          assert.equal(dom.resultsHeadPrecedesTrees, true, '.my-trees-results-head must precede #treesContainer in DOM order');
          assert.equal(dom.treesPrecedesHub, true, '#treesContainer must precede #myTreesHubPanel in DOM order');
          if (vp.name === 'desktop') {
            assert.ok(o.panel < o.finder, `panel header < finder (${o.panel} < ${o.finder})`);
            assert.ok(o.finder < o.resultsHead, `finder < results header (${o.finder} < ${o.resultsHead})`);
            assert.ok(o.resultsHead < o.trees, `results header < trees container (${o.resultsHead} < ${o.trees})`);
            assert.equal(dom.panelPrecedesTrees, true, '.search-panel-header must precede #treesContainer in DOM order');
            assert.ok(snap.overlaps.mainRail <= 1, `main column / hub rail overlap ~0, got ${snap.overlaps.mainRail}`);
            assert.ok(snap.overlaps.treesHub <= 1, `trees container / hub panel overlap ~0, got ${snap.overlaps.treesHub}`);
            assert.ok(snap.overlaps.headFirstCard <= 1, `results header / first card overlap ~0, got ${snap.overlaps.headFirstCard}`);
          } else {
            assert.ok(o.header < o.panel, `header < title (${o.header} < ${o.panel})`);
            assert.ok(o.panel < o.finder, `title < search input / filter controls (${o.panel} < ${o.finder})`);
            assert.ok(o.finder < o.resultsHead, `search input / filter controls < results header (${o.finder} < ${o.resultsHead})`);
            assert.ok(o.resultsHead < o.trees, `results header < trees container (${o.resultsHead} < ${o.trees})`);
            const badOverlap = snap.overlaps.controlsFirstCard.filter((c) => c.area > 1);
            assert.deepEqual(badOverlap, [], `visible controls vs first card overlap ~0, got ${JSON.stringify(badOverlap)}`);
          }
          assert.ok(snap.viewMode.overlapSortControl <= 1, `view-mode control / sort select overlap ~0, got ${snap.viewMode.overlapSortControl}`);
          assert.ok(snap.viewMode.overlapCreate <= 1, `view-mode control / create CTA overlap ~0, got ${snap.viewMode.overlapCreate}`);
        });

        await t.test('I. continuation hub', () => {
          assert.equal(snap.hub.panelLoaded, true, '#myTreesHubPanel reached is-loaded');
          assert.equal(snap.hub.panelEmpty, false, '#myTreesHubPanel not in empty state');
          assert.equal(snap.hub.contentVisible, true, '#myTreesHubContent visible after auto-selecting the first tree');
          assert.ok(snap.hub.treeTitleText.length > 0, 'hub tree title non-empty');
          assert.ok(snap.hub.flowVisible, '#myTreesHubFlow visible');
          assert.ok(snap.hub.flowStageCount >= 1, `hub flow renders at least 1 stage, got ${snap.hub.flowStageCount}`);
          assert.ok(snap.hub.summaryVisible, '#myTreesHubSummary visible');
          assert.ok(snap.hub.summaryText.length > 0, 'hub summary text non-empty');
        });

        await t.test('J. overflow and browser health', () => {
          assert.ok(snap.overflow.html <= 1, `documentElement horizontal overflow ~0, got ${snap.overflow.html}`);
          assert.ok(snap.overflow.body <= 1, `body horizontal overflow ~0, got ${snap.overflow.body}`);
          assert.strictEqual(pageErrors.length, 0, `pageerror zero, got: ${pageErrors.join(', ')}`);
          assert.strictEqual(consoleErrors.length, 0, `unexpected console error zero, got: ${consoleErrors.join(', ')}`);
          assert.strictEqual(sameOriginFailures.length, 0, `same-origin request failure zero, got: ${sameOriginFailures.join(', ')}`);
          assert.strictEqual(http4xx.length, 0, `same-origin HTTP>=400 zero, got: ${http4xx.join(', ')}`);
          // Deterministic data boundary: the synthetic owner feed was used.
          assert.ok(stubbed.apiTrees >= 1, `deterministic /api/trees stub used (${stubbed.apiTrees} fulfillment)`);
          assert.ok(stubbed.external >= 1, `external requests all stubbed (${stubbed.external} fulfilled, 0 real external network)`);
          assert.deepEqual(unexpectedExternal, [], `no unexpected external origin escape, got: ${JSON.stringify(unexpectedExternal)}`);
        });

        await t.test('K. authenticated-owner API request allowlist', () => {
          // Exact positive allowlist: the owner page may call only the owner
          // list, first-tree detail, and memories over the same-origin API.
          const requestSet = Array.from(
            new Set(sameOriginApiRequests.map(({ method, pathname, query }) => method + ' ' + pathname + (query ? '?' + query : '')))
          ).sort();
          assert.deepEqual(
            requestSet,
            [
              'GET /api/memories?limit=100&pagination=cursor&treeId=mt-tree-3888-1',
              'GET /api/trees/mt-tree-3888-1',
              'GET /api/trees?pagination=cursor',
            ],
            `same-origin API request set must be exactly the owner allowlist, got: ${JSON.stringify(requestSet)}`
          );
          assert.deepEqual(
            apiCounts,
            {
              'GET /api/trees?pagination=cursor': 1,
              'GET /api/trees/mt-tree-3888-1': 1,
              'GET /api/memories?limit=100&pagination=cursor&treeId=mt-tree-3888-1': 1,
            },
            'exact per-endpoint request counts (list 1, detail 1, memories 1 via single-flight bridge)'
          );
          assert.equal(stubbed.apiOther, 0, `non-allowlisted /api/* stub fulfillments must be 0, got ${stubbed.apiOther}`);
          const writeRequests = sameOriginRequests.filter((r) => !['GET', 'HEAD', 'OPTIONS'].includes(r.method));
          assert.deepEqual(writeRequests, [], `no write method (POST/PUT/PATCH/DELETE) same-origin request, got: ${JSON.stringify(writeRequests)}`);
          const forbiddenPathname = (pathname) => {
            const forbiddenPrefixes = ['/api/auth', '/api/login', '/api/session', '/api/user', '/modal/private'];
            return forbiddenPrefixes.some(
              (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
            );
          };
          const forbiddenRequests = sameOriginRequests.filter(({ pathname }) => forbiddenPathname(pathname));
          assert.deepEqual(
            forbiddenRequests,
            [],
            `no auth/login/session/private/owner-profile same-origin request, got: ${JSON.stringify(forbiddenRequests)}`
          );
        });

        if (vp.name !== 'desktop') {
          await t.test('L. mobile bottom-sheet', async () => {
            assert.equal(snap.hub.panelOpen, true, '#myTreesHubPanel is-open on mobile after auto-select');
            assert.equal(snap.sheet.overlayPresent, true, '.preview-sheet-overlay present while sheet open');
            assert.equal(snap.sheet.bodySheetOpen, true, 'body.preview-sheet-open applied while sheet open');
            assert.equal(snap.hub.position, 'fixed', `mobile hub panel is position:fixed, got ${snap.hub.position}`);
            const maxHeight = parseFloat(snap.hub.maxHeight);
            assert.ok(Number.isFinite(maxHeight) && maxHeight > 0, `mobile hub max-height set, got ${snap.hub.maxHeight}`);
            assert.ok(snap.regions.hubPanel.bottom >= snap.viewportHeight - 1, `sheet bottom pinned to viewport bottom (bottom=${snap.regions.hubPanel.bottom}, vh=${snap.viewportHeight})`);
            assert.ok(snap.hub.flowVisible, 'sheet content shows the flow list');
            assert.ok(snap.hub.summaryVisible, 'sheet content shows the hub summary');
            assert.ok(focus.hubClose.ok, 'hub close button focusable in the open sheet');
            assert.equal(focus.hubClose.name, '닫기', 'hub close button accessible name preserved');

            await page.keyboard.press('Escape');
            await page.waitForFunction(() => {
              const panel = document.getElementById('myTreesHubPanel');
              return panel
                && !panel.classList.contains('is-open')
                && !document.querySelector('.preview-sheet-overlay')
                && !document.body.classList.contains('preview-sheet-open');
            }, null, { timeout: 10000 });
            const closed = await page.evaluate(() => {
              const panel = document.getElementById('myTreesHubPanel');
              return {
                isOpen: !!(panel && panel.classList.contains('is-open')),
                overlayPresent: !!document.querySelector('.preview-sheet-overlay'),
                bodySheetOpen: document.body.classList.contains('preview-sheet-open'),
              };
            });
            assert.deepEqual(closed, { isOpen: false, overlayPresent: false, bodySheetOpen: false }, 'Escape closes the mobile sheet');
          });
        }

        await t.test('M. view-mode pointer interaction', async () => {
          const beforeErrorCount = pageErrors.length;
          const modes = ['large', 'compact', 'list', 'story'];
          const findReachablePoint = async (mode) => {
            return page.evaluate((m) => {
              const btn = document.querySelector(`#myTreesViewModeMount .tree-view-mode-btn[data-mode="${m}"]`);
              if (!btn) return null;
              const r = btn.getBoundingClientRect();
              const cy = r.top + r.height / 2;
              const samples = 16;
              for (let i = 1; i <= samples; i += 1) {
                const x = r.left + (r.width * i) / (samples + 1);
                const el = document.elementFromPoint(x, cy);
                if (el && btn.contains(el)) {
                  return { x, y: cy };
                }
              }
              return null;
            }, mode);
          };
          for (const mode of modes) {
            const point = await findReachablePoint(mode);
            assert.ok(point, `view-mode button ${mode} has a reachable pointer point (not fully covered)`);
            await page.mouse.click(point.x, point.y);
            await page.waitForFunction((m) => {
              const b = document.querySelector(`#myTreesViewModeMount .tree-view-mode-btn[data-mode="${m}"]`);
              return b && b.classList.contains('is-active');
            }, mode, { timeout: 10000 });
            const activeMode = await page.evaluate(() => {
              const active = document.querySelector('#myTreesViewModeMount .tree-view-mode-btn.is-active');
              return active ? active.getAttribute('data-mode') : null;
            });
            assert.equal(activeMode, mode, `pointer click on ${mode} activates the ${mode} mode button`);
          }
          // Restore the canonical compact baseline state (non-mutating view preference).
          const compactPoint = await findReachablePoint('compact');
          assert.ok(compactPoint, 'compact button still reachable for restore');
          await page.mouse.click(compactPoint.x, compactPoint.y);
          await page.waitForFunction(() => {
            const b = document.querySelector('#myTreesViewModeMount .tree-view-mode-btn[data-mode="compact"]');
            return b && b.classList.contains('is-active');
          }, null, { timeout: 10000 });
          const gridMode = await page.evaluate(() => {
            const grid = document.getElementById('trees-grid');
            return grid ? grid.getAttribute('data-tree-view-mode') : null;
          });
          assert.equal(gridMode, 'compact', 'grid restored to compact after pointer interaction');
          assert.strictEqual(pageErrors.length, beforeErrorCount, 'pointer interaction introduced no new pageerror');
        });
      } finally {
        await teardownRealMyTrees(env);
      }
    });
  }
});
