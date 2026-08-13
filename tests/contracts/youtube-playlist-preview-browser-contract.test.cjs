/**
 * Browser contract test for the YouTube playlist preview UI
 * (js/import/youtube-playlist-preview-ui.js + js/api/import-youtube-playlist-preview.js)
 * — Issue #3914.
 *
 * Mounts the real preview surface against a MOCK provider route (fetch is
 * stubbed; no real Google API call). Verifies, per #3906 authority and #3903
 * tutorial contract:
 *   - accessible trigger: NOT permanently aria-hidden, focusable, aria-expanded
 *     toggles, focus moves into the input (desktop + keyboard)
 *   - accepted-source restriction: URL-looking input (including watch URLs
 *     with a list= param) is sent as `source`; only bare IDs become `playlistId`
 *   - input → submit → loading → ordered success preview
 *   - explicit unavailable/partial states, position preserved
 *   - deterministic placeholder when thumbnail is null
 *   - thumbnail LOAD FAILURE (404 image) → deterministic placeholder + explicit
 *     THUMBNAIL_UNAVAILABLE state (no multi-host retry)
 *   - bounded error shown, source editable, retry recovers
 *   - 50-item preview fully reachable via bounded scrolling (desktop + mobile)
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

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
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

function successPayload(itemCount) {
  const count = itemCount || 3;
  const items = [];
  for (let i = 0; i < count; i += 1) {
    if (i === 1) {
      items.push({
        position: 1,
        videoId: '',
        title: 'Private video',
        description: '',
        channelTitle: '테스트',
        thumbnailUrl: null,
        state: 'PRIVATE_OR_UNAVAILABLE',
        sourceUrl: '',
      });
    } else {
      items.push({
        position: i,
        videoId: 'v' + String(i).padStart(11, '0'),
        title: (i === 0 ? '첫 번째 영상' : (i === 2 ? '세 번째 영상' : '영상 ' + (i + 1))),
        description: '',
        channelTitle: '테스트',
        thumbnailUrl: null,
        state: 'AVAILABLE_METADATA',
        sourceUrl: 'https://www.youtube.com/watch?v=v' + String(i).padStart(11, '0'),
      });
    }
  }
  return {
    ok: true,
    playlist: { id: 'PLmock1234567890', title: '나의 추천 재생목록', channelTitle: '테스트 채널', itemCount: count, truncated: count > 50 },
    items,
    truncated: count > 50,
    totalItems: count,
    previewedItems: count,
  };
}

function mockPreviewScript() {
  const defaultPayload = JSON.stringify(successPayload(3));
  return [
    '<script>',
    '(function () {',
    "  window.__previewLogs = { calls: [], authCalls: [], mode: 'success', errorCode: 'PLAYLIST_NOT_FOUND', payload: null };",
    '  var originalFetch = window.fetch;',
    '  window.fetch = function (url, init) {',
    '    var u = String(url);',
    '    window.__previewLogs.calls.push({ url: u, init: init, body: init && init.body ? String(init.body) : null });',
    "    if (u.indexOf('/api/import/youtube/playlist/preview') !== -1) {",
    "      if (window.__previewLogs.mode === 'error') {",
    "        return Promise.resolve(new Response(JSON.stringify({ ok: false, error: { code: window.__previewLogs.errorCode, message: '재생목록을 찾을 수 없어요.' } }), { status: 404, headers: { 'content-type': 'application/json' } }));",
    '      }',
    '      var payload = window.__previewLogs.payload || JSON.parse(' + JSON.stringify(defaultPayload) + ');',
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
<div class="ypp-fab-root" id="youtubePlaylistPreviewFabRoot">
<button type="button" class="ypp-fab" id="youtubePlaylistPreviewOpenBtn" aria-expanded="false" aria-controls="youtubePlaylistPreviewPopover" aria-label="유튜브 재생목록 미리보기"><span class="material-symbols-outlined">playlist_play</span></button>
<section class="youtube-playlist-preview-popover" id="youtubePlaylistPreviewPopover" hidden role="dialog" aria-modal="false" aria-label="유튜브 재생목록 미리보기">
  <div class="ypp-popover-arrow" aria-hidden="true"></div>
  <div class="ypp-field">
    <p class="ypp-help">재생목록 페이지에서 주소창의 공개 링크를 복사해 붙여넣으세요.</p>
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

async function openAndSubmit(page, inputValue) {
  await page.click('#youtubePlaylistPreviewOpenBtn');
  await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
  await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewOpenBtn').getAttribute('aria-expanded') === 'true');
  await page.waitForTimeout(120);
  await page.fill('#youtubePlaylistPreviewInput', inputValue);
  await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
}

test('browser: trigger is accessible (not aria-hidden), opens as non-modal dialog, focuses input', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    const before = await page.evaluate(() => ({
      rootAriaHidden: document.getElementById('youtubePlaylistPreviewFabRoot').getAttribute('aria-hidden'),
      btnTag: document.getElementById('youtubePlaylistPreviewOpenBtn').tagName,
      popoverModal: document.getElementById('youtubePlaylistPreviewPopover').getAttribute('aria-modal'),
      popoverHidden: document.getElementById('youtubePlaylistPreviewPopover').hidden,
    }));
    assert.notEqual(before.rootAriaHidden, 'true', 'FAB wrapper must not be permanently aria-hidden');
    assert.equal(before.btnTag, 'BUTTON', 'trigger must be a focusable button');
    assert.equal(before.popoverModal, 'false', 'popover must not claim false modality');
    assert.equal(before.popoverHidden, true, 'popover starts closed');

    // Keyboard path: focus button, press Enter → opens and moves focus to input.
    await page.focus('#youtubePlaylistPreviewOpenBtn');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'youtubePlaylistPreviewInput');
    const expanded = await page.evaluate(() => document.getElementById('youtubePlaylistPreviewOpenBtn').getAttribute('aria-expanded'));
    assert.equal(expanded, 'true', 'aria-expanded must reflect open state');

    // Escape closes and returns focus to the trigger.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === true);
    const closedExpanded = await page.evaluate(() => document.getElementById('youtubePlaylistPreviewOpenBtn').getAttribute('aria-expanded'));
    assert.equal(closedExpanded, 'false', 'aria-expanded must reflect closed state');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: URL-looking input stays source; bare IDs become playlistId (source restriction)', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    // Watch URL with list= must NOT be smuggled as a bare playlistId.
    const watchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLAbCdEfGhIjKlMnOp';
    await openAndSubmit(page, watchUrl);
    await page.waitForFunction(() => window.__previewLogs.calls.length >= 1);
    const watchCall = await page.evaluate(() => {
      const last = window.__previewLogs.calls[window.__previewLogs.calls.length - 1];
      return last.body ? JSON.parse(last.body) : null;
    });
    assert.equal(watchCall.source, watchUrl, 'URL-looking input must be forwarded as source');
    assert.equal(watchCall.playlistId, undefined, 'list= value must never become a bare playlistId client-side');

    // Bare playlist ID stays playlistId.
    await page.fill('#youtubePlaylistPreviewInput', 'PLAbCdEfGhIjKlMnOp');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
    await page.waitForFunction(() => window.__previewLogs.calls.length >= 2);
    const bareCall = await page.evaluate(() => {
      const last = window.__previewLogs.calls[window.__previewLogs.calls.length - 1];
      return last.body ? JSON.parse(last.body) : null;
    });
    assert.equal(bareCall.playlistId, 'PLAbCdEfGhIjKlMnOp', 'bare ID must be sent as playlistId');
    assert.equal(bareCall.source, undefined);
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: preview input → submit → loading → ordered success preview (mock provider)', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    await openAndSubmit(page, 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await page.waitForSelector('.ypp-list', { timeout: 8000 });

    const summary = await page.evaluate(() => {
      const result = document.getElementById('youtubePlaylistPreviewResult');
      const rows = Array.from((result && result.querySelectorAll('.ypp-row')) || []);
      return {
        rows: rows.length,
        title: result && result.querySelector('.ypp-head h4') ? result.querySelector('.ypp-head h4').textContent : '',
        orders: rows.map((r) => (r.querySelector('.ypp-order') || {}).textContent || ''),
        states: rows.map((r) => (r.querySelector('.ypp-state') || {}).textContent || ''),
        authCalls: window.__previewLogs.authCalls.length,
        fetchCalls: window.__previewLogs.calls.length,
        authHeader: window.__previewLogs.calls[0] && window.__previewLogs.calls[0].init.headers.Authorization,
      };
    });
    assert.equal(summary.rows, 3);
    assert.equal(summary.title, '나의 추천 재생목록');
    assert.deepEqual(summary.orders, ['#1', '#2', '#3'], 'source order must be preserved (position+1)');
    assert.ok(summary.states.includes('비공개 또는 삭제됨'), 'unavailable item must be explicitly visible');
    assert.ok(summary.authCalls >= 1, 'client wrapper must request an auth header');
    assert.ok(summary.authHeader === 'Bearer mock-id-token', 'Authorization header must be attached');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: deterministic placeholder used when thumbnail is null', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    await openAndSubmit(page, 'https://www.youtube.com/playlist?list=PLtest1234567890');
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

test('browser: thumbnail LOAD FAILURE (404 image) → deterministic placeholder + THUMBNAIL_UNAVAILABLE, no retry chain', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    const payload = successPayload(2);
    payload.items[0] = {
      position: 0,
      videoId: 'v00000000001',
      title: '첫 번째 영상',
      description: '',
      channelTitle: '테스트',
      thumbnailUrl: '/__thumb_404_3914.jpg',
      state: 'AVAILABLE_METADATA',
      sourceUrl: 'https://www.youtube.com/watch?v=v00000000001',
    };
    await page.evaluate((p) => { window.__previewLogs.payload = p; }, payload);

    await openAndSubmit(page, 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await page.waitForSelector('.ypp-row[data-position="0"]');

    await page.waitForFunction(() => {
      const img = document.querySelector('.ypp-row[data-position="0"] .ypp-thumb img');
      return img && img.getAttribute('data-fallback') === '1' && img.src.startsWith('data:image/svg');
    }, { timeout: 8000 });

    const fallback = await page.evaluate(() => {
      const row = document.querySelector('.ypp-row[data-position="0"]');
      const img = row.querySelector('.ypp-thumb img');
      const badge = row.querySelector('.ypp-state');
      return {
        placeholder: img.src.startsWith('data:image/svg'),
        badgeText: badge.textContent.trim(),
        badgeClass: badge.className,
      };
    });
    assert.equal(fallback.placeholder, true, 'failed provider image must swap to the deterministic placeholder');
    assert.equal(fallback.badgeText, '썸네일 없음', 'row must surface explicit THUMBNAIL_UNAVAILABLE state');
    assert.ok(fallback.badgeClass.includes('ypp-state-thumbnail-unavailable'), 'state class must use canonical enum value');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: error is shown and user can edit + retry', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    await page.evaluate(() => { window.__previewLogs.mode = 'error'; });
    await openAndSubmit(page, 'https://www.youtube.com/playlist?list=PLbadbadbadbad');
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

test('browser: 50-item preview fully reachable via bounded scrolling (desktop)', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    const payload = successPayload(50);
    await page.evaluate((p) => { window.__previewLogs.payload = p; }, payload);
    await openAndSubmit(page, 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await page.waitForSelector('.ypp-row[data-position="49"]', { timeout: 10000 });

    const reachable = await page.evaluate(() => {
      const region = document.querySelector('.ypp-result');
      const lastRow = document.querySelector('.ypp-row[data-position="49"]');
      if (!region || !lastRow) return { found: false };
      region.scrollTop = region.scrollHeight;
      const rr = region.getBoundingClientRect();
      const lr = lastRow.getBoundingClientRect();
      return {
        found: true,
        scrollable: region.scrollHeight > region.clientHeight,
        inView: lr.top >= rr.top - 1 && lr.bottom <= rr.bottom + 1,
      };
    });
    assert.equal(reachable.found, true, 'item 50 must render');
    assert.equal(reachable.scrollable, true, 'result region must provide bounded vertical scrolling');
    assert.equal(reachable.inView, true, 'item 50 must be reachable after scrolling');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});

test('browser: preview flow works and item 50 is reachable on mobile viewport', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture-preview.html`);

    await page.click('#youtubePlaylistPreviewOpenBtn');
    await page.waitForFunction(() => document.getElementById('youtubePlaylistPreviewPopover').hidden === false);
    await page.waitForTimeout(120);

    const payload = successPayload(50);
    await page.evaluate((p) => { window.__previewLogs.payload = p; }, payload);
    await page.fill('#youtubePlaylistPreviewInput', 'https://www.youtube.com/playlist?list=PLtest1234567890');
    await clickStable(page, '#youtubePlaylistPreviewSubmitBtn');
    await page.waitForSelector('.ypp-row[data-position="49"]', { timeout: 10000 });

    const reachable = await page.evaluate(() => {
      const region = document.querySelector('.ypp-result');
      const lastRow = document.querySelector('.ypp-row[data-position="49"]');
      if (!region || !lastRow) return { found: false };
      region.scrollTop = region.scrollHeight;
      const rr = region.getBoundingClientRect();
      const lr = lastRow.getBoundingClientRect();
      const panel = document.getElementById('youtubePlaylistPreviewPopover').getBoundingClientRect();
      return {
        found: true,
        scrollable: region.scrollHeight > region.clientHeight,
        inView: lr.top >= rr.top - 1 && lr.bottom <= rr.bottom + 1,
        panelWithinViewport: panel.left >= 0 && panel.right <= window.innerWidth + 1,
      };
    });
    assert.equal(reachable.found, true, 'item 50 must render on mobile');
    assert.equal(reachable.scrollable, true, 'mobile result region must scroll');
    assert.equal(reachable.inView, true, 'item 50 must be reachable on mobile');
    assert.equal(reachable.panelWithinViewport, true, 'popover must stay within the mobile viewport');
  } finally {
    await closeServer(server);
    await browser.close();
  }
});
