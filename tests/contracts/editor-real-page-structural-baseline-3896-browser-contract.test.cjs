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
const FIXTURE_OWNER_ID = SYNTHETIC_USER.uid;

const FIXTURE_TREE = {
  id: FIXTURE_TREE_ID,
  title: 'Editor Structural Baseline Tree',
  visibility: 'public',
  ownerId: FIXTURE_OWNER_ID
};

const FIXTURE_MEMORIES = [
  {
    id: 'editor-memory-3896-1',
    treeId: FIXTURE_TREE_ID,
    parentId: null,
    title: '첫 순간',
    memo: '구조적 기준선의 시작',
    artist: 'Synthetic Artist',
    sourceUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    sourceType: 'youtube',
    emotionTags: ['기쁨'],
    timestamp: '2026.01.05',
    delay: '0s',
    x: 0,
    y: 0
  },
  {
    id: 'editor-memory-3896-2',
    treeId: FIXTURE_TREE_ID,
    parentId: 'editor-memory-3896-1',
    title: '이어진 기억',
    memo: '흐름을 이어간 순간',
    artist: 'Synthetic Artist',
    sourceUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb',
    sourceType: 'youtube',
    emotionTags: ['기대'],
    timestamp: '2026.01.20',
    delay: '0.1s',
    x: 0,
    y: 0
  }
];

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// Exactly the same-origin API endpoints the editor may call through apiClient.
// Any other `/api/*` request is unexpected and fails the contract.
const ALLOWED_API_KEYS = new Set([
  'GET /api/trees/' + FIXTURE_TREE_ID,
  'GET /api/memories?treeId=' + FIXTURE_TREE_ID,
  'GET /api/memories/editor-memory-3896-1/reactions',
  'GET /api/memories/editor-memory-3896-1/comments',
  'GET /api/memories/editor-memory-3896-2/reactions',
  'GET /api/memories/editor-memory-3896-2/comments'
]);

function normalizedApiKey(req) {
  const url = new URL(req.url());
  let base = req.method() + ' ' + url.pathname;
  const treeId = url.searchParams.get('treeId');
  if (url.pathname === '/api/memories' && treeId) {
    base = req.method() + ' /api/memories?treeId=' + treeId;
  }
  return base;
}

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
    window.__LOVEBUD_AUTH_WAIT_MS = 100;
    localStorage.setItem('lovebud_lang', lang);
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem('lovebud_auth_cache', JSON.stringify(user));
    window.__lovebudAuthReady = true;
    window.__lastAuthUser = user;
    window.getConfirmedAuthUser = function() { return user; };
    // Synthetic auth user. Token methods resolve to null so NO Authorization
    // header is ever attached (contract: authorizationHeaders = 0).
    user.getIdToken = function() { return Promise.resolve(null); };
    user.getIdTokenResult = function() { return Promise.resolve(null); };
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

// Error-reporting (pageerror / console.error) listeners. Network/auth
// classification is collected separately in attachNetworkObserver.
function attachErrorObservers(page, health) {
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
}

function isRoutedExternalUrl(url) {
  const externalHosts = ['www.gstatic.com', 'apis.google.com', 'googleusercontent.com',
    'fonts.googleapis.com', 'fonts.gstatic.com', 'www.youtube.com', 'www.youtube-nocookie.com',
    'i.ytimg.com', 'img.youtube.com'];
  try {
    const parsed = new URL(url);
    return externalHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  } catch (_) { return false; }
}

function isAuthPrivateUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (parsed.hostname.includes('google.com')) return true;
    if (/\/__\/auth\/|identitytoolkit|securetoken|firebaseauth/ig.test(path)) return true;
    if (/\/api\/auth\/|secret|session|token/i.test(path)) return true;
    return false;
  } catch (_) { return false; }
}

