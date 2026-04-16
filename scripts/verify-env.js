#!/usr/bin/env node

/**
 * LoveBud 환경변수 및 엔드포인트 검증 스크립트
 *
 * 사용법:
 *   node scripts/verify-env.js [--remote https://lovebud.netlify.app]
 *
 * 확인 항목:
 *   1. 필수 환경변수 존재 여부
 *   2. 데이터베이스 연결
 *   3. Firebase 초기화
 *   4. 원격 엔드포인트 응답 (선택)
 */

const BASE_URL = process.argv.find(a => a === '--remote')
  ? process.argv[process.argv.indexOf('--remote') + 1] || 'https://lovebud.netlify.app'
  : null;

let exitCode = 0;
const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  const color = passed ? '' : ' [FAIL]';
  console.log(`  ${icon} ${name}${color}${detail ? ': ' + detail : ''}`);
  if (!passed) exitCode = 1;
}

async function verifyEnvVars() {
  console.log('\n=== 환경변수 확인 ===');

  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  check('NETLIFY_DATABASE_URL / DATABASE_URL', !!dbUrl, dbUrl ? '설정됨' : '누락');

  const fbSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  check('FIREBASE_SERVICE_ACCOUNT_JSON', !!fbSa, fbSa ? '설정됨' : '누락 (인증 필요 API 503)');

  if (fbSa) {
    try {
      JSON.parse(fbSa);
      check('FIREBASE_SERVICE_ACCOUNT_JSON 포맷', true, '유효한 JSON');
    } catch (e) {
      check('FIREBASE_SERVICE_ACCOUNT_JSON 포맷', false, 'JSON 파싱 실패: ' + e.message);
    }
  }
}

async function verifyDbConnection() {
  console.log('\n=== 데이터베이스 연결 확인 ===');

  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    check('DB 연결', false, '연결 문자열 없음');
    return;
  }

  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 3000,
    });

    const start = Date.now();
    const result = await pool.query('SELECT 1 AS ok');
    const elapsed = Date.now() - start;
    await pool.end();

    check('DB 연결', result.rows[0].ok === 1, `${elapsed}ms`);
  } catch (e) {
    check('DB 연결', false, e.message);
  }
}

async function verifyFirebaseInit() {
  console.log('\n=== Firebase Admin 초기화 확인 ===');

  const fbSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!fbSa) {
    check('Firebase 초기화', false, '서비스 계정 JSON 없음');
    return;
  }

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(fbSa);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    check('Firebase 초기화', true, '앱 초기화 성공');

    try {
      await admin.auth().listUsers(1);
      check('Firebase Auth 접근', true, '사용자 목록 조회 가능');
    } catch (e) {
      check('Firebase Auth 접근', false, e.message);
    }
  } catch (e) {
    check('Firebase 초기화', false, e.message);
  }
}

async function verifyRemoteEndpoints() {
  if (!BASE_URL) {
    console.log('\n=== 원격 엔드포인트 확인 (스킵: --remote 미지정) ===');
    return;
  }

  console.log(`\n=== 원격 엔드포인트 확인 (${BASE_URL}) ===`);

  const endpoints = [
    { url: '/api/trees', method: 'GET', expectStatus: [200, 503], label: 'GET /api/trees' },
    { url: '/api/community/memories', method: 'GET', expectStatus: [200, 503], label: 'GET /api/community/memories' },
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(BASE_URL + ep.url, { method: ep.method, signal: AbortSignal.timeout(10000) });
      const ok = ep.expectStatus.includes(resp.status);
      check(ep.label, ok, `status=${resp.status}`);
    } catch (e) {
      check(ep.label, false, e.message);
    }
  }
}

async function verifyFunctionSyntax() {
  console.log('\n=== 함수 문법 확인 ===');

  const functions = [
    'netlify/functions/trees.js',
    'netlify/functions/memories.js',
    'netlify/functions/tree-detail.js',
    'netlify/functions/memory-detail.js',
    'netlify/functions/community-memories.js',
    'netlify/functions/_lib/auth.js',
    'netlify/functions/_lib/db.js',
    'netlify/functions/_lib/http.js',
    'netlify/functions/_lib/doc-store.js',
  ];

  for (const fn of functions) {
    try {
      require('./' + fn);
      check(fn, true);
    } catch (e) {
      check(fn, false, e.message.split('\n')[0]);
    }
  }
}

async function main() {
  console.log('LoveBud 환경변수 및 엔드포인트 검증');
  console.log('='.repeat(40));

  await verifyEnvVars();
  await verifyFunctionSyntax();
  await verifyDbConnection();
  await verifyFirebaseInit();
  await verifyRemoteEndpoints();

  console.log('\n' + '='.repeat(40));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`결과: ${passed}/${total} 통과`);

  if (exitCode !== 0) {
    console.log('\n실패 항목:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.detail}`);
    });
  }

  process.exit(exitCode);
}

main().catch(e => {
  console.error('검증 스크립트 오류:', e);
  process.exit(1);
});
