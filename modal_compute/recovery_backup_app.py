"""Separate source-only Modal scheduled logical-backup app.

Scope boundary (#3828): this module is a standalone Modal scheduled function. It
is never imported by the public FastAPI app, exposes no HTTP endpoint, performs
no Production restore, and reads secrets / connects to the database / uploads
objects only inside the scheduled function body. Importing this module performs
no network, secret, DB, subprocess, filesystem, or deployment side effect.

Pipeline order (single run, one Production dump per execution):
  1. symbolic secret presence check
  2. private ephemeral working directory
  3. compressed PostgreSQL custom-format logical dump (DB URL via child-only env)
  4. non-empty dump verification
  5. single parseable streaming AEAD envelope (version + nonce + streamed
     ciphertext + one final authentication tag) with a strict base64 32-byte key
  6. plaintext dump deletion before upload
  7. incomplete/staging object upload (retry-safe fresh file cursor, streaming)
  8. authenticated head/metadata verification (length + format metadata)
  9. daily prefix promotion under a unique non-logged run key
  10. independent weekly/monthly promotion from the same encrypted object
  11. staging object deletion (staging-cleanup failure reflected as cleanup)
  12. strict finally cleanup (failures reflected, never suppressed)
  13. sanitized status return (from modal_compute.recovery_backup_policy)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone

import modal

from modal_compute.recovery_backup_policy import (
    BACKUP_POINT_MISSING,
    CLEANUP_COMPLETE,
    CLEANUP_FAILED,
    DAILY_TIER_MISSING,
    DRIVE_STORAGE_NEAR_LIMIT,
    DRIVE_STORAGE_WITHIN_LIMIT,
    EXTERNAL_STORAGE_UNPROVISIONED,
    MONTHLY_TIER_MISSING,
    SECRET_BOUNDARY_UNPROVISIONED,
    WEEKLY_TIER_MISSING,
    decide_monthly_promotion,
    decide_weekly_promotion,
    decode_encryption_key,
    evaluate_run,
    make_sanitized_status,
)
from modal_compute.recovery_drive_storage import (
    TIER_DAILY,
    TIER_MONTHLY,
    TIER_STAGING,
    TIER_WEEKLY,
    build_drive_service,
    copy_file as drive_copy_file,
    create_encrypted_file as drive_create_file,
    delete_file as drive_delete_file,
    drive_secrets_present,
    list_tier_files as drive_list_tier_files,
    preflight_storage_quota as drive_preflight_quota,
    select_retention_deletions as drive_select_deletions,
    verify_uploaded_file as drive_verify_file,
)

# Fixed symbolic identifiers (values are never logged or recorded).
RECOVERY_BACKUP_APP_NAME = "lovebud-recovery-backup"
RECOVERY_DB_SECRET_NAME = "lovebud-db"
RECOVERY_DRIVE_SECRET_NAME = "lovebud-recovery-drive"
RECOVERY_ENCRYPTION_SECRET_NAME = "lovebud-recovery-encryption"

# Symbolic environment names read from the injected secrets.
DB_URL_ENV = "DATABASE_URL"
ENCRYPTION_KEY_ENV = "RECOVERY_ENCRYPTION_KEY_B64"

# Bounded execution budgets.
DUMP_TIMEOUT_SECONDS = 600
OBJECT_RETRY_MAX = 3
OBJECT_RETRY_BACKOFF_SECONDS = 2.0
STREAM_CHUNK_BYTES = 1024 * 1024
STREAM_AEAD_VERSION = b"LBBA1"
STREAM_AEAD_NONCE_BYTES = 12
STREAM_AEAD_TAG_BYTES = 16
STREAM_AEAD_HEADER_BYTES = len(STREAM_AEAD_VERSION) + STREAM_AEAD_NONCE_BYTES

# Object prefixes (symbolic structure only; exact keys are never recorded).
DAILY_PREFIX = "daily"
WEEKLY_PREFIX = "weekly"
MONTHLY_PREFIX = "monthly"
STAGING_PREFIX = "staging"

# Bounded retention: minimum valid points to retain per tier. The newest valid
# daily point is always protected (keep >= 1). Deletions are tier-scoped and only
# target expired app-owned encrypted artifacts.
RETENTION_DAILY_KEEP = 8
RETENTION_WEEKLY_KEEP = 5
RETENTION_MONTHLY_KEEP = 4

# Fixed non-private object metadata written at upload time.
BACKUP_OBJECT_METADATA = {
    "format-version": "LBBA1",
    "content-kind": "encrypted-postgresql-custom-dump",
}

# Deterministic PostgreSQL 17 backup-client authority: the official image tag is
# pinned to a fixed minor so the deployed client provides `pg_dump` major 17.
POSTGRES_BACKUP_IMAGE = "postgres:17.4-bookworm"
POSTGRES_PYTHON_VERSION = "3.11"

BACKUP_IMAGE = (
    modal.Image.from_registry(
        POSTGRES_BACKUP_IMAGE,
        add_python=POSTGRES_PYTHON_VERSION,
    )
    .pip_install("requests", "cryptography")
    .add_local_python_source("modal_compute")
)

app = modal.App(RECOVERY_BACKUP_APP_NAME)

# One scheduled execution per 24-hour period; no web endpoint, no manual trigger.
DAILY_SCHEDULE = modal.Period(days=1)

# Bounded runtime budget for a single scheduled backup execution.
FUNCTION_TIMEOUT_SECONDS = 900


def _log_phase(phase: str) -> None:
    # Sanitized phase-only logging: never logs values, commands, or stderr.
    print(f"recovery-backup phase={phase}", flush=True)


def _secrets_present() -> bool:
    required = (
        DB_URL_ENV,
        ENCRYPTION_KEY_ENV,
    )
    db_and_enc = all(os.environ.get(name) for name in required)
    drive = drive_secrets_present()
    return db_and_enc and drive


def _decode_encryption_key(value: str) -> bytes:
    """Strict base64-decoded 32-byte key, fail closed on malformed input."""
    return decode_encryption_key(value)


def _run_dump(dump_path: str) -> None:
    # Bounded single-attempt dump with a sanitized argv; the connection value is
    # passed only through the child-only libpq environment (PGDATABASE).
    _log_phase("dump")
    cmd = [
        "pg_dump",
        "--format=custom",
        "--compress=9",
        "--no-owner",
        "--no-privileges",
        "--file",
        dump_path,
    ]
    child_env = {
        "PATH": os.environ.get("PATH", ""),
        "PGDATABASE": os.environ[DB_URL_ENV],
        "PGCONNECT_TIMEOUT": "15",
    }
    subprocess.run(
        cmd,
        check=True,
        capture_output=True,
        timeout=DUMP_TIMEOUT_SECONDS,
        env=child_env,
    )


def _is_non_empty(path: str) -> bool:
    try:
        return os.path.getsize(path) > 0
    except OSError:
        return False


def _streaming_encrypt(plain_path: str, enc_path: str, key: bytes, nonce: bytes) -> None:
    """Stream one parseable AEAD envelope: version + nonce + ciphertext + one tag.

    Uses the streaming Cipher API (update/finalize/tag) so the whole dump is never
    loaded into memory; chunk boundaries do not affect decryptability because the
    envelope carries a single final authentication tag.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    wrote_any = False
    with open(plain_path, "rb") as src, open(enc_path, "wb") as dst:
        dst.write(STREAM_AEAD_VERSION)
        dst.write(nonce)
        while True:
            chunk = src.read(STREAM_CHUNK_BYTES)
            if not chunk:
                break
            wrote_any = True
            dst.write(encryptor.update(chunk))
        if not wrote_any:
            raise ValueError("empty plaintext rejected")
        dst.write(encryptor.finalize())
        dst.write(encryptor.tag)  # single 16-byte authentication tag
    if not _is_non_empty(enc_path):
        raise ValueError("encrypted output empty")