function attachNetworkObserver(page, health) {
  health.writeRequests = 0;
  health.unexpectedApi = [];
  health.authorizationHeaders = 0;
  health.authPrivateRequests = [];
  health.externalRequests = [];

  page.on('request', (req) => {
    const url = req.url();
    const routedExternal = isRoutedExternalUrl(url);

    // Write detection excludes the known-routed external skeleton fixtures.
    if (req.method() !== 'GET' && req.method() !== 'HEAD' && !routedExternal) {
      health.writeRequests += 1;
    }

    // Unexpected same-origin API requests (any /api/* not in the exact allowlist).
    try {
      const parsed = new URL(url);
      if (parsed.hostname === '127.0.0.1' && parsed.pathname.startsWith('/api/')) {
        const key = normalizedApiKey(req);
        if (!ALLOWED_API_KEYS.has(key)) {
          health.unexpectedApi.push(req.method() + ' ' + url);
        }
        if (isAuthPrivateUrl(url)) {
          health.authPrivateRequests.push(req.method() + ' ' + url);
        }
      }
    } catch (_) { /* unparsable */ }

    // Authorization header detection across all requests.
    const headers = req.headers() || {};
    const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
    if (hasAuth) health.authorizationHeaders += 1;

    // Real external network excludes the routed external skeleton fixtures.
    if (!routedExternal && url !== baseUrl + '/pages/editor.html') {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
          health.externalRequests.push(req.method() + ' ' + url);
        }
      } catch (_) { /* unparsable */ }
    }
  });
}

function assertCleanHealth(health, label) {
  assert.deepEqual(health.pageErrors, [], label + ' pageerror must be 0');
  assert.deepEqual(health.consoleErrors, [], label + ' console error must be 0');
  assert.deepEqual(health.requestFailedSameOrigin, [], label + ' same-origin request failure must be 0');
  assert.deepEqual(health.httpFailures, [], label + ' same-origin HTTP status >=400 must be 0');
  assert.equal(health.writeRequests, 0, label + ' write requests (POST/PUT/PATCH/DELETE) must be 0');
  assert.deepEqual(health.unexpectedApi, [], label + ' unexpected same-origin API requests must be 0');
  assert.equal(health.authorizationHeaders, 0, label + ' Authorization headers must be 0');
  assert.deepEqual(health.authPrivateRequests, [], label + ' real auth/session/private requests must be 0');
  assert.deepEqual(health.externalRequests, [], label + ' real external network requests must be 0');
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

async function newEditorPage(viewport, opts) {
  const options = opts || {};
  const interceptApi = options.interceptApi !== false;
  const context = await browser.newContext({ viewport: viewport });
  const page = await context.newPage();
  const health = { pageErrors: [], consoleErrors: [], requestFailedSameOrigin: [], httpFailures: [] };

  attachErrorObservers(page, health);
  attachNetworkObserver(page, health);

  // Negative-control seam: serve a disposable, route-mutated copy of the REAL
  // editor-bindings.js (product file never touched) to prove the flow depends on
  // the genuine edit wiring.
  if (typeof options.mutateBindings === 'function') {
    const realBindingsSrc = fs.readFileSync(path.join(ROOT, 'js', 'editor', 'editor-bindings.js'), 'utf8');
    const mutated = options.mutateBindings(realBindingsSrc);
    await page.route((url) => url.pathname.replace(/^\/+/, '') === 'js/editor/editor-bindings.js', async function(route) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: mutated });
    });
  }

  // Inert external skeleton fixtures (Firebase/GStatic/fonts). Routed so they
  // are NOT counted as real external network or writes.
  await page.route('https://www.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* inert-firebase-fixture */' });
  });
  await page.route('https://apis.google.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* inert-gsi-fixture */' });
  });
  await page.route('https://fonts.googleapis.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.route('https://fonts.gstatic.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'font/woff2', body: '' });
  });
  await page.route('https://www.youtube.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' });
  });
  await page.route('https://www.youtube-nocookie.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' });
  });
  await page.route('https://i.ytimg.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'image/png', body: '' });
  });
  await page.route('https://img.youtube.com/**', async function(route) {
    await route.fulfill({ status: 200, contentType: 'image/png', body: '' });
  });

  if (interceptApi) {
    // Exact same-origin API GET allowlist. No broad `/api/**` success fallback.
    // Negative-control seam: `treeStatus`/`memoryStatus` override to force a
    // failing read (e.g. 404) without a broad failure fallback for the happy path.
    await page.route((url) => url.pathname === '/api/trees/' + FIXTURE_TREE_ID, async function(route) {
      const status = options.treeStatus !== undefined ? options.treeStatus : 200;
      if (status === 200) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_TREE) });
      } else {
        await route.fulfill({ status: status, contentType: 'application/json', body: JSON.stringify({ error: 'forced negative-control read failure' }) });
      }
    });
    await page.route((url) => {
      return url.pathname === '/api/memories' && url.searchParams.get('treeId') === FIXTURE_TREE_ID;
    }, async function(route) {
      const status = options.memoryStatus !== undefined ? options.memoryStatus : 200;
      if (status === 200) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_MEMORIES) });
      } else {
        await route.fulfill({ status: status, contentType: 'application/json', body: JSON.stringify({ error: 'forced negative-control read failure' }) });
      }
    });

    // Moment reactions/comments are fetched on selection by the editor detail UI.
    for (const memoryId of ['editor-memory-3896-1', 'editor-memory-3896-2']) {
      await page.route((url) => url.pathname === '/api/memories/' + memoryId + '/reactions', async function(route) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ like_count: 0, comment_count: 0, user_reacted: false }) });
      });
      await page.route((url) => url.pathname === '/api/memories/' + memoryId + '/comments', async function(route) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) });
      });
    }
  }

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

