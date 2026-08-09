"""Contract tests for POST /api/trees/:id/fork

Tests verify:
- Unauthenticated request returns 401
- Missing source tree returns 404
- Non-public (private) source tree returns 403
- Public source copy returns 201/200 with correct ownership and lineage
- Original source tree is unchanged after fork
- Duplicate fork guard returns existing copy with duplicate=true

Privacy (#3952): the source authorization now happens inside the fork
transaction (SELECT ... FOR SHARE), so these tests drive the mocked
transaction cursor directly instead of a pre-transaction DTO fetch.

These are contract-level tests. They mock db and auth layers.
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from modal_compute.app import web_app

client = TestClient(web_app)

PUBLIC_TREE_ID = str(uuid.uuid4())
PRIVATE_TREE_ID = str(uuid.uuid4())
MISSING_TREE_ID = str(uuid.uuid4())
AUTH_USER_ID = "test-user-uid-fork"

MOCK_PUBLIC_TREE_ROW = {
    "id": PUBLIC_TREE_ID,
    "owner_id": "original-owner-uid",
    "title": "My Public LoveTree",
    "visibility": "public",
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00",
}

MOCK_PRIVATE_TREE_ROW = {
    "id": PRIVATE_TREE_ID,
    "owner_id": "original-owner-uid",
    "title": "My Private LoveTree",
    "visibility": "private",
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00",
}

MOCK_SOURCE_MEMORIES = [
    {
        "id": str(uuid.uuid4()),
        "parent_id": None,
        "title": "Memory 1",
        "memo": "memo text",
        "artist": "Artist A",
        "source": "YouTube",
        "source_url": "https://youtube.com/watch?v=test1",
        "source_type": "youtube",
        "thumbnail": "https://img.example.com/1.jpg",
        "emotion_tags": json.dumps(["joy"]),
        "timestamp": "1:23",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
    },
    {
        "id": str(uuid.uuid4()),
        "parent_id": None,
        "title": "Memory 2",
        "memo": None,
        "artist": None,
        "source": None,
        "source_url": None,
        "source_type": "youtube",
        "thumbnail": None,
        "emotion_tags": json.dumps([]),
        "timestamp": None,
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
    },
]


def _make_new_tree_row(new_id: str, owner_id: str, title: str, source_id: str) -> dict:
    return {
        "id": new_id,
        "owner_id": owner_id,
        "title": title,
        "visibility": "public",
        "forked_from_tree_id": source_id,
        "created_at": "2026-04-29T00:00:00",
        "updated_at": "2026-04-29T00:00:00",
    }


def _fork_conn_context(cursor: MagicMock) -> MagicMock:
    """Build a patch context for modal_compute.tree_writes.get_db_connection.

    Returns (context, conn) where `with get_db_connection() as conn:` yields the
    same mock connection and `with conn.cursor() as cur:` yields `cursor`.
    """
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: cursor
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    context = MagicMock()
    context.return_value.__enter__ = lambda s: conn
    context.return_value.__exit__ = MagicMock(return_value=False)
    return context


# --- Auth Required ---

def test_fork_tree_requires_auth():
    """POST /api/trees/:id/fork without Authorization must return 401."""
    response = client.post(f"/modal/private/trees/{PUBLIC_TREE_ID}/fork")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"


# --- Missing Source (transaction-local FOR SHARE read returns no row) ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.tree_writes.ensure_owner_user_exists")
@patch("modal_compute.tree_writes.get_db_connection")
def test_fork_tree_missing_source(mock_conn_ctx, mock_user, mock_auth):
    """POST /api/trees/:id/fork with non-existent source tree must return 404."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None  # FOR SHARE source read -> no row
    mock_conn_ctx.side_effect = _fork_conn_context(mock_cursor)

    response = client.post(
        f"/modal/private/trees/{MISSING_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )
    assert response.status_code == 404
    body = response.json()
    assert "not found" in body.get("detail", "").lower()


# --- Private Source Rejection (transaction-local visibility check) ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.tree_writes.ensure_owner_user_exists")
@patch("modal_compute.tree_writes.get_db_connection")
def test_fork_tree_private_source_denied(mock_conn_ctx, mock_user, mock_auth):
    """POST /api/trees/:id/fork with private source tree must return 403."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = MOCK_PRIVATE_TREE_ROW  # FOR SHARE -> private
    mock_conn_ctx.side_effect = _fork_conn_context(mock_cursor)

    response = client.post(
        f"/modal/private/trees/{PRIVATE_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )
    assert response.status_code == 403
    body = response.json()
    assert "public" in body.get("detail", "").lower() or "fork" in body.get("detail", "").lower()


# --- Public Source Copy Success ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.tree_writes.ensure_owner_user_exists")
@patch("modal_compute.tree_writes.get_db_connection")
def test_fork_tree_public_source_success(mock_conn_ctx, mock_user, mock_auth):
    """POST /api/trees/:id/fork with public source must create new tree owned by authed user."""
    new_tree_id = str(uuid.uuid4())
    new_tree_row = _make_new_tree_row(
        new_tree_id, AUTH_USER_ID, "My Public LoveTree (복사본)", PUBLIC_TREE_ID
    )

    # fetchone order: FOR SHARE source -> public row, duplicate check -> none,
    # destination tree INSERT -> new row, then memory INSERTs (no fetchone).
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        MOCK_PUBLIC_TREE_ROW,
        None,
        new_tree_row,
        *[None] * 10,
    ]
    mock_cursor.fetchall.return_value = MOCK_SOURCE_MEMORIES
    mock_conn_ctx.side_effect = _fork_conn_context(mock_cursor)

    response = client.post(
        f"/modal/private/trees/{PUBLIC_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body.get("forked") is True
    assert body.get("duplicate") is False
    assert body.get("forkedFromTreeId") == PUBLIC_TREE_ID
    # New tree title must contain source title
    assert "My Public LoveTree" in body.get("title", "")
    assert "복사본" in body.get("title", "")


# --- Original Tree Unchanged ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.tree_writes.ensure_owner_user_exists")
@patch("modal_compute.tree_writes.get_db_connection")
def test_fork_tree_original_unchanged(mock_conn_ctx, mock_user, mock_auth):
    """After fork, source tree must not be modified."""
    new_tree_id = str(uuid.uuid4())
    new_tree_row = _make_new_tree_row(
        new_tree_id, AUTH_USER_ID, "My Public LoveTree (복사본)", PUBLIC_TREE_ID
    )

    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        MOCK_PUBLIC_TREE_ROW,
        None,
        new_tree_row,
        *[None] * 10,
    ]
    mock_cursor.fetchall.return_value = MOCK_SOURCE_MEMORIES
    mock_conn_ctx.side_effect = _fork_conn_context(mock_cursor)

    client.post(
        f"/modal/private/trees/{PUBLIC_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )

    # Verify no UPDATE or DELETE was issued against the source tree
    all_execute_calls = [
        str(call) for call in mock_cursor.execute.call_args_list
    ]
    source_mutations = [
        c for c in all_execute_calls
        if ("UPDATE trees" in c or "DELETE FROM trees" in c) and PUBLIC_TREE_ID in c
    ]
    assert len(source_mutations) == 0, f"Source tree was mutated: {source_mutations}"


# --- Duplicate Fork Guard (inside the fork transaction) ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.tree_writes.ensure_owner_user_exists")
@patch("modal_compute.tree_writes.fetch_owner_tree")
@patch("modal_compute.tree_writes.get_db_connection")
def test_fork_tree_duplicate_guard(mock_conn_ctx, mock_owner_tree, mock_user, mock_auth):
    """If user already forked this tree, return existing copy with duplicate=true."""
    existing_id = str(uuid.uuid4())

    # fetchone order: FOR SHARE source -> public row, duplicate check -> found.
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        MOCK_PUBLIC_TREE_ROW,
        {"id": existing_id},
    ]
    mock_conn_ctx.side_effect = _fork_conn_context(mock_cursor)
    mock_owner_tree.return_value = {
        "id": existing_id,
        "owner_id": AUTH_USER_ID,
        "title": "My Public LoveTree (복사본)",
        "visibility": "public",
        "forkedFromTreeId": PUBLIC_TREE_ID,
    }

    response = client.post(
        f"/modal/private/trees/{PUBLIC_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("duplicate") is True
    assert body.get("forked") is False
