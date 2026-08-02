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
from typing import Any

import modal

from modal_compute.recovery_backup_policy import (
    BACKUP_POINT_MISSING,
    CLEANUP_COMPLETE,
    CLEANUP_FAILED,
    DAILY_TIER_MISSING,
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

# Fixed symbolic identifiers (values are never logged or recorded).
RECOVERY_BACKUP_APP_NAME = "lovebud-recovery-backup"
RECOVERY_DB_SECRET_NAME = "lovebud-db"
RECOVERY_R2_SECRET_NAME = "lovebud-recovery-r2"
RECOVERY_ENCRYPTION_SECRET_NAME = "lovebud-recovery-encryption"

# Symbolic environment names read from the injected secrets.
DB_URL_ENV = "DATABASE_URL"
R2_ACCOUNT_ID_ENV = "R2_ACCOUNT_ID"
R2_ACCESS_KEY_ENV = "R2_ACCESS_KEY_ID"
R2_SECRET_KEY_ENV = "R2_SECRET_ACCESS_KEY"
R2_BUCKET_ENV = "R2_BUCKET_NAME"
R2_ENDPOINT_ENV = "R2_ENDPOINT_URL"
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

# Fixed non-private object metadata written at upload time.
R2_OBJECT_METADATA = {
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
    .pip_install("boto3", "cryptography")
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
        R2_ACCOUNT_ID_ENV,
        R2_ACCESS_KEY_ENV,
        R2_SECRET_KEY_ENV,
        R2_BUCKET_ENV,
        R2_ENDPOINT_ENV,
        ENCRYPTION_KEY_ENV,
    )
    return all(os.environ.get(name) for name in required)


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


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.environ[R2_ENDPOINT_ENV],
        aws_access_key_id=os.environ[R2_ACCESS_KEY_ENV],
        aws_secret_access_key=os.environ[R2_SECRET_KEY_ENV],
        region_name="auto",
    )


def _unique_run_key() -> str:
    """UTC-based, cryptographically random, non-logged run key."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{stamp}-{uuid.uuid4().hex}"


def _object_key(prefix: str, run_key: str) -> str:
    return f"{prefix}/{run_key}"


def _retry_object(fn):
    last_error = None
    for attempt in range(OBJECT_RETRY_MAX):
        try:
            return fn()
        except Exception as exc:  # bounded retry for idempotent object ops only
            last_error = exc
            if attempt < OBJECT_RETRY_MAX - 1:
                time.sleep(OBJECT_RETRY_BACKOFF_SECONDS)
    raise last_error


def _upload_attempt(s3, bucket: str, key: str, enc_path: str) -> Any:
    # Retry-safe streaming upload: every attempt reopens the file with a fresh
    # cursor, and boto3 streams the file object instead of a whole-file read.
    with open(enc_path, "rb") as body:
        return s3.put_object(Bucket=bucket, Key=key, Body=body, Metadata=R2_OBJECT_METADATA)


def _verified_upload(s3, bucket: str, key: str, enc_path: str) -> bool:
    expected_size = os.path.getsize(enc_path)
    if expected_size <= STREAM_AEAD_HEADER_BYTES + STREAM_AEAD_TAG_BYTES:
        _log_phase("upload_zero_or_truncated")
        return False
    _log_phase("staging_upload")
    _retry_object(lambda: _upload_attempt(s3, bucket, key, enc_path))
    _log_phase("head_verify")
    head = _retry_object(lambda: s3.head_object(Bucket=bucket, Key=key))
    meta = (head.get("Metadata") or {}) if head else {}
    ok = bool(
        head
        and head.get("ContentLength") == expected_size
        and expected_size > STREAM_AEAD_HEADER_BYTES + STREAM_AEAD_TAG_BYTES
        and meta.get("format-version") == R2_OBJECT_METADATA["format-version"]
        and meta.get("content-kind") == R2_OBJECT_METADATA["content-kind"]
    )
    if not ok:
        _log_phase("head_verification_failed")
    return ok


@app.function(
    image=BACKUP_IMAGE,
    secrets=[
        modal.Secret.from_name(RECOVERY_DB_SECRET_NAME),
        modal.Secret.from_name(RECOVERY_R2_SECRET_NAME),
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

    workdir = tempfile.mkdtemp(prefix="lovebud-recovery-", dir="/tmp")
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

    s3 = None
    bucket = None
    run_key = None
    staging_key = None

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
            # 5-6. streaming AEAD envelope + plaintext deletion
            try:
                nonce = os.urandom(STREAM_AEAD_NONCE_BYTES)
                _streaming_encrypt(dump_path, enc_path, encryption_key, nonce)
                encryption_ok = True
                os.remove(dump_path)
                plaintext_cleanup_ok = True
                _log_phase("plaintext_removed")
            except Exception:
                encryption_ok = False
                _log_phase("encryption_failed")

        if dump_ok and encryption_ok and plaintext_cleanup_ok:
            # Provider client construction is a narrow, sanitized boundary.
            try:
                s3 = _s3_client()
            except Exception:
                _log_phase("storage_client_failed")
                s3 = None
            if s3 is not None:
                bucket = os.environ[R2_BUCKET_ENV]
                run_key = _unique_run_key()
                staging_key = _object_key(STAGING_PREFIX, run_key)
                # Upload and verification are a narrow, sanitized boundary: retry
                # exhaustion or unexpected provider responses never escape as raw
                # exceptions; the outcome is expressed in the sanitized status.
                try:
                    upload_ok = _verified_upload(s3, bucket, staging_key, enc_path)
                    verify_ok = upload_ok
                except Exception:
                    upload_ok = False
                    verify_ok = False
                    _log_phase("upload_or_verification_failed")

        if dump_ok and encryption_ok and plaintext_cleanup_ok and upload_ok and verify_ok:
            # 9. daily promotion from the staging object under the unique run key
            daily_key = _object_key(DAILY_PREFIX, run_key)
            try:
                _log_phase("daily_promote")
                _retry_object(
                    lambda: s3.copy_object(
                        Bucket=bucket, CopySource={"Bucket": bucket, "Key": staging_key}, Key=daily_key
                    )
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
                weekly_key = _object_key(WEEKLY_PREFIX, run_key)
                try:
                    _log_phase("weekly_promote")
                    _retry_object(
                        lambda: s3.copy_object(
                            Bucket=bucket, CopySource={"Bucket": bucket, "Key": daily_key}, Key=weekly_key
                        )
                    )
                    weekly_success = True
                except Exception:
                    weekly_success = False
                    _log_phase("weekly_promotion_failed")
            monthly_decided = decide_monthly_promotion(True, False, now.day)
            if monthly_decided:
                monthly_key = _object_key(MONTHLY_PREFIX, run_key)
                try:
                    _log_phase("monthly_promote")
                    _retry_object(
                        lambda: s3.copy_object(
                            Bucket=bucket, CopySource={"Bucket": bucket, "Key": daily_key}, Key=monthly_key
                        )
                    )
                    monthly_success = True
                except Exception:
                    monthly_success = False
                    _log_phase("monthly_promotion_failed")
            # 11. staging deletion; a failure is reflected as cleanup failure but
            # never deletes the valid daily object.
            try:
                _log_phase("staging_delete")
                _retry_object(lambda: s3.delete_object(Bucket=bucket, Key=staging_key))
            except Exception:
                staging_delete_failed = True
                _log_phase("staging_delete_failed")
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