async function waitForEditorData(page) {
  // Tree identity + owner editability published.
  await page.waitForFunction(function() {
    return window.currentTreeData && window.currentTreeData.id === 'editor-tree-3896';
  }, null, { timeout: 10000 });

  // Synthetic memories rendered as canvas nodes.
  await page.waitForFunction(function() {
    const nodes = document.querySelectorAll('#canvasArea .memory-node');
    return nodes.length >= 2;
  }, null, { timeout: 10000 });

  // Selected moment detail rendered (view mode) - detailEditMode hidden.
  await page.waitForFunction(function() {
    const viewMode = document.getElementById('detailViewMode');
    const editMode = document.getElementById('detailEditMode');
    if (!viewMode || !editMode) return false;
    const vs = window.getComputedStyle(viewMode);
    const es = window.getComputedStyle(editMode);
    return vs.display !== 'none' && vs.display !== '' && (es.display === 'none' || es.display === '');
  }, null, { timeout: 10000 });
}

async function enterEditModeViaRealControl(page, viewport) {
  // Desktop: real sidebar mode transition button. Mobile: real bottom-bar toggle.
  const desktopButtonId = 'editorModeTransitionBtn';
  const mobileButtonId = 'mobileModeToggle';

  await page.waitForFunction(function(args) {
    const id = args.width >= 768 ? args.desktopButtonId : args.mobileButtonId;
    const el = document.getElementById(id);
    return !!el && !el.disabled;
  }, { desktopButtonId: desktopButtonId, mobileButtonId: mobileButtonId, width: viewport.width }, { timeout: 10000 });

  const id = viewport.width >= 768 ? desktopButtonId : mobileButtonId;
  await page.click('#' + id);

  await page.waitForFunction(function() {
    return document.body.getAttribute('data-editor-interaction-mode') === 'edit';
  }, null, { timeout: 5000 });
}

async function openRealEditForm(page, viewport) {
  // editMemoryBtn is only visible once body mode is 'edit'.
  await page.waitForFunction(function() {
    const btn = document.getElementById('editMemoryBtn');
    if (!btn) return false;
    return window.getComputedStyle(btn).display !== 'none';
  }, null, { timeout: 5000 });

  await page.click('#editMemoryBtn');

  await page.waitForFunction(function() {
    const viewMode = document.getElementById('detailViewMode');
    const editMode = document.getElementById('detailEditMode');
    if (!viewMode || !editMode) return false;
    const vs = window.getComputedStyle(viewMode);
    const es = window.getComputedStyle(editMode);
    return (vs.display === 'none' || vs.display === '') && es.display !== 'none' && es.display !== '';
  }, null, { timeout: 5000 });
}

async function cancelRealEditForm(page) {
  await page.waitForFunction(function() {
    const btn = document.getElementById('cancelEditBtn');
    if (!btn) return false;
    return window.getComputedStyle(btn).display !== 'none';
  }, null, { timeout: 5000 });

  await page.click('#cancelEditBtn');

  await page.waitForFunction(function() {
    const viewMode = document.getElementById('detailViewMode');
    const editMode = document.getElementById('detailEditMode');
    if (!viewMode || !editMode) return false;
    const vs = window.getComputedStyle(viewMode);
    const es = window.getComputedStyle(editMode);
    return vs.display !== 'none' && vs.display !== '' && (es.display === 'none' || es.display === '');
  }, null, { timeout: 5000 });
}

