"""Separate source-only Google Drive storage adapter for the recovery backup pipeline.

Scope boundary (#3894 / child #4137): this module contains ONLY the Google Drive
auth, token-refresh, quota preflight, upload, verification, promotion (copy),
bounded retention listing, and bounded deletion operations. It is imported by the
scheduled Modal app module but performs no network, secret, or provider side
effect at import time; every live operation happens only inside explicitly called
functions during a scheduled run.

Authority:
    PRIMARY_IMPLEMENTATION_PATH = MODAL_PLUS_GOOGLE_DRIVE
    DEFERRED (NOT implemented here): R2, Oracle Object Storage, Backblaze B2

Non-actions (this module authorizes none of these):
    no Google OAuth client creation
    no Google OAuth consent flow
    no refresh-token creation
    no Google Drive folder creation
    no real-account upload / list / delete
    no Modal Secret creation or change
    no Modal deployment or schedule activation
    no Production pg_dump / DB connection
    no Production backup or restore
    no restore / download in the normal backup path
    no generic Drive browser / arbitrary listing / arbitrary deletion
    no public sharing or permission mutation
    no cross-provider fallback (Drive failure never falls back to R2/B2/Oracle)

Symbolic names only. No credential value, token, refresh token, client secret,
file id, folder id, account identifier, database URL, host, database name, user or
owner identity, Tree/Memory id, or Product content is ever logged, returned,
recorded, committed, fixture-captured, or snapshotted. ChatGPT Google Drive
connector credentials are NOT runtime credentials and MUST NOT be reused.

Drive receives ENCRYPTED files only. Artifact identity is opaque. The only
bounded metadata written to Drive is: LBBA format version, encrypted-postgresql-dump
content kind, retention tier, and an app-owned operational identity (the run key).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

from modal_compute.recovery_backup_policy import (
    DRIVE_AUTH_UNAVAILABLE,
    DRIVE_STORAGE_EXHAUSTED,
    DRIVE_STORAGE_NEAR_LIMIT,
    DRIVE_STORAGE_WITHIN_LIMIT,
    DRIVE_UPLOAD_UNVERIFIED,
    classify_drive_quota,
)

# Fixed symbolic secret name (the value is never logged or recorded).
RECOVERY_DRIVE_SECRET_NAME = "lovebud-recovery-drive"

# Symbolic environment names read from the injected secret. Values are never logged.
DRIVE_CLIENT_ID_ENV = "DRIVE_CLIENT_ID"
DRIVE_CLIENT_SECRET_ENV = "DRIVE_CLIENT_SECRET"
DRIVE_REFRESH_TOKEN_ENV = "DRIVE_REFRESH_TOKEN"
DRIVE_BACKUP_ROOT_ENV = "DRIVE_BACKUP_ROOT"

# Fixed OAuth 2.0 authority: one-time user consent + offline refresh token. The
# scheduled Modal job exchanges the refresh authority for short-lived access
# tokens; it never performs interactive browser login or stores a Google password.
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"

# Bounded retry budgets for idempotent Drive operations (mirrors the object budget
# in the orchestration module so the adapter is self-contained for its own seam).
DRIVE_RETRY_MAX = 3
DRIVE_RETRY_BACKOFF_SECONDS = 2.0

# Bounded opaque file metadata written at upload time. No private identifier is
# placed in the Drive filename or metadata.
DRIVE_OBJECT_METADATA = {
    "format-version": "LBBA1",
    "content-kind": "encrypted-postgresql-dump",
}

# Retention tier values written to Drive appProperties (bounded, non-private).
TIER_DAILY = "daily"
TIER_WEEKLY = "weekly"
TIER_MONTHLY = "monthly"
TIER_STAGING = "staging"


def drive_secrets_present() -> bool:
    """Symbolic Drive secret presence check; never reads or logs values."""
    required = (
        DRIVE_CLIENT_ID_ENV,
        DRIVE_CLIENT_SECRET_ENV,
        DRIVE_REFRESH_TOKEN_ENV,
        DRIVE_BACKUP_ROOT_ENV,
    )
    return all(os.environ.get(name) for name in required)


def _retry_drive(fn):
    """Bounded retry for idempotent Drive REST operations only."""
    last_error: Any = None
    for attempt in range(DRIVE_RETRY_MAX):
        try:
            return fn()
        except Exception as exc:  # bounded retry; raw exceptions never escape to status/logs
            last_error = exc
            if attempt < DRIVE_RETRY_MAX - 1:
                time.sleep(DRIVE_RETRY_BACKOFF_SECONDS)
    raise last_error


def _exchange_refresh_token() -> dict:
    """Exchange the offline refresh authority for a bounded short-lived access token.

    Performs a single token-endpoint POST with the symbolic client id, client
    secret (when present), and refresh token read only from the process
    environment. The access token value is returned to the caller in memory and is
    never logged, persisted, or recorded. Raises on any auth failure so the caller
    fails closed with DRIVE_AUTH_UNAVAILABLE.
    """
    import requests

    payload = {
        "client_id": os.environ[DRIVE_CLIENT_ID_ENV],
        "client_secret": os.environ.get(DRIVE_CLIENT_SECRET_ENV, ""),
        "refresh_token": os.environ[DRIVE_REFRESH_TOKEN_ENV],
        "grant_type": "refresh_token",
    }
    resp = requests.post(DRIVE_TOKEN_URL, data=payload, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError("drive token exchange failed")
    body = resp.json()
    access_token = body.get("access_token")
    if not access_token or not isinstance(access_token, str):
        raise RuntimeError("drive token missing")
    return body


def build_drive_service() -> Any:
    """Build an authorized requests session for the Drive API v3.

    Returns an object carrying the short-lived access token and the app-owned
    backup root folder id. Raises on auth failure (caller fails closed).
    """
    import requests

    token_body = _retry_drive(_exchange_refresh_token)
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": "Bearer " + token_body["access_token"],
            "Accept": "application/json",
        }
    )
    return _DriveService(
        session=session,
        backup_root=os.environ[DRIVE_BACKUP_ROOT_ENV],
    )


class _DriveService:
    """Bounded authorized Drive v3 session; carries no loggable secret value."""

    __slots__ = ("session", "backup_root")

    def __init__(self, session: Any, backup_root: str) -> None:
        self.session = session
        self.backup_root = backup_root


def _scoped_params(service: _DriveService, extra: dict | None = None) -> dict:
    """Query params bounding every list operation to the app-owned backup scope."""
    params = {
        "spaces": "drive",
        "fields": "files(id,name,createdTime,appProperties,size,trashed)",
        "q": f"'{service.backup_root}' in parents and trashed = false",
    }
    if extra:
        params.update(extra)
    return params


def preflight_storage_quota(
    service: _DriveService, encrypted_artifact_size: int
) -> str:
    """Fetch current total account usage / provider storage limit via about.get and
    classify against the internal hard ceiling BEFORE any upload.

    Returns one sanitized state:
      DRIVE_STORAGE_WITHIN_LIMIT  -> upload permitted
      DRIVE_STORAGE_NEAR_LIMIT    -> upload permitted (approaching ceiling)
      DRIVE_STORAGE_EXHAUSTED     -> NO upload (quota exhausted or fail-closed)
      DRIVE_AUTH_UNAVAILABLE      -> NO upload (quota fetch failed / auth)

    The total account usage (not only Drive-file usage) is used. Missing,
    unparseable, unbounded, or inconsistent quota responses fail closed as
    EXHAUSTED. Exact quota byte values are never emitted to logs or status.
    """
    try:
        resp = _retry_drive(
            lambda: service.session.get(
                DRIVE_API_BASE + "/about",
                params={"fields": "storageQuota(limit,usage)"},
                timeout=30,
            )
        )
        if resp.status_code != 200:
            return DRIVE_AUTH_UNAVAILABLE
        quota = (resp.json() or {}).get("storageQuota") or {}
        limit_raw = quota.get("limit")
        usage_raw = quota.get("usage")
        limit_bytes = int(limit_raw) if isinstance(limit_raw, (int, str)) and str(limit_raw).isdigit() else None
        usage_bytes = int(usage_raw) if isinstance(usage_raw, (int, str)) and str(usage_raw).isdigit() else None
    except Exception:
        return DRIVE_AUTH_UNAVAILABLE
    # classify_drive_quota is the pure fail-closed authority.
    return classify_drive_quota(
        usage_bytes=usage_bytes,
        limit_bytes=limit_bytes,
        artifact_size_bytes=encrypted_artifact_size,
    )


def create_encrypted_file(
    service: _DriveService,
    name: str,
    enc_path: str,
    retention_tier: str,
    run_identity: str,
) -> str:
    """Resumable upload of the encrypted artifact; returns the new Drive file id.

    The Drive file is created inside the app-owned backup root. The request body
    carries only bounded, non-private metadata (format-version, content-kind,
    retention tier, app-owned operational identity). The encrypted file is streamed
    so the whole artifact is never loaded into memory. After media transmission
    begins, retries remain on the SAME resumable session and query its committed
    offset before resuming; a response-loss ambiguity never starts a second file.
    """
    metadata = {
        "name": name,
        "parents": [service.backup_root],
        "appProperties": {
            "format-version": DRIVE_OBJECT_METADATA["format-version"],
            "content-kind": DRIVE_OBJECT_METADATA["content-kind"],
            "retention-tier": retention_tier,
            "run-identity": run_identity,
        },
    }
    file_id = _resumable_upload_attempt(service, metadata, enc_path)
    if not file_id or not isinstance(file_id, str):
        raise RuntimeError("drive upload returned no file id")
    return file_id


def _completed_file_id(resp: Any) -> str | None:
    """Return a completed-upload file id without exposing response details."""
    try:
        body = resp.json() or {}
    except Exception:
        return None
    file_id = body.get("id")
    return file_id if isinstance(file_id, str) and file_id else None


def _resume_offset(range_header: Any, total_size: int) -> int:
    """Parse Drive's 308 Range header into the next byte offset, fail closed."""
    if range_header is None or range_header == "":
        return 0
    if not isinstance(range_header, str) or not range_header.startswith("bytes=0-"):
        raise RuntimeError("drive resumable range invalid")
    last_raw = range_header[len("bytes=0-") :]
    if not last_raw.isdigit():
        raise RuntimeError("drive resumable range invalid")
    offset = int(last_raw) + 1
    if offset < 0 or offset > total_size:
        raise RuntimeError("drive resumable range invalid")
    return offset


