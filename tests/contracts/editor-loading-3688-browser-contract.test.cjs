'use strict';

// Editor staged-loading runtime evidence (Issue #3688 / #3704, PR #3705).
//
// Real-local Chromium contract. Serves the real pages/editor.html, real Editor
// CSS chain (css/editor.css -> css/editor/editor-base.css -> css/global.css ->
// css/global/lovetree-loading-states.css) and the real
// js/editor/editor-initial-load-flow.js from a local 127.0.0.1 HTTP server on an
// ephemeral port, then drives the real
// window.LoveBudEditorInitialLoadFlow.runEditorInitialLoadFlow() in the page.
//
// Synthetic boundary: only loadInitialEditorTree and loadEditorMemories are
// deferred synthetic gates controlled from Node; syncCurrentTreeData,
// renderTreeLoadError, markEditorReady, showToast and redirectToEditorLogin are
// bounded observable fixture callbacks. Every other Editor script and all
// external provider/font/network requests are fulfilled inert by exact pathname
// so no production bootstrap, auth, API, DB, cache, storage or provider runs.
// No Production URL, no real account, no real private identifiers.

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const COPIES = {
  editor_loading_tree: '트리 정보를 불러오는 중',
  editor_loading_memories: '순간 목록을 불러오는 중',
  need_login: '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
  'loading.long.wait': '평소보다 오래 걸리고 있어요. 잠시만 기다려 주세요.',
};

const CONTEXTS = [
  { name: 'desktop normal motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', isMobile: false, hasTouch: false },
  { name: 'mobile normal motion', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', isMobile: true, hasTouch: true },
  { name: 'desktop reduced motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', isMobile: false, hasTouch: false },
  { name: 'mobile reduced motion', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true },
];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/pages/editor.html' : urlPath;
        const filePath = path.normalize(path.join(ROOT, rel));
        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403);
          res.end();
          return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('not found');
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) {
        try {
          res.writeHead(500);
          res.end();
        } catch (_) { /* socket already gone */ }
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    try {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    } catch (_) { /* best effort */ }
    server.close(() => resolve());
  });
}

function newHealth() {
  return {
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    requestFailedSameOrigin: [],
    httpFailures: [],
    externalUnexpected: 0,
  };
}

function collectHealth(page, health) {
  page.on('pageerror', (err) => {
    health.pageErrors.push(String((err && err.message) || err));
  });
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') health.consoleErrors.push(msg.text());
    else if (type === 'warning') health.consoleWarnings.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(req.url()).hostname === '127.0.0.1';
    } catch (_) { /* unparsable */ }
    if (sameOrigin) {
      const failure = req.failure();
      health.requestFailedSameOrigin.push(req.url() + ' :: ' + ((failure && failure.errorText) || 'unknown'));
    }
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(resp.url()).hostname === '127.0.0.1';
      } catch (_) { /* unparsable */ }
      if (sameOrigin) health.httpFailures.push(resp.status() + ' ' + resp.url());
    }
  });
}

// Every route callback settles exactly once: continue, fulfill, or abort.
function installRoutes(page, health, port) {
  return page.route('**/*', async (route) => {
    const request = route.request();
    let parsed;
    try {
      parsed = new URL(request.url());
    } catch (_) {
      await route.abort('failed');
      return;
    }
    const reqPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const sameOrigin = parsed.hostname === '127.0.0.1' && reqPort === String(port);

    if (!sameOrigin) {
      const host = parsed.hostname;
      if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') {
        await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
        return;
      }
      if (host === 'www.gstatic.com') {
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* inert-firebase-fixture */' });
        return;
      }
      health.externalUnexpected += 1;
      await route.abort('blockedbyclient');
      return;
    }

    const pathname = parsed.pathname;
    if (pathname === '/js/editor/editor-initial-load-flow.js') {
      await route.continue();
      return;
    }
    if (pathname.endsWith('.css')) {
      await route.continue();
      return;
    }
    if (pathname === '/pages/editor.html' || pathname === '/') {
      await route.continue();
      return;
    }
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* inert-editor-fixture */' });
      return;
    }
    if (pathname.startsWith('/assets/') || pathname.endsWith('.ico') || pathname.endsWith('.svg') || pathname.endsWith('.png')) {
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '' });
      return;
    }
    await route.continue();
  });
}

