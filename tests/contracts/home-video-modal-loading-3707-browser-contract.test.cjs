/**
 * #3707 — Home video modal staged loading browser contract
 *
 * Executable Chromium contract (not string-only).
 * Loads production CSS/JS asset chains and verifies modal loading states.
 *
 * Viewports: 1440×900 (desktop), 390×844 (mobile)
 *
 * Iframe control: every youtube-nocookie.com embed request is intercepted
 * with Playwright route handling. The test harness — never production code —
 * decides whether each embed is pending, load-success, error, timeout,
 * stale-load, or retry-success. No real external network dependency.
 *
 * Fake timers (page.clock) drive the 8s long-wait and 30s timeout transitions
 * and the hero growth-cycle spotlight progression deterministically.
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

const ROOT = path.resolve(__dirname, '..', '..');

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

const STUB_HTML = '<!DOCTYPE html><html><head><title>stub player</title></head><body>stub player</body></html>';

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

// ---------------------------------------------------------------------------
// Controlled iframe stub.
//
// mode 'pending' → hold the request (iframe never loads; timers drive state)
// mode 'success' → fulfill with stub HTML (iframe fires load → READY)
// mode 'error'   → abort the request (iframe fires error → ERROR)
//
// held routes can be flushed later to simulate a late/stale load arriving
// after the owning attempt has already been superseded.
// ---------------------------------------------------------------------------
async function setupIframeControl(page) {
  const ctl = { mode: 'pending', held: [] };
  await page.route('**/youtube-nocookie.com/**', async (route) => {
    if (ctl.mode === 'success') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML });
    } else if (ctl.mode === 'error') {
      await route.abort('failed');
    } else {
      ctl.held.push(route);
    }
  });
  ctl.setMode = (m) => { ctl.mode = m; };
  ctl.flushLoad = async () => {
    const routes = ctl.held.splice(0);
    for (const r of routes) {
      try { await r.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML }); } catch (e) { /* route already settled */ }
    }
  };
  ctl.abortHeld = async () => {
    const routes = ctl.held.splice(0);
    for (const r of routes) {
      try { await r.abort('aborted'); } catch (e) { /* route already settled */ }
    }
  };
  return ctl;
}

async function newModalPage(browser, vp, baseUrl, opts) {
  const options = opts || {};
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: options.reducedMotion || 'no-preference',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  const ctl = await setupIframeControl(page);
  await page.goto(baseUrl + '/fixture-home.html');
  await page.waitForLoadState('domcontentloaded');
  await page.clock.install();
  if (options.ff !== 0) {
    await page.clock.fastForward(options.ff == null ? 2000 : options.ff);
  }
  return { context, page, pageErrors, ctl };
}

async function teardown(env) {
  try { await env.ctl.abortHeld(); } catch (e) { /* ignore */ }
  try { await env.context.close(); } catch (e) { /* ignore */ }
}

async function openModal(page) {
  await page.evaluate(() => {
    document.querySelector('.growth-stage-card-media').click();
  });
  await page.waitForSelector('.hero-video-modal', { timeout: 2000 });
}

async function closeModalViaButton(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.hero-video-modal-close');
    if (btn) btn.click();
  });
  await page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 2000 });
}

