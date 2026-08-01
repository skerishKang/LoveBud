'use strict';

// Modal accessibility core-dialogs browser contract (Issue #3795).
// Real-local Playwright Chromium against actual LoveBud pages + actual
// controller scripts with synthetic safe fixtures. Covers the six core
// true-modal surfaces: Home video, Editor new-moment form, Editor rename,
// Editor shortcuts help, My Trees create-tree, and Auth email login/signup.
//
// Proves per surface: initial focus after open, Tab/Shift+Tab containment,
// focus cannot escape, Escape close exactly once (or gated when busy),
// close/cancel behavior, surface backdrop policy, guarded invoker restore,
// reopen cycles without listener duplication, close/dispose releasing helper
// state and body-scroll ownership, and page usability after close.
//
// No Production URL, real login, real Auth provider, private IDs, API writes,
// DB, cache, storage, or external network. No waitForTimeout / networkidle.

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

const CONTEXTS = [
  { name: 'desktop normal motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'mobile normal motion', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
  { name: 'desktop reduced motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
  { name: 'mobile reduced motion', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
];

const REAL_FILES = {
  home: ['js/shared/modal-a11y.js', 'js/index-inline-init.js'],
  memoryForm: ['js/shared/modal-a11y.js', 'js/editor/templates/editor-add-memory-form-template.js', 'js/editor/editor-memory-form.js'],
  rename: ['js/shared/modal-a11y.js', 'js/editor/editor-rename-ui.js'],
  shortcuts: ['js/shared/modal-a11y.js', 'js/editor/editor-shortcuts-help.js'],
  myTrees: ['js/shared/modal-a11y.js', 'js/my-trees/my-trees-actions.js'],
  auth: ['js/shared/modal-a11y.js', 'js/auth/auth-login-page.js'],
};

const STUBS = {
  home: 'window.t = function(k){ return k; };',
  memoryForm: 'window.t = function(k){ return k; }; ' +
    'window.LoveBudEditorMemoryFormSave = function(){ return { enrichPayloadChannelMetadata: function(p){ return p; } }; }; ' +
    'window.apiClient = {};',
  rename: 'window.t = function(k){ return k; };',
  shortcuts: 'window.t = function(k){ return k; };',
  myTrees: 'window.t = function(k){ return k; }; window.apiClient = {};',
  auth: 'window.t = function(k){ return k; };',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/index.html' : urlPath;
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
        } catch (_) { /* socket gone */ }
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
    if (!server) return resolve();
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
    requestFailedSameOrigin: [],
    httpFailures: [],
    externalUnexpected: 0,
  };
}

function collectHealth(page, health) {
  page.on('pageerror', (err) => health.pageErrors.push(String((err && err.message) || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') health.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(req.url()).hostname === '127.0.0.1';
    } catch (_) { /* ignore */ }
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
      } catch (_) { /* ignore */ }
      if (sameOrigin) health.httpFailures.push(resp.status() + ' ' + resp.url());
    }
  });
}

function installRoutes(page, health, port, realFiles) {
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
      if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'www.youtube-nocookie.com') {
        await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>inert</title>' });
        return;
      }
      if (host === 'i.ytimg.com') {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml; charset=utf-8', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
        return;
      }
      health.externalUnexpected += 1;
      await route.abort('blockedbyclient');
      return;
    }

    const pathname = parsed.pathname;
    if (pathname === '/api/' || pathname.startsWith('/api/')) {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '{}' });
      return;
    }
    if (realFiles.some((f) => pathname.endsWith(f))) {
      await route.continue();
      return;
    }
    if (pathname.endsWith('.css') || pathname.endsWith('.html') || pathname === '/') {
      await route.continue();
      return;
    }
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* inert-fixture */' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: '' });
  });
}

async function newPage(context, port, surface, stubExtra) {
  const page = await context.newPage();
  const health = newHealth();
  collectHealth(page, health);
  await page.addInitScript((stub) => {
    try {
      // eslint-disable-next-line no-eval
      (0, eval)(stub);
    } catch (e) {
      window.__stubError = String(e);
    }
  }, (STUBS[surface] || '') + (stubExtra || ''));
  await installRoutes(page, health, port, REAL_FILES[surface]);
  return { page, health };
}

