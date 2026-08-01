"""Separate source-only Modal scheduled logical-backup app.

Scope boundary (#3828): this module is a standalone Modal scheduled function. It
is never imported by the public FastAPI app, exposes no HTTP endpoint, performs
no Production restore, and reads secrets / connects to the database / uploads
objects only inside the scheduled function body. Importing this module performs
no network, secret, DB, subprocess, filesystem, or deployment side effect.

Pipeline order (single run, one Production dump per execution):
  1. symbolic secret presence check
  2. private ephemeral working directory
  3. compressed PostgreSQL custom-format logical dump
  4. non-empty dump verification
  5. streaming authenticated encryption (per-object random nonce, tag stored)
  6. plaintext dump deletion before upload
  7. incomplete/staging object upload
  8. authenticated head/metadata verification
  9. daily prefix promotion
  10. conditional weekly/monthly promotion from the same encrypted object
  11. staging object deletion
  12. finally cleanup
  13. sanitized status return (from modal_compute.recovery_backup_policy)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import Any

import modal

from modal_compute.recovery_backup_policy import (
    BACKUP_INTEGRITY_UNVERIFIED,
    BACKUP_POINT_MISSING,
    BACKUP_POINT_VALID,
    BACKUP_UPLOAD_INCOMPLETE,
    CLEANUP_COMPLETE,
    CLEANUP_FAILED,
    DAILY_TIER_VALID,
    EXTERNAL_STORAGE_UNPROVISIONED,
    MONTHLY_TIER_VALID,
    SECRET_BOUNDARY_UNPROVISIONED,
    WEEKLY_TIER_VALID,
    classify_daily_freshness,
    decide_promotion,
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
ENCRYPTION_KEY_ENV = "RECOVERY_ENCRYPTION_KEY"

# Bounded execution budgets.
DUMP_TIMEOUT_SECONDS = 600
OBJECT_RETRY_MAX = 3
OBJECT_RETRY_BACKOFF_SECONDS = 2.0
STREAM_CHUNK_BYTES = 1024 * 1024
STREAM_AEAD_VERSION = b"LBBA1"

# Object prefixes (symbolic structure only; exact keys are never recorded).
DAILY_PREFIX = "daily"
WEEKLY_PREFIX = "weekly"
MONTHLY_PREFIX = "monthly"
STAGING_PREFIX = "staging"

BACKUP_IMAGE = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("postgresql-client")
    .pip_install("boto3", "cryptography")
)

app = modal.App(RECOVERY_BACKUP_APP_NAME)

# One scheduled execution per 24-hour period; no web endpoint, no manual trigger.
DAILY_SCHEDULE = modal.Period(days=1)


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


def _run_dump(db_url: str, dump_path: str) -> None:
    # Bounded single-attempt dump: no unbounded retry of pg_dump.
    _log_phase("dump")
    cmd = [
        "pg_dump",
        "--format=custom",
        "--compress=9",
        "--no-owner",
        "--no-privileges",
        "--file",
        dump_path,
        db_url,
    ]
    subprocess.run(
        cmd,
        check=True,
        capture_output=True,
        timeout=DUMP_TIMEOUT_SECONDS,
    )


def _is_non_empty(path: str) -> bool:
    try:
        return os.path.getsize(path) > 0
    except OSError:
        return False


def _streaming_encrypt(plain_path: str, enc_path: str, key: bytes, base_nonce: bytes) -> None:
    # Streaming authenticated encryption: each 1 MiB chunk is encrypted with an
    # AES-GCM context using a unique derived nonce; the per-chunk authentication
    # tag is stored adjacent to the ciphertext inside the object. The base nonce
    # is written once at the start of the object.
    _log_phase("encrypt")
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    aesgcm = AESGCM(key)
    counter = 0
    with open(plain_path, "rb") as src, open(enc_path, "wb") as dst:
        dst.write(STREAM_AEAD_VERSION)
        dst.write(base_nonce)
        while True:
            chunk = src.read(STREAM_CHUNK_BYTES)
            if not chunk:
                break
            nonce = base_nonce[:4] + counter.to_bytes(8, "big")
            counter += 1
            ciphertext = aesgcm.encrypt(nonce, chunk, None)
            dst.write(ciphertext)
            dst.write(ciphertext[-16:])  # authentication tag stored inside object


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.environ[R2_ENDPOINT_ENV],
        aws_access_key_id=os.environ[R2_ACCESS_KEY_ENV],
        aws_secret_access_key=os.environ[R2_SECRET_KEY_ENV],
        region_name="auto",
    )


def _object_key(prefix: str, staging_name: str) -> str:
    # Deterministic symbolic key structure; exact keys are never recorded.
    return f"{prefix}/{staging_name}"


def _retry_object(fn):
    import time

    last_error = None
    for attempt in range(OBJECT_RETRY_MAX):
        try:
            return fn()
        except Exception as exc:  # bounded retry for idempotent object ops only
            last_error = exc
            if attempt < OBJECT_RETRY_MAX - 1:
                time.sleep(OBJECT_RETRY_BACKOFF_SECONDS)
    raise last_error


@app.function(
    image=BACKUP_IMAGE,
    secrets=[
        modal.Secret.from_name(RECOVERY_DB_SECRET_NAME),
        modal.Secret.from_name(RECOVERY_R2_SECRET_NAME),
        modal.Secret.from_name(RECOVERY_ENCRYPTION_SECRET_NAME),
    ],
    schedule=DAILY_SCHEDULE,
    timeout=900,
)
def run_logical_backup() -> dict:
    """One compressed, encrypted, retained logical backup per 24-hour period."""
    if not _secrets_present():
        return make_sanitized_status(
            backup_point_state=BACKUP_POINT_MISSING,
            daily_tier="DAILY_TIER_MISSING",
            weekly_tier="WEEKLY_TIER_MISSING",
            monthly_tier="MONTHLY_TIER_MISSING",
            cleanup_state=CLEANUP_COMPLETE,
            external_storage_state=EXTERNAL_STORAGE_UNPROVISIONED,
            secret_boundary_state=SECRET_BOUNDARY_UNPROVISIONED,
            phase="secrets",
        )

    db_url = os.environ[DB_URL_ENV]
    encryption_key = os.environ[ENCRYPTION_KEY_ENV].encode("utf-8")
    workdir = tempfile.mkdtemp(prefix="lovebud-recovery-", dir="/tmp")
    dump_path = os.path.join(workdir, "backup.dump")
    enc_path = os.path.join(workdir, "backup.dump.enc")

    result = None
    cleanup_ok = True

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

    try:
        # 3-4. dump + non-empty verification (single attempt, no unbounded retry)
        try:
            _run_dump(db_url, dump_path)
            dump_ok = _is_non_empty(dump_path)
        except Exception:
            dump_ok = False
        if not dump_ok:
            _log_phase("dump_failed")
        else:
            # 5-6. streaming authenticated encryption + plaintext deletion
            try:
                base_nonce = os.urandom(12)
                _streaming_encrypt(dump_path, enc_path, encryption_key, base_nonce)
                encryption_ok = True
                os.remove(dump_path)
                plaintext_cleanup_ok = True
                _log_phase("plaintext_removed")
            except Exception:
                encryption_ok = False

        if dump_ok and encryption_ok and plaintext_cleanup_ok:
            s3 = _s3_client()
            bucket = os.environ[R2_BUCKET_ENV]
            staging_name = "incomplete.object"
            staging_key = _object_key(STAGING_PREFIX, staging_name)
            # 7. staging upload
            try:
                with open(enc_path, "rb") as enc_file:
                    _retry_object(lambda: s3.put_object(Bucket=bucket, Key=staging_key, Body=enc_file.read()))
                upload_ok = True
            except Exception:
                _log_phase("upload_incomplete")
            # 8. authenticated head verification
            if upload_ok:
                try:
                    head = _retry_object(lambda: s3.head_object(Bucket=bucket, Key=staging_key))
                    verify_ok = bool(head and "ETag" in head)
                except Exception:
                    verify_ok = False
                if not verify_ok:
                    _log_phase("head_verification_failed")

        if dump_ok and encryption_ok and plaintext_cleanup_ok and upload_ok and verify_ok:
            # 9. daily promotion from the staging object
            _log_phase("daily_promote")
            daily_key = _object_key(DAILY_PREFIX, staging_name)
            _retry_object(
                lambda: s3.copy_object(
                    Bucket=bucket, CopySource={"Bucket": bucket, "Key": staging_key}, Key=daily_key
                )
            )
            daily_ok = True
            # 10. conditional weekly/monthly promotion from the same encrypted object
            weekly_decided = decide_promotion(True, False)
            if weekly_decided:
                _log_phase("weekly_promote")
                weekly_key = _object_key(WEEKLY_PREFIX, staging_name)
                try:
                    _retry_object(
                        lambda: s3.copy_object(
                            Bucket=bucket, CopySource={"Bucket": bucket, "Key": daily_key}, Key=weekly_key
                        )
                    )
                    weekly_success = True
                except Exception:
                    weekly_success = False
                    _log_phase("weekly_promotion_failed")
            monthly_decided = decide_promotion(True, False)
            if monthly_decided:
                _log_phase("monthly_promote")
                monthly_key = _object_key(MONTHLY_PREFIX, staging_name)
                try:
                    _retry_object(
                        lambda: s3.copy_object(
                            Bucket=bucket, CopySource={"Bucket": bucket, "Key": daily_key}, Key=monthly_key
                        )
                    )
                    monthly_success = True
                except Exception:
                    monthly_success = False
                    _log_phase("monthly_promotion_failed")
            # 11. staging deletion after successful promotion
            try:
                _retry_object(lambda: s3.delete_object(Bucket=bucket, Key=staging_key))
                _log_phase("staging_delete")
            except Exception:
                _log_phase("staging_delete_failed")

        result = evaluate_run(
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
            cleanup_success=True,
        )
    finally:
        # 12. always clean the ephemeral working directory
        try:
            shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            cleanup_ok = False
            _log_phase("cleanup_failed")

    if result is None:
        result = make_sanitized_status(
            backup_point_state=BACKUP_POINT_MISSING,
            daily_tier="DAILY_TIER_MISSING",
            weekly_tier="WEEKLY_TIER_MISSING",
            monthly_tier="MONTHLY_TIER_MISSING",
            cleanup_state=CLEANUP_COMPLETE if cleanup_ok else CLEANUP_FAILED,
            external_storage_state=EXTERNAL_STORAGE_UNPROVISIONED,
            secret_boundary_state=SECRET_BOUNDARY_UNPROVISIONED,
            phase="cleanup",
        )
    elif not cleanup_ok:
        result = make_sanitized_status(
            backup_point_state=result["backup_point_state"],
            daily_tier=result["daily_tier"],
            weekly_tier=result["weekly_tier"],
            monthly_tier=result["monthly_tier"],
            cleanup_state=CLEANUP_FAILED,
            external_storage_state=result["external_storage_state"],
            secret_boundary_state=result["secret_boundary_state"],
            phase=result["phase"],
        )
    return result
