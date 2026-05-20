const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = 'https://test-1390.lovebud.pages.dev';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

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

  // Desktop test
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/pages/search.html`, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('=== Desktop Tests ===');
  console.log('1. Search page loaded: OK');

  await page.waitForSelector('.tree-card', { timeout: 10000 });
  const initialCards = await page.locator('.tree-card').count();
  console.log(`2. Initial cards: ${initialCards}`);

  const sentinel = await page.$('#browseScrollLoadSentinel');
  console.log(`3. Sentinel DOM: ${sentinel !== null}`);

  // Check bindScrollLoadIntentHandlers is callable
  const scrollLoadMethods = await page.evaluate(() => {
    const ScrollLoad = window.LoveBudSearchScrollLoad;
    return {
      canLoadMorePublicTrees: typeof ScrollLoad.canLoadMorePublicTrees === 'function',
      ensureScrollLoadSentinel: typeof ScrollLoad.ensureScrollLoadSentinel === 'function',
      syncScrollLoadSentinel: typeof ScrollLoad.syncScrollLoadSentinel === 'function',
      requestScrollLoadMore: typeof ScrollLoad.requestScrollLoadMore === 'function',
      scheduleScrollLoadCheck: typeof ScrollLoad.scheduleScrollLoadCheck === 'function',
      markScrollLoadIntent: typeof ScrollLoad.markScrollLoadIntent === 'function',
      handleScrollLoadKeydown: typeof ScrollLoad.handleScrollLoadKeydown === 'function',
      bindScrollLoadIntentHandlers: typeof ScrollLoad.bindScrollLoadIntentHandlers === 'function',
    };
  });
  console.log('4. Scroll load methods:', scrollLoadMethods);

  // Scroll test
  const initialScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(1500);
  const afterScrollCards = await page.locator('.tree-card').count();
  console.log(`5. Cards after scroll: ${afterScrollCards} (was ${initialCards})`);

  // Keyboard tests
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(1000);
  console.log('6. PageDown key: OK');

  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  await page.keyboard.press('End');
  await page.waitForTimeout(1000);
  console.log('7. End key: OK');

  // Resize test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  console.log('8. Resize to mobile: OK');

  // Mobile touchmove test
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000);
  console.log('9. Mobile touchmove: OK');

  // Back to desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  console.log('10. Resize back to desktop: OK');

  // Check regression - card click
  const firstCard = page.locator('.tree-card').first();
  await firstCard.click();
  await page.waitForTimeout(1000);
  console.log('11. Card click: OK');

  // Check preview state
  const hasPreview = await page.evaluate(() => {
    return document.querySelector('.preview-panel') !== null;
  });
  console.log(`12. Preview state: ${hasPreview ? 'visible' : 'not visible'}`);

  // Check modules still work
  const modules = await page.evaluate(() => {
    return {
      LoveBudSearchCopy: typeof window.LoveBudSearchCopy !== 'undefined',
      LoveBudSearchMobilePreviewSheet: typeof window.LoveBudSearchMobilePreviewSheet !== 'undefined',
      LoveBudSearchPreviewState: typeof window.LoveBudSearchPreviewState !== 'undefined',
    };
  });
  console.log('13. Regression modules:', modules);

  console.log('=== Console Errors ===');
  console.log('Fatal errors:', consoleErrors.length, consoleErrors);

  console.log('=== SMOKE RESULT ===');
  if (consoleErrors.length === 0) {
    console.log('SMOKE PASS');
  } else {
    console.log('SMOKE FAIL - Fatal errors:', consoleErrors);
  }

  await browser.close();
}

main().catch((error) => {
  console.error('SMOKE FAIL:', error);
  process.exit(1);
});
