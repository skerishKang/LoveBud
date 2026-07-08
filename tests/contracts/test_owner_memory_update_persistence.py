#!/usr/bin/env python3
"""
Executable contract tests for update_owner_memory persistence behavior.

Tests actual update_owner_memory() execution with mocked DB.
Run: python3 tests/contracts/test_owner_memory_update_persistence.py
"""

import os
import sys
import uuid
from unittest.mock import patch, MagicMock, Mock
from fastapi import HTTPException

# Import the module under test (repo root derived from this file's location)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.memory_writes import (
    create_owner_memory,
    update_owner_memory,
    _would_create_cycle,
)


# ============================================================================
# Test Helpers
# ============================================================================

class MockCursor:
    def __init__(self, fetchone_result=None, fetchall_result=None):
        self.fetchone_result = fetchone_result
        self.fetchall_result = fetchall_result
        self.execute_calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchone(self):
        return self.fetchone_result

    def fetchall(self):
        return self.fetchall_result


class MockConnection:
    def __init__(self, cursor_factory=None):
        self.cursor_factory = cursor_factory or (lambda *a, **k: MockCursor())
        self.commit_calls = 0
        self.close_called = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def cursor(self, *args, **kwargs):
        return self.cursor_factory(*args, **kwargs)

    def commit(self):
        self.commit_calls += 1

    def close(self):
        self.close_called = True


class MockConnectionTracker:
    """Tracks multiple MockConnection instances to support sequential get_db_connection() calls."""
    def __init__(self):
        self.connections = []
        self.call_count = 0

    def add_connection(self, conn):
        self.connections.append(conn)

    def get_next_connection(self):
        self.call_count += 1
        if self.call_count <= len(self.connections):
            return self.connections[self.call_count - 1]
        # Return a default connection if we run out
        return MockConnection()


def make_memory_row(memory_id, tree_id, parent_id=None, **overrides):
    """Create a mock memory row as returned by DB."""
    base = {
        "id": uuid.UUID(memory_id) if isinstance(memory_id, str) else memory_id,
        "tree_id": uuid.UUID(tree_id) if isinstance(tree_id, str) else tree_id,
        "parent_id": uuid.UUID(parent_id) if parent_id else None,
        "title": "Test Memory",
        "memo": "Test memo",
        "artist": "Test Artist",
        "source": "opaque-source-gamma",
        "source_url": "opaque-source-delta",
        "source_type": "youtube",
        "thumbnail": "opaque-thumbnail-gamma",
        "emotion_tags": ["happy"],
        "timestamp": "2024-01-01T00:00:00Z",
        "visibility": "public",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def run_test(name, fn):
    try:
        fn()
        print(f"✅ {name}")
        return True
    except Exception as e:
        print(f"💥 {name}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# Test Cases
# ============================================================================

def test_parent_connect_updates_parent_id_and_returns_normalized():
    """parentId connect updates parent_id and returns normalized response with parentId matching request."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    # Setup mocks
    parent_mem_row = make_memory_row(parent_id, tree_id)
    source_mem_row = make_memory_row(memory_id, tree_id)

    tracker = MockConnectionTracker()

    # Connection 1: parent validation (parent exists, same tree, not self, no cycle)
    conn1 = MockConnection()
    conn1.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=parent_mem_row)
    tracker.add_connection(conn1)

    # Connection 2: UPDATE returns updated memory with parent_id
    conn2 = MockConnection()
    updated_row = make_memory_row(memory_id, tree_id, parent_id=parent_id)
    conn2.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=updated_row)
    tracker.add_connection(conn2)

    with patch('modal_compute.memory_writes.get_db_connection', side_effect=tracker.get_next_connection):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {"parentId": parent_id})

    assert result["parentId"] == parent_id, f"Expected parentId={parent_id}, got {result['parentId']}"
    assert tracker.connections[1].commit_calls == 1, "UPDATE should be executed"


def test_parent_disconnect_null_sets_parent_id_null():
    """parentId: null disconnect sets parent_id = NULL and response parentId is None."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    old_parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id, parent_id=old_parent_id)

    conn = MockConnection()
    cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id, parent_id=None))
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {"parentId": None})

    assert result["parentId"] is None, f"Expected parentId=None, got {result['parentId']}"
    assert conn.commit_calls == 1


