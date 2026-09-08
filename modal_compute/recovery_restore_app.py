"""Operator-only isolated restore orchestration (source/test seam for #3460).

Scope boundary (#3460 restore source child; provider parents #3894 / #4137): this
module prepares the future authorized restore drill WITHOUT executing any real
restore. It is import-hermetic: importing it performs no network, Drive call, DB
connection, subprocess, filesystem, or deployment side effect, and it never imports
Modal, FastAPI, requests, psycopg, or any provider library at module scope. Every
live operation happens only inside explicitly called functions with explicitly
injected dependencies (dependency injection), and only when a caller provides a
bounded, explicitly classified ISOLATED_RESTORE_TARGET.

This is NOT a Production restore tool. The source is architecturally incapable of
silently targeting Production:

    RESTORE_TARGET = EXPLICIT_ISOLATED_TARGET_ONLY
    DEFAULT_PRODUCTION_TARGET = NONE
    AUTOMATIC_TARGET_DISCOVERY = FORBIDDEN
    PRODUCTION_DATABASE_URL_FALLBACK = FORBIDDEN

Canonical Product credential names (LOVE_PLATFORM_DATABASE_URL,
LOVE_PLATFORM_WRITE_DATABASE_URL, DATABASE_URL) and the backup source DB URL must
never be accepted as the restore target. A future execution path must supply an
explicit restore-only target credential boundary (symbolic suggestion consistent
with repository conventions: `lovebud-recovery-restore-target`; no real secret is
created by this task). Missing or ambiguous target = STOP (fail closed).

No HTTP endpoint, no schedule, no Modal app: this operator path is never imported by
modal_compute/app.py, functions/api/**, or functions/_shared/**.

Non-actions (this module authorizes none of these):
    no Google OAuth / consent / token creation
    no real Drive download / upload / delete
    no Modal secret mutation / deploy / schedule
    no Production DB connection / pg_dump / pg_restore / DDL / DML
    no real backup or restore execution
    no Neon branch or provider mutation
    no destructive pg_restore flags (no database-replacing or object-dropping flags)
    no blind retry of pg_restore
    no Product counts / row contents / identifiers in any status
"""

from __future__ import annotations

import os
import shutil
import tempfile
from typing import Any, Callable, Mapping

from modal_compute.recovery_backup_policy import (
    RESTORE_ARTIFACT_INVALID,
    RESTORE_ARTIFACT_NOT_FOUND,
    RESTORE_AUTH_UNAVAILABLE,
    RESTORE_CLEANUP_FAILED,
    RESTORE_COMMAND_FAILED,
    RESTORE_SOURCE_READY,
    RESTORE_SUCCESS,
    RESTORE_TARGET_CLASS_ISOLATED,
    RESTORE_TARGET_INVALID,
    RESTORE_VERIFICATION_FAILED,
    RESTORE_VERIFY_INVARIANTS_PASS,
    classify_restore_target,
    evaluate_restore_verification,
    make_restore_status,
)
from modal_compute.recovery_backup_stream import (
    STREAM_AEAD_HEADER_BYTES,
    STREAM_AEAD_TAG_BYTES,
    streaming_decrypt,
)

# --- symbolic boundaries (values are never logged or recorded) -------------
# Explicit restore-only target credential boundary recommendation. This task does
# NOT create or mutate any secret; a future authorized operator provisions it.
RESTORE_TARGET_SECRET_NAME = "lovebud-recovery-restore-target"
RESTORE_TARGET_URL_ENV = "RESTORE_TARGET_DATABASE_URL"
RESTORE_TARGET_CLASS_ENV = "RESTORE_TARGET_CLASS"

# Symbolic environment names required from the injected Drive + encryption secrets.
DRIVE_SECRET_NAME = "lovebud-recovery-drive"
DRIVE_CLIENT_ID_ENV = "DRIVE_CLIENT_ID"
DRIVE_CLIENT_SECRET_ENV = "DRIVE_CLIENT_SECRET"
DRIVE_REFRESH_TOKEN_ENV = "DRIVE_REFRESH_TOKEN"
DRIVE_BACKUP_ROOT_ENV = "DRIVE_BACKUP_ROOT"
ENCRYPTION_KEY_ENV = "RECOVERY_ENCRYPTION_KEY_B64"

# Bounded subprocess boundary for the future pg_restore invocation. Only non-
# destructive flags are permitted; the isolated target is provisioned/prepared
# separately by an explicitly authorized operator. No blind retry.
PG_RESTORE_TIMEOUT_SECONDS = 1800
PG_RESTORE_PASSWORD_ENV = "PGPASSWORD"

# Count of bytes the operator accepts from Drive before decrypt (hard bound aligned
# with the Drive adapter bound; kept local so the seam is self-contained).
RESTORE_MAX_ARTIFACT_BYTES = 20 * 1024 * 1024 * 1024  # 20 GiB

ALLOWED_RESTORE_TARGET_CLASSES = frozenset((RESTORE_TARGET_CLASS_ISOLATED,))