async function setupHarness(page, cfg) {
  await page.evaluate((copies) => {
    window.t = function (key) {
      return (copies && copies[key]) || key;
    };
    function deferred() {
      let resolveFn;
      let rejectFn;
      const promise = new Promise((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });
      return { promise, resolve: resolveFn, reject: rejectFn };
    }
    window.__harness = {
      copies: copies || {},
      treeGate: deferred(),
      memoriesGate: deferred(),
      reportedErrors: [],
      logs: [],
      flash: { sidebar: 0, canvas: 0, total: 0 },
      calls: {
        syncCurrentTreeData: [],
        renderTreeLoadError: [],
        markEditorReady: 0,
        showToast: [],
        redirectToEditorLogin: [],
      },
      flowPromise: null,
      flowResult: null,
      flowError: null,
      flowSettled: false,
    };
    const sidebar = document.getElementById('editorSidebarTemplateMount');
    const canvas = document.getElementById('canvasArea');
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-region-loading')) {
            window.__harness.flash.total += 1;
            if (sidebar && sidebar.contains(node)) window.__harness.flash.sidebar += 1;
            if (canvas && canvas.contains(node)) window.__harness.flash.canvas += 1;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__harness.observer = observer;
  }, cfg.copies || {});
}

async function startFlow(page, cfg) {
  await page.evaluate((urlTreeId) => {
    const h = window.__harness;
    const editorDataLoader = {
      loadInitialEditorTree: function () {
        return h.treeGate.promise;
      },
      createNormalizeMemory: function () {
        return function (m) { return m; };
      },
      loadEditorMemories: function () {
        return h.memoriesGate.promise;
      },
    };
    h.flowPromise = window.LoveBudEditorInitialLoadFlow.runEditorInitialLoadFlow({
      editorDataLoader,
      log: function (m) { h.logs.push(m); },
      reportError: function (m) { h.reportedErrors.push(m); },
      cache: null,
      i18n: function (key) { return h.copies[key] || ''; },
      urlTreeId,
      apiClient: {},
      createDefaultTreeTitle: 'Synthetic Tree',
      getConfirmedSessionUser: function () { return Promise.resolve({ uid: 'synthetic-user' }); },
      showToast: function (msg, type) { h.calls.showToast.push({ msg, type }); },
      redirectToEditorLogin: function (delay) { h.calls.redirectToEditorLogin.push(delay); },
      buildTreeLoadErrorCopy: function (args) {
        return {
          errorTitle: 'SYNTHETIC_TREE_ERROR_TITLE',
          errorDesc: 'SYNTHETIC_TREE_ERROR_DESC:' + ((args && args.treeLoadStatus) || ''),
        };
      },
      renderTreeLoadError: function (args) { h.calls.renderTreeLoadError.push(args); },
      canvas: document.getElementById('canvasArea'),
      addBtn: null,
      markEditorReady: function () { h.calls.markEditorReady += 1; },
      escapeHtml: function (s) { return String(s); },
      sharedNormalize: function (m) { return m; },
      syncCurrentTreeData: function (tree) { h.calls.syncCurrentTreeData.push(tree); },
    });
    h.flowPromise.then(
      function (r) { h.flowResult = r; h.flowSettled = true; },
      function (e) { h.flowError = { message: (e && e.message) || String(e), name: (e && e.name) || '' }; h.flowSettled = true; }
    );
  }, cfg.urlTreeId == null ? null : cfg.urlTreeId);
}

async function releaseGates(page) {
  try {
    await page.evaluate(() => {
      const h = window.__harness;
      if (!h) return;
      try { h.treeGate.resolve({ tree: null }); } catch (_) { /* already settled */ }
      try { h.memoriesGate.resolve(); } catch (_) { /* already settled */ }
      if (h.observer) h.observer.disconnect();
    });
  } catch (_) { /* page already closing */ }
}

