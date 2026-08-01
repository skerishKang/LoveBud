'use strict';

/**
 * Editor floating-toolbar dropdown accessibility contract (Issue #3810, Child 2).
 *
 * Executes the real `pages/editor.html` markup, the real floating-toolbar
 * template, and the real `editor-floating-toolbar-keyboard.js` +
 * `editor-floating-toolbar-dropdown.js` product scripts in Playwright Chromium
 * over a local ephemeral HTTP server with synthetic safe editor fixtures. No
 * Production, Preview, login, or private data; no external network.
 *
 * Proves the confirmed SVG `.click()` Escape defect is corrected (guarded,
 * SVG-safe canvas dispatch with dropdown cleanup and focus restoration
 * independent of the optional dispatch), and that the existing role="menu"
 * dropdown completes its bounded keyboard/ARIA contract.
 *
 * Refs: #3810, #3799, #3672, #1882
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
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
};

const REAL_FILES = [
  'js/editor/templates/editor-floating-toolbar-template.js',
  'js/editor/editor-floating-toolbar-keyboard.js',
  'js/editor/editor-floating-toolbar-dropdown.js',
];

const MENUITEM_IDS = ['ftbBranchBtn', 'ftbForkBtn', 'ftbScoutAction', 'ftbFocusAction', 'ftbShareAction', 'ftbDeleteAction'];

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.normalize(path.join(ROOT, rel));
        if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end('not found'); return; }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) { try { res.writeHead(500); res.end(); } catch (_) {} }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    try { if (typeof server.closeAllConnections === 'function') server.closeAllConnections(); } catch (_) {}
    server.close(() => resolve());
  });
}

function newHealth() {
  return { pageErrors: [], consoleErrors: [], requestFailedSameOrigin: [], httpFailures: [], externalUnexpected: 0 };
}

function collectHealth(page, health) {
  page.on('pageerror', (err) => health.pageErrors.push(String((err && err.message) || err)));
  page.on('console', (msg) => { if (msg.type() === 'error') health.consoleErrors.push(msg.text()); });
  page.on('requestfailed', (req) => {
    let sameOrigin = false;
    try { sameOrigin = new URL(req.url()).hostname === '127.0.0.1'; } catch (_) {}
    if (sameOrigin) health.requestFailedSameOrigin.push(req.url());
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      let sameOrigin = false;
      try { sameOrigin = new URL(resp.url()).hostname === '127.0.0.1'; } catch (_) {}
      if (sameOrigin) health.httpFailures.push(resp.status() + ' ' + resp.url());
    }
  });
}

function installRoutes(page, health, port) {
  return page.route('**/*', async (route) => {
    let parsed;
    try { parsed = new URL(route.request().url()); } catch (_) { await route.abort('failed'); return; }
    const reqPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const sameOrigin = parsed.hostname === '127.0.0.1' && reqPort === String(port);
    if (!sameOrigin) {
      const host = parsed.hostname;
      if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') {
        await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' }); return;
      }
      if (host === 'www.gstatic.com') {
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* inert-firebase */' }); return;
      }
      health.externalUnexpected += 1;
      await route.abort('blockedbyclient'); return;
    }
    const pathname = parsed.pathname;
    if (pathname === '/api/' || pathname.startsWith('/api/')) {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '{}' }); return;
    }
    if (REAL_FILES.some((f) => pathname.endsWith(f)) || pathname.endsWith('.css') || pathname.endsWith('.html') || pathname === '/') {
      await route.continue(); return;
    }
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* inert-editor-fixture */' }); return;
    }
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: '' });
  });
}

async function newPage(context, port) {
  const page = await context.newPage();
  const health = newHealth();
  collectHealth(page, health);
  await page.addInitScript(() => {
    window.t = function (k) { return k; };
    window.LoveBudEditor = { canEdit: true };
  });
  await installRoutes(page, health, port);
  return { page, health };
}