test('home video modal loading states (#3707)', async (t) => {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await closeServer(server);
  });

  for (const vp of VIEWPORTS) {
    await t.test(`viewport ${vp.name} (${vp.width}x${vp.height})`, async (t) => {
      const browser = await playwright.chromium.launch({ headless: true });

      t.after(async () => {
        await browser.close();
      });

      // -----------------------------------------------------------------
      // Group A — loading lifecycle on a single chained page.
      // -----------------------------------------------------------------
      await t.test('A. loading lifecycle (pending → success → long-wait → timeout → stale → retry)', async (t) => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        const { page, ctl } = env;
        t.after(async () => { await teardown(env); });

        await t.test('A1. modal shell and Close appear immediately (pending)', async () => {
          ctl.setMode('pending');
          await openModal(page);
          assert.ok(await page.locator('.hero-video-modal').isVisible(), 'modal shell must be visible');
          assert.ok(await page.locator('.hero-video-modal-close').isVisible(), 'close button must be visible');
        });

        await t.test('A2. initial loading state with aria-busy', async () => {
          assert.ok(await page.locator('.hero-video-modal-loading').isVisible(), 'loading overlay must be visible');
          assert.strictEqual(await page.locator('.hero-video-modal-player').getAttribute('aria-busy'), 'true', 'player aria-busy=true');
          const loadingText = await page.locator('.hero-video-modal-loading-text').textContent();
          assert.ok(loadingText.includes('영상을 불러오는 중'), 'initial loading text shown');
          // Non-reduced motion: spinner must carry an animateTransform.
          const animCount = await page.locator('.hero-video-modal-loading-spinner animateTransform').count();
          assert.strictEqual(animCount, 1, 'spinner has exactly one animateTransform in normal motion');
        });

        await t.test('A3. controlled load success transitions to READY exactly once', async () => {
          ctl.setMode('success');
          // Fulfill the currently-held embed request to fire a real load event.
          await ctl.flushLoad();
          await page.waitForSelector('.hero-video-modal-ready', { timeout: 2000 });
          const cls = await page.locator('.hero-video-modal').getAttribute('class');
          assert.ok(cls.includes('hero-video-modal-ready'), 'modal has ready class');
          assert.strictEqual(await page.locator('.hero-video-modal-loading').count(), 0, 'loading removed after ready');
          assert.strictEqual(await page.locator('.hero-video-modal-player').getAttribute('aria-busy'), null, 'aria-busy removed after ready');
          assert.strictEqual(await page.locator('.hero-video-modal iframe').getAttribute('tabindex'), null, 'iframe tabindex removed after ready');
        });

        await t.test('A4. long-wait transition at 8 seconds (pending)', async () => {
          await closeModalViaButton(page);
          ctl.setMode('pending');
          await openModal(page);
          await page.clock.fastForward(8000);
          const cls = await page.locator('.hero-video-modal-loading').getAttribute('class');
          assert.ok(cls.includes('is-long-wait'), 'loading has is-long-wait after 8s');
          const txt = await page.locator('.hero-video-modal-loading-text').textContent();
          assert.ok(txt.includes('오래 걸리고'), 'long-wait text shown');
        });

        await t.test('A5. 30s timeout transitions to ERROR (pending)', async () => {
          await page.clock.fastForward(22000);
          await page.waitForSelector('.hero-video-modal-error', { timeout: 2000 });
          assert.ok(await page.locator('.hero-video-modal-error').isVisible(), 'error overlay visible after 30s');
          const errText = await page.locator('.hero-video-modal-error-text').textContent();
          assert.ok(errText.includes('불러오지 못했어요'), 'error text shown');
          assert.ok(await page.locator('.hero-video-modal-retry-btn').isVisible(), 'retry button visible');
          const watchLink = await page.locator('.hero-video-modal-error a[href*="youtube.com"]').getAttribute('href');
          assert.ok(watchLink.includes('youtube.com/watch?v='), 'fallback YouTube watch link present');
        });

        await t.test('A6. stale controlled load does not change ERROR state', async () => {
          // Fulfill the still-held original embed request: a late load arriving
          // after the timeout attempt was superseded.
          await ctl.flushLoad();
          await page.waitForTimeout(120);
          assert.ok(await page.locator('.hero-video-modal-error').isVisible(), 'error remains after stale load');
          const cls = await page.locator('.hero-video-modal').getAttribute('class');
          assert.ok(!cls.includes('hero-video-modal-ready'), 'modal does not become ready after stale load');
        });

        await t.test('A7. retry creates exactly one new iframe (retrying)', async () => {
          ctl.setMode('pending');
          await page.evaluate(() => {
            document.querySelector('.hero-video-modal-retry-btn').click();
          });
          await page.waitForTimeout(120);
          assert.strictEqual(await page.locator('.hero-video-modal iframe').count(), 1, 'exactly one iframe after retry');
          const txt = await page.locator('.hero-video-modal-loading-text').textContent();
          assert.ok(txt.includes('다시 시도'), 'retrying text shown');
          assert.strictEqual(await page.locator('.hero-video-modal-error').count(), 0, 'error removed on retry');
        });

        await t.test('A8. retry controlled success reaches READY (old listener/timer cleaned)', async () => {
          ctl.setMode('success');
          await ctl.flushLoad();
          await page.waitForSelector('.hero-video-modal-ready', { timeout: 2000 });
          assert.ok(await page.locator('.hero-video-modal-ready').isVisible(), 'modal ready after retry success');
          assert.strictEqual(await page.locator('.hero-video-modal iframe').count(), 1, 'still exactly one iframe');
        });

        await t.test('A9. pageerror is zero across lifecycle', async () => {
          assert.strictEqual(env.pageErrors.length, 0, `no page errors expected, got: ${env.pageErrors.join(', ')}`);
        });
      });

      // -----------------------------------------------------------------
      // Group B — close from every distinct state (fresh page per state).
      // -----------------------------------------------------------------
      const closeScenarios = [
        {
          name: 'B1. close from initial loading (pending)',
          setup: async (env) => { env.ctl.setMode('pending'); await openModal(env.page); },
        },
        {
          name: 'B2. close from long-wait state',
          setup: async (env) => { env.ctl.setMode('pending'); await openModal(env.page); await env.page.clock.fastForward(8000); },
        },
        {
          name: 'B3. close from error state',
          setup: async (env) => { env.ctl.setMode('pending'); await openModal(env.page); await env.page.clock.fastForward(30000); await env.page.waitForSelector('.hero-video-modal-error', { timeout: 2000 }); },
        },
        {
          name: 'B4. close from retrying state',
          setup: async (env) => {
            env.ctl.setMode('pending');
            await openModal(env.page);
            await env.page.clock.fastForward(30000);
            await env.page.waitForSelector('.hero-video-modal-retry-btn', { timeout: 2000 });
            await env.page.evaluate(() => { document.querySelector('.hero-video-modal-retry-btn').click(); });
            await env.page.waitForTimeout(120);
          },
        },
        {
          name: 'B5. close from ready state',
          setup: async (env) => { env.ctl.setMode('success'); await openModal(env.page); await env.page.waitForSelector('.hero-video-modal-ready', { timeout: 2000 }); },
        },
      ];

      for (const sc of closeScenarios) {
        await t.test(sc.name, async () => {
          const env = await newModalPage(browser, vp, baseUrl, {});
          try {
            await sc.setup(env);
            assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 1, 'modal present before close');
            await closeModalViaButton(env.page);
            assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'modal removed after close');
            // Advancing time after close must not resurrect error or modal.
            await env.page.clock.fastForward(60000);
            assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'no modal resurrection after close');
            assert.strictEqual(await env.page.locator('.hero-video-modal-error').count(), 0, 'no error resurrection after close');
            assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
          } finally {
            await teardown(env);
          }
        });
      }

      // -----------------------------------------------------------------
      // Group C — Escape, backdrop close, pagehide cleanup.
      // -----------------------------------------------------------------
      await t.test('C1. Escape closes the modal', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          env.ctl.setMode('pending');
          await openModal(env.page);
          await env.page.keyboard.press('Escape');
          await env.page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 2000 });
          assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'modal removed after Escape');
        } finally {
          await teardown(env);
        }
      });

      await t.test('C2. backdrop click closes and cleans up', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          env.ctl.setMode('pending');
          await openModal(env.page);
          // Click the overlay backdrop (top-left corner, outside the panel).
          await env.page.locator('.hero-video-modal').click({ position: { x: 3, y: 3 } });
          await env.page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 2000 });
          assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'modal removed after backdrop click');
          await env.page.clock.fastForward(60000);
          assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'no resurrection after backdrop close');
          assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      await t.test('C3. pagehide closes the modal', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          env.ctl.setMode('pending');
          await openModal(env.page);
          await env.page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
          await env.page.waitForSelector('.hero-video-modal', { state: 'detached', timeout: 2000 });
          assert.strictEqual(await env.page.locator('.hero-video-modal').count(), 0, 'modal removed after pagehide');
          assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // -----------------------------------------------------------------
      // Group D — stale attempt timer cannot mutate a new attempt.
      // -----------------------------------------------------------------
      await t.test('D1. stale attempt timer does not mutate the new attempt', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          const { page, ctl } = env;
          ctl.setMode('pending');
          await openModal(page);
          // First attempt reaches long-wait; its 30s timeout is still armed.
          await page.clock.fastForward(8000);
          assert.ok((await page.locator('.hero-video-modal-loading').getAttribute('class')).includes('is-long-wait'), 'first attempt in long-wait');
          // First attempt then times out into ERROR (retry button now exists).
          await page.clock.fastForward(22000);
          await page.waitForSelector('.hero-video-modal-retry-btn', { timeout: 2000 });
          // Retry into a NEW attempt that succeeds.
          ctl.setMode('success');
          await page.evaluate(() => { document.querySelector('.hero-video-modal-retry-btn').click(); });
          await page.waitForSelector('.hero-video-modal-ready', { timeout: 2000 });
          // Advance far beyond any timer from the previous (errored) attempt.
          await page.clock.fastForward(90000);
          const cls = await page.locator('.hero-video-modal').getAttribute('class');
          assert.ok(cls.includes('hero-video-modal-ready'), 'new attempt stays ready');
          assert.strictEqual(await page.locator('.hero-video-modal-error').count(), 0, 'stale timer never flips new attempt to error');
          assert.strictEqual(await page.locator('.hero-video-modal iframe').count(), 1, 'still exactly one iframe');
          assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // -----------------------------------------------------------------
      // Group E — focus trap / restoration.
      // -----------------------------------------------------------------
      await t.test('E1. focus trap and focus restoration', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          const { page } = env;
          env.ctl.setMode('pending');
          await openModal(page);
          assert.ok(await page.evaluate(() => document.activeElement.classList.contains('hero-video-modal-close')), 'close button receives initial focus');
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          assert.ok(await page.evaluate(() => {
            const modal = document.querySelector('.hero-video-modal');
            return modal && modal.contains(document.activeElement);
          }), 'focus stays trapped in modal');
          await closeModalViaButton(page);
          assert.ok(await page.evaluate(() => {
            const playBtn = document.querySelector('.growth-stage-card-play');
            return document.activeElement === playBtn || (document.activeElement && document.activeElement.closest('.growth-stage-card'));
          }), 'focus returns to card after close');
        } finally {
          await teardown(env);
        }
      });

      // -----------------------------------------------------------------
      // Group F — reduced motion: state preserved, no animateTransform.
      // -----------------------------------------------------------------
      await t.test('F1. reduced-motion preserves state and omits animateTransform', async () => {
        const env = await newModalPage(browser, vp, baseUrl, { reducedMotion: 'reduce' });
        try {
          const { page } = env;
          env.ctl.setMode('pending');
          await openModal(page);
          assert.ok(await page.locator('.hero-video-modal-loading').isVisible(), 'loading visible in reduced motion');
          const animCount = await page.locator('.hero-video-modal-loading-spinner animateTransform').count();
          assert.strictEqual(animCount, 0, 'no animateTransform in reduced motion');
          await page.clock.fastForward(8000);
          await page.clock.runFor(0);
          assert.ok(await page.locator('.hero-video-modal-loading.is-long-wait').isVisible(), 'long-wait visible in reduced motion');
          assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // -----------------------------------------------------------------
      // Group G — spotlight progression pauses during modal, resumes after.
      // Uses a fresh page so the cycle phase is deterministic.
      // -----------------------------------------------------------------
      await t.test('G1. spotlight progression stops while modal open and resumes after close', async () => {
        const env = await newModalPage(browser, vp, baseUrl, { ff: 2000 });
        try {
          const { page } = env;
          const sample = () => page.evaluate(() => ({
            state: document.querySelector('.home-v3-growth-stage').getAttribute('data-stage-state'),
            spotlight: document.querySelectorAll('.growth-stage-card.is-spotlight').length,
          }));

          // Modal loads successfully so no modal timer fires during the window;
          // opening it still pauses the hero cycle.
          env.ctl.setMode('success');
          await openModal(page);
          await page.waitForSelector('.hero-video-modal-ready', { timeout: 2000 });
          const baseline = await sample();

          // While the modal is open the cycle is paused: advancing time must not
          // change the stage state nor start/stop any spotlight.
          let frozen = true;
          for (let i = 0; i < 6; i++) {
            await page.clock.fastForward(5000);
            const s = await sample();
            if (s.state !== baseline.state || s.spotlight !== baseline.spotlight) frozen = false;
          }
          assert.ok(frozen, 'cycle progression frozen while modal open (baseline=' + JSON.stringify(baseline) + ')');

          await closeModalViaButton(page);

          // Closing returns focus to the card (inside the collage), which arms
          // the independent focus-pause. Move focus out of the collage so only
          // the modal's playing pause/resume is under test.
          await page.evaluate(() => {
            const cta = document.querySelector('.home-v3-copy .btn-round');
            if (cta) { cta.focus(); } else if (document.activeElement) { document.activeElement.blur(); }
          });

          // After close the cycle resumes: advancing time must produce real
          // progression (stage state changes and/or a spotlight appears).
          const seen = new Set();
          let spotlightSeen = false;
          for (let i = 0; i < 12; i++) {
            await page.clock.fastForward(3000);
            const s = await sample();
            seen.add(s.state);
            if (s.spotlight > 0) spotlightSeen = true;
          }
          assert.ok(seen.size > 1 || spotlightSeen,
            'cycle progression resumes after close (states=' + Array.from(seen).join(',') + ', spotlight=' + spotlightSeen + ')');
          assert.strictEqual(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // -----------------------------------------------------------------
      // Group H — structural integrity: duplicates and overflow.
      // -----------------------------------------------------------------
      await t.test('H1. duplicate modal/iframe is zero', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          const { page } = env;
          env.ctl.setMode('pending');
          await openModal(page);
          // Second open attempt while a modal already exists.
          await page.evaluate(() => { document.querySelector('.growth-stage-card-media').click(); });
          await page.waitForTimeout(120);
          assert.strictEqual(await page.locator('.hero-video-modal').count(), 1, 'exactly one modal');
          assert.strictEqual(await page.locator('.hero-video-modal iframe').count(), 1, 'exactly one iframe');
        } finally {
          await teardown(env);
        }
      });

      await t.test('H2. no horizontal overflow or clipping', async () => {
        const env = await newModalPage(browser, vp, baseUrl, {});
        try {
          const { page } = env;
          env.ctl.setMode('pending');
          await openModal(page);
          const overflow = await page.evaluate(() => ({
            bodyScrollWidth: document.body.scrollWidth,
            bodyClientWidth: document.body.clientWidth,
            htmlScrollWidth: document.documentElement.scrollWidth,
            htmlClientWidth: document.documentElement.clientWidth,
          }));
          assert.ok(overflow.bodyScrollWidth <= overflow.bodyClientWidth + 1, 'body has no horizontal overflow');
          assert.ok(overflow.htmlScrollWidth <= overflow.htmlClientWidth + 1, 'html has no horizontal overflow');
        } finally {
          await teardown(env);
        }
      });
    });
  }
});
