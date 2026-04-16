#!/usr/bin/env node

/**
 * LoveBud Core Flows Verification Script
 *
 * 검증 대상 (최근 수정 커밋: 31531fe, 1cf95e0):
 * 1. /api/trees 502/503 재발 방지 - db.js env missing handling
 * 2. editor local fallback null 처리 - createdMemory null/undefined guard
 * 3. currentTreeMemories null/array guard - window.currentTreeMemories 안전성
 *
 * 사용법: node scripts/verify-core-flows.js
 */

const fs = require('fs');
const path = require('path');

let exitCode = 0;
const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  const icon = passed ? '\u2713' : '\u2717';
  const color = passed ? '' : ' [FAIL]';
  console.log(` ${icon} ${name}${color}${detail ? ': ' + detail : ''}`);
  if (!passed) exitCode = 1;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

// ── 1. trees.js env/error handling ────────────────────────────────────────

function verifyTreesFunction() {
  console.log('\n=== /api/trees 502/503 재발 방지 검증 ===');

  const treesPath = path.join(__dirname, '..', 'netlify', 'functions', 'trees.js');
  const dbPath = path.join(__dirname, '..', 'netlify', 'functions', '_lib', 'db.js');
  const httpPath = path.join(__dirname, '..', 'netlify', 'functions', '_lib', 'http.js');

  try {
    const treesCode = readFile(treesPath);
    const dbCode = readFile(dbPath);
    const httpCode = readFile(httpPath);

    // 1-1. trees.js가 db 에러를 handleError로 처리하는지 확인
    const hasDbErrorHandling = treesCode.includes('handleError') && treesCode.includes('dbError');
    check('/api/trees db 에러 처리', hasDbErrorHandling, hasDbErrorHandling ? 'handleError 사용' : 'handleError 미사용');

    // 1-2. db.js가 env missing 시 503 + 명확한 에러 메시지 반환하는지 확인
    const dbEnvMissing503 = dbCode.includes('503') && dbCode.includes('NETLIFY_DATABASE_URL');
    check('db.js env missing 503 반환', dbEnvMissing503, dbEnvMissing503 ? '503 에러 처리 있음' : '503 에러 처리 없음');

    // 1-3. http.js handleError가 error.status를 확인하는지 확인
    const httpChecksStatus = httpCode.includes('error.status') || httpCode.includes('typeof error.status');
    check('http.js error.status 확인', httpChecksStatus, httpChecksStatus ? 'status 체크 있음' : 'status 체크 없음');

    // 1-4. trees.js에서 queryTrees 호출 시 에러가 handleError로 전달되는지 확인
    const queryTreesInTryCatch = /try\s*\{[\s\S]*?queryTrees[\s\S]*?\}\s*catch/.test(treesCode);
    check('/api/trees queryTrees try-catch', queryTreesInTryCatch, queryTreesInTryCatch ? 'try-catch 있음' : 'try-catch 없음');

  } catch (e) {
    check('trees.js 파일 읽기', false, e.message);
  }
}

// ── 2. editor.js null handling ─────────────────────────────────────────────

