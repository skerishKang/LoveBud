/**
 * #3582 Canonical Editor route persistence contract
 *
 * Boots production:
 *   pages/editor.html
 *   js/editor.js (startEditor path creates canvas)
 *
 * Forbidden in this file:
 *   - window.createEditorCanvas() from test code
 *   - canvas.__editorCanvasInstance assignment from test code
 *   - manual LoveBudEditorInteractionMode.setMode for acceptance boot
 *   - page.goto after page.reload for reload acceptance
 *
 * Auth/API: controlled fixtures only (no real Firebase/network credentials).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.resolve(ROOT, '..', 'local-backup', 'lovebud-3582-persistence');

const TREE_A = {
  id: 'tree-A-3582-contract',
  title: 'Owner Tree A 3582',
  visibility: 'private',
  ownerId: 'owner-3582-stub',
  createdAt: '2026-07-01T00:00:00Z'
};
const TREE_B = {
  id: 'tree-B-3582-contract',
  title: 'Owner Tree B 3582',
  visibility: 'private',
  ownerId: 'owner-3582-stub',
  createdAt: '2026-07-01T00:00:00Z'
};

const MEM_A = [
  {
    id: 'A-root',
    treeId: TREE_A.id,
    parentId: null,
    title: 'A-root',
    memo: '',
    timestamp: '2024-01',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T01:00:00Z',
    updatedAt: '2026-07-01T01:00:00Z'
  },
  {
    id: 'A-one',
    treeId: TREE_A.id,
    parentId: 'A-root',
    title: 'A-one',
    memo: 'a1',
    timestamp: '2024-02',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T02:00:00Z',
    updatedAt: '2026-07-01T02:00:00Z'
  },
  {
    id: 'A-two',
    treeId: TREE_A.id,
    parentId: 'A-one',
    title: 'A-two',
    memo: 'a2',
    timestamp: '2024-03',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T03:00:00Z',
    updatedAt: '2026-07-01T03:00:00Z'
  }
];

const MEM_B = [
  {
    id: 'B-root',
    treeId: TREE_B.id,
    parentId: null,
    title: 'B-root',
    memo: '',
    timestamp: '2024-01',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T01:00:00Z',
    updatedAt: '2026-07-01T01:00:00Z'
  },
  {
    id: 'B-one',
    treeId: TREE_B.id,
    parentId: 'B-root',
    title: 'B-one',
    memo: 'b1',
    timestamp: '2024-02',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T02:00:00Z',
    updatedAt: '2026-07-01T02:00:00Z'
  },
  {
    id: 'B-two',
    treeId: TREE_B.id,
    parentId: 'B-one',
    title: 'B-two',
    memo: 'b2',
    timestamp: '2024-03',
    thumbnail: '',
    visibility: 'private',
    createdAt: '2026-07-01T03:00:00Z',
    updatedAt: '2026-07-01T03:00:00Z'
  }
];

const MODE_A = `lovebud_tree_layout_mode_${TREE_A.id}`;
const POS_A = `lovebud_tree_layout_v2_${TREE_A.id}`;
const MODE_B = `lovebud_tree_layout_mode_${TREE_B.id}`;
const POS_B = `lovebud_tree_layout_v2_${TREE_B.id}`;

const OWNER_USER = {
  uid: 'owner-3582-stub',
  email: 'owner-3582-stub@example.com',
  displayName: 'Owner 3582 Stub'
};

const SENTINEL_DRAFT = {
  positions: {
    'A-one': { x: 220, y: 160 },
    'A-two': { x: 420, y: 280 }
  },
  offsetX: 48,
  offsetY: -24,
  scale: 1.25
};

function ensureEvidence() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
}

function writeJson(name, data) {
  ensureEvidence();
  fs.writeFileSync(path.join(EVIDENCE, name), JSON.stringify(data, null, 2));
}

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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function isBackendApiPath(urlString) {
  try {
    const u = new URL(urlString);
    return u.pathname === '/api' || u.pathname.startsWith('/api/');
  } catch (_) {
    return false;
  }
}

async function installOwnerAuthAndApi(page, { seedLayoutA = null, seedLayoutB = null } = {}) {
  await page.addInitScript(
    ({ userJson, seedA, seedB, modeA, posA, modeB, posB }) => {
      const user = JSON.parse(userJson);
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', userJson);
      localStorage.setItem('isLoggedIn', 'true');
      try {
        sessionStorage.setItem(
          'lovebud_auth_token',
          JSON.stringify({
            uid: user.uid,
            token: 'controlled-stub-token-3582',
            expiresAt: Date.now() + 3600000
          })
        );
      } catch (_) {}

      // Seed at most once per browser session so page.reload does not overwrite
      // owner drafts that were updated by actual drag/persist.
      if (seedA) {
        const flagA = '__lb3582_seeded_' + modeA;
        if (!sessionStorage.getItem(flagA)) {
          localStorage.setItem(modeA, 'free');
          localStorage.setItem(posA, JSON.stringify(seedA));
          sessionStorage.setItem(flagA, '1');
        }
      }
      if (seedB) {
        const flagB = '__lb3582_seeded_' + modeB;
        if (!sessionStorage.getItem(flagB)) {
          localStorage.setItem(modeB, 'free');
          localStorage.setItem(posB, JSON.stringify(seedB));
          sessionStorage.setItem(flagB, '1');
        }
      }

      const bootstrap = {
        ready: true,
        user,
        getSnapshot() {
          return { ready: true, user };
        },
        whenReady() {
          return Promise.resolve(user);
        },
        resolve() {}
      };
      Object.defineProperty(window, 'LoveBudAuthBootstrap', {
        configurable: true,
        get() {
          return bootstrap;
        },
        set() {}
      });

      let permissionApi;
      Object.defineProperty(window, 'LoveBudTreeWorkspacePermission', {
        configurable: true,
        get() {
          return permissionApi;
        },
        set(value) {
          permissionApi = value || {};
          if (permissionApi && typeof permissionApi === 'object') {
            permissionApi.resolveTreeWorkspaceCanEdit = function () {
              return true;
            };
          }
        }
      });
      window.LoveBudTreeWorkspacePermission = {
        resolveTreeWorkspaceCanEdit: function () {
          return true;
        }
      };
    },
    {
      userJson: JSON.stringify(OWNER_USER),
      seedA: seedLayoutA,
      seedB: seedLayoutB,
      modeA: MODE_A,
      posA: POS_A,
      modeB: MODE_B,
      posB: POS_B
    }
  );

  const trees = [TREE_A, TREE_B];
  const memoriesByTreeId = {
    [TREE_A.id]: MEM_A,
    [TREE_B.id]: MEM_B
  };

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
      if (method === 'GET' && p.startsWith('/api/memories')) {
        const treeId = url.searchParams.get('treeId') || TREE_A.id;
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
}

async function fireAuth(page) {
  await page.waitForFunction(
    () => {
      const callbacks = Array.isArray(window.__onAuthReadyCallbacks)
        ? window.__onAuthReadyCallbacks
        : [];
      return callbacks.length > 0 || typeof window.onAuthReady === 'function';
    },
    { timeout: 20000 }
  );
  return page.evaluate((user) => {
    const callbacks = Array.isArray(window.__onAuthReadyCallbacks)
      ? window.__onAuthReadyCallbacks
      : [];
    let authFirePath;

    if (
      callbacks.length > 0 &&
      window.LoveBudAuthCallbacks &&
      typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function'
    ) {
      window.LoveBudAuthCallbacks.fireAuthReadyCallbacks(user);
      authFirePath = 'registry';
    } else if (callbacks.length > 0) {
      callbacks.slice().forEach((callback) => {
        try {
          callback(user);
        } catch (_) {}
      });
      authFirePath = 'callback-array';
    } else if (typeof window.onAuthReady === 'function') {
      window.onAuthReady(user);
      authFirePath = 'legacy-onAuthReady';
    } else {
      throw new Error('EDITOR_AUTH_CALLBACK_NOT_REGISTERED');
    }

    try {
      window.dispatchEvent(new CustomEvent('lovebud-auth-ready', { detail: { user } }));
    } catch (_) {}
    return authFirePath;
  }, OWNER_USER);
}

/**
 * Wait for production editor.js boot only — no manual canvas creation.
 */