def restore_secrets_present() -> bool:
    """Symbolic presence check for the restore-path secrets; never reads values.

    Requires at minimum the Drive OAuth material, the encryption key, and an
    explicit restore-only target authority (URL + isolated class). Missing any
    required value fails closed downstream (never falls back to Product names).
    """
    required = (
        DRIVE_CLIENT_ID_ENV,
        DRIVE_REFRESH_TOKEN_ENV,
        DRIVE_BACKUP_ROOT_ENV,
        ENCRYPTION_KEY_ENV,
    )
    return all(os.environ.get(name) for name in required) and restore_target_env_present()


def restore_target_env_present() -> bool:
    """True only when an explicit restore target URL and isolated class are set."""
    return bool(os.environ.get(RESTORE_TARGET_URL_ENV)) and bool(os.environ.get(RESTORE_TARGET_CLASS_ENV))


def _read_target_class() -> str | None:
    value = os.environ.get(RESTORE_TARGET_CLASS_ENV)
    if value in ALLOWED_RESTORE_TARGET_CLASSES:
        return value
    return None


def classify_current_target() -> str:
    """Fail-closed target classification against the current process environment.

    Returns RESTORE_TARGET_VALID only when an explicit isolated restore target URL
    exists, its class is exactly ISOLATED_RESTORE_TARGET, and no canonical Product
    credential name or the backup source DB URL is in use. Never reads or logs any
    secret value.
    """
    return classify_restore_target(
        restore_target_url_present=bool(os.environ.get(RESTORE_TARGET_URL_ENV)),
        restore_target_class=_read_target_class(),
        forbidden_credential_names_present=(
            bool(os.environ.get("LOVE_PLATFORM_DATABASE_URL"))
            or bool(os.environ.get("LOVE_PLATFORM_WRITE_DATABASE_URL"))
            or bool(os.environ.get("DATABASE_URL"))
        ),
        source_db_url_present=bool(os.environ.get("DATABASE_URL")),
    )


def _make_restore_status(**fields: Any) -> dict:
    return make_restore_status(**fields)


def _target_arg() -> str:
    """The explicit restore-only target URL (fail closed when absent/ambiguous)."""
    if classify_current_target() != "RESTORE_TARGET_VALID":
        raise RuntimeError("restore target invalid")
    return os.environ[RESTORE_TARGET_URL_ENV]


def _build_restore_command(target_url: str) -> list:
    """Narrow non-destructive pg_restore argv.

    Only --no-owner / --no-privileges plus a redundant --exit-on-error guard are
    included. No database-replacing, schema-wiping, or object-dropping flags are
    present by default: the isolated target is provisioned/prepared separately by
    an explicitly authorized future operator. The target is passed only through the
    child-only PGDATABASE environment so the URL never appears in argv or logs.
    """
    return [
        "pg_restore",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--file",
        "-",
    ]


def _run_pg_restore(
    plain_path: str,
    target_url: str,
    *,
    executor: Callable[..., Any] | None = None,
) -> int:
    """Narrow bounded pg_restore subprocess boundary (single attempt, no blind retry).

    `executor` is an injected callable for deterministic source tests; it receives
    (cmd, env) and must return an object with `.returncode`. The child environment
    carries only PATH, PGDATABASE (the explicit isolated target), PGPASSWORD-adjacent
    values are deliberately NOT auto-injected: a future authorized operator supplies
    the target credential boundary separately (e.g. libpq uses the URL's userinfo or
    a dedicated restore-only secret). Raw stderr is captured and never returned.
    The subprocess module is imported lazily so importing this module stays fully
    hermetic (no subprocess capability is even loaded at import time).
    """
    cmd = _build_restore_command("")
    child_env = {"PATH": os.environ.get("PATH", ""), "PGDATABASE": target_url}
    if executor is not None:
        result = executor([*cmd, plain_path], child_env)
    else:
        import subprocess

        try:
            result = subprocess.run(
                [*cmd, plain_path],
                check=False,
                capture_output=True,
                timeout=PG_RESTORE_TIMEOUT_SECONDS,
                env=child_env,
            )
        except subprocess.TimeoutExpired:
            return 1
    return int(getattr(result, "returncode", 1))


# --- injected seam types (deterministic source tests) -----------------------
Service = Any
DownloadFn = Callable[..., None]
DecryptFn = Callable[[str, str, bytes], None]
VerifyFn = Callable[[str], str]


def _plain_artifact_valid(enc_path: str, plain_path: str) -> bool:
    """Artifact validity that never depends on Product state.

    The encrypted artifact must be non-empty, carry a recognized LBBA1 header, and
    contain at least one authentication tag; the plaintext produced by decrypt must
    be non-empty. Authentication is enforced by streaming_decrypt (AES-GCM tag).
    """
    try:
        if os.path.getsize(enc_path) <= STREAM_AEAD_HEADER_BYTES + STREAM_AEAD_TAG_BYTES:
            return False
        with open(enc_path, "rb") as fh:
            header = fh.read(STREAM_AEAD_HEADER_BYTES)
        if header[:5] != b"LBBA1":
            return False
        if not os.path.getsize(plain_path) > 0:
            return False
        return True
    except OSError:
        return False


