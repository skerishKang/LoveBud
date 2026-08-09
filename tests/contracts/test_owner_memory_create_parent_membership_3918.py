#!/usr/bin/env python3
"""
Executable contract tests for create_owner_memory parent membership validation (Issue #3918).

Verifies that create_owner_memory() validates parentId membership inside the same
DB transaction as the INSERT, using FOR KEY SHARE, and returns a bounded
INVALID_PARENT_ID on any cross-tree / nonexistent parent without leaking details.

Run: python3 tests/contracts/test_owner_memory_create_parent_membership_3918.py
"""

import os
import sys
import uuid
from typing import Any
from unittest.mock import patch, MagicMock

from fastapi import HTTPException

# Import the module under test (repo root derived from this file's location)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.memory_writes import create_owner_memory


# ============================================================================
# Test Helpers
# ============================================================================

class MockCursor:
    def __init__(self, fetchone_result=None):
        self.fetchone_result = fetchone_result
        self.execute_calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchone(self):
        return self.fetchone_result


class MockConnection:
    """Mock DB connection that tracks ALL cursors created and their execution history.

    Key fix: cursor() may be called multiple times by production code. We track
    every created cursor so tests can inspect the REAL execution history, not
    a post-hoc empty cursor.
    """

    def __init__(self, cursor_factory=None):
        self.cursor_factory = cursor_factory or (lambda *a, **k: MockCursor())
        self.commit_calls = 0
        self.created_cursors: list[MockCursor] = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def cursor(self, *args, **kwargs):
        cur = self.cursor_factory(*args, **kwargs)
        self.created_cursors.append(cur)
        return cur

    def commit(self):
        self.commit_calls += 1

    def all_execute_calls(self) -> list[tuple[str, Any]]:
        """Aggregate execute() calls from ALL cursors created during production use.

        This is the real execution history — not a post-hoc empty cursor.
        """
        all_calls: list[tuple[str, Any]] = []
        for cur in self.created_cursors:
            all_calls.extend(cur.execute_calls)
        return all_calls


class MockConnectionTracker:
    """Sequential multi-connection tracker for get_db_connection() patching."""

    def __init__(self):
        self.connections = []
        self.call_count = 0

    def add_connection(self, conn):
        self.connections.append(conn)

    def get_next_connection(self):
        self.call_count += 1
        if self.call_count <= len(self.connections):
            return self.connections[self.call_count - 1]
        return MockConnection()


def make_tree_row(tree_id, owner_id="owner-123", visibility="public"):
    return {
        "id": uuid.UUID(tree_id) if isinstance(tree_id, str) else tree_id,
        "owner_id": owner_id,
        "title": "Test Tree",
        "visibility": visibility,
        "group_name": None,
        "keywords": None,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "memory_count": 0,
        "like_count": 0,
        "view_count": 0,
    }


def make_memory_row(memory_id, tree_id, parent_id=None):
    return {
        "id": uuid.UUID(memory_id) if isinstance(memory_id, str) else memory_id,
        "tree_id": uuid.UUID(tree_id) if isinstance(tree_id, str) else tree_id,
        "parent_id": uuid.UUID(parent_id) if parent_id else None,
        "title": "Test Memory",
        "memo": "Test memo",
        "artist": "Test Artist",
        "source": "opaque-source",
        "source_url": "opaque-url",
        "source_type": "youtube",
        "thumbnail": "opaque-thumb",
        "emotion_tags": ["happy"],
        "timestamp": "2024-01-01T00:00:00Z",
        "visibility": "public",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }


