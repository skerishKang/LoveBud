from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection
from modal_compute.validation import validate_required_uuid
from modal_compute.write_validation import require_tree_owner

# Bounded item count for an explicit appreciation order. A single Tree's
# appreciation order is a curated narrative path, not a full dump of every
# memory id; cap it to keep the JSONB payload bounded and the route safe.
MAX_ORDER_ITEMS = 500


def _validate_order_payload(order: Any) -> list[str]:
    """Validate and normalize the explicit appreciation order.

    Requirements:
    - ``order`` must be a list (array)
    - Each item must be a non-empty string memory id
    - No duplicate memory ids
    - Total items <= MAX_ORDER_ITEMS

    Returns the normalized list of memory ids (may be empty, allowing a
    cleared / partial order).
    """
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
        if item in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate memoryId in order: {item}",
            )
        seen.add(item)
        normalized.append(item)

    return normalized


def save_appreciation_order(
    tree_id: str,
    owner_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Persist the explicit appreciation order as the authoritative source.

    The full lifecycle runs inside one transaction boundary:

      1. Validate tree ownership (stable 4xx on missing/foreign tree).
      2. Validate the order payload shape (array, bounded, no duplicates).
      3. Validate every id belongs to THIS Tree's memories (FOR SHARE so a
         concurrent memory deletion cannot leave a dangling reference).
      4. UPSERT into tree_appreciation_orders.

    Success is returned only after the UPSERT is persisted. Any membership
    failure rolls back with zero mutation.
    """
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_tree_owner(safe_tree_id, owner_id)

    order = _validate_order_payload(payload.get("order", []))
    ordered_json = json.dumps(order)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 3. Membership validation within the same transaction. Skip for an
            # empty order (cleared / partial order permitted).
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
                missing = [mid for mid in order if mid not in found_ids]
                if missing:
                    conn.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail="order contains memories not belonging to this tree",
                    )

            # 4. UPSERT the validated sequence.
            cur.execute(
                """
                INSERT INTO tree_appreciation_orders (tree_id, ordered_ids, updated_at)
                VALUES (%s, %s::jsonb, NOW())
                ON CONFLICT (tree_id)
                DO UPDATE SET ordered_ids = EXCLUDED.ordered_ids, updated_at = NOW()
                RETURNING tree_id
                """,
                (safe_tree_id, ordered_json),
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=500, detail="Appreciation order save failed")

    return {"ok": True}


def fetch_appreciation_order(
    tree_id: str,
    owner_id: str,
) -> dict[str, Any]:
    """Read the explicit appreciation order from dedicated persistence.

    Steps:
      1. Validate tree ownership (stable 4xx on missing/foreign tree).
      2. Read tree_appreciation_orders.

    No row means there is no explicit order yet -> ``orderedIds: []``.
    Never falls back to a Tree DTO field.
    """
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    require_tree_owner(safe_tree_id, owner_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
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

    ordered = row["ordered_ids"] if row else []
    if not isinstance(ordered, list):
        ordered = []
    return {"orderedIds": ordered}
