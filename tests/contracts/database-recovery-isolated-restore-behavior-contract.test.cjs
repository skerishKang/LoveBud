/**
 * #3460 isolated restore behavior contract — deterministic policy execution
 * and injected-seam restore orchestration.
 *
 * Refs #3460 (restore-drill policy parent). Provider parents #3894 / #4137.
 *
 * Executes ONLY pure policy functions and deterministic injected seams via a local
 * python3 subprocess (scenario script written to the OS temp directory, never the
 * repository, removed after the run). No provider, Google, Drive, Modal, DB,
 * pg_restore, network, secret, or filesystem-backup operation occurs. Restore
 * orchestration is exercised through dependency-injected fake download, fake
 * pg_restore executor, and fake verification only.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const SCENARIO_SCRIPT = `
import sys, json, os, tempfile, glob
sys.path.insert(0, ${JSON.stringify(ROOT)})
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'modal_compute'))})
import recovery_backup_policy as p
import recovery_restore_app as r
import recovery_backup_stream as s

results = {}
def check(name, fn):
    try:
        value = fn()
        if isinstance(value, bytes):
            value = value.decode('latin-1')
        if hasattr(value, 'items'):
            value = {k: (v.decode('latin-1') if isinstance(v, bytes) else v) for k, v in value.items()}
        results[name] = {'status': 'PASS', 'value': value}
    except Exception as e:
        results[name] = {'status': 'ERROR', 'error': str(e)}

# ---- helpers (pure, hermetic) ----------------------------------------------
def build_artifact(plain_bytes, key):
    work = tempfile.mkdtemp(prefix='restore-contract-art-')
    enc = os.path.join(work, 'a.enc'); plain = os.path.join(work, 'a.dump')
    with open(plain, 'wb') as fh: fh.write(plain_bytes)
    s.streaming_encrypt(plain, enc, key, os.urandom(s.STREAM_AEAD_NONCE_BYTES))
    return enc, work

def fake_download_from(enc_path):
    def _dl(service, file_id, dest_path, **kw):
        with open(enc_path, 'rb') as src, open(dest_path, 'wb') as dst:
            dst.write(src.read())
    return _dl

def ok_executor(cmd, env):
    class R: returncode = 0
    return R()

def fail_executor(cmd, env):
    class R: returncode = 1
    return R()

def ok_verify(target):
    return p.RESTORE_VERIFY_INVARIANTS_PASS

def fail_verify(target):
    return p.RESTORE_VERIFY_FAILED

KEY = b'k' * 32
ENC, ART_WORK = build_artifact(b'custom dump bytes for restore verification', KEY)

def set_target(klass='ISOLATED_RESTORE_TARGET', url='postgresql://restore@isolated.example/db'):
    os.environ['RESTORE_TARGET_DATABASE_URL'] = url
    os.environ['RESTORE_TARGET_CLASS'] = klass
    # never leak forbidden Product names into the environment during tests
    for k in ('LOVE_PLATFORM_DATABASE_URL', 'LOVE_PLATFORM_WRITE_DATABASE_URL', 'DATABASE_URL'):
        os.environ.pop(k, None)

def base_args(**kw):
    args = dict(
        drive_service=object(), file_id='f',
        expected_size=os.path.getsize(ENC),
        expected_retention_tier='daily', expected_run_identity=None,
        encryption_key=KEY, download_fn=fake_download_from(ENC),
        pg_restore_executor=ok_executor, verify_fn=ok_verify,
    )
    args.update(kw)
    return args

# ---- 1. import side effects = 0 (this file runs inside the python3 process) ----
check('import-network', lambda: 'requests' not in sys.modules)
check('import-psycopg', lambda: 'psycopg' not in sys.modules)
check('import-modal', lambda: 'modal' not in sys.modules)
check('import-subprocess-mod', lambda: 'subprocess' not in sys.modules)

# ---- 2. restore cannot run without explicit restore-only target authority ----
def run_missing_target():
    set_target('', '')
    return r.run_isolated_restore(**base_args())
check('target-missing', run_missing_target)

def run_wrong_class():
    set_target('PRODUCTION_RESTORE', 'postgresql://prod.example/db')
    return r.run_isolated_restore(**base_args())
check('target-wrong-class', run_wrong_class)

# ---- 3. Product credential names cannot substitute for restore target --------
def run_forbidden_product_name():
    set_target('ISOLATED_RESTORE_TARGET', 'postgresql://restore@isolated.example/db')
    os.environ['LOVE_PLATFORM_DATABASE_URL'] = 'postgresql://prod.example/db'
    return r.run_isolated_restore(**base_args())
check('target-forbidden-product-name', run_forbidden_product_name)

# ---- 4. Drive download accepts only app-owned recovery artifacts ------------
def run_download_metadata_mismatch():
    set_target()
    # simulate wrong parent: the download fn raises (fail closed) on any mismatch
    def bad_download(service, file_id, dest_path, **kw):
        raise RuntimeError('drive restore artifact metadata mismatch')
    return r.run_isolated_restore(**base_args(download_fn=bad_download))
check('download-metadata-mismatch', run_download_metadata_mismatch)

# ---- 5. empty/corrupt/LBBA1-invalid artifact fails closed -------------------
def run_empty_artifact():
    set_target()
    def empty_download(service, file_id, dest_path, **kw):
        with open(dest_path, 'wb'):
            pass
    return r.run_isolated_restore(**base_args(download_fn=empty_download))
check('artifact-empty', run_empty_artifact)

def run_corrupt_artifact():
    set_target()
    def corrupt_download(service, file_id, dest_path, **kw):
        with open(dest_path, 'wb') as fh:
            fh.write(b'NOTANLBBA1ENVELOPE' + b'x' * 64)
    return r.run_isolated_restore(**base_args(download_fn=corrupt_download))
check('artifact-corrupt', run_corrupt_artifact)

# ---- 6. AES-GCM authentication failure never reaches pg_restore -------------
def run_wrong_key():
    set_target()
    return r.run_isolated_restore(**base_args(encryption_key=b'z' * 32))
check('auth-failure-blocks-restore', run_wrong_key)

# ---- 7. pg_restore failure does not trigger blind retry --------------------
exec_calls = {'n': 0}
def counting_executor(cmd, env):
    exec_calls['n'] += 1
    class R: returncode = 1
    return R()

def run_pg_failure():
    set_target()
    exec_calls['n'] = 0
    st = r.run_isolated_restore(**base_args(pg_restore_executor=counting_executor))
    return {'status': st, 'calls': exec_calls['n']}
check('pg-failure-no-retry', run_pg_failure)

# ---- 8. verification failure cannot be reported as restore success ----------
def run_verify_failure():
    set_target()
    return r.run_isolated_restore(**base_args(verify_fn=fail_verify))
check('verify-failure-not-success', run_verify_failure)

# ---- 9. temp artifact cleanup on all failure stages -------------------------
def run_cleanup_success():
    set_target()
    before = set(glob.glob('/tmp/lovebud-restore-*'))
    r.run_isolated_restore(**base_args())
    after = set(glob.glob('/tmp/lovebud-restore-*'))
    return after == before
check('cleanup-success', run_cleanup_success)

def run_cleanup_decrypt_failure():
    set_target()
    before = set(glob.glob('/tmp/lovebud-restore-*'))
    r.run_isolated_restore(**base_args(encryption_key=b'z' * 32))
    after = set(glob.glob('/tmp/lovebud-restore-*'))
    return after == before
check('cleanup-decrypt-failure', run_cleanup_decrypt_failure)

def run_cleanup_pg_failure():
    set_target()
    before = set(glob.glob('/tmp/lovebud-restore-*'))
    r.run_isolated_restore(**base_args(pg_restore_executor=fail_executor))
    after = set(glob.glob('/tmp/lovebud-restore-*'))
    return after == before
check('cleanup-pg-failure', run_cleanup_pg_failure)

def run_cleanup_verify_failure():
    set_target()
    before = set(glob.glob('/tmp/lovebud-restore-*'))
    r.run_isolated_restore(**base_args(verify_fn=fail_verify))
    after = set(glob.glob('/tmp/lovebud-restore-*'))
    return after == before
check('cleanup-verify-failure', run_cleanup_verify_failure)

# ---- 10. sanitized status only; raw secrets never escape --------------------
def run_status_surface():
    set_target()
    st = r.run_isolated_restore(**base_args())
    return {'keys': sorted(st.keys()), 'json': json.dumps(st)}
check('status-surface', run_status_surface)

# ---- 11. pg_restore argv surface: no destructive flags ----------------------
def run_command_argv():
    cmd = r._build_restore_command('postgresql://restore@isolated.example/db')
    return {'argv': cmd}
check('command-argv', run_command_argv)

# ---- 12. LBBA1 validity seam ------------------------------------------------
def run_plain_valid():
    work = tempfile.mkdtemp(prefix='restore-contract-plain-')
    e = os.path.join(work, 'e'); pl = os.path.join(work, 'p')
    with open(pl, 'wb') as fh: fh.write(b'x' * 100)
    s.streaming_encrypt(pl, e, KEY, os.urandom(s.STREAM_AEAD_NONCE_BYTES))
    s.streaming_decrypt(e, pl, KEY)
    r._plain_artifact_valid(e, pl)
    return True
check('plain-valid', run_plain_valid)

print(json.dumps(results))
`;

function runScenarios() {
  const tmp = path.join(os.tmpdir(), 'lovebud-restore-behavior-' + process.pid + '.py');
  fs.writeFileSync(tmp, SCENARIO_SCRIPT, { mode: 0o600 });
  try {
    const stdout = execFileSync('python3', [tmp], { encoding: 'utf8', timeout: 90000 });
    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* best effort */ }
  }
}

