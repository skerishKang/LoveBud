/**
 * e2e-first-moment-cta-back-panel.cjs
 *
 * PR #2449 (UX) production-like E2E 검증.
 *
 * 박사님 production 확인 시나리오 6가지 (playwright headless):
 *   1. 빈 트리 → empty guide에 "첫 순간 만들기" 1개만 보임
 *   2. 클릭 → add-memory form 열림
 *   3. Back → panel만 닫히고 페이지 이동 없음
 *   4. panel 닫힌 뒤 Back → 정상 navigation
 *   5a. Esc로 닫은 뒤 Back → 정상 navigation
 *   5b. outside click으로 닫은 뒤 Back → 정상 navigation
 *
 * 비침습 (Do not touch):
 *   - #2400 reopened 안 됨
 *   - #1661 / Browse / Search / DB / API / AI / Scout 변경 없음
 *   - editor-canvas.js 미변경
 *
 * 사용:
 *   LOVEBUD_URL=http://localhost:8888 node scripts/e2e-first-moment-cta-back-panel.cjs
 */

const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

const MOCK_EMPTY_TREE = {
    id: 'tree-pr-2449-empty',
    title: 'PR #2449 빈 트리',
    visibility: 'private',
    createdAt: '2026-06-13T00:00:00Z',
    ownerId: 'e2e-pr-2449',
    memories: [], // root 만 있는 빈 트리 → empty guide visible
};

