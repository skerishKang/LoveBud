from __future__ import annotations

from typing import Any

from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    normalize_row,
    normalize_memory_row,
    normalize_tree_row,
)


def _build_reaction_counts(counts: dict[str, int]) -> dict[str, int]:
    """Ensure reaction_counts dict includes the total key."""
    result = dict(counts)
    result["total"] = sum(counts.values())
    return result


def _table_exists(cur, table_name: str) -> bool:
    """Check if a table exists in the public schema."""
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


def _has_legacy_tree_columns(cur) -> bool:
    """Check if trees table uses legacy column names (name/is_public)."""
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'trees'
              AND column_name = 'name'
        ) AS "exists"
        """,
    )
    row = cur.fetchone()
    return bool(row and row.get("exists"))


def _get_legacy_memory_from_payload(payload: dict[str, Any], memory_id: str) -> dict[str, Any] | None:
    """Find a single memory/node by ID within legacy payload.nodes."""
    nodes = payload.get("nodes") or []
    for node in nodes:
        if node.get("id") == memory_id:
            return node
    return None


def _legacy_payload_node_to_memory_row(node: dict[str, Any], tree_id: str, row: dict[str, Any]) -> dict[str, Any]:
    """Convert a legacy payload node into a memory row dict compatible with normalize_memory_row."""
    return {
        "id": node.get("id"),
        "tree_id": tree_id,
        "parent_id": node.get("parent_id") or node.get("parentId"),
        "title": node.get("title") or node.get("label") or "Untitled Moment",
        "memo": node.get("memo") or node.get("description") or "",
        "artist": node.get("artist") or "",
        "source": node.get("source") or "",
        "source_url": node.get("source_url") or node.get("sourceUrl") or "",
        "source_type": node.get("source_type") or node.get("sourceType") or "youtube",
        "thumbnail": node.get("thumbnail") or "",
        "emotion_tags": node.get("emotion_tags") or node.get("emotionTags") or [],
        "timestamp": node.get("timestamp") or "",
        "visibility": "public",
        "channel_id": node.get("channel_id") or node.get("channelId") or "",
        "channel_name": node.get("channel_name") or node.get("channelName") or "",
        "channel_url": node.get("channel_url") or node.get("channelUrl") or "",
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _is_modern_schema(cur) -> bool:
    """Detect whether the DB uses modern schema (memories table + trees.title)."""
    has_memories = _table_exists(cur, "memories")
    if not has_memories:
        # No memories table at all → legacy
        return False
    # Check if trees has title column (modern indicator)
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'trees'
              AND column_name = 'title'
        ) AS "exists"
        """,
    )
    row = cur.fetchone()
    return bool(row and row.get("exists"))