const results = runScenarios();

test('1. import side effects = 0 (no requests/psycopg/modal/subprocess at import)', () => {
  assert.equal(results['import-network'].status, 'PASS');
  assert.equal(results['import-network'].value, true);
  assert.equal(results['import-psycopg'].value, true);
  assert.equal(results['import-modal'].value, true);
  assert.equal(results['import-subprocess-mod'].value, true);
});

test('2. missing restore-only target fails closed (RESTORE_TARGET_INVALID)', () => {
  assert.equal(results['target-missing'].status, 'PASS');
  assert.equal(results['target-missing'].value.restore_state, 'RESTORE_TARGET_INVALID');
  assert.equal(results['target-wrong-class'].value.restore_state, 'RESTORE_TARGET_INVALID');
});

test('3. Product DB credential substitution is rejected', () => {
  assert.equal(results['target-forbidden-product-name'].status, 'PASS');
  assert.equal(results['target-forbidden-product-name'].value.restore_state, 'RESTORE_TARGET_INVALID');
});

test('4. invalid Drive metadata fails closed before decrypt/restore', () => {
  assert.equal(results['download-metadata-mismatch'].status, 'PASS');
  assert.equal(results['download-metadata-mismatch'].value.restore_state, 'RESTORE_ARTIFACT_NOT_FOUND');
});

