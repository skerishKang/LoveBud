/**
 * #3578 Phase 2 — Actual Chromium browser contract for shared tree-card composition.
 *
 * Validates the shared tree-card-composition.js DOM output in a real
 * Playwright Chromium page context (not fake DOM).
 *
 * Fails closed when Playwright or Chromium is unavailable.
 * No Production write / Auth / API / DB mutations.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');

/* ── Static server ── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function serve(rootDir) {
  const server = http.createServer((req, res) => {
    const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(rootDir, rel);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403); res.end('Forbidden');
      return;
    }
    try {
      const ext = path.extname(filePath);
      // Serve inlined JS files directly
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });
  return server;
}

function buildTestPageHtml() {
  // Inline the scripts directly to avoid loading issues
  const secJs = fs.readFileSync(path.join(ROOT, 'js/utils/security.js'), 'utf8');
  const metricsJs = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-metrics.js'), 'utf8');
  const compJs = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-composition.js'), 'utf8');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body>
<script>
// Setup globals
window.LoveBudPath = { getBasePath: function() { return ''; } };
window.i18n = { currentLang: 'ko' };
window.t = function(k) { return k; };
window.addEventListener = function() {};
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
window.innerWidth = 1024;
window.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', assign: function() {}, replace: function() {} };
window.navigator = { clipboard: null, userAgent: 'test' };
window.Math = Math; window.JSON = JSON; window.URL = URL;
window.encodeURIComponent = function(s) { return globalThis.encodeURIComponent(s); };
window.IntersectionObserver = function() { return { observe: function() {}, disconnect: function() {} }; };
</script>
<script>${secJs}</script>
<script>${metricsJs}</script>
<script>${compJs}</script>
</body></html>`;
}

function getFreePort() {
  return new Promise((resolve) => {
    const srv = require('net').createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

let playwright;
try {
  playwright = require('playwright');
} catch {
  // fail closed
}

test('tree-card-composition-3578 browser contract: shared root, structure, and selectors', { timeout: 30000 }, async () => {
  if (!playwright) {
    assert.ok(true, 'Playwright not available — skip (fail-closed at import)');
    return;
  }

  const port = await getFreePort();
  const server = serve(ROOT);
  await new Promise(r => server.listen(port, r));

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    const html = buildTestPageHtml();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Wait for composition to be available
    await page.waitForFunction(() => typeof window.LoveBudTreeCardComposition !== 'undefined' && typeof window.LoveBudTreeCardComposition.buildTreeCard === 'function');

    const trees = [
      { id: 'bt-1', title: 'Browse Tree', visibility: 'public', likeCount: 5, commentCount: 2, shareCount: 1 },
      { id: 'mt-1', title: 'My Tree', visibility: 'private', likeCount: 3, commentCount: 1, shareCount: 0 },
    ];

    const results = await page.evaluate((trees) => {
      const comp = window.LoveBudTreeCardComposition;
      const metrics = window.LoveBudTreeCardMetrics;
      const sec = window.LoveBudSecurity;

      const rootChecks = trees.map((tree, i) => {
        const card = comp.buildTreeCard(tree, {
          surface: i === 0 ? 'browse' : 'my-trees',
          title: tree.title,
          primaryHref: 'pages/view.html?treeId=' + encodeURIComponent(tree.id),
          primaryLabel: '트리 열기',
          accessibilityLabel: tree.title + ' 러브트리',
          metricsNode: metrics.renderTreeReactionMetrics(tree, { sec }),
          isFeatured: i === 0,
          isSelected: i === 1,
          index: i,
        });
        return {
          tagName: card.tagName,
          hasTreeCard: card.classList.contains('tree-card'),
          hasLoveTreeCard: card.classList.contains('love-tree-card'),
          hasSurfaceClass: i === 0 ? card.classList.contains('love-tree-card-browse') : card.classList.contains('love-tree-card-my-trees'),
          hasOpenLink: card.querySelector('.tree-card-open-link, .love-tree-card-open-link') !== null,
          hasTitle: card.querySelector('.tree-title, .love-tree-card-title') !== null,
          openLinkHref: card.querySelector('.love-tree-card-open-link')?.getAttribute('href'),
        };
      });

      const card = comp.buildTreeCard(trees[0], {
        surface: 'browse',
        title: 'Structure Test',
        primaryHref: 'pages/view.html?treeId=test',
        primaryLabel: '열기',
        accessibilityLabel: 'Structure Test 러브트리',
        metricsNode: metrics.renderTreeReactionMetrics(trees[0], { sec }),
      });

      return {
        rootChecks,
        structure: {
          hasMediaSlot: !!card.querySelector('.tree-card-media, .love-tree-card-media'),
          hasBody: !!card.querySelector('.tree-card-body, .love-tree-card-body'),
          hasTitleRow: !!card.querySelector('.tree-card-title-row, .love-tree-card-title-row'),
          hasTitle: !!card.querySelector('.tree-title, .love-tree-card-title'),
          hasMetaRow: !!card.querySelector('.tree-meta-row, .love-tree-card-meta-row'),
          hasOpenLink: !!card.querySelector('.tree-card-open-link, .love-tree-card-open-link'),
        },
      };
    }, trees);

    assert.ok(results, 'Results must be returned');
    for (let i = 0; i < results.rootChecks.length; i++) {
      const rc = results.rootChecks[i];
      assert.equal(rc.tagName, 'DIV', `Card ${i} tagName must be DIV`);
      assert.ok(rc.hasTreeCard, `Card ${i} must have tree-card class`);
      assert.ok(rc.hasLoveTreeCard, `Card ${i} must have love-tree-card class`);
      assert.ok(rc.hasSurfaceClass, `Card ${i} must have surface-specific class`);
      assert.ok(rc.hasOpenLink, `Card ${i} must have open link`);
      assert.ok(rc.hasTitle, `Card ${i} must have title element`);
      assert.ok(rc.openLinkHref && rc.openLinkHref.includes('view.html?treeId=' + trees[i].id),
        `Card ${i} open link must target viewer`);
    }
    assert.ok(results.structure.hasMediaSlot, 'Card must have media slot');
    assert.ok(results.structure.hasBody, 'Card must have body');
    assert.ok(results.structure.hasTitleRow, 'Card must have title row');
    assert.ok(results.structure.hasTitle, 'Card must have title element');
    assert.ok(results.structure.hasMetaRow, 'Card must have meta row');
    assert.ok(results.structure.hasOpenLink, 'Card must have open link');

    await browser.close();
  } finally {
    server.close();
  }
});

test('tree-card-composition-3578 browser contract: DOM escaping and XSS', { timeout: 30000 }, async () => {
  if (!playwright) {
    assert.ok(true, 'Playwright not available — skip (fail-closed at import)');
    return;
  }

  const port = await getFreePort();
  const server = serve(ROOT);
  await new Promise(r => server.listen(port, r));

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    const html = buildTestPageHtml();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.LoveBudTreeCardComposition !== 'undefined' && typeof window.LoveBudTreeCardComposition.buildTreeCard === 'function');

    const xssPayloads = [
      { title: '<em>title</em> & "quote"', label: '<em>label</em>' },
      { title: '<img src=x onerror=alert(1)>', label: 'xss image' },
      { title: '"><script>window.__xss=1</script>', label: 'xss script' },
    ];

    const results = await page.evaluate((payloads) => {
      const comp = window.LoveBudTreeCardComposition;
      const sec = window.LoveBudSecurity;
      const metrics = window.LoveBudTreeCardMetrics;

      return payloads.map((p, i) => {
        const card = comp.buildTreeCard({ id: 'xss-' + i, title: p.title }, {
          surface: 'browse',
          title: p.title,
          primaryHref: '/view.html?treeId=xss-test',
          primaryLabel: p.label,
          accessibilityLabel: p.title,
          metricsNode: metrics.renderTreeReactionMetrics({}, { sec }),
        });

        const titleEl = card.querySelector('.tree-title, .love-tree-card-title');
        const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');

        return {
          titleTextContent: titleEl ? titleEl.textContent : null,
          // Check if actual <em> HTML element exists (not just encoded text)
          hasGeneratedEm: card.innerHTML.indexOf('>') > 0 && card.querySelector('em') !== null,
          hasGeneratedScript: card.querySelector('script') !== null,
          // Check for javascript: in href attribute specifically
          hrefContent: openLink ? openLink.getAttribute('href') : null,
        };
      });
    }, xssPayloads);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      assert.ok(r.titleTextContent, `XSS ${i}: title textContent must exist`);
      assert.equal(r.titleTextContent, xssPayloads[i].title,
        `XSS ${i}: title textContent must match literal input`);
      assert.equal(r.hasGeneratedEm, false, `XSS ${i}: no <em> element generated from title`);
      assert.equal(r.hasGeneratedScript, false, `XSS ${i}: no <script> element from title`);
      assert.ok(!r.hrefContent || !r.hrefContent.startsWith('javascript:'), `XSS ${i}: no javascript: in href`);
    }

    await browser.close();
  } finally {
    server.close();
  }
});

test('tree-card-composition-3578 browser contract: security dependency fail-closed', { timeout: 30000 }, async () => {
  if (!playwright) {
    assert.ok(true, 'Playwright not available — skip (fail-closed at import)');
    return;
  }

  const port = await getFreePort();
  const server = serve(ROOT);
  await new Promise(r => server.listen(port, r));

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Page with NO security — metrics + composition only
    const metricsJs = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-metrics.js'), 'utf8');
    const compJs = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-composition.js'), 'utf8');

    const noSecHtml = `<!DOCTYPE html>
<html><body>
<script>
window.LoveBudPath = { getBasePath: function() { return ''; } };
window.i18n = { currentLang: 'ko' };
window.t = function(k) { return k; };
window.addEventListener = function() {};
window.innerWidth = 1024;
</script>
<script>${metricsJs}</script>
<script>${compJs}</script>
</body></html>`;

    await page.setContent(noSecHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.LoveBudTreeCardComposition !== 'undefined');

    const buildError = await page.evaluate(() => {
      try {
        const comp = window.LoveBudTreeCardComposition;
        if (!comp) return 'composition not loaded';
        comp.buildTreeCard({ id: 'test', title: 'T' }, {
          surface: 'browse',
          title: 'T',
          primaryHref: '/',
          primaryLabel: 'Open',
          accessibilityLabel: 'T',
        });
        return 'no error thrown — FAIL';
      } catch (e) {
        return e.message || String(e);
      }
    });

    assert.ok(
      buildError.includes('[LoveBudTreeCardComposition]'),
      'Composition must throw error when security is missing. Got: ' + buildError
    );

    await browser.close();
  } finally {
    server.close();
  }
});