def _normalize_legacy_tree_row(row: dict[str, Any], payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Normalize a legacy tree row (name/is_public/payload) into the expected tree shape."""
    if payload is None:
        payload = row.get("payload") or {}
    nodes = payload.get("nodes") or []
    return {
        "id": str(row["id"]),
        "title": row.get("title") or row.get("name") or "Untitled LoveTree",
        "visibility": "public" if row.get("is_public") else "private",
        "memoryCount": len(nodes),
        "createdAt": _to_isoformat_dt(row.get("created_at")),
        "updatedAt": _to_isoformat_dt(row.get("updated_at")),
    }


def _to_isoformat_dt(value: Any) -> str | None:
    """Convert datetime or string to ISO format string."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _normalize_legacy_memory_row(node: dict[str, Any], tree_id: str, row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a legacy payload node into the memory shape expected by the frontend."""
    emotion_tags_raw = node.get("emotion_tags") or node.get("emotionTags") or []
    if isinstance(emotion_tags_raw, list):
        emotion_tags = [str(t) for t in emotion_tags_raw if t]
    elif isinstance(emotion_tags_raw, str):
        emotion_tags = [emotion_tags_raw] if emotion_tags_raw else []
    else:
        emotion_tags = []

    return {
        "id": str(node.get("id", "")),
        "treeId": str(tree_id) if tree_id else None,
        "parentId": str(node.get("parent_id") or node.get("parentId") or "") if node.get("parent_id") or node.get("parentId") else None,
        "title": node.get("title") or node.get("label") or "Untitled Moment",
        "memo": node.get("memo") or node.get("description") or "",
        "artist": node.get("artist") or "",
        "source": node.get("source") or "",
        "sourceUrl": node.get("source_url") or node.get("sourceUrl") or "",
        "sourceType": node.get("source_type") or node.get("sourceType") or "youtube",
        "thumbnail": node.get("thumbnail") or "",
        "emotionTags": emotion_tags,
        "timestamp": node.get("timestamp") or "",
        "visibility": "public",
        "channelId": node.get("channel_id") or node.get("channelId") or None,
        "channelName": node.get("channel_name") or node.get("channelName") or None,
        "channelUrl": node.get("channel_url") or node.get("channelUrl") or None,
        "createdAt": _to_isoformat_dt(row.get("created_at")),
        "updatedAt": _to_isoformat_dt(row.get("updated_at")),
        "order": node.get("order", 0),
    }


def fetch_latest_public_tree_snapshots(limit: int = 12, sort: str = "latest") -> list[dict[str, Any]]:
    """Fetch the latest public tree snapshots using a robust join-lateral query."""

    order_clause = "t.created_at DESC"
    if sort == "popular":
        order_clause = "c.memory_count DESC, t.created_at DESC"

    query = """
        SELECT
            t.id, t.title, t.visibility, t.created_at, t.updated_at,
            c.memory_count,
            c.all_tags,
            m.thumbnail as raw_thumbnail,
            m.source_url as raw_source_url
        FROM trees t
        INNER JOIN (
            -- Quality Filter: Only trees with 3+ public memories
            SELECT
                tree_id,
                count(*) as memory_count,
                ARRAY_AGG(emotion_tags) as all_tags
            FROM memories
            WHERE visibility = 'public'
            GROUP BY tree_id
            HAVING count(*) >= 3
        ) c ON t.id = c.tree_id
        LEFT JOIN LATERAL (
            -- Representative Snapshot: Latest memory with visual data
            SELECT thumbnail, source_url
            FROM memories
            WHERE tree_id = t.id
              AND visibility = 'public'
              AND (NULLIF(thumbnail, '') IS NOT NULL OR NULLIF(source_url, '') IS NOT NULL)
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON TRUE
        WHERE t.visibility = 'public'
        ORDER BY {order_clause}
        LIMIT %s;
    """.format(order_clause=order_clause)

    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (limit,))
                return cur.fetchall()

    rows = run_db_with_retry(operation)

    return [normalize_row(row) for row in rows]


def fetch_growing_public_tree_snapshots(limit: int = 6) -> list[dict[str, Any]]:
    """Fetch growing public tree snapshots for trees with 1-2 public memories."""

    query = """
        SELECT
            t.id, t.title, t.visibility, t.created_at, t.updated_at,
            c.memory_count,
            c.all_tags,
            m.thumbnail as raw_thumbnail,
            m.source_url as raw_source_url
        FROM trees t
        INNER JOIN (
            SELECT
                tree_id,
                count(*) as memory_count,
                ARRAY_AGG(emotion_tags) as all_tags
            FROM memories
            WHERE visibility = 'public'
            GROUP BY tree_id
            HAVING count(*) BETWEEN 1 AND 2
        ) c ON t.id = c.tree_id
        LEFT JOIN LATERAL (
            SELECT thumbnail, source_url
            FROM memories
            WHERE tree_id = t.id
              AND visibility = 'public'
              AND (NULLIF(thumbnail, '') IS NOT NULL OR NULLIF(source_url, '') IS NOT NULL)
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON TRUE
        WHERE t.visibility = 'public'
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
        LIMIT %s;
    """

    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (limit,))
                return cur.fetchall()

    rows = run_db_with_retry(operation)

    return [normalize_row(row, stage_override="growing") for row in rows]


