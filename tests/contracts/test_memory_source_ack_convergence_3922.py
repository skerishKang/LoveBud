#!/usr/bin/env python3
"""
Executable regression tests for source acknowledgement convergence ordering (Issue #3922).

Verifies that update_owner_memory() enforces _enforce_source_ack_convergence()
BEFORE conn.commit(), so divergent writes are never made durable.

Run: python3 tests/contracts/test_memory_source_ack_convergence_3922.py
"""

import os
import sys
import uuid
from unittest.mock import patch, MagicMock

from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.memory_writes import update_owner_memory


class MockCursor:
    def __init__(self, fetchone_result=None, execute_calls=None):
        self.fetchone_result = fetchone_result
        self.execute_calls = execute_calls or []
        self.commit_calls = 0
        self.rollback_calls = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback_calls += 1
        return False

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchone(self):
        return self.fetchone_result

    def commit(self):
        self.commit_calls += 1


class MockConnection:
    def __init__(self, cursor_factory=None):
        self.cursor_factory = cursor_factory or (lambda: MockCursor())
        self.commit_calls = 0
        self.rollback_calls = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback_calls += 1
        return False

    def cursor(self, *args, **kwargs):
        return self.cursor_factory(*args, **kwargs)

    def commit(self):
        self.commit_calls += 1


def make_memory_row(
    memory_id=None,
    tree_id=None,
    owner_id="owner-123",
    source="youtube",
    source_url="https://youtube.com/watch?v=test",
    source_type="youtube",
    thumbnail="",
    **kwargs
):
    return {
        "id": memory_id or uuid.uuid4(),
        "tree_id": tree_id or uuid.uuid4(),
        "owner_id": owner_id,
        "source": source,
        "source_url": source_url,
        "source_type": source_type,
        "thumbnail": thumbnail,
        **kwargs,
    }


def run_test(name, fn):
    try:
        fn()
        print(f"  PASS: {name}")
        return True
    except Exception as e:
        print(f"  FAIL: {name}")
        print(f"    Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# Test 1: Divergent source update → 409 BEFORE commit, commit count = 0
# ============================================================================

def test_divergent_source_url_commits_nothing():
    """Divergent RETURNING row → HTTP 409 raised, commit count = 0.

    This is the core regression: the convergence check must run BEFORE
    conn.commit(), so a divergent write is rolled back, not made durable.
    """
    memory_id = str(uuid.uuid4())
    owner_id = "owner-123"
    tree_id = str(uuid.uuid4())

    # Simulated DB row: what was actually persisted (different from request)
    persisted_row = make_memory_row(
        memory_id=memory_id,
        tree_id=tree_id,
        source="youtube",
        source_url="https://youtube.com/watch?v=original",
        source_type="youtube",
        thumbnail="",
    )

    # Mock require_memory_owner to return the existing memory
    mock_memory = {
        "id": memory_id,
        "tree_id": tree_id,
        "owner_id": owner_id,
        "title": "Test",
        "memo": "",
        "artist": "",
        "source": "youtube",
        "source_url": "https://youtube.com/watch?v=original",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "visibility": "public",
        "timestamp": "",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01",
        "updated_at": "2024-01-01",
    }

    # The cursor that will execute the UPDATE and return the persisted row
    cursor = MockCursor(fetchone_result=persisted_row)

    conn = MockConnection(cursor_factory=lambda: cursor)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=mock_memory):
            try:
                update_owner_memory(
                    owner_id,
                    memory_id,
                    {
                        "sourceUrl": "https://youtube.com/watch?v=different",  # diverges from persisted
                    },
                )
                assert False, "Expected HTTPException 409 for divergent source"
            except HTTPException as e:
                assert e.status_code == 409, f"Expected 409, got {e.status_code}"
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "SOURCE_WRITE_ACK_DIVERGENCE"

    # CRITICAL: commit must NOT have been called — the transaction was rolled back
    assert conn.commit_calls == 0, f"Expected 0 commits for divergent write, got {conn.commit_calls}"
    assert cursor.commit_calls == 0, f"Expected 0 cursor commits, got {cursor.commit_calls}"


# ============================================================================
# Test 2: Successful source update → convergence passes, commit = 1
# ============================================================================

def test_convergent_source_url_commits_once():
    """Convergent source update → 409 not raised, commit count = 1.

    The convergence check passes because the requested and persisted values match,
    so conn.commit() is called exactly once.
    """
    memory_id = str(uuid.uuid4())
    owner_id = "owner-123"
    tree_id = str(uuid.uuid4())

    # The row returned by UPDATE — must match what we request
    persisted_row = make_memory_row(
        memory_id=memory_id,
        tree_id=tree_id,
        source="youtube",
        source_url="https://youtube.com/watch?v=matched",
        source_type="youtube",
        thumbnail="",
    )

    mock_memory = {
        "id": memory_id,
        "tree_id": tree_id,
        "owner_id": owner_id,
        "title": "Test",
        "memo": "",
        "artist": "",
        "source": "youtube",
        "source_url": "https://youtube.com/watch?v=original",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "visibility": "public",
        "timestamp": "",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01",
        "updated_at": "2024-01-01",
    }

    cursor = MockCursor(fetchone_result=persisted_row)
    conn = MockConnection(cursor_factory=lambda: cursor)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=mock_memory):
            result = update_owner_memory(
                owner_id,
                memory_id,
                {
                    "sourceUrl": "https://youtube.com/watch?v=matched",  # matches persisted
                },
            )

    assert conn.commit_calls == 1, f"Expected 1 commit for convergent write, got {conn.commit_calls}"


