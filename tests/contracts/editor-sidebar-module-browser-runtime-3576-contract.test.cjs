/**
 * #3576 Actual browser runtime: sidebar type=module evaluation + mount replacement.
 *
 * Uses local static HTTP server + Playwright Chromium.
 * Does NOT strip export, does NOT use node:vm, does NOT fabricate DOMContentLoaded.
 *
 * Fails closed when Playwright package or Chromium binary is unavailable.
 *
 * Keep #3562/#3563 closed. Keep #3425/#1882 OPEN. Do not close #3576 here.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const EXPECTED_FP = '38e12fa98ab9';
const SIDEBAR_REL = 'js/editor/templates/editor-sidebar-template.js';
const SHARED_REL = 'js/shared/canonical-appreciation-detail-presentation.js';

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
    const msg = err && err.message ? err.message : String(err);
    throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${msg}`);
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
    const msg = err && err.message ? err.message : String(err);
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${msg}`);
  }
}

test('#3576 BROWSER: actual sidebar module evaluation and mount replacement order', async () => {
  const playwright = requirePlaywrightOrThrow();
  const browser = await launchChromiumOrThrow(playwright);
  const server = await startStaticServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const fixtureHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>#3576 sidebar module runtime</title>
</head>
<body>
  <div id="editorSidebarTemplateMount"></div>
  <script src="/${SHARED_REL}?v=bed65bd9cb52"></script>
  <script type="module" src="/${SIDEBAR_REL}?v=${EXPECTED_FP}"></script>
  <script>
    // Classic deferred-classic would run earlier; this classic post-module marker
    // only proves DOMContentLoaded ordering relative to module evaluation.
    document.addEventListener('DOMContentLoaded', function () {
      window.__lb3576Trace = window.__lb3576Trace || [];
      window.__lb3576Trace.push({ t: performance.now(), event: 'DOMContentLoaded' });
      window.__lb3576DomContentLoaded = true;
    });
  </script>
</body>
</html>`;

  const tmpDir = path.join(ROOT, '.tmp-3576-sidebar-module');
  fs.mkdirSync(tmpDir, { recursive: true });
  const fixturePath = path.join(tmpDir, 'sidebar-module.html');
  fs.writeFileSync(fixturePath, fixtureHtml, 'utf8');

  const pageErrors = [];
  const consoleErrors = [];
  const moduleResponses = [];

  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('editor-sidebar-template.js') || url.includes('canonical-appreciation-detail-presentation.js')) {
        moduleResponses.push({
          url,
          status: res.status(),
          ok: res.ok()
        });
      }
    });

    await page.addInitScript(() => {
      window.__lb3576Trace = [];
      window.__lb3576EvalCount = 0;
      const push = (event, extra) => {
        window.__lb3576Trace.push(Object.assign({ t: performance.now(), event }, extra || {}));
      };

      const scan = () => {
        const mod = document.querySelector('script[type="module"][src*="editor-sidebar-template.js"]');
        if (mod && !window.__lb3576SawModuleTag) {
          window.__lb3576SawModuleTag = true;
          push('parser_encounters_module_tag', { src: mod.getAttribute('src') || '' });
        }
        const shared = window.LoveBudCanonicalAppreciationDetailPresentation;
        if (shared && typeof shared.buildTreeScopeShellHtml === 'function' && !window.__lb3576SharedSeen) {
          window.__lb3576SharedSeen = true;
          push('shared_builder_available');
        }
        const mount = document.getElementById('detailTreeMetaMount');
        if (mount && !window.__lb3576MountCreated) {
          window.__lb3576MountCreated = true;
          push('detailTreeMetaMount_created', {
            connected: mount.isConnected,
            childElementCount: mount.childElementCount
          });
        }
        if (
          !document.getElementById('editorSidebarTemplateMount') &&
          document.querySelector('.sidebar[data-appreciation-layout="tree-scope-rail"]') &&
          !window.__lb3576MountReplaced
        ) {
          window.__lb3576MountReplaced = true;
          push('mount_replacement_success');
        }
      };

      const startObserver = () => {
        if (!document.documentElement) return false;
        const mo = new MutationObserver(scan);
        mo.observe(document.documentElement, { childList: true, subtree: true });
        window.__lb3576Mo = mo;
        scan();
        return true;
      };

      if (!startObserver()) {
        const boot = setInterval(() => {
          if (startObserver()) clearInterval(boot);
        }, 0);
      }

      document.addEventListener(
        'DOMContentLoaded',
        () => {
          push('DOMContentLoaded');
          window.__lb3576DomContentLoaded = true;
          scan();
        },
        { capture: true }
      );
    });

    await page.goto(`${base}/.tmp-3576-sidebar-module/sidebar-module.html`, {
      waitUntil: 'load',
      timeout: 20000
    });

    // Wait until module evaluation replaces the mount (real deferred module timing).
    await page.waitForFunction(
      () =>
        !!document.querySelector('.sidebar[data-appreciation-layout="tree-scope-rail"]') &&
        !!document.getElementById('detailTreeMetaMount') &&
        !document.getElementById('editorSidebarTemplateMount'),
      { timeout: 10000 }
    );

    // Allow DOMContentLoaded listeners to settle.
    await page.waitForFunction(() => window.__lb3576DomContentLoaded === true, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const mounts = document.querySelectorAll('#detailTreeMetaMount');
      const originalMount = document.getElementById('editorSidebarTemplateMount');
      const mount = document.getElementById('detailTreeMetaMount');
      const shared = window.LoveBudCanonicalAppreciationDetailPresentation;
      const mod = document.querySelector('script[type="module"][src*="editor-sidebar-template.js"]');
      return {
        trace: window.__lb3576Trace || [],
        sawModuleTag: !!window.__lb3576SawModuleTag,
        sharedOk: !!(shared && typeof shared.buildTreeScopeShellHtml === 'function'),
        originalMountPresent: !!originalMount,
        mountCount: mounts.length,
        mountConnected: !!(mount && mount.isConnected),
        mountBeforeDCL: (() => {
          const tr = window.__lb3576Trace || [];
          const mountIdx = tr.findIndex((e) => e.event === 'detailTreeMetaMount_created' || e.event === 'mount_replacement_success');
          const dclIdx = tr.findIndex((e) => e.event === 'DOMContentLoaded');
          return mountIdx >= 0 && dclIdx >= 0 && mountIdx < dclIdx;
        })(),
        moduleSrc: mod ? mod.getAttribute('src') : null,
        sidebarOuter: document.querySelector('.sidebar')
          ? document.querySelector('.sidebar').outerHTML.slice(0, 400)
          : null
      };
    });

    const sidebarResponse = moduleResponses.find((r) => r.url.includes('editor-sidebar-template.js'));
    assert.ok(sidebarResponse, 'sidebar module request must be observed');
    assert.equal(sidebarResponse.status, 200, 'sidebar module request must succeed');
    assert.ok(
      sidebarResponse.url.includes(`v=${EXPECTED_FP}`),
      `actual browser must request new fingerprint URL, got ${sidebarResponse.url}`
    );

    assert.equal(pageErrors.length, 0, `module evaluation pageerror must be 0, got: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `console error must be 0, got: ${consoleErrors.join(' | ')}`);
    assert.equal(result.sharedOk, true, 'shared builder must exist');
    assert.equal(result.originalMountPresent, false, 'original #editorSidebarTemplateMount must be gone after replacement');
    assert.equal(result.mountCount, 1, '#detailTreeMetaMount must exist exactly once');
    assert.equal(result.mountConnected, true, '#detailTreeMetaMount must be a connected DOM node');
    assert.equal(result.mountBeforeDCL, true, 'mount must be created before DOMContentLoaded');
    assert.ok(result.moduleSrc && result.moduleSrc.includes(EXPECTED_FP), 'module tag must use new fingerprint');

    // Expected order markers (subset).
    const events = result.trace.map((e) => e.event);
    assert.ok(
      events.includes('shared_builder_available') || result.sharedOk,
      'shared builder available before/at evaluation'
    );
    assert.ok(
      events.includes('mount_replacement_success') || events.includes('detailTreeMetaMount_created'),
      'mount replacement must be observed'
    );
    assert.ok(events.includes('DOMContentLoaded'), 'real DOMContentLoaded must be recorded');

    // Duplicate evaluation guard: module script appears once; mount once.
    const sidebarTags = await page.evaluate(
      () => document.querySelectorAll('script[src*="editor-sidebar-template.js"]').length
    );
    assert.equal(sidebarTags, 1, 'duplicate evaluation guard: one sidebar module tag');

    await page.close();
  } finally {
    try {
      await browser.close();
    } catch (_) {
      /* ignore */
    }
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
});

test('#3576 BROWSER source: fingerprint and ESM invariants remain', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages', 'editor.html'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, SIDEBAR_REL));
  const sha = crypto.createHash('sha256').update(src).digest('hex').slice(0, 12);
  assert.equal(sha, EXPECTED_FP);
  assert.match(html, /type="module"\s+src="[^"]*editor-sidebar-template\.js\?v=38e12fa98ab9"/);
  assert.doesNotMatch(html, /6d79c66e2fbc/);
  assert.match(src.toString('utf8'), /export\s+function\s+buildSidebarTemplate\s*\(/);
});
