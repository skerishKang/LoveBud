#!/usr/bin/env python3
"""
Executable contract tests for #3935: reject malformed Tree scalar types
(title / groupName) on create + update instead of silently clearing or
defaulting fields.

Unlike the Memory strict path (#3287), this keeps the Tree API error taxonomy
separate (INVALID_TREE_SCALAR_TYPE) and only hardens the Tree write scalars.

Run: python3 tests/contracts/test_tree_scalar_type_validation_3935.py
"""

import os
import sys
import uuid
from unittest.mock import patch
from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.validation import (
    validate_tree_title,
    validate_tree_group_name,
)
from modal_compute.tree_writes import create_owner_tree, update_owner_tree


# ============================================================================
# Lightweight DB mocks (proper context-manager + fetchone support)
# ============================================================================

class MockCursor:
    def __init__(self, fetchone_result=None):
        self.fetchone_result = fetchone_result
        self.execute_calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchone(self):
        return self.fetchone_result


class MockConnection:
    def __init__(self, cursor=None):
        self._cursor = cursor or MockCursor()
        self.commit_calls = 0
        self.rollback_calls = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commit_calls += 1

    def rollback(self):
        self.rollback_calls += 1


# ============================================================================
# Strict validator matrix (unit level)
# ============================================================================

def test_tree_title_rejects_non_string_types():
    for bad in [1, 0, -5, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        try:
            validate_tree_title(bad)
        except HTTPException as exc:
            assert exc.status_code == 400, f"{bad!r} should be HTTP 400, got {exc.status_code}"
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE", f"got {exc.detail}"
            assert detail.get("field") == "title"
            assert detail.get("expected") == "string"
        else:
            raise AssertionError(f"non-string title {bad!r} must raise HTTP 400")
    print("  ok: title rejects number/bool/array/object -> INVALID_TREE_SCALAR_TYPE")


def test_tree_title_accepts_none_and_strings():
    # explicit null / omitted -> "" (create default / explicit-null contract)
    assert validate_tree_title(None) == ""
    assert validate_tree_title("") == ""
    assert validate_tree_title("  hello  ") == "hello"
    assert validate_tree_title("My Tree") == "My Tree"
    print("  ok: title accepts None/empty/valid strings with trim")


def test_tree_title_overlength_rejected():
    try:
        validate_tree_title("x" * 201, max_length=200)
        assert False, "overlength title must raise"
    except HTTPException as exc:
        assert exc.status_code == 400
    print("  ok: title over 200 chars -> 400")


def test_tree_group_name_rejects_non_string_types():
    for bad in [1, 0, -5, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        try:
            validate_tree_group_name(bad)
        except HTTPException as exc:
            assert exc.status_code == 400, f"{bad!r} should be HTTP 400, got {exc.status_code}"
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE", f"got {exc.detail}"
            assert detail.get("field") == "groupName"
            assert detail.get("expected") == "string"
        else:
            raise AssertionError(f"non-string groupName {bad!r} must raise HTTP 400")
    print("  ok: groupName rejects number/bool/array/object -> INVALID_TREE_SCALAR_TYPE")


def test_tree_group_name_accepts_none_and_strings():
    assert validate_tree_group_name(None) is None
    assert validate_tree_group_name("") is None
    assert validate_tree_group_name("  ") is None
    assert validate_tree_group_name("  my group  ") == "my group"
    assert validate_tree_group_name("x" * 80) == "x" * 80
    print("  ok: groupName accepts None/empty/valid strings with trim/empty->None")


def test_tree_group_name_overlength_rejected():
    try:
        validate_tree_group_name("x" * 81)
        assert False, "overlength groupName must raise"
    except HTTPException as exc:
        assert exc.status_code == 400
    print("  ok: groupName over 80 chars -> 400")


# ============================================================================
# UPDATE: malformed scalars rejected before DB mutation (no-mutation proof)
# ============================================================================

def _assert_no_mutation(mock_cursor, mock_conn):
    written = [q for q, _ in mock_cursor.execute_calls]
    assert not any("UPDATE trees" in q for q in written), (
        f"no UPDATE trees may run for rejected payload, got {written}"
    )
    assert mock_conn.commit_calls == 0, "no commit may happen for rejected payload"


def _run_update(tree_id, payload):
    mock_cursor = MockCursor()
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            try:
                update_owner_tree("owner-1", tree_id, payload)
            except HTTPException as exc:
                return exc, mock_cursor, mock_conn
            raise AssertionError("expected HTTPException for malformed update")
    return None, mock_cursor, mock_conn


def test_update_title_non_string_rejected_no_mutation():
    for bad in [1, 0, -9, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        exc, cur, conn = _run_update(str(uuid.uuid4()), {"title": bad})
        assert exc.status_code == 400, f"{bad!r} expected 400, got {exc.status_code}"
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE"
        assert detail.get("field") == "title"
        _assert_no_mutation(cur, conn)
    print("  PASSED: update title malformed -> 400, zero UPDATE trees, zero commit")


def test_update_group_name_non_string_rejected_no_mutation():
    for bad in [1, 0, -9, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        exc, cur, conn = _run_update(str(uuid.uuid4()), {"groupName": bad})
        assert exc.status_code == 400, f"{bad!r} expected 400, got {exc.status_code}"
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE"
        assert detail.get("field") == "groupName"
        _assert_no_mutation(cur, conn)
    print("  PASSED: update groupName malformed -> 400, zero UPDATE trees, zero commit")


def test_update_existing_title_preserved_after_malformed_group_name():
    """A rejected malformed groupName must not touch the stored title either."""
    tree_id = str(uuid.uuid4())
    exc, cur, conn = _run_update(tree_id, {"groupName": 123})
    assert exc.status_code == 400
    _assert_no_mutation(cur, conn)
    print("  PASSED: malformed groupName update leaves stored data untouched (no UPDATE)")


# ============================================================================
# CREATE: malformed scalars rejected before INSERT (no-mutation proof)
# ============================================================================

def _create_owner_row(owner_id, title, group_name="g", visibility="public"):
    return {
        "id": str(uuid.uuid4()),
        "owner_id": owner_id,
        "title": title,
        "visibility": visibility,
        "group_name": group_name,
        "keywords": [],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }


def _assert_no_insert(mock_cursor, mock_conn):
    written = [q for q, _ in mock_cursor.execute_calls]
    assert not any("INSERT INTO trees" in q for q in written), (
        f"no INSERT INTO trees may run for rejected payload, got {written}"
    )
    assert mock_conn.commit_calls == 0, "no commit may happen for rejected create"


def _run_create(payload, owner_id="owner-1", returning=None):
    mock_cursor = MockCursor(fetchone_result=returning)
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.ensure_owner_user_exists", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            try:
                return create_owner_tree(owner_id, payload), mock_cursor, mock_conn
            except HTTPException as exc:
                return exc, mock_cursor, mock_conn
    return None, mock_cursor, mock_conn


def test_create_title_non_string_rejected_before_insert():
    for bad in [1, 0, -9, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        result, cur, conn = _run_create({"title": bad})
        assert isinstance(result, HTTPException), f"{bad!r} expected HTTPException"
        assert result.status_code == 400, f"{bad!r} expected 400, got {result.status_code}"
        detail = result.detail if isinstance(result.detail, dict) else {}
        assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE"
        assert detail.get("field") == "title"
        _assert_no_insert(cur, conn)
    print("  PASSED: create title malformed -> 400, zero INSERT INTO trees, zero commit")


def test_create_group_name_non_string_rejected_before_insert():
    for bad in [1, 0, -9, 3.14, True, False, [], {}, ["a"], {"k": "v"}]:
        result, cur, conn = _run_create({"title": "My Tree", "groupName": bad})
        assert isinstance(result, HTTPException), f"{bad!r} expected HTTPException"
        assert result.status_code == 400, f"{bad!r} expected 400, got {result.status_code}"
        detail = result.detail if isinstance(result.detail, dict) else {}
        assert detail.get("code") == "INVALID_TREE_SCALAR_TYPE"
        assert detail.get("field") == "groupName"
        _assert_no_insert(cur, conn)
    print("  PASSED: create groupName malformed -> 400, zero INSERT INTO trees, zero commit")


# ============================================================================
# Explicit null semantics (decided + tested separately from malformed)
# ============================================================================

def test_update_explicit_null_title_accepted_and_persisted_empty():
    tree_id = str(uuid.uuid4())
    mock_cursor = MockCursor(fetchone_result={"id": tree_id})
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "title": ""}):
                # explicit null title must NOT raise; it follows current contract ("").
                update_owner_tree("owner-1", tree_id, {"title": None})
    written = [q for q, _ in mock_cursor.execute_calls]
    assert any("UPDATE trees" in q for q in written), "explicit null title must run UPDATE"
    # param[0] is title; explicit null -> "" (not rejected, not malformed).
    params = [p for _, p in mock_cursor.execute_calls if p][0]
    assert params[0] == "", f"explicit null title must persist empty string, got {params[0]!r}"
    assert mock_conn.commit_calls == 1
    print("  PASSED: update title:null accepted (distinct from malformed), persists ''")


def test_update_explicit_null_group_name_accepted_and_cleared():
    tree_id = str(uuid.uuid4())
    mock_cursor = MockCursor(fetchone_result={"id": tree_id})
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "groupName": None}):
                update_owner_tree("owner-1", tree_id, {"groupName": None})
    written = [q for q, _ in mock_cursor.execute_calls]
    assert any("UPDATE trees" in q for q in written), "explicit null groupName must run UPDATE"
    params = [p for _, p in mock_cursor.execute_calls if p][0]
    assert params[0] is None, f"explicit null groupName must persist None, got {params[0]!r}"
    print("  PASSED: update groupName:null accepted (distinct from malformed), clears to NULL")


def test_create_explicit_null_title_defaults_to_my_lovetree():
    owner_id = "owner-1"
    result, _, _ = _run_create(
        {"title": None},
        owner_id=owner_id,
        returning=_create_owner_row(owner_id, "My LoveTree", None),
    )
    assert result["title"] == "My LoveTree", f"explicit null title defaults, got {result['title']!r}"
    print("  PASSED: create title:null defaults to 'My LoveTree' (distinct from malformed)")


# ============================================================================
# Omitted field semantics preserved (no change)
# ============================================================================

def test_update_omitted_field_not_written():
    # Sending only groupName must not write the title column (and vice versa),
    # proving omitted fields preserve current no-change semantics.
    tree_id = str(uuid.uuid4())

    mock_cursor = MockCursor(fetchone_result={"id": tree_id})
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "groupName": "g"}):
                update_owner_tree("owner-1", tree_id, {"groupName": "g"})
    written = [q for q, _ in mock_cursor.execute_calls]
    assert any("group_name = %s" in q for q in written), "supplied groupName must be written"
    assert all("title = %s" not in q for q in written), "omitted title must not appear in UPDATE"

    mock_cursor2 = MockCursor(fetchone_result={"id": tree_id})
    mock_conn2 = MockConnection(mock_cursor2)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn2):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "title": "t"}):
                update_owner_tree("owner-1", tree_id, {"title": "t"})
    written2 = [q for q, _ in mock_cursor2.execute_calls]
    assert any("title = %s" in q for q in written2), "supplied title must be written"
    assert all("group_name = %s" not in q for q in written2), "omitted groupName must not appear in UPDATE"
    print("  PASSED: omitted title/groupName leave those columns untouched")


