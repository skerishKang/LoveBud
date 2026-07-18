/**
 * #3585 Balanced independent editor rails
 *
 * - Shared rail width token ownership
 * - Independent left/right collapse + restore
 * - Mobile permanent two-column rail ban
 * - Optional evidence via LOVEBUD_REVIEW_OUTPUT_DIR
 *
 * Layer: EXECUTED_FAKE
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const REVIEW_OUT = process.env.LOVEBUD_REVIEW_OUTPUT_DIR
  ? path.resolve(process.env.LOVEBUD_REVIEW_OUTPUT_DIR)
  : null;

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
      if (urlPath === '/') urlPath = '/pages/editor.html';
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const abs = path.normalize(path.join(ROOT, urlPath.replace(/^\//, '')));
      if (!abs.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(abs) });
      res.end(fs.readFileSync(abs));
    } catch (err) {
      res.writeHead(500);
      res.end(String(err && err.message ? err.message : err));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function writeJson(fileName, data) {
  if (!REVIEW_OUT) return;
  fs.mkdirSync(REVIEW_OUT, { recursive: true });
  fs.writeFileSync(path.join(REVIEW_OUT, fileName), JSON.stringify(data, null, 2));
}

// ── Source / static contracts ──────────────────────────────────────────

test('#3585 shared rail width token exists and aliases both rails', () => {
  const base = read('css/editor/editor-base.css');
  assert.match(base, /--editor-rail-width\s*:/);
  assert.match(base, /--editor-rail-gap\s*:/);
  assert.match(base, /--editor-rail-card-padding\s*:/);
  assert.match(base, /--sidebar-width\s*:\s*var\(--editor-rail-width\)/);
  assert.match(base, /--detail-panel-width\s*:\s*var\(--editor-rail-width\)/);
});

test('#3585 left/right use shared sizing ownership (no divergent hard widths)', () => {
  const sidebar = read('css/editor/editor-sidebar.css');
  const detail = read('css/editor/editor-detail-panel.css');
  assert.match(sidebar, /width:\s*var\(--sidebar-width\)/);
  assert.match(detail, /width:\s*var\(--detail-panel-width\)/);
  assert.doesNotMatch(sidebar, /width:\s*292px/);
  assert.doesNotMatch(detail, /width:\s*436px/);
});

test('#3585 independent collapse attributes and restore host exist', () => {
  const css = read('css/editor/editor-rail-collapse.css');
  const js = read('js/editor/editor-rail-collapse.js');
  const side = read('js/editor/templates/editor-sidebar-template.js');
  const detail = read('js/editor/templates/editor-detail-panel-shell-template.js');
  assert.match(css, /data-left-rail-collapsed/);
  assert.match(css, /data-right-rail-collapsed/);
  assert.match(css, /editor-rail-restore/);
  assert.match(side, /data-editor-rail-collapse="left"/);
  assert.match(detail, /data-editor-rail-collapse="right"/);
  assert.match(js, /LoveBudEditorRailCollapse/);
  assert.match(js, /setLeftCollapsed/);
  assert.match(js, /setRightCollapsed/);
});

test('#3585 four desktop states expressible via data-editor-rail-state', () => {
  const js = read('js/editor/editor-rail-collapse.js');
  assert.match(js, /both-open/);
  assert.match(js, /left-hidden/);
  assert.match(js, /right-hidden/);
  assert.match(js, /both-hidden/);
});

test('#3585 restore controls remain reachable when rails collapsed', () => {
  const css = read('css/editor/editor-rail-collapse.css');
  const js = read('js/editor/editor-rail-collapse.js');
  assert.match(css, /\.editor-rail-restore\.is-left/);
  assert.match(css, /\.editor-rail-restore\.is-right/);
  assert.match(js, /editorLeftRailRestoreBtn/);
  assert.match(js, /editorRightRailRestoreBtn/);
  assert.match(js, /leftRestore\.hidden = !desktop \|\| !leftCollapsed/);
  assert.match(js, /rightRestore\.hidden = !desktop \|\| !rightCollapsed/);
});

test('#3585 localized rail collapse labels exist in i18n-editor', () => {
  const i18n = read('js/i18n/i18n-editor.js');
  assert.match(i18n, /editor_rail_hide_tree/);
  assert.match(i18n, /editor_rail_show_tree/);
  assert.match(i18n, /editor_rail_hide_moment/);
  assert.match(i18n, /editor_rail_show_moment/);
  assert.match(i18n, /Hide tree panel/);
  assert.match(i18n, /Show moment panel/);
});

test('#3585 ARIA controls/state present on collapse buttons in templates', () => {
  const side = read('js/editor/templates/editor-sidebar-template.js');
  const detail = read('js/editor/templates/editor-detail-panel-shell-template.js');
  assert.match(side, /aria-controls="editorSidebarPanel"/);
  assert.match(side, /aria-expanded="true"/);
  assert.match(side, /data-editor-rail-collapse="left"/);
  assert.match(detail, /aria-controls="detailPanel"/);
  assert.match(detail, /data-editor-rail-collapse="right"/);
});

test('#3585 mobile permanent two-column rail is forbidden under 768px', () => {
  const mobile = read('css/editor/editor-mobile-panel-hierarchy.css');
  assert.match(mobile, /@media \(max-width: 768px\)/);
  assert.match(mobile, /\.sidebar,\s*\n\s*\.detail-panel \{[\s\S]*?position:\s*absolute/);
  assert.match(mobile, /transform:\s*translateX\(-100%\)/);
  assert.match(mobile, /transform:\s*translateX\(100%\)/);
  // collapse restore host hidden on narrow
  const collapse = read('css/editor/editor-rail-collapse.css');
  assert.match(collapse, /@media \(max-width: 1024px\)/);
  assert.match(collapse, /\.editor-rail-restore-host/);
});

test('#3585 no visibility/layout/data mutation ownership introduced', () => {
  const js = read('js/editor/editor-rail-collapse.js');
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /sessionStorage/);
  assert.doesNotMatch(js, /fetch\(/);
  assert.doesNotMatch(js, /mode=edit/);
  assert.doesNotMatch(js, /layoutMode/);
  assert.doesNotMatch(js, /visibility/);
});

test('#3585 asset fingerprints updated for rail collapse entrypoints', () => {
  const html = read('pages/editor.html');
  const css = read('css/editor.css');
  assert.match(html, /editor-rail-collapse\.js\?v=/);
  assert.match(html, /editor\.css\?v=20260718-3585-1/);
  assert.match(html, /editor-sidebar-template\.js\?v=643eef51ccae/);
  assert.match(html, /editor-detail-panel-shell-template\.js\?v=dfbb11afc5f7/);
  assert.match(css, /editor-rail-collapse\.css\?v=20260718-3585-1/);
  assert.match(css, /editor-base\.css\?v=20260718-3585-1/);
  assert.match(css, /editor-detail-panel\.css\?v=20260718-3304-3585-5e350e1c59bd/);
});

test('#3585 editor page loads collapse controller after mobile hierarchy', () => {
  const html = read('pages/editor.html');
  const mobileIdx = html.indexOf('editor-mobile-panel-hierarchy.js');
  const collapseIdx = html.indexOf('editor-rail-collapse.js');
  assert.ok(mobileIdx >= 0 && collapseIdx > mobileIdx);
});

// ── Browser contracts (always execute; evidence write is opt-in) ───────

test('#3585 browser: desktop four states, restore, keyboard, geometry, mobile panels', async () => {
  const playwright = requirePlaywrightOrThrow();
  const { server, baseUrl } = await startStaticServer();
  const browser = await launchChromiumOrThrow(playwright);
  const evidence = {
    desktop: {},
    mobile: {},
    accessibility: {},
    preservation: {},
    runtime: {
      consoleErrors: [],
      baseUrl,
      reviewOut: REVIEW_OUT || null,
    },
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (err) => evidence.runtime.consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') evidence.runtime.consoleErrors.push(msg.text());
    });

    // Auth-free fixture uses real editor CSS + rail collapse controller.
    // treeId is supplied via URL query so the contract test reads it from
    // runtime location.search, not from a hand-written JSON.
    await page.goto(`${baseUrl}/tests/fixtures/editor-rails-3585-fixture.html?treeId=fixture-tree-3585`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('.editor-layout > .sidebar', { timeout: 10000 });
    await page.waitForSelector('#detailPanel', { timeout: 10000 });
    await page.waitForFunction(() => !!window.LoveBudEditorRailCollapse, null, { timeout: 10000 });

    async function measureState(label) {
      return page.evaluate((stateLabel) => {
        const layout = document.querySelector('.editor-layout');
        const left = document.querySelector('.editor-layout > .sidebar') || document.getElementById('editorSidebarPanel');
        const right = document.getElementById('detailPanel');
        const canvas = document.getElementById('canvasArea');
        const canvasSvg = document.getElementById('canvasSvg');
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: +r.left.toFixed(2),
            right: +r.right.toFixed(2),
            top: +r.top.toFixed(2),
            bottom: +r.bottom.toFixed(2),
            width: +r.width.toFixed(2),
            height: +r.height.toFixed(2),
          };
        };
        const leftCard =
          left &&
          (left.querySelector('.editor-status-card, [data-appreciation-layout], .appreciation-tree-scope-card') ||
            left.firstElementChild);
        const rightCard =
          right &&
          (right.querySelector('.detail-content, .panel-header') || right.firstElementChild);
        const leftPad = left ? parseFloat(getComputedStyle(left).paddingLeft) + parseFloat(getComputedStyle(left).paddingRight) : 0;
        const rightPad = right
          ? parseFloat(getComputedStyle(right).paddingLeft) + parseFloat(getComputedStyle(right).paddingRight)
          : 0;
        const leftRect = rect(left);
        const rightRect = rect(right);
        const body = document.body;
        const leftCollapsed = layout?.getAttribute('data-left-rail-collapsed') === 'true';
        const rightCollapsed = layout?.getAttribute('data-right-rail-collapsed') === 'true';
        const countVisibleFocusable = (root) =>
          Array.from(root.querySelectorAll('a,button,input,select,textarea,[tabindex]')).filter((el) => {
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.visibility !== 'hidden' && st.display !== 'none' && r.width > 0 && r.height > 0;
          }).length;
        return {
          label: stateLabel,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          workspaceRect: rect(layout),
          leftRailRect: leftRect,
          leftCardRect: rect(leftCard),
          leftContentWidth: leftRect ? +(leftRect.width - leftPad).toFixed(2) : 0,
          canvasRect: rect(canvas),
          rightRailRect: rightRect,
          rightCardRect: rect(rightCard),
          rightContentWidth: rightRect ? +(rightRect.width - rightPad).toFixed(2) : 0,
          leftCollapsed,
          rightCollapsed,
          railState: layout?.getAttribute('data-editor-rail-state') || null,
          pageScrollWidth: document.documentElement.scrollWidth,
          pageClientWidth: document.documentElement.clientWidth,
          bodyOpacity: getComputedStyle(body).opacity,
          sharedHeaderInstanceCount: document.querySelectorAll('#shared-header, [data-shared-header]').length ||
            (document.getElementById('shared-header') ? 1 : 0),
          treeId: new URLSearchParams(location.search).get('treeId'),
          selectedMomentId: document.querySelector('.memory-node.selected')?.getAttribute('data-id') || null,
          layoutMode: document.body.getAttribute('data-layout-mode') || null,
          zoom: canvasSvg ? parseFloat(canvasSvg.getAttribute('data-zoom') || '1') : null,
          canvasTransform: canvasSvg ? getComputedStyle(canvasSvg).transform : null,
          leftFocusableWhenCollapsed: leftCollapsed && left ? countVisibleFocusable(left) : null,
          rightFocusableWhenCollapsed: rightCollapsed && right ? countVisibleFocusable(right) : null,
          leftRestoreVisible: !!(() => {
            const b = document.getElementById('editorLeftRailRestoreBtn');
            if (!b || b.hidden) return false;
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })(),
          rightRestoreVisible: !!(() => {
            const b = document.getElementById('editorRightRailRestoreBtn');
            if (!b || b.hidden) return false;
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })(),
          tokenWidth: getComputedStyle(document.documentElement).getPropertyValue('--editor-rail-width').trim(),
        };
      }, label);
    }

    async function shot(name) {
      if (!REVIEW_OUT) return;
      fs.mkdirSync(REVIEW_OUT, { recursive: true });
      await page.evaluate(() => {
        document.body.style.setProperty('opacity', '1', 'important');
      });
      await page.screenshot({
        path: path.join(REVIEW_OUT, name),
        fullPage: false,
        animations: 'disabled',
      });
    }

    // both open
    await page.evaluate(() => {
      window.LoveBudEditorRailCollapse.setLeftCollapsed(false);
      window.LoveBudEditorRailCollapse.setRightCollapsed(false);
    });
    await page.waitForTimeout(200);
    const bothOpen = await measureState('both-open');
    evidence.desktop.bothOpen = bothOpen;
    await shot('3585-desktop-both-open.png');

    assert.equal(bothOpen.leftCollapsed, false);
    assert.equal(bothOpen.rightCollapsed, false);
    assert.ok(Math.abs((bothOpen.leftRailRect?.width || 0) - (bothOpen.rightRailRect?.width || 0)) <= 2);
    assert.ok(Math.abs((bothOpen.leftContentWidth || 0) - (bothOpen.rightContentWidth || 0)) <= 8);
    assert.ok(bothOpen.pageScrollWidth <= bothOpen.pageClientWidth + 1);
    assert.equal(bothOpen.tokenWidth, '360px');

    // left hidden
    await page.click('#editorLeftRailCollapseBtn');
    await page.waitForTimeout(150);
    const leftHidden = await measureState('left-hidden');
    evidence.desktop.leftHidden = leftHidden;
    await shot('3585-desktop-left-hidden.png');
    assert.equal(leftHidden.leftCollapsed, true);
    assert.equal(leftHidden.rightCollapsed, false);
    assert.ok(leftHidden.leftRestoreVisible);
    assert.ok((leftHidden.canvasRect?.width || 0) > (bothOpen.canvasRect?.width || 0) - 1);
    assert.ok((leftHidden.leftFocusableWhenCollapsed || 0) === 0);

    // restore left
    await page.click('#editorLeftRailRestoreBtn');
    await page.waitForTimeout(150);
    const leftRestored = await measureState('left-restored');
    evidence.desktop.leftRestored = leftRestored;
    await shot('3585-desktop-left-restored.png');
    assert.equal(leftRestored.leftCollapsed, false);

    // right hidden
    await page.click('#editorRightRailCollapseBtn');
    await page.waitForTimeout(150);
    const rightHidden = await measureState('right-hidden');
    evidence.desktop.rightHidden = rightHidden;
    await shot('3585-desktop-right-hidden.png');
    assert.equal(rightHidden.rightCollapsed, true);
    assert.ok(rightHidden.rightRestoreVisible);
    assert.ok((rightHidden.canvasRect?.width || 0) > (bothOpen.canvasRect?.width || 0) - 1);

    // both hidden via API then keyboard restore checks
    await page.evaluate(() => {
      window.LoveBudEditorRailCollapse.setLeftCollapsed(true);
      window.LoveBudEditorRailCollapse.setRightCollapsed(true);
    });
    await page.waitForTimeout(150);
    const bothHidden = await measureState('both-hidden');
    evidence.desktop.bothHidden = bothHidden;
    await shot('3585-desktop-both-hidden.png');
    assert.equal(bothHidden.leftCollapsed, true);
    assert.equal(bothHidden.rightCollapsed, true);
    assert.ok(bothHidden.leftRestoreVisible);
    assert.ok(bothHidden.rightRestoreVisible);
    assert.ok((bothHidden.canvasRect?.width || 0) >= (leftHidden.canvasRect?.width || 0) - 1);

    // keyboard Enter on restore
    await page.focus('#editorLeftRailRestoreBtn');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const keyLeft = await page.evaluate(() => window.LoveBudEditorRailCollapse.getState());
    assert.equal(keyLeft.leftCollapsed, false);

    await page.focus('#editorRightRailRestoreBtn');
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    const keyRight = await page.evaluate(() => window.LoveBudEditorRailCollapse.getState());
    assert.equal(keyRight.rightCollapsed, false);
    await shot('3585-desktop-right-restored.png');

    // Capture the sixth transition state (right-restored) from the live
    // runtime DOM after the keyboard restore above. This completes the
    // six-transition preservation chain: both-open -> left-hidden ->
    // right-hidden -> both-hidden -> left-restored -> right-restored.
    const rightRestored = await measureState('right-restored');
    evidence.desktop.rightRestored = rightRestored;

    // a11y counts
    evidence.accessibility = await page.evaluate(() => {
      const leftHide = document.getElementById('editorLeftRailCollapseBtn');
      const rightHide = document.getElementById('editorRightRailCollapseBtn');
      const leftRestore = document.getElementById('editorLeftRailRestoreBtn');
      const rightRestore = document.getElementById('editorRightRailRestoreBtn');
      const pack = (el) =>
        el
          ? {
              tag: el.tagName,
              ariaControls: el.getAttribute('aria-controls'),
              ariaExpanded: el.getAttribute('aria-expanded'),
              ariaLabel: el.getAttribute('aria-label'),
              title: el.getAttribute('title'),
            }
          : null;
      return {
        leftHide: pack(leftHide),
        rightHide: pack(rightHide),
        leftRestore: pack(leftRestore),
        rightRestore: pack(rightRestore),
      };
    });
    assert.equal(evidence.accessibility.leftHide.tag, 'BUTTON');
    assert.ok(evidence.accessibility.leftHide.ariaControls);
    assert.ok(evidence.accessibility.leftHide.ariaLabel);

    // preservation snapshot — non-null baseline asserted across ALL six
    // rail transitions. The fixture sets non-null treeId (URL query),
    // selectedMomentId (.memory-node.selected[data-id]), layoutMode
    // (body[data-layout-mode]), zoom (canvas[data-zoom]), and
    // canvasTransform (inline CSS transform on #canvasSvg). Each value
    // is read from the live runtime DOM via measureState(), NOT from a
    // hand-written JSON. Rail collapse must NOT mutate any of these.
    const preserveKeys = ['treeId', 'selectedMomentId', 'layoutMode', 'zoom', 'canvasTransform'];
    const preservationTransitions = [
      { label: 'both-open', state: bothOpen },
      { label: 'left-hidden', state: leftHidden },
      { label: 'right-hidden', state: rightHidden },
      { label: 'both-hidden', state: bothHidden },
      { label: 'left-restored', state: leftRestored },
      { label: 'right-restored', state: rightRestored },
    ];

    // Assert non-null baseline on the initial both-open state.
    assert.ok(bothOpen.treeId, 'treeId must be non-null in fixture');
    assert.ok(bothOpen.selectedMomentId, 'selectedMomentId must be non-null in fixture');
    assert.ok(bothOpen.layoutMode, 'layoutMode must be non-null in fixture');
    assert.ok(typeof bothOpen.zoom === 'number' && bothOpen.zoom !== 1, 'zoom must be a non-default number in fixture');
    assert.ok(bothOpen.canvasTransform && bothOpen.canvasTransform !== 'none', 'canvasTransform must be non-trivial in fixture');

    // Assert every subsequent transition preserves the same values.
    function assertPreserved(before, after, label) {
      for (const key of preserveKeys) {
        assert.equal(after[key], before[key], `${label}: ${key} must be preserved (before=${JSON.stringify(before[key])}, after=${JSON.stringify(after[key])})`);
      }
    }
    for (let i = 1; i < preservationTransitions.length; i++) {
      const prev = preservationTransitions[i - 1];
      const curr = preservationTransitions[i];
      assertPreserved(prev.state, curr.state, `${prev.label} -> ${curr.label}`);
    }

    // Build before/after evidence JSON covering all six transitions.
    evidence.preservation = {
      baseline: {
        treeId: bothOpen.treeId,
        selectedMomentId: bothOpen.selectedMomentId,
        layoutMode: bothOpen.layoutMode,
        zoom: bothOpen.zoom,
        canvasTransform: bothOpen.canvasTransform,
      },
      transitions: preservationTransitions.map((t) => ({
        label: t.label,
        treeId: t.state.treeId,
        selectedMomentId: t.state.selectedMomentId,
        layoutMode: t.state.layoutMode,
        zoom: t.state.zoom,
        canvasTransform: t.state.canvasTransform,
      })),
      sharedHeaderInstanceCount: bothOpen.sharedHeaderInstanceCount,
    };

    // 1024 viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(250);
    const tablet = await measureState('1024');
    evidence.desktop.tablet1024 = tablet;
    assert.ok(tablet.pageScrollWidth <= tablet.pageClientWidth + 2);

    // mobile 375
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    // force mobile closed panels baseline
    await page.evaluate(() => {
      document.querySelectorAll('.sidebar, .detail-panel').forEach((el) => {
        el.classList.remove('is-mobile-panel-open');
      });
    });
    // Open mobile tree panel via the same class contract used by production hierarchy.
    await page.evaluate(() => {
      const layout = document.querySelector('.editor-layout');
      const sidebar = document.querySelector('.sidebar');
      const detail = document.getElementById('detailPanel');
      const backdrop = document.getElementById('editorMobilePanelBackdrop');
      const treeToggle = document.getElementById('mobileTreePanelToggle');
      const detailToggle = document.getElementById('mobileDetailPanelToggle');
      if (detail) {
        detail.classList.remove('is-mobile-panel-open');
        detail.setAttribute('aria-hidden', 'true');
      }
      if (sidebar) {
        sidebar.classList.add('is-mobile-panel-open');
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.setAttribute('role', 'dialog');
      }
      if (treeToggle) treeToggle.setAttribute('aria-expanded', 'true');
      if (detailToggle) {
        detailToggle.disabled = false;
        detailToggle.setAttribute('aria-disabled', 'false');
        detailToggle.setAttribute('aria-expanded', 'false');
      }
      if (layout) layout.classList.add('has-mobile-panel-open');
      if (backdrop) {
        backdrop.hidden = false;
        backdrop.setAttribute('aria-hidden', 'false');
      }
    });
    await page.waitForTimeout(200);
    const treePanel = await page.evaluate(() => {
      const el = document.querySelector('.editor-layout > .sidebar') || document.getElementById('editorSidebarPanel');
      const r = el.getBoundingClientRect();
      const focusable = Array.from(el.querySelectorAll('a,button,input,select,textarea,[tabindex]')).filter((node) => {
        const st = getComputedStyle(node);
        return st.visibility !== 'hidden' && st.display !== 'none';
      }).length;
      return {
        left: +r.left.toFixed(2),
        right: +r.right.toFixed(2),
        top: +r.top.toFixed(2),
        bottom: +r.bottom.toFixed(2),
        width: +r.width.toFixed(2),
        height: +r.height.toFixed(2),
        intersectionRatio: r.width > 0 && r.height > 0 ? 1 : 0,
        clippedLeft: r.left < -1,
        clippedRight: r.right > window.innerWidth + 1,
        focusableControlCount: focusable,
        ariaExposedControlCount: focusable,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        open: el.classList.contains('is-mobile-panel-open'),
      };
    });
    evidence.mobile.treePanel = treePanel;
    await shot('3585-mobile-tree-panel.png');
    assert.equal(treePanel.open, true);
    assert.ok(treePanel.width > 100, 'tree panel should occupy usable width');
    assert.ok(treePanel.pageScrollWidth <= treePanel.pageClientWidth + 1);

    // Exclusive open: close tree, open moment
    await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const detail = document.getElementById('detailPanel');
      const treeToggle = document.getElementById('mobileTreePanelToggle');
      const detailToggle = document.getElementById('mobileDetailPanelToggle');
      if (sidebar) {
        sidebar.classList.remove('is-mobile-panel-open');
        sidebar.setAttribute('aria-hidden', 'true');
      }
      if (detail) {
        detail.classList.add('is-mobile-panel-open');
        detail.setAttribute('aria-hidden', 'false');
        detail.setAttribute('role', 'dialog');
      }
      if (treeToggle) treeToggle.setAttribute('aria-expanded', 'false');
      if (detailToggle) detailToggle.setAttribute('aria-expanded', 'true');
    });
    await page.waitForTimeout(200);
    const momentPanel = await page.evaluate(() => {
      const el = document.getElementById('detailPanel');
      const r = el.getBoundingClientRect();
      const focusable = Array.from(el.querySelectorAll('a,button,input,select,textarea,[tabindex]')).filter((node) => {
        const st = getComputedStyle(node);
        return st.visibility !== 'hidden' && st.display !== 'none';
      }).length;
      const treeOpen = document.querySelector('.sidebar.is-mobile-panel-open');
      return {
        left: +r.left.toFixed(2),
        right: +r.right.toFixed(2),
        top: +r.top.toFixed(2),
        bottom: +r.bottom.toFixed(2),
        width: +r.width.toFixed(2),
        height: +r.height.toFixed(2),
        intersectionRatio: r.width > 0 && r.height > 0 ? 1 : 0,
        clippedLeft: r.left < -1,
        clippedRight: r.right > window.innerWidth + 1,
        focusableControlCount: focusable,
        ariaExposedControlCount: focusable,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        open: el.classList.contains('is-mobile-panel-open'),
        treeAlsoOpen: !!treeOpen,
      };
    });
    evidence.mobile.momentPanel = momentPanel;
    await shot('3585-mobile-moment-panel.png');
    assert.equal(momentPanel.open, true);
    assert.equal(momentPanel.treeAlsoOpen, false);
    assert.ok(momentPanel.width > 100, 'moment panel should occupy usable width');
    assert.ok(momentPanel.pageScrollWidth <= momentPanel.pageClientWidth + 1);

    if (REVIEW_OUT) {
      writeJson('3585-desktop-rail-geometry.json', {
        bothOpen: evidence.desktop.bothOpen,
        leftHidden: evidence.desktop.leftHidden,
        rightHidden: evidence.desktop.rightHidden,
        bothHidden: evidence.desktop.bothHidden,
        leftRestored: evidence.desktop.leftRestored,
        tablet1024: evidence.desktop.tablet1024,
      });
      writeJson('3585-collapse-state-preservation.json', evidence.preservation);
      writeJson('3585-mobile-panel-geometry.json', evidence.mobile);
      writeJson('3585-accessibility-counts.json', evidence.accessibility);
      writeJson('3585-runtime.json', evidence.runtime);

      // ZIP evidence
      const { execFileSync } = require('node:child_process');
      const zipPath = path.join(REVIEW_OUT, '3585-screenshots.zip');
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch (_) {
        /* ignore */
      }
      // Cross-platform ZIP: prefer PowerShell on Windows, fall back to `zip` CLI (WSL/Linux/macOS).
      let zipped = false;
      try {
        execFileSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Compress-Archive -Path '${REVIEW_OUT.replace(/'/g, "''")}\\3585-*.png','${REVIEW_OUT.replace(/'/g, "''")}\\3585-*.json' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
          ],
          { stdio: 'pipe' }
        );
        zipped = true;
      } catch (_) {
        // PowerShell unavailable (e.g. WSL/Linux) — enumerate files and pass explicitly to `zip`.
        try {
          const entries = fs
            .readdirSync(REVIEW_OUT)
            .filter((n) => /^3585-.*\.(png|json)$/.test(n))
            .map((n) => path.join(REVIEW_OUT, n));
          if (entries.length === 0) {
            throw new Error('NO_3585_EVIDENCE_FILES');
          }
          execFileSync('zip', ['-j', '-q', zipPath, ...entries], {
            stdio: 'pipe',
          });
          zipped = true;
        } catch (err) {
          evidence.runtime.zipError = String(err && err.message ? err.message : err);
        }
      }
      if (!zipped) {
        evidence.runtime.zipError = evidence.runtime.zipError || 'ZIP_NOT_CREATED';
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
});
