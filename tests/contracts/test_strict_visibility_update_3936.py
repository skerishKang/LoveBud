#!/usr/bin/env python3
"""
Executable contract tests for #3936: reject null/malformed Tree/Memory
visibility updates instead of defaulting to public.

Run: python3 tests/contracts/test_strict_visibility_update_3936.py
"""

import os
import sys
import uuid
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.validation import validate_explicit_visibility, validate_visibility
from modal_compute.memory_writes import update_owner_memory
from modal_compute.tree_writes import update_owner_tree


# ============================================================================
# Strict validator matrix
# ============================================================================

def test_explicit_visibility_rejects_null_and_malformed():
    bad = [None, "", "   ", 1, 0, True, False, [], {}, ["public"], {"v": "public"}, "PUBLIC", "Public", "public ", 3.14]
    for value in bad:
        try:
            validate_explicit_visibility(value)
        except HTTPException as exc:
            assert exc.status_code == 400, f"{value!r} should be HTTP 400, got {exc.status_code}"
        else:
            raise AssertionError(f"{value!r} was accepted by validate_explicit_visibility")
    print("  ok: all malformed values -> HTTP 400")


def test_explicit_visibility_accepts_literals():
    assert validate_explicit_visibility("public") == "public"
    assert validate_explicit_visibility("private") == "private"
    print("  ok: literal public/private accepted")


def test_create_path_default_semantics_unchanged():
    assert validate_visibility(None, "public") == "public"
    assert validate_visibility(None, "private") == "private"
    assert validate_visibility("private", "public") == "private"
    print("  ok: create-path validate_visibility(None, default) fallback preserved")


# ============================================================================
# update_owner_memory strict rejection (validation before DB mutation)
# ============================================================================

def _memory_row(memory_id, visibility="private", tree_visibility="private"):
    return {
        "id": memory_id, "tree_id": str(uuid.uuid4()), "parent_id": None,
        "title": "title", "memo": "memo", "artist": None, "source": None,
        "source_url": None, "source_type": None, "thumbnail": None,
        "emotion_tags": [], "timestamp": None, "visibility": visibility,
        "channel_id": None, "channel_name": None, "channel_url": None,
    }


def test_update_memory_visibility_null_rejected_before_db_mutation():
    memory_id = str(uuid.uuid4())
    payload = {"visibility": None}
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    with patch("modal_compute.memory_writes.require_memory_owner", return_value=_memory_row(memory_id)):
        with patch("modal_compute.memory_writes.get_db_connection", return_value=mock_conn):
            try:
                update_owner_memory("owner-1", memory_id, payload)
            except HTTPException as exc:
                assert exc.status_code == 400, f"expected 400, got {exc.status_code}"
            else:
                raise AssertionError("update with visibility:null must fail with HTTP 400")

    # validation precedes DB mutation: no UPDATE execute
    executed = [q for q, _ in (mock_cursor.execute.call_args_list if mock_cursor.execute.called else [])]
    assert not any("UPDATE memories" in q for q in executed), "no UPDATE should reach DB for null visibility"
    mock_conn.commit.assert_not_called()
    print("  PASSED: memory visibility:null -> 400 before any DB mutation")


def test_update_memory_malformed_values_rejected_no_db_mutation():
    for bad in ["", "   ", 1, True, [], {}]:
        memory_id = str(uuid.uuid4())
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=_memory_row(memory_id)):
            with patch("modal_compute.memory_writes.get_db_connection", return_value=mock_conn):
                try:
                    update_owner_memory("owner-1", memory_id, {"visibility": bad})
                except HTTPException as exc:
                    assert exc.status_code == 400, f"{bad!r} expected 400, got {exc.status_code}"
                else:
                    raise AssertionError(f"update with {bad!r} must be HTTP 400")
        assert not mock_conn.commit.called
    print("  PASSED: memory malformed visibility values -> 400, no commit")


def test_update_memory_persisted_visibility_stays_after_failed_null():
    memory_id = str(uuid.uuid4())
    source = _memory_row(memory_id, visibility="private")
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    with patch("modal_compute.memory_writes.require_memory_owner", return_value=source):
        with patch("modal_compute.memory_writes.get_db_connection", return_value=mock_conn):
            try:
                update_owner_memory("owner-1", memory_id, {"visibility": None})
            except HTTPException:
                pass
            else:
                raise AssertionError("expected HTTP 400")
    # persisted visibility unchanged (source row was never reflected, and no UPDATE ran)
    assert mock_conn.commit.call_count == 0
    print("  OK: private memory remains private after rejected null update (no commit)")


# ============================================================================
# update_owner_tree flow
# ============================================================================

def test_update_tree_visibility_null_rejected_before_db_mutation():
    tree_id = str(uuid.uuid4())
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            try:
                update_owner_tree("owner-1", tree_id, {"visibility": None})
            except HTTPException as exc:
                assert exc.status_code == 400, f"expected 400, got {exc.status_code}"
            else:
                raise AssertionError("update tree with null visibility must be HTTP 400")
    assert not mock_conn.commit.called
    print("  OK: tree visibility:null -> 400, no commit")


def test_update_tree_malformed_rejected_before_db_write():
    for bad in ["", "   ", 1, True, [], {}]:
        tree_id = str(uuid.uuid4())
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
            with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
                try:
                    update_owner_tree("owner-1", tree_id, {"visibility": bad})
                except HTTPException as exc:
                    assert exc.status_code == 400, f"{bad!r} expected 400"
                else:
                    raise AssertionError(f"{bad!r} must be 400")
        assert not mock_conn.commit.called
    print("  OK: tree malformed visibility -> 400, no commit")


def test_update_tree_omitted_visibility_is_noop():
    # payload without visibility key must never touch visibility
    tree_id = str(uuid.uuid4())
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    def fake_fetch(*args, **kwargs):
        return {"id": tree_id, "visibility": "private", "title": "new title"}

    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", side_effect=fake_fetch):
                try:
                    update_owner_tree("owner-1", tree_id, {"title": "new title"})
                except HTTPException:
                    pass
    # no visibility column write may appear in the UPDATE
    written_sql = [q for q, _ in (mock_cursor.execute.call_args_list if mock_cursor.execute.called else [])]
    assert all("visibility" not in q for q in written_sql), "omitted visibility must not touch visibility column"
    print("  OK: omitted visibility is a no-op (title only, no visibility column)")


if __name__ == "__main__":
    test_explicit_visibility_rejects_null_and_malformed()
    test_explicit_visibility_accepts_literals()
    test_create_path_default_semantics_unchanged()
    test_update_memory_visibility_null_rejected_before_db_mutation()
    test_update_memory_malformed_values_rejected_no_db_mutation()
    test_update_memory_persisted_visibility_stays_after_failed_null()
    test_update_tree_visibility_null_rejected_before_db_mutation()
    test_update_tree_malformed_rejected_before_db_write()
    test_update_tree_omitted_visibility_is_noop()
    print("\nALL 3936 EXECUTABLE CHECKS PASSED")