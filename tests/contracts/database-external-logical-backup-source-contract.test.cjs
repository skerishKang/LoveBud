/**
 * #4137 external logical-backup source contract — static source analysis.
 *
 * Refs #4137 (implementation child of #3894). Parent #3894 stays OPEN. Grandparent #3460
 * stays OPEN.
 *
 * Statically proves the source-only Modal→Google Drive logical-backup pipeline boundaries
 * without executing any live operation (no provider, Google, Drive, Modal, DB, subprocess
 * dump, network, or filesystem mutation). The behavior contract test in the sibling file
 * executes only the pure policy module and a deterministic injected cipher seam.
 *
 * Deploy/schedule decoupling (#3460 child): the deployed function carries no schedule
 * binding and every execution requires the explicit runtime activation gate
 * (LB_RECOVERY_BACKUP_RUNTIME); unset/unknown values fail closed. Deployment alone is
 * architecturally incapable of activating automatic Production backups.
 *
 * The former R2 storage surface (boto3, _s3_client, put_object, head_object, copy_object,
 * delete_object, lovebud-recovery-r2) has been replaced by a Google Drive adapter under the
 * lovebud-recovery-drive symbolic secret. This contract proves the R2 surface is removed
 * from the active candidate and the Drive adapter enforces the #3894 boundaries.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_app.py');
const POLICY_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_policy.py');
const DRIVE_PATH = path.join(ROOT, 'modal_compute', 'recovery_drive_storage.py');
const STREAM_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_stream.py');
const RESTORE_PATH = path.join(ROOT, 'modal_compute', 'recovery_restore_app.py');
const APP = fs.readFileSync(APP_PATH, 'utf8');
const POLICY = fs.readFileSync(POLICY_PATH, 'utf8');
const DRIVE = fs.readFileSync(DRIVE_PATH, 'utf8');
const STREAM = fs.readFileSync(STREAM_PATH, 'utf8');
const RESTORE = fs.readFileSync(RESTORE_PATH, 'utf8');

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

test('3. exact three symbolic secret names (Drive replaces R2)', () => {
  assert.match(APP, /lovebud-db/);
  assert.match(APP, /lovebud-recovery-drive/);
  assert.match(APP, /lovebud-recovery-encryption/);
  const dbCount = (APP.match(/lovebud-db/g) || []).length;
  const driveCount = (APP.match(/lovebud-recovery-drive/g) || []).length;
  const encCount = (APP.match(/lovebud-recovery-encryption/g) || []).length;
  assert.ok(dbCount >= 1 && driveCount >= 1 && encCount >= 1, 'all three secret names referenced');
});

test('3b. R2 runtime surface removed from the active candidate', () => {
  assert.ok(!/lovebud-recovery-r2/.test(APP), 'R2 symbolic secret name removed from app');
  assert.ok(!/\bboto3\b/.test(APP), 'boto3 import removed from app');
  assert.ok(!/_s3_client/.test(APP), '_s3_client removed from app');
  assert.ok(!/put_object/.test(APP), 'put_object removed from app');
  assert.ok(!/head_object/.test(APP), 'head_object removed from app');
  assert.ok(!/\bcopy_object\b/.test(APP), 'copy_object removed from app');
  assert.ok(!/\bdelete_object\b/.test(APP), 'delete_object removed from app');
  assert.ok(!/R2_ACCOUNT_ID_ENV|R2_ACCESS_KEY_ENV|R2_SECRET_KEY_ENV|R2_BUCKET_ENV|R2_ENDPOINT_ENV/.test(APP), 'R2 env names removed from app');
  assert.ok(!/R2_OBJECT_METADATA/.test(APP), 'R2_OBJECT_METADATA constant removed from app');
});

test('3c. Drive adapter symbolic secret name exact', () => {
  assert.match(DRIVE, /RECOVERY_DRIVE_SECRET_NAME\s*=\s*['"]lovebud-recovery-drive['"]/);
  assert.match(DRIVE, /lovebud-recovery-drive/);
});

test('4. deployment does not activate a schedule (deploy != schedule activation)', () => {
  // #3460 decoupling child: the 24h cadence constant may exist, but the deployed
  // function must carry NO schedule binding — `modal deploy` alone stays inert.
  assert.match(APP, /DAILY_SCHEDULE\s*=\s*modal\.Period\(days\s*=\s*1\)/);
  assert.ok(!/schedule\s*=/.test(APP), 'no schedule= binding may remain in the deployed app');
  const fnStart = APP.indexOf('def run_logical_backup');
  const decoratorEnd = APP.indexOf('@app.function');
  const binding = APP.slice(decoratorEnd, fnStart);
  assert.ok(!/schedule\s*=/.test(binding), 'run_logical_backup must not be schedule-bound');
});

test('4c. Modal image pins PostgreSQL 17 client and preserves modal_compute local source', () => {
  const imageBlock = APP.slice(APP.indexOf('POSTGRES_BACKUP_IMAGE'), APP.indexOf('app = modal.App'));
  // exact pinned tag tied to the from_registry construction
  assert.match(APP, /POSTGRES_BACKUP_IMAGE\s*=\s*["']postgres:17\.4-bookworm["']/);
  assert.match(imageBlock, /modal\.Image\.from_registry\(/);
  assert.match(imageBlock, /from_registry\(\s*POSTGRES_BACKUP_IMAGE/);
  // exact Python 3.11 runtime
  assert.match(APP, /POSTGRES_PYTHON_VERSION\s*=\s*["']3\.11["']/);
  assert.match(imageBlock, /add_python\s*=\s*POSTGRES_PYTHON_VERSION/);
  // python dependencies: requests (Drive HTTP) + cryptography; boto3 removed
  assert.match(imageBlock, /pip_install\(["']requests["'],\s*["']cryptography["']\)/);
  assert.ok(!/pip_install\([^)]*boto3/.test(imageBlock), 'boto3 no longer in image pip_install');
  // local modal_compute source preserved
  assert.match(imageBlock, /add_local_python_source\(["']modal_compute["']\)/);
  // negative: no unversioned / floating / wrong-major image references anywhere
  assert.ok(!/apt_install\(["']postgresql-client["']\)/.test(APP), 'generic postgresql-client apt package removed');
  assert.ok(!/postgresql-client/.test(APP), 'unversioned postgresql-client package removed');
  assert.ok(!/postgres:latest/.test(APP), 'no latest tag');
  assert.ok(!/postgres:17["']/.test(APP), 'no floating major-17 tag (minor required)');
  assert.ok(!/postgres:16/.test(APP), 'no PostgreSQL 16 series');
  assert.ok(!/postgres:18/.test(APP), 'no PostgreSQL 18 series');
  assert.ok(!/modal\.Image\.debian_slim/.test(APP), 'no debian_slim fallback image');
});

test('4d. narrow provider failure containment without raw exception escape', () => {
  const flowStart = APP.indexOf('if dump_ok and encryption_ok and plaintext_cleanup_ok:');
  const dailyBlock = APP.indexOf('# 9. daily promotion');
  const flow = APP.slice(flowStart, dailyBlock);
  // client construction is a narrow sanitized boundary
  assert.match(flow, /try:\s*\n\s*service = _drive_client\(\)/);
  assert.match(flow, /except Exception:\s*\n\s*_log_phase\(["']storage_client_failed["']\)/);
  assert.match(flow, /service = None/);
  // upload + verification are a narrow sanitized boundary
  assert.match(flow, /try:\s*\n\s*staging_file_id = _verified_upload\(/);
  assert.match(flow, /except Exception:\s*\n\s*upload_ok = False/);
  assert.match(flow, /_log_phase\(["']upload_or_verification_failed["']\)/);
  // raw exception strings must never reach status or logs
  assert.ok(!/print\([^)]*except|print\([^)]*\be\b\)/.test(flow), 'no raw exception message logging');
  assert.ok(!/str\(e\)|repr\(e\)|traceback/.test(flow), 'no exception serialization into status/logs');
  // no broad outer catch: the only 4-space bare catches are the three narrow
  // fail-closed boundaries — encryption-key decode, workdir creation, and the
  // runtime activation gate — each of which returns sanitized status (never swallows).
  const runFunctionBody = APP.slice(APP.indexOf('def run_logical_backup'));
  const fourSpaceCatches = (runFunctionBody.match(/^    except Exception:\s*$/gm) || []);
  assert.equal(fourSpaceCatches.length, 3, 'only key-decode, workdir, and runtime-activation-gate boundaries are 4-space catches');
  assert.match(runFunctionBody, /except Exception:\s*\n\s*return make_sanitized_status\(/);
  assert.match(runFunctionBody, /workdir = tempfile\.mkdtemp[\s\S]{0,240}except Exception:/);
});

test('4e. encryption and plaintext cleanup are separate narrow boundaries', () => {
  const start = APP.indexOf('# 5. streaming AEAD envelope');
  const upload = APP.indexOf('if dump_ok and encryption_ok and plaintext_cleanup_ok:');
  const block = APP.slice(start, upload);
  const cleanupStart = block.indexOf('if encryption_ok:');
  assert.ok(cleanupStart !== -1, 'separate encryption_ok cleanup boundary');
  const encryptionBlock = block.slice(0, cleanupStart);
  const cleanupBlock = block.slice(cleanupStart);
  assert.match(encryptionBlock, /_streaming_encrypt\(dump_path, enc_path, encryption_key, nonce\)/);
  assert.ok(!encryptionBlock.includes('os.remove(dump_path)'), 'encryption block must not delete plaintext');
  assert.match(cleanupBlock, /try:/);
  assert.match(cleanupBlock, /os\.remove\(dump_path\)/);
  assert.match(cleanupBlock, /plaintext_cleanup_ok = False/);
  assert.match(cleanupBlock, /_log_phase\(["']plaintext_cleanup_failed["']\)/);
  assert.ok(!/plaintext_cleanup_failed[\s\S]{0,120}encryption_ok = False/.test(cleanupBlock), 'cleanup failure must preserve encryption_ok');
  assert.ok(!/plaintext_cleanup_failed[\s\S]{0,160}upload_ok = True/.test(cleanupBlock), 'upload cannot start after cleanup failure');
});

test('4b. exactly one non-HTTP Modal function binding on run_logical_backup', () => {
  const functionDecorators = (APP.match(/@app\.function\s*\(/g) || []).length;
  assert.equal(functionDecorators, 1, 'must be exactly one @app.function');
  const fnStart = APP.indexOf('def run_logical_backup');
  const decoratorEnd = APP.indexOf('@app.function');
  assert.ok(fnStart !== -1 && decoratorEnd !== -1 && decoratorEnd < fnStart, 'decorator must precede run_logical_backup');
  const binding = APP.slice(decoratorEnd, fnStart);
  assert.match(binding, /image\s*=\s*BACKUP_IMAGE/);
  assert.ok(!/schedule\s*=/.test(binding), 'deployed function must not be schedule-bound (#3460 decoupling)');
  assert.match(binding, /timeout\s*=\s*FUNCTION_TIMEOUT_SECONDS/);
  assert.ok(!/@modal\.asgi_app|@modal\.web_endpoint/.test(binding), 'binding must remain non-HTTP');
  // each exact symbolic secret must be bound through modal.Secret.from_name
  for (const secretName of ['lovebud-db', 'lovebud-recovery-drive', 'lovebud-recovery-encryption']) {
    assert.ok(
      APP.includes(`modal.Secret.from_name(RECOVERY_DB_SECRET_NAME)`) ||
      APP.includes(`modal.Secret.from_name(RECOVERY_DRIVE_SECRET_NAME)`) ||
      APP.includes(`modal.Secret.from_name(RECOVERY_ENCRYPTION_SECRET_NAME)`),
      'secret constants must be referenced through modal.Secret.from_name'
    );
    const constantFor = {
      'lovebud-db': 'RECOVERY_DB_SECRET_NAME',
      'lovebud-recovery-drive': 'RECOVERY_DRIVE_SECRET_NAME',
      'lovebud-recovery-encryption': 'RECOVERY_ENCRYPTION_SECRET_NAME',
    }[secretName];
    assert.ok(APP.includes(`${constantFor} = '${secretName}'`) || APP.includes(`${constantFor} = "${secretName}"`), `constant ${constantFor} must carry ${secretName}`);
    assert.ok(APP.includes(`modal.Secret.from_name(${constantFor})`), `modal.Secret.from_name(${constantFor}) binding required`);
  }
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
  const retryScope = APP.slice(APP.indexOf('def _retry_object'), APP.indexOf('def _drive_filename'));
  assert.ok(!retryScope.includes('pg_dump'), 'pg_dump is outside the retry helper');
});

test('7. DB URL never placed in pg_dump argv', () => {
  const dumpDef = APP.slice(APP.indexOf('def _run_dump'), APP.indexOf('def _is_non_empty'));
  assert.ok(!dumpDef.includes('db_url'), 'db_url must not appear in dump helper');
  assert.match(dumpDef, /PGDATABASE/);
  assert.match(dumpDef, /env\s*=\s*child_env/);
  assert.match(dumpDef, /PGCONNECT_TIMEOUT/);
  assert.ok(!dumpDef.includes('DRIVE_CLIENT') && !dumpDef.includes('RECOVERY_ENCRYPTION_KEY'), 'no secret inherited into child env');
});

test('8. streaming single-envelope AEAD (version + nonce + ciphertext + one final tag)', () => {
  // The LBBA1 envelope authority lives in the shared stream module (restore child
  // refactor); the backup app must delegate to it without duplicating cipher code.
  assert.match(STREAM, /cryptography\.hazmat\.primitives\.ciphers/);
  assert.match(STREAM, /Cipher\(\s*algorithms\.AES\(key\),\s*modes\.GCM\(nonce\)\s*\)\.encryptor\(\)/);
  assert.match(STREAM, /encryptor\.finalize\(\)/);
  assert.match(STREAM, /encryptor\.tag/);
  assert.match(STREAM, /STREAM_AEAD_VERSION/);
  assert.equal((STREAM.match(/dst\.write\(STREAM_AEAD_VERSION\)/g) || []).length, 1, 'version written exactly once');
  assert.equal((STREAM.match(/dst\.write\(nonce\)/g) || []).length, 1, 'nonce written exactly once');
  assert.equal((STREAM.match(/dst\.write\(encryptor\.tag\)/g) || []).length, 1, 'single final authentication tag');
  assert.ok(!/dst\.write\(ciphertext\[-16:\]\)/.test(STREAM), 'no duplicate tag write');
  // the backup app delegates to the shared module
  assert.match(APP, /from modal_compute\.recovery_backup_stream import/);
  assert.match(APP, /streaming_encrypt\(plain_path, enc_path, key, nonce\)/);
  // no duplicated Cipher construction remains in the backup app
  assert.ok(!/algorithms\.AES\(key\)/.test(APP), 'cipher construction must live only in the stream module');
});

test('9. chunked streaming encrypt: no whole-file read', () => {
  const encBlock = STREAM.slice(STREAM.indexOf('def streaming_encrypt'), STREAM.indexOf('def streaming_decrypt'));
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
  const uploadCall = APP.indexOf('staging_file_id = _verified_upload(service, run_key, enc_path)');
  const plaintextRemove = APP.indexOf('os.remove(dump_path)');
  assert.ok(encryptBlock !== -1 && plaintextRemove !== -1 && uploadCall !== -1, 'encrypt/remove/upload present');
  assert.ok(plaintextRemove < uploadCall, 'plaintext removed before upload');
});

test('12. resumable streaming upload: fresh file cursor per attempt, no whole-file read', () => {
  const attemptBlock = DRIVE.slice(DRIVE.indexOf('def _resumable_upload_attempt'), DRIVE.indexOf('def verify_uploaded_file'));
  assert.match(attemptBlock, /with open\(enc_path,\s*["']rb["']\) as body:/);
  assert.match(attemptBlock, /data\s*=\s*body/);
  assert.ok(!/body\.read\(\)/.test(attemptBlock), 'no whole-file read upload');
  assert.match(DRIVE, /["']uploadType["']:\s*["']resumable["']/);
  assert.match(DRIVE, /def create_encrypted_file/);
  assert.match(APP, /drive_create_file/);
});

test('13. files.get verification requires size + format metadata + app-owned location, never file id alone', () => {
  const verifyBlock = DRIVE.slice(DRIVE.indexOf('def verify_uploaded_file'), DRIVE.indexOf('def copy_file'));
  assert.match(verifyBlock, /actual_size\s*==\s*expected_size/);
  assert.match(verifyBlock, /format-version/);
  assert.match(verifyBlock, /content-kind/);
  assert.match(verifyBlock, /retention-tier/);
  assert.match(verifyBlock, /trashed/);
  assert.match(verifyBlock, /backup_root in parents/);
  assert.ok(!/etag[\s\S]{0,80}return\s+True/i.test(verifyBlock), 'etag alone must not decide success');
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
  assert.match(promotionSection, /drive_copy_file/);
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
  assert.ok(!/print\([^)]*(access_key|secret_key|refresh_token|client_secret|DRIVE_)/.test(APP), 'no credential logging');
  assert.ok(!/print\([^)]*(run_key|run_stamp|uuid|file_id)/.test(APP), 'no run-key/file-id logging');
  const logCalls = APP.match(/_log_phase\((['"])([^'"]+)\1\)/g) || [];
  assert.ok(logCalls.length >= 5, 'phase-only logging used');
  for (const call of logCalls) {
    assert.ok(/^_log_phase\((['"])([a-z_]+)\1\)$/.test(call), 'log call is a literal phase label only');
  }
  // Drive adapter must not log credentials either
  assert.ok(!/print\([^)]*(refresh_token|client_secret|access_token|file_id)/.test(DRIVE), 'no Drive credential/file-id logging');
});

test('21. no restore/reset/branch operations in the backup path', () => {
  assert.ok(!/restoreSnapshot|finalize_restore|\.restore\(|create_branch|delete_branch|reset_branch/.test(APP), 'no restore/reset/branch operation in backup app');
  assert.ok(!/\breset\b/.test(APP), 'no reset operation in backup app');
  assert.ok(!/snapshot/.test(APP), 'no snapshot mutation in backup app');
  // The Drive adapter implements exactly one bounded restore-oriented download
  // primitive (restore source child #3460); it must remain restore-limited: no
  // generic downloader, no export/media helpers beyond the bounded artifact path.
  const driveFns = DRIVE.slice(DRIVE.indexOf('def build_drive_service'));
  const downloadFns = (driveFns.match(/def\s+(download_recovery_artifact|_preflight_download_metadata|_parse_drive_size)/g) || []);
  assert.ok(downloadFns.length === 3, 'exactly the bounded download primitives: ' + JSON.stringify(downloadFns));
  assert.ok(!/def\s+restore|def\s+get_media|def\s+export/.test(driveFns), 'no generic restore/get_media/export helper in Drive adapter');
});

test('22. policy module purity: no forbidden imports or env/network access', () => {
  assert.ok(!/^\s*(import|from)\s+modal\b/m.test(POLICY), 'policy must not import modal');
  assert.ok(!/^\s*(import|from)\s+boto3\b/m.test(POLICY), 'policy must not import boto3');
  assert.ok(!/^\s*(import|from)\s+botocore\b/m.test(POLICY), 'policy must not import botocore');
  assert.ok(!/^\s*(import|from)\s+cryptography\b/m.test(POLICY), 'policy must not import cryptography');
  assert.ok(!/^\s*(import|from)\s+psycopg\b/m.test(POLICY), 'policy must not import psycopg');
  assert.ok(!/^\s*(import|from)\s+requests\b/m.test(POLICY), 'policy must not import requests');
  assert.ok(!/^\s*import\s+subprocess\b/m.test(POLICY), 'policy must not import subprocess');
  assert.ok(!/os\.environ/.test(POLICY), 'policy must not access environment variables (docstrings included)');
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

// --- #3894 Drive-specific source boundaries --------------------------------

test('24. Drive OAuth offline refresh-token boundary (no browser login, no password, drive.file scope)', () => {
  assert.match(DRIVE, /def _exchange_refresh_token/);
  assert.match(DRIVE, /grant_type["']?\s*[:=]\s*["']refresh_token["']/);
  assert.match(DRIVE, /DRIVE_SCOPE\s*=\s*['"]https:\/\/www\.googleapis\.com\/auth\/drive\.file['"]/);
  // no browser-login automation IMPLEMENTED (check code, not docstrings that document the absence)
  const driveCode = DRIVE.slice(DRIVE.indexOf('def build_drive_service'));
  assert.ok(!/selenium|playwright|webdriver|\.click\(|find_element/.test(driveCode), 'no browser automation code in Drive adapter');
  assert.ok(!/google_password|os\.environ\[.*PASSWORD/.test(driveCode), 'no Google password read in Drive adapter code');
  // ChatGPT connector token must not be referenced as a credential source
  assert.ok(!/chatgpt_token|openai_token|connector_token/.test(DRIVE), 'no ChatGPT connector token usage');
});

test('24b. Drive client secret is optional; required id/refresh-token/root enforced', () => {
  const secretsFn = DRIVE.slice(DRIVE.indexOf('def drive_secrets_present'), DRIVE.indexOf('def _retry_drive'));
  assert.match(secretsFn, /DRIVE_CLIENT_ID_ENV/);
  assert.match(secretsFn, /DRIVE_REFRESH_TOKEN_ENV/);
  assert.match(secretsFn, /DRIVE_BACKUP_ROOT_ENV/);
  assert.ok(!/DRIVE_CLIENT_SECRET_ENV/.test(secretsFn), 'client secret must NOT be in the required set (optional per selected client type)');
  const exch = DRIVE.slice(DRIVE.indexOf('def _exchange_refresh_token'), DRIVE.indexOf('def build_drive_service'));
  assert.match(exch, /os\.environ\.get\(DRIVE_CLIENT_SECRET_ENV\)/, 'client secret read without a default value');
  assert.ok(!/get\(DRIVE_CLIENT_SECRET_ENV,\s*["']/.test(exch), 'client secret must not be defaulted to an empty value');
});

test('25. Drive scope not broadened beyond drive.file', () => {
  assert.ok(!/drive\.read|drive\.appdata|drive\.metadata|drive\.full/.test(DRIVE), 'no broadened Drive scope');
  assert.ok(!/www\.googleapis\.com\/auth\/drive["']\s/.test(DRIVE), 'no full Drive scope');
  assert.ok(!/www\.googleapis\.com\/auth\/drive\b(?!\.file)/.test(DRIVE), 'no bare /drive scope');
});

test('26. no real OAuth request in source tests', () => {
  const behaviorPath = path.join(ROOT, 'tests', 'contracts', 'database-external-logical-backup-behavior-contract.test.cjs');
  const behavior = fs.readFileSync(behaviorPath, 'utf8');
  assert.ok(!/oauth2\.googleapis|googleapis\.com\/drive/.test(behavior), 'no real Google endpoint in behavior test');
  // Drive authority URLs must live only as module-level symbolic constants; the
  // runtime request code must reference the constants, never hard-coded literals.
  assert.match(DRIVE, /DRIVE_TOKEN_URL\s*=\s*['"]https:\/\/oauth2\.googleapis\.com\/token['"]/);
  assert.match(DRIVE, /DRIVE_UPLOAD_BASE\s*=\s*['"]https:\/\/www\.googleapis\.com\/upload\/drive\/v3['"]/);
  const runtimeCode = DRIVE.slice(DRIVE.indexOf('def _exchange_refresh_token'));
  assert.ok(!/https:\/\/oauth2\.googleapis\.com\/token/.test(runtimeCode), 'token URL literal must not appear in runtime code (use constant)');
  assert.ok(!/https:\/\/www\.googleapis\.com\/drive/.test(runtimeCode), 'API base literal must not appear in runtime code (use constants)');
});

test('27. Drive auth failure fails closed (DRIVE_AUTH_UNAVAILABLE, zero upload)', () => {
  assert.match(POLICY, /DRIVE_AUTH_UNAVAILABLE/);
  assert.match(DRIVE, /return DRIVE_AUTH_UNAVAILABLE/);
  assert.match(DRIVE, /def preflight_storage_quota/);
});

test('28. quota fetched before upload (about.get total account usage)', () => {
  assert.match(DRIVE, /\/about/);
  assert.match(DRIVE, /storageQuota/);
  assert.match(DRIVE, /def preflight_storage_quota/);
  assert.match(APP, /_quota_allows_upload/);
  assert.match(APP, /drive_preflight_quota/);
  // quota preflight must run before files.create within the verified upload function
  const uploadFn = APP.slice(APP.indexOf('def _verified_upload'), APP.indexOf('@app.function'));
  const quotaCallPos = uploadFn.indexOf('_quota_allows_upload');
  const createCallPos = uploadFn.indexOf('drive_create_file');
  assert.ok(quotaCallPos !== -1 && createCallPos !== -1 && quotaCallPos < createCallPos, 'quota checked before create within upload function');
});

test('29. 0.90 internal hard ceiling with at least 10% reserved', () => {
  assert.match(POLICY, /INTERNAL_CEILING_RATIO\s*=\s*0\.90/);
  assert.match(POLICY, /def classify_drive_quota/);
  assert.match(POLICY, /int\(limit_bytes\s*\*\s*ceiling_ratio\)/);
  assert.match(POLICY, /DRIVE_STORAGE_WITHIN_LIMIT/);
  assert.match(POLICY, /DRIVE_STORAGE_NEAR_LIMIT/);
  assert.match(POLICY, /DRIVE_STORAGE_EXHAUSTED/);
});

test('30. insufficient quota -> zero upload (EXHAUSTED fail closed)', () => {
  assert.match(DRIVE, /DRIVE_STORAGE_EXHAUSTED/);
  assert.match(DRIVE, /DRIVE_STORAGE_WITHIN_LIMIT/);
  // EXHAUSTED path in _quota_allows_upload returns False (zero upload)
  const quotaFn = APP.slice(APP.indexOf('def _quota_allows_upload'), APP.indexOf('def _verified_upload'));
  assert.match(quotaFn, /return False/);
  assert.match(quotaFn, /quota_exhausted/);
});

test('31. missing/unparseable quota fails closed', () => {
  const classifyFn = POLICY.slice(POLICY.indexOf('def classify_drive_quota'), POLICY.indexOf('def _require_bucket'));
  assert.match(classifyFn, /return DRIVE_STORAGE_EXHAUSTED/);
  assert.ok(/not isinstance\(usage_bytes/.test(classifyFn) || /usage_bytes.*None/.test(classifyFn), 'missing usage fails closed');
  assert.ok(/not isinstance\(limit_bytes/.test(classifyFn) || /limit_bytes.*None/.test(classifyFn), 'missing limit fails closed');
});

test('32. no exact quota byte values in logs/status', () => {
  assert.ok(!/print\([^)]*\d{6,}/.test(DRIVE), 'no large byte literals logged');
  assert.ok(!/print\([^)]*limit_bytes|print\([^)]*usage_bytes/.test(DRIVE), 'no quota byte values logged');
});

test('33. upload verification before promotion (DRIVE_UPLOAD_UNVERIFIED on failure)', () => {
  assert.match(POLICY, /DRIVE_UPLOAD_UNVERIFIED/);
  assert.match(DRIVE, /def verify_uploaded_file/);
  assert.match(APP, /drive_verify_file/);
  // daily promotion only proceeds after upload + verify
  const dailyBlock = APP.slice(APP.indexOf('# 9. daily promotion'), APP.indexOf('# 10'));
  assert.ok(dailyBlock.indexOf('daily_ok = True') > dailyBlock.indexOf('drive_copy_file'), 'daily ok set after copy');
});

test('34. no cross-provider fallback (R2/Oracle/B2 never targeted on Drive failure)', () => {
  assert.ok(!/fallback|r2|oracle|backblaze|b2/.test(APP.toLowerCase()), 'no cross-provider fallback in app');
  // Drive adapter runtime code (after the docstring) must not target fallback providers
  const driveCode = DRIVE.slice(DRIVE.indexOf('def build_drive_service'));
  assert.ok(!/boto3|s3\.client|r2_endpoint|oracle|backblaze/.test(driveCode), 'no fallback provider client in Drive adapter runtime code');
});

test('35. Drive receives encrypted files only; opaque artifact identity', () => {
  assert.match(DRIVE, /encrypted-postgresql-dump/);
  // metadata-writing code must not include private identifiers
  const metaCode = DRIVE.slice(DRIVE.indexOf('DRIVE_OBJECT_METADATA'), DRIVE.indexOf('def drive_secrets_present'));
  assert.ok(!/database_name|db_host|database_url|hostname/.test(metaCode), 'no private db identifiers in Drive metadata constants');
  // the appProperties written in create_encrypted_file must contain only bounded fields
  const createFn = DRIVE.slice(DRIVE.indexOf('def create_encrypted_file'), DRIVE.indexOf('def _resumable_upload_attempt'));
  assert.match(createFn, /format-version/);
  assert.match(createFn, /content-kind/);
  assert.match(createFn, /retention-tier/);
  assert.match(createFn, /run-identity/);
  assert.ok(!/database_name|db_host|database_url|hostname|tree_id|memory_id/.test(createFn), 'no private identifiers in create metadata');
});

test('36. no public/shared Drive permissions', () => {
  // no permission/share API calls IMPLEMENTED (check runtime code, not docstrings)
  const driveCode = DRIVE.slice(DRIVE.indexOf('def build_drive_service'));
  assert.ok(!/\/permissions|createPermission|\/shares|public/.test(driveCode), 'no public/share/permission mutation API calls');
});

test('37. no arbitrary Drive listing; app-owned scoped listing only', () => {
  assert.match(DRIVE, /def list_tier_files/);
  assert.match(DRIVE, /backup_root.*parents/);
  assert.match(DRIVE, /appProperties/);
  assert.ok(!/list\(\s*\)/.test(DRIVE.slice(DRIVE.indexOf('def list_tier_files'))), 'no unscoped listing');
});

test('38. app-owned-only delete; newest valid daily protected', () => {
  assert.match(DRIVE, /def delete_file/);
  assert.match(DRIVE, /def select_retention_deletions/);
  assert.match(DRIVE, /keep_count < 1/);
  assert.match(DRIVE, /raise ValueError/);
  assert.match(APP, /RETENTION_DAILY_KEEP/);
  assert.match(APP, /RETENTION_WEEKLY_KEEP/);
  assert.match(APP, /RETENTION_MONTHLY_KEEP/);
  assert.match(APP, /drive_select_deletions/);
});

test('38b. delete call sites are caller-bounded (staging-created or scoped-list-derived)', () => {
  const deleteCalls = (APP.match(/drive_delete_file\(service,\s*\S+?\)/g) || []);
  assert.ok(deleteCalls.length === 2, 'expected exactly two delete call sites (staging + retention): ' + JSON.stringify(deleteCalls));
  for (const c of deleteCalls) {
    assert.ok(
      /drive_delete_file\(service,\s*staging_file_id\)/.test(c) ||
        /drive_delete_file\(service,\s*_expired_id\)/.test(c),
      'delete call site must be staging-created or scoped-list-derived: ' + c
    );
  }
});

test('39. explicit runtime activation gate is the sole execution authority', () => {
  // #3460 decoupling child: the activation gate is the first check in the
  // execution body and precedes every side-effecting operation.
  const bodyStart = APP.indexOf('def run_logical_backup');
  const body = APP.slice(bodyStart);
  assert.match(APP, /RUNTIME_ACTIVATION_ENV\s*=\s*RUNTIME_ACTIVATION_ENV/);
  assert.match(APP, /_runtime_activated\(\)/);
  assert.match(body, /_runtime_activated\(\)/);
  const gatePos = body.indexOf('_runtime_activated()');
  const dumpPos = body.indexOf('_run_dump(');
  const drivePos = body.indexOf('_drive_client()');
  const encryptPos = body.indexOf('_streaming_encrypt(');
  assert.ok(gatePos !== -1, 'gate check present in body');
  assert.ok(dumpPos === -1 || gatePos < dumpPos, 'gate check precedes pg_dump');
  assert.ok(drivePos === -1 || gatePos < drivePos, 'gate check precedes Drive client construction');
  assert.ok(encryptPos === -1 || gatePos < encryptPos, 'gate check precedes encryption');
});

// --- #3460 deploy/schedule decoupling (runtime activation gate) ---

test('43. runtime activation vocabulary exists and is fail-closed by design', () => {
  assert.match(POLICY, /RUNTIME_ACTIVATION_ENV\s*=\s*["']LB_RECOVERY_BACKUP_RUNTIME["']/);
  assert.match(POLICY, /RUNTIME_ACTIVATION_DISABLED\s*=\s*["']disabled["']/);
  assert.match(POLICY, /RUNTIME_ACTIVATION_SCHEDULED\s*=\s*["']scheduled["']/);
  assert.match(POLICY, /BACKUP_RUNTIME_DISABLED\s*=\s*["']BACKUP_RUNTIME_DISABLED["']/);
  // pure classifier: only the exact "scheduled" value enables
  assert.match(POLICY, /def classify_runtime_activation/);
  const cls = POLICY.slice(POLICY.indexOf('def classify_runtime_activation'));
  assert.match(cls, /raw_value == RUNTIME_ACTIVATION_SCHEDULED/);
  assert.match(cls, /return BACKUP_RUNTIME_DISABLED/);
});

test('44. inert disabled status is sanitized and produced by the app path', () => {
  assert.match(APP, /_runtime_disabled_status/);
  const fn = APP.slice(APP.indexOf('def _runtime_disabled_status'));
  assert.match(fn, /make_sanitized_status/);
  assert.match(fn, /phase\s*=\s*["']runtime_activation["']/);
  // the disabled phase is an allowed policy phase
  assert.match(POLICY, /["']runtime_activation["']/);
  // disabled path emits no secret/gate raw value (sanitized status keys only)
  assert.ok(!/make_sanitized_status\([^)]*gate/i.test(APP), 'gate raw value never enters status');
});

test('45. gate-check failure fails closed; no checked-in activation value exists', () => {
  const bodyStart = APP.indexOf('def run_logical_backup');
  const body = APP.slice(bodyStart);
  // exception during the activation check must disable, never enable
  const gateBlock = body.slice(body.indexOf('# 0. explicit runtime activation gate'));
  assert.match(gateBlock, /except Exception:/);
  assert.match(gateBlock, /activated\s*=\s*False/);
  // no committed activation value anywhere in source
  assert.ok(!/LB_RECOVERY_BACKUP_RUNTIME\s*=\s*["']scheduled["']/.test(APP), 'no checked-in scheduled activation');
  assert.ok(!/LB_RECOVERY_BACKUP_RUNTIME\s*=\s*["']scheduled["']/.test(POLICY), 'no checked-in scheduled activation in policy');
});

test('40. sanitized status only; raw provider error never escapes', () => {
  assert.match(DRIVE, /raise RuntimeError/);
  assert.ok(!/return.*error|return.*exception/i.test(DRIVE), 'no raw error returned from Drive adapter');
  assert.match(APP, /_log_phase\(["']upload_or_verification_failed["']\)/);
});

test('41. Drive adapter module imports policy states (provider logic separated)', () => {
  assert.match(DRIVE, /from modal_compute\.recovery_backup_policy import/);
  assert.match(DRIVE, /DRIVE_STORAGE_WITHIN_LIMIT/);
  assert.match(DRIVE, /DRIVE_STORAGE_EXHAUSTED/);
  assert.match(DRIVE, /classify_drive_quota/);
});

test('42. backup path stays download-free; restore download exists only in the bounded restore primitive', () => {
  // The backup app must never download: its Drive usage remains upload/verify/copy/list/delete only.
  assert.ok(!/alt=media|get_media|export_link|download/.test(APP), 'no download in the backup app path');
  // The bounded restore download primitive is the only media path in the adapter.
  const downloadFn = DRIVE.slice(DRIVE.indexOf('def download_recovery_artifact'));
  assert.match(downloadFn, /alt=media/);
  assert.match(downloadFn, /stream=True/);
  assert.match(downloadFn, /iter_content/);
  assert.match(downloadFn, /max_bytes/);
  // no generic downloader: media fetch appears exactly once in the adapter
  assert.equal((DRIVE.match(/alt=media/g) || []).length, 1, 'exactly one bounded media download site');
});
