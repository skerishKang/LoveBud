'use strict';

// Issue #3907 — real-page local_stub Scout draft journey browser contract.
//
// Uses the actual /pages/editor.html + real Editor/Scout scripts served from a
// local ephemeral same-origin server, a credential-free synthetic owner, and
// synthetic Tree/Moment fixtures only. Playwright Chromium only.
//
// Proves B1 (lazy provider resolution, local_stub default, no provider
// endpoint / no suggestion write), B2 (compact mobile #mobileScoutAction
// sharing the same open authority, hidden in read-only/view), and B3 (dialog
// role/aria semantics, LoveBudModalA11y lifecycle, initial focus, and guarded
// focus restoration) at 1440x900 and 390x844, plus NC1-NC12 negative controls.

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

const SYNTHETIC_USER = {
  uid: 'scout-owner-3907',
  displayName: 'synthetic scout owner',
  email: 'scout-owner-3907@example.invalid',
  providerData: [{ providerId: 'google.com' }],
  photoURL: null
};
const VIEWER_USER = {
  uid: 'scout-viewer-3907',
  displayName: 'synthetic scout viewer',
  email: 'scout-viewer-3907@example.invalid',
  providerData: [{ providerId: 'google.com' }],
  photoURL: null
};

const FIXTURE_TREE_ID = 'scout-tree-3907';
const FIXTURE_OWNER_ID = SYNTHETIC_USER.uid;

const FIXTURE_TREE = {
  id: FIXTURE_TREE_ID,
  title: 'Scout Real-Page Journey Tree',
  visibility: 'public',
  ownerId: FIXTURE_OWNER_ID
};

