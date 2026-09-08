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

def ok_attest(target):
    return p.ISOLATED_TARGET_VERIFIED

def fail_attest(target):
    return 'NOT_VERIFIED'

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
        target_verifier=ok_attest,
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
    # Product credential name used AS the restore target value (aliasing):
    # RESTORE_TARGET_DATABASE_URL == LOVE_PLATFORM_DATABASE_URL value.
    set_target('ISOLATED_RESTORE_TARGET', 'postgresql://product@production.example/db')
    os.environ['LOVE_PLATFORM_DATABASE_URL'] = 'postgresql://product@production.example/db'
    return r.run_isolated_restore(**base_args())
check('target-forbidden-product-name', run_forbidden_product_name)

# ---- shared counting seams (robust against restore-path changes) ---------------
call_counts = {'dl': 0, 'dec': 0, 'pg': 0}
def counting_download(service, file_id, dest_path, **kw):
    call_counts['dl'] += 1
    fake_download_from(ENC)(service, file_id, dest_path, **kw)
def counting_decrypt(enc_path, plain_path, key):
    call_counts['dec'] += 1
    s.streaming_decrypt(enc_path, plain_path, key)
def counting_executor(cmd, env):
    call_counts['pg'] += 1
    class R: returncode = 0
    return R()

# ---- 3b. DSN alias guard: equality against EACH known Product/source DSN --------
# Mere PRESENCE of a distinct Product DSN must NOT block; only EQUALITY must.
ALIAS_ISOLATED = 'postgresql://restore@isolated.example/db'
ALIAS_PRODUCT = 'postgresql://product@production.example/db'
ALIAS_SOURCE = 'postgresql://source@backup-source.example/db'

def run_positive_control():
    # Positive control: a DIFFERENT Product DSN exists but restore succeeds.
    set_target('ISOLATED_RESTORE_TARGET', ALIAS_ISOLATED)
    os.environ['LOVE_PLATFORM_DATABASE_URL'] = ALIAS_PRODUCT
    for k in ('LOVE_PLATFORM_WRITE_DATABASE_URL', 'DATABASE_URL'):
        os.environ.pop(k, None)
    for k in call_counts: call_counts[k] = 0
    st = r.run_isolated_restore(**base_args(
        download_fn=counting_download,
        decrypt_fn=counting_decrypt,
        pg_restore_executor=counting_executor,
    ))
    return {'status': st, 'calls': dict(call_counts)}
check('positive-control-distinct-dsn', run_positive_control)

def run_equality_case(env_name, known_value):
    set_target('ISOLATED_RESTORE_TARGET', known_value)  # target == known DSN
    os.environ[env_name] = known_value
    for k in call_counts: call_counts[k] = 0
    st = r.run_isolated_restore(**base_args(
        download_fn=counting_download,
        decrypt_fn=counting_decrypt,
        pg_restore_executor=counting_executor,
    ))
    os.environ.pop(env_name, None)
    return {'status': st, 'calls': dict(call_counts)}

check('prod-read-dsn-equality', lambda: run_equality_case('LOVE_PLATFORM_DATABASE_URL', ALIAS_PRODUCT))
check('prod-write-dsn-equality', lambda: run_equality_case('LOVE_PLATFORM_WRITE_DATABASE_URL', ALIAS_PRODUCT))
check('database-url-dsn-equality', lambda: run_equality_case('DATABASE_URL', ALIAS_SOURCE))

# ---- 3c. BLOCKER-2: isolated class with NO positive attestation is rejected ------
def run_no_attestation():
    set_target()
    for k in ('LOVE_PLATFORM_DATABASE_URL', 'LOVE_PLATFORM_WRITE_DATABASE_URL', 'DATABASE_URL'):
        os.environ.pop(k, None)
    return r.run_isolated_restore(**base_args(target_verifier=fail_attest))
check('no-attestation-rejected', run_no_attestation)

# ---- 3d. BLOCKER-2: positive fake isolated-target attestation + distinct target allowed -
def run_attestation_allowed():
    set_target()
    for k in ('LOVE_PLATFORM_DATABASE_URL', 'LOVE_PLATFORM_WRITE_DATABASE_URL', 'DATABASE_URL'):
        os.environ.pop(k, None)
    return r.run_isolated_restore(**base_args(target_verifier=ok_attest))
check('attestation-allowed', run_attestation_allowed)