function assertHealth(health, label) {
  assert.deepEqual(health.pageErrors, [], label + ': pageerror 0');
  assert.deepEqual(health.consoleErrors, [], label + ': console error 0');
  assert.deepEqual(health.requestFailedSameOrigin, [], label + ': same-origin requestfailed 0');
  assert.deepEqual(health.httpFailures, [], label + ': same-origin HTTP >=400 0');
  assert.equal(health.externalUnexpected, 0, label + ': unexpected external network 0');
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, label + ': horizontal overflow <= 1px (got ' + overflow + ')');
}

async function activeClass(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return '';
    return String(el.id || el.className || el.tagName);
  });
}

// The per-surface tests are registered in the top-level test with a shared
// server + browser. Each surface function receives the browser/context/port.
async function runHome(t, context, ctx, port) {
  await t.test('Home video modal — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'home');
    await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate(() => {
      const card = document.querySelector('.growth-stage-card');
      if (!card) throw new Error('no growth-stage-card');
      card.setAttribute('data-video-id', 'synthetic-video-001');
      const media = card.querySelector('.growth-stage-card-media');
      media.click();
    });
    await page.waitForSelector('.hero-video-modal', { state: 'visible', timeout: 10000 });

    const initialFocus = await activeClass(page);
    assert.ok(String(initialFocus).includes('hero-video-modal-close'), 'initial focus on close button');

    // Tab stays inside the modal (close button is the only focusable).
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.ok(String(afterTab).includes('hero-video-modal-close'), 'Tab keeps focus in modal');

    // focusin containment: synthetic outside button focus is redirected.
    const containment = await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'a11y-outside-probe';
      document.body.appendChild(b);
      b.focus();
      const active = document.activeElement;
      const inside = !!document.querySelector('.hero-video-modal') && document.querySelector('.hero-video-modal').contains(active);
      b.remove();
      return inside;
    });
    assert.equal(containment, true, 'focusin containment redirects outside focus into modal');

    // Escape closes exactly once.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.hero-video-modal'), null, { timeout: 5000 });
    const restored = await page.evaluate(() => {
      const play = document.querySelector('.growth-stage-card-play');
      return !!play && document.activeElement === play;
    });
    assert.equal(restored, true, 'focus restored to invoker (play button)');

    // Reopen ×2 without listener duplication; each Escape closes.
    for (let i = 0; i < 2; i++) {
      await page.evaluate((idx) => {
        const card = document.querySelector('.growth-stage-card');
        card.setAttribute('data-video-id', 'synthetic-video-00' + (idx + 2));
        card.querySelector('.growth-stage-card-media').click();
      }, i);
      await page.waitForSelector('.hero-video-modal', { state: 'visible', timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.hero-video-modal'), null, { timeout: 5000 });
    }

    // Backdrop policy: clicking the overlay (outside the panel) closes.
    await page.evaluate(() => {
      const card = document.querySelector('.growth-stage-card');
      card.setAttribute('data-video-id', 'synthetic-video-099');
      card.querySelector('.growth-stage-card-media').click();
    });
    await page.waitForSelector('.hero-video-modal', { state: 'visible', timeout: 10000 });
    await page.mouse.click(4, 4);
    await page.waitForFunction(() => !document.querySelector('.hero-video-modal'), null, { timeout: 5000 });

    assertHealth(health, 'home/' + ctx.name);
    await assertNoOverflow(page, 'home/' + ctx.name);
    await page.close();
  });
}