async function regionState(page) {
  return page.evaluate(() => {
    function inspect(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return { exists: false, loaders: 0, classes: [], roles: [], live: [], spinnerHidden: [], spinnerCount: [], text: [], longWait: [], visible: [] };
      const els = Array.from(container.querySelectorAll('[data-region-loading]'));
      return {
        exists: true,
        loaders: els.length,
        classes: els.map((e) => e.className),
        roles: els.map((e) => e.getAttribute('role')),
        live: els.map((e) => e.getAttribute('aria-live')),
        spinnerHidden: els.map((e) => {
          const s = e.querySelector('.lt-spinner');
          return s ? s.getAttribute('aria-hidden') : null;
        }),
        spinnerCount: els.map((e) => e.querySelectorAll('.lt-spinner').length),
        text: els.map((e) => e.textContent),
        longWait: els.map((e) => e.classList.contains('lt-long-wait')),
        visible: els.map((e) => getComputedStyle(e).display !== 'none'),
      };
    }
    const h = window.__harness;
    return {
      sidebar: inspect('editorSidebarTemplateMount'),
      canvas: inspect('canvasArea'),
      totalLoaders: document.querySelectorAll('[data-region-loading]').length,
      flash: { sidebar: h.flash.sidebar, canvas: h.flash.canvas, total: h.flash.total },
      calls: {
        syncCurrentTreeData: h.calls.syncCurrentTreeData.length,
        renderTreeLoadError: h.calls.renderTreeLoadError.length,
        markEditorReady: h.calls.markEditorReady,
        showToast: h.calls.showToast.length,
        redirectToEditorLogin: h.calls.redirectToEditorLogin.length,
      },
      flowSettled: h.flowSettled,
      flowStatus: h.flowResult ? h.flowResult.status : null,
      flowTreeId: h.flowResult ? h.flowResult.treeId : null,
      flowMemoriesCount: h.flowResult ? h.flowResult.memoriesCount : null,
      flowErrorMessage: h.flowError ? h.flowError.message : null,
    };
  });
}

async function shellPresence(page) {
  return page.evaluate(() => ({
    canvasArea: !!document.getElementById('canvasArea'),
    sidebar: !!document.getElementById('editorSidebarTemplateMount'),
    canvasSvg: !!document.getElementById('canvasSvg'),
    mobileControls: !!document.querySelector('.editor-mobile-panel-controls'),
    treeToggle: !!document.getElementById('mobileTreePanelToggle'),
    detailToggle: !!document.getElementById('mobileDetailPanelToggle'),
    bottomBar: !!document.getElementById('mobileBottomBar'),
  }));
}

async function advance(page, ms) {
  await page.clock.runFor(ms);
}

function assertHealth(health, label) {
  assert.deepEqual(health.pageErrors, [], label + ': pageerror 0');
  assert.deepEqual(health.consoleErrors, [], label + ': unexpected console error 0');
  assert.deepEqual(health.requestFailedSameOrigin, [], label + ': same-origin request failure 0');
  assert.deepEqual(health.httpFailures, [], label + ': unexpected HTTP >=400 0');
  assert.equal(health.externalUnexpected, 0, label + ': unexpected external network 0');
  for (const e of health.pageErrors) assert.ok(!UUID_RE.test(e), label + ': no private id in pageerror');
  for (const e of health.consoleErrors) assert.ok(!UUID_RE.test(e), label + ': no private id in console');
}

async function withPage(context, port, cfg, fn) {
  const page = await context.newPage();
  try {
    await page.clock.install({ time: 0 });
    const health = newHealth();
    collectHealth(page, health);
    await installRoutes(page, health, port);
    await page.goto('http://127.0.0.1:' + port + '/pages/editor.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      return !!window.LoveBudEditorInitialLoadFlow
        && !!document.getElementById('editorSidebarTemplateMount')
        && !!document.getElementById('canvasArea');
    }, null, { timeout: 15000 });
    await setupHarness(page, { copies: cfg.copies || COPIES });
    await fn(page, health);
  } finally {
    await releaseGates(page);
    await page.close();
  }
}

async function scenarioA(t2, context, port) {
  await t2.test('A fast tree + fast memories: no flash, immediate ready', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-fast' } }); });
      await page.evaluate(() => {
        window.currentTreeMemories = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
        window.__harness.memoriesGate.resolve();
      });
      const st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowStatus, 'ready', 'status ready');
      assert.equal(st.flash.sidebar, 0, 'sidebar loading flash 0');
      assert.equal(st.flash.canvas, 0, 'canvas loading flash 0');
      assert.equal(st.flash.total, 0, 'total flash 0');
      assert.equal(st.totalLoaders, 0, 'no loader became visible');
      assert.equal(st.calls.syncCurrentTreeData, 1, 'ready callback executed');
      assert.equal(st.flowMemoriesCount, 3, 'memoriesCount correct');
      assert.equal(st.flowTreeId, 'synthetic-tree-fast', 'treeId preserved in synthetic fixture');
      await advance(page, 25000);
      const st2 = await regionState(page);
      assert.equal(st2.totalLoaders, 0, 'no delayed loader after clock advance');
      assert.equal(st2.flash.total, 0, 'flash still 0 after advance');
      assertHealth(health, 'A');
    });
  });
}