const FIXTURE_MEMORIES = [
  {
    id: 'scout-memory-3907-1',
    treeId: FIXTURE_TREE_ID,
    parentId: null,
    title: '첫 순간',
    memo: 'Scout 실페이지 출발점',
    artist: 'Synthetic Artist',
    sourceUrl: 'https://www.youtube.com/watch?v=rcQghS9ZPkY',
    sourceType: 'youtube',
    emotionTags: ['기쁨'],
    timestamp: '2026.01.05',
    delay: '0s',
    x: 0,
    y: 0
  },
  {
    id: 'scout-memory-3907-2',
    treeId: FIXTURE_TREE_ID,
    parentId: 'scout-memory-3907-1',
    title: '이어진 기억',
    memo: '흐름을 이어간 순간',
    artist: 'Synthetic Artist',
    sourceUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
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

const SCOUT_STUB = {
  summary: 'A short stub summary based on the provided Scout draft.',
  memo: 'Review this stub suggestion before saving it to your LoveTree.',
  tags: 'curious, warm'
};

// The exact same-origin API surface the editor/Scout may legitimately call.
// Any other `/api/*` request (including any Scout endpoint) fails the contract.
const ALLOWED_API_KEYS = new Set([
  'GET /api/trees/' + FIXTURE_TREE_ID,
  'GET /api/memories?treeId=' + FIXTURE_TREE_ID,
  'GET /api/memories/scout-memory-3907-1/reactions',
  'GET /api/memories/scout-memory-3907-1/comments',
  'GET /api/memories/scout-memory-3907-2/reactions',
  'GET /api/memories/scout-memory-3907-2/comments',
  'GET /api/memories/scout-created-3907/reactions',
  'GET /api/memories/scout-created-3907/comments',
  'POST /api/memories'
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

function keydownInstrumentFixture() {
  return function fixture() {
    window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__ = 0;
    var origAdd = Document.prototype.addEventListener;
    var origRm = Document.prototype.removeEventListener;
    Document.prototype.addEventListener = function(type, fn, opts) {
      if (type === 'keydown') window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__ += 1;
      return origAdd.call(this, type, fn, opts);
    };
    Document.prototype.removeEventListener = function(type, fn, opts) {
      if (type === 'keydown') window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__ -= 1;
      return origRm.call(this, type, fn, opts);
    };
  };
}

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
  health.allowedApiRequests = [];
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

    try {
      const parsed = new URL(url);
      if (parsed.hostname === '127.0.0.1' && parsed.pathname.startsWith('/api/')) {
        const key = normalizedApiKey(req);
        if (ALLOWED_API_KEYS.has(key)) {
          health.allowedApiRequests.push(key);
        } else {
          health.unexpectedApi.push(req.method() + ' ' + url);
        }
        if (isAuthPrivateUrl(url)) {
          health.authPrivateRequests.push(req.method() + ' ' + url);
        }
      }
    } catch (_) { /* unparsable */ }

    const headers = req.headers() || {};
    const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
    if (hasAuth) health.authorizationHeaders += 1;

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

function getHorizontalOverflow(page) {
  return page.evaluate(function() {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
}

function getActiveElementId(page) {
  return page.evaluate(function() {
    var el = document.activeElement;
    return el ? (el.id || el.tagName) : null;
  });
}

function getSelectedMemoryId(page) {
  return page.evaluate(function() {
    const selectedEl = document.querySelector('.memory-node.selected');
    return selectedEl ? (selectedEl.dataset.memoryId || selectedEl.dataset.id || selectedEl.getAttribute('data-id')) : null;
  });
}

const REQUIRED_ALLOWED_GETS = [
  'GET /api/trees/' + FIXTURE_TREE_ID,
  'GET /api/memories?treeId=' + FIXTURE_TREE_ID,
  'GET /api/memories/scout-memory-3907-1/reactions',
  'GET /api/memories/scout-memory-3907-1/comments'
];

function assertAllowedGetsObserved(health, label) {
  const observed = new Set(health.allowedApiRequests || []);
  for (const required of REQUIRED_ALLOWED_GETS) {
    assert.ok(observed.has(required), label + ' must have actually issued ' + required + ' (observed: ' + Array.from(observed).join(', ') + ')');
  }
}

async function newEditorPage(viewport, opts) {
  const options = opts || {};
  const interceptApi = options.interceptApi !== false;
  const context = await browser.newContext({ viewport: viewport });
  const page = await context.newPage();
  const health = { pageErrors: [], consoleErrors: [], requestFailedSameOrigin: [], httpFailures: [] };

  attachErrorObservers(page, health);
  attachNetworkObserver(page, health);

  // Disposable route-mutated copies of real product modules (never touching the
  // files) for negative-control seams.
  if (typeof options.mutateEditorHtml === 'function') {
    const realHtml = fs.readFileSync(path.join(ROOT, 'pages', 'editor.html'), 'utf8');
    const mutated = options.mutateEditorHtml(realHtml);
    await page.route((url) => url.pathname.replace(/^\/+/, '') === 'pages/editor.html', async function(route) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: mutated });
    });
  }
  if (typeof options.mutateScoutUi === 'function') {
    const realSrc = fs.readFileSync(path.join(ROOT, 'js', 'scout', 'scout-draft-ui.js'), 'utf8');
    const mutated = options.mutateScoutUi(realSrc);
    await page.route((url) => url.pathname.replace(/^\/+/, '') === 'js/scout/scout-draft-ui.js', async function(route) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: mutated });
    });
  }
  if (typeof options.mutateScoutProvider === 'function') {
    const realSrc = fs.readFileSync(path.join(ROOT, 'js', 'scout', 'scout-suggestion-provider.js'), 'utf8');
    const mutated = options.mutateScoutProvider(realSrc);
    await page.route((url) => url.pathname.replace(/^\/+/, '') === 'js/scout/scout-suggestion-provider.js', async function(route) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: mutated });
    });
  }
  if (typeof options.mutateScoutSelector === 'function') {
    const realSrc = fs.readFileSync(path.join(ROOT, 'js', 'scout', 'scout-suggestion-source-selector.js'), 'utf8');
    const mutated = options.mutateScoutSelector(realSrc);
    await page.route((url) => url.pathname.replace(/^\/+/, '') === 'js/scout/scout-suggestion-source-selector.js', async function(route) {
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

  if (options.interceptSave) {
    // The one-and-only allowed write: POST /api/memories fulfills with a
    // synthetic created Moment so the save boundary completes locally without a
    // real backend. Exactly-once is asserted by health.writeRequests.
    await page.route('**/api/memories', async function(route) {
      const req = route.request();
      if (req.method() !== 'POST') { await route.continue(); return; }
      const body = (req.postData && req.postDataJSON) ? req.postDataJSON() : {};
      const created = {
        id: 'scout-created-3907',
        treeId: FIXTURE_TREE_ID,
        parentId: body.parentId || FIXTURE_MEMORIES[0].id,
        title: body.title || 'Scout moment',
        memo: body.memo || '',
        quote: '',
        emotionTags: Array.isArray(body.emotionTags) ? body.emotionTags : [],
        sourceUrl: body.sourceUrl || '',
        sourceType: body.sourceType || 'text',
        timestamp: body.timestamp || '2026.08.05',
        delay: '0s',
        x: 0,
        y: 0
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
    });
  }

  if (interceptApi) {
    await page.route((url) => url.pathname === '/api/trees/' + FIXTURE_TREE_ID, async function(route) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_TREE) });
    });
    await page.route((url) => {
      return url.pathname === '/api/memories' && url.searchParams.get('treeId') === FIXTURE_TREE_ID;
    }, async function(route) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_MEMORIES) });
    });
    for (const memoryId of ['scout-memory-3907-1', 'scout-memory-3907-2', 'scout-created-3907']) {
      await page.route((url) => url.pathname === '/api/memories/' + memoryId + '/reactions', async function(route) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ like_count: 0, comment_count: 0, user_reacted: false }) });
      });
      await page.route((url) => url.pathname === '/api/memories/' + memoryId + '/comments', async function(route) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) });
      });
    }
  }

  if (options.instrumentKeydown) {
    await page.addInitScript(keydownInstrumentFixture());
  }
  await page.addInitScript(authFixtureScript(), { user: options.user || SYNTHETIC_USER, lang: 'ko' });

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
  await page.waitForFunction(function() {
    return window.currentTreeData && window.currentTreeData.id === 'scout-tree-3907';
  }, null, { timeout: 10000 });
  await page.waitForFunction(function() {
    const nodes = document.querySelectorAll('#canvasArea .memory-node');
    return nodes.length >= 2;
  }, null, { timeout: 10000 });
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

// ── Scout modal helpers ──────────────────────────────────────────────────────

function isModalOpen(page) {
  return page.evaluate(function() {
    const el = document.getElementById('scoutDraftModal');
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    return cs.display === 'flex' || el.classList.contains('is-open');
  });
}

async function waitForModalOpen(page) {
  await page.waitForFunction(function() {
    const el = document.getElementById('scoutDraftModal');
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    return cs.display === 'flex' || el.classList.contains('is-open');
  }, null, { timeout: 5000 });
}

async function waitForModalClosed(page) {
  await page.waitForFunction(function() {
    const el = document.getElementById('scoutDraftModal');
    if (!el) return true;
    const cs = window.getComputedStyle(el);
    return cs.display !== 'flex' && !el.classList.contains('is-open');
  }, null, { timeout: 5000 });
}