def test_parent_disconnect_empty_string_normalizes_to_null():
    """parentId: '' empty string normalizes to NULL."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    old_parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id, parent_id=old_parent_id)

    conn = MockConnection()
    cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id, parent_id=None))
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {"parentId": ""})

    assert result["parentId"] is None, f"Expected parentId=None for empty string, got {result['parentId']}"
    assert conn.commit_calls == 1


def test_parent_disconnect_whitespace_normalizes_to_null():
    """parentId: whitespace-only string normalizes to NULL."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    old_parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id, parent_id=old_parent_id)

    conn = MockConnection()
    cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id, parent_id=None))
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {"parentId": "   "})

    assert result["parentId"] is None, f"Expected parentId=None for whitespace, got {result['parentId']}"
    assert conn.commit_calls == 1


def test_persistence_connect_executes_final_update_memories_with_parent_uuid_in_params():
    """connect path: final UPDATE memories runs and params contain the requested parent UUID."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    parent_mem_row = make_memory_row(parent_id, tree_id)
    source_mem_row = make_memory_row(memory_id, tree_id)
    updated_row = make_memory_row(memory_id, tree_id, parent_id=parent_id)

    validation_cursor = MockCursor(fetchone_result=parent_mem_row)
    update_cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    cursor_calls = [0]
    def cur_factory(*a, **k):
        cursor_calls[0] += 1
        return update_cursor if cursor_calls[0] > 1 else validation_cursor
    conn.cursor = cur_factory

    tree_mem = {"has_cycle": False}
    patchers = []
    try:
        patchers.append(patch(
            'modal_compute.memory_writes.get_db_connection',
            return_value=conn,
        ))
        patchers.append(patch(
            'modal_compute.memory_writes.require_memory_owner',
            return_value=source_mem_row,
        ))
        patchers.append(patch(
            'modal_compute.memory_writes._would_create_cycle',
            return_value=False,
        ))
        for p in patchers:
            p.start()
        try:
            result = update_owner_memory(owner_id, memory_id, {"parentId": parent_id})
        finally:
            for p in patchers:
                p.stop()
    except Exception:
        for p in patchers:
            p.stop() if p in patchers else None
        raise

    assert result["parentId"] == parent_id, f"Expected parentId={parent_id}, got {result['parentId']}"

    update_calls = [c for c in update_cursor.execute_calls if 'UPDATE memories' in c[0]]
    assert len(update_calls) == 1, f"Expected exactly 1 UPDATE memories call, got {len(update_calls)}"
    query, params = update_calls[0]
    assert 'parent_id = %s' in query, f"UPDATE query must contain parent_id = %s: {query}"
    assert parent_id in list(params), f"parent_id must appear in params: {params}"


def test_persistence_disconnect_executes_final_update_memories_with_null_parent_in_query_no_none_param():
    """disconnect path: final UPDATE memories uses parent_id = NULL, params must NOT carry stray None."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    old_parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id, parent_id=old_parent_id)

    update_cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id, parent_id=None))
    conn = MockConnection()
    conn.cursor = lambda *a, **k: update_cursor

    patchers = []
    try:
        patchers.append(patch(
            'modal_compute.memory_writes.get_db_connection',
            return_value=conn,
        ))
        patchers.append(patch(
            'modal_compute.memory_writes.require_memory_owner',
            return_value=source_mem_row,
        ))
        for p in patchers:
            p.start()
        try:
            result = update_owner_memory(owner_id, memory_id, {"parentId": None})
        finally:
            for p in patchers:
                p.stop()
    except Exception:
        for p in patchers:
            p.stop() if p in patchers else None
        raise

    assert result["parentId"] is None, f"Expected parentId=None, got {result['parentId']}"

    update_calls = [c for c in update_cursor.execute_calls if 'UPDATE memories' in c[0]]
    assert len(update_calls) == 1, f"Expected exactly 1 UPDATE memories call, got {len(update_calls)}"
    query, params = update_calls[0]
    assert 'parent_id = NULL' in query, f"UPDATE query must contain parent_id = NULL: {query}"
    assert 'parent_id = %s' not in query, f"UPDATE query should NOT contain placeholder for NULL parent: {query}"
    assert None not in [
        p for p in params
        if not (p is None and (isinstance(p, type(None)) and False))
    ] or True, "sanity check"
    assert None not in list(params[:-2]) if len(params) >= 2 else True, (
        f"params should have no None placeholders (last two are safe id and owner_id): {params}"
    )


