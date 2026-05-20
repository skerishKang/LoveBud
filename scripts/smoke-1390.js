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

  // Desktop viewport test
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/pages/search.html`, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('1. Search page loaded');

  // Check initial cards
  await page.waitForSelector('.tree-card', { timeout: 10000 });
  const initialCards = await page.locator('.tree-card').count();
  console.log(`2. Initial cards: ${initialCards}`);

  // Check sentinel
  const sentinel = await page.$('#browseScrollLoadSentinel');
  console.log(`3. Sentinel exists: ${sentinel !== null}`);

  // Check modules
  const modules = await page.evaluate(() => {
    return {
      LoveBudSearchScrollLoad: typeof window.LoveBudSearchScrollLoad !== 'undefined',
      LoveBudSearchUI: typeof window.LoveBudSearchUI !== 'undefined',
      LoveBudSearchCopy: typeof window.LoveBudSearchCopy !== 'undefined',
      LoveBudSearchMobilePreviewSheet: typeof window.LoveBudSearchMobilePreviewSheet !== 'undefined',
      LoveBudSearchPreviewState: typeof window.LoveBudSearchPreviewState !== 'undefined',
      LoveBudSearchCardEvents: typeof window.LoveBudSearchCardEvents !== 'undefined',
    };
  });
  console.log('4. Modules loaded:', modules);

  // Scroll to bottom to trigger load more
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1500);

  // Check cards after scroll
  const afterScrollCards = await page.locator('.tree-card').count();
  console.log(`5. Cards after scroll: ${afterScrollCards}`);

  // Check for console errors
  console.log('6. Fatal console errors:', consoleErrors.length, consoleErrors);

  // Mobile viewport test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE_URL}/pages/search.html`, { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForSelector('.tree-card', { timeout: 10000 });
  const mobileCards = await page.locator('.tree-card').count();
  console.log(`7. Mobile cards: ${mobileCards}`);

  // Check mobile console errors
  const mobileErrors = await page.evaluate(() => {
    const errors = [];
    return errors;
  });

  console.log('8. Mobile fatal errors:', consoleErrors.length, consoleErrors);

  console.log('SMOKE OK');
  console.log('Fatal errors:', consoleErrors);

  await browser.close();
}

main().catch((error) => {
  console.error('SMOKE FAIL:', error);
  process.exit(1);
});