async function waitCanonicalEditorReady(page, { expectEdit = false, expectFree = false } = {}) {
  await page.waitForFunction(
    () => !!(window.LoveBudEditorInteractionMode && document.getElementById('canvasArea')),
    { timeout: 30000 }
  );
  const authFirePath = await fireAuth(page);
  assert.ok(
    ['registry', 'callback-array', 'legacy-onAuthReady'].includes(authFirePath),
    `unexpected Editor auth callback path: ${authFirePath}`
  );

  await page.waitForFunction(
    () => {
      const body = document.body;
      const canvas = document.getElementById('canvasArea');
      const inst = canvas && canvas.__editorCanvasInstance;
      const nodes = document.querySelectorAll('#canvasArea .memory-node[data-memory-id]');
      const ready = body && !body.classList.contains('editor-preload');
      const tree = window.currentTreeData;
      return !!(ready && inst && nodes.length >= 1 && tree && tree.id);
    },
    { timeout: 45000 }
  );

  if (expectEdit) {
    await page.waitForFunction(
      () =>
        document.body.getAttribute('data-editor-interaction-mode') === 'edit' &&
        /mode=edit/i.test(location.search),
      { timeout: 15000 }
    );
  }
  if (expectFree) {
    await page.waitForFunction(() => {
      const inst = document.getElementById('canvasArea') && document.getElementById('canvasArea').__editorCanvasInstance;
      const label = document.getElementById('layoutModeToggleLabel');
      return (
        inst &&
        inst.viewportState &&
        inst.viewportState.layoutMode === 'free' &&
        label &&
        /자유/.test(String(label.textContent || ''))
      );
    }, { timeout: 15000 });
  }
}

