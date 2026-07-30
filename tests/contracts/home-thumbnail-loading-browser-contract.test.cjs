/**
 * #3713 — Home growth-stage thumbnail loading browser contract
 *
 * Executable Chromium contract (not string-only).
 * Loads the production CSS/JS asset chains and verifies the bounded
 * decorative-thumbnail lifecycle for each Home growth-stage card:
 *
 *   FALLBACK_VISIBLE -> PRIMARY_PENDING -> PRIMARY_READY
 *                                      \-> SECONDARY_PENDING -> SECONDARY_READY
 *                                                            \-> DEGRADED_FALLBACK
 *   SUPERSEDED (a stale load/error is a guarded no-op)
 *
 * Viewports: 1440x900 (desktop), 390x844 (mobile)
 *
 * Thumbnail control: every i.ytimg.com request is intercepted with Playwright
 * route handling. The harness — never production code — decides whether each
 * primary (maxresdefault.jpg) / secondary (mqdefault.jpg) candidate is held
 * (pending), fulfilled (success), or aborted (error). Held routes can be
 * settled later to simulate a late/stale event arriving after a superseded
 * assignment. No real external network dependency.
 *
 * The youtube-nocookie.com modal embed is intercepted (held) so the existing
 * modal open path can be exercised without touching the public network.
 *
 * Refs #3713
 * Refs #3707 (modal non-regression)
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

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const CARD0_VIDEO = 'GEk4jHwfFTA';
const CARD_VIDEOS = ['GEk4jHwfFTA', '2GJfWMYCWY0', 'U6BDbXIah-Y', '9XttLI0oH0I'];
const CARD_TITLES = ['NORMAL', 'GO', 'REDRED', 'LOVE ATTACK'];

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
  <title>Home Thumbnail Test Fixture</title>
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
// Controlled thumbnail stub.
//
// Each i.ytimg.com request is classified as primary (maxresdefault.jpg) or
// secondary (mqdefault.jpg) and recorded with its video id. The policy fn
// decides per request: 'success' (fulfill), 'error' (abort), 'hold' (pending).
// Held requests can be settled later to simulate a late/stale event arriving
// after the owning assignment has been superseded.
// ---------------------------------------------------------------------------
async function setupThumbnailControl(page) {
  const ctl = {
    requests: [],
    policy: () => 'hold',
  };

  const settle = (rec, decision) => {
    if (rec.settled) return;
    rec.settled = true;
    if (decision === 'success') {
      rec.route.fulfill({ status: 200, contentType: 'image/gif', body: GIF }).catch(() => {});
    } else {
      rec.route.abort('failed').catch(() => {});
    }
  };

  await page.route('**/i.ytimg.com/**', (route) => {
    const url = route.request().url();
    const candidate = url.indexOf('maxresdefault') !== -1 ? 'primary' : 'secondary';
    const m = url.match(/\/vi\/([^/]+)\//);
    const videoId = m ? decodeURIComponent(m[1]) : '';
    const rec = { route, url, videoId, candidate, settled: false };
    ctl.requests.push(rec);
    const decision = ctl.policy(rec);
    if (decision === 'hold') return;
    settle(rec, decision);
  });

  // Hold the modal embed so the modal open path never touches the network.
  await page.route('**/youtube-nocookie.com/**', () => { /* hold */ });

  ctl.setPolicy = (fn) => { ctl.policy = fn; };
  ctl.count = (pred) => ctl.requests.filter(pred).length;
  ctl.flush = (pred, decision) => {
    ctl.requests.filter((r) => !r.settled && pred(r)).forEach((r) => settle(r, decision));
  };
  ctl.flushFirst = (pred, decision) => {
    const rec = ctl.requests.find((r) => !r.settled && pred(r));
    if (rec) settle(rec, decision);
    return !!rec;
  };
  ctl.flushAll = (decision) => {
    ctl.requests.filter((r) => !r.settled).forEach((r) => settle(r, decision));
  };
  return ctl;
}

