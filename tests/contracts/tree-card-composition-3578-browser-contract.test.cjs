/**
 * #3578 Phase 2 — Actual Chromium browser contract for shared tree-card composition.
 *
 * Loads REAL production surface modules (security, metrics, composition,
 * search-card-renderer, my-trees-ui + deps) in a real Playwright Chromium
 * page context served from an actual local HTTP server.
 *
 * Fails closed (non-zero) when Playwright package or Chromium binary is
 * unavailable — no skip, no silent pass.
 *
 * No Production write / Auth / API / DB mutations.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..');

/* ── Playwright (fail-closed, no skip) ── */
let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function launchChromiumOrThrow() {
  try {
    return await withTimeout(
      playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] }),
      30000,
      'playwright chromium.launch'
    );
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

/* ── Static server (real URL navigation, not setContent) ── */
function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/tests/fixtures/tree-card-composition-3578-browser-fixture.html';
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const abs = path.normalize(path.join(ROOT, urlPath.replace(/^\//, '')));
      if (!abs.startsWith(ROOT)) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const content = fs.readFileSync(abs);
      res.writeHead(200, { 'Content-Type': contentType(abs) });
      res.end(content);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return server;
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

const FIXTURE_PATH = '/tests/fixtures/tree-card-composition-3578-browser-fixture.html';

async function withServerPage(t, fn) {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudTreeCardComposition !== 'undefined' &&
      typeof window.LoveBudTreeCardComposition.buildTreeCard === 'function' &&
      typeof window.LoveBudSearchCardRenderer !== 'undefined' &&
      typeof window.LoveBudMyTreesUI !== 'undefined'
    );
    return await fn(page, base);
  } finally {
    await browser.close();
    server.close();
  }
}

/* Absolute appreciation URL helper — composition sanitizeUrl rejects relative URLs */
function appreciationUrl(base, treeId) {
  return `${base}/pages/view.html?treeId=${encodeURIComponent(treeId)}`;
}
function editorUrl(base, treeId) {
  return `${base}/pages/editor.html?treeId=${encodeURIComponent(treeId)}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. Shared root, structure, and selectors — Browse + My Trees               */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3578 browser: shared root structure and selectors (composition direct)', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const trees = [
      { id: 'bt-1', title: 'Browse Tree', visibility: 'public', likeCount: 5, commentCount: 2, shareCount: 1, viewCount: 10 },
      { id: 'mt-1', title: 'My Tree', visibility: 'private', likeCount: 3, commentCount: 1, shareCount: 0, viewCount: 4 },
    ];

    const results = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const trees = args.trees;
      const base = args.base;
      const rootChecks = trees.map((tree, i) => {
        const card = comp.buildTreeCard(tree, {
          surface: i === 0 ? 'browse' : 'my-trees',
          title: tree.title,
          primaryHref: i === 0
            ? base + '/pages/view.html?treeId=' + encodeURIComponent(tree.id)
            : base + '/pages/editor.html?treeId=' + encodeURIComponent(tree.id),
          primaryLabel: '트리 열기',
          accessibilityLabel: tree.title + ' 러브트리',
          isFeatured: i === 0,
          isSelected: i === 1,
          index: i,
        });
        return {
          tagName: card.tagName,
          hasTreeCard: card.classList.contains('tree-card'),
          hasLoveTreeCard: card.classList.contains('love-tree-card'),
          hasSurfaceClass: i === 0 ? card.classList.contains('love-tree-card-browse') : card.classList.contains('love-tree-card-my-trees'),
          nestedTreeInLove: card.querySelectorAll('.tree-card > .love-tree-card').length,
          nestedLoveInTree: card.querySelectorAll('.love-tree-card > .tree-card').length,
          hasBody: card.querySelector('.tree-card-body, .love-tree-card-body') !== null,
          hasTitleRow: card.querySelector('.tree-card-title-row, .love-tree-card-title-row') !== null,
          hasTitle: card.querySelector('.tree-title, .love-tree-card-title') !== null,
          hasMetaRow: card.querySelector('.tree-meta-row, .love-tree-card-meta-row') !== null,
          hasOpenLink: card.querySelector('.tree-card-open-link, .love-tree-card-open-link') !== null,
          openLinkHref: card.querySelector('.love-tree-card-open-link')?.getAttribute('href'),
          hasModeEdit: card.querySelector('[href*="mode=edit"]') !== null,
        };
      });
      return { rootChecks };
    }, { trees, base });

    assert.ok(results, 'Results must be returned');
    for (let i = 0; i < results.rootChecks.length; i++) {
      const rc = results.rootChecks[i];
      assert.equal(rc.tagName, 'DIV', `Card ${i} tagName must be DIV`);
      assert.ok(rc.hasTreeCard, `Card ${i} must have tree-card class`);
      assert.ok(rc.hasLoveTreeCard, `Card ${i} must have love-tree-card class`);
      assert.ok(rc.hasSurfaceClass, `Card ${i} must have surface-specific class`);
      assert.equal(rc.nestedTreeInLove, 0, `Card ${i} no .tree-card > .love-tree-card nesting`);
      assert.equal(rc.nestedLoveInTree, 0, `Card ${i} no .love-tree-card > .tree-card reverse nesting`);
      assert.ok(rc.hasBody, `Card ${i} must have body`);
      assert.ok(rc.hasTitleRow, `Card ${i} must have title row`);
      assert.ok(rc.hasTitle, `Card ${i} must have title element`);
      assert.ok(rc.hasMetaRow, `Card ${i} must have meta row`);
      assert.ok(rc.hasOpenLink, `Card ${i} must have open link`);
      assert.ok(rc.openLinkHref && rc.openLinkHref.includes('view.html?treeId=' + trees[i].id) || rc.openLinkHref && rc.openLinkHref.includes('editor.html?treeId=' + trees[i].id),
        `Card ${i} open link must target viewer/editor`);
      assert.equal(rc.hasModeEdit, false, `Card ${i} must NOT have mode=edit`);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. Browse actual runtime — search-card-renderer.js
 *    Verifies CTA is rendered (same-origin absolute) in both root context
 *    and /pages/search context. FAILS before the production fix because the
 *    renderer emits a relative URL that composition's sanitizeUrl rejects.    */
/* ────────────────────────────────────────────────────────────────────────── */

function assertBrowseCta(t, label, r, pageOrigin, expectedTreeId) {
  assert.ok(r.htmlLength > 0, `${label}: renderer must produce HTML`);
  assert.equal(r.rootTag, 'DIV', `${label}: root must be DIV`);
  assert.ok(r.hasTreeCard, `${label}: must have tree-card class`);
  assert.ok(r.hasLoveTreeCard, `${label}: must have love-tree-card class`);
  assert.ok(r.hasBrowseClass, `${label}: must have love-tree-card-browse class`);
  assert.equal(r.nestedTreeInLove, 0, `${label}: no .tree-card > .love-tree-card nesting`);
  assert.equal(r.nestedLoveInTree, 0, `${label}: no .love-tree-card > .tree-card reverse nesting`);
  assert.ok(r.hasBody, `${label}: must have body`);
  assert.ok(r.hasTitle, `${label}: must have title`);
  assert.ok(r.hasMediaSlot, `${label}: must have media slot`);
  assert.ok(r.hasMetaRow, `${label}: must have meta row`);
  // CTA contract — exactly one open link
  assert.ok(r.hasOpenLink, `${label}: must render an appreciation CTA (open link)`);
  assert.equal(r.hasMetaRight, true, `${label}: must render meta-right wrapper for CTA`);
  // href must be absolute and same-origin
  assert.ok(r.href && /^https?:\/\//.test(r.href), `${label}: href must be absolute (${r.href})`);
  assert.equal(r.hrefOrigin, pageOrigin, `${label}: href origin must equal page origin`);
  assert.equal(r.hrefPathname, '/pages/view.html', `${label}: pathname must be /pages/view.html`);
  assert.equal(r.hrefTreeId, expectedTreeId, `${label}: treeId must match (${r.hrefTreeId})`);
  assert.equal(r.hasModeEdit, false, `${label}: must NOT have mode=edit`);
  assert.ok(r.metricsText.length > 0, `${label}: must render metrics`);
}

// Browser-side card inspector (stringified into page.evaluate)
const INSPECT_BROWSE_CARD_FN = function (card) {
  if (!card) return null;
  var openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
  var metaRight = card.querySelector('.tree-meta-right, .love-tree-card-meta-right');
  var href = openLink ? openLink.getAttribute('href') : null;
  var hrefOrigin = null, hrefPathname = null, hrefTreeId = null;
  if (href) {
    try {
      var u = new URL(href, window.location.origin);
      hrefOrigin = u.origin;
      hrefPathname = u.pathname;
      hrefTreeId = u.searchParams.get('treeId');
    } catch (e) {}
  }
  return {
    htmlLength: card.outerHTML.length,
    rootTag: card.tagName,
    hasTreeCard: card.classList.contains('tree-card'),
    hasLoveTreeCard: card.classList.contains('love-tree-card'),
    hasBrowseClass: card.classList.contains('love-tree-card-browse'),
    nestedTreeInLove: card.querySelectorAll('.tree-card > .love-tree-card').length,
    nestedLoveInTree: card.querySelectorAll('.love-tree-card > .tree-card').length,
    hasBody: card.querySelector('.tree-card-body, .love-tree-card-body') !== null,
    hasTitle: card.querySelector('.tree-title, .love-tree-card-title') !== null,
    hasMediaSlot: card.querySelector('.tree-card-media, .love-tree-card-media') !== null,
    hasMetaRow: card.querySelector('.tree-meta-row, .love-tree-card-meta-row') !== null,
    hasOpenLink: !!openLink,
    hasMetaRight: !!metaRight,
    href: href,
    hrefOrigin: hrefOrigin,
    hrefPathname: hrefPathname,
    hrefTreeId: hrefTreeId,
    hasModeEdit: !!href && href.indexOf('mode=edit') !== -1,
    metricsText: card.querySelector('.tree-card-reaction-metrics') ? card.querySelector('.tree-card-reaction-metrics').textContent : '',
  };
};

test('#3602 browser: Browse surface adapter — root context CTA (FAILS before fix)', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    // Simulate production root context (page at site root, not /tests/fixtures/)
    await page.evaluate(() => {
      window.history.replaceState({}, '', '/');
    });
    const tree = {
      id: 'browse-root', title: 'Browse Root Context', visibility: 'public',
      likeCount: 5, commentCount: 2, shareCount: 1, viewCount: 10,
    };
    // Fixture is served at root path — LoveBudPath.getBasePath() returns 'pages/'
    const result = await page.evaluate((args) => {
      const renderer = window.LoveBudSearchCardRenderer;
      const html = renderer.renderTreeCard(args.tree, { index: 0 });
      const container = document.createElement('div');
      container.innerHTML = html;
      const card = container.firstElementChild;
      const inspectFn = args.inspectFn;
      // eslint-disable-next-line no-eval
      const inspect = eval('(' + inspectFn + ')');
      return inspect(card);
    }, { tree, inspectFn: INSPECT_BROWSE_CARD_FN.toString() });
    assertBrowseCta(t, 'Browse root', result, new URL(base).origin, tree.id);
  });
});

test('#3602 browser: Browse surface adapter — /pages/search context CTA (FAILS before fix)', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    // Use replaceState to simulate the production /pages/search context so
    // LoveBudPath.getBasePath() returns '' (same as real /pages/search.html).
    await page.evaluate(() => {
      window.history.replaceState({}, '', '/pages/search');
    });
    const tree = {
      id: 'browse-search', title: 'Browse Search Context', visibility: 'public',
      likeCount: 3, commentCount: 1, shareCount: 0, viewCount: 7,
    };
    const result = await page.evaluate((args) => {
      const renderer = window.LoveBudSearchCardRenderer;
      const html = renderer.renderTreeCard(args.tree, { index: 0 });
      const container = document.createElement('div');
      container.innerHTML = html;
      const card = container.firstElementChild;
      const inspectFn = args.inspectFn;
      // eslint-disable-next-line no-eval
      const inspect = eval('(' + inspectFn + ')');
      return inspect(card);
    }, { tree, inspectFn: INSPECT_BROWSE_CARD_FN.toString() });
    assertBrowseCta(t, 'Browse /pages/search', result, new URL(base).origin, tree.id);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. My Trees actual runtime — my-trees-ui.js                                */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3602 browser: My Trees surface adapter — CTA + visibility (FAILS before fix)', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    // Simulate production /pages/my-trees context so resolveSafeBasePath() returns ''
    await page.evaluate(() => {
      window.history.replaceState({}, '', '/pages/my-trees');
    });
    const pageOrigin = new URL(base).origin;
    const publicTree = {
      id: 'mt-public', title: 'Public My Tree', visibility: 'public',
      likeCount: 7, commentCount: 3, shareCount: 2, viewCount: 20,
    };
    const privateTree = {
      id: 'mt-private', title: 'Private My Tree', visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 0,
    };

    const result = await page.evaluate((args) => {
      const UI = window.LoveBudMyTreesUI;

      function buildOne(tree) {
        return UI.buildTreeCard(tree, {
          i18n: function(k) { return k; },
          onSelect: function() {},
          isSelected: function() { return false; },
        });
      }

      function inspect(card) {
        if (!card) return null;
        const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
        const metaRight = card.querySelector('.tree-meta-right, .love-tree-card-meta-right');
        const href = openLink ? openLink.getAttribute('href') : null;
        let hrefOrigin = null, hrefPathname = null, hrefTreeId = null;
        if (href) {
          try {
            const u = new URL(href, window.location.origin);
            hrefOrigin = u.origin;
            hrefPathname = u.pathname;
            hrefTreeId = u.searchParams.get('treeId');
          } catch (e) {}
        }
        const visNode = card.querySelector('.love-tree-card-visibility');
        return {
          rootTag: card.tagName,
          hasTreeCard: card.classList.contains('tree-card'),
          hasLoveTreeCard: card.classList.contains('love-tree-card'),
          hasMyTreesClass: card.classList.contains('love-tree-card-my-trees'),
          nestedTreeInLove: card.querySelectorAll('.tree-card > .love-tree-card').length,
          nestedLoveInTree: card.querySelectorAll('.love-tree-card > .tree-card').length,
          hasBody: card.querySelector('.tree-card-body, .love-tree-card-body') !== null,
          hasTitle: card.querySelector('.tree-title, .love-tree-card-title') !== null,
          hasMetaRow: card.querySelector('.tree-meta-row, .love-tree-card-meta-row') !== null,
          hasOpenLink: !!openLink,
          hasMetaRight: !!metaRight,
          href: href,
          hrefOrigin: hrefOrigin,
          hrefPathname: hrefPathname,
          hrefTreeId: hrefTreeId,
          hasModeEdit: !!href && href.indexOf('mode=edit') !== -1,
          hasDirectEditLink: card.querySelector('a[href*="mode=edit"], .tree-card-edit-link') !== null,
          hasOwnerMenu: card.querySelector('.tree-card-owner-menu, .owner-menu') !== null,
          hasVisibilityNode: !!visNode,
          visibilityAriaLabel: visNode ? (visNode.getAttribute('aria-label') || visNode.querySelector('[aria-label]')?.getAttribute('aria-label') || '') : '',
          visibilityTitle: visNode ? (visNode.getAttribute('title') || visNode.querySelector('[title]')?.getAttribute('title') || '') : '',
          visibilityIcons: Array.from(card.querySelectorAll('.love-tree-card-visibility .material-symbols-outlined')).map(function(el) { return el.textContent.trim(); }),
          visibilityHtml: visNode ? visNode.innerHTML : '',
          metricsText: card.querySelector('.tree-card-reaction-metrics')?.textContent || '',
          cardRole: card.getAttribute('role'),
          cardTabindex: card.getAttribute('tabindex'),
        };
      }

      return { pub: inspect(buildOne(args.publicTree)), priv: inspect(buildOne(args.privateTree)) };
    }, { publicTree, privateTree });

    assert.ok(result.pub, 'Public My Trees card must be built');
    assert.ok(result.priv, 'Private My Trees card must be built');

    for (const [label, card, tree] of [['public', result.pub, publicTree], ['private', result.priv, privateTree]]) {
      assert.equal(card.rootTag, 'DIV', `${label}: root must be DIV`);
      assert.ok(card.hasTreeCard, `${label}: must have tree-card class`);
      assert.ok(card.hasLoveTreeCard, `${label}: must have love-tree-card class`);
      assert.ok(card.hasMyTreesClass, `${label}: must have love-tree-card-my-trees class`);
      assert.equal(card.nestedTreeInLove, 0, `${label}: no nesting`);
      assert.equal(card.nestedLoveInTree, 0, `${label}: no reverse nesting`);
      assert.ok(card.hasBody, `${label}: must have body`);
      assert.ok(card.hasTitle, `${label}: must have title`);
      assert.ok(card.hasMetaRow, `${label}: must have meta row`);
      // CTA contract — exactly one open link, same-origin absolute /pages/editor
      assert.ok(card.hasOpenLink, `${label}: must render an appreciation CTA (open link)`);
      assert.equal(card.hasMetaRight, true, `${label}: must render meta-right wrapper`);
      assert.ok(card.href && /^https?:\/\//.test(card.href), `${label}: href must be absolute (${card.href})`);
      assert.equal(card.hrefOrigin, pageOrigin, `${label}: href origin must equal page origin`);
      assert.equal(card.hrefPathname, '/pages/editor', `${label}: pathname must be /pages/editor (${card.hrefPathname})`);
      assert.equal(card.hrefTreeId, tree.id, `${label}: treeId must match (${card.hrefTreeId})`);
      assert.equal(card.hasModeEdit, false, `${label}: must NOT have mode=edit`);
      assert.equal(card.hasDirectEditLink, false, `${label}: must NOT have direct Edit link`);
      assert.equal(card.hasOwnerMenu, false, `${label}: must NOT have owner menu`);
      assert.ok(card.hasVisibilityNode, `${label}: must have visibility node`);
      assert.equal(card.cardRole, 'button', `${label}: card must have role=button`);
      assert.equal(card.cardTabindex, '0', `${label}: card must have tabindex=0`);
      // Visibility icon and accessible name
      assert.ok(card.visibilityIcons.length > 0, `${label}: visibility must render a material icon`);
      assert.ok(card.visibilityAriaLabel || card.visibilityTitle,
        `${label}: visibility must have localized aria-label or title`);
    }
    // Public → globe; Private → lock
    assert.ok(result.pub.visibilityIcons.indexOf('public') !== -1,
      'Public visibility icon must be "public" (globe)');
    assert.ok(result.priv.visibilityIcons.indexOf('lock') !== -1,
      'Private visibility icon must be "lock"');
    // No filled badge background
    assert.equal(result.pub.visibilityHtml.indexOf('background:'), -1,
      'Public visibility must not have filled badge background');
    // Private metrics: viewCount=0 → authoritative zero '0'
    assert.ok(result.priv.metricsText.indexOf('0') !== -1 || result.priv.metricsText.length === 0,
      'Private metrics: authoritative zero rendered as 0 or omitted if unknown');
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. Interaction contract — mobile click, keyboard, nested de-dup, desktop   */
/* ────────────────────────────────────────────────────────────────────────── */

/* Helper: build a My Trees card, attach to DOM, and dispatch an event.
   Returns card properties. Navigation (window.location.href = ...) is
   intercepted via page.route so we can count and inspect the target URL. */
async function buildCardAndInteract(page, tree, eventType, eventKey) {
  // Set up navigation interception via route
  let navCount = 0;
  let navUrl = null;
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.indexOf('editor') !== -1 || url.indexOf('view.html') !== -1) {
      navCount++;
      navUrl = url;
      route.abort();
    } else {
      route.continue();
    }
  });

  const cardInfo = await page.evaluate((args) => {
    const UI = window.LoveBudMyTreesUI;
    const tree = args.tree;

    const card = UI.buildTreeCard(tree, {
      i18n: function(k) { return k; },
      onSelect: function() {},
      isSelected: function() { return false; },
    });

    var resolved = UI.validateAndResolveEntryTargets(tree);
    var openHref = resolved && resolved.primary;

    document.body.appendChild(card);

    // Dispatch the event
    if (args.eventType === 'click') {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      card.dispatchEvent(event);
    } else if (args.eventType === 'keydown') {
      const event = new KeyboardEvent('keydown', { key: args.eventKey, bubbles: true, cancelable: true });
      card.dispatchEvent(event);
    }

    return {
      openHref: openHref,
      cardRole: card.getAttribute('role'),
      cardTabindex: card.getAttribute('tabindex'),
    };
  }, { tree, eventType, eventKey });

  // Wait for any potential navigation to be caught by route
  await page.waitForTimeout(300);

  return {
    navCount,
    navUrl,
    ...cardInfo,
  };
}

test('#3578 browser: My Trees mobile whole-card click → single appreciation navigation', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    const tree = {
      id: 'mt-mobile',
      title: 'Mobile Tree',
      visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await buildCardAndInteract(page, tree, 'click', null);

    assert.ok(result.openHref, 'Card must have resolved appreciation openHref');
    assert.equal(result.navCount, 1, `Mobile click must trigger navigation exactly once (got ${result.navCount})`);
    assert.ok(result.navUrl && result.navUrl.indexOf('mode=edit') === -1,
      'Navigation URL must not contain mode=edit');
    assert.equal(result.cardRole, 'button', 'Card must have role=button');
    assert.equal(result.cardTabindex, '0', 'Card must have tabindex=0');
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3578 browser: My Trees keyboard Enter → single appreciation activation', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    const tree = {
      id: 'mt-kb-enter',
      title: 'KB Enter Tree',
      visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await buildCardAndInteract(page, tree, 'keydown', 'Enter');

    assert.equal(result.navCount, 1, `Enter must trigger navigation exactly once (got ${result.navCount})`);
    assert.ok(result.navUrl && result.navUrl.indexOf('mode=edit') === -1,
      'Enter navigation must not contain mode=edit');
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3578 browser: My Trees keyboard Space → single appreciation activation', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    const tree = {
      id: 'mt-kb-space',
      title: 'KB Space Tree',
      visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await buildCardAndInteract(page, tree, 'keydown', ' ');

    assert.equal(result.navCount, 1, `Space must trigger navigation exactly once (got ${result.navCount})`);
    assert.ok(result.navUrl && result.navUrl.indexOf('mode=edit') === -1,
      'Space navigation must not contain mode=edit');
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3578 browser: nested action click does not duplicate root activation', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    // Set up navigation interception
    let navCount = 0;
    let navUrl = null;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.indexOf('editor') !== -1 || url.indexOf('view.html') !== -1) {
        navCount++;
        navUrl = url;
        route.abort();
      } else {
        route.continue();
      }
    });

    const tree = {
      id: 'mt-nested',
      title: 'Nested Click Tree',
      visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await page.evaluate((args) => {
      const UI = window.LoveBudMyTreesUI;
      const card = UI.buildTreeCard(args.tree, {
        i18n: function(k) { return k; },
        onSelect: function() {},
        isSelected: function() { return false; },
      });

      document.body.appendChild(card);

      // Click on a non-interactive child (title element) — should propagate to root
      // and trigger root activation exactly once
      const titleEl = card.querySelector('.tree-title, .love-tree-card-title');
      let hasTitleEl = !!titleEl;
      if (titleEl) {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        titleEl.dispatchEvent(event);
      }

      return { hasTitleEl };
    }, { tree });

    await page.waitForTimeout(300);

    // Clicking a non-interactive child (title) propagates to root → single navigation
    assert.ok(result.hasTitleEl, 'Card must have title element');
    assert.equal(navCount, 1, `Non-interactive child click must trigger root navigation exactly once (got ${navCount})`);
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3578 browser: desktop card click is selection-only (no immediate navigation)', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    // Desktop viewport
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    // Set up navigation interception
    let navCount = 0;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.indexOf('editor') !== -1 || url.indexOf('view.html') !== -1) {
        navCount++;
        route.abort();
      } else {
        route.continue();
      }
    });

    const tree = {
      id: 'mt-desktop',
      title: 'Desktop Tree',
      visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await page.evaluate((args) => {
      const UI = window.LoveBudMyTreesUI;

      let selectCount = 0;
      const card = UI.buildTreeCard(args.tree, {
        i18n: function(k) { return k; },
        onSelect: function() { selectCount++; },
        isSelected: function() { return false; },
      });

      document.body.appendChild(card);

      // Click on card body (not on open-link)
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      card.dispatchEvent(event);

      return {
        selectCount,
        hasRole: card.getAttribute('role'),
        hasTabindex: card.getAttribute('tabindex'),
      };
    }, { tree });

    await page.waitForTimeout(300);

    // Desktop: click must be selection-only, NO immediate navigation
    assert.equal(navCount, 0, `Desktop card click must NOT navigate (got ${navCount})`);
    assert.ok(result.selectCount >= 1, `Desktop card click must trigger select (got ${result.selectCount})`);
    assert.equal(result.hasRole, 'button', 'Card must have role=button');
    assert.equal(result.hasTabindex, '0', 'Card must have tabindex=0');
  } finally {
    await browser.close();
    server.close();
  }
});

test('#3602 browser: desktop card CTA direct click → appreciation navigation', { timeout: 60000 }, async (t) => {
  const port = await getFreePort();
  const server = startStaticServer();
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchChromiumOrThrow();
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    await page.goto(`${base}${FIXTURE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof window.LoveBudMyTreesUI !== 'undefined' &&
      typeof window.LoveBudMyTreesUI.buildTreeCard === 'function'
    );

    let navCount = 0;
    let navUrl = null;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.indexOf('editor') !== -1 || url.indexOf('view.html') !== -1) {
        navCount++;
        navUrl = url;
        route.abort();
      } else {
        route.continue();
      }
    });

    const tree = {
      id: 'mt-desktop-cta', title: 'Desktop CTA Tree', visibility: 'private',
      likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 2,
    };

    const result = await page.evaluate((args) => {
      const UI = window.LoveBudMyTreesUI;
      const card = UI.buildTreeCard(args.tree, {
        i18n: function(k) { return k; },
        onSelect: function() {},
        isSelected: function() { return false; },
      });
      document.body.appendChild(card);
      const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
      let hasOpenLink = !!openLink;
      if (openLink) {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        openLink.dispatchEvent(event);
      }
      return { hasOpenLink, href: openLink ? openLink.getAttribute('href') : null };
    }, { tree });

    await page.waitForTimeout(300);

    // Desktop CTA direct click must navigate exactly once to appreciation
    assert.ok(result.hasOpenLink, 'Desktop card must have a CTA open link');
    assert.equal(navCount, 1, `Desktop CTA click must navigate exactly once (got ${navCount})`);
    assert.ok(navUrl && navUrl.indexOf('mode=edit') === -1,
      'Desktop CTA navigation must not contain mode=edit');
  } finally {
    await browser.close();
    server.close();
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. XSS contract — each sink verified separately                            */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3578 browser: DOM escaping and XSS — title sink', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const payloads = [
      { title: '<em>title</em> & "quote"', label: 'normal-label' },
      { title: '<img src=x onerror=window.__xss=1>', label: 'img-onerror' },
      { title: '"><script>window.__xss=1</script>', label: 'script-inject' },
      { title: '"><span onclick=window.__xss=1>x</span>', label: 'span-onclick' },
    ];

    const results = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const sec = window.LoveBudSecurity;
      const base = args.base;

      // Reset XSS sentinel
      window.__xss = undefined;

      return args.payloads.map((p) => {
        const card = comp.buildTreeCard({ id: 'xss-' + p.label, title: p.title }, {
          surface: 'browse',
          title: p.title,
          primaryHref: base + '/pages/view.html?treeId=xss-test',
          primaryLabel: p.label,
          accessibilityLabel: p.title,
        });

        const titleEl = card.querySelector('.tree-title, .love-tree-card-title');
        const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
        const labelSpan = openLink ? openLink.querySelector('span:last-child') : null;

        return {
          titleTextContent: titleEl ? titleEl.textContent : null,
          hasGeneratedEm: card.querySelector('em') !== null,
          hasGeneratedScript: card.querySelector('script') !== null,
          hasGeneratedImg: card.querySelector('img[src="x"]') !== null,
          hasGeneratedSpan: card.querySelectorAll('span').length, // composition creates spans intentionally
          hasOnerror: card.querySelector('[onerror]') !== null,
          hasOnclick: card.querySelector('[onclick]') !== null,
          hrefContent: openLink ? openLink.getAttribute('href') : null,
          ariaLabel: card.getAttribute('aria-label'),
          windowXss: window.__xss,
        };
      });
    }, { payloads, base });

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const expectedTitle = payloads[i].title;
      assert.equal(r.titleTextContent, expectedTitle,
        `XSS ${i}: title textContent must match literal input (got: ${r.titleTextContent})`);
      assert.equal(r.hasGeneratedEm, false, `XSS ${i}: no <em> element generated`);
      assert.equal(r.hasGeneratedScript, false, `XSS ${i}: no <script> element generated`);
      assert.equal(r.hasGeneratedImg, false, `XSS ${i}: no <img src=x> element generated`);
      assert.equal(r.hasOnerror, false, `XSS ${i}: no onerror attribute anywhere`);
      assert.equal(r.hasOnclick, false, `XSS ${i}: no onclick attribute anywhere`);
      assert.ok(!r.hrefContent || !r.hrefContent.startsWith('javascript:'),
        `XSS ${i}: no javascript: in href`);
      // aria-label must be literal plain string, no double-escaped entity text
      assert.equal(r.ariaLabel, expectedTitle,
        `XSS ${i}: aria-label must be literal plain string (no entity double-escaping)`);
      assert.equal(r.windowXss, undefined, `XSS ${i}: window.__xss must remain unset`);
    }
  });
});

