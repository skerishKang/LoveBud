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
        ORDER BY t.created_at DESC
        LIMIT %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [normalize_row(row) for row in rows]