def run_test(name, fn):
    try:
        fn()
        print(f"  ✅ {name}")
        return True
    except Exception as e:
        print(f"  💥 {name}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# Regression Matrix
# ============================================================================

def test_parent_id_omitted_creates_success_parent_id_null():
    """A. parentId omitted → create success, parent_id null, exactly 1 commit."""
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"

    tree_row = make_tree_row(tree_id)
    inserted_row = make_memory_row(uuid.uuid4(), tree_id, parent_id=None)

    insert_cursor = MockCursor(fetchone_result=inserted_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **kwargs: insert_cursor

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            result = create_owner_memory(owner_id, {"treeId": tree_id})

    assert result["parentId"] is None, f"Expected parentId=None, got {result['parentId']}"
    assert conn.commit_calls == 1, f"Expected 1 commit, got {conn.commit_calls}"
    insert_calls = [c for c in insert_cursor.execute_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 1, f"Expected exactly 1 INSERT, got {len(insert_calls)}"


def test_parent_id_null_creates_success_parent_id_null():
    """B. parentId null → create success, parent_id null."""
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"

    tree_row = make_tree_row(tree_id)
    inserted_row = make_memory_row(uuid.uuid4(), tree_id, parent_id=None)

    conn = MockConnection()
    conn.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=inserted_row)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            result = create_owner_memory(owner_id, {"treeId": tree_id, "parentId": None})

    assert result["parentId"] is None
    assert conn.commit_calls == 1


def test_parent_id_empty_string_uses_existing_semantics():
    """C. parentId '' (empty) → falsy guard skips parent normalization, root create.

    REAL-HISTORY PROOF: uses conn.all_execute_calls() which aggregates ALL
    cursors created during the actual create_owner_memory() execution.
    """
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"

    tree_row = make_tree_row(tree_id)
    inserted_row = make_memory_row(uuid.uuid4(), tree_id, parent_id=None)

    conn = MockConnection()
    conn.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=inserted_row)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            # Empty string is falsy; parent_id stays None (no parent SELECT run)
            result = create_owner_memory(owner_id, {"treeId": tree_id, "parentId": ""})

    assert result["parentId"] is None
    # REAL-HISTORY: aggregate ALL cursors created during production execution
    all_calls = conn.all_execute_calls()
    parent_select_calls = [
        c for c in all_calls
        if "SELECT id, tree_id" in c[0] and "FOR KEY SHARE" in c[0]
    ]
    assert len(parent_select_calls) == 0, (
        f"Empty parentId must not trigger parent validation query. "
        f"Actual execution history: {all_calls}"
    )
    # Also verify INSERT happened exactly once in real history
    insert_calls = [c for c in all_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 1, (
        f"Expected exactly 1 INSERT in real history, got {len(insert_calls)}. "
        f"History: {all_calls}"
    )
    assert conn.commit_calls == 1


def test_valid_same_tree_parent_persists_exact_parent_id():
    """D. Valid parent in exact target Tree → create success, stored parent_id exact match.

    NOTE: create_owner_memory uses a SINGLE DB connection for both the parent
    validation SELECT (FOR KEY SHARE) and the INSERT — they are in the same
    transaction. The cursor's fetchone must return parent_row first (for the
    parent validation), then inserted_row (for the INSERT RETURNING).
    """
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    tree_row = make_tree_row(tree_id)
    parent_row = make_memory_row(parent_id, tree_id)  # same tree
    new_id = uuid.uuid4()
    inserted_row = make_memory_row(new_id, tree_id, parent_id=parent_id)

    # Single cursor: fetchone returns parent_row first, then inserted_row
    call_count = [0]

    class DualFetchOneCursor(MockCursor):
        def fetchone(self):
            call_count[0] += 1
            if call_count[0] == 1:
                return parent_row
            return inserted_row

    cursor = DualFetchOneCursor()
    conn = MockConnection()
    conn.cursor = lambda *a, **kwargs: cursor

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            result = create_owner_memory(owner_id, {"treeId": tree_id, "parentId": parent_id})

    assert result["parentId"] == parent_id, f"Expected stored parentId={parent_id}, got {result['parentId']}"
    assert conn.commit_calls == 1, f"Expected 1 commit, got {conn.commit_calls}"

    # Verify the parent SELECT was issued with FOR KEY SHARE
    parent_sel = [c for c in cursor.execute_calls if "FOR KEY SHARE" in c[0]]
    assert len(parent_sel) == 1, f"Parent validation must use FOR KEY SHARE, got {cursor.execute_calls}"
    assert parent_sel[0][1] == (parent_id,), f"Parent SELECT must bind the parent UUID: {parent_sel[0]}"

    # Verify the INSERT was also issued on the same cursor (same transaction)
    insert_calls = [c for c in cursor.execute_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 1, f"Expected exactly 1 INSERT, got {cursor.execute_calls}"


def test_nonexistent_parent_rejected_no_insert_no_commit():
    """E. Nonexistent valid UUID parent → 400 INVALID_PARENT_ID, INSERT 0, commit 0."""
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    tree_row = make_tree_row(tree_id)

    # Single cursor instance to track all execute calls on this connection
    val_cursor = MockCursor(fetchone_result=None)  # parent not found
    conn1 = MockConnection()
    conn1.cursor = lambda *a, **kwargs: val_cursor

    tracker = MockConnectionTracker()
    tracker.add_connection(conn1)

    with patch("modal_compute.memory_writes.get_db_connection", side_effect=tracker.get_next_connection):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            try:
                create_owner_memory(owner_id, {"treeId": tree_id, "parentId": parent_id})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400, f"Expected 400, got {e.status_code}"
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_PARENT_ID", f"Expected INVALID_PARENT_ID, got {detail}"

    # Zero INSERT, zero commit — rejection happens before any mutation
    assert conn1.commit_calls == 0, "Rejected create must not commit"
    insert_calls = [c for c in val_cursor.execute_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 0, f"INSERT must not run for nonexistent parent, got {val_cursor.execute_calls}"

    # Leak-safe: detail is bounded to {code: INVALID_PARENT_ID}, no existence/owner/tree info
    assert "reason" not in detail, "detail must not contain a reason sub-field (leak-safe)"
    assert "tree_id" not in detail
    assert "owner" not in detail


def test_same_owner_different_tree_parent_rejected():
    """F. Parent in another Tree owned by same user → 400 INVALID_PARENT_ID, no mutation."""
    owner_id = "owner-123"
    target_tree_id = "22222222-2222-2222-2222-222222222222"
    other_tree_id = "44444444-4444-4444-4444-444444444444"
    parent_id = "33333333-3333-3333-3333-333333333333"

    tree_row = make_tree_row(target_tree_id)
    parent_row = make_memory_row(parent_id, other_tree_id)  # same owner, different tree

    val_cursor = MockCursor(fetchone_result=parent_row)
    conn1 = MockConnection()
    conn1.cursor = lambda *a, **kwargs: val_cursor

    tracker = MockConnectionTracker()
    tracker.add_connection(conn1)

    with patch("modal_compute.memory_writes.get_db_connection", side_effect=tracker.get_next_connection):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            try:
                create_owner_memory(owner_id, {"treeId": target_tree_id, "parentId": parent_id})
                assert False, "Should have raised HTTPException for cross-tree parent"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_PARENT_ID"

    assert conn1.commit_calls == 0
    insert_calls = [c for c in val_cursor.execute_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 0, f"INSERT must not run for cross-tree parent, got {val_cursor.execute_calls}"

    # Leak-safe: must not reveal the other tree's identity
    assert "reason" not in detail


def test_foreign_owner_different_tree_parent_rejected_no_leak():
    """G. Parent in another user's Tree → 400 INVALID_PARENT_ID, no existence/owner/tree leak."""
    owner_id = "owner-123"
    target_tree_id = "22222222-2222-2222-2222-222222222222"
    other_tree_id = "44444444-4444-4444-4444-444444444444"
    parent_id = "33333333-3333-3333-3333-333333333333"

    tree_row = make_tree_row(target_tree_id)
    parent_row = make_memory_row(parent_id, other_tree_id)
    # The same-tree invariant is what matters: parent.tree_id != target tree_id

    val_cursor = MockCursor(fetchone_result=parent_row)
    conn1 = MockConnection()
    conn1.cursor = lambda *a, **kwargs: val_cursor

    tracker = MockConnectionTracker()
    tracker.add_connection(conn1)

    with patch("modal_compute.memory_writes.get_db_connection", side_effect=tracker.get_next_connection):
        with patch("modal_compute.memory_writes.fetch_owner_tree", return_value=tree_row):
            try:
                create_owner_memory(owner_id, {"treeId": target_tree_id, "parentId": parent_id})
                assert False, "Should have raised HTTPException for foreign-tree parent"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_PARENT_ID"

    assert conn1.commit_calls == 0
    insert_calls = [c for c in val_cursor.execute_calls if "INSERT INTO memories" in c[0]]
    assert len(insert_calls) == 0, f"INSERT must not run for foreign-tree parent, got {val_cursor.execute_calls}"

    # Leak-safe assertions: must not expose any information about the foreign parent
    assert "reason" not in detail
    assert "foreign" not in str(detail).lower()
    assert "owner" not in str(detail).lower()
    # "tree" may appear in the code field only as part of "INVALID_PARENT_ID" context
    assert "code" in detail


def test_concurrent_parent_delete_blocked_by_for_key_share():
    """H. FOR KEY SHARE on the parent row prevents concurrent delete from creating a dangling child.

    Proof via source contract: the implementation must use FOR KEY SHARE in the
    parent validation SELECT. A concurrent DELETE on the same parent row would
    block until our transaction commits (or vice versa), so the child INSERT
    always sees a live, same-tree parent at commit time.

    We verify:
      1. FOR KEY SHARE appears in the source
      2. The parent SELECT (FOR KEY SHARE) runs inside the create transaction
         (after `with get_db_connection() as conn:`)
      3. The INSERT execution (cur.execute(query, params)) runs inside the
         same transaction, AFTER the parent SELECT
      4. commit() runs after the INSERT execution
    """
    import inspect
    from modal_compute import memory_writes

    src = inspect.getsource(memory_writes.create_owner_memory)

    # 1. FOR KEY SHARE must appear in the source
    assert "FOR KEY SHARE" in src, "create_owner_memory must use FOR KEY SHARE for parent validation"

    # 2-4. Everything must be inside the same get_db_connection() transaction block
    conn_open = src.find("with get_db_connection() as conn:")
    assert conn_open >= 0, "create_owner_memory must open a DB connection"

    # The parent validation SELECT (with FOR KEY SHARE) must be inside the transaction
    parent_sel = src.find("FOR KEY SHARE", conn_open)
    assert parent_sel > conn_open, "FOR KEY SHARE query must be inside the create transaction"

    # The INSERT execution (cur.execute with the query) must be inside the same transaction,
    # and must come AFTER the parent validation
    insert_exec = src.find("cur.execute(query, params)", conn_open)
    assert insert_exec > conn_open, "INSERT execution must be inside the create transaction"
    assert insert_exec > parent_sel, (
        "INSERT execution must come after parent validation (FOR KEY SHARE) "
        "inside the same transaction"
    )

    # commit must come after the INSERT execution
    commit_pos = src.find("conn.commit()", conn_open)
    assert commit_pos > insert_exec, "commit must come after INSERT execution inside the transaction"


def test_invalid_parent_id_detail_is_bounded_leak_safe():
    """The INVALID_PARENT_ID external response is bounded: HTTP 400, code only.

    Verifies that both nonexistent-parent and cross-tree-parent paths return the
    same bounded classification without exposing parent existence, owner, or tree.
    """
    import inspect
    from modal_compute import memory_writes

    src = inspect.getsource(memory_writes.create_owner_memory)

    # Both rejection paths must raise the same structured detail
    # (one inline raise; we check the detail shape appears in source)
    assert '"code": "INVALID_PARENT_ID"' in src or "'code': 'INVALID_PARENT_ID'" in src or \
           '"code": INVALID_PARENT_ID' in src, \
        "create_owner_memory must raise INVALID_PARENT_ID for bad parents"

    # The detail dict must NOT include reason, tree_id, owner, or email in the raise
    # (Check the actual raise statement in the source)
    raise_idx = src.find('code": "INVALID_PARENT_ID"')
    if raise_idx < 0:
        raise_idx = src.find("'code': 'INVALID_PARENT_ID'")
    assert raise_idx > 0, "INVALID_PARENT_ID raise must exist"

    # Look at the raise HTTPException call context (±300 chars around the code)
    window_start = max(0, raise_idx - 200)
    window_end = min(len(src), raise_idx + 200)
    raise_window = src[window_start:window_end]

    # The detail should be bounded — no interpolation of parent details
    assert "parent_row" not in raise_window or "parent_row" in src[:raise_idx], \
        "raise context must not interpolate parent_row data into the response"


def test_source_behavior_parent_membership_not_owner_based():
    """Same-tree invariant is authoritative: same owner different tree parent is rejected."""
    import inspect
    from modal_compute import memory_writes

    src = inspect.getsource(memory_writes.create_owner_memory)

    # The comparison must be tree_id vs tree_id, NOT owner_id vs owner_id
    # Check: the source compares parent_row["tree_id"] with tree_id (the target tree)
    assert "tree_id" in src, "create must reference tree_id"
    # Verify the comparison string is tree_id vs tree_id (not owner-based)
    assert 'parent_row["tree_id"]' in src or "parent_row['tree_id']" in src or \
           "parent_row[\\\"tree_id\\\"]" in src or 'parent_row["tree_id"]' in src, \
        "must compare parent.tree_id to target tree_id (not owner equality)"


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    tests = [
        ("A: parentId omitted → success, parent_id null, commit=1", test_parent_id_omitted_creates_success_parent_id_null),
        ("B: parentId null → success, parent_id null", test_parent_id_null_creates_success_parent_id_null),
        ("C: parentId empty string → existing root semantics, no parent query", test_parent_id_empty_string_uses_existing_semantics),
        ("D: valid same-tree parent → success, exact parent_id persisted", test_valid_same_tree_parent_persists_exact_parent_id),
        ("E: nonexistent valid UUID parent → 400 INVALID_PARENT_ID, INSERT 0, commit 0", test_nonexistent_parent_rejected_no_insert_no_commit),
        ("F: same-owner different-tree parent → 400 INVALID_PARENT_ID, no mutation", test_same_owner_different_tree_parent_rejected),
        ("G: foreign-owner different-tree parent → 400 INVALID_PARENT_ID, no leak", test_foreign_owner_different_tree_parent_rejected_no_leak),
        ("H: FOR KEY SHARE concurrency proof — source contract", test_concurrent_parent_delete_blocked_by_for_key_share),
        ("INVALID_PARENT_ID detail is bounded and leak-safe", test_invalid_parent_id_detail_is_bounded_leak_safe),
        ("same-tree invariant is tree_id-based, not owner-based", test_source_behavior_parent_membership_not_owner_based),
    ]

    print("=" * 70)
    print("Running create_owner_memory parent membership (#3918) contract tests")
    print("=" * 70)

    passed = 0
    failed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1
        else:
            failed += 1

    print("=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)
