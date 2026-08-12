/**
 * Issue #4013 — negative controls for the hermetic external-network policy.
 *
 * Proves the boundary enforced by `tests/helpers/external-network-hermetic.cjs`
 * and adopted by the affected real-local browser contracts:
 *
 *   NC1 hostname/pathname regression: a fonts.googleapis.com URL must hit the
 *       deterministic fixture branch (hostname-aware, not pathname-aware).
 *   NC2 unexpected external origin: a synthetic https://example.invalid/...
 *       request is prevented from reaching the real network and is surfaced as
 *       an explicit unexpected-external failure with its exact URL.
 *   NC3 same-origin 404: a local fixture 404 still fails and reports its exact
 *       URL/status (same-origin 4xx checks stay strict).
 *   NC4 browser console health: a genuine console error is still captured, so
 *       the health assertions keep failing loudly — no blanket filtering.
 *
 * Refs #4013.
 * Refs #1882 — Keep OPEN.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  isKnownExternalHost,
  makeHermeticRouteHandler,
  defaultFulfillExternal,
} = require('../helpers/external-network-hermetic.cjs');

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  throw new Error(`PLAYWRIGHT_PACKAGE_UNAVAILABLE: ${err && err.message ? err.message : err}`);
}

const MARKER_CSS = '/* nc1-font-fixture */';

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body id="app">ok</body></html>');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(() => resolve(), 300);
  });
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  } catch (err) {
    throw new Error(`PLAYWRIGHT_BROWSER_BINARY_UNAVAILABLE: ${err && err.message ? err.message : err}`);
  }
}

test('NC1: fonts.googleapis.com URL hits the deterministic fixture branch (hostname, not pathname)', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const unexpected = [];
    await page.route('**/*', makeHermeticRouteHandler({
      fixtureOrigin,
      onUnexpectedExternal: (url) => unexpected.push(url),
      fulfillExternal: async (route, target) => {
        if (target.hostname === 'fonts.googleapis.com') {
          await route.fulfill({
            status: 200,
            contentType: 'text/css; charset=utf-8',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: MARKER_CSS,
          });
          return;
        }
        await defaultFulfillExternal(route, target);
      },
    }));
    await page.goto(`${fixtureOrigin}/`, { waitUntil: 'domcontentloaded' });
    const body = await page.evaluate(async () => {
      const res = await fetch('https://fonts.googleapis.com/css2?family=NC1&display=swap');
      return res.status === 200 ? res.text() : null;
    });
    assert.equal(body, MARKER_CSS, 'fonts.googleapis.com must be served by the deterministic fixture branch');
    assert.deepEqual(unexpected, [], 'no unexpected external recorded while fixture-branching the font');
    await context.close();
  } finally {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
  }
});

test('NC2: unexpected external origin is prevented from real network and surfaced explicitly', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const unexpected = [];
    const requestFailures = [];
    page.on('requestfailed', (req) => requestFailures.push(req.url()));
    await page.route('**/*', makeHermeticRouteHandler({
      fixtureOrigin,
      onUnexpectedExternal: (url) => unexpected.push(url),
    }));
    await page.goto(`${fixtureOrigin}/`, { waitUntil: 'domcontentloaded' });
    const outcome = await page.evaluate(() => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://example.invalid/nc2-evil.js';
      s.onload = () => resolve('loaded');
      s.onerror = () => resolve('blocked');
      document.head.appendChild(s);
    }));
    assert.equal(outcome, 'blocked', 'unexpected external script must not load from the real network');
    assert.ok(
      unexpected.some((u) => u.startsWith('https://example.invalid/nc2-evil.js')),
      `unexpected external URL must be recorded with its exact URL, got: ${JSON.stringify(unexpected)}`
    );
    assert.ok(
      requestFailures.some((u) => u.startsWith('https://example.invalid/nc2-evil.js')),
      `aborted request must be visible as a requestfailure, got: ${JSON.stringify(requestFailures)}`
    );
    await context.close();
  } finally {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
  }
});

test('NC3: same-origin 404 still fails and reports its exact URL/status', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const unexpected = [];
    const responseErrors = [];
    page.on('response', (res) => {
      const url = res.url();
      try {
        if (new URL(url).origin === fixtureOrigin && res.status() >= 400) {
          responseErrors.push({ url, status: res.status() });
        }
      } catch (e) { /* non-HTTP */ }
    });
    await page.route('**/*', makeHermeticRouteHandler({
      fixtureOrigin,
      onUnexpectedExternal: (url) => unexpected.push(url),
    }));
    await page.goto(`${fixtureOrigin}/`, { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate(async () => {
      const r = await fetch('/nc3-missing-asset');
      return { status: r.status };
    });
    assert.equal(res.status, 404, 'same-origin fixture 404 is served by the local server');
    const hit = responseErrors.find(
      (e) => e.url.includes('/nc3-missing-asset') && e.status === 404
    );
    assert.ok(hit, `same-origin 404 must be recorded with exact URL/status, got: ${JSON.stringify(responseErrors)}`);
    assert.deepEqual(unexpected, [], 'a same-origin 404 is not an unexpected external escape');
    await context.close();
  } finally {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
  }
});

test('NC4: genuine console error is still captured (no blanket filtering)', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  const { server, port } = await startServer();
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.route('**/*', makeHermeticRouteHandler({
      fixtureOrigin,
      onUnexpectedExternal: () => {},
    }));
    await page.goto(`${fixtureOrigin}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      // eslint-disable-next-line no-console
      console.error('NC4 genuine console error');
    });
    await page.waitForTimeout(200);
    assert.ok(
      consoleErrors.some((t) => t.includes('NC4 genuine console error')),
      `genuine console error must be captured, got: ${JSON.stringify(consoleErrors)}`
    );
    assert.throws(
      () => assert.deepEqual(consoleErrors, []),
      /NC4 genuine console error/,
      'health assertion on consoleErrors must still fail loudly (no blanket filtering)'
    );
    await context.close();
  } finally {
    if (context) await context.close();
    await browser.close();
    await closeServer(server);
  }
});

test('NC0: classifier unit — hostname-based, never pathname-based', () => {
  assert.equal(isKnownExternalHost('fonts.googleapis.com'), true, 'fonts.googleapis.com is known');
  assert.equal(isKnownExternalHost('fonts.gstatic.com'), true, 'fonts.gstatic.com is known');
  assert.equal(isKnownExternalHost('www.gstatic.com'), true, 'www.gstatic.com is known');
  assert.equal(isKnownExternalHost('relovetree.firebaseapp.com'), true, 'firebaseapp.com suffix is known');
  assert.equal(isKnownExternalHost('example.invalid'), false, 'example.invalid is unexpected');
  assert.equal(isKnownExternalHost('127.0.0.1'), false, 'same-origin host is not external');
  assert.equal(isKnownExternalHost(''), false, 'empty host is not known');
});
