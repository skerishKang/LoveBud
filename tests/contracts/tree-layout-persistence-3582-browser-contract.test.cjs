/**
 * #3582 Chromium component integration (supplemental) — production canvas modules.
 *
 * Role: lower-level supplemental coverage only.
 * Canonical Editor route / reload / URL mode=edit / js/editor.js first paint are
 * owned by tree-layout-persistence-3582-editor-route-contract.test.cjs.
 *
 * This file may claim:
 * - createEditorCanvas storage restoration (fixture-level)
 * - actual pointer drag persistence
 * - layout toggle free↔structured
 * - tree-key isolation via fixture full page navigation
 * - storage failure fallback
 * - mobile canvas restoration (fixture)
 *
 * This file must NOT alone claim:
 * - canonical pages/editor.html boot
 * - actual js/editor.js startEditor first paint
 * - URL mode=edit production startup
 * - ordinary Editor reload without second navigation
 * - owner auth/permission startup via real editor shell
 *
 * No drag-failure substitutes (no direct positions write / persist to fake success).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.resolve(ROOT, '..', 'local-backup', 'lovebud-3582-persistence');
const TOKEN = '20260721-3581-layout-policy-2';
const TREE_A = 'tree-A-3582-contract';
const TREE_B = 'tree-B-3582-contract';
const MODE_A = `lovebud_tree_layout_mode_${TREE_A}`;
const POS_A = `lovebud_tree_layout_v2_${TREE_A}`;
const MODE_B = `lovebud_tree_layout_mode_${TREE_B}`;
const POS_B = `lovebud_tree_layout_v2_${TREE_B}`;

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

function ensureEvidence() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

const GLOBAL_SCRIPTS = [
  'js/editor/editor-interaction-mode.js',
  'js/editor/editor-canvas-layout.js',
  'js/editor/editor-canvas-layout-helpers.js',
  'js/editor/editor-canvas-layout-policy.js',
  'js/editor/editor-canvas-layout-storage.js',
  'js/editor/editor-canvas-node.js',
  'js/editor/editor-canvas-interaction.js',
  'js/editor/editor-canvas-viewport.js',
  'js/editor/editor-canvas-viewport-scale.js',
  'js/editor/editor-canvas-viewport-projection.js',
  'js/editor/editor-canvas-viewport-targets.js',
  'js/editor/editor-canvas-viewport-feedback.js',
  'js/editor/editor-canvas-viewport-state.js',
  'js/editor/editor-canvas-viewport-fit.js',
  'js/editor/editor-canvas-viewport-initial.js',
  'js/editor/editor-canvas-viewport-branches.js',
  'js/editor/editor-canvas-viewport-actions.js',
  'js/editor/editor-canvas-viewport-controls.js',
  'js/editor/editor-canvas-edges.js',
  'js/editor/editor-canvas-state-boundary.js',
  'js/editor/editor-canvas-growth-affordance.js',
  'js/editor/editor-canvas-branch-ports.js',
  'js/editor/editor-canvas-geometry.js',
  'js/editor/editor-canvas-layout-transition.js',
  'js/auth/auth-cache.js',
  'js/auth/auth-firebase.js'
];

function fixtureHtml() {
  const globals = GLOBAL_SCRIPTS.map((src) => `<script src="/${src}?v=${TOKEN}"></script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>#3582 persistence fixture</title>
<style>
  html, body { margin: 0; width: 100%; max-width: 100%; overflow-x: hidden; background: #f6f1ec; font-family: system-ui, sans-serif; }
  #toolbar { padding: 10px 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  #layoutModeToggleBtn { padding: 8px 12px; border-radius: 999px; border: 1px solid #c9a; background: #fff; }
  #canvasArea { position: relative; width: min(1100px, 100%); height: 520px; margin: 0 12px 16px; border: 1px solid #dcc; border-radius: 18px; background: #fff; overflow: hidden; }
  #svgRoot { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .memory-node { position: absolute; width: 96px; height: 96px; border-radius: 50%; border: 2px solid #b86; background: #f7ece9; box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; touch-action: none; user-select: none; }
  .material-symbols-outlined { font-family: system-ui; font-size: 16px; }
  #nav a { margin-right: 10px; }
</style>
</head><body>
  <div id="nav">
    <a href="/route-exit.html" id="linkExit">My Trees</a>
    <button type="button" id="logoutBtn">logout</button>
  </div>
  <div id="toolbar">
    <button type="button" class="editor-canvas-tool-btn is-active" id="layoutModeToggleBtn"
      aria-pressed="true" aria-label="현재 정리된 트리, 자유 배치로 전환" title="현재 정리된 트리, 자유 배치로 전환">
      <span class="material-symbols-outlined" id="layoutModeToggleIcon" aria-hidden="true">account_tree</span>
      <span class="editor-canvas-tool-label" id="layoutModeToggleLabel">정리된 트리</span>
    </button>
    <span id="modeBadge">view</span>
    <span id="treeBadge">?</span>
  </div>
  <div id="canvasArea" data-testid="canvas"><svg id="svgRoot"></svg></div>
${globals}
<script type="module" src="/js/editor/editor-canvas.js?v=${TOKEN}"></script>
<script>
(function(){
  window.__authStub = { signedOut: false, reloaded: false };
  // Prevent production signOut full reload; record that boundary ran.
  var reloadStub = function(){ window.__authStub.reloaded = true; };
  function wireSignOut(){
    if (!window.LoveBudAuthFirebase) { setTimeout(wireSignOut, 20); return; }
    if (typeof window.LoveBudAuthFirebase.createProtectedRouteBridge === 'function') {
      var bridge = window.LoveBudAuthFirebase.createProtectedRouteBridge({
        clearStaleFirebaseAuthState: function(){
          try {
            var keys=[];
            for (var i=0;i<localStorage.length;i++){
              var k=localStorage.key(i);
              if (k && (k.indexOf('firebase:authUser:')===0 || k.indexOf('firebase:pendingRedirect:')===0 || k.indexOf('firebase:redirectUser:')===0)) keys.push(k);
            }
            keys.forEach(function(k){ localStorage.removeItem(k); });
          } catch(e){}
        },
        clearConfirmedAuthCache: function(){
          try {
            localStorage.removeItem('lovebud_auth_cache');
            localStorage.removeItem('lovebud_auth_confirmed');
            localStorage.removeItem('lovebud_auth_token');
          } catch(e){}
        },
        isLoginPage: function(){ return false; },
        getCachedAuthUser: function(){ return null; },
        buildUserDropdown: function(){},
        updateNavUI: function(){},
        fireAuthReadyCallbacks: function(){},
        resolveAuthBootstrap: function(){},
        markAuthLoading: function(){},
        markAuthReady: function(){},
        initOfflineAuth: function(){},
        attachDropdownListener: function(){},
        persistConfirmedAuthSession: async function(){},
        setupLoginPageAuthUi: function(){},
        resolveEmailAuthMode: function(){},
        setupGoogleBtn: function(){},
        setupEmailAuthForm: function(){},
        setupSignupForm: function(){},
        setupSignupGoogleBtn: function(){},
        getRedirectTarget: function(){ return '/'; },
        preloadRedirectTargetData: function(){},
        getEnvironmentCheckError: function(){ return null; }
      });
      window.__lbSignOut = function(){
        window.location.reload = reloadStub;
        return bridge.signOut();
      };
    } else if (typeof window.LoveBudAuthFirebase.signOut === 'function') {
      window.__lbSignOut = function(){
        window.location.reload = reloadStub;
        return window.LoveBudAuthFirebase.signOut({
          clearStaleFirebaseAuthState: function(){
            try {
              var keys=[];
              for (var i=0;i<localStorage.length;i++){
                var k=localStorage.key(i);
                if (k && k.indexOf('firebase:')===0) keys.push(k);
              }
              keys.forEach(function(k){ localStorage.removeItem(k); });
            } catch(e){}
          },
          clearConfirmedAuthCache: function(){
            try {
              localStorage.removeItem('lovebud_auth_cache');
              localStorage.removeItem('lovebud_auth_confirmed');
              localStorage.removeItem('lovebud_auth_token');
            } catch(e){}
          }
        });
      };
    }
    var btn = document.getElementById('logoutBtn');
    if (btn) btn.onclick = function(){ if (window.__lbSignOut) window.__lbSignOut(); };
  }
  wireSignOut();
  window.__LB3582_READY = new Promise(function(resolve){
    function c(){ if (typeof window.createEditorCanvas === 'function') return resolve(true); setTimeout(c, 20); }
    c();
  });
})();
</script>
</body></html>`;
}

function routeExitHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>route-exit</title></head>
<body><h1>My Trees (fixture)</h1>
<a id="backAEdit" href="/fixture.html?treeId=${TREE_A}&mode=edit">A edit</a>
<a id="backAView" href="/fixture.html?treeId=${TREE_A}&mode=view">A view</a>
</body></html>`;
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
            if (urlPath === '/route-exit.html') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(routeExitHtml());
              return;
            }
            const abs = path.normalize(path.join(ROOT, urlPath.replace(/^\//, '')));
            if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
              res.writeHead(404);
              res.end('not found: ' + urlPath);
              return;
            }
            res.writeHead(200, { 'Content-Type': contentType(abs) });
            res.end(fs.readFileSync(abs));
          } catch (e) {
            res.writeHead(500);
            res.end(String(e));
          }
        });
        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => resolve({ server, port }));
      })
  );
}

async function launchBrowser() {
  return playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
}

function mems(tree) {
  if (tree === 'B') {
    return [
      { id: 'B-root', parentId: null, title: 'B-root' },
      { id: 'B-one', parentId: 'B-root', title: 'B-one' },
      { id: 'B-two', parentId: 'B-one', title: 'B-two' }
    ];
  }
  return [
    { id: 'A-root', parentId: null, title: 'A-root' },
    { id: 'A-one', parentId: 'A-root', title: 'A-one' },
    { id: 'A-two', parentId: 'A-one', title: 'A-two' }
  ];
}

async function openTree(page, base, tree, interactionMode) {
  const treeId = tree === 'B' ? TREE_B : TREE_A;
  const memories = mems(tree);
  const rootId = memories[0].id;
  await page.goto(`${base}/fixture.html?treeId=${encodeURIComponent(treeId)}&mode=${interactionMode}`, {
    waitUntil: 'networkidle'
  });
  await page.waitForFunction(() => typeof window.createEditorCanvas === 'function', null, {
    timeout: 15000
  });
  return page.evaluate(
    ({ treeId, memories, rootId, interaction, treeLabel }) => {
      window.currentTreeData = { id: treeId };
      window.currentTreeMemories = memories;
      document.getElementById('treeBadge').textContent = treeLabel;
      if (window.LoveBudEditorInteractionMode) {
        window.LoveBudEditorInteractionMode.setMode(
          interaction === 'edit'
            ? window.LoveBudEditorInteractionMode.MODE_EDIT
            : window.LoveBudEditorInteractionMode.MODE_VIEW,
          { replace: true, syncUrl: false, forceUrlSync: true }
        );
      }
      const canvas = document.getElementById('canvasArea');
      const editorCanvas = window.createEditorCanvas({
        canvas,
        svg: document.getElementById('svgRoot'),
        getTreeMemories: () => memories,
        getCanonicalRootId: () => rootId,
        isRootMemory: (m, rid) => !m || m.id === rid || m.parentId == null,
        resolveMemoryThumbnail: () => null,
        updateDetailPanel: () => {},
        setDetailEmptyState: () => {},
        updateFocusSelectedBtn: () => {},
        createInitialMemory: () => memories[1],
        onNodeClick: () => {},
        openAddMoment: () => {},
        canEdit: true,
        interactionMode: interaction === 'edit' ? 'edit' : 'view',
        onDisconnectEdge: async () => false,
        onConnectTargetSelect: () => {}
      });
      canvas.__editorCanvasInstance = editorCanvas;
      if (typeof editorCanvas.initCanvas === 'function') editorCanvas.initCanvas();
      document.getElementById('modeBadge').textContent = interaction;
      return {
        canvasFactory: 'window.createEditorCanvas',
        hasSync: typeof editorCanvas.syncInteractionLayoutMode === 'function',
        layoutMode: editorCanvas.viewportState.layoutMode,
        positions: JSON.parse(JSON.stringify(editorCanvas.viewportState.positions || {})),
        nodeCount: canvas.querySelectorAll('.memory-node').length
      };
    },
    { treeId, memories, rootId, interaction: interactionMode, treeLabel: tree }
  );
}

async function snapshot(page, tree) {
  const modeKey = tree === 'B' ? MODE_B : MODE_A;
  const posKey = tree === 'B' ? POS_B : POS_A;
  return page.evaluate(
    ({ modeKey, posKey }) => {
      const inst = document.getElementById('canvasArea').__editorCanvasInstance;
      const vs = inst.viewportState;
      return {
        interactionMode: document.body.getAttribute('data-editor-interaction-mode'),
        layoutMode: vs.layoutMode,
        positions: JSON.parse(JSON.stringify(vs.positions || {})),
        offsetX: vs.offsetX,
        offsetY: vs.offsetY,
        scale: vs.scale,
        modeKey: localStorage.getItem(modeKey),
        layoutRaw: localStorage.getItem(posKey),
        nodeCount: document.querySelectorAll('#canvasArea .memory-node').length,
        canvasCount: document.querySelectorAll('#canvasArea').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        label: (document.getElementById('layoutModeToggleLabel') || {}).textContent || ''
      };
    },
    { modeKey, posKey }
  );
}

async function ensureFree(page) {
  const mode = await page.evaluate(
    () => document.getElementById('canvasArea').__editorCanvasInstance.viewportState.layoutMode
  );
  if (mode !== 'free') {
    await page.locator('#layoutModeToggleBtn').click();
    await page.waitForTimeout(150);
  }
}

async function ensureStructured(page) {
  const mode = await page.evaluate(
    () => document.getElementById('canvasArea').__editorCanvasInstance.viewportState.layoutMode
  );
  if (mode !== 'structured') {
    await page.locator('#layoutModeToggleBtn').click();
    await page.waitForTimeout(150);
  }
}

/**
 * Real mouse drag. FAILS contract if coordinates do not change.
 * Does NOT call persistStoredPositions or mutate viewportState.positions from test code.
 */
