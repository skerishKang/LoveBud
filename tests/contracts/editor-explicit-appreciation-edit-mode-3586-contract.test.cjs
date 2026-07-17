/**
 * #3586 Explicit appreciation / edit mode contracts
 *
 * - URL mode=edit ↔ body data-editor-interaction-mode
 * - Owner appreciation hides rename/visibility mutations
 * - Desktop/mobile transition labels are explicit
 * - Browser: enter edit / return appreciation / browser back
 *
 * Layer: EXECUTED_FAKE
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const interactionSrc = read('js/editor/editor-interaction-mode.js');
const treeMetaSrc = read('js/editor/editor-detail-tree-meta.js');
const editorSrc = read('js/editor.js');
const mobileSrc = read('js/editor/editor-mobile-bottom-bar.js');
const modeCss = read('css/editor/editor-mode-selection.css');
const mobileBarCss = read('css/editor/editor-mobile-action-bar.css');
const editorHtml = read('pages/editor.html');

/** Repo-external screenshot + geometry evidence directory for screenshot review v2. */
const REVIEW_OUT_V2 = path.join(
  'G:',
  'Ddrive',
  'BatangD',
  'task',
  'workdiary',
  'lovebud-review-output',
  '3586-v2'
);

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

function startStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/' ) urlPath = '/index.html';
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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ── Source contracts ───────────────────────────────────────────────