# ============================================================================
# Valid strings still persist (trim/bound) + overlength controls
# ============================================================================

def test_update_valid_title_persists_trimmed():
    tree_id = str(uuid.uuid4())
    mock_cursor = MockCursor(fetchone_result={"id": tree_id})
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "title": "Trim Me"}):
                update_owner_tree("owner-1", tree_id, {"title": "  Trim Me  "})
    params = [p for _, p in mock_cursor.execute_calls if p][0]
    assert params[0] == "Trim Me", f"valid title must be trimmed, got {params[0]!r}"
    assert mock_conn.commit_calls == 1
    print("  PASSED: valid title trimmed and persisted via UPDATE")


def test_update_valid_group_name_persists_trimmed():
    tree_id = str(uuid.uuid4())
    mock_cursor = MockCursor(fetchone_result={"id": tree_id})
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            with patch("modal_compute.tree_writes.fetch_owner_tree", return_value={"id": tree_id, "groupName": "my grp"}):
                update_owner_tree("owner-1", tree_id, {"groupName": "  my grp  "})
    params = [p for _, p in mock_cursor.execute_calls if p][0]
    assert params[0] == "my grp", f"valid groupName must be trimmed, got {params[0]!r}"
    print("  PASSED: valid groupName trimmed and persisted via UPDATE")


