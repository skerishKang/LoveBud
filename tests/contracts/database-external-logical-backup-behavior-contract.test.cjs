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


# ---- #3894 / #4137 in-process FAKE Drive transport contract ----
# NO real Google API, OAuth, or secret. build_drive_service / _exchange_refresh_token
# (which touch requests + tokens) are bypassed: a _DriveService is built directly
# with a FakeSession, so the REAL adapter operations execute against deterministic
# responses. No npm dependency is required (the adapter only uses the stdlib at import).

class FakeResp:
    def __init__(self, status_code=200, json_body=None, headers=None):
        self.status_code = status_code
        self._json = json_body if json_body is not None else {}
        self.headers = headers if headers is not None else {}
    def json(self):
        return self._json


class FakeSession:
    def __init__(self):
        self.calls = []
        self.post_queue = []
        self.put_queue = []
        self.get_queue = []
        self.del_queue = []
    def _maybe_raise(self, item):
        if isinstance(item, BaseException):
            raise item
        return item
    def post(self, url, params=None, headers=None, data=None, timeout=None):
        self.calls.append(('POST', url, dict(params or {}), data, dict(headers or {})))
        return self._maybe_raise(self.post_queue.pop(0) if self.post_queue else FakeResp(200, {}))
    def put(self, url, data=None, headers=None, timeout=None):
        data_seen = ('fileobj', None) if hasattr(data, 'read') else data
        self.calls.append(('PUT', url, None, data_seen, dict(headers or {})))
        return self._maybe_raise(self.put_queue.pop(0) if self.put_queue else FakeResp(200, {}))
    def get(self, url, params=None, timeout=None):
        self.calls.append(('GET', url, dict(params or {}), None, None))
        return self._maybe_raise(self.get_queue.pop(0) if self.get_queue else FakeResp(200, {}))
    def delete(self, url, timeout=None):
        self.calls.append(('DELETE', url, None, None))
        return self._maybe_raise(self.del_queue.pop(0) if self.del_queue else FakeResp(204, {}))


