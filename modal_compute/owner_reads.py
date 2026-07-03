from __future__ import annotations

from typing import Any

import psycopg

from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    normalize_memory_row,
    normalize_tree_row,
)


class OwnerTreeListError(Exception):
    def __init__(
        self,
        error_category: str,
        failure_phase: str,
    ) -> None:
        self.error_category = error_category
        self.failure_phase = failure_phase


def fetch_user_trees(owner_id: str, limit: int = 100) -> list[dict[str, Any]]:
    query = """
        SELECT t.id, t.owner_id, t.title, t.visibility,
               t.group_name, t.keywords,
               t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count
        FROM trees t
        LEFT JOIN memories m
          ON m.tree_id = t.id
        WHERE t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility,
                 t.group_name, t.keywords,
                 t.created_at, t.updated_at
        ORDER BY t.created_at DESC
        LIMIT %s;
    """

    def operation():
        try:
            conn_context = get_db_connection()
        except Exception:
            raise OwnerTreeListError(
                error_category="OWNER_TREE_LIST_DB_CONNECTION_FAILURE",
                failure_phase="db_connection",
            )
        with conn_context as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(query, (owner_id, limit))
                    return cur.fetchall()
                except psycopg.OperationalError:
                    raise
                except psycopg.Error:
                    raise OwnerTreeListError(
                        error_category="OWNER_TREE_LIST_QUERY_FAILURE",
                        failure_phase="query",
                    )

    try:
        rows = run_db_with_retry(operation)
    except OwnerTreeListError:
        raise
    except psycopg.OperationalError:
        raise OwnerTreeListError(
            error_category="OWNER_TREE_LIST_DB_CONNECTION_FAILURE",
            failure_phase="db_connection",
        )
    except Exception:
        raise OwnerTreeListError(
            error_category="OWNER_TREE_LIST_UNEXPECTED_FAILURE",
            failure_phase="unexpected",
        )

    try:
        return [
            normalize_tree_row(row, row.get("memory_count"), include_owner_metadata=True)
            for row in rows
        ]
    except Exception:
        raise OwnerTreeListError(
            error_category="OWNER_TREE_LIST_NORMALIZATION_FAILURE",
            failure_phase="normalization",
        )


def fetch_owner_tree(tree_id: str, owner_id: str) -> dict[str, Any] | None:
    query = """
        SELECT t.id, t.owner_id, t.title, t.visibility,
               t.group_name, t.keywords,
               t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count
        FROM trees t
        LEFT JOIN memories m
          ON m.tree_id = t.id
        WHERE t.id = %s
          AND t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility,
                 t.group_name, t.keywords,
                 t.created_at, t.updated_at
        LIMIT 1;
    """

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (tree_id, owner_id))
                return cur.fetchone()

    row = run_db_with_retry(operation)

    return normalize_tree_row(row, row.get("memory_count"), include_owner_metadata=True) if row else None


def fetch_owner_memories(owner_id: str, tree_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    params: list[Any] = [owner_id]
    filters = ["t.owner_id = %s"]

    if tree_id:
        params.append(tree_id)
        filters.append("m.tree_id = %s")

    params.append(limit)
    query = f"""
        SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
               m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
               m.channel_id, m.channel_name, m.channel_url,
               m.created_at, m.updated_at
        FROM memories m
        INNER JOIN trees t
          ON t.id = m.tree_id
        WHERE {' AND '.join(filters)}
        ORDER BY m.created_at DESC
        LIMIT %s;
    """

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                return cur.fetchall()

    rows = run_db_with_retry(operation)

    return [normalize_memory_row(row) for row in rows]
