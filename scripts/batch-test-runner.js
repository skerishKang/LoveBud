/**
 * LoveBud Batch Test Runner
 * 모든 그룹 데이터를 순회하며 테스트 실행
 * 실패 시 중지하고 결과 저장 후 다음 그룹으로 진행
 * 
 * 사용법: node scripts/batch-test-runner.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 설정
const CONFIG = {
  BASE_URL: process.env.LOVEBUD_URL || 'http://localhost:8888',
  RESULTS_DIR: path.join(__dirname, '..', 'docs', 'test-scenarios', 'results'),
  DATA_DIR: path.join(__dirname, '..', 'docs', 'test-scenarios', 'data'),
  SCREENSHOTS_PER_TEST: 8,
  TIMEOUT_PER_GROUP: 5 * 60 * 1000, // 5분 타임아웃
};

// 테스트 상태 추적
const testState = {
  totalGroups: 0,
  successCount: 0,
  failCount: 0,
  results: [],
};

/**
 * 타임스탬프 생성 (YYYY-MM-DD-HHMM)
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}${minute}`;
}

/**
 * 그룹 데이터 파일 목록 조회
 */
function getGroupDataFiles() {
  const files = fs.readdirSync(CONFIG.DATA_DIR);
  return files
    .filter(f => f.endsWith('-data.json'))
    .map(f => ({
      filename: f,
      filepath: path.join(CONFIG.DATA_DIR, f),
      groupId: f.replace('-data.json', ''),
    }));
}

/**
 * 그룹 데이터 로드
 */
function loadGroupData(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 테스트 결과 폴더 생성
 */
function createResultFolder(timestamp, groupId) {
  const folderName = `${timestamp}-batch-${groupId}`;
  const folderPath = path.join(CONFIG.RESULTS_DIR, folderName);
  const screenshotsPath = path.join(folderPath, 'screenshots');
  
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  if (!fs.existsSync(screenshotsPath)) {
    fs.mkdirSync(screenshotsPath, { recursive: true });
  }
  
  return { folderPath, screenshotsPath, folderName };
}

/**
 * 스크린샷 캡처
 */
async function captureScreenshot(page, filepath, description) {
  try {
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`  📸 스크린샷: ${description}`);
    return true;
  } catch (e) {
    console.error(`  ❌ 스크린샷 실패: ${description}`, e.message);
    return false;
  }
}

/**
 * 단일 그룹 테스트 실행
 */