function getModalCount(page) {
  return page.evaluate(function() {
    return document.querySelectorAll('#scoutDraftModal').length;
  });
}

function getKeydownListenerDelta(page, baseline) {
  return page.evaluate(function(base) {
    return window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__ - base;
  }, baseline);
}

// Desktop real entry: floating-toolbar "..." → #ftbScoutAction → modal.
async function openDesktopScout(page) {
  await page.waitForFunction(function() {
    const btn = document.getElementById('ftbMoreBtn');
    if (!btn) return false;
    const cs = window.getComputedStyle(btn);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && !btn.disabled;
  }, null, { timeout: 10000 });
  await page.click('#ftbMoreBtn');
  await page.waitForFunction(function() {
    const el = document.getElementById('ftbScoutAction');
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }, null, { timeout: 5000 });
  await page.click('#ftbScoutAction');
  await waitForModalOpen(page);
}

// Mobile real entry: bottom-bar #mobileScoutAction → modal.
async function openMobileScout(page) {
  await page.waitForFunction(function() {
    const el = document.getElementById('mobileScoutAction');
    if (!el) return false;
    return !el.disabled && window.getComputedStyle(el).display !== 'none';
  }, null, { timeout: 10000 });
  await page.click('#mobileScoutAction');
  await waitForModalOpen(page);
}

async function fillScoutSourceUrl(page, url) {
  await page.fill('#scoutSourceUrlInput', url);
}

async function pressSuggestAndWaitApplied(page) {
  await page.click('#scoutDraftSuggestBtn');
  await page.waitForFunction(function(summary) {
    const ta = document.getElementById('scoutExcerptTextarea');
    const feedback = document.getElementById('scoutSuggestFeedback');
    if (!ta) return false;
    if (ta.value === summary) return true;
    if (!feedback) return false;
    const cs = window.getComputedStyle(feedback);
    return cs.display !== 'none' && feedback.textContent.indexOf('제안') !== -1;
  }, SCOUT_STUB.summary, { timeout: 5000 });
}

function getScoutFieldValues(page) {
  return page.evaluate(function() {
    function val(id) {
      const el = document.getElementById(id);
      return el ? el.value : null;
    }
    return {
      excerpt: val('scoutExcerptTextarea'),
      memo: val('scoutMemoTextarea'),
      tags: val('scoutEmotionTagsInput'),
      sourceUrl: val('scoutSourceUrlInput'),
      feedback: (function() {
        const el = document.getElementById('scoutSuggestFeedback');
        return el ? el.textContent : null;
      })()
    };
  });
}

function assertDialogSemantics(page) {
  return page.evaluate(function() {
    const modal = document.getElementById('scoutDraftModal');
    if (!modal) return { role: null, ariaModal: null, ariaLabelledby: null, titleIdMatch: false, hasTitleHeading: false };
    const title = document.getElementById('scoutDraftTitle');
    return {
      role: modal.getAttribute('role'),
      ariaModal: modal.getAttribute('aria-modal'),
      ariaLabelledby: modal.getAttribute('aria-labelledby'),
      hasTitleHeading: !!title && title.tagName === 'H2',
      titleIdMatch: !!title && modal.getAttribute('aria-labelledby') === title.id
    };
  });
}

