const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const RAW_BASE_URL = process.env.SMOKE_BASE_URL || process.env.LOVEBUD_URL || 'http://localhost:8888';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const PAGE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const PUBLIC_TREE_ID = process.env.PUBLIC_VIEWER_TREE_ID || '10340000-0000-4000-8000-000000000001';

const VIEWPORTS = [
  { name: 'phone-360x800', width: 360, height: 800, expectedPhoneStructured: true },
  { name: 'phone-390x844', width: 390, height: 844, expectedPhoneStructured: true },
  { name: 'phone-430x932', width: 430, height: 932, expectedPhoneStructured: true },
  // 853x1280 is portrait, but intentionally wider than the current <=560px phone guard.
  // Keep this explicit so future breakpoint changes are intentional.
  { name: 'wide-portrait-853x1280', width: 853, height: 1280, expectedPhoneStructured: false },
  { name: 'desktop-1280x800', width: 1280, height: 800, expectedPhoneStructured: false },
];

function usage() {
  console.error('Usage:');
  console.error('  SMOKE_BASE_URL=https://lovebud.pages.dev npm run test:e2e:public-viewer-mobile');
  console.error('Optional:');
  console.error('  PUBLIC_VIEWER_TREE_ID=10340000-0000-4000-8000-000000000001');
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
  return value.includes('ytimg.com') ||
    value.includes('img.youtube.com') ||
    value.includes('favicon');
}

function isNetworkBlocker(response) {
  const url = response.url();
  const status = response.status();
  if (status < 400) return false;
  if (/ytimg\.com|img\.youtube\.com/.test(url)) return false;
  if (/favicon\.(ico|png|svg)$/.test(url)) return false;
  return true;
}

async function isHiddenOrAbsent(page, selector) {
  return page.evaluate((targetSelector) => {
    const el = document.querySelector(targetSelector);
    if (!el) return true;
    const style = window.getComputedStyle(el);
    return el.hidden ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      el.getAttribute('aria-hidden') === 'true';
  }, selector);
}

async function getHorizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
}

async function getBodyState(page) {
  return page.evaluate(() => ({
    bodyClass: document.body.className,
    bodyText: document.body.innerText || '',
    layoutLabel: (document.getElementById('layoutModeToggleLabel')?.textContent || '').trim(),
    nodeCount: document.querySelectorAll('.memory-node').length,
    firstNodeTitle: (document.querySelector('.memory-node .node-title')?.textContent || '').trim(),
    editHidden: (() => {
      const el = document.getElementById('editMemoryBtn');
      if (!el) return true;
      const style = window.getComputedStyle(el);
      return el.hidden || style.display === 'none' || style.visibility === 'hidden';
    })(),
    continueHidden: (() => {
      const el = document.getElementById('continueFromMomentBtn');
      if (!el) return true;
      const style = window.getComputedStyle(el);
      return el.hidden || style.display === 'none' || style.visibility === 'hidden';
    })(),
    saveStatusHidden: (() => {
      const el = document.querySelector('.editor-save-status-card');
      if (!el) return true;
      const style = window.getComputedStyle(el);
      return el.hidden || style.display === 'none' || style.visibility === 'hidden';
    })(),
  }));
}