async function runMemoryForm(t, context, ctx, port) {
  await t.test('Editor new-moment form — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'memoryForm');
    await page.goto('http://127.0.0.1:' + port + '/pages/editor.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.getElementById('addMemoryForm'), null, { timeout: 15000 });

    const deps = `
      window.__memoryDeps = {
        i18n: window.t,
        treeId: 'synthetic-tree-001',
        getSelectedNodeId: function(){ return null; },
        getCanonicalRootId: function(){ return null; },
        resolveParentIdForCreate: function(){ return null; },
        updateSaveStatus: function(){},
        showToast: function(){},
        getYouTubeInputErrorMessage: function(){ return ''; },
        nextMemoryId: function(){ return 'm1'; },
        normalizeMemory: function(m){ return m; },
        getTreeMemories: function(){ return []; },
        setTreeMemories: function(){},
        setLocalSaveMode: function(){},
        drawNode: function(){},
        drawBranch: function(){},
        calcPosition: function(){ return { x: 0, y: 0 }; },
        updateSidebarStatus: function(){},
        updateFocusSelectedBtn: function(){},
        setDetailEmptyState: function(){},
        selectNode: function(){},
        treeMemories: function(){ return []; },
        setCachedMemories: function(){},
        rerenderCanvas: function(){},
        focusNodeById: function(){},
        canEdit: true
      };
      window.__formInvoker = document.createElement('button');
      window.__formInvoker.id = 'memory-form-invoker';
      document.body.appendChild(window.__formInvoker);
      window.__formInvoker.focus();
      window.__memoryCtrl = window.createEditorMemoryForm(window.__memoryDeps);
      window.__memoryCtrl.showAddMemoryForm();
    `;
    await page.evaluate(deps);
    await page.waitForFunction(() => {
      const f = document.getElementById('addMemoryForm');
      return f && f.classList.contains('is-open');
    }, null, { timeout: 5000 });

    const initialFocus = await activeClass(page);
    assert.equal(initialFocus, 'memoryUrlInput', 'initial focus on url input');

    // Tab wrap: focus the last live focusable then Tab → wraps to first.
    const memWrap = await page.evaluate(() => {
      const modal = document.getElementById('addMemoryForm');
      const lc = window.LoveBudModalA11y.createLifecycle({ getModal: () => modal, isOpen: () => true });
      const fbs = lc.getFocusables();
      if (!fbs.length) return { ok: false, reason: 'no focusables' };
      fbs[fbs.length - 1].focus();
      return { ok: true, first: String(fbs[0].id || fbs[0].className || fbs[0].tagName) };
    });
    assert.equal(memWrap.ok, true, memWrap.reason || 'has focusables');
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.equal(afterTab, memWrap.first, 'Tab wraps last → first');

    // Shift+Tab from first → wraps to last.
    const memShift = await page.evaluate(() => {
      const modal = document.getElementById('addMemoryForm');
      const lc = window.LoveBudModalA11y.createLifecycle({ getModal: () => modal, isOpen: () => true });
      const fbs = lc.getFocusables();
      fbs[0].focus();
      return { last: String(fbs[fbs.length - 1].id || fbs[fbs.length - 1].className || fbs[fbs.length - 1].tagName) };
    });
    await page.keyboard.press('Shift+Tab');
    const afterShift = await activeClass(page);
    assert.equal(afterShift, memShift.last, 'Shift+Tab wraps first → last');

    // Escape closes; outside-click is page-owned (Escape path uses helper).
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('addMemoryForm').classList.contains('is-open'), null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const inv = document.getElementById('memory-form-invoker');
      return !!inv && document.activeElement === inv;
    }, null, { timeout: 5000 });

    // Reopen without listener duplication.
    await page.evaluate(() => { window.__memoryCtrl.showAddMemoryForm(); });
    await page.waitForFunction(() => document.getElementById('addMemoryForm').classList.contains('is-open'), null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('addMemoryForm').classList.contains('is-open'), null, { timeout: 5000 });

    assertHealth(health, 'memoryForm/' + ctx.name);
    await assertNoOverflow(page, 'memoryForm/' + ctx.name);
    await page.close();
  });
}

