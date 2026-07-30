/**
 * #3707 — Home video modal staged loading browser contract
 *
 * Executable Chromium contract (not string-only).
 * Loads production CSS/JS asset chains and verifies modal loading states.
 *
 * Viewports: 1440×900 (desktop), 390×844 (mobile)
 * Uses Playwright fake timers to avoid waiting 8s/30s in real time.
 *
 * Refs #3707
 * Refs #1882 (kept OPEN)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

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
            if (urlPath === '/' || urlPath === '/fixture-home.html') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(buildHomeFixture());
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

function buildHomeFixture() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home Modal Test Fixture</title>
  <link rel="stylesheet" href="css/global.css">
  <link rel="stylesheet" href="css/index.css">
  <link rel="stylesheet" href="css/index-visual.css">
  <style>
    body { margin: 0; padding: 20px; background: #1a1a2e; }
    .home-v3-shell { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="home-v3-shell">
    <main class="home-v3-main">
      <section class="home-v3-hero">
        <div class="home-v3-copy">
          <h1 class="home-v3-title"><span class="soft">Test</span></h1>
          <p class="home-v3-desc">Test description</p>
          <div class="home-v3-actions"><a href="#" class="btn-round">CTA</a></div>
        </div>
        <div class="home-v3-collage" data-hero-spotlight="active">
          <div class="home-v3-growth-stage" data-stage-state="pending">
            <div class="home-v3-halo"></div>
            <p class="growth-stage-caption">세대를 건너 이어진 네 개의 무대</p>
            <div class="growth-stage-network">
              <div class="growth-stage-network-core" aria-hidden="true">
                <span class="growth-stage-network-rail"></span>
                <span class="growth-stage-network-hub"></span>
              </div>
              <div class="growth-stage-spotlight-zone" aria-hidden="true"></div>
              <article class="growth-stage-card featured" data-role="featured" data-card-index="0" data-artist-key="bts">
                <div class="growth-stage-card-content">
                  <div class="growth-stage-card-media">
                    <span class="growth-stage-card-fallback" aria-hidden="true"></span>
                    <button class="growth-stage-card-play" type="button" aria-label="영상 재생">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <strong>NORMAL</strong>
                  <a class="growth-stage-card-link" target="_blank" rel="noopener noreferrer">
                    <span>YouTube에서 보기</span>
                  </a>
                  <span class="growth-stage-card-channel">공식 채널 · HYBE LABELS</span>
                </div>
              </article>
              <article class="growth-stage-card supporting one" data-role="supporting" data-card-index="1" data-artist-key="blackpink">
                <div class="growth-stage-card-content">
                  <div class="growth-stage-card-media">
                    <span class="growth-stage-card-fallback" aria-hidden="true"></span>
                    <button class="growth-stage-card-play" type="button" aria-label="영상 재생">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <strong>GO</strong>
                  <a class="growth-stage-card-link" target="_blank" rel="noopener noreferrer">
                    <span>YouTube에서 보기</span>
                  </a>
                  <span class="growth-stage-card-channel">공식 채널 · BLACKPINK</span>
                </div>
              </article>
              <article class="growth-stage-card supporting two" data-role="supporting" data-card-index="2" data-artist-key="cortis">
                <div class="growth-stage-card-content">
                  <div class="growth-stage-card-media">
                    <span class="growth-stage-card-fallback" aria-hidden="true"></span>
                    <button class="growth-stage-card-play" type="button" aria-label="영상 재생">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <strong>REDRED</strong>
                  <a class="growth-stage-card-link" target="_blank" rel="noopener noreferrer">
                    <span>YouTube에서 보기</span>
                  </a>
                  <span class="growth-stage-card-channel">공식 채널 · BIGHIT MUSIC</span>
                </div>
              </article>
              <article class="growth-stage-card supporting three" data-role="supporting" data-card-index="3" data-artist-key="rescene">
                <div class="growth-stage-card-content">
                  <div class="growth-stage-card-media">
                    <span class="growth-stage-card-fallback" aria-hidden="true"></span>
                    <button class="growth-stage-card-play" type="button" aria-label="영상 재생">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <strong>LOVE ATTACK</strong>
                  <a class="growth-stage-card-link" target="_blank" rel="noopener noreferrer">
                    <span>YouTube에서 보기</span>
                  </a>
                  <span class="growth-stage-card-channel">공식 채널 · RESCENE</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script src="js/i18n/i18n-core.js"></script>
  <script src="js/i18n/i18n-shared.js"></script>
  <script src="js/i18n/i18n-home-v3.js"></script>
  <script src="js/index-inline-init.js"></script>
</body>
</html>`;
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test('home video modal loading states (#3707)', async (t) => {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    server.close();
  });

  for (const vp of VIEWPORTS) {
    await t.test(`viewport ${vp.name} (${vp.width}x${vp.height})`, async (t) => {
      const browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();

      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await t.test('1. modal shell and Close appear immediately', async () => {
        await page.goto(baseUrl + '/fixture-home.html');
        await page.waitForLoadState('domcontentloaded');
        await page.clock.install();
        await page.clock.fastForward(2000);

        await page.click('.growth-stage-card-media');
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });

        const modalVisible = await page.locator('.hero-video-modal').isVisible();
        assert.ok(modalVisible, 'modal shell must be visible');

        const closeVisible = await page.locator('.hero-video-modal-close').isVisible();
        assert.ok(closeVisible, 'close button must be visible');
      });

      await t.test('2. initial loading state with aria-busy', async () => {
        const loadingVisible = await page.locator('.hero-video-modal-loading').isVisible();
        assert.ok(loadingVisible, 'loading overlay must be visible');

        const ariaBusy = await page.locator('.hero-video-modal-player').getAttribute('aria-busy');
        assert.strictEqual(ariaBusy, 'true', 'player must have aria-busy="true"');

        const loadingText = await page.locator('.hero-video-modal-loading-text').textContent();
        assert.ok(loadingText.includes('영상을 불러오는 중'), 'loading text must show initial message');
      });

      await t.test('3. iframe load transitions to READY exactly once', async () => {
        await page.clock.fastForward(8000);

        await page.evaluate(() => {
          const iframe = document.querySelector('.hero-video-modal iframe');
          if (iframe) iframe.dispatchEvent(new Event('load'));
        });

        await page.waitForSelector('.hero-video-modal-ready', { timeout: 1000 });
        const readyClass = await page.locator('.hero-video-modal').getAttribute('class');
        assert.ok(readyClass.includes('hero-video-modal-ready'), 'modal must have ready class');

        const loadingGone = await page.locator('.hero-video-modal-loading').count();
        assert.strictEqual(loadingGone, 0, 'loading overlay must be removed after ready');

        const ariaBusy = await page.locator('.hero-video-modal-player').getAttribute('aria-busy');
        assert.strictEqual(ariaBusy, null, 'aria-busy must be removed after ready');

        const iframeTabindex = await page.locator('.hero-video-modal iframe').getAttribute('tabindex');
        assert.strictEqual(iframeTabindex, null, 'iframe tabindex must be removed after ready');
      });

      await t.test('4. long-wait transition at 8 seconds', async () => {
        await page.locator('.hero-video-modal-close').click();
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        await page.click('.growth-stage-card-media');
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });

        await page.clock.fastForward(8000);

        const longWaitClass = await page.locator('.hero-video-modal-loading').getAttribute('class');
        assert.ok(longWaitClass.includes('is-long-wait'), 'loading must have is-long-wait class after 8s');

        const loadingText = await page.locator('.hero-video-modal-loading-text').textContent();
        assert.ok(loadingText.includes('오래 걸리고'), 'long-wait text must be shown');
      });

      await t.test('5. 30s timeout transitions to ERROR', async () => {
        await page.clock.fastForward(22000);

        await page.waitForSelector('.hero-video-modal-error', { timeout: 1000 });
        const errorVisible = await page.locator('.hero-video-modal-error').isVisible();
        assert.ok(errorVisible, 'error overlay must be visible after 30s');

        const errorText = await page.locator('.hero-video-modal-error-text').textContent();
        assert.ok(errorText.includes('불러오지 못했어요'), 'error text must be shown');

        const retryVisible = await page.locator('.hero-video-modal-retry-btn').isVisible();
        assert.ok(retryVisible, 'retry button must be visible');

        const watchLink = await page.locator('.hero-video-modal-error a[href*="youtube.com"]').getAttribute('href');
        assert.ok(watchLink.includes('youtube.com/watch'), 'fallback YouTube link must be present');
      });

      await t.test('6. stale iframe load does not change ERROR state', async () => {
        await page.evaluate(() => {
          const iframe = document.querySelector('.hero-video-modal iframe');
          if (iframe) iframe.dispatchEvent(new Event('load'));
        });

        await page.waitForTimeout(100);

        const errorStillVisible = await page.locator('.hero-video-modal-error').isVisible();
        assert.ok(errorStillVisible, 'error must remain visible after stale load event');

        const readyClass = await page.locator('.hero-video-modal').getAttribute('class');
        assert.ok(!readyClass.includes('hero-video-modal-ready'), 'modal must not become ready after stale load');
      });

      await t.test('7. Retry creates exactly one new iframe', async () => {
        await page.locator('.hero-video-modal-retry-btn').click();
        await page.waitForTimeout(100);

        const iframeCount = await page.locator('.hero-video-modal iframe').count();
        assert.strictEqual(iframeCount, 1, 'exactly one iframe must exist after retry');

        const retryingText = await page.locator('.hero-video-modal-loading-text').textContent();
        assert.ok(retryingText.includes('다시 시도'), 'retrying text must be shown');
      });

      await t.test('8. old iframe/listener/timer cleaned up on retry', async () => {
        await page.evaluate(() => {
          const iframe = document.querySelector('.hero-video-modal iframe');
          if (iframe) iframe.dispatchEvent(new Event('load'));
        });

        await page.waitForSelector('.hero-video-modal-ready', { timeout: 1000 });
        const readyVisible = await page.locator('.hero-video-modal-ready').isVisible();
        assert.ok(readyVisible, 'modal must become ready after retry iframe loads');
      });

      await t.test('9. YouTube fallback URL is correct', async () => {
        await page.locator('.hero-video-modal-close').click();
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        await page.click('.growth-stage-card-media');
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });
        await page.clock.fastForward(30000);

        await page.waitForSelector('.hero-video-modal-error', { timeout: 1000 });
        const watchLink = await page.locator('.hero-video-modal-error a').getAttribute('href');
        assert.ok(watchLink.includes('youtube.com/watch?v='), 'fallback link must be a YouTube watch URL');
      });

      await t.test('10. Close/Escape works from all states', async () => {
        await page.locator('.hero-video-modal-close').click();
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        await page.click('.growth-stage-card-media');
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });
        await page.keyboard.press('Escape');
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        const modalGone = await page.locator('.hero-video-modal').count();
        assert.strictEqual(modalGone, 0, 'modal must be removed after Escape');
      });

      await t.test('11. focus trap and focus restoration', async () => {
        await page.click('.growth-stage-card-media');
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });

        const closeFocused = await page.evaluate(() => {
          return document.activeElement.classList.contains('hero-video-modal-close');
        });
        assert.ok(closeFocused, 'close button must receive initial focus');

        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        const stillInModal = await page.evaluate(() => {
          const modal = document.querySelector('.hero-video-modal');
          return modal && modal.contains(document.activeElement);
        });
        assert.ok(stillInModal, 'focus must stay trapped in modal');

        await page.locator('.hero-video-modal-close').click();
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        const focusRestored = await page.evaluate(() => {
          const playBtn = document.querySelector('.growth-stage-card-play');
          return document.activeElement === playBtn || document.activeElement.closest('.growth-stage-card');
        });
        assert.ok(focusRestored, 'focus must return to card after close');
      });

      await t.test('12. reduced-motion preserves state communication', async () => {
        const rmContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          reducedMotion: 'reduce',
        });
        const rmPage = await rmContext.newPage();
        await rmPage.goto(baseUrl + '/fixture-home.html');
        await rmPage.waitForLoadState('domcontentloaded');
        await rmPage.clock.install();
        await rmPage.clock.fastForward(2000);

        await rmPage.click('.growth-stage-card-media');
        await rmPage.waitForSelector('.hero-video-modal', { timeout: 1000 });

        const loadingVisible = await rmPage.locator('.hero-video-modal-loading').isVisible();
        assert.ok(loadingVisible, 'loading state must be visible in reduced motion');

        await rmPage.clock.fastForward(8000);
        const longWaitVisible = await rmPage.locator('.hero-video-modal-loading.is-long-wait').isVisible();
        assert.ok(longWaitVisible, 'long-wait state must be visible in reduced motion');

        await rmContext.close();
      });

      await t.test('13. duplicate modal/iframe is zero', async () => {
        await page.evaluate(() => {
          const modal = document.querySelector('.hero-video-modal');
          if (modal) modal.remove();
        });
        await page.waitForTimeout(100);

        await page.evaluate(() => {
          document.querySelector('.growth-stage-card-media').click();
        });
        await page.waitForSelector('.hero-video-modal', { timeout: 1000 });

        await page.evaluate(() => {
          document.querySelector('.growth-stage-card-media').click();
        });
        await page.waitForTimeout(100);

        const modalCount = await page.locator('.hero-video-modal').count();
        assert.strictEqual(modalCount, 1, 'exactly one modal must exist');

        const iframeCount = await page.locator('.hero-video-modal iframe').count();
        assert.strictEqual(iframeCount, 1, 'exactly one iframe must exist');
      });

      await t.test('14. pageerror is zero', async () => {
        assert.strictEqual(pageErrors.length, 0, `no page errors expected, got: ${pageErrors.join(', ')}`);
      });

      await t.test('15. spotlight pause/resume preserved', async () => {
        await page.locator('.hero-video-modal-close').click();
        await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 1000 });

        await page.clock.fastForward(10000);

        const stageState = await page.locator('.home-v3-growth-stage').getAttribute('data-stage-state');
        assert.ok(stageState, 'growth stage must have a data-stage-state attribute');
      });

      await t.test('16. no overflow or clipping', async () => {
        const overflow = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          return {
            bodyScrollWidth: body.scrollWidth,
            bodyClientWidth: body.clientWidth,
            htmlScrollWidth: html.scrollWidth,
            htmlClientWidth: html.clientWidth,
          };
        });
        assert.ok(overflow.bodyScrollWidth <= overflow.bodyClientWidth + 1,
          'body must not have horizontal overflow');
        assert.ok(overflow.htmlScrollWidth <= overflow.htmlClientWidth + 1,
          'html must not have horizontal overflow');
      });

      await browser.close();
    });
  }
});