function realConsoleErrors(list) {
  // Deliberately aborted thumbnail requests produce benign resource-failure
  // console messages; those are harness artifacts, not production defects.
  return list.filter((t) => !/Failed to load resource|net::ERR_FAILED|ERR_FAILED|ytimg\.com/i.test(t));
}

async function newThumbPage(browser, vp, baseUrl, opts) {
  const options = opts || {};
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: options.reducedMotion || 'no-preference',
  });
  const page = await context.newPage();
  // Disable HTTP caching so each assignment's thumbnail request is a distinct,
  // interceptable network request (a superseded assignment and its replacement
  // share the same video URL; without this the browser would serve the stale
  // fulfilled response to the current image from cache). Test-harness only.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const ctl = await setupThumbnailControl(page);
  if (options.policy) ctl.setPolicy(options.policy);
  await page.goto(baseUrl + '/fixture-home.html');
  await page.waitForLoadState('domcontentloaded');
  // Real time (no frozen clock): the decorative thumbnails use loading="lazy",
  // whose IntersectionObserver-driven fetch is pumped by the real compositor.
  // A frozen clock blocks every image created after install, so the lifecycle
  // is observed in real time. The cycle's initial assignment runs at ~t=0 and
  // each test settles its target state well before the ~20s cycle auto-restart.
  return { context, page, pageErrors, consoleErrors, ctl };
}

async function teardown(env) {
  try { await env.context.close(); } catch (e) { /* ignore */ }
}

// Bring the featured card media into the viewport so its lazy thumbnail
// request is allowed to fire deterministically.
async function revealCard0(page) {
  await page.locator('.growth-stage-card.featured .growth-stage-card-media').scrollIntoViewIfNeeded().catch(() => {});
}

// Trigger one fresh card assignment via the visibility-restart path (the
// production lifecycle re-runs applyArtistToCard from PHASE.PENDING). The
// restart schedules the reassignment ~50ms later; wait in real time so the new
// lazy thumbnail fetch can fire via the real compositor.
async function reassign(page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(200);
}

async function waitForState(page, idx, state) {
  await page.waitForFunction(
    (args) => {
      const m = document.querySelectorAll('.growth-stage-card-media')[args.idx];
      return !!m && m.getAttribute('data-thumb-state') === args.state;
    },
    { idx, state },
    { timeout: 4000 }
  );
}

async function mediaSnapshot(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.growth-stage-card-media')).map((m) => {
      const fb = m.querySelector('.growth-stage-card-fallback');
      const img = m.querySelector('img');
      return {
        state: m.getAttribute('data-thumb-state'),
        imgCount: m.querySelectorAll('img').length,
        loadedCount: m.querySelectorAll('img.is-loaded').length,
        degraded: m.classList.contains('is-thumb-degraded'),
        hasError: m.classList.contains('has-thumbnail-error'),
        fallbackDisplay: fb ? getComputedStyle(fb).display : null,
        imgTransitionDuration: img ? getComputedStyle(img).transitionDuration : null,
      };
    });
  });
}

async function cardMapping(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.growth-stage-card')).map((c) => ({
      videoId: c.getAttribute('data-video-id'),
      title: (c.querySelector('strong') || {}).textContent || null,
      linkHref: (c.querySelector('.growth-stage-card-link') || {}).href || null,
    }));
  });
}