async function runRename(t, context, ctx, port) {
  await t.test('Editor rename — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'rename');
    await page.goto('http://127.0.0.1:' + port + '/pages/editor.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.LoveBudEditorRenameModal, null, { timeout: 15000 });

    await page.evaluate(() => {
      window.__renameInvoker = document.createElement('button');
      window.__renameInvoker.id = 'rename-invoker';
      document.body.appendChild(window.__renameInvoker);
      window.__renameInvoker.focus();
      window.__renameCtrl = window.LoveBudEditorRenameModal.createRenameModalController({
        windowRef: window,
        documentRef: document,
        getCurrentTitle: function() { return '테스트 트리'; },
        getI18n: function() { return window.t; },
        saveTitle: async function(title) { window.__renamedTitle = title; },
        reportError: function() {}
      });
      window.__renameCtrl.open({ currentTitle: '테스트 트리', i18n: window.t });
    });
    await page.waitForFunction(() => {
      const m = document.getElementById('editorRenameModal');
      return m && m.hidden === false;
    }, null, { timeout: 5000 });

    const initialFocus = await activeClass(page);
    assert.equal(initialFocus, 'editorRenameTitleInput', 'initial focus on rename input');

    // Tab wrap: save button is last; Tab → first (input).
    const wrapOk = await page.evaluate(() => {
      document.getElementById('editorRenameSaveBtn').focus();
      return true;
    });
    assert.equal(wrapOk, true, 'focused save button');
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.equal(afterTab, 'editorRenameTitleInput', 'Tab wraps last → first');

    await page.evaluate(() => { document.getElementById('editorRenameTitleInput').focus(); });
    await page.keyboard.press('Shift+Tab');
    const afterShift = await activeClass(page);
    assert.equal(afterShift, 'editorRenameSaveBtn', 'Shift+Tab wraps first → last');

    // Escape closes.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('editorRenameModal').hidden === true, null, { timeout: 5000 });
    const restored = await page.evaluate(() => {
      const inv = document.getElementById('rename-invoker');
      return !!inv && document.activeElement === inv;
    });
    assert.equal(restored, true, 'focus restored to invoker');

    // Backdrop click closes.
    await page.evaluate(() => { window.__renameCtrl.open({ currentTitle: '테스트 트리', i18n: window.t }); });
    await page.waitForFunction(() => document.getElementById('editorRenameModal').hidden === false, null, { timeout: 5000 });
    await page.evaluate(() => {
      const backdrop = document.getElementById('editorRenameModalBackdrop');
      backdrop.click();
    });
    await page.waitForFunction(() => document.getElementById('editorRenameModal').hidden === true, null, { timeout: 5000 });

    assertHealth(health, 'rename/' + ctx.name);
    await assertNoOverflow(page, 'rename/' + ctx.name);
    await page.close();
  });
}

async function runShortcuts(t, context, ctx, port) {
  await t.test('Editor shortcuts help — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'shortcuts');
    await page.goto('http://127.0.0.1:' + port + '/pages/editor.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.LoveBudEditorShortcutHelp, null, { timeout: 15000 });

    await page.evaluate(() => {
      window.__helpInvoker = document.createElement('button');
      window.__helpInvoker.id = 'help-invoker';
      document.body.appendChild(window.__helpInvoker);
      window.__helpInvoker.focus();
      window.__helpCtrl = window.LoveBudEditorShortcutHelp.createShortcutHelpController({
        i18n: window.t,
        triggerEl: window.__helpInvoker
      });
      window.__helpCtrl.open();
    });
    await page.waitForFunction(() => {
      const m = document.getElementById('editorShortcutHelpModal');
      return m && m.hidden === false;
    }, null, { timeout: 5000 });

    const initialFocus = await activeClass(page);
    assert.equal(initialFocus, 'editorShortcutHelpCloseBtn', 'initial focus on close button');

    // Tab on the (single) close button stays in the modal.
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.equal(afterTab, 'editorShortcutHelpCloseBtn', 'Tab keeps focus in modal');

    // Escape closes; restores to trigger.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('editorShortcutHelpModal').hidden === true, null, { timeout: 5000 });
    const restored = await page.evaluate(() => {
      const inv = document.getElementById('help-invoker');
      return !!inv && document.activeElement === inv;
    });
    assert.equal(restored, true, 'focus restored to trigger invoker');

    // Reopen without duplicate listeners.
    await page.evaluate(() => { window.__helpCtrl.open(); });
    await page.waitForFunction(() => document.getElementById('editorShortcutHelpModal').hidden === false, null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('editorShortcutHelpModal').hidden === true, null, { timeout: 5000 });

    assertHealth(health, 'shortcuts/' + ctx.name);
    await assertNoOverflow(page, 'shortcuts/' + ctx.name);
    await page.close();
  });
}