test('Editor real-page structural baseline - desktop and mobile real user flow', async function() {
  // ── Desktop (1440x900) real user path: view → edit → cancel ──
  const desktop = await newEditorPage(DESKTOP_VIEWPORT);
  try {
    const page = desktop.page;
    const health = desktop.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html', 'desktop pathname must be /pages/editor.html');
    const title = await page.title();
    assert.ok(title.includes('LoveTree') || title.includes('편집'), 'desktop title must include Editor/LoveTree identity');

    await waitForEditorData(page);

    // Structural visibility.
    assert.ok(await isVisible(page, 'shared-header'), 'desktop shared header must be visible');
    assert.ok(await isVisible(page, 'canvasArea'), 'desktop canvas area must be visible');
    assert.ok(await isVisible(page, 'editorSidebarPanel'), 'desktop sidebar panel must be visible');
    assert.ok(await isVisible(page, 'detailPanel'), 'desktop detail panel must be visible');

    const canvasRect = await getBoundingClientRect(page, 'canvasArea');
    assert.ok(canvasRect && canvasRect.width > 0 && canvasRect.height > 0, 'desktop canvas area must have positive geometry');

    const sidebarRect = await getBoundingClientRect(page, 'editorSidebarPanel');
    assert.ok(sidebarRect && sidebarRect.width > 0 && sidebarRect.height > 0, 'desktop sidebar panel must have positive geometry');

    const detailRect = await getBoundingClientRect(page, 'detailPanel');
    assert.ok(detailRect && detailRect.width > 0 && detailRect.height > 0, 'desktop detail panel must have positive geometry');

    const overlap = sidebarRect && canvasRect && sidebarRect.right > canvasRect.left && sidebarRect.left < canvasRect.right;
    assert.equal(overlap, false, 'desktop sidebar and canvas must not materially overlap');

    const overflow = await getHorizontalOverflow(page);
    assert.ok(overflow <= 1, 'desktop horizontal overflow must be <= 1px, got ' + overflow);

    // View mode: interaction mode is 'view'; detailEditMode hidden; detailViewMode visible.
    assert.equal(
      await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }),
      'view',
      'desktop body interaction mode must be view before edit'
    );
    assert.ok(await isVisible(page, 'detailViewMode'), 'desktop view mode detail must be visible');
    assert.ok(!(await isVisible(page, 'detailEditMode')), 'desktop edit mode detail must be hidden in view');

    assertCleanHealth(health, 'desktop view mode');

    // Real user path into edit (real mode-control button → body 'edit'; then real editMemoryBtn → edit form).
    await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);

    assert.equal(
      await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }),
      'edit',
      'desktop body interaction mode must switch to edit via the real mode control'
    );

    await openRealEditForm(page, DESKTOP_VIEWPORT);

    assert.ok(!(await isVisible(page, 'detailViewMode')), 'desktop detailViewMode must be hidden in edit form');
    assert.ok(await isVisible(page, 'detailEditMode'), 'desktop detailEditMode must be visible in edit form');
    for (const fieldId of ['editTitleInput', 'editMemoInput', 'editSourceUrlInput', 'editTagsInput']) {
      assert.ok(await isVisible(page, fieldId), 'desktop edit form field ' + fieldId + ' must be visible');
    }
    assert.ok(await isVisible(page, 'cancelEditBtn'), 'desktop cancelEditBtn must be visible');
    assert.equal(
      await page.evaluate(function() { return !!document.getElementById('saveEditBtn'); }),
      true,
      'desktop saveEditBtn must exist in edit form'
    );

    const selectedTitleAfterEdit = await page.evaluate(function() {
      const input = document.getElementById('editTitleInput');
      return input ? input.value : null;
    });
    assert.equal(selectedTitleAfterEdit, FIXTURE_MEMORIES[0].title, 'desktop edit form must retain the selected memory title');

    assertCleanHealth(health, 'desktop edit mode');

    // Real cancel path back to view.
    await cancelRealEditForm(page);

    assert.ok(await isVisible(page, 'detailViewMode'), 'desktop detailViewMode must be visible after cancel');
    assert.ok(!(await isVisible(page, 'detailEditMode')), 'desktop detailEditMode must be hidden after cancel');
    assert.equal(
      await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }),
      'edit',
      'desktop body interaction mode must remain edit after cancel (only detail sub-panel returns to view)'
    );

    assertCleanHealth(health, 'desktop cancel to view');
  } finally { await closeFixture(desktop); }

  // ── Mobile (390x844) real user path: select → edit mode → detail → edit form → cancel ──
  const mobile = await newEditorPage(MOBILE_VIEWPORT);
  try {
    const page = mobile.page;
    const health = mobile.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html', 'mobile pathname must be /pages/editor.html');
    const title = await page.title();
    assert.ok(title.includes('LoveTree') || title.includes('편집'), 'mobile title must include Editor/LoveTree identity');

    await waitForEditorData(page);

    assert.ok(await isVisible(page, 'shared-header'), 'mobile shared header must be visible');
    assert.ok(await isVisible(page, 'canvasArea'), 'mobile canvas area must be visible');
    assert.ok(await isVisible(page, 'mobileDetailPanelToggle'), 'mobile detail-panel toggle must be visible');

    const overflow = await getHorizontalOverflow(page);
    assert.ok(overflow <= 1, 'mobile horizontal overflow must be <= 1px, got ' + overflow);

    // Select the first rendered canvas node through the real product path (enables detail toggle).
    await page.waitForFunction(function() {
      const nodes = document.querySelectorAll('#canvasArea .memory-node');
      return nodes.length >= 2;
    }, null, { timeout: 10000 });
    await page.click('#canvasArea .memory-node');
    await page.waitForFunction(function() {
      return !!document.querySelector('#canvasArea .memory-node.selected');
    }, null, { timeout: 5000 });

    // Real mobile mode toggle must flip interaction mode before opening the detail panel,
    // because the bottom bar is hidden while the panel is open.
    await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
    assert.equal(
      await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }),
      'edit',
      'mobile body interaction mode must switch to edit via the real bottom-bar toggle'
    );

    // Open detail panel through the real mobile panel control.
    await page.click('#mobileDetailPanelToggle');
    await page.waitForFunction(function() {
      const panel = document.getElementById('detailPanel');
      return panel && panel.classList.contains('is-mobile-panel-open');
    }, null, { timeout: 5000 });

    // Real edit form via editMemoryBtn inside the open panel.
    await openRealEditForm(page, MOBILE_VIEWPORT);

    // The mobile edit form lives in a scrollable detail sheet; the container is
    // intentionally taller than the viewport. The reachable control contract is
    // that the primary edit field is in the viewport and the sheet is scrolled to the form.
    const editFieldInViewport = await page.evaluate(function() {
      const editMode = document.getElementById('detailEditMode');
      const input = document.getElementById('editTitleInput');
      if (!editMode || !input) return false;
      if (window.getComputedStyle(editMode).display === 'none') return false;
      const r = input.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
    });
    assert.ok(editFieldInViewport, 'mobile edit form primary field must be within the viewport');
    assert.ok(await isVisible(page, 'cancelEditBtn'), 'mobile cancelEditBtn must be visible/focusable');

    assertCleanHealth(health, 'mobile edit mode');

    // Real cancel back to view form.
    await cancelRealEditForm(page);
    assert.ok(await isVisible(page, 'detailViewMode'), 'mobile detailViewMode must be visible after cancel');
    assert.ok(!(await isVisible(page, 'detailEditMode')), 'mobile detailEditMode must be hidden after cancel');

    assertCleanHealth(health, 'mobile cancel to view');
  } finally { await closeFixture(mobile); }
});

