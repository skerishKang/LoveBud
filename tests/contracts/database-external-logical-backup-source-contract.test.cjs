/**
 * #3828 external logical-backup source contract — static source analysis.
 *
 * Refs #3828 (implementation child). Parent #3460 stays OPEN.
 *
 * Statically proves the source-only Modal-to-R2 logical-backup pipeline boundaries
 * without executing any live operation (no provider, R2, Modal, DB, subprocess dump,
 * network, or filesystem mutation). The behavior contract test in the sibling file
 * executes only the pure policy module.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_app.py');
const POLICY_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_policy.py');
const APP = fs.readFileSync(APP_PATH, 'utf8');
const POLICY = fs.readFileSync(POLICY_PATH, 'utf8');

test('1. separate Modal app with exact name', () => {
  assert.match(APP, /modal\.App\(\s*RECOVERY_BACKUP_APP_NAME\s*\)/);
  assert.match(APP, /RECOVERY_BACKUP_APP_NAME\s*=\s*['"]lovebud-recovery-backup['"]/);
});

test('2. non-HTTP boundary: no web endpoints or public trigger', () => {
  assert.ok(!/@modal\.asgi_app\b/.test(APP), 'must not use @modal.asgi_app');
  assert.ok(!/@modal\.web_endpoint\b/.test(APP), 'must not use @modal.web_endpoint');
  assert.ok(!/(from\s+fastapi\s+import|import\s+fastapi|FastAPI\()/.test(APP), 'must not use FastAPI');
  assert.ok(!/(from\s+flask\s+import|import\s+flask|Flask\()/.test(APP), 'must not use Flask');
  assert.ok(!/webhook|@app\.web_endpoint/.test(APP), 'no webhook/browser trigger');
});

test('3. exact three symbolic secret names', () => {
  assert.match(APP, /lovebud-db/);
  assert.match(APP, /lovebud-recovery-r2/);
  assert.match(APP, /lovebud-recovery-encryption/);
  const dbCount = (APP.match(/lovebud-db/g) || []).length;
  const r2Count = (APP.match(/lovebud-recovery-r2/g) || []).length;
  const encCount = (APP.match(/lovebud-recovery-encryption/g) || []).length;
  assert.ok(dbCount >= 1 && r2Count >= 1 && encCount >= 1, 'all three secret names referenced');
});

test('4. one scheduled execution per 24-hour period', () => {
  assert.match(APP, /modal\.Period\(days\s*=\s*1\)/);
});

test('5. custom-format compressed dump intent with no owner/privilege dependency', () => {
  assert.match(APP, /--format=custom|format=custom/);
  assert.match(APP, /--compress/);
  assert.match(APP, /--no-owner/);
  assert.match(APP, /--no-privileges/);
});

test('6. bounded single-attempt dump: pg_dump never retried unboundedly', () => {
  assert.match(APP, /pg_dump/);
  assert.ok(/timeout\s*=\s*DUMP_TIMEOUT_SECONDS/.test(APP), 'bounded dump timeout');
  const retryScope = APP.slice(APP.indexOf('def _retry_object'), APP.indexOf('def _run_dump'));
  assert.ok(!retryScope.includes('pg_dump'), 'pg_dump is outside the retry helper');
});

test('7. streaming authenticated encryption intent', () => {
  assert.match(APP, /cryptography\.hazmat\.primitives\.ciphers\.aead/);
  assert.match(APP, /AESGCM/);
  assert.match(APP, /STREAM_CHUNK_BYTES/);
  assert.match(APP, /nonce/);
  assert.match(APP, /authentication tag stored inside object|tag stored inside object/i);
});

test('8. plaintext deletion before upload', () => {
  const encryptBlock = APP.indexOf('def _streaming_encrypt');
  const uploadBlock = APP.indexOf('put_object');
  const plaintextRemove = APP.indexOf('os.remove(dump_path)');
  assert.ok(encryptBlock !== -1 && plaintextRemove !== -1 && uploadBlock !== -1, 'encrypt/remove/upload present');
  assert.ok(plaintextRemove < uploadBlock, 'plaintext removed before upload');
});

test('9. staging upload -> head verification -> daily promotion -> weekly/monthly promotion -> staging cleanup ordering', () => {
  assert.match(APP, /STAGING_PREFIX/);
  assert.match(APP, /DAILY_PREFIX/);
  assert.match(APP, /WEEKLY_PREFIX/);
  assert.match(APP, /MONTHLY_PREFIX/);
  assert.match(APP, /put_object/);
  assert.match(APP, /head_object/);
  assert.match(APP, /copy_object/);
  assert.match(APP, /delete_object/);
  const idx = (t) => APP.indexOf(t);
  for (const marker of ['put_object', 'head_object', 'daily_promote', 'weekly_promote', 'monthly_promote', 'staging_delete']) {
    assert.ok(idx(marker) !== -1, 'missing pipeline marker ' + marker);
  }
  assert.ok(idx('put_object') < idx('head_object'), 'upload before head verification');
  assert.ok(idx('head_object') < idx('daily_promote'), 'head verification before daily promotion');
  assert.ok(idx('daily_promote') < idx('weekly_promote'), 'daily before weekly promotion');
  assert.ok(idx('weekly_promote') < idx('monthly_promote'), 'weekly before monthly promotion');
  assert.ok(idx('monthly_promote') < idx('staging_delete'), 'monthly promotion before staging cleanup');
});

test('10. weekly/monthly promotion copies the same encrypted object, never a second dump', () => {
  const dumpDefCount = (APP.match(/def _run_dump\(/g) || []).length;
  const dumpCallCount = (APP.match(/_run_dump\(db_url, dump_path\)/g) || []).length;
  assert.equal(dumpDefCount, 1, 'single dump helper');
  assert.equal(dumpCallCount, 1, 'exactly one Production dump per run');
  const promotionSection = APP.slice(APP.indexOf('# 9. daily promotion'));
  assert.ok(!promotionSection.includes('_run_dump') && !promotionSection.includes('pg_dump'), 'promotion section never re-dumps');
});

test('11. finally cleanup present', () => {
  assert.match(APP, /finally\s*:/);
  assert.match(APP, /shutil\.rmtree/);
});

test('12. sanitized-only reporting via the pure policy module', () => {
  assert.match(APP, /from modal_compute\.recovery_backup_policy import/);
  assert.match(APP, /evaluate_run|make_sanitized_status/);
});

test('13. no import or modification dependency on the public FastAPI app', () => {
  assert.ok(!/from modal_compute\.app import|import modal_compute\.app\b/.test(APP), 'must not import modal_compute/app');
  assert.ok(!/modal_compute\.app\./.test(APP), 'must not reference modal_compute/app');
});

test('14. no raw secret/status logging patterns', () => {
  assert.ok(!/print\([^)]*(DATABASE_URL|db_url|command|stderr|nonce|tag|os\.environ)/.test(APP), 'no value/secret logging');
  assert.ok(!/print\([^)]*(access_key|secret_key|R2_)/.test(APP), 'no credential logging');
  const logCalls = APP.match(/_log_phase\((['"])([^'"]+)\1\)/g) || [];
  assert.ok(logCalls.length >= 5, 'phase-only logging used');
  for (const call of logCalls) {
    assert.ok(/^_log_phase\((['"])([a-z_]+)\1\)$/.test(call), 'log call is a literal phase label only');
  }
});

test('15. no restore/reset/branch operations', () => {
  assert.ok(!/restoreSnapshot|finalize_restore|\.restore\(|create_branch|delete_branch|reset_branch/.test(APP), 'no restore/reset/branch operation');
  assert.ok(!/\breset\b/.test(APP), 'no reset operation');
  assert.ok(!/snapshot/.test(APP), 'no snapshot mutation');
});

test('16. policy module purity: no forbidden imports or env/network access', () => {
  assert.ok(!/^\s*(import|from)\s+modal\b/m.test(POLICY), 'policy must not import modal');
  assert.ok(!/^\s*(import|from)\s+boto3\b/m.test(POLICY), 'policy must not import boto3');
  assert.ok(!/^\s*(import|from)\s+botocore\b/m.test(POLICY), 'policy must not import botocore');
  assert.ok(!/^\s*(import|from)\s+cryptography\b/m.test(POLICY), 'policy must not import cryptography');
  assert.ok(!/^\s*(import|from)\s+psycopg\b/m.test(POLICY), 'policy must not import psycopg');
  assert.ok(!/^\s*import\s+subprocess\b/m.test(POLICY), 'policy must not import subprocess');
  assert.ok(!/os\.environ/.test(POLICY), 'policy must not access environment variables');
  assert.ok(!/^\s*(import|from)\s+(socket|http|urllib|requests)\b/m.test(POLICY), 'policy must not import network libraries');
});

test('17. fixed policy states and helpers present', () => {
  for (const state of [
    'BACKUP_POINT_VALID',
    'BACKUP_POINT_STALE',
    'BACKUP_POINT_MISSING',
    'BACKUP_UPLOAD_INCOMPLETE',
    'BACKUP_INTEGRITY_UNVERIFIED',
    'EXTERNAL_STORAGE_UNPROVISIONED',
    'SECRET_BOUNDARY_UNPROVISIONED',
    'DAILY_TIER_VALID',
    'WEEKLY_TIER_VALID',
    'MONTHLY_TIER_VALID',
    'CLEANUP_COMPLETE',
    'CLEANUP_FAILED',
  ]) {
    assert.ok(POLICY.includes(state), 'missing policy state ' + state);
  }
  for (const helper of [
    'decide_promotion',
    'classify_daily_freshness',
    'classify_retained_tier',
    'validate_backup_point',
    'make_sanitized_status',
    'reject_unknown_state',
    'reject_impossible_partial',
    'preserve_daily_on_weekly_failure',
    'preserve_daily_on_monthly_failure',
    'evaluate_run',
  ]) {
    assert.ok(POLICY.includes(helper), 'missing policy helper ' + helper);
  }
});
