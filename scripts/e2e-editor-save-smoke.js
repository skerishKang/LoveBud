const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_TREE = {
  id: 'tree-editor-e2e-1',
  title: '기존 러브트리',
  visibility: 'private',
  createdAt: '2026-04-20T00:00:00Z',
  ownerId: 'e2e-user-1',
};

const MOCK_MEMORY = {
  id: 'memory-editor-e2e-1',
  treeId: 'tree-editor-e2e-1',
  parentId: null,
  title: '기존 메모리',
  memo: '초기 데이터',
  timestamp: '2024-01',
  thumbnail: '',
  visibility: 'private',
  artist: 'E2E Artist',
  source: 'YouTube',
  sourceUrl: 'https://example.com/watch?v=editor',
  sourceType: 'youtube',
  emotionTags: ['설렘'],
  createdAt: '2026-04-20T00:00:00Z',
  updatedAt: '2026-04-20T00:00:00Z',
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const writeRequests = [];

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

    if (req.method() === 'POST') {
      writeRequests.push({ method: 'POST', url: req.url(), body: req.postData() });
      return route.fulfill({
        status: 201,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          ...MOCK_TREE,
          title: '새 러브트리',
        }),
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

    if (req.method() === 'PUT' || req.method() === 'DELETE') {
      writeRequests.push({ method: req.method(), url: req.url(), body: req.postData() });
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ ...MOCK_TREE }),
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

    if (req.method() === 'POST') {
      writeRequests.push({ method: 'POST', url: req.url(), body: req.postData() });
      return route.fulfill({
        status: 201,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          ...MOCK_MEMORY,
          id: 'memory-editor-e2e-created',
          title: '새 메모리',
        }),
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

    if (req.method() === 'PUT' || req.method() === 'DELETE') {
      writeRequests.push({ method: req.method(), url: req.url(), body: req.postData() });
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(MOCK_MEMORY),
      });
    }

    return route.fallback();
  });

  try {
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    assert.ok(bodyText && bodyText.length > 0, 'editor page should render');

    const titleInput = page.locator('input[name="title"], #treeTitle, .tree-title-input').first();
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.fill('E2E 저장 테스트 트리');
      await page.waitForTimeout(300);
    }

    const memoInput = page.locator('textarea[name="memo"], textarea, .memo-input').first();
    if (await memoInput.isVisible().catch(() => false)) {
      await memoInput.fill('E2E editor save flow');
      await page.waitForTimeout(300);
    }

    const saveButton = page.locator(
      'button:has-text("저장"), button:has-text("Save"), #saveBtn, .save-btn'
    ).first();

    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1500);
    } else {
      const form = page.locator('form').first();
      if (await form.isVisible().catch(() => false)) {
        await form.evaluate((node) => {
          node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(1500);
      }
    }

    assert.ok(
      writeRequests.length >= 1,
      `editor save flow should trigger at least one write request, got ${writeRequests.length}`
    );

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: editor save flow');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: editor save flow');
    console.error(error);

    if (consoleErrors.length > 0) {
      console.error('Captured console/page errors:');
      console.error(consoleErrors.join('\n'));
    }

    if (writeRequests.length > 0) {
      console.error('Captured write requests:');
      console.error(JSON.stringify(writeRequests, null, 2));
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
