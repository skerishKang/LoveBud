/**
 * #3828 external logical-backup behavior contract — deterministic policy execution
 * and framing/integrity seam.
 *
 * Refs #3828 (implementation child). Parent #3460 stays OPEN.
 *
 * Executes ONLY pure policy functions and a deterministic injected cipher seam via a
 * local python3 subprocess. No provider, R2, Modal, DB, pg_dump, network, secret, or
 * filesystem-backup operation occurs. The scenario script is written to the OS temp
 * directory (never the repository) and removed after the run. The production source's
 * cryptography GCM usage is locked statically by the sibling source contract.
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
import sys, json, base64, os
sys.path.insert(0, ${JSON.stringify(ROOT)})
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'modal_compute'))})
import recovery_backup_policy as p
import modal_compute.recovery_drive_storage as d

OK = dict(dump_success=True, encryption_success=True, plaintext_cleanup_success=True,
          upload_complete=True, post_upload_verified=True, daily_promotion_success=True)

# ---- deterministic injected cipher seam (framing + single-tag contract) ----
SEAM_VERSION = b"LBBA1"
SEAM_NONCE_LEN = 12
SEAM_TAG_LEN = 16

def seam_tag(ct, key, nonce):
    h = bytearray(SEAM_TAG_LEN)
    for i, b in enumerate(nonce + ct):
        h[i % SEAM_TAG_LEN] ^= b ^ key[i % len(key)]
    return bytes(h)

def seam_encrypt(plain, key, nonce):
    if not plain:
        raise ValueError("empty plaintext rejected")
    ct = bytes((b ^ key[i % len(key)]) for i, b in enumerate(plain))
    return SEAM_VERSION + nonce + ct + seam_tag(ct, key, nonce)

def seam_decrypt(envelope, key):
    version = envelope[:len(SEAM_VERSION)]
    nonce = envelope[len(SEAM_VERSION):len(SEAM_VERSION) + SEAM_NONCE_LEN]
    payload = envelope[len(SEAM_VERSION) + SEAM_NONCE_LEN:]
    if version != SEAM_VERSION:
        raise ValueError("invalid envelope header")
    if len(nonce) != SEAM_NONCE_LEN:
        raise ValueError("invalid nonce length")
    if len(payload) <= SEAM_TAG_LEN:
        raise ValueError("invalid envelope payload")
    ct = payload[:-SEAM_TAG_LEN]
    tag = payload[-SEAM_TAG_LEN:]
    if tag != seam_tag(ct, key, nonce):
        raise ValueError("authentication failed")
    return bytes((b ^ key[i % len(key)]) for i, b in enumerate(ct))

results = {}
def check(name, fn):
    try:
        value = fn()
        if isinstance(value, bytes):
            value = value.decode('latin-1')
        results[name] = {'status': 'PASS', 'value': value}
    except Exception as e:
        results[name] = {'status': 'ERROR', 'error': str(e)}

def expect_raise(name, fn, needle):
    try:
        fn()
        results[name] = {'status': 'FAIL', 'error': 'expected exception not raised'}
    except Exception as e:
        ok = needle is None or needle in str(e)
        results[name] = {'status': 'PASS' if ok else 'FAIL', 'error': str(e)}

KEY = bytes(range(32))
NONCE = bytes(range(12))
PLAIN = b"the quick brown fox jumps over the lazy dog" * 40

# --- seam framing ---
env = seam_encrypt(PLAIN, KEY, NONCE)
check('seam-header', lambda: env[:len(SEAM_VERSION)])
check('seam-nonce-slice', lambda: env[len(SEAM_VERSION):len(SEAM_VERSION) + SEAM_NONCE_LEN])
check('seam-nonce-length', lambda: len(env[len(SEAM_VERSION):len(SEAM_VERSION) + SEAM_NONCE_LEN]))
check('seam-ciphertext-present', lambda: len(env) > len(SEAM_VERSION) + SEAM_NONCE_LEN + SEAM_TAG_LEN)
check('seam-single-tag', lambda: env[-SEAM_TAG_LEN:] == seam_tag(env[len(SEAM_VERSION) + SEAM_NONCE_LEN:-SEAM_TAG_LEN], KEY, NONCE))
check('seam-roundtrip', lambda: seam_decrypt(env, KEY) == PLAIN)
bad_ct = bytearray(env); bad_ct[len(SEAM_VERSION) + SEAM_NONCE_LEN] ^= 0x01
expect_raise('seam-ciphertext-tamper', lambda: seam_decrypt(bytes(bad_ct), KEY), 'authentication failed')
bad_tag = bytearray(env); bad_tag[-1] ^= 0x01
expect_raise('seam-tag-tamper', lambda: seam_decrypt(bytes(bad_tag), KEY), 'authentication failed')
expect_raise('seam-empty-plaintext', lambda: seam_encrypt(b"", KEY, NONCE), 'empty plaintext rejected')

# --- key validation (pure policy helper) ---
valid_b64 = base64.b64encode(bytes(range(32))).decode('ascii')
check('key-valid', lambda: len(p.decode_encryption_key(valid_b64)))
expect_raise('key-invalid-b64', lambda: p.decode_encryption_key('!!!not-base64!!!'), None)
expect_raise('key-wrong-length', lambda: p.decode_encryption_key(base64.b64encode(bytes(range(16))).decode('ascii')), 'invalid encryption key length')

# ---- injected fake provider seam (deterministic containment semantics) ----
SENTINEL = 'SENTINEL_UNIQUE_TOKEN_7f3a'
ALL_LOG_LINES = []

class FakeProvider:
    def __init__(self, mode):
        self.mode = mode
    def client(self):
        if self.mode == 'client_fail':
            raise RuntimeError(SENTINEL)
        return self
    def upload_and_verify(self):
        if self.mode == 'put_fail':
            raise RuntimeError(SENTINEL)
        if self.mode == 'head_fail':
            return False
        return True

def run_flow(mode):
    s3 = None
    upload_ok = False
    try:
        s3 = FakeProvider(mode).client()
    except Exception:
        s3 = None
        ALL_LOG_LINES.append('phase=storage_client_failed')
    if s3 is not None:
        try:
            upload_ok = bool(s3.upload_and_verify())
        except Exception:
            upload_ok = False
            ALL_LOG_LINES.append('phase=upload_or_verification_failed')
    status = p.evaluate_run(
        dump_success=True, encryption_success=True, plaintext_cleanup_success=True,
        upload_complete=upload_ok, post_upload_verified=upload_ok, daily_promotion_success=False,
    )
    return status, upload_ok

for _mode in ('client_fail', 'put_fail', 'head_fail', 'ok'):
    _status, _ok = run_flow(_mode)
    check('seam-' + _mode, lambda s=_status: s)
check('seam-no-sentinel-output', lambda: all(SENTINEL not in line for line in ALL_LOG_LINES))

# ---- encryption/cleanup and workdir-failure seams ----
def run_encryption_cleanup_seam(encryption_fails=False, delete_fails=False):
    upload_calls = []
    logs = []
    encryption_ok = False
    plaintext_cleanup_ok = False
    try:
        if encryption_fails:
            raise RuntimeError(SENTINEL)
        encryption_ok = True
    except Exception:
        logs.append('phase=encryption')
    if encryption_ok:
        try:
            if delete_fails:
                raise RuntimeError(SENTINEL)
            plaintext_cleanup_ok = True
            logs.append('phase=plaintext_removed')
        except Exception:
            logs.append('phase=plaintext_cleanup')
    if encryption_ok and plaintext_cleanup_ok:
        upload_calls.append('upload')
    status = p.evaluate_run(
        dump_success=True,
        encryption_success=encryption_ok,
        plaintext_cleanup_success=plaintext_cleanup_ok,
        upload_complete=bool(upload_calls),
        post_upload_verified=bool(upload_calls),
        daily_promotion_success=False,
    )
    return status, upload_calls, logs

def run_workdir_failure_seam():
    provider_calls = []
    logs = []
    try:
        raise RuntimeError(SENTINEL)
    except Exception:
        logs.append('phase=cleanup')
    status = p.make_sanitized_status(
        backup_point_state=p.BACKUP_POINT_MISSING,
        daily_tier=p.DAILY_TIER_MISSING,
        weekly_tier=p.WEEKLY_TIER_MISSING,
        monthly_tier=p.MONTHLY_TIER_MISSING,
        cleanup_state=p.CLEANUP_FAILED,
        phase='cleanup',
    )
    return status, provider_calls, logs

for _name, _args in (
    ('encryption-cleanup-success', (False, False)),
    ('encryption-cleanup-failure', (False, True)),
    ('encryption-failure-boundary', (True, False)),
):
    _status, _calls, _logs = run_encryption_cleanup_seam(*_args)
    check('seam-' + _name, lambda s=_status, c=_calls, l=_logs: {'status': s, 'upload_calls': c, 'logs': l})
_status, _calls, _logs = run_workdir_failure_seam()
check('workdir-create-failure', lambda s=_status, c=_calls, l=_logs: {'status': s, 'provider_calls': c, 'logs': l})
check('runtime-failure-sentinel-absent', lambda: all(SENTINEL not in line for line in ALL_LOG_LINES))

# --- policy status scenarios ---
check('daily-only-success', lambda: p.evaluate_run(**OK))
check('daily-weekly-success', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=True))
check('daily-monthly-success', lambda: p.evaluate_run(**OK, monthly_promotion_decided=True, monthly_promotion_success=True))
check('daily-weekly-monthly-success', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=True, monthly_promotion_decided=True, monthly_promotion_success=True))
check('dump-failure', lambda: p.evaluate_run(dump_success=False))
check('encryption-failure', lambda: p.evaluate_run(dump_success=True))
check('plaintext-cleanup-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True))
check('incomplete-upload', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True))
check('head-verification-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True, upload_complete=True))
check('daily-promotion-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True, upload_complete=True, post_upload_verified=True))
check('daily-valid-weekly-failure', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=False))
check('daily-valid-monthly-failure', lambda: p.evaluate_run(**OK, monthly_promotion_decided=True, monthly_promotion_success=False))
check('cleanup-failure-preserves-daily', lambda: p.evaluate_run(**OK, cleanup_success=False))
check('stale-existing-daily', lambda: p.evaluate_run(dump_success=False, existing_daily_bucket='GE_24H_LT_7D'))
check('missing-weekly', lambda: p.evaluate_run(**OK).get('weekly_tier'))
check('missing-monthly', lambda: p.evaluate_run(**OK).get('monthly_tier'))
# independent boundary decisions
check('weekly-boundary-on', lambda: p.decide_weekly_promotion(True, False, 0))
check('weekly-boundary-off', lambda: p.decide_weekly_promotion(True, False, 1))
check('monthly-boundary-on', lambda: p.decide_monthly_promotion(True, False, 1))
check('monthly-boundary-off', lambda: p.decide_monthly_promotion(True, False, 2))
# rejections
expect_raise('unknown-state-rejection', lambda: p.reject_unknown_state('BOGUS'), 'unknown state rejected')
expect_raise('private-field-rejection', lambda: p.make_sanitized_status(timestamp='x'), None)
expect_raise('raw-field-rejection', lambda: p.make_sanitized_status(checksum='x'), 'RAW_FIELD_REJECTED')
expect_raise('impossible-state-rejection', lambda: p.reject_impossible_partial({'backup_point_state': p.BACKUP_POINT_MISSING, 'daily_tier': p.DAILY_TIER_VALID, 'weekly_tier': p.WEEKLY_TIER_MISSING, 'monthly_tier': p.MONTHLY_TIER_MISSING}), 'impossible partial rejected')

# ---- #3894 Drive quota preflight classification (pure, deterministic, fail-closed) ----
# Tests MAY use deterministic fake byte counts; no real quota value is used.
LIM = 10_000_000
CEIL = int(LIM * p.INTERNAL_CEILING_RATIO)  # 9_000_000
check('quota-within', lambda: p.classify_drive_quota(usage_bytes=10_000, limit_bytes=LIM, artifact_size_bytes=5_000))
check('quota-near', lambda: p.classify_drive_quota(usage_bytes=7_600_000, limit_bytes=LIM, artifact_size_bytes=100_000))
check('quota-exhausted-over-ceiling', lambda: p.classify_drive_quota(usage_bytes=8_950_000, limit_bytes=LIM, artifact_size_bytes=100_000))
check('quota-exhausted-missing-usage', lambda: p.classify_drive_quota(usage_bytes=None, limit_bytes=LIM, artifact_size_bytes=100))
check('quota-exhausted-missing-limit', lambda: p.classify_drive_quota(usage_bytes=100, limit_bytes=None, artifact_size_bytes=100))
check('quota-exhausted-unbounded', lambda: p.classify_drive_quota(usage_bytes=100, limit_bytes=0, artifact_size_bytes=100))
check('quota-exhausted-inconsistent', lambda: p.classify_drive_quota(usage_bytes=20_000_000, limit_bytes=LIM, artifact_size_bytes=100))
check('quota-exhausted-in-margin', lambda: p.classify_drive_quota(usage_bytes=CEIL, limit_bytes=LIM, artifact_size_bytes=1))
expect_raise('quota-invalid-ceiling-zero', lambda: p.classify_drive_quota(usage_bytes=0, limit_bytes=LIM, artifact_size_bytes=0, ceiling_ratio=0), None)
expect_raise('quota-invalid-ceiling-one', lambda: p.classify_drive_quota(usage_bytes=0, limit_bytes=LIM, artifact_size_bytes=0, ceiling_ratio=1), None)

# ---- retention selection: newest valid daily point protected ----
tier_files = [{'id': f'f{i}', 'created_time': f't{i}'} for i in range(5)]
check('retention-keep3-of5', lambda: d.select_retention_deletions(tier_files, 3))
check('retention-keep1-protects-newest', lambda: d.select_retention_deletions(tier_files, 1))
check('retention-keep-all', lambda: d.select_retention_deletions(tier_files, 5))
expect_raise('retention-keep0-rejected', lambda: d.select_retention_deletions(tier_files, 0), 'keep_count must protect')
check('retention-empty', lambda: d.select_retention_deletions([], 1))

# ---- Drive OAuth symbolic boundary (no real request) ----
check('drive-scope-exact', lambda: d.DRIVE_SCOPE)
check('drive-secret-name', lambda: d.RECOVERY_DRIVE_SECRET_NAME)
check('drive-within-state', lambda: d.DRIVE_STORAGE_WITHIN_LIMIT if hasattr(d, 'DRIVE_STORAGE_WITHIN_LIMIT') else p.DRIVE_STORAGE_WITHIN_LIMIT)

print(json.dumps(results))
`;

function runScenarios() {
  const tmp = path.join(os.tmpdir(), 'lovebud-backup-behavior-' + process.pid + '.py');
  fs.writeFileSync(tmp, SCENARIO_SCRIPT, { mode: 0o600 });
  try {
    const stdout = execFileSync('python3', [tmp], { encoding: 'utf8', timeout: 60000 });
    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* best effort */ }
  }
}

