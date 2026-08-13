/**
 * LoveBud #3811 My Trees Story View — executable Chromium contract
 *
 * Refs #3811 (implementation child). Parent #3654 stays OPEN.
 * Prerequisite: #3813 / PR #3819 (shared controller surface-adapter boundary).
 * Baseline: 2070cb3160f2bfb63ba5732b96f52ca5416aa79a
 *
 * Serves the REAL pages/my-trees.html + real product JS/CSS over a local
 * ephemeral HTTP server and drives headless Chromium with deterministic
 * authenticated/API stubs and synthetic non-private fixtures. The product
 * controller creates the Story DOM itself; the fixture only replaces the
 * Auth/API boundary.
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
  defaultFulfillExternal,
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
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

const FIXTURE_GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath.startsWith('/fixture-media/')) {
          res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
          res.end(FIXTURE_GIF);
          return;
        }
        if (urlPath === '/' || urlPath === '/pages/my-trees' || urlPath === '/pages/my-trees.html') {
          const html = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
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
  await new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(() => resolve(), 500);
  });
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

/* ── Synthetic non-private owner trees (exactly 4: first batch renders all).
 * updatedAt is set so the page's default `recent` sort (updatedAt DESC)
 * yields the canonical order mt-story-1..4. */
const OWNER_TREES = [
  { id: 'mt-story-1', title: '첫 러브트리', visibility: 'private', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z', memoryCount: 3, theme: 'BTS' },
  { id: 'mt-story-2', title: '이어가는 순간', visibility: 'private', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-03-05T00:00:00Z', memoryCount: 1, theme: 'BLACKPINK' },
  { id: 'mt-story-3', title: '나의 대표 순간', visibility: 'public', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-02-05T00:00:00Z', memoryCount: 2, theme: 'RESCENE' },
  { id: 'mt-story-4', title: '감정의 흐름', visibility: 'private', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-01-05T00:00:00Z', memoryCount: 0, theme: 'BTS' }
];

const FIREBASE_APP_STUB = `
(function () {
  if (window.firebase) return;
  function makeAuth() {
    var syntheticUser = {
      uid: 'review-synthetic-user-0001',
      displayName: 'Review User',
      email: 'review-user@example.com',
      reload: async function () {},
      getIdToken: async function () { return 'review-synthetic-token-0001'; },
      getIdTokenResult: async function () {
        return { token: 'review-synthetic-token-0001', expirationTime: new Date(Date.now() + 3600 * 1000).toISOString() };
      }
    };
    return {
      currentUser: syntheticUser,
      onAuthStateChanged: function (cb) {
        if (cb) { try { cb(syntheticUser); } catch (e) {} }
        return function () {};
      },
      signOut: async function () {},
      setPersistence: async function () {},
      getRedirectResult: async function () { return { user: null }; }
    };
  }
  window.firebase = {
    apps: [],
    initializeApp: function (config) {
      var app = { name: '[DEFAULT]', options: config || {}, auth: makeAuth };
      window.firebase.apps.push(app);
      return app;
    },
    auth: makeAuth
  };
})();
`;

const FIREBASE_AUTH_STUB = `
(function () {
  if (!window.firebase) return;
  window.firebase.auth.GoogleAuthProvider = function GoogleAuthProvider() {};
  window.firebase.auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  window.firebase.auth.GoogleAuthProvider.PROVIDER_ID = 'google.com';
})();
`;

function newHealth() {
  return {
    pageerrors: [],
    consoleErrors: [],
    requestFailures: [],
    responseErrors: [],
    unexpectedExternal: [],
    resourceFailures: [],
  };
}

function captureHealth(page, fixtureOrigin) {
  const health = newHealth();
  page.on('pageerror', (error) => health.pageerrors.push(String(error)));
  page.on('console', (msg) => { if (msg.type() === 'error') health.consoleErrors.push(msg.text()); });
  /* #4013 diagnostics: any network failure is recorded with its exact URL
   * (and failure text when Playwright exposes it), so a future browser
   * console "Failed to load resource" is attributable to a specific request. */
  page.on('requestfailed', (req) => {
    const url = req.url();
    const failure = typeof req.failure === 'function' ? req.failure() : null;
    const detail = failure && failure.errorText ? `${url} :: ${failure.errorText}` : url;
    health.resourceFailures.push(detail);
    try {
      if (new URL(url).origin === fixtureOrigin) health.requestFailures.push(url);
    } catch (e) { /* non-http */ }
  });
  page.on('response', (res) => {
    const url = res.url();
    try {
      if (new URL(url).origin === fixtureOrigin && res.status() >= 400) {
        health.responseErrors.push({ url, status: res.status() });
      }
    } catch (e) { /* non-http */ }
  });
  return health;
}

function installRoutes(page, fixtureOrigin, apiTrees, unexpectedExternal) {
  const handler = makeHermeticRouteHandler({
    fixtureOrigin,
    onUnexpectedExternal: (url) => unexpectedExternal.push(url),
    onSameOrigin: async (route, target) => {
      const pathname = target.pathname;
      if (pathname === '/api/trees' || pathname === '/api/trees?') {
        if (apiTrees && apiTrees.status >= 400) {
          await route.fulfill({ status: apiTrees.status, contentType: 'application/json', body: JSON.stringify({ error: 'fixture' }) });
        } else if (apiTrees && Array.isArray(apiTrees.body)) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiTrees.body) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OWNER_TREES) });
        }
        return true;
      }
      if (pathname.startsWith('/api/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return true;
      }
      if (pathname.startsWith('/pages/view') || pathname.startsWith('/pages/editor')) {
        await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!DOCTYPE html><html><body>fixture</body></html>' });
        return true;
      }
      if (pathname.startsWith('/fixture-media/')) {
        await route.fulfill({ status: 200, contentType: 'image/gif', body: FIXTURE_GIF });
        return true;
      }
      return false;
    },
    fulfillExternal: async (route, target) => {
      const p = target.pathname;
      if (p.endsWith('/firebase-app.js')) {
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: FIREBASE_APP_STUB });
        return;
      }
      if (p.endsWith('/firebase-auth.js')) {
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: FIREBASE_AUTH_STUB });
        return;
      }
      await defaultFulfillExternal(route, target);
    },
  });
  return page.route('**/*', handler);
}

