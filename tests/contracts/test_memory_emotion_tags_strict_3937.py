#!/usr/bin/env python3
"""Focused strict emotionTags regression for Issue #3937."""

import uuid
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from modal_compute.memory_writes import (
    create_owner_memory,
    update_owner_memory,
    validate_emotion_tags,
)


def _assert_400(value, reason):
    try:
        validate_emotion_tags(value)
        raise AssertionError(f"expected invalid emotionTags rejection for {value!r}")
    except HTTPException as error:
        assert error.status_code == 400
        assert error.detail == {"code": "INVALID_EMOTION_TAGS", "reason": reason}


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


def _connection_capturing(returning_row, executed):
    conn = MagicMock(name="conn")
    cursor = MagicMock(name="cursor")
    cursor.fetchone.return_value = returning_row
    cursor.execute.side_effect = lambda query, params=None: executed.append((query, params))
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


def test_normalization_and_intentional_clear():
    assert validate_emotion_tags([]) == []
    assert validate_emotion_tags([" happy ", "", "  ", "hopeful"]) == ["happy", "hopeful"]


def test_malformed_top_level_and_members_rejected():
    for value in (None, "happy", 7, True, {"tag": "happy"}):
        _assert_400(value, "array_required")

    for member in (7, True, None, {"tag": "happy"}):
        _assert_400(["happy", member], "string_items_required")


def test_existing_maximum_is_preserved():
    twenty = [f"tag-{index}" for index in range(20)]
    assert validate_emotion_tags(twenty) == twenty

    try:
        validate_emotion_tags(twenty + ["overflow"])
        raise AssertionError("expected >20 emotionTags rejection")
    except HTTPException as error:
        assert error.status_code == 400
        assert error.detail == "emotionTags exceeds maximum of 20 items"


def test_malformed_update_never_reaches_db_mutation():
    memory = {"id": "8fb6f3cf-01bd-41d4-9d13-a89186cae9f0", "tree_id": "0f999b89-c92e-4f3d-b619-3fe49a2dfa1d"}

    with patch("modal_compute.memory_writes.require_memory_owner", return_value=memory), patch(
        "modal_compute.memory_writes.get_db_connection",
        side_effect=AssertionError("malformed emotionTags must be rejected before DB mutation"),
    ) as db:
        try:
            update_owner_memory("owner-3937", memory["id"], {"emotionTags": "happy"})
            raise AssertionError("expected malformed update rejection")
        except HTTPException as error:
            assert error.status_code == 400
            assert error.detail == {"code": "INVALID_EMOTION_TAGS", "reason": "array_required"}

    assert db.call_count == 0


def test_malformed_create_never_reaches_db_mutation():
    tree_id = "0f999b89-c92e-4f3d-b619-3fe49a2dfa1d"
    tree = {"id": tree_id, "owner_id": "owner-3937", "visibility": "public"}

    with patch(
        "modal_compute.memory_writes.fetch_owner_tree",
        return_value=tree,
    ), patch(
        "modal_compute.memory_writes.require_plus_for_private_storage",
        return_value=None,
    ), patch(
        "modal_compute.memory_writes.get_db_connection",
        side_effect=AssertionError("malformed emotionTags must be rejected before DB mutation"),
    ) as db:
        try:
            create_owner_memory("owner-3937", {"treeId": tree_id, "emotionTags": "happy"})
            raise AssertionError("expected malformed create rejection")
        except HTTPException as error:
            assert error.status_code == 400
            assert error.detail == {"code": "INVALID_EMOTION_TAGS", "reason": "array_required"}

    assert db.call_count == 0


def test_update_explicit_empty_clear_persists():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    returning_row = {"id": memory_id, "tree_id": tree_id, "emotion_tags": []}
    executed = []
    connection_cm, conn = _connection_capturing(returning_row, executed)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ), patch(
        "modal_compute.memory_writes.normalize_memory_row",
        return_value={"id": memory_id, "emotionTags": []},
    ):
        result = update_owner_memory("owner-3937", memory_id, {"emotionTags": []})

    assert result["emotionTags"] == []
    update_query = next(q for q, _ in executed if "update" in q.lower() and "memories" in q.lower())
    assert "emotion_tags = %s" in update_query
    update_params = next(p for q, p in executed if "update" in q.lower() and "memories" in q.lower())
    assert [] in update_params
    assert conn.commit.call_count == 1


def test_update_valid_trimmed_list_persists():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    returning_row = {"id": memory_id, "tree_id": tree_id, "emotion_tags": ["happy", "hopeful"]}
    executed = []
    connection_cm, conn = _connection_capturing(returning_row, executed)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ), patch(
        "modal_compute.memory_writes.normalize_memory_row",
        return_value={"id": memory_id, "emotionTags": ["happy", "hopeful"]},
    ):
        result = update_owner_memory("owner-3937", memory_id, {"emotionTags": [" happy ", "", " hopeful "]})

    assert result["emotionTags"] == ["happy", "hopeful"]
    update_params = next(p for q, p in executed if "update" in q.lower() and "memories" in q.lower())
    assert ["happy", "hopeful"] in update_params


def test_update_omitted_does_not_touch_emotion_tags():
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())
    returning_row = {"id": memory_id, "tree_id": tree_id, "title": "renamed"}
    executed = []
    connection_cm, conn = _connection_capturing(returning_row, executed)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=connection_cm), patch(
        "modal_compute.memory_writes.require_memory_owner",
        return_value=_existing(memory_id, tree_id),
    ), patch(
        "modal_compute.memory_writes.normalize_memory_row",
        return_value={"id": memory_id, "title": "renamed"},
    ):
        result = update_owner_memory("owner-3937", memory_id, {"title": "renamed"})

    assert result["title"] == "renamed"
    update_query = next(q for q, _ in executed if "update" in q.lower() and "memories" in q.lower())
    assert "emotion_tags = %s" not in update_query


if __name__ == "__main__":
    test_normalization_and_intentional_clear()
    test_malformed_top_level_and_members_rejected()
    test_existing_maximum_is_preserved()
    test_malformed_update_never_reaches_db_mutation()
    test_malformed_create_never_reaches_db_mutation()
    test_update_explicit_empty_clear_persists()
    test_update_valid_trimmed_list_persists()
    test_update_omitted_does_not_touch_emotion_tags()
    print("PASS: #3937 strict emotionTags regression (8/8)")