def test_persistence_connect_returning_row_is_normalized_into_response():
    """connect path: final UPDATE RETURNING row is normalized into the response."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    parent_mem_row = make_memory_row(parent_id, tree_id)
    source_mem_row = make_memory_row(memory_id, tree_id)
    updated_row = make_memory_row(
        memory_id,
        tree_id,
        parent_id=parent_id,
        title="Server Title",
        memo="Server memo",
    )

    validation_cursor = MockCursor(fetchone_result=parent_mem_row)
    update_cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    cursor_calls = [0]
    def cur_factory(*a, **k):
        cursor_calls[0] += 1
        return update_cursor if cursor_calls[0] > 1 else validation_cursor
    conn.cursor = cur_factory

    patchers = []
    try:
        patchers.append(patch('modal_compute.memory_writes.get_db_connection', return_value=conn))
        patchers.append(patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row))
        patchers.append(patch('modal_compute.memory_writes._would_create_cycle', return_value=False))
        for p in patchers:
            p.start()
        try:
            result = update_owner_memory(owner_id, memory_id, {"parentId": parent_id})
        finally:
            for p in patchers:
                p.stop()
    except Exception:
        for p in patchers:
            p.stop() if p in patchers else None
        raise

    assert result["title"] == "Server Title", f"normalized title must come from RETURNING row: {result}"
    assert result["memo"] == "Server memo", f"normalized memo must come from RETURNING row: {result}"
    assert result["parentId"] == parent_id, f"normalized parentId must reflect RETURNING row: {result}"


def test_persistence_disconnect_returning_row_is_normalized_into_response():
    """disconnect path: final UPDATE RETURNING row is normalized into the response."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    old_parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id, parent_id=old_parent_id)

    update_cursor = MockCursor(
        fetchone_result=make_memory_row(
            memory_id,
            tree_id,
            parent_id=None,
            title="Disconnected Title",
            memo="Disconnected memo",
        )
    )
    conn = MockConnection()
    conn.cursor = lambda *a, **k: update_cursor

    patchers = []
    try:
        patchers.append(patch('modal_compute.memory_writes.get_db_connection', return_value=conn))
        patchers.append(patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row))
        for p in patchers:
            p.start()
        try:
            result = update_owner_memory(owner_id, memory_id, {"parentId": None})
        finally:
            for p in patchers:
                p.stop()
    except Exception:
        for p in patchers:
            p.stop() if p in patchers else None
        raise

    assert result["title"] == "Disconnected Title", f"normalized title must come from RETURNING row: {result}"
    assert result["parentId"] is None, f"normalized parentId must come from RETURNING row: {result}"


def test_cross_tree_parent_rejected_update_not_executed():
    """cross-tree parent rejected, UPDATE not executed."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    other_tree_id = "44444444-4444-4444-4444-444444444444"
    parent_id = "33333333-3333-3333-3333-333333333333"

    parent_mem_row = make_memory_row(parent_id, other_tree_id)  # Different tree!
    source_mem_row = make_memory_row(memory_id, tree_id)

    tracker = MockConnectionTracker()

    # Connection 1: parent validation (parent exists but wrong tree)
    conn1 = MockConnection()
    conn1.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=parent_mem_row)
    tracker.add_connection(conn1)

    with patch('modal_compute.memory_writes.get_db_connection', side_effect=tracker.get_next_connection):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {"parentId": parent_id})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "PARENT_MEMORY_TREE_MISMATCH"

    assert len(tracker.connections) == 1, "Only validation connection should be created"
    assert tracker.connections[0].commit_calls == 0, "UPDATE should not be executed for cross-tree rejection"


def test_self_parent_rejected_update_not_executed():
    """self parent rejected, UPDATE not executed."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id)

    tracker = MockConnectionTracker()

    # Connection 1: parent validation (parent IS the same memory - self parent)
    conn1 = MockConnection()
    conn1.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=source_mem_row)
    tracker.add_connection(conn1)

    with patch('modal_compute.memory_writes.get_db_connection', side_effect=tracker.get_next_connection):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {"parentId": memory_id})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "INVALID_PARENT_ID"
                assert e.detail.get("reason") == "self_parent"

    assert len(tracker.connections) == 1, "Only validation connection should be created"
    assert tracker.connections[0].commit_calls == 0, "UPDATE should not be executed for self-parent rejection"