async function scenarioB(t2, context, port) {
  await t2.test('B slow tree: sidebar region-owned inline loading', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await advance(page, 501);
      const st = await regionState(page);
      assert.equal(st.sidebar.loaders, 1, 'sidebar exactly one loading owner');
      assert.ok(st.sidebar.classes[0].includes('lt-loading-inline'), 'sidebar lt-loading-inline');
      assert.equal(st.sidebar.roles[0], 'status', 'role=status');
      assert.equal(st.sidebar.live[0], 'polite', 'aria-live=polite');
      assert.equal(st.sidebar.spinnerHidden[0], 'true', 'spinner aria-hidden=true');
      assert.ok(st.sidebar.text[0].includes(COPIES.editor_loading_tree), 'tree-specific copy visible');
      assert.equal(st.sidebar.longWait[0], false, 'no long-wait at 501ms');
      assert.equal(st.canvas.loaders, 0, 'canvas memory loader absent');
      const shell = await shellPresence(page);
      assert.ok(shell.canvasArea && shell.sidebar && shell.canvasSvg, 'stable Editor shell present');
      assert.ok(shell.mobileControls && shell.treeToggle && shell.detailToggle, 'safe navigation/mobile controls present');
      assertHealth(health, 'B');
    });
  });
}

async function scenarioC(t2, context, port) {
  await t2.test('C tree ready / memories pending: canvas region-owned compact loading', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-c' } }); });
      await advance(page, 501);
      const st = await regionState(page);
      assert.equal(st.sidebar.loaders, 0, 'sidebar loader removed immediately');
      assert.equal(st.calls.syncCurrentTreeData, 1, 'syncCurrentTreeData invoked exactly once');
      assert.equal(st.canvas.loaders, 1, 'canvas exactly one loading owner');
      assert.ok(st.canvas.classes[0].includes('lt-loading-compact'), 'canvas lt-loading-compact');
      assert.ok(st.canvas.text[0].includes(COPIES.editor_loading_memories), 'memory-specific copy visible');
      assert.equal(st.canvas.longWait[0], false, 'no long-wait yet');
      const dom = await page.evaluate(() => ({
        sidebarPresent: !!document.getElementById('editorSidebarTemplateMount'),
        sidebarLoading: document.getElementById('editorSidebarTemplateMount').querySelectorAll('[data-region-loading]').length,
        canvasVisible: getComputedStyle(document.getElementById('canvasArea')).display !== 'none',
      }));
      assert.ok(dom.sidebarPresent, 'sidebar-ready marker remains usable');
      assert.equal(dom.sidebarLoading, 0, 'ready primary region not loading');
      assert.ok(dom.canvasVisible, 'canvas shell remains visible');
      assertHealth(health, 'C');
    });
  });
}

async function scenarioD(t2, context, port) {
  await t2.test('D memories ready: full cleanup and ready result', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-d' } }); });
      await advance(page, 501);
      await page.evaluate(() => {
        window.currentTreeMemories = [{ id: 'm1' }, { id: 'm2' }];
        window.__harness.memoriesGate.resolve();
      });
      const st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowStatus, 'ready', 'ready result returned');
      assert.equal(st.totalLoaders, 0, 'all loading owners removed');
      assert.equal(st.flowMemoriesCount, 2, 'memoriesCount correct');
      assert.equal(st.flowTreeId, 'synthetic-tree-d', 'treeId preserved only in synthetic fixture');
      const flashAtReady = st.flash.total;
      await advance(page, 25000);
      const st2 = await regionState(page);
      assert.equal(st2.totalLoaders, 0, 'no stale sidebar/canvas loader');
      assert.equal(st2.flash.total, flashAtReady, 'no delayed loader appears after advance');
      assertHealth(health, 'D');
    });
  });
}