def _streaming_decrypt(enc_path: str, out_path: str, key: bytes) -> None:
    """Decrypt a single AEAD envelope; raises on framing or authentication errors."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    with open(enc_path, "rb") as src:
        header = src.read(STREAM_AEAD_HEADER_BYTES)
        if len(header) != STREAM_AEAD_HEADER_BYTES or header[: len(STREAM_AEAD_VERSION)] != STREAM_AEAD_VERSION:
            raise ValueError("invalid envelope header")
        nonce = header[len(STREAM_AEAD_VERSION):]
        payload = src.read()
        if len(payload) <= STREAM_AEAD_TAG_BYTES:
            raise ValueError("invalid envelope payload")
        ciphertext = payload[:-STREAM_AEAD_TAG_BYTES]
        tag = payload[-STREAM_AEAD_TAG_BYTES:]
    decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
    with open(out_path, "wb") as dst:
        if ciphertext:
            dst.write(decryptor.update(ciphertext))
        decryptor.finalize()


def _drive_client():
    # Provider client construction is a narrow, sanitized boundary: the Drive
    # service carries a short-lived access token in memory only; no credential
    # value is logged or recorded.
    return build_drive_service()


def _unique_run_key() -> str:
    """UTC-based, cryptographically random, non-logged run key."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{stamp}-{uuid.uuid4().hex}"