test('Scout real-page local_stub journey - desktop (1440x900)', async function() {
  const fx = await newEditorPage(DESKTOP_VIEWPORT, { instrumentKeydown: true });
  try {
    const page = fx.page;
    const health = fx.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html');
    await waitForEditorData(page);

    // Prepare for edit mode so the floating-toolbar Scout entry is available.
    await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
    assert.equal(await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }), 'edit');

    // Positive 1 + 3 + 4: actual #ftbScoutAction opens the dialog with role/name/modal
    // semantics and initial focus entering #scoutSourceUrlInput.
    await openDesktopScout(page);
    assert.equal(await isModalOpen(page), true, 'desktop #ftbScoutAction must open the Scout dialog');
    const semantics = await assertDialogSemantics(page);
    assert.equal(semantics.role, 'dialog', 'desktop dialog must have role=dialog');
    assert.equal(semantics.ariaModal, 'true', 'desktop dialog must have aria-modal=true');
    assert.equal(semantics.ariaLabelledby, 'scoutDraftTitle', 'desktop dialog must be labelled by scoutDraftTitle');
    assert.equal(semantics.hasTitleHeading, true, 'desktop dialog title must be an <h2>');
    assert.equal(semantics.titleIdMatch, true, 'desktop aria-labelledby must match the title id');
    assert.equal(await getActiveElementId(page), 'scoutSourceUrlInput', 'desktop initial focus must enter #scoutSourceUrlInput');

    // Positive 5 + 7: actual #scoutDraftSuggestBtn produces deterministic
    // local_stub content with endpoint request 0 and write 0.
    await fillScoutSourceUrl(page, 'https://www.youtube.com/watch?v=rcQghS9ZPkY');
    await pressSuggestAndWaitApplied(page);
    let fields = await getScoutFieldValues(page);
    assert.equal(fields.excerpt, SCOUT_STUB.summary, 'desktop stub excerpt must be applied');
    assert.equal(fields.memo, SCOUT_STUB.memo, 'desktop stub memo must be applied');
    assert.equal(fields.tags, SCOUT_STUB.tags, 'desktop stub emotion tags must be applied');
    assert.equal(fields.sourceUrl, 'https://www.youtube.com/watch?v=rcQghS9ZPkY', 'desktop source attribution must remain in the URL input');
    assertCleanHealth(health, 'desktop suggestion');

    // Positive 8: repeat open/suggest does not multiply listeners or duplicate output.
    // Measure the document keydown baseline while the modal is CLOSED so the
    // per-open delta is exactly the lifecycle's single bound listener.
    await page.click('#scoutDraftCloseBtn');
    await waitForModalClosed(page);
    const baselineListeners = await page.evaluate(function() { return window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__; });
    assert.equal(await getKeydownListenerDelta(page, baselineListeners), 0, 'desktop keydown baseline must be measured while closed');
    assert.equal(await getModalCount(page), 1, 'desktop must have exactly one #scoutDraftModal');
    for (let cycle = 0; cycle < 3; cycle++) {
      await openDesktopScout(page);
      assert.equal(await getKeydownListenerDelta(page, baselineListeners), 1, 'desktop exactly one modal keydown listener while open');
      await pressSuggestAndWaitApplied(page);
      fields = await getScoutFieldValues(page);
      assert.equal(fields.excerpt, SCOUT_STUB.summary, 'desktop repeat suggestion must NOT concatenate/duplicate output');
      assert.equal(await getModalCount(page), 1, 'desktop repeat cycles must not duplicate the modal surface');
      assertCleanHealth(health, 'desktop repeat suggestion cycle ' + cycle);
      await page.click('#scoutDraftCloseBtn');
      await waitForModalClosed(page);
      assert.equal(await getKeydownListenerDelta(page, baselineListeners), 0, 'desktop keydown listeners must return to baseline after close');
    }

    // Positive 10: cancel restores focus to the desktop opening trigger.
    await openDesktopScout(page);
    await page.click('#scoutDraftCancelBtn');
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'ftbMoreBtn', 'desktop cancel must restore focus to the opening toolbar trigger (fallback)');
    assert.equal(await getKeydownListenerDelta(page, baselineListeners), 0, 'desktop keydown listeners must be released after cancel');

    // Positive 10: close button restores focus.
    await openDesktopScout(page);
    await page.click('#scoutDraftCloseBtn');
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'ftbMoreBtn', 'desktop close button must restore focus to the opening trigger');

    // Positive 10: backdrop click restores focus. A real click event on the
    // dimmed overlay (outside the inner panel) drives the controller-owned
    // backdrop-close handler.
    await openDesktopScout(page);
    await page.evaluate(function() { var ov = document.getElementById('scoutDraftModal'); if (ov) ov.click(); });
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'ftbMoreBtn', 'desktop backdrop click must restore focus to the opening trigger');

    // Positive 10: Escape (exactly once) restores focus.
    await openDesktopScout(page);
    await page.keyboard.press('Escape');
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'ftbMoreBtn', 'desktop Escape must restore focus to the opening trigger');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(function() { return !!document.getElementById('scoutSourceUrlInput'); }), true, 'desktop repeated Escape must not error/double-close');
    assert.equal(await isModalOpen(page), false, 'desktop modal must remain closed after repeated Escape');

    assertCleanHealth(health, 'desktop full journey');
    assertAllowedGetsObserved(health, 'desktop full journey');
  } finally { await closeFixture(fx); }
});

