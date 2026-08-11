#!/usr/bin/env python3
"""Focused strict emotionTags regression for Issue #3937."""

from unittest.mock import patch

from fastapi import HTTPException

from modal_compute.memory_writes import update_owner_memory, validate_emotion_tags


def _assert_400(value, reason):
    try:
        validate_emotion_tags(value)
        raise AssertionError(f"expected invalid emotionTags rejection for {value!r}")
    except HTTPException as error:
        assert error.status_code == 400
        assert error.detail == {"code": "INVALID_EMOTION_TAGS", "reason": reason}


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


if __name__ == "__main__":
    test_normalization_and_intentional_clear()
    test_malformed_top_level_and_members_rejected()
    test_existing_maximum_is_preserved()
    test_malformed_update_never_reaches_db_mutation()
    print("PASS: #3937 strict emotionTags regression (4/4)")