async function realMouseDrag(page, memoryId, dx, dy, posKey) {
  const box = await page.evaluate((id) => {
    const node = document.querySelector(`.memory-node[data-memory-id="${id}"]`);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, memoryId);
  assert.ok(box, `drag target node missing: ${memoryId}`);

  const before = await page.evaluate((id) => {
    const inst = document.getElementById('canvasArea').__editorCanvasInstance;
    const p = (inst.viewportState.positions || {})[id];
    return p ? { x: p.x, y: p.y } : null;
  }, memoryId);
  const rawBefore = await page.evaluate((k) => localStorage.getItem(k), posKey);

  // Seed a free position if none (structured-derived first free paint) by a tiny
  // production-path drag that must establish coordinates — still real mouse only.
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + (dx * i) / 12, box.y + (dy * i) / 12, { steps: 2 });
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await page.waitForTimeout(350);

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
  const coordsChanged = !!(established || moved);

  assert.equal(
    coordsChanged,
    true,
    `actual mouse drag must change coordinates for ${memoryId}; before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
  );
  assert.ok(rawAfter, 'localStorage payload must exist after drag');
  assert.notEqual(rawBefore, rawAfter, 'localStorage raw must change after successful drag persist');

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

async function syncMode(page, mode) {
  return page.evaluate((m) => {
    const inst = document.getElementById('canvasArea').__editorCanvasInstance;
    if (window.LoveBudEditorInteractionMode) {
      window.LoveBudEditorInteractionMode.setMode(
        m === 'edit'
          ? window.LoveBudEditorInteractionMode.MODE_EDIT
          : window.LoveBudEditorInteractionMode.MODE_VIEW,
        { replace: true, syncUrl: false, forceUrlSync: true }
      );
    }
    const policy = inst.syncInteractionLayoutMode(m);
    document.getElementById('modeBadge').textContent = m;
    return {
      transitionApi: 'editorCanvas.syncInteractionLayoutMode',
      layoutMode: inst.viewportState.layoutMode,
      positions: JSON.parse(JSON.stringify(inst.viewportState.positions || {})),
      policy
    };
  }, mode);
}

test('#3582 component canvas: drag, fixture route sim, logout stub, tree switch, free↔structured', {
  timeout: 180000
}, async () => {
  ensureEvidence();
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const stepLog = [];
  const log = (s) => stepLog.push(s);

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => log('PAGEERROR ' + String(e).slice(0, 160)));

    // clean keys
    await page.goto(`${base}/fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ keys }) => {
        keys.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'stub-owner' }));
        localStorage.setItem('lovebud_auth_confirmed', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('firebase:authUser:stub', JSON.stringify({ uid: 'stub-owner' }));
      },
      { keys: [MODE_A, POS_A, MODE_B, POS_B] }
    );

    // 1-5 Tree A edit free + drag
    const bootA = await openTree(page, base, 'A', 'edit');
    assert.equal(bootA.canvasFactory, 'window.createEditorCanvas');
    assert.equal(bootA.hasSync, true);
    await ensureFree(page);
    const dragA = await realMouseDrag(page, 'A-one', 140, 90, POS_A);
    log('dragA ' + JSON.stringify(dragA.after));
    await page.screenshot({ path: path.join(EVIDENCE, '01-free-after-drag.png') });
    const afterDrag = await snapshot(page, 'A');
    assert.equal(afterDrag.modeKey, 'free');
    assert.ok(afterDrag.positions['A-one']);
    const savedA = afterDrag.positions['A-one'];
    const rawA = afterDrag.layoutRaw;

    // 12-14 free → structured → free
    await ensureStructured(page);
    const structuredSnap = await snapshot(page, 'A');
    assert.equal(structuredSnap.layoutMode, 'structured');
    assert.equal(structuredSnap.layoutRaw, rawA, 'structured must not overwrite free payload');
    await page.screenshot({ path: path.join(EVIDENCE, '06-structured-mode.png') });
    await ensureFree(page);
    const freeAgain = await snapshot(page, 'A');
    assert.equal(freeAgain.layoutMode, 'free');
    assert.ok(freeAgain.positions['A-one']);
    assert.ok(Math.abs(freeAgain.positions['A-one'].x - savedA.x) < 1);
    assert.ok(Math.abs(freeAgain.positions['A-one'].y - savedA.y) < 1);
    await page.screenshot({ path: path.join(EVIDENCE, '07-free-restored-after-structured.png') });

    const posStable = (await snapshot(page, 'A')).positions;
    const rawStable = (await snapshot(page, 'A')).layoutRaw;

    // 6-9 route exit → appreciation → edit
    await page.click('#linkExit');
    await page.waitForURL(/route-exit/);
    const keysOnExit = await page.evaluate(
      ({ MODE_A, POS_A }) => ({
        mode: localStorage.getItem(MODE_A),
        raw: localStorage.getItem(POS_A)
      }),
      { MODE_A, POS_A }
    );
    assert.equal(keysOnExit.mode, 'free');
    assert.equal(keysOnExit.raw, rawStable);

    await openTree(page, base, 'A', 'view');
    const apprec = await snapshot(page, 'A');
    assert.equal(apprec.layoutMode, 'structured');
    assert.equal(Object.keys(apprec.positions).length, 0);
    assert.equal(apprec.modeKey, 'free', 'appreciation must not rewrite mode key');

    const editRe = await syncMode(page, 'edit');
    assert.equal(editRe.transitionApi, 'editorCanvas.syncInteractionLayoutMode');
    assert.equal(editRe.layoutMode, 'free');
    assert.ok(Math.abs(editRe.positions['A-one'].x - posStable['A-one'].x) < 1);
    await page.screenshot({ path: path.join(EVIDENCE, '02-route-reentry-restored.png') });
    fs.writeFileSync(
      path.join(EVIDENCE, 'route-reentry.json'),
      JSON.stringify({ keysOnExit, apprec, editRe }, null, 2)
    );

    // Component-level re-open (NOT ordinary Editor reload acceptance — see editor-route contract).
    // openTree performs a fresh fixture navigation + createEditorCanvas; do not treat as page.reload proof.
    await openTree(page, base, 'A', 'edit');
    const afterReopen = await snapshot(page, 'A');
    assert.equal(afterReopen.layoutMode, 'free');
    assert.ok(Math.abs(afterReopen.positions['A-one'].x - posStable['A-one'].x) < 1);
    assert.equal(afterReopen.canvasCount, 1);
    assert.equal(afterReopen.overflow, false);
    fs.writeFileSync(
      path.join(EVIDENCE, 'component-reopen-restoration.json'),
      JSON.stringify(
        {
          note: 'component fixture reopen only; canonical reload is in editor-route contract',
          afterReopen
        },
        null,
        2
      )
    );

    // 15-19 logout / same-owner login simulation
    const preLogout = await snapshot(page, 'A');
    await page.evaluate(() => {
      localStorage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'stub-owner' }));
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_token', 'stub-token');
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('firebase:authUser:stub', JSON.stringify({ uid: 'stub-owner' }));
    });
    const logout = await page.evaluate(async () => {
      if (typeof window.__lbSignOut !== 'function') return { ok: false, err: 'no-signout' };
      await window.__lbSignOut();
      return { ok: true, via: '__lbSignOut / production auth boundary' };
    });
    assert.equal(logout.ok, true, JSON.stringify(logout));
    await page.waitForTimeout(200);
    const keysAfterLogout = await page.evaluate(
      ({ MODE_A, POS_A }) => ({
        mode: localStorage.getItem(MODE_A),
        raw: localStorage.getItem(POS_A),
        authCache: localStorage.getItem('lovebud_auth_cache'),
        authConfirmed: localStorage.getItem('lovebud_auth_confirmed'),
        isLoggedIn: localStorage.getItem('isLoggedIn')
      }),
      { MODE_A, POS_A }
    );
    assert.equal(keysAfterLogout.mode, preLogout.modeKey);
    assert.equal(keysAfterLogout.raw, preLogout.layoutRaw);
    assert.equal(keysAfterLogout.authCache, null);
    await page.screenshot({ path: path.join(EVIDENCE, '04-logout-state-keys-preserved.png') });

    // same-owner login simulation
    await page.evaluate(() => {
      localStorage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'stub-owner' }));
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('isLoggedIn', 'true');
    });
    await openTree(page, base, 'A', 'edit');
    const afterLogin = await snapshot(page, 'A');
    assert.equal(afterLogin.layoutMode, 'free');
    assert.ok(Math.abs(afterLogin.positions['A-one'].x - preLogout.positions['A-one'].x) < 1);
    await page.screenshot({ path: path.join(EVIDENCE, '05-login-reentry-restored.png') });
    fs.writeFileSync(
      path.join(EVIDENCE, 'logout-login-restoration.json'),
      JSON.stringify({ preLogout, logout, keysAfterLogout, afterLogin }, null, 2)
    );

    // 20-25 tree A/B isolation with full page navigation
    const aBeforeB = await snapshot(page, 'A');
    await openTree(page, base, 'B', 'edit');
    await ensureFree(page);
    const dragB = await realMouseDrag(page, 'B-one', -110, 70, POS_B);
    const bAfter = await snapshot(page, 'B');
    assert.ok(bAfter.positions['B-one']);
    assert.equal(bAfter.positions['A-one'], undefined);

    await openTree(page, base, 'A', 'edit');
    const aAgain = await snapshot(page, 'A');
    assert.equal(aAgain.layoutMode, 'free');
    assert.ok(Math.abs(aAgain.positions['A-one'].x - aBeforeB.positions['A-one'].x) < 1);
    assert.equal(aAgain.positions['B-one'], undefined);
    await page.screenshot({ path: path.join(EVIDENCE, '08-tree-a-restored.png') });

    await openTree(page, base, 'B', 'edit');
    const bAgain = await snapshot(page, 'B');
    assert.equal(bAgain.layoutMode, 'free');
    assert.ok(Math.abs(bAgain.positions['B-one'].x - bAfter.positions['B-one'].x) < 1);
    assert.equal(bAgain.positions['A-one'], undefined);
    await page.screenshot({ path: path.join(EVIDENCE, '09-tree-b-restored.png') });
    fs.writeFileSync(
      path.join(EVIDENCE, 'tree-switch-isolation.json'),
      JSON.stringify({ aBeforeB, dragB, bAfter, aAgain, bAgain }, null, 2)
    );

    // duplicate sanity
    assert.equal(aAgain.canvasCount, 1);
    assert.equal(aAgain.overflow, false);

    const summary = {
      evidenceClass: 'LOCAL_EVIDENCE',
      productionAcceptance: false,
      canvasFactory: 'window.createEditorCanvas',
      transitionApi: 'editorCanvas.syncInteractionLayoutMode',
      toggleEvent: 'actual click #layoutModeToggleBtn',
      dragMethod: 'page.mouse',
      actualDragCoordsChanged: true,
      storage: 'actual localStorage',
      dragA,
      dragB,
      steps: stepLog
    };
    fs.writeFileSync(path.join(EVIDENCE, 'acceptance-summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(EVIDENCE, 'step-log.txt'), stepLog.join('\n') + '\n');

    await context.close();
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 storage failure matrix via production storage in Chromium', { timeout: 60000 }, async () => {
  ensureEvidence();
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.LoveBudEditorCanvasLayoutStorage === 'object');
    const matrix = await page.evaluate(() => {
      const storage = window.LoveBudEditorCanvasLayoutStorage;
      const key = 'lovebud_tree_layout_v2_failtest';
      const modeKey = 'lovebud_tree_layout_mode_failtest';
      const results = {};
      localStorage.setItem(
        key,
        JSON.stringify({ positions: { keep: { x: 1, y: 2 } }, offsetX: 1, offsetY: 2, scale: 1.2 })
      );
      localStorage.setItem(modeKey, 'free');
      const existing = localStorage.getItem(key);

      localStorage.setItem(key, '{not-json');
      results.malformed = storage.loadStoredLayout('failtest', key, null, false);
      localStorage.setItem(key, 'null');
      results.nullString = storage.loadStoredLayout('failtest', key, null, false);
      localStorage.setItem(key, JSON.stringify({ offsetX: 5 }));
      results.missingPositions = storage.loadStoredLayout('failtest', key, null, false);
      localStorage.setItem(
        key,
        JSON.stringify({ positions: {}, offsetX: 'bad', offsetY: null, scale: 'x' })
      );
      results.badNumbers = storage.loadStoredLayout('failtest', key, null, false);
      localStorage.setItem(modeKey, 'banana');
      results.invalidMode = storage.loadLayoutMode(modeKey, false);

      const origGet = Storage.prototype.getItem;
      Storage.prototype.getItem = function () {
        throw new Error('get boom');
      };
      try {
        results.getThrow = storage.loadStoredLayout('failtest', key, null, false);
        results.getThrowMode = storage.loadLayoutMode(modeKey, false);
      } finally {
        Storage.prototype.getItem = origGet;
      }

      localStorage.setItem(key, existing);
      localStorage.setItem(modeKey, 'free');
      const before = localStorage.getItem(key);
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new Error('set boom');
      };
      try {
        storage.persistLayoutMode('structured', modeKey, true);
        storage.persistStoredPositions(
          {
            layoutMode: 'free',
            positions: { z: { x: 9, y: 9 } },
            offsetX: 0,
            offsetY: 0,
            scale: 1
          },
          'failtest',
          key,
          null,
          true
        );
      } finally {
        Storage.prototype.setItem = origSet;
      }
      results.writeFailPreserves = localStorage.getItem(key) === before;
      results.writeFailModePreserved = localStorage.getItem(modeKey) === 'free';

      localStorage.setItem(
        key,
        JSON.stringify({ positions: { leak: { x: 99, y: 99 } }, offsetX: 9, offsetY: 9, scale: 2 })
      );
      results.readOnly = storage.loadStoredLayout('failtest', key, null, true);
      results.readOnlyMode = storage.loadLayoutMode(modeKey, true);

      localStorage.removeItem(key);
      localStorage.removeItem(modeKey);
      return results;
    });

    assert.equal(matrix.malformed.offsetX, 0);
    assert.equal(Object.keys(matrix.malformed.positions).length, 0);
    assert.equal(matrix.nullString.scale, 1);
    assert.equal(matrix.invalidMode, 'structured');
    assert.equal(matrix.getThrow.offsetX, 0);
    assert.equal(matrix.getThrowMode, 'structured');
    assert.equal(matrix.writeFailPreserves, true);
    assert.equal(matrix.writeFailModePreserved, true);
    assert.equal(matrix.readOnly.offsetX, 0);
    assert.equal(matrix.readOnlyMode, 'structured');
    assert.equal(matrix.badNumbers.offsetX, 0);
    assert.equal(matrix.badNumbers.scale, 1);
    fs.writeFileSync(path.join(EVIDENCE, 'storage-failure-matrix.json'), JSON.stringify(matrix, null, 2));
  } finally {
    server.close();
    await browser.close();
  }
});