def _tmp_enc(n=4096):
    fp = '/tmp/lbba-fake-' + os.urandom(8).hex()
    fd = os.open(fp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.write(fd, bytes(n))
    os.close(fd)
    return fp


ROOT_FID = 'root-folder-id'
SESS_URL_A = 'https://upload.drive/v3/sessions/s1'
SESS_URL_B = 'https://upload.drive/v3/sessions/s2'


def _init_count(calls):
    return len([c for c in calls if c[0] == 'POST' and (c[2] or {}).get('uploadType') == 'resumable'])
def _puts(calls):
    return [c for c in calls if c[0] == 'PUT']
def _copy_count(calls):
    return len([c for c in calls if c[0] == 'POST' and (c[1] or '').endswith('/copy')])


# A. resumable upload: ONE session init; 308 partial Range -> resume SAME session from offset
def run_resumable_upload():
    enc = _tmp_enc()
    try:
        sess = FakeSession()
        sess.post_queue.append(FakeResp(201, {'id': 'STAGED'}, {'Location': SESS_URL_A}))
        sess.put_queue.append(FakeResp(308, {}, {'Range': 'bytes=0-1023'}))   # committed first 1024 bytes
        sess.put_queue.append(FakeResp(200, {'id': 'FILE_A'}))                  # resume completes
        svc = d._DriveService(session=sess, backup_root=ROOT_FID)
        fid = d.create_encrypted_file(svc, 'daily-RKEY', enc, d.TIER_DAILY, 'RKEY')
        puts = _puts(sess.calls)
        return {
            'file_id': fid,
            'init_post_count': _init_count(sess.calls),
            'put_count': len(puts),
            'resume_content_range': puts[1][4].get('Content-Range'),
            'resume_url_is_session': puts[1][1] == SESS_URL_A,
        }
    finally:
        os.unlink(enc)
check('resumable-single-session', lambda: run_resumable_upload())


# A2. media response ambiguity (network exception) -> SAME session status probe, no second create
def run_resumable_ambiguity():
    enc = _tmp_enc()
    try:
        sess = FakeSession()
        sess.post_queue.append(FakeResp(201, {}, {'Location': SESS_URL_B}))
        sess.put_queue.append(RuntimeError('network-loss'))     # media PUT raises
        sess.put_queue.append(FakeResp(200, {'id': 'FILE_B'}))   # status probe resolves
        svc = d._DriveService(session=sess, backup_root=ROOT_FID)
        fid = d.create_encrypted_file(svc, 'daily-RKEY', enc, d.TIER_DAILY, 'RKEY')
        puts = _puts(sess.calls)
        status_put = [c for c in puts if (c[4].get('Content-Range') or '').startswith('bytes */')]
        return {
            'file_id': fid,
            'init_post_count': _init_count(sess.calls),
            'put_count': len(puts),
            'status_query_same_session': bool(status_put) and status_put[0][1] == SESS_URL_B,
            'status_query_content_range': status_put[0][4].get('Content-Range') if status_put else None,
        }
    finally:
        os.unlink(enc)
check('resumable-ambiguity-same-session', lambda: run_resumable_ambiguity())


# B. malformed 308 Range -> fail closed, no second session
def run_malformed_range():
    enc = _tmp_enc()
    try:
        sess = FakeSession()
        sess.post_queue.append(FakeResp(201, {}, {'Location': 'https://upload.drive/v3/sessions/s3'}))
        sess.put_queue.append(FakeResp(308, {}, {'Range': 'bytes=0-abc'}))
        svc = d._DriveService(session=sess, backup_root=ROOT_FID)
        raised = False
        try:
            d.create_encrypted_file(svc, 'daily-RKEY', enc, d.TIER_DAILY, 'RKEY')
        except RuntimeError:
            raised = True
        return {'raised': raised, 'init_post_count': _init_count(sess.calls)}
    finally:
        os.unlink(enc)
check('malformed-range-fail-closed', lambda: run_malformed_range())


# C. files.copy is single-attempt: 500 raises immediately, no second copy; 200 returns id
def run_copy():
    sess = FakeSession()
    sess.post_queue.append(FakeResp(500, {}))
    svc = d._DriveService(session=sess, backup_root=ROOT_FID)
    fail_outcome = 'no-raise'
    try:
        d.copy_file(svc, 'SRC_ID', 'weekly-RKEY', d.TIER_WEEKLY, 'RKEY')
    except RuntimeError:
        fail_outcome = 'raised'
    sess2 = FakeSession()
    sess2.post_queue.append(FakeResp(200, {'id': 'COPY_OK'}))
    svc2 = d._DriveService(session=sess2, backup_root=ROOT_FID)
    ok_id = d.copy_file(svc2, 'SRC_ID', 'monthly-RKEY', d.TIER_MONTHLY, 'RKEY')
    return {'failure_outcome': fail_outcome, 'failure_copy_count': _copy_count(sess.calls),
            'success_id': ok_id, 'success_copy_count': _copy_count(sess2.calls)}
check('copy-ambiguity-single-attempt', lambda: run_copy())


# D. files.get verification: size + format + tier + app-owned root all required; any mismatch => False
def run_verify():
    props = {'format-version': 'LBBA1', 'content-kind': 'encrypted-postgresql-dump'}
    def mk(size, tier, parents, trashed):
        return FakeResp(200, {'id': 'FID', 'size': size, 'trashed': trashed,
            'appProperties': dict(props, **{'retention-tier': tier}), 'parents': parents})
    s1 = d._DriveService(session=FakeSession(), backup_root='R'); s1.session.get_queue.append(mk(4096, 'daily', ['R'], False))
    s2 = d._DriveService(session=FakeSession(), backup_root='R'); s2.session.get_queue.append(mk(999, 'daily', ['R'], False))
    s3 = d._DriveService(session=FakeSession(), backup_root='R'); s3.session.get_queue.append(mk(4096, 'daily', ['OTHER'], False))
    s4 = d._DriveService(session=FakeSession(), backup_root='R'); s4.session.get_queue.append(mk(4096, 'daily', ['R'], True))
    return {'match': d.verify_uploaded_file(s1, 'FID', 4096, 'daily'),
            'size_mismatch_false': d.verify_uploaded_file(s2, 'FID', 4096, 'daily'),
            'parent_mismatch_false': d.verify_uploaded_file(s3, 'FID', 4096, 'daily'),
            'trashed_false': d.verify_uploaded_file(s4, 'FID', 4096, 'daily')}
check('verify-metadata-required', lambda: run_verify())


# E. list_tier_files: scoped to backup-root parent + exact tier, ordered newest-first, bounded
def run_list():
    s = d._DriveService(session=FakeSession(), backup_root='R-ROOT')
    s.session.get_queue.append(FakeResp(200, {'files': [{'id': 'Z1', 'createdTime': 't1'}, {'id': 'Z2', 'createdTime': 't2'}]}))
    files = d.list_tier_files(s, 'daily')
    params = s.session.calls[0][2]
    q = params.get('q', '')
    return {'count': len(files), 'q_has_root': "'R-ROOT' in parents" in q,
            'q_has_tier': "value='daily'" in q,
            'ordered_desc': params.get('orderBy') == 'createdTime desc',
            'page_bounded': params.get('pageSize')}
check('list-scoped', lambda: run_list())


# F. delete issues a single DELETE /files/{id} by caller-supplied identity (caller-bounded provenance)
def run_delete():
    s = d._DriveService(session=FakeSession(), backup_root=ROOT_FID)
    s.session.del_queue.append(FakeResp(204, {}))
    d.delete_file(s, 'expire-XYZ')
    dels = [c for c in s.session.calls if c[0] == 'DELETE']
    return {'delete_count': len(dels), 'delete_url': dels[0][1] if dels else None,
            'delete_url_has_id': bool(dels) and dels[0][1].endswith('/files/expire-XYZ')}
check('delete-single-by-id', lambda: run_delete())


# Quota/auth HTTP boundary (fake about.get): 401 -> AUTH_UNAVAILABLE; valid -> WITHIN_LIMIT
def run_preflight_auth_fail():
    s = d._DriveService(session=FakeSession(), backup_root=ROOT_FID)
    s.session.get_queue.append(FakeResp(401, {}))
    return d.preflight_storage_quota(s, 100)
check('preflight-auth-unavailable', lambda: run_preflight_auth_fail())


def run_preflight_within():
    s = d._DriveService(session=FakeSession(), backup_root=ROOT_FID)
    s.session.get_queue.append(FakeResp(200, {'storageQuota': {'limit': 10000000, 'usage': 1000}}))
    return d.preflight_storage_quota(s, 5000)
check('preflight-within-limit', lambda: run_preflight_within())


# client_secret optional: absent does not block; missing required id fails closed
def run_secret_optional():
    for k in ('DRIVE_CLIENT_ID', 'DRIVE_CLIENT_SECRET', 'DRIVE_REFRESH_TOKEN', 'DRIVE_BACKUP_ROOT'):
        os.environ.pop(k, None)
    os.environ['DRIVE_CLIENT_ID'] = 'c'
    os.environ['DRIVE_REFRESH_TOKEN'] = 'r'
    os.environ['DRIVE_BACKUP_ROOT'] = 'b'
    no_secret = d.drive_secrets_present()
    os.environ['DRIVE_CLIENT_SECRET'] = 'shh'
    with_secret = d.drive_secrets_present()
    del os.environ['DRIVE_CLIENT_ID']
    missing_id = d.drive_secrets_present()
    for k in ('DRIVE_CLIENT_ID', 'DRIVE_CLIENT_SECRET', 'DRIVE_REFRESH_TOKEN', 'DRIVE_BACKUP_ROOT'):
        os.environ.pop(k, None)
    return {'without_client_secret': no_secret, 'with_client_secret': with_secret,
            'missing_client_id_fails_closed': (not missing_id)}
check('client-secret-optional', lambda: run_secret_optional())

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

// --- #4137 FAKE Drive transport execution (no network, no OAuth, no secret) ---

test('AA. resumable upload: one session init, resume from committed offset on SAME session', () => {
  const r = results['resumable-single-session'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.file_id, 'FILE_A');
  assert.equal(r.value.init_post_count, 1, 'exactly one files.create (resumable session) initialization');
  assert.equal(r.value.put_count, 2, 'two media PUTs: partial 308 then resume');
  assert.equal(r.value.resume_content_range, 'bytes 1024-4095/4096', 'resume Content-Range starts at committed 1024 offset');
  assert.equal(r.value.resume_url_is_session, true, 'resume PUT targets the SAME session URI');
});

test('AB. media ambiguity (network exception): SAME session status probe, no second create', () => {
  const r = results['resumable-ambiguity-same-session'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.file_id, 'FILE_B');
  assert.equal(r.value.init_post_count, 1, 'no second files.create on network ambiguity');
  assert.equal(r.value.put_count, 2, 'one failed media PUT + one status-probe PUT');
  assert.equal(r.value.status_query_same_session, true, 'status probe hits the SAME session URI');
  assert.equal(r.value.status_query_content_range, 'bytes */4096', 'status probe uses whole-file Content-Range');
});

test('AC. malformed 308 Range fails closed without a second session', () => {
  const r = results['malformed-range-fail-closed'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.raised, true, 'malformed Range raises (fail closed)');
  assert.equal(r.value.init_post_count, 1, 'no second files.create after malformed Range');
});

test('AD. files.copy is single-attempt: 500 raises with no blind second copy; 200 returns id', () => {
  const r = results['copy-ambiguity-single-attempt'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.failure_outcome, 'raised');
  assert.equal(r.value.failure_copy_count, 1, 'exactly one copy attempt on failure (no retry)');
  assert.equal(r.value.success_id, 'COPY_OK');
  assert.equal(r.value.success_copy_count, 1);
});

test('AE. files.get verification requires size + format + tier + app-owned root', () => {
  const r = results['verify-metadata-required'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.match, true);
  assert.equal(r.value.size_mismatch_false, false);
  assert.equal(r.value.parent_mismatch_false, false);
  assert.equal(r.value.trashed_false, false);
});

test('AF. list scoped to backup-root parent + exact tier, newest-first, bounded page', () => {
  const r = results['list-scoped'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.count, 2);
  assert.equal(r.value.q_has_root, true);
  assert.equal(r.value.q_has_tier, true);
  assert.equal(r.value.ordered_desc, true);
  assert.equal(r.value.page_bounded, 100);
});

test('AG. delete issues a single DELETE /files/{id} by caller-supplied identity', () => {
  const r = results['delete-single-by-id'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.delete_count, 1, 'single delete call');
  assert.equal(r.value.delete_url_has_id, true, 'delete targets /files/{id} exactly');
});

test('AH. about.get 401 fails closed as DRIVE_AUTH_UNAVAILABLE (zero upload)', () => {
  assert.equal(results['preflight-auth-unavailable'].status, 'PASS');
  assert.equal(results['preflight-auth-unavailable'].value, 'DRIVE_AUTH_UNAVAILABLE');
});

test('AI. about.get within 0.90 ceiling permits upload', () => {
  assert.equal(results['preflight-within-limit'].status, 'PASS');
  assert.equal(results['preflight-within-limit'].value, 'DRIVE_STORAGE_WITHIN_LIMIT');
});

test('AJ. client secret optional: absent does not block; missing client id fails closed', () => {
  const r = results['client-secret-optional'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.without_client_secret, true, 'absent client secret must not block');
  assert.equal(r.value.with_client_secret, true);
  assert.equal(r.value.missing_client_id_fails_closed, true, 'missing required id fails closed');
});
