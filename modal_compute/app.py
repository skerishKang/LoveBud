from __future__ import annotations

import os
import json
import time
import urllib.request
import uuid
from datetime import datetime
from typing import Any

import jwt
import modal
import psycopg
from cryptography import x509
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

# --- DB Logic (formerly browse_latest.py) ---

_firebase_cert_cache: dict[str, Any] = {"expires_at": 0, "certs": {}}
_db_pool: ConnectionPool | None = None
PRIVATE_READ_MAX_ATTEMPTS = 3
PRIVATE_READ_RETRY_DELAY_SECONDS = 0.2

def get_db_pool() -> ConnectionPool:
    global _db_pool
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if _db_pool is None or _db_pool.closed:
        _db_pool = ConnectionPool(
            conninfo=db_url,
            min_size=1,
            max_size=4,
            max_idle=300,
            kwargs={"row_factory": dict_row},
        )
    return _db_pool


def get_db_connection():
    """Return a pooled psycopg3 connection context."""
    return get_db_pool().connection()


def reset_db_pool() -> None:
    global _db_pool
    if _db_pool is not None and not _db_pool.closed:
        _db_pool.close()
    _db_pool = None


def run_db_with_retry(operation, *, max_attempts: int = PRIVATE_READ_MAX_ATTEMPTS):
    last_error: psycopg.OperationalError | None = None
    for attempt in range(max_attempts):
        try:
            return operation()
        except psycopg.OperationalError as error:
            last_error = error
            reset_db_pool()
            if attempt == max_attempts - 1:
                raise
            time.sleep(PRIVATE_READ_RETRY_DELAY_SECONDS * (attempt + 1))
    if last_error is not None:
        raise last_error
    raise RuntimeError("run_db_with_retry failed without capturing an error")


def get_firebase_project_id() -> str:
    return os.getenv("FIREBASE_PROJECT_ID", "relovetree")


def get_firebase_certs() -> dict[str, str]:
    now = time.time()
    if _firebase_cert_cache["expires_at"] > now and _firebase_cert_cache["certs"]:
        return _firebase_cert_cache["certs"]

    with urllib.request.urlopen(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
        timeout=5,
    ) as response:
        raw = response.read().decode("utf-8")
        cache_control = response.headers.get("cache-control", "")

    max_age = 300
    for part in cache_control.split(","):
        part = part.strip()
        if part.startswith("max-age="):
            try:
                max_age = int(part.split("=", 1)[1])
            except ValueError:
                max_age = 300

    certs = json.loads(raw)
    _firebase_cert_cache["certs"] = certs
    _firebase_cert_cache["expires_at"] = now + max_age
    return certs


def require_firebase_user(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        header = jwt.get_unverified_header(token)
        cert = get_firebase_certs().get(header.get("kid"))
        if not cert:
            raise HTTPException(status_code=401, detail="Invalid ID token")

        project_id = get_firebase_project_id()
        public_key = x509.load_pem_x509_certificate(cert.encode("utf-8")).public_key()
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid ID token") from error

    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid ID token")

    return {"uid": uid, "email": decoded.get("email") or "", "decoded": decoded}


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


def normalize_row(row: dict[str, Any], *, stage_override: str | None = None) -> dict[str, Any]:
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
        "stage": stage_override or estimate_stage(memory_count),
        "theme": "LoveTree",
        "timeRange": "",
        "representativeMemorySourceUrl": raw_source_url or "",
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


def validate_visibility(value: Any, default: str = "private") -> str:
    if value is None:
        return default
    if value not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="visibility: public, private")
    return value


def validate_optional_string(value: Any, max_length: int = 5000) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if len(text) > max_length:
        raise HTTPException(status_code=400, detail=f"Field exceeds max {max_length}")
    return text


def validate_required_uuid(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=f"{name} is required")
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid {name}") from error


def validate_optional_uuid(value: Any, name: str) -> str | None:
    if value is None or value == "":
        return None
    return validate_required_uuid(value, name)


def create_owner_tree(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    title = validate_optional_string(payload.get("title"), 200) or "My LoveTree"
    visibility = validate_visibility(payload.get("visibility"), "private")
    if visibility == "public":
        raise HTTPException(status_code=409, detail="Start new trees as private before publishing.")

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
        validate_visibility(payload.get("visibility"), "private"),
    )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
        conn.commit()

    return normalize_memory_row(row)


# --- Modal App Setup ---

app = modal.App("lovebud-browse-snapshot")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.12",
        "PyJWT[crypto]==2.10.1",
        "psycopg[binary,pool]==3.2.9",
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
    allow_methods=["GET", "POST", "OPTIONS"],
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


@app.function(
    image=image,
    cpu=0.25,
    memory=512,
    scaledown_window=300,
    min_containers=1,
    secrets=[modal.Secret.from_name("lovebud-db")],
)
@modal.asgi_app()
def fastapi_app():
    return web_app
