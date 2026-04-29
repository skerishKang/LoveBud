from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

import modal
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from modal_compute.auth import (
    PlusRequiredError,
    get_firebase_certs,
    require_firebase_user,
    require_plus_for_private_storage,
)
from modal_compute.config import _allowed_origins as _config_allowed_origins
from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    _to_isoformat,
    estimate_stage,
    parse_tags,
    normalize_tags,
    normalize_memory_row,
    normalize_tree_row,
    normalize_row,
    validate_visibility,
    validate_optional_string,
    validate_required_uuid,
    validate_optional_uuid,
)


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
    filters = ["m.visibility = 'public'", "t.visibility = 'public'"]
    params: list[Any] = []

    if tree_id:
        params.append(tree_id)
        filters.append("m.tree_id = %s")

    params.append(limit)
    query = f"""
        SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
               m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
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


def fetch_public_memory(memory_id: str) -> dict[str, Any] | None:
    query = """
        SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
               m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
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
                cur.execute(query, (memory_id,))
                return cur.fetchone()

    row = run_db_with_retry(operation)

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

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (tree_id,))
                return cur.fetchone()

    row = run_db_with_retry(operation)

    return normalize_tree_row(row, row.get("memory_count")) if row else None


def fetch_user_trees(owner_id: str, limit: int = 100) -> list[dict[str, Any]]:
    query = """
        SELECT t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count
        FROM trees t
        LEFT JOIN memories m
          ON m.tree_id = t.id
        WHERE t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at
        ORDER BY t.created_at DESC
        LIMIT %s;
    """

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (owner_id, limit))
                return cur.fetchall()

    rows = run_db_with_retry(operation)

    return [normalize_tree_row(row, row.get("memory_count")) for row in rows]


def fetch_owner_tree(tree_id: str, owner_id: str) -> dict[str, Any] | None:
    query = """
        SELECT t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at,
               COUNT(m.id)::int AS memory_count
        FROM trees t
        LEFT JOIN memories m
          ON m.tree_id = t.id
        WHERE t.id = %s
          AND t.owner_id = %s
        GROUP BY t.id, t.owner_id, t.title, t.visibility, t.created_at, t.updated_at
        LIMIT 1;
    """

    def operation():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (tree_id, owner_id))
                return cur.fetchone()

    row = run_db_with_retry(operation)

    return normalize_tree_row(row, row.get("memory_count")) if row else None


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


