#!/usr/bin/env python3
"""
Executable behavioral contract tests for #3938: reject unsupported Tree update
fields (and empty updates) instead of returning a no-op success.

This is the dedicated #3938 test only. It must NOT touch
tests/contracts/modal-owner-write-route-contract.test.cjs (owned by #3992).

Run: python3 tests/contracts/test_tree_update_allowlist_3938.py
"""

import os
import sys
import uuid
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.tree_writes import (
    ALLOWED_TREE_UPDATE_FIELDS,
    update_owner_tree,
)


def _new_conn(tree_id):
    """Mock DB connection whose UPDATE is observed and fetchone returns a row."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {"id": tree_id}
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    return mock_conn, mock_cursor


# ============================================================================
# Allowlist shape
# ============================================================================

def test_allowlist_exact_fields():
    assert ALLOWED_TREE_UPDATE_FIELDS == {
        "title",
        "visibility",
        "groupName",
        "keywords",
    }
    assert "appreciationOrder" not in ALLOWED_TREE_UPDATE_FIELDS
    print("  ok: allowlist is exactly {title, visibility, groupName, keywords}")


# ============================================================================
# Rejected payloads => zero DB mutation
# ============================================================================

def _expect_400(payload, code=None, fields=None):
    """Run update_owner_tree with patched deps; assert HTTP 400 + zero mutation."""
    tree_id = str(uuid.uuid4())
    get_db = MagicMock()
    fetch = MagicMock()
    entitlement = MagicMock()
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", get_db):
            with patch("modal_compute.tree_writes.fetch_owner_tree", fetch):
                with patch("modal_compute.tree_writes.require_plus_for_private_storage", entitlement):
                    try:
                        update_owner_tree("owner-1", tree_id, payload)
                    except HTTPException as exc:
                        assert exc.status_code == 400, f"expected 400, got {exc.status_code}"
                        detail = exc.detail
                        if code is not None:
                            assert detail.get("code") == code, f"expected code {code}, got {detail}"
                        if fields is not None:
                            assert detail.get("fields") == fields, f"expected fields {fields}, got {detail}"
                        return detail
                    raise AssertionError("rejected payload must raise HTTP 400")
    raise AssertionError("unreachable")


def test_empty_payload_rejected_no_mutation():
    tree_id = str(uuid.uuid4())
    get_db = MagicMock()
    fetch = MagicMock()
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", get_db):
            with patch("modal_compute.tree_writes.fetch_owner_tree", fetch):
                try:
                    update_owner_tree("owner-1", tree_id, {})
                except HTTPException as exc:
                    assert exc.status_code == 400
                    assert exc.detail.get("code") == "EMPTY_TREE_UPDATE"
                else:
                    raise AssertionError("empty payload must be HTTP 400 EMPTY_TREE_UPDATE")

    # No DB opened, no fetch fallback, no UPDATE, no commit on reject.
    assert get_db.call_count == 0, "empty payload must not open DB connection"
    assert fetch.call_count == 0, "empty payload must not call fetch_owner_tree"
    print("  PASSED: {} -> 400 EMPTY_TREE_UPDATE, 0 UPDATE/commit/fetch")


def test_unknown_only_rejected_no_mutation():
    detail = _expect_400(
        {"visiblity": "private"},
        code="UNSUPPORTED_TREE_UPDATE_FIELDS",
        fields=["visiblity"],
    )
    assert detail.get("fields") == ["visiblity"]
    print("  PASSED: {\"visiblity\":\"private\"} -> 400 UNSUPPORTED_TREE_UPDATE_FIELDS fields=[visiblity]")


def test_mixed_valid_unknown_rejected_no_partial_mutation():
    tree_id = str(uuid.uuid4())
    get_db = MagicMock()
    fetch = MagicMock()
    entitlement = MagicMock()
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", get_db):
            with patch("modal_compute.tree_writes.fetch_owner_tree", fetch):
                with patch("modal_compute.tree_writes.require_plus_for_private_storage", entitlement):
                    try:
                        update_owner_tree("owner-1", tree_id, {"title": "Changed", "visiblity": "private"})
                    except HTTPException as exc:
                        assert exc.status_code == 400
                        assert exc.detail.get("code") == "UNSUPPORTED_TREE_UPDATE_FIELDS"
                    else:
                        raise AssertionError("mixed valid+unknown must be rejected")

    # Entire request rejected: get_db_connection never opened, no title write.
    assert get_db.call_count == 0, "mixed payload must not open DB (no partial write)"
    assert fetch.call_count == 0
    assert entitlement.call_count == 0
    print("  PASSED: mixed title+typo -> 400, no partial title mutation, 0 commit")


def test_multiple_unknown_deterministic_sort():
    detail = _expect_400(
        {"zzz": 1, "aaa": 2},
        code="UNSUPPORTED_TREE_UPDATE_FIELDS",
        fields=["aaa", "zzz"],
    )
    assert detail.get("fields") == ["aaa", "zzz"], "unknown fields must be sorted"
    print("  PASSED: multiple unknown -> sorted deterministic fields [aaa, zzz]")


def test_appreciation_order_generic_rejection():
    detail = _expect_400(
        {"appreciationOrder": []},
        code="UNSUPPORTED_TREE_UPDATE_FIELDS",
        fields=["appreciationOrder"],
    )
    assert detail.get("fields") == ["appreciationOrder"]
    print("  PASSED: {\"appreciationOrder\":[]} -> 400 via generic Tree updater (no false success)")


def test_private_visibility_with_unknown_rejected_before_entitlement():
    tree_id = str(uuid.uuid4())
    get_db = MagicMock()
    fetch = MagicMock()
    entitlement = MagicMock()
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", get_db):
            with patch("modal_compute.tree_writes.fetch_owner_tree", fetch):
                with patch("modal_compute.tree_writes.require_plus_for_private_storage", entitlement):
                    try:
                        update_owner_tree("owner-1", tree_id, {"visibility": "private", "bogus": 1})
                    except HTTPException as exc:
                        assert exc.status_code == 400
                        assert exc.detail.get("code") == "UNSUPPORTED_TREE_UPDATE_FIELDS"
                    else:
                        raise AssertionError("private+unknown must be rejected")

    # Unknown-field gate fires before the visibility entitlement check.
    assert entitlement.call_count == 0, "entitlement must not run for unknown payload"
    assert get_db.call_count == 0
    print("  PASSED: private+unknown -> unsupported-field 400 before require_plus_for_private_storage")


# ============================================================================
# Valid field regressions (must still persist)
# ============================================================================

def _run_valid(payload):
    tree_id = str(uuid.uuid4())
    mock_conn, mock_cursor = _new_conn(tree_id)
    returned_tree = {"id": tree_id, "title": "t", "visibility": "public", "groupName": None, "keywords": []}
    entitlement = MagicMock()
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value=returned_tree):
                with patch("modal_compute.tree_writes.require_plus_for_private_storage", entitlement):
                    result = update_owner_tree("owner-1", tree_id, payload)
    return result, mock_cursor, mock_conn, entitlement


def _assert_update_written(mock_cursor, mock_conn):
    written = [
        c.args[0] for c in mock_cursor.execute.call_args_list
        if "UPDATE trees" in c.args[0]
    ]
    assert written, "update must produce an UPDATE trees statement"
    assert mock_conn.commit.call_count == 1, "valid update must commit"


def test_valid_title_update_works():
    result, mock_cursor, mock_conn, _ = _run_valid({"title": "New Title"})
    assert result is not None
    _assert_update_written(mock_cursor, mock_conn)
    print("  PASSED: valid title -> persisted UPDATE + commit")


def test_valid_group_name_update_works():
    result, mock_cursor, mock_conn, _ = _run_valid({"groupName": "My Group"})
    assert result is not None
    _assert_update_written(mock_cursor, mock_conn)
    print("  PASSED: valid groupName -> persisted UPDATE + commit")


def test_valid_keywords_update_works():
    result, mock_cursor, mock_conn, _ = _run_valid({"keywords": ["a", "b"]})
    assert result is not None
    _assert_update_written(mock_cursor, mock_conn)
    print("  PASSED: valid keywords -> persisted UPDATE + commit")


def test_valid_visibility_update_preserves_entitlement():
    result, mock_cursor, mock_conn, entitlement = _run_valid({"visibility": "private"})
    assert result is not None
    assert entitlement.call_count == 1, "private visibility must trigger entitlement check"
    _assert_update_written(mock_cursor, mock_conn)
    print("  PASSED: valid private visibility -> entitlement called + persisted UPDATE")


def test_owner_authorization_still_enforced():
    tree_id = str(uuid.uuid4())
    mock_conn, mock_cursor = _new_conn(tree_id)
    with patch("modal_compute.tree_writes.require_tree_owner", side_effect=HTTPException(status_code=404, detail="Tree not found")):
        with patch("modal_compute.tree_writes.get_db_connection", mock_conn):
            try:
                update_owner_tree("owner-1", tree_id, {"title": "x"})
            except HTTPException as exc:
                assert exc.status_code == 404
            else:
                raise AssertionError("non-owner/foreign tree must be rejected before validation")

    # Ownership rejection precedes the allowlist gate and any DB mutation.
    assert mock_conn.cursor.call_count == 0, "no DB cursor when owner check fails"
    assert mock_conn.commit.call_count == 0
    print("  PASSED: require_tree_owner rejection stays authoritative (404, 0 DB mutation)")


if __name__ == "__main__":
    test_allowlist_exact_fields()
    test_empty_payload_rejected_no_mutation()
    test_unknown_only_rejected_no_mutation()
    test_mixed_valid_unknown_rejected_no_partial_mutation()
    test_multiple_unknown_deterministic_sort()
    test_appreciation_order_generic_rejection()
    test_private_visibility_with_unknown_rejected_before_entitlement()
    test_valid_title_update_works()
    test_valid_group_name_update_works()
    test_valid_keywords_update_works()
    test_valid_visibility_update_preserves_entitlement()
    test_owner_authorization_still_enforced()
    print("\nALL 3938 EXECUTABLE CHECKS PASSED")