async function runGroupTest(browser, groupData, groupId, timestamp) {
  const { folderPath, screenshotsPath, folderName } = createResultFolder(timestamp, groupId);
  const screenshots = [];
  const logs = [];
  let status = 'success';
  let errorMessage = null;
  let page = null;
  
  console.log(`\n🎵 테스트 시작: ${groupData.groupNameKorean} (${groupData.groupName})`);
  
  try {
    // 타임아웃 설정
    const testPromise = (async () => {
      page = await browser.newPage();
      
      // 1. 홈페이지 접속
      console.log('  → 홈페이지 접속');
      await page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      const homeScreenshot = path.join(screenshotsPath, '01-home.png');
      await captureScreenshot(page, homeScreenshot, '홈페이지');
      screenshots.push({ file: '01-home.png', desc: '홈페이지' });
      
      // 2. 로그인 페이지로 이동
      console.log('  → 로그인 페이지');
      const loginLink = await page.locator('a[href="login.html"]').first();
      if (await loginLink.isVisible().catch(() => false)) {
        await loginLink.click();
        await page.waitForTimeout(1500);
        
        const loginScreenshot = path.join(screenshotsPath, '02-login.png');
        await captureScreenshot(page, loginScreenshot, '로그인 페이지');
        screenshots.push({ file: '02-login.png', desc: '로그인 페이지' });
        
        // 3. 테스트용 이메일로 로그인
        const testEmail = `test_${groupId}_${timestamp}@example.com`;
        console.log(`  → 로그인 시도: ${testEmail}`);
        
        // 이메일 입력
        const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible().catch(() => false)) {
          await emailInput.fill(testEmail);
          await page.waitForTimeout(500);
          
          // 비밀번호 입력
          const pwInput = await page.locator('input[type="password"]').first();
          if (await pwInput.isVisible().catch(() => false)) {
            await pwInput.fill('Test1234!');
            await page.waitForTimeout(500);
            
            // 로그인 버튼 클릭
            const loginBtn = await page.locator('button[type="submit"], button:has-text("로그인")').first();
            if (await loginBtn.isVisible().catch(() => false)) {
              await loginBtn.click();
              await page.waitForTimeout(2000);
              
              const afterLoginScreenshot = path.join(screenshotsPath, '03-after-login.png');
              await captureScreenshot(page, afterLoginScreenshot, '로그인 후');
              screenshots.push({ file: '03-after-login.png', desc: '로그인 후' });
            }
          }
        }
      }
      
      // 4. 내 트리 페이지로 이동
      console.log('  → 내 트리 페이지');
      await page.goto(`${CONFIG.BASE_URL}/pages/my-trees.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      
      const myTreesScreenshot = path.join(screenshotsPath, '04-my-trees.png');
      await captureScreenshot(page, myTreesScreenshot, '내 트리 페이지');
      screenshots.push({ file: '04-my-trees.png', desc: '내 트리 페이지' });
      
      // 5. 새 트리 만들기 버튼 확인
      console.log('  → 새 트리 만들기 버튼 확인');
      const createBtn = await page.locator('#headerCreateTreeBtn, #createTreeBtn, .btn-create-tree').first();
      if (await createBtn.isVisible().catch(() => false)) {
        console.log('    ✅ 새 트리 만들기 버튼 발견');
        
        // 6. 에디터 페이지로 이동
        await createBtn.click();
        await page.waitForTimeout(2000);
        
        const editorScreenshot = path.join(screenshotsPath, '05-editor.png');
        await captureScreenshot(page, editorScreenshot, '에디터 페이지');
        screenshots.push({ file: '05-editor.png', desc: '에디터 페이지' });
        
        // 7. 트리 정보 입력
        console.log(`  → 트리 정보 입력: ${groupData.treeName}`);
        const titleInput = await page.locator('input[name="title"], #treeTitle, .tree-title-input').first();
        if (await titleInput.isVisible().catch(() => false)) {
          await titleInput.fill(groupData.treeName);
          await page.waitForTimeout(500);
        }
        
        // 8. 팬 페르소나 입력
        const personaInput = await page.locator('textarea[name="persona"], #fanPersona, .persona-input').first();
        if (await personaInput.isVisible().catch(() => false)) {
          await personaInput.fill(groupData.fanPersona);
          await page.waitForTimeout(500);
        }
        
        const filledEditorScreenshot = path.join(screenshotsPath, '06-editor-filled.png');
        await captureScreenshot(page, filledEditorScreenshot, '정보 입력 후');
        screenshots.push({ file: '06-editor-filled.png', desc: '정보 입력 후' });
        
        // 9. 검색 페이지 테스트 (선택사항)
        console.log('  → 검색 페이지');
        await page.goto(`${CONFIG.BASE_URL}/pages/search.html`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        const searchScreenshot = path.join(screenshotsPath, '07-search.png');
        await captureScreenshot(page, searchScreenshot, '검색 페이지');
        screenshots.push({ file: '07-search.png', desc: '검색 페이지' });
        
        // 10. 첫 번째 URL 테스트
        if (groupData.testUrls && groupData.testUrls.length > 0) {
          const firstUrl = groupData.testUrls[0];
          console.log(`  → URL 테스트: ${firstUrl.title}`);
          
          const urlInput = await page.locator('input[type="url"], #urlInput, .url-input').first();
          if (await urlInput.isVisible().catch(() => false)) {
            await urlInput.fill(firstUrl.url);
            await page.waitForTimeout(500);
            
            const searchBtn = await page.locator('button:has-text("검색"), button:has-text("추가"), .search-btn').first();
            if (await searchBtn.isVisible().catch(() => false)) {
              await searchBtn.click();
              await page.waitForTimeout(2000);
              
              const urlResultScreenshot = path.join(screenshotsPath, '08-url-result.png');
              await captureScreenshot(page, urlResultScreenshot, 'URL 추가 결과');
              screenshots.push({ file: '08-url-result.png', desc: 'URL 추가 결과' });
            }
          }
        }
      } else {
        console.log('    ⚠️ 새 트리 만들기 버튼을 찾을 수 없음');
        logs.push('새 트리 만들기 버튼을 찾을 수 없음');
      }
      
      await page.close();
      
    })();
    
    // 타임아웃 적용
    await Promise.race([
      testPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('테스트 타임아웃 (5분)')), CONFIG.TIMEOUT_PER_GROUP)
      )
    ]);
    
    console.log(`  ✅ 테스트 성공: ${groupData.groupNameKorean}`);
    logs.push('모든 테스트 단계 완료');
    
  } catch (error) {
    status = 'failed';
    errorMessage = error.message;
    console.error(`  ❌ 테스트 실패: ${groupData.groupNameKorean}`);
    console.error(`     에러: ${error.message}`);
    logs.push(`에러: ${error.message}`);
    
    // 에러 발생 시 스크린샷 캡처
    if (page) {
      try {
        const errorScreenshot = path.join(screenshotsPath, '99-error.png');
        await captureScreenshot(page, errorScreenshot, '에러 발생 시점');
        screenshots.push({ file: '99-error.png', desc: '에러 발생 시점' });
      } catch (e) {
        console.error('    에러 스크린샷 실패:', e.message);
      }
      await page.close().catch(() => {});
    }
  }
  
  // 결과 저장
  const result = saveTestResult({
    folderPath,
    folderName,
    groupData,
    groupId,
    status,
    errorMessage,
    screenshots,
    logs,
    timestamp,
  });
  
  // 상태 업데이트
  if (status === 'success') {
    testState.successCount++;
  } else {
    testState.failCount++;
  }
  testState.results.push({
    groupId,
    groupName: groupData.groupNameKorean,
    status,
    folderName,
    errorMessage,
  });
  
  return result;
}

/**
 * 테스트 결과 저장 (마크다운)
 */
function saveTestResult({ folderPath, folderName, groupData, groupId, status, errorMessage, screenshots, logs, timestamp }) {
  const now = new Date().toLocaleString('ko-KR');
  
  const mdContent = `# ${groupData.groupNameKorean} 테스트 결과

## 테스트 정보
| 항목 | 값 |
|------|-----|
| 그룹명 | ${groupData.groupName} (${groupData.groupNameKorean}) |
| 테스트 시간 | ${now} |
| 테스트 ID | ${groupId}-${timestamp} |
| 상태 | ${status === 'success' ? '✅ 성공' : '❌ 실패'} |
${errorMessage ? `| 에러 | ${errorMessage} |` : ''}

## 팬 페르소나
> ${groupData.fanPersona}

## 테스트 수행 내용
${logs.map(log => `- ${log}`).join('\n')}

## 스크린샷
${screenshots.map((s, i) => `${i + 1}. **${s.desc}**\n   ![${s.desc}](./screenshots/${s.file})`).join('\n\n')}

## 테스트 URL 목록
| # | 제목 | 설명 |
|---|------|------|
${groupData.testUrls.map((url, i) => `| ${i + 1} | ${url.title} | ${url.description} |`).join('\n')}

---
*자동 생성된 테스트 결과*
`;

  const mdPath = path.join(folderPath, 'test-result.md');
  fs.writeFileSync(mdPath, mdContent, 'utf-8');
  
  console.log(`  📝 결과 저장: ${mdPath}`);
  
  return {
    folderPath,
    folderName,
    mdPath,
    status,
  };
}

/**
 * 전체 테스트 요약 리포트 생성
 */
function generateSummaryReport(timestamp) {
  const now = new Date().toLocaleString('ko-KR');
  const successRate = Math.round((testState.successCount / testState.totalGroups) * 100);
  
  const summaryContent = `# 배치 테스트 요약 리포트

## 테스트 개요
| 항목 | 값 |
|------|-----|
| 테스트 시간 | ${now} |
| 배치 ID | ${timestamp} |
| 총 그룹 수 | ${testState.totalGroups} |
| 성공 | ${testState.successCount} (${successRate}%) |
| 실패 | ${testState.failCount} |

## 그룹별 결과
| 그룹 ID | 그룹명 | 상태 | 결과 폴더 |
|---------|--------|------|-----------|
${testState.results.map(r => `| ${r.groupId} | ${r.groupName} | ${r.status === 'success' ? '✅' : '❌'} | [${r.folderName}](./${r.folderName}/test-result.md) |`).join('\n')}

## 실패한 테스트
${testState.results.filter(r => r.status === 'failed').map(r => `- **${r.groupName}**: ${r.errorMessage}`).join('\n') || '없음'}

## 개선 권장사항
${testState.failCount > 0 ? `- 실패한 ${testState.failCount}개 그룹의 테스트를 수동으로 확인 필요` : '- 모든 그룹 테스트 성공!'}

---
*LoveBud Batch Test Runner*
`;

  const summaryPath = path.join(CONFIG.RESULTS_DIR, `${timestamp}-batch-summary.md`);
  fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
  
  console.log(`\n📊 요약 리포트: ${summaryPath}`);
  
  return summaryPath;
}

/**
 * 메인 실행 함수
 */
async function main() {
  const timestamp = getTimestamp();
  
  console.log('='.repeat(60));
  console.log('🚀 LoveBud 배치 테스트 실행기');
  console.log('='.repeat(60));
  console.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`🌐 테스트 URL: ${CONFIG.BASE_URL}`);
  console.log(`📁 결과 저장: ${CONFIG.RESULTS_DIR}`);
  console.log('='.repeat(60));
  
  // 그룹 데이터 로드
  const groupFiles = getGroupDataFiles();
  testState.totalGroups = groupFiles.length;
  
  console.log(`\n📋 총 ${groupFiles.length}개 그룹 테스트 예정`);
  console.log(groupFiles.map(g => `   - ${g.groupId}`).join('\n'));
  console.log('');
  
  // 브라우저 시작
  console.log('🌐 브라우저 시작...');
  const browser = await chromium.launch({ headless: true });
  
  // 각 그룹 순회 테스트
  for (let i = 0; i < groupFiles.length; i++) {
    const groupFile = groupFiles[i];
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${i + 1}/${groupFiles.length}] 그룹 테스트`);
    
    try {
      const groupData = loadGroupData(groupFile.filepath);
      await runGroupTest(browser, groupData, groupFile.groupId, timestamp);
    } catch (error) {
      console.error(`   ❌ 치명적 에러: ${error.message}`);
      testState.failCount++;
      testState.results.push({
        groupId: groupFile.groupId,
        groupName: groupFile.groupId,
        status: 'failed',
        folderName: 'N/A',
        errorMessage: error.message,
      });
      // 계속 진행 (다음 그룹으로)
    }
    
    // 그룹 간 대기 (서버 부하 방지)
    if (i < groupFiles.length - 1) {
      console.log('   ⏳ 다음 그룹까지 3초 대기...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // 브라우저 종료
  await browser.close();
  
  // 요약 리포트 생성
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 완료! 요약 리포트 생성 중...');
  const summaryPath = generateSummaryReport(timestamp);
  
  // 최종 출력
  console.log('\n' + '='.repeat(60));
  console.log('✅ 배치 테스트 완료!');
  console.log('='.repeat(60));
  console.log(`   총 그룹: ${testState.totalGroups}`);
  console.log(`   ✅ 성공: ${testState.successCount}`);
  console.log(`   ❌ 실패: ${testState.failCount}`);
  console.log(`   📊 성공률: ${Math.round((testState.successCount / testState.totalGroups) * 100)}%`);
  console.log(`\n📄 요약 리포트: ${summaryPath}`);
  console.log('='.repeat(60));
}

// 실행
main().catch(error => {
  console.error('\n❌ 배치 테스트 실행기 실패:', error);
  process.exit(1);
});