test('home thumbnail loading lifecycle (#3713)', async (t) => {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    server.close();
  });

  for (const vp of VIEWPORTS) {
    await t.test(`viewport ${vp.name} (${vp.width}x${vp.height})`, async (t) => {
      const browser = await playwright.chromium.launch({ headless: true });

      t.after(async () => {
        await browser.close();
      });

      // ---------------------------------------------------------------
      // 1. primary pending: shell/title/link/play remain usable.
      // ---------------------------------------------------------------
      await t.test('1. primary pending keeps shell/title/link/play usable', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, { policy: () => 'hold' });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_PENDING');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'PRIMARY_PENDING', 'card0 primary pending');
          assert.equal(snap.imgCount, 1, 'one pending img node');
          assert.equal(snap.loadedCount, 0, 'pending img is not loaded');
          assert.equal(snap.fallbackDisplay, 'flex', 'fallback visible while pending');
          // Shell/title/link/play usable.
          const shell = await page.evaluate(() => {
            const card = document.querySelector('.growth-stage-card.featured');
            const title = card.querySelector('strong');
            const link = card.querySelector('.growth-stage-card-link');
            const play = card.querySelector('.growth-stage-card-play');
            return {
              title: title ? title.textContent : null,
              linkHref: link ? link.getAttribute('href') : null,
              playVisible: play ? getComputedStyle(play).display !== 'none' : false,
            };
          });
          assert.equal(shell.title, 'NORMAL', 'title present and correct while pending');
          assert.ok(shell.linkHref && shell.linkHref.indexOf('youtube.com/watch?v=' + CARD0_VIDEO) !== -1, 'attribution link usable while pending');
          assert.ok(shell.playVisible, 'play control usable while pending');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 2. primary success: exactly one current loaded image.
      // ---------------------------------------------------------------
      await t.test('2. primary success yields exactly one loaded image', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'success' : 'hold'),
        });
        try {
          const { page, ctl } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_READY');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'PRIMARY_READY', 'card0 primary ready');
          assert.equal(snap.imgCount, 1, 'exactly one img node');
          assert.equal(snap.loadedCount, 1, 'exactly one loaded img');
          assert.equal(snap.fallbackDisplay, 'none', 'fallback hidden once loaded');
          assert.equal(ctl.count((r) => r.videoId === CARD0_VIDEO && r.candidate === 'secondary'), 0, 'no secondary request on primary success');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 3. primary failure triggers exactly one secondary request.
      // ---------------------------------------------------------------
      await t.test('3. primary failure triggers exactly one secondary request', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'error' : 'hold'),
        });
        try {
          const { page, ctl } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'SECONDARY_PENDING');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'SECONDARY_PENDING', 'card0 secondary pending');
          assert.equal(ctl.count((r) => r.videoId === CARD0_VIDEO && r.candidate === 'primary'), 1, 'exactly one primary request');
          assert.equal(ctl.count((r) => r.videoId === CARD0_VIDEO && r.candidate === 'secondary'), 1, 'exactly one secondary request');
          assert.equal(snap.imgCount, 1, 'still one img node during secondary');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 4. secondary success becomes ready without duplicate images.
      // ---------------------------------------------------------------
      await t.test('4. secondary success becomes ready without duplicates', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'error' : 'success'),
        });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'SECONDARY_READY');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'SECONDARY_READY', 'card0 secondary ready');
          assert.equal(snap.imgCount, 1, 'exactly one img node');
          assert.equal(snap.loadedCount, 1, 'exactly one loaded img');
          assert.equal(snap.fallbackDisplay, 'none', 'fallback hidden once secondary loaded');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 5. both candidates fail -> intentional fallback, no broken image.
      // ---------------------------------------------------------------
      await t.test('5. both candidates failing leaves intentional fallback', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, { policy: () => 'error' });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'DEGRADED_FALLBACK');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'DEGRADED_FALLBACK', 'card0 degraded fallback');
          assert.equal(snap.imgCount, 0, 'failed image removed (no broken-image icon)');
          assert.ok(snap.degraded, 'explicit is-thumb-degraded class present');
          assert.ok(snap.hasError, 'has-thumbnail-error class present');
          assert.equal(snap.fallbackDisplay, 'flex', 'branded/text fallback retained');
          // No blank/black media surface: the media keeps its warm background.
          const bg = await page.evaluate(() => {
            const m = document.querySelector('.growth-stage-card.featured .growth-stage-card-media');
            return getComputedStyle(m).backgroundColor;
          });
          assert.ok(bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', 'media retains an intentional background');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 6. a stale primary success cannot revive a superseded card.
      //    Assignment 1's image is captured, then assignment 2 supersedes and
      //    degrades (no current image). A late 'load' (success) delivered to the
      //    superseded assignment-1 image must be a guarded no-op: the degraded
      //    current card must NOT flip to ready and no image may be re-added.
      //
      //    The current card is driven to DEGRADED_FALLBACK through the real
      //    intercepted request path. Because a reassignment reuses the same
      //    video URL (the browser coalesces the in-flight fetch), the stale
      //    event is delivered by dispatching a real 'load' Event on the captured
      //    detached assignment-1 <img>; this exercises the exact production
      //    load handler and its assignment-identity guard, with no dependence on
      //    the public network.
      // ---------------------------------------------------------------
      await t.test('6. stale primary success cannot overwrite the new card', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, { policy: () => 'hold' });
        try {
          const { page, ctl } = env;
          await revealCard0(page);
          // Assignment 1 (initial): card0 primary held. Capture its image element
          // before it is superseded (it becomes the stale, detached element).
          await waitForState(page, 0, 'PRIMARY_PENDING');
          const staleImg = await page.evaluateHandle(() =>
            document.querySelector('.growth-stage-card.featured .growth-stage-card-media img'));
          // Assignment 2 supersedes and degrades (primary + secondary both fail).
          ctl.setPolicy(() => 'error');
          await reassign(page);
          // Settle the current primary with error so the current card cascades
          // primary -> secondary -> DEGRADED_FALLBACK through the real path.
          ctl.flushFirst((r) => r.videoId === CARD0_VIDEO && r.candidate === 'primary', 'error');
          await waitForState(page, 0, 'DEGRADED_FALLBACK');
          assert.equal((await mediaSnapshot(page))[0].imgCount, 0, 'degraded current card has no image');
          // Deliver the STALE assignment-1 primary 'load' (a late success) to the
          // detached image. Its guarded handler must be a no-op.
          await staleImg.evaluate((el) => el.dispatchEvent(new Event('load')));
          await page.waitForTimeout(150);
          // Guarded no-op: the degraded current card must not be revived.
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'DEGRADED_FALLBACK', 'stale primary success did not revive the degraded card');
          assert.equal(snap.imgCount, 0, 'stale primary success did not re-add an image');
          assert.equal(snap.loadedCount, 0, 'stale primary success did not mark any img loaded');
          assert.ok(snap.degraded, 'degraded class remains from the current assignment');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 7. stale secondary success/error cannot revive a superseded card.
      //    Assignment 1's image (active candidate = secondary) is captured, then
      //    assignment 2 supersedes and degrades. Late 'load' (success) and
      //    'error' events delivered to the superseded assignment-1 image must be
      //    guarded no-ops (no flip to ready, no re-added image). See test 6 for
      //    why the stale event is dispatched on the captured detached <img>.
      // ---------------------------------------------------------------
      await t.test('7. stale secondary events cannot overwrite the new card', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'error' : 'hold'),
        });
        try {
          const { page, ctl } = env;
          await revealCard0(page);
          // Assignment 1 (initial): primary fails -> secondary held. Capture the
          // image element (its active candidate is the secondary) before supersede.
          await waitForState(page, 0, 'SECONDARY_PENDING');
          const staleImg = await page.evaluateHandle(() =>
            document.querySelector('.growth-stage-card.featured .growth-stage-card-media img'));
          // Assignment 2 supersedes and degrades (primary + secondary both fail).
          ctl.setPolicy(() => 'error');
          await reassign(page);
          // Settle the current secondary with error so the current card lands in
          // DEGRADED_FALLBACK through the real path.
          ctl.flushFirst((r) => r.videoId === CARD0_VIDEO && r.candidate === 'secondary', 'error');
          await waitForState(page, 0, 'DEGRADED_FALLBACK');
          assert.equal((await mediaSnapshot(page))[0].imgCount, 0, 'degraded current card has no image');
          // Deliver the STALE assignment-1 secondary 'load' (late success) and
          // 'error' to the detached image. Both guarded handlers must be no-ops.
          await staleImg.evaluate((el) => el.dispatchEvent(new Event('load')));
          await staleImg.evaluate((el) => el.dispatchEvent(new Event('error')));
          await page.waitForTimeout(150);
          // Guarded no-op: the degraded current card must not be revived.
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'DEGRADED_FALLBACK', 'stale secondary events did not revive the degraded card');
          assert.equal(snap.imgCount, 0, 'stale secondary events did not re-add an image');
          assert.equal(snap.loadedCount, 0, 'stale secondary events did not mark any img loaded');
          assert.ok(snap.degraded, 'degraded class remains from the current assignment');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 8. rapid reassignment leaves one current image + current mapping.
      // ---------------------------------------------------------------
      await t.test('8. rapid reassignment leaves one current image and mapping', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, { policy: () => 'hold' });
        try {
          const { page, ctl } = env;
          await revealCard0(page);
          // Several rapid reassignments (on top of the initial assignment).
          for (let i = 0; i < 4; i++) {
            await reassign(page);
          }
          await page.waitForTimeout(120);
          const snap = await mediaSnapshot(page);
          for (let i = 0; i < snap.length; i++) {
            assert.equal(snap[i].imgCount, 1, `card${i} has exactly one current image after rapid reassignment`);
          }
          const mapping = await cardMapping(page);
          for (let i = 0; i < mapping.length; i++) {
            assert.equal(mapping[i].videoId, CARD_VIDEOS[i], `card${i} keeps its current video mapping`);
            assert.equal(mapping[i].title, CARD_TITLES[i], `card${i} keeps its current title mapping`);
            assert.ok(mapping[i].linkHref && mapping[i].linkHref.indexOf('watch?v=' + CARD_VIDEOS[i]) !== -1, `card${i} link matches current video`);
          }
          // Settling the current primaries yields one loaded image per card.
          await page.evaluate(() => {
            document.querySelectorAll('.growth-stage-card-media').forEach((m) => m.scrollIntoView());
          });
          ctl.flushAll('success');
          await waitForState(page, 0, 'PRIMARY_READY');
          await page.waitForTimeout(150);
          const after = await mediaSnapshot(page);
          for (let i = 0; i < after.length; i++) {
            assert.ok(after[i].imgCount <= 1, `card${i} has at most one image after settle`);
          }
          assert.equal(after[0].loadedCount, 1, 'card0 has exactly one loaded image after settle');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 9. reduced motion preserves state and removes the thumbnail fade.
      // ---------------------------------------------------------------
      await t.test('9. reduced motion preserves state with no thumbnail fade', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          reducedMotion: 'reduce',
          policy: (r) => (r.candidate === 'primary' ? 'success' : 'hold'),
        });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_READY');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'PRIMARY_READY', 'ready state preserved under reduced motion');
          assert.equal(snap.loadedCount, 1, 'image loaded under reduced motion');
          assert.equal(snap.imgTransitionDuration, '0s', 'thumbnail fade removed under reduced motion');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }

        const envDeg = await newThumbPage(browser, vp, baseUrl, {
          reducedMotion: 'reduce',
          policy: () => 'error',
        });
        try {
          const { page } = envDeg;
          await revealCard0(page);
          await waitForState(page, 0, 'DEGRADED_FALLBACK');
          const snap = (await mediaSnapshot(page))[0];
          assert.equal(snap.state, 'DEGRADED_FALLBACK', 'degraded state preserved under reduced motion');
          assert.equal(snap.fallbackDisplay, 'flex', 'fallback retained under reduced motion');
          assert.equal(envDeg.pageErrors.length, 0, `no page errors, got: ${envDeg.pageErrors.join(', ')}`);
        } finally {
          await teardown(envDeg);
        }
      });

      // ---------------------------------------------------------------
      // 10. no pageerror / console error / duplicate / overflow.
      // ---------------------------------------------------------------
      await t.test('10. no pageerror, real console error, duplicate, or overflow', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'success' : 'hold'),
        });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_READY');
          // No duplicate current image on any card.
          const snap = await mediaSnapshot(page);
          for (let i = 0; i < snap.length; i++) {
            assert.ok(snap[i].imgCount <= 1, `card${i} has no duplicate image`);
            assert.ok(snap[i].loadedCount <= 1, `card${i} has at most one loaded image`);
          }
          const overflow = await page.evaluate(() => ({
            bodyScrollWidth: document.body.scrollWidth,
            bodyClientWidth: document.body.clientWidth,
            htmlScrollWidth: document.documentElement.scrollWidth,
            htmlClientWidth: document.documentElement.clientWidth,
          }));
          assert.ok(overflow.bodyScrollWidth <= overflow.bodyClientWidth + 1, 'body has no horizontal overflow');
          assert.ok(overflow.htmlScrollWidth <= overflow.htmlClientWidth + 1, 'html has no horizontal overflow');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
          assert.equal(realConsoleErrors(env.consoleErrors).length, 0, `no real console errors, got: ${realConsoleErrors(env.consoleErrors).join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 11. modal open path targets the currently visible card/video.
      // ---------------------------------------------------------------
      await t.test('11. modal opens for the currently visible card/video', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'success' : 'hold'),
        });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_READY');
          const currentVideo = await page.evaluate(() => document.querySelector('.growth-stage-card.featured').getAttribute('data-video-id'));
          assert.equal(currentVideo, CARD0_VIDEO, 'featured card currently maps to card0 video');
          await page.evaluate(() => {
            document.querySelector('.growth-stage-card.featured .growth-stage-card-media').click();
          });
          await page.waitForSelector('.hero-video-modal', { timeout: 3000 });
          assert.ok(await page.locator('.hero-video-modal').isVisible(), 'modal opens from the card media');
          const iframeSrc = await page.locator('.hero-video-modal iframe').getAttribute('src');
          assert.ok(iframeSrc && iframeSrc.indexOf(currentVideo) !== -1, 'modal iframe targets the currently visible video');
          assert.ok(iframeSrc.indexOf('youtube-nocookie.com/embed/') !== -1, 'modal keeps the privacy-enhanced embed');
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });

      // ---------------------------------------------------------------
      // 12. thumbnail lifecycle adds no new live-region / busy announcement.
      // ---------------------------------------------------------------
      await t.test('12. no new live-region or card-wide busy announcement', async () => {
        const env = await newThumbPage(browser, vp, baseUrl, {
          policy: (r) => (r.candidate === 'primary' ? 'success' : 'hold'),
        });
        try {
          const { page } = env;
          await revealCard0(page);
          await waitForState(page, 0, 'PRIMARY_READY');
          const a11y = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.growth-stage-card'));
            let liveInCards = 0;
            let busyInCards = 0;
            cards.forEach((c) => {
              liveInCards += c.querySelectorAll('[aria-live]').length;
              busyInCards += c.querySelectorAll('[aria-busy]').length;
              if (c.hasAttribute('aria-busy')) busyInCards++;
            });
            const mediaBusy = Array.from(document.querySelectorAll('.growth-stage-card-media')).filter((m) => m.hasAttribute('aria-busy')).length;
            const imgAlts = Array.from(document.querySelectorAll('.growth-stage-card-media img')).map((i) => i.getAttribute('alt'));
            return { liveInCards, busyInCards, mediaBusy, imgAlts };
          });
          assert.equal(a11y.liveInCards, 0, 'no aria-live added inside cards');
          assert.equal(a11y.busyInCards, 0, 'no aria-busy added inside cards');
          assert.equal(a11y.mediaBusy, 0, 'no card-wide aria-busy on media');
          for (const alt of a11y.imgAlts) {
            assert.equal(alt, '', 'thumbnail images remain decorative with alt=""');
          }
          assert.equal(env.pageErrors.length, 0, `no page errors, got: ${env.pageErrors.join(', ')}`);
        } finally {
          await teardown(env);
        }
      });
    });
  }
});