def _retry_object(fn):
    # Bounded retry for idempotent provider operations only. The Drive adapter
    # also bounds its own retries; this helper documents the shared budget.
    last_error = None
    for attempt in range(OBJECT_RETRY_MAX):
        try:
            return fn()
        except Exception as exc:  # bounded retry; raw exceptions never escape to status/logs
            last_error = exc
            if attempt < OBJECT_RETRY_MAX - 1:
                time.sleep(OBJECT_RETRY_BACKOFF_SECONDS)
    raise last_error


def _drive_filename(prefix: str, run_key: str) -> str:
    # Opaque app-owned identity only: no host, db, url, user, owner, or product id.
    return prefix + "-" + run_key


def _quota_allows_upload(service, enc_path: str) -> bool:
    # Quota preflight is mandatory before any files.create. The Drive adapter
    # fetches the total account usage / provider storage limit (not only
    # Drive-file usage) and classifies against the internal 0.90 hard ceiling.
    # Insufficient quota or missing/unparseable quota fail closed: zero upload.
    expected_size = os.path.getsize(enc_path)
    if expected_size <= STREAM_AEAD_HEADER_BYTES + STREAM_AEAD_TAG_BYTES:
        _log_phase("upload_zero_or_truncated")
        return False
    state = drive_preflight_quota(service, expected_size)
    if state == DRIVE_STORAGE_WITHIN_LIMIT:
        _log_phase("quota_within_limit")
        return True
    if state == DRIVE_STORAGE_NEAR_LIMIT:
        _log_phase("quota_near_limit")
        return True
    # EXHAUSTED or AUTH_UNAVAILABLE: zero upload, no promotion.
    _log_phase("quota_exhausted")
    return False


def _verified_upload(service, run_key: str, enc_path: str) -> str | None:
    """Upload + verify the encrypted staging artifact; return the Drive file id.

    Returns the verified file id on success, or None on any upload/verification
    failure (including quota exhaustion). The file id is an opaque app-owned
    identity; it is never logged or recorded in status output.
    """
    expected_size = os.path.getsize(enc_path)
    if expected_size <= STREAM_AEAD_HEADER_BYTES + STREAM_AEAD_TAG_BYTES:
        _log_phase("upload_zero_or_truncated")
        return None
    # Quota must PASS before any upload attempt; otherwise zero upload.
    if not _quota_allows_upload(service, enc_path):
        return None
    _log_phase("staging_upload")
    staging_name = _drive_filename(TIER_STAGING, run_key)
    file_id = drive_create_file(
        service,
        staging_name,
        enc_path,
        TIER_STAGING,
        run_key,
    )
    _log_phase("head_verify")
    ok = drive_verify_file(service, file_id, expected_size, TIER_STAGING)
    if not ok:
        _log_phase("head_verification_failed")
        return None
    return file_id