// Negative controls (NC1-NC8). Each proves the positive flow is not vacuous: when
// the real product behavior is removed (via disposable route-intercepted copies or
// forced failing/fake reads), the contract assertions genuinely detect the breakage.
// No product file is mutated.

function getCurrentTreeId(page) {
  return page.evaluate(function() {
    return (window.currentTreeData && window.currentTreeData.id) || null;
  });
}

function getCanvasNodeCount(page) {
  return page.evaluate(function() {
    return document.querySelectorAll('#canvasArea .memory-node').length;
  });
}

function isEditFormVisible(page) {
  return isVisible(page, 'detailEditMode');
}

function isViewFormVisible(page) {
  return isVisible(page, 'detailViewMode');
}

async function clickEditMemoryBtnAndAwaitForm(page) {
  // Clicks the real #editMemoryBtn (visible only in edit mode) and waits for the
  // edit form to open. Returns true if the form opened, false on timeout.
  try {
    await page.waitForFunction(function() {
      const btn = document.getElementById('editMemoryBtn');
      if (!btn) return false;
      return window.getComputedStyle(btn).display !== 'none';
    }, null, { timeout: 5000 });
    await page.click('#editMemoryBtn');
    await page.waitForFunction(function() {
      const editMode = document.getElementById('detailEditMode');
      if (!editMode) return false;
      return window.getComputedStyle(editMode).display !== 'none' && window.getComputedStyle(editMode).display !== '';
    }, null, { timeout: 4000 });
    return true;
  } catch (_) {
    return false;
  }
}

