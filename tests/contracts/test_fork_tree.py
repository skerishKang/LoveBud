"""Contract tests for POST /api/trees/:id/fork

Tests verify:
- Unauthenticated request returns 401
- Missing source tree returns 404
- Non-public (private) source tree returns 403
- Public source copy returns 201/200 with correct ownership and lineage
- Original source tree is unchanged after fork
- Duplicate fork guard returns existing copy with duplicate=true

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


# --- Auth Required ---

def test_fork_tree_requires_auth():
    """POST /api/trees/:id/fork without Authorization must return 401."""
    response = client.post(f"/modal/private/trees/{PUBLIC_TREE_ID}/fork")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"


# --- Missing Source ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.app.fetch_tree_for_owner_check", return_value=None)
def test_fork_tree_missing_source(mock_fetch, mock_auth):
    """POST /api/trees/:id/fork with non-existent source tree must return 404."""
    response = client.post(
        f"/modal/private/trees/{MISSING_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )
    assert response.status_code == 404
    body = response.json()
    assert "not found" in body.get("detail", "").lower()


# --- Private Source Rejection ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.app.fetch_tree_for_owner_check", return_value=MOCK_PRIVATE_TREE_ROW)
def test_fork_tree_private_source_denied(mock_fetch, mock_auth):
    """POST /api/trees/:id/fork with private source tree must return 403."""
    response = client.post(
        f"/modal/private/trees/{PRIVATE_TREE_ID}/fork",
        headers={"authorization": "Bearer fake-token"},
    )
    assert response.status_code == 403
    body = response.json()
    assert "public" in body.get("detail", "").lower() or "fork" in body.get("detail", "").lower()


# --- Public Source Copy Success ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.app.run_db_with_retry")
@patch("modal_compute.app.get_db_connection")
def test_fork_tree_public_source_success(mock_conn_ctx, mock_retry, mock_auth):
    """POST /api/trees/:id/fork with public source must create new tree owned by authed user."""
    new_tree_id = str(uuid.uuid4())
    new_tree_row = _make_new_tree_row(
        new_tree_id, AUTH_USER_ID, "My Public LoveTree (복사본)", PUBLIC_TREE_ID
    )

    # run_db_with_retry: first call = no existing fork, subsequent = used in fork_public_tree
    call_count = 0

    def retry_side_effect(fn):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # check_existing → no prior fork
            return None
        return fn()

    mock_retry.side_effect = retry_side_effect

    # Mock DB connection for insert operations
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [new_tree_row, *[None] * 10]
    mock_cursor.fetchall.return_value = MOCK_SOURCE_MEMORIES
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn_ctx.return_value.__enter__ = lambda s: mock_conn
    mock_conn_ctx.return_value.__exit__ = MagicMock(return_value=False)

    with patch("modal_compute.app.fetch_tree_for_owner_check", return_value=MOCK_PUBLIC_TREE_ROW):
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
@patch("modal_compute.app.run_db_with_retry")
@patch("modal_compute.app.get_db_connection")
def test_fork_tree_original_unchanged(mock_conn_ctx, mock_retry, mock_auth):
    """After fork, source tree must not be modified."""
    new_tree_id = str(uuid.uuid4())
    new_tree_row = _make_new_tree_row(
        new_tree_id, AUTH_USER_ID, "My Public LoveTree (복사본)", PUBLIC_TREE_ID
    )

    call_count = 0

    def retry_side_effect(fn):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return None
        return fn()

    mock_retry.side_effect = retry_side_effect

    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [new_tree_row, *[None] * 10]
    mock_cursor.fetchall.return_value = MOCK_SOURCE_MEMORIES
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn_ctx.return_value.__enter__ = lambda s: mock_conn
    mock_conn_ctx.return_value.__exit__ = MagicMock(return_value=False)

    with patch("modal_compute.app.fetch_tree_for_owner_check", return_value=MOCK_PUBLIC_TREE_ROW):
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


# --- Duplicate Fork Guard ---

@patch("modal_compute.app.require_firebase_user", return_value={"uid": AUTH_USER_ID})
@patch("modal_compute.app.fetch_tree_for_owner_check", return_value=MOCK_PUBLIC_TREE_ROW)
@patch("modal_compute.app.fetch_owner_tree")
@patch("modal_compute.app.run_db_with_retry")
def test_fork_tree_duplicate_guard(mock_retry, mock_owner_tree, mock_fetch, mock_auth):
    """If user already forked this tree, return existing copy with duplicate=true."""
    existing_id = str(uuid.uuid4())
    mock_retry.return_value = {"id": existing_id}  # existing fork found
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