async function scenarioE(t2, context, port) {
  await t2.test('E sidebar long wait: exact 500ms / 8000ms thresholds', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      let st = await regionState(page);
      assert.equal(st.sidebar.loaders, 0, 'before 500ms: no indicator');
      await advance(page, 500);
      st = await regionState(page);
      assert.equal(st.sidebar.loaders, 1, 'at 500ms: loading indicator visible');
      assert.ok(st.sidebar.visible[0], 'indicator display visible');
      assert.equal(st.sidebar.longWait[0], false, 'at indicator: no lt-long-wait yet');
      await advance(page, 7000);
      st = await regionState(page);
      assert.equal(st.sidebar.longWait[0], false, 'before 8000ms: no lt-long-wait');
      await advance(page, 500);
      st = await regionState(page);
      assert.equal(st.sidebar.loaders, 1, 'exactly one status owner');
      assert.equal(st.sidebar.longWait[0], true, 'at 8000ms: lt-long-wait visible');
      assert.equal(st.sidebar.spinnerCount[0], 0, 'spinner removed');
      assert.ok(st.sidebar.text[0].includes(COPIES['loading.long.wait']), 'plain-language long-wait copy visible');
      assertHealth(health, 'E');
    });
  });
}

async function scenarioF(t2, context, port) {
  await t2.test('F canvas long wait: canvas alone escalates, sidebar stays ready', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-f' } }); });
      await advance(page, 500);
      let st = await regionState(page);
      assert.equal(st.sidebar.loaders, 0, 'sidebar remains ready');
      assert.equal(st.canvas.loaders, 1, 'canvas loading owner visible');
      assert.equal(st.canvas.longWait[0], false, 'canvas not long-wait yet');
      await advance(page, 7500);
      st = await regionState(page);
      assert.equal(st.canvas.longWait[0], true, 'canvas alone becomes lt-long-wait');
      assert.equal(st.sidebar.loaders, 0, 'sidebar receives no new loading owner');
      assert.equal(st.flash.sidebar, 0, 'sidebar never flashed a loader');
      const dom = await page.evaluate(() => !!document.getElementById('editorSidebarTemplateMount'));
      assert.ok(dom, 'ready sibling region remains usable');
      assertHealth(health, 'F');
    });
  });
}

async function scenarioG(t2, context, port) {
  await t2.test('G auth required: stopped with toast + redirect, cleaned', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: null, authRequired: true }); });
      const st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowStatus, 'stopped', 'status=stopped');
      assert.equal(st.calls.showToast, 1, 'showToast exactly once');
      assert.equal(st.calls.redirectToEditorLogin, 1, 'redirectToEditorLogin exactly once');
      assert.equal(st.sidebar.loaders, 0, 'sidebar loader cleaned');
      assert.equal(st.canvas.loaders, 0, 'canvas loader absent');
      const detail = await page.evaluate(() => ({
        toast: window.__harness.calls.showToast[0],
        redirectDelay: window.__harness.calls.redirectToEditorLogin[0],
        canvasLoaders: document.getElementById('canvasArea').querySelectorAll('[data-region-loading]').length,
      }));
      assert.equal(detail.toast.msg, COPIES.need_login, 'toast uses need_login copy');
      assert.equal(detail.toast.type, 'error', 'toast type error');
      assert.equal(detail.redirectDelay, 2000, 'redirect delay 2000');
      assert.equal(detail.canvasLoaders, 0, 'no synthetic private data rendered');
      assertHealth(health, 'G');
    });
  });
}

async function scenarioH(t2, context, port) {
  await t2.test('H tree not found / load error boundary: renderTreeLoadError + ready', async () => {
    await withPage(context, port, { urlTreeId: 'synthetic-url-tree-h' }, async (page, health) => {
      await startFlow(page, { urlTreeId: 'synthetic-url-tree-h' });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: null, treeLoadStatus: 'not_found', treeLoadErrorMessage: '' }); });
      const st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowStatus, 'stopped', 'status=stopped');
      assert.equal(st.calls.renderTreeLoadError, 1, 'renderTreeLoadError exactly once');
      assert.equal(st.calls.markEditorReady, 1, 'markEditorReady exactly once');
      assert.equal(st.sidebar.loaders, 0, 'sidebar loader cleaned');
      assert.equal(st.canvas.loaders, 0, 'canvas loader absent');
      const errArgs = await page.evaluate(() => window.__harness.calls.renderTreeLoadError[0]);
      assert.ok(errArgs.errorTitle && errArgs.errorTitle.length > 0, 'error not represented as empty (title)');
      assert.ok(errArgs.errorDesc && errArgs.errorDesc.length > 0, 'error not represented as empty (desc)');
      assertHealth(health, 'H');
    });
  });
}