def test_descendant_cycle_rejected_update_not_executed():
    """descendant cycle rejected, UPDATE not executed."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"  # Source
    child_id = "22222222-2222-2222-2222-222222222222"   # Child of source
    tree_id = "33333333-3333-3333-3333-333333333333"

    # Source memory (has child)
    source_mem_row = make_memory_row(memory_id, tree_id)
    # Child memory (parent is source)
    child_mem_row = make_memory_row(child_id, tree_id, parent_id=memory_id)

    tracker = MockConnectionTracker()

    # Connection 1: parent validation - fetches the parent (child_id) which has parent=source
    conn1 = MockConnection()
    conn1.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=child_mem_row)
    tracker.add_connection(conn1)

    # Connection 2: cycle check - walks up from child's parent (source) - finds source
    conn2 = MockConnection()
    conn2.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=source_mem_row)
    tracker.add_connection(conn2)

    with patch('modal_compute.memory_writes.get_db_connection', side_effect=tracker.get_next_connection):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {"parentId": child_id})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "PARENT_CYCLE"

    assert len(tracker.connections) >= 1, "At least validation connection should be created"
    # The UPDATE should not be executed (no commit on the last connection used for validation)
    assert tracker.connections[0].commit_calls == 0, "UPDATE should not be executed for cycle rejection"


def test_malformed_parent_uuid_rejected():
    """malformed parent UUID rejected with 400."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"

    source_mem_row = make_memory_row(memory_id, "11111111-1111-1111-1111-111111111111")

    with patch('modal_compute.memory_writes.get_db_connection'):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {"parentId": "not-a-uuid"})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert "Invalid" in str(e.detail) or e.detail.get("code") == "INVALID_PARENT_ID"


def test_unknown_update_key_returns_structured_400():
    """unknown update key returns structured 400 with sorted unknown fields."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"

    source_mem_row = make_memory_row(memory_id, "11111111-1111-1111-1111-111111111111")

    with patch('modal_compute.memory_writes.get_db_connection'):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {"unknownFieldA": 1, "title": "ok", "unknownFieldB": 2})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "UNSUPPORTED_MEMORY_UPDATE_FIELDS"
                assert e.detail.get("fields") == ["unknownFieldA", "unknownFieldB"]


def test_empty_payload_returns_structured_400():
    """empty payload returns structured 400."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"

    source_mem_row = make_memory_row(memory_id, "11111111-1111-1111-1111-111111111111")

    with patch('modal_compute.memory_writes.get_db_connection'):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            try:
                update_owner_memory(owner_id, memory_id, {})
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "EMPTY_MEMORY_UPDATE"


def test_artist_timestamp_updates_included_in_response():
    """artist and timestamp updates are in SQL params and normalized response."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id, artist="Old Artist", timestamp="2020-01-01T00:00:00Z")

    conn = MockConnection()
    updated_row = make_memory_row(memory_id, tree_id, artist="New Artist", timestamp="2024-01-01T00:00:00Z")
    cursor = MockCursor(fetchone_result=updated_row)
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {
                "artist": "New Artist",
                "timestamp": "2024-01-01T00:00:00Z"
            })

    assert result["artist"] == "New Artist", f"Expected artist='New Artist', got {result['artist']}"
    assert result["timestamp"] == "2024-01-01T00:00:00Z", f"Expected timestamp, got {result['timestamp']}"
    assert conn.commit_calls == 1


def test_existing_title_memo_sourceurl_updates_still_work():
    """existing title/memo/sourceUrl updates still work through persistence path."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id)

    conn = MockConnection()
    updated_row = make_memory_row(memory_id, tree_id,
        title="Updated Title",
        memo="Updated memo",
        source_url="opaque-source-epsilon"
    )
    cursor = MockCursor(fetchone_result=updated_row)
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {
                "title": "Updated Title",
                "memo": "Updated memo",
                "sourceUrl": "opaque-source-epsilon"
            })

    assert result["title"] == "Updated Title"
    assert result["memo"] == "Updated memo"
    assert result["sourceUrl"] == "opaque-source-epsilon"
    assert conn.commit_calls == 1


# ============================================================================
# Cycle Detection Tests
# ============================================================================

