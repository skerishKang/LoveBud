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


def classify_query_error(error: psycopg.Error) -> str:
    """Map psycopg query SQLSTATE to a safe fixed error category.

    This is a pure function — no logging, no side effects.
    Never returns the SQLSTATE value itself.
    psycopg.OperationalError callers must route through the existing
    retry / connection-path before reaching this classifier.
    """
    sqlstate = getattr(error, "sqlstate", None)
    if sqlstate == "42703":
        return "OWNER_TREE_LIST_QUERY_UNDEFINED_COLUMN"
    if sqlstate == "42P01":
        return "OWNER_TREE_LIST_QUERY_UNDEFINED_TABLE"
    if sqlstate == "42501":
        return "OWNER_TREE_LIST_QUERY_INSUFFICIENT_PRIVILEGE"
    if sqlstate == "42883":
        return "OWNER_TREE_LIST_QUERY_UNDEFINED_FUNCTION"
    return "OWNER_TREE_LIST_QUERY_FAILURE"


_TABLE_EXISTS_CACHE: dict[str, bool] = {}
_TABLE_HAS_COLUMN_CACHE: dict[tuple[str, str], bool] = {}


def _table_exists(cur, table_name: str) -> bool:
    """Check if a table exists in the public schema."""
    if table_name in _TABLE_EXISTS_CACHE:
        return _TABLE_EXISTS_CACHE[table_name]
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
    res = bool(row and row.get("exists"))
    _TABLE_EXISTS_CACHE[table_name] = res
    return res


def _table_has_column(cur, table_name: str, column_name: str) -> bool:
    """Check if a table has a specific column."""
    cache_key = (table_name, column_name)
    if cache_key in _TABLE_HAS_COLUMN_CACHE:
        return _TABLE_HAS_COLUMN_CACHE[cache_key]
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
    res = bool(row and row.get("exists"))
    _TABLE_HAS_COLUMN_CACHE[cache_key] = res
    return res


def _build_owner_social_counts_source(
    has_table: bool,
    has_like_count: bool,
    has_view_count: bool,
) -> str:
    """Build the dynamic subquery for tree_social_counts in owner reads.

    Follows the same safe capability-detection pattern as public reads
    but is kept local and narrow for owner-read use only.
    When the table or relevant columns are unavailable, a dummy source
    returning no rows is substituted so the LEFT JOIN produces NULLs.
    """
    if not has_table or (not has_like_count and not has_view_count):
        return "(SELECT NULL::text as tree_id, 0 as like_count, 0 as view_count WHERE FALSE) s_dummy"
    if has_like_count and not has_view_count:
        return "(SELECT tree_id::text as tree_id, like_count, 0 as view_count FROM tree_social_counts) s_social"
    if not has_like_count and has_view_count:
        return "(SELECT tree_id::text as tree_id, 0 as like_count, view_count FROM tree_social_counts) s_social"
    return "(SELECT tree_id::text as tree_id, like_count, view_count FROM tree_social_counts) s_social"


def fetch_user_trees(owner_id: str, limit: int = 100) -> list[dict[str, Any]]:
    _OWNER_LIST_QUERY_TEMPLATE = """
        SELECT t.id, t.owner_id, t.title, t.visibility,
               t.group_name, t.keywords,
               t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count,
               COALESCE(s.like_count, 0) as like_count,
               COALESCE(s.view_count, 0) as view_count
        FROM trees t
        LEFT JOIN memories m ON m.tree_id = t.id
        LEFT JOIN (
            SELECT tree_id, like_count, view_count
            FROM {social_counts_source}
        ) s ON t.id = s.tree_id
        WHERE t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility,
                 t.group_name, t.keywords,
                 t.created_at, t.updated_at,
                 s.like_count, s.view_count
        ORDER BY t.created_at DESC
        LIMIT %s;
    """

    def operation():
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    has_social_counts = _table_exists(cur, "tree_social_counts")
                    has_like_count = _table_has_column(cur, "tree_social_counts", "like_count") if has_social_counts else False
                    has_view_count = _table_has_column(cur, "tree_social_counts", "view_count") if has_social_counts else False

                    social_counts_source = _build_owner_social_counts_source(
                        has_social_counts, has_like_count, has_view_count,
                    )
                    query = _OWNER_LIST_QUERY_TEMPLATE.format(social_counts_source=social_counts_source)

                    try:
                        cur.execute(query, (owner_id, limit))
                        return cur.fetchall(), has_like_count, has_view_count
                    except psycopg.OperationalError:
                        raise
                    except psycopg.Error as error:
                        raise OwnerTreeListError(
                            error_category=classify_query_error(error),
                            failure_phase="query",
                        ) from error
        except OwnerTreeListError:
            raise
        except psycopg.OperationalError:
            raise
        except Exception:
            raise OwnerTreeListError(
                error_category="OWNER_TREE_LIST_DB_CONNECTION_FAILURE",
                failure_phase="db_connection",
            )

    try:
        result = run_db_with_retry(operation)
        rows, has_like_count, has_view_count = result
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
            normalize_tree_row(
                row,
                row.get("memory_count"),
                include_owner_metadata=True,
                include_owner_social_counts=True,
                _owner_like_available=has_like_count,
                _owner_view_available=has_view_count,
            )
            for row in rows
        ]
    except Exception:
        raise OwnerTreeListError(
            error_category="OWNER_TREE_LIST_NORMALIZATION_FAILURE",
            failure_phase="normalization",
        )


def fetch_owner_tree(tree_id: str, owner_id: str) -> dict[str, Any] | None:
    _OWNER_DETAIL_QUERY_TEMPLATE = """
        SELECT t.id, t.owner_id, t.title, t.visibility,
               t.group_name, t.keywords,
               t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count,
               COALESCE(s.like_count, 0) as like_count,
               COALESCE(s.view_count, 0) as view_count
        FROM trees t
        LEFT JOIN memories m ON m.tree_id = t.id
        LEFT JOIN (
            SELECT tree_id, like_count, view_count
            FROM {social_counts_source}
        ) s ON t.id = s.tree_id
        WHERE t.id = %s
          AND t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility,
                 t.group_name, t.keywords,
                 t.created_at, t.updated_at,
                 s.like_count, s.view_count
        LIMIT 1;
    """

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                has_social_counts = _table_exists(cur, "tree_social_counts")
                has_like_count = _table_has_column(cur, "tree_social_counts", "like_count") if has_social_counts else False
                has_view_count = _table_has_column(cur, "tree_social_counts", "view_count") if has_social_counts else False

                social_counts_source = _build_owner_social_counts_source(
                    has_social_counts, has_like_count, has_view_count,
                )
                query = _OWNER_DETAIL_QUERY_TEMPLATE.format(social_counts_source=social_counts_source)
                cur.execute(query, (tree_id, owner_id))
                return cur.fetchone(), has_like_count, has_view_count

    result = run_db_with_retry(operation)
    row, has_like_count, has_view_count = result

    return normalize_tree_row(
        row,
        row.get("memory_count"),
        include_owner_metadata=True,
        include_owner_social_counts=True,
        _owner_like_available=has_like_count,
        _owner_view_available=has_view_count,
    ) if row else None


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
