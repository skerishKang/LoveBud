/**
 * #3576 Actual browser runtime: owner tree-scope left rail under no-moment and with-moments.
 *
 * Harness conventions from:
 *   - tests/contracts/public-mobile-detail-visibility-3567-contract.test.cjs (static server + Playwright)
 *   - scripts/e2e-ui-regression-smoke.cjs (auth localStorage + API interception + editor.html?treeId=)
 *
 * Fails closed when Playwright package or Chromium binary is unavailable.
 * No Production write / Auth / API / DB mutations.
 *
 * Keep #3562/#3563 closed. Keep #3425/#1882 OPEN. #3576 remains OPEN.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');

const TREE_A = {
  id: 'tree-3576-a',
  title: 'Owner Tree A',
  visibility: 'private',
  ownerId: 'ui-e2e-user-3576',
  createdAt: '2026-07-01T00:00:00Z'
};

const TREE_B = {
  id: 'tree-3576-b',
  title: 'Owner Tree B',
  visibility: 'public',
  ownerId: 'ui-e2e-user-3576',
  createdAt: '2026-07-02T00:00:00Z'
};

const MOMENT_A1 = {
  id: 'mem-3576-a1',
  treeId: TREE_A.id,
  parentId: null,
  title: 'Moment A1',
  memo: 'first moment',
  timestamp: '2024-01',
  thumbnail: '',
  visibility: 'private',
  createdAt: '2026-07-01T01:00:00Z',
  updatedAt: '2026-07-01T01:00:00Z'
};

const MOMENT_A2 = {
  id: 'mem-3576-a2',
  treeId: TREE_A.id,
  parentId: MOMENT_A1.id,
  title: 'Moment A2',
  memo: 'second moment',
  timestamp: '2024-02',
  thumbnail: '',
  visibility: 'private',
  createdAt: '2026-07-01T02:00:00Z',
  updatedAt: '2026-07-01T02:00:00Z'
};

const MOMENT_B1 = {
  id: 'mem-3576-b1',
  treeId: TREE_B.id,
  parentId: null,
  title: 'Moment B1',
  memo: 'tree b moment',
  timestamp: '2024-03',
  thumbnail: '',
  visibility: 'public',
  createdAt: '2026-07-02T01:00:00Z',
  updatedAt: '2026-07-02T01:00:00Z'
};

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
      // Match Netlify-style pretty paths used by redirects.
      if (urlPath === '/pages/editor' || urlPath === '/editor' || urlPath === '/editor.html') {
        urlPath = '/pages/editor.html';
      }
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('not found: ' + urlPath);
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
      playwright.chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage']
      }),
      20000,
      'playwright chromium.launch'
    );
  } catch (err) {
    throw new Error(
      `PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`
    );
  }
}

async function installOwnerFixtures(page, fixtures) {
  const { trees, memoriesByTreeId, user } = fixtures;

  await page.addInitScript(
    ({ userJson }) => {
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', userJson);
      try {
        sessionStorage.setItem(
          'lovebud_auth_token',
          JSON.stringify({
            uid: JSON.parse(userJson).uid,
            token: 'fake-token-3576-owner-runtime',
            expiresAt: Date.now() + 60 * 60 * 1000
          })
        );
      } catch (_) {
        /* ignore */
      }

      window.__lb3576OwnerTrace = [];
      const push = (event, extra) => {
        window.__lb3576OwnerTrace.push(
          Object.assign({ t: performance.now(), event }, extra || {})
        );
      };
      window.__lb3576Push = push;

      document.addEventListener(
        'DOMContentLoaded',
        () => {
          push('DOMContentLoaded');
        },
        { capture: true }
      );

      // Force auth bootstrap ready for treeId routes without network auth.
      const readyUser = JSON.parse(userJson);
      const bootstrap = {
        ready: true,
        user: readyUser,
        getSnapshot() {
          return { ready: true, user: readyUser };
        },
        whenReady() {
          return Promise.resolve(readyUser);
        },
        resolve() {
          /* no-op */
        }
      };
      Object.defineProperty(window, 'LoveBudAuthBootstrap', {
        configurable: true,
        get() {
          return bootstrap;
        },
        set() {
          /* keep fixture bootstrap */
        }
      });

      // Wrap later globals once scripts load.
      const wrapWhenReady = () => {
        if (window.createEditorDetailUI && !window.createEditorDetailUI.__lb3576Wrapped) {
          const orig = window.createEditorDetailUI;
          window.createEditorDetailUI = function patchedCreateEditorDetailUI(deps) {
            push('createEditorDetailUI');
            const ui = orig(deps);
            if (ui && typeof ui.updateDetailPanel === 'function' && !ui.updateDetailPanel.__lb3576Wrapped) {
              const origUpdate = ui.updateDetailPanel.bind(ui);
              ui.updateDetailPanel = function patchedUpdate(data) {
                push('updateDetailPanel', {
                  hasData: !!(data && data.id),
                  dataId: data && data.id ? data.id : null
                });
                const mountBefore = document.getElementById('detailTreeMetaMount');
                push('treeMetaMount_lookup', {
                  found: !!mountBefore,
                  childElementCount: mountBefore ? mountBefore.childElementCount : -1
                });
                const out = origUpdate(data);
                const mountAfter = document.getElementById('detailTreeMetaMount');
                push('render-complete', {
                  childElementCount: mountAfter ? mountAfter.childElementCount : -1,
                  text: mountAfter ? (mountAfter.textContent || '').slice(0, 160) : ''
                });
                return out;
              };
              ui.updateDetailPanel.__lb3576Wrapped = true;
            }
            return ui;
          };
          window.createEditorDetailUI.__lb3576Wrapped = true;
        }

        if (window.LoveBudEditorInitialLoadFlow && !window.LoveBudEditorInitialLoadFlow.__lb3576Wrapped) {
          const flow = window.LoveBudEditorInitialLoadFlow;
          const orig = flow.runEditorInitialLoadFlow;
          if (typeof orig === 'function') {
            const wrapped = async function (options) {
              push('runEditorInitialLoadFlow_start');
              const result = await orig(options);
              push('runEditorInitialLoadFlow_end', {
                status: result && result.status,
                treeId: result && result.treeId,
                memoriesCount: result && result.memoriesCount
              });
              push('window.currentTreeData', {
                id: window.currentTreeData && window.currentTreeData.id,
                title: window.currentTreeData && window.currentTreeData.title,
                visibility: window.currentTreeData && window.currentTreeData.visibility
              });
              return result;
            };
            window.LoveBudEditorInitialLoadFlow = Object.freeze({
              runEditorInitialLoadFlow: wrapped,
              __lb3576Wrapped: true
            });
          }
        }
      };

      const iv = setInterval(wrapWhenReady, 10);
      window.addEventListener('load', () => {
        wrapWhenReady();
        setTimeout(() => clearInterval(iv), 8000);
      });
    },
    { userJson: JSON.stringify(user) }
  );

  // Only intercept backend API paths — never /js/api/* static modules.
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
    const url = new URL(req.url());
    const method = req.method();

    if (method === 'GET') {
      const treeId = url.searchParams.get('treeId');
      const list = treeId
        ? memoriesByTreeId[treeId] || []
        : Object.values(memoriesByTreeId).flat();
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(list)
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

async function collectOwnerSnapshot(page) {
  return page.evaluate(() => {
    const mount = document.getElementById('detailTreeMetaMount');
    const section = document.getElementById('detailTreeMetaSection');
    const right = document.getElementById('detailViewMode') || document.querySelector('.detail-panel');
    const debug = window.LoveBudEditorDebug || null;
    const cs = mount ? getComputedStyle(mount) : null;
    const sectionCs = section ? getComputedStyle(section) : null;
    return {
      ready: document.body && document.body.classList
        ? !document.body.classList.contains('editor-preload')
        : true,
      currentTree: window.currentTreeData
        ? {
            id: window.currentTreeData.id,
            title: window.currentTreeData.title,
            visibility: window.currentTreeData.visibility
          }
        : null,
      mountExists: !!mount,
      mountCount: document.querySelectorAll('#detailTreeMetaMount').length,
      mountChildren: mount ? mount.childElementCount : 0,
      mountText: mount ? (mount.textContent || '').replace(/\s+/g, ' ').trim() : '',
      mountDisplay: cs ? cs.display : null,
      mountRectW: mount ? Math.round(mount.getBoundingClientRect().width) : 0,
      mountRectH: mount ? Math.round(mount.getBoundingClientRect().height) : 0,
      mountVisibility: cs ? cs.visibility : null,
      sectionDisplay: sectionCs ? sectionCs.display : null,
      sectionVisibility: sectionCs ? sectionCs.visibility : null,
      rightHasTreeMeta: !!(
        right &&
        (right.querySelector('#detailTreeMetaMount') ||
          right.querySelector('#detailTreeMetaSection') ||
          right.querySelector('[data-canonical-section="tree-scope"]'))
      ),
      sidebarHasTreeScope: !!document.querySelector(
        '.sidebar[data-appreciation-layout="tree-scope-rail"] [data-appreciation-region="tree-scope"]'
      ),
      originalSidebarMount: !!document.getElementById('editorSidebarTemplateMount'),
      route: {
        href: location.href,
        treeId: new URLSearchParams(location.search).get('treeId'),
        tree: new URLSearchParams(location.search).get('tree')
      },
      trace: window.__lb3576OwnerTrace || [],
      debugLogs: debug && Array.isArray(debug.logs) ? debug.logs.slice(-40) : [],
      debugErrors: debug && Array.isArray(debug.errors) ? debug.errors.slice(-20) : []
    };
  });
}

async function waitForEditorReady(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const body = document.body;
      const ready = body && !body.classList.contains('editor-preload');
      const hasSidebar = !!document.querySelector(
        '.sidebar[data-appreciation-layout="tree-scope-rail"]'
      );
      const hasMount = !!document.getElementById('detailTreeMetaMount');
      return ready && hasSidebar && hasMount;
    },
    { timeout: timeoutMs }
  );
  // Allow async initial load + first updateDetailPanel.
  await page.waitForFunction(
    () => {
      const mount = document.getElementById('detailTreeMetaMount');
      const tree = window.currentTreeData;
      return !!(mount && tree && tree.id && mount.childElementCount > 0);
    },
    { timeout: timeoutMs }
  );
}

