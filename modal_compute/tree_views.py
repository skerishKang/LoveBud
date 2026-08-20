from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry
from modal_compute.validation import validate_required_uuid

_ALLOWED_ACTOR_KINDS = {"authenticated", "anonymous"}
_ALLOWED_VIEW_SOURCES = {"public_tree_detail", "public_tree_card_open"}


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


def _fetch_public_tree_for_view_count(cur, tree_id: str) -> dict[str, Any] | None:
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


def _lock_public_tree_for_view_write(cur, tree_id: str) -> dict[str, Any] | None:
    """Authorize and hold public visibility for a view-count mutation.

    Issue #4139: ordinary public count reads remain lock-free, but a view write
    must keep the Tree's explicit-public state authoritative until COMMIT. FOR
    SHARE conflicts with the owner's non-key visibility UPDATE; FOR KEY SHARE
    would not provide that revocation serialization.
    """
    if _table_has_column(cur, "trees", "visibility"):
        cur.execute(
            """
            SELECT id
            FROM trees
            WHERE id = %s
              AND visibility = 'public'
            LIMIT 1
            FOR SHARE
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
            FOR SHARE
            """,
            (tree_id, True),
        )
        return cur.fetchone()

    return None


def _ensure_tree_social_counts(cur, tree_id: str) -> None:
    cur.execute(
        """
        INSERT INTO tree_social_counts (tree_id, like_count, view_count, updated_at)
        VALUES (%s, 0, 0, NOW())
        ON CONFLICT (tree_id) DO NOTHING
        """,
        (tree_id,),
    )


def _fetch_view_count(cur, tree_id: str) -> int:
    if not _table_exists(cur, "tree_social_counts"):
        return 0

    cur.execute(
        """
        SELECT view_count
        FROM tree_social_counts
        WHERE tree_id = %s
        LIMIT 1
        """,
        (tree_id,),
    )
    row = cur.fetchone()
    return int(row.get("view_count") or 0) if row else 0


def _normalize_actor_key(actor_key: str) -> str:
    normalized = str(actor_key or "").strip()
    if not normalized or len(normalized) > 128:
        raise HTTPException(status_code=400, detail="Invalid view actor key")
    return normalized


def _normalize_actor_kind(actor_kind: str) -> str:
    normalized = str(actor_kind or "anonymous").strip()
    if normalized not in _ALLOWED_ACTOR_KINDS:
        raise HTTPException(status_code=400, detail="Invalid view actor kind")
    return normalized


def _normalize_view_source(source: str) -> str:
    normalized = str(source or "public_tree_detail").strip()
    if normalized not in _ALLOWED_VIEW_SOURCES:
        raise HTTPException(status_code=400, detail="Invalid view source")
    return normalized


def fetch_public_tree_view_count(tree_id: str) -> int:
    """Read the public tree-level view count without creating aggregate rows.

    Missing tree_social_counts remains a safe zero-count fallback so public tree detail
    reads keep working before the migration is applied in a runtime environment.
    """

    def operation() -> dict[str, Any] | None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                tree = _fetch_public_tree_for_view_count(cur, tree_id)
                if not tree:
                    return None

                if not _table_exists(cur, "tree_social_counts"):
                    return {"view_count": 0}

                if not _table_has_column(cur, "tree_social_counts", "view_count"):
                    return {"view_count": 0}

                cur.execute(
                    """
                    SELECT view_count
                    FROM tree_social_counts
                    WHERE tree_id = %s
                    LIMIT 1
                    """,
                    (tree_id,),
                )
                row = cur.fetchone()
                return {"view_count": int(row.get("view_count") or 0) if row else 0}

    result = run_db_with_retry(operation)
    if result is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return int(result.get("view_count") or 0)


def record_public_tree_view(
    tree_id: str,
    actor_key: str,
    actor_kind: str = "anonymous",
    source: str = "public_tree_detail",
) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    safe_actor_key = _normalize_actor_key(actor_key)
    safe_actor_kind = _normalize_actor_kind(actor_kind)
    safe_source = _normalize_view_source(source)

    def operation() -> dict[str, Any] | None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Issue #4139: mutation authorization is transaction-local and
                # row-locked so public -> private revocation cannot commit after
                # authorization but before the view event/count mutation commits.
                tree = _lock_public_tree_for_view_write(cur, safe_tree_id)
                if not tree:
                    return None

                if not _table_exists(cur, "tree_social_counts") or not _table_exists(cur, "tree_view_dedup_events"):
                    return {"treeId": safe_tree_id, "counted": False, "viewCount": _fetch_view_count(cur, safe_tree_id)}

                _ensure_tree_social_counts(cur, safe_tree_id)
                cur.execute(
                    """
                    INSERT INTO tree_view_dedup_events (
                        id,
                        tree_id,
                        actor_key,
                        actor_kind,
                        counted_window_start,
                        source,
                        created_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        date_trunc('day', NOW()),
                        %s,
                        NOW()
                    )
                    ON CONFLICT (tree_id, actor_key, counted_window_start) DO NOTHING
                    RETURNING id
                    """,
                    (str(uuid.uuid4()), safe_tree_id, safe_actor_key, safe_actor_kind, safe_source),
                )
                inserted = cur.fetchone() is not None

                if inserted:
                    cur.execute(
                        """
                        UPDATE tree_social_counts
                        SET view_count = view_count + 1,
                            updated_at = NOW()
                        WHERE tree_id = %s
                        """,
                        (safe_tree_id,),
                    )

                view_count = _fetch_view_count(cur, safe_tree_id)
                conn.commit()
                return {"treeId": safe_tree_id, "counted": inserted, "viewCount": view_count}

    result = run_db_with_retry(operation)
    if result is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return result
