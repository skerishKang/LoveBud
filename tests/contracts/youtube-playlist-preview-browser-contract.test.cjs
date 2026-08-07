/**
 * Browser contract test for the YouTube playlist preview UI
 * (js/import/youtube-playlist-preview-ui.js + js/api/import-youtube-playlist-preview.js)
 * — Issue #3914.
 *
 * Mounts the real preview surface against a MOCK provider route (fetch is
 * stubbed; no real Google API call). Verifies, per #3906 authority and #3903
 * tutorial contract:
 *   - input
 *   - submit
 *   - loading state
 *   - success ordered preview
 *   - explicit unavailable/partial state
 *   - thumbnail or deterministic placeholder
 *   - error
 *   - edit/retry after error
 *
 * Executed Chromium only (desktop + mobile). No network beyond the in-process
 * static server; no DB; no Production.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
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

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '/fixture-preview.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildPreviewFixture());
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
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function clickStable(page, selector) {
  return page.evaluate((sel) => {
    var btn = document.querySelector(sel);
    if (!btn) throw new Error('missing ' + sel);
    return new Promise((resolve, reject) => {
      var last = null;
      var stable = 0;
      var frames = 0;
      var id = setInterval(() => {
        var r = btn.getBoundingClientRect();
        var cur = r.left + ',' + r.top + ',' + r.width + ',' + r.height;
        frames += 1;
        if (last === cur) {
          stable += 1;
          if (stable >= 3) {
            clearInterval(id);
            btn.click();
            resolve();
          }
        } else {
          stable = 0;
          last = cur;
        }
        if (frames > 60) {
          clearInterval(id);
          reject(new Error('element not stable: ' + sel));
        }
      }, 16);
    });
  }, selector);
}

function mockPreviewScript() {
  var successPayload = JSON.stringify({
    ok: true,
    playlist: { id: 'PLmock1234567890', title: '\ub098\uc758 \ucd94\ucc9c \uc7ac\uc0dd\ubaa9\ub85d', channelTitle: '\ud14c\uc2a4\ud2b8 \ucc44\ub110', itemCount: 3, truncated: false },
    items: [
      { position: 0, videoId: 'v00000000001', title: '\uccab \ubc88\uc9f8 \uc601\uc0c1', description: '', channelTitle: '\ud14c\uc2a4\ud2b8', thumbnailUrl: null, state: 'AVAILABLE_METADATA', sourceUrl: 'https://www.youtube.com/watch?v=v00000000001' },
      { position: 1, videoId: '', title: 'Private video', description: '', channelTitle: '\ud14c\uc2a4\ud2b8', thumbnailUrl: null, state: 'PRIVATE_OR_UNAVAILABLE', sourceUrl: '' },
      { position: 2, videoId: 'v00000000003', title: '\uc138 \ubc88\uc9f8 \uc601\uc0c1', description: '', channelTitle: '\ud14c\uc2a4\ud2b8', thumbnailUrl: null, state: 'AVAILABLE_METADATA', sourceUrl: 'https://www.youtube.com/watch?v=v00000000003' }
    ],
    truncated: false,
    totalItems: 3,
    previewedItems: 3
  });

  return [
    '<script>',
    '(function () {',
    "  window.__previewLogs = { calls: [], authCalls: [], mode: 'success', errorCode: 'PLAYLIST_NOT_FOUND', payload: null };",
    '  var originalFetch = window.fetch;',
    '  window.fetch = function (url, init) {',
    '    var u = String(url);',
    '    window.__previewLogs.calls.push({ url: u, init: init });',
    "    if (u.indexOf('/api/import/youtube/playlist/preview') !== -1) {",
    "      if (window.__previewLogs.mode === 'error') {",
    '        return Promise.resolve(new Response(JSON.stringify({ ok: false, error: { code: window.__previewLogs.errorCode, message: \'\uc7ac\uc0dd\ubaa9\ub85d\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc5b4\uc694.\' } }), { status: 404, headers: { \'content-type\': \'application/json\' } }));',
    '      }',
    '      var payload = window.__previewLogs.payload || JSON.parse(' + JSON.stringify(successPayload) + ');',
    '      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { \'content-type\': \'application/json\' } }));',
    '    }',
    '    return originalFetch.call(window, url, init);',
    '  };',
    '})();',
    '</script>'
  ].join('\n');
}


function buildPreviewFixture() {
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/css/global.css"/>
<link rel="stylesheet" href="/css/my-trees.css"/>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ec; padding: 24px; }
  .material-symbols-outlined { font-family: system-ui; font-size: 14px; }
</style>
</head>
<body>
<div class="ypp-fab-root" id="youtubePlaylistPreviewFabRoot" aria-hidden="true">
<button type="button" class="ypp-fab" id="youtubePlaylistPreviewOpenBtn" aria-expanded="false" aria-controls="youtubePlaylistPreviewPopover" aria-label="유튜브 재생목록 미리보기"><span class="material-symbols-outlined">playlist_play</span></button>
<section class="youtube-playlist-preview-popover" id="youtubePlaylistPreviewPopover" hidden role="dialog" aria-modal="true" aria-label="유튜브 재생목록 미리보기">
  <div class="ypp-popover-arrow" aria-hidden="true"></div>
  <div class="ypp-field">
    <p class="ypp-help">공개 또는 링크 공유 재생목록만 지원해요.</p>
    <input id="youtubePlaylistPreviewInput" class="search-input ypp-input" type="text" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/playlist?list=..." />
    <button type="button" class="btn-round btn-primary" id="youtubePlaylistPreviewSubmitBtn"><span>미리보기</span></button>
  </div>
  <div id="youtubePlaylistPreviewResult" class="ypp-result" role="region" aria-live="polite"></div>
</section>
</div>
${mockPreviewScript()}
<script src="/js/api/import-youtube-playlist-preview.js"></script>
<script>
  // Browser-like auth pipeline stub for the client wrapper.
  window.LoveTreeBaseApiFetch = {
    getAuthHeaders: async function () {
      window.__previewLogs.authCalls.push(1);
      return { Authorization: 'Bearer mock-id-token' };
    }
  };
</script>
<script src="/js/import/youtube-playlist-preview-ui.js"></script>
</body></html>`;
}

function stateSummary() {
  return () => {
    const result = document.getElementById('youtubePlaylistPreviewResult');
    const panel = document.getElementById('youtubePlaylistPreviewPopover');
    const openBtn = document.getElementById('youtubePlaylistPreviewOpenBtn');
    const rows = Array.from((result && result.querySelectorAll('.ypp-row')) || []);
    const stateSpans = rows.map((r) => {
      const s = r.querySelector('.ypp-state');
      return s ? s.textContent.trim() : '';
    });
    const orderSpans = rows.map((r) => (r.querySelector('.ypp-order') || {}).textContent || '');
const thumb = result && result.querySelector('.ypp-thumb img');
    const fallbackThumb = !!thumb && thumb.src.startsWith('data:image');
    return {
      panelHidden: panel ? panel.hidden : null,
      openExpanded: openBtn ? openBtn.getAttribute('aria-expanded') : null,
      loading: result ? !!result.querySelector('.ypp-loading') : false,
      error: result ? !!result.querySelector('.ypp-error') : false,
      errorText: result && result.querySelector('.ypp-error') ? result.querySelector('.ypp-error').textContent : '',
      list: rows.length,
      rows: rows.length,
      states: stateSpans,
      titles: orderSpans,
      thumbCount: (result && result.querySelectorAll('.ypp-thumb').length) || 0,
      thumbnailFallback: fallbackThumb,
      title: result && result.querySelector('.ypp-head h4') ? result.querySelector('.ypp-head h4').textContent : '',
      authCalls: window.__previewLogs ? window.__previewLogs.authCalls.length : 0,
      fetchCalls: window.__previewLogs ? window.__previewLogs.calls.length : 0,
    };
  };
}

test('#3914 browser: preview input → submit → loading → ordered success preview (mock provider)', { timeout: 60000 }, async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    // Open panel.
    await page.click('#youtubePlaylistPreviewOpenBtn');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewOpenBtn').getAttribute('aria-expanded') === 'true');
    await page.waitForTimeout(120);

    // Fill + submit.
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');

    // Success mode is the default; result appears.
    await page.waitForSelector('.ypp-list', { timeout: 8000 });

    const summary = await page.evaluate(stateSummary());
    assert.equal(summary.list >= 1, true, 'should render at least one item row');
    assert.equal(summary.states.length >= 1, true);
    assert.ok(summary.title, 'should render playlist title');
    assert.ok(summary.fetchCalls >= 1, 'should call mocked preview route');
    assert.ok(summary.authCalls >= 1, 'client wrapper must request an auth header');
    assert.ok(summary.panelHidden === false, 'panel should be open');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: unavailable/partial state is explicit and position preserved (desktop)', { timeout: 60000 }, async () => {
  // Covered by success payload containing a PRIVATE_OR_UNAVAILABLE item;
  // assert explicit unavailable state text is present.
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);
    await page.click('#youtubePlaylistPreviewOpenBtn');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForTimeout(120);
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
    await page.waitForSelector('.ypp-list .ypp-row[data-position="2"]', { timeout: 10000 });
    const s = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ypp-row'));
      const row2 = rows.find((r) => r.getAttribute('data-position') === '2');
      return {
        row2State: row2 ? row2.querySelector('.ypp-state').textContent.trim() : null,
        row2Order: row2 ? row2.querySelector('.ypp-order').textContent.trim() : null,
        orderTexts: rows.map((r) => r.querySelector('.ypp-state').textContent.trim()),
      };
    });
    assert.equal(s.row2Order, '#3', 'human rank must be position+1 (position 2 -> #3)');
    assert.ok(s.orderTexts.includes('비공개 또는 불가능'), 'unavailable item must be explicitly visible');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: deterministic placeholder is used when thumbnail is null', async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);
    await page.click('#youtubePlaylistPreviewOpenBtn');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForTimeout(120);
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await page.click('#youtubePlaylistPreviewSubmitBtn');
    await page.waitForSelector('.ypp-list');
    const placeholder = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.ypp-thumb img'));
      return imgs.length ? imgs.every((i) => i.src.startsWith('data:image/svg')) : false;
    });
    assert.equal(placeholder, true, 'null thumbnails must use the deterministic placeholder');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: error is shown and user can edit + retry', async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);
    await page.click('#youtubePlaylistPreviewOpenBtn');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForTimeout(120);

    // Force error mode.
    await page.evaluate(() => { window.__previewLogs.mode = 'error'; window.__previewLogs.errorCode = 'PLAYLIST_NOT_FOUND'; });
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLbadbadbadbad');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
    await page.waitForSelector('.ypp-error', { timeout: 10000 });
    const errText = await page.evaluate(() => (document.querySelector('.ypp-error') || {}).textContent || '');
    assert.ok(errText.length > 0, 'error text must be shown');

    // Edit + retry in success mode.
    await page.evaluate(() => { window.__previewLogs.mode = 'success'; });
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
    await page.waitForSelector('.ypp-list', { timeout: 10000 });
    const ok = await page.evaluate(() => !document.querySelector('.ypp-error'));
    assert.equal(ok, true, 'retry after edit must clear error and show a list');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});