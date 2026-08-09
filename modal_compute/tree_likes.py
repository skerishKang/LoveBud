from __future__ import annotations

import hashlib
import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry
from modal_compute.validation import validate_required_uuid
from modal_compute.social_errors import SocialWriteError
from modal_compute.social_idempotency import (
    _compute_key_hash,
    complete_idempotency,
    reserve_and_verify_idempotency_target,
    validate_idempotency_key_format,
)
from modal_compute.social_write_audit import record_audit_target
from modal_compute.write_validation import is_explicit_public


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
    if not tree or not is_explicit_public(tree.get("visibility")):
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


def require_public_tree_cursor(cur: Any, tree_id: str) -> dict[str, Any]:
    """Authorize a Tree social write inside its mutation transaction.

    FOR SHARE conflicts with the owner's non-key visibility UPDATE, so a
    successful explicit-public authorization remains authoritative until this
    transaction completes. Ordinary read paths intentionally keep using the
    lock-free require_public_tree_for_like() helper above.
    """
    cur.execute(
        """
        SELECT id, visibility
        FROM trees
        WHERE id = %s
          AND visibility = 'public'
        FOR SHARE
        """,
        (tree_id,),
    )
    tree = cur.fetchone()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


def _table_exists(cur, table_name: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = %s
        ) AS "exists"
        """,
        (table_name,),
    )
    row = cur.fetchone()
    return bool(row and row.get("exists"))


def _table_has_column(cur, table_name: str, column_name: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        ) AS "exists"
        """,
        (table_name, column_name),
    )
    row = cur.fetchone()
    return bool(row and row.get("exists"))


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


def _fetch_public_tree_for_like_count(cur, tree_id: str) -> dict[str, Any] | None:
    if _table_has_column(cur, "trees", "visibility"):
        cur.execute(
            """
            SELECT id
            FROM trees
            WHERE id = %s
              AND visibility = 'public'
            LIMIT 1
            """,
            (tree_id,),
        )
        return cur.fetchone()

    if _table_has_column(cur, "trees", "is_public"):
        cur.execute(
            """
            SELECT id
            FROM trees
            WHERE id = %s
              AND is_public = %s
            LIMIT 1
            """,
            (tree_id, True),
        )
        return cur.fetchone()

    return None


def fetch_public_tree_like_count(tree_id: str) -> int:
    """Read the public tree-level like count without creating aggregate rows.

    Missing tree_social_counts remains a safe zero-count fallback so public tree detail
    reads keep working before the migration is applied in a runtime environment.
    """

    def operation() -> dict[str, Any] | None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                tree = _fetch_public_tree_for_like_count(cur, tree_id)
                if not tree:
                    return None

                if not _table_exists(cur, "tree_social_counts"):
                    return {"like_count": 0}

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
                return {"like_count": int(row.get("like_count") or 0) if row else 0}

    result = run_db_with_retry(operation)
    if result is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return int(result.get("like_count") or 0)


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


def _tree_like_advisory_lock(actor_id: str, tree_id: str) -> int:
    raw = f"{actor_id}:{tree_id}"
    digest = hashlib.sha256(raw.encode("utf-8")).digest()[:8]
    return int.from_bytes(digest, byteorder="big", signed=True)


def _fetch_active_like(cur: Any, tree_id: str, owner_id: str) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT id
        FROM tree_likes
        WHERE tree_id = %s
          AND owner_id = %s
          AND deleted_at IS NULL
        LIMIT 1
        """,
        (tree_id, owner_id),
    )
    return cur.fetchone()


def _read_active_and_count(cur: Any, tree_id: str, owner_id: str) -> tuple[bool, int]:
    active = _fetch_active_like(cur, tree_id, owner_id) is not None
    like_count = _fetch_like_count(cur, tree_id)
    return active, like_count


def toggle_tree_like(tree_id: str, owner_id: str, idempotency_key: str | None = None) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")

    if not idempotency_key:
        raise SocialWriteError(
            status_code=400,
            code="IDEMPOTENCY_KEY_REQUIRED",
            message="Idempotency-Key header is required for this operation",
        )

    validate_idempotency_key_format(idempotency_key)

    operation = "tree.like.toggle"
    body: dict[str, Any] = {}

    lock_key = _tree_like_advisory_lock(owner_id, safe_tree_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                require_public_tree_cursor(cur, safe_tree_id)
                cur.execute("SELECT pg_advisory_xact_lock(%s)", (lock_key,))

                _ensure_tree_social_counts(cur, safe_tree_id)

                replay = reserve_and_verify_idempotency_target(
                    cur, owner_id, operation, idempotency_key,
                    "tree", safe_tree_id, body,
                )

                if replay is not None and replay.get("replay"):
                    stored_payload = replay.get("resultPayload")
                    key_hash = _compute_key_hash(idempotency_key)
                    record_audit_target(
                        cur, owner_id, "tree", safe_tree_id,
                        "tree.like.toggle.replay", "success",
                        request_key_hash=key_hash,
                    )
                    if stored_payload is not None and isinstance(stored_payload, dict):
                        conn.commit()
                        return stored_payload

                    active, like_count = _read_active_and_count(cur, safe_tree_id, owner_id)
                    result_payload = {"treeId": safe_tree_id, "active": active, "likeCount": like_count}
                    conn.commit()
                    return result_payload

                existing = _fetch_active_like(cur, safe_tree_id, owner_id)

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
                result_payload = {"treeId": safe_tree_id, "active": active, "likeCount": like_count}

                complete_idempotency(
                    cur, owner_id, operation,
                    idempotency_key, str(uuid.uuid4()), "completed",
                    result_payload=result_payload,
                )
                key_hash = _compute_key_hash(idempotency_key)
                record_audit_target(
                    cur, owner_id, "tree", safe_tree_id,
                    "tree.like.toggle", "success",
                    request_key_hash=key_hash,
                )
                conn.commit()
                return result_payload

            except Exception:
                conn.rollback()
                raise
