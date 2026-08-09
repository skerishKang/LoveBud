from __future__ import annotations

import uuid
from typing import Any

from modal_compute.db import get_db_connection, run_db_with_retry
from modal_compute.social_errors import SocialWriteError
from modal_compute.social_idempotency import (
    _compute_key_hash,
    complete_idempotency,
    reserve_and_verify_idempotency_target,
    validate_idempotency_key_format,
)
from modal_compute.social_write_audit import record_audit_target
from modal_compute.tree_likes import require_public_tree_cursor, require_public_tree_for_like
from modal_compute.validation import validate_optional_string, validate_required_uuid

COMMENT_BODY_MAX = 5000

ANONYMOUS_DISPLAY_LABEL = "anonymous"


def normalize_tree_comment_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "treeId": str(row["tree_id"]),
        "ownerId": str(row["owner_id"]),
        "body": str(row["body"]),
        "createdAt": str(row.get("created_at")),
        "updatedAt": str(row.get("updated_at")),
    }


def normalize_public_tree_comment_row(row: dict[str, Any]) -> dict[str, Any]:
    """Safe public read DTO. Never returns the raw account identifier."""
    return {
        "id": str(row["id"]),
        "treeId": str(row["tree_id"]),
        "body": str(row["body"]),
        "createdAt": str(row.get("created_at")),
        "updatedAt": str(row.get("updated_at")),
        "authorDisplayLabel": ANONYMOUS_DISPLAY_LABEL,
    }


def fetch_tree_comments(tree_id: str, limit: int = 20) -> dict[str, Any]:
    """Read whole-tree (tree-level) comments for a public tree.

    Targets only `tree_comments` with `tree_comments.tree_id = :treeId`.
    Never touches moment `comments` or `memory_id`. Public-tree visibility
    gate runs before any read. Returns safe public DTOs (no raw account id).
    """
    safe_tree_id = validate_required_uuid(tree_id, "treeId")

    try:
        safe_limit = int(limit)
    except (TypeError, ValueError):
        safe_limit = 20
    if safe_limit < 1 or safe_limit > 50:
        safe_limit = max(1, min(safe_limit, 50))

    require_public_tree_for_like(safe_tree_id)

    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, tree_id, body, created_at, updated_at
                    FROM tree_comments
                    WHERE tree_id = %s
                    ORDER BY created_at ASC, id ASC
                    LIMIT %s
                    """,
                    (safe_tree_id, safe_limit),
                )
                rows = cur.fetchall()
                return [normalize_public_tree_comment_row(row) for row in rows]

    return {"comments": run_db_with_retry(operation)}


def create_tree_comment(
    tree_id: str,
    owner_id: str,
    body: str,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Create a whole-tree (tree-level) comment.

    Targets only `tree_comments` with generic target_kind='tree',
    target_id=tree_id. Never touches moment `comments` or `memory_id`.
    """
    safe_tree_id = validate_required_uuid(tree_id, "treeId")

    safe_body = validate_optional_string(body, COMMENT_BODY_MAX)
    if not safe_body:
        raise SocialWriteError(
            status_code=400,
            code="SOCIAL_WRITE_UNAVAILABLE",
            message="Comment body is required",
        )

    if not idempotency_key:
        raise SocialWriteError(
            status_code=400,
            code="IDEMPOTENCY_KEY_REQUIRED",
            message="Idempotency-Key header is required for this operation",
        )

    validate_idempotency_key_format(idempotency_key)

    operation = "tree.comment.create"
    body_dict: dict[str, Any] = {"body": safe_body}

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                require_public_tree_cursor(cur, safe_tree_id)
                replay = reserve_and_verify_idempotency_target(
                    cur, owner_id, operation, idempotency_key,
                    "tree", safe_tree_id, body_dict,
                )

                if replay is not None and replay.get("replay"):
                    result_id = replay.get("resultId")
                    key_hash = _compute_key_hash(idempotency_key)
                    record_audit_target(
                        cur, owner_id, "tree", safe_tree_id,
                        "tree.comment.create.replay", "success",
                        request_key_hash=key_hash,
                    )

                    if result_id:
                        cur.execute(
                            """
                            SELECT id, tree_id, owner_id, body, created_at, updated_at
                            FROM tree_comments
                            WHERE id = %s
                            LIMIT 1
                            """,
                            (result_id,),
                        )
                        comment_row = cur.fetchone()
                        if comment_row:
                            conn.commit()
                            return normalize_tree_comment_row(comment_row)

                    conn.rollback()
                    raise SocialWriteError(
                        status_code=410,
                        code="IDEMPOTENCY_RESULT_UNAVAILABLE",
                        message="The original comment is no longer available",
                    )

                comment_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO tree_comments
                        (id, tree_id, owner_id, body, target_kind, target_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'tree', %s, NOW(), NOW())
                    RETURNING id, tree_id, owner_id, body, created_at, updated_at
                    """,
                    (comment_id, safe_tree_id, owner_id, safe_body, safe_tree_id),
                )
                row = cur.fetchone()

                result_payload = normalize_tree_comment_row(row)
                complete_idempotency(
                    cur, owner_id, operation,
                    idempotency_key, comment_id, "completed",
                    result_payload=result_payload,
                )
                key_hash = _compute_key_hash(idempotency_key)
                record_audit_target(
                    cur, owner_id, "tree", safe_tree_id,
                    "tree.comment.create", "success",
                    request_key_hash=key_hash,
                )
                conn.commit()

                return result_payload

            except Exception:
                conn.rollback()
                raise