test('#3578 browser: DOM escaping — primary label and accessibility label', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const payload = { title: 'normal', label: '<em>label</em> & "quote"' };

    const result = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const base = args.base;
      window.__xss = undefined;

      const card = comp.buildTreeCard({ id: 'xss-label', title: args.payload.title }, {
        surface: 'browse',
        title: args.payload.title,
        primaryHref: base + '/pages/view.html?treeId=xss-label',
        primaryLabel: args.payload.label,
        accessibilityLabel: args.payload.title + ' ' + args.payload.label,
      });

      const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
      const labelSpan = openLink ? openLink.querySelector('span:last-child') : null;
      const linkAriaLabel = openLink ? openLink.getAttribute('aria-label') : null;
      const cardAriaLabel = card.getAttribute('aria-label');

      return {
        labelSpanTextContent: labelSpan ? labelSpan.textContent : null,
        linkAriaLabel: linkAriaLabel,
        cardAriaLabel: cardAriaLabel,
        hasGeneratedEmInLabel: openLink ? openLink.querySelector('em') !== null : false,
        hasEntityTextInAria: (cardAriaLabel || '').indexOf('&lt;') !== -1 || (cardAriaLabel || '').indexOf('&quot;') !== -1,
        windowXss: window.__xss,
      };
    }, { payload, base });

    assert.equal(result.labelSpanTextContent, payload.label,
      'Label textContent must match literal input (plain text, not escaped entity)');
    assert.equal(result.hasGeneratedEmInLabel, false, 'No <em> element generated in label');
    assert.equal(result.hasEntityTextInAria, false,
      'aria-label must NOT contain literal entity text (&lt;, &quot;) — no double escaping');
    assert.equal(result.windowXss, undefined, 'window.__xss must remain unset');
    // aria-label must be the literal plain string
    assert.equal(result.cardAriaLabel, payload.title + ' ' + payload.label,
      'Card aria-label must be literal plain string');
  });
});