async function waitForPublicCanvasReady(page) {
  await page.waitForSelector('body.editor-readonly', { timeout: PAGE_TIMEOUT_MS });
  await page.waitForFunction(() => document.querySelectorAll('.memory-node').length > 0, null, {
    timeout: PAGE_TIMEOUT_MS,
  });
  await page.waitForFunction(() => {
    const text = document.body.innerText || '';
    return text.includes('선택한 순간') && text.includes('순간 자세히 보기');
  }, null, { timeout: PAGE_TIMEOUT_MS });
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.width <= 560,
  });
  const page = await context.newPage();
  const fatalMessages = [];
  const networkFailures = [];
  const networkBlockers = [];
  const infoLogs = [];
  let ignoredMedia404Count = 0;

  page.on('pageerror', (error) => {
    fatalMessages.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') {
      if (text === 'Failed to load resource: the server responded with a status of 404 ()' && ignoredMedia404Count > 0) {
        ignoredMedia404Count -= 1;
        return;
      }
      if (!isIgnoredConsoleError(text)) {
        fatalMessages.push(`console.error: ${text}`);
      }
      return;
    }
    if (text.includes('[public-canvas]')) {
      infoLogs.push(text);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/ytimg\.com|img\.youtube\.com/.test(url)) return;
    networkFailures.push(`${request.method()} ${url}: ${request.failure()?.errorText || 'failed'}`);
  });

  page.on('response', (response) => {
    if (response.status() === 404 && (/ytimg\.com|img\.youtube\.com/.test(response.url()))) {
      ignoredMedia404Count += 1;
    }
    if (isNetworkBlocker(response)) {
      networkBlockers.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      // Storage may be unavailable in restricted browser contexts.
    }
  });

  const targetUrl = `${BASE_URL}/pages/view.html?treeId=${encodeURIComponent(PUBLIC_TREE_ID)}`;
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
  assert.ok(response, `${viewport.name} should return a response`);
  assert.ok(response.status() < 400, `${viewport.name} returned HTTP ${response.status()}`);

  await waitForPublicCanvasReady(page);
  await page.waitForTimeout(250);

  const state = await getBodyState(page);
  const overflow = await getHorizontalOverflow(page);
  const editHidden = await isHiddenOrAbsent(page, '#editMemoryBtn');
  const continueHidden = await isHiddenOrAbsent(page, '#continueFromMomentBtn');
  const saveHidden = await isHiddenOrAbsent(page, '.editor-save-status-card');

  assert.equal(fatalMessages.length, 0, `${viewport.name} fatal console/page errors:\n${fatalMessages.join('\n')}`);
  assert.equal(networkFailures.length, 0, `${viewport.name} network failures:\n${networkFailures.join('\n')}`);
  assert.equal(networkBlockers.length, 0, `${viewport.name} network blockers:\n${networkBlockers.join('\n')}`);
  assert.equal(overflow, 0, `${viewport.name} horizontal overflow: ${overflow}px`);

  assert.ok(state.bodyClass.includes('editor-readonly'), `${viewport.name} must run as read-only public viewer`);
  assert.ok(state.nodeCount > 0, `${viewport.name} must render at least one memory node`);
  assert.ok(state.firstNodeTitle.length > 0, `${viewport.name} must render a visible node title`);

  assert.equal(state.bodyText.includes('editor_layout_free'), false, `${viewport.name} must not expose raw free layout key`);
  assert.equal(state.bodyText.includes('editor_layout_structured'), false, `${viewport.name} must not expose raw structured layout key`);

  assert.ok(state.bodyText.includes('선택한 순간'), `${viewport.name} must render public viewer selected-moment copy`);
  assert.ok(state.bodyText.includes('순간 자세히 보기'), `${viewport.name} must render public viewer detail CTA copy`);
  assert.ok(state.bodyText.includes('감상 동선'), `${viewport.name} must render viewer action-section copy`);
  assert.ok(state.bodyText.includes('순간 기록'), `${viewport.name} must render moment record label`);
  assert.ok(state.bodyText.includes('감정 태그'), `${viewport.name} must render tag label`);
  assert.ok(state.bodyText.includes('남긴 메모'), `${viewport.name} must render memo label`);

  assert.equal(editHidden && state.editHidden, true, `${viewport.name} must hide edit memory button`);
  assert.equal(continueHidden && state.continueHidden, true, `${viewport.name} must hide continue button`);
  assert.equal(saveHidden && state.saveStatusHidden, true, `${viewport.name} must hide save status card`);

  if (viewport.expectedPhoneStructured) {
    assert.ok(
      state.bodyClass.includes('layout-structured'),
      `${viewport.name} phone-width public viewer must default to structured layout; body class was: ${state.bodyClass}`
    );
    assert.ok(
      ['정리된 트리', '구조 보기'].includes(state.layoutLabel),
      `${viewport.name} structured layout label must be Korean copy, got: ${state.layoutLabel}`
    );
  } else {
    assert.equal(
      state.bodyClass.includes('layout-structured'),
      false,
      `${viewport.name} must not be treated as phone-width structured layout unless product breakpoint changes`
    );
  }

  const hasLoadedTreeLog = infoLogs.some((line) => line.includes('Loaded tree'));
  const hasCanvasReadyLog = infoLogs.some((line) => line.includes('Canvas initialized successfully'));

  assert.equal(hasLoadedTreeLog, true, `${viewport.name} must log Loaded tree`);
  assert.equal(hasCanvasReadyLog, true, `${viewport.name} must log Canvas initialized successfully`);

  await context.close();

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    status: response.status(),
    nodeCount: state.nodeCount,
    layoutLabel: state.layoutLabel,
    bodyClass: state.bodyClass,
    horizontalOverflow: overflow,
  };
}

async function main() {
  if (!BASE_URL || !isAllowedBaseUrl(BASE_URL)) {
    usage();
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      results.push(await runViewport(browser, viewport));
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      treeId: PUBLIC_TREE_ID,
      results,
    }, null, 2));
  } catch (error) {
    console.error('Public viewer mobile smoke failed');
    console.error(error && error.stack ? error.stack : error);
    console.error(JSON.stringify({
      ok: false,
      baseUrl: BASE_URL,
      treeId: PUBLIC_TREE_ID,
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
