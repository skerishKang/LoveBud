from __future__ import annotations

import os
import json
from datetime import datetime
from typing import Any

import modal
import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row

# --- DB Logic (formerly browse_latest.py) ---

def get_db_connection() -> psycopg.Connection:
    """Create a psycopg3 connection for snapshot reads."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(db_url, row_factory=dict_row)


def _to_isoformat(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


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
            if isinstance(raw, (list, dict)):
                tags = raw
            else:
                tags = json.loads(raw)

            if isinstance(tags, list):
                for t in tags:
                    if t:
                        unique_tags.add(str(t))
        except (json.JSONDecodeError, TypeError):
            if isinstance(raw, str):
                unique_tags.add(raw)

    return sorted(list(unique_tags))[:5]


def normalize_tags(raw: Any) -> list[str]:
    """Normalize a single memory emotion_tags value."""
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(tag) for tag in raw if tag]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return [raw] if raw else []
        if isinstance(parsed, list):
            return [str(tag) for tag in parsed if tag]
    return []


def normalize_memory_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "treeId": str(row["tree_id"]) if row.get("tree_id") else None,
        "parentId": str(row["parent_id"]) if row.get("parent_id") else None,
        "title": row.get("title") or "",
        "memo": row.get("memo") or "",
        "artist": row.get("artist") or "",
        "source": row.get("source") or "",
        "sourceUrl": row.get("source_url") or "",
        "sourceType": row.get("source_type") or "youtube",
        "thumbnail": row.get("thumbnail") or "",
        "emotionTags": normalize_tags(row.get("emotion_tags")),
        "timestamp": row.get("timestamp") or "",
        "visibility": row.get("visibility") or "public",
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
    }


def normalize_tree_row(row: dict[str, Any], memory_count: int | None = None) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "ownerId": str(row["owner_id"]) if row.get("owner_id") else None,
        "title": row.get("title") or "",
        "visibility": row.get("visibility") or "public",
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
        "memoryCount": int(memory_count or 0),
    }


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a combined DB row into a browse-friendly snapshot."""
    memory_count = row.get("memory_count", 0) or 0
    emotion_tags = parse_tags(row.get("all_tags"))
    
    raw_thumbnail = row.get("raw_thumbnail")
    raw_source_url = row.get("raw_source_url")
    representative_thumbnail = raw_thumbnail or raw_source_url or ""

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
        "timeRange": "",
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


def fetch_public_memories(tree_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    filters = ["visibility = 'public'"]
    params: list[Any] = []

    if tree_id:
        params.append(tree_id)
        filters.append(f"tree_id = %s")

    params.append(limit)
    query = f"""
        SELECT id, tree_id, parent_id, title, memo, artist, source, source_url,
               source_type, thumbnail, emotion_tags, timestamp, visibility,
               created_at, updated_at
        FROM memories
        WHERE {' AND '.join(filters)}
        ORDER BY created_at DESC
        LIMIT %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    return [normalize_memory_row(row) for row in rows]


def fetch_public_memory(memory_id: str) -> dict[str, Any] | None:
    query = """
        SELECT id, tree_id, parent_id, title, memo, artist, source, source_url,
               source_type, thumbnail, emotion_tags, timestamp, visibility,
               created_at, updated_at
        FROM memories
        WHERE id = %s
          AND visibility = 'public'
        LIMIT 1;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (memory_id,))
            row = cur.fetchone()

    return normalize_memory_row(row) if row else None


def fetch_public_tree(tree_id: str) -> dict[str, Any] | None:
    query = """
        SELECT t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count
        FROM trees t
        LEFT JOIN memories m
          ON m.tree_id = t.id
         AND m.visibility = 'public'
        WHERE t.id = %s
          AND t.visibility = 'public'
        GROUP BY t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at
        LIMIT 1;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (tree_id,))
            row = cur.fetchone()

    return normalize_tree_row(row, row.get("memory_count")) if row else None


# --- Modal App Setup ---

app = modal.App("lovebud-browse-snapshot")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.12",
        "psycopg[binary]==3.2.9",
    )
)

web_app = FastAPI(
    title="LoveBud Modal Compute Layer",
    version="1.0.0",
)


def _allowed_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://lovebud.vercel.app,https://lovebud.pages.dev,https://lovebud.netlify.app",
    )
    return [value.strip() for value in raw.split(",") if value.strip()]


web_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@web_app.get("/modal/health")
def modal_health() -> dict[str, bool]:
    return {"ok": True}


@web_app.get("/modal/browse/latest")
def get_latest_browse_snapshot(
    limit: int = Query(default=3, ge=1, le=3),
) -> list[dict]:
    return fetch_latest_public_tree_snapshots(limit=limit)


@web_app.get("/modal/community/memories")
def get_public_community_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[dict]:
    return fetch_public_memories(tree_id=treeId, limit=limit)


@web_app.get("/modal/memories/{memory_id}")
def get_public_memory_detail(memory_id: str) -> dict:
    memory = fetch_public_memory(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@web_app.get("/modal/trees/{tree_id}")
def get_public_tree_detail(tree_id: str) -> dict:
    tree = fetch_public_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@app.function(
    image=image,
    cpu=1,
    memory=512,
    scaledown_window=60,
    min_containers=0,
    secrets=[modal.Secret.from_name("lovebud-db")],
)
@modal.asgi_app()
def fastapi_app():
    return web_app
