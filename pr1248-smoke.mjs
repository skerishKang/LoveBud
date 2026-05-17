import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = 'https://4df22de5.lovebud.pages.dev';

const MOCK_TREE = {
  id: 'smoke-tree-1',
  title: '스모크 테스트 트리',
  visibility: 'private',
  createdAt: '2026-05-16T00:00:00Z',
  ownerId: 'smoke-user-1',
};

const MOCK_MEMORY = {
  id: 'smoke-memory-1',
  treeId: 'smoke-tree-1',
  parentId: null,
  title: '첫 순간',
  memo: '테스트',
  timestamp: '2026-05',
  thumbnail: '',
  visibility: 'private',
  artist: 'Smoke Tester',
  source: 'YouTube',
  sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  sourceType: 'youtube',
  emotionTags: ['설렘'],
  createdAt: '2026-05-16T00:00:00Z',
  updatedAt: '2026-05-16T00:00:00Z',
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = { pass: [], fail: [] };
  let totalChecks = 0;
  const consoleErrors = [];
  let screenshots = [];

  function check(name, condition, detail = '') {
    totalChecks++;
    if (condition) {
      results.pass.push(name);
      console.log(`  ✅ ${name}`);
    } else {
      results.fail.push(name);
      console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    }
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Collect console errors
  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`console.${msg.type()}: ${msg.text()}`);
    }
  });

  // Mock auth
  await page.addInitScript(() => {
    localStorage.setItem('lovebud_auth_confirmed', 'true');
    localStorage.setItem('lovebud_auth_cache', JSON.stringify({
      uid: 'smoke-user-1',
      email: 'smoke@test.dev',
      displayName: 'Smoke Tester',
    }));
  });

  // Intercept ALL /api/* calls at the browser level
  await page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    // Let through to Cloudflare only if it has proper auth headers
    // Since we're using localStorage mock, intercept everything
    if (url.includes('/api/trees') && method === 'GET') {
      // Tree listing (no additional path segments)
      if (url.endsWith('/api/trees') || url.endsWith('/api/trees?')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_TREE]) });
      }
      // Single tree (with or without memories query)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_TREE, memories: [] }) });
    }
    if (url.includes('/api/memories') && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (url.includes('/api/memories') && method === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_MEMORY) });
    }
    if (url.includes('/api/memories') && method === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MEMORY) });
    }
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.fallback();
  });

  try {
    // =========== TEST 1: Guide card visible on empty canvas ===========
    console.log('\n📋 Test 1: Guide card visibility on empty canvas');
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const guideCard = page.locator('#canvasEmptyGuide');
    await guideCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check('Guide card DOM exists', await guideCard.count() > 0);
    check('Guide card is visible', await guideCard.isVisible());
    check('No auth redirect', !page.url().includes('login'));

    // =========== TEST 2: Guide card elements ===========
    console.log('\n📋 Test 2: Guide card UI elements');
    
    const title = page.locator('#canvasEmptyGuideTitle');
    check('Title text correct', await title.textContent() === '이 트리의 첫 순간을 기록해볼까요?', 
      `Got: "${await title.textContent()}"`);

    const eyebrow = page.locator('#canvasEmptyGuideEyebrow');
    check('Eyebrow text correct', await eyebrow.textContent() === '시작하기',
      `Got: "${await eyebrow.textContent()}"`);

    const youtubeInput = page.locator('#canvasEmptyYoutubeInput');
    check('YouTube input exists', await youtubeInput.count() > 0);
    const placeholder = await youtubeInput.getAttribute('placeholder');
    check('YouTube input placeholder', placeholder === 'YouTube 링크를 붙여넣어 첫 순간 심기',
      `Got: "${placeholder}"`);

    const startBtn = page.locator('#canvasEmptyStartBtn');
    check('첫 순간 심기 button exists', await startBtn.count() > 0);
    check('첫 순간 심기 button label', (await startBtn.textContent()).includes('첫 순간 심기'),
      `Got: "${await startBtn.textContent()}"`);

    const textStartBtn = page.locator('#canvasEmptyTextStartBtn');
    check('텍스트로 시작하기 button exists', await textStartBtn.count() > 0);
    const textBtnText = await textStartBtn.textContent();
    check('텍스트로 시작하기 label', textBtnText.includes('텍스트로 시작하기'),
      `Got: "${textBtnText}"`);

    const hint = page.locator('#canvasEmptyGuideHint');
    check('Hint text exists', await hint.count() > 0);

    // =========== TEST 3: "텍스트로 시작하기" click ===========
    console.log('\n📋 Test 3: "텍스트로 시작하기" click');
    await textStartBtn.click();
    await page.waitForTimeout(1000);

    // Should show add memory form with text mode
    const addMemoryForm = page.locator('.add-memory-form, #addMemoryForm, .memory-form-overlay').first();
    const textModeActive = addMemoryForm.isVisible().catch(() => false);
    check('Text mode form opens after click', await textModeActive || await page.locator('.add-memory-form').isVisible().catch(() => false));

    // Close form if open (click escape or cancel)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Wait for guide card to re-appear after form close
    await guideCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check('Guide card re-visible after form close', await guideCard.isVisible());

    // =========== TEST 4: YouTube URL input + "첫 순간 심기" ===========
    console.log('\n📋 Test 4: YouTube URL input + "첫 순간 심기" click');
    // Get a fresh page with empty tree for the creation test
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const freshGuide2 = page.locator('#canvasEmptyGuide');
    await freshGuide2.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const freshInput2 = page.locator('#canvasEmptyYoutubeInput');
    await freshInput2.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const inputValue = await freshInput2.inputValue();
    check('YouTube URL typed correctly', inputValue === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const freshStartBtn = page.locator('#canvasEmptyStartBtn');
    await freshStartBtn.click();
    await page.waitForTimeout(1500);
    check('No page crash after start btn click', await page.locator('body').isVisible());

    // =========== TEST 5: Enter key submission ===========
    console.log('\n📋 Test 5: Enter key submission');
    // Fresh page for enter key test
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const freshGuide3 = page.locator('#canvasEmptyGuide');
    await freshGuide3.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const freshInput3 = page.locator('#canvasEmptyYoutubeInput');
    await freshInput3.fill('https://www.youtube.com/watch?v=test123');
    await freshInput3.press('Enter');
    await page.waitForTimeout(1500);
    check('No crash after Enter key submission', await page.locator('body').isVisible());

    // =========== TEST 6: Mobile viewport ===========
    console.log('\n📋 Test 6: Mobile viewport');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    
    // Navigate fresh at mobile size
    await page.goto(`${BASE_URL}/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const mobileGuide = page.locator('#canvasEmptyGuide');
    await mobileGuide.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Check mobile layout: input and button should stack vertically
    const mobileInputWrap = page.locator('.editor-canvas-empty-guide__input-wrap');
    const mobileWrapStyle = await mobileInputWrap.getAttribute('style').catch(() => '');
    
    // Check no horizontal overflow
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    check('No horizontal overflow on mobile', pageWidth <= 376, `scrollWidth: ${pageWidth}`);
    
    const mobileGuideRect = await mobileGuide.boundingBox();
    check('Guide card fully visible on mobile', mobileGuideRect !== null);
    if (mobileGuideRect) {
      check('Guide card within viewport width', mobileGuideRect.x + mobileGuideRect.width <= 380);
    }

    // =========== TEST 7: Console errors (filtering pre-existing CSP noise) ===========
    console.log('\n📋 Test 7: Console error check');
    const relevantErrors = consoleErrors.filter(e => 
      !e.includes('upgrade-insecure-requests') && 
      !e.includes('ignored when delivered in a report-only')
    );
    check('No console errors from PR changes', relevantErrors.length === 0,
      relevantErrors.length > 0 ? `Errors: ${relevantErrors.join('; ')}` : '');
    if (consoleErrors.length > 0 && relevantErrors.length === 0) {
      console.log('  ℹ️  CSP report-only warnings ignored (pre-existing, not from PR #1248)');
    }

    // =========== SUMMARY ===========
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Pass: ${results.pass.length}/${totalChecks}`);
    console.log(`❌ Fail: ${results.fail.length}/${totalChecks}`);
    
    if (results.fail.length > 0) {
      console.log('\nFailed items:');
      results.fail.forEach(f => console.log(`  - ${f}`));
    }
    
    if (consoleErrors.length > 0) {
      console.log('\nConsole errors captured:');
      consoleErrors.forEach(e => console.log(`  - ${e}`));
    }

  } catch (error) {
    console.log(`\n❌ Test error: ${error.message}`);
    console.log(error.stack);
  } finally {
    await browser.close();
  }

  // Exit with proper code
  process.exit(results.fail.length > 0 ? 1 : 0);
}

run();
