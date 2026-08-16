from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

_COMMENT_CURSOR_VERSION = 1
_MAX_CURSOR_PAYLOAD_CHARS = 1024


class CommentCursorError(Exception):
    """Raised when a comment pagination cursor is missing, malformed, oversized, or wrong-kind."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def encode_comment_cursor(
    kind: str,
    created_at: Any,
    row_id: str,
    target_id: str | None = None,
) -> str:
    """Encode an opaque base64url cursor for forward comment pagination."""
    created_at_str = created_at.isoformat() if isinstance(created_at, datetime) else str(created_at)
    payload: dict[str, Any] = {
        "v": _COMMENT_CURSOR_VERSION,
        "k": kind,
        "c": created_at_str,
        "i": str(row_id),
    }
    if target_id is not None:
        payload["t"] = str(target_id)
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_comment_cursor(
    raw: str | None,
    expected_kind: str,
    expected_target_id: str | None = None,
) -> dict[str, Any]:
    """Decode and validate an opaque base64url comment pagination cursor.

    Fails closed on missing, malformed, oversized, wrong-kind, or target-mismatched cursor.
    """
    if not raw or not isinstance(raw, str):
        raise CommentCursorError("empty")
    if len(raw) > _MAX_CURSOR_PAYLOAD_CHARS:
        raise CommentCursorError("oversized")
    try:
        pad = -len(raw) % 4
        decoded = base64.urlsafe_b64decode(raw.encode("ascii") + b"=" * pad)
        payload = json.loads(decoded.decode("utf-8"))
    except Exception:
        raise CommentCursorError("not_base64_json")
    if not isinstance(payload, dict):
        raise CommentCursorError("not_object")
    if payload.get("v") != _COMMENT_CURSOR_VERSION:
        raise CommentCursorError("bad_version")
    if payload.get("k") != expected_kind:
        raise CommentCursorError("wrong_kind")
    created_at = payload.get("c")
    row_id = payload.get("i")
    if (
        not isinstance(created_at, str)
        or not isinstance(row_id, str)
        or not row_id
        or len(row_id) > 64
        or len(created_at) > 64
    ):
        raise CommentCursorError("missing_fields")
    try:
        created_at_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except Exception:
        raise CommentCursorError("bad_timestamp")
    target_id = payload.get("t")
    if expected_target_id is not None:
        if target_id is None or str(target_id) != str(expected_target_id):
            raise CommentCursorError("target_mismatch")
    return {
        "created_at": created_at_dt,
        "created_at_str": created_at,
        "id": str(row_id),
        "target_id": str(target_id) if target_id is not None else None,
    }