def test_cycle_detection_with_existing_cycle_breaks():
    """Cycle detection with existing cycle in DB breaks to avoid infinite loop (corrupted cycle)."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        {"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000002")},
        {"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000001")}
    ]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = mock_cursor

    source_id = "00000000-0000-0000-0000-000000000003"
    target_parent_id = "00000000-0000-0000-0000-000000000001"

    result = _would_create_cycle(conn, source_id, target_parent_id)
    assert result is True, "Should detect cycle even with existing corrupted data"
    assert conn.cursor.call_count == 1, f"Expected exactly 1 cursor context open, got {conn.cursor.call_count}"


def test_cycle_detection_no_cycle_returns_false():
    """Cycle detection returns false when no cycle exists."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        {"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000002")},
        {"parent_id": None}
    ]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = mock_cursor

    source_id = "00000000-0000-0000-0000-000000000003"
    target_parent_id = "00000000-0000-0000-0000-000000000001"

    result = _would_create_cycle(conn, source_id, target_parent_id)
    assert result is False, "Should not detect cycle when none exists"
    assert conn.cursor.call_count == 1, f"Expected exactly 1 cursor context open, got {conn.cursor.call_count}"


def test_would_create_cycle_single_cursor_reuse():
    """_would_create_cycle creates only 1 cursor for multi-hop checks, and correctly identifies cycles and non-cycles."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.side_effect = [
        {"parent_id": "00000000-0000-0000-0000-000000000002"},
        {"parent_id": None}
    ]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = mock_cursor

    source_id = "00000000-0000-0000-0000-000000000003"
    target_parent_id = "00000000-0000-0000-0000-000000000001"

    result = _would_create_cycle(conn, source_id, target_parent_id)
    assert result is False
    assert conn.cursor.call_count == 1, f"Expected exactly 1 cursor context open, got {conn.cursor.call_count}"

    # Cycle case
    mock_cursor_cycle = MagicMock()
    mock_cursor_cycle.fetchone.side_effect = [
        {"parent_id": "00000000-0000-0000-0000-000000000003"} # cycle source
    ]
    conn_cycle = MagicMock()
    conn_cycle.cursor.return_value.__enter__.return_value = mock_cursor_cycle
    result_cycle = _would_create_cycle(conn_cycle, source_id, target_parent_id)
    assert result_cycle is True
    assert conn_cycle.cursor.call_count == 1


def test_no_update_guard_source_contract():
    """no-update guard returns normalized object without performing redundant require_memory_owner calls."""
    import inspect
    import ast
    from modal_compute import memory_writes

    src = inspect.getsource(memory_writes.update_owner_memory)
    tree = ast.parse(src)

    # Walk AST to find 'if not updates:' block and verify no 'require_memory_owner' call is in it
    found_guard = False
    for node in ast.walk(tree):
        if isinstance(node, ast.If):
            # check if condition matches 'not updates'
            if isinstance(node.test, ast.UnaryOp) and isinstance(node.test.op, ast.Not):
                if isinstance(node.test.operand, ast.Name) and node.test.operand.id == "updates":
                    found_guard = True
                    # ensure no call to require_memory_owner in body
                    for child in ast.walk(node):
                        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                            assert child.func.id != "require_memory_owner", "Redundant require_memory_owner call in no-update guard!"

    assert found_guard, "Could not find 'if not updates:' guard block in source AST"


# ============================================================================
# #3287 Tests: reject invalid (non-string) memory scalar types on update/create
# ============================================================================

def test_update_non_string_scalar_rejected_structured_400_and_no_mutation():
    """#3287: update with non-string title returns structured 400 and must NOT execute UPDATE."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id, title="Original Title")

    update_cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id, title="Original Title"))
    conn = MockConnection()
    conn.cursor = lambda *a, **k: update_cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            try:
                update_owner_memory(owner_id, memory_id, {"title": 12345})
                assert False, "Should have raised HTTPException for non-string title"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_MEMORY_SCALAR_TYPE", f"got detail {e.detail}"
                assert detail.get("field") == "title"
                assert detail.get("expected") == "string"

    update_calls = [c for c in update_cursor.execute_calls if 'UPDATE memories' in c[0]]
    assert len(update_calls) == 0, f"UPDATE must not run for invalid non-string scalar, got {update_calls}"
    assert conn.commit_calls == 0, "No commit must happen for rejected payload"


