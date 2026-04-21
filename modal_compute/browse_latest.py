from __future__ import annotations

import os
import json
from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row


def get_db_connection() -> psycopg.Connection:
    """Create a psycopg3 connection for snapshot reads."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(db_url, row_factory=dict_row)


def _to_isoformat(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    return None


def estimate_stage(memory_count: int) -> str:
    """Matches netlify/functions/community-trees.js logic."""
    if memory_count <= 0:
        return "empty"
    if memory_count <= 2:
        return "입덕"
    if memory_count <= 4:
        return "성장"
    return "최애"


def parse_tags(all_tags_raw: list[Any] | None) -> list[str]:
    """Parse and flatten emotion tags from multiple memory rows."""
    if not all_tags_raw:
        return []

    unique_tags = set()
    for raw in all_tags_raw:
        if not raw:
            continue
        try:
            # Handle if already a list/dict (psycopg auto-deserialization)
            if isinstance(raw, (list, dict)):
                tags = raw
            else:
                # Handle if JSON string
                tags = json.loads(raw)

            if isinstance(tags, list):
                for t in tags:
                    if t:
                        unique_tags.add(str(t))
        except (json.JSONDecodeError, TypeError):
            if isinstance(raw, str):
                unique_tags.add(raw)

    return sorted(list(unique_tags))[:5]


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a combined DB row into a browse-friendly snapshot."""
    memory_count = row.get("memory_count", 0) or 0
    emotion_tags = parse_tags(row.get("all_tags"))
    
    # Fallback logic for thumbnail
    raw_thumbnail = row.get("raw_thumbnail")
    raw_source_url = row.get("raw_source_url")
    representative_thumbnail = raw_thumbnail or raw_source_url or ""

    # Dates
    created_at = _to_isoformat(row.get("created_at"))
    updated_at = _to_isoformat(row.get("updated_at"))

    return {
        "id": str(row["id"]),
        "title": row.get("title") or "나의 Lovetree",
        "visibility": row.get("visibility") or "public",
        "createdAt": created_at,
        "updatedAt": updated_at,
        "representativeThumbnail": representative_thumbnail,
        "memoryCount": memory_count,
        "emotionTags": emotion_tags,
        "stage": estimate_stage(memory_count),
        "theme": "LoveTree",
        "timeRange": "",  # Future expansion
        "representativeMemorySourceUrl": raw_source_url or "",
    }


def fetch_latest_public_tree_snapshots(limit: int = 3) -> list[dict[str, Any]]:
    """Fetch the latest public tree snapshots using a robust join-lateral query."""

    query = """
        WITH latest_public_trees AS (
            SELECT id, title, visibility, created_at, updated_at
            FROM trees
            WHERE visibility = 'public'
            ORDER BY created_at DESC
            LIMIT %s
        ),
        counts AS (
            SELECT 
                tree_id,
                count(*) as memory_count,
                ARRAY_AGG(emotion_tags) as all_tags
            FROM memories
            WHERE visibility = 'public' 
              AND tree_id IN (SELECT id FROM latest_public_trees)
            GROUP BY tree_id
        )
        SELECT 
            t.id, t.title, t.visibility, t.created_at, t.updated_at,
            COALESCE(c.memory_count, 0) as memory_count,
            c.all_tags,
            m.thumbnail as raw_thumbnail,
            m.source_url as raw_source_url
        FROM latest_public_trees t
        LEFT JOIN LATERAL (
            SELECT thumbnail, source_url
            FROM memories
            WHERE tree_id = t.id 
              AND visibility = 'public'
              AND (NULLIF(thumbnail, '') IS NOT NULL OR NULLIF(source_url, '') IS NOT NULL)
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON TRUE
        LEFT JOIN counts c ON t.id = c.tree_id
        ORDER BY t.created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [normalize_row(row) for row in rows]