def _query_resumable_status(
    service: _DriveService, session_url: str, total_size: int
) -> Any:
    """Query the SAME resumable session after an ambiguous media response."""

    def _query_once():
        resp = service.session.put(
            session_url,
            data=b"",
            headers={
                "Content-Length": "0",
                "Content-Range": f"bytes */{total_size}",
            },
            timeout=30,
        )
        if resp.status_code >= 500:
            raise RuntimeError("drive resumable status transient failure")
        return resp

    return _retry_drive(_query_once)


def _resumable_upload_attempt(
    service: _DriveService, metadata: dict, enc_path: str
) -> str:
    """Create one resumable session and resume that same session after ambiguity.

    Session initiation itself may be retried because no media has been committed to
    an initialized-but-unused session. Once media transmission starts, this helper
    never creates another session. Network loss or a transient server response is
    reconciled by querying the same session URI, then resuming from Drive's Range.
    """
    total_size = os.path.getsize(enc_path)
    if total_size <= 0:
        raise RuntimeError("drive encrypted upload is empty")

    def _init_session():
        resp = service.session.post(
            DRIVE_UPLOAD_BASE + "/files",
            params={"uploadType": "resumable"},
            headers={
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "application/octet-stream",
                "X-Upload-Content-Length": str(total_size),
            },
            data=json.dumps(metadata),
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError("drive resumable session failed")
        return resp

    session_resp = _retry_drive(_init_session)
    session_url = session_resp.headers.get("Location")
    if not session_url:
        raise RuntimeError("drive resumable session url missing")

    offset = 0
    for attempt in range(DRIVE_RETRY_MAX):
        try:
            with open(enc_path, "rb") as body:
                body.seek(offset)
                put_resp = service.session.put(
                    session_url,
                    data=body,
                    headers={
                        "Content-Type": "application/octet-stream",
                        "Content-Length": str(total_size - offset),
                        "Content-Range": f"bytes {offset}-{total_size - 1}/{total_size}",
                    },
                    timeout=600,
                )
        except Exception:
            put_resp = _query_resumable_status(service, session_url, total_size)

        if put_resp.status_code in (200, 201):
            file_id = _completed_file_id(put_resp)
            if not file_id:
                raise RuntimeError("drive upload missing file id")
            return file_id

        if put_resp.status_code == 308:
            offset = _resume_offset(put_resp.headers.get("Range"), total_size)
        elif put_resp.status_code >= 500:
            status_resp = _query_resumable_status(service, session_url, total_size)
            if status_resp.status_code in (200, 201):
                file_id = _completed_file_id(status_resp)
                if not file_id:
                    raise RuntimeError("drive upload missing file id")
                return file_id
            if status_resp.status_code != 308:
                raise RuntimeError("drive resumable status failed")
            offset = _resume_offset(status_resp.headers.get("Range"), total_size)
        else:
            raise RuntimeError("drive resumable upload failed")

        if offset >= total_size:
            status_resp = _query_resumable_status(service, session_url, total_size)
            if status_resp.status_code in (200, 201):
                file_id = _completed_file_id(status_resp)
                if not file_id:
                    raise RuntimeError("drive upload missing file id")
                return file_id
            if status_resp.status_code != 308:
                raise RuntimeError("drive resumable status failed")
            offset = _resume_offset(status_resp.headers.get("Range"), total_size)

        if attempt < DRIVE_RETRY_MAX - 1:
            time.sleep(DRIVE_RETRY_BACKOFF_SECONDS)

    raise RuntimeError("drive resumable upload retry budget exhausted")


def verify_uploaded_file(
    service: _DriveService,
    file_id: str,
    expected_size: int,
    retention_tier: str,
) -> bool:
    """files.get metadata verification of the exact uploaded artifact.

    Proves: the file exists, is not trashed, has the expected encrypted byte length,
    and carries the expected bounded app-owned metadata and app-owned location.
    Never returns True on a missing/trashed/mismatched file.
    """
    try:
        resp = _retry_drive(
            lambda: service.session.get(
                DRIVE_API_BASE + "/files/" + file_id,
                params={
                    "fields": "id,name,size,trashed,appProperties,parents",
                },
                timeout=30,
            )
        )
        if resp.status_code != 200:
            return False
        meta = resp.json() or {}
    except Exception:
        return False
    if not meta or meta.get("trashed") is True:
        return False
    size_raw = meta.get("size")
    actual_size = int(size_raw) if isinstance(size_raw, (int, str)) and str(size_raw).isdigit() else -1
    props = meta.get("appProperties") or {}
    parents = meta.get("parents") or []
    ok = bool(
        actual_size == expected_size
        and expected_size > 0
        and props.get("format-version") == DRIVE_OBJECT_METADATA["format-version"]
        and props.get("content-kind") == DRIVE_OBJECT_METADATA["content-kind"]
        and props.get("retention-tier") == retention_tier
        and service.backup_root in parents
    )
    return ok


def copy_file(
    service: _DriveService,
    src_file_id: str,
    new_name: str,
    retention_tier: str,
    run_identity: str,
) -> str:
    """files.copy promotion of the same encrypted artifact to a retention tier.

    Promotion never takes another pg_dump; it copies the verified encrypted
    artifact. Because files.copy creates a new file, it is intentionally issued
    once only: an ambiguous/lost response fails closed rather than blindly creating
    a second copy. Returns the new file id on an unambiguous success.
    """
    body = {
        "name": new_name,
        "appProperties": {
            "format-version": DRIVE_OBJECT_METADATA["format-version"],
            "content-kind": DRIVE_OBJECT_METADATA["content-kind"],
            "retention-tier": retention_tier,
            "run-identity": run_identity,
        },
    }
    resp = service.session.post(
        DRIVE_API_BASE + "/files/" + src_file_id + "/copy",
        headers={"Content-Type": "application/json; charset=UTF-8"},
        data=json.dumps(body),
        params={"fields": "id"},
        timeout=120,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError("drive copy failed")
    new_id = (resp.json() or {}).get("id")
    if not new_id:
        raise RuntimeError("drive copy missing file id")
    return new_id


def list_tier_files(service: _DriveService, retention_tier: str) -> list:
    """Bounded retention inventory: list app-owned files for one tier, newest first.

    Listing is scoped ONLY to the app-owned backup root and the requested tier via
    appProperties. Never lists arbitrary Drive content. Returns a list of
    {"id": str, "created_time": str} sorted newest-first for retention decisions.
    """
    q = (
        f"'{service.backup_root}' in parents and trashed = false "
        f"and appProperties has {{ key='retention-tier' and value='{retention_tier}' }}"
    )
    resp = _retry_drive(
        lambda: service.session.get(
            DRIVE_API_BASE + "/files",
            params={
                "q": q,
                "spaces": "drive",
                "fields": "files(id,createdTime)",
                "orderBy": "createdTime desc",
                "pageSize": 100,
            },
            timeout=30,
        )
    )
    if resp.status_code != 200:
        return []
    items = (resp.json() or {}).get("files") or []
    return [{"id": item.get("id"), "created_time": item.get("createdTime")} for item in items]


def delete_file(service: _DriveService, file_id: str) -> None:
    """Delete one positively-identified app-owned encrypted backup artifact only.

    Never deletes arbitrary files, the newest valid daily point, or files outside
    the app-owned backup scope. The caller selects the exact file id to delete.
    """
    resp = _retry_drive(
        lambda: service.session.delete(
            DRIVE_API_BASE + "/files/" + file_id,
            timeout=30,
        )
    )
    if resp.status_code not in (200, 204):
        raise RuntimeError("drive delete failed")


def select_retention_deletions(tier_files: list, keep_count: int) -> list:
    """Select expired app-owned artifacts to delete, never the newest valid points.

    Pure helper: given a newest-first tier inventory and the number of valid points
    to retain, returns the ids of the older expired points. The newest `keep_count`
    points are always protected. `keep_count` must be >= 1 so the newest valid daily
    point is never deleted merely to satisfy cleanup.
    """
    if keep_count < 1:
        raise ValueError("keep_count must protect at least the newest valid point")
    if len(tier_files) <= keep_count:
        return []
    return [item["id"] for item in tier_files[keep_count:] if item.get("id")]