test('#3578 browser: URL sanitization matrix — invalid URLs produce no action', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const urlCases = [
      { url: 'javascript:alert(1)', desc: 'javascript scheme', shouldCreate: false },
      { url: 'JaVaScRiPt:alert(1)', desc: 'mixed case javascript', shouldCreate: false },
      { url: '//evil.example/path', desc: 'protocol-relative', shouldCreate: false },
      { url: 'data:text/html,<script>window.__xss=1</script>', desc: 'data uri', shouldCreate: false },
      { url: '', desc: 'empty string', shouldCreate: false },
      { url: '   ', desc: 'whitespace string', shouldCreate: false },
      { url: base + '/pages/view.html?treeId=valid-1', desc: 'valid absolute URL', shouldCreate: true },
      // Composition must NOT inject mode=edit into URLs that don't have it
      { url: base + '/pages/view.html?treeId=valid-no-mode', desc: 'valid URL without mode=edit', shouldCreate: true },
      // Cross-origin http URL: composition sanitizeUrl only checks protocol,
      // not origin. Surface adapters must refuse cross-origin at their own
      // boundary (verified in the surface adapter tests). Composition itself
      // still renders an anchor for a syntactically valid http(s) URL.
      { url: 'http://evil.example/pages/view.html?treeId=cross', desc: 'cross-origin http (composition allows)', shouldCreate: true },
    ];

    const results = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      return args.cases.map((c) => {
        const card = comp.buildTreeCard({ id: 'url-' + c.desc.replace(/\s/g, '-'), title: 'URL Test' }, {
          surface: 'browse',
          title: 'URL Test',
          primaryHref: c.url,
          primaryLabel: 'Open',
          accessibilityLabel: 'URL Test',
        });
        const openLink = card.querySelector('.tree-card-open-link, .love-tree-card-open-link');
        const metaRight = card.querySelector('.tree-meta-right, .love-tree-card-meta-right');
        return {
          desc: c.desc,
          hasOpenLink: !!openLink,
          hasMetaRight: !!metaRight,
          href: openLink ? openLink.getAttribute('href') : null,
          hasModeEdit: openLink ? (openLink.getAttribute('href') || '').indexOf('mode=edit') !== -1 : false,
        };
      });
    }, { cases: urlCases, base });

    for (let i = 0; i < urlCases.length; i++) {
      const expected = urlCases[i];
      const actual = results[i];
      assert.equal(actual.hasOpenLink, expected.shouldCreate,
        `URL case "${expected.desc}": open link creation mismatch (expected ${expected.shouldCreate})`);
      if (!expected.shouldCreate) {
        assert.equal(actual.hasMetaRight, false,
          `URL case "${expected.desc}": meta-right wrapper must NOT be created for invalid URL`);
      }
      assert.equal(actual.hasModeEdit, false,
        `URL case "${expected.desc}": must NOT have mode=edit added`);
    }
  });
});

