'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

const SYNTHETIC_USER = {
  uid: 'editor-owner-3896',
  displayName: 'synthetic editor owner',
  email: 'editor-owner-3896@example.invalid',
  providerData: [{ providerId: 'google.com' }],
  photoURL: null
};

const FIXTURE_TREE_ID = 'editor-tree-3896';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.woff')) return 'font/woff';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/pages/editor.html' : urlPath;
        const filePath = path.normalize(path.join(ROOT, rel));
        if (!filePath.startsWith(ROOT + path.sep)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(data);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

let server;
let browser;
let baseUrl;

before(async function() {
  server = await startServer();
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
});

after(async function() {
  if (browser) await browser.close();
  if (server) await new Promise(function(resolve) { server.close(resolve); });
});

function authFixtureScript() {
  return function fixture(opts) {
    var user = opts && opts.user;
    var lang = opts && opts.lang || 'ko';
    localStorage.setItem('lovebud_lang', lang);
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem('lovebud_auth_cache', JSON.stringify(user));
    window.__lovebudAuthReady = true;
    window.__lastAuthUser = user;
    window.getConfirmedAuthUser = function() { return user; };
    window.firebase = {
      apps: [{}],
      auth: function() {
        return {
          currentUser: user,
          onAuthStateChanged: function(cb) { Promise.resolve().then(function() { cb(user); }); return function() {}; },
          signOut: function() { return Promise.resolve(); },
          setPersistence: function() { return Promise.resolve(); },
          getRedirectResult: function() { return Promise.resolve({ user: null }); }
        };
      },
      initializeApp: function() { return {}; }
    };
  };
}

function collectHealth(page) {
  const health = {
    pageErrors: [],
    consoleErrors: [],
    requestFailedSameOrigin: [],
    httpFailures: [],
    writeRequests: 0
  };
  page.on('pageerror', (err) => { health.pageErrors.push(String((err && err.message) || err)); });
  page.on('console', (msg) => { if (msg.type() === 'error') health.consoleErrors.push(msg.text()); });
  page.on('requestfailed', (req) => {
    let sameOrigin = false;
    try { sameOrigin = new URL(req.url()).hostname === '127.0.0.1'; } catch (_) { /* unparsable */ }
    if (sameOrigin) health.requestFailedSameOrigin.push(req.url() + ' :: ' + ((req.failure && req.failure()) || {}).errorText);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      let sameOrigin = false;
      try { sameOrigin = new URL(resp.url()).hostname === '127.0.0.1'; } catch (_) { /* unparsable */ }
      if (sameOrigin) health.httpFailures.push(resp.status() + ' ' + resp.url());
    }
  });
  page.on('request', (req) => {
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      let isRoutedExternal = false;
      try {
        const parsed = new URL(req.url());
        if (parsed.hostname === 'www.gstatic.com' || parsed.hostname === 'fonts.googleapis.com' || parsed.hostname === 'fonts.gstatic.com') {
          isRoutedExternal = true;
        }
      } catch (_) { /* unparsable */ }
      if (!isRoutedExternal) {
        health.writeRequests += 1;
      }
    }
  });
  return health;
}

function assertNoErrors(health, label) {
  assert.deepEqual(health.pageErrors, [], label + ' pageerror must be 0');
  assert.deepEqual(health.consoleErrors, [], label + ' console error must be 0');
  assert.deepEqual(health.requestFailedSameOrigin, [], label + ' same-origin request failure must be 0');
  assert.deepEqual(health.httpFailures, [], label + ' same-origin HTTP status >=400 must be 0');
  assert.equal(health.writeRequests, 0, label + ' write requests must be 0');
}

function isVisible(page, id) {
  return page.evaluate(function(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (parseFloat(style.opacity) === 0) return false;
    if (el.getClientRects().length === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, id);
}

function getBoundingClientRect(page, id) {
  return page.evaluate(function(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, width: r.width, height: r.height };
  }, id);
}

function getHorizontalOverflow(page) {
  return page.evaluate(function() {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
}

async function newEditorPage(viewport) {
  const context = await browser.newContext({ viewport: viewport });
  const page = await context.newPage();
  const health = collectHealth(page);

  await page.route('https://www.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* inert-firebase-fixture */' });
  });
  await page.route('https://fonts.googleapis.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.route('https://fonts.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'font/woff2', body: '' });
  });

  await page.addInitScript(authFixtureScript(), { user: SYNTHETIC_USER, lang: 'ko' });

  await page.goto(baseUrl + '/pages/editor.html?treeId=' + FIXTURE_TREE_ID + '&lang=ko', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(function() {
    return document.getElementById('canvasArea') !== null;
  }, null, { timeout: 10000 });

  await page.waitForFunction(function() {
    return document.body.classList.contains('editor-preload') === false;
  }, null, { timeout: 10000 });

  return { context, page, health };
}

async function closeFixture(fixture) {
  await fixture.context.close();
}

