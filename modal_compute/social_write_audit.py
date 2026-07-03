from __future__ import annotations

import uuid
from typing import Any

SAFE_ACTIONS = frozenset({
    "reaction.toggle",
    "reaction.toggle.replay",
    "comment.create",
    "comment.create.replay",
    "comment.soft_delete",
    "comment.hide",
})


def record_audit(
    cur: Any,
    actor_id: str,
    memory_id: str,
    action: str,
    outcome_code: str,
    request_key_hash: str | None = None,
) -> None:
    """Record a minimal safe audit entry for a social write operation.

    This function intentionally stores the minimum safe metadata:
    - actor_id (Firebase UID)
    - memory_id (target UUID)
    - action (one of SAFE_ACTIONS)
    - outcome_code ('success', 'rate_limited', 'validation_error', etc.)
    - request_key_hash (SHA-256 of idempotency key, NOT the raw key)

    The following are NEVER stored:
    - Comment body
    - Firebase token or Authorization header
    - Raw exception or stack trace
    - Full request/response payload
    - Browser fingerprint or IP address
    """
    if action not in SAFE_ACTIONS:
        action = f"unknown:{action}"

    audit_id = str(uuid.uuid4())

    cur.execute(
        """
        INSERT INTO social_audit_log
            (id, actor_id, memory_id, action, outcome_code, request_key_hash, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """,
        (audit_id, actor_id, memory_id, action, outcome_code, request_key_hash),
    )