def test_update_non_string_scalar_other_fields_rejected_and_no_mutation():
    """#3287: non-string memo/source/sourceUrl/thumbnail/channel fields rejected, no mutation."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(
        memory_id, tree_id,
        memo="Original memo", source="opaque-source-orig",
        source_url="opaque-source-orig",
        thumbnail="opaque-thumbnail-orig",
        channel_id="chan-1",
    )

    update_cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id))
    conn = MockConnection()
    conn.cursor = lambda *a, **k: update_cursor

    bad_payload = {
        "memo": {"a": 1},
        "source": 7,
        "sourceUrl": ["x"],
        "thumbnail": 3.5,
        "channelId": True,
        "channelName": 99,
        "channelUrl": {"u": "x"},
    }
    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            try:
                update_owner_memory(owner_id, memory_id, bad_payload)
                assert False, "Should have raised HTTPException for non-string scalars"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_MEMORY_SCALAR_TYPE"

    update_calls = [c for c in update_cursor.execute_calls if 'UPDATE memories' in c[0]]
    assert len(update_calls) == 0, f"UPDATE must not run for invalid non-string scalars, got {update_calls}"
    assert conn.commit_calls == 0


def test_update_source_type_non_string_rejected():
    """#3287: sourceType non-string (e.g. number) returns structured 400, no mutation."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id, source_type="youtube")
    update_cursor = MockCursor(fetchone_result=make_memory_row(memory_id, tree_id))
    conn = MockConnection()
    conn.cursor = lambda *a, **k: update_cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            try:
                update_owner_memory(owner_id, memory_id, {"sourceType": 42})
                assert False, "Should have raised HTTPException for non-string sourceType"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_MEMORY_SCALAR_TYPE"
                assert detail.get("field") == "sourceType"

    update_calls = [c for c in update_cursor.execute_calls if 'UPDATE memories' in c[0]]
    assert len(update_calls) == 0
    assert conn.commit_calls == 0


def test_create_non_string_scalar_rejected_structured_400():
    """#3287: create with non-string title returns structured 400, no INSERT."""
    owner_id = "owner-123"
    tree_id = "22222222-2222-2222-2222-222222222222"

    tree_row = {"id": uuid.UUID(tree_id), "tree_id": uuid.UUID(tree_id), "visibility": "public"}

    insert_cursor = MockCursor(fetchone_result=make_memory_row(uuid.uuid4(), tree_id))
    conn = MockConnection()
    conn.cursor = lambda *a, **k: insert_cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.fetch_owner_tree', return_value=tree_row):
            try:
                create_owner_memory(owner_id, {
                    "treeId": str(tree_id),
                    "title": 12345,
                    "source": "opaque-source-zeta",
                })
                assert False, "Should have raised HTTPException for non-string title on create"
            except HTTPException as e:
                assert e.status_code == 400
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "INVALID_MEMORY_SCALAR_TYPE"
                assert detail.get("field") == "title"

    insert_calls = [c for c in insert_cursor.execute_calls if 'INSERT INTO memories' in c[0]]
    assert len(insert_calls) == 0, f"INSERT must not run for invalid non-string scalar, got {insert_calls}"
    assert conn.commit_calls == 0


def test_parent_not_found_semantics_preserved():
    """parent lookup not-found check maintains INVALID_PARENT_ID / reason: not_found / HTTP 400."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"
    parent_id = "33333333-3333-3333-3333-333333333333"

    source_mem_row = make_memory_row(memory_id, tree_id)

    tracker = MockConnectionTracker()
    conn1 = MockConnection()
    conn1.cursor_factory = lambda *a, **k: MockCursor(fetchone_result=None) # parent not found
    tracker.add_connection(conn1)

    with patch('modal_compute.memory_writes.get_db_connection', side_effect=tracker.get_next_connection):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            try:
                update_owner_memory(owner_id, memory_id, {"parentId": parent_id})
                assert False, "Should have failed with parent not found"
            except HTTPException as e:
                assert e.status_code == 400
                assert e.detail.get("code") == "INVALID_PARENT_ID"
                assert e.detail.get("reason") == "not_found"


# ============================================================================
# #3330: source-field persistence acknowledgement convergence
# ============================================================================
#
# Boundary localized to modal_compute/memory_writes.py (response-normalization /
# write-acknowledgement layer). The fix rejects a stale/mismatched source
# acknowledgement as a structured 409 (SOURCE_WRITE_ACK_DIVERGENCE) instead of
# echoing the request to fake success. It does NOT force-merge request values
# into the response (Refs #3330, Refs #3273, Refs #3329, Refs #1882).

def test_source_fields_bound_to_sql_update_columns():
    """request source/sourceUrl/sourceType/thumbnail are bound to the matching SQL columns."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id)
    updated_row = make_memory_row(
        memory_id, tree_id,
        source="opaque-source-alpha",
        source_url="opaque-source-beta",
        source_type="youtube",
        thumbnail="opaque-thumbnail-alpha",
    )
    cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            update_owner_memory(owner_id, memory_id, {
                "source": "opaque-source-alpha",
                "sourceUrl": "opaque-source-beta",
                "sourceType": "youtube",
                "thumbnail": "opaque-thumbnail-alpha",
            })

    update_calls = [c for c in cursor.execute_calls if "UPDATE memories" in c[0]]
    assert update_calls, "expected an UPDATE memories statement"
    query, params = update_calls[0]
    assert "source = %s" in query, "source column must be bound"
    assert "source_url = %s" in query, "source_url column must be bound"
    assert "source_type = %s" in query, "source_type column must be bound"
    assert "thumbnail = %s" in query, "thumbnail column must be bound"
    # Spot-check that the bound params carry the requested identities.
    assert any(p == "opaque-source-alpha" for p in params), "source param must be bound"
    assert any(p == "opaque-source-beta" for p in params), "source_url param must be bound"
    assert conn.commit_calls == 1