def run_isolated_restore(
    *,
    drive_service: Service,
    file_id: str,
    expected_size: int,
    expected_retention_tier: str | None,
    expected_run_identity: str | None,
    encryption_key: bytes,
    download_fn: DownloadFn,
    decrypt_fn: DecryptFn = streaming_decrypt,
    verify_fn: VerifyFn,
    pg_restore_executor: Callable[..., Any] | None = None,
    workdir: str | None = None,
) -> dict:
    """Execute one isolated restore attempt entirely through injected boundaries.

    The default `decrypt_fn` is the shared LBBA1 AES-GCM streaming_decrypt. This
    function performs no real network/Drive/DB/subprocess unless the caller supplies
    live implementations; the operator path is reached only with an explicit
    isolated target (checked by `classify_current_target` before any download).

    Ordering (strict, cleanup on every failure path):
      target classification -> download -> decrypt -> pg_restore -> verification
      -> plaintext cleanup -> encrypted temp cleanup (finally).

    Returns a sanitized status only; no raw provider/DB/secret value ever escapes.
    A temp-artifact cleanup failure downgrades the outcome to
    RESTORE_CLEANUP_FAILED (never a silent success with leftover plaintext).
    """
    if classify_current_target() != "RESTORE_TARGET_VALID":
        return _make_restore_status(
            restore_state=RESTORE_TARGET_INVALID,
            target_state=RESTORE_TARGET_INVALID,
            phase="target",
        )

    owned_workdir = None
    enc_path = None
    plain_path = None
    cleanup_failed = False
    status: dict | None = None
    try:
        if workdir is None:
            owned_workdir = tempfile.mkdtemp(prefix="lovebud-restore-", dir="/tmp")
            workdir = owned_workdir
        enc_path = os.path.join(workdir, "recovery.enc")
        plain_path = os.path.join(workdir, "recovery.dump")

        try:
            download_fn(
                drive_service,
                file_id,
                enc_path,
                expected_size=expected_size,
                expected_retention_tier=expected_retention_tier,
                expected_run_identity=expected_run_identity,
                max_bytes=RESTORE_MAX_ARTIFACT_BYTES,
            )
        except Exception:
            status = _make_restore_status(
                restore_state=RESTORE_ARTIFACT_NOT_FOUND,
                artifact_state=RESTORE_ARTIFACT_NOT_FOUND,
                phase="artifact_metadata",
            )

        if status is None:
            try:
                decrypt_fn(enc_path, plain_path, encryption_key)
            except Exception:
                status = _make_restore_status(
                    restore_state=RESTORE_ARTIFACT_INVALID,
                    artifact_state=RESTORE_ARTIFACT_INVALID,
                    phase="decrypt",
                )

        if status is None and not _plain_artifact_valid(enc_path, plain_path):
            status = _make_restore_status(
                restore_state=RESTORE_ARTIFACT_INVALID,
                artifact_state=RESTORE_ARTIFACT_INVALID,
                phase="decrypt",
            )

        if status is None:
            target_url = _target_arg()  # fail closed again before any subprocess
            rc = _run_pg_restore(
                plain_path,
                target_url,
                executor=pg_restore_executor,
            )
            if rc != 0:
                status = _make_restore_status(
                    restore_state=RESTORE_COMMAND_FAILED,
                    phase="restore_command",
                )

        if status is None:
            verification = verify_fn(target_url)
            if verification != RESTORE_VERIFY_INVARIANTS_PASS:
                status = _make_restore_status(
                    restore_state=RESTORE_VERIFICATION_FAILED,
                    verification_state=verification,
                    phase="verification",
                )

        if status is None:
            status = _make_restore_status(
                restore_state=RESTORE_SUCCESS,
                verification_state=RESTORE_VERIFY_INVARIANTS_PASS,
                phase=None,
            )
    finally:
        if enc_path is not None and os.path.exists(enc_path):
            try:
                os.remove(enc_path)
            except OSError:
                cleanup_failed = True
        if plain_path is not None and os.path.exists(plain_path):
            try:
                os.remove(plain_path)
            except OSError:
                cleanup_failed = True
        if owned_workdir is not None and os.path.exists(owned_workdir):
            try:
                shutil.rmtree(owned_workdir)
            except OSError:
                cleanup_failed = True

    if cleanup_failed and status is not None:
        # A cleanup failure is surfaced as a bounded status without raw detail:
        # the outcome downgrades to RESTORE_CLEANUP_FAILED so a leftover plaintext
        # or encrypted artifact can never be reported as a silent success.
        status = _make_restore_status(
            restore_state=RESTORE_CLEANUP_FAILED,
            cleanup_state="CLEANUP_FAILED",
            phase="cleanup",
        )
    return status


__all__ = [
    "RESTORE_TARGET_SECRET_NAME",
    "RESTORE_TARGET_URL_ENV",
    "RESTORE_TARGET_CLASS_ENV",
    "PG_RESTORE_TIMEOUT_SECONDS",
    "restore_secrets_present",
    "restore_target_env_present",
    "classify_current_target",
    "_build_restore_command",
    "_run_pg_restore",
    "run_isolated_restore",
]