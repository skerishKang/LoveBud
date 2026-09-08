/**
 * #3460 isolated restore-source contract — static source analysis.
 *
 * Refs #3460 (restore-drill policy parent). Provider parents #3894 / #4137.
 *
 * Statically proves the source-only isolated-restore boundaries WITHOUT executing
 * any live operation (no provider, Google, Drive, Modal, DB, pg_restore, subprocess,
 * network, or filesystem mutation). The sibling behavior contract executes only the
 * pure policy module and deterministic injected seams.
 *
 * This contract establishes the architectural posture:
 *
 *   RESTORE_TARGET = EXPLICIT_ISOLATED_TARGET_ONLY
 *   DEFAULT_PRODUCTION_TARGET = NONE
 *   AUTOMATIC_TARGET_DISCOVERY = FORBIDDEN
 *   PRODUCTION_DATABASE_URL_FALLBACK = FORBIDDEN
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RESTORE_PATH = path.join(ROOT, 'modal_compute', 'recovery_restore_app.py');
const DRIVE_PATH = path.join(ROOT, 'modal_compute', 'recovery_drive_storage.py');
const POLICY_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_policy.py');
const STREAM_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_stream.py');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');

const RESTORE = fs.readFileSync(RESTORE_PATH, 'utf8');
const DRIVE = fs.readFileSync(DRIVE_PATH, 'utf8');
const POLICY = fs.readFileSync(POLICY_PATH, 'utf8');
const STREAM = fs.readFileSync(STREAM_PATH, 'utf8');

test('1. restore operator is a non-HTTP, non-scheduled, Modal-free source path', () => {
  assert.ok(!/modal\.App\(|@modal\.function|modal\.Period\(/.test(RESTORE), 'no Modal app/function/schedule');
  assert.ok(!/@modal\.asgi_app|@modal\.web_endpoint/.test(RESTORE), 'no HTTP endpoint');
  assert.ok(!/from\s+fastapi\s+import|import\s+fastapi|FastAPI\(/.test(RESTORE), 'no FastAPI');
  assert.ok(!/from\s+flask\s+import|import\s+flask|Flask\(/.test(RESTORE), 'no Flask');
  assert.ok(!/webhook|@app\.web_endpoint/.test(RESTORE), 'no webhook/browser trigger');
  const importedModules = RESTORE.match(/^import\s+(\w+)|^from\s+(\w+)\s+import/gm) || [];
  for (const imp of importedModules) {
    assert.ok(!/modal|fastapi|flask|psycopg|requests/.test(imp), 'no forbidden import: ' + imp);
  }
});

test('2. restore operator is never imported by the public app or functions surface', () => {
  const appPath = path.join(ROOT, 'modal_compute', 'app.py');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.ok(!/recovery_restore_app|recovery_restore/.test(app), 'public app must not import restore operator');
  const glob = require('node:child_process').execSync(
    "grep -rIl 'recovery_restore_app' functions 2>/dev/null || true",
    { encoding: 'utf8', cwd: ROOT }
  );
  assert.equal(glob.trim(), '', 'functions/** must not import restore operator');
});

test('3. import-hermetic policy: no env/network/subprocess at module scope', () => {
  assert.ok(!/^os\.environ/m.test(RESTORE), 'no unindented env access at import scope');
  assert.ok(!/requests\.|urllib|http\.client/.test(RESTORE), 'no network client import');
  assert.ok(!/^import\s+subprocess|^from\s+subprocess/m.test(RESTORE), 'no subprocess import at module scope');
  assert.ok(!/^import\s+psycopg|^from\s+psycopg/.test(RESTORE), 'no psycopg import');
  assert.ok(!/^import\s+requests|^from\s+requests/.test(RESTORE), 'no requests import at module scope');
  assert.ok(!/^import\s+modal|^from\s+modal/.test(RESTORE), 'no modal import at module scope');
  // dependencies are injected or lazily imported inside call functions only
  assert.ok(!/cryptography\.|from cryptography/.test(RESTORE), 'no cryptography import at module scope');
});

test('4. restore-only target authority: explicit isolated target only', () => {
  // the symbolic target boundary must exist and must be restore-only
  assert.match(RESTORE, /RESTORE_TARGET_SECRET_NAME\s*=\s*['\"]lovebud-recovery-restore-target['\"]/);
  assert.match(RESTORE, /RESTORE_TARGET_CLASS_ENV\s*=\s*['\"]RESTORE_TARGET_CLASS['\"]/);
  assert.match(RESTORE, /RESTORE_TARGET_URL_ENV\s*=\s*['\"]RESTORE_TARGET_DATABASE_URL['\"]/);
  assert.match(RESTORE, /ALLOWED_RESTORE_TARGET_CLASSES\s*=\s*frozenset\(\s*\(\s*RESTORE_TARGET_CLASS_ISOLATED,\s*\)\s*\)/);
});

test('5. Production credential names can never be the restore target source', () => {
  // canonical Product credential names must be rejected as restore-target sources
  assert.match(POLICY, /FORBIDDEN_RESTORE_TARGET_CREDENTIAL_NAMES/);
  assert.match(POLICY, /LOVE_PLATFORM_DATABASE_URL/);
  assert.match(POLICY, /LOVE_PLATFORM_WRITE_DATABASE_URL/);
  assert.match(POLICY, /DATABASE_URL/);
  // classify_restore_target must fail closed on forbidden/present names
  assert.match(POLICY, /def classify_restore_target/);
  assert.match(POLICY, /forbidden_credential_names_present/);
  assert.match(POLICY, /return RESTORE_TARGET_INVALID/);
  // the backup source DB URL must never be silently reused as the restore target
  assert.match(POLICY, /source_db_url_present/);
});

test('6. missing or ambiguous restore target fails closed (STOP)', () => {
  const classifyStart = POLICY.indexOf('def classify_restore_target');
  const classify = POLICY.slice(classifyStart, PolicyIndexOfReject(POLICY));
  assert.match(classify, /not restore_target_url_present/);
  assert.match(classify, /return RESTORE_TARGET_INVALID/);
  assert.match(classify, /restore_target_class\s*!=\s*RESTORE_TARGET_CLASS_ISOLATED/);
  // the operator must refuse to proceed before any download when target invalid
  assert.match(RESTORE, /classify_current_target\(\)/);
  assert.match(RESTORE, /RESTORE_TARGET_INVALID/);
});

test('7. Drive download accepts only app-owned recovery artifacts with metadata verification', () => {
  const downloadFn = DRIVE.slice(DRIVE.indexOf('def _preflight_download_metadata'));
  assert.match(downloadFn, /def _preflight_download_metadata/);
  assert.match(downloadFn, /backup_root in parents/);
  assert.match(downloadFn, /format-version/);
  assert.match(downloadFn, /content-kind/);
  assert.match(downloadFn, /retention-tier/);
  assert.match(downloadFn, /trashed/);
  assert.match(downloadFn, /DRIVE_RESTORE_ACCEPT_RETENTION_TIERS/);
  assert.ok(!/def\s+browse|def\s+list\s*\(|def\s+export/.test(downloadFn), 'no generic downloader');
});

test('8. download is streamed and bounded by max_bytes, never generically unbounded', () => {
  const downloadFn = DRIVE.slice(DRIVE.indexOf('def download_recovery_artifact'));
  assert.match(downloadFn, /stream=True/);
  assert.match(downloadFn, /iter_content/);
  assert.match(downloadFn, /max_bytes/);
  assert.match(downloadFn, /written\s*>\s*max_bytes/);
  assert.equal((DRIVE.match(/alt=media/g) || []).length, 1, 'exactly one media download site');
});

test('9. LBBA1 AEAD preserved; authenticated decryption required before restore', () => {
  assert.match(STREAM, /STREAM_AEAD_VERSION\s*=\s*b["']LBBA1["']/);
  assert.match(STREAM, /modes\.GCM\(nonce/);
  assert.match(STREAM, /def streaming_decrypt/);
  assert.match(STREAM, /decryptor\.finalize\(\)/);
  assert.match(RESTORE, /streaming_decrypt/);
  assert.match(RESTORE, /RESTORE_ARTIFACT_INVALID/);
  // invalid envelope / AEAD auth failure must fail closed before pg_restore
  assert.match(RESTORE, /_plain_artifact_valid/);
  assert.match(RESTORE, /STREAM_AEAD_HEADER_BYTES/);
  assert.match(RESTORE, /b["']LBBA1["']/);
});

test('10. pg_restore boundary: no destructive flags, no blind retry', () => {
  assert.match(RESTORE, /--no-owner/);
  assert.match(RESTORE, /--no-privileges/);
  assert.ok(!/--clean/.test(RESTORE), 'no --clean flag');
  assert.ok(!/--create/.test(RESTORE), 'no --create flag');
  assert.ok(!/DROP\s+DATABASE|DROP\s+SCHEMA/.test(RESTORE), 'no DROP DATABASE/SCHEMA');
  assert.ok(!/drop-db|drop-schema/.test(RESTORE), 'no drop flags');
  // single attempt only: no retry loop around pg_restore
  assert.ok(!/for\s+attempt\s+in\s+range\(/.test(RESTORE), 'no retry loop');
});

test('11. no HTTP endpoint, no schedule, no Modal deploy in the restore path', () => {
  // assert on actual API invocation forms only (docstrings may mention the words)
  assert.ok(!/@modal|modal\.App\(|Modal\(/.test(RESTORE), 'no Modal app construction');
  assert.ok(!/modal\.Period\(|@modal\.function|schedule\s*=|cron/.test(RESTORE), 'no schedule API');
  assert.ok(!/@modal\.web_endpoint|asgi_app|http\.server|FastAPI\(|Flask\(/.test(RESTORE), 'no HTTP surface API');
});

test('12. sanitized status only; raw provider/DB/secret errors never escape', () => {
  assert.match(POLICY, /ALLOWED_RESTORE_STATUS_KEYS/);
  assert.match(POLICY, /make_restore_status/);
  const restoreFn = RESTORE.slice(RESTORE.indexOf('def run_isolated_restore'));
  assert.ok(!/print\([^)]*(stderr|error|exception|token|DATABASE_URL|file_id)/.test(restoreFn), 'no raw details logged');
  assert.ok(!/str\(e\)|repr\(e\)|traceback/.test(restoreFn), 'no exception serialization');
  assert.ok(!/return\s+.*(stderr|exception|error)/.test(restoreFn), 'no raw error returned');
  // the restore status vocabulary is fixed
  for (const state of [
    'RESTORE_SOURCE_READY',
    'RESTORE_AUTH_UNAVAILABLE',
    'RESTORE_ARTIFACT_NOT_FOUND',
    'RESTORE_ARTIFACT_INVALID',
    'RESTORE_TARGET_INVALID',
    'RESTORE_COMMAND_FAILED',
    'RESTORE_VERIFICATION_FAILED',
    'RESTORE_CLEANUP_FAILED',
    'RESTORE_SUCCESS',
  ]) {
    assert.ok(POLICY.includes(state), 'missing restore state ' + state);
  }
});

test('13. bounded structural verification categories; no Product counts/identifiers', () => {
  for (const v of [
    'RESTORED_SCHEMA_PRESENT',
    'EXPECTED_CRITICAL_RELATIONS_PRESENT',
    'REPRESENTATIVE_RELATIONAL_INVARIANTS_PASS',
    'RESTORE_VERIFICATION_FAILED',
  ]) {
    assert.ok(POLICY.includes(v), 'missing verification category ' + v);
  }
  assert.match(POLICY, /def evaluate_restore_verification/);
  assert.ok(!/SELECT\s+COUNT|row_count|count\(\*\)/.test(RESTORE), 'no real row-count SQL');
});

test('14. strict temp cleanup on every exit path', () => {
  const cleanup = RESTORE.slice(RESTORE.indexOf('finally:'));
  assert.match(cleanup, /os\.remove\(enc_path\)/);
  assert.match(cleanup, /os\.remove\(plain_path\)/);
  assert.match(cleanup, /shutil\.rmtree\(owned_workdir\)/);
  assert.match(cleanup, /cleanup_failed/);
  assert.match(cleanup, /RESTORE_CLEANUP_FAILED/);
  assert.ok(!/ignore_errors\s*=\s*True/.test(cleanup), 'cleanup failures must not be suppressed');
});

test('15. classification registry: restore source contract registered exactly once', () => {
  const registry = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const matches = registry.entries.filter(
    (e) => e.path === 'tests/contracts/database-recovery-isolated-restore-source-contract.test.cjs'
  );
  assert.equal(matches.length, 1, 'must be registered exactly once');
  assert.equal(matches[0].layer, 'SOURCE_STATIC');
});

function PolicyIndexOfReject(policy) {
  const idx = policy.indexOf('def reject_impossible_partial');
  return idx === -1 ? policy.length : idx;
}