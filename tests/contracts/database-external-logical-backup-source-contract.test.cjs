/**
 * #3828 external logical-backup source contract — static source analysis.
 *
 * Refs #3828 (implementation child). Parent #3460 stays OPEN.
 *
 * Statically proves the source-only Modal-to-R2 logical-backup pipeline boundaries
 * without executing any live operation (no provider, R2, Modal, DB, subprocess dump,
 * network, or filesystem mutation). The behavior contract test in the sibling file
 * executes only the pure policy module and a deterministic injected cipher seam.
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
  const retryScope = APP.slice(APP.indexOf('def _retry_object'), APP.indexOf('def _upload_attempt'));
  assert.ok(!retryScope.includes('pg_dump'), 'pg_dump is outside the retry helper');
});

test('7. DB URL never placed in pg_dump argv', () => {
  const dumpDef = APP.slice(APP.indexOf('def _run_dump'), APP.indexOf('def _is_non_empty'));
  assert.ok(!dumpDef.includes('db_url'), 'db_url must not appear in dump helper');
  assert.match(dumpDef, /PGDATABASE/);
  assert.match(dumpDef, /env\s*=\s*child_env/);
  assert.match(dumpDef, /PGCONNECT_TIMEOUT/);
  assert.ok(!dumpDef.includes('R2_ACCESS_KEY') && !dumpDef.includes('RECOVERY_ENCRYPTION_KEY'), 'no secret inherited into child env');
});

test('8. streaming single-envelope AEAD (version + nonce + ciphertext + one final tag)', () => {
  assert.match(APP, /cryptography\.hazmat\.primitives\.ciphers/);
  assert.match(APP, /Cipher\(\s*algorithms\.AES\(key\),\s*modes\.GCM\(nonce\)\s*\)\.encryptor\(\)/);
  assert.match(APP, /encryptor\.finalize\(\)/);
  assert.match(APP, /encryptor\.tag/);
  assert.match(APP, /STREAM_AEAD_VERSION/);
  assert.match(APP, /os\.urandom\(STREAM_AEAD_NONCE_BYTES\)/);
  // exact-once framing: version and nonce written once, tag written once
  assert.equal((APP.match(/dst\.write\(STREAM_AEAD_VERSION\)/g) || []).length, 1, 'version written exactly once');
  assert.equal((APP.match(/dst\.write\(nonce\)/g) || []).length, 1, 'nonce written exactly once');
  assert.equal((APP.match(/dst\.write\(encryptor\.tag\)/g) || []).length, 1, 'single final authentication tag');
  assert.ok(!/dst\.write\(ciphertext\[-16:\]\)/.test(APP), 'no duplicate tag write');
});

test('9. chunked streaming encrypt: no whole-file read', () => {
  const encBlock = APP.slice(APP.indexOf('def _streaming_encrypt'), APP.indexOf('def _streaming_decrypt'));
  assert.match(encBlock, /src\.read\(STREAM_CHUNK_BYTES\)/);
  assert.ok(!/src\.read\(\)/.test(encBlock), 'no whole-file read in encrypt');
  assert.match(encBlock, /empty plaintext rejected/);
});

test('10. strict base64 32-byte encryption key', () => {
  assert.match(APP, /RECOVERY_ENCRYPTION_KEY_B64/);
  assert.match(POLICY, /def decode_encryption_key/);
  assert.match(POLICY, /base64\.b64decode\(value,\s*validate=True\)/);
  assert.match(POLICY, /len\(decoded\)\s*!=\s*32/);
});

test('11. plaintext deletion before upload', () => {
  const encryptBlock = APP.indexOf('def _streaming_encrypt');
  const uploadCall = APP.indexOf('_verified_upload(s3, bucket, staging_key, enc_path)');
  const plaintextRemove = APP.indexOf('os.remove(dump_path)');
  assert.ok(encryptBlock !== -1 && plaintextRemove !== -1 && uploadCall !== -1, 'encrypt/remove/upload present');
  assert.ok(plaintextRemove < uploadCall, 'plaintext removed before upload');
});

test('12. retry-safe streaming upload: fresh file cursor per attempt, no whole-file read', () => {
  const attemptBlock = APP.slice(APP.indexOf('def _upload_attempt'), APP.indexOf('def _verified_upload'));
  assert.match(attemptBlock, /with open\(enc_path,\s*["']rb["']\) as body:/);
  assert.match(attemptBlock, /Body\s*=\s*body/);
  assert.ok(!/Body\s*=\s*[^)]*\.read\(\)/.test(attemptBlock), 'no whole-file read upload');
  const verifiedBlock = APP.slice(APP.indexOf('def _verified_upload'));
  assert.match(verifiedBlock, /_retry_object\(lambda: _upload_attempt/);
});

test('13. HeadObject verification requires length + format metadata, never ETag alone', () => {
  const verifiedBlock = APP.slice(APP.indexOf('def _verified_upload'), APP.indexOf('def run_logical_backup'));
  assert.match(verifiedBlock, /ContentLength[\s\S]{0,30}==\s*expected_size/);
  assert.match(verifiedBlock, /format-version/);
  assert.match(verifiedBlock, /content-kind/);
  assert.match(verifiedBlock, /R2_OBJECT_METADATA/);
  assert.ok(!/ETag[\s\S]{0,80}return\s+True/.test(verifiedBlock), 'ETag alone must not decide success');
});

test('14. unique non-logged run keys, no static key overwrite', () => {
  assert.match(APP, /def _unique_run_key/);
  assert.match(APP, /uuid\.uuid4\(\)\.hex/);
  assert.match(APP, /datetime\.now\(timezone\.utc\)/);
  assert.ok(!/incomplete\.object/.test(APP), 'no static object key');
});

test('15. independent weekly/monthly promotion decisions with UTC boundaries', () => {
  assert.match(APP, /decide_weekly_promotion\(True, False, now\.weekday\(\)\)/);
  assert.match(APP, /decide_monthly_promotion\(True, False, now\.day\)/);
  assert.ok(!/decide_promotion\(True,\s*False\)/.test(APP), 'no shared always-on promotion decision');
  assert.match(POLICY, /def decide_weekly_promotion/);
  assert.match(POLICY, /def decide_monthly_promotion/);
  assert.match(POLICY, /WEEKLY_PROMOTION_WEEKDAY/);
  assert.match(POLICY, /MONTHLY_PROMOTION_DAY/);
});

test('16. weekly/monthly promotion copies the same encrypted object, never a second dump', () => {
  const dumpDefCount = (APP.match(/def _run_dump\(/g) || []).length;
  const dumpCallCount = (APP.match(/_run_dump\(dump_path\)/g) || []).length;
  assert.equal(dumpDefCount, 1, 'single dump helper');
  assert.equal(dumpCallCount, 1, 'exactly one Production dump per run');
  const promotionSection = APP.slice(APP.indexOf('# 9. daily promotion'));
  assert.ok(!promotionSection.includes('_run_dump') && !promotionSection.includes('pg_dump'), 'promotion section never re-dumps');
});

test('17. strict finally cleanup: ignore_errors must not suppress failures', () => {
  assert.match(APP, /finally\s*:/);
  assert.match(APP, /shutil\.rmtree\(workdir\)/);
  assert.ok(!/ignore_errors\s*=\s*True/.test(APP), 'cleanup failures must not be suppressed');
});

test('18. sanitized-only reporting via the pure policy module', () => {
  assert.match(APP, /from modal_compute\.recovery_backup_policy import/);
  assert.match(APP, /evaluate_run|make_sanitized_status/);
});

test('19. no import or modification dependency on the public FastAPI app', () => {
  assert.ok(!/from modal_compute\.app import|import modal_compute\.app\b/.test(APP), 'must not import modal_compute/app');
  assert.ok(!/modal_compute\.app\./.test(APP), 'must not reference modal_compute/app');
});

test('20. no raw secret/status logging patterns', () => {
  assert.ok(!/print\([^)]*(DATABASE_URL|db_url|command|stderr|nonce|tag|os\.environ)/.test(APP), 'no value/secret logging');
  assert.ok(!/print\([^)]*(access_key|secret_key|R2_)/.test(APP), 'no credential logging');
  assert.ok(!/print\([^)]*(run_key|run_stamp|uuid)/.test(APP), 'no run-key logging');
  const logCalls = APP.match(/_log_phase\((['"])([^'"]+)\1\)/g) || [];
  assert.ok(logCalls.length >= 5, 'phase-only logging used');
  for (const call of logCalls) {
    assert.ok(/^_log_phase\((['"])([a-z_]+)\1\)$/.test(call), 'log call is a literal phase label only');
  }
});

test('21. no restore/reset/branch operations', () => {
  assert.ok(!/restoreSnapshot|finalize_restore|\.restore\(|create_branch|delete_branch|reset_branch/.test(APP), 'no restore/reset/branch operation');
  assert.ok(!/\breset\b/.test(APP), 'no reset operation');
  assert.ok(!/snapshot/.test(APP), 'no snapshot mutation');
});

test('22. policy module purity: no forbidden imports or env/network access', () => {
  assert.ok(!/^\s*(import|from)\s+modal\b/m.test(POLICY), 'policy must not import modal');
  assert.ok(!/^\s*(import|from)\s+boto3\b/m.test(POLICY), 'policy must not import boto3');
  assert.ok(!/^\s*(import|from)\s+botocore\b/m.test(POLICY), 'policy must not import botocore');
  assert.ok(!/^\s*(import|from)\s+cryptography\b/m.test(POLICY), 'policy must not import cryptography');
  assert.ok(!/^\s*(import|from)\s+psycopg\b/m.test(POLICY), 'policy must not import psycopg');
  assert.ok(!/^\s*import\s+subprocess\b/m.test(POLICY), 'policy must not import subprocess');
  assert.ok(!/os\.environ/.test(POLICY), 'policy must not access environment variables');
  assert.ok(!/^\s*(import|from)\s+(socket|http|urllib|requests)\b/m.test(POLICY), 'policy must not import network libraries');
});

test('23. fixed policy states and helpers present', () => {
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
    'decide_weekly_promotion',
    'decide_monthly_promotion',
    'classify_daily_freshness',
    'classify_retained_tier',
    'validate_backup_point',
    'make_sanitized_status',
    'reject_unknown_state',
    'reject_impossible_partial',
    'preserve_daily_on_weekly_failure',
    'preserve_daily_on_monthly_failure',
    'evaluate_run',
    'decode_encryption_key',
  ]) {
    assert.ok(POLICY.includes(helper), 'missing policy helper ' + helper);
  }
});
