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
const editorHtml = read('pages/editor.html');

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

test('#3586 source: mobile toggle no longer uses ambiguous 보기', () => {
  assert.match(mobileSrc, /편집하기/);
  assert.match(mobileSrc, /감상으로 돌아가기/);
  assert.doesNotMatch(mobileSrc, /textContent = '보기'/);
  assert.doesNotMatch(mobileSrc, /aria-label',\s*'보기 모드'/);
});

test('#3586 CSS: view mode hides owner mutation actions', () => {
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #renameTreeBtn/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #sidebarVisibilityToggleBtn/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] \.editor-owner-mutation-action/);
  assert.match(modeCss, /\.editor-mode-status-badge/);
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

async function installOwnerFixtures(page) {
  const user = { uid: 'ui-e2e-user-3586', email: 'ui-e2e-3586@example.com', displayName: 'UI E2E 3586' };
  const trees = [TREE];
  const memoriesByTreeId = { [TREE.id]: [MOMENT] };

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

async function fireAuth(page) {
  await page.waitForFunction(
    () =>
      !!(window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') ||
      (Array.isArray(window.__onAuthReadyCallbacks) && window.__onAuthReadyCallbacks.length > 0),
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const user = { uid: 'ui-e2e-user-3586', email: 'ui-e2e-3586@example.com', displayName: 'UI E2E 3586' };
    if (window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') {
      window.LoveBudAuthCallbacks.fireAuthReadyCallbacks(user);
      return;
    }
    if (Array.isArray(window.__onAuthReadyCallbacks)) {
      window.__onAuthReadyCallbacks.forEach((cb) => { try { cb(user); } catch (_) {} });
    }
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
  }, { timeout: 25000 });
  await page.waitForFunction(() => {
    const mount = document.getElementById('detailTreeMetaMount');
    const tree = window.currentTreeData;
    return !!(mount && tree && tree.id && mount.childElementCount > 0);
  }, { timeout: 25000 });
  // Owner mode card is injected only after canEdit resolves; wait before mode assertions.
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
  }, { timeout: 15000 });
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
  const outDir = path.resolve(ROOT, '..', 'lovebud-review-output', '3586');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installOwnerFixtures(page);

    await page.goto(`${base}/pages/editor.html?treeId=${encodeURIComponent(TREE.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await fireAuth(page);
    await waitOwnerReady(page);

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
    await page.screenshot({ path: path.join(outDir, '3586-owner-appreciation-desktop.png'), fullPage: false });

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
    await page.screenshot({ path: path.join(outDir, '3586-owner-edit-desktop.png'), fullPage: false });

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
    await page.screenshot({ path: path.join(outDir, '3586-owner-returned-appreciation-desktop.png'), fullPage: false });

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

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(window.LoveBudEditorInteractionMode.MODE_VIEW, {
          replace: true,
          forceUrlSync: true
        });
      }
    });
    await page.screenshot({ path: path.join(outDir, '3586-owner-appreciation-mobile.png'), fullPage: false });
    await page.evaluate(() => {
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(window.LoveBudEditorInteractionMode.MODE_EDIT);
      }
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, '3586-owner-edit-mobile.png'), fullPage: false });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    assert.equal(overflow, false, 'no horizontal overflow at 375');

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
  const outDir = path.resolve(ROOT, '..', 'lovebud-review-output', '3586');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Minimal public static shell: view page may need more stubs; assert source/DOM of loaded CSS/JS authority
    await page.goto(`${base}/pages/view.html?treeId=${encodeURIComponent(TREE.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(800);
    const pub = await page.evaluate(() => ({
      readonly: document.body.classList.contains('editor-readonly'),
      mode: document.body.getAttribute('data-editor-interaction-mode'),
      hasModeCard: !!document.querySelector('[data-editor-mode-card], #editorDesktopModeToggle, #editorModeTransitionBtn'),
      mutation: document.querySelectorAll('.editor-owner-mutation-action').length,
      editLabels: [...document.querySelectorAll('button,a')]
        .map((el) => (el.textContent || '').trim())
        .filter((t) => /편집하기|편집 모드/.test(t)).length
    }));
    assert.equal(pub.readonly, true);
    assert.equal(pub.hasModeCard, false, 'public must not expose owner mode transition card');
    assert.equal(pub.mutation, 0);
    assert.equal(pub.editLabels, 0);
    await page.screenshot({ path: path.join(outDir, '3586-public-appreciation-desktop.png'), fullPage: false });
    await page.close();
  } finally {
    try { await browser.close(); } catch (_) {}
    await new Promise((resolve) => server.close(resolve));
  }
});
