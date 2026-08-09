from __future__ import annotations

import hashlib
import json
import math
import uuid
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from modal_compute.db import get_db_connection
from modal_compute.write_validation import require_tree_owner

MAX_POSITIONS = 500
MAX_POSITION_VALUE = 1_000_000.0
VALID_LAYOUT_MODES = {"manual", "auto"}


class HubLayoutNotFoundError(HTTPException):
    def __init__(self) -> None:
        super().__init__(status_code=404, detail="Hub layout not found")


async def hub_layout_not_found_handler(request: Any, exc: HubLayoutNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "error": "Hub layout not found",
            "code": "HUB_LAYOUT_NOT_FOUND",
        },
    )


def _to_isoformat(value: Any) -> str | None:
    """Format a value as ISO 8601 string."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _validate_manual_positions(positions: Any) -> list[dict[str, Any]]:
    """Validate manual_positions JSONB payload.

    Requirements:
    - Must be a list of objects
    - Each object must have 'memoryId' (string) and 'position' (object with x, y)
    - x, y must be finite numbers (no NaN, Infinity, -Infinity)
    - ``|x|``, ``|y|`` <= MAX_POSITION_VALUE
    - No duplicate memoryId
    - Total positions <= MAX_POSITIONS
    """
    if not isinstance(positions, list):
        raise HTTPException(status_code=400, detail="manualPositions must be an array")

    if len(positions) > MAX_POSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"manualPositions exceeds max {MAX_POSITIONS} items",
        )

    seen_ids: set[str] = set()
    for i, item in enumerate(positions):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}] must be an object",
            )

        memory_id = item.get("memoryId")
        if not isinstance(memory_id, str) or not memory_id.strip():
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].memoryId is required",
            )

        if memory_id in seen_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate memoryId in manualPositions: {memory_id}",
            )
        seen_ids.add(memory_id)

        position = item.get("position")
        if not isinstance(position, dict):
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].position must be an object",
            )

        x = position.get("x")
        y = position.get("y")

        if x is None or y is None:
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].position must have x and y",
            )

        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].position x and y must be numbers",
            )

        if math.isnan(x) or math.isinf(x) or math.isnan(y) or math.isinf(y):
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].position contains non-finite coordinates",
            )

        if abs(x) > MAX_POSITION_VALUE or abs(y) > MAX_POSITION_VALUE:
            raise HTTPException(
                status_code=400,
                detail=f"manualPositions[{i}].position coordinates exceed limit of {MAX_POSITION_VALUE}",
            )

    return positions


def _validate_layout_mode(mode: Any) -> str:
    """Validate layout_mode. Default to 'manual' if not provided."""
    if mode is None:
        return "manual"
    if not isinstance(mode, str) or mode not in VALID_LAYOUT_MODES:
        raise HTTPException(
            status_code=400,
            detail="layoutMode must be 'manual' or 'auto'",
        )
    return mode


def _hub_layout_lock_key(tree_id: str) -> int:
    """Return a stable, domain-separated signed bigint for PostgreSQL advisory locking."""
    digest = hashlib.sha256(f"hub-layout:{tree_id}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)


def _fetch_latest_revision(tree_id: str) -> int | None:
    """Fetch the latest revision number for a tree's hub layout (read-only callers)."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT revision
                FROM tree_hub_layouts
                WHERE tree_id = %s
                ORDER BY revision DESC
                LIMIT 1
                """,
                (tree_id,),
            )
            row = cur.fetchone()
            return row["revision"] if row else None


def save_hub_layout(
    tree_id: str,
    owner_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Save a new revision of hub layout atomically per Tree.

    Payload/ownership validation occurs before the transaction. Revision authority
    and the insert share one transaction guarded by a Tree-scoped advisory lock,
    so concurrent writers from the same base revision serialize deterministically.
    """
    # Validate ownership and request shape before taking the transaction lock.
    require_tree_owner(tree_id, owner_id)

    base_revision = payload.get("baseRevision")
    if base_revision is None:
        raise HTTPException(status_code=400, detail="baseRevision is required")
    if not isinstance(base_revision, int) or base_revision < 0:
        raise HTTPException(
            status_code=400,
            detail="baseRevision must be a non-negative integer",
        )

    layout_mode = _validate_layout_mode(payload.get("layoutMode"))
    manual_positions = _validate_manual_positions(payload.get("manualPositions", []))

    with get_db_connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(%s)", (_hub_layout_lock_key(tree_id),))
                cur.execute(
                    """
                    SELECT revision
                    FROM tree_hub_layouts
                    WHERE tree_id = %s
                    ORDER BY revision DESC
                    LIMIT 1
                    """,
                    (tree_id,),
                )
                latest_row = cur.fetchone()
                latest_revision = latest_row["revision"] if latest_row else 0

                if base_revision != latest_revision:
                    raise HTTPException(
                        status_code=409,
                        detail="Conflict: baseRevision does not match the latest revision",
                    )

                new_revision = latest_revision + 1
                cur.execute(
                    """
                    INSERT INTO tree_hub_layouts (id, tree_id, revision, layout_mode, manual_positions, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, NOW(), NOW())
                    RETURNING revision, updated_at
                    """,
                    (
                        str(uuid.uuid4()),
                        tree_id,
                        new_revision,
                        layout_mode,
                        json.dumps(manual_positions),
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return {
        "revision": row["revision"],
        "updatedAt": _to_isoformat(row["updated_at"]),
        "positions": manual_positions,
    }


def fetch_hub_layout(
    tree_id: str,
    owner_id: str,
) -> dict[str, Any]:
    """Fetch the latest hub layout for a tree.

    Steps:
    1. Validate tree ownership via ``require_tree_owner``
    2. Query latest row from ``tree_hub_layouts``
    3. Raise ``HubLayoutNotFoundError`` (404) if none

    Returns ``{ revision, layout_mode, positions, updated_at }``.
    """
    # 1. Tree ownership
    require_tree_owner(tree_id, owner_id)

    # 2. Query latest
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT revision, layout_mode, manual_positions, updated_at
                FROM tree_hub_layouts
                WHERE tree_id = %s
                ORDER BY revision DESC
                LIMIT 1
                """,
                (tree_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HubLayoutNotFoundError()

    return {
        "revision": row["revision"],
        "layoutMode": row["layout_mode"],
        "positions": row["manual_positions"],
        "updatedAt": _to_isoformat(row["updated_at"]),
    }