def create_owner_tree(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    title = validate_optional_string(payload.get("title"), 200) or "My LoveTree"
    visibility = validate_visibility(payload.get("visibility"), "public")
    require_plus_for_private_storage(owner_id, visibility)

    query = """
        INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
        VALUES (%s, %s, %s, %s, NOW(), NOW())
        RETURNING id, owner_id, title, visibility, created_at, updated_at;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (str(uuid.uuid4()), owner_id, title, visibility))
            row = cur.fetchone()
        conn.commit()

    return normalize_tree_row(row, 0)


def create_owner_memory(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    tree_id = validate_required_uuid(payload.get("treeId"), "treeId")
    tree = fetch_owner_tree(tree_id, owner_id)
    if not tree:
        raise HTTPException(status_code=403, detail="Access denied: not your tree")
    visibility = validate_visibility(payload.get("visibility"), tree.get("visibility") or "public")
    require_plus_for_private_storage(owner_id, visibility)

    parent_id = None
    if payload.get("parentId"):
        parent_id = validate_required_uuid(payload.get("parentId"), "parentId")

    emotion_tags = payload.get("emotionTags") if isinstance(payload.get("emotionTags"), list) else []
    if len(emotion_tags) > 20:
        raise HTTPException(status_code=400, detail="emotionTags exceeds maximum of 20 items")

    query = """
        INSERT INTO memories (
            id, tree_id, parent_id, title, memo, artist, source, source_url,
            source_type, thumbnail, emotion_tags, timestamp, visibility,
            created_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
                  source_type, thumbnail, emotion_tags, timestamp, visibility,
                  created_at, updated_at;
    """
    params = (
        str(uuid.uuid4()),
        tree_id,
        parent_id,
        validate_optional_string(payload.get("title"), 200),
        validate_optional_string(payload.get("memo"), 5000),
        validate_optional_string(payload.get("artist"), 100),
        validate_optional_string(payload.get("source"), 200),
        validate_optional_string(payload.get("sourceUrl"), 1000),
        validate_optional_string(payload.get("sourceType"), 50) or "youtube",
        validate_optional_string(payload.get("thumbnail"), 500),
        json.dumps([str(tag).strip() for tag in emotion_tags if str(tag).strip()]),
        validate_optional_string(payload.get("timestamp"), 100),
        visibility,
    )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
        conn.commit()

    return normalize_memory_row(row)


def fetch_tree_for_owner_check(tree_id: str) -> dict[str, Any] | None:
    query = """
        SELECT id, owner_id, title, visibility, created_at, updated_at
        FROM trees
        WHERE id = %s
        LIMIT 1;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (tree_id,))
            return cur.fetchone()


def require_tree_owner(tree_id: str, owner_id: str) -> dict[str, Any]:
    tree = fetch_tree_for_owner_check(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    if str(tree.get("owner_id") or "") != owner_id:
        raise HTTPException(status_code=403, detail="Access denied: not your tree")
    return tree


def fetch_memory_for_owner_check(memory_id: str) -> dict[str, Any] | None:
    query = """
        SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
               m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
               m.created_at, m.updated_at, t.owner_id AS tree_owner_id
        FROM memories m
        INNER JOIN trees t
          ON t.id = m.tree_id
        WHERE m.id = %s
        LIMIT 1;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (memory_id,))
            return cur.fetchone()


def require_memory_owner(memory_id: str, owner_id: str) -> dict[str, Any]:
    memory = fetch_memory_for_owner_check(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    if str(memory.get("tree_owner_id") or "") != owner_id:
        raise HTTPException(status_code=403, detail="Access denied: not your memory")
    return memory


def update_owner_tree(owner_id: str, tree_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_tree_owner(safe_tree_id, owner_id)

    updates: list[str] = []
    params: list[Any] = []

    if "title" in payload:
        updates.append("title = %s")
        params.append(validate_optional_string(payload.get("title"), 200))

    if "visibility" in payload:
        visibility = validate_visibility(payload.get("visibility"), "public")
        require_plus_for_private_storage(owner_id, visibility)
        updates.append("visibility = %s")
        params.append(visibility)

    if not updates:
        tree = fetch_owner_tree(safe_tree_id, owner_id)
        if not tree:
            raise HTTPException(status_code=404, detail="Tree not found")
        return tree

    query = f"""
        UPDATE trees
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = %s
          AND owner_id = %s
        RETURNING id;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params + [safe_tree_id, owner_id]))
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Tree not found")

    tree = fetch_owner_tree(safe_tree_id, owner_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


def delete_owner_tree(owner_id: str, tree_id: str) -> dict[str, Any]:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_tree_owner(safe_tree_id, owner_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE memories SET parent_id = NULL WHERE tree_id = %s AND parent_id IS NOT NULL;",
                (safe_tree_id,),
            )
            cur.execute("DELETE FROM memories WHERE tree_id = %s;", (safe_tree_id,))
            cur.execute(
                "DELETE FROM trees WHERE id = %s AND owner_id = %s RETURNING id;",
                (safe_tree_id, owner_id),
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Tree not found")
    return {"deleted": True, "id": str(row["id"])}


def update_owner_memory(owner_id: str, memory_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    require_memory_owner(safe_memory_id, owner_id)

    updates: list[str] = []
    params: list[Any] = []

    if "title" in payload:
        updates.append("title = %s")
        params.append(validate_optional_string(payload.get("title"), 200))

    if "memo" in payload:
        updates.append("memo = %s")
        params.append(validate_optional_string(payload.get("memo"), 5000))

    if "emotionTags" in payload:
        emotion_tags = payload.get("emotionTags") if isinstance(payload.get("emotionTags"), list) else []
        if len(emotion_tags) > 20:
            raise HTTPException(status_code=400, detail="emotionTags exceeds maximum of 20 items")
        updates.append("emotion_tags = %s")
        params.append(json.dumps([str(tag).strip() for tag in emotion_tags if str(tag).strip()]))

    if "visibility" in payload:
        visibility = validate_visibility(payload.get("visibility"), "public")
        require_plus_for_private_storage(owner_id, visibility)
        updates.append("visibility = %s")
        params.append(visibility)

    if not updates:
        memory = require_memory_owner(safe_memory_id, owner_id)
        return normalize_memory_row(memory)

    query = f"""
        UPDATE memories
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = %s
          AND EXISTS (
              SELECT 1
              FROM trees t
              WHERE t.id = memories.tree_id
                AND t.owner_id = %s
          )
        RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
                  source_type, thumbnail, emotion_tags, timestamp, visibility,
                  created_at, updated_at;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params + [safe_memory_id, owner_id]))
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")
    return normalize_memory_row(row)


def delete_owner_memory(owner_id: str, memory_id: str) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    memory = require_memory_owner(safe_memory_id, owner_id)
    tree_id = str(memory["tree_id"])

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE memories SET parent_id = NULL WHERE tree_id = %s AND parent_id = %s;",
                (tree_id, safe_memory_id),
            )
            cur.execute(
                """
                DELETE FROM memories
                WHERE id = %s
                  AND EXISTS (
                      SELECT 1
                      FROM trees t
                      WHERE t.id = memories.tree_id
                        AND t.owner_id = %s
                  )
                RETURNING id;
                """,
                (safe_memory_id, owner_id),
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": True, "id": str(row["id"])}


def fork_public_tree(owner_id: str, source_tree_id: str) -> dict[str, Any]:
    """Copy a public LoveTree and its public memories into a new tree owned by owner_id."""
    safe_source_id = validate_required_uuid(source_tree_id, "sourceTreeId")

    # Fetch source tree — must exist and be public
    source_tree = fetch_tree_for_owner_check(safe_source_id)
    if not source_tree:
        raise HTTPException(status_code=404, detail="Source tree not found")
    if str(source_tree.get("visibility") or "") != "public":
        raise HTTPException(
            status_code=403,
            detail="Only public trees can be forked",
        )

    # Idempotency guard: if authenticated user already forked this tree, return existing copy
    existing_fork_query = """
        SELECT id FROM trees
        WHERE owner_id = %s
          AND forked_from_tree_id = %s
        ORDER BY created_at DESC
        LIMIT 1;
    """

    def check_existing():
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(existing_fork_query, (owner_id, safe_source_id))
                return cur.fetchone()

    existing = run_db_with_retry(check_existing)
    if existing:
        existing_id = str(existing["id"])
        forked_tree = fetch_owner_tree(existing_id, owner_id)
        if forked_tree:
            return {**forked_tree, "forked": False, "duplicate": True}

    # Build new tree title with suffix
    source_title = str(source_tree.get("title") or "LoveTree")
    new_title_raw = f"{source_title} (복사본)"
    new_title = new_title_raw[:200]

    new_tree_id = str(uuid.uuid4())

    insert_tree_query = """
        INSERT INTO trees (id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at)
        VALUES (%s, %s, %s, 'public', %s, NOW(), NOW())
        RETURNING id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at;
    """

    # Fetch public memories from source tree
    fetch_source_memories_query = """
        SELECT id, parent_id, title, memo, artist, source, source_url, source_type,
               thumbnail, emotion_tags, timestamp
        FROM memories
        WHERE tree_id = %s
          AND visibility = 'public'
        ORDER BY created_at ASC
        LIMIT 200;
    """

    insert_memory_query = """
        INSERT INTO memories (
            id, tree_id, parent_id, title, memo, artist, source, source_url,
            source_type, thumbnail, emotion_tags, timestamp, visibility,
            created_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'public', NOW(), NOW());
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Insert new tree
            cur.execute(insert_tree_query, (new_tree_id, owner_id, new_title, safe_source_id))
            new_tree_row = cur.fetchone()

            # Fetch source memories
            cur.execute(fetch_source_memories_query, (safe_source_id,))
            source_memories = cur.fetchall()

            # Build old->new memory id map for parent_id rewriting
            id_map: dict[str, str] = {}
            for mem in source_memories:
                id_map[str(mem["id"])] = str(uuid.uuid4())

            # Insert copied memories with rewritten tree_id and parent_id
            for mem in source_memories:
                new_mem_id = id_map[str(mem["id"])]
                old_parent_id = str(mem["parent_id"]) if mem["parent_id"] else None
                new_parent_id = id_map.get(old_parent_id) if old_parent_id else None
                cur.execute(
                    insert_memory_query,
                    (
                        new_mem_id,
                        new_tree_id,
                        new_parent_id,
                        mem["title"],
                        mem["memo"],
                        mem["artist"],
                        mem["source"],
                        mem["source_url"],
                        mem["source_type"],
                        mem["thumbnail"],
                        mem["emotion_tags"],
                        mem["timestamp"],
                    ),
                )
        conn.commit()

    memory_count = len(source_memories)
    new_tree = normalize_tree_row(new_tree_row, memory_count)
    new_tree["forkedFromTreeId"] = safe_source_id
    new_tree["forked"] = True
    new_tree["duplicate"] = False
    return new_tree


def _allowed_origins() -> list[str]:
    return _config_allowed_origins()


# --- Modal App Setup ---

app = modal.App("lovebud-browse-snapshot")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.12",
        "firebase-admin==6.5.0",
        "PyJWT[crypto]==2.10.1",
        "psycopg[binary,pool]==3.2.9",
    )
)

web_app = FastAPI(
    title="LoveBud Modal Compute Layer",
    version="1.0.0",
)


@web_app.exception_handler(PlusRequiredError)
async def plus_required_exception_handler(request: Request, exc: PlusRequiredError) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "error": "Private storage requires Plus.",
            "code": "PLUS_REQUIRED_PRIVATE_STORAGE",
            "upgradeRequired": True,
        },
    )