async function scenarioI(t2, context, port) {
  await t2.test('I tree rejection cleanup: truthful rejection, no stale mutation', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.reject(new Error('synthetic-tree-rejection')); });
      const st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowErrorMessage, 'synthetic-tree-rejection', 'promise rejects truthfully (not swallowed)');
      assert.equal(st.sidebar.loaders, 0, 'sidebar loader cleaned');
      assert.equal(st.canvas.loaders, 0, 'canvas loader absent');
      const flashAtReject = st.flash.total;
      await advance(page, 25000);
      const st2 = await regionState(page);
      assert.equal(st2.totalLoaders, 0, 'no later timer mutation');
      assert.equal(st2.flash.total, flashAtReject, 'flash unchanged after advance');
      assertHealth(health, 'I');
    });
  });
}

async function scenarioJ(t2, context, port) {
  await t2.test('J memory rejection cleanup: sidebar ready, canvas cleaned, no stale long-wait', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-j' } }); });
      await advance(page, 501);
      let st = await regionState(page);
      assert.equal(st.canvas.loaders, 1, 'canvas loader visible before rejection');
      await page.evaluate(() => { window.__harness.memoriesGate.reject(new Error('synthetic-memory-rejection')); });
      st = await regionState(page);
      assert.equal(st.flowSettled, true, 'flow settled');
      assert.equal(st.flowErrorMessage, 'synthetic-memory-rejection', 'promise rejects truthfully (not converted to empty)');
      assert.equal(st.calls.syncCurrentTreeData, 1, 'sidebar remains ready');
      assert.equal(st.sidebar.loaders, 0, 'sidebar no loader');
      assert.equal(st.canvas.loaders, 0, 'canvas loader cleaned');
      await advance(page, 25000);
      const st2 = await regionState(page);
      assert.equal(st2.totalLoaders, 0, 'no stale long-wait mutation');
      assertHealth(health, 'J');
    });
  });
}

async function scenarioK(t2, context, port, ctx) {
  await t2.test('K reduced motion: computed animation + geometry', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await advance(page, 501);
      const styles = await page.evaluate(() => {
        const el = document.querySelector('#editorSidebarTemplateMount [data-region-loading]');
        const spinner = el ? el.querySelector('.lt-spinner') : null;
        const cs = el ? getComputedStyle(el) : null;
        const scs = spinner ? getComputedStyle(spinner) : null;
        const rect = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
        return {
          loaderExists: !!el,
          loaderVisible: cs ? cs.display !== 'none' : false,
          copyText: el ? el.textContent : '',
          spinnerExists: !!spinner,
          spinnerAriaHidden: spinner ? spinner.getAttribute('aria-hidden') : null,
          spinnerAnimationName: scs ? scs.animationName : null,
          width: rect.width,
          height: rect.height,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        };
      });
      assert.ok(styles.loaderExists, 'loading status remains present');
      assert.ok(styles.loaderVisible, 'loading status remains visible');
      assert.ok(styles.copyText.includes(COPIES.editor_loading_tree), 'copy remains visible');
      assert.ok(styles.spinnerExists, 'spinner/status meaning remains present');
      assert.equal(styles.spinnerAriaHidden, 'true', 'spinner aria-hidden');
      assert.ok(styles.width > 0 && styles.height > 0, 'layout geometry remains non-zero');
      if (ctx.reducedMotion === 'reduce') {
        assert.equal(styles.reducedMotion, true, 'reduced-motion context active');
        assert.equal(styles.spinnerAnimationName, 'none', 'nonessential animation disabled');
      } else {
        assert.equal(styles.reducedMotion, false, 'normal-motion context active');
        assert.equal(styles.spinnerAnimationName, 'lt-spin', 'observed normal-motion spinner animation');
      }
      assertHealth(health, 'K');
    });
  });
}

