const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_TREE = {
  id: 'tree-e2e-1',
  title: 'E2E 러브트리',
  visibility: 'public',
  createdAt: '2026-04-20T00:00:00Z',
  ownerId: 'user-e2e-1',
};

const MOCK_MEMORY = {
  id: 'memory-e2e-1',
  treeId: 'tree-e2e-1',
  parentId: null,
  title: '첫 추억',
  memo: '브라우저 E2E detail 이동 테스트',
  quote: '',
  timestamp: '2024-01',
  thumbnail: 'https://example.com/thumb.jpg',
  visibility: 'public',
  artist: 'E2E Artist',
  source: 'YouTube',
  sourceUrl: 'https://example.com/watch?v=test',
  sourceType: 'youtube',
  emotionTags: ['설렘', '행복'],
  createdAt: '2026-04-20T00:00:00Z',
  updatedAt: '2026-04-20T00:00:00Z',
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

  await page.route('**/api/community/trees', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([MOCK_TREE]),
    });
  });

  await page.route('**/api/community/memories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([MOCK_MEMORY]),
    });
  });

  await page.route(`**/api/memories/${MOCK_MEMORY.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(MOCK_MEMORY),
    });
  });

  await page.route(`**/api/memories?treeId=${MOCK_TREE.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify([MOCK_MEMORY]),
    });
  });

  try {
    await page.goto(`${BASE_URL}/search.html`, { waitUntil: 'networkidle' });

    await page.waitForSelector('.tree-card', { timeout: 10000 });
    const cards = await page.locator('.tree-card').count();
    assert.ok(cards >= 1, 'search page should render at least one tree card');

    await page.locator('.tree-card').first().click();

    await page.waitForURL(
      new RegExp(`detail\\.html\\?id=${MOCK_MEMORY.id}&tree=${MOCK_TREE.id}`),
      { timeout: 10000 }
    );

    const finalUrl = page.url();
    assert.match(
      finalUrl,
      new RegExp(`detail\\.html\\?id=${MOCK_MEMORY.id}&tree=${MOCK_TREE.id}`),
      'clicking a search card should navigate to detail alias path'
    );

    const pageText = await page.textContent('body');
    assert.ok(
      pageText && pageText.includes('첫 추억'),
      'detail page should render mocked memory content'
    );

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: search -> detail flow');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: search -> detail flow');
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