@app.function(
    image=BACKUP_IMAGE,
    secrets=[
        modal.Secret.from_name(RECOVERY_DB_SECRET_NAME),
        modal.Secret.from_name(RECOVERY_DRIVE_SECRET_NAME),
        modal.Secret.from_name(RECOVERY_ENCRYPTION_SECRET_NAME),
    ],
    schedule=DAILY_SCHEDULE,
    timeout=FUNCTION_TIMEOUT_SECONDS,
)
def run_logical_backup() -> dict:
    """One compressed, encrypted, retained logical backup per 24-hour period."""
    if not _secrets_present():
        return make_sanitized_status(
            backup_point_state=BACKUP_POINT_MISSING,
            daily_tier=DAILY_TIER_MISSING,
            weekly_tier=WEEKLY_TIER_MISSING,
            monthly_tier=MONTHLY_TIER_MISSING,
            cleanup_state=CLEANUP_COMPLETE,
            external_storage_state=EXTERNAL_STORAGE_UNPROVISIONED,
            secret_boundary_state=SECRET_BOUNDARY_UNPROVISIONED,
            phase="secrets",
        )

    try:
        encryption_key = _decode_encryption_key(os.environ[ENCRYPTION_KEY_ENV])
    except Exception:
        return make_sanitized_status(
            backup_point_state=BACKUP_POINT_MISSING,
            daily_tier=DAILY_TIER_MISSING,
            weekly_tier=WEEKLY_TIER_MISSING,
            monthly_tier=MONTHLY_TIER_MISSING,
            cleanup_state=CLEANUP_COMPLETE,
            external_storage_state=EXTERNAL_STORAGE_UNPROVISIONED,
            secret_boundary_state=SECRET_BOUNDARY_UNPROVISIONED,
            phase="encryption",
        )

    try:
        workdir = tempfile.mkdtemp(prefix="lovebud-recovery-", dir="/tmp")
    except Exception:
        _log_phase("workdir_create_failed")
        return make_sanitized_status(
            backup_point_state=BACKUP_POINT_MISSING,
            daily_tier=DAILY_TIER_MISSING,
            weekly_tier=WEEKLY_TIER_MISSING,
            monthly_tier=MONTHLY_TIER_MISSING,
            cleanup_state=CLEANUP_FAILED,
            phase="cleanup",
        )
    dump_path = os.path.join(workdir, "backup.dump")
    enc_path = os.path.join(workdir, "backup.dump.enc")

    dump_ok = False
    encryption_ok = False
    plaintext_cleanup_ok = False
    upload_ok = False
    verify_ok = False
    daily_ok = False
    weekly_decided = False
    weekly_success = False
    monthly_decided = False
    monthly_success = False
    staging_delete_failed = False
    cleanup_ok = True

    service = None
    run_key = None
    staging_file_id = None
    daily_file_id = None

    try:
        # 3-4. dump + non-empty verification (single attempt, no unbounded retry)
        try:
            _run_dump(dump_path)
            dump_ok = _is_non_empty(dump_path)
        except Exception:
            dump_ok = False
        if not dump_ok:
            _log_phase("dump_failed")
        else:
            # 5. streaming AEAD envelope
            try:
                nonce = os.urandom(STREAM_AEAD_NONCE_BYTES)
                _streaming_encrypt(dump_path, enc_path, encryption_key, nonce)
                encryption_ok = True
            except Exception:
                encryption_ok = False
                _log_phase("encryption_failed")

            # 6. plaintext deletion is a separate failure boundary. Encryption
            # success is preserved if cleanup fails, and upload never starts.
            if encryption_ok:
                try:
                    os.remove(dump_path)
                    plaintext_cleanup_ok = True
                    _log_phase("plaintext_removed")
                except Exception:
                    plaintext_cleanup_ok = False
                    _log_phase("plaintext_cleanup_failed")

        if dump_ok and encryption_ok and plaintext_cleanup_ok:
            # Provider client construction is a narrow, sanitized boundary.
            try:
                service = _drive_client()
            except Exception:
                _log_phase("storage_client_failed")
                service = None
            if service is not None:
                run_key = _unique_run_key()
                # Upload and verification are a narrow, sanitized boundary: retry
                # exhaustion or unexpected provider responses never escape as raw
                # exceptions; the outcome is expressed in the sanitized status.
                # Quota preflight runs BEFORE any files.create (inside _verified_upload).
                try:
                    staging_file_id = _verified_upload(service, run_key, enc_path)
                    upload_ok = staging_file_id is not None
                    verify_ok = upload_ok
                except Exception:
                    upload_ok = False
                    verify_ok = False
                    _log_phase("upload_or_verification_failed")

        if dump_ok and encryption_ok and plaintext_cleanup_ok and upload_ok and verify_ok:
            # 9. daily promotion from the same encrypted artifact (never a second
            # dump). The Drive copy promotes the verified staging file to the
            # daily tier under the same app-owned run identity.
            try:
                _log_phase("daily_promote")
                daily_name = _drive_filename(TIER_DAILY, run_key)
                daily_file_id = drive_copy_file(
                    service, staging_file_id, daily_name, TIER_DAILY, run_key
                )
                daily_ok = True
            except Exception:
                daily_ok = False
                _log_phase("daily_promotion_failed")

        if daily_ok:
            # 10. independent weekly/monthly promotion from the same encrypted object
            now = datetime.now(timezone.utc)
            weekly_decided = decide_weekly_promotion(True, False, now.weekday())
            if weekly_decided:
                try:
                    _log_phase("weekly_promote")
                    weekly_name = _drive_filename(TIER_WEEKLY, run_key)
                    drive_copy_file(
                        service, daily_file_id, weekly_name, TIER_WEEKLY, run_key
                    )
                    weekly_success = True
                except Exception:
                    weekly_success = False
                    _log_phase("weekly_promotion_failed")
            monthly_decided = decide_monthly_promotion(True, False, now.day)
            if monthly_decided:
                try:
                    _log_phase("monthly_promote")
                    monthly_name = _drive_filename(TIER_MONTHLY, run_key)
                    drive_copy_file(
                        service, daily_file_id, monthly_name, TIER_MONTHLY, run_key
                    )
                    monthly_success = True
                except Exception:
                    monthly_success = False
                    _log_phase("monthly_promotion_failed")
            # 11. staging deletion; a failure is reflected as cleanup failure but
            # never deletes the valid daily object.
            try:
                _log_phase("staging_delete")
                drive_delete_file(service, staging_file_id)
            except Exception:
                staging_delete_failed = True
                _log_phase("staging_delete_failed")
            # 12. bounded retention cleanup: delete expired app-owned artifacts,
            # tier-scoped, newest valid point protected. Failures are reflected
            # as cleanup state only and never delete the valid daily point.
            for _tier, _keep in (
                (TIER_DAILY, RETENTION_DAILY_KEEP),
                (TIER_WEEKLY, RETENTION_WEEKLY_KEEP),
                (TIER_MONTHLY, RETENTION_MONTHLY_KEEP),
            ):
                try:
                    _log_phase("retention_cleanup")
                    tier_files = drive_list_tier_files(service, _tier)
                    for _expired_id in drive_select_deletions(tier_files, _keep):
                        drive_delete_file(service, _expired_id)
                except Exception:
                    staging_delete_failed = True
                    _log_phase("retention_cleanup_failed")
    finally:
        # 12. strict cleanup: failures are surfaced, never suppressed.
        try:
            shutil.rmtree(workdir)
            cleanup_ok = not staging_delete_failed
        except Exception:
            cleanup_ok = False
            _log_phase("cleanup_failed")

    return evaluate_run(
        dump_success=dump_ok,
        encryption_success=encryption_ok,
        plaintext_cleanup_success=plaintext_cleanup_ok,
        upload_complete=upload_ok,
        post_upload_verified=verify_ok,
        daily_promotion_success=daily_ok,
        weekly_promotion_decided=weekly_decided,
        weekly_promotion_success=weekly_success,
        monthly_promotion_decided=monthly_decided,
        monthly_promotion_success=monthly_success,
        cleanup_success=cleanup_ok,
    )
