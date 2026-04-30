const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const RAW_BASE_URL = process.env.SMOKE_BASE_URL || process.env.LOVEBUD_URL || '';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const PAGE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

const TARGETS = [
  { path: '/', name: 'home', apiDependent: false, requiredSelector: 'body' },
  { path: '/pages/intro.html', name: 'intro', apiDependent: false, requiredSelector: 'body' },
  { path: '/pages/search.html', name: 'search', apiDependent: true, requiredSelector: 'body' },
];

function usage() {
  console.error('SMOKE_BASE_URL is required. Example:');
  console.error('SMOKE_BASE_URL=https://test1.lovebud.pages.dev npm run smoke:cloudflare');
}

function isAllowedBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch (error) {
    return false;
  }
}

function isIgnoredConsoleError(text) {
  const value = String(text || '');
  return value.includes('ytimg.com') || value.includes('img.youtube.com');
}

function isNetworkBlocker(response) {
  const url = response.url();
  const status = response.status();
  if (status < 400) return false;
  if (/ytimg\.com|img\.youtube\.com/.test(url)) return false;
  if (/favicon\.(ico|png|svg)$/.test(url)) return false;
  return true;
}

async function getHorizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
}

async function runTarget(page, target, viewport) {
  const fatalMessages = [];
  const networkFailures = [];
  const networkBlockers = [];
  let ignoredMedia404Count = 0; // Tracks generic 404 console errors linked to ignored media network responses

  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.removeAllListeners('requestfailed');
  page.removeAllListeners('response');

  page.on('pageerror', (error) => {
    fatalMessages.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // If a generic "Failed to load resource: 404" console error occurs,
    // and we have an unacknowledged ignored media 404 network response,
    // decrement the counter and ignore this console error.
    if (text === 'Failed to load resource: the server responded with a status of 404 ()' && ignoredMedia404Count > 0) {
      ignoredMedia404Count--;
      return; // Ignore this specific console error
    }
    // Apply original console error filtering for other cases
    if (!isIgnoredConsoleError(text)) {
      fatalMessages.push(`console.error: ${text}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/ytimg\.com|img\.youtube\.com/.test(url)) return;
    networkFailures.push(`${request.method()} ${url}: ${request.failure()?.errorText || 'failed'}`);
  });

  page.on('response', (response) => {
    // Increment counter for ignored YouTube 404s that might cause generic console errors
    if (response.status() === 404 && (/ytimg\.com|img\.youtube\.com/.test(response.url()))) {
      ignoredMedia404Count++;
    }

    if (isNetworkBlocker(response)) {
      networkBlockers.push(`${response.status()} ${response.url()}`);
    }
  });

  const url = `${BASE_URL}${target.path}`;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS });
  assert.ok(response, `${target.name} should return a response`);
  assert.ok(response.status() < 400, `${target.name} returned HTTP ${response.status()}`);

  await page.waitForSelector(target.requiredSelector, { timeout: PAGE_TIMEOUT_MS });
  const overflow = await getHorizontalOverflow(page);

  const result = {
    target: target.name,
    path: target.path,
    viewport: viewport.name,
    status: response.status(),
    horizontalOverflow: overflow,
    fatalMessages,
    networkFailures,
    networkBlockers,
  };

  assert.equal(fatalMessages.length, 0, `${target.name}/${viewport.name} fatal console errors:\n${fatalMessages.join('\n')}`);
  assert.equal(networkFailures.length, 0, `${target.name}/${viewport.name} network failures:\n${networkFailures.join('\n')}`);
  assert.equal(networkBlockers.length, 0, `${target.name}/${viewport.name} network blockers:\n${networkBlockers.join('\n')}`);
  assert.equal(overflow, 0, `${target.name}/${viewport.name} horizontal overflow: ${overflow}px`);

  return result;
}

async function main() {
  if (!BASE_URL || !isAllowedBaseUrl(BASE_URL)) {
    usage();
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    for (const target of TARGETS) {
      for (const viewport of VIEWPORTS) {
        results.push(await runTarget(page, target, viewport));
      }
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      targets: TARGETS.map((target) => target.path),
      results,
    }, null, 2));
  } catch (error) {
    console.error('Cloudflare supplied-URL smoke failed');
    console.error(error && error.stack ? error.stack : error);
    console.error(JSON.stringify({
      ok: false,
      baseUrl: BASE_URL,
      partialResults: results,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Smoke bootstrap failure');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