test('#3586 source: interaction mode syncs URL mode=edit and popstate', () => {
  assert.match(interactionSrc, /pushState|replaceState/);
  assert.match(interactionSrc, /popstate/);
  assert.match(interactionSrc, /searchParams\.set\(['"]mode['"],\s*MODE_EDIT\)|searchParams\.set\("mode", MODE_EDIT\)|searchParams\.set\('mode', MODE_EDIT\)/);
  assert.match(interactionSrc, /searchParams\.delete\(['"]mode['"]\)|searchParams\.delete\("mode"\)/);
});

test('#3586 source: tree-meta mutations only when isEditMode', () => {
  assert.match(treeMetaSrc, /isEditMode\(\)/);
  assert.match(treeMetaSrc, /editor-owner-mutation-action/);
  assert.match(treeMetaSrc, /canEdit === true && isEditMode/);
});

test('#3586 source: desktop mode card uses explicit transition CTA', () => {
  assert.match(editorSrc, /편집하기/);
  assert.match(editorSrc, /감상으로 돌아가기/);
  assert.match(editorSrc, /editor-mode-status-badge|editorModeStatusBadge/);
  assert.match(editorSrc, /enter-edit|return-to-appreciation/);
  assert.doesNotMatch(editorSrc, /aria-label',\s*'보기 모드'|textContent = '보기'/);
});

test('#3586 source: mobile owns single status + transition (no legacy mode CTA)', () => {
  assert.match(mobileSrc, /편집하기/);
  assert.match(mobileSrc, /감상으로/);
  assert.match(mobileSrc, /mobileModeCluster|MODE_CLUSTER_ID|editor-mobile-mode-cluster/);
  assert.match(mobileSrc, /mobileModeStatus|MODE_STATUS_ID|editor-mobile-mode-status/);
  assert.match(mobileSrc, /is-authoring-hidden|AUTHORING_HIDDEN_CLASS/);
  // Runtime must not assign the legacy explanatory mode CTA string.
  assert.doesNotMatch(mobileSrc, /textContent\s*=\s*['"]편집하려면 모드 전환['"]/);
  assert.doesNotMatch(mobileSrc, /actionLabel\.textContent\s*=\s*['"]편집하려면/);
  assert.doesNotMatch(mobileSrc, /textContent = '보기'/);
  assert.doesNotMatch(mobileSrc, /aria-label',\s*'보기 모드'/);
  // Primary authoring remains 이어가기 only in edit mode — not a mode transition.
  assert.match(mobileSrc, /이어가기/);
});

test('#3586 CSS: view mode hides owner mutation actions', () => {
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #renameTreeBtn/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #sidebarVisibilityToggleBtn/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] \.editor-owner-mutation-action/);
  assert.match(modeCss, /\.editor-mode-status-badge/);
});

test('#3586 CSS: mobile mode cluster is compact one-line layout', () => {
  assert.match(mobileBarCss, /editor-mobile-mode-cluster/);
  assert.match(mobileBarCss, /editor-mobile-mode-status/);
  assert.match(mobileBarCss, /white-space:\s*nowrap/);
  assert.match(mobileBarCss, /is-authoring-hidden/);
});

test('#3586 assets: editor page fingerprints bumped for runtime modules', () => {
  assert.match(editorHtml, /editor-interaction-mode\.js\?v=[^"'\s>]+/);
  assert.match(editorHtml, /editor-detail-tree-meta\.js\?v=[^"'\s>]+/);
  assert.match(editorHtml, /editor-mobile-bottom-bar\.js\?v=[^"'\s>]+/);
  assert.match(editorHtml, /editor\.js\?v=[^"'\s>]+/);
  assert.match(editorHtml, /css\/editor\.css\?v=\d{8}-[^"'\s>]+/);
});

// ── VM interaction mode ────────────────────────────────────────────

test('#3586 vm: setMode edits URL and popstate restores view', () => {
  function applyHref(loc, href) {
    const abs = href.startsWith('http') ? href : 'https://lovebud.pages.dev' + href;
    const u = new URL(abs);
    loc.href = u.href;
    loc.pathname = u.pathname;
    loc.search = u.search;
    loc.hash = u.hash;
  }
  const location = {
    href: 'https://lovebud.pages.dev/pages/editor.html?treeId=tree-a',
    pathname: '/pages/editor.html',
    search: '?treeId=tree-a',
    hash: ''
  };
  const history = {
    state: {},
    pushState(state, _t, url) {
      this.state = state;
      applyHref(location, url);
    },
    replaceState(state, _t, url) {
      this.state = state;
      applyHref(location, url);
    }
  };
  const body = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] || null; },
    classList: { contains() { return false; } }
  };
  const listeners = {};
  const win = {
    LoveBudEditorInteractionMode: null,
    location,
    history,
    URL,
    URLSearchParams,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    document: { body }
  };
  const ctx = {
    window: win,
    document: win.document,
    console,
    URL,
    URLSearchParams
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(interactionSrc, ctx);

  const mode = win.LoveBudEditorInteractionMode;
  assert.equal(mode.getMode(), 'view');
  mode.setMode(mode.MODE_EDIT);
  assert.equal(mode.getMode(), 'edit');
  assert.equal(body.getAttribute('data-editor-interaction-mode'), 'edit');
  assert.match(location.search, /mode=edit/);
  assert.match(location.href, /mode=edit/);

  mode.setMode(mode.MODE_VIEW);
  assert.equal(mode.getMode(), 'view');
  assert.ok(!/mode=edit/.test(location.search));

  // Simulate browser back into edit URL
  applyHref(location, 'https://lovebud.pages.dev/pages/editor.html?treeId=tree-a&mode=edit');
  (listeners.popstate || []).forEach((fn) => fn({}));
  assert.equal(mode.getMode(), 'edit');
});

// ── Browser runtime ────────────────────────────────────────────────

const TREE = {
  id: 'tree-3586-a',
  title: 'Owner Tree 3586',
  visibility: 'private',
  ownerId: 'ui-e2e-user-3586',
  createdAt: '2026-07-01T00:00:00Z'
};
const MOMENT = {
  id: 'mem-3586-a1',
  treeId: TREE.id,
  parentId: null,
  title: 'Moment 3586',
  memo: 'memo',
  timestamp: '2024-01',
  thumbnail: '',
  visibility: 'private',
  createdAt: '2026-07-01T01:00:00Z',
  updatedAt: '2026-07-01T01:00:00Z'
};

const PUBLIC_TREE = {
  id: 'tree-3586-public',
  title: 'Public LoveTree 3586',
  visibility: 'public',
  ownerId: 'public-owner-3586',
  createdAt: '2026-07-01T00:00:00Z'
};
const PUBLIC_MOMENT = {
  id: 'mem-3586-public-1',
  treeId: PUBLIC_TREE.id,
  parentId: null,
  title: 'Public Moment 3586',
  memo: 'public memo',
  timestamp: '2024-05',
  thumbnail: '',
  visibility: 'public',
  createdAt: '2026-07-01T01:00:00Z',
  updatedAt: '2026-07-01T01:00:00Z'
};
const PUBLIC_MOMENT_2 = {
  id: 'mem-3586-public-2',
  treeId: PUBLIC_TREE.id,
  parentId: PUBLIC_MOMENT.id,
  title: 'Public Moment 3586 B',
  memo: 'second public moment',
  timestamp: '2024-06',
  thumbnail: '',
  visibility: 'public',
  createdAt: '2026-07-01T02:00:00Z',
  updatedAt: '2026-07-01T02:00:00Z'
};

async function installOwnerFixtures(page) {
  const user = { uid: 'ui-e2e-user-3586', email: 'ui-e2e-3586@example.com', displayName: 'UI E2E 3586' };
  const trees = [TREE, PUBLIC_TREE];
  const memoriesByTreeId = {
    [TREE.id]: [MOMENT],
    [PUBLIC_TREE.id]: [PUBLIC_MOMENT, PUBLIC_MOMENT_2]
  };

  await page.addInitScript(
    ({ userJson }) => {
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', userJson);
      try {
        sessionStorage.setItem(
          'lovebud_auth_token',
          JSON.stringify({
            uid: JSON.parse(userJson).uid,
            token: 'fake-token-3586',
            expiresAt: Date.now() + 3600000
          })
        );
      } catch (_) {}
      const readyUser = JSON.parse(userJson);
      const bootstrap = {
        ready: true,
        user: readyUser,
        getSnapshot() { return { ready: true, user: readyUser }; },
        whenReady() { return Promise.resolve(readyUser); },
        resolve() {}
      };
      Object.defineProperty(window, 'LoveBudAuthBootstrap', {
        configurable: true,
        get() { return bootstrap; },
        set() {}
      });

      // Ensure owner canEdit resolves even if Firebase auth races null under suite load.
      // Patch whichever permission object is later assigned by project scripts.
      let permissionApi;
      Object.defineProperty(window, 'LoveBudTreeWorkspacePermission', {
        configurable: true,
        get() { return permissionApi; },
        set(value) {
          permissionApi = value || {};
          if (permissionApi && typeof permissionApi === 'object') {
            permissionApi.resolveTreeWorkspaceCanEdit = function () { return true; };
          }
        }
      });
      // Pre-seed if a consumer reads before the real module assigns.
      window.LoveBudTreeWorkspacePermission = {
        resolveTreeWorkspaceCanEdit: function () { return true; }
      };
    },
    { userJson: JSON.stringify(user) }
  );

  // Match #3576 harness: only intercept backend API paths.
  await page.route('**/api/trees**', async (route) => {
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
          body: JSON.stringify({
            ...tree,
            memories: memoriesByTreeId[tree.id] || []
          })
        });
      }
    }
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ error: 'tree fixture not found' })
    });
  });

  await page.route('**/api/memories**', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(memoriesByTreeId[TREE.id] || [])
      });
    }
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([])
    });
  });
}

function isBackendApiPath(urlString) {
  try {
    const u = new URL(urlString);
    // IMPORTANT: do not match /js/api/* script assets — only real backend /api/* endpoints.
    return u.pathname === '/api' || u.pathname.startsWith('/api/');
  } catch (_) {
    return false;
  }
}

async function installPublicFixtures(page) {
  const trees = [PUBLIC_TREE];
  const memoriesByTreeId = {
    [PUBLIC_TREE.id]: [PUBLIC_MOMENT, PUBLIC_MOMENT_2]
  };

  // Guest public viewer — no owner auth bootstrap.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('lovebud_auth_confirmed');
      localStorage.removeItem('lovebud_auth_cache');
      sessionStorage.removeItem('lovebud_auth_token');
    } catch (_) {}
  });

  // Single route predicate scoped to pathname /api/* only (never /js/api/*).
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
            body: JSON.stringify({
              ...tree,
              memories: memoriesByTreeId[tree.id] || []
            })
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
      if (method === 'GET' && p.startsWith('/api/memories')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(memoriesByTreeId[PUBLIC_TREE.id] || [])
        });
      }
      // Soft-fail remaining backend reads (likes/comments/views) so canvas can render.
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
}

function collectMobileGeometry() {
  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom)
    };
  }
  const docEl = document.documentElement;
  const body = document.body;
  const bar = document.getElementById('mobileBottomBar');
  const status = document.getElementById('mobileModeStatus');
  const toggle = document.getElementById('mobileModeToggle');
  const action = document.getElementById('mobileBottomAction');
  const ftb = document.querySelector('.editor-floating-toolbar');
  const topbar = document.querySelector('.editor-canvas-topbar, #editorCanvasTopbar, .canvas-topbar');
  const statusLabel = status && status.querySelector('[data-mobile-mode-status-label]');
  const actionLabel = toggle && toggle.querySelector('[data-mobile-mode-action-label]');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  function isOneLine(el) {
    if (!el) return true;
    const style = getComputedStyle(el);
    // Compact chips force nowrap; treat that as the one-line contract.
    if (style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre') return true;
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const pad =
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const border =
      (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const contentH = el.getBoundingClientRect().height - pad - border;
    return contentH <= lineHeight * 1.85 + 2;
  }
  function fullyInViewport(el) {
    if (!el) return true;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return true;
    return r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
  }
  return {
    scrollWidth: docEl.scrollWidth,
    clientWidth: docEl.clientWidth,
    bodyScrollWidth: body.scrollWidth,
    bodyClientWidth: body.clientWidth,
    viewport: { width: vw, height: vh },
    pageOverflow: docEl.scrollWidth > docEl.clientWidth + 1,
    bar: rectOf(bar),
    status: rectOf(status),
    toggle: rectOf(toggle),
    action: rectOf(action),
    floating: rectOf(ftb),
    topbar: rectOf(topbar),
    statusText: (statusLabel && statusLabel.textContent) || (status && status.textContent) || '',
    transitionText: (actionLabel && actionLabel.textContent) || (toggle && toggle.textContent) || '',
    authoringText: (document.getElementById('mobileBottomActionLabel') || {}).textContent || '',
    statusOneLine: isOneLine(status),
    transitionOneLine: isOneLine(toggle),
    authoringOneLine: isOneLine(action),
    statusInViewport: fullyInViewport(status),
    transitionInViewport: fullyInViewport(toggle),
    actionInViewport: fullyInViewport(action),
    floatingInViewport: fullyInViewport(ftb),
    floatingDisplay: ftb ? getComputedStyle(ftb).display : 'none',
    actionHidden: action
      ? action.classList.contains('is-authoring-hidden') || getComputedStyle(action).display === 'none'
      : true,
    legacyModeCopy: /편집하려면 모드 전환/.test(document.body.innerText || ''),
    modeStatusCount: document.querySelectorAll('#mobileModeStatus, [data-mobile-mode-status-label]').length,
    modeTransitionCount: document.querySelectorAll(
      '#mobileModeToggle, [data-mode-action="enter-edit"], [data-mode-action="return-to-appreciation"]'
    ).length,
    mode: body.getAttribute('data-editor-interaction-mode')
  };
}

async function fireAuth(page) {
  await page.waitForFunction(
    () =>
      !!(window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') ||
      (Array.isArray(window.__onAuthReadyCallbacks) && window.__onAuthReadyCallbacks.length > 0) ||
      !!(window.LoveBudAuthBootstrap && window.LoveBudAuthBootstrap.ready),
    { timeout: 20000 }
  );
  await page.evaluate(() => {
    const user = { uid: 'ui-e2e-user-3586', email: 'ui-e2e-3586@example.com', displayName: 'UI E2E 3586' };
    if (window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') {
      window.LoveBudAuthCallbacks.fireAuthReadyCallbacks(user);
    }
    if (Array.isArray(window.__onAuthReadyCallbacks)) {
      window.__onAuthReadyCallbacks.forEach((cb) => { try { cb(user); } catch (_) {} });
    }
    // Some editor paths also listen to custom auth events.
    try {
      window.dispatchEvent(new CustomEvent('lovebud-auth-ready', { detail: { user } }));
    } catch (_) {}
  });
}

async function waitOwnerReady(page) {
  await page.waitForFunction(() => {
    const body = document.body;
    const ready = body && !body.classList.contains('editor-preload');
    const hasSidebar = !!document.querySelector(
      '.sidebar[data-appreciation-layout="tree-scope-rail"], .sidebar'
    );
    const hasMount = !!document.getElementById('detailTreeMetaMount');
    return ready && hasSidebar && hasMount && !!window.LoveBudEditorInteractionMode;
  }, { timeout: 30000 });
  await page.waitForFunction(() => {
    const mount = document.getElementById('detailTreeMetaMount');
    const tree = window.currentTreeData;
    return !!(mount && tree && tree.id && mount.childElementCount > 0);
  }, { timeout: 30000 });

  // Mode card injects only after canEdit resolves. Re-fire auth a few times under load.
  for (let attempt = 0; attempt < 5; attempt++) {
    const ready = await page.evaluate(() => {
      const btn = document.getElementById('editorModeTransitionBtn');
      const status = document.querySelector('[data-mode-status-label]');
      const action = document.querySelector('[data-mode-action-label]');
      return !!(
        btn &&
        status &&
        action &&
        String(status.textContent || '').trim() &&
        String(action.textContent || '').trim()
      );
    });
    if (ready) return;
    await fireAuth(page);
    await page.waitForTimeout(300);
  }

  await page.waitForFunction(() => {
    const btn = document.getElementById('editorModeTransitionBtn');
    const status = document.querySelector('[data-mode-status-label]');
    const action = document.querySelector('[data-mode-action-label]');
    return !!(
      btn &&
      status &&
      action &&
      String(status.textContent || '').trim() &&
      String(action.textContent || '').trim()
    );
  }, { timeout: 20000 });
}

function collectModeSnapshot() {
  return {
    mode: document.body.getAttribute('data-editor-interaction-mode'),
    modeEdit: /mode=edit/i.test(location.search),
    queryKeys: [...new URLSearchParams(location.search)].map((x) => x[0]),
    statusText: (document.querySelector('[data-mode-status-label]') || {}).textContent || '',
    actionText: (document.querySelector('[data-mode-action-label]') || {}).textContent || '',
    action: (document.getElementById('editorModeTransitionBtn') || {}).dataset
      ? document.getElementById('editorModeTransitionBtn').dataset.modeAction
      : null,
    mutationCount: document.querySelectorAll('.editor-owner-mutation-action').length,
    renameVisible: (() => {
      const el = document.getElementById('renameTreeBtn');
      return el ? getComputedStyle(el).display !== 'none' : false;
    })(),
    addDisplay: (() => {
      const el = document.querySelector('.editor-add-section-bottom');
      return el ? getComputedStyle(el).display : null;
    })(),
    mountKids: (document.getElementById('detailTreeMetaMount') || {}).childElementCount || 0,
    headerCount: document.querySelectorAll('header, .shared-header, .site-header').length
  };
}

test('#3586 BROWSER: appreciation → edit → return → browser back', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(REVIEW_OUT_V2, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installOwnerFixtures(page);

    await page.goto(`${base}/pages/editor.html?treeId=${encodeURIComponent(TREE.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    // Wait for editor bootstrap scripts before auth fire (reduces suite-order flake).
    await page.waitForFunction(
      () => !!(window.LoveBudEditorInteractionMode && document.getElementById('detailTreeMetaMount')),
      { timeout: 30000 }
    );
    await fireAuth(page);
    try {
      await waitOwnerReady(page);
    } catch (err) {
      const diag = await page.evaluate(() => ({
        preload: document.body.classList.contains('editor-preload'),
        tree: window.currentTreeData && window.currentTreeData.id,
        mount: (document.getElementById('detailTreeMetaMount') || {}).childElementCount || 0,
        im: !!window.LoveBudEditorInteractionMode,
        modeBtn: !!document.getElementById('editorModeTransitionBtn'),
        canEdit: window.LoveBudEditor && window.LoveBudEditor.canEdit,
        body: (document.body.innerText || '').slice(0, 240)
      })).catch(() => null);
      throw new Error(
        `waitOwnerReady failed: ${err && err.message ? err.message : err}; diag=${JSON.stringify(diag)}`
      );
    }

    // Force explicit view settle and re-sync desktop mode card labels.
    await page.evaluate(() => {
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(window.LoveBudEditorInteractionMode.MODE_VIEW, {
          replace: true,
          forceUrlSync: true
        });
      }
    });
    await page.waitForFunction(() => {
      const mode = document.body.getAttribute('data-editor-interaction-mode');
      const status = document.querySelector('[data-mode-status-label]');
      const action = document.querySelector('[data-mode-action-label]');
      return (
        mode === 'view' &&
        status &&
        /감상/.test(String(status.textContent || '')) &&
        action &&
        /편집하기/.test(String(action.textContent || ''))
      );
    }, { timeout: 10000 });

    let snap = await page.evaluate(collectModeSnapshot);
    assert.equal(snap.mode, 'view');
    assert.equal(snap.modeEdit, false);
    assert.match(String(snap.statusText || ''), /감상/);
    assert.match(String(snap.actionText || ''), /편집하기/);
    assert.equal(snap.mutationCount, 0, 'appreciation hides mutation actions');
    assert.equal(snap.renameVisible, false);
    assert.equal(snap.addDisplay, 'none');
    assert.ok(snap.mountKids >= 1);
    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-owner-appreciation-desktop.png'),
      fullPage: false
    });

    // Enter edit
    await page.click('#editorModeTransitionBtn');
    await page.waitForFunction(() => {
      const mode = document.body.getAttribute('data-editor-interaction-mode');
      const status = document.querySelector('[data-mode-status-label]');
      const action = document.querySelector('[data-mode-action-label]');
      return (
        mode === 'edit' &&
        /mode=edit/i.test(location.search) &&
        status &&
        /편집/.test(String(status.textContent || '')) &&
        action &&
        /감상으로 돌아가기/.test(String(action.textContent || ''))
      );
    }, { timeout: 10000 });
    snap = await page.evaluate(collectModeSnapshot);
    assert.equal(snap.mode, 'edit');
    assert.equal(snap.modeEdit, true);
    assert.match(String(snap.statusText || ''), /편집/);
    assert.match(String(snap.actionText || ''), /감상으로 돌아가기/);
    assert.ok(snap.mutationCount >= 1, 'edit shows mutation actions');
    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-owner-edit-desktop.png'),
      fullPage: false
    });

    // Return to appreciation
    await page.click('#editorModeTransitionBtn');
    await page.waitForFunction(() => {
      const mode = document.body.getAttribute('data-editor-interaction-mode');
      return mode === 'view' && !/mode=edit/i.test(location.search);
    }, { timeout: 10000 });
    snap = await page.evaluate(collectModeSnapshot);
    assert.equal(snap.mode, 'view');
    assert.equal(snap.modeEdit, false);
    assert.equal(snap.mutationCount, 0);
    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-owner-returned-appreciation-desktop.png'),
      fullPage: false
    });

    // Enter edit then browser back
    await page.click('#editorModeTransitionBtn');
    await page.waitForFunction(() => /mode=edit/i.test(location.search), { timeout: 10000 });
    assert.equal(await page.evaluate(() => /mode=edit/.test(location.search)), true);
    await page.goBack();
    await page.waitForFunction(() => {
      const mode = document.body.getAttribute('data-editor-interaction-mode');
      return mode === 'view' && !/mode=edit/i.test(location.search);
    }, { timeout: 10000 });
    snap = await page.evaluate(collectModeSnapshot);
    assert.equal(snap.mode, 'view', 'browser back returns to appreciation mode');
    assert.equal(snap.modeEdit, false);
    assert.equal(snap.queryKeys.includes('treeId') || snap.queryKeys.includes('tree'), true);

    // ── Mobile 375×812: single mode surface, no legacy CTA, geometry ──
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(window.LoveBudEditorInteractionMode.MODE_VIEW, {
          replace: true,
          forceUrlSync: true
        });
      }
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => {
      const bar = document.getElementById('mobileBottomBar');
      const status = document.getElementById('mobileModeStatus');
      const toggle = document.getElementById('mobileModeToggle');
      const action = document.getElementById('mobileBottomAction');
      if (!bar || !status || !toggle) return false;
      if (bar.classList.contains('is-hidden')) return false;
      const statusText = (status.textContent || '').trim();
      const toggleText = (toggle.textContent || '').trim();
      const actionHidden =
        !action ||
        action.classList.contains('is-authoring-hidden') ||
        getComputedStyle(action).display === 'none';
      return /감상 모드/.test(statusText) && /편집하기/.test(toggleText) && actionHidden;
    }, { timeout: 10000 });

    let mobileGeo = await page.evaluate(collectMobileGeometry);
    fs.writeFileSync(
      path.join(REVIEW_OUT_V2, '3586-owner-appreciation-mobile-geometry.json'),
      JSON.stringify(mobileGeo, null, 2),
      'utf8'
    );
    assert.equal(mobileGeo.mode, 'view');
    assert.match(mobileGeo.statusText, /감상 모드/);
    assert.match(mobileGeo.transitionText, /편집하기/);
    assert.equal(mobileGeo.actionHidden, true, 'appreciation must hide authoring primary');
    assert.equal(mobileGeo.legacyModeCopy, false, 'legacy 편집하려면 모드 전환 must be gone');
    assert.equal(mobileGeo.statusOneLine, true, 'status must stay one line');
    assert.equal(mobileGeo.transitionOneLine, true, 'transition must stay one line');
    assert.equal(mobileGeo.pageOverflow, false, 'no page-level horizontal overflow');
    assert.ok(mobileGeo.scrollWidth <= mobileGeo.clientWidth + 1);
    assert.equal(mobileGeo.statusInViewport, true);
    assert.equal(mobileGeo.transitionInViewport, true);
    // Exactly one mobile mode transition action
    const apprTransitionCount = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('#mobileBottomBar button')].filter((b) => {
        if (b.id === 'mobileBottomAction' && (
          b.classList.contains('is-authoring-hidden') || getComputedStyle(b).display === 'none'
        )) return false;
        const t = (b.textContent || '').trim();
        return /편집하기|감상으로/.test(t);
      });
      return buttons.length;
    });
    assert.equal(apprTransitionCount, 1, 'exactly one mobile mode transition in appreciation');
    const apprStatusCount = await page.evaluate(
      () => [...document.querySelectorAll('#mobileModeStatus')].filter(
        (el) => getComputedStyle(el).display !== 'none'
      ).length
    );
    assert.equal(apprStatusCount, 1, 'exactly one 감상 모드 status');
    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-owner-appreciation-mobile.png'),
      fullPage: false
    });

    // Edit mobile
    await page.evaluate(() => {
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(window.LoveBudEditorInteractionMode.MODE_EDIT);
      }
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => {
      const status = document.getElementById('mobileModeStatus');
      const toggle = document.getElementById('mobileModeToggle');
      const action = document.getElementById('mobileBottomAction');
      if (!status || !toggle || !action) return false;
      const statusText = (status.textContent || '').trim();
      const toggleText = (toggle.textContent || '').trim();
      const actionHidden =
        action.classList.contains('is-authoring-hidden') ||
        getComputedStyle(action).display === 'none';
      return (
        /편집 모드/.test(statusText) &&
        /감상으로/.test(toggleText) &&
        !actionHidden &&
        /이어가기|새 순간/.test((document.getElementById('mobileBottomActionLabel') || {}).textContent || '')
      );
    }, { timeout: 10000 });

    mobileGeo = await page.evaluate(collectMobileGeometry);
    fs.writeFileSync(
      path.join(REVIEW_OUT_V2, '3586-owner-edit-mobile-geometry.json'),
      JSON.stringify(mobileGeo, null, 2),
      'utf8'
    );
    assert.equal(mobileGeo.mode, 'edit');
    assert.match(mobileGeo.statusText, /편집 모드/);
    assert.match(mobileGeo.transitionText, /감상으로/);
    assert.equal(mobileGeo.actionHidden, false, 'edit must show authoring primary');
    assert.match(mobileGeo.authoringText, /이어가기|새 순간/);
    assert.equal(mobileGeo.legacyModeCopy, false);
    assert.equal(mobileGeo.statusOneLine, true);
    assert.equal(mobileGeo.transitionOneLine, true);
    assert.equal(mobileGeo.authoringOneLine, true);
    assert.equal(mobileGeo.pageOverflow, false);
    assert.ok(mobileGeo.scrollWidth <= mobileGeo.clientWidth + 1);
    assert.equal(mobileGeo.statusInViewport, true);
    assert.equal(mobileGeo.transitionInViewport, true);
    assert.equal(mobileGeo.actionInViewport, true);
    // Floating toolbar must be hidden on <480, so no off-screen authoring float.
    assert.ok(
      mobileGeo.floatingDisplay === 'none' || mobileGeo.floatingInViewport,
      'floating control must not sit outside viewport'
    );
    const editReturnCount = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('#mobileBottomBar button')].filter((b) => {
        const t = (b.textContent || '').trim();
        return /감상으로/.test(t);
      });
      return buttons.length;
    });
    assert.equal(editReturnCount, 1, 'exactly one mobile return transition in edit');
    const editStatusCount = await page.evaluate(
      () => [...document.querySelectorAll('#mobileModeStatus')].filter(
        (el) => getComputedStyle(el).display !== 'none'
      ).length
    );
    assert.equal(editStatusCount, 1, 'exactly one 편집 모드 status');
    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-owner-edit-mobile.png'),
      fullPage: false
    });

    await page.close();
  } finally {
    try { await browser.close(); } catch (_) {}
    await new Promise((resolve) => server.close(resolve));
  }
});

test('#3586 BROWSER public appreciation has no edit transition', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(REVIEW_OUT_V2, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installPublicFixtures(page);

    await page.goto(`${base}/pages/view.html?treeId=${encodeURIComponent(PUBLIC_TREE.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForFunction(() => {
      const body = document.body;
      const nodes = document.querySelectorAll('.memory-node, .canvas-svg .memory-node, #canvasSvg .memory-node, g.memory-node');
      const errText = (body && body.innerText) || '';
      const hasError = /트리를 불러올 수 없어요|HTTP Error 404|tree fixture not found/i.test(errText);
      const treeReady = !!(window.currentTreeData && window.currentTreeData.id);
      const memReady = Array.isArray(window.currentTreeMemories) && window.currentTreeMemories.length > 0;
      return (
        body &&
        !body.classList.contains('editor-preload') &&
        treeReady &&
        memReady &&
        nodes.length > 0 &&
        !hasError
      );
    }, { timeout: 25000 });

    // Ensure shared header mount (view.html wires renderSharedHeader like editor).
    await page.evaluate(() => {
      if (typeof window.renderSharedHeader === 'function') {
        const el = document.getElementById('shared-header');
        if (el && el.childElementCount === 0) window.renderSharedHeader();
      }
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('shared-header');
      return !!(el && (el.childElementCount > 0 || /LoveTree|둘러보기|내 러브트리/.test(el.textContent || '')));
    }, { timeout: 10000 });

    // Give layout/detail a beat to settle for screenshot evidence.
    await page.waitForTimeout(400);

    const pub = await page.evaluate(() => {
      const bodyText = document.body ? document.body.innerText || '' : '';
      const nodes = document.querySelectorAll(
        '.memory-node, #canvasSvg .memory-node, g.memory-node, .node-info-label'
      );
      const shared = document.getElementById('shared-header');
      const headerHasChildren = !!(
        shared &&
        (shared.childElementCount > 0 ||
          (shared.querySelector('nav, a, .logo, header') && true) ||
          /LoveTree|LoveBud|둘러보기|내 러브트리/.test(shared.textContent || ''))
      );
      return {
        readonly: document.body.classList.contains('editor-readonly'),
        mode: document.body.getAttribute('data-editor-interaction-mode'),
        hasModeCard: !!document.querySelector(
          '[data-editor-mode-card], #editorDesktopModeToggle, #editorModeTransitionBtn, #mobileModeToggle, #mobileModeCluster'
        ),
        mutation: document.querySelectorAll('.editor-owner-mutation-action, #renameTreeBtn, #sidebarVisibilityToggleBtn').length,
        editLabels: [...document.querySelectorAll('button,a')]
          .map((el) => (el.textContent || '').trim())
          .filter((t) => /^(편집하기|편집 모드|감상으로 돌아가기)$/.test(t) || t === '편집하기').length,
        nodeCount: nodes.length,
        treeId: window.currentTreeData && window.currentTreeData.id,
        memoryCount: Array.isArray(window.currentTreeMemories) ? window.currentTreeMemories.length : 0,
        hasHeader: headerHasChildren,
        hasHttpError: /트리를 불러올 수 없어요|HTTP Error 404/i.test(bodyText),
        bodySnippet: bodyText.slice(0, 200)
      };
    });

    fs.writeFileSync(
      path.join(REVIEW_OUT_V2, '3586-public-appreciation-desktop-runtime.json'),
      JSON.stringify(pub, null, 2),
      'utf8'
    );

    assert.equal(pub.hasHttpError, false, 'public fixture must not show HTTP/load error');
    assert.ok(pub.treeId, 'public tree must load');
    assert.ok(pub.memoryCount > 0, 'public memories must load');
    assert.ok(pub.nodeCount > 0, 'public canvas must render nodes');
    assert.equal(pub.hasHeader, true, 'shared header must be present');
    assert.equal(pub.hasModeCard, false, 'public must not expose owner mode transition card');
    assert.equal(pub.mutation, 0);
    assert.equal(pub.editLabels, 0, 'public must not show Edit transition labels');

    await page.screenshot({
      path: path.join(REVIEW_OUT_V2, '3586-public-appreciation-desktop.png'),
      fullPage: false
    });
    await page.close();
  } finally {
    try { await browser.close(); } catch (_) {}
    await new Promise((resolve) => server.close(resolve));
  }
});
