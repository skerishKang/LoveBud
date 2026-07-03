from __future__ import annotations

import hashlib
import uuid
from typing import Any

from modal_compute.db import get_db_connection
from modal_compute.validation import validate_required_uuid
from modal_compute.social_errors import SocialWriteError
from modal_compute.social_idempotency import (
    _compute_key_hash,
    complete_idempotency,
    reserve_and_verify_idempotency,
    validate_idempotency_key_format,
)
from modal_compute.social_write_audit import record_audit
from modal_compute.write_validation import (
    require_memory_visible_or_owner,
    require_memory_visible_or_owner_cursor,
)

ALLOWED_REACTION_TYPES = frozenset({"like"})


def _reaction_advisory_lock(actor_id: str, memory_id: str, reaction_type: str) -> int:
    raw = f"{actor_id}:{memory_id}:{reaction_type}"
    digest = hashlib.sha256(raw.encode("utf-8")).digest()[:8]
    return int.from_bytes(digest, byteorder="big", signed=True)


def _compute_reaction_counts(cur: Any, memory_id: str) -> dict[str, int]:
    cur.execute(
        """
        SELECT type, COUNT(*)::int AS count
        FROM reactions
        WHERE memory_id = %s
        GROUP BY type
        ORDER BY type
        """,
        (memory_id,),
    )
    rows = cur.fetchall()
    return {str(row["type"]): int(row["count"]) for row in rows}


def _make_reaction_dto(
    active: bool,
    reaction_type: str,
    counts: dict[str, int],
    total: int,
) -> dict[str, Any]:
    return {
        "type": reaction_type,
        "active": active,
        "counts": counts,
        "total": total,
    }


def fetch_reaction_counts(memory_id: str) -> dict[str, int]:
    def operation() -> dict[str, int]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                return _compute_reaction_counts(cur, memory_id)

    from modal_compute.db import run_db_with_retry
    return run_db_with_retry(operation)


def toggle_reaction(
    memory_id: str,
    owner_id: str,
    reaction_type: str,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    safe_type = (reaction_type or "").strip().lower()
    if not safe_type:
        raise SocialWriteError(
            status_code=400,
            code="REACTION_TYPE_INVALID",
            message="Reaction type is required",
        )
    if safe_type not in ALLOWED_REACTION_TYPES:
        raise SocialWriteError(
            status_code=400,
            code="REACTION_TYPE_INVALID",
            message=f"Reaction type must be one of: {', '.join(sorted(ALLOWED_REACTION_TYPES))}",
        )

    if not idempotency_key:
        raise SocialWriteError(
            status_code=400,
            code="IDEMPOTENCY_KEY_REQUIRED",
            message="Idempotency-Key header is required",
        )

    validate_idempotency_key_format(idempotency_key)

    lock_key = _reaction_advisory_lock(owner_id, safe_memory_id, safe_type)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("SELECT pg_advisory_xact_lock(%s)", (lock_key,))

                require_memory_visible_or_owner_cursor(cur, safe_memory_id, owner_id)

                body = {"type": safe_type}
                replay = reserve_and_verify_idempotency(
                    cur, owner_id, "reaction.toggle",
                    idempotency_key, safe_memory_id, body,
                )

                if replay is not None and replay.get("replay"):
                    stored_payload = replay.get("resultPayload")
                    key_hash = _compute_key_hash(idempotency_key)
                    record_audit(
                        cur, owner_id, safe_memory_id,
                        "reaction.toggle.replay", "success",
                        request_key_hash=key_hash,
                    )
                    if stored_payload is not None and isinstance(stored_payload, dict):
                        conn.commit()
                        return stored_payload

                    counts = _compute_reaction_counts(cur, safe_memory_id)
                    total = sum(counts.values())
                    dto = _make_reaction_dto(False, safe_type, counts, total)
                    conn.commit()
                    return dto

                cur.execute(
                    """
                    SELECT id FROM reactions
                    WHERE memory_id = %s AND owner_id = %s AND type = %s
                    LIMIT 1
                    """,
                    (safe_memory_id, owner_id, safe_type),
                )
                existing = cur.fetchone()

                result_payload: dict[str, Any]

                if existing:
                    cur.execute(
                        "DELETE FROM reactions WHERE memory_id = %s AND owner_id = %s AND type = %s",
                        (safe_memory_id, owner_id, safe_type),
                    )
                    result_id_val = str(existing["id"])
                    counts = _compute_reaction_counts(cur, safe_memory_id)
                    total = sum(counts.values())
                    result_payload = _make_reaction_dto(False, safe_type, counts, total)
                    complete_idempotency(
                        cur, owner_id, "reaction.toggle",
                        idempotency_key, result_id_val, "completed",
                        result_payload=result_payload,
                    )
                    key_hash = _compute_key_hash(idempotency_key)
                    record_audit(
                        cur, owner_id, safe_memory_id,
                        "reaction.toggle", "success",
                        request_key_hash=key_hash,
                    )
                    conn.commit()
                    return result_payload

                reaction_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO reactions (id, memory_id, owner_id, type, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    """,
                    (reaction_id, safe_memory_id, owner_id, safe_type),
                )
                counts = _compute_reaction_counts(cur, safe_memory_id)
                total = sum(counts.values())
                result_payload = _make_reaction_dto(True, safe_type, counts, total)
                complete_idempotency(
                    cur, owner_id, "reaction.toggle",
                    idempotency_key, reaction_id, "completed",
                    result_payload=result_payload,
                )
                key_hash = _compute_key_hash(idempotency_key)
                record_audit(
                    cur, owner_id, safe_memory_id,
                    "reaction.toggle", "success",
                    request_key_hash=key_hash,
                )
                conn.commit()
                return result_payload

            except Exception:
                conn.rollback()
                raise


def fetch_public_reaction_counts(memory_id: str) -> dict[str, Any]:
    """Fetch aggregate reaction counts for a public memory.

    Returns only anonymous aggregate counts — no viewer-specific state.
    Used by the public (guest-safe) reaction endpoint.
    """
    counts = fetch_reaction_counts(memory_id)
    total = sum(counts.values())
    return {
        "counts": counts,
        "total": total,
    }


def fetch_reaction_summary(memory_id: str, owner_id: str) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    require_memory_visible_or_owner(safe_memory_id, owner_id)

    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, memory_id, owner_id, type, created_at
                    FROM reactions
                    WHERE memory_id = %s
                    ORDER BY created_at ASC
                    """,
                    (safe_memory_id,),
                )
                return cur.fetchall()

    from modal_compute.db import run_db_with_retry
    rows = run_db_with_retry(operation)

    counts: dict[str, int] = {}
    user_reactions: dict[str, bool] = {}

    for r in rows:
        r_type = str(r["type"])
        counts[r_type] = counts.get(r_type, 0) + 1
        if str(r["owner_id"]) == owner_id:
            user_reactions[r_type] = True

    return {
        "counts": counts,
        "userReactions": user_reactions,
    }