async function setupToolbar(page, port) {
  await page.goto('http://127.0.0.1:' + port + '/pages/editor.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    return !!document.getElementById('editorFloatingToolbar') &&
      !!document.getElementById('ftbMoreBtn') &&
      !!document.getElementById('ftbDropdown') &&
      !!document.querySelector('.canvas-svg');
  }, null, { timeout: 15000 });
  // Wire the real dropdown + keyboard product modules with a synthetic safe ctx.
  await page.evaluate(() => {
    const toolbar = document.getElementById('editorFloatingToolbar');
    const moreBtn = document.getElementById('ftbMoreBtn');
    const dropdown = document.getElementById('ftbDropdown');
    let selectedNode = null;
    const ctx = {
      toolbar: toolbar,
      visibleClass: 'is-visible',
      editBtn: document.getElementById('ftbEditBtn'),
      continueBtn: document.getElementById('ftbContinueBtn'),
      viewBtn: document.getElementById('ftbViewBtn'),
      moreBtn: moreBtn,
      deleteAction: document.getElementById('ftbDeleteAction'),
      getSelectedNode: function () { return selectedNode; },
      hideToolbar: function () {
        toolbar.classList.remove('is-visible');
        toolbar.classList.add('is-hidden');
        toolbar.style.display = 'none';
      },
      dropdown: dropdown,
      selectedClass: 'selected'
    };
    window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown({
      dropdown: dropdown,
      moreBtn: moreBtn,
      deleteAction: document.getElementById('ftbDeleteAction'),
      shareAction: document.getElementById('ftbShareAction'),
      focusAction: document.getElementById('ftbFocusAction'),
      scoutAction: document.getElementById('ftbScoutAction'),
      selectedNode: function () { return selectedNode; }
    });
    window.LoveBudFloatingToolbarKeyboard.bind(ctx);
    window.__ftbTest = {
      ctx: ctx,
      setSelectedNode: function (el) { selectedNode = el; },
      selectedNode: function () { return selectedNode; }
    };
  });
  await showToolbar(page);
}

// Pin the floating toolbar into the viewport (the controller is inert in this
// harness). The product CSS hides the toolbar below 480px via a real
// `!important` override, so the same override is required to exercise the
// toolbar contract on the mobile contexts.
async function showToolbar(page) {
  await page.evaluate(() => {
    const toolbar = document.getElementById('editorFloatingToolbar');
    toolbar.classList.remove('is-hidden');
    toolbar.classList.add('is-visible');
    toolbar.style.setProperty('display', 'flex', 'important');
    toolbar.style.position = 'fixed';
    toolbar.style.top = '10px';
    toolbar.style.left = '8px';
    toolbar.style.zIndex = '9999';
    toolbar.style.maxWidth = 'calc(100vw - 16px)';
    const moreBtn = document.getElementById('ftbMoreBtn');
    if (moreBtn) moreBtn.style.visibility = 'visible';
  });
}

function menuState(page) {
  return page.evaluate(() => {
    const dropdown = document.getElementById('ftbDropdown');
    const moreBtn = document.getElementById('ftbMoreBtn');
    const active = document.activeElement;
    const inDropdown = !!active && dropdown.contains(active);
    const navigable = Array.from(dropdown.querySelectorAll('.editor-ftb-dropdown-item')).filter((item) => {
      if (item.hasAttribute('hidden')) return false;
      if (item.getAttribute('aria-hidden') === 'true') return false;
      if (item.disabled === true) return false;
      if (item.getAttribute('aria-disabled') === 'true') return false;
      if (item.style.display === 'none') return false;
      return true;
    });
    return {
      open: dropdown.classList.contains('is-visible'),
      ariaExpanded: moreBtn.getAttribute('aria-expanded'),
      activeId: active ? active.id : '',
      activeInDropdown: inDropdown,
      navigableIds: navigable.map((n) => n.id)
    };
  });
}

function assertHealth(health, label) {
  assert.deepEqual(health.pageErrors, [], label + ': pageerror 0');
  assert.deepEqual(health.consoleErrors, [], label + ': console error 0');
  assert.deepEqual(health.requestFailedSameOrigin, [], label + ': same-origin requestfailed 0');
  assert.deepEqual(health.httpFailures, [], label + ': same-origin HTTP >=400 0');
  assert.equal(health.externalUnexpected, 0, label + ': unexpected external network 0');
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, label + ': horizontal overflow <=1px (got ' + overflow + ')');
}

// Real mouse click path (detail 1) dispatched directly on the target so the
// harness never depends on Playwright actionability visibility of the toolbar.
function dispatchClick(page, id, detail) {
  return page.evaluate(function (args) {
    var el = document.getElementById(args.id);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: args.detail
    }));
    return true;
  }, { id: id, detail: detail == null ? 1 : detail });
}