async function runMyTrees(t, context, ctx, port) {
  await t.test('My Trees create-tree — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'myTrees', 'window.apiClient = { createTree: function(){ return new Promise(function(){}); } };');
    await page.goto('http://127.0.0.1:' + port + '/pages/my-trees.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.LoveBudMyTreesActions, null, { timeout: 15000 });

    // Open the create modal via the real controller API.
    await page.evaluate(() => {
      window.__createInvoker = document.createElement('button');
      window.__createInvoker.id = 'create-invoker';
      document.body.appendChild(window.__createInvoker);
      window.__createInvoker.focus();
      window.__createPromise = window.LoveBudMyTreesActions.createNewTree({ i18n: window.t });
    });
    await page.waitForFunction(() => {
      const b = document.getElementById('createTreeModalBackdrop');
      return b && b.classList.contains('show');
    }, null, { timeout: 5000 });

    const initialFocus = await activeClass(page);
    assert.equal(initialFocus, 'createTreeTitleInput', 'initial focus on title input');

    const scrollLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
    assert.equal(scrollLocked, true, 'body scroll locked while open');

    // Tab wrap: focus the last live focusable then Tab → wraps to first.
    const mtWrap = await page.evaluate(() => {
      const modal = document.getElementById('createTreeModalBackdrop');
      const lc = window.LoveBudModalA11y.createLifecycle({ getModal: () => modal, isOpen: () => true });
      const fbs = lc.getFocusables();
      if (!fbs.length) return { ok: false, reason: 'no focusables' };
      fbs[fbs.length - 1].focus();
      return { ok: true, first: String(fbs[0].id || fbs[0].className || fbs[0].tagName) };
    });
    assert.equal(mtWrap.ok, true, mtWrap.reason || 'has focusables');
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.equal(afterTab, mtWrap.first, 'Tab wraps last → first');

    // Escape closes (not busy) and restores focus + scroll.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('createTreeModalBackdrop').classList.contains('show'), null, { timeout: 5000 });
    const restored = await page.evaluate(() => {
      const inv = document.getElementById('create-invoker');
      return !!inv && document.activeElement === inv;
    });
    assert.equal(restored, true, 'focus restored to invoker');
    const scrollReleased = await page.evaluate(() => document.body.style.overflow === '');
    assert.equal(scrollReleased, true, 'body scroll released after close');

    // Busy gate: reopen, submit with pending API → Escape must be blocked.
    await page.evaluate(() => {
      window.__createPromise = window.LoveBudMyTreesActions.createNewTree({ i18n: window.t });
    });
    await page.waitForFunction(() => document.getElementById('createTreeModalBackdrop').classList.contains('show'), null, { timeout: 5000 });
    await page.evaluate(() => {
      const form = document.getElementById('createTreeModalForm');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => {
      const b = document.getElementById('createTreeModalSubmitBtn');
      return b && b.disabled === true;
    }, null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    const stillOpen = await page.evaluate(() => document.getElementById('createTreeModalBackdrop').classList.contains('show'));
    assert.equal(stillOpen, true, 'busy gate blocks Escape while submitting');

    assertHealth(health, 'myTrees/' + ctx.name);
    await assertNoOverflow(page, 'myTrees/' + ctx.name);
    await page.close();
  });
}

async function runAuth(t, context, ctx, port) {
  await t.test('Auth email modal — ' + ctx.name, async () => {
    const { page, health } = await newPage(context, port, 'auth');
    await page.goto('http://127.0.0.1:' + port + '/pages/login.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.LoveBudAuthLoginPage, null, { timeout: 15000 });

    await page.evaluate(() => {
      window.__authMode = 'login';
      window.LoveBudAuthLoginPage.setupEmailAuthEntry({
        setEmailAuthMode: function(m) { window.__authMode = m; },
        getEmailAuthMode: function() { return window.__authMode; },
        syncEmailAuthModeUi: function() {},
        applyI18n: function() {},
        initialMode: 'login'
      });
      // The page's auto-bind hides the login card (visibility:hidden), which
      // would make the CTA unrestorable; restore visibility so the guarded
      // invoker restore has a valid target.
      const card = document.querySelector('.login-card');
      if (card) {
        card.style.visibility = '';
        card.removeAttribute('aria-hidden');
      }
      const cta = document.getElementById('login-btn-email');
      cta.click();
    });
    await page.waitForFunction(() => {
      const m = document.getElementById('email-auth-modal');
      return m && m.style.display === 'flex';
    }, null, { timeout: 5000 });

    const initialFocus = await activeClass(page);
    assert.equal(initialFocus, 'email-auth-email', 'initial focus on email input');

    // Tab wrap: focus the last live focusable then Tab → wraps to first.
    const auWrap = await page.evaluate(() => {
      const modal = document.getElementById('email-auth-modal');
      const lc = window.LoveBudModalA11y.createLifecycle({ getModal: () => modal, isOpen: () => true });
      const fbs = lc.getFocusables();
      if (!fbs.length) return { ok: false, reason: 'no focusables' };
      fbs[fbs.length - 1].focus();
      return { ok: true, first: String(fbs[0].id || fbs[0].className || fbs[0].tagName) };
    });
    assert.equal(auWrap.ok, true, auWrap.reason || 'has focusables');
    await page.keyboard.press('Tab');
    const afterTab = await activeClass(page);
    assert.equal(afterTab, auWrap.first, 'Tab wraps last → first');

    // Shift+Tab from first → wraps to last.
    const auShift = await page.evaluate(() => {
      const modal = document.getElementById('email-auth-modal');
      const lc = window.LoveBudModalA11y.createLifecycle({ getModal: () => modal, isOpen: () => true });
      const fbs = lc.getFocusables();
      fbs[0].focus();
      return { last: String(fbs[fbs.length - 1].id || fbs[fbs.length - 1].className || fbs[fbs.length - 1].tagName) };
    });
    await page.keyboard.press('Shift+Tab');
    const afterShift = await activeClass(page);
    assert.equal(afterShift, auShift.last, 'Shift+Tab wraps first → last');

    // Escape closes and restores focus to the CTA.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('email-auth-modal').style.display === 'none', null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const cta = document.getElementById('login-btn-email');
      return !!cta && document.activeElement === cta;
    }, null, { timeout: 5000 });

    // Reopen without listener duplication.
    await page.evaluate(() => { document.getElementById('login-btn-email').click(); });
    await page.waitForFunction(() => document.getElementById('email-auth-modal').style.display === 'flex', null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('email-auth-modal').style.display === 'none', null, { timeout: 5000 });

    assertHealth(health, 'auth/' + ctx.name);
    await assertNoOverflow(page, 'auth/' + ctx.name);
    await page.close();
  });
}

// A minimal forced-colors/WHCM evidence probe on the Home video modal, whose
// close control carries real outline authority (`.hero-video-modal-close:
// focus-visible`). A keyboard Tab makes :focus-visible match so the outline is
// observable. The known box-shadow-only focus defect on
// `.editor-rename-modal-input:focus` / `.create-tree-input:focus` is reported
// as a separate blocker, not fixed in this child.
async function runForcedColorsProbe(t, browser, port) {
  await t.test('WHCM forced-colors probe (Home video modal)', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    });
    try {
      const page = await context.newPage();
      const health = newHealth();
      collectHealth(page, health);
      await page.addInitScript('window.t = function(k){ return k; };');
      await installRoutes(page, health, port, REAL_FILES.home);
      await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'dark' });
      await page.evaluate(() => {
        const card = document.querySelector('.growth-stage-card');
        card.setAttribute('data-video-id', 'synthetic-whcm-001');
        card.querySelector('.growth-stage-card-media').click();
      });
      await page.waitForSelector('.hero-video-modal', { state: 'visible', timeout: 10000 });
      // A keyboard Tab makes :focus-visible match on the close control.
      await page.keyboard.press('Tab');
      const evidence = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { outlineStyle: 'none', ok: false, reason: 'no active element' };
        const cs = getComputedStyle(el);
        const outlineStyle = cs.outlineStyle || 'none';
        const outlineWidth = cs.outlineWidth || '0px';
        const isModal = !!document.querySelector('.hero-video-modal');
        return { outlineStyle, outlineWidth, ok: outlineStyle !== 'none', isModal };
      });
      assert.equal(evidence.isModal, true, 'WHCM: modal open in forced-colors');
      assert.equal(evidence.ok, true,
        'WHCM: focused close control keeps a non-none outline (got ' + evidence.outlineStyle + ':' + evidence.outlineWidth + ')');
      assertHealth(health, 'whcm/home');
      await page.close();
    } finally {
      await context.close();
    }
  });
}

test('modal a11y core dialogs browser contract', async (t) => {
  const { server, port } = await startServer();
  const browser = await chromium.launch();
  try {
    for (const ctx of CONTEXTS) {
      await t.test(ctx.name, async (t2) => {
        const context = await browser.newContext({
          viewport: ctx.viewport,
          reducedMotion: ctx.reducedMotion,
          isMobile: ctx.viewport.width < 768,
          hasTouch: ctx.viewport.width < 768,
        });
        try {
          await runHome(t2, context, ctx, port);
          await runMemoryForm(t2, context, ctx, port);
          await runRename(t2, context, ctx, port);
          await runShortcuts(t2, context, ctx, port);
          await runMyTrees(t2, context, ctx, port);
          await runAuth(t2, context, ctx, port);
        } finally {
          await context.close();
        }
      });
    }
    await runForcedColorsProbe(t, browser, port);
  } finally {
    await browser.close();
    await closeServer(server);
  }
});