function short(msg) {
    return `  • ${msg}`;
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
    });

    // ─── Auth + empty tree API mock ────────────────────────────────────
    await page.addInitScript(() => {
        localStorage.setItem('lovebud_auth_confirmed', 'true');
        localStorage.setItem('lovebud_auth_cache', JSON.stringify({
            uid: 'e2e-pr-2449',
            email: 'pr2449@example.com',
            displayName: 'PR #2449 Tester',
        }));
    });

    await page.route('**/api/trees', async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify([MOCK_EMPTY_TREE]),
            });
        }
        return route.fallback();
    });

    await page.route(`**/api/trees/${MOCK_EMPTY_TREE.id}`, async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify(MOCK_EMPTY_TREE),
            });
        }
        return route.fallback();
    });

    // memory create (없으면 fallback) — panel open만 검증하므로 401이어도 무관
    await page.route('**/api/memories', async (route) => {
        return route.fulfill({
            status: 201,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ id: 'mock-memory-pr-2449' }),
        });
    });

    // ───────────────────────────────────────────────────────────────────
    // History 보장: login → editor 진입 후 검증.
    // editor.html에 직접 goto하면 history에 1 entry뿐이라 "정상 navigation" 검증이
    // 모호해짐. login 페이지를 먼저 거쳐 history에 2 entry 만든다.
    // ───────────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/pages/login.html`, { waitUntil: 'networkidle' });
    const loginPath = new URL(page.url()).pathname;
    console.log(short(`login: ${loginPath}`));

    await page.goto(`${BASE_URL}/pages/editor.html?treeId=${MOCK_EMPTY_TREE.id}`,
        { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // editor bootstrap

    const editorPath = new URL(page.url()).pathname;
    console.log(short(`editor: ${editorPath}`));

    // ─── 시나리오 1: 빈 트리 → empty guide + primary CTA 1개 ────────────
    console.log('\n[Scenario 1] empty guide: primary CTA only, no direct controls');
    await page.waitForSelector('#canvasEmptyGuide:not(.editor-canvas-empty-guide-hidden)', {
        timeout: 5000,
    });

    const primaryCount = await page.locator('#canvasEmptyStartBtn').count();
    const videoCount = await page.locator('#canvasEmptyVideoBtn').count();
    const textCount = await page.locator('#canvasEmptyTextBtn').count();
    const quickCount = await page.locator('#canvasEmptyQuickInput').count();
    const primaryText = await page.locator('#canvasEmptyStartBtn').innerText();

    assert.equal(videoCount, 0, 'canvasEmptyVideoBtn must not be present');
    assert.equal(textCount, 0, 'canvasEmptyTextBtn must not be present');
    assert.equal(quickCount, 0, 'canvasEmptyQuickInput must not be present');
    assert.equal(primaryCount, 1, 'exactly one primary CTA');
    assert.ok(primaryText.includes('첫 순간 만들기'),
        `primary CTA text must be "첫 순간 만들기", got: "${primaryText}"`);
    console.log(short(`OK: primary CTA = "${primaryText.trim()}"`));
    console.log(short(`OK: removed video/text/quick input (counts: ${videoCount}/${textCount}/${quickCount})`));

    // screenshot
    await page.screenshot({ path: '/tmp/pr-2449-scenario-1.png', fullPage: false });

    // ─── 시나리오 2: 클릭 → add-memory form 열림 ─────────────────────────
    console.log('\n[Scenario 2] primary CTA click → add-memory form opens');
    await page.click('#canvasEmptyStartBtn');
    await page.waitForSelector('#addMemoryForm', { state: 'visible', timeout: 3000 });
    const formVisible = await page.locator('#addMemoryForm').isVisible();
    assert.equal(formVisible, true, 'add-memory form must be visible after click');
    console.log(short('OK: add-memory form is visible'));
    await page.screenshot({ path: '/tmp/pr-2449-scenario-2.png', fullPage: false });

    // ─── 시나리오 3: Back → panel만 닫힘, 페이지 이동 없음 ───────────────
    console.log('\n[Scenario 3] Back while panel open → panel closes only (no navigation)');
    const pathnameBeforeBack = new URL(page.url()).pathname;
    await page.goBack();
    // panel close + url unchanged 모두 확인
    await page.waitForFunction(() => {
        const form = document.getElementById('addMemoryForm');
        if (!form) return false;
        return form.style.display === 'none' || !form.classList.contains('is-open');
    }, { timeout: 3000 });
    const pathnameAfterBack = new URL(page.url()).pathname;
    assert.equal(pathnameAfterBack, pathnameBeforeBack,
        `pathname must be unchanged. before=${pathnameBeforeBack} after=${pathnameAfterBack}`);
    const formVisible3 = await page.locator('#addMemoryForm').isVisible();
    assert.equal(formVisible3, false, 'add-memory form must be hidden after Back');
    console.log(short(`OK: panel closed, URL unchanged (${pathnameAfterBack})`));
    await page.screenshot({ path: '/tmp/pr-2449-scenario-3.png', fullPage: false });

    // ─── 시나리오 4: panel 닫힌 뒤 Back → 정상 navigation ─────────────────
    console.log('\n[Scenario 4] After panel closed, Back → normal navigation');
    await page.goBack();
    await page.waitForTimeout(500);
    const pathnameAfterNav = new URL(page.url()).pathname;
    assert.notEqual(pathnameAfterNav, editorPath,
        `pathname must change to previous page. editor=${editorPath} after=${pathnameAfterNav}`);
    console.log(short(`OK: navigated to previous page (${pathnameAfterNav})`));
    await page.screenshot({ path: '/tmp/pr-2449-scenario-4.png', fullPage: false });

    // ─── 시나리오 5a: Esc로 닫은 뒤 Back → 정상 navigation ────────────────
    console.log('\n[Scenario 5a] Esc close + Back → normal navigation');
    await page.goto(`${BASE_URL}/pages/editor.html?treeId=${MOCK_EMPTY_TREE.id}`,
        { waitUntil: 'networkidle' });
    await page.waitForSelector('#canvasEmptyStartBtn', { timeout: 5000 });
    await page.click('#canvasEmptyStartBtn');
    await page.waitForSelector('#addMemoryForm', { state: 'visible' });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
        const form = document.getElementById('addMemoryForm');
        if (!form) return false;
        return form.style.display === 'none' || !form.classList.contains('is-open');
    }, { timeout: 3000 });
    const escEditorPath = new URL(page.url()).pathname;
    await page.goBack();
    await page.waitForTimeout(500);
    const escAfterPath = new URL(page.url()).pathname;
    assert.notEqual(escAfterPath, escEditorPath,
        `Esc close must allow normal nav. editor=${escEditorPath} after=${escAfterPath}`);
    console.log(short(`OK: Esc close → Back navigated (${escAfterPath})`));
    await page.screenshot({ path: '/tmp/pr-2449-scenario-5a.png', fullPage: false });

    // ─── 시나리오 5b: outside click으로 닫은 뒤 Back → 정상 navigation ─────
    console.log('\n[Scenario 5b] outside click close + Back → normal navigation');
    await page.goto(`${BASE_URL}/pages/editor.html?treeId=${MOCK_EMPTY_TREE.id}`,
        { waitUntil: 'networkidle' });
    await page.waitForSelector('#canvasEmptyStartBtn', { timeout: 5000 });
    await page.click('#canvasEmptyStartBtn');
    await page.waitForSelector('#addMemoryForm', { state: 'visible' });
    // form 바깥 (body 좌상단 코너) 클릭
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => {
        const form = document.getElementById('addMemoryForm');
        if (!form) return false;
        return form.style.display === 'none' || !form.classList.contains('is-open');
    }, { timeout: 3000 });
    const ocEditorPath = new URL(page.url()).pathname;
    await page.goBack();
    await page.waitForTimeout(500);
    const ocAfterPath = new URL(page.url()).pathname;
    assert.notEqual(ocAfterPath, ocEditorPath,
        `outside-click close must allow normal nav. editor=${ocEditorPath} after=${ocAfterPath}`);
    console.log(short(`OK: outside-click close → Back navigated (${ocAfterPath})`));
    await page.screenshot({ path: '/tmp/pr-2449-scenario-5b.png', fullPage: false });

    // ─── 비침습 invariant: console.error 0 ──────────────────────────────
    if (consoleErrors.length > 0) {
        console.log('\n[!] Console errors detected:');
        consoleErrors.forEach((e) => console.log('  ' + e));
        throw new Error(`Console errors during E2E: ${consoleErrors.length}`);
    }
    console.log('\n[Invariant] console.error: 0');

    await browser.close();

    console.log('\n════════════════════════════════════════════');
    console.log('  PR #2449 6 시나리오 E2E 전부 PASS');
    console.log('  1) 빈 가이드 primary CTA 1개');
    console.log('  2) 클릭 → form open');
    console.log('  3) Back → panel close only');
    console.log('  4) panel 닫힘 후 Back → 정상 nav');
    console.log('  5a) Esc 닫기 → Back 정상 nav');
    console.log('  5b) outside click 닫기 → Back 정상 nav');
    console.log('════════════════════════════════════════════');
}

main().catch((err) => {
    console.error('\n[E2E FAIL]', err.message);
    process.exit(1);
});
