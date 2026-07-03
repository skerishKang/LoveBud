from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    _to_isoformat,
    validate_required_uuid,
)
from modal_compute.write_validation import require_memory_visible_or_owner


def normalize_reaction_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw reactions DB row into camelCase API response format."""
    return {
        "id": str(row["id"]),
        "memoryId": str(row["memory_id"]),
        "ownerId": str(row["owner_id"]),
        "type": str(row["type"]),
        "createdAt": _to_isoformat(row.get("created_at")),
    }


def fetch_reaction_counts(memory_id: str) -> dict[str, int]:
    """Fetch reaction counts grouped by type for a memory."""
    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
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
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    return {str(row["type"]): int(row["count"]) for row in rows}


def toggle_reaction(memory_id: str, owner_id: str, reaction_type: str) -> dict[str, Any]:
    """Toggle a reaction on a memory.

    If the user already has a reaction of this type on this memory, remove it
    (toggle off). Otherwise, add a new reaction (toggle on).

    Returns a dict with active=True and the reaction data if created,
    or active=False if removed.
    """
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    require_memory_visible_or_owner(safe_memory_id, owner_id)

    if not reaction_type or not isinstance(reaction_type, str):
        raise HTTPException(status_code=400, detail="Reaction type is required")
    safe_type = reaction_type.strip().lower()
    if len(safe_type) > 32:
        raise HTTPException(status_code=400, detail="Reaction type exceeds max 32 characters")
    if not safe_type:
        raise HTTPException(status_code=400, detail="Reaction type is required")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check if reaction already exists
            cur.execute(
                """
                SELECT id, memory_id, owner_id, type, created_at
                FROM reactions
                WHERE memory_id = %s AND owner_id = %s AND type = %s
                LIMIT 1
                """,
                (safe_memory_id, owner_id, safe_type),
            )
            existing = cur.fetchone()

            if existing:
                # Toggle off — delete existing reaction
                cur.execute(
                    "DELETE FROM reactions WHERE id = %s",
                    (existing["id"],),
                )
                conn.commit()
                return {"active": False, "type": safe_type}
            else:
                # Toggle on — insert new reaction
                reaction_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO reactions (id, memory_id, owner_id, type, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    RETURNING id, memory_id, owner_id, type, created_at
                    """,
                    (reaction_id, safe_memory_id, owner_id, safe_type),
                )
                row = cur.fetchone()
                conn.commit()
                reaction = normalize_reaction_row(row)
                reaction["active"] = True
                return reaction


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
    """Fetch reaction summary for a memory.

    Returns counts by type and which types the requesting user has reacted with.
    """
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