# ============================================================================
# Test 3: Non-source update (title only) → no convergence check, commit = 1
# ============================================================================

def test_non_source_update_commits_once():
    """Non-source field update (title) → no source ack check needed, commit = 1.

    Preserves existing semantics: when no source fields are in the payload,
    _enforce_source_ack_convergence is still called (no-op) and commit runs.
    """
    memory_id = str(uuid.uuid4())
    owner_id = "owner-123"
    tree_id = str(uuid.uuid4())

    persisted_row = make_memory_row(
        memory_id=memory_id,
        tree_id=tree_id,
        source="youtube",
        source_url="https://youtube.com/watch?v=test",
        source_type="youtube",
        thumbnail="",
        title="Updated Title",
    )

    mock_memory = {
        "id": memory_id,
        "tree_id": tree_id,
        "owner_id": owner_id,
        "title": "Original Title",
        "memo": "",
        "artist": "",
        "source": "youtube",
        "source_url": "https://youtube.com/watch?v=test",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "visibility": "public",
        "timestamp": "",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01",
        "updated_at": "2024-01-01",
    }

    cursor = MockCursor(fetchone_result=persisted_row)
    conn = MockConnection(cursor_factory=lambda: cursor)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=mock_memory):
            result = update_owner_memory(owner_id, memory_id, {"title": "Updated Title"})

    assert conn.commit_calls == 1, f"Expected 1 commit for non-source update, got {conn.commit_calls}"


# ============================================================================
# Test 4: Convergence check runs inside transaction (before commit)
# ============================================================================

def test_convergence_check_runs_inside_transaction():
    """Source: _enforce_source_ack_convergence must run before conn.commit().

    Proves the ordering: UPDATE → fetchone → convergence check → commit.
    """
    import inspect
    from modal_compute import memory_writes

    source = inspect.getsource(memory_writes.update_owner_memory)

    # Find the key positions
    update_exec = source.find("cur.execute(query")
    fetchone_call = source.find("row = cur.fetchone()", update_exec)
    convergence = source.find("_enforce_source_ack_convergence(payload, row)", fetchone_call)
    commit_call = source.find("conn.commit()", fetchone_call)

    assert update_exec >= 0, "UPDATE must execute"
    assert fetchone_call > update_exec, "fetchone must follow UPDATE"
    assert convergence > fetchone_call, (
        f"_enforce_source_ack_convergence must run AFTER fetchone and BEFORE commit. "
        f"convergence at {convergence}, commit at {commit_call}"
    )
    assert commit_call > convergence, (
        f"conn.commit() must run AFTER convergence check. "
        f"convergence at {convergence}, commit at {commit_call}"
    )


# ============================================================================
# Test 5: Rollback on divergence (connection context semantics)
# ============================================================================

def test_divergence_triggers_rollback_not_commit():
    """Divergent write: conn.commit() is NOT called; context manager handles rollback.

    The with-block context manager (__exit__ with exception) will trigger
    rollback. We verify that commit is never called and the exception propagates.
    """
    memory_id = str(uuid.uuid4())
    owner_id = "owner-123"
    tree_id = str(uuid.uuid4())

    persisted_row = make_memory_row(
        memory_id=memory_id,
        tree_id=tree_id,
        source_url="https://youtube.com/watch?v=stale",
        source_type="youtube",
    )

    mock_memory = {
        "id": memory_id,
        "tree_id": tree_id,
        "owner_id": owner_id,
        "title": "Test",
        "memo": "",
        "artist": "",
        "source": "youtube",
        "source_url": "https://youtube.com/watch?v=stale",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "visibility": "public",
        "timestamp": "",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01",
        "updated_at": "2024-01-01",
    }

    cursor = MockCursor(fetchone_result=persisted_row)
    conn = MockConnection(cursor_factory=lambda: cursor)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=mock_memory):
            try:
                update_owner_memory(
                    owner_id,
                    memory_id,
                    {"sourceUrl": "https://youtube.com/watch?v=different"},
                )
                assert False, "Expected 409"
            except HTTPException as e:
                assert e.status_code == 409

    # Both connection and cursor must have 0 commits
    assert conn.commit_calls == 0, f"Connection commit_calls={conn.commit_calls}"
    assert cursor.commit_calls == 0, f"Cursor commit_calls={cursor.commit_calls}"


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    tests = [
        (
            "divergent sourceUrl → 409, commit count = 0",
            test_divergent_source_url_commits_nothing,
        ),
        (
            "convergent sourceUrl → commit count = 1",
            test_convergent_source_url_commits_once,
        ),
        (
            "non-source update (title) → commit count = 1",
            test_non_source_update_commits_once,
        ),
        (
            "source: convergence check runs before commit (source ordering)",
            test_convergence_check_runs_inside_transaction,
        ),
        (
            "divergence → rollback semantics, commit = 0",
            test_divergence_triggers_rollback_not_commit,
        ),
    ]

    print("=" * 65)
    print("Memory source ack convergence ordering (#3922) tests")
    print("=" * 65)

    passed = 0
    failed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1
        else:
            failed += 1

    print("=" * 65)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 65)

    if failed > 0:
        sys.exit(1)