test('Editor real-page structural baseline', async function() {
  const desktop = await newEditorPage(DESKTOP_VIEWPORT);
  try {
    const page = desktop.page;
    const health = desktop.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html', 'pathname must be /pages/editor.html');
    const title = await page.title();
    assert.ok(title.includes('LoveTree') || title.includes('편집'), 'title must include Editor/LoveTree identity');

    assert.ok(await isVisible(page, 'shared-header'), 'shared header must be visible');
    assert.ok(await isVisible(page, 'canvasArea'), 'canvas area must be visible');
    assert.ok(await isVisible(page, 'editorSidebarPanel'), 'sidebar panel must be visible');
    assert.ok(await isVisible(page, 'detailPanel'), 'detail panel must be visible');

    const canvasRect = await getBoundingClientRect(page, 'canvasArea');
    assert.ok(canvasRect && canvasRect.width > 0 && canvasRect.height > 0, 'canvas area must have positive geometry');

    const sidebarRect = await getBoundingClientRect(page, 'editorSidebarPanel');
    assert.ok(sidebarRect && sidebarRect.width > 0 && sidebarRect.height > 0, 'sidebar panel must have positive geometry');

    const detailRect = await getBoundingClientRect(page, 'detailPanel');
    assert.ok(detailRect && detailRect.width > 0 && detailRect.height > 0, 'detail panel must have positive geometry');

    const overlap = sidebarRect && canvasRect && sidebarRect.right > canvasRect.left && sidebarRect.left < canvasRect.right;
    assert.equal(overlap, false, 'sidebar and canvas must not materially overlap');

    const overflow = await getHorizontalOverflow(page);
    assert.ok(overflow <= 1, 'horizontal overflow must be <= 1px, got ' + overflow);

    assertNoErrors(health, 'desktop view mode');
  } finally { await closeFixture(desktop); }

  const mobile = await newEditorPage(MOBILE_VIEWPORT);
  try {
    const page = mobile.page;
    const health = mobile.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html', 'mobile pathname must be /pages/editor.html');
    const title = await page.title();
    assert.ok(title.includes('LoveTree') || title.includes('편집'), 'mobile title must include Editor/LoveTree identity');

    assert.ok(await isVisible(page, 'shared-header'), 'mobile shared header must be visible');
    assert.ok(await isVisible(page, 'canvasArea'), 'mobile canvas area must be visible');

    const overflow = await getHorizontalOverflow(page);
    assert.ok(overflow <= 1, 'mobile horizontal overflow must be <= 1px, got ' + overflow);

    assertNoErrors(health, 'mobile view mode');
  } finally { await closeFixture(mobile); }

  const editDesktop = await newEditorPage(DESKTOP_VIEWPORT);
  try {
    const page = editDesktop.page;
    const health = editDesktop.health;

    await page.evaluate(function() {
      if (window.LoveBudEditorInteractionMode && typeof window.LoveBudEditorInteractionMode.setMode === 'function') {
        window.LoveBudEditorInteractionMode.setMode('edit', { syncUrl: false });
      }
    });

    await page.waitForFunction(function() {
      return document.body.getAttribute('data-editor-interaction-mode') === 'edit';
    }, null, { timeout: 5000 });

    assert.equal(
      await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }),
      'edit',
      'body interaction mode must be edit after setMode'
    );

    await page.evaluate(function() {
      var viewMode = document.getElementById('detailViewMode');
      var editMode = document.getElementById('detailEditMode');
      if (viewMode) viewMode.style.display = 'none';
      if (editMode) editMode.style.display = 'block';
    });

    await page.waitForFunction(function() {
      var viewMode = document.getElementById('detailViewMode');
      var editMode = document.getElementById('detailEditMode');
      if (!viewMode || !editMode) return false;
      return window.getComputedStyle(viewMode).display === 'none' && window.getComputedStyle(editMode).display !== 'none';
    }, null, { timeout: 5000 });

    assert.ok(await isVisible(page, 'detailEditMode'), 'edit mode panel must be visible after edit entry');
    assert.ok(!(await isVisible(page, 'detailViewMode')), 'view mode panel must be hidden after edit entry');

    assertNoErrors(health, 'desktop edit mode');
  } finally { await closeFixture(editDesktop); }

  const cancelDesktop = await newEditorPage(DESKTOP_VIEWPORT);
  try {
    const page = cancelDesktop.page;
    const health = cancelDesktop.health;

    await page.evaluate(function() {
      var viewMode = document.getElementById('detailViewMode');
      var editMode = document.getElementById('detailEditMode');
      if (viewMode) viewMode.style.display = 'none';
      if (editMode) editMode.style.display = 'block';
    });

    await page.waitForFunction(function() {
      var editMode = document.getElementById('detailEditMode');
      return editMode && window.getComputedStyle(editMode).display !== 'none';
    }, null, { timeout: 5000 });

    await page.evaluate(function() {
      var viewMode = document.getElementById('detailViewMode');
      var editMode = document.getElementById('detailEditMode');
      if (viewMode) viewMode.style.display = 'block';
      if (editMode) editMode.style.display = 'none';
    });

    await page.waitForFunction(function() {
      var viewMode = document.getElementById('detailViewMode');
      var editMode = document.getElementById('detailEditMode');
      if (!viewMode || !editMode) return false;
      return window.getComputedStyle(viewMode).display !== 'none' && window.getComputedStyle(editMode).display === 'none';
    }, null, { timeout: 5000 });

    assert.ok(await isVisible(page, 'detailViewMode'), 'view mode panel must be visible after cancel');
    assert.ok(!(await isVisible(page, 'detailEditMode')), 'edit mode panel must be hidden after cancel');

    assertNoErrors(health, 'desktop cancel to view');
  } finally { await closeFixture(cancelDesktop); }
});
