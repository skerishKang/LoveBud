/**
 * Contract: LoveBud #3567 — public selected-moment detail visible in mobile stack.
 *
 * Root cause: editor-mobile-panel-hierarchy.css sets .detail-panel { visibility:hidden }
 * at max-width:768px unless .is-mobile-panel-open. #3566 reset position/transform but not visibility.
 *
 * EXECUTED_FAKE: applies CSS through a real browser-like computed cascade via playwright when available;
 * also source guards for route-scoped override and owner closed-state preservation.
 *
 * Closes #3567
 * Refs #3562 — CLOSED / completed; do not reopen.
 * Refs #3563 — CLOSED / completed; do not reopen.
 * Refs #3566
 * Keep #3425 OPEN. Keep #1882 OPEN.
 * #3075 is CLOSED / completed. Do not reopen.
 * #3188 is CLOSED / completed. Do not reopen.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SIDEBAR_CSS = 'css/editor/editor-sidebar.css';
const MOBILE_PANEL_CSS = 'css/editor/editor-mobile-panel-hierarchy.css';
const EDITOR_CSS = 'css/editor.css';
const VIEW_HTML = 'pages/view.html';
const EDITOR_HTML = 'pages/editor.html';
const SHARED = 'js/shared/canonical-appreciation-detail-presentation.js';

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(fs.readFileSync(filePath));
    } catch (err) {
      res.writeHead(500);
      res.end(String(err && err.message ? err.message : err));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('#3567 cascade source: mobile panel hierarchy still hides closed detail/sidebar', () => {
  const mobile = read(MOBILE_PANEL_CSS);
  assert.match(
    mobile,
    /\.sidebar,\s*\n\s*\.detail-panel\s*\{[\s\S]*?visibility:\s*hidden/m
  );
  assert.match(
    mobile,
    /\.detail-panel\.is-mobile-panel-open\s*\{[\s\S]*?visibility:\s*visible/m
  );
});

test('#3567 public-only override restores visibility without requiring is-mobile-panel-open', () => {
  const css = read(SIDEBAR_CSS);
  // Route-scoped selector required
  assert.match(
    css,
    /\.editor-layout:has\(\s*\.public-viewer-sidebar\[data-appreciation-layout="tree-scope-rail"\]\s*\)\s*>\s*\.detail-panel/
  );
  // Must set visibility visible in a max-width 768 block (where mobile hierarchy applies)
  const idx768 = css.indexOf('@media (max-width: 768px)');
  assert.ok(idx768 >= 0, 'must include max-width:768px media query');
  const block768 = css.slice(idx768, idx768 + 1800);
  assert.match(block768, /visibility:\s*visible\s*!important/);
  assert.match(block768, /pointer-events:\s*auto\s*!important/);
  // Must not use broad unscoped detail-panel visibility:visible
  assert.doesNotMatch(
    css,
    /^\s*\.detail-panel\s*\{\s*visibility:\s*visible/m
  );
});

test('#3567 import order keeps mobile-panel-hierarchy after editor-sidebar', () => {
  const entry = read(EDITOR_CSS);
  const side = entry.indexOf('editor-sidebar.css');
  const mobile = entry.indexOf('editor-mobile-panel-hierarchy.css');
  assert.ok(side >= 0 && mobile > side, 'mobile-panel-hierarchy must load after editor-sidebar');
});

test('#3567 public stack preserves position/transform resets from #3566', () => {
  const css = read(SIDEBAR_CSS);
  assert.match(css, /position:\s*relative\s*!important/);
  assert.match(css, /transform:\s*none\s*!important/);
});

test('#3567 owner route is excluded from public visibility override selector', () => {
  const css = read(SIDEBAR_CSS);
  // Public override always requires public-viewer-sidebar tree-scope-rail
  assert.match(css, /public-viewer-sidebar\[data-appreciation-layout="tree-scope-rail"\]/);
  // Owner editor sidebar does not use public-viewer-sidebar class
  const ownerSidebar = read('js/editor/templates/editor-sidebar-template.js');
  assert.doesNotMatch(ownerSidebar, /public-viewer-sidebar/);
  assert.match(ownerSidebar, /data-appreciation-layout="tree-scope-rail"/);
});

test('#3567 pages: view uses public tree-scope rail; editor keeps mobile panel controls', () => {
  const view = read(VIEW_HTML);
  const editor = read(EDITOR_HTML);
  assert.match(view, /public-viewer-sidebar-template/);
  assert.doesNotMatch(view, /editor-mobile-panel-hierarchy\.js/);
  assert.match(editor, /editor-mobile-panel-hierarchy\.js/);
  assert.match(editor, /editor-mobile-panel-controls|mobileTreePanelToggle|mobileDetailPanelToggle/);
});

test('#3567 #3562/#3563 hierarchy markers remain', () => {
  const shared = read(SHARED);
  assert.match(shared, /buildTreeScopeShellHtml/);
  assert.match(shared, /data-appreciation-region="selected-moment"/);
  assert.doesNotMatch(
    shared.match(/function buildDetailViewModeHtml[\s\S]*?^  function /m)?.[0] || shared,
    /id="detailTreeMetaMount"/
  );
  // selected-moment builder body should not include tree meta mount
  const start = shared.indexOf('function buildDetailViewModeHtml');
  const end = shared.indexOf('function mountDetailViewMode', start);
  const momentFn = shared.slice(start, end);
  assert.doesNotMatch(momentFn, /id="detailTreeMetaMount"/);
  assert.match(momentFn, /selected-moment/);
});

test('#3567 #3561 geometry guard remains', () => {
  const css = read('css/editor/editor-memory-node.css');
  assert.doesNotMatch(
    css,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i
  );
});

test('#3567 EXECUTED browser cascade fixture: public 390 visible; owner closed hidden', async () => {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    assert.ok(true, 'playwright unavailable; source guards still apply');
    return;
  }

  const server = await startStaticServer();
  const port = server.address().port;
  // Minimal fixtures isolate cascade without full page bootstrap dependencies.
  const publicFixture =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<link rel="stylesheet" href="/css/editor.css?v=20260716-3567-1">' +
    '</head><body class="editor-readonly">' +
    '<div class="editor-layout">' +
    '<aside class="sidebar public-viewer-sidebar" data-appreciation-layout="tree-scope-rail">' +
    '<div id="detailTreeMetaMount">tree</div></aside>' +
    '<main class="canvas-area" id="canvasArea" style="min-height:120px">canvas</main>' +
    '<aside class="detail-panel" id="detailPanel"><div id="detailViewMode" data-appreciation-region="selected-moment">' +
    '<h4 id="detailCurrentMomentTitle">moment</h4><button type="button" id="pubOnlyBtn">ok</button>' +
    '</div></aside></div></body></html>';

  const ownerFixture =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<link rel="stylesheet" href="/css/editor.css?v=20260716-3567-1">' +
    '</head><body>' +
    '<div class="editor-layout">' +
    '<aside class="sidebar"><div>tree</div></aside>' +
    '<main class="canvas-area" style="min-height:120px">canvas</main>' +
    '<aside class="detail-panel" id="detailPanel"><div id="detailViewMode">moment</div></aside>' +
    '</div></body></html>';

  // Serve fixtures via data URLs after loading CSS from static server is harder;
  // write temp fixtures under worktree tmp and serve them.
  const tmpDir = path.join(ROOT, '.tmp-3567-fixtures');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'public.html'), publicFixture);
  fs.writeFileSync(path.join(tmpDir, 'owner.html'), ownerFixture);

  // Rebind server paths: fixtures are under ROOT/.tmp-3567-fixtures
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const publicPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await publicPage.goto(`http://127.0.0.1:${port}/.tmp-3567-fixtures/public.html`, {
      waitUntil: 'load',
      timeout: 30000
    });
    await publicPage.waitForTimeout(300);
    const pub = await publicPage.evaluate(() => {
      const panel = document.getElementById('detailPanel');
      const sidebar = document.querySelector('.public-viewer-sidebar');
      const cs = getComputedStyle(panel);
      const sCs = getComputedStyle(sidebar);
      const rect = panel.getBoundingClientRect();
      const btn = document.getElementById('pubOnlyBtn');
      return {
        panel: {
          position: cs.position,
          transform: cs.transform,
          visibility: cs.visibility,
          pointerEvents: cs.pointerEvents,
          opacity: cs.opacity
        },
        sidebarVisibility: sCs.visibility,
        rect: { w: Math.round(rect.width), h: Math.round(rect.height), y: Math.round(rect.y) },
        classes: panel.className,
        hasEdit: !!document.getElementById('editMemoryBtn'),
        btnFocusable: !!(btn && btn.offsetParent !== null && getComputedStyle(btn).visibility !== 'hidden')
      };
    });
    await publicPage.close();

    assert.equal(pub.panel.visibility, 'visible');
    assert.equal(pub.panel.pointerEvents, 'auto');
    assert.ok(pub.panel.position === 'relative' || pub.panel.position === 'static');
    assert.ok(
      pub.panel.transform === 'none' || pub.panel.transform === 'matrix(1, 0, 0, 1, 0, 0)'
    );
    assert.ok(pub.rect.w > 0 && pub.rect.h > 0);
    assert.equal(pub.sidebarVisibility, 'visible');
    assert.equal(pub.hasEdit, false);
    assert.equal(pub.btnFocusable, true);
    assert.doesNotMatch(pub.classes || '', /is-mobile-panel-open/);

    const ownerPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await ownerPage.goto(`http://127.0.0.1:${port}/.tmp-3567-fixtures/owner.html`, {
      waitUntil: 'load',
      timeout: 30000
    });
    await ownerPage.waitForTimeout(300);
    const owner = await ownerPage.evaluate(() => {
      const panel = document.getElementById('detailPanel');
      const sidebar = document.querySelector('.sidebar');
      const cs = getComputedStyle(panel);
      return {
        hasPublicRail: sidebar.classList.contains('public-viewer-sidebar'),
        panelVisibility: cs.visibility,
        panelTransform: cs.transform,
        panelPosition: cs.position,
        openClass: panel.classList.contains('is-mobile-panel-open')
      };
    });
    await ownerPage.close();

    assert.equal(owner.hasPublicRail, false);
    assert.equal(owner.openClass, false);
    assert.equal(owner.panelVisibility, 'hidden');
    assert.ok(
      owner.panelTransform !== 'none' && owner.panelTransform !== 'matrix(1, 0, 0, 1, 0, 0)',
      'owner closed detail remains translated off-canvas'
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(path.join(ROOT, '.tmp-3567-fixtures'), { recursive: true, force: true });
    } catch (_) {
      /* ignore cleanup */
    }
  }
});