def test_update_title_overlength_rejected_no_mutation():
    tree_id = str(uuid.uuid4())
    mock_cursor = MockCursor()
    mock_conn = MockConnection(mock_cursor)
    with patch("modal_compute.tree_writes.require_tree_owner", return_value=None):
        with patch("modal_compute.tree_writes.get_db_connection", return_value=mock_conn):
            try:
                update_owner_tree("owner-1", tree_id, {"title": "x" * 201})
                assert False, "overlength title must raise"
            except HTTPException as exc:
                assert exc.status_code == 400
    _assert_no_mutation(mock_cursor, mock_conn)
    print("  PASSED: update title over 200 chars -> 400, no mutation")


def test_create_group_name_overlength_rejected_before_insert():
    owner_id = "owner-1"
    result, cur, conn = _run_create(
        {"title": "My Tree", "groupName": "x" * 81},
        owner_id=owner_id,
        returning=_create_owner_row(owner_id, "My Tree", None),
    )
    assert isinstance(result, HTTPException), "overlength groupName must raise"
    assert result.status_code == 400
    _assert_no_insert(cur, conn)
    print("  PASSED: create groupName over 80 chars -> 400, no INSERT")


def test_create_valid_title_group_name_persist():
    owner_id = "owner-1"
    result, cur, conn = _run_create(
        {"title": "  My Tree  ", "groupName": "  my grp  "},
        owner_id=owner_id,
        returning=_create_owner_row(owner_id, "My Tree", "my grp"),
    )
    assert result["title"] == "My Tree", f"create title trimmed, got {result['title']!r}"
    assert result["groupName"] == "my grp", f"create groupName trimmed, got {result['groupName']!r}"
    written = [q for q, _ in cur.execute_calls]
    assert any("INSERT INTO trees" in q for q in written), "valid create must INSERT"
    assert conn.commit_calls == 1
    print("  PASSED: valid create persists trimmed title/groupName via INSERT")


if __name__ == "__main__":
    test_tree_title_rejects_non_string_types()
    test_tree_title_accepts_none_and_strings()
    test_tree_title_overlength_rejected()
    test_tree_group_name_rejects_non_string_types()
    test_tree_group_name_accepts_none_and_strings()
    test_tree_group_name_overlength_rejected()
    test_update_title_non_string_rejected_no_mutation()
    test_update_group_name_non_string_rejected_no_mutation()
    test_update_existing_title_preserved_after_malformed_group_name()
    test_create_title_non_string_rejected_before_insert()
    test_create_group_name_non_string_rejected_before_insert()
    test_update_explicit_null_title_accepted_and_persisted_empty()
    test_update_explicit_null_group_name_accepted_and_cleared()
    test_create_explicit_null_title_defaults_to_my_lovetree()
    test_update_omitted_field_not_written()
    test_update_valid_title_persists_trimmed()
    test_update_valid_group_name_persists_trimmed()
    test_update_title_overlength_rejected_no_mutation()
    test_create_group_name_overlength_rejected_before_insert()
    test_create_valid_title_group_name_persist()
    print("\nALL 3935 EXECUTABLE CHECKS PASSED")
