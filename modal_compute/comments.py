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
    validate_optional_string,
)
from modal_compute.write_validation import require_memory_visible_or_owner


def normalize_comment_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw comments DB row into camelCase API response format."""
    return {
        "id": str(row["id"]),
        "memoryId": str(row["memory_id"]),
        "ownerId": str(row["owner_id"]),
        "body": str(row["body"]),
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
    }


def create_comment(memory_id: str, owner_id: str, body: str) -> dict[str, Any]:
    """Create a new comment on a memory."""
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    require_memory_visible_or_owner(safe_memory_id, owner_id)

    safe_body = validate_optional_string(body, 5000)
    if not safe_body:
        raise HTTPException(status_code=400, detail="Comment body is required")

    comment_id = str(uuid.uuid4())

    query = """
        INSERT INTO comments (id, memory_id, owner_id, body, created_at, updated_at)
        VALUES (%s, %s, %s, %s, NOW(), NOW())
        RETURNING id, memory_id, owner_id, body, created_at, updated_at;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (comment_id, safe_memory_id, owner_id, safe_body))
            row = cur.fetchone()
        conn.commit()

    return normalize_comment_row(row)


def normalize_public_comment_row(row: dict[str, Any]) -> dict[str, Any]:
    """Public-safe comment DTO — no ownerId, no memoryId, no internal fields.

    This normalizer is intentionally separate from normalize_comment_row so that
    the public endpoint never leaks owner identity or internal DB shape.

    Future: when moderation/deletion/hidden columns exist, add a WHERE clause
    in the query (not a filter here). Currently no such schema exists, so all
    comments stored against a public memory are returned.
    """
    return {
        "id": str(row["id"]),
        "body": str(row["body"]),
        "createdAt": _to_isoformat(row.get("created_at")),
    }


def fetch_public_comments(
    memory_id: str,
    limit: int = 20,
) -> dict[str, Any]:
    """Fetch comments for a public memory, returning only public-safe fields.

    Uses a small bounded default limit with a hard clamp. Pagination is not
    implemented yet — nextCursor is null.
    """
    safe_limit = max(1, min(limit, 50))

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, body, created_at
                    FROM comments
                    WHERE memory_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (memory_id, safe_limit),
                )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    comments = [normalize_public_comment_row(row) for row in rows]
    return {
        "comments": comments,
        "nextCursor": None,
    }


def fetch_comments(memory_id: str, requester_uid: str, limit: int = 50) -> list[dict[str, Any]]:
    """Fetch comments for a memory, ordered by creation time."""
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    require_memory_visible_or_owner(safe_memory_id, requester_uid)
    safe_limit = max(1, min(limit, 200))

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, memory_id, owner_id, body, created_at, updated_at
                    FROM comments
                    WHERE memory_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (safe_memory_id, safe_limit),
                )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    return [normalize_comment_row(row) for row in rows]