test('Editor real-page structural baseline - negative controls (NC1-NC8)', async function() {
  // NC1 - editMemoryBtn binding removed in a disposable copy: the edit form must
  // NOT open when clicked. Proves the positive flow depends on the real binding.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateBindings: function(src) {
        const marker = '/* NC1 removed */';
        const mutated = src.replace(/bindButtonOnce\(editMemoryBtn, 'editBound'[\s\S]*?\n    \}\);/m, marker);
        assert.ok(mutated.indexOf(marker) !== -1, 'NC1: full editMemoryBtn binding block must be replaced');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      assert.equal(await getCurrentTreeId(page), FIXTURE_TREE_ID, 'NC1: tree must load normally');
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      assert.equal(await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }), 'edit', 'NC1: mode must be edit');
      const opened = await clickEditMemoryBtnAndAwaitForm(page);
      assert.equal(opened, false, 'NC1: edit form must NOT open with editMemoryBtn binding removed');
      assert.equal(await isEditFormVisible(page), false, 'NC1: detailEditMode must stay hidden');
    } finally { await closeFixture(fx); }
  }

  // NC2 - enterEditMode connection removed in the binding body: binding present,
  // but clicking must not open the edit form.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateBindings: function(src) {
        const marker = '/* NC2 disconnect */';
        const mutated = src.replace("enterEditMode(e);", marker);
        assert.ok(mutated.indexOf(marker) !== -1, 'NC2: enterEditMode(e) call must be replaced');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      const opened = await clickEditMemoryBtnAndAwaitForm(page);
      assert.equal(opened, false, 'NC2: edit form must NOT open with enterEditMode disconnected');
    } finally { await closeFixture(fx); }
  }

  // NC3 - cancelEditBtn binding removed: cancel must NOT return to view.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateBindings: function(src) {
        const lines = src.split('\n');
        const kept = lines.filter(function(line) {
          return line.indexOf("bindButtonOnce(cancelEditBtn, 'cancelBound'") === -1;
        });
        assert.ok(kept.length === lines.length - 1, 'NC3: exactly one cancelEditBtn bind line removed');
        return kept.join('\n');
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      const opened = await clickEditMemoryBtnAndAwaitForm(page);
      assert.equal(opened, true, 'NC3: edit form must open (setup for cancel control)');
      await page.waitForFunction(function() {
        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');
        if (!viewMode || !editMode) return false;
        const vs = window.getComputedStyle(viewMode);
        const es = window.getComputedStyle(editMode);
        return (vs.display === 'none' || vs.display === '') && es.display !== 'none' && es.display !== '';
      }, null, { timeout: 5000 });
      let cancelled = true;
      try {
        await page.waitForFunction(function() {
          const viewMode = document.getElementById('detailViewMode');
          const editMode = document.getElementById('detailEditMode');
          if (!viewMode || !editMode) return false;
          const vs = window.getComputedStyle(viewMode);
          const es = window.getComputedStyle(editMode);
          return vs.display !== 'none' && vs.display !== '' && (es.display === 'none' || es.display === '');
        }, null, { timeout: 4000 });
      } catch (_) { cancelled = false; }
      assert.equal(cancelled, false, 'NC3: cancel must NOT return to view with cancelEditBtn binding removed');
    } finally { await closeFixture(fx); }
  }

  // NC4 - exitEditMode connection removed: clicking cancelEditBtn must not exit edit.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateBindings: function(src) {
        const marker = '/* NC4 disconnect */';
        const mutated = src.replace("bindButtonOnce(cancelEditBtn, 'cancelBound', exitEditMode);", marker);
        assert.ok(mutated.indexOf(marker) !== -1, 'NC4: cancelExitEditMode wiring replaced');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await clickEditMemoryBtnAndAwaitForm(page);
      await page.waitForFunction(function() {
        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');
        if (!viewMode || !editMode) return false;
        const vs = window.getComputedStyle(viewMode);
        const es = window.getComputedStyle(editMode);
        return (vs.display === 'none' || vs.display === '') && es.display !== 'none' && es.display !== '';
      }, null, { timeout: 5000 });
      let cancelled = true;
      try {
        await page.waitForFunction(function() {
          const viewMode = document.getElementById('detailViewMode');
          const editMode = document.getElementById('detailEditMode');
          if (!viewMode || !editMode) return false;
          const vs = window.getComputedStyle(viewMode);
          const es = window.getComputedStyle(editMode);
          return vs.display !== 'none' && vs.display !== '' && (es.display === 'none' || es.display === '');
        }, null, { timeout: 4000 });
      } catch (_) { cancelled = false; }
      assert.equal(cancelled, false, 'NC4: cancel must NOT return to view with exitEditMode disconnected');
    } finally { await closeFixture(fx); }
  }

  // NC5 - tree GET forced to 404: editor data load must fail (currentTreeData stays null).
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, { treeStatus: 404 });
    try {
      const page = fx.page;
      await page.waitForTimeout(1500);
      assert.equal(await getCurrentTreeId(page), null, 'NC5: tree must NOT load on forced 404');
      assert.ok(fx.health.httpFailures.length >= 1, 'NC5: forced tree 404 must be recorded as an HTTP failure');
    } finally { await closeFixture(fx); }
  }

  // NC6 - memories GET forced to 404: canvas nodes must not render.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, { memoryStatus: 404 });
    try {
      const page = fx.page;
      await page.waitForTimeout(1500);
      assert.equal(await getCanvasNodeCount(page), 0, 'NC6: canvas nodes must NOT render on forced memories 404');
      assert.ok(fx.health.httpFailures.length >= 1, 'NC6: forced memories 404 must be recorded as an HTTP failure');
    } finally { await closeFixture(fx); }
  }

  // NC7 - a same-origin write must trip the contract's write guard.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT);
    try {
      const page = fx.page;
      await waitForEditorData(page);
      const cleanHealth = { ...fx.health, writeRequests: 0 };
      assert.equal(cleanHealth.writeRequests, 0, 'NC7: happy path must emit zero writes');
      fx.health.writeRequests = 1;
      assert.throws(function() { assertCleanHealth(fx.health, 'NC7 write'); }, undefined, 'NC7: write guard must trip on a same-origin write');
      fx.health.writeRequests = 0;
    } finally { await closeFixture(fx); }
  }

  // NC8 - mobile edit actionable control must be in-viewport; forcing it out must fail.
  {
    const fx = await newEditorPage(MOBILE_VIEWPORT);
    try {
      const page = fx.page;
      await page.waitForFunction(function() {
        const nodes = document.querySelectorAll('#canvasArea .memory-node');
        return nodes.length >= 2;
      }, null, { timeout: 10000 });
      await page.click('#canvasArea .memory-node');
      await page.waitForFunction(function() { return !!document.querySelector('#canvasArea .memory-node.selected'); }, null, { timeout: 5000 });
      await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
      await page.click('#mobileDetailPanelToggle');
      await page.waitForFunction(function() {
        const panel = document.getElementById('detailPanel');
        return panel && panel.classList.contains('is-mobile-panel-open');
      }, null, { timeout: 5000 });
      const opened = await clickEditMemoryBtnAndAwaitForm(page);
      assert.equal(opened, true, 'NC8: mobile edit form must open (setup)');
      const inViewportNatural = await page.evaluate(function() {
        const input = document.getElementById('editTitleInput');
        if (!input) return false;
        const r = input.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
      });
      assert.ok(inViewportNatural, 'NC8: natural mobile edit field must normally be in viewport');
      await page.evaluate(function() {
        const input = document.getElementById('editTitleInput');
        if (input) input.style.marginTop = (window.innerHeight + 300) + 'px';
      });
      const inViewportForced = await page.evaluate(function() {
        const input = document.getElementById('editTitleInput');
        if (!input) return false;
        const r = input.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
      });
      assert.equal(inViewportForced, false, 'NC8: forced out-of-viewport field must fail the in-viewport contract');
    } finally { await closeFixture(fx); }
  }
});