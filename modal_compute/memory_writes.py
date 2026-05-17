# Memory write operations for owner
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import get_db_connection
from modal_compute.owner_reads import fetch_owner_tree
from modal_compute.validation import (
    _to_isoformat,
    normalize_memory_row,
    validate_visibility,
    validate_optional_string,
    validate_required_uuid,
)


def create_owner_memory(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a new memory/node in tree."""
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


def update_owner_memory(owner_id: str, memory_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Update memory details."""
    # Placeholder - implement memory update logic
    raise NotImplementedError("Memory update not yet implemented")


def delete_owner_memory(owner_id: str, memory_id: str) -> dict[str, Any]:
    """Delete memory from tree."""
    # Placeholder - implement memory deletion logic
    raise NotImplementedError("Memory deletion not yet implemented")