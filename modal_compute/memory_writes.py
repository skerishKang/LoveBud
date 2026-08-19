from __future__ import annotations

import hashlib
import uuid
from typing import Any

import psycopg
from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import get_db_connection
from modal_compute.owner_reads import fetch_owner_tree
from modal_compute.schema_capabilities import table_has_column
from modal_compute.write_validation import (
    fetch_memory_for_owner_check,
    require_memory_owner,
)
from modal_compute.validation import (
    normalize_memory_row,
    validate_client_key,
    validate_explicit_visibility,
    validate_optional_memory_string,
    validate_optional_string,
    validate_required_uuid,
    validate_visibility,
)


def validate_emotion_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_EMOTION_TAGS", "reason": "array_required"},
        )
    if len(value) > 20:
        raise HTTPException(status_code=400, detail="emotionTags exceeds maximum of 20 items")

    normalized: list[str] = []
    for tag in value:
        if not isinstance(tag, str):
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_EMOTION_TAGS", "reason": "string_items_required"},
            )
        trimmed = tag.strip()
        if trimmed:
            normalized.append(trimmed)
    return normalized


def create_owner_memory(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    tree_id = validate_required_uuid(payload.get("treeId"), "treeId")
    tree = fetch_owner_tree(tree_id, owner_id)
    if not tree:
        raise HTTPException(status_code=403, detail="Access denied: not your tree")
    parent_visibility = tree.get("visibility")
    explicit_visibility = payload.get("visibility")

    if explicit_visibility is None:
        # Issue #3934: caller omitted visibility. Inheriting from the parent Tree
        # is allowed only when the parent Tree visibility is a known literal.
        # An unresolved parent (NULL / missing / unknown / invalid) must fail
        # closed — it is NEVER synthesized into a "public" Memory (#3934 DTO
        # truthfulness). No DB mutation occurs on this path.
        if parent_visibility == "public":
            visibility = "public"
        elif parent_visibility == "private":
            visibility = "private"
        else:
            raise HTTPException(
                status_code=400,
                detail={"code": "TREE_VISIBILITY_UNRESOLVED"},
            )
    else:
        # Explicit caller visibility: keep strict validation + entitlement
        # authority (#3935/#3936 semantics). A non public/private value is
        # rejected before any DB mutation.
        visibility = validate_visibility(explicit_visibility, default="private")

    require_plus_for_private_storage(owner_id, visibility)

    parent_id = None
    if payload.get("parentId"):
        parent_id = validate_required_uuid(payload.get("parentId"), "parentId")

    emotion_tags = validate_emotion_tags(payload["emotionTags"]) if "emotionTags" in payload else []

    # Issue #4058: Tree-scoped Memory clientKey idempotency.
    # validate_client_key returns None for omitted/empty (legacy-compatible),
    # raises HTTP 400 for non-string/oversized BEFORE any DB mutation.
    client_key = validate_client_key(payload.get("clientKey"))

    # Shared column list / params (without client_key — added conditionally below).
    base_columns = (
        "id, tree_id, parent_id, title, memo, artist, source, source_url, "
        "source_type, thumbnail, emotion_tags, timestamp, visibility, "
        "channel_id, channel_name, channel_url, created_at, updated_at"
    )
    base_values = (
        "%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()"
    )
    base_params = (
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
            # --- Parent membership validation (same transaction as INSERT) ---
            # Issue #3918: verify parent exists and belongs to the same tree
            # before inserting. FOR KEY SHARE is sufficient:
            #   - blocks concurrent DELETE of the parent row (prevents dangling child)
            #   - blocks concurrent UPDATE of the parent PK (id)
            #   - does NOT block concurrent reads or unrelated column updates
            # A stronger FOR UPDATE is unnecessary because we never modify the
            # parent row here; we only need it to survive until our INSERT commits.
            if parent_id is not None:
                cur.execute(
                    """
                    SELECT id, tree_id
                    FROM memories
                    WHERE id = %s
                    LIMIT 1
                    FOR KEY SHARE
                    """,
                    (parent_id,),
                )
                parent_row = cur.fetchone()
                if not parent_row or str(parent_row["tree_id"]) != str(tree_id):
                    raise HTTPException(
                        status_code=400,
                        detail={"code": "INVALID_PARENT_ID"},
                    )

            # --- Capability detection: does the canonical schema carry client_key? ---
            has_client_key_column = table_has_column(cur, "memories", "client_key")

            if has_client_key_column:
                # Idempotency path: same Tree + same clientKey already persisted?
                if client_key is not None:
                    cur.execute(
                        """
                        SELECT id, tree_id, parent_id, title, memo, artist, source, source_url,
                               source_type, thumbnail, emotion_tags, timestamp, visibility,
                               channel_id, channel_name, channel_url, client_key,
                               created_at, updated_at
                        FROM memories
                        WHERE tree_id = %s AND client_key = %s
                        LIMIT 1
                        FOR KEY SHARE
                        """,
                        (tree_id, client_key),
                    )
                    existing = cur.fetchone()
                    if existing:
                        # Convergence: return the already-persisted canonical Memory.
                        conn.commit()
                        return normalize_memory_row(existing)

                insert_columns = f"{base_columns}, client_key"
                insert_values = f"{base_values}, %s"
                insert_params: tuple[Any, ...] = base_params + (client_key,)
            else:
                # Compatibility path: column not yet activated in this environment.
                # Issue #4058 / #4007: NEVER silently ignore an explicitly supplied
                # clientKey and create a NEW Memory under a schema that cannot honor
                # it — that would violate the idempotency contract. Reject explicitly
                # so the caller can retry after the canonical migration is applied.
                if client_key is not None:
                    raise HTTPException(
                        status_code=501,
                        detail={
                            "code": "MEMORY_CLIENT_KEY_SCHEMA_NOT_ACTIVATED",
                            "reason": "client_key column unavailable; cannot honor idempotency",
                        },
                    )
                insert_columns = base_columns
                insert_values = base_values
                insert_params = base_params

            query = f"""
                INSERT INTO memories (
                    {insert_columns}
                )
                VALUES ({insert_values})
                RETURNING id, tree_id, parent_id, title, memo, artist, source, source_url,
                          source_type, thumbnail, emotion_tags, timestamp, visibility,
                          channel_id, channel_name, channel_url,
                          {("client_key, " if has_client_key_column else "")}
                          created_at, updated_at;
            """
            try:
                cur.execute(query, insert_params)
                row = cur.fetchone()
            except psycopg.errors.UniqueViolation:
                # Concurrent same Tree + same clientKey: the other transaction won
                # the race. Reread the canonical existing row and return it — never
                # echo the request payload as if it were a freshly created Memory.
                # Roll back the failed insert, then open a FRESH cursor (the existing
                # one is invalid after rollback) to reread the winning row.
                conn.rollback()
                reread_cur = conn.cursor()
                reread_cur.execute(
                    """
                    SELECT id, tree_id, parent_id, title, memo, artist, source, source_url,
                           source_type, thumbnail, emotion_tags, timestamp, visibility,
                           channel_id, channel_name, channel_url, client_key,
                           created_at, updated_at
                    FROM memories
                    WHERE tree_id = %s AND client_key = %s
                    LIMIT 1
                    """,
                    (tree_id, client_key),
                )
                row = reread_cur.fetchone()
                if not row:
                    # Should not happen: the conflicting row vanished between the
                    # insert and the reread. Surface a bounded, non-raw error.
                    raise HTTPException(
                        status_code=409,
                        detail={"code": "MEMORY_CLIENT_KEY_CONFLICT_UNRESOLVED"},
                    )
                conn.commit()
                return normalize_memory_row(row)

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


def _memory_parent_advisory_lock(tree_id: str) -> int:
    raw = f"memory-parent-graph:{tree_id}"
    digest = hashlib.sha256(raw.encode("utf-8")).digest()[:8]
    return int.from_bytes(digest, byteorder="big", signed=True)


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
        # NOTE (#4058): clientKey is intentionally NOT in this allowlist. A Memory's
        # clientKey is immutable after create; any update attempt carrying it is
        # rejected as an unsupported field (no silent mutation of idempotency key).
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
        emotion_tags = validate_emotion_tags(payload["emotionTags"])
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
    # The non-null reparent path performs parent existence / same-tree / self /
    # ancestor-cycle validation AND the parent_id UPDATE inside ONE DB
    # transaction (see _validate_reparent_atomic). This makes the cycle check
    # atomic with the write so concurrent reparents cannot read each other's
    # stale state (Issue #3951). Detach (parentId null/empty) is acyclic by
    # construction and stays a single UPDATE in the same transaction below.
    reparent_target = None
    if "parentId" in payload:
        parent_id_value = payload.get("parentId")
        # Normalize disconnect values: null, "", whitespace-only -> None
        if parent_id_value is None or (isinstance(parent_id_value, str) and parent_id_value.strip() == ""):
            updates.append("parent_id = NULL")
        else:
            # Validate UUID format
            reparent_target = validate_required_uuid(parent_id_value, "parentId")
            updates.append("parent_id = %s")
            params.append(reparent_target)

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
        try:
            with conn.cursor() as cur:
                if reparent_target is not None:
                    # Reread source Memory + owning Tree inside the transaction
                    # to obtain the authoritative tree_id. The pre-transaction
                    # memory["tree_id"] read (from require_memory_owner) must
                    # NOT be used as concurrency authority (Issue #3951).
                    cur.execute(
                        """
                        SELECT m.id, m.tree_id, m.parent_id, m.visibility,
                               t.owner_id AS tree_owner_id
                        FROM memories m
                        INNER JOIN trees t ON t.id = m.tree_id
                        WHERE m.id = %s
                        LIMIT 1
                        """,
                        (safe_memory_id,),
                    )
                    source_row = cur.fetchone()
                    if not source_row:
                        raise HTTPException(status_code=404, detail="Memory not found")
                    if str(source_row["tree_owner_id"]) != owner_id:
                        raise HTTPException(
                            status_code=403, detail="Access denied: not your memory"
                        )
                    authoritative_tree_id = str(source_row["tree_id"])

                    # Acquire tree-scoped transaction advisory lock.
                    # Only one reparent transaction per Tree can proceed,
                    # while different Trees use independent lock keys and
                    # do not serialize (Issue #3951).
                    lock_key = _memory_parent_advisory_lock(authoritative_tree_id)
                    cur.execute("SELECT pg_advisory_xact_lock(%s)", (lock_key,))

                    # Post-lock: reread source + target, validate graph
                    _validate_reparent_atomic(cur, safe_memory_id, reparent_target, owner_id)
                cur.execute(query, tuple(params + [safe_memory_id, owner_id]))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Memory not found")
                _enforce_source_ack_convergence(payload, row)
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return normalize_memory_row(row)


def _validate_reparent_atomic(cur, source_id: str, parent_id: str, owner_id: str) -> None:
    """Validate a memory reparent under the tree-scoped advisory lock.

    Called after pg_advisory_xact_lock acquisition (tree-scoped key
    "memory-parent-graph:<tree_id>"). The advisory lock guarantees that
    only one reparent transaction per Tree is active, so no concurrent
    reparent within the same Tree can mutate the parent graph underneath
    this walk.

    Post-lock steps (all within the single authoritative transaction):

        1. Reread source Memory + owning Tree (owner_id re-verified)
        2. Reread target parent (existence + same-Tree check)
        3. Self-parent rejection
        4. Ancestor-chain walk + cycle detection

    Any failure raises a bounded HTTPException (never a raw DB error /
    deadlock / constraint text).
    """
    source_id = str(source_id)
    parent_id = str(parent_id)

    # Self-parent is rejected up front with its own bounded code.
    if parent_id == source_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PARENT_ID", "reason": "self_parent"},
        )

    # --- Post-lock: reread source Memory ---
    cur.execute(
        "SELECT m.id, m.tree_id, m.parent_id, t.owner_id AS tree_owner_id FROM memories m INNER JOIN trees t ON t.id = m.tree_id WHERE m.id = %s",
        (source_id,),
    )
    source_row = cur.fetchone()
    if not source_row:
        raise HTTPException(status_code=404, detail="Memory not found")
    if str(source_row["tree_owner_id"]) != owner_id:
        raise HTTPException(
            status_code=403, detail="Access denied: not your memory"
        )

    # --- Post-lock: reread target parent ---
    cur.execute(
        "SELECT id, tree_id, parent_id FROM memories WHERE id = %s",
        (parent_id,),
    )
    target_row = cur.fetchone()
    if not target_row:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PARENT_ID", "reason": "not_found"},
        )

    # --- Same-tree check ---
    source_tree_id = str(source_row["tree_id"])
    if str(target_row["tree_id"]) != source_tree_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "PARENT_MEMORY_TREE_MISMATCH"},
        )

    # --- Ancestor-chain walk + cycle check (advisory lock serializes) ---
    _assert_no_ancestor_cycle_locked(cur, source_id, parent_id)


def _assert_no_ancestor_cycle_locked(cur, source_id: str, parent_id: str) -> None:
    """Walk the target's ancestor chain and raise PARENT_CYCLE if the
    source is reachable.

    Every call is protected by the tree-scoped pg_advisory_xact_lock acquired
    by the caller, so no concurrent reparent can mutate the chain during the
    walk. The visited guard also rejects a corrupted pre-existing cycle without
    looping forever.
    """
    source_id = str(source_id)
    parent_id = str(parent_id)
    visited: set[str] = set()
    current = parent_id
    while current:
        if current in visited:
            raise HTTPException(status_code=400, detail={"code": "PARENT_CYCLE"})
        visited.add(current)
        if current == source_id:
            raise HTTPException(status_code=400, detail={"code": "PARENT_CYCLE"})
        cur.execute("SELECT parent_id FROM memories WHERE id = %s", (current,))
        row = cur.fetchone()
        if not row or not row["parent_id"]:
            break
        current = str(row["parent_id"])


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