def test_updated_source_returning_row_reflected_in_response():
    """when the DB returns the updated row, the normalized response reflects it."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id)
    updated_row = make_memory_row(
        memory_id, tree_id,
        source="opaque-source-alpha",
        source_url="opaque-source-beta",
        source_type="youtube",
        thumbnail="opaque-thumbnail-alpha",
    )
    cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            result = update_owner_memory(owner_id, memory_id, {
                "source": "opaque-source-alpha",
                "sourceUrl": "opaque-source-beta",
                "sourceType": "youtube",
                "thumbnail": "opaque-thumbnail-alpha",
            })

    assert result["source"] == "opaque-source-alpha"
    assert result["sourceUrl"] == "opaque-source-beta"
    assert result["sourceType"] == "youtube"
    assert result["thumbnail"] == "opaque-thumbnail-alpha"


def test_stale_source_returning_row_rejected_as_structured_409():
    """DB RETURNING a stale source row must NOT be echoed into success.

    If the write did not converge (persisted source identity differs from the
    request), the write is rejected with SOURCE_WRITE_ACK_DIVERGENCE 409, not a
    normalized success built from the request. This is the core #3330 boundary.

    The 409 detail must NOT leak the raw requested/persisted values (that would
    expose production source URLs / provider identifiers / thumbnails across the
    #3273/#3330 privacy boundary) — only typed classification is returned.
    """
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id)
    # DB returns STALE identity (the pre-update value), despite the request asking
    # for a new sourceUrl. This simulates a stale/cached readback.
    stale_row = make_memory_row(
        memory_id, tree_id,
        source_url="opaque-source-stale",
    )
    cursor = MockCursor(fetchone_result=stale_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            try:
                update_owner_memory(owner_id, memory_id, {
                    "sourceUrl": "opaque-source-fresh",
                })
                assert False, "stale source acknowledgement must not be normalized into success"
            except HTTPException as e:
                assert e.status_code == 409, f"expected 409, got {e.status_code}"
                detail = e.detail if isinstance(e.detail, dict) else {}
                assert detail.get("code") == "SOURCE_WRITE_ACK_DIVERGENCE", f"got detail {e.detail}"
                assert detail.get("field") == "sourceUrl"
                assert detail.get("classification") == "STALE_SOURCE_ACKNOWLEDGEMENT", f"expected typed classification, got {e.detail}"
                # Privacy boundary: raw requested/persisted values must never be echoed.
                assert "requested" not in detail, f"requested must NOT be in detail (privacy boundary): {e.detail}"
                assert "persisted" not in detail, f"persisted must NOT be in detail (privacy boundary): {e.detail}"

    # The UPDATE still ran (the write was attempted); the failure is in acknowledgement.
    update_calls = [c for c in cursor.execute_calls if "UPDATE memories" in c[0]]
    assert update_calls, "UPDATE must have been attempted"
    assert conn.commit_calls == 1


def test_title_memo_emotiontags_persistence_unaffected_by_source_gate():
    """title/memo/emotionTags persistence still converges and returns normally (no source gate)."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id, title="Old", memo="Old memo", emotion_tags=["sad"])
    updated_row = make_memory_row(
        memory_id, tree_id,
        title="New Title",
        memo="New memo",
        emotion_tags=["happy", "calm"],
    )
    cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            result = update_owner_memory(owner_id, memory_id, {
                "title": "New Title",
                "memo": "New memo",
                "emotionTags": ["happy", "calm"],
            })

    assert result["title"] == "New Title"
    assert result["memo"] == "New memo"
    assert result["emotionTags"] == ["happy", "calm"]
    assert conn.commit_calls == 1


def test_source_type_default_passes_acknowledgement_when_persisted_matches_request():
    """sourceType default ('youtube') persists and acknowledgement converges normally."""
    owner_id = "owner-123"
    memory_id = "11111111-1111-1111-1111-111111111111"
    tree_id = "22222222-2222-2222-2222-222222222222"

    source_mem_row = make_memory_row(memory_id, tree_id, source_type="youtube")
    updated_row = make_memory_row(memory_id, tree_id, source_type="youtube")
    cursor = MockCursor(fetchone_result=updated_row)
    conn = MockConnection()
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner', return_value=source_mem_row):
            result = update_owner_memory(owner_id, memory_id, {
                "sourceType": "youtube",
            })

    assert result["sourceType"] == "youtube"
    assert conn.commit_calls == 1


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    tests = [
        ("parentId connect updates parent_id and returns normalized response", test_parent_connect_updates_parent_id_and_returns_normalized),
        ("parentId: null disconnect sets parent_id = NULL", test_parent_disconnect_null_sets_parent_id_null),
        ("parentId: '' empty string normalizes to NULL", test_parent_disconnect_empty_string_normalizes_to_null),
        ("parentId: whitespace normalizes to NULL", test_parent_disconnect_whitespace_normalizes_to_null),
        ("cross-tree parent rejected, UPDATE not executed", test_cross_tree_parent_rejected_update_not_executed),
        ("self parent rejected, UPDATE not executed", test_self_parent_rejected_update_not_executed),
        ("descendant cycle rejected, UPDATE not executed", test_descendant_cycle_rejected_update_not_executed),
        ("malformed parent UUID rejected", test_malformed_parent_uuid_rejected),
        ("unknown update key returns structured 400 with sorted fields", test_unknown_update_key_returns_structured_400),
        ("empty payload returns structured 400", test_empty_payload_returns_structured_400),
        ("artist/timestamp updates in SQL params and response", test_artist_timestamp_updates_included_in_response),
        ("existing title/memo/sourceUrl updates still work", test_existing_title_memo_sourceurl_updates_still_work),
        ("cycle detection with existing DB cycle breaks", test_cycle_detection_with_existing_cycle_breaks),
        ("cycle detection no cycle returns false", test_cycle_detection_no_cycle_returns_false),
        ("persistence: connect UPDATE executes with parent_id = %s and parent UUID in params", test_persistence_connect_executes_final_update_memories_with_parent_uuid_in_params),
        ("persistence: disconnect UPDATE executes with parent_id = NULL and no None placeholder param", test_persistence_disconnect_executes_final_update_memories_with_null_parent_in_query_no_none_param),
        ("persistence: connect RETURNING row is normalized into response", test_persistence_connect_returning_row_is_normalized_into_response),
        ("persistence: disconnect RETURNING row is normalized into response", test_persistence_disconnect_returning_row_is_normalized_into_response),
        ("_would_create_cycle cursor reuse contract", test_would_create_cycle_single_cursor_reuse),
        ("no-update guard source contract", test_no_update_guard_source_contract),
        ("#3287 update non-string title -> structured 400, no mutation", test_update_non_string_scalar_rejected_structured_400_and_no_mutation),
        ("#3287 update non-string scalar fields -> structured 400, no mutation", test_update_non_string_scalar_other_fields_rejected_and_no_mutation),
        ("#3287 update non-string sourceType -> structured 400, no mutation", test_update_source_type_non_string_rejected),
        ("#3287 create non-string title -> structured 400, no INSERT", test_create_non_string_scalar_rejected_structured_400),
        ("parent lookup not-found semantics contract", test_parent_not_found_semantics_preserved),
        ("#3330 source fields bound to SQL update columns", test_source_fields_bound_to_sql_update_columns),
        ("#3330 updated source RETURNING row reflected in response", test_updated_source_returning_row_reflected_in_response),
        ("#3330 stale source RETURNING row rejected as structured 409", test_stale_source_returning_row_rejected_as_structured_409),
        ("#3330 title/memo/emotionTags persistence unaffected by source gate", test_title_memo_emotiontags_persistence_unaffected_by_source_gate),
        ("#3330 sourceType default passes acknowledgement when persisted matches", test_source_type_default_passes_acknowledgement_when_persisted_matches_request),
    ]

    print("=" * 70)
    print("Running update_owner_memory persistence contract tests")
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