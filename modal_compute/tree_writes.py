from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import (
    get_db_connection,
)
from modal_compute.owner_reads import (
    fetch_owner_tree,
)
from modal_compute.owner_users import ensure_owner_user_exists
from modal_compute.write_validation import (
    require_tree_owner,
)
from modal_compute.validation import (
    normalize_group_name,
    normalize_keywords,
    normalize_tree_row,
    validate_explicit_visibility,
    validate_optional_string,
    validate_required_uuid,
    validate_visibility,
)


def create_owner_tree(
    owner_id: str,
    payload: dict[str, Any],
    owner_email: str = "",
) -> dict[str, Any]:
    # Ownership identity is always the verified Firebase uid/sub. Email is
    # optional users-table metadata only and must never become owner_id.
    owner_id = str(owner_id or "").strip()
    if not owner_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    ensure_owner_user_exists(owner_id, owner_email)
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
        try:
            with conn.cursor() as cur:
                cur.execute(
                    query,
                    (str(uuid.uuid4()), owner_id, title, visibility,
                     group_name, keywords),
                )
                row = cur.fetchone()

            # Fail closed before commit: never persist a tree whose returned
            # owner_id does not exactly match the authenticated UID.
            returned_owner_id = str((row or {}).get("owner_id") or "").strip()
            if not row or returned_owner_id != owner_id:
                conn.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Tree owner binding failed",
                )

            conn.commit()
        except HTTPException:
            raise
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise

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
        visibility = validate_explicit_visibility(payload.get("visibility"))
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
    """Copy a public LoveTree and its public memories into a new tree owned by owner_id.

    Privacy invariant (#3952): the fork is atomic with source visibility
    authorization. The source tree row is read with SELECT ... FOR SHARE inside
    the same transaction that performs the duplicate check, the destination tree
    insert, and the public-memory copy. A concurrent public -> private
    revocation can therefore never commit between the authorization read and the
    durable copy: it either commits first (the fork observes `private` and
    aborts with no destination rows) or it blocks on the FOR SHARE lock until
    the fork transaction commits.
    """
    ensure_owner_user_exists(owner_id)
    safe_source_id = validate_required_uuid(source_tree_id, "sourceTreeId")

    new_tree_id = str(uuid.uuid4())

    # Authoritative source read. FOR SHARE conflicts with the row lock taken by
    # a visibility UPDATE, so it serializes a concurrent revocation against the
    # copy below. FOR KEY SHARE would NOT conflict with a non-key UPDATE and is
    # deliberately not used.
    lock_source_query = """
        SELECT id, title, visibility
        FROM trees
        WHERE id = %s
        FOR SHARE;
    """

    # Idempotency guard: if authenticated user already forked this tree, return existing copy.
    # Runs inside the same transaction, after the source row is authorized.
    existing_fork_query = """
        SELECT id FROM trees
        WHERE owner_id = %s
          AND forked_from_tree_id = %s
        ORDER BY created_at DESC
        LIMIT 1;
    """

    insert_tree_query = """
        INSERT INTO trees (id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at)
        VALUES (%s, %s, %s, 'public', %s, NOW(), NOW())
        RETURNING id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at;
    """

    # Fetch public memories from source tree (inside the authorized transaction).
    # Private memories are never copied.
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

    existing_fork_id: str | None = None
    new_tree_row: dict[str, Any] | None = None
    source_memories: list[dict[str, Any]] = []

    with get_db_connection() as conn:
        try:
            with conn.cursor() as cur:
                # 1. Authoritative, transaction-local source read (FOR SHARE).
                cur.execute(lock_source_query, (safe_source_id,))
                source_tree = cur.fetchone()

                # 2. Explicit public authorization inside the fork transaction.
                if not source_tree:
                    raise HTTPException(status_code=404, detail="Source tree not found")
                if str(source_tree.get("visibility") or "") != "public":
                    raise HTTPException(
                        status_code=403,
                        detail="Only public trees can be forked",
                    )

                # 3. Duplicate fork guard inside the same transaction.
                cur.execute(existing_fork_query, (owner_id, safe_source_id))
                existing = cur.fetchone()
                if existing:
                    existing_fork_id = str(existing["id"])
                else:
                    # 4. Source title comes from the authorized transaction row.
                    source_title = str(source_tree.get("title") or "LoveTree")
                    new_title_raw = f"{source_title} (복사본)"
                    new_title = new_title_raw[:200]

                    # 5. Destination tree insert happens only after authorization.
                    cur.execute(
                        insert_tree_query,
                        (new_tree_id, owner_id, new_title, safe_source_id),
                    )
                    new_tree_row = cur.fetchone()

                    # 6. Public source memories read inside the same transaction.
                    cur.execute(fetch_source_memories_query, (safe_source_id,))
                    source_memories = cur.fetchall()

                    # Build old->new memory id map for parent_id rewriting
                    id_map: dict[str, str] = {}
                    for mem in source_memories:
                        id_map[str(mem["id"])] = str(uuid.uuid4())

                    # 7. Insert copied memories with rewritten tree_id and parent_id.
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
        except HTTPException:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise

    if existing_fork_id is not None:
        forked_tree = fetch_owner_tree(existing_fork_id, owner_id)
        if forked_tree:
            return {**forked_tree, "forked": False, "duplicate": True}

    # Fail closed: a fork that was neither a duplicate nor materialized must never
    # reach the success path with an undefined destination row.
    if new_tree_row is None:
        raise HTTPException(status_code=500, detail="Fork creation failed")

    memory_count = len(source_memories)
    new_tree = normalize_tree_row(new_tree_row, memory_count)
    new_tree["forkedFromTreeId"] = safe_source_id
    new_tree["forked"] = True
    new_tree["duplicate"] = False
    return new_tree
