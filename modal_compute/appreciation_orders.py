from __future__ import annotations

import json
from typing import Any

import psycopg
from fastapi import HTTPException

from modal_compute.db import get_db_connection
from modal_compute.validation import validate_required_id

# Bounded item count for an explicit appreciation order. A single Tree's
# appreciation order is a curated narrative path, not a full dump of every
# memory id; cap it to keep the JSONB payload bounded and the route safe.
MAX_ORDER_ITEMS = 500

_STORAGE_UNAVAILABLE_DETAIL = {"code": "APPRECIATION_ORDER_STORAGE_UNAVAILABLE"}
_STORAGE_INVALID_DETAIL = {"code": "APPRECIATION_ORDER_STORAGE_INVALID"}


def _validate_request_payload(payload: Any) -> list[str]:
    """Validate the route-specific appreciation-order request object.

    ``order`` is intentionally required. Omitting or misspelling it must not
    silently clear an existing persisted order. Unknown fields are rejected so
    this dedicated write boundary cannot accidentally grow into a permissive
    metadata bag (#3921 / #3938 separation).
    """
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail={"code": "APPRECIATION_ORDER_OBJECT_REQUIRED"},
        )

    if "order" not in payload:
        raise HTTPException(
            status_code=400,
            detail={"code": "APPRECIATION_ORDER_REQUIRED", "field": "order"},
        )

    unknown_fields = sorted(set(payload) - {"order"})
    if unknown_fields:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "APPRECIATION_ORDER_UNKNOWN_FIELD",
                "fields": unknown_fields,
            },
        )

    return _validate_order_payload(payload["order"])


def _validate_order_payload(order: Any) -> list[str]:
    """Validate and canonicalize the explicit appreciation order."""
    if not isinstance(order, list):
        raise HTTPException(status_code=400, detail="order must be an array")

    if len(order) > MAX_ORDER_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"order exceeds max {MAX_ORDER_ITEMS} items",
        )

    seen: set[str] = set()
    normalized: list[str] = []
    for i, item in enumerate(order):
        if not isinstance(item, str) or not item.strip():
            raise HTTPException(
                status_code=400,
                detail=f"order[{i}] must be a non-empty string memoryId",
            )

        memory_id = item.strip()
        if memory_id in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate memoryId in order: {memory_id}",
            )
        seen.add(memory_id)
        normalized.append(memory_id)

    return normalized


def _require_tree_owner_cursor(cur: Any, tree_id: str, owner_id: str) -> dict[str, Any]:
    """Validate Tree ownership using the caller's active transaction cursor.

    The SHARE lock keeps the parent Tree row stable through membership
    validation and the appreciation-order UPSERT, so authorization and mutation
    cannot be separated by a concurrent Tree delete/ownership change.
    """
    cur.execute(
        """
        SELECT t.id, t.owner_id
        FROM trees t
        WHERE t.id = %s
        LIMIT 1
        FOR SHARE OF t
        """,
        (tree_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tree not found")
    if str(row.get("owner_id") or "") != owner_id:
        raise HTTPException(status_code=403, detail="Access denied: not your tree")
    return row


def _storage_unavailable(error: BaseException) -> HTTPException:
    """Return a sanitized capability failure without leaking DB details."""
    return HTTPException(status_code=503, detail=_STORAGE_UNAVAILABLE_DETAIL)


def save_appreciation_order(
    tree_id: str,
    owner_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Persist the explicit appreciation order under one transaction boundary.

    Request shape is validated before opening the DB. The authoritative write
    transaction then performs Tree ownership validation, Memory membership
    validation, and the dedicated-table UPSERT on the same connection/cursor.
    Success is returned only after commit, using the canonical ``ordered_ids``
    returned by PostgreSQL.
    """
    safe_tree_id = validate_required_id(tree_id, "treeId")
    order = _validate_request_payload(payload)
    ordered_json = json.dumps(order)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_tree_owner_cursor(cur, safe_tree_id, owner_id)

                if order:
                    cur.execute(
                        """
                        SELECT m.id
                        FROM memories m
                        WHERE m.tree_id = %s
                          AND m.id = ANY(%s)
                        FOR SHARE OF m
                        """,
                        (safe_tree_id, order),
                    )
                    found_ids = {str(row["id"]) for row in cur.fetchall()}
                    missing = [memory_id for memory_id in order if memory_id not in found_ids]
                    if missing:
                        conn.rollback()
                        raise HTTPException(
                            status_code=400,
                            detail="order contains memories not belonging to this tree",
                        )

                cur.execute(
                    """
                    INSERT INTO tree_appreciation_orders (tree_id, ordered_ids, updated_at)
                    VALUES (%s, %s::jsonb, NOW())
                    ON CONFLICT (tree_id)
                    DO UPDATE SET ordered_ids = EXCLUDED.ordered_ids, updated_at = NOW()
                    RETURNING ordered_ids
                    """,
                    (safe_tree_id, ordered_json),
                )
                row = cur.fetchone()
                if not row or not isinstance(row.get("ordered_ids"), list):
                    conn.rollback()
                    raise HTTPException(status_code=500, detail=_STORAGE_INVALID_DETAIL)
                persisted_order = [str(memory_id) for memory_id in row["ordered_ids"]]
            conn.commit()
    except psycopg.errors.UndefinedTable as error:
        raise _storage_unavailable(error) from error

    return {"orderedIds": persisted_order}


def fetch_appreciation_order(
    tree_id: str,
    owner_id: str,
) -> dict[str, Any]:
    """Read the owner's explicit order from dedicated persistence.

    Tree ownership and the dedicated-table read share one connection. No row
    means no explicit appreciation order has been stored yet -> ``[]``.
    """
    safe_tree_id = validate_required_id(tree_id, "treeId")

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_tree_owner_cursor(cur, safe_tree_id, owner_id)
                cur.execute(
                    """
                    SELECT ordered_ids
                    FROM tree_appreciation_orders
                    WHERE tree_id = %s
                    LIMIT 1
                    """,
                    (safe_tree_id,),
                )
                row = cur.fetchone()
    except psycopg.errors.UndefinedTable as error:
        raise _storage_unavailable(error) from error

    if not row:
        return {"orderedIds": []}

    ordered = row.get("ordered_ids")
    if not isinstance(ordered, list):
        raise HTTPException(status_code=500, detail=_STORAGE_INVALID_DETAIL)
    return {"orderedIds": [str(memory_id) for memory_id in ordered]}
