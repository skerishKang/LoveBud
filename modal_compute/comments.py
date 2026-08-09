from __future__ import annotations

import uuid
from typing import Any

from modal_compute.db import get_db_connection, run_db_with_retry
from modal_compute.social_errors import SocialWriteError
from modal_compute.social_idempotency import (
    _compute_key_hash,
    complete_idempotency,
    reserve_and_verify_idempotency,
    validate_idempotency_key_format,
)
from modal_compute.social_rate_limit import check_comment_rate_limits
from modal_compute.social_write_audit import record_audit
from modal_compute.validation import _to_isoformat, validate_optional_string, validate_required_uuid
from modal_compute.write_validation import (
    require_memory_visible_or_owner,
    require_memory_visible_or_owner_cursor,
)


def normalize_comment_row(row: dict[str, Any], requester_uid: str | None = None) -> dict[str, Any]:
    """Normalize a comment DB row into the authenticated DTO.

    The authenticated DTO intentionally excludes the raw stable account
    identifier (owner_id). Instead it exposes ``isOwn``, a server-computed
    boolean that is True only when the authenticated requester_uid matches the
    row's owner_id.

    Public/guest DTOs use ``normalize_public_comment_row`` instead.
    """
    result = {
        "id": str(row["id"]),
        "memoryId": str(row["memory_id"]),
        "body": str(row["body"]),
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
    }
    if requester_uid is not None:
        result["isOwn"] = str(row["owner_id"]) == str(requester_uid)
    return result


def create_comment(
    memory_id: str,
    owner_id: str,
    body: str,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")

    safe_body = validate_optional_string(body, 5000)
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
            message="Idempotency-Key header is required",
        )

    validate_idempotency_key_format(idempotency_key)

    comment_id = str(uuid.uuid4())

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                require_memory_visible_or_owner_cursor(cur, safe_memory_id, owner_id)

                body_dict = {"body": safe_body}
                replay = reserve_and_verify_idempotency(
                    cur, owner_id, "comment.create",
                    idempotency_key, safe_memory_id, body_dict,
                )

                if replay is not None and replay.get("replay"):
                    result_id = replay.get("resultId")
                    key_hash = _compute_key_hash(idempotency_key)
                    record_audit(
                        cur, owner_id, safe_memory_id,
                        "comment.create.replay", "success",
                        request_key_hash=key_hash,
                    )
                    conn.commit()

                    if result_id:
                        cur.execute(
                            """
                            SELECT id, memory_id, owner_id, body, created_at, updated_at,
                                   status, deleted_at
                            FROM comments
                            WHERE id = %s
                            LIMIT 1
                            """,
                            (result_id,),
                        )
                        comment_row = cur.fetchone()
                        if comment_row:
                            status = str(comment_row.get("status") or "visible")
                            deleted_at = comment_row.get("deleted_at")
                            if status != "visible" or deleted_at is not None:
                                raise SocialWriteError(
                                    status_code=410,
                                    code="IDEMPOTENCY_RESULT_UNAVAILABLE",
                                    message="The original comment is no longer available",
                                )
                            return normalize_comment_row(comment_row, owner_id)

                    raise SocialWriteError(
                        status_code=410,
                        code="IDEMPOTENCY_RESULT_UNAVAILABLE",
                        message="The original comment is no longer available",
                    )

                check_comment_rate_limits(cur, owner_id, safe_memory_id)

                cur.execute(
                    """
                    INSERT INTO comments
                        (id, memory_id, owner_id, body, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'visible', NOW(), NOW())
                    RETURNING id, memory_id, owner_id, body, created_at, updated_at
                    """,
                    (comment_id, safe_memory_id, owner_id, safe_body),
                )
                row = cur.fetchone()

                complete_idempotency(
                    cur, owner_id, "comment.create",
                    idempotency_key, comment_id, "completed",
                )
                key_hash = _compute_key_hash(idempotency_key)
                record_audit(
                    cur, owner_id, safe_memory_id,
                    "comment.create", "success",
                    request_key_hash=key_hash,
                )
                conn.commit()

                return normalize_comment_row(row, owner_id)

            except Exception:
                conn.rollback()
                raise


