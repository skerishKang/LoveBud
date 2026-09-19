#!/usr/bin/env node
'use strict';

require('dotenv').config();

/**
 * LoveBud 환경변수 및 Direct-Neon runtime drift 검증 스크립트 (#4451)
 *
 * 사용법:
 *   node scripts/verify-env.cjs                     # repo authority 기반 drift + 로컬 env presence
 *   node scripts/verify-env.cjs --remote            # + 원격 엔드포인트 확인 (기본 https://lovebud.pages.dev)
 *   node scripts/verify-env.cjs --remote <url>      # + 지정 호스트 확인
 *   node scripts/verify-env.cjs --connect           # (선택) DB 연결 확인 — Production credential 필요
 *
 * 현재 runtime authority:
 *   - Cloudflare Pages + Pages Functions (functions 디렉터리, same-origin /api/*)
 *   - Direct-Neon (Neon PostgreSQL 직접 연결, read/write credential 분리)
 *   - Firebase ID-token verification (JWKS 기반; service account JSON 사용 안 함)
 *   - Modal retained specialized/fallback boundary (MODAL_BASE_URL)
 *
 * 이 스크립트는 gate 이름 목록을 자체적으로 복제하지 않는다. authority는 항상 repo source다.
 *   - Production gate inventory : wrangler.toml [env.production.vars]
 *   - gate -> adapter            : functions 트리 JS 의 GATE_FLAG / PRIVATE_GATE_FLAG 선언
 *   - adapter -> DB env          : 같은 파일의 DATABASE_URL 심볼 선언
 *   - 금지 fallback              : 같은 파일의 *_FORBIDDEN_FALLBACK_ENVS 선언
 *
 * 출력 안전: DB URL value, password, token, credential JSON 등 secret 값은 절대 출력하지 않는다.
 * 심볼 이름 / present·missing / 개수 / 상대 경로 / sanitized status 만 출력한다.
 *
 * Note: Netlify hosts (*.netlify.app) are stale/legacy and must not be used
 * as --remote defaults or production validation targets (#3348).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const PRODUCTION_HOST = 'https://lovebud.pages.dev';

const argv = process.argv.slice(2);
const remoteIndex = argv.indexOf('--remote');
const REMOTE_FLAG = remoteIndex !== -1;
const REMOTE_ARG = REMOTE_FLAG ? argv[remoteIndex + 1] : null;
const BASE_URL = REMOTE_FLAG
  ? (REMOTE_ARG && !REMOTE_ARG.startsWith('--') ? REMOTE_ARG : PRODUCTION_HOST)
  : null;
const CONNECT_FLAG = argv.includes('--connect');

// Active Cloudflare Pages Functions entrypoints. Each path was verified to exist
// on current main before being listed; do not add speculative paths (#4451).
const PAGES_FUNCTION_ENTRYPOINTS = [
  'functions/api/[[path]].js',
  'functions/api/trees.js',
  'functions/api/memories.js',
  'functions/api/community/trees.js',
  'functions/_shared/bounded-request-body.js',
  'functions/_shared/firebase-id-token-verifier.js',
];

const GATE_NAME_RE = /^LB_[A-Z0-9_]+_RUNTIME$/;
const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const DIRECT_NEON_VALUE = 'direct_neon';

let exitCode = 0;
const results = [];
const warnings = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  const color = passed ? '' : ' [FAIL]';
  console.log(`  ${icon} ${name}${color}${detail ? ': ' + detail : ''}`);
  if (!passed) exitCode = 1;
}

function warn(name, detail) {
  warnings.push({ name, detail });
  console.log(`  ! ${name}${detail ? ': ' + detail : ''}`);
}

function info(label, detail) {
  console.log(`    · ${label}${detail ? ': ' + detail : ''}`);
}

function readRepoFile(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

// ─── Repo authority readers ──────────────────────────────────────────────────

function readWranglerProductionVars() {
  const text = readRepoFile('wrangler.toml');
  if (text === null) return { parsed: false, gates: new Set(), vars: new Map() };
  const parts = text.split(/^\[env\.production\.vars\]\s*$/m);
  if (parts.length < 2) return { parsed: false, gates: new Set(), vars: new Map() };
  const section = parts[1];

  const gates = new Set();
  for (const m of section.matchAll(/^(LB_[A-Z0-9_]+_RUNTIME)\s*=\s*"([^"]*)"\s*$/gm)) {
    if (m[2].trim() === DIRECT_NEON_VALUE) gates.add(m[1]);
  }

  const vars = new Map();
  for (const m of section.matchAll(/^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/gm)) {
    vars.set(m[1], m[2].trim());
  }
  return { parsed: true, gates, vars };
}

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collectAdapterDeclarations() {
  const files = walkJsFiles(path.join(ROOT, 'functions'));
  const gateOwners = new Map();
  const dbEnvByFile = new Map();
  const forbiddenByFile = new Map();

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const src = fs.readFileSync(abs, 'utf8');

    for (const m of src.matchAll(/\b(?:GATE_FLAG|PRIVATE_GATE_FLAG)\s*:\s*'([A-Z0-9_]+)'/g)) {
      if (!GATE_NAME_RE.test(m[1])) continue;
      if (!gateOwners.has(m[1])) gateOwners.set(m[1], new Set());
      gateOwners.get(m[1]).add(rel);
    }

    for (const m of src.matchAll(/\bDATABASE_URL\s*:\s*'([A-Z0-9_]+)'/g)) {
      if (!ENV_NAME_RE.test(m[1])) continue;
      if (!dbEnvByFile.has(rel)) dbEnvByFile.set(rel, new Set());
      dbEnvByFile.get(rel).add(m[1]);
    }

    for (const m of src.matchAll(/FORBIDDEN[A-Z0-9_]*\s*=\s*Object\.freeze\(\[([\s\S]*?)\]/g)) {
      const names = [...m[1].matchAll(/'([A-Z0-9_]+)'/g)].map((x) => x[1]);
      if (!names.length) continue;
      if (!forbiddenByFile.has(rel)) forbiddenByFile.set(rel, new Set());
      for (const n of names) forbiddenByFile.get(rel).add(n);
    }
  }

  return { gateOwners, dbEnvByFile, forbiddenByFile, fileCount: files.length };
}

function collectDocumentedGates() {
  const text = readRepoFile('.env.example');
  if (text === null) return null;
  const gates = new Set();
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const m = /^(LB_[A-Z0-9_]+_RUNTIME)\s*=\s*direct_neon\s*$/.exec(s);
    if (m) gates.add(m[1]);
  }
  return gates;
}

// ─── 1 / 2. Gate inventory and gate -> adapter mapping ───────────────────────

function verifyGateInventory(wrangler, decl) {
  console.log('\n=== 1. Production Direct-Neon gate inventory (wrangler.toml) ===');
  check('wrangler.toml [env.production.vars] 파싱', wrangler.parsed);
  if (!wrangler.parsed) return null;

  // Set으로 보관한다: drift 검사에서 두 방향 membership 검사가 필요하다.
  const gates = new Set([...wrangler.gates].sort());
  info('checked-in direct_neon gates', String(gates.size));
  check('checked-in gate inventory 비어 있지 않음', gates.size > 0);

  console.log('\n=== 2. gate -> adapter mapping ===');
  const unmapped = [];
  const ambiguous = [];
  const multiEnvFiles = [];
  const dbEnvByGate = new Map();
  const forbiddenByGate = new Map();

  for (const gate of gates) {
    const owners = decl.gateOwners.get(gate);
    if (!owners || owners.size === 0) {
      unmapped.push(gate);
      continue;
    }
    if (owners.size > 1) ambiguous.push(`${gate} <- ${[...owners].sort().join(', ')}`);

    const envs = new Set();
    const forbidden = new Set();
    for (const owner of owners) {
      const fileEnvs = decl.dbEnvByFile.get(owner);
      if (!fileEnvs || fileEnvs.size === 0) {
        unmapped.push(`${gate} (adapter ${owner} declares no DATABASE_URL symbol)`);
        continue;
      }
      if (fileEnvs.size > 1) multiEnvFiles.push(`${owner} declares ${[...fileEnvs].sort().join(', ')}`);
      for (const e of fileEnvs) envs.add(e);
      const f = decl.forbiddenByFile.get(owner);
      if (f) for (const n of f) forbidden.add(n);
    }

    if (envs.size === 1) dbEnvByGate.set(gate, [...envs][0]);
    else if (envs.size > 1) ambiguous.push(`${gate} <- multiple DB envs ${[...envs].sort().join(', ')}`);
    forbiddenByGate.set(gate, forbidden);
  }

  info('mapped gates', String(dbEnvByGate.size));
  info('unmapped gates', String(unmapped.length));
  info('ambiguous gates', String(ambiguous.length));
  check('모든 checked-in gate가 adapter에 매핑됨 (unmapped = 0)', unmapped.length === 0,
    unmapped.length ? unmapped.slice(0, 5).join('; ') : undefined);
  check('gate 소유권 모호성 없음 (ambiguous = 0)', ambiguous.length === 0,
    ambiguous.length ? ambiguous.slice(0, 5).join('; ') : undefined);
  check('adapter별 DB env 심볼 단일 선언', multiEnvFiles.length === 0,
    multiEnvFiles.length ? multiEnvFiles.slice(0, 5).join('; ') : undefined);

  return { gates, dbEnvByGate, forbiddenByGate };
}

// ─── 3. read / write symbolic authority ──────────────────────────────────────

function verifySymbolicAuthority(inventory, decl) {
  console.log('\n=== 3. read / write DB symbolic authority ===');
  const dbEnvByGate = inventory.dbEnvByGate;
  const authorityEnvs = new Set([...dbEnvByGate.values()]);

  info('gate가 사용하는 DB env 심볼 수', String(authorityEnvs.size));
  for (const env of [...authorityEnvs].sort()) info('authority env', env);
  check('DB authority 심볼이 정확히 2개 (read / write 분리)', authorityEnvs.size === 2,
    `found ${authorityEnvs.size}`);

  const forbiddenAll = new Set();
  for (const [, names] of decl.forbiddenByFile) for (const n of names) forbiddenAll.add(n);
  const genericForbidden = [...forbiddenAll].filter((n) => !authorityEnvs.has(n)).sort();

  info('forbidden fallback env (source-derived)', String(forbiddenAll.size));
  info('generic/legacy forbidden env', genericForbidden.join(', ') || '(none)');
  check('source가 generic/legacy fallback env를 금지하고 있음', genericForbidden.length > 0);

  // Each authority must be rejected as a substitute by the opposite side.
  const oppositeCount = new Map();
  for (const [gate, env] of dbEnvByGate) {
    const forbidden = inventory.forbiddenByGate.get(gate) || new Set();
    for (const other of authorityEnvs) {
      if (other !== env && forbidden.has(other)) {
        oppositeCount.set(other, (oppositeCount.get(other) || 0) + 1);
      }
    }
  }
  const bothSidesForbidden = [...authorityEnvs].every((env) => (oppositeCount.get(env) || 0) > 0);
  check('read authority와 write authority가 서로의 대체를 금지함', bothSidesForbidden,
    [...authorityEnvs].sort().map((e) => `${e}<-opposite-forbidden x${oppositeCount.get(e) || 0}`).join(' | '));

  // #4451 §7: the gate-name suffix must not be the authority. Gates whose name
  // ends in neither _READ_RUNTIME nor _WRITE_RUNTIME (e.g. *_DETAIL_RUNTIME) are
  // unclassifiable by suffix, yet the adapter still resolves a DB env for them.
  const suffixClassifiable = (g) => /_(READ|WRITE)_RUNTIME$/.test(g);
  const unclassifiableBySuffix = [...dbEnvByGate.keys()].filter((g) => !suffixClassifiable(g)).sort();
  const suffixDisagreements = [];
  for (const [gate, env] of dbEnvByGate) {
    if (!suffixClassifiable(gate)) continue;
    const suffixSaysWrite = /_WRITE_RUNTIME$/.test(gate);
    const writeEnv = [...authorityEnvs].find((e) => /WRITE/.test(e));
    const adapterSaysWrite = writeEnv ? env === writeEnv : false;
    if (suffixSaysWrite !== adapterSaysWrite) suffixDisagreements.push(`${gate}->${env}`);
  }

  info('suffix로 분류 불가능한 gate 수', String(unclassifiableBySuffix.length));
  for (const g of unclassifiableBySuffix) info('  suffix-ambiguous', `${g} -> ${dbEnvByGate.get(g)}`);
  check('suffix만으로 DB credential을 결정할 수 없음이 확인됨', unclassifiableBySuffix.length > 0,
    unclassifiableBySuffix.length ? undefined : 'suffix 규칙이 모든 gate를 분류해버림 — 판정 근거 재검토 필요');
  check('suffix로 분류 가능한 gate는 adapter 판정과 일치', suffixDisagreements.length === 0,
    suffixDisagreements.slice(0, 5).join(', ') || undefined);

  return { authorityEnvs, dbEnvByGate, genericForbidden, unclassifiableBySuffix, oppositeCount };
}

// ─── 4. local env presence / compatibility ───────────────────────────────────

function looksLikePostgresUrl(value) {
  return typeof value === 'string' && /^postgres(?:ql)?:\/\//i.test(value.trim());
}

function envValue(name) {
  const raw = process.env[name];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}

function verifyLocalEnv(authority) {
  console.log('\n=== 4. 로컬 환경변수 presence / compatibility ===');
  const present = [];
  const missing = [];
  const malformed = [];

  for (const env of [...authority.authorityEnvs].sort()) {
    const value = envValue(env);
    if (!value) {
      missing.push(env);
      check(`env ${env}`, false, '누락');
      continue;
    }
    present.push(env);
    if (looksLikePostgresUrl(value)) {
      check(`env ${env}`, true, '설정됨 (postgres URL 형식)');
    } else {
      malformed.push(env);
      check(`env ${env}`, false, '설정됨 (postgres URL 형식 아님)');
    }
  }

  const modal = envValue('MODAL_BASE_URL');
  info('MODAL_BASE_URL', modal ? '설정됨' : '누락 (Modal 경로 fail closed)');
  const projectId = envValue('FIREBASE_PROJECT_ID');
  info('FIREBASE_PROJECT_ID', projectId ? '설정됨' : '누락 (기본 project id 사용)');

  return { present, missing, malformed };
}

// ─── 5. forbidden fallback / fail-closed ─────────────────────────────────────

function verifyForbiddenFallback(inventory, authority) {
  console.log('\n=== 5. forbidden fallback 검출 (fail closed) ===');
  const violations = [];
  let satisfied = 0;

  for (const [gate, env] of inventory.dbEnvByGate) {
    if (envValue(env)) {
      satisfied += 1;
      continue;
    }
    const forbidden = inventory.forbiddenByGate.get(gate) || new Set();
    const substitutes = [...forbidden].filter((n) => looksLikePostgresUrl(envValue(n))).sort();
    if (substitutes.length) violations.push(`${gate} (${env} 누락, 대체 가능: ${substitutes.join(', ')})`);
  }

  info('checked-in gate 수', String(inventory.dbEnvByGate.size));
  info('전용 authority가 설정된 gate 수', String(satisfied));
  info('전용 authority 누락 + 금지 fallback 존재 조합', String(violations.length));
  check('전용 authority 없이 generic/legacy fallback으로 대체되는 상태가 아님', violations.length === 0,
    violations.length ? violations.slice(0, 5).join('; ') : undefined);

  // A read credential must never be able to satisfy a write gate's authority.
  const crossSubstitution = [];
  for (const [gate, env] of inventory.dbEnvByGate) {
    const forbidden = inventory.forbiddenByGate.get(gate) || new Set();
    for (const other of authority.authorityEnvs) {
      if (other === env) continue;
      if (forbidden.has(other) && envValue(other) && !envValue(env)) {
        crossSubstitution.push(`${gate}: ${other} present while ${env} missing`);
      }
    }
  }
  info('read/write 교차 대체 위험', String(crossSubstitution.length));
  check('read credential이 writer authority를 대신하지 않음 (반대도 동일)', crossSubstitution.length === 0,
    crossSubstitution.slice(0, 3).join('; ') || undefined);

  return { satisfied, violations, crossSubstitution };
}

// ─── 6. read / write credential boundary ─────────────────────────────────────

function verifyCredentialBoundary(authority) {
  console.log('\n=== 6. read / write credential boundary ===');
  const envs = [...authority.authorityEnvs].sort();
  if (envs.length !== 2) {
    check('read / write authority 2개 존재', false, `found ${envs.length}`);
    return { identical: false, compared: false };
  }

  const [a, b] = envs;
  const va = envValue(a);
  const vb = envValue(b);

  if (!va || !vb) {
    info('두 authority 동일성 비교', '한쪽 이상 미설정 → 생략');
    return { identical: false, compared: false };
  }

  const identical = va === vb;
  info('두 authority 동일 여부', identical ? '동일' : '분리됨');
  if (identical) {
    // 현재 main의 accepted design에는 read == write 를 fail closed 로 만드는
    // contract가 없다 (writer/reader adapter는 "공존"을 정식 허용한다).
    // 따라서 경고만 남기고 실패로 처리하지 않는다 — 임의 설계를 발명하지 않기 위함.
    warn('read authority와 write authority 값이 동일', `${a} == ${b} (현재 main에 fail-closed contract 없음 — 경고만)`);
  } else {
    check('read authority와 write authority가 분리됨', true);
  }
  return { identical, compared: true };
}

// ─── 7. Firebase project-id boundary ─────────────────────────────────────────

function verifyFirebaseBoundary() {
  console.log('\n=== 7. Firebase project-id boundary ===');
  const rel = 'functions/_shared/firebase-id-token-verifier.js';
  const src = readRepoFile(rel);
  check(`${rel} 존재`, src !== null);
  if (src === null) return {};

  const declaresEnv = /projectIdEnv\s*:\s*'FIREBASE_PROJECT_ID'/.test(src);
  const fallbackMatch = src.match(/DEFAULT_PROJECT_ID\s*=\s*'([^']+)'/);
  const usesServiceAccount = /FIREBASE_SERVICE_ACCOUNT/.test(src);

  check('projectIdEnv = FIREBASE_PROJECT_ID', declaresEnv);
  check('기본 project id fallback 존재 (optional semantics)', !!fallbackMatch,
    fallbackMatch ? `default=${fallbackMatch[1]}` : undefined);
  check('service account JSON 의존 없음', !usesServiceAccount);

  const configured = envValue('FIREBASE_PROJECT_ID');
  info('FIREBASE_PROJECT_ID semantics', configured ? '설정값 사용' : `미설정 → 기본값 ${fallbackMatch ? fallbackMatch[1] : '?'} 사용`);
  return { declaresEnv, fallback: fallbackMatch ? fallbackMatch[1] : null, configured: !!configured };
}

// ─── 8. Cloudflare Pages Functions entrypoints ───────────────────────────────

function verifyPagesEntrypoints() {
  console.log('\n=== 8. Cloudflare Pages Functions entrypoint ===');
  const missing = PAGES_FUNCTION_ENTRYPOINTS.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  info('검사한 entrypoint 수', String(PAGES_FUNCTION_ENTRYPOINTS.length));
  check('active Pages Functions entrypoint 존재', missing.length === 0,
    missing.length ? missing.join(', ') : undefined);

  const nonPages = PAGES_FUNCTION_ENTRYPOINTS.filter((rel) => !rel.startsWith('functions/'));
  check('entrypoint 목록이 Cloudflare Pages Functions 경로만 포함', nonPages.length === 0,
    nonPages.join(', ') || undefined);

  // Legacy Netlify function syntax validation must be gone. The marker is built
  // at runtime so this guard cannot match its own source text.
  const legacyMarker = ['netlify', 'functions'].join('/');
  const selfSrc = readRepoFile('scripts/verify-env.cjs') || '';
  const legacyRefs = selfSrc.split(legacyMarker).length - 1;
  info('스크립트 내 legacy Netlify 함수 경로 참조', String(legacyRefs));
  check('legacy Netlify functions 문법 검증 제거됨', legacyRefs === 0);

  return { checked: PAGES_FUNCTION_ENTRYPOINTS.length, missing };
}

// ─── 9. optional remote endpoints ────────────────────────────────────────────

async function verifyRemoteEndpoints() {
  if (!BASE_URL) {
    console.log('\n=== 9. 원격 엔드포인트 확인 (스킵: --remote 미지정) ===');
    return;
  }

  console.log(`\n=== 9. 원격 엔드포인트 확인 (${BASE_URL}) ===`);

  // unauthenticated GET /api/trees 는 auth guard 가 살아 있음을 증명하는 check 다.
  // functions/api/trees.js 는 Authorization 헤더가 없으면 401 로 fail closed 하므로
  // 401 이 healthy result 다. 200/503 은 이 check 에서 정상으로 인정하지 않는다.
  // 인증 요청은 하지 않는다 (read-only, no credential). body 문자열은 authority 가 아니다.
  const endpoints = [
    { url: '/api/trees', method: 'GET', expectStatus: [401], label: 'GET /api/trees' },
    { url: '/api/community/memories', method: 'GET', expectStatus: [200, 503], label: 'GET /api/community/memories' },
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(BASE_URL + ep.url, { method: ep.method, signal: AbortSignal.timeout(10000) });
      check(ep.label, ep.expectStatus.includes(resp.status), `status=${resp.status}`);
    } catch (e) {
      check(ep.label, false, e.message);
    }
  }
}

// ─── 10. optional DB connectivity ────────────────────────────────────────────

async function verifyDbConnectivity(authority) {
  if (!CONNECT_FLAG) {
    console.log('\n=== 10. DB 연결 확인 (스킵: --connect 미지정) ===');
    return;
  }
  console.log('\n=== 10. DB 연결 확인 (--connect) ===');
  const target = [...authority.authorityEnvs].sort().find((env) => envValue(env));
  if (!target) {
    check('DB 연결', false, '설정된 authority env 없음');
    return;
  }
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: envValue(target),
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 3000,
    });
    const start = Date.now();
    const result = await pool.query('SELECT 1 AS ok');
    const elapsed = Date.now() - start;
    await pool.end();
    check(`DB 연결 (${target})`, result.rows[0].ok === 1, `${elapsed}ms`);
  } catch (e) {
    check(`DB 연결 (${target})`, false, e.message);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LoveBud 환경변수 / Direct-Neon runtime drift 검증 (#4451)');
  console.log('='.repeat(48));
  console.log('authority: wrangler.toml [env.production.vars] + functions JS 선언');

  const wrangler = readWranglerProductionVars();
  const decl = collectAdapterDeclarations();
  info('functions JS 파일 수', String(decl.fileCount));

  const inventory = verifyGateInventory(wrangler, decl);
  let authority = { authorityEnvs: new Set(), genericForbidden: [] };
  let local = { present: [], missing: [], malformed: [] };
  let boundary = { identical: false, compared: false };
  let fallback = { satisfied: 0, violations: [], crossSubstitution: [] };

  if (inventory) {
    authority = verifySymbolicAuthority(inventory, decl);
    local = verifyLocalEnv(authority);
    fallback = verifyForbiddenFallback(inventory, authority);
    boundary = verifyCredentialBoundary(authority);
  }

  verifyFirebaseBoundary();
  verifyPagesEntrypoints();

  console.log('\n=== .env.example 문서 drift ===');
  const documented = collectDocumentedGates();
  check('.env.example 읽기', documented !== null);
  if (documented !== null && inventory) {
    const missingDoc = [...inventory.gates].filter((g) => !documented.has(g)).sort();
    const staleDoc = [...documented].filter((g) => !inventory.gates.has(g)).sort();
    info('wrangler checked-in gates', String(inventory.gates.size));
    info('.env.example documented gates', String(documented.size));
    check('MISSING_DOCUMENTED_GATE = 0', missingDoc.length === 0, missingDoc.slice(0, 5).join(', ') || undefined);
    check('STALE_DOCUMENTED_GATE = 0', staleDoc.length === 0, staleDoc.slice(0, 5).join(', ') || undefined);
  }

  await verifyRemoteEndpoints();
  await verifyDbConnectivity(authority);

  console.log('\n' + '='.repeat(48));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`결과: ${passed}/${total} 통과`);
  if (warnings.length) {
    console.log(`경고: ${warnings.length}`);
    for (const w of warnings) console.log(`  ! ${w.name}: ${w.detail}`);
  }

  if (exitCode !== 0) {
    console.log('\n실패 항목:');
    for (const r of results.filter((x) => !x.passed)) console.log(`  ✗ ${r.name}: ${r.detail || ''}`);
    console.log('\n주: 로컬 .env / credential이 없는 clean workspace에서는 env presence 검사가');
    console.log('    의도적으로 실패한다. 이는 source/gate parsing 실패가 아니다.');
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error('검증 스크립트 오류:', e && e.message ? e.message : e);
  process.exit(1);
});