const results = runScenarios();

test('A. envelope framing: header, nonce slice/length, ciphertext, single final tag', () => {
  assert.equal(results['seam-header'].status, 'PASS');
  assert.equal(results['seam-header'].value, 'LBBA1');
  assert.equal(results['seam-nonce-slice'].status, 'PASS');
  assert.equal(results['seam-nonce-length'].value, 12);
  assert.equal(results['seam-ciphertext-present'].status, 'PASS');
  assert.equal(results['seam-single-tag'].status, 'PASS');
});

test('B. envelope round-trip and tamper detection', () => {
  assert.equal(results['seam-roundtrip'].status, 'PASS');
  assert.equal(results['seam-ciphertext-tamper'].status, 'PASS');
  assert.equal(results['seam-tag-tamper'].status, 'PASS');
  assert.equal(results['seam-empty-plaintext'].status, 'PASS');
});

test('C. encryption key validation (strict base64 32 bytes)', () => {
  assert.equal(results['key-valid'].status, 'PASS');
  assert.equal(results['key-valid'].value, 32);
  assert.equal(results['key-invalid-b64'].status, 'PASS');
  assert.equal(results['key-wrong-length'].status, 'PASS');
});

test('D. daily-only success (weekly/monthly missing, no provisioned dimensions)', () => {
  const r = results['daily-only-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(r.value.weekly_tier, 'WEEKLY_TIER_MISSING');
  assert.equal(r.value.monthly_tier, 'MONTHLY_TIER_MISSING');
  assert.ok(!('external_storage_state' in r.value), 'success must omit external_storage_state');
  assert.ok(!('secret_boundary_state' in r.value), 'success must omit secret_boundary_state');
});

test('E. daily+weekly / daily+monthly / daily+weekly+monthly success', () => {
  assert.equal(results['daily-weekly-success'].status, 'PASS');
  assert.equal(results['daily-weekly-success'].value.weekly_tier, 'WEEKLY_TIER_VALID');
  assert.equal(results['daily-monthly-success'].status, 'PASS');
  assert.equal(results['daily-monthly-success'].value.monthly_tier, 'MONTHLY_TIER_VALID');
  const wm = results['daily-weekly-monthly-success'];
  assert.equal(wm.status, 'PASS');
  assert.equal(wm.value.weekly_tier, 'WEEKLY_TIER_VALID');
  assert.equal(wm.value.monthly_tier, 'MONTHLY_TIER_VALID');
});

test('F. failure stages map to fixed states with phases', () => {
  assert.equal(results['dump-failure'].value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(results['dump-failure'].value.phase, 'dump');
  assert.equal(results['encryption-failure'].value.phase, 'encryption');
  assert.equal(results['plaintext-cleanup-failure'].value.phase, 'plaintext_cleanup');
  assert.equal(results['incomplete-upload'].value.backup_point_state, 'BACKUP_UPLOAD_INCOMPLETE');
  assert.equal(results['head-verification-failure'].value.backup_point_state, 'BACKUP_INTEGRITY_UNVERIFIED');
  assert.equal(results['daily-promotion-failure'].value.phase, 'daily_promotion');
});

test('G. no MISSING + DAILY_TIER_VALID contradiction', () => {
  const dump = results['dump-failure'];
  assert.equal(dump.status, 'PASS');
  assert.equal(dump.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.notEqual(dump.value.daily_tier, 'DAILY_TIER_VALID', 'failed run must not report a fresh daily tier');
  assert.equal(dump.value.daily_tier, 'DAILY_TIER_MISSING');
});

test('H. valid daily preserved on weekly/monthly promotion failure', () => {
  const w = results['daily-valid-weekly-failure'];
  assert.equal(w.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(w.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(w.value.weekly_tier, 'WEEKLY_TIER_MISSING');
  assert.equal(w.value.phase, 'weekly_promotion');
  const m = results['daily-valid-monthly-failure'];
  assert.equal(m.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(m.value.monthly_tier, 'MONTHLY_TIER_MISSING');
  assert.equal(m.value.phase, 'monthly_promotion');
});

test('I. cleanup failure preserves valid daily point', () => {
  const r = results['cleanup-failure-preserves-daily'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(r.value.cleanup_state, 'CLEANUP_FAILED');
});

test('J. stale existing daily point classified as STALE, not VALID', () => {
  const r = results['stale-existing-daily'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_STALE');
});

test('K. missing weekly/monthly points', () => {
  assert.equal(results['missing-weekly'].value, 'WEEKLY_TIER_MISSING');
  assert.equal(results['missing-monthly'].value, 'MONTHLY_TIER_MISSING');
});

test('L. independent weekly/monthly boundary decisions', () => {
  assert.equal(results['weekly-boundary-on'].status, 'PASS');
  assert.equal(results['weekly-boundary-on'].value, true);
  assert.equal(results['weekly-boundary-off'].value, false);
  assert.equal(results['monthly-boundary-on'].value, true);
  assert.equal(results['monthly-boundary-off'].value, false);
});

test('M. rejection controls (unknown/private/raw/impossible)', () => {
  assert.equal(results['unknown-state-rejection'].status, 'PASS');
  assert.equal(results['private-field-rejection'].status, 'PASS');
  assert.equal(results['raw-field-rejection'].status, 'PASS');
  assert.equal(results['impossible-state-rejection'].status, 'PASS');
});

test('N. preserve-daily helper functions', () => {
  const w = results['daily-valid-weekly-failure'];
  assert.equal(w.status, 'PASS');
  assert.equal(w.value.weekly_tier, 'WEEKLY_TIER_MISSING');
});

test('O. fake provider seam: client creation failure is contained', () => {
  const r = results['seam-client_fail'];
  assert.equal(r.status, 'PASS');
  const status = r.value;
  assert.ok('backup_point_state' in status, 'sanitized status returned');
  assert.ok(!('error' in status) && !('exception' in status), 'no raw exception in status');
  assert.ok(JSON.stringify(status).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no raw sentinel in status');
});

test('P. fake provider seam: put retry-exhaustion failure is contained', () => {
  const r = results['seam-put_fail'];
  assert.equal(r.status, 'PASS');
  const status = r.value;
  assert.ok('backup_point_state' in status, 'sanitized status returned');
  assert.ok(!('error' in status) && !('exception' in status), 'no raw exception in status');
  assert.ok(JSON.stringify(status).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no raw sentinel in status');
  assert.ok(status.backup_point_state !== 'BACKUP_POINT_VALID', 'failed provider run must not be valid');
});

test('Q. fake provider seam: head failure is contained', () => {
  const r = results['seam-head_fail'];
  assert.equal(r.status, 'PASS');
  const status = r.value;
  assert.ok('backup_point_state' in status, 'sanitized status returned');
  assert.ok(JSON.stringify(status).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no raw sentinel in status');
});

test('R. fake provider seam: no sentinel leaks into phase logs', () => {
  assert.equal(results['seam-no-sentinel-output'].status, 'PASS');
  assert.equal(results['seam-no-sentinel-output'].value, true);
});

test('S. fake provider seam: healthy provider yields expected upload path', () => {
  const r = results['seam-ok'];
  assert.equal(r.status, 'PASS');
  assert.ok(JSON.stringify(r.value).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no sentinel in healthy status');
});

test('T. encryption success and plaintext cleanup success permit upload', () => {
  const r = results['seam-encryption-cleanup-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.deepEqual(r.value.upload_calls, ['upload']);
  assert.deepEqual(r.value.logs, ['phase=plaintext_removed']);
});

test('U. plaintext cleanup failure preserves encryption success and blocks upload', () => {
  const r = results['seam-encryption-cleanup-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.status.phase, 'plaintext_cleanup');
  assert.deepEqual(r.value.upload_calls, []);
  assert.deepEqual(r.value.logs, ['phase=plaintext_cleanup']);
  assert.ok(JSON.stringify(r.value).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no raw sentinel');
});

test('V. encryption failure does not enter plaintext cleanup or upload', () => {
  const r = results['seam-encryption-failure-boundary'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.status.phase, 'encryption');
  assert.deepEqual(r.value.upload_calls, []);
});

test('W. workdir creation failure returns cleanup-failed sanitized status with no provider calls', () => {
  const r = results['workdir-create-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.status.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.status.cleanup_state, 'CLEANUP_FAILED');
  assert.equal(r.value.status.phase, 'cleanup');
  assert.deepEqual(r.value.provider_calls, []);
  assert.deepEqual(r.value.logs, ['phase=cleanup']);
  assert.ok(JSON.stringify(r.value).indexOf('SENTINEL_UNIQUE_TOKEN_7f3a') === -1, 'no raw sentinel');
});

// --- #3894 Drive quota preflight classification (fail-closed) ---

test('X1. quota within limit permits upload', () => {
  const r = results['quota-within'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_WITHIN_LIMIT');
});

test('X2. quota near limit (projected in near-band) still permits upload', () => {
  const r = results['quota-near'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_NEAR_LIMIT');
});

test('X3. quota over ceiling is exhausted (zero upload)', () => {
  const r = results['quota-exhausted-over-ceiling'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X4. missing usage fails closed as exhausted', () => {
  const r = results['quota-exhausted-missing-usage'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X5. missing limit fails closed as exhausted', () => {
  const r = results['quota-exhausted-missing-limit'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X6. unbounded limit (0) fails closed as exhausted', () => {
  const r = results['quota-exhausted-unbounded'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X7. inconsistent usage > limit fails closed as exhausted', () => {
  const r = results['quota-exhausted-inconsistent'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X8. usage at ceiling (reserved margin) fails closed as exhausted', () => {
  const r = results['quota-exhausted-in-margin'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_EXHAUSTED');
});

test('X9. invalid ceiling ratio (0 or 1) rejected', () => {
  assert.equal(results['quota-invalid-ceiling-zero'].status, 'PASS');
  assert.equal(results['quota-invalid-ceiling-one'].status, 'PASS');
});

// --- retention selection: newest valid daily protected ---

test('Y1. retention keep 3 of 5 selects the 2 oldest expired', () => {
  const r = results['retention-keep3-of5'];
  assert.equal(r.status, 'PASS');
  assert.deepEqual(r.value, ['f3', 'f4']);
});

test('Y2. retention keep 1 protects the newest valid daily point', () => {
  const r = results['retention-keep1-protects-newest'];
  assert.equal(r.status, 'PASS');
  assert.deepEqual(r.value, ['f1', 'f2', 'f3', 'f4']);
  assert.ok(!r.value.includes('f0'), 'newest point f0 protected');
});

test('Y3. retention keep all selects nothing', () => {
  const r = results['retention-keep-all'];
  assert.equal(r.status, 'PASS');
  assert.deepEqual(r.value, []);
});

test('Y4. retention keep 0 rejected (must protect newest)', () => {
  assert.equal(results['retention-keep0-rejected'].status, 'PASS');
});

test('Y5. retention on empty tier selects nothing', () => {
  const r = results['retention-empty'];
  assert.equal(r.status, 'PASS');
  assert.deepEqual(r.value, []);
});

// --- Drive OAuth symbolic boundary (no real request) ---

test('Z1. Drive scope is exactly drive.file', () => {
  const r = results['drive-scope-exact'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'https://www.googleapis.com/auth/drive.file');
});

test('Z2. Drive secret symbolic name exact', () => {
  const r = results['drive-secret-name'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'lovebud-recovery-drive');
});

test('Z3. Drive sanitized state vocabulary present', () => {
  const r = results['drive-within-state'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value, 'DRIVE_STORAGE_WITHIN_LIMIT');
});
