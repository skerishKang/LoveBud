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
    validate_explicit_visibility,
    validate_optional_memory_string,
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
        validate_optional_memory_string(payload.get("title"), "title", 200),
        validate_optional_memory_string(payload.get("memo"), "memo", 5000),
        validate_optional_memory_string(payload.get("artist"), "artist", 100),
        validate_optional_memory_string(payload.get("source"), "source", 200),
        validate_optional_memory_string(payload.get("sourceUrl"), "sourceUrl", 1000),
        validate_optional_memory_string(payload.get("sourceType"), "sourceType", 50) or "youtube",
        validate_optional_memory_string(payload.get("thumbnail"), "thumbnail", 500),
        emotion_tags,
        validate_optional_memory_string(payload.get("timestamp"), "timestamp", 100),
        visibility,
        validate_optional_memory_string(payload.get("channelId"), "channelId", 100) or None,
        validate_optional_memory_string(payload.get("channelName"), "channelName", 200) or None,
        validate_optional_memory_string(payload.get("channelUrl"), "channelUrl", 1000) or None,
    )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")
    return normalize_memory_row(row)


# Source-identity fields the update path can bind to SQL. Maps the request key
# -> persisted DB column -> normalized response key. Used by the post-write
# acknowledgement gate (Refs #3330, Refs #3273). Request values are never
# echoed into the response; divergence is a structured failure.
_SOURCE_ACK_FIELDS: tuple[tuple[str, str, str], ...] = (
    ("source", "source", "source"),
    ("sourceUrl", "source_url", "sourceUrl"),
    ("sourceType", "source_type", "sourceType"),
    ("thumbnail", "thumbnail", "thumbnail"),
)
_SOURCE_ACK_MAX_LEN = {
    "source": 200,
    "sourceUrl": 1000,
    "sourceType": 50,
    "thumbnail": 500,
}


def _source_ack_requested_value(payload_key: str, payload: dict[str, Any]) -> str:
    """Normalize a requested source-identity value the same way the SQL binding does.

    Mirrors the update binding (validate_optional_memory_string + sourceType
    default "youtube") so the comparison is byte-identical to what was persisted.
    """
    requested = validate_optional_memory_string(payload.get(payload_key), payload_key, _SOURCE_ACK_MAX_LEN[payload_key])
    if payload_key == "sourceType" and not requested:
        requested = "youtube"
    return requested or ""


def _source_ack_persisted_value(db_column: str, row: dict[str, Any]) -> str:
    """Read a persisted source-identity value the same way normalize_memory_row does."""
    default = "youtube" if db_column == "source_type" else ""
    return row.get(db_column) or default


def _enforce_source_ack_convergence(payload: dict[str, Any], row: dict[str, Any]) -> None:
    """Fail the write if a requested source-identity field did not actually persist.

    Compares the post-write RETURNING row against the requested value. A missing
    or stale acknowledgement is a structured failure — the response is never
    coerced into success by echoing the request (Refs #3330, Refs #3273).

    The divergence is detected internally, but the 409 detail never echoes the
    raw requested/persisted values (raw source URLs, provider identifiers,
    thumbnails) — that would leak production identity data across the #3273/#3330
    privacy boundary. Only typed classification is returned.
    """
    for _payload_key, db_column, _resp_key in _SOURCE_ACK_FIELDS:
        if _payload_key not in payload:
            continue
        requested = _source_ack_requested_value(_payload_key, payload)
        persisted = _source_ack_persisted_value(db_column, row)
        if requested != persisted:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "SOURCE_WRITE_ACK_DIVERGENCE",
                    "field": _payload_key,
                    "classification": "STALE_SOURCE_ACKNOWLEDGEMENT",
                },
            )


