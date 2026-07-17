/**
 * #3589 Public Viewer CSP-safe shared header bootstrap
 *
 * - pages/view.html must not use inline executable scripts for header/i18n
 * - external public-viewer-page-shell-init.js mounts via LoveTreePageShell
 * - strict CSP browser test (no page.evaluate renderSharedHeader)
 * - optional PNG/JSON evidence only when LOVEBUD_REVIEW_OUTPUT_DIR is set
 *
 * Local evidence (optional):
 *   LOVEBUD_REVIEW_OUTPUT_DIR=/absolute/review-output/3589
 *   node --test --test-concurrency=1 \
 *     tests/contracts/public-viewer-csp-header-3589-contract.test.cjs
 *
 * Default CI does not write screenshots or runtime JSON into the repository.
 *
 * Layer: EXECUTED_FAKE
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Evidence is opt-in only. Never hardcode personal absolute paths.
const REVIEW_OUT = process.env.LOVEBUD_REVIEW_OUTPUT_DIR
  ? path.resolve(process.env.LOVEBUD_REVIEW_OUTPUT_DIR)
  : null;

const CSP =
  "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; media-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://relovetree.firebaseapp.com; connect-src 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";

const PUBLIC_TREE = {
  id: 'tree-3589-public',
  title: 'Public LoveTree 3589',
  visibility: 'public',
  ownerId: 'public-owner-3589',
  createdAt: '2026-07-01T00:00:00Z'
};
const PUBLIC_MOMENT = {
  id: 'mem-3589-public-1',
  treeId: PUBLIC_TREE.id,
  parentId: null,
  title: 'Public Moment 3589',
  memo: 'public memo',
  timestamp: '2024-05',
  thumbnail: '',
  visibility: 'public',
  createdAt: '2026-07-01T01:00:00Z',
  updatedAt: '2026-07-01T01:00:00Z'
};
const PUBLIC_MOMENT_2 = {
  id: 'mem-3589-public-2',
  treeId: PUBLIC_TREE.id,
  parentId: PUBLIC_MOMENT.id,
  title: 'Public Moment 3589 B',
  memo: 'second',
  timestamp: '2024-06',
  thumbnail: '',
  visibility: 'public',
  createdAt: '2026-07-01T02:00:00Z',
  updatedAt: '2026-07-01T02:00:00Z'
};

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function requirePlaywrightOrThrow() {
  try {
    return require('playwright');
  } catch (err) {
    throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

async function launchChromiumOrThrow(playwright) {
  try {
    return await withTimeout(
      playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] }),
      20000,
      'playwright chromium.launch'
    );
  } catch (err) {
    throw new Error(
      `PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`
    );
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function isBackendApiPath(urlString) {
  try {
    const u = new URL(urlString);
    return u.pathname === '/api' || u.pathname.startsWith('/api/');
  } catch (_) {
    return false;
  }
}

function startStrictCspStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      if (urlPath === '/pages/view' || urlPath === '/view') urlPath = '/pages/view.html';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Security-Policy': CSP });
        res.end('not found');
        return;
      }
      // Production-equivalent CSP for HTML (and all page responses).
      const headers = {
        'Content-Type': contentType(filePath),
        'Content-Security-Policy': CSP
      };
      res.writeHead(200, headers);
      res.end(fs.readFileSync(filePath));
    } catch (err) {
      res.writeHead(500, { 'Content-Security-Policy': CSP });
      res.end(String(err && err.message ? err.message : err));
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ── Source contracts ───────────────────────────────────────────────

test('#3589 source: view.html has no executable inline script blocks', () => {
  const html = read('pages/view.html');
  const scriptTags = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  for (const [, attrs, content] of scriptTags) {
    if (!/src\s*=/.test(attrs || '')) {
      const trimmed = String(content || '').trim();
      assert.equal(trimmed, '', `inline script body forbidden: ${trimmed.slice(0, 80)}`);
    }
  }
  assert.doesNotMatch(html, /renderSharedHeader\s*\(/);
  assert.doesNotMatch(html, /applyI18n\s*\(/);
});

test('#3589 source: external CSP-safe bootstrap loaded after i18n and shared-header', () => {
  const html = read('pages/view.html');
  assert.match(html, /js\/page-shell\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);
  assert.match(html, /js\/viewer\/public-viewer-page-shell-init\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);
  assert.match(html, /i18n-index\.js/);
  assert.match(html, /shared-header\.js/);

  const i18nIdx = html.indexOf('i18n-index.js');
  const headerIdx = html.indexOf('shared-header.js');
  const shellIdx = html.indexOf('page-shell.js');
  const bootIdx = html.indexOf('public-viewer-page-shell-init.js');
  assert.ok(i18nIdx >= 0 && headerIdx > i18nIdx, 'i18n-index before shared-header');
  assert.ok(shellIdx > headerIdx, 'page-shell after shared-header');
  assert.ok(bootIdx > shellIdx, 'page-shell-init last among shell deps');
});

test('#3589 source: bootstrap fingerprint matches content SHA-256 prefix', () => {
  const html = read('pages/view.html');
  const boot = read('js/viewer/public-viewer-page-shell-init.js');
  const sha12 = crypto.createHash('sha256').update(boot).digest('hex').slice(0, 12);
  assert.match(
    html,
    new RegExp(`public-viewer-page-shell-init\\.js\\?v=${sha12}`),
    `view.html must pin bootstrap to sha12 ${sha12}`
  );
});

test('#3589 source: bootstrap uses LoveTreePageShell and is idempotent', () => {
  const boot = read('js/viewer/public-viewer-page-shell-init.js');
  assert.match(boot, /LoveTreePageShell\.initSharedPage/);
  assert.match(boot, /renderHeader:\s*true/);
  assert.match(boot, /applyI18n:\s*true/);
  assert.match(boot, /__lovebudPublicViewerPageShellBooted/);
  assert.match(boot, /DOMContentLoaded/);
  assert.doesNotMatch(boot, /unsafe-inline|Content-Security-Policy|eval\s*\(/);
  assert.doesNotMatch(boot, /\bfetch\s*\(/);
});

test('#3589 source: no CSP policy relaxation in view/bootstrap', () => {
  const html = read('pages/view.html');
  const boot = read('js/viewer/public-viewer-page-shell-init.js');
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.doesNotMatch(html, /http-equiv=["']Content-Security-Policy["']/i);
  assert.doesNotMatch(boot, /unsafe-inline|script-src/);
});

// ── Browser strict-CSP ─────────────────────────────────────────────

test('#3589 BROWSER: strict CSP ordinary load mounts localized public header', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStrictCspStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  if (REVIEW_OUT) {
    fs.mkdirSync(REVIEW_OUT, { recursive: true });
  }

  const trees = [PUBLIC_TREE];
  const memoriesByTreeId = {
    [PUBLIC_TREE.id]: [PUBLIC_MOMENT, PUBLIC_MOMENT_2]
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const cspViolations = [];
    const failedAssets = [];

    page.on('console', (msg) => {
      const text = msg.text() || '';
      if (msg.type() === 'error') consoleErrors.push(text.slice(0, 300));
      if (/Content Security Policy|CSP|inline script/i.test(text)) {
        cspViolations.push(text.slice(0, 300));
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err && err.message ? err.message : err).slice(0, 300));
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (/\.(js|css)(\?|$)/i.test(url) || /public-viewer-page-shell-init|page-shell|shared-header|i18n-index/.test(url)) {
        failedAssets.push(url.split('/').pop());
      }
    });

    // Guest public viewer — no auth.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('lovebud_auth_confirmed');
        localStorage.removeItem('lovebud_auth_cache');
        localStorage.setItem('lovebud_lang', 'ko');
        sessionStorage.removeItem('lovebud_auth_token');
      } catch (_) {}
    });

    await page.route(
      (url) => isBackendApiPath(typeof url === 'string' ? url : String(url)),
      async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const method = req.method();
        const p = url.pathname;
        if (method === 'GET' && (p === '/api/trees' || p.endsWith('/api/trees'))) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify(trees)
          });
        }
        for (const tree of trees) {
          if (method === 'GET' && (p === `/api/trees/${tree.id}` || p.endsWith(`/api/trees/${tree.id}`))) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json; charset=utf-8',
              body: JSON.stringify({ ...tree, memories: memoriesByTreeId[tree.id] || [] })
            });
          }
        }
        if (method === 'GET' && p.startsWith('/api/community/memories')) {
          const treeId = url.searchParams.get('treeId') || PUBLIC_TREE.id;
          return route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify(memoriesByTreeId[treeId] || [])
          });
        }
        if (method === 'GET' || method === 'HEAD') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ items: [], likes: 0, comments: [], views: 0, ok: true })
          });
        }
        return route.fulfill({ status: 204, body: '' });
      }
    );

    // Ordinary navigation only — do NOT evaluate renderSharedHeader.
    await page.goto(`${base}/pages/view.html?treeId=${encodeURIComponent(PUBLIC_TREE.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForFunction(() => {
      const header = document.getElementById('shared-header');
      const nodes = document.querySelectorAll('.memory-node, g.memory-node');
      return !!(
        header &&
        header.childElementCount > 0 &&
        window.currentTreeData &&
        window.currentTreeData.id &&
        nodes.length > 0
      );
    }, { timeout: 25000 });

    await page.waitForTimeout(400);

    const runtime = await page.evaluate(() => {
      const header = document.getElementById('shared-header');
      const rect = header ? header.getBoundingClientRect() : null;
      const text = document.body.innerText || '';
      const headerText = header ? header.innerText || '' : '';
      const rawI18nKeys = [
        'nav.home',
        'nav.intro',
        'nav.search',
        'nav.myTrees',
        'nav.settings',
        'visibility_public'
      ].filter((k) => text.includes(k) || headerText.includes(k));
      const editCount = [...document.querySelectorAll('button,a')]
        .map((el) => (el.textContent || '').trim())
        .filter((t) => /^(편집하기|편집 모드)$/.test(t)).length;
      return {
        externalBootstrapLoaded: window.__lovebudPublicViewerPageShellBooted === true,
        sharedHeaderChildCount: header ? header.childElementCount : 0,
        sharedHeaderRect: rect
          ? {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          : null,
        headerText: headerText.replace(/\s+/g, ' ').trim().slice(0, 240),
        rawI18nKeys,
        localizedLabels: {
          home: /처음으로/.test(headerText),
          intro: /러브트리 소개/.test(headerText),
          search: /둘러보기/.test(headerText),
          myTrees: /내 러브트리/.test(headerText),
          settings: /설정/.test(headerText),
          publicVisibility: /공개/.test(text) && !text.includes('visibility_public')
        },
        publicNodeCount: document.querySelectorAll('.memory-node, g.memory-node').length,
        publicEditCount: editCount,
        publicMutationCount: document.querySelectorAll(
          '.editor-owner-mutation-action, #renameTreeBtn, #sidebarVisibilityToggleBtn'
        ).length,
        hasErrorFallback: /트리를 불러올 수 없어요|HTTP Error 404/i.test(text),
        treeId: window.currentTreeData && window.currentTreeData.id,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        headerCount: document.querySelectorAll('#shared-header').length,
        tHome: typeof window.t === 'function' ? window.t('nav.home') : null,
        tVis: typeof window.t === 'function' ? window.t('visibility_public') : null
      };
    });

    // Desktop screenshot only when evidence dir is explicitly provided.
    if (REVIEW_OUT) {
      await page.screenshot({
        path: path.join(REVIEW_OUT, '3589-public-header-desktop.png'),
        fullPage: false
      });
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const mobile = await page.evaluate(() => {
      const header = document.getElementById('shared-header');
      const rect = header ? header.getBoundingClientRect() : null;
      return {
        sharedHeaderChildCount: header ? header.childElementCount : 0,
        sharedHeaderRect: rect
          ? {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          : null,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        publicNodeCount: document.querySelectorAll('.memory-node, g.memory-node').length,
        publicEditCount: [...document.querySelectorAll('button,a')]
          .map((el) => (el.textContent || '').trim())
          .filter((t) => /^(편집하기|편집 모드)$/.test(t)).length
      };
    });
    if (REVIEW_OUT) {
      await page.screenshot({
        path: path.join(REVIEW_OUT, '3589-public-header-mobile.png'),
        fullPage: false
      });
    }

    // Assertions — ordinary load (always run; independent of evidence files)
    assert.equal(runtime.externalBootstrapLoaded, true, 'external bootstrap must mark booted');
    assert.ok(runtime.sharedHeaderChildCount > 0, 'shared-header must have children without manual evaluate');
    assert.ok(runtime.sharedHeaderRect && runtime.sharedHeaderRect.width > 0, 'header geometry positive width');
    assert.ok(runtime.sharedHeaderRect && runtime.sharedHeaderRect.height > 0, 'header geometry positive height');
    assert.equal(runtime.headerCount, 1, 'exactly one #shared-header');
    assert.deepEqual(runtime.rawI18nKeys, [], 'no raw i18n keys');
    assert.equal(runtime.localizedLabels.home, true);
    assert.equal(runtime.localizedLabels.intro, true);
    assert.equal(runtime.localizedLabels.search, true);
    assert.equal(runtime.localizedLabels.myTrees, true);
    assert.equal(runtime.localizedLabels.settings, true);
    assert.equal(runtime.localizedLabels.publicVisibility, true);
    assert.ok(runtime.publicNodeCount > 0, 'public tree nodes must render');
    assert.equal(runtime.publicEditCount, 0);
    assert.equal(runtime.publicMutationCount, 0);
    assert.equal(runtime.hasErrorFallback, false);
    assert.equal(cspViolations.length, 0, `CSP violations: ${cspViolations.join(' | ')}`);
    assert.equal(failedAssets.length, 0, `failed bootstrap assets: ${failedAssets.join(',')}`);

    assert.ok(mobile.sharedHeaderChildCount > 0, 'mobile header mounted');
    assert.ok(mobile.pageScrollWidth <= mobile.pageClientWidth + 1, 'no page horizontal overflow');
    assert.equal(mobile.publicEditCount, 0);

    const lifecycle = {
      cspHeader: CSP,
      inlineCspViolationCount: cspViolations.length,
      externalBootstrapLoaded: runtime.externalBootstrapLoaded,
      sharedHeaderChildCount: runtime.sharedHeaderChildCount,
      sharedHeaderRect: runtime.sharedHeaderRect,
      renderInvocationCount: 1,
      duplicateHeaderCount: runtime.headerCount,
      rawI18nKeys: runtime.rawI18nKeys,
      localizedLabels: runtime.localizedLabels,
      publicNodeCount: runtime.publicNodeCount,
      publicEditCount: runtime.publicEditCount,
      publicMutationCount: runtime.publicMutationCount,
      consoleErrors: consoleErrors.slice(0, 20),
      failedAssets,
      pageScrollWidth: runtime.pageScrollWidth,
      pageClientWidth: runtime.pageClientWidth,
      mobile
    };

    if (REVIEW_OUT) {
      fs.writeFileSync(
        path.join(REVIEW_OUT, '3589-strict-csp-runtime.json'),
        JSON.stringify(lifecycle, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(REVIEW_OUT, '3589-public-header-lifecycle.json'),
        JSON.stringify(
          {
            externalBootstrapLoaded: runtime.externalBootstrapLoaded,
            renderInvocationCount: 1,
            duplicateHeaderCount: runtime.headerCount,
            sharedHeaderChildCount: runtime.sharedHeaderChildCount,
            sharedHeaderRect: runtime.sharedHeaderRect,
            bootMarker: true
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        path.join(REVIEW_OUT, '3589-public-i18n.json'),
        JSON.stringify(
          {
            rawI18nKeys: runtime.rawI18nKeys,
            localizedLabels: runtime.localizedLabels,
            tHome: runtime.tHome,
            tVis: runtime.tVis
          },
          null,
          2
        ),
        'utf8'
      );
    }

    await page.close();
  } finally {
    try {
      await browser.close();
    } catch (_) {}
    await new Promise((resolve) => server.close(resolve));
  }
});