test('#3582 mobile appreciation structured-first and edit restore', { timeout: 90000 }, async () => {
  ensureEvidence();
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();

    // Prepare desktop-saved free draft for A in this profile
    await page.goto(`${base}/fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ MODE_A, POS_A }) => {
        localStorage.setItem(MODE_A, 'free');
        localStorage.setItem(
          POS_A,
          JSON.stringify({
            positions: { 'A-one': { x: 220, y: 180 } },
            offsetX: 40,
            offsetY: -20,
            scale: 1.2
          })
        );
      },
      { MODE_A, POS_A }
    );

    await openTree(page, base, 'A', 'view');
    const mobileView = await snapshot(page, 'A');
    assert.equal(mobileView.layoutMode, 'structured');
    assert.equal(Object.keys(mobileView.positions).length, 0);
    assert.equal(mobileView.modeKey, 'free');
    assert.equal(mobileView.overflow, false);

    await openTree(page, base, 'A', 'edit');
    const mobileEdit = await snapshot(page, 'A');
    assert.equal(mobileEdit.layoutMode, 'free');
    assert.ok(mobileEdit.positions['A-one']);
    assert.ok(Math.abs(mobileEdit.positions['A-one'].x - 220) < 1);
    assert.equal(mobileEdit.overflow, false);
    const toggleBox = await page.locator('#layoutModeToggleBtn').boundingBox();
    assert.ok(toggleBox, 'layout toggle must be present');
    assert.ok(toggleBox.y + toggleBox.height <= 812 + 40, 'layout control reachable in viewport');
    await page.screenshot({ path: path.join(EVIDENCE, '10-mobile-owner-edit-restored.png') });
    fs.writeFileSync(
      path.join(EVIDENCE, 'mobile-restoration.json'),
      JSON.stringify({
        mobileView,
        mobileEdit,
        toggleBox,
        note: 'Mobile free drag not claimed as success in this contract; restoration of stored mode/positions asserted only.'
      }, null, 2)
    );

    await context.close();
  } finally {
    server.close();
    await browser.close();
  }
});