test('Scout real-page local_stub journey - mobile (390x844)', async function() {
  const fx = await newEditorPage(MOBILE_VIEWPORT, { instrumentKeydown: true });
  try {
    const page = fx.page;
    const health = fx.health;

    assert.equal(await page.evaluate(function() { return window.location.pathname; }), '/pages/editor.html');
    await waitForEditorData(page);

    // Positive 12 (mobile part): in view mode the Scout entry must NOT be enabled.
    await page.waitForFunction(function() {
      return !!document.getElementById('mobileModeToggle') && !document.getElementById('mobileModeToggle').disabled;
    }, null, { timeout: 10000 });
    assert.deepEqual(
      await page.evaluate(function() {
        const el = document.getElementById('mobileScoutAction');
        if (!el) return { exists: false, disabled: true, ariaHidden: 'true' };
        const cs = window.getComputedStyle(el);
        return {
          exists: true,
          disabled: !!el.disabled,
          ariaHidden: el.getAttribute('aria-hidden'),
          displayNone: cs.display === 'none'
        };
      }),
      { exists: true, disabled: true, ariaHidden: 'true', displayNone: true },
      'mobile Scout entry must be hidden/disabled in view mode'
    );

    // Real mobile path: select node → enter edit mode → bottom-bar #mobileScoutAction.
    await page.waitForFunction(function() {
      const nodes = document.querySelectorAll('#canvasArea .memory-node');
      return nodes.length >= 2;
    }, null, { timeout: 10000 });
    await page.click('#canvasArea .memory-node');
    await page.waitForFunction(function() { return !!document.querySelector('#canvasArea .memory-node.selected'); }, null, { timeout: 5000 });

    await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
    assert.equal(await page.evaluate(function() { return document.body.getAttribute('data-editor-interaction-mode'); }), 'edit');

    const selectedId = await getSelectedMemoryId(page);
    assert.ok(selectedId, 'mobile must have a selected Moment before opening Scout');

    // Positive 2 + 3 + 4: actual #mobileScoutAction opens the same dialog.
    await openMobileScout(page);
    assert.equal(await isModalOpen(page), true, 'mobile #mobileScoutAction must open the Scout dialog');
    const semantics = await assertDialogSemantics(page);
    assert.equal(semantics.role, 'dialog', 'mobile dialog must have role=dialog');
    assert.equal(semantics.ariaModal, 'true', 'mobile dialog must have aria-modal=true');
    assert.equal(semantics.titleIdMatch, true, 'mobile dialog aria-labelledby must match the title id');
    assert.equal(await getActiveElementId(page), 'scoutSourceUrlInput', 'mobile initial focus must enter #scoutSourceUrlInput');

    // Positive 5 + 6 + 7: mobile local_stub suggestion; editable fields; 0 endpoint/0 write.
    await fillScoutSourceUrl(page, 'https://www.youtube.com/watch?v=rcQghS9ZPkY');
    await pressSuggestAndWaitApplied(page);
    const fields = await getScoutFieldValues(page);
    assert.equal(fields.excerpt, SCOUT_STUB.summary, 'mobile stub excerpt must be applied');
    assert.equal(fields.memo, SCOUT_STUB.memo, 'mobile stub memo must be applied');
    assert.equal(fields.tags, SCOUT_STUB.tags, 'mobile stub emotion tags must be applied');
    // Editable controls exist and are enabled.
    assert.equal(await page.evaluate(function() {
      const ta = document.getElementById('scoutExcerptTextarea');
      return !!ta && !ta.readOnly && !ta.disabled;
    }), true, 'mobile excerpt must remain an editable textarea');
    assertCleanHealth(health, 'mobile suggestion');

    // Positive 8: repeat suggestion → single modal, single listener, no duplicate output.
    // Close first so the baseline reflects a closed modal; then the per-open
    // delta is exactly the lifecycle's single bound listener.
    await page.click('#scoutDraftCloseBtn');
    await waitForModalClosed(page);
    const baselineListeners = await page.evaluate(function() { return window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__; });
    assert.equal(await getKeydownListenerDelta(page, baselineListeners), 0, 'mobile keydown baseline must be measured while closed');
    assert.equal(await getModalCount(page), 1, 'mobile must have exactly one #scoutDraftModal');
    for (let cycle = 0; cycle < 3; cycle++) {
      await openMobileScout(page);
      assert.equal(await getKeydownListenerDelta(page, baselineListeners), 1, 'mobile exactly one modal keydown listener while open');
      await pressSuggestAndWaitApplied(page);
      const f2 = await getScoutFieldValues(page);
      assert.equal(f2.excerpt, SCOUT_STUB.summary, 'mobile repeat suggestion must NOT duplicate output');
      assert.equal(await getModalCount(page), 1, 'mobile repeat cycles must not duplicate the modal surface');
      await page.click('#scoutDraftCloseBtn');
      await waitForModalClosed(page);
      assert.equal(await getKeydownListenerDelta(page, baselineListeners), 0, 'mobile keydown listeners must return to baseline after close');
    }

    // Positive 10: cancel restores focus to the mobile opening trigger.
    await openMobileScout(page);
    await page.click('#scoutDraftCancelBtn');
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'mobileScoutAction', 'mobile cancel must restore focus to #mobileScoutAction');

    // Positive 10: Escape restores focus.
    await openMobileScout(page);
    await page.keyboard.press('Escape');
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'mobileScoutAction', 'mobile Escape must restore focus to #mobileScoutAction');

    // Positive 10: backdrop click restores focus.
    await openMobileScout(page);
    await page.evaluate(function() { var ov = document.getElementById('scoutDraftModal'); if (ov) ov.click(); });
    await waitForModalClosed(page);
    assert.equal(await getActiveElementId(page), 'mobileScoutAction', 'mobile backdrop click must restore focus to #mobileScoutAction');

    // Positive 11: primary + Scout controls fit inside 390px with <=1px overflow.
    const overflow = await getHorizontalOverflow(page);
    assert.ok(overflow <= 1, 'mobile horizontal overflow must be <= 1px, got ' + overflow);
    assert.equal(await isVisible(page, 'mobileScoutAction'), true, 'mobile Scout action must be visible in edit mode');
    assert.equal(await isVisible(page, 'mobileBottomAction'), true, 'mobile primary action must remain visible in edit mode');

    assertCleanHealth(health, 'mobile full journey');
    assertAllowedGetsObserved(health, 'mobile full journey');
  } finally { await closeFixture(fx); }
});

test('Scout real-page local_stub journey - manual save boundary (exactly-once write)', async function() {
  const fx = await newEditorPage(DESKTOP_VIEWPORT, { interceptSave: true });
  try {
    const page = fx.page;
    const health = fx.health;

    await waitForEditorData(page);
    await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);

    await openDesktopScout(page);
    await fillScoutSourceUrl(page, 'https://www.youtube.com/watch?v=rcQghS9ZPkY');
    await pressSuggestAndWaitApplied(page);
    assert.equal(health.writeRequests, 0, 'suggestion must not write before manual save');

    // Positive 9: manual save is user-triggered and delegates exactly once to
    // the existing Moment save boundary via an intercepted synthetic write.
    await page.click('#scoutDraftSaveBtn');

    await page.waitForFunction(function() {
      return document.querySelectorAll('#canvasArea .memory-node').length >= 3;
    }, null, { timeout: 10000 });

    assert.equal(health.writeRequests, 1, 'manual save must issue exactly one intercepted synthetic write');
    const posts = health.allowedApiRequests.filter(function(k) { return k.indexOf('POST /api/memories') === 0; });
    assert.equal(posts.length, 1, 'exactly one allowed POST /api/memories must be observed');
    assert.deepEqual(health.unexpectedApi, [], 'save flow must not issue unexpected /api requests');
    assert.equal(health.authorizationHeaders, 0, 'Authorization headers must remain 0 through the save flow');
    assert.deepEqual(health.pageErrors, [], 'save flow pageerror must be 0');
    assert.deepEqual(health.consoleErrors, [], 'save flow console error must be 0');
    assert.deepEqual(health.externalRequests, [], 'save flow must not hit real external network');

    // The saved Moment is committed locally from the synthetic response.
    const nodeCount = await page.evaluate(function() {
      return document.querySelectorAll('#canvasArea .memory-node').length;
    });
    assert.equal(nodeCount, 3, 'saved Moment must be committed to the tree locally');
  } finally { await closeFixture(fx); }
});