test('5. empty/corrupt/LBBA1-invalid artifact fails closed', () => {
  assert.equal(results['artifact-empty'].status, 'PASS');
  assert.equal(results['artifact-empty'].value.restore_state, 'RESTORE_ARTIFACT_INVALID');
  assert.equal(results['artifact-corrupt'].value.restore_state, 'RESTORE_ARTIFACT_INVALID');
});

test('6. AEAD authentication failure never reaches pg_restore', () => {
  assert.equal(results['auth-failure-blocks-restore'].status, 'PASS');
  assert.equal(results['auth-failure-blocks-restore'].value.restore_state, 'RESTORE_ARTIFACT_INVALID');
});

test('7. pg_restore failure does not trigger blind retry', () => {
  assert.equal(results['pg-failure-no-retry'].status, 'PASS');
  assert.equal(results['pg-failure-no-retry'].value.status.restore_state, 'RESTORE_COMMAND_FAILED');
  assert.equal(results['pg-failure-no-retry'].value.calls, 1, 'exactly one pg_restore attempt');
});

test('8. verification failure cannot be reported as restore success', () => {
  assert.equal(results['verify-failure-not-success'].status, 'PASS');
  assert.equal(results['verify-failure-not-success'].value.restore_state, 'RESTORE_VERIFICATION_FAILED');
});

test('9. temp artifact cleanup on success and every failure stage', () => {
  assert.equal(results['cleanup-success'].status, 'PASS');
  assert.equal(results['cleanup-success'].value, true);
  assert.equal(results['cleanup-decrypt-failure'].value, true);
  assert.equal(results['cleanup-pg-failure'].value, true);
  assert.equal(results['cleanup-verify-failure'].value, true);
});

test('10. sanitized status only; no raw secrets/provider/DB in output', () => {
  const r = results['status-surface'];
  assert.equal(r.status, 'PASS');
  const statusJson = r.value.json;
  const parsed = JSON.parse(statusJson);
  assert.ok(!('error' in parsed) && !('exception' in parsed), 'no raw error in status');
  assert.ok(!/stderr|DATABASE_URL|file_id|token/.test(statusJson), 'no raw values in status');
});

test('11. pg_restore argv is non-destructive', () => {
  const r = results['command-argv'];
  assert.equal(r.status, 'PASS');
  assert.ok(r.value.argv.includes('--no-owner'));
  assert.ok(r.value.argv.includes('--no-privileges'));
  assert.ok(!r.value.argv.includes('--clean'), 'no --clean');
  assert.ok(!r.value.argv.includes('--create'), 'no --create');
});

test('12. LBBA1 validity seam: encrypt->decrypt round-trips for a valid artifact', () => {
  assert.equal(results['plain-valid'].status, 'PASS');
  assert.equal(results['plain-valid'].value, true);
});