test('#3578 browser: XSS — no dangerous attributes or global side-effects anywhere in card', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const payload = {
      title: '<img src=x onerror=window.__xss=1>',
      label: '"><span onclick=window.__xss=1>x</span>',
    };

    const result = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const base = args.base;
      window.__xss = undefined;

      const card = comp.buildTreeCard({ id: 'xss-full', title: args.payload.title }, {
        surface: 'browse',
        title: args.payload.title,
        primaryHref: base + '/pages/view.html?treeId=xss-full',
        primaryLabel: args.payload.label,
        accessibilityLabel: args.payload.title,
      });

      return {
        hasOnclick: card.querySelector('[onclick]') !== null,
        hasOnerror: card.querySelector('[onerror]') !== null,
        hasScript: card.querySelector('script') !== null,
        hasImgSrcX: card.querySelector('img[src="x"]') !== null,
        hasJavascriptHref: card.querySelector('[href^="javascript:"]') !== null,
        windowXss: window.__xss,
        innerHtmlSnippet: card.innerHTML.substring(0, 200),
      };
    }, { payload, base });

    assert.equal(result.hasOnclick, false, 'Card must have no onclick attribute');
    assert.equal(result.hasOnerror, false, 'Card must have no onerror attribute');
    assert.equal(result.hasScript, false, 'Card must have no <script> element');
    assert.equal(result.hasImgSrcX, false, 'Card must have no img[src="x"]');
    assert.equal(result.hasJavascriptHref, false, 'Card must have no javascript: href');
    assert.equal(result.windowXss, undefined, 'window.__xss must remain unset');
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. Dependency fail-closed matrix                                           */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3578 browser: dependency fail-closed matrix — explicit errors for all missing deps', { timeout: 90000 }, async (t) => {
  // Each sub-case loads a fresh page with specific deps missing and verifies explicit error.
  const readModule = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  const cases = [
    {
      name: '1. LoveBudSecurity completely missing',
      scripts: [readModule('js/shared/tree-card-metrics.js'), readModule('js/shared/tree-card-composition.js')],
      expectedError: 'LoveBudSecurity',
    },
    {
      name: '2. LoveBudSecurity.escapeHtml missing',
      scripts: ['window.LoveBudSecurity = { sanitizeUrl: function(v){return v;} };',
                readModule('js/shared/tree-card-metrics.js'), readModule('js/shared/tree-card-composition.js')],
      expectedError: 'LoveBudSecurity',
    },
    {
      name: '3. LoveBudSecurity.sanitizeUrl missing',
      scripts: ['window.LoveBudSecurity = { escapeHtml: function(v){return v;} };',
                readModule('js/shared/tree-card-metrics.js'), readModule('js/shared/tree-card-composition.js')],
      expectedError: 'LoveBudSecurity',
    },
    {
      name: '4. LoveBudTreeCardMetrics completely missing',
      scripts: [readModule('js/utils/security.js'), readModule('js/shared/tree-card-composition.js')],
      expectedError: 'LoveBudTreeCardMetrics',
    },
    {
      name: '5. renderTreeReactionMetrics missing',
      scripts: [readModule('js/utils/security.js'),
                'window.LoveBudTreeCardMetrics = { getTreeMetrics: function() { return {}; } };',
                readModule('js/shared/tree-card-composition.js')],
      expectedError: 'LoveBudTreeCardMetrics',
    },
    {
      name: '6. metrics renderer throws',
      scripts: [readModule('js/utils/security.js'),
                'window.LoveBudTreeCardMetrics = { getTreeMetrics: function() { return {}; }, renderTreeReactionMetrics: function() { throw new Error("METRICS_BOOM"); } };',
                readModule('js/shared/tree-card-composition.js')],
      expectedError: 'Metrics rendering failed',
    },
    {
      name: '7. Browse renderer with composition missing',
      scripts: [readModule('js/utils/security.js'), readModule('js/shared/tree-card-metrics.js'),
                readModule('js/search/search-card-renderer.js')],
      expectedError: 'LoveBudTreeCardComposition',
    },
    {
      name: '8. My Trees UI with composition missing',
      scripts: [readModule('js/utils/security.js'), readModule('js/shared/tree-card-metrics.js'),
                readModule('js/my-trees/my-trees-ui.js')],
      expectedError: 'LoveBudTreeCardComposition',
    },
  ];

  for (const c of cases) {
    await t.test(c.name, async () => {
      const port = await getFreePort();
      const server = startStaticServer();
      await new Promise(r => server.listen(port, '127.0.0.1', r));
      const base = `http://127.0.0.1:${port}`;
      const browser = await launchChromiumOrThrow();
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        // Build an HTML page with only the specified scripts
        const html = `<!DOCTYPE html><html><body>
<script>window.LoveBudPath = { getBasePath: function() { return 'pages/'; } }; window.i18n = { currentLang: 'ko' }; window.t = function(k){return k;};</script>
${c.scripts.map(s => `<script>${s}</script>`).join('\n')}
</body></html>`;
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        const buildError = await page.evaluate(() => {
          try {
            // Try Browse renderer first if available, else composition direct, else my-trees-ui
            if (typeof window.LoveBudSearchCardRenderer !== 'undefined' && window.LoveBudSearchCardRenderer.renderTreeCard) {
              window.LoveBudSearchCardRenderer.renderTreeCard({ id: 'dep-test', title: 'T' }, { index: 0 });
              return 'no error thrown — FAIL';
            }
            if (typeof window.LoveBudMyTreesUI !== 'undefined' && window.LoveBudMyTreesUI.buildTreeCard) {
              window.LoveBudMyTreesUI.buildTreeCard({ id: 'dep-test', title: 'T', visibility: 'private' }, {});
              return 'no error thrown — FAIL';
            }
            if (typeof window.LoveBudTreeCardComposition !== 'undefined' && window.LoveBudTreeCardComposition.buildTreeCard) {
              window.LoveBudTreeCardComposition.buildTreeCard({ id: 'dep-test', title: 'T' }, {
                surface: 'browse', title: 'T', primaryHref: 'http://127.0.0.1/x', primaryLabel: 'Open', accessibilityLabel: 'T',
              });
              return 'no error thrown — FAIL';
            }
            return 'no target module loaded — FAIL';
          } catch (e) {
            return e.message || String(e);
          }
        });

        assert.ok(
          buildError.indexOf(c.expectedError) !== -1,
          `${c.name}: expected error containing "${c.expectedError}", got: "${buildError}"`
        );
        assert.ok(
          buildError.indexOf('FAIL') === -1,
          `${c.name}: must throw explicit error, not silently succeed`
        );
      } finally {
        await browser.close();
        server.close();
      }
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. Metrics contract — authoritative zero, unknown omission, order          */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3578 browser: metrics contract — authoritative zero, unknown omission, view/like/comment/share order', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const tree = {
      id: 'mt-metrics',
      title: 'Metrics Tree',
      visibility: 'public',
      viewCount: 0,      // authoritative zero → '0'
      likeCount: 5,      // positive → '5'
      commentCount: null, // unknown → omitted
      shareCount: undefined, // unknown → omitted
    };

    const result = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const base = args.base;

      const card = comp.buildTreeCard(args.tree, {
        surface: 'browse',
        title: args.tree.title,
        primaryHref: base + '/pages/view.html?treeId=' + args.tree.id,
        primaryLabel: 'Open',
        accessibilityLabel: args.tree.title,
      });

      const metrics = card.querySelector('.tree-card-reaction-metrics');
      if (!metrics) return { hasMetrics: false, items: [] };

      const items = Array.from(metrics.querySelectorAll('.tree-card-reaction-metric')).map((el) => {
        const icon = el.querySelector('.material-symbols-outlined');
        return {
          icon: icon ? icon.textContent : '',
          value: el.querySelector('span:last-child')?.textContent || '',
          title: el.getAttribute('title') || '',
        };
      });

      return { hasMetrics: true, items, metricsText: metrics.textContent };
    }, { tree, base });

    assert.ok(result.hasMetrics, 'Card must render metrics');
    assert.ok(result.items.length >= 2, 'At least views and likes must render');
    // First item must be views (icon: visibility)
    assert.equal(result.items[0].icon, 'visibility', 'First metric must be views (visibility icon)');
    assert.equal(result.items[0].value, '0', 'Authoritative zero viewCount must render as "0"');
    // Second item must be likes (icon: favorite)
    assert.equal(result.items[1].icon, 'favorite', 'Second metric must be likes (favorite icon)');
    assert.equal(result.items[1].value, '5', 'likeCount=5 must render as "5"');
    // comments and shares must be omitted (unknown)
    const icons = result.items.map(i => i.icon);
    assert.ok(icons.indexOf('chat_bubble') === -1, 'commentCount=null must be omitted');
    assert.ok(icons.indexOf('share') === -1, 'shareCount=undefined must be omitted');
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 8. Media slot contract — provided media is appended; optional when absent   */
/* ────────────────────────────────────────────────────────────────────────── */