test('Scout real-page local_stub journey - negative controls (NC1-NC12)', async function() {
  const KO_URL = 'https://www.youtube.com/watch?v=rcQghS9ZPkY';

  // NC1 - provider script moved after UI + lazy lookup removed → suggestion fails.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateEditorHtml: function(src) {
        const swap = src.replace(
          '<script src="../js/scout/scout-suggestion-provider.js?v=20260605-1"></script>\n    <script src="../js/scout/scout-draft-ui.js?v=e2e799866637"></script>',
          '<script src="../js/scout/scout-draft-ui.js?v=e2e799866637"></script>\n    <script src="../js/scout/scout-suggestion-provider.js?v=20260605-1"></script>'
        );
        assert.ok(swap.indexOf('scout-suggestion-provider.js') === -1 || swap.indexOf('scout-draft-ui.js') < swap.indexOf('scout-suggestion-provider.js'), 'NC1: script order must be inverted to original broken order');
        return swap;
      },
      mutateScoutUi: function(src) {
        const marker = '/* NC1: lazy lookup removed */';
        const mutated = src.replace(
          'const ScoutSuggestionProvider = window.LoveBudScoutSuggestionProvider;',
          marker + ' var ScoutSuggestionProvider = null;'
        );
        assert.ok(mutated.indexOf(marker) !== -1, 'NC1: lazy provider lookup must be removed');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      await fillScoutSourceUrl(page, KO_URL);
      await page.click('#scoutDraftSuggestBtn');
      await page.waitForFunction(function() {
        const fb = document.getElementById('scoutSuggestFeedback');
        if (!fb) return false;
        return window.getComputedStyle(fb).display !== 'none' && fb.textContent.indexOf('제안') !== -1;
      }, null, { timeout: 5000 });
      const fields = await getScoutFieldValues(page);
      assert.notEqual(fields.excerpt, SCOUT_STUB.summary, 'NC1: suggestion must NOT apply stub content when provider is unavailable');
      assert.equal(fx.health.writeRequests, 0, 'NC1: unavailable suggestion must not write');
      assert.ok(fields.feedback.indexOf('직접 입력 후 저장할 수 있습니다') !== -1, 'NC1: feedback must show the actionable unavailable message');
    } finally { await closeFixture(fx); }
  }

  // NC2 - provider global absent at click time → actionable unavailable, no crash/write.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateScoutProvider: function() {
        return '/* NC2: provider namespace intentionally absent */';
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      await fillScoutSourceUrl(page, KO_URL);
      await page.click('#scoutDraftSuggestBtn');
      await page.waitForFunction(function() {
        const fb = document.getElementById('scoutSuggestFeedback');
        if (!fb) return false;
        return window.getComputedStyle(fb).display !== 'none' && fb.textContent.indexOf('직접 입력 후 저장할 수 있습니다') !== -1;
      }, null, { timeout: 5000 });
      const fields = await getScoutFieldValues(page);
      assert.notEqual(fields.excerpt, SCOUT_STUB.summary, 'NC2: absent provider must not apply stub content');
      assert.equal(fx.health.writeRequests, 0, 'NC2: absent provider must not write');
      assert.deepEqual(fx.health.pageErrors, [], 'NC2: absent provider must not crash the page');
      // The modal remains usable for manual entry (no dead end).
      assert.equal(await isModalOpen(page), true, 'NC2: modal must remain open for manual entry');
    } finally { await closeFixture(fx); }
  }

  // NC3 - source selector chooses endpoint/live mode → test fails (endpoint request,
  // no stub content).
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateScoutSelector: function(src) {
        const marker = '/* NC3 forced endpoint */';
        let mutated = src.replace(
          'const resolution = resolveScoutSuggestionSource(config);',
          marker + ' const resolution = { source: "endpoint_client", enabled: true, reason: "NC3 forced" };'
        );
        // Inject a real fetchImpl so the endpoint client actually issues a
        // same-origin request (otherwise it short-circuits with no network).
        mutated = mutated.replace(
          'fetchImpl: endpointOptions.fetchImpl,',
          'fetchImpl: endpointOptions.fetchImpl || (window.fetch ? window.fetch.bind(window) : null),'
        );
        assert.ok(mutated.indexOf(marker) !== -1, 'NC3: resolution must be forced to endpoint_client');
        assert.ok(mutated.indexOf('window.fetch.bind(window)') !== -1, 'NC3: a real fetchImpl must be injected');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await page.route('**/api/scout/suggest', async function(route) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NC3 forced endpoint failure' }) });
      });
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      await fillScoutSourceUrl(page, KO_URL);
      await page.click('#scoutDraftSuggestBtn');
      await page.waitForFunction(function() {
        const fb = document.getElementById('scoutSuggestFeedback');
        if (!fb) return false;
        return fb.textContent.length > 0;
      }, null, { timeout: 8000 });
      const fields = await getScoutFieldValues(page);
      assert.notEqual(fields.excerpt, SCOUT_STUB.summary, 'NC3: endpoint/live selection must NOT yield stub content');
      const scoutEndpointSeen = fx.health.unexpectedApi.some(function(u) { return u.indexOf('/api/scout/suggest') !== -1; });
      assert.ok(scoutEndpointSeen, 'NC3: a Scout endpoint request must be observed when source is endpoint/live');
    } finally { await closeFixture(fx); }
  }

  // NC4 - any Scout endpoint request in local_stub flow fails the contract.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT);
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      await fillScoutSourceUrl(page, KO_URL);
      await pressSuggestAndWaitApplied(page);
      assert.equal(fx.health.unexpectedApi.length, 0, 'NC4: local_stub flow must observe zero unexpected/Scout endpoint requests');
      // Actual probe proves the detector is not vacuous.
      await page.route('**/api/scout/suggest', async function(route) {
        await route.fulfill({ status: 204, body: '' });
      });
      await page.evaluate(async function() {
        await fetch('/api/scout/suggest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ probe: true })
        });
      });
      assert.ok(fx.health.unexpectedApi.length >= 1, 'NC4: an actual Scout endpoint POST must trip the unexpected-API guard');
    } finally { await closeFixture(fx); }
  }

  // NC5 - mobile Scout trigger removed → mobile journey fails.
  {
    const fx = await newEditorPage(MOBILE_VIEWPORT, {
      mutateEditorHtml: function(src) {
        const removed = src.replace(
          /\n?          <button\b(?=[^>]*id="mobileScoutAction")[^>]*>[\s\S]*?<\/button>/,
          ''
        );
        assert.ok(removed.indexOf('id="mobileScoutAction"') === -1, 'NC5: #mobileScoutAction must be removed');
        return removed;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await page.waitForFunction(function() {
        const nodes = document.querySelectorAll('#canvasArea .memory-node');
        return nodes.length >= 2;
      }, null, { timeout: 10000 });
      await page.click('#canvasArea .memory-node');
      await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
      assert.equal(await page.evaluate(function() { return !!document.getElementById('mobileScoutAction'); }), false, 'NC5: mobile Scout trigger must be absent');
      assert.equal(await isModalOpen(page), false, 'NC5: with trigger removed the mobile journey must not open the dialog');
    } finally { await closeFixture(fx); }
  }

  // NC6 - mobile Scout entry exposed in view mode → contract fails.
  {
    const fx = await newEditorPage(MOBILE_VIEWPORT);
    try {
      const page = fx.page;
      await waitForEditorData(page);

      // Natural view mode: the entry must be hidden/disabled.
      const natural = await page.evaluate(function() {
        const el = document.getElementById('mobileScoutAction');
        if (!el) return { exists: false, disabled: true, ariaHidden: 'true' };
        const cs = window.getComputedStyle(el);
        return { exists: true, disabled: !!el.disabled, ariaHidden: el.getAttribute('aria-hidden'), displayNone: cs.display === 'none' };
      });
      assert.equal(natural.displayNone, true, 'NC6: natural view mode must keep #mobileScoutAction hidden');
      assert.equal(natural.disabled, true, 'NC6: natural view mode must keep #mobileScoutAction disabled');

      // Forcing it enabled/visible proves the no-enabled-entry contract is
      // non-vacuous: an exposed entry violates the invariant. The force and the
      // violation check run in ONE synchronous evaluate so the mobile bar's
      // debounced view-mode update cannot re-hide the entry in between.
      const violated = await page.evaluate(function() {
        const el = document.getElementById('mobileScoutAction');
        if (!el) return false;
        el.classList.remove('editor-mobile-scout-action');
        el.style.display = 'block';
        el.style.position = 'fixed';
        el.style.bottom = '0';
        el.style.zIndex = '99999';
        el.disabled = false;
        el.removeAttribute('aria-hidden');
        const cs = window.getComputedStyle(el);
        // Contract requires the entry to be BOTH disabled and hidden in view mode.
        const requiresDisabled = el.disabled === true;
        const requiresHidden = cs.display === 'none' || el.getAttribute('aria-hidden') === 'true';
        return !(requiresDisabled && requiresHidden);
      });
      assert.equal(violated, true, 'NC6: an enabled/visible Scout entry in view mode must violate the no-enabled-entry contract');
    } finally { await closeFixture(fx); }
  }

  // NC7 - role/aria-modal/aria-labelledby removed → accessibility test fails.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateScoutUi: function(src) {
        const marker = '/* NC7 semantics removed */';
        const mutated = src
          .replace("overlay.setAttribute('role', 'dialog');", marker)
          .replace("overlay.setAttribute('aria-modal', 'true');", '')
          .replace("overlay.setAttribute('aria-labelledby', 'scoutDraftTitle');", '');
        assert.ok(mutated.indexOf(marker) !== -1, 'NC7: role=dialog must be removed');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      const semantics = await assertDialogSemantics(page);
      assert.notEqual(semantics.role, 'dialog', 'NC7: without role=dialog the semantics assertion must fail');
    } finally { await closeFixture(fx); }
  }

  // NC8 - initial focus does not enter dialog → test fails.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateScoutUi: function(src) {
        const marker = '/* NC8 bind without focus */';
        const mutated = src.replace('modalA11y.open();', marker + ' modalA11y.bind();');
        assert.ok(mutated.indexOf(marker) !== -1, 'NC8: modalA11y.open() must be replaced by bind only');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      assert.notEqual(await getActiveElementId(page), 'scoutSourceUrlInput', 'NC8: when initial focus is removed, active element must NOT be #scoutSourceUrlInput');
    } finally { await closeFixture(fx); }
  }

  // NC9 - close focus restore removed → desktop and mobile tests fail.
  {
    const mkFixture = (viewport) => newEditorPage(viewport, {
      mutateScoutUi: function(src) {
        const marker = '/* NC9 restore removed */';
        const mutated = src.replace('modalA11y.restoreFocus();', marker);
        assert.ok(mutated.indexOf(marker) !== -1, 'NC9: restoreFocus must be removed');
        return mutated;
      }
    });
    {
      const fx = await mkFixture(DESKTOP_VIEWPORT);
      try {
        const page = fx.page;
        await waitForEditorData(page);
        await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
        await openDesktopScout(page);
        await page.click('#scoutDraftCloseBtn');
        await waitForModalClosed(page);
        assert.notEqual(await getActiveElementId(page), 'ftbMoreBtn', 'NC9: desktop focus-restore assertion must fail when restoration is removed');
      } finally { await closeFixture(fx); }
    }
    {
      const fx = await mkFixture(MOBILE_VIEWPORT);
      try {
        const page = fx.page;
        await waitForEditorData(page);
        await page.click('#canvasArea .memory-node');
        await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
        await openMobileScout(page);
        await page.click('#scoutDraftCloseBtn');
        await waitForModalClosed(page);
        assert.notEqual(await getActiveElementId(page), 'mobileScoutAction', 'NC9: mobile focus-restore assertion must fail when restoration is removed');
      } finally { await closeFixture(fx); }
    }
  }

  // NC10 - repeat open/suggest creates duplicate listeners → exact-count fails.
  {
    const mkFixture = (viewport, mutate) => newEditorPage(viewport, {
      instrumentKeydown: true,
      mutateScoutUi: mutate
    });
    // Positive control surface: exactly one document keydown listener while open.
    {
      const fx = await mkFixture(DESKTOP_VIEWPORT, null);
      try {
        const page = fx.page;
        await waitForEditorData(page);
        await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
        const baseline = await page.evaluate(function() { return window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__; });
        await openDesktopScout(page);
        assert.equal(await getKeydownListenerDelta(page, baseline), 1, 'NC10 positive: exactly one modal keydown listener while open');
        await page.click('#scoutDraftCloseBtn');
        await waitForModalClosed(page);
        assert.equal(await getKeydownListenerDelta(page, baseline), 0, 'NC10 positive: listener released on close');
      } finally { await closeFixture(fx); }
    }
    // Negative control: an injected second persistent Escape listener trips the count.
    {
      const fx = await mkFixture(DESKTOP_VIEWPORT, function(src) {
        const marker = '/* NC10 duplicate listener */';
        const mutated = src.replace(
          'modalA11y.open();',
          'modalA11y.open(); document.addEventListener("keydown", function __nc10() {}, false); ' + marker
        );
        assert.ok(mutated.indexOf('__nc10') !== -1, 'NC10: duplicate Escape listener must be injected');
        return mutated;
      });
      try {
        const page = fx.page;
        await waitForEditorData(page);
        await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
        const baseline = await page.evaluate(function() { return window.__LOVEBUD_KEYDOWN_LISTENER_COUNT__; });
        await openDesktopScout(page);
        assert.notEqual(await getKeydownListenerDelta(page, baseline), 1, 'NC10: a duplicate keydown listener must trip the exact-count assertion');
      } finally { await closeFixture(fx); }
    }
  }

  // NC11 - suggestion auto-saves or writes → write-guard fails.
  {
    const fx = await newEditorPage(DESKTOP_VIEWPORT, {
      mutateScoutProvider: function(src) {
        const marker = '/* NC11 auto-write */';
        const mutated = src.replace(
          'return normalizeScoutSuggestionOutput(stubOutput);',
          'await window.fetch("/api/memories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ probe: true }) });\n            ' + marker + '\n            return normalizeScoutSuggestionOutput(stubOutput);'
        );
        assert.ok(mutated.indexOf('NC11 auto-write') !== -1, 'NC11: stub provider must inject an auto-write');
        return mutated;
      }
    });
    try {
      const page = fx.page;
      await page.route('**/api/memories', async function(route) {
        const req = route.request();
        if (req.method() !== 'POST') { await route.continue(); return; }
        await route.fulfill({ status: 204, body: '' });
      });
      await waitForEditorData(page);
      await enterEditModeViaRealControl(page, DESKTOP_VIEWPORT);
      await openDesktopScout(page);
      await fillScoutSourceUrl(page, KO_URL);
      await pressSuggestAndWaitApplied(page);
      assert.notEqual(fx.health.writeRequests, 0, 'NC11: an auto-writing suggestion must trip the write=0 guard');
    } finally { await closeFixture(fx); }
  }

  // NC12 - modal/controls overflow 390x844 → geometry test fails.
  {
    const fx = await newEditorPage(MOBILE_VIEWPORT);
    try {
      const page = fx.page;
      await waitForEditorData(page);
      await page.click('#canvasArea .memory-node');
      await enterEditModeViaRealControl(page, MOBILE_VIEWPORT);
      const natural = await getHorizontalOverflow(page);
      assert.ok(natural <= 1, 'NC12 natural: mobile overflow must be <= 1px, got ' + natural);
      // Force overflow to prove the geometry assertion is non-vacuous. A
      // position:fixed wide element forces document scroll regardless of any
      // ancestor overflow clipping on the bar.
      await page.evaluate(function() {
        const probe = document.createElement('div');
        probe.id = '__nc12_overflow_probe';
        probe.style.cssText = 'position:absolute;left:0;top:0;width:600px;height:2px;pointer-events:none;z-index:-1;';
        document.body.appendChild(probe);
      });
      const forced = await getHorizontalOverflow(page);
      assert.ok(forced > 1, 'NC12: forced overflow must trip the <=1px geometry assertion');
      await page.evaluate(function() {
        const probe = document.getElementById('__nc12_overflow_probe');
        if (probe) probe.remove();
      });
    } finally { await closeFixture(fx); }
  }
});