function verifyEditorNullHandling() {
  console.log('\n=== editor.js null/fallback 처리 검증 ===');

  const editorPath = path.join(__dirname, '..', 'js', 'editor.js');

  try {
    const editorCode = readFile(editorPath);

    // 2-1. createdMemory null/undefined 체크 확인
    const hasCreatedMemoryNullCheck = /if\s*\(\s*!createdMemory\s*\|\|\s*typeof\s+createdMemory\s*!==\s*['"]object['"]\s*\)/.test(editorCode);
    check('createdMemory null/undefined/object 체크', hasCreatedMemoryNullCheck, hasCreatedMemoryNullCheck ? '방어적 체크 있음' : '방어적 체크 없음');

    // 2-2. e?.message (optional chaining) 사용 확인
    const hasOptionalChaining = /e\?\.(?:message|details)/.test(editorCode);
    check('error.message optional chaining', hasOptionalChaining, hasOptionalChaining ? 'e?.message 사용' : 'e.message 직접 접근');

    // 2-3. normalizeMemory 호출 시 null 체크 확인
    const hasNormalizeNullCheck = /normalizeMemory\(createdMemory\)(\s*)&&\s*normalizedMemory\s*\!==\s*null/.test(editorCode) ||
                                   /if\s*\(\s*!normalizedMemory\s*\)/.test(editorCode);
    check('normalizeMemory 결과 null 체크', hasNormalizeNullCheck, hasNormalizeNullCheck ? 'null 체크 있음' : 'null 체크 없음');

    // 2-4. treeMemories 함수가 배열을 반환하는지 확인 (null 안전성)
    const treeMemoriesReturnsArray = /const\s+treeMemories\s*=\s*\(\s*\)\s*=>\s*\(/.test(editorCode);
    check('treeMemories 배열 반환', treeMemoriesReturnsArray, treeMemoriesReturnsArray ? '배열 반환' : '비 배열 반환');

  } catch (e) {
    check('editor.js 파일 읽기', false, e.message);
  }
}

// ── 3. currentTreeMemories guard 검증 ──────────────────────────────────────

function verifyCurrentTreeMemoriesGuard() {
  console.log('\n=== currentTreeMemories null/array guard 검증 ===');

  const editorPath = path.join(__dirname, '..', 'js', 'editor.js');

  try {
    const editorCode = readFile(editorPath);

    // 3-1. currentTreeMemories에 접근할 때 Array.isArray 또는 filter/Map 사용 전 체크
    const hasArrayGuard = /Array\.isArray\(.*currentTreeMemories/.test(editorCode);
    check('currentTreeMemories Array.isArray 체크', hasArrayGuard, hasArrayGuard ? '배열 체크 있음' : '배열 체크 없음');

    // 3-2. findRootMemory 함수가 배열이 아니면 null 반환
    const findRootMemoryHandlesNonArray = /if\s*\(\s*!\Array\.isArray\(memories\)\s*\)/.test(editorCode) ||
                                           /if\s*\(\s*!memories\s*\)/.test(editorCode);
    check('findRootMemory 비배열 처리', findRootMemoryHandlesNonArray, findRootMemoryHandlesNonArray ? '비배열 처리 있음' : '비배열 처리 없음');

    // 3-3. window.currentTreeMemories = ...전에 null/undefined 체크
    const hasWindowCurrentTreeMemoriesAssignment = /window\.currentTreeMemories\s*=\s*.*\.map\(normalizeMemory\)\.filter\(Boolean\)/.test(editorCode);
    check('window.currentTreeMemories 정규화 할당', hasWindowCurrentTreeMemoriesAssignment, hasWindowCurrentTreeMemoriesAssignment ? '정규화 할당 있음' : '정규화 할당 없음');

  } catch (e) {
    check('editor.js 파일 읽기', false, e.message);
  }
}

// ── 4. API client fallback 검증 ─────────────────────────────────────────────

function verifyApiClientFallback() {
  console.log('\n=== API client fallback 흐름 검증 ===');

  const editorPath = path.join(__dirname, '..', 'js', 'editor.js');

  try {
    const editorCode = readFile(editorPath);

    // 4-1. apiClient.createMemory 실패 시 로컬 fallback 존재
    const hasCreateMemoryFallback = /if\s*\(\s*!createdMemory\s*\|\|/.test(editorCode);
    check('createMemory 실패 시 fallback', hasCreateMemoryFallback, hasCreateMemoryFallback ? 'fallback 있음' : 'fallback 없음');

    // 4-2. getMemoriesByTree 실패 시 캐시 사용
    const hasGetMemoriesFallback = /catch\s*\(.*\)\s*\{[\s\S]*?cachedMemories/.test(editorCode) ||
                                    /if\s*\(\s*memories\.length\s*===\s*0\s*&&\s*!cachedMemories/.test(editorCode);
    check('getMemoriesByTree 실패 시 캐시 fallback', hasGetMemoriesFallback, hasGetMemoriesFallback ? '캐시 fallback 있음' : '캐시 fallback 없음');

  } catch (e) {
    check('editor.js 파일 읽기', false, e.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LoveBud Core Flows 검증');
  console.log('='.repeat(50));
  console.log('대상 커밋: 31531fe, 1cf95e0, 1b20ff9');
  console.log('');

  verifyTreesFunction();
  verifyEditorNullHandling();
  verifyCurrentTreeMemoriesGuard();
  verifyApiClientFallback();

  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`결과: ${passed}/${total} 통과`);

  if (exitCode !== 0) {
    console.log('\n실패 항목:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(` \u2717 ${r.name}: ${r.detail}`);
    });
  } else {
    console.log('\n\u2705 모든 검증 통과');
  }

  process.exit(exitCode);
}

main().catch(e => {
  console.error('검증 스크립트 오류:', e);
  process.exit(1);
});