def update_owner_memory(owner_id: str, memory_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    memory = require_memory_owner(safe_memory_id, owner_id)

    # Explicit allowlist for update payload
    ALLOWED_UPDATE_FIELDS = {
        "title",
        "memo",
        "artist",
        "source",
        "sourceUrl",
        "sourceType",
        "thumbnail",
        "emotionTags",
        "timestamp",
        "visibility",
        "channelId",
        "channelName",
        "channelUrl",
        "parentId",
    }

    # Check for unsupported fields
    unknown_fields = [k for k in payload.keys() if k not in ALLOWED_UPDATE_FIELDS]
    if unknown_fields:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNSUPPORTED_MEMORY_UPDATE_FIELDS",
                "fields": sorted(unknown_fields),
            },
        )

    # Reject empty payload
    if not payload:
        raise HTTPException(
            status_code=400,
            detail={"code": "EMPTY_MEMORY_UPDATE"},
        )

    updates: list[str] = []
    params: list[Any] = []

    if "title" in payload:
        updates.append("title = %s")
        params.append(validate_optional_memory_string(payload.get("title"), "title", 200))

    if "memo" in payload:
        updates.append("memo = %s")
        params.append(validate_optional_memory_string(payload.get("memo"), "memo", 5000))

    if "source" in payload:
        updates.append("source = %s")
        params.append(validate_optional_memory_string(payload.get("source"), "source", 200))

    if "sourceUrl" in payload:
        updates.append("source_url = %s")
        params.append(validate_optional_memory_string(payload.get("sourceUrl"), "sourceUrl", 1000))

    if "sourceType" in payload:
        updates.append("source_type = %s")
        params.append(validate_optional_memory_string(payload.get("sourceType"), "sourceType", 50) or "youtube")

    if "thumbnail" in payload:
        updates.append("thumbnail = %s")
        params.append(validate_optional_memory_string(payload.get("thumbnail"), "thumbnail", 500))

    if "emotionTags" in payload:
        emotion_tags = payload.get("emotionTags") if isinstance(payload.get("emotionTags"), list) else []
        if len(emotion_tags) > 20:
            raise HTTPException(status_code=400, detail="emotionTags exceeds maximum of 20 items")
        emotion_tags = [str(tag).strip() for tag in emotion_tags if str(tag).strip()]
        updates.append("emotion_tags = %s")
        params.append(emotion_tags)

    if "visibility" in payload:
        visibility = validate_explicit_visibility(payload.get("visibility"))
        require_plus_for_private_storage(owner_id, visibility)
        updates.append("visibility = %s")
        params.append(visibility)

    if "channelId" in payload:
        updates.append("channel_id = %s")
        params.append(validate_optional_memory_string(payload.get("channelId"), "channelId", 100) or None)

    if "channelName" in payload:
        updates.append("channel_name = %s")
        params.append(validate_optional_memory_string(payload.get("channelName"), "channelName", 200) or None)

    if "channelUrl" in payload:
        updates.append("channel_url = %s")
        params.append(validate_optional_memory_string(payload.get("channelUrl"), "channelUrl", 1000) or None)

    # New: artist update support
    if "artist" in payload:
        updates.append("artist = %s")
        params.append(validate_optional_memory_string(payload.get("artist"), "artist", 100))

    # New: timestamp update support
    if "timestamp" in payload:
        updates.append("timestamp = %s")
        params.append(validate_optional_memory_string(payload.get("timestamp"), "timestamp", 100))

    # New: parentId update support
    if "parentId" in payload:
        parent_id_value = payload.get("parentId")
        # Normalize disconnect values: null, "", whitespace-only -> None
        if parent_id_value is None or (isinstance(parent_id_value, str) and parent_id_value.strip() == ""):
            updates.append("parent_id = NULL")
        else:
            # Validate UUID format
            parent_id = validate_required_uuid(parent_id_value, "parentId")
            # Check: parent memory exists, same tree, not self, not descendant
            # All checks must happen within the same DB connection context
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Check parent exists
                    cur.execute(
                        """
                        SELECT id, tree_id, parent_id
                        FROM memories
                        WHERE id = %s
                        """,
                        (parent_id,),
                    )
                    parent_mem = cur.fetchone()
                    if not parent_mem:
                        raise HTTPException(
                            status_code=400,
                            detail={"code": "INVALID_PARENT_ID", "reason": "not_found"},
                        )
                # Check: same tree
                if str(parent_mem["tree_id"]) != str(memory["tree_id"]):
                    raise HTTPException(
                        status_code=400,
                        detail={"code": "PARENT_MEMORY_TREE_MISMATCH"},
                    )
                # Check: not self
                if str(parent_mem["id"]) == str(safe_memory_id):
                    raise HTTPException(
                        status_code=400,
                        detail={"code": "INVALID_PARENT_ID", "reason": "self_parent"},
                    )
                # Check: not descendant (cycle detection with visited guard)
                if _would_create_cycle(conn, safe_memory_id, parent_id):
                    raise HTTPException(
                        status_code=400,
                        detail={"code": "PARENT_CYCLE"},
                    )
            updates.append("parent_id = %s")
            params.append(parent_id)

    if not updates:
        # This should not happen due to empty payload check above, but guard anyway
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
    _enforce_source_ack_convergence(payload, row)
    return normalize_memory_row(row)


def _would_create_cycle(conn, source_id: str, target_parent_id: str) -> bool:
    """
    Check if setting source_id's parent to target_parent_id would create a cycle.
    Walks up the ancestor chain from target_parent_id looking for source_id.
    Includes visited guard to prevent infinite loops on existing corrupted data.
    """
    visited = set()
    current_id = target_parent_id
    with conn.cursor() as cur:
        while current_id:
            if str(current_id) == str(source_id):
                return True
            if str(current_id) in visited:
                # Existing cycle in DB - break to avoid infinite loop
                return True
            visited.add(str(current_id))
            cur.execute(
                "SELECT parent_id FROM memories WHERE id = %s",
                (current_id,),
            )
            row = cur.fetchone()
            if not row or not row["parent_id"]:
                break
            current_id = row["parent_id"]
    return False


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