web_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@web_app.get("/modal/health")
def modal_health() -> dict[str, bool]:
    return {"ok": True}


@web_app.get("/modal/browse/latest")
def get_latest_browse_snapshot(
    limit: int = Query(default=12, ge=1, le=60),
    sort: str = Query(default="latest"),
) -> list[dict]:
    safe_sort = sort if sort in {"latest", "popular"} else "latest"
    return fetch_latest_public_tree_snapshots(limit=limit, sort=safe_sort)


@web_app.get("/modal/browse/growing")
def get_growing_browse_snapshot(
    limit: int = Query(default=6, ge=3, le=12),
) -> list[dict]:
    return fetch_growing_public_tree_snapshots(limit=limit)


@web_app.get("/modal/community/memories")
def get_public_community_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[dict]:
    safe_tree_id = validate_optional_uuid(treeId, "treeId")
    return fetch_public_memories(tree_id=safe_tree_id, limit=limit)


@web_app.get("/modal/memories/{memory_id}")
def get_public_memory_detail(memory_id: str) -> dict:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    memory = fetch_public_memory(safe_memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@web_app.get("/modal/trees/{tree_id}")
def get_public_tree_detail(tree_id: str) -> dict:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_public_tree(safe_tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@web_app.get("/modal/private/trees")
def get_private_trees(
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
) -> list[dict]:
    user = require_firebase_user(authorization)
    return fetch_user_trees(user["uid"], limit=limit)


@web_app.post("/modal/private/trees")
async def post_private_tree(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error
    return create_owner_tree(user["uid"], payload if isinstance(payload, dict) else {})


@web_app.get("/modal/private/trees/{tree_id}")
def get_private_tree_detail(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_owner_tree(safe_tree_id, user["uid"])
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@web_app.post("/modal/private/trees/{tree_id}/fork")
def post_fork_tree(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fork_public_tree(user["uid"], tree_id)


@web_app.put("/modal/private/trees/{tree_id}")
async def put_private_tree(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error
    return update_owner_tree(user["uid"], tree_id, payload if isinstance(payload, dict) else {})


@web_app.delete("/modal/private/trees/{tree_id}")
def delete_private_tree(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return delete_owner_tree(user["uid"], tree_id)


@web_app.get("/modal/private/memories")
def get_private_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
) -> list[dict]:
    user = require_firebase_user(authorization)
    safe_tree_id = validate_optional_uuid(treeId, "treeId")
    return fetch_owner_memories(user["uid"], tree_id=safe_tree_id, limit=limit)


@web_app.post("/modal/private/memories")
async def post_private_memory(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error
    return create_owner_memory(user["uid"], payload if isinstance(payload, dict) else {})


@web_app.put("/modal/private/memories/{memory_id}")
async def put_private_memory(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error
    return update_owner_memory(user["uid"], memory_id, payload if isinstance(payload, dict) else {})


@web_app.delete("/modal/private/memories/{memory_id}")
def delete_private_memory(
    memory_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return delete_owner_memory(user["uid"], memory_id)


@app.function(
    image=image,
    cpu=0.25,
    memory=512,
    scaledown_window=300,
    min_containers=1,
    secrets=[
        modal.Secret.from_name("lovebud-db"),
        modal.Secret.from_name("lovebud-firebase-admin"),
    ],
)
@modal.asgi_app()
def fastapi_app():
    return web_app