def normalize_public_comment_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "body": str(row["body"]),
        "createdAt": _to_isoformat(row.get("created_at")),
    }


def fetch_public_comments(
    memory_id: str,
    limit: int = 20,
) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 50))

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, body, created_at
                    FROM comments
                    WHERE memory_id = %s
                      AND status = 'visible'
                      AND deleted_at IS NULL
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (memory_id, safe_limit),
                )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    comments_list = [normalize_public_comment_row(row) for row in rows]
    return {
        "comments": comments_list,
        "nextCursor": None,
    }


def fetch_comments(memory_id: str, requester_uid: str, limit: int = 50) -> list[dict[str, Any]]:
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
                      AND status = 'visible'
                      AND deleted_at IS NULL
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (safe_memory_id, safe_limit),
                )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    return [normalize_comment_row(row, requester_uid) for row in rows]


def soft_delete_own_comment(comment_id: str, actor_id: str) -> dict[str, Any]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    SELECT id, owner_id, memory_id, status, deleted_at
                    FROM comments
                    WHERE id = %s
                    LIMIT 1
                    """,
                    (comment_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise SocialWriteError(
                        status_code=404,
                        code="SOCIAL_WRITE_UNAVAILABLE",
                        message="Comment not found",
                    )

                memory_id = str(row["memory_id"])

                if str(row["owner_id"]) != actor_id:
                    raise SocialWriteError(
                        status_code=403,
                        code="SOCIAL_WRITE_UNAVAILABLE",
                        message="Only the comment author can delete this comment",
                    )

                current_status = str(row.get("status") or "visible")
                if current_status != "visible":
                    return {"id": comment_id, "status": current_status}

                cur.execute(
                    """
                    UPDATE comments
                    SET status = 'deleted', deleted_at = NOW(), deleted_by = %s
                    WHERE id = %s
                    """,
                    (actor_id, comment_id),
                )

                record_audit(
                    cur, actor_id, memory_id,
                    "comment.soft_delete", "success",
                )
                conn.commit()
                return {"id": comment_id, "status": "deleted"}
            except Exception:
                conn.rollback()
                raise


def hide_comment_by_tree_owner(comment_id: str, tree_owner_id: str) -> dict[str, Any]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    SELECT c.id, c.memory_id, c.status, c.deleted_at, m.tree_id
                    FROM comments c
                    INNER JOIN memories m ON m.id = c.memory_id
                    WHERE c.id = %s
                    LIMIT 1
                    """,
                    (comment_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise SocialWriteError(
                        status_code=404,
                        code="SOCIAL_WRITE_UNAVAILABLE",
                        message="Comment not found",
                    )

                memory_id = str(row["memory_id"])

                cur.execute(
                    "SELECT owner_id FROM trees WHERE id = %s LIMIT 1",
                    (str(row["tree_id"]),),
                )
                tree = cur.fetchone()
                if not tree or str(tree["owner_id"]) != tree_owner_id:
                    raise SocialWriteError(
                        status_code=403,
                        code="SOCIAL_WRITE_UNAVAILABLE",
                        message="Only the tree owner can moderate comments in this tree",
                    )

                current_status = str(row.get("status") or "visible")
                if current_status != "visible":
                    return {"id": comment_id, "status": current_status}

                cur.execute(
                    """
                    UPDATE comments
                    SET status = 'hidden', deleted_at = NOW(), deleted_by = %s
                    WHERE id = %s
                    """,
                    (tree_owner_id, comment_id),
                )

                record_audit(
                    cur, tree_owner_id, memory_id,
                    "comment.hide", "success",
                )
                conn.commit()
                return {"id": comment_id, "status": "hidden"}
            except Exception:
                conn.rollback()
                raise