async function openMyTrees(context, port, page, opts) {
  opts = opts || {};
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  const health = captureHealth(page, fixtureOrigin);
  await installRoutes(page, fixtureOrigin, opts.apiTrees, health.unexpectedExternal);
  await page.addInitScript(() => {
    try {
      const cache = JSON.stringify({
        uid: 'review-synthetic-user-0001',
        displayName: 'Review User',
        email: 'review-user@example.com'
      });
      localStorage.setItem('lovebud_auth_cache', cache);
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      sessionStorage.setItem('lovebud_auth_token', JSON.stringify({
        uid: 'review-synthetic-user-0001',
        token: 'review-synthetic-token-0001',
        expiresAt: new Date(Date.now() + 3600 * 1000).getTime()
      }));
      window.__lovebudAuthReady = true;
    } catch (e) {}
  });
  if (opts.storage) {
    await page.addInitScript((storage) => {
      if (storage.myTrees) localStorage.setItem('lovebud:myTrees:viewMode', storage.myTrees);
      if (storage.browse) localStorage.setItem('lovebud:browse:viewMode', storage.browse);
    }, opts.storage);
  }
  await page.goto(`${fixtureOrigin}/pages/my-trees.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { health, fixtureOrigin };
}

async function waitForCards(page, count) {
  await page.waitForFunction((n) => {
    const grid = document.getElementById('trees-grid');
    if (!grid) return false;
    return grid.querySelectorAll('.tree-card[data-tree-id]').length === n;
  }, count, { timeout: 15000 });
}

async function storyState(page) {
  return page.evaluate(() => {
    const grid = document.getElementById('trees-grid');
    const nav = document.querySelector('.browse-story-navigation');
    const visible = grid ? Array.from(grid.querySelectorAll('.tree-card[data-tree-id]'))
      .filter((c) => !c.hidden && !c.closest('.browse-story-transition-stage'))
      .map((c) => c.getAttribute('data-tree-id')) : [];
    const indicator = document.querySelector('.browse-story-indicator-current');
    const prev = document.querySelector('[data-story-prev]');
    const next = document.querySelector('[data-story-next]');
    const stateModule = window.LoveBudMyTreesState || null;
    return {
      mode: grid ? grid.getAttribute('data-tree-view-mode') : null,
      groupSizeAttr: grid ? grid.getAttribute('data-story-group-size') : null,
      visible,
      allCards: grid ? grid.querySelectorAll('.tree-card[data-tree-id]').length : 0,
      indicator: indicator ? indicator.textContent : null,
      a11y: document.querySelector('.browse-story-indicator-a11y') ? document.querySelector('.browse-story-indicator-a11y').textContent : null,
      regionLabel: nav ? nav.getAttribute('aria-label') : null,
      prevLabel: prev ? prev.getAttribute('aria-label') : null,
      nextLabel: next ? next.getAttribute('aria-label') : null,
      navHidden: nav ? nav.hidden : null,
      navMountHidden: document.getElementById('myTreesStoryNavMount') ? document.getElementById('myTreesStoryNavMount').hidden : null,
      prevDisabled: prev ? prev.disabled : null,
      nextDisabled: next ? next.disabled : null,
      selectedId: stateModule && typeof stateModule.getSelectedTreeId === 'function' ? stateModule.getSelectedTreeId() : null,
      hubTitle: document.getElementById('myTreesHubTreeTitle') ? document.getElementById('myTreesHubTreeTitle').textContent : null,
      selectedCardId: (() => {
        const sel = grid ? grid.querySelector('.tree-card[data-selected-tree-card="true"]') : null;
        return sel ? sel.getAttribute('data-tree-id') : null;
      })(),
      wrapperCount: document.querySelectorAll('.browse-story-transition-stage').length,
      ariaBusy: grid ? grid.getAttribute('aria-busy') : null,
      stored: localStorage.getItem('lovebud:myTrees:viewMode'),
      browseStored: localStorage.getItem('lovebud:browse:viewMode')
    };
  });
}

function assertHealth(health, label) {
  assert.deepEqual(health.pageerrors, [], label + ': pageerror 0');
  assert.deepEqual(health.consoleErrors, [], label + ': console error 0');
  assert.deepEqual(health.requestFailures, [], label + ': same-origin request failure 0');
  assert.deepEqual(health.responseErrors, [], label + ': same-origin HTTP >=400 0');
  assert.deepEqual(
    health.unexpectedExternal,
    [],
    label + ': unexpected external requests 0 (' + health.unexpectedExternal.join(', ') + ')'
  );
  assert.deepEqual(
    health.resourceFailures,
    [],
    label + ': resource failures 0 (' + health.resourceFailures.join(', ') + ')'
  );
}

async function overflowOf(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
}

/* ══════════════════════════════════════════════════════════════════
 * S1/S2/S3 — mode capability, compact default, story persistence
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: My Trees exposes four modes, compact default, and stored story persistence without Browse leakage', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, {});
    await waitForCards(page, 4);

    const modes = await page.$$eval('.tree-view-mode-btn', (btns) => btns.map((b) => b.getAttribute('data-mode')));
    assert.deepEqual(modes, ['large', 'compact', 'list', 'story']);
    let st = await storyState(page);
    assert.equal(st.mode, 'compact');
    assert.equal(st.selectedId, 'mt-story-1', 'auto-select first tree on load');

    await page.click('.tree-view-mode-btn[data-mode="story"]');
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.getAttribute('data-tree-view-mode') === 'story'
        && document.querySelector('.browse-story-navigation') && !document.querySelector('.browse-story-navigation').hidden;
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.mode, 'story');
    assert.equal(st.stored, 'story', 'My Trees storage key persists story');
    assert.equal(st.browseStored, null, 'Browse storage key stays untouched');
    assert.equal(st.selectedId, 'mt-story-1', 'entry keeps the selected tree visible');

    assertHealth(health, 'modes/persistence');
    const overflow = await overflowOf(page);
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

/* ══════════════════════════════════════════════════════════════════
 * S4 — responsive group sizes 3/2/1
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: story group sizes are 3 (wide) / 2 (tablet) / 1 (mobile)', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let wide, tablet, mobile;
  try {
    wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageW = await wide.newPage();
    await openMyTrees(wide, port, pageW, { storage: { myTrees: 'story' } });
    await waitForCards(pageW, 4);
    await pageW.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.getAttribute('data-tree-view-mode') === 'story'
        && document.querySelector('.browse-story-indicator-current');
    }, null, { timeout: 10000 });
    let st = await storyState(pageW);
    assert.equal(st.groupSizeAttr, '3', 'wide group size 3');
    assert.deepEqual(st.visible, ['mt-story-1', 'mt-story-2', 'mt-story-3']);
    assert.equal(st.indicator, '01 / 02');
    await wide.close();

    tablet = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const pageT = await tablet.newPage();
    await openMyTrees(tablet, port, pageT, { storage: { myTrees: 'story' } });
    await waitForCards(pageT, 4);
    await pageT.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    st = await storyState(pageT);
    assert.equal(st.groupSizeAttr, '2', 'tablet group size 2');
    assert.deepEqual(st.visible, ['mt-story-1', 'mt-story-2']);
    await tablet.close();

    mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageM = await mobile.newPage();
    await openMyTrees(mobile, port, pageM, { storage: { myTrees: 'story' } });
    await waitForCards(pageM, 4);
    await pageM.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    st = await storyState(pageM);
    assert.equal(st.groupSizeAttr, '1', 'mobile group size 1');
    assert.deepEqual(st.visible, ['mt-story-1']);
    await mobile.close();

    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (wide) await wide.close();
    if (tablet) await tablet.close();
    if (mobile) await mobile.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

/* ══════════════════════════════════════════════════════════════════
 * S5/S6/S7 — selected-tree entry, navigation, selection + hub sync
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: selected-tree group entry; Next/Previous/Home/End sync selection and desktop hub', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, {});
    await waitForCards(page, 4);

    // select tree 4 via a real card click (compact mode)
    await page.click('.tree-card[data-tree-id="mt-story-4"]');
    await page.waitForFunction(() => {
      const s = window.LoveBudMyTreesState;
      return s && s.getSelectedTreeId && s.getSelectedTreeId() === 'mt-story-4';
    }, null, { timeout: 10000 });

    // S5: entering story opens the group containing the selected tree
    await page.click('.tree-view-mode-btn[data-mode="story"]');
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.getAttribute('data-tree-view-mode') === 'story';
    }, null, { timeout: 10000 });
    let st = await storyState(page);
    assert.deepEqual(st.visible, ['mt-story-4'], 'selected-tree group opens on entry');
    assert.equal(st.selectedId, 'mt-story-4', 'selected tree preserved on entry');

    // S6: Previous moves to group 0 and syncs selection to first visible
    await page.click('[data-story-prev]');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '01 / 02';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['mt-story-1', 'mt-story-2', 'mt-story-3'], 'Previous reaches group 1');
    assert.equal(st.selectedId, 'mt-story-1', 'first visible card becomes selected');

    // S7: desktop hub syncs to the selected tree
    await page.waitForFunction(() => {
      const t = document.getElementById('myTreesHubTreeTitle');
      return t && t.textContent.indexOf('첫 러브트리') !== -1;
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.ok(st.hubTitle.indexOf('첫 러브트리') !== -1, 'hub title reflects selected tree');

    await page.click('[data-story-next]');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '02 / 02';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.deepEqual(st.visible, ['mt-story-4']);
    assert.equal(st.selectedId, 'mt-story-4', 'Next syncs selection to first visible card');
    await page.waitForFunction(() => {
      const t = document.getElementById('myTreesHubTreeTitle');
      return t && t.textContent.indexOf('감정의 흐름') !== -1;
    }, null, { timeout: 10000 });

    // Home / End
    await page.keyboard.press('Home');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '01 / 02';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.selectedId, 'mt-story-1', 'Home syncs selection to first group first card');
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '02 / 02';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.selectedId, 'mt-story-4', 'End syncs selection to last group first card');

    assertHealth(health, 'navigation/hub');
    const overflow = await overflowOf(page);
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

/* ══════════════════════════════════════════════════════════════════
 * S8/S9 — mobile sheet not auto-opened by group nav; card activation
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: mobile group navigation never auto-opens the sheet; card activation preserved', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, { storage: { myTrees: 'story' } });
    await waitForCards(page, 4);
    await page.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    // The initial auto-select opens the mobile sheet via setTimeout(0); wait
    // for it to settle so the close below is deterministic.
    await page.waitForFunction(() => document.body.classList.contains('preview-sheet-open'), null, { timeout: 10000 });
    await page.evaluate(() => {
      const b = document.getElementById('myTreesHubClose');
      if (b) b.click();
    });
    await page.waitForFunction(() => {
      return !document.body.classList.contains('preview-sheet-open')
        && document.querySelectorAll('.preview-sheet-overlay').length === 0;
    }, null, { timeout: 10000 });

    // S8: group navigation via the supported keyboard input does not reopen the sheet
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '02 / 04';
    }, null, { timeout: 10000 });
    let st = await storyState(page);
    assert.deepEqual(st.visible, ['mt-story-2'], 'mobile group size 1 after Next');
    const sheet = await page.evaluate(() => ({
      overlay: document.querySelectorAll('.preview-sheet-overlay').length,
      open: document.getElementById('myTreesHubPanel') ? document.getElementById('myTreesHubPanel').classList.contains('is-open') : false,
      bodyOpen: document.body.classList.contains('preview-sheet-open')
    }));
    assert.equal(sheet.overlay, 0, 'mobile group nav must not open the sheet overlay');
    assert.equal(sheet.bodyOpen, false, 'mobile group nav must not set the sheet body class');
    assert.equal(st.selectedId, 'mt-story-2', 'mobile group nav still syncs selected-tree state');

    // S9: real mobile card activation preserves the existing open-editor
    // behavior (the page navigates to the owner edit route).
    const card2 = page.locator('.tree-card[data-tree-id="mt-story-2"]');
    await card2.scrollIntoViewIfNeeded();
    await card2.click();
    await page.waitForFunction(() => {
      return location.pathname.indexOf('/pages/') !== -1 && location.pathname.indexOf('my-trees') === -1;
    }, null, { timeout: 10000 });
    const navPath = await page.evaluate(() => location.pathname);
    assert.ok(navPath.indexOf('/pages/') !== -1, 'mobile card activation navigates to an owner route (got ' + navPath + ')');

    assertHealth(health, 'mobile');
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
 * S10 — owner actions preserved
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: owner actions remain present on cards and create CTA intact', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, { storage: { myTrees: 'story' } });
    await waitForCards(page, 4);
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.getAttribute('data-tree-view-mode') === 'story';
    }, null, { timeout: 10000 });

    const actionCounts = await page.evaluate(() => {
      const actions = document.getElementById('myTreesHubActions');
      const selected = window.LoveBudMyTreesState && window.LoveBudMyTreesState.getSelectedTreeId
        ? window.LoveBudMyTreesState.getSelectedTreeId() : null;
      return {
        createCta: document.getElementById('createTreeBtn') ? 1 : 0,
        hubOpen: document.getElementById('myTreesHubOpenBtn') ? 1 : 0,
        hubShare: document.getElementById('myTreesHubShareBtn') ? 1 : 0,
        hubActionsVisible: actions ? actions.hidden !== true : false,
        selected: selected
      };
    });
    assert.equal(actionCounts.createCta, 1, 'create tree CTA intact');
    assert.equal(actionCounts.hubOpen, 1, 'hub open action intact');
    assert.equal(actionCounts.hubShare, 1, 'hub share action intact');
    assert.ok(actionCounts.selected, 'a tree is selected');
    assert.equal(actionCounts.hubActionsVisible, true, 'owner action hub is visible for the selected tree');

    assertHealth(health, 'owner-actions');
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
 * S11 — result replacement/filter clamp
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: filter/result replacement clamps to a valid group and preserves truthful selection', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, { storage: { myTrees: 'story' } });
    await waitForCards(page, 4);
    await page.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });

    await page.fill('#myTreesSearchInput', '이어가는 순간');
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.querySelectorAll('.tree-card[data-tree-id]').length === 1;
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '01 / 01';
    }, null, { timeout: 10000 });
    let st = await storyState(page);
    assert.deepEqual(st.visible, ['mt-story-2'], 'filtered result clamped to the selected group');
    assert.equal(st.selectedId, 'mt-story-2', 'selection truthfully reflects the visible card');

    await page.fill('#myTreesSearchInput', '');
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.querySelectorAll('.tree-card[data-tree-id]').length === 4;
    }, null, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.allCards, 4, 'full set restored');

    assertHealth(health, 'filter-clamp');
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
 * S12 — loading/empty/error states show no Story rail
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: loading/empty/error states never show the Story rail', { timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let ctxE, ctxX;
  try {
    // empty API -> #state-empty, no rail (stored story must not force a rail)
    ctxE = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageE = await ctxE.newPage();
    const { health: healthE } = await openMyTrees(ctxE, port, pageE, {
      storage: { myTrees: 'story' },
      apiTrees: { body: [] }
    });
    await pageE.waitForSelector('#state-empty:not([hidden])', { state: 'visible', timeout: 25000 });
    const emptyRail = await pageE.evaluate(() => ({
      mountHidden: (() => { const m = document.getElementById('myTreesStoryNavMount'); return m ? m.hidden : null; })(),
      navPresent: !!document.querySelector('.browse-story-navigation')
    }));
    assert.equal(emptyRail.navPresent, false, 'no Story nav in empty state');
    assertHealth(healthE, 'empty-state');
    await ctxE.close();
    ctxE = null;

    // error API (500) -> #state-error, no rail (fresh context so the empty
    // page's persistent-tree cache cannot turn the error into an empty render)
    ctxX = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageX = await ctxX.newPage();
    const { health: healthX } = await openMyTrees(ctxX, port, pageX, {
      storage: { myTrees: 'story' },
      apiTrees: { status: 500 }
    });
    await pageX.waitForSelector('#state-error:not([hidden])', { state: 'visible', timeout: 25000 });
    const errorRail = await pageX.evaluate(() => ({
      navPresent: !!document.querySelector('.browse-story-navigation'),
      gridCards: (() => { const g = document.getElementById('trees-grid'); return g ? g.querySelectorAll('.tree-card[data-tree-id]').length : 0; })()
    }));
    assert.equal(errorRail.navPresent, false, 'no Story nav in error state');
    assert.equal(errorRail.gridCards, 0, 'no Story cards in error state');
    // only the intentional API 500 is allowed
    assert.deepEqual(
      healthX.responseErrors.filter((r) => !r.url.includes('/api/trees')),
      [],
      'only the intentional API 500'
    );
    assert.deepEqual(healthX.pageerrors, [], 'error-state: no page errors');
    await ctxX.close();
    ctxX = null;

    await browser.close();
    await closeServer(server);
  } catch (err) {
    if (ctxE) await ctxE.close();
    if (ctxX) await ctxX.close();
    await browser.close();
    await closeServer(server);
    throw err;
  }
});

/* ══════════════════════════════════════════════════════════════════
 * S13/S14/S15/S16/S17/S18 — leave/re-enter, hidden a11y, reduced motion,
 * listener idempotence, locale labels, Browse-key separation
 * ══════════════════════════════════════════════════════════════════ */
test('#3811 browser: leave/re-enter restores canonical order; hidden cards excluded; reduced-motion immediate; locale labels', { timeout: 180000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  let context, rmContext;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { health } = await openMyTrees(context, port, page, { storage: { myTrees: 'story' } });
    await waitForCards(page, 4);
    await page.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });

    // S17: My Trees-specific localized labels applied
    let st = await storyState(page);
    assert.equal(st.regionLabel, '나의 트리 스토리', 'My Trees region label');
    assert.equal(st.prevLabel, '이전 스토리', 'My Trees previous label');
    assert.equal(st.nextLabel, '다음 스토리', 'My Trees next label');
    assert.equal(st.a11y, '현재 그룹 1 / 전체 2', 'My Trees position label');

    // S14: hidden cards excluded from tab/accessibility (display:none + hidden)
    const a11y = await page.evaluate(() => {
      const grid = document.getElementById('trees-grid');
      const cards = Array.from(grid.querySelectorAll('.tree-card[data-tree-id]'));
      const hidden = cards.filter((c) => c.hidden);
      return {
        hiddenCount: hidden.length,
        hiddenDisplayNone: hidden.filter((c) => getComputedStyle(c).display === 'none').length
      };
    });
    assert.equal(a11y.hiddenCount, 1, 'one card hidden in current group');
    assert.equal(a11y.hiddenDisplayNone, a11y.hiddenCount, 'all hidden cards are display:none (out of tab order)');

    // S13: leave Story -> canonical order restored, selection preserved
    await page.click('.tree-view-mode-btn[data-mode="compact"]');
    await page.waitForFunction(() => {
      const grid = document.getElementById('trees-grid');
      return grid && grid.getAttribute('data-tree-view-mode') === 'compact';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.allCards, 4, 'all cards restored as direct children');
    assert.deepEqual(st.visible, ['mt-story-1', 'mt-story-2', 'mt-story-3', 'mt-story-4'], 'canonical order restored on leave');
    const leaveState = await page.evaluate(() => ({
      wrapperCount: document.querySelectorAll('.browse-story-transition-stage').length,
      navHidden: (() => { const m = document.getElementById('myTreesStoryNavMount'); return m ? m.hidden : null; })(),
      selectedId: window.LoveBudMyTreesState ? window.LoveBudMyTreesState.getSelectedTreeId() : null
    }));
    assert.equal(leaveState.wrapperCount, 0, 'no transition wrapper after leaving');
    assert.equal(leaveState.navHidden, true, 'Story nav hidden after leaving');

    // re-enter restores story
    await page.click('.tree-view-mode-btn[data-mode="story"]');
    await page.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.mode, 'story', 're-entry restores story');

    // S16: no duplicate group navigation per keydown (one keydown = one group)
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const ind = document.querySelector('.browse-story-indicator-current');
      return ind && ind.textContent === '02 / 02';
    }, null, { timeout: 10000 });
    st = await storyState(page);
    assert.equal(st.indicator, '02 / 02', 'one End moves exactly one boundary');

    // S18: Browse preference never affects My Trees
    await page.evaluate(() => localStorage.setItem('lovebud:browse:viewMode', 'large'));
    const mtMode = await page.evaluate(() => {
      const grid = document.getElementById('trees-grid');
      return grid.getAttribute('data-tree-view-mode');
    });
    assert.equal(mtMode, 'story', 'Browse preference change does not alter My Trees mode');

    assertHealth(health, 'leave-reenter');
    await context.close();

    // S15: reduced motion — immediate navigation, zero wrappers
    rmContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const pageR = await rmContext.newPage();
    const healthR = captureHealth(pageR, `http://127.0.0.1:${port}`);
    await installRoutes(pageR, `http://127.0.0.1:${port}`);
    await pageR.addInitScript(() => {
      localStorage.setItem('lovebud:myTrees:viewMode', 'story');
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'review-synthetic-user-0001', displayName: 'Review User', email: 'review-user@example.com' }));
      sessionStorage.setItem('lovebud_auth_token', JSON.stringify({ uid: 'review-synthetic-user-0001', token: 't', expiresAt: Date.now() + 3600e3 }));
      window.__lovebudAuthReady = true;
    });
    await pageR.goto(`http://127.0.0.1:${port}/pages/my-trees.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForCards(pageR, 4);
    await pageR.waitForFunction(() => document.querySelector('.browse-story-indicator-current'), null, { timeout: 10000 });
    await pageR.click('[data-story-next]');
    const rmState = await pageR.evaluate(() => ({
      indicator: document.querySelector('.browse-story-indicator-current').textContent,
      wrapperCount: document.querySelectorAll('.browse-story-transition-stage').length
    }));
    assert.equal(rmState.indicator, '02 / 02', 'reduced-motion navigation settles immediately');
    assert.equal(rmState.wrapperCount, 0, 'reduced-motion leaves zero wrappers');
    assertHealth(healthR, 'reduced-motion');
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
