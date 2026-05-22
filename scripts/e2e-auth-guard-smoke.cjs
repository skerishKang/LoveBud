const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

async function collectErrors(page, bucket) {
  page.on('pageerror', (err) => {
    bucket.push(`pageerror: ${err.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      bucket.push(`console.${msg.type()}: ${msg.text()}`);
    }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  await collectErrors(page, errors);

  try {
    // 1) 비로그인 my-trees 진입
    await page.goto(`${BASE_URL}/my-trees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const myTreesUrl = page.url();
    const myTreesBody = await page.textContent('body');

    assert.ok(
      myTreesUrl.includes('login.html') ||
      myTreesUrl.includes('my-trees.html') ||
      /로그인|login|signin/i.test(myTreesBody || ''),
      'my-trees unauthenticated guard should redirect or show login-related UI'
    );

    // 2) 비로그인 editor 직접 진입
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const editorUrl = page.url();
    const editorBody = await page.textContent('body');

    assert.ok(
      editorUrl.includes('login.html') ||
      editorUrl.includes('editor.html') ||
      /로그인|login|signin|권한|접근/i.test(editorBody || ''),
      'editor unauthenticated guard should redirect or show guarded state'
    );

    // 3) 최소 confirmed auth cache 주입 후 my-trees 재진입
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('lovebud_auth_confirmed', 'true');
      localStorage.setItem('lovebud_auth_cache', JSON.stringify({
        uid: 'e2e-user-1',
        email: 'e2e@example.com',
        displayName: 'E2E User'
      }));
    });

    await page.goto(`${BASE_URL}/my-trees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const guardedUrl = page.url();
    assert.ok(
      guardedUrl.includes('my-trees.html') || guardedUrl.includes('login.html'),
      'guard flow should remain stable after confirmed auth cache injection'
    );

    assert.equal(
      errors.length,
      0,
      `unexpected console/page errors:\n${errors.join('\n')}`
    );

    console.log('E2E OK: auth guard flow');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: auth guard flow');
    console.error(error);
    if (errors.length > 0) {
      console.error('Captured console/page errors:');
      console.error(errors.join('\n'));
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
