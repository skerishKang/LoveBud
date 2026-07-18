/**
 * #3580 Owner appreciation tree-scope CSS visibility
 *
 * Production evidence: #detailTreeMetaMount was populated but parent
 * `.editor-tree-meta-section` stayed `display:none` for owner appreciation
 * because only `body.editor-readonly` restored visibility.
 *
 * This contract proves:
 * - source selector gates (public readonly + owner view)
 * - executed CSS cascade for view / edit / readonly bodies
 * - browser runtime: owner view shows positive geometry; right rail clean
 *
 * Layer: EXECUTED_FAKE (Playwright + local static server for cascade/browser bits)
 * Keep #3580 OPEN. Do not close #3577/#3578/#3581/#3582/#3425/#1882.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const OVERRIDES = fs.readFileSync(
  path.join(ROOT, 'css/editor/editor-overrides.css'),
  'utf8'
);
const EDITOR_CSS = fs.readFileSync(path.join(ROOT, 'css/editor.css'), 'utf8');
const EDITOR_HTML = fs.readFileSync(path.join(ROOT, 'pages/editor.html'), 'utf8');
const VIEW_HTML = fs.readFileSync(path.join(ROOT, 'pages/view.html'), 'utf8');

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

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
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
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ── A. Source / selector contracts ─────────────────────────────────

test('#3580 CSS: broad hide still includes .editor-tree-meta-section', () => {
  assert.match(
    OVERRIDES,
    /\.editor-tree-meta-section[\s\S]{0,120}display:\s*none\s*!important/,
    'broad hide of .editor-tree-meta-section must remain'
  );
});

test('#3580 CSS: public readonly restore remains', () => {
  assert.match(
    OVERRIDES,
    /body\.editor-readonly\s+\.editor-tree-meta-section\s*\{\s*display:\s*block\s*!important;/,
    'public readonly restore must remain'
  );
});

test('#3580 CSS: owner view restore is mode-gated and narrow', () => {
  assert.match(
    OVERRIDES,
    /body:not\(\.editor-readonly\)\[data-editor-interaction-mode="view"\]\s+\.editor-tree-meta-section\s*\{\s*display:\s*block\s*!important;/,
    'owner appreciation/view must restore tree-meta via interaction-mode=view'
  );
});

test('#3587 CSS: owner edit restore is mode-gated and narrow', () => {
  assert.match(
    OVERRIDES,
    /body:not\(\.editor-readonly\)\[data-editor-interaction-mode="edit"\]\s+\.editor-tree-meta-section\s*\{\s*display:\s*block\s*!important;/,
    'owner edit must restore tree-meta via interaction-mode=edit (#3587)'
  );
});

test('#3580 CSS: add-section remains edit-only', () => {
  assert.match(
    OVERRIDES,
    /body:not\(\.editor-readonly\)\[data-editor-interaction-mode="edit"\] \.editor-add-section-bottom/,
    'add-section restore must stay edit-mode only'
  );
  assert.doesNotMatch(
    OVERRIDES,
    /body:not\(\.editor-readonly\)\[data-editor-interaction-mode="view"\] \.editor-add-section-bottom/,
    'owner view must not restore add-section'
  );
});

test('#3580 asset: editor.css imports bumped overrides token', () => {
  assert.match(
    EDITOR_CSS,
    /@import\s+url\("\.\/editor\/editor-overrides\.css\?v=[a-f0-9]{8,}"\)/,
    'editor.css must import overrides with content fingerprint'
  );
  assert.ok(
    !EDITOR_CSS.includes('editor-overrides.css?v=20260712-3419-1'),
    'pre-#3580 overrides token must be retired'
  );
});

test('#3580 asset: editor.html and view.html load bumped editor.css', () => {
  assert.match(EDITOR_HTML, /href="\.\.\/css\/editor\.css\?v=\d{8}-[^"'\s>]+"/);
  assert.match(VIEW_HTML, /href="\.\.\/css\/editor\.css\?v=\d{8}-[^"'\s>]+"/);
  assert.ok(!EDITOR_HTML.includes('css/editor.css?v=20260716-3567-1'));
  assert.ok(!VIEW_HTML.includes('css/editor.css?v=20260716-3567-1'));
});

// ── B. Executed CSS cascade ────────────────────────────────────────

test('#3580 cascade: owner view shows tree-meta; edit keeps hide; readonly shows; add-section edit-only', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await browser.newPage();
    // Load real overrides via absolute path through static server.
    await page.setContent(
      `<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="${base}/css/editor/editor-overrides.css">
</head>
<body>
  <section class="editor-tree-meta-section appreciation-tree-scope" id="detailTreeMetaSection">
    <div id="detailTreeMetaMount"><div class="probe">TREE_META</div></div>
  </section>
  <section class="editor-add-section-bottom" id="addSectionProbe">ADD</section>
</body>
</html>`,
      { waitUntil: 'load' }
    );

    async function measure(bodyClass, mode) {
      return page.evaluate(
        ({ bodyClass, mode }) => {
          document.body.className = bodyClass || '';
          if (mode) document.body.setAttribute('data-editor-interaction-mode', mode);
          else document.body.removeAttribute('data-editor-interaction-mode');
          const sec = document.getElementById('detailTreeMetaSection');
          const add = document.getElementById('addSectionProbe');
          const mount = document.getElementById('detailTreeMetaMount');
          const r = mount.getBoundingClientRect();
          return {
            sectionDisplay: getComputedStyle(sec).display,
            addDisplay: getComputedStyle(add).display,
            mountW: Math.round(r.width),
            mountH: Math.round(r.height)
          };
        },
        { bodyClass, mode }
      );
    }

    const ownerView = await measure('', 'view');
    assert.notEqual(ownerView.sectionDisplay, 'none', 'owner view must show tree-meta section');
    assert.equal(ownerView.addDisplay, 'none', 'owner view must keep add-section hidden');
    assert.ok(ownerView.mountW > 0 && ownerView.mountH > 0, 'owner view mount positive geometry');

    const ownerEdit = await measure('', 'edit');
    assert.notEqual(ownerEdit.sectionDisplay, 'none', 'owner edit restores tree-meta section (#3587)');
    assert.notEqual(ownerEdit.addDisplay, 'none', 'owner edit restores add-section');

    const publicRo = await measure('editor-readonly', 'view');
    assert.notEqual(publicRo.sectionDisplay, 'none', 'public readonly must show tree-meta');
    assert.equal(publicRo.addDisplay, 'none', 'public readonly keeps add-section hidden');

    // No mode attribute: should remain hidden for non-readonly (fails closed to hide).
    const noMode = await measure('', null);
    assert.equal(noMode.sectionDisplay, 'none', 'without interaction mode, broad hide remains');

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

// ── C. Browser harness coupling (executed coverage lives in #3576 runtime) ──

test('#3580 BROWSER coupling: #3576 owner runtime asserts section visibility + geometry', () => {
  const ownerRuntime = fs.readFileSync(
    path.join(ROOT, 'tests/contracts/editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs'),
    'utf8'
  );
  assert.match(
    ownerRuntime,
    /sectionDisplay must not be none \(#3580\)/,
    'owner browser runtime must assert tree-meta section is not display:none'
  );
  assert.match(
    ownerRuntime,
    /mount positive geometry \(#3580\)/,
    'owner browser runtime must assert positive mount width/height'
  );
  assert.match(ownerRuntime, /mountRectW/);
  assert.match(ownerRuntime, /rightHasTreeMeta/);
  assert.match(ownerRuntime, /with-moments, moment change, tree change/);
});
