#!/usr/bin/env node

/**
 * LoveBud Pre-Deploy Verification
 * v20260420-1
 *
 * 배포 전 자동 검증 스크립트.
 * 현재 저장소 구조(pages/*.html, js/*, netlify/functions/*) 기준으로
 * 환경변수/DB/Firebase 의존성 없이 실행 가능한 항목을 우선 검사합니다.
 *
 * 사용법:
 *   node scripts/pre-deploy.js             # 빠른 검사 (syntax, i18n, routes, html)
 *   node scripts/pre-deploy.js --full      # 위 + env/DB/Firebase 원격 검사
 *   node scripts/pre-deploy.js --remote https://lovebud.netlify.app
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const FULL = args.includes('--full');
const REMOTE_URL = args.includes('--remote')
  ? args[args.indexOf('--remote') + 1] || 'https://lovebud.netlify.app'
  : null;

let exitCode = 0;
const results = [];

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function check(name, passed, detail) {
  results.push({ name, passed, detail: detail || '' });
  const icon = passed ? '✓' : '✗';
  const suffix = passed ? '' : ' [FAIL]';
  console.log(`  ${icon} ${name}${suffix}${detail ? ': ' + detail : ''}`);
  if (!passed) exitCode = 1;
}

function relPath(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function collectJsFiles(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
}

function checkJsSyntaxFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: file });
}

// ── 1. JS 구문 검사 (node --check) ───────────────────────────────────────────

function verifyJSSyntax() {
  console.log('\n=== JS 구문 검사 ===');

  // 백엔드 함수 (CommonJS)
  const backendDir = path.join(ROOT, 'netlify/functions');
  if (fs.existsSync(backendDir)) {
    const backendFiles = [];
    collectJsFiles(backendDir, backendFiles);
    for (const file of backendFiles) {
      const rel = relPath(file);
      try {
        checkJsSyntaxFile(file);
        check(`syntax: ${rel}`, true);
      } catch (e) {
        const msg = String(e.message || e).split('\n')[0];
        check(`syntax: ${rel}`, false, msg);
      }
    }
  }

  // 프론트엔드 JS (IIFE/ES 모듈 혼합)
  const frontendDir = path.join(ROOT, 'js');
  if (fs.existsSync(frontendDir)) {
    const frontendFiles = [];
    collectJsFiles(frontendDir, frontendFiles);
    for (const file of frontendFiles) {
      const rel = relPath(file);
      try {
        checkJsSyntaxFile(file);
        check(`syntax: ${rel}`, true);
      } catch (e) {
        const msg = String(e.message || e).split('\n')[0];
        check(`syntax: ${rel}`, false, msg);
      }
    }
  }
}

// ── 2. i18n key 정합성 검사 ─────────────────────────────────────────────────

function verifyI18nKeys() {
  console.log('\n=== i18n key 정합성 검사 ===');

  const i18nPath = path.join(ROOT, 'js/i18n.js');
  const i18nDir = path.join(ROOT, 'js/i18n');
  
  const i18nFiles = [];
  if (fs.existsSync(i18nPath)) i18nFiles.push(i18nPath);
  if (fs.existsSync(i18nDir)) {
    const entries = fs.readdirSync(i18nDir);
    for (const name of entries) {
      if (name.endsWith('.js')) i18nFiles.push(path.join(i18nDir, name));
    }
  }

  if (i18nFiles.length === 0) {
    check('i18n 파일 존재', false, 'js/i18n.js 또는 js/i18n/*.js 없음');
    return;
  }
  check('i18n 파일 스캔', true, `${i18nFiles.length}개 파일`);

  const dictKeys = new Set();
  // 정합성 검사용 키 추출 정규식: 'key': { 또는 key: { 구조 매칭
  // 그룹 1: 싱글 따옴표, 그룹 2: 더블 따옴표, 그룹 3: 따옴표 없음
  const keyRegex = /(?:'([^']+)'|"([^"]+)"|([a-zA-Z0-9_$]+))\s*:\s*\{/g;
  
  for (const file of i18nFiles) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = keyRegex.exec(src)) !== null) {
      const key = m[1] || m[2] || m[3];
      // ko, en 등 언어 코드는 딕셔너리 키가 아니므로 제외
      if (key && key !== 'ko' && key !== 'en' && key !== 'ja' && key !== 'zh') {
        dictKeys.add(key);
      }
    }
  }
  check('dictionary key 수', dictKeys.size > 0, `${dictKeys.size}개`);

  // HTML에서 data-i18n key 추출
  const htmlDirs = ['pages', '.'];
  const htmlFiles = [];
  for (const dir of htmlDirs) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    const entries = fs.readdirSync(absDir);
    for (const name of entries) {
      if (name.endsWith('.html')) {
        htmlFiles.push(path.join(absDir, name));
      }
    }
  }

  const usedKeys = new Set();
  const missingKeys = [];

  for (const htmlFile of htmlFiles) {
    const src = fs.readFileSync(htmlFile, 'utf8');
    const rel = relPath(htmlFile);
    const i18nRegex = /data-i18n(?:-placeholder)?="([^"]+)"/g;
    let match;
    while ((match = i18nRegex.exec(src)) !== null) {
      const key = match[1];
      usedKeys.add(key);
      if (!dictKeys.has(key)) {
        missingKeys.push({ key, file: rel, source: 'data-i18n' });
      }
    }
  }

  // JS에서 i18n('key') 호출 추출
  const jsDir = path.join(ROOT, 'js');
  if (fs.existsSync(jsDir)) {
    const entries = fs.readdirSync(jsDir);
    for (const name of entries) {
      if (!name.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(jsDir, name), 'utf8');
      const rel = 'js/' + name;
      const callRegex = /(?:i18n|window\.t)\s*\(\s*'([^']+)'/g;
      let match;
      while ((match = callRegex.exec(src)) !== null) {
        const key = match[1];
        usedKeys.add(key);
        if (!dictKeys.has(key)) {
          missingKeys.push({ key, file: rel, source: 'i18n()/t()' });
        }
      }
    }
  }

  if (missingKeys.length === 0) {
    check('i18n key 정합성', true, `${usedKeys.size}개 key 전부 dictionary에 존재`);
  } else {
    check('i18n key 정합성', false, `${missingKeys.length}개 누락`);
    for (const mk of missingKeys) {
      console.log(`    → "${mk.key}" (${mk.source} in ${mk.file})`);
    }
  }

  // 사용되지 않는 key 경고 (INFO only)
  const unusedKeys = [...dictKeys].filter(k => !usedKeys.has(k));
  if (unusedKeys.length > 0) {
    console.log(`  ℹ 미사용 key ${unusedKeys.length}개 (정리 대상, FAIL 아님):`);
    for (const k of unusedKeys.slice(0, 10)) {
      console.log(`    → "${k}"`);
    }
    if (unusedKeys.length > 10) console.log(`    ... 외 ${unusedKeys.length - 10}개`);
  }
}

// ── 3. netlify.toml 라우트 ↔ 함수 파일 존재 확인 ─────────────────────────────

function verifyRoutesAndFunctions() {
  console.log('\n=== netlify.toml 라우트 ↔ 함수 파일 확인 ===');

  const tomlPath = path.join(ROOT, 'netlify.toml');
  if (!fs.existsSync(tomlPath)) {
    check('netlify.toml 존재', false, '파일 없음');
    return;
  }
  check('netlify.toml 존재', true);

  const tomlSrc = fs.readFileSync(tomlPath, 'utf8');
  const routeRegex = /from\s*=\s*"\/api\/[^"]*"\s*\n\s*to\s*=\s*"\/\.netlify\/functions\/([^"]+)"/g;
  let match;
  const routes = [];
  while ((match = routeRegex.exec(tomlSrc)) !== null) {
    routes.push({ fnName: match[1] });
  }

  const fnDir = path.join(ROOT, 'netlify/functions');
  for (const route of routes) {
    const fnFile = path.join(fnDir, route.fnName + '.js');
    const exists = fs.existsSync(fnFile);
    check(`route → ${route.fnName}.js`, exists, exists ? '존재' : '파일 없음');
  }

  if (fs.existsSync(fnDir)) {
    const allFns = fs.readdirSync(fnDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
    const routedNames = new Set(routes.map(r => r.fnName));
    const orphanFns = allFns.filter(f => !routedNames.has(f) && !f.startsWith('_'));
    if (orphanFns.length > 0) {
      console.log(`  ℹ 라우트 없는 함수 (직접 호출 전용 가능): ${orphanFns.join(', ')}`);
    }
  }
}

// ── 4. HTML 파일 기본 구조 검사 ─────────────────────────────────────────────

function verifyHTMLFiles() {
  console.log('\n=== HTML 파일 기본 구조 검사 ===');

  const htmlDirs = [{ dir: '.', label: 'root' }, { dir: 'pages', label: 'pages' }];
  const requiredPatterns = [
    { pattern: /<!DOCTYPE html>/i, name: 'DOCTYPE' },
    { pattern: /<html/i, name: '<html>' },
    { pattern: /<\/html>/i, name: '</html>' },
    { pattern: /<head/i, name: '<head>' },
    { pattern: /<body/i, name: '<body>' },
  ];

  for (const { dir } of htmlDirs) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    const entries = fs.readdirSync(absDir);
    for (const name of entries) {
      if (!name.endsWith('.html')) continue;
      const src = fs.readFileSync(path.join(absDir, name), 'utf8');
      const rel = (dir === '.' ? '' : dir + '/') + name;
      const allPresent = requiredPatterns.every(p => p.pattern.test(src));
      check(`html ${rel}`, allPresent, allPresent ? '기본 구조 OK' : '필수 태그 누락');
    }
  }
}

// ── 5. 필수 파일 존재 확인 ───────────────────────────────────────────────────

function verifyRequiredFiles() {
  console.log('\n=== 필수 파일 존재 확인 ===');

  const required = [
    'index.html',
    'pages/search.html',
    'pages/detail.html',
    'pages/editor.html',
    'pages/my-trees.html',
    'pages/login.html',
    'pages/intro.html',
    'js/i18n.js',
    'js/auth.js',
    'js/editor.js',
    'js/search.js',
    'js/detail.js',
    'js/my-trees.js',
    'js/shared-header.js',
    'js/firebase-config.js',
    'css/global.css',
    'netlify.toml',
    'package.json',
  ];

  for (const file of required) {
    const exists = fs.existsSync(path.join(ROOT, file));
    check(`file: ${file}`, exists, exists ? '존재' : '없음');
  }
}

// ── 6. node_modules 의존성 설치 확인 ──────────────────────────────────────────

function verifyNodeModules() {
  console.log('\n=== node_modules 의존성 확인 ===');

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});

  for (const dep of deps) {
    const exists = fs.existsSync(path.join(ROOT, 'node_modules', dep, 'package.json'));
    check(`dep: ${dep}`, exists, exists ? '설치됨' : '미설치');
  }
}

// ── 7. env/DB/Firebase (--full 또는 --remote 시) ────────────────────────────

async function verifyFull() {
  if (!FULL && !REMOTE_URL) {
    console.log('\n=== env/DB/Firebase 검사 (스킵: --full 미지정) ===');
    return;
  }

  const verifyEnvPath = path.join(ROOT, 'scripts/verify-env.js');
  if (!fs.existsSync(verifyEnvPath)) {
    check('verify-env.js 존재', false, '스킵');
    return;
  }

  console.log('\n=== env/DB/Firebase 검사 (verify-env.js) ===');
  try {
    const cmd = REMOTE_URL
      ? `node "${verifyEnvPath}" --remote ${REMOTE_URL}`
      : `node "${verifyEnvPath}"`;
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, timeout: 30000 });
  } catch (e) {
    exitCode = 1;
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LoveBud Pre-Deploy Verification');
  console.log('='.repeat(40));

  verifyJSSyntax();
  verifyI18nKeys();
  verifyRoutesAndFunctions();
  verifyHTMLFiles();
  verifyRequiredFiles();
  verifyNodeModules();
  await verifyFull();

  console.log('\n' + '='.repeat(40));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`결과: ${passed}/${total} 통과`);

  if (exitCode !== 0) {
    console.log('\n실패 항목:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.name}${r.detail ? ': ' + r.detail : ''}`);
    });
  }

  process.exit(exitCode);
}

main().catch(e => {
  console.error('검증 스크립트 오류:', e);
  process.exit(1);
});