async function openMouse(page) {
  await showToolbar(page);
  await dispatchClick(page, 'ftbMoreBtn', 1);
  await page.waitForFunction(() => document.getElementById('ftbDropdown').classList.contains('is-visible'), null, { timeout: 5000 });
}

async function closeIfOpen(page) {
  const st = await menuState(page);
  if (st.open) {
    // Move focus to the trigger so the Escape keydown reaches the toolbar
    // handler even after a mouse open left focus on the document body.
    await page.evaluate(() => document.getElementById('ftbMoreBtn').focus());
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('ftbDropdown').classList.contains('is-visible'), null, { timeout: 5000 });
  }
}

// ── S1. SVG click defect correction ─────────────────────────────────────────

test('S1 Escape over SVG canvas never throws and closes the dropdown', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // Confirm the SVG canvas has no callable .click (the confirmed defect env).
    const svgClick = await page.evaluate(() => ({
      svgExists: !!document.querySelector('.canvas-svg'),
      clickCallable: typeof document.querySelector('.canvas-svg').click === 'function'
    }));
    assert.equal(svgClick.svgExists, true, '.canvas-svg exists');
    assert.equal(svgClick.clickCallable, false, 'canvasSvg.click is not callable (SVG)');

    // Toolbar-owned Escape: focus a toolbar button with the dropdown open, then
    // Escape. The toolbar handler runs the guarded SVG-safe dispatch.
    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbEditBtn').focus());
    await page.keyboard.press('Escape');
    let st = await menuState(page);
    assert.equal(st.open, false, 'toolbar Escape closes the dropdown');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded false after toolbar Escape');

    // Menu-focused Escape: open again, focus a menuitem, Escape.
    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('Escape');
    st = await menuState(page);
    assert.equal(st.open, false, 'menu Escape closes the dropdown');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded false after menu Escape');
    assert.equal(st.activeId, 'ftbMoreBtn', 'focus restored to trigger after menu Escape');

    assertHealth(health, 'S1');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S2. Toolbar-owned cleanup (no reliance on a document click handler) ─────

test('S2 Escape closes the dropdown without relying on a document click handler', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // A distinct document click fixture that would NOT close the dropdown; if
    // the dropdown were closed by a synthesized click, this counter would fire.
    // Only clicks that occur while the dropdown is still visible count, so the
    // fixture ignores the open-click and the post-close canvas deselection
    // dispatch while still catching any click that closed the menu.
    await page.evaluate(() => {
      window.__outsideClickCounter = 0;
      document.addEventListener('click', function () {
        var dd = document.getElementById('ftbDropdown');
        if (dd && dd.classList.contains('is-visible')) {
          window.__outsideClickCounter += 1;
        }
      }, true);
    });

    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('Escape');
    const st = await menuState(page);
    assert.equal(st.open, false, 'Escape closes the dropdown via the toolbar/menu handler');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded false');
    const clicks = await page.evaluate(() => window.__outsideClickCounter);
    assert.equal(clicks, 0, 'no document click was used to close the dropdown');

    assertHealth(health, 'S2');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S3. Trigger ARIA synchronization ────────────────────────────────────────

test('S3 trigger aria-haspopup/aria-controls and aria-expanded synchronization', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    const initial = await page.evaluate(() => {
      const b = document.getElementById('ftbMoreBtn');
      return { haspopup: b.getAttribute('aria-haspopup'), controls: b.getAttribute('aria-controls'), expanded: b.getAttribute('aria-expanded') };
    });
    assert.equal(initial.haspopup, 'menu', 'aria-haspopup=menu');
    assert.equal(initial.controls, 'ftbDropdown', 'aria-controls=ftbDropdown');
    assert.equal(initial.expanded, 'false', 'closed -> aria-expanded=false');

    await openMouse(page);
    assert.equal((await menuState(page)).ariaExpanded, 'true', 'open -> aria-expanded=true');
    // Focus a toolbar button so the Escape keydown reaches the toolbar handler.
    await page.evaluate(() => document.getElementById('ftbEditBtn').focus());
    await page.keyboard.press('Escape');
    assert.equal((await menuState(page)).ariaExpanded, 'false', 'close -> aria-expanded=false');

    assertHealth(health, 'S3');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S4. Keyboard open moves focus to the first navigable menuitem ──────────

test('S4 keyboard open focuses the first visible enabled menuitem', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await page.evaluate(() => document.getElementById('ftbMoreBtn').focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('ftbDropdown').classList.contains('is-visible'), null, { timeout: 5000 });
    const st = await menuState(page);
    assert.equal(st.ariaExpanded, 'true', 'keyboard open -> aria-expanded=true');
    assert.equal(st.activeInDropdown, true, 'focus moved inside the dropdown');
    assert.equal(st.activeId, 'ftbBranchBtn', 'first visible enabled menuitem focused (Fork hidden)');

    await closeIfOpen(page);
    assertHealth(health, 'S4');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S5. Arrow navigation with wrap ─────────────────────────────────────────

test('S5 ArrowDown/ArrowUp wrap among visible enabled items', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    // ArrowDown: branch -> scout (fork hidden) -> focus -> share -> delete -> wrap to branch.
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbScoutAction', 'ArrowDown branch -> scout (Fork skipped)');
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbFocusAction', 'ArrowDown scout -> focus');
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbShareAction', 'ArrowDown focus -> share');
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbDeleteAction', 'ArrowDown share -> delete');
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbBranchBtn', 'ArrowDown delete -> wrap to branch');
    // ArrowUp: branch -> delete (wrap backward from first).
    await page.keyboard.press('ArrowUp');
    assert.equal((await menuState(page)).activeId, 'ftbDeleteAction', 'ArrowUp branch -> wrap to delete');

    await closeIfOpen(page);
    assertHealth(health, 'S5');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S6. Home / End ─────────────────────────────────────────────────────────

test('S6 Home/End move to first/last visible enabled item', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbShareAction').focus());
    await page.keyboard.press('Home');
    assert.equal((await menuState(page)).activeId, 'ftbBranchBtn', 'Home -> first visible enabled item');
    await page.keyboard.press('End');
    assert.equal((await menuState(page)).activeId, 'ftbDeleteAction', 'End -> last visible enabled item');

    await closeIfOpen(page);
    assertHealth(health, 'S6');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S7. Escape close + focus restore ───────────────────────────────────────

test('S7 Escape closes and restores focus to the trigger', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbFocusAction').focus());
    await page.keyboard.press('Escape');
    const st = await menuState(page);
    assert.equal(st.open, false, 'Escape closes the menu');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded=false');
    assert.equal(st.activeId, 'ftbMoreBtn', 'focus restored to #ftbMoreBtn');

    assertHealth(health, 'S7');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S8. Tab / Shift+Tab close without trap ─────────────────────────────────

test('S8 Tab/Shift+Tab close the menu without trapping or restoring focus', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // Tab forward.
    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('Tab');
    let st = await menuState(page);
    assert.equal(st.open, false, 'Tab closes the menu');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded=false after Tab');
    assert.equal(st.activeInDropdown, false, 'focus is not trapped in the menu after Tab');

    // Shift+Tab backward.
    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('Shift+Tab');
    st = await menuState(page);
    assert.equal(st.open, false, 'Shift+Tab closes the menu');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded=false after Shift+Tab');
    assert.equal(st.activeInDropdown, false, 'focus is not trapped in the menu after Shift+Tab');

    assertHealth(health, 'S8');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S9. Outside click closes without stealing focus ────────────────────────

test('S9 outside click closes without forcing trigger focus', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await openMouse(page);
    // Click an outside target (the canvas SVG) with a real mouse click.
    await page.mouse.click(120, 300);
    const st = await menuState(page);
    assert.equal(st.open, false, 'outside click closes the menu');
    assert.equal(st.ariaExpanded, 'false', 'aria-expanded=false after outside click');
    // Focus must not be force-returned to the trigger.
    assert.notEqual(st.activeId, 'ftbMoreBtn', 'outside click does not force trigger focus');

    assertHealth(health, 'S9');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S10. Hidden item exclusion ─────────────────────────────────────────────

test('S10 hidden Fork item is excluded from navigation', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    await openMouse(page);
    const nav = await menuState(page);
    assert.ok(!nav.navigableIds.includes('ftbForkBtn'), 'Fork hidden item excluded from navigable set');
    assert.ok(nav.navigableIds.includes('ftbBranchBtn'), 'Branch visible item navigable');
    assert.ok(nav.navigableIds.includes('ftbDeleteAction'), 'Delete visible item navigable');

    await closeIfOpen(page);
    assertHealth(health, 'S10');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S11. Disabled item exclusion ───────────────────────────────────────────

test('S11 disabled / aria-disabled items are excluded from navigation', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // Introduce a disabled menuitem between branch and scout.
    await page.evaluate(() => {
      const scout = document.getElementById('ftbScoutAction');
      const probe = document.createElement('button');
      probe.type = 'button';
      probe.id = 'ftbDisabledProbe';
      probe.className = 'editor-ftb-dropdown-item';
      probe.setAttribute('role', 'menuitem');
      probe.disabled = true;
      probe.textContent = 'disabled probe';
      scout.parentNode.insertBefore(probe, scout);
    });

    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbScoutAction', 'ArrowDown skips the disabled item');
    await page.keyboard.press('ArrowUp');
    assert.equal((await menuState(page)).activeId, 'ftbBranchBtn', 'ArrowUp wraps back over the disabled item');

    await closeIfOpen(page);
    assertHealth(health, 'S11');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S12. Listener idempotence ──────────────────────────────────────────────

test('S12 repeated init/open/close never duplicates listeners or actions', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // Re-bind the real modules three times (same elements).
    await page.evaluate(() => {
      const moreBtn = document.getElementById('ftbMoreBtn');
      const dropdown = document.getElementById('ftbDropdown');
      window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown({
        dropdown: dropdown, moreBtn: moreBtn,
        deleteAction: document.getElementById('ftbDeleteAction'),
        shareAction: document.getElementById('ftbShareAction'),
        focusAction: document.getElementById('ftbFocusAction'),
        scoutAction: document.getElementById('ftbScoutAction'),
        selectedNode: function () { return null; }
      });
      window.LoveBudFloatingToolbarKeyboard.bind({
        toolbar: document.getElementById('editorFloatingToolbar'),
        visibleClass: 'is-visible',
        editBtn: document.getElementById('ftbEditBtn'),
        continueBtn: document.getElementById('ftbContinueBtn'),
        viewBtn: document.getElementById('ftbViewBtn'),
        moreBtn: moreBtn,
        deleteAction: document.getElementById('ftbDeleteAction'),
        getSelectedNode: function () { return null; },
        hideToolbar: function () {},
        dropdown: dropdown,
        selectedClass: 'selected'
      });
      window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown({
        dropdown: dropdown, moreBtn: moreBtn,
        deleteAction: document.getElementById('ftbDeleteAction'),
        shareAction: document.getElementById('ftbShareAction'),
        focusAction: document.getElementById('ftbFocusAction'),
        scoutAction: document.getElementById('ftbScoutAction'),
        selectedNode: function () { return null; }
      });
    });

    // Open/close three times; each Escape closes exactly once.
    for (let i = 0; i < 3; i++) {
      await openMouse(page);
      assert.equal((await menuState(page)).open, true, 'open cycle ' + i);
      await page.evaluate(() => document.getElementById('ftbFocusAction').focus());
      await page.keyboard.press('Escape');
      assert.equal((await menuState(page)).open, false, 'close cycle ' + i);
    }

    // A single ArrowDown key moves exactly one item (no duplicate handling).
    await openMouse(page);
    await page.evaluate(() => document.getElementById('ftbBranchBtn').focus());
    await page.keyboard.press('ArrowDown');
    assert.equal((await menuState(page)).activeId, 'ftbScoutAction', 'one key press moves exactly one item');

    await closeIfOpen(page);
    assertHealth(health, 'S12');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S13. Existing mouse action dispatch compatibility ──────────────────────

test('S13 mouse activation and Delete/Share/Focus action dispatch remain compatible', async () => {
  const browser = await chromium.launch();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, health } = await newPage(context, port);
    await setupToolbar(page, port);

    // Instrument the action paths: Delete/Share/Focus click dispatch.
    await page.evaluate(() => {
      window.__dispatches = [];
      ['ftbDeleteAction', 'ftbShareAction', 'ftbFocusAction'].forEach((id) => {
        document.getElementById(id).addEventListener('click', function () {
          window.__dispatches.push(id);
        });
      });
    });

    // Mouse open (detail > 0) must NOT move focus into the menu (existing behavior).
    await openMouse(page);
    const st = await menuState(page);
    assert.equal(st.open, true, 'mouse open works');
    assert.equal(st.activeInDropdown, false, 'mouse open does not force focus into the menu');

    // Click the Delete action: it dispatches + closes the dropdown.
    await dispatchClick(page, 'ftbDeleteAction', 1);
    assert.equal((await menuState(page)).open, false, 'action click closes the dropdown');
    const dispatched = await page.evaluate(() => window.__dispatches);
    assert.ok(dispatched.includes('ftbDeleteAction'), 'Delete action dispatched');

    // Share action.
    await openMouse(page);
    await dispatchClick(page, 'ftbShareAction', 1);
    assert.equal((await menuState(page)).open, false, 'share click closes');
    const dispatched2 = await page.evaluate(() => window.__dispatches);
    assert.ok(dispatched2.includes('ftbShareAction'), 'Share action dispatched');

    // Focus action.
    await openMouse(page);
    await dispatchClick(page, 'ftbFocusAction', 1);
    assert.equal((await menuState(page)).open, false, 'focus click closes');
    const dispatched3 = await page.evaluate(() => window.__dispatches);
    assert.ok(dispatched3.includes('ftbFocusAction'), 'Focus action dispatched');

    assertHealth(health, 'S13');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

// ── S14. Responsive + reduced-motion health ────────────────────────────────

for (const ctxName of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
  { name: 'desktop reduced', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
  { name: 'mobile reduced', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
]) {
  test('S14 ' + ctxName.name + ' — toolbar + dropdown health and no overflow', async () => {
    const browser = await chromium.launch();
    const { server, port } = await startServer();
    try {
      const context = await browser.newContext({
        viewport: ctxName.viewport,
        reducedMotion: ctxName.reducedMotion,
        isMobile: ctxName.viewport.width < 768,
        hasTouch: ctxName.viewport.width < 768,
      });
      const { page, health } = await newPage(context, port);
      await setupToolbar(page, port);

      await openMouse(page);
      await page.evaluate(() => document.getElementById('ftbFocusAction').focus());
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
      await page.keyboard.press('Escape');

      const st = await menuState(page);
      assert.equal(st.open, false, ctxName.name + ': dropdown closed after Escape');
      assertHealth(health, 'S14/' + ctxName.name);
      await assertNoOverflow(page, 'S14/' + ctxName.name);
      await context.close();
    } finally {
      await browser.close();
      await closeServer(server);
    }
  });
}

// ── Source-static locks ─────────────────────────────────────────────────────

test('source: template trigger ARIA + keyboard SVG-safe dispatch + dropdown contract markers', () => {
  const template = fs.readFileSync(path.join(ROOT, 'js/editor/templates/editor-floating-toolbar-template.js'), 'utf8');
  const keyboard = fs.readFileSync(path.join(ROOT, 'js/editor/editor-floating-toolbar-keyboard.js'), 'utf8');
  const dropdown = fs.readFileSync(path.join(ROOT, 'js/editor/editor-floating-toolbar-dropdown.js'), 'utf8');

  assert.ok(template.includes('aria-haspopup="menu"'), 'template trigger aria-haspopup=menu');
  assert.ok(template.includes('aria-controls="ftbDropdown"'), 'template trigger aria-controls');
  assert.ok(template.includes('aria-expanded="false"'), 'template trigger aria-expanded=false initial');

  assert.ok(!/emptySpot\.click\(\)/.test(keyboard), 'keyboard module never calls a direct SVG .click()');
  assert.ok(keyboard.includes("dispatchEvent(new MouseEvent('click',"), 'keyboard uses SVG-safe dispatchEvent');
  assert.ok(keyboard.includes('window.LoveBudFloatingToolbarDropdown.hide'), 'keyboard explicitly hides the dropdown');
  assert.ok(keyboard.includes('moreButton.focus()'), 'keyboard restores trigger focus');
  assert.ok(keyboard.includes('typeof emptySpot.dispatchEvent === \'function\''), 'canvas dispatch is guarded');

  assert.ok(dropdown.includes('handleDropdownKeydown'), 'dropdown module has a keydown contract handler');
  assert.ok(dropdown.includes('getNavigableItems'), 'dropdown module filters navigable items');
  assert.ok(dropdown.includes('isNavigableItem'), 'dropdown module excludes hidden/disabled items');
  assert.ok(dropdown.includes('new WeakSet'), 'dropdown module has an idempotence guard');
  assert.ok(dropdown.includes('e.detail === 0'), 'dropdown module distinguishes keyboard open');
  assert.ok(dropdown.includes("e.key === 'Tab'"), 'dropdown module handles Tab without trap');
  assert.ok(dropdown.includes("e.key === 'Escape'"), 'dropdown module handles menu Escape');
});