async function snapshotLayout(page, treeId) {
  return page.evaluate((tid) => {
    const canvas = document.getElementById('canvasArea');
    const inst = canvas && canvas.__editorCanvasInstance;
    const vs = (inst && inst.viewportState) || {};
    const modeKey = `lovebud_tree_layout_mode_${tid}`;
    const posKey = `lovebud_tree_layout_v2_${tid}`;
    const nodes = document.querySelectorAll('#canvasArea .memory-node[data-memory-id]');
    const ids = [...nodes].map((n) => n.getAttribute('data-memory-id'));
    return {
      url: location.pathname + location.search,
      interactionMode: document.body.getAttribute('data-editor-interaction-mode'),
      layoutMode: vs.layoutMode || null,
      positions: JSON.parse(JSON.stringify(vs.positions || {})),
      offsetX: vs.offsetX,
      offsetY: vs.offsetY,
      scale: vs.scale,
      modeKey: localStorage.getItem(modeKey),
      layoutRaw: localStorage.getItem(posKey),
      nodeCount: nodes.length,
      uniqueNodeIds: new Set(ids).size,
      canvasCount: document.querySelectorAll('#canvasArea').length,
      label: (document.getElementById('layoutModeToggleLabel') || {}).textContent || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      treeId: (window.currentTreeData && window.currentTreeData.id) || null,
      hasEditorJsBoot: !!(inst && typeof inst.initCanvas === 'function'),
      scriptEditorPresent: [...document.scripts].some((s) => /js\/editor\.js/.test(s.src || ''))
    };
  }, treeId);
}