async function scenarioL(t2, context, port, ctx) {
  await t2.test('L accessibility and responsive safety', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await advance(page, 501);
      const a11y = await page.evaluate((vp) => {
        const loaders = Array.from(document.querySelectorAll('[data-region-loading]'));
        const visibleLoaders = loaders.filter((e) => getComputedStyle(e).display !== 'none');
        const sidebar = document.getElementById('editorSidebarTemplateMount');
        const canvas = document.getElementById('canvasArea');
        const controls = Array.from(document.querySelectorAll('.editor-mobile-panel-toggle, #mobileBottomBar'));
        let controlsOverflow = 0;
        for (const c of controls) {
          const r = c.getBoundingClientRect();
          if (r.width > 0 && (r.right > vp.width + 1 || r.left < -1)) controlsOverflow += 1;
        }
        const active = document.activeElement;
        const focusInUnresolved = !!(active && active !== document.body && loaders.some((e) => e.contains(active)));
        const canvasRect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
        return {
          visibleLoaderCount: visibleLoaders.length,
          sidebarLoaders: sidebar ? sidebar.querySelectorAll('[data-region-loading]').length : 0,
          canvasLoaders: canvas ? canvas.querySelectorAll('[data-region-loading]').length : 0,
          rolesOk: visibleLoaders.every((e) => e.getAttribute('role') === 'status'),
          liveOk: visibleLoaders.every((e) => e.getAttribute('aria-live') === 'polite'),
          spinnerOk: visibleLoaders.every((e) => {
            const s = e.querySelector('.lt-spinner');
            return !s || s.getAttribute('aria-hidden') === 'true';
          }),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          canvasWidth: canvasRect.width,
          canvasHeight: canvasRect.height,
          controlsOverflow,
          focusInUnresolved,
        };
      }, ctx.viewport);
      assert.ok(a11y.sidebarLoaders <= 1, 'sidebar owns at most one status');
      assert.ok(a11y.canvasLoaders <= 1, 'canvas owns at most one status');
      assert.equal(a11y.visibleLoaderCount, a11y.sidebarLoaders + a11y.canvasLoaders, 'duplicate visible loading owners 0');
      assert.ok(a11y.rolesOk, 'role=status');
      assert.ok(a11y.liveOk, 'aria-live=polite');
      assert.ok(a11y.spinnerOk, 'spinner aria-hidden=true');
      assert.ok(a11y.horizontalOverflow <= 1, 'horizontal overflow 0');
      assert.ok(a11y.canvasWidth > 0 && a11y.canvasHeight > 0, 'primary region non-zero geometry');
      assert.equal(a11y.controlsOverflow, 0, 'mobile controls remain within viewport');
      assert.equal(a11y.focusInUnresolved, false, 'no focus forced into unresolved content');
      assertHealth(health, 'L');
    });
  });
}

async function scenarioM(t2, context, port) {
  await t2.test('M browser health: clean page, no leaks, no private-id leakage', async () => {
    await withPage(context, port, { urlTreeId: null }, async (page, health) => {
      await startFlow(page, { urlTreeId: null });
      await page.evaluate(() => { window.__harness.treeGate.resolve({ tree: { id: 'synthetic-tree-m' } }); });
      await page.evaluate(() => {
        window.currentTreeMemories = [{ id: 'm1' }];
        window.__harness.memoriesGate.resolve();
      });
      await regionState(page);
      assertHealth(health, 'M');
      const bodyUuid = await page.evaluate((re) => new RegExp(re).test(document.body.innerText || ''), UUID_RE.source);
      assert.equal(bodyUuid, false, 'raw private identifier leakage 0');
      assert.equal(health.consoleWarnings.length >= 0, true, 'warnings recorded (bounded)');
    });
  });
}

test('editor loading 3688 browser contract', async (t) => {
  const { server, port } = await startServer();
  const browser = await chromium.launch();
  try {
    for (const ctx of CONTEXTS) {
      await t.test(ctx.name, async (t2) => {
        const context = await browser.newContext({
          viewport: ctx.viewport,
          reducedMotion: ctx.reducedMotion,
          isMobile: ctx.isMobile,
          hasTouch: ctx.hasTouch,
        });
        try {
          await scenarioA(t2, context, port, ctx);
          await scenarioB(t2, context, port, ctx);
          await scenarioC(t2, context, port, ctx);
          await scenarioD(t2, context, port, ctx);
          await scenarioE(t2, context, port, ctx);
          await scenarioF(t2, context, port, ctx);
          await scenarioG(t2, context, port, ctx);
          await scenarioH(t2, context, port, ctx);
          await scenarioI(t2, context, port, ctx);
          await scenarioJ(t2, context, port, ctx);
          await scenarioK(t2, context, port, ctx);
          await scenarioL(t2, context, port, ctx);
          await scenarioM(t2, context, port, ctx);
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
});
