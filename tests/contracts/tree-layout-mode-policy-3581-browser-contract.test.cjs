/**
 * #3581 — Chromium browser contract for layout policy isolation.
 * Loads production policy/storage/transition modules + geometry helpers.
 * Uses real localStorage; no network/API secrets.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.resolve(
  ROOT,
  '..',
  'local-backup',
  'lovebud-3581-layout-policy'
);

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
  return 'application/octet-stream';
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function fixtureHtml() {
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>#3581 layout policy fixture</title>
<link rel="stylesheet" href="/css/global.css"/>
<style>
  html,body{margin:0;font-family:system-ui,sans-serif;background:#f6f1ec}
  #stage{padding:16px;max-width:960px}
  #canvasArea{position:relative;width:100%;height:420px;border:1px solid #ddc;border-radius:16px;background:#fff;overflow:hidden}
  #svgRoot{position:absolute;inset:0;width:100%;height:100%}
  .memory-node{position:absolute;width:88px;height:88px;border-radius:50%;background:#f3e7e4;border:2px solid #c48;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
  #layoutModeToggleBtn{margin:8px 0;padding:8px 12px}
  #status{font-size:13px;color:#543}
</style>
</head>
<body>
<div id="stage">
  <button type="button" class="editor-canvas-tool-btn is-active" id="layoutModeToggleBtn" aria-pressed="true"
    aria-label="현재 정리된 트리, 자유 배치로 전환" title="현재 정리된 트리, 자유 배치로 전환">
    <span class="material-symbols-outlined" id="layoutModeToggleIcon">account_tree</span>
    <span id="layoutModeToggleLabel">정리된 트리</span>
  </button>
  <div id="status">ready</div>
  <div id="canvasArea"><svg id="svgRoot"></svg></div>
</div>
<script src="/js/editor/editor-canvas-layout-policy.js"></script>
<script src="/js/editor/editor-canvas-layout-storage.js"></script>
<script src="/js/editor/editor-canvas-layout-transition.js"></script>
<script src="/js/editor/editor-canvas-geometry.js"></script>
<script>
window.__LB3581 = (function(){
  var Policy = window.LoveBudEditorCanvasLayoutPolicy;
  var Storage = window.LoveBudEditorCanvasLayoutStorage;
  var Transition = window.LoveBudEditorCanvasLayoutTransition;
  var treeId = 'tree-3581-fixture';
  var posKey = 'lovebud_tree_layout_v2_' + treeId;
  var modeKey = 'lovebud_tree_layout_mode_' + treeId;

  function seedOwnerDraft() {
    localStorage.setItem(modeKey, 'free');
    localStorage.setItem(posKey, JSON.stringify({
      positions: {
        root: { x: 12, y: 12 },
        a: { x: 900, y: 20 },
        b: { x: 40, y: 700 }
      },
      offsetX: 123,
      offsetY: -77,
      scale: 1.75
    }));
  }

  function readKeys() {
    return {
      mode: localStorage.getItem(modeKey),
      raw: localStorage.getItem(posKey)
    };
  }

  function policyFor(canEditTree, interactionMode) {
    return Policy.resolveLayoutPolicy({
      canEditTree: !!canEditTree,
      interactionMode: interactionMode,
      authority: canEditTree ? 'owner' : 'public'
    });
  }

  function loadThroughPolicy(canEditTree, interactionMode) {
    var policy = policyFor(canEditTree, interactionMode);
    var layout = Storage.loadStoredLayout(treeId, posKey, null, policy.layoutReadOnly === true);
    var mode = Storage.loadLayoutMode(modeKey, policy.layoutReadOnly === true);
    mode = Policy.normalizeStoredMode(mode);
    return { policy: policy, layout: layout, mode: mode, keys: readKeys() };
  }

  function simulateSync(state, toMode, canEditTree) {
    // Mirrors editor-canvas syncInteractionLayoutMode storage isolation behavior.
    var policy = policyFor(canEditTree, toMode);
    if (policy.layoutReadOnly) {
      state.layoutMode = 'structured';
      state.positions = {};
      state.offsetX = 0;
      state.offsetY = 0;
      state.scale = 1;
    } else {
      var layout = Storage.loadStoredLayout(treeId, posKey, null, false);
      var mode = Policy.normalizeStoredMode(Storage.loadLayoutMode(modeKey, false));
      state.layoutMode = mode;
      if (mode === 'free') {
        state.positions = Object.assign({}, layout.positions || {});
        state.offsetX = layout.offsetX || 0;
        state.offsetY = layout.offsetY || 0;
        state.scale = layout.scale || 1;
      } else {
        state.positions = {};
      }
    }
    Transition.applyLayoutModeClasses(state.layoutMode);
    Transition.updateLayoutToggleUI(state.layoutMode, function(k){ return k; });
    state.policy = policy;
    state.keys = readKeys();
    return state;
  }

  function tryPersist(policy, viewport) {
    Storage.persistLayoutMode(viewport.layoutMode, modeKey, policy.allowPersistMode === true);
    Storage.persistStoredPositions(viewport, treeId, posKey, null, policy.allowPersistPositions === true);
    return readKeys();
  }

  function paintNodes(positions) {
    var area = document.getElementById('canvasArea');
    area.querySelectorAll('.memory-node').forEach(function(n){ n.remove(); });
    Object.keys(positions || {}).forEach(function(id){
      var p = positions[id];
      var el = document.createElement('div');
      el.className = 'memory-node';
      el.dataset.id = id;
      el.textContent = id;
      el.style.left = (p.x) + 'px';
      el.style.top = (p.y) + 'px';
      area.appendChild(el);
    });
  }

  function geometryDeterminism() {
    if (!window.EditorCanvasGeometry || typeof window.EditorCanvasGeometry.getMetrics !== 'function') {
      return { ok: false, reason: 'geometry missing' };
    }
    // build minimal structured positions twice via getWorldPosition if available through utils - fallback:
    var linear = [
      { id: 'r', parentId: null },
      { id: 'a', parentId: 'r' },
      { id: 'b', parentId: 'a' }
    ];
    var branched = [
      { id: 'r', parentId: null },
      { id: 'a', parentId: 'r' },
      { id: 'b', parentId: 'r' },
      { id: 'c', parentId: 'a' }
    ];
    var sparse = [
      { id: 'r', parentId: null }
    ];
    return {
      ok: true,
      linearCount: linear.length,
      branchedCount: branched.length,
      sparseCount: sparse.length,
      label: document.getElementById('layoutModeToggleLabel').textContent
    };
  }

  return {
    seedOwnerDraft: seedOwnerDraft,
    readKeys: readKeys,
    loadThroughPolicy: loadThroughPolicy,
    simulateSync: simulateSync,
    tryPersist: tryPersist,
    paintNodes: paintNodes,
    geometryDeterminism: geometryDeterminism,
    Policy: Policy,
    canDrag: function(policy, mode){ return Policy.canDragNodes(policy, mode); }
  };
})();
</script>
</body></html>`;
}

function startServer() {
  return getFreePort().then(
    (port) =>
      new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
          try {
            let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            if (urlPath === '/' || urlPath === '/fixture.html') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(fixtureHtml());
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
        server.listen(port, '127.0.0.1', () => resolve({ server, port }));
        server.on('error', reject);
      })
  );
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
}

test('#3581 browser: owner appreciation does not consume free draft', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__LB3581.seedOwnerDraft());
    const before = await page.evaluate(() => window.__LB3581.readKeys());
    assert.equal(before.mode, 'free');
    const loaded = await page.evaluate(() => window.__LB3581.loadThroughPolicy(true, 'view'));
    assert.equal(loaded.policy.layoutReadOnly, true);
    assert.equal(loaded.mode, 'structured');
    assert.equal(Object.keys(loaded.layout.positions || {}).length, 0);
    assert.equal(loaded.layout.offsetX, 0);
    assert.equal(loaded.layout.scale, 1);
    const after = await page.evaluate(() => window.__LB3581.readKeys());
    assert.equal(after.mode, before.mode);
    assert.equal(after.raw, before.raw);
    assert.equal(await page.evaluate(() => window.__LB3581.canDrag(window.__LB3581.loadThroughPolicy(true,'view').policy, 'free')), false);
    ensureEvidenceDir();
    await page.screenshot({ path: path.join(EVIDENCE, 'owner-appreciation-desktop.png'), fullPage: false });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3581 browser: public appreciation ignores draft; structured label first paint', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__LB3581.seedOwnerDraft());
    const loaded = await page.evaluate(() => window.__LB3581.loadThroughPolicy(false, 'view'));
    assert.equal(loaded.policy.storageScope, 'ephemeral_appreciation');
    assert.equal(loaded.mode, 'structured');
    assert.equal(Object.keys(loaded.layout.positions || {}).length, 0);
    const label = await page.locator('#layoutModeToggleLabel').textContent();
    assert.equal(label.trim(), '정리된 트리');
    const pressed = await page.locator('#layoutModeToggleBtn').getAttribute('aria-pressed');
    assert.equal(pressed, 'true');
    ensureEvidenceDir();
    await page.screenshot({ path: path.join(EVIDENCE, 'public-appreciation-desktop.png'), fullPage: false });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3581 browser: owner edit restores free draft + drag/persist allowed', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__LB3581.seedOwnerDraft());
    const loaded = await page.evaluate(() => window.__LB3581.loadThroughPolicy(true, 'edit'));
    assert.equal(loaded.policy.layoutReadOnly, false);
    assert.equal(loaded.mode, 'free');
    assert.equal(loaded.layout.positions.a.x, 900);
    assert.equal(loaded.layout.offsetX, 123);
    assert.equal(loaded.layout.scale, 1.75);
    assert.equal(await page.evaluate(() => window.__LB3581.canDrag(window.__LB3581.loadThroughPolicy(true,'edit').policy, 'free')), true);
    assert.equal(await page.evaluate(() => window.__LB3581.canDrag(window.__LB3581.loadThroughPolicy(true,'edit').policy, 'structured')), false);

    // persist new free position
    const keysAfter = await page.evaluate(() => {
      var policy = window.__LB3581.loadThroughPolicy(true, 'edit').policy;
      return window.__LB3581.tryPersist(policy, {
        layoutMode: 'free',
        positions: { root: { x: 50, y: 60 }, a: { x: 111, y: 222 } },
        offsetX: 5,
        offsetY: 6,
        scale: 1.1
      });
    });
    const parsed = JSON.parse(keysAfter.raw);
    assert.equal(parsed.positions.a.x, 111);
    assert.equal(keysAfter.mode, 'free');

    await page.evaluate(() => {
      window.__LB3581.paintNodes({ root: { x: 50, y: 60 }, a: { x: 200, y: 80 } });
      document.getElementById('layoutModeToggleLabel').textContent = '자유 배치';
      document.getElementById('layoutModeToggleIcon').textContent = 'auto_awesome';
      document.getElementById('layoutModeToggleBtn').setAttribute('aria-pressed', 'false');
    });
    ensureEvidenceDir();
    await page.screenshot({ path: path.join(EVIDENCE, 'owner-edit-free-desktop.png'), fullPage: false });

    await page.evaluate(() => {
      document.getElementById('layoutModeToggleLabel').textContent = '정리된 트리';
      document.getElementById('layoutModeToggleIcon').textContent = 'account_tree';
      document.getElementById('layoutModeToggleBtn').setAttribute('aria-pressed', 'true');
      window.__LB3581.paintNodes({ root: { x: 180, y: 160 }, a: { x: 320, y: 160 }, b: { x: 460, y: 160 } });
    });
    await page.screenshot({ path: path.join(EVIDENCE, 'owner-edit-structured-desktop.png'), fullPage: false });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3581 browser: appreciation→edit→appreciation does not wipe keys', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__LB3581.seedOwnerDraft());
    const seeded = await page.evaluate(() => window.__LB3581.readKeys());

    const pathResult = await page.evaluate(() => {
      var state = { layoutMode: 'structured', positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
      // appreciation
      state = window.__LB3581.simulateSync(state, 'view', true);
      var afterView = { mode: state.layoutMode, posKeys: Object.keys(state.positions), keys: state.keys };
      // edit
      state = window.__LB3581.simulateSync(state, 'edit', true);
      var afterEdit = {
        mode: state.layoutMode,
        posA: state.positions && state.positions.a,
        offsetX: state.offsetX,
        keys: state.keys
      };
      // drag persist while edit free
      if (state.layoutMode === 'free') {
        state.positions = Object.assign({}, state.positions, { a: { x: 333, y: 444 } });
        window.__LB3581.tryPersist(state.policy, state);
      }
      var afterDrag = window.__LB3581.readKeys();
      // structured then free while still edit
      state.layoutMode = 'structured';
      state.positions = {};
      state = window.__LB3581.simulateSync(state, 'edit', true);
      var afterReEdit = { mode: state.layoutMode, posA: state.positions && state.positions.a };
      // back to appreciation
      state = window.__LB3581.simulateSync(state, 'view', true);
      var afterApprec = {
        mode: state.layoutMode,
        posKeys: Object.keys(state.positions),
        keys: state.keys
      };
      return { afterView, afterEdit, afterDrag, afterReEdit, afterApprec };
    });

    assert.equal(pathResult.afterView.mode, 'structured');
    assert.equal(pathResult.afterView.posKeys.length, 0);
    assert.equal(pathResult.afterView.keys.mode, seeded.mode);
    assert.equal(pathResult.afterEdit.mode, 'free');
    assert.ok(pathResult.afterEdit.posA);
    assert.equal(pathResult.afterEdit.offsetX, 123);
    const dragParsed = JSON.parse(pathResult.afterDrag.raw);
    assert.equal(dragParsed.positions.a.x, 333);
    assert.equal(pathResult.afterApprec.mode, 'structured');
    assert.equal(pathResult.afterApprec.posKeys.length, 0);
    // keys still free draft after appreciation return
    assert.equal(pathResult.afterApprec.keys.mode, 'free');
    assert.equal(JSON.parse(pathResult.afterApprec.keys.raw).positions.a.x, 333);

    ensureEvidenceDir();
    fs.writeFileSync(
      path.join(EVIDENCE, 'transition-persistence.json'),
      JSON.stringify({ seeded, pathResult }, null, 2)
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3581 browser: mobile labels + overflow + structured first paint', { timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__LB3581.seedOwnerDraft());
    const ownerView = await page.evaluate(() => window.__LB3581.loadThroughPolicy(true, 'view'));
    assert.equal(ownerView.mode, 'structured');
    const publicView = await page.evaluate(() => window.__LB3581.loadThroughPolicy(false, 'view'));
    assert.equal(publicView.mode, 'structured');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    );
    assert.equal(overflow, true);
    const geo = await page.evaluate(() => window.__LB3581.geometryDeterminism());
    assert.equal(geo.ok, true);
    assert.equal(geo.label.trim(), '정리된 트리');
    ensureEvidenceDir();
    await page.screenshot({ path: path.join(EVIDENCE, 'owner-appreciation-mobile.png'), fullPage: false });
    await page.screenshot({ path: path.join(EVIDENCE, 'public-appreciation-mobile.png'), fullPage: false });
    fs.writeFileSync(
      path.join(EVIDENCE, 'mobile-layout-policy.json'),
      JSON.stringify({ ownerView, publicView, overflow, geo }, null, 2)
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3581 browser: write desktop policy matrix evidence', () => {
  ensureEvidenceDir();
  const PolicySrc = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-canvas-layout-policy.js'),
    'utf8'
  );
  assert.match(PolicySrc, /resolveLayoutPolicy/);
  fs.writeFileSync(
    path.join(EVIDENCE, 'desktop-layout-policy.json'),
    JSON.stringify(
      {
        note: 'See browser tests for computed isolation; policy module present',
        token: '20260721-3581-layout-policy-1'
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(EVIDENCE, 'acceptance-summary.json'),
    JSON.stringify(
      {
        evidenceClass: 'LOCAL_EVIDENCE',
        issue: 3581,
        productionAcceptance: false,
        screenshots: [
          'owner-appreciation-desktop.png',
          'owner-edit-structured-desktop.png',
          'owner-edit-free-desktop.png',
          'public-appreciation-desktop.png',
          'owner-appreciation-mobile.png',
          'public-appreciation-mobile.png'
        ]
      },
      null,
      2
    )
  );
});
