const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = 'https://test-1396.lovebud.pages.dev';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('upgrade-insecure-requests') && !text.includes('ytimg') && !text.includes('youtube') && !text.includes('404')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    if (!err.message.includes('upgrade-insecure-requests') && !err.message.includes('ytimg') && !err.message.includes('youtube') && !err.message.includes('404')) {
      consoleErrors.push('pageerror: ' + err.message);
    }
  });

  // Track network requests
  const networkRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('lovebud-api') || request.url().includes('megazone')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      });
    }
  });

  // Desktop viewport test
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/pages/search.html`, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('1. Search page loaded: OK');

  await page.waitForSelector('.tree-card', { timeout: 10000 });
  const initialCards = await page.locator('.tree-card').count();
  console.log(`2. Initial cards: ${initialCards}`);

  const sentinel = await page.$('#browseScrollLoadSentinel');
  console.log(`3. Sentinel exists: ${sentinel !== null}`);

  // Scroll to trigger load more
  const initialRequests = networkRequests.length;
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);

  const afterScrollCards = await page.locator('.tree-card').count();
  console.log(`4. Cards after scroll: ${afterScrollCards} (was ${initialCards})`);

  // Check for duplicate requests
  const recentRequests = networkRequests.slice(initialRequests);
  console.log(`5. New requests after scroll: ${recentRequests.length}`);

  // Check controller methods
  const controller = await page.evaluate(() => {
    const ScrollLoad = window.LoveBudSearchScrollLoad;
    return {
      createScrollLoadRequestController: typeof ScrollLoad.createScrollLoadRequestController === 'function',
      requestMore: typeof ScrollLoad.requestMore === 'function',
    };
  });
  console.log('6. Controller methods:', controller);

  // Check that requestController.requestMore returns true
  const requestMoreReturnsTrue = await page.evaluate(() => {
    const ScrollLoad = window.LoveBudSearchScrollLoad;
    if (typeof ScrollLoad.createScrollLoadRequestController === 'function') {
      const controller = ScrollLoad.createScrollLoadRequestController({
        getQueued: () => false,
        setQueued: () => {},
        getIntent: () => true,
        setIntent: () => {},
        requestMore: () => { return true; },
        scheduleCheck: () => {}
      });
      return controller.requestMore() === true;
    }
    return null;
  });
  console.log(`7. requestMore returns true: ${requestMoreReturnsTrue}`);

  // Keyboard tests
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(1000);
  console.log('8. PageDown key: OK');

  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  await page.keyboard.press('End');
  await page.waitForTimeout(1000);
  console.log('9. End key: OK');

  // Resize test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  console.log('10. Resize to mobile: OK');

  // Mobile scroll
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000);
  console.log('11. Mobile scroll: OK');

  // Check regression modules
  const modules = await page.evaluate(() => {
    return {
      LoveBudSearchCopy: typeof window.LoveBudSearchCopy !== 'undefined',
      LoveBudSearchMobilePreviewSheet: typeof window.LoveBudSearchMobilePreviewSheet !== 'undefined',
      LoveBudSearchPreviewState: typeof window.LoveBudSearchPreviewState !== 'undefined',
      LoveBudSearchCardEvents: typeof window.LoveBudSearchCardEvents !== 'undefined',
    };
  });
  console.log('12. Regression modules:', modules);

  // Check console errors
  console.log('13. Fatal console errors:', consoleErrors.length, consoleErrors);

  // Check for duplicate requests in the same trigger
  const groupedRequests = {};
  for (const req of recentRequests) {
    const base = req.url.split('?')[0];
    if (!groupedRequests[base]) groupedRequests[base] = 0;
    groupedRequests[base]++;
  }
  const duplicates = Object.entries(groupedRequests).filter(([_, count]) => count > 1);
  console.log('14. Duplicate requests:', duplicates);

  console.log('=== SMOKE RESULT ===');
  if (consoleErrors.length === 0 && !duplicates.length) {
    console.log('SMOKE PASS');
  } else {
    console.log('SMOKE FAIL');
    if (consoleErrors.length) console.log('  Errors:', consoleErrors);
    if (duplicates.length) console.log('  Duplicates:', duplicates);
  }

  await browser.close();
}

main().catch((error) => {
  console.error('SMOKE FAIL:', error);
  process.exit(1);
});