test('#3578 browser: media slot — provided mediaNode is appended with legacy+shared class', { timeout: 60000 }, async (t) => {
  await withServerPage(t, async (page, base) => {
    const result = await page.evaluate((args) => {
      const comp = window.LoveBudTreeCardComposition;
      const base = args.base;

      // Case 1: mediaNode provided
      const media = document.createElement('img');
      media.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      media.alt = 'test media';

      const cardWithMedia = comp.buildTreeCard({ id: 'media-1', title: 'With Media' }, {
        surface: 'browse',
        title: 'With Media',
        primaryHref: base + '/pages/view.html?treeId=media-1',
        primaryLabel: 'Open',
        accessibilityLabel: 'With Media',
        mediaNode: media,
      });

      const mediaWrap = cardWithMedia.querySelector('.tree-card-media, .love-tree-card-media');
      const hasMediaChild = mediaWrap ? mediaWrap.querySelector('img') !== null : false;
      const hasLegacyClass = mediaWrap ? mediaWrap.classList.contains('tree-card-media') : false;
      const hasSharedClass = mediaWrap ? mediaWrap.classList.contains('love-tree-card-media') : false;

      // Case 2: no mediaNode provided
      const cardNoMedia = comp.buildTreeCard({ id: 'media-2', title: 'No Media' }, {
        surface: 'browse',
        title: 'No Media',
        primaryHref: base + '/pages/view.html?treeId=media-2',
        primaryLabel: 'Open',
        accessibilityLabel: 'No Media',
      });

      const noMediaWrap = cardNoMedia.querySelector('.tree-card-media, .love-tree-card-media');

      return {
        withMedia: {
          hasMediaWrap: !!mediaWrap,
          hasMediaChild,
          hasLegacyClass,
          hasSharedClass,
        },
        noMedia: {
          hasMediaWrap: !!noMediaWrap,
        },
      };
    }, { base });

    assert.ok(result.withMedia.hasMediaWrap, 'Card with mediaNode must have media wrapper');
    assert.ok(result.withMedia.hasMediaChild, 'Media child (img) must be appended to wrapper');
    assert.ok(result.withMedia.hasLegacyClass, 'Media wrapper must have legacy tree-card-media class');
    assert.ok(result.withMedia.hasSharedClass, 'Media wrapper must have shared love-tree-card-media class');
    assert.equal(result.noMedia.hasMediaWrap, false, 'Card without mediaNode must NOT have media wrapper');
  });
});
