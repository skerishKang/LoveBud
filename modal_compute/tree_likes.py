from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry
from modal_compute.validation import validate_required_uuid


def require_public_tree_for_like(tree_id: str) -> dict[str, Any]:
    def operation() -> dict[str, Any] | None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, visibility
                    FROM trees
                    WHERE id = %s
                    LIMIT 1
                    """,
                    (tree_id,),
                )
                return cur.fetchone()

    tree = run_db_with_retry(operation)
    if not tree or str(tree.get("visibility") or "public") != "public":
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


def _ensure_tree_social_counts(cur, tree_id: str) -> None:
    cur.execute(
        """
        INSERT INTO tree_social_counts (tree_id, like_count, view_count, updated_at)
        VALUES (%s, 0, 0, NOW())
        ON CONFLICT (tree_id) DO NOTHING
        """,
        (tree_id,),
    )


def _fetch_like_count(cur, tree_id: str) -> int:
    cur.execute(
        """
        SELECT like_count
        FROM tree_social_counts
        WHERE tree_id = %s
        LIMIT 1
        """,
        (tree_id,),
    )
    row = cur.fetchone()
    return int(row.get("like_count") or 0) if row else 0


def fetch_tree_like_summary(tree_id: str, owner_id: str) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_public_tree_for_like(safe_tree_id)

    def operation() -> dict[str, Any]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _ensure_tree_social_counts(cur, safe_tree_id)
                cur.execute(
                    """
                    SELECT id
                    FROM tree_likes
                    WHERE tree_id = %s
                      AND owner_id = %s
                      AND deleted_at IS NULL
                    LIMIT 1
                    """,
                    (safe_tree_id, owner_id),
                )
                active = cur.fetchone() is not None
                like_count = _fetch_like_count(cur, safe_tree_id)
                conn.commit()
                return {"treeId": safe_tree_id, "active": active, "likeCount": like_count}

    return run_db_with_retry(operation)


def toggle_tree_like(tree_id: str, owner_id: str) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_public_tree_for_like(safe_tree_id)

    def operation() -> dict[str, Any]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _ensure_tree_social_counts(cur, safe_tree_id)
                cur.execute(
                    """
                    SELECT id
                    FROM tree_likes
                    WHERE tree_id = %s
                      AND owner_id = %s
                      AND deleted_at IS NULL
                    LIMIT 1
                    """,
                    (safe_tree_id, owner_id),
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        """
                        UPDATE tree_likes
                        SET deleted_at = NOW()
                        WHERE id = %s
                        """,
                        (existing["id"],),
                    )
                    cur.execute(
                        """
                        UPDATE tree_social_counts
                        SET like_count = GREATEST(like_count - 1, 0),
                            updated_at = NOW()
                        WHERE tree_id = %s
                        """,
                        (safe_tree_id,),
                    )
                    active = False
                else:
                    cur.execute(
                        """
                        INSERT INTO tree_likes (id, tree_id, owner_id, created_at, deleted_at)
                        VALUES (%s, %s, %s, NOW(), NULL)
                        """,
                        (str(uuid.uuid4()), safe_tree_id, owner_id),
                    )
                    cur.execute(
                        """
                        UPDATE tree_social_counts
                        SET like_count = like_count + 1,
                            updated_at = NOW()
                        WHERE tree_id = %s
                        """,
                        (safe_tree_id,),
                    )
                    active = True

                like_count = _fetch_like_count(cur, safe_tree_id)
                conn.commit()
                return {"treeId": safe_tree_id, "active": active, "likeCount": like_count}

    return run_db_with_retry(operation)
