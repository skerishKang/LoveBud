from __future__ import annotations

import time
from typing import Any

from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    estimate_stage,
    normalize_row,
    normalize_memory_row,
    normalize_tree_row,
    parse_tags,
)


def _build_reaction_counts(counts: dict[str, int]) -> dict[str, int]:
    """Ensure reaction_counts dict includes the total key."""
    result = dict(counts)
    result["total"] = sum(counts.values())
    return result


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


def _build_social_counts_source(
    has_table: bool,
    has_like_count: bool,
    has_view_count: bool,
) -> str:
    """Build the dynamic subquery or table reference for tree_social_counts."""
    if not has_table or (not has_like_count and not has_view_count):
        return "(SELECT NULL::uuid as tree_id, 0 as like_count, 0 as view_count WHERE FALSE) s_dummy"
    if has_like_count and not has_view_count:
        return "(SELECT tree_id, like_count, 0 as view_count FROM tree_social_counts) s_social"
    if not has_like_count and has_view_count:
        return "(SELECT tree_id, 0 as like_count, view_count FROM tree_social_counts) s_social"
    # Both table and columns exist
    return "tree_social_counts"


def fetch_latest_public_tree_snapshots(limit: int = 12, sort: str = "latest") -> list[dict[str, Any]]:
    """Fetch the latest public tree snapshots using a robust join-lateral query.
    Falls back to legacy trees.payload format if memories table is missing.
    Supports sort="latest" (created_at DESC), sort="popular" (memory_count DESC),
    sort="likes" (like_count DESC), and sort="views" (view_count DESC).
    """

    order_clause = "t.created_at DESC"
    if sort == "popular":
        order_clause = "c.memory_count DESC, t.created_at DESC"
    elif sort == "likes":
        order_clause = "s.like_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC"
    elif sort == "views":
        order_clause = "s.view_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC"

    modern_query_template = """
        SELECT
            t.id, t.title, t.visibility, t.created_at, t.updated_at,
            c.memory_count,
            c.all_tags,
            COALESCE(s.like_count, 0) as like_count,
            COALESCE(s.view_count, 0) as view_count,
            m.thumbnail as raw_thumbnail,
            m.source_url as raw_source_url
        FROM trees t
        INNER JOIN (
            -- Quality Filter: Only trees with 3+ public memories
            SELECT
                tree_id,
                count(*) as memory_count,
                jsonb_agg(emotion_tags) as all_tags
            FROM memories
            WHERE visibility = 'public'
            GROUP BY tree_id
            HAVING count(*) >= 3
        ) c ON t.id = c.tree_id
        LEFT JOIN (
            -- Social counts: like_count, view_count
            -- COALESCE handles pre-migration envs (table or column missing) safely.
            SELECT tree_id, like_count, view_count
            FROM {social_counts_source}
        ) s ON t.id = s.tree_id
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
    """

    def operation() -> list[dict[str, Any]]:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                meta_start = time.time()
                has_memories = _table_exists(cur, "memories")
                has_title = _table_has_column(cur, "trees", "title")
                # sort=views requires tree_social_counts.view_count to exist.
                # If the migration has not run yet, fall back to the latest
                # order rather than crashing the whole endpoint.
                has_social_counts_table = _table_exists(cur, "tree_social_counts")
                has_like_count_column = _table_has_column(cur, "tree_social_counts", "like_count") if has_social_counts_table else False
                has_view_count_column = _table_has_column(cur, "tree_social_counts", "view_count") if has_social_counts_table else False
                effective_order_clause = order_clause
                if sort == "likes" and not (has_social_counts_table and has_like_count_column):
                    effective_order_clause = "t.created_at DESC"
                elif sort == "views" and not (has_social_counts_table and has_view_count_column):
                    effective_order_clause = "t.created_at DESC"
                meta_duration = (time.time() - meta_start) * 1000
                print(f"[LoveBudModal] [TIMING] Schema metadata check took {meta_duration:.2f}ms")

                if has_memories and has_title:
                    q_start = time.time()
                    social_counts_source = _build_social_counts_source(
                        has_social_counts_table,
                        has_like_count_column,
                        has_view_count_column,
                    )
                    modern_query = modern_query_template.format(
                        order_clause=effective_order_clause,
                        social_counts_source=social_counts_source,
                    )
                    cur.execute(modern_query, (limit,))
                    rows = cur.fetchall()
                    q_duration = (time.time() - q_start) * 1000
                    print(f"[LoveBudModal] Latest browse query took {q_duration:.2f}ms (limit={limit})")
                    return [normalize_row(row, include_like_count=True) for row in rows]

                # Fallback: legacy schema (name/is_public/payload)
                has_name = _table_has_column(cur, "trees", "name")
                has_is_public = _table_has_column(cur, "trees", "is_public")
                if not has_name or not has_is_public:
                    return []

                cur.execute(
                    """SELECT id, name, is_public, payload, created_at, updated_at
                       FROM trees WHERE is_public = true
                       ORDER BY created_at DESC LIMIT %s""",
                    (limit * 2,),
                )
                raw_rows = cur.fetchall()

                result: list[dict[str, Any]] = []
                for row in raw_rows:
                    raw_payload = row.get("payload")
                    payload = raw_payload if isinstance(raw_payload, dict) else {}
                    nodes = payload.get("nodes") or []
                    public_nodes = [
                        n for n in nodes
                        if isinstance(n, dict) and n.get("visibility", "public") == "public"
                    ]
                    if len(public_nodes) < 3:
                        continue  # Quality filter: 3+ public memories

                    all_tags_collected: list[list[str]] = []
                    rep_thumbnail = ""
                    rep_source_url = ""
                    for n in public_nodes:
                        tags = n.get("emotion_tags") or n.get("emotionTags") or []
                        if isinstance(tags, list):
                            all_tags_collected.append(tags)
                        if not rep_thumbnail and n.get("thumbnail"):
                            rep_thumbnail = n.get("thumbnail", "")
                        if not rep_source_url and (n.get("source_url") or n.get("sourceUrl")):
                            rep_source_url = n.get("source_url") or n.get("sourceUrl") or ""

                    mc = len(public_nodes)
                    result.append({
                        "id": str(row["id"]),
                        "title": row.get("name") or "나의 Lovetree",
                        "visibility": "public",
                        "createdAt": _to_isoformat_dt(row.get("created_at")),
                        "updatedAt": _to_isoformat_dt(row.get("updated_at")),
                        "representativeThumbnail": rep_thumbnail or rep_source_url or "",
                        "memoryCount": mc,
                        "emotionTags": parse_tags(all_tags_collected),
                        "stage": estimate_stage(mc),
                        "theme": "LoveTree",
                        "timeRange": "",
                        "representativeMemorySourceUrl": rep_source_url or "",
                    })
                    if len(result) >= limit:
                        break
                return result

    return run_db_with_retry(operation)


