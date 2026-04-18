/**
 * 스크린샷 캡처 및 복사 스크립트
 * 
 * 사용법: node scripts/capture-screenshots.js [결과폴더명]
 * 예시: node scripts/capture-screenshots.js xg-test-2026-04-18-1100
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LOVEBUD_URL || 'http://localhost:8888';

async function main() {
  const folderName = process.argv[2] || `test-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
  
  // 결과 폴더 생성
  const resultDir = path.join(__dirname, '..', 'docs', 'test-scenarios', 'results', folderName);
  const screenshotDir = path.join(resultDir, 'screenshots');
  
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  console.log(`📁 결과 폴더: ${resultDir}`);
  
  // 브라우저 시작
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const screenshots = [];
  
  try {
    // 1. 홈페이지
    console.log('📸 1. 홈페이지 캡처 중...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotDir, '01-home.png'),
      fullPage: false 
    });
    screenshots.push({ file: '01-home.png', desc: '홈페이지' });
    
    // 2. 로그인 페이지
    console.log('📸 2. 로그인 페이지 캡처 중...');
    await page.goto(`${BASE_URL}/pages/login.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotDir, '02-login.png'),
      fullPage: false 
    });
    screenshots.push({ file: '02-login.png', desc: '로그인 페이지' });
    
    // 3. 내 트리 페이지 (로그인 안 된 상태)
    console.log('📸 3. 내 트리 페이지 캡처 중...');
    await page.goto(`${BASE_URL}/pages/my-trees.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: path.join(screenshotDir, '03-my-trees.png'),
      fullPage: false 
    });
    screenshots.push({ file: '03-my-trees.png', desc: '내 트리 페이지' });
    
    // 4. 에디터 페이지
    console.log('📸 4. 에디터 페이지 캡처 중...');
    await page.goto(`${BASE_URL}/pages/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotDir, '04-editor.png'),
      fullPage: false 
    });
    screenshots.push({ file: '04-editor.png', desc: '에디터 페이지' });
    
    // 5. 검색 페이지
    console.log('📸 5. 검색 페이지 캡처 중...');
    await page.goto(`${BASE_URL}/pages/search.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotDir, '05-search.png'),
      fullPage: false 
    });
    screenshots.push({ file: '05-search.png', desc: '검색 페이지' });
    
    console.log('\n✅ 모든 스크린샷 캡처 완료!');
    
  } catch (error) {
    console.error('❌ 스크린샷 캡처 실패:', error.message);
  } finally {
    await browser.close();
  }
  
  // 결과 파일 목록 생성
  const resultContent = `# 스크린샷 목록

| 파일 | 설명 |
|------|------|
${screenshots.map(s => `| ${s.file} | ${s.desc} |`).join('\n')}

---
*캡처 시간: ${new Date().toLocaleString('ko-KR')}*
`;
  
  fs.writeFileSync(path.join(resultDir, 'screenshots-index.md'), resultContent);
  
  console.log(`\n📄 결과 인덱스: ${path.join(resultDir, 'screenshots-index.md')}`);
  console.log(`📁 스크린샷 폴더: ${screenshotDir}`);
}

main().catch(console.error);