# ---- 3e. BLOCKER-2: verifier failure -> no download, no decrypt, no pg_restore ------
def run_verifier_failure_no_ops():
    set_target()
    for k in call_counts: call_counts[k] = 0
    st = r.run_isolated_restore(**base_args(
        target_verifier=fail_attest,
        download_fn=counting_download,
        decrypt_fn=counting_decrypt,
        pg_restore_executor=counting_executor,
    ))
    return {'status': st, 'calls': dict(call_counts)}
check('verifier-failure-no-ops', run_verifier_failure_no_ops)

# ---- 3f. pure alias guard is load-bearing (in-memory, no env) ----------------
def run_pure_alias_guard():
    # equality -> rejected; distinct -> allowed; absent target -> fail closed
    eq = p.dsn_alias_rejected(ALIAS_PRODUCT, [ALIAS_PRODUCT, ALIAS_SOURCE])
    distinct = p.dsn_alias_rejected(ALIAS_ISOLATED, [ALIAS_PRODUCT, ALIAS_SOURCE])
    missing = p.dsn_alias_rejected(None, [ALIAS_PRODUCT])
    empty_known = p.dsn_alias_rejected(ALIAS_ISOLATED, [None, ''])
    return {'eq': eq, 'distinct': distinct, 'missing': missing, 'empty_known': empty_known}
check('pure-alias-guard', run_pure_alias_guard)

# ---- 3g. MUTATION PROOF: the alias guard is the discriminating factor ----------
# If dsn_alias_rejected() always returned False (or the app-level guard were
# removed), the equality scenarios above would flip to RESTORE_SUCCESS and FAIL
# these assertions. This scenario proves that causality inside the contract.
def run_alias_mutation_proof():
    set_target('ISOLATED_RESTORE_TARGET', ALIAS_PRODUCT)
    os.environ['LOVE_PLATFORM_DATABASE_URL'] = ALIAS_PRODUCT
    for k in call_counts: call_counts[k] = 0
    st_real = r.run_isolated_restore(**base_args(
        download_fn=counting_download,
        decrypt_fn=counting_decrypt,
        pg_restore_executor=counting_executor,
    ))
    real_calls = dict(call_counts)
    # mutation A: neutralize the app-level guard binding -> must flip to SUCCESS
    real_guard = r.dsn_alias_rejected
    r.dsn_alias_rejected = lambda *a, **k: False
    try:
        for k in call_counts: call_counts[k] = 0
        st_mut = r.run_isolated_restore(**base_args(
            download_fn=counting_download,
            decrypt_fn=counting_decrypt,
            pg_restore_executor=counting_executor,
        ))
        mut_calls = dict(call_counts)
    finally:
        r.dsn_alias_rejected = real_guard
    os.environ.pop('LOVE_PLATFORM_DATABASE_URL', None)
    return {
        'real_state': st_real['restore_state'], 'real_calls': real_calls,
        'mutated_state': st_mut['restore_state'], 'mutated_calls': mut_calls,
    }
check('alias-mutation-proof', run_alias_mutation_proof)

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
    cmd = r._build_restore_command()
    return {'argv': cmd}
check('command-argv', run_command_argv)

# ---- 11b. PGDATABASE child-env only: target URL never in argv ----------------
def run_pg_env_only():
    set_target()
    captured = {}
    def capture_executor(cmd, env):
        captured['argv'] = list(cmd)
        captured['env'] = dict(env)
        class R: returncode = 0
        return R()
    r.run_isolated_restore(**base_args(pg_restore_executor=capture_executor))
    argv = captured.get('argv', [])
    env = captured.get('env', {})
    target = os.environ.get('RESTORE_TARGET_DATABASE_URL', '')
    return {
        'has_pgdatabase': 'PGDATABASE' in env,
        'pgdatabase_value': env.get('PGDATABASE'),
        'target_in_argv': any(target and target in str(a) for a in argv),
    }
check('pg-env-only', run_pg_env_only)

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

test('3b. positive control: distinct Product DSN present + isolated target → success (1/1/1)', () => {
  const r = results['positive-control-distinct-dsn'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.restore_state, 'RESTORE_SUCCESS', 'mere presence of a Product DSN must not block');
  assert.equal(r.value.calls.dl, 1, 'exactly one download');
  assert.equal(r.value.calls.dec, 1, 'exactly one decrypt');
  assert.equal(r.value.calls.pg, 1, 'exactly one pg_restore');
});

test('3c. equality against LOVE_PLATFORM_DATABASE_URL is rejected (0/0/0)', () => {
  const r = results['prod-read-dsn-equality'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.restore_state, 'RESTORE_TARGET_INVALID');
  assert.equal(r.value.calls.dl, 0, 'no download on alias equality');
  assert.equal(r.value.calls.dec, 0, 'no decrypt on alias equality');
  assert.equal(r.value.calls.pg, 0, 'no pg_restore on alias equality');
});

