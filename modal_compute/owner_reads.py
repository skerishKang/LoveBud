from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

import psycopg

from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.schema_capabilities import (
    table_exists as _table_exists,
    table_has_column as _table_has_column,
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

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Issue #4058: client_key is selected only when the canonical
                # schema carries the column. This keeps the read path
                # capability-safe — when the migration has not been applied, we
                # never issue a query against a missing column.
                client_key_select = (
                    "m.client_key," if _table_has_column(cur, "memories", "client_key") else ""
                )
                query = f"""
                    SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
                           m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
                           m.channel_id, m.channel_name, m.channel_url,
                           {client_key_select}
                           m.created_at, m.updated_at
                    FROM memories m
                    INNER JOIN trees t
                      ON t.id = m.tree_id
                    WHERE {' AND '.join(filters)}
                    ORDER BY m.created_at DESC
                    LIMIT %s;
                """
                cur.execute(query, tuple(params))
                return cur.fetchall()

    rows = run_db_with_retry(operation)

    return [normalize_memory_row(row) for row in rows]


# ---------------------------------------------------------------------------
# Bounded deterministic owner-list continuation (cursor mode) — #3944
#
# Legacy fetch_user_trees / fetch_owner_memories keep their raw-array shape.
# The page variants add an opaque keyset cursor over (created_at DESC, id DESC)
# without changing the first-page response for legacy callers. The owner
# predicate always comes from the authenticated UID; the cursor is navigation
# input only and is never treated as authorization.
# ---------------------------------------------------------------------------

_PAGE_CURSOR_VERSION = 1
_TREE_CURSOR_KIND = "trees"
_MEMORY_CURSOR_KIND = "memories"
_MAX_CURSOR_PAYLOAD_CHARS = 1024


class OwnerListCursorError(Exception):
    """Raised when a pagination cursor is missing, malformed, oversized, or wrong-kind."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def _encode_owner_list_cursor(
    kind: str,
    created_at: Any,
    row_id: str,
    tree_id: str | None = None,
) -> str:
    payload: dict[str, Any] = {
        "v": _PAGE_CURSOR_VERSION,
        "k": kind,
        "c": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
        "i": row_id,
    }
    if tree_id is not None:
        payload["t"] = tree_id
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _decode_owner_list_cursor(raw: str | None, expected_kind: str) -> dict[str, Any]:
    if not raw or not isinstance(raw, str):
        raise OwnerListCursorError("empty")
    if len(raw) > _MAX_CURSOR_PAYLOAD_CHARS:
        raise OwnerListCursorError("oversized")
    try:
        pad = -len(raw) % 4
        decoded = base64.urlsafe_b64decode(raw.encode("ascii") + b"=" * pad)
        payload = json.loads(decoded.decode("utf-8"))
    except Exception:
        raise OwnerListCursorError("not_base64_json")
    if not isinstance(payload, dict):
        raise OwnerListCursorError("not_object")
    if payload.get("v") != _PAGE_CURSOR_VERSION:
        raise OwnerListCursorError("bad_version")
    if payload.get("k") != expected_kind:
        raise OwnerListCursorError("wrong_kind")
    created_at = payload.get("c")
    row_id = payload.get("i")
    if (
        not isinstance(created_at, str)
        or not isinstance(row_id, str)
        or not row_id
        or len(row_id) > 64
        or len(created_at) > 64
    ):
        raise OwnerListCursorError("missing_fields")
    try:
        created_at_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except Exception:
        raise OwnerListCursorError("bad_timestamp")
    tree_id = payload.get("t")
    if tree_id is not None and (not isinstance(tree_id, str) or not tree_id or len(tree_id) > 64):
        raise OwnerListCursorError("bad_tree_id")
    return {"created_at": created_at_dt, "id": row_id, "tree_id": tree_id}


def _page_from_rows(rows, kind, has_like_count, has_view_count, limit, tree_id=None):
    normalize = normalize_tree_row if kind == _TREE_CURSOR_KIND else normalize_memory_row
    normalized = []
    if kind == _TREE_CURSOR_KIND:
        for row in rows:
            normalized.append(
                normalize_tree_row(
                    row,
                    row.get("memory_count"),
                    include_owner_metadata=True,
                    include_owner_social_counts=True,
                    _owner_like_available=has_like_count,
                    _owner_view_available=has_view_count,
                )
            )
    else:
        for row in rows:
            normalized.append(normalize_memory_row(row))
    has_more = len(normalized) > limit
    items = normalized[:limit]
    next_cursor = None
    if has_more:
        last = items[-1]
        next_cursor = _encode_owner_list_cursor(
            kind,
            last.get("createdAt"),
            str(last.get("id")),
            tree_id=tree_id,
        )
    return items, next_cursor


def _run_owner_page_query(build_query_and_params):
    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                has_social_counts = _table_exists(cur, "tree_social_counts")
                has_like_count = _table_has_column(cur, "tree_social_counts", "like_count") if has_social_counts else False
                has_view_count = _table_has_column(cur, "tree_social_counts", "view_count") if has_social_counts else False
                # Issue #4058: detect the canonical client_key column so the
                # memory page query stays capability-safe (no query against a
                # missing column before the migration is applied).
                has_client_key = _table_has_column(cur, "memories", "client_key")
                social_counts_source = _build_owner_social_counts_source(
                    has_social_counts, has_like_count, has_view_count,
                )
                query, params = build_query_and_params(social_counts_source, has_like_count, has_view_count, has_client_key)
                try:
                    cur.execute(query, tuple(params))
                    return cur.fetchall(), has_like_count, has_view_count
                except psycopg.OperationalError:
                    raise
                except psycopg.Error as error:
                    raise OwnerTreeListError(
                        error_category=classify_query_error(error),
                        failure_phase="query",
                    ) from error

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
    return rows, has_like_count, has_view_count


_TREE_PAGE_QUERY = """
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
    {cursor_predicate}
    GROUP BY t.id, t.owner_id, t.title, t.visibility,
             t.group_name, t.keywords,
             t.created_at, t.updated_at,
             s.like_count, s.view_count
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT %s;
"""


def page_user_trees(owner_id: str, limit: int, cursor: str | None = None) -> tuple[list[dict[str, Any]], str | None]:
    decoded = None
    if cursor is not None:
        decoded = _decode_owner_list_cursor(cursor, _TREE_CURSOR_KIND)

    def build(social_counts_source, _like, _view, has_client_key):
        params: list[Any] = [owner_id]
        cursor_predicate = ""
        if decoded is not None:
            cursor_predicate = "AND ((t.created_at < %s) OR (t.created_at = %s AND t.id < %s))"
            params.extend([decoded["created_at"], decoded["created_at"], decoded["id"]])
        params.append(limit + 1)
        query = _TREE_PAGE_QUERY.format(
            social_counts_source=social_counts_source,
            cursor_predicate=cursor_predicate,
        )
        return query, params

    rows, has_like_count, has_view_count = _run_owner_page_query(build)
    return _page_from_rows(rows, _TREE_CURSOR_KIND, has_like_count, has_view_count, limit)


_MEMORY_PAGE_QUERY = """
    SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
           m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
           m.channel_id, m.channel_name, m.channel_url,
           {client_key_select}
           m.created_at, m.updated_at
    FROM memories m
    INNER JOIN trees t
      ON t.id = m.tree_id
    WHERE {filters}
    {cursor_predicate}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT %s;
"""


def page_owner_memories(
    owner_id: str,
    tree_id: str | None,
    limit: int,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    decoded = None
    if cursor is not None:
        decoded = _decode_owner_list_cursor(cursor, _MEMORY_CURSOR_KIND)
        cursor_tree_id = decoded.get("tree_id")
        if tree_id is not None:
            if cursor_tree_id != tree_id:
                raise OwnerListCursorError("tree_scope_mismatch")
        else:
            if cursor_tree_id is not None:
                raise OwnerListCursorError("tree_scope_required")

    def build(social_counts_source, _like, _view, has_client_key):
        filters = ["t.owner_id = %s"]
        params: list[Any] = [owner_id]
        if tree_id:
            filters.append("m.tree_id = %s")
            params.append(tree_id)
        cursor_predicate = ""
        if decoded is not None:
            cursor_predicate = "AND ((m.created_at < %s) OR (m.created_at = %s AND m.id < %s))"
            params.extend([decoded["created_at"], decoded["created_at"], decoded["id"]])
        params.append(limit + 1)
        client_key_select = "m.client_key," if has_client_key else ""
        query = _MEMORY_PAGE_QUERY.format(
            filters=" AND ".join(filters),
            cursor_predicate=cursor_predicate,
            client_key_select=client_key_select,
        )
        return query, params

    rows, _like, _view = _run_owner_page_query(build)
    return _page_from_rows(rows, _MEMORY_CURSOR_KIND, _like, _view, limit, tree_id=tree_id)
