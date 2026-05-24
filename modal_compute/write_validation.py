from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection

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
               m.channel_id, m.channel_name, m.channel_url,
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


def require_memory_visible_or_owner(memory_id: str, requester_uid: str) -> dict[str, Any]:
    """Allow access if the memory is public or the requester is the tree owner.

    Private memories return 404 to avoid leaking existence to non-owners.
    """
    memory = fetch_memory_for_owner_check(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    visibility = str(memory.get("visibility") or "public")
    is_owner = str(memory.get("tree_owner_id") or "") == requester_uid

    if visibility == "private" and not is_owner:
        raise HTTPException(status_code=404, detail="Memory not found")

    return memory