def fetch_growing_public_tree_snapshots(limit: int = 6) -> list[dict[str, Any]]:
    """Fetch growing public tree snapshots for trees with 1-2 public memories.
    Falls back to legacy trees.payload format if memories table is missing.
    """

    modern_query = """
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
                jsonb_agg(emotion_tags) as all_tags
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
        conn_start = time.time()
        with get_db_connection() as conn:
            conn_acquire_ms = (time.time() - conn_start) * 1000
            print(f"[LoveBudModal] [TIMING] DB connection acquisition took {conn_acquire_ms:.2f}ms")
            with conn.cursor() as cur:
                meta_start = time.time()
                has_memories = _table_exists(cur, "memories")
                has_title = _table_has_column(cur, "trees", "title")
                meta_duration = (time.time() - meta_start) * 1000
                print(f"[LoveBudModal] [TIMING] Schema metadata check took {meta_duration:.2f}ms")

                if has_memories and has_title:
                    q_start = time.time()
                    cur.execute(modern_query, (limit,))
                    rows = cur.fetchall()
                    q_duration = (time.time() - q_start) * 1000
                    print(f"[LoveBudModal] [TIMING] SQL execution took {q_duration:.2f}ms (limit={limit})")
                    return [normalize_row(row, stage_override="growing") for row in rows]

                # Fallback: legacy schema (name/is_public/payload)
                has_name = _table_has_column(cur, "trees", "name")
                has_is_public = _table_has_column(cur, "trees", "is_public")
                if not has_name or not has_is_public:
                    return []

                q_start = time.time()
                cur.execute(
                    """SELECT id, name, is_public, payload, created_at, updated_at
                       FROM trees WHERE is_public = true
                       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
                       LIMIT %s""",
                    (limit * 3,),
                )
                raw_rows = cur.fetchall()
                q_duration = (time.time() - q_start) * 1000
                print(f"[LoveBudModal] [TIMING] Legacy fallback SQL execution took {q_duration:.2f}ms")

                map_start = time.time()
                result: list[dict[str, Any]] = []
                for row in raw_rows:
                    raw_payload = row.get("payload")
                    payload = raw_payload if isinstance(raw_payload, dict) else {}
                    nodes = payload.get("nodes") or []
                    public_nodes = [
                        n for n in nodes
                        if isinstance(n, dict) and n.get("visibility", "public") == "public"
                    ]
                    mc = len(public_nodes)
                    if mc < 1 or mc > 2:
                        continue  # Growing filter: 1-2 public memories

                    all_tags_collected: list[list[str]] = []
                    rep_thumbnail = ""
                    rep_source_url = ""
                    for n in public_nodes:
                        tags = n.get("emotion_tags") or n.get("emotionTags") or []
                        if isinstance(tags, list):
                            all_tags_collected.append(tags)
                        if not rep_thumbnail and n.get("thumbnail"):
                            rep_thumbnail = n.get("thumbnail", "")
                        if not rep_source_url and (n.get("source_url") or n.get("sourceUrl")):
                            rep_source_url = n.get("source_url") or n.get("sourceUrl") or ""

                    result.append({
                        "id": str(row["id"]),
                        "title": row.get("name") or "나의 Lovetree",
                        "visibility": "public",
                        "createdAt": _to_isoformat_dt(row.get("created_at")),
                        "updatedAt": _to_isoformat_dt(row.get("updated_at")),
                        "representativeThumbnail": rep_thumbnail or rep_source_url or "",
                        "memoryCount": mc,
                        "emotionTags": parse_tags(all_tags_collected),
                        "stage": "growing",
                        "theme": "LoveTree",
                        "timeRange": "",
                        "representativeMemorySourceUrl": rep_source_url or "",
                    })
                    if len(result) >= limit:
                        break
                map_duration = (time.time() - map_start) * 1000
                print(f"[LoveBudModal] [TIMING] Legacy fallback result mapping/normalization took {map_duration:.2f}ms")
                return result

    return run_db_with_retry(operation)


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
                has_title = _table_has_column(cur, "trees", "title")
                has_visibility = _table_has_column(cur, "trees", "visibility")
                has_name = _table_has_column(cur, "trees", "name")
                has_is_public = _table_has_column(cur, "trees", "is_public")

                # Use appropriate column names based on schema
                if has_title and has_visibility:
                    tree_cols = "id, title as name, visibility as is_public, payload, created_at, updated_at"
                    public_filter = "visibility = 'public'"
                elif has_name and has_is_public:
                    tree_cols = "id, name, is_public, payload, created_at, updated_at"
                    public_filter = "is_public = true"
                else:
                    return []

                if tree_id:
                    cur.execute(
                        f"""
                        SELECT {tree_cols}
                        FROM trees
                        WHERE id = %s
                          AND {public_filter}
                        LIMIT 1
                        """,
                        (tree_id,),
                    )
                else:
                    cur.execute(
                        f"""
                        SELECT {tree_cols}
                        FROM trees
                        WHERE {public_filter}
                        ORDER BY created_at DESC
                        LIMIT 20
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
                has_title = _table_has_column(cur, "trees", "title")
                has_visibility = _table_has_column(cur, "trees", "visibility")
                has_name = _table_has_column(cur, "trees", "name")
                has_is_public = _table_has_column(cur, "trees", "is_public")

                # Use appropriate column names based on schema
                if has_title and has_visibility:
                    tree_cols = "id, title as name, visibility as is_public, payload, created_at, updated_at"
                    public_filter = "visibility = 'public'"
                elif has_name and has_is_public:
                    tree_cols = "id, name, is_public, payload, created_at, updated_at"
                    public_filter = "is_public = true"
                else:
                    return []

                cur.execute(
                    f"""
                    SELECT {tree_cols}
                    FROM trees
                    WHERE {public_filter}
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

    def operation():
        """Detect schema, query accordingly, and return raw row."""
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                has_memories = _table_exists(cur, "memories")
                has_title = _table_has_column(cur, "trees", "title")
                has_name = _table_has_column(cur, "trees", "name")

                if has_memories and has_title:
                    # Modern path: memories JOIN trees
                    cur.execute(
                        """
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
                        """,
                        (tree_id,),
                    )
                    return cur.fetchone()

                if has_title:
                    # Modern tree columns + no memories table: query trees directly
                    cur.execute(
                        """
                        SELECT id, title, visibility, created_at, updated_at
                        FROM trees
                        WHERE id = %s
                          AND visibility = 'public'
                        LIMIT 1;
                        """,
                        (tree_id,),
                    )
                    return cur.fetchone()

                if has_name:
                    # Legacy path: name/is_public/payload
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

                return None

    row = run_db_with_retry(operation)
    if not row:
        return None

    # Determine normalizer based on schema: legacy rows have payload/name, modern rows have title
    if row.get("payload") is not None or row.get("name") is not None:
        return _normalize_legacy_tree_row(row)

    return normalize_tree_row(row, row.get("memory_count"), include_owner=False)
