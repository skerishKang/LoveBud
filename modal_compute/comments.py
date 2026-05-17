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


def fetch_comments(memory_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Fetch comments for a memory, ordered by creation time."""
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
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
