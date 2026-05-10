from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    _to_isoformat,
    estimate_stage,
    normalize_memory_row,
    normalize_tree_row,
    validate_optional_string,
    validate_required_uuid,
    validate_optional_uuid,
    validate_visibility,
)


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

    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")
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

    if "source" in payload:
        updates.append("source = %s")
        params.append(validate_optional_string(payload.get("source"), 200))

    if "sourceUrl" in payload:
        updates.append("source_url = %s")
        params.append(validate_optional_string(payload.get("sourceUrl"), 1000))

    if "sourceType" in payload:
        updates.append("source_type = %s")
        params.append(validate_optional_string(payload.get("sourceType"), 50) or "youtube")

    if "thumbnail" in payload:
        updates.append("thumbnail = %s")
        params.append(validate_optional_string(payload.get("thumbnail"), 500))

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
