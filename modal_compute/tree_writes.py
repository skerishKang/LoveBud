# Tree write operations for owner
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException

from modal_compute.auth import require_plus_for_private_storage
from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.validation import (
    _to_isoformat,
    normalize_tree_row,
    validate_visibility,
    validate_optional_string,
)


def create_owner_tree(owner_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a new tree for owner."""
    title = validate_optional_string(payload.get("title"), 200) or "My LoveTree"
    visibility = validate_visibility(payload.get("visibility"), "public")
    require_plus_for_private_storage(owner_id, visibility)

    query = """
        INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
        VALUES (%s, %s, %s, %s, NOW(), NOW())
        RETURNING id, owner_id, title, visibility, created_at, updated_at;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (str(uuid.uuid4()), owner_id, title, visibility))
            row = cur.fetchone()
        conn.commit()

    return normalize_tree_row(row, 0)


def update_owner_tree(owner_id: str, tree_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Update tree details."""
    # Placeholder - implement tree update logic
    pass


def delete_owner_tree(owner_id: str, tree_id: str) -> dict[str, Any]:
    """Delete tree and all associated memories."""
    # Placeholder - implement tree deletion with cascade
    pass