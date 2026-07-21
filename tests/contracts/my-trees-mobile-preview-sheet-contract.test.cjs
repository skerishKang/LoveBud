/**
 * LoveBud My Trees Mobile Preview Sheet Contract Test
 * Includes #3604 initial CTA visibility presentation contract and the
 * Production follow-up for transformed page-transition containing blocks.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');

const ROOT = path.join(__dirname, '..', '..');
const CACHE_V = '20260721-3604-2';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('My Trees loads mobile preview sheet script and integrates correctly', () => {
    const html = read('pages/my-trees.html');
    const controllerJs = read('js/my-trees/my-trees-mobile-preview-sheet.js');
    const responsiveCss = read('css/my-trees/my-trees-preview-hub/responsive.css');

    // Verify script inclusion
    assert.match(
        html,
        /<script src="..\/js\/my-trees\/my-trees-mobile-preview-sheet.js\?v=[^"]+"><\/script>/,
        'pages/my-trees.html must include the script tag for my-trees-mobile-preview-sheet.js'
    );

    // Verify references in JS controller
    assert.match(
        controllerJs,
        /document\.getElementById\(\s*['"]myTreesHubPanel['"]\s*\)/,
        'Controller must reference #myTreesHubPanel ID'
    );
    assert.match(
        controllerJs,
        /document\.getElementById\(\s*['"]myTreesHubClose['"]\s*\)/,
        'Controller must reference #myTreesHubClose ID'
    );

    // Verify overlay/backdrop logic is present
    assert.match(
        controllerJs,
        /document\.createElement\(\s*['"]div['"]\s*\)/,
        'Controller must create overlay element'
    );
    assert.match(
        controllerJs,
        /preview-sheet-overlay/,
        'Controller must use preview-sheet-overlay class'
    );

    // Verify body scroll lock logic is present
    assert.match(
        controllerJs,
        /preview-sheet-open/,
        'Controller must toggle preview-sheet-open class on body'
    );

    // Verify close path only closes the sheet and does NOT automatically clear owner selections
    assert.doesNotMatch(
        controllerJs,
        /closeMobilePreview\(\)\s*\{[\s\S]*?showPlaceholder\(\)/,
        'closeMobilePreview must NOT directly call showPlaceholder()'
    );
    assert.doesNotMatch(
        controllerJs,
        /closeMobilePreview\(\)\s*\{[\s\S]*?markSelectedCard\(/,
        'closeMobilePreview must NOT directly clear selected cards'
    );

    // Verify responsive CSS sets preview-sidebar styles inside media query with scoped selector
    assert.match(
        responsiveCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?#myTreesHubPanel\.preview-sidebar[\s\S]*?position:\s*fixed;?[\s\S]*?\}/,
        'CSS must define mobile bottom sheet styles with scoped selector #myTreesHubPanel.preview-sidebar'
    );

    // Confirm owner-only actions are preserved (edit removed in #3578 Phase 1)
    assert.match(
        html,
        /id="myTreesHubOpenBtn"/,
        'My Trees must preserve #myTreesHubOpenBtn'
    );
    assert.doesNotMatch(
        html,
        /id="myTreesHubEditBtn"/,
        'My Trees must NOT preserve obsolete #myTreesHubEditBtn (#3578)'
    );
});

test('#3604 mobile open sheet keeps primary-only sticky CTA presentation', () => {
  const responsiveCss = read('css/my-trees/my-trees-preview-hub/responsive.css');
  const html = read('pages/my-trees.html');
  const actionsCss = read('css/my-trees/my-trees-preview-hub/actions.css');
  const myTreesCss = read('css/my-trees.css');
  const hubManifest = read('css/my-trees/my-trees-preview-hub.css');

  // Cache-bust chain must all share the same delivery token.
  assert.ok(
    html.includes(`my-trees.css?v=${CACHE_V}`),
    `pages/my-trees.html must load my-trees.css?v=${CACHE_V}`
  );
  assert.ok(
    myTreesCss.includes(`my-trees-preview-hub.css?v=${CACHE_V}`),
    `css/my-trees.css must import preview-hub manifest ?v=${CACHE_V}`
  );
  assert.ok(
    hubManifest.includes(`responsive.css?v=${CACHE_V}`),
    `preview-hub manifest must import responsive.css?v=${CACHE_V}`
  );

  // Extract the ≤768px mobile block only for scoped assertions.
  const mobileBlockMatch = responsiveCss.match(
    /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*)\}\s*@media\s*\(max-width:\s*375px\)/
  );
  assert.ok(mobileBlockMatch, 'responsive.css must contain a ≤768px mobile block before the ≤375px block');
  const mobileBlock = mobileBlockMatch[1];

  // Sheet still uses deliberate near-full max-height + internal scroll.
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar[\s\S]*?max-height:\s*92dvh/,
    'Mobile open sheet must keep max-height: 92dvh'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar[\s\S]*?overflow-y:\s*auto/,
    'Mobile open sheet must keep overflow-y: auto for internal scrolling'
  );

  // Safe-area bottom padding retained on the sheet itself.
  assert.match(
    mobileBlock,
    /padding:\s*22px\s+18px\s+calc\(18px\s*\+\s*env\(safe-area-inset-bottom/,
    'Mobile sheet must retain safe-area bottom padding'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open[\s\S]*?padding-bottom:\s*calc\(72px\s*\+\s*env\(safe-area-inset-bottom/,
    'Open sheet must reserve bottom clearance for the sticky primary CTA'
  );

  // Primary CTA only is sticky; whole actions stack must not be sticky.
  assert.doesNotMatch(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open\s+\.my-trees-hub-actions[\s\S]{0,200}?position:\s*sticky/,
    'Must NOT sticky-pin the whole .my-trees-hub-actions stack'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open\s+\.my-trees-hub-actions[\s\S]*?display:\s*contents/,
    'Actions wrapper must use display:contents so open-btn sticks to the sheet scrollport'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open\s+\.my-trees-hub-open-btn[\s\S]*?position:\s*sticky/,
    'Primary open CTA must be position:sticky'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open\s+\.my-trees-hub-open-btn[\s\S]*?safe-area-inset-bottom/,
    'Sticky primary CTA must include safe-area bottom offset'
  );
  assert.match(
    mobileBlock,
    /#myTreesHubPanel\.preview-sidebar\.is-open\s+\.my-trees-hub-share-btn[\s\S]*?position:\s*static/,
    'Share button must remain position:static (normal scroll flow)'
  );

  // Scoped transform neutralization while the mobile sheet is open only.
  assert.match(
    mobileBlock,
    /body\.preview-sheet-open\s+\.my-trees-container\.page-transition-enter[\s\S]*?transform:\s*none/,
    'Mobile sheet-open must neutralize .my-trees-container.page-transition-enter transform'
  );
  assert.match(
    mobileBlock,
    /body\.preview-sheet-open\s+\.my-trees-container\.page-transition-enter\.is-visible[\s\S]*?transform:\s*none/,
    'Mobile sheet-open must neutralize completed .is-visible page-transition transform'
  );

  // No CSS order reordering of interactive controls (DOM/focus order preserved).
  assert.doesNotMatch(
    mobileBlock,
    /\.my-trees-hub-open-btn[\s\S]{0,120}?order\s*:/,
    'Must not CSS-order the open CTA'
  );
  assert.doesNotMatch(
    mobileBlock,
    /\.my-trees-hub-share-btn[\s\S]{0,120}?order\s*:/,
    'Must not CSS-order the share button'
  );
  assert.doesNotMatch(
    mobileBlock,
    /\.preview-focus-title-block[\s\S]{0,80}?order\s*:/,
    'Must not CSS-order title block'
  );
  assert.doesNotMatch(
    mobileBlock,
    /\.my-trees-hub-flow[\s\S]{0,80}?order\s*:/,
    'Must not CSS-order flow'
  );
  assert.doesNotMatch(
    mobileBlock,
    /#myTreesHubSocialSlot[\s\S]{0,80}?order\s*:/,
    'Must not CSS-order social slot'
  );

  // Exactly one primary open CTA in markup; no obsolete direct Edit control.
  const openBtnMatches = html.match(/id="myTreesHubOpenBtn"/g) || [];
  assert.equal(openBtnMatches.length, 1, 'Exactly one #myTreesHubOpenBtn in my-trees.html');
  assert.doesNotMatch(html, /id="myTreesHubEditBtn"/, 'No obsolete direct Edit hub button');
  assert.doesNotMatch(actionsCss, /my-trees-hub-edit-btn/, 'actions.css must not reintroduce edit button styles as active primary');
  // DOM order: open CTA before share.
  const openIdx = html.indexOf('id="myTreesHubOpenBtn"');
  const shareIdx = html.indexOf('id="myTreesHubShareBtn"');
  assert.ok(openIdx > 0 && shareIdx > openIdx, 'DOM order must be open CTA then share');

  // Desktop selectors outside the mobile media query must not receive sticky presentation.
  const outsideMobile = responsiveCss
    .replace(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\}\s*@media\s*\(max-width:\s*375px\)\s*\{[\s\S]*\}/, '')
    .replace(/@media\s*\(max-width:\s*1024px\)\s*\{[\s\S]*?\}/, '');
  assert.doesNotMatch(
    outsideMobile,
    /\.my-trees-hub-open-btn[\s\S]*position:\s*sticky/,
    'Sticky open CTA presentation must not apply outside the mobile media query'
  );
  assert.doesNotMatch(
    outsideMobile,
    /body\.preview-sheet-open[\s\S]*transform:\s*none/,
    'page-transition transform neutralization must stay inside the mobile media query'
  );
});

/* ── Optional Chromium geometry (fail-closed when Playwright unavailable) ── */
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