def fetch_public_memories(tree_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Fetch public memories for a tree. Falls back to legacy payload.nodes if memories table doesn't exist."""

    def try_modern() -> list[dict[str, Any]] | None:
        """Try the modern memories query. Returns None if memories table is missing."""
        filters = ["m.visibility = 'public'", "t.visibility = 'public'"]
        params: list[Any] = []

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
                    # Check if memories table exists
                    if not _table_exists(cur, "memories"):
                        return None
                    cur.execute(query, tuple(params))
                    return cur.fetchall()

        result = run_db_with_retry(operation)
        if result is None:
            return None
        return [normalize_memory_row(row) for row in result]

    modern_result = try_modern()
    if modern_result is not None:
        return modern_result

    # Legacy fallback: read from payload.nodes
    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if tree_id:
                    cur.execute(
                        """
                        SELECT id, name, is_public, payload, created_at, updated_at
                        FROM trees
                        WHERE id = %s
                          AND is_public = true
                        LIMIT 1
                        """,
                        (tree_id,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, name, is_public, payload, created_at, updated_at
                        FROM trees
                        WHERE is_public = true
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                    )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    result: list[dict[str, Any]] = []

    for tree_row in rows:
        payload = tree_row.get("payload") or {}
        nodes = payload.get("nodes") or []
        # Sort by order if available, otherwise preserve array order
        sorted_nodes = sorted(nodes, key=lambda n: n.get("order", 0) if isinstance(n.get("order"), (int, float)) else 0)
        for node in sorted_nodes[:limit]:
            memory_row = _legacy_payload_node_to_memory_row(node, tree_row["id"], tree_row)
            result.append(normalize_memory_row(memory_row))

    # Sort by created_at DESC (as modern path does)
    result.sort(key=lambda m: m.get("createdAt") or "", reverse=True)

    return result


def fetch_public_memory(memory_id: str) -> dict[str, Any] | None:
    """Fetch a single public memory. Falls back to legacy payload.nodes if memories table doesn't exist."""

    def try_modern() -> dict[str, Any] | None:
        """Try the modern single memory query."""
        query = """
            SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
                   m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
                   m.channel_id, m.channel_name, m.channel_url,
                   m.created_at, m.updated_at
            FROM memories m
            INNER JOIN trees t
              ON t.id = m.tree_id
            WHERE m.id = %s
              AND m.visibility = 'public'
              AND t.visibility = 'public'
            LIMIT 1;
        """

        def operation():
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    if not _table_exists(cur, "memories"):
                        return False  # Sentinel: table doesn't exist
                    cur.execute(query, (memory_id,))
                    return cur.fetchone()

        result = run_db_with_retry(operation)
        if result is False:
            return None  # Table doesn't exist
        if result is None:
            return None  # Not found in modern
        if not result:
            return None

        memory = normalize_memory_row(result)
        # Add reaction counts
        from modal_compute.reactions import fetch_reaction_counts
        counts = fetch_reaction_counts(memory_id)
        memory["reactionCounts"] = _build_reaction_counts(counts)
        return memory

    modern_result = try_modern()
    if modern_result is not None:
        return modern_result

    # Legacy fallback: search payload.nodes for the memory_id
    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, is_public, payload, created_at, updated_at
                    FROM trees
                    WHERE is_public = true
                    ORDER BY updated_at DESC
                    LIMIT 50
                    """,
                )
                return cur.fetchall()

    rows = run_db_with_retry(operation)
    for tree_row in rows:
        payload = tree_row.get("payload") or {}
        node = _get_legacy_memory_from_payload(payload, memory_id)
        if node:
            memory_row = _legacy_payload_node_to_memory_row(node, tree_row["id"], tree_row)
            memory = normalize_memory_row(memory_row)
            # Legacy fixture: no reaction counts
            memory["reactionCounts"] = _build_reaction_counts({})
            return memory

    return None


def fetch_public_tree(tree_id: str) -> dict[str, Any] | None:
    """Fetch a public tree. Falls back to legacy schema (name/is_public/payload) if modern fails."""

    def try_modern() -> dict[str, Any] | None:
        """Try the modern tree query."""
        query = """
            SELECT t.id, t.title, t.visibility, t.created_at, t.updated_at,
                   COUNT(m.id)::int AS memory_count
            FROM trees t
            LEFT JOIN memories m
              ON m.tree_id = t.id
             AND m.visibility = 'public'
            WHERE t.id = %s
              AND t.visibility = 'public'
            GROUP BY t.id, t.title, t.visibility, t.created_at, t.updated_at
            LIMIT 1;
        """

        def operation():
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    if not _table_exists(cur, "memories"):
                        return None  # Table doesn't exist
                    cur.execute(query, (tree_id,))
                    return cur.fetchone()

        row = run_db_with_retry(operation)
        if row is None:
            return None
        # If modern query returned a row but with 0 memory_count and no title, it might be legacy tree
        # that exists but wasn't caught by modern query
        return normalize_tree_row(row, row.get("memory_count"), include_owner=False) if row else None

    modern_result = try_modern()
    if modern_result is not None:
        return modern_result

    # Legacy fallback
    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, is_public, payload, created_at, updated_at
                    FROM trees
                    WHERE id = %s
                      AND is_public = true
                    LIMIT 1;
                    """,
                    (tree_id,),
                )
                return cur.fetchone()

    row = run_db_with_retry(operation)
    if not row:
        return None

    return _normalize_legacy_tree_row(row)
