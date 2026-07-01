from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.owner_reads import (
    fetch_owner_tree,
)
from modal_compute.owner_users import ensure_owner_user_exists
from modal_compute.write_validation import (
    fetch_tree_for_owner_check,
    require_tree_owner,
)
from modal_compute.validation import (
    normalize_group_name,
    normalize_keywords,
    normalize_tree_row,
    validate_optional_string,
    validate_required_uuid,
    validate_visibility,
)


def create_owner_tree(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    ensure_owner_user_exists(owner_id)
    title = validate_optional_string(payload.get("title"), 200) or "My LoveTree"
    visibility = validate_visibility(payload.get("visibility"), "public")
    require_plus_for_private_storage(owner_id, visibility)

    group_name = normalize_group_name(payload.get("groupName"))
    keywords = normalize_keywords(payload.get("keywords"))

    query = """
        INSERT INTO trees (id, owner_id, title, visibility,
                            group_name, keywords, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id, owner_id, title, visibility,
                  group_name, keywords, created_at, updated_at;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (str(uuid.uuid4()), owner_id, title, visibility,
                 group_name, keywords),
            )
            row = cur.fetchone()
        conn.commit()

    return normalize_tree_row(row, 0, include_owner_metadata=True)


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

    if "groupName" in payload:
        updates.append("group_name = %s")
        params.append(normalize_group_name(payload.get("groupName")))

    if "keywords" in payload:
        updates.append("keywords = %s")
        params.append(normalize_keywords(payload.get("keywords")))

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


def fork_public_tree(owner_id: str, source_tree_id: str) -> dict[str, Any]:
    """Copy a public LoveTree and its public memories into a new tree owned by owner_id."""
    ensure_owner_user_exists(owner_id)
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
               thumbnail, emotion_tags, timestamp, channel_id, channel_name, channel_url
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
            channel_id, channel_name, channel_url,
            created_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'public', %s, %s, %s, NOW(), NOW());
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
                        mem.get("channel_id") or None,
                        mem.get("channel_name") or None,
                        mem.get("channel_url") or None,
                    ),
                )
        conn.commit()

    memory_count = len(source_memories)
    new_tree = normalize_tree_row(new_tree_row, memory_count)
    new_tree["forkedFromTreeId"] = safe_source_id
    new_tree["forked"] = True
    new_tree["duplicate"] = False
    return new_tree
