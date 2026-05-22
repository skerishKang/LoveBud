const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

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
    localStorage.removeItem('lovebud_auth_confirmed');
    localStorage.removeItem('lovebud_auth_cache');
    localStorage.removeItem('lovebud_auth_token');
    localStorage.removeItem('isLoggedIn');
    window.__lovebudAuthReady = false;
  });

  try {
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });

    const loginBody = await page.textContent('body');
    assert.ok(loginBody && loginBody.length > 0, 'login page should render in timeout test');

    await page.goto(`${BASE_URL}/my-trees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const myTreesUrl = page.url();
    const myTreesBody = await page.textContent('body');

    assert.ok(
      myTreesUrl.includes('login.html') ||
      myTreesUrl.includes('my-trees.html') ||
      /로그인|login|signin|권한|접근/i.test(myTreesBody || ''),
      `unauthenticated timeout flow should stay guarded, got: ${myTreesUrl}`
    );

    assert.ok(
      !/내 트리 목록|새 트리 만들기|저장 완료/i.test(myTreesBody || ''),
      'timeout flow should not look like authenticated success state'
    );

    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const editorUrl = page.url();
    const editorBody = await page.textContent('body');

    assert.ok(
      editorUrl.includes('login.html') ||
      editorUrl.includes('editor.html') ||
      /로그인|login|signin|권한|접근/i.test(editorBody || ''),
      `editor timeout flow should remain guarded, got: ${editorUrl}`
    );

    assert.ok(
      !/저장 완료|삭제 완료|편집 저장/i.test(editorBody || ''),
      'editor timeout flow should not enter authenticated success state'
    );

    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console/page errors:\n${consoleErrors.join('\n')}`
    );

    console.log('E2E OK: login failure/timeout path');
    process.exitCode = 0;
  } catch (error) {
    console.error('E2E FAIL: login failure/timeout path');
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