/**
 * Production-equivalent fixture ancestry:
 * sheet is a descendant of
 * <main class="my-trees-container ... page-transition-enter is-visible">
 * and page-transitions.css is loaded so completed enter keeps
 * transform: translateY(0) until the mobile sheet-open correction applies.
 * body.preview-sheet-open + body top offset mirrors controller scroll-lock.
 */
function buildFixtureHtml(options = {}) {
  const sheetOpen = options.sheetOpen !== false;
  const scrollLockY = Number.isFinite(options.scrollLockY) ? options.scrollLockY : 232;
  const bodyClass = sheetOpen ? 'preview-sheet-open' : '';
  const bodyTop = sheetOpen ? `top: -${scrollLockY}px;` : '';
  const sheetOpenClass = sheetOpen ? ' is-open' : '';

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<link rel="stylesheet" href="/css/page-transitions.css"/>
<link rel="stylesheet" href="/css/my-trees/my-trees-preview-hub/layout.css"/>
<link rel="stylesheet" href="/css/my-trees/my-trees-preview-hub/actions.css"/>
<link rel="stylesheet" href="/css/my-trees/my-trees-preview-hub/content.css"/>
<link rel="stylesheet" href="/css/my-trees/my-trees-preview-hub/responsive.css"/>
<style>
  :root { --primary: #904951; --font-heading: system-ui, sans-serif; --on-surface-variant: #5c514c; --outline-variant: rgba(144,73,81,.14); --surface-container: rgba(255,255,255,.5); }
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; min-height: 200vh; }
  .material-symbols-outlined { font-family: system-ui; font-size: 16px; }
  .my-trees-container { min-height: 100vh; padding: 12px; box-sizing: border-box; }
  /* Prefer reduced motion so open-sheet slide animation does not mask geometry. */
  @media (prefers-reduced-motion: no-preference) {
    #myTreesHubPanel.preview-sidebar.is-open { animation-duration: 1ms; }
  }
</style>
</head>
<body class="${bodyClass}" style="${bodyTop}">
<main class="my-trees-container lovetree-calm-two-column-shell page-transition-enter is-visible" id="myTreesPageRoot">
  <div class="my-trees-list-pad" style="height:180px;background:#eee;margin-bottom:12px;border-radius:12px;">owner tree list</div>
  <aside class="my-trees-hub-panel preview-sidebar preview-hub${sheetOpenClass}" id="myTreesHubPanel">
  <div class="my-trees-hub-header preview-panel-header">
    <div class="my-trees-hub-title-group preview-panel-title-group">
      <h3>내 러브트리</h3>
      <span class="my-trees-hub-badge preview-badge">선택한 내 트리</span>
    </div>
    <button type="button" class="preview-mobile-close" id="myTreesHubClose" aria-label="닫기" style="display:inline-flex">
      <span class="material-symbols-outlined">close</span>
    </button>
  </div>
  <div id="myTreesHubVideoContainer" class="video-container" style="height:180px;background:#ddd;border-radius:1rem;margin-bottom:12px;"></div>
  <div class="my-trees-hub-content preview-details" id="myTreesHubContent">
    <div class="preview-focus-title-block">
      <div class="my-trees-hub-tree-title preview-focus-title">대표 트리</div>
      <div class="my-trees-hub-meta-badge">공개 · 순간 8</div>
    </div>
    <div class="my-trees-hub-flow preview-flow-slot" id="myTreesHubFlow">
      <div class="my-trees-hub-flow-label"><span>이어진 흐름</span></div>
      <div class="my-trees-hub-flow-list" id="myTreesHubFlowList">
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
        <div style="height:36px;margin:6px 0;background:#eee;border-radius:999px;"></div>
      </div>
    </div>
    <div class="my-trees-hub-summary" id="myTreesHubSummary" style="min-height:80px;margin:12px 0;">이어진 기억 요약 문단. 감정이 이어진 경로를 설명합니다.</div>
    <div class="my-trees-hub-actions preview-actions" id="myTreesHubActions">
      <a class="btn-round btn-primary preview-primary-action my-trees-hub-open-btn" id="myTreesHubOpenBtn" href="/pages/editor?treeId=demo-tree-1"><span class="material-symbols-outlined">account_tree</span><span>감상하기</span></a>
      <button type="button" class="my-trees-hub-share-btn preview-share-action" id="myTreesHubShareBtn"><span class="material-symbols-outlined">link</span><span>감상 링크 복사</span></button>
    </div>
    <div id="myTreesHubSocialSlot" class="preview-hub-social-slot">
      <button type="button" id="fixtureSocialBtn" style="display:block;width:100%;min-height:40px;margin-top:10px;">소셜 슬롯</button>
    </div>
  </div>
</aside>
</main>
</body></html>`;
}

function startFixtureServer(fixtureHtml) {
  return getFreePort().then((port) => new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '/fixture.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fixtureHtml);
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
  }));
}

function isFullyVisible(rect, viewportH, viewportW) {
  return (
    rect.top >= -1 &&
    rect.bottom <= viewportH + 1 &&
    rect.left >= -1 &&
    rect.right <= viewportW + 1 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

test('#3604 browser geometry: 375×812 open sheet shows CTA without scrolling', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }

  const fixtureHtml = buildFixtureHtml({ sheetOpen: true, scrollLockY: 232 });
  const { server, port } = await startFixtureServer(fixtureHtml);

  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    // Wait for primary-only sticky layout + viewport-anchored sheet to settle.
    await page.waitForFunction(() => {
      const main = document.getElementById('myTreesPageRoot');
      const sheet = document.getElementById('myTreesHubPanel');
      const cta = document.getElementById('myTreesHubOpenBtn');
      const share = document.getElementById('myTreesHubShareBtn');
      if (!main || !sheet || !cta || !share) return false;
      const cr = cta.getBoundingClientRect();
      const sr = sheet.getBoundingClientRect();
      const ctaPos = getComputedStyle(cta).position;
      const sharePos = getComputedStyle(share).position;
      const mainTransform = getComputedStyle(main).transform;
      return (
        (ctaPos === 'sticky' || ctaPos === 'fixed') &&
        sharePos !== 'sticky' &&
        sharePos !== 'fixed' &&
        mainTransform === 'none' &&
        sr.bottom <= window.innerHeight + 1 &&
        cr.bottom <= window.innerHeight + 1 &&
        cr.top >= 0
      );
    }, { timeout: 8000 });

    const geo = await page.evaluate(() => {
      const main = document.getElementById('myTreesPageRoot');
      const sheet = document.getElementById('myTreesHubPanel');
      const ctas = document.querySelectorAll('#myTreesHubOpenBtn, a.my-trees-hub-open-btn');
      const cta = document.getElementById('myTreesHubOpenBtn');
      const share = document.getElementById('myTreesHubShareBtn');
      const edit = document.querySelector('#myTreesHubEditBtn, a[href*="mode=edit"]');
      const sr = sheet.getBoundingClientRect();
      const cr = cta.getBoundingClientRect();
      const sh = share.getBoundingClientRect();
      const cs = getComputedStyle(sheet);
      const ctaCs = getComputedStyle(cta);
      const shareCs = getComputedStyle(share);
      const mainCs = getComputedStyle(main);
      const summary = document.getElementById('myTreesHubSummary');
      const sum = summary ? summary.getBoundingClientRect() : null;
      const fullyVisible = (r) =>
        r.top >= -1 &&
        r.bottom <= window.innerHeight + 1 &&
        r.left >= -1 &&
        r.right <= window.innerWidth + 1 &&
        r.width > 0 &&
        r.height > 0;
      return {
        ctaCount: ctas.length,
        scrollTop: sheet.scrollTop,
        mainTransform: mainCs.transform,
        sheet: {
          top: sr.top,
          bottom: sr.bottom,
          height: sr.height,
          left: sr.left,
          right: sr.right,
          position: cs.position
        },
        cta: {
          top: cr.top,
          bottom: cr.bottom,
          left: cr.left,
          right: cr.right,
          position: ctaCs.position,
          fullyVisible: fullyVisible(cr)
        },
        share: {
          top: sh.top,
          bottom: sh.bottom,
          position: shareCs.position,
          visible: sh.top < innerHeight && sh.bottom > 0
        },
        viewportH: window.innerHeight,
        maxHeight: cs.maxHeight,
        overflowY: cs.overflowY,
        hasEdit: !!edit,
        href: cta.getAttribute('href') || '',
        modeEdit: (cta.getAttribute('href') || '').includes('mode=edit'),
        overflow: {
          documentScrollWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth
        },
        closeVisible: (() => {
          const close = document.getElementById('myTreesHubClose');
          if (!close) return false;
          const r = close.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
        })(),
        flowVisible: (() => {
          const flow = document.getElementById('myTreesHubFlow');
          if (!flow) return false;
          const r = flow.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0;
        })(),
        summaryTop: sum ? sum.top : null
      };
    });

    assert.equal(geo.ctaCount, 1, 'Exactly one appreciation CTA');
    assert.equal(geo.scrollTop, 0, 'Internal scrollTop must be 0 on initial open');
    assert.equal(geo.hasEdit, false, 'No direct Edit control');
    assert.equal(geo.modeEdit, false, 'CTA href must not include mode=edit');
    assert.match(geo.href, /\/pages\/editor\?treeId=/, 'CTA destination must be /pages/editor?treeId=...');
    assert.equal(geo.sheet.position, 'fixed', `Sheet must be position:fixed (got ${geo.sheet.position})`);
    assert.equal(geo.mainTransform, 'none',
      `Open sheet must neutralize page-transition transform on main (got ${geo.mainTransform})`);
    assert.ok(geo.cta.position === 'sticky' || geo.cta.position === 'fixed',
      `Primary CTA must be sticky/fixed (got ${geo.cta.position})`);
    assert.ok(geo.share.position !== 'sticky' && geo.share.position !== 'fixed',
      `Share must not be sticky/fixed (got ${geo.share.position})`);
    assert.equal(geo.share.position, 'static', `Share must remain position:static (got ${geo.share.position})`);
    assert.ok(parseFloat(geo.maxHeight) > 0 || /dvh|px/.test(geo.maxHeight), 'Sheet must keep max-height contract');
    assert.equal(geo.overflowY, 'auto', 'Sheet must keep overflow-y:auto');
    assert.ok(geo.sheet.bottom <= geo.viewportH + 1,
      `Sheet bottom (${geo.sheet.bottom}) must be <= viewport height (${geo.viewportH})`);
    assert.ok(geo.sheet.top >= -1,
      `Sheet top (${geo.sheet.top}) must be >= 0 (viewport-anchored, not shifted with main)`);
    assert.ok(geo.cta.top >= geo.sheet.top - 1, `CTA top (${geo.cta.top}) must be >= sheet top (${geo.sheet.top})`);
    assert.ok(geo.cta.bottom <= geo.viewportH + 1, `CTA bottom (${geo.cta.bottom}) must be <= viewport height (${geo.viewportH})`);
    assert.equal(geo.cta.fullyVisible, true,
      `CTA must be fully visible at scrollTop=0 (top=${geo.cta.top}, bottom=${geo.cta.bottom}, vh=${geo.viewportH})`);
    assert.ok(geo.cta.left >= geo.sheet.left - 1, 'CTA left within sheet');
    assert.ok(geo.cta.right <= geo.sheet.right + 1, 'CTA right within sheet');
    assert.equal(geo.overflow.documentScrollWidth, geo.overflow.documentClientWidth, 'No document-level horizontal overflow');
    assert.equal(geo.closeVisible, true, 'Close button must be visible');
    assert.equal(geo.flowVisible, true, 'Flow list must remain visible in initial open state');

    // DOM / focus order: open CTA then share (no CSS visual reverse).
    const order = await page.evaluate(() => {
      const cta = document.getElementById('myTreesHubOpenBtn');
      const share = document.getElementById('myTreesHubShareBtn');
      const ctaRect = cta.getBoundingClientRect();
      const shareRect = share.getBoundingClientRect();
      const domOpenBeforeShare = !!(cta.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING);
      cta.focus();
      const active1 = document.activeElement && document.activeElement.id;
      share.focus();
      const active2 = document.activeElement && document.activeElement.id;
      return {
        domOpenBeforeShare,
        ctaOrder: getComputedStyle(cta).order,
        shareOrder: getComputedStyle(share).order,
        activeAfterCtaFocus: active1,
        activeAfterShareFocus: active2,
        ctaTop: ctaRect.top,
        shareTop: shareRect.top
      };
    });
    assert.equal(order.domOpenBeforeShare, true, 'DOM order: open CTA before share');
    assert.ok(order.ctaOrder === '0' || order.ctaOrder === 'auto' || order.ctaOrder === '',
      `CTA must not use CSS order reordering (got ${order.ctaOrder})`);
    assert.ok(order.shareOrder === '0' || order.shareOrder === 'auto' || order.shareOrder === '',
      `Share must not use CSS order reordering (got ${order.shareOrder})`);
    assert.equal(order.activeAfterCtaFocus, 'myTreesHubOpenBtn', 'Focus on CTA stays on CTA');
    assert.equal(order.activeAfterShareFocus, 'myTreesHubShareBtn', 'Focus can move to share (DOM next interactive)');

    // Bottom scroll: summary above sticky CTA; share fully visible and not covered by CTA.
    const bottomGeo = await page.evaluate(() => {
      const sheet = document.getElementById('myTreesHubPanel');
      sheet.scrollTop = sheet.scrollHeight;
      const cta = document.getElementById('myTreesHubOpenBtn').getBoundingClientRect();
      const share = document.getElementById('myTreesHubShareBtn').getBoundingClientRect();
      const summary = document.getElementById('myTreesHubSummary').getBoundingClientRect();
      const social = document.getElementById('fixtureSocialBtn').getBoundingClientRect();
      const covered = (r, c) => r.top < c.bottom && r.bottom > c.top && r.left < c.right && r.right > c.left;
      return {
        scrollTop: sheet.scrollTop,
        ctaTop: cta.top,
        ctaBottom: cta.bottom,
        shareTop: share.top,
        shareBottom: share.bottom,
        shareFullyVisible: share.top >= 0 && share.bottom <= window.innerHeight + 1 && share.height > 0,
        shareNotCoveredByCta: !covered(share, cta) || (share.bottom <= cta.top + 1),
        summaryBottom: summary.bottom,
        summaryAboveCta: summary.bottom <= cta.top + 1,
        socialFullyVisible: social.top >= 0 && social.bottom <= window.innerHeight + 1 && social.height > 0,
        socialNotCoveredByCta: !covered(social, cta) || (social.bottom <= cta.top + 1),
        ctaStillSticky: getComputedStyle(document.getElementById('myTreesHubOpenBtn')).position,
        ctaStillVisible: cta.top >= 0 && cta.bottom <= window.innerHeight + 1,
        openAboveShareInFlow: true
      };
    });
    assert.ok(bottomGeo.scrollTop > 0, 'Sheet must allow internal scroll to bottom');
    assert.ok(bottomGeo.summaryAboveCta, 'Summary must scroll fully above sticky CTA');
    assert.ok(bottomGeo.shareFullyVisible, 'Share must be fully visible after bottom scroll');
    assert.ok(bottomGeo.shareNotCoveredByCta, 'Share must not be permanently covered by sticky CTA');
    assert.ok(bottomGeo.socialFullyVisible, 'Social slot content must be fully visible after bottom scroll');
    assert.ok(bottomGeo.socialNotCoveredByCta, 'Social slot must not be permanently covered by sticky CTA');
    assert.ok(bottomGeo.ctaStillSticky === 'sticky' || bottomGeo.ctaStillSticky === 'fixed',
      'CTA remains sticky/fixed after bottom scroll');
    assert.ok(bottomGeo.ctaStillVisible, 'CTA remains visible after bottom scroll');

    // Mid-scroll: DOM visual order open above share when both in content (CTA sticky may pin lower).
    const mid = await page.evaluate(() => {
      const sheet = document.getElementById('myTreesHubPanel');
      sheet.scrollTop = Math.floor(sheet.scrollHeight / 3);
      const cta = document.getElementById('myTreesHubOpenBtn');
      const share = document.getElementById('myTreesHubShareBtn');
      return {
        ctaOffsetTop: cta.offsetTop,
        shareOffsetTop: share.offsetTop
      };
    });
    assert.ok(mid.ctaOffsetTop < mid.shareOffsetTop, 'Layout offsetTop: open CTA above share (DOM order preserved)');

    // CTA click navigates once (same-tab navigation to editor href).
    await page.evaluate(() => { document.getElementById('myTreesHubPanel').scrollTop = 0; });
    let navCount = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('editor')) navCount += 1;
    });
    await page.locator('#myTreesHubOpenBtn').click({ force: true });
    try {
      await page.waitForURL((u) => u.pathname.includes('editor') || u.href.includes('editor'), { timeout: 5000 });
    } catch (_) {
      // fixture server has no editor page; navigation attempt still counts via href assignment
    }
    const after = page.url();
    assert.equal(
      after.includes('editor') || navCount >= 1 || after.includes('treeId=demo-tree-1'),
      true,
      `CTA click must navigate toward editor (url=${after}, navCount=${navCount})`
    );
    assert.equal(after.includes('mode=edit'), false, 'Navigation must not introduce mode=edit');

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3604 sheet close restores page-transition transform (not permanently removed)', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }

  // Start open, then close via body class removal (mirrors controller close path).
  const fixtureHtml = buildFixtureHtml({ sheetOpen: true, scrollLockY: 232 });
  const { server, port } = await startFixtureServer(fixtureHtml);

  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });

    const openState = await page.evaluate(() => {
      const main = document.getElementById('myTreesPageRoot');
      return {
        transform: getComputedStyle(main).transform,
        transition: getComputedStyle(main).transition
      };
    });
    assert.equal(openState.transform, 'none', 'While sheet open, main transform must be none');

    const closedState = await page.evaluate(() => {
      // Mirror controller close: remove preview-sheet-open and clear body top.
      document.body.classList.remove('preview-sheet-open');
      document.body.style.top = '';
      const sheet = document.getElementById('myTreesHubPanel');
      sheet.classList.remove('is-open');
      const main = document.getElementById('myTreesPageRoot');
      const cs = getComputedStyle(main);
      return {
        transform: cs.transform,
        transition: cs.transition,
        transitionProperty: cs.transitionProperty,
        opacity: cs.opacity
      };
    });

    // page-transitions.css .page-transition-enter.is-visible keeps translateY(0)
    // which computes to matrix(1,0,0,1,0,0) — NOT permanently stripped to none.
    assert.notEqual(
      closedState.transform,
      'none',
      `After close, page-transition transform must not stay permanently removed (got ${closedState.transform})`
    );
    assert.match(
      closedState.transform,
      /^matrix\(/,
      `After close, completed enter transform should remain as matrix (got ${closedState.transform})`
    );
    assert.ok(
      /transform/i.test(closedState.transition) || /transform/i.test(closedState.transitionProperty),
      `After close, transition involving transform must remain available (got transition=${closedState.transition})`
    );
    assert.equal(closedState.opacity, '1', 'Completed enter opacity must remain 1 after close');

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3604 desktop viewport does not sticky-pin primary CTA or share', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }

  const fixtureHtml = buildFixtureHtml({ sheetOpen: true, scrollLockY: 0 });
  const { server, port } = await startFixtureServer(fixtureHtml);

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);
    const desktop = await page.evaluate(() => {
      const cta = document.getElementById('myTreesHubOpenBtn');
      const share = document.getElementById('myTreesHubShareBtn');
      const sheet = document.getElementById('myTreesHubPanel');
      const main = document.getElementById('myTreesPageRoot');
      const scs = getComputedStyle(sheet);
      const mcs = getComputedStyle(main);
      return {
        ctaPosition: getComputedStyle(cta).position,
        sharePosition: getComputedStyle(share).position,
        sheetPosition: scs.position,
        sheetMaxHeight: scs.maxHeight,
        mainTransform: mcs.transform
      };
    });
    // At 1440px the mobile media query is inactive: sticky presentation must not apply.
    assert.ok(desktop.ctaPosition !== 'sticky' && desktop.ctaPosition !== 'fixed',
      `Desktop CTA must not be sticky/fixed (got ${desktop.ctaPosition})`);
    assert.ok(desktop.sharePosition !== 'sticky' && desktop.sharePosition !== 'fixed',
      `Desktop share must not be sticky/fixed (got ${desktop.sharePosition})`);
    assert.notEqual(desktop.sheetPosition, 'fixed', 'Desktop sheet must not use mobile fixed bottom-sheet position');
    // Desktop must not apply the mobile-only transform neutralization.
    assert.notEqual(desktop.mainTransform, 'none',
      `Desktop must keep page-transition transform (got ${desktop.mainTransform})`);

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});
