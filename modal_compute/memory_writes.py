from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import get_db_connection
from modal_compute.owner_reads import fetch_owner_tree
from modal_compute.write_validation import (
    fetch_memory_for_owner_check,
    require_memory_owner,
)
from modal_compute.validation import (
    normalize_memory_row,
    validate_optional_string,
    validate_required_uuid,
    validate_visibility,
)


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
    emotion_tags = [str(tag).strip() for tag in emotion_tags if str(tag).strip()]

    query = """
        INSERT INTO memories (
            id, tree_id, parent_id, title, memo, artist, source, source_url,
            source_type, thumbnail, emotion_tags, timestamp, visibility,
            channel_id, channel_name, channel_url,
            created_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
                  source_type, thumbnail, emotion_tags, timestamp, visibility,
                  channel_id, channel_name, channel_url,
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
        emotion_tags,
        validate_optional_string(payload.get("timestamp"), 100),
        visibility,
        validate_optional_string(payload.get("channelId"), 100) or None,
        validate_optional_string(payload.get("channelName"), 200) or None,
        validate_optional_string(payload.get("channelUrl"), 1000) or None,
    )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")
    return normalize_memory_row(row)


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
        emotion_tags = [str(tag).strip() for tag in emotion_tags if str(tag).strip()]
        updates.append("emotion_tags = %s")
        params.append(emotion_tags)

    if "visibility" in payload:
        visibility = validate_visibility(payload.get("visibility"), "public")
        require_plus_for_private_storage(owner_id, visibility)
        updates.append("visibility = %s")
        params.append(visibility)

    if "channelId" in payload:
        updates.append("channel_id = %s")
        params.append(validate_optional_string(payload.get("channelId"), 100) or None)

    if "channelName" in payload:
        updates.append("channel_name = %s")
        params.append(validate_optional_string(payload.get("channelName"), 200) or None)

    if "channelUrl" in payload:
        updates.append("channel_url = %s")
        params.append(validate_optional_string(payload.get("channelUrl"), 1000) or None)

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
                  channel_id, channel_name, channel_url,
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
    normalized = normalize_memory_row(memory)
    tree_id = normalized["treeId"]

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
    return {"deleted": True, "id": str(row["id"]), "treeId": normalized["treeId"]}