test('3c2. equality against LOVE_PLATFORM_WRITE_DATABASE_URL is rejected (0/0/0)', () => {
  const r = results['prod-write-dsn-equality'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.restore_state, 'RESTORE_TARGET_INVALID');
  assert.equal(r.value.calls.dl, 0);
  assert.equal(r.value.calls.dec, 0);
  assert.equal(r.value.calls.pg, 0);
});

test('3c3. equality against DATABASE_URL / backup source DSN is rejected (0/0/0)', () => {
  const r = results['database-url-dsn-equality'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.restore_state, 'RESTORE_TARGET_INVALID');
  assert.equal(r.value.calls.dl, 0);
  assert.equal(r.value.calls.dec, 0);
  assert.equal(r.value.calls.pg, 0);
});

test('3c4. pure alias guard is load-bearing (equality/different/missing/empty)', () => {
  const r = results['pure-alias-guard'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.eq, true, 'equality must be rejected');
  assert.equal(r.value.distinct, false, 'distinct DSN must be allowed');
  assert.equal(r.value.missing, true, 'missing target fails closed');
  assert.equal(r.value.empty_known, false, 'empty known values are not aliasing');
});

test('3g. MUTATION PROOF: neutralizing the alias guard flips equality to SUCCESS', () => {
  const r = results['alias-mutation-proof'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.real_state, 'RESTORE_TARGET_INVALID', 'equality rejected with the guard active');
  assert.equal(r.value.real_calls.dl, 0);
  assert.equal(r.value.real_calls.dec, 0);
  assert.equal(r.value.real_calls.pg, 0);
  assert.equal(r.value.mutated_state, 'RESTORE_SUCCESS', 'guard removed -> equality case would succeed (tests would FAIL)');
  assert.equal(r.value.mutated_calls.dl, 1);
  assert.equal(r.value.mutated_calls.dec, 1);
  assert.equal(r.value.mutated_calls.pg, 1);
});

test('3d. isolated class with no positive attestation is rejected', () => {
  assert.equal(results['no-attestation-rejected'].status, 'PASS');
  assert.equal(results['no-attestation-rejected'].value.restore_state, 'RESTORE_TARGET_INVALID');
});

test('3e. positive fake isolated-target attestation + distinct target is allowed', () => {
  assert.equal(results['attestation-allowed'].status, 'PASS');
  assert.equal(results['attestation-allowed'].value.restore_state, 'RESTORE_SUCCESS');
});

test('3f. verifier failure -> no download, no decrypt, no pg_restore', () => {
  const r = results['verifier-failure-no-ops'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.restore_state, 'RESTORE_TARGET_INVALID');
  assert.equal(r.value.calls.dl, 0, 'no download on verifier failure');
  assert.equal(r.value.calls.dec, 0, 'no decrypt on verifier failure');
  assert.equal(r.value.calls.pg, 0, 'no pg_restore on verifier failure');
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

test('11. pg_restore argv is non-destructive and non-script-output', () => {
  const r = results['command-argv'];
  assert.equal(r.status, 'PASS');
  assert.ok(r.value.argv.includes('--no-owner'));
  assert.ok(r.value.argv.includes('--no-privileges'));
  assert.ok(!r.value.argv.includes('--clean'), 'no --clean');
  assert.ok(!r.value.argv.includes('--create'), 'no --create');
  // BLOCKER-1 fix: no script-output mode
  assert.ok(!r.value.argv.includes('--file'), 'no --file');
  assert.ok(!r.value.argv.includes('-f'), 'no -f');
  // archive path is positional input (first bare arg is the archive, not --file)
  assert.ok(r.value.argv[0] === 'pg_restore', 'pg_restore is argv[0]');
  assert.ok(!r.value.argv.includes('-'), 'no bare dash placeholder');
});

test('11b. PGDATABASE carries the isolated target in child-env only (never argv)', () => {
  const r = results['pg-env-only'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.has_pgdatabase, true, 'PGDATABASE present in child env');
  assert.equal(r.value.pgdatabase_value, 'postgresql://restore@isolated.example/db');
  assert.equal(r.value.target_in_argv, false, 'target URL never in argv');
});

test('12. LBBA1 validity seam: encrypt->decrypt round-trips for a valid artifact', () => {
  assert.equal(results['plain-valid'].status, 'PASS');
  assert.equal(results['plain-valid'].value, true);
});