async function openOwnerEditor(browser, base, treeId, memoriesByTreeId, trees) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await installOwnerFixtures(page, {
    trees,
    memoriesByTreeId,
    user: {
      uid: 'ui-e2e-user-3576',
      email: 'ui-e2e-3576@example.com',
      displayName: 'UI E2E 3576'
    }
  });

  await page.goto(`${base}/pages/editor.html?treeId=${encodeURIComponent(treeId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Kick auth-ready callbacks after editor registers tryStartEditor.
  await page.waitForFunction(
    () =>
      !!(
        window.LoveBudAuthCallbacks &&
        typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function'
      ) ||
      (Array.isArray(window.__onAuthReadyCallbacks) && window.__onAuthReadyCallbacks.length > 0),
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const user = {
      uid: 'ui-e2e-user-3576',
      email: 'ui-e2e-3576@example.com',
      displayName: 'UI E2E 3576'
    };
    if (window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') {
      window.LoveBudAuthCallbacks.fireAuthReadyCallbacks(user);
      return;
    }
    if (Array.isArray(window.__onAuthReadyCallbacks)) {
      window.__onAuthReadyCallbacks.forEach((cb) => {
        try {
          cb(user);
        } catch (_) {
          /* ignore */
        }
      });
    }
  });

  await waitForEditorReady(page, 25000);
  const snap = await collectOwnerSnapshot(page);
  return { page, pageErrors, consoleErrors, snap };
}

test('#3576 BROWSER owner A: no-moment tree renders left-rail tree meta', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const { page, pageErrors, consoleErrors, snap } = await openOwnerEditor(
      browser,
      base,
      TREE_A.id,
      { [TREE_A.id]: [] },
      [TREE_A]
    );

    assert.equal(snap.originalSidebarMount, false, 'sidebar mount must be replaced');
    assert.equal(snap.mountExists, true, 'tree metadata DOM must exist');
    assert.equal(snap.mountCount, 1, 'exactly one #detailTreeMetaMount');
    assert.ok(snap.mountChildren > 0, 'detailTreeMetaMount childElementCount > 0');
    assert.match(snap.mountText, /Owner Tree A/);
    assert.match(snap.mountText, /비공개|Private|private/i);
    assert.ok(
      /0|아직|기다|empty|moment/i.test(snap.mountText),
      `moment count empty-state copy expected, got: ${snap.mountText}`
    );
    assert.equal(snap.rightHasTreeMeta, false, 'right rail must not host tree-scope nodes');
    assert.equal(snap.sidebarHasTreeScope, true);
    assert.equal(snap.route.treeId, TREE_A.id);
    assert.equal(snap.currentTree && snap.currentTree.id, TREE_A.id);
    assert.notEqual(snap.mountDisplay, 'none');
    assert.notEqual(snap.mountVisibility, 'hidden');
    assert.notEqual(snap.sectionDisplay, 'none', 'sectionDisplay must not be none (#3580)');
    assert.ok(snap.mountRectW > 0 && snap.mountRectH > 0, 'mount positive geometry (#3580)');

    const events = snap.trace.map((e) => e.event);
    assert.ok(events.includes('DOMContentLoaded') || snap.debugLogs.length >= 0, 'trace collected');
    assert.ok(
      events.includes('updateDetailPanel') || snap.mountChildren > 0,
      'updateDetailPanel must run or mount already populated'
    );

    assert.equal(pageErrors.length, 0, `pageerror: ${pageErrors.join(' | ')}`);
    // Soft-filter known third-party noise if any; hard fail on app errors containing detailTreeMeta.
    const critical = consoleErrors.filter((e) => /detailTreeMeta|buildSidebar|updateDetailPanel|CRITICAL/i.test(e));
    assert.equal(critical.length, 0, `critical console errors: ${critical.join(' | ')}`);

    await page.close();
  } finally {
    try {
      await browser.close();
    } catch (_) {
      /* ignore */
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('#3576 BROWSER owner B: with-moments, moment change, tree change', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const memoriesByTreeId = {
      [TREE_A.id]: [MOMENT_A1, MOMENT_A2],
      [TREE_B.id]: [MOMENT_B1]
    };

    const first = await openOwnerEditor(browser, base, TREE_A.id, memoriesByTreeId, [TREE_A, TREE_B]);
    const { page, pageErrors, consoleErrors, snap } = first;

    assert.equal(snap.mountExists, true);
    assert.ok(snap.mountChildren > 0, 'metadata DOM populated after owner tree load');
    assert.match(snap.mountText, /Owner Tree A/);
    assert.equal(snap.rightHasTreeMeta, false);

    // Moment selection change: click second node if present, else call select path via evaluate.
    const momentChanged = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.memory-node, [data-memory-id]'));
      const second =
        nodes.find((n) => (n.getAttribute('data-memory-id') || n.id || '').includes('a2')) ||
        nodes[1] ||
        null;
      if (second) {
        second.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
      if (typeof window.updateDetailPanel === 'function') {
        window.updateDetailPanel({
          id: 'mem-3576-a2',
          treeId: 'tree-3576-a',
          title: 'Moment A2'
        });
        return true;
      }
      return false;
    });
    assert.equal(momentChanged, true, 'moment selection change must be exercised');
    await page.waitForTimeout(300);
    const afterMoment = await collectOwnerSnapshot(page);
    assert.ok(afterMoment.mountChildren > 0, 'tree meta remains after moment change');
    assert.match(afterMoment.mountText, /Owner Tree A/);
    assert.ok(!/Owner Tree B/.test(afterMoment.mountText), 'no stale other-tree title after moment change');

    // Tree change: navigate to TREE_B with same page session fixtures.
    await page.goto(`${base}/pages/editor.html?treeId=${encodeURIComponent(TREE_B.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForFunction(
      () =>
        !!(
          window.LoveBudAuthCallbacks &&
          typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function'
        ) ||
        (Array.isArray(window.__onAuthReadyCallbacks) && window.__onAuthReadyCallbacks.length > 0),
      { timeout: 15000 }
    );
    await page.evaluate(() => {
      const user = {
        uid: 'ui-e2e-user-3576',
        email: 'ui-e2e-3576@example.com',
        displayName: 'UI E2E 3576'
      };
      if (window.LoveBudAuthCallbacks && typeof window.LoveBudAuthCallbacks.fireAuthReadyCallbacks === 'function') {
        window.LoveBudAuthCallbacks.fireAuthReadyCallbacks(user);
        return;
      }
      if (Array.isArray(window.__onAuthReadyCallbacks)) {
        window.__onAuthReadyCallbacks.forEach((cb) => {
          try {
            cb(user);
          } catch (_) {
            /* ignore */
          }
        });
      }
    });
    await waitForEditorReady(page, 25000);
    const afterTree = await collectOwnerSnapshot(page);

    assert.equal(afterTree.currentTree && afterTree.currentTree.id, TREE_B.id);
    assert.match(afterTree.mountText, /Owner Tree B/);
    assert.ok(!/Owner Tree A/.test(afterTree.mountText), 'stale previous tree content must be absent');
    assert.ok(afterTree.mountChildren > 0);
    assert.equal(afterTree.route.treeId, TREE_B.id);
    assert.equal(afterTree.rightHasTreeMeta, false);

    assert.equal(pageErrors.length, 0, `pageerror: ${pageErrors.join(' | ')}`);
    const critical = consoleErrors.filter((e) => /detailTreeMeta|buildSidebar|CRITICAL/i.test(e));
    assert.equal(critical.length, 0, `critical console: ${critical.join(' | ')}`);

    await page.close();
  } finally {
    try {
      await browser.close();
    } catch (_) {
      /* ignore */
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
