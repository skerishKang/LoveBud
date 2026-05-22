const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_TREE = {
  id: 'tree-login-e2e-1',
  title: '로그인 후 내 트리',
  visibility: 'private',
  createdAt: '2026-04-20T00:00:00Z',
  ownerId: 'login-e2e-user-1',
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`console.${msg.type()}: ${msg.text()}`);
    }
  });

  await page.route('**/api/trees', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([MOCK_TREE]),
    });
  });

  await page.route('**/api/memories**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([]),
    });
  });

  try {
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });

    const loginBody = await page.textContent('body');
    assert.ok(loginBody && loginBody.length > 0, 'login page should render');

    await page.evaluate(() => {
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', JSON.stringify({
        uid: 'login-e2e-user-1',
        email: 'login-e2e@example.com',
        displayName: 'Login E2E User',
      }));
      window.__lovebudAuthReady = true;
    });

    await page.goto(`${BASE_URL}/my-trees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const finalUrl = page.url();
    const bodyText = await page.textContent('body');

    assert.ok(
      finalUrl.includes('my-trees.html') || finalUrl.includes('editor.html'),
      `expected post-login landing to reach protected flow, got: ${finalUrl}`
    );

    assert.ok(
      bodyText && !/로그인\s*실패|auth error|unauthorized/i.test(bodyText),
      'post-login landing should not show obvious auth failure state'
    );

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: login success path');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: login success path');
    console.error(error);

    if (consoleErrors.length > 0) {
      console.error('Captured console/page errors:');
      console.error(consoleErrors.join('\n'));
    }

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('E2E bootstrap failure');
  console.error(error);
  process.exit(1);
});
