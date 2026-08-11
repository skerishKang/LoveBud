#!/usr/bin/env python3
"""Focused transaction regression for Issue #3922."""

import uuid
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from modal_compute.memory_writes import update_owner_memory


def _connection(returning_row):
    conn = MagicMock(name="conn")
    cursor = MagicMock(name="cursor")
    cursor.fetchone.return_value = returning_row
    cursor_cm = MagicMock(name="cursor_cm")
    cursor_cm.__enter__.return_value = cursor
    cursor_cm.__exit__.return_value = False
    conn.cursor.return_value = cursor_cm

    connection_cm = MagicMock(name="connection_cm")
    connection_cm.__enter__.return_value = conn
    connection_cm.__exit__.return_value = False
    return connection_cm, conn


def _existing(memory_id, tree_id):
    return {"id": memory_id, "tree_id": tree_id}


def test_divergent_ack_rolls_back_without_commit():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    requested = "https://youtube.example/requested"
    persisted = "https://youtube.example/persisted"
    connection_cm, conn = _connection({"source_url": persisted})

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ):
        try:
            update_owner_memory("owner-3922", memory_id, {"sourceUrl": requested})
            raise AssertionError("expected SOURCE_WRITE_ACK_DIVERGENCE")
        except HTTPException as error:
            assert error.status_code == 409
            assert error.detail["code"] == "SOURCE_WRITE_ACK_DIVERGENCE"
            assert requested not in str(error.detail)
            assert persisted not in str(error.detail)

    assert conn.commit.call_count == 0
    assert conn.rollback.call_count == 1


def test_convergent_ack_commits_once_without_rollback():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    source_url = "https://youtube.example/matched"
    returning_row = {"source_url": source_url}
    connection_cm, conn = _connection(returning_row)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ), patch(
        "modal_compute.memory_writes.normalize_memory_row",
        return_value={"id": memory_id, "sourceUrl": source_url},
    ):
        result = update_owner_memory("owner-3922", memory_id, {"sourceUrl": source_url})

    assert result["sourceUrl"] == source_url
    assert conn.commit.call_count == 1
    assert conn.rollback.call_count == 0


def test_missing_returning_row_rolls_back_without_commit():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    connection_cm, conn = _connection(None)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ):
        try:
            update_owner_memory("owner-3922", memory_id, {"title": "still guarded"})
            raise AssertionError("expected 404")
        except HTTPException as error:
            assert error.status_code == 404

    assert conn.commit.call_count == 0
    assert conn.rollback.call_count == 1


if __name__ == "__main__":
    test_divergent_ack_rolls_back_without_commit()
    test_convergent_ack_commits_once_without_rollback()
    test_missing_returning_row_rolls_back_without_commit()
    print("PASS: #3922 explicit rollback regression (3/3)")
