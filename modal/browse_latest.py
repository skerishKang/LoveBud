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
    """Normalize DB rows into a stable browse snapshot payload."""
    tags = row.get("tags") or []
    image_url = (
        row.get("screenshot_url")
        or row.get("image_url")
        or ""
    )

    return {
        "id": str(row["id"]),
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "sourceUrl": row.get("url") or "",
        "thumbnail": image_url,
        "tags": tags if isinstance(tags, list) else [],
        "source": row.get("source") or "",
        "createdAt": _to_isoformat(row.get("created_at")),
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
