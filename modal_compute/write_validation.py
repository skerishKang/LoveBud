from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection


def is_explicit_public(value: Any) -> bool:
    """Return True only for a persisted exact literal `'public'` visibility token.

    NULL/missing/empty/malformed values are NOT treated as public. This is the
    canonical fail-closed predicate for non-owner social access (Refs #3926).
    """
    return isinstance(value, str) and value == "public"


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
               m.created_at, m.updated_at, t.owner_id AS tree_owner_id,
               t.visibility AS tree_visibility
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


def require_memory_visible_or_owner(
    memory_id: str,
    requester_uid: str,
) -> dict[str, Any]:
    """Allow write access if the memory+tree are both public or the requester is the tree owner.

    Non-owner authenticated users must satisfy ALL of:
      - tree exists
      - memory exists
      - memory belongs to tree
      - tree.visibility = 'public' (exact persisted token)
      - memory.visibility = 'public' (exact persisted token)

    If any condition fails, 404 is returned (leak-safe for private/inaccessible targets).

    Tree owner can always access their own tree (owner-local private behavior).
    """
    memory = fetch_memory_for_owner_check(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    is_owner = str(memory.get("tree_owner_id") or "") == requester_uid

    if is_owner:
        return memory

    if not is_explicit_public(memory.get("visibility")) or not is_explicit_public(
        memory.get("tree_visibility")
    ):
        raise HTTPException(status_code=404, detail="Memory not found")

    return memory


def require_memory_visible_or_owner_cursor(
    cur: Any,
    memory_id: str,
    requester_uid: str,
) -> dict[str, Any]:
    """Transaction-local authorization guard for social writes.

    Same semantics as require_memory_visible_or_owner() but uses the active
    write cursor so authorization and mutation share one transaction. The query
    takes SHARE locks on both the Memory and parent Tree visibility rows so a
    concurrent non-key visibility UPDATE cannot commit between authorization
    and the social mutation.

    Returns the memory+tree row on success.
    Raises HTTPException 404 on failure (leak-safe).
    """
    cur.execute(
        """
        SELECT m.id, m.tree_id, m.visibility AS mem_visibility,
               t.owner_id AS tree_owner_id, t.visibility AS tree_visibility
        FROM memories m
        INNER JOIN trees t ON t.id = m.tree_id
        WHERE m.id = %s
        LIMIT 1
        FOR SHARE OF m, t
        """,
        (memory_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Memory not found")

    is_owner = str(row["tree_owner_id"]) == requester_uid

    if is_owner:
        return row

    if not is_explicit_public(row["mem_visibility"]) or not is_explicit_public(
        row["tree_visibility"]
    ):
        raise HTTPException(status_code=404, detail="Memory not found")

    return row
