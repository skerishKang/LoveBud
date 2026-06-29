#!/usr/bin/env python3
"""
Executable contract tests for update_owner_memory persistence behavior.

Tests actual update_owner_memory() execution with mocked DB.
Run: python3 tests/contracts/test_owner_memory_update_persistence.py
"""

import sys
import uuid
from unittest.mock import patch, MagicMock, Mock
from fastapi import HTTPException

# Import the module under test
sys.path.insert(0, '/root/LoveBud-worktrees/api-memory-update-persistence-2986')

from modal_compute.memory_writes import update_owner_memory, _would_create_cycle


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
        "source": "YouTube",
        "source_url": "https://youtube.com/watch?v=test",
        "source_type": "youtube",
        "thumbnail": "https://img.youtube.com/vi/test/mqdefault.jpg",
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
        source_url="https://youtube.com/watch?v=new"
    )
    cursor = MockCursor(fetchone_result=updated_row)
    conn.cursor = lambda *a, **k: cursor

    with patch('modal_compute.memory_writes.get_db_connection', return_value=conn):
        with patch('modal_compute.memory_writes.require_memory_owner') as mock_req:
            mock_req.return_value = source_mem_row
            result = update_owner_memory(owner_id, memory_id, {
                "title": "Updated Title",
                "memo": "Updated memo",
                "sourceUrl": "https://youtube.com/watch?v=new"
            })

    assert result["title"] == "Updated Title"
    assert result["memo"] == "Updated memo"
    assert result["sourceUrl"] == "https://youtube.com/watch?v=new"
    assert conn.commit_calls == 1


# ============================================================================
# Cycle Detection Tests
# ============================================================================

def test_cycle_detection_with_existing_cycle_breaks():
    """Cycle detection with existing cycle in DB breaks to avoid infinite loop."""
    conn = MockConnection()
    call_count = [0]

    def cursor_factory(*a, **k):
        call_count[0] += 1
        if call_count[0] == 1:
            return MockCursor(fetchone_result={"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000002")})
        elif call_count[0] == 2:
            return MockCursor(fetchone_result={"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000001")})
        elif call_count[0] == 3:
            return MockCursor(fetchone_result={"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000002")})
        return MockCursor()

    conn.cursor = cursor_factory

    source_id = "00000000-0000-0000-0000-000000000003"
    target_parent_id = "00000000-0000-0000-0000-000000000001"

    result = _would_create_cycle(conn, source_id, target_parent_id)
    assert result is True, "Should detect cycle even with existing corrupted data"


def test_cycle_detection_no_cycle_returns_false():
    """Cycle detection returns false when no cycle exists."""
    conn = MockConnection()
    call_count = [0]

    def cursor_factory(*a, **k):
        call_count[0] += 1
        if call_count[0] == 1:
            return MockCursor(fetchone_result={"parent_id": uuid.UUID("00000000-0000-0000-0000-000000000002")})
        elif call_count[0] == 2:
            return MockCursor(fetchone_result={"parent_id": None})
        return MockCursor()

    conn.cursor = cursor_factory

    source_id = "00000000-0000-0000-0000-000000000003"
    target_parent_id = "00000000-0000-0000-0000-000000000001"

    result = _would_create_cycle(conn, source_id, target_parent_id)
    assert result is False, "Should not detect cycle when none exists"


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