const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_TREE = {
  id: 'tree-editor-e2e-1',
  title: '삭제 테스트 러브트리',
  visibility: 'private',
  createdAt: '2026-04-20T00:00:00Z',
  ownerId: 'e2e-user-1',
};

const MOCK_MEMORY = {
  id: 'memory-editor-e2e-1',
  treeId: 'tree-editor-e2e-1',
  parentId: null,
  title: '삭제 테스트 메모리',
  memo: '삭제될 데이터',
  timestamp: '2024-01',
  thumbnail: '',
  visibility: 'private',
  artist: 'E2E Artist',
  source: 'YouTube',
  sourceUrl: 'https://example.com/watch?v=editor-delete',
  sourceType: 'youtube',
  emotionTags: ['설렘'],
  createdAt: '2026-04-20T00:00:00Z',
  updatedAt: '2026-04-20T00:00:00Z',
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const deleteRequests = [];

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
      uid: 'e2e-user-1',
      email: 'e2e@example.com',
      displayName: 'E2E User',
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
          memories: [MOCK_MEMORY],
        }),
      });
    }
    if (req.method() === 'DELETE') {
      deleteRequests.push({ method: 'DELETE', url: req.url(), target: 'tree' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true }),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/memories', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify([MOCK_MEMORY]),
      });
    }
    return route.fallback();
  });

  await page.route(`**/api/memories/${MOCK_MEMORY.id}`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(MOCK_MEMORY),
      });
    }
    if (req.method() === 'DELETE') {
      deleteRequests.push({ method: 'DELETE', url: req.url(), target: 'memory' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true }),
      });
    }
    return route.fallback();
  });

  try {
    await page.goto(`${BASE_URL}/editor.html?tree=${MOCK_TREE.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    assert.ok(bodyText && bodyText.length > 0, 'editor page should render with tree context');
    assert.ok(
      bodyText.includes(MOCK_MEMORY.title) || bodyText.includes('메모리'),
      'editor should display existing memory content'
    );

    const deleteButtons = [
      page.locator('button:has-text("삭제"), button:has-text("Delete"), .delete-btn, [data-action="delete"]').first(),
      page.locator('[data-testid="delete-btn"], #deleteBtn, button.delete').first(),
    ];

    let clicked = false;
    for (const btn of deleteButtons) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1000);

        const confirmBtn = page.locator(
          'button:has-text("확인"), button:has-text("Confirm"), button:has-text("예"), .confirm-delete'
        ).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(1500);
        }
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      const moreMenu = page.locator('[data-testid="more-actions"], .more-actions, #moreActions').first();
      if (await moreMenu.isVisible().catch(() => false)) {
        await moreMenu.click();
        await page.waitForTimeout(500);
        const deleteOption = page.locator('button:has-text("삭제"), .delete-option').first();
        if (await deleteOption.isVisible().catch(() => false)) {
          await deleteOption.click();
          await page.waitForTimeout(500);
          const confirmBtn = page.locator('button:has-text("확인"), button:has-text("Confirm"), .confirm-delete').first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(1500);
          }
        }
        clicked = true;
      }
    }

    assert.ok(
      deleteRequests.length >= 1,
      `editor delete flow should trigger at least one DELETE request, got ${deleteRequests.length}`
    );

    const hasMemoryDelete = deleteRequests.some(r => r.target === 'memory');
    const hasTreeDelete = deleteRequests.some(r => r.target === 'tree');
    assert.ok(
      hasMemoryDelete || hasTreeDelete,
      'at least one DELETE request should be for memory or tree'
    );

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: editor delete flow');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: editor delete flow');
    console.error(error);

    if (consoleErrors.length > 0) {
      console.error('Captured console/page errors:');
      console.error(consoleErrors.join('\n'));
    }

    if (deleteRequests.length > 0) {
      console.error('Captured DELETE requests:');
      console.error(JSON.stringify(deleteRequests, null, 2));
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
