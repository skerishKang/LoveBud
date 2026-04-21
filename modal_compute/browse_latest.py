from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row


DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection() -> psycopg.Connection:
    """Create a psycopg3 connection for snapshot reads."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _to_isoformat(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    return None


def normalize_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize DB rows into a browse-friendly snapshot payload."""
    tags = row.get("tags") or []
    if not isinstance(tags, list):
        tags = []

    source_url = row.get("url") or ""
    thumbnail = row.get("screenshot_url") or row.get("image_url") or ""
    created_at = _to_isoformat(row.get("created_at"))
    description = row.get("description") or ""
    source = row.get("source") or "LoveTree"

    return {
        # Browse-summary compatible keys
        "id": str(row["id"]),
        "title": row.get("title") or "",
        "visibility": "public",
        "createdAt": created_at,
        "updatedAt": created_at,
        "representativeThumbnail": thumbnail,
        "memoryCount": 0,
        "emotionTags": tags[:3],
        "stage": "empty",
        "theme": source,
        "timeRange": "",
        # Snapshot-specific companion fields
        "summary": description,
        "representativeMemorySourceUrl": source_url,
        # Transitional aliases for consumers still experimenting
        "thumbnail": thumbnail,
        "tags": tags,
        "source": source,
        "sourceUrl": source_url,
    }


def fetch_latest_public_tree_snapshots(limit: int = 3) -> list[dict[str, Any]]:
    """Fetch the latest public tree snapshots for browse preview use."""
    query = """
        SELECT id, title, description, url, screenshot_url, image_url,
               tags, source, created_at
        FROM snapshots
        WHERE is_public = true
        ORDER BY created_at DESC
        LIMIT %s
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [normalize_snapshot(row) for row in rows]
