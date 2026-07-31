/**
 * #3688 — Public Viewer staged-loading runtime evidence
 *
 * Executable Playwright Chromium contract against the production Public
 * Viewer route (pages/tree.html plus its real CSS/JS asset chain) served by a
 * local HTTP server on 127.0.0.1 with an ephemeral port.  No Production URL,
 * no Cloudflare, no real API/DB/Auth, no real user data, no fixed port, no
 * waitForTimeout/sleep/blind polling/retry-wrapper/timeout-inflation.
 *
 * Data arrives through the real product data path
 * (js/postgres-client.js sets window.apiClient ->
 *  js/viewer/viewer-data-loader.js ->
 *  js/api/base-api-fetch.js -> fetch('/api/community/memories?...'))
 * and is controlled per-request with a deferred route resolver.  Only the
 * synthetic public-tree fixture (viewer-fixture-tree / viewer-fixture-memory)
 * is served; all other same-origin requests continue to the local server and
 * external font requests are fulfilled deterministically with empty bodies.
 *
 * Scenarios (run in every context of the four-context matrix):
 *   A  initial loading (shell aria-busy, status live region, pending request)
 *   B  successful loaded state (controlled resolve)
 *   C  EMPTY terminal for a missing treeId query (no API request is issued;
 *      this is NOT an API 404 / server not-found / nonexistent-treeId test)
 *      plus the READY/FALLBACK terminal for a bounded empty API payload
 *      (deterministic fallback shell, per viewer-init-flow.js #3060)
 *   D  error state (controlled 500; role=alert; retry present and focusable)
 *   E  retry recovery (real button event path: mouse click + keyboard)
 *   F  reduced motion (normal contexts record; reduce contexts assert none)
 *   G  accessibility (single visible owner, hidden-attribute authority, no
 *      duplicate status announcement, aria-busy removed at terminal)
 *   H  responsive safety (no horizontal overflow, containment, non-zero
 *      geometry)
 *   I  browser health (zero pageerror, unexpected console error, unexpected
 *      request failure, unexpected HTTP failure, external network, leaks)
 *
 * Refs #3688 — Keep OPEN.
 * Refs #3729 — Completed implementation slice.
 * Refs #3672 — Keep OPEN.
 * Refs #3670 — Keep OPEN.
 * Refs #1882 — Keep OPEN.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

// ---------------------------------------------------------------------------
// Synthetic deterministic public-tree fixture.  No real identifiers.
// ---------------------------------------------------------------------------
const FIXTURE_TREE_ID = 'viewer-fixture-tree';
const FIXTURE_TREE_TITLE = 'Runtime evidence tree';
const FIXTURE_MEMORY_ID = 'viewer-fixture-memory';
const FIXTURE_MEMORY_TITLE = 'Runtime evidence moment';

const FIXTURE_PAYLOAD = [
  {
    id: FIXTURE_MEMORY_ID,
    visibility: 'public',
    title: FIXTURE_MEMORY_TITLE,
    emotionMemo: FIXTURE_MEMORY_TITLE,
    emotionTags: ['추억'],
    treeTitle: FIXTURE_TREE_TITLE,
    artist: 'viewer-fixture',
  },
];

const CONTEXTS = [
  { name: 'desktop normal motion', width: 1440, height: 900, reducedMotion: 'no-preference', isMobile: false },
  { name: 'mobile normal motion', width: 390, height: 844, reducedMotion: 'no-preference', isMobile: true },
  { name: 'desktop reduced motion', width: 1440, height: 900, reducedMotion: 'reduce', isMobile: false },
  { name: 'mobile reduced motion', width: 390, height: 844, reducedMotion: 'reduce', isMobile: true },
];

const API_PATHNAME = '/api/community/memories';
const VIEWER_HTML_PATH = '/pages/tree.html';
const VIEWER_QUERY = `?treeId=${FIXTURE_TREE_ID}`;

const CONTENT_TYPE = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ---------------------------------------------------------------------------
// Local HTTP server over the production tree.
// ---------------------------------------------------------------------------
function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPE[ext] || 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        const abs = path.normalize(path.join(ROOT, urlPath.replace(/^\//, '')));
        if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentTypeFor(abs) });
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

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Deferred API request gate.  Every request callback settles exactly once.
// ---------------------------------------------------------------------------
function createApiGate() {
  const gate = {
    mode: 'pending', // 'pending' | 'success' | 'error' | 'empty'
    requestCount: 0,
    pendingCount: 0,
    maxPending: 0,
    held: [],
    arrivalWaiters: [],
  };

  gate.nextArrival = function nextArrival() {
    return new Promise((resolve) => {
      gate.arrivalWaiters.push(resolve);
    });
  };

  function notifyArrival() {
    const waiter = gate.arrivalWaiters.shift();
    if (waiter) waiter();
  }

  gate.handleApi = async function handleApi(route) {
    gate.requestCount++;
    gate.pendingCount++;
    gate.maxPending = Math.max(gate.maxPending, gate.pendingCount);
    notifyArrival();
    let release;
    await new Promise((resolve) => {
      release = resolve;
      gate.held.push(release);
    });
    const mode = gate.mode;
    try {
      if (mode === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json; charset=utf-8',
          body: '{"error":"synthetic-failure"}',
        });
      } else if (mode === 'empty') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: '[]',
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(FIXTURE_PAYLOAD),
        });
      }
    } catch (e) {
      // Page or route already torn down; callback is still settled.
    }
    gate.pendingCount--;
  };

  gate.releaseNext = function releaseNext(mode) {
    if (mode != null) gate.mode = mode;
    const release = gate.held.shift();
    if (release) release();
  };

  gate.releaseAll = function releaseAll() {
    gate.mode = 'success';
    const held = gate.held.splice(0);
    held.forEach((release) => release());
  };

  return gate;
}

// ---------------------------------------------------------------------------
// Route installation.  Every callback path completes with exactly one of
// continue / fulfill / abort.
// ---------------------------------------------------------------------------
async function installRoutes(page, gate, port, health) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch (e) {
      await route.abort('failed');
      return;
    }
    const sameOrigin =
      parsed.hostname === '127.0.0.1' && String(parsed.port || '80') === String(port);

    if (!sameOrigin) {
      const hostname = parsed.hostname;
      if (hostname === 'fonts.googleapis.com' || hostname === 'fonts.gstatic.com') {
        await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
        return;
      }
      health.externalUnexpected++;
      await route.abort('blockedbyclient');
      return;
    }

    if (parsed.pathname === API_PATHNAME) {
      await gate.handleApi(route);
      return;
    }

    await route.continue();
  });
}

// ---------------------------------------------------------------------------
// Health collection (bounded operation labels only; never raw URLs/payloads).
// ---------------------------------------------------------------------------
function collectHealth(page, port, gate) {
  const health = {
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    requestFailedSameOrigin: 0,
    httpFailures: [],
    externalUnexpected: 0,
  };

  page.on('pageerror', (err) => {
    health.pageErrors.push(String(err && err.message ? err.message : 'pageerror').slice(0, 80));
  });

  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (msg.type() === 'error') {
      if (text.indexOf('[tree-viewer] load failed') === 0) {
        health.consoleErrors.push('product-error-log');
      } else if (text.indexOf('Failed to load resource') === 0) {
        // Chromium emits this for any HTTP error response; the only such
        // response in this contract is the controlled synthetic failure.
        health.consoleErrors.push('resource-fail-label');
      } else {
        health.consoleErrors.push(text.slice(0, 60));
      }
    } else if (msg.type() === 'warning') {
      health.consoleWarnings.push(text.slice(0, 60));
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    let sameOrigin = false;
    try {
      const parsed = new URL(url);
      sameOrigin = parsed.hostname === '127.0.0.1' && String(parsed.port || '80') === String(port);
    } catch (e) {
      sameOrigin = false;
    }
    if (sameOrigin) health.requestFailedSameOrigin++;
  });

  page.on('response', (response) => {
    const url = response.url();
    let apiRequest = false;
    let sameOrigin = false;
    try {
      const parsed = new URL(url);
      sameOrigin = parsed.hostname === '127.0.0.1' && String(parsed.port || '80') === String(port);
      apiRequest = parsed.pathname === API_PATHNAME;
    } catch (e) {
      sameOrigin = false;
    }
    const status = response.status();
    if (sameOrigin && status >= 400) {
      health.httpFailures.push({ status, api: apiRequest });
    }
  });

  return health;
}

// ---------------------------------------------------------------------------
// Observable-condition waits.  No waitForTimeout, no sleep, no blind polling.
// ---------------------------------------------------------------------------
function boundedWait(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), ms);
    }),
  ]).then(
    (value) => {
      clearTimeout(timer);
      return value;
    },
    (error) => {
      clearTimeout(timer);
      throw error;
    }
  );
}

async function waitForVisible(page, selector, ms) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!(el && !el.hasAttribute('hidden') && getComputedStyle(el).display !== 'none');
    },
    selector,
    { timeout: ms || 15000 }
  );
}

async function waitForHidden(page, selector, ms) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!(el && (el.hasAttribute('hidden') || getComputedStyle(el).display === 'none'));
    },
    selector,
    { timeout: ms || 15000 }
  );
}

async function waitForShellReady(page, kind, ms) {
  const timeout = ms || 15000;
  if (kind === 'loaded') {
    await page.waitForFunction(
      () => {
        const tree = document.querySelector('#viewerTreeContainer');
        const shell = document.querySelector('#viewerTreeShell');
        if (!tree || tree.hasAttribute('hidden')) return false;
        if (shell && shell.getAttribute('aria-busy') !== null) return false;
        const title = tree.querySelector('.vv-title');
        return !!(title && title.textContent && title.textContent.length > 0);
      },
      { timeout }
    );
    return;
  }
  if (kind === 'error') {
    await page.waitForFunction(
      () => {
        const error = document.querySelector('#viewerErrorState');
        const shell = document.querySelector('#viewerTreeShell');
        if (!error || error.hasAttribute('hidden')) return false;
        if (shell && shell.getAttribute('aria-busy') !== null) return false;
        return !!error.querySelector('#viewerRetryBtn');
      },
      { timeout }
    );
    return;
  }
  if (kind === 'empty') {
    await page.waitForFunction(
      () => {
        const empty = document.querySelector('#viewerEmptyState');
        const shell = document.querySelector('#viewerTreeShell');
        if (!empty || empty.hasAttribute('hidden')) return false;
        if (shell && shell.getAttribute('aria-busy') !== null) return false;
        return true;
      },
      { timeout }
    );
    return;
  }
  if (kind === 'fallback') {
    await page.waitForFunction(
      () => {
        const tree = document.querySelector('#viewerTreeContainer');
        const shell = document.querySelector('#viewerTreeShell');
        if (!tree || tree.hasAttribute('hidden')) return false;
        if (shell && shell.getAttribute('aria-busy') !== null) return false;
        return !!tree.querySelector('.vv-title');
      },
      { timeout }
    );
    return;
  }
  if (kind === 'loading') {
    await page.waitForFunction(
      () => {
        const loading = document.querySelector('#viewerLoadingState');
        const shell = document.querySelector('#viewerTreeShell');
        if (!loading || loading.hasAttribute('hidden')) return false;
        if (shell && shell.getAttribute('aria-busy') !== 'true') return false;
        return true;
      },
      { timeout }
    );
    return;
  }
  throw new Error(`unknown shell readiness kind: ${kind}`);
}

// ---------------------------------------------------------------------------
// DOM snapshots (synthetic fixtures only; no raw URLs or private payloads).
// ---------------------------------------------------------------------------
async function snapshotInitialLoading(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('#viewerTreeShell');
    const loading = document.querySelector('#viewerLoadingState');
    const empty = document.querySelector('#viewerEmptyState');
    const error = document.querySelector('#viewerErrorState');
    const tree = document.querySelector('#viewerTreeContainer');
    const back = document.querySelector('#backButton');
    const badge = document.querySelector('.viewer-badge');
    return {
      shellPresent: !!shell,
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
      loadingPresent: !!loading,
      loadingVisible: !!(loading && !loading.hasAttribute('hidden') && getComputedStyle(loading).display !== 'none'),
      loadingRole: loading ? loading.getAttribute('role') : null,
      loadingLive: loading ? loading.getAttribute('aria-live') : null,
      emptyHidden: !!(empty && empty.hasAttribute('hidden')),
      errorHidden: !!(error && error.hasAttribute('hidden')),
      treeHidden: !!(tree && tree.hasAttribute('hidden')),
      navigationPresent: !!(back && badge),
    };
  });
}

async function snapshotLoaded(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('#viewerTreeShell');
    const loading = document.querySelector('#viewerLoadingState');
    const empty = document.querySelector('#viewerEmptyState');
    const error = document.querySelector('#viewerErrorState');
    const tree = document.querySelector('#viewerTreeContainer');
    const title = tree ? tree.querySelector('.vv-title') : null;
    const layout = tree ? tree.querySelector('.vv-viewer-layout') : null;
    const treeBox = tree ? tree.querySelector('.vv-tree-container') : null;
    const panelHost = tree ? tree.querySelector('.vv-panel-host') : null;
    const boxRect = treeBox ? treeBox.getBoundingClientRect() : null;
    const panelRect = panelHost ? panelHost.getBoundingClientRect() : null;
    return {
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
      loadingHidden: !!(loading && loading.hasAttribute('hidden')),
      emptyHidden: !!(empty && empty.hasAttribute('hidden')),
      errorHidden: !!(error && error.hasAttribute('hidden')),
      treeVisible: !!(tree && !tree.hasAttribute('hidden') && getComputedStyle(tree).display !== 'none'),
      titleText: title ? (title.textContent || '') : '',
      layoutPresent: !!layout,
      treeBoxPresent: !!treeBox,
      treeBoxWidth: boxRect ? boxRect.width : 0,
      treeBoxHeight: boxRect ? boxRect.height : 0,
      panelHostHeight: panelRect ? panelRect.height : 0,
    };
  });
}

async function snapshotEmpty(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('#viewerTreeShell');
    const loading = document.querySelector('#viewerLoadingState');
    const empty = document.querySelector('#viewerEmptyState');
    const error = document.querySelector('#viewerErrorState');
    const tree = document.querySelector('#viewerTreeContainer');
    return {
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
      emptyVisible: !!(empty && !empty.hasAttribute('hidden') && getComputedStyle(empty).display !== 'none'),
      emptyRole: empty ? empty.getAttribute('role') : null,
      emptyLive: empty ? empty.getAttribute('aria-live') : null,
      loadingHidden: !!(loading && loading.hasAttribute('hidden')),
      errorHidden: !!(error && error.hasAttribute('hidden')),
      treeHidden: !!(tree && tree.hasAttribute('hidden')),
    };
  });
}

async function snapshotFallback(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('#viewerTreeShell');
    const loading = document.querySelector('#viewerLoadingState');
    const empty = document.querySelector('#viewerEmptyState');
    const error = document.querySelector('#viewerErrorState');
    const tree = document.querySelector('#viewerTreeContainer');
    return {
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
      treeVisible: !!(tree && !tree.hasAttribute('hidden') && getComputedStyle(tree).display !== 'none'),
      fallbackMarked: !!(tree && tree.querySelector('.vv-tree-container[data-fallback="neon-snapshot"]')),
      loadingHidden: !!(loading && loading.hasAttribute('hidden')),
      emptyHidden: !!(empty && empty.hasAttribute('hidden')),
      errorHidden: !!(error && error.hasAttribute('hidden')),
      titleText: tree && tree.querySelector('.vv-title') ? (tree.querySelector('.vv-title').textContent || '') : '',
    };
  });
}

async function snapshotError(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('#viewerTreeShell');
    const loading = document.querySelector('#viewerLoadingState');
    const empty = document.querySelector('#viewerEmptyState');
    const error = document.querySelector('#viewerErrorState');
    const tree = document.querySelector('#viewerTreeContainer');
    const retry = document.querySelector('#viewerRetryBtn');
    return {
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
      errorVisible: !!(error && !error.hasAttribute('hidden') && getComputedStyle(error).display !== 'none'),
      errorRole: error ? error.getAttribute('role') : null,
      loadingHidden: !!(loading && loading.hasAttribute('hidden')),
      emptyHidden: !!(empty && empty.hasAttribute('hidden')),
      treeHidden: !!(tree && tree.hasAttribute('hidden')),
      retryPresent: !!retry,
      retryName: retry && retry.getAttribute('aria-label') ? retry.getAttribute('aria-label') : (retry ? (retry.textContent || '').trim() : ''),
    };
  });
}

async function snapshotTerminalOwners(page) {
  return page.evaluate(() => {
    const ids = ['#viewerLoadingState', '#viewerEmptyState', '#viewerErrorState', '#viewerTreeContainer'];
    const visible = [];
    for (const sel of ids) {
      const el = document.querySelector(sel);
      if (el && !el.hasAttribute('hidden') && getComputedStyle(el).display !== 'none') {
        visible.push(sel.replace('#', ''));
      }
    }
    return {
      visibleOwners: visible,
      statusRegions: (() => {
        const status = [];
        for (const sel of ['#viewerLoadingState', '#viewerEmptyState']) {
          const el = document.querySelector(sel);
          if (el && !el.hasAttribute('hidden') && getComputedStyle(el).display !== 'none') status.push(sel);
        }
        return status;
      })(),
      alertOwners: (() => {
        const alerts = [];
        const el = document.querySelector('#viewerErrorState');
        if (el && !el.hasAttribute('hidden') && getComputedStyle(el).display !== 'none') alerts.push('#viewerErrorState');
        return alerts;
      })(),
      shellBusy: (() => {
        const shell = document.querySelector('#viewerTreeShell');
        return shell ? shell.getAttribute('aria-busy') : null;
      })(),
    };
  });
}

async function snapshotResponsive(page, stateSelector) {
  return page.evaluate((sel) => {
    const de = document.documentElement;
    const primary = document.querySelector(sel);
    const rect = primary ? primary.getBoundingClientRect() : null;
    const retry = document.querySelector('#viewerRetryBtn');
    const retryRect = retry ? retry.getBoundingClientRect() : null;
    const copyEl = primary ? primary.querySelector('.viewer-state-content p, p, .vv-title') : null;
    const copyRect = copyEl ? copyEl.getBoundingClientRect() : null;
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      overflowX: de.scrollWidth - de.clientWidth,
      primary: rect
        ? {
            width: rect.width,
            height: rect.height,
            inViewport: rect.left >= -1 && rect.right <= de.clientWidth + 1,
          }
        : null,
      retryInViewport: retryRect
        ? retryRect.width > 0 &&
          retryRect.height > 0 &&
          retryRect.left >= -1 &&
          retryRect.right <= de.clientWidth + 1 &&
          retryRect.top >= -1
        : null,
      copyVisible: !!(copyEl && copyRect && copyRect.width > 0 && copyRect.height > 0),
    };
  }, stateSelector);
}

async function snapshotMotion(page) {
  return page.evaluate(() => {
    const icon = document.querySelector('#viewerLoadingState .material-symbols-outlined, #viewerLoadingState .refresh-symbol');
    if (!icon) return null;
    const cs = getComputedStyle(icon);
    return {
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      iconVisible: !!(icon.getBoundingClientRect().width > 0 && icon.getBoundingClientRect().height > 0),
    };
  });
}

async function focusRetryWithKeyboard(page) {
  await page.focus('#viewerRetryBtn');
  const focused = await page.evaluate(() => document.activeElement === document.querySelector('#viewerRetryBtn'));
  assert.ok(focused, 'retry button must receive keyboard focus');
  await page.keyboard.press('Enter');
}

// ---------------------------------------------------------------------------
// Scenario helpers
// ---------------------------------------------------------------------------
async function openViewer(env, withTreeId) {
  const url = withTreeId === false
    ? `${env.baseUrl}${VIEWER_HTML_PATH}`
    : `${env.baseUrl}${VIEWER_HTML_PATH}${VIEWER_QUERY}`;
  await env.page.goto(url, { waitUntil: 'domcontentloaded' });
}

async function assertNoPageWideIssues(env, expectedProductErrorLogs, expectedResourceFailures) {
  const expected = expectedProductErrorLogs || 0;
  const expectedResource = expectedResourceFailures || 0;
  assert.equal(env.health.pageErrors.length, 0, `page errors: ${env.health.pageErrors.join(', ')}`);
  assert.equal(env.health.requestFailedSameOrigin, 0, 'same-origin request failures must be zero');
  const unexpectedConsole = env.health.consoleErrors.filter(
    (label) => label !== 'product-error-log' && label !== 'resource-fail-label'
  );
  assert.equal(unexpectedConsole.length, 0, `unexpected console errors: ${unexpectedConsole.join(', ')}`);
  const productLogs = env.health.consoleErrors.filter((label) => label === 'product-error-log');
  assert.equal(productLogs.length, expected, `expected ${expected} product error log(s), got ${productLogs.length}`);
  const resourceFails = env.health.consoleErrors.filter((label) => label === 'resource-fail-label');
  assert.equal(resourceFails.length, expectedResource, `expected ${expectedResource} resource-failure log(s), got ${resourceFails.length}`);
  assert.equal(env.health.externalUnexpected, 0, 'unexpected external network attempts must be zero');
  const unexpectedHttp = env.health.httpFailures.filter((f) => !f.api);
  assert.equal(unexpectedHttp.length, 0, `unexpected same-origin HTTP failures: ${JSON.stringify(unexpectedHttp)}`);
}

async function scenarioLoadingToLoaded(t, env) {
  const { page, gate } = env;

  // --- A. Initial loading while the request is pending ---
  const arrival = gate.nextArrival();
  await openViewer(env, true);
  await boundedWait(arrival, 20000, 'initial viewer data request');
  assert.ok(gate.held.length >= 1, 'initial request must be held pending');

  await waitForShellReady(page, 'loading', 15000);
  const initial = await snapshotInitialLoading(page);
  assert.equal(initial.shellPresent, true, 'viewer shell must exist');
  assert.equal(initial.shellBusy, 'true', 'shell must be aria-busy while loading');
  assert.equal(initial.loadingPresent, true, 'loading state element must exist');
  assert.equal(initial.loadingVisible, true, 'loading state must be visible while pending');
  assert.equal(initial.loadingRole, 'status', 'loading state must have role=status');
  assert.equal(initial.loadingLive, 'polite', 'loading state must be aria-live=polite');
  assert.equal(initial.emptyHidden, true, 'empty state must stay hidden while loading');
  assert.equal(initial.errorHidden, true, 'error state must stay hidden while loading');
  assert.equal(initial.treeHidden, true, 'loaded content must not be presented while pending');
  assert.equal(initial.navigationPresent, true, 'stable shell/navigation must remain rendered while loading');

  const motionDuringLoading = await snapshotMotion(page);
  assert.ok(motionDuringLoading && motionDuringLoading.iconVisible, 'loading icon must be visible while pending');

  const resp = await snapshotResponsive(page, '#viewerLoadingState');
  assert.ok(resp.overflowX <= 0, `no horizontal overflow while loading (overflowX=${resp.overflowX})`);
  assert.ok(resp.primary && resp.primary.inViewport, 'loading state container must stay within the viewport');
  assert.ok(resp.primary && resp.primary.height > 0, 'loading state geometry must be non-zero');
  assert.ok(resp.copyVisible, 'loading copy must be visible');

  // --- B. Controlled success resolves to the loaded state ---
  gate.releaseNext('success');
  await waitForShellReady(page, 'loaded', 15000);
  const loaded = await snapshotLoaded(page);
  assert.equal(loaded.shellBusy, null, 'aria-busy must be cleared after load');
  assert.equal(loaded.loadingHidden, true, 'loading must be hidden after load');
  assert.equal(loaded.emptyHidden, true, 'empty must stay hidden after load');
  assert.equal(loaded.errorHidden, true, 'error must stay hidden after load');
  assert.equal(loaded.treeVisible, true, 'loaded tree container must be visible');
  assert.ok(loaded.titleText.indexOf(FIXTURE_TREE_TITLE) !== -1, `tree title must render (${loaded.titleText})`);
  assert.equal(loaded.layoutPresent, true, 'shell layout must be rendered');
  assert.equal(loaded.treeBoxPresent, true, 'tree box must be rendered');
  assert.ok(loaded.treeBoxWidth > 0 && loaded.treeBoxHeight > 0, 'tree content must have non-zero geometry');
  assert.ok(loaded.panelHostHeight > 0, 'panel host must have non-zero geometry');

  const loadedResp = await snapshotResponsive(page, '#viewerTreeContainer');
  assert.ok(loadedResp.overflowX <= 0, `no horizontal overflow after load (overflowX=${loadedResp.overflowX})`);
  assert.ok(loadedResp.primary && loadedResp.primary.inViewport, 'loaded container must stay within the viewport');
  assert.ok(loadedResp.primary && loadedResp.primary.height > 0, 'loaded container geometry must be non-zero');

  const owners = await snapshotTerminalOwners(page);
  assert.deepEqual(owners.visibleOwners, ['viewerTreeContainer'], 'exactly one visible state owner after load');
  assert.equal(owners.shellBusy, null, 'aria-busy must be absent at the loaded terminal');

  await assertNoPageWideIssues(env, 0);
}

async function scenarioEmpty(t, env) {
  const { page, gate } = env;

  // --- C1. EMPTY terminal: missing treeId query -> product empty state ---
  // Classification: EMPTY — missing treeId. No API request is issued, so this
  // is NOT an API 404, server not-found, or nonexistent-treeId verification.
  await openViewer(env, false);
  await waitForShellReady(page, 'empty', 15000);
  const empty = await snapshotEmpty(page);
  assert.equal(empty.emptyVisible, true, 'empty state must be visible without treeId');
  assert.equal(empty.emptyRole, 'status', 'empty state must have role=status');
  assert.equal(empty.emptyLive, 'polite', 'empty state must be aria-live=polite');
  assert.equal(empty.shellBusy, null, 'aria-busy must be cleared at the empty terminal');
  assert.equal(empty.loadingHidden, true, 'loading must be hidden at the empty terminal');
  assert.equal(empty.errorHidden, true, 'error must be hidden at the empty terminal');
  assert.equal(empty.treeHidden, true, 'loaded content must stay hidden at the empty terminal');
  assert.equal(gate.requestCount, 0, 'empty state must not issue an API request');

  const emptyResp = await snapshotResponsive(page, '#viewerEmptyState');
  assert.ok(emptyResp.overflowX <= 0, `no horizontal overflow at empty (overflowX=${emptyResp.overflowX})`);
  assert.ok(emptyResp.primary && emptyResp.primary.inViewport, 'empty state container must stay within the viewport');
  assert.ok(emptyResp.primary && emptyResp.primary.height > 0, 'empty state geometry must be non-zero');
  assert.ok(emptyResp.copyVisible, 'empty copy must be visible');

  const owners = await snapshotTerminalOwners(page);
  assert.deepEqual(owners.visibleOwners, ['viewerEmptyState'], 'exactly one visible state owner at empty');
  assert.deepEqual(owners.statusRegions, ['#viewerEmptyState'], 'exactly one status live region at empty');
  assert.equal(owners.alertOwners.length, 0, 'no alert owner at empty');

  await assertNoPageWideIssues(env, 0);

  // --- C2. READY/FALLBACK terminal: bounded empty API payload -> deterministic fallback shell (per source) ---
  const fallbackArrival = gate.nextArrival();
  gate.mode = 'empty';
  await openViewer(env, true);
  await boundedWait(fallbackArrival, 20000, 'empty-payload viewer data request');
  gate.releaseNext('empty');
  await waitForShellReady(page, 'fallback', 15000);
  const fallback = await snapshotFallback(page);
  assert.equal(fallback.shellBusy, null, 'aria-busy must be cleared at the fallback terminal');
  assert.equal(fallback.treeVisible, true, 'deterministic fallback shell must be visible for a bounded empty payload');
  assert.equal(fallback.fallbackMarked, true, 'fallback tree box must carry the neon-snapshot marker');
  assert.equal(fallback.loadingHidden, true, 'loading must be hidden at the fallback terminal');
  assert.equal(fallback.emptyHidden, true, 'empty state must stay hidden at the fallback terminal');
  assert.equal(fallback.errorHidden, true, 'error must stay hidden at the fallback terminal');
  assert.ok(fallback.titleText.length > 0, 'fallback shell must render a title');

  const fallbackResp = await snapshotResponsive(page, '#viewerTreeContainer');
  assert.ok(fallbackResp.overflowX <= 0, `no horizontal overflow at fallback (overflowX=${fallbackResp.overflowX})`);
  assert.ok(fallbackResp.primary && fallbackResp.primary.inViewport, 'fallback container must stay within the viewport');

  const fallbackOwners = await snapshotTerminalOwners(page);
  assert.deepEqual(fallbackOwners.visibleOwners, ['viewerTreeContainer'], 'exactly one visible state owner at fallback');

  await assertNoPageWideIssues(env, 0);
}

async function scenarioError(t, env) {
  const { page, gate } = env;

  gate.mode = 'error';
  const arrival = gate.nextArrival();
  await openViewer(env, true);
  await boundedWait(arrival, 20000, 'error-scenario viewer data request');
  assert.ok(gate.held.length >= 1, 'error-scenario request must be held pending');

  await waitForShellReady(page, 'loading', 15000);
  const pending = await snapshotInitialLoading(page);
  assert.equal(pending.shellBusy, 'true', 'shell must be aria-busy while error request is pending');
  assert.equal(pending.loadingVisible, true, 'loading must be visible while error request is pending');

  gate.releaseNext('error');
  await waitForShellReady(page, 'error', 15000);
  const error = await snapshotError(page);
  assert.equal(error.errorVisible, true, 'error state must be visible');
  assert.equal(error.errorRole, 'alert', 'error state must have role=alert');
  assert.equal(error.shellBusy, null, 'aria-busy must be cleared at the error terminal');
  assert.equal(error.loadingHidden, true, 'loading must be hidden at the error terminal');
  assert.equal(error.emptyHidden, true, 'empty must stay hidden at the error terminal');
  assert.equal(error.treeHidden, true, 'loaded content must stay hidden at the error terminal');
  assert.equal(error.retryPresent, true, 'retry button must be present');
  assert.ok(error.retryName && error.retryName.length > 0, 'retry button accessible name must be non-empty');

  await page.focus('#viewerRetryBtn');
  const focusState = await page.evaluate(() => ({
    active: document.activeElement === document.querySelector('#viewerRetryBtn'),
    tabbable: document.querySelector('#viewerRetryBtn').tabIndex >= 0,
  }));
  assert.equal(focusState.active, true, 'retry button must be keyboard focusable');
  assert.equal(focusState.tabbable, true, 'retry button must be in the tab order');

  const errorResp = await snapshotResponsive(page, '#viewerErrorState');
  assert.ok(errorResp.overflowX <= 0, `no horizontal overflow at error (overflowX=${errorResp.overflowX})`);
  assert.ok(errorResp.primary && errorResp.primary.inViewport, 'error state container must stay within the viewport');
  assert.ok(errorResp.primary && errorResp.primary.height > 0, 'error state geometry must be non-zero');
  assert.equal(errorResp.retryInViewport, true, 'retry control must not be clipped');
  assert.ok(errorResp.copyVisible, 'error copy must be visible');

  const owners = await snapshotTerminalOwners(page);
  assert.deepEqual(owners.visibleOwners, ['viewerErrorState'], 'exactly one visible state owner at error');
  assert.deepEqual(owners.alertOwners, ['#viewerErrorState'], 'exactly one alert owner at error');
  assert.deepEqual(owners.statusRegions, [], 'no status live region at error');
  assert.equal(owners.shellBusy, null, 'aria-busy must be absent at the error terminal');

  assert.equal(gate.requestCount, 1, 'initial error-scenario request count must be exactly 1');
  await assertNoPageWideIssues(env, 1, 1);
}

async function scenarioRetry(t, env, activate) {
  const { page, gate } = env;

  gate.mode = 'error';
  let arrival = gate.nextArrival();
  await openViewer(env, true);
  await boundedWait(arrival, 20000, 'retry-scenario initial viewer data request');
  gate.releaseNext('error');
  await waitForShellReady(page, 'error', 15000);
  assert.equal(gate.requestCount, 1, 'initial request count must be exactly 1');

  // Retry via the real button event path (mouse click or keyboard activation).
  const retryArrival = gate.nextArrival();
  gate.mode = 'success';
  if (activate === 'keyboard') {
    await focusRetryWithKeyboard(page);
  } else {
    await page.click('#viewerRetryBtn');
  }
  await boundedWait(retryArrival, 20000, 'retry viewer data request');
  assert.equal(gate.held.length, 1, 'retry request must be held pending');

  // Loading must reappear during retry; error must clear.
  await waitForShellReady(page, 'loading', 15000);
  const duringRetry = await page.evaluate(() => {
    const loading = document.querySelector('#viewerLoadingState');
    const error = document.querySelector('#viewerErrorState');
    const shell = document.querySelector('#viewerTreeShell');
    return {
      loadingVisible: !!(loading && !loading.hasAttribute('hidden') && getComputedStyle(loading).display !== 'none'),
      errorHidden: !!(error && error.hasAttribute('hidden')),
      shellBusy: shell ? shell.getAttribute('aria-busy') : null,
    };
  });
  assert.equal(duringRetry.loadingVisible, true, 'loading must reappear during retry');
  assert.equal(duringRetry.errorHidden, true, 'error must clear when retry starts');
  assert.equal(duringRetry.shellBusy, 'true', 'shell must be busy during retry');

  gate.releaseNext('success');
  await waitForShellReady(page, 'loaded', 15000);
  const loaded = await snapshotLoaded(page);
  assert.equal(loaded.shellBusy, null, 'aria-busy must be cleared after retry success');
  assert.equal(loaded.loadingHidden, true, 'loading must be hidden after retry success');
  assert.equal(loaded.errorHidden, true, 'error must be hidden after retry success');
  assert.equal(loaded.treeVisible, true, 'successful content must be visible after resolve');
  assert.ok(loaded.titleText.indexOf(FIXTURE_TREE_TITLE) !== -1, 'tree title must render after retry success');

  assert.equal(gate.requestCount, 2, 'total request count must be exactly 2');
  assert.equal(gate.maxPending, 1, 'duplicate concurrent requests must be zero');

  const owners = await snapshotTerminalOwners(page);
  assert.deepEqual(owners.visibleOwners, ['viewerTreeContainer'], 'exactly one visible terminal state after retry');
  assert.equal(owners.shellBusy, null, 'aria-busy must be absent at the retry terminal');

  const retryResp = await snapshotResponsive(page, '#viewerTreeContainer');
  assert.ok(retryResp.overflowX <= 0, `no horizontal overflow after retry (overflowX=${retryResp.overflowX})`);
  assert.ok(retryResp.primary && retryResp.primary.inViewport, 'loaded container must stay within the viewport');

  await assertNoPageWideIssues(env, 1, 1);
}

async function scenarioReducedMotion(t, env, reduced) {
  const { page, gate } = env;

  const arrival = gate.nextArrival();
  await openViewer(env, true);
  await boundedWait(arrival, 20000, 'motion-scenario viewer data request');
  await waitForShellReady(page, 'loading', 15000);

  const motion = await snapshotMotion(page);
  assert.ok(motion && motion.iconVisible, 'loading icon must be visible in the motion context');
  if (reduced) {
    assert.equal(motion.animationName, 'none', `reduced motion must disable loading icon animation (got ${motion.animationName})`);
    assert.equal(motion.animationDuration, '0s', `reduced motion must zero the animation duration (got ${motion.animationDuration})`);
  } else {
    // The current product provides no loading-icon animation in normal motion;
    // record the observed state without inventing a new requirement.
    t.diagnostic(`normal-motion loading icon animation: ${motion.animationName} / ${motion.animationDuration}`);
  }

  const loading = await snapshotInitialLoading(page);
  assert.equal(loading.loadingVisible, true, 'loading semantics must be unchanged in the motion context');
  assert.equal(loading.shellBusy, 'true', 'shell busy semantics must be unchanged in the motion context');
  assert.equal(loading.loadingRole, 'status', 'loading role must be unchanged in the motion context');
  assert.equal(loading.loadingLive, 'polite', 'loading live semantics must be unchanged in the motion context');

  const resp = await snapshotResponsive(page, '#viewerLoadingState');
  assert.ok(resp.overflowX <= 0, `no horizontal overflow in motion context (overflowX=${resp.overflowX})`);
  assert.ok(resp.primary && resp.primary.height > 0, 'loading geometry must be preserved in the motion context');
  assert.ok(resp.copyVisible, 'copy must remain visible in the motion context');

  gate.releaseNext('success');
  await waitForShellReady(page, 'loaded', 15000);
  const loaded = await snapshotLoaded(page);
  assert.equal(loaded.treeVisible, true, 'loaded content must render in the motion context');
  assert.ok(loaded.treeBoxHeight > 0, 'loaded geometry must be non-zero in the motion context');

  await assertNoPageWideIssues(env, 0);
}

// ---------------------------------------------------------------------------
// Per-context runner
// ---------------------------------------------------------------------------
async function runContext(t, ctxConfig, baseUrl) {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  try {
    const context = await browser.newContext({
      viewport: { width: ctxConfig.width, height: ctxConfig.height },
      reducedMotion: ctxConfig.reducedMotion,
      isMobile: ctxConfig.isMobile,
      hasTouch: ctxConfig.isMobile,
    });

    async function newEnv() {
      const page = await context.newPage();
      const gate = createApiGate();
      const health = collectHealth(page, baseUrl.port, gate);
      await installRoutes(page, gate, baseUrl.port, health);
      const env = { page, gate, health, baseUrl: baseUrl.url };
      return env;
    }

    async function closeEnv(env) {
      env.gate.releaseAll();
      try {
        await env.page.close();
      } catch (e) {
        // already closed
      }
    }

    await t.test('A+B initial loading and loaded state', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioLoadingToLoaded(t, env);
      } finally {
        await closeEnv(env);
      }
    });

    await t.test('C empty (missing treeId) and deterministic fallback', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioEmpty(t, env);
      } finally {
        await closeEnv(env);
      }
    });

    await t.test('D error state', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioError(t, env);
      } finally {
        await closeEnv(env);
      }
    });

    await t.test('E1 retry recovery via click', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioRetry(t, env, 'click');
      } finally {
        await closeEnv(env);
      }
    });

    await t.test('E2 retry recovery via keyboard', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioRetry(t, env, 'keyboard');
      } finally {
        await closeEnv(env);
      }
    });

    await t.test('F reduced motion', { timeout: 60000 }, async () => {
      const env = await newEnv();
      try {
        await scenarioReducedMotion(t, env, ctxConfig.reducedMotion === 'reduce');
      } finally {
        await closeEnv(env);
      }
    });

    await context.close();
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Top-level contract
// ---------------------------------------------------------------------------
test('public viewer staged-loading runtime evidence (#3688)', { timeout: 600000 }, async (t) => {
  const { server, port } = await startServer();
  t.after(async () => {
    await closeServer(server);
  });
  const baseUrl = { url: `http://127.0.0.1:${port}`, port };

  for (const ctxConfig of CONTEXTS) {
    await t.test(`context ${ctxConfig.name} (${ctxConfig.width}x${ctxConfig.height})`, { timeout: 420000 }, async (t) => {
      await runContext(t, ctxConfig, baseUrl);
    });
  }
});