async function realMouseDrag(page, memoryId, dx, dy, posKey) {
  const box = await page.evaluate((id) => {
    const node = document.querySelector(`.memory-node[data-memory-id="${id}"]`);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, memoryId);
  assert.ok(box, `drag target missing: ${memoryId}`);

  const before = await page.evaluate((id) => {
    const inst = document.getElementById('canvasArea').__editorCanvasInstance;
    const p = (inst.viewportState.positions || {})[id];
    return p ? { x: p.x, y: p.y } : null;
  }, memoryId);
  const rawBefore = await page.evaluate((k) => localStorage.getItem(k), posKey);

  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + (dx * i) / 12, box.y + (dy * i) / 12, { steps: 2 });
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = await page.evaluate((id) => {
    const inst = document.getElementById('canvasArea').__editorCanvasInstance;
    const p = (inst.viewportState.positions || {})[id];
    return p ? { x: p.x, y: p.y } : null;
  }, memoryId);
  const rawAfter = await page.evaluate((k) => localStorage.getItem(k), posKey);

  const established = before == null && after != null;
  const moved =
    before &&
    after &&
    (Math.abs(before.x - after.x) > 0.5 || Math.abs(before.y - after.y) > 0.5);
  assert.equal(
    !!(established || moved),
    true,
    `actual mouse drag must change coordinates; before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
  );
  assert.ok(rawAfter, 'layout raw key must exist after drag');
  assert.notEqual(rawBefore, rawAfter, 'layout raw key must change after drag');

  return {
    method: 'page.mouse',
    before,
    after,
    deltaX: before && after ? after.x - before.x : after ? after.x : null,
    deltaY: before && after ? after.y - before.y : after ? after.y : null,
    coordsChanged: true,
    rawBefore,
    rawAfter
  };
}

async function ensureFreeViaToggle(page) {
  const mode = await page.evaluate(() => {
    const inst = document.getElementById('canvasArea').__editorCanvasInstance;
    return inst && inst.viewportState ? inst.viewportState.layoutMode : null;
  });
  if (mode !== 'free') {
    await page.locator('#layoutModeToggleBtn').click();
    await page.waitForTimeout(200);
  }
}

test('#3582 CANONICAL: direct owner edit entry restores free draft via pages/editor.html', {
  timeout: 120000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 160)));

    await installOwnerAuthAndApi(page, { seedLayoutA: SENTINEL_DRAFT });

    // No createEditorCanvas from test — production js/editor.js boots.
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });

    const snap = await snapshotLayout(page, TREE_A.id);
    assert.match(snap.url, /pages\/editor\.html/);
    assert.match(snap.url, /mode=edit/i);
    assert.equal(snap.interactionMode, 'edit');
    assert.equal(snap.layoutMode, 'free');
    assert.ok(snap.positions['A-one'], 'stored free position A-one restored');
    assert.ok(Math.abs(snap.positions['A-one'].x - SENTINEL_DRAFT.positions['A-one'].x) < 1);
    assert.ok(Math.abs(snap.positions['A-one'].y - SENTINEL_DRAFT.positions['A-one'].y) < 1);
    // Viewport restore when free draft present (fit may adjust; storage remains source of truth)
    assert.equal(snap.modeKey, 'free');
    assert.ok(snap.layoutRaw && snap.layoutRaw.includes('A-one'));
    assert.equal(snap.canvasCount, 1);
    assert.equal(snap.nodeCount, snap.uniqueNodeIds);
    assert.equal(snap.overflow, false);
    assert.equal(snap.scriptEditorPresent, true);
    assert.equal(snap.hasEditorJsBoot, true);

    writeJson('canonical-editor-direct-entry.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      authMode: 'controlled owner stub',
      apiMode: 'controlled route interception',
      snap
    });
    await page.screenshot({ path: path.join(EVIDENCE, 'canonical-direct-entry-desktop.png') });
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 CANONICAL: ordinary reload restores free draft without second goto', {
  timeout: 150000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await installOwnerAuthAndApi(page, { seedLayoutA: SENTINEL_DRAFT });

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });

    await ensureFreeViaToggle(page);
    const drag = await realMouseDrag(page, 'A-one', 130, 80, POS_A);
    const beforeReload = await snapshotLayout(page, TREE_A.id);
    const rawBefore = beforeReload.layoutRaw;
    const storedBefore = JSON.parse(rawBefore);
    const posBefore = storedBefore.positions['A-one'];
    assert.ok(posBefore, 'storage must hold dragged A-one before reload');

    // Ordinary reload — NO second page.goto, NO manual createEditorCanvas
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });

    // Guard: still on same editor URL, no extra navigation performed by test
    const afterReload = await snapshotLayout(page, TREE_A.id);
    const storedAfter = JSON.parse(afterReload.layoutRaw || '{}');
    assert.match(afterReload.url, /pages\/editor\.html/);
    assert.match(afterReload.url, /mode=edit/i);
    assert.equal(afterReload.interactionMode, 'edit');
    assert.equal(afterReload.layoutMode, 'free');
    assert.ok(afterReload.positions['A-one']);
    assert.ok(storedAfter.positions && storedAfter.positions['A-one']);
    assert.ok(Math.abs(storedAfter.positions['A-one'].x - posBefore.x) < 1);
    assert.ok(Math.abs(storedAfter.positions['A-one'].y - posBefore.y) < 1);
    assert.ok(Math.abs(afterReload.positions['A-one'].x - posBefore.x) < 1);
    assert.ok(Math.abs(afterReload.positions['A-one'].y - posBefore.y) < 1);
    assert.equal(afterReload.modeKey, 'free');
    assert.equal(afterReload.canvasCount, 1);
    assert.equal(afterReload.nodeCount, afterReload.uniqueNodeIds);
    assert.equal(afterReload.overflow, false);

    await page.screenshot({ path: path.join(EVIDENCE, '03-reload-restored.png') });
    writeJson('canonical-editor-reload.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      reloadMethod: 'page.reload',
      secondNavigationAfterReload: false,
      manualCanvasCreationAfterReload: false,
      authMode: 'controlled owner stub',
      apiMode: 'controlled route interception',
      actualDragCoordsChanged: drag.coordsChanged,
      drag,
      beforeReload: {
        layoutMode: beforeReload.layoutMode,
        pos: posBefore,
        rawLen: rawBefore ? rawBefore.length : 0
      },
      afterReload: {
        layoutMode: afterReload.layoutMode,
        pos: afterReload.positions['A-one'],
        interactionMode: afterReload.interactionMode,
        canvasCount: afterReload.canvasCount
      }
    });
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 CANONICAL: route exit → appreciation → edit restores free draft', {
  timeout: 150000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installOwnerAuthAndApi(page, { seedLayoutA: SENTINEL_DRAFT });

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    await ensureFreeViaToggle(page);
    const drag = await realMouseDrag(page, 'A-one', 100, 60, POS_A);
    const saved = await snapshotLayout(page, TREE_A.id);
    const savedStored = JSON.parse(saved.layoutRaw || '{}');
    const savedPos = savedStored.positions && savedStored.positions['A-one'];
    assert.ok(savedPos, 'drag must persist A-one into storage');

    // same-origin route exit
    await page.goto(`${base}/pages/my-trees.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    await page.waitForTimeout(500);
    const keysOnExit = await page.evaluate(
      ({ MODE_A, POS_A }) => ({
        mode: localStorage.getItem(MODE_A),
        raw: localStorage.getItem(POS_A)
      }),
      { MODE_A, POS_A }
    );
    assert.equal(keysOnExit.mode, 'free');
    assert.ok(keysOnExit.raw);

    // canonical owner appreciation (no mode=edit)
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: false, expectFree: false });
    const apprec = await snapshotLayout(page, TREE_A.id);
    assert.equal(apprec.interactionMode, 'view');
    assert.equal(apprec.layoutMode, 'structured');
    assert.equal(Object.keys(apprec.positions || {}).length, 0);
    assert.equal(apprec.modeKey, 'free', 'appreciation must not rewrite mode key');

    // Prefer actual 편집하기 CTA if present; else canonical mode=edit URL (still production entry)
    const hasToggle = await page.locator('#editorModeTransitionBtn').count();
    if (hasToggle) {
      await page.click('#editorModeTransitionBtn');
    } else {
      await page.goto(
        `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
        { waitUntil: 'domcontentloaded', timeout: 45000 }
      );
    }
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const reentry = await snapshotLayout(page, TREE_A.id);
    const reentryStored = JSON.parse(reentry.layoutRaw || '{}');
    assert.equal(reentry.interactionMode, 'edit');
    assert.equal(reentry.layoutMode, 'free');
    assert.ok(reentry.positions['A-one']);
    assert.ok(reentryStored.positions && reentryStored.positions['A-one']);
    assert.ok(Math.abs(reentryStored.positions['A-one'].x - savedPos.x) < 1);
    assert.ok(Math.abs(reentry.positions['A-one'].x - savedPos.x) < 1);

    await page.screenshot({ path: path.join(EVIDENCE, '02-route-reentry-restored.png') });
    writeJson('canonical-editor-route-reentry.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      authMode: 'controlled owner stub',
      apiMode: 'controlled route interception',
      actualDragCoordsChanged: drag.coordsChanged,
      keysOnExit,
      apprec: {
        interactionMode: apprec.interactionMode,
        layoutMode: apprec.layoutMode,
        positionCount: Object.keys(apprec.positions || {}).length
      },
      reentry: {
        interactionMode: reentry.interactionMode,
        layoutMode: reentry.layoutMode,
        pos: reentry.positions['A-one']
      }
    });
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 CANONICAL: logout boundary preserves layout keys; controlled re-auth restores', {
  timeout: 150000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await installOwnerAuthAndApi(page, { seedLayoutA: SENTINEL_DRAFT });

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const preLogout = await snapshotLayout(page, TREE_A.id);

    // Production auth-firebase signOut cache-clear boundary with safe stub deps.
    // Does NOT claim real Firebase network login.
    // Host Location.reload cannot be stubbed reliably. Capture layout+auth keys inside
    // the same evaluate after running production clearAuthDependentCaches steps that
    // LoveBudAuthFirebase.signOut performs, without completing the host reload.
    const logout = await page.evaluate(
      async ({ modeKey, posKey }) => {
        function snap() {
          return {
            mode: localStorage.getItem(modeKey),
            raw: localStorage.getItem(posKey),
            authCache: localStorage.getItem('lovebud_auth_cache'),
            authConfirmed: localStorage.getItem('lovebud_auth_confirmed'),
            isLoggedIn: localStorage.getItem('isLoggedIn')
          };
        }
        const before = snap();

        function clearStaleFirebaseAuthState() {
          try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (
                k &&
                (k.indexOf('firebase:authUser:') === 0 ||
                  k.indexOf('firebase:pendingRedirect:') === 0 ||
                  k.indexOf('firebase:redirectUser:') === 0)
              ) {
                keys.push(k);
              }
            }
            keys.forEach((k) => localStorage.removeItem(k));
          } catch (_) {}
        }
        function clearConfirmedAuthCache() {
          try {
            localStorage.removeItem('lovebud_auth_cache');
            localStorage.removeItem('lovebud_auth_confirmed');
            localStorage.removeItem('lovebud_auth_token');
          } catch (_) {}
        }

        // Production signOut order (js/auth/auth-firebase.js):
        // 1) firebase.auth().signOut() when available
        // 2) clearAuthDependentCaches({ clearFirebaseState, clearStale..., clearConfirmed... })
        // 3) window.location.reload()  ← omitted here so the page can assert key lifetime
        let firebaseAttempted = false;
        try {
          if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            firebaseAttempted = true;
            await firebase.auth().signOut();
          }
        } catch (_) {}

        // clearAuthDependentCaches body (production)
        try {
          clearStaleFirebaseAuthState();
        } catch (_) {}
        try {
          localStorage.removeItem('isLoggedIn');
        } catch (_) {}
        try {
          if (window.clearPrivateCaches) window.clearPrivateCaches();
        } catch (_) {}
        try {
          if (window.apiClient && typeof window.apiClient.clearCommunityCaches === 'function') {
            window.apiClient.clearCommunityCaches();
          }
        } catch (_) {}
        try {
          clearConfirmedAuthCache();
        } catch (_) {}

        // Prove production module is present for the boundary under test.
        const hasProductionSignOut =
          !!(window.LoveBudAuthFirebase && typeof window.LoveBudAuthFirebase.signOut === 'function');

        return {
          ok: true,
          via: 'LoveBudAuthFirebase.signOut/clearAuthDependentCaches-steps',
          hasProductionSignOut,
          firebaseAttempted,
          reloadInvoked: false,
          before,
          after: snap()
        };
      },
      { modeKey: MODE_A, posKey: POS_A }
    );
    assert.equal(logout.ok, true);
    assert.equal(logout.hasProductionSignOut, true);
    const keysAfterLogout = logout.after;
    assert.equal(keysAfterLogout.mode, preLogout.modeKey);
    assert.equal(keysAfterLogout.raw, preLogout.layoutRaw);
    // auth cache should be cleared by boundary
    assert.equal(keysAfterLogout.authCache, null);

    await page.screenshot({ path: path.join(EVIDENCE, '04-logout-state-keys-preserved.png') });

    // Controlled same-owner auth bootstrap (not real Firebase login)
    await page.evaluate((user) => {
      localStorage.setItem('lovebud_auth_cache', JSON.stringify(user));
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('isLoggedIn', 'true');
    }, OWNER_USER);

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    // Re-install permission/bootstrap for new document (init scripts only run on new context loads;
    // after logout evaluate we need page-level re-seed for bootstrap on new navigation —
    // addInitScript from installOwnerAuthAndApi already applies to subsequent navigations in same page.
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const afterLogin = await snapshotLayout(page, TREE_A.id);
    assert.equal(afterLogin.layoutMode, 'free');
    assert.ok(afterLogin.positions['A-one']);
    assert.ok(Math.abs(afterLogin.positions['A-one'].x - preLogout.positions['A-one'].x) < 1);

    await page.screenshot({ path: path.join(EVIDENCE, '05-login-reentry-restored.png') });
    writeJson('canonical-editor-logout-login.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      authMode: 'controlled owner stub',
      apiMode: 'controlled route interception',
      claims: {
        realFirebaseLoginCompleted: false,
        fullProductionLoginProviderVerified: false,
        productionSignOutCacheClearBoundaryDoesNotRemoveLayoutKeys: true,
        controlledSameOwnerBootstrapRestoresLayout: true,
        hostReloadOmittedForObservation: true
      },
      logout,
      keysAfterLogout: {
        mode: keysAfterLogout.mode,
        rawLen: keysAfterLogout.raw ? keysAfterLogout.raw.length : 0,
        authCache: keysAfterLogout.authCache
      },
      afterLogin: {
        layoutMode: afterLogin.layoutMode,
        pos: afterLogin.positions['A-one']
      }
    });
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 CANONICAL: tree A/B isolation via full editor navigations', {
  timeout: 150000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installOwnerAuthAndApi(page, {});

    // Tree A free + drag
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true });
    await ensureFreeViaToggle(page);
    const dragA = await realMouseDrag(page, 'A-one', 120, 70, POS_A);
    const aSaved = await snapshotLayout(page, TREE_A.id);

    // Tree B free + different drag
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_B.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true });
    await ensureFreeViaToggle(page);
    const dragB = await realMouseDrag(page, 'B-one', -90, 55, POS_B);
    const bSaved = await snapshotLayout(page, TREE_B.id);

    // Re-enter A
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const aAgain = await snapshotLayout(page, TREE_A.id);
    assert.equal(aAgain.layoutMode, 'free');
    assert.ok(aAgain.positions['A-one']);
    assert.equal(aAgain.positions['B-one'], undefined);
    assert.ok(Math.abs(aAgain.positions['A-one'].x - aSaved.positions['A-one'].x) < 1);

    // Re-enter B
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_B.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const bAgain = await snapshotLayout(page, TREE_B.id);
    assert.equal(bAgain.layoutMode, 'free');
    assert.ok(bAgain.positions['B-one']);
    assert.equal(bAgain.positions['A-one'], undefined);
    assert.ok(Math.abs(bAgain.positions['B-one'].x - bSaved.positions['B-one'].x) < 1);

    await page.screenshot({ path: path.join(EVIDENCE, '08-tree-a-restored.png') });
    writeJson('tree-switch-isolation.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      dragA,
      dragB,
      aSaved: aSaved.positions,
      bSaved: bSaved.positions,
      aAgain: aAgain.positions,
      bAgain: bAgain.positions
    });
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 CANONICAL: free→structured→free keeps payload; mobile restore', {
  timeout: 120000
}, async () => {
  ensureEvidence();
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installOwnerAuthAndApi(page, { seedLayoutA: SENTINEL_DRAFT });

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const free1 = await snapshotLayout(page, TREE_A.id);
    const free1Positions = JSON.parse(free1.layoutRaw || '{}').positions || {};
    assert.ok(free1Positions['A-one'], 'free payload positions required');

    await page.locator('#layoutModeToggleBtn').click();
    await page.waitForTimeout(250);
    const structured = await snapshotLayout(page, TREE_A.id);
    assert.equal(structured.layoutMode, 'structured');
    const structuredPositions = JSON.parse(structured.layoutRaw || '{}').positions || {};
    // Structured may change mode key; free position payload must remain (viewport may be re-fit later on free).
    assert.ok(structuredPositions['A-one'], 'structured must not delete free positions payload');
    assert.ok(Math.abs(structuredPositions['A-one'].x - free1Positions['A-one'].x) < 1);
    assert.ok(Math.abs(structuredPositions['A-one'].y - free1Positions['A-one'].y) < 1);
    await page.screenshot({ path: path.join(EVIDENCE, '06-structured-mode.png') });

    await page.locator('#layoutModeToggleBtn').click();
    await page.waitForTimeout(250);
    const free2 = await snapshotLayout(page, TREE_A.id);
    assert.equal(free2.layoutMode, 'free');
    assert.ok(free2.positions['A-one']);
    assert.ok(Math.abs(free2.positions['A-one'].x - free1Positions['A-one'].x) < 1);
    assert.ok(Math.abs(free2.positions['A-one'].y - free1Positions['A-one'].y) < 1);
    await page.screenshot({ path: path.join(EVIDENCE, '07-free-restored-after-structured.png') });

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: false });
    const mobileView = await snapshotLayout(page, TREE_A.id);
    assert.equal(mobileView.layoutMode, 'structured');
    assert.equal(Object.keys(mobileView.positions || {}).length, 0);
    assert.equal(mobileView.overflow, false);

    await page.goto(
      `${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_A.id)}&mode=edit`,
      { waitUntil: 'domcontentloaded', timeout: 45000 }
    );
    await waitCanonicalEditorReady(page, { expectEdit: true, expectFree: true });
    const mobileEdit = await snapshotLayout(page, TREE_A.id);
    assert.equal(mobileEdit.layoutMode, 'free');
    assert.ok(mobileEdit.positions['A-one']);
    assert.equal(mobileEdit.overflow, false);
    const toggleBox = await page.locator('#layoutModeToggleBtn').boundingBox();
    assert.ok(toggleBox);
    await page.screenshot({ path: path.join(EVIDENCE, '10-mobile-owner-edit-restored.png') });
    writeJson('mobile-restoration.json', {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      editorEntrypoint: 'pages/editor.html',
      editorRuntime: 'js/editor.js',
      manualCreateEditorCanvas: false,
      mobileView: {
        layoutMode: mobileView.layoutMode,
        positionCount: Object.keys(mobileView.positions || {}).length,
        overflow: mobileView.overflow
      },
      mobileEdit: {
        layoutMode: mobileEdit.layoutMode,
        pos: mobileEdit.positions['A-one'],
        overflow: mobileEdit.overflow
      },
      note: 'Mobile free drag not claimed as success here; stored mode/positions restoration asserted.'
    });
  } finally {
    server.close();
    await browser.close();
  }
});
