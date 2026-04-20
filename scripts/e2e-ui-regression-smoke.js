const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_TREE = {
  id: 'tree-ui-e2e-empty-1',
  title: 'UI 회귀 점검 트리',
  visibility: 'private',
  createdAt: '2026-04-20T00:00:00Z',
  ownerId: 'ui-e2e-user-1',
};

async function verifySettingsNavigation(page) {
  await page.goto(`${BASE_URL}/settings.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#shared-header a', { timeout: 10000 });

  const settingsLink = page.locator('#shared-header a').filter({ hasText: '설정' }).first();
  await settingsLink.waitFor({ state: 'visible', timeout: 10000 });

  const href = await settingsLink.getAttribute('href');
  assert.ok(href && href.includes('settings.html'), `settings link should point to settings.html, got: ${href}`);

  const className = await settingsLink.getAttribute('class');
  assert.ok((className || '').includes('active'), 'settings menu should be active on settings page');

  const bodyText = await page.textContent('body');
  assert.ok(bodyText && bodyText.includes('기본 공개 범위'), 'settings page should render core settings content');
}

async function verifyEditorEmptyState(page) {
  await page.goto(`${BASE_URL}/editor.html?treeId=${MOCK_TREE.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.waitForSelector('#renameTreeBtn', { timeout: 10000 });
  await page.waitForSelector('#detailEmptyState', { timeout: 10000 });

  const emptyVisible = await page.locator('#detailEmptyState').isVisible();
  assert.equal(emptyVisible, true, 'editor empty state should be visible for empty tree');

  const bodyText = await page.textContent('body');
  assert.ok(bodyText && bodyText.includes('첫 순간'), 'editor should render first-moment onboarding text');
  assert.ok(bodyText && bodyText.includes('트리 전체 보기'), 'editor sidebar should render viewport controls');

  const renameButtonVisible = await page.locator('#renameTreeBtn').isVisible();
  assert.equal(renameButtonVisible, true, 'rename button should render inline in editor sidebar');
}

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

  await page.addInitScript(() => {
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem('lovebud_auth_cache', JSON.stringify({
      uid: 'ui-e2e-user-1',
      email: 'ui-e2e@example.com',
      displayName: 'UI E2E User',
    }));
  });

  await page.route('**/api/trees', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify([MOCK_TREE]),
      });
    }
    return route.fallback();
  });

  await page.route(`**/api/trees/${MOCK_TREE.id}`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          ...MOCK_TREE,
          memories: [],
        }),
      });
    }
    return route.fallback();
  });

  await page.route(`**/api/memories?treeId=${MOCK_TREE.id}`, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/memories', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify([]),
      });
    }
    return route.fallback();
  });

  try {
    await verifySettingsNavigation(page);
    await verifyEditorEmptyState(page);

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: settings navigation and editor empty-state regression smoke');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: settings navigation and editor empty-state regression smoke');
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
