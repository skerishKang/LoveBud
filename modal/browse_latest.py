import os
from typing import List, Dict, Any
from datetime import datetime
import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """PostgreSQL 연결 (psycopg3)"""
    return psycopg.connect(DATABASE_URL)

def normalize_snapshot(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    DB row → LoveBud 프론트엔드 형식으로 정규화
    """
    tags = row.get("tags") or []

    image_url = (
        row.get("screenshot_url") or
        row.get("image_url") or
        "/images/placeholder.png"
    )

    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "url": row["url"],
        "thumbnail": image_url,
        "tags": tags if isinstance(tags, list) else [],
        "source": row.get("source", ""),
        "created_at": row["created_at"].isoformat() if isinstance(row.get("created_at"), datetime) else None,
    }

def fetch_latest_public_tree_snapshots(limit: int = 3) -> List[Dict[str, Any]]:
    """
    최근 public tree snapshot N개 조회 → 정규화 → list
    """
    query = """
        SELECT id, title, description, url, screenshot_url, image_url,
               tags, source, created_at
        FROM snapshots
        WHERE is_public = true
        ORDER BY created_at DESC
        LIMIT %s
    """

    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [normalize_snapshot(row) for row in rows]
