#!/usr/bin/env python3
"""
Executable contract tests for comment ownerId privacy fix (Issue #3929).

Verifies that:
- normalize_comment_row() does NOT expose raw ownerId
- normalize_comment_row() exposes isOwn (server-computed boolean)
- fetch_comments() passes requester_uid to normalizer
- create_comment() returns privacy-safe authenticated DTO
- idempotent replay returns same privacy shape
- public guest DTO remains id/body/createdAt only
- delete authorization still uses server-side UID comparison

Run: python3 tests/contracts/test_comment_owner_id_privacy_3929.py
"""

import os
import sys
import uuid
from unittest.mock import patch

from modal_compute.comments import (
    normalize_comment_row,
    normalize_public_comment_row,
    create_comment,
    fetch_comments,
    soft_delete_own_comment,
    hide_comment_by_tree_owner,
)
from modal_compute.social_errors import SocialWriteError


# ============================================================================
# Test Helpers
# ============================================================================

class MockCursor:
    def __init__(self, fetchone_result=None, fetchall_result=None):
        self._fetchone_results = fetchone_result if fetchone_result is not None else []
        self.fetchall_result = fetchall_result
        self.execute_calls = []
        self._fetchone_idx = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchone(self):
        if isinstance(self._fetchone_results, list):
            if self._fetchone_idx < len(self._fetchone_results):
                result = self._fetchone_results[self._fetchone_idx]
                self._fetchone_idx += 1
                return result
            return None
        return self._fetchone_results

    def fetchall(self):
        return self.fetchall_result

    def commit(self):
        pass

    def rollback(self):
        pass


class MockConnection:
    def __init__(self, cursor_factory=None):
        self.cursor_factory = cursor_factory or MockCursor

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def cursor(self, *args, **kwargs):
        return self.cursor_factory(*args, **kwargs)

    def commit(self):
        pass

    def rollback(self):
        pass


def make_comment_row(
    comment_id=None,
    memory_id=None,
    owner_id=None,
    body="Test comment",
    status="visible",
    deleted_at=None,
    created_at="2024-01-01T00:00:00Z",
    updated_at="2024-01-01T00:00:00Z",
):
    return {
        "id": comment_id or uuid.uuid4(),
        "memory_id": memory_id or uuid.uuid4(),
        "owner_id": owner_id or uuid.uuid4(),
        "body": body,
        "status": status,
        "deleted_at": deleted_at,
        "created_at": created_at,
        "updated_at": updated_at,
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
# Tests: normalize_comment_row privacy contract
# ============================================================================

def test_normalize_comment_row_excludes_owner_id():
    """normalize_comment_row must NOT expose raw ownerId/owner_id in output."""
    row = make_comment_row(
        comment_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        memory_id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        owner_id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
    )
    result = normalize_comment_row(row)

    assert "ownerId" not in result, f"ownerId must not be in result: {result}"
    assert "owner_id" not in result, f"owner_id must not be in result: {result}"
    assert "uid" not in result, f"uid must not be in result: {result}"
    assert "email" not in result, f"email must not be in result: {result}"


def test_normalize_comment_row_includes_required_fields():
    """normalize_comment_row must include id, memoryId, body, createdAt, updatedAt."""
    row = make_comment_row()
    result = normalize_comment_row(row)

    assert "id" in result, f"id missing from result: {result}"
    assert "memoryId" in result, f"memoryId missing from result: {result}"
    assert "body" in result, f"body missing from result: {result}"
    assert "createdAt" in result, f"createdAt missing from result: {result}"
    assert "updatedAt" in result, f"updatedAt missing from result: {result}"


def test_normalize_comment_row_isOwn_true_for_own_comment():
    """isOwn must be True when requester_uid matches row owner_id."""
    owner_uid = "user-123"
    row = make_comment_row(owner_id=owner_uid)
    result = normalize_comment_row(row, requester_uid=owner_uid)

    assert "isOwn" in result, f"isOwn missing from result: {result}"
    assert result["isOwn"] is True, f"isOwn should be True for own comment: {result}"


def test_normalize_comment_row_isOwn_false_for_foreign_comment():
    """isOwn must be False when requester_uid differs from row owner_id."""
    row_owner = "user-456"
    requester = "user-789"
    row = make_comment_row(owner_id=row_owner)
    result = normalize_comment_row(row, requester_uid=requester)

    assert "isOwn" in result, f"isOwn missing from result: {result}"
    assert result["isOwn"] is False, f"isOwn should be False for foreign comment: {result}"


def test_normalize_comment_row_isOwn_uuid_type_safe():
    """isOwn comparison must work across UUID string and UUID object types."""
    owner_uuid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    row = make_comment_row(owner_id=owner_uuid)
    result_str = normalize_comment_row(row, requester_uid=str(owner_uuid))
    assert result_str["isOwn"] is True, f"isOwn should be True with string requester: {result_str}"
    result_uuid = normalize_comment_row(row, requester_uid=owner_uuid)
    assert result_uuid["isOwn"] is True, f"isOwn should be True with UUID requester: {result_uuid}"


def test_normalize_comment_row_no_isOwn_when_no_requester():
    """When requester_uid is None, isOwn must not be included."""
    row = make_comment_row()
    result = normalize_comment_row(row, requester_uid=None)

    assert "isOwn" not in result, f"isOwn must not be present when no requester: {result}"
    assert "ownerId" not in result, f"ownerId must not be present: {result}"


# ============================================================================
# Tests: normalize_public_comment_row contract (unchanged)
# ============================================================================

def test_normalize_public_comment_row_unchanged():
    """Public/guest comment DTO must remain id/body/createdAt only."""
    row = make_comment_row()
    result = normalize_public_comment_row(row)

    assert "id" in result, f"id missing: {result}"
    assert "body" in result, f"body missing: {result}"
    assert "createdAt" in result, f"createdAt missing: {result}"

    assert "ownerId" not in result, f"ownerId must not be in public DTO: {result}"
    assert "memoryId" not in result, f"memoryId must not be in public DTO: {result}"
    assert "updatedAt" not in result, f"updatedAt must not be in public DTO: {result}"
    assert "isOwn" not in result, f"isOwn must not be in public DTO: {result}"


# ============================================================================
# Tests: Executable fetch_comments() privacy regression
# ============================================================================

def test_fetch_comments_passes_requester_uid_to_normalizer():
    import inspect
    from modal_compute import comments

    source = inspect.getsource(comments.fetch_comments)
    assert "normalize_comment_row(row, requester_uid)" in source or \
           "normalize_comment_row(row,requester_uid)" in source.replace(" ", ""), \
        f"fetch_comments must pass requester_uid to normalize_comment_row"


def test_fetch_comments_has_authorization_guard():
    import inspect
    from modal_compute import comments

    source = inspect.getsource(comments.fetch_comments)
    assert "require_memory_visible_or_owner" in source, \
        "fetch_comments must call require_memory_visible_or_owner"


# ============================================================================
# Tests: Executable fetch_comments() privacy regression
# ============================================================================

def test_fetch_comments_authenticated_non_owner_foreign_comment():
    """Executable regression: authenticated non-owner reading foreign comment on public Memory.

    This is the core #3929 privacy read boundary case that source-string assertions
    alone cannot cover. We call fetch_comments() with a fake DB seam and prove:

    - read succeeds (authorization + visibility allow it)
    - returned comments include safe metadata (id, memoryId, body, createdAt, updatedAt)
    - foreign comment: isOwn == False
    - own comment: isOwn == True
    - NO raw ownerId / owner_id / uid / email in ANY returned row
    """
    tree_id = str(uuid.uuid4())
    memory_id = str(uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"))
    requester_uid = "requester-user-111"      # authenticated, NOT tree/memory owner
    tree_owner_uid = "tree-owner-user-222"    # tree + memory owner
    foreign_commenter_uid = "foreign-commenter-333"  # author of one comment

    # --- mock rows ---
    # 1. require_memory_visible_or_owner row (same columns as write_validation query)
    auth_row = {
        "id": memory_id,
        "tree_id": tree_id,
        "mem_visibility": "public",
        "tree_owner_id": tree_owner_uid,
        "tree_visibility": "public",
    }

    # 2. comment rows returned by fetch_comments()
    own_comment_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    foreign_comment_id = uuid.UUID("22222222-2222-2222-2222-222222222222")

    own_comment_row = make_comment_row(
        comment_id=own_comment_id,
        memory_id=memory_id,
        owner_id=requester_uid,       # requester is the author of THIS comment
        body="내가 단 댓글",           # safe body preserved
        status="visible",
    )
    foreign_comment_row = make_comment_row(
        comment_id=foreign_comment_id,
        memory_id=memory_id,
        owner_id=foreign_commenter_uid,  # different user authored THIS comment
        body="다른 사람이 단 댓글",
        status="visible",
    )

    # --- mock cursor setup ---
    # fetch_comments() flow:
    #   1. require_memory_visible_or_owner() → get_db_connection() → cur.fetchone() → auth_row
    #   2. fetch_comments() own get_db_connection() → cur.execute(comment_query) → cur.fetchall() → [own, foreign]
    #
    # Both use the same mock connection. The first get_db_connection() call is for auth,
    # the second is for the comment query. Each creates a fresh cursor via cursor_factory.
    # We use side_effect to return a cursor with the right fetchone/fetchall behavior.

    auth_cursor = MockCursor(fetchone_result=auth_row)
    comment_cursor = MockCursor(fetchall_result=[own_comment_row, foreign_comment_row])

    auth_conn = MockConnection()
    auth_conn.cursor = lambda *a, **k: auth_cursor
    comment_conn = MockConnection()
    comment_conn.cursor = lambda *a, **k: comment_cursor

    conn_call_count = [0]

    def get_conn():
        conn_call_count[0] += 1
        return auth_conn if conn_call_count[0] == 1 else comment_conn

    with patch("modal_compute.write_validation.get_db_connection", side_effect=get_conn):
        with patch("modal_compute.comments.get_db_connection", side_effect=get_conn):
            result = fetch_comments(memory_id, requester_uid)

    # --- result shape ---
    assert isinstance(result, list), f"fetch_comments must return a list, got {type(result)}"
    assert len(result) == 2, f"Expected 2 comments, got {len(result)}: {result}"

    # --- find own and foreign rows by comment id ---
    by_id = {r["id"]: r for r in result}
    own = by_id.get(str(own_comment_id))
    foreign = by_id.get(str(foreign_comment_id))
    assert own is not None, f"own comment missing from result: {result}"
    assert foreign is not None, f"foreign comment missing from result: {result}"

    # --- common safe fields preserved ---
    for label, row in [("own", own), ("foreign", foreign)]:
        assert "id" in row, f"{label}: id missing: {row}"
        assert "memoryId" in row, f"{label}: memoryId missing: {row}"
        assert "body" in row, f"{label}: body missing: {row}"
        assert row["body"] in ("내가 단 댓글", "다른 사람이 단 댓글"), f"{label}: body mismatch: {row}"
        assert "createdAt" in row, f"{label}: createdAt missing: {row}"
        assert "updatedAt" in row, f"{label}: updatedAt missing: {row}"

        # --- privacy: no raw identifiers anywhere ---
        assert "ownerId" not in row, f"{label}: ownerId must not be exposed: {row}"
        assert "owner_id" not in row, f"{label}: owner_id must not be exposed: {row}"
        assert "uid" not in row, f"{label}: uid must not be exposed: {row}"
        assert "email" not in row, f"{label}: email must not be exposed: {row}"

    # --- isOwn semantics ---
    assert own["isOwn"] is True, f"own comment must have isOwn=True: {own}"
    assert foreign["isOwn"] is False, f"foreign comment must have isOwn=False: {foreign}"

    # --- isOwn must be a bool, not a leakable sentinel ---
    assert isinstance(own["isOwn"], bool), f"isOwn must be bool: {own}"
    assert isinstance(foreign["isOwn"], bool), f"isOwn must be bool: {foreign}"

    # --- memoryId must match the requested memory ---
    for label, row in [("own", own), ("foreign", foreign)]:
        assert row["memoryId"] == memory_id, f"{label}: memoryId mismatch: {row}"


def test_fetch_comments_authenticated_non_owner_no_comments():
    """Edge case: authenticated non-owner can read empty comment list on public Memory.

    Proves the authorization seam allows the read (public + visible) even though
    requester is not the tree owner, and the response is an empty list with no leak.
    """
    memory_id = str(uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"))
    requester_uid = "requester-user-999"
    tree_owner_uid = "tree-owner-user-888"

    auth_row = {
        "id": memory_id,
        "tree_id": str(uuid.uuid4()),
        "mem_visibility": "public",
        "tree_owner_id": tree_owner_uid,
        "tree_visibility": "public",
    }

    auth_cursor = MockCursor(fetchone_result=auth_row)
    comment_cursor = MockCursor(fetchall_result=[])  # empty comment list

    auth_conn = MockConnection()
    auth_conn.cursor = lambda *a, **k: auth_cursor
    comment_conn = MockConnection()
    comment_conn.cursor = lambda *a, **k: comment_cursor

    conn_call_count = [0]

    def get_conn():
        conn_call_count[0] += 1
        return auth_conn if conn_call_count[0] == 1 else comment_conn

    with patch("modal_compute.write_validation.get_db_connection", side_effect=get_conn):
        with patch("modal_compute.comments.get_db_connection", side_effect=get_conn):
            result = fetch_comments(memory_id, requester_uid)

    assert isinstance(result, list), f"Expected list, got {type(result)}"
    assert result == [], f"Expected empty list, got {result}"



# ============================================================================
# Tests: create_comment returns privacy-safe DTO
# ============================================================================

def test_create_comment_fresh_returns_isOwn_true_no_owner_id():
    memory_id = str(uuid.uuid4())
    owner_id = "creator-user-123"
    body = "This is my comment"
    idempotency_key = "test-key-12345678"

    comment_id = str(uuid.uuid4())
    created_row = make_comment_row(
        comment_id=comment_id,
        memory_id=memory_id,
        owner_id=owner_id,
        body=body,
    )

    auth_result = {
        "id": memory_id,
        "tree_id": str(uuid.uuid4()),
        "mem_visibility": "public",
        "tree_owner_id": owner_id,
        "tree_visibility": "public",
    }

    mock_cursor = MockCursor(fetchone_result=[auth_result, created_row])

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        with patch("modal_compute.comments.reserve_and_verify_idempotency", return_value=None):
            with patch("modal_compute.comments.check_comment_rate_limits"):
                with patch("modal_compute.comments._compute_key_hash", return_value="hash123"):
                    with patch("modal_compute.comments.record_audit"):
                        with patch("modal_compute.comments.complete_idempotency"):
                            result = create_comment(memory_id, owner_id, body, idempotency_key)

    assert "ownerId" not in result, f"ownerId must not be in create response: {result}"
    assert "owner_id" not in result, f"owner_id must not be in create response: {result}"
    assert "isOwn" in result, f"isOwn must be in create response: {result}"
    assert result["isOwn"] is True, f"isOwn must be True for fresh create: {result}"
    assert result["body"] == body, f"body mismatch: {result}"


def test_create_comment_idempotent_replay_returns_same_privacy_shape():
    memory_id = str(uuid.uuid4())
    owner_id = "replay-user-456"
    body = "Replay comment"
    idempotency_key = "replay-key-87654321"

    existing_comment_id = str(uuid.uuid4())
    existing_row = make_comment_row(
        comment_id=existing_comment_id,
        memory_id=memory_id,
        owner_id=owner_id,
        body=body,
    )

    auth_result = {
        "id": memory_id,
        "tree_id": str(uuid.uuid4()),
        "mem_visibility": "public",
        "tree_owner_id": owner_id,
        "tree_visibility": "public",
    }

    mock_cursor = MockCursor(fetchone_result=[auth_result, existing_row])

    replay_data = {
        "replay": True,
        "resultId": existing_comment_id,
        "resultPayload": {"body": body},
    }

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        with patch("modal_compute.comments.reserve_and_verify_idempotency", return_value=replay_data):
            with patch("modal_compute.comments._compute_key_hash", return_value="hash456"):
                with patch("modal_compute.comments.record_audit"):
                    result = create_comment(memory_id, owner_id, body, idempotency_key)

    assert "ownerId" not in result, f"ownerId must not be in replay response: {result}"
    assert "isOwn" in result, f"isOwn must be in replay response: {result}"
    assert result["isOwn"] is True, f"isOwn must be True for replay of own comment: {result}"


# ============================================================================
# Tests: delete authorization uses server-side UID comparison
# ============================================================================

def test_soft_delete_own_comment_succeeds_for_owner():
    comment_id = str(uuid.uuid4())
    owner_id = "comment-author-789"
    memory_id = str(uuid.uuid4())

    row = make_comment_row(
        comment_id=comment_id,
        memory_id=memory_id,
        owner_id=owner_id,
        status="visible",
    )

    mock_cursor = MockCursor(fetchone_result=row)

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        with patch("modal_compute.comments.record_audit"):
            result = soft_delete_own_comment(comment_id, owner_id)

    assert result["status"] == "deleted", f"Expected deleted status: {result}"


def test_soft_delete_own_comment_fails_for_foreign_actor():
    comment_id = str(uuid.uuid4())
    owner_id = "comment-author-aaa"
    foreign_actor = "other-user-bbb"

    row = make_comment_row(
        comment_id=comment_id,
        owner_id=owner_id,
        status="visible",
    )

    mock_cursor = MockCursor(fetchone_result=row)

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        try:
            soft_delete_own_comment(comment_id, foreign_actor)
            assert False, "Expected SocialWriteError for foreign delete"
        except SocialWriteError as e:
            assert e.status_code == 403, f"Expected 403, got {e.status_code}: {e}"


def test_hide_comment_by_tree_owner_succeeds_for_tree_owner():
    comment_id = str(uuid.uuid4())
    tree_owner_id = "tree-owner-ccc"
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())

    comment_row = {
        "id": comment_id,
        "memory_id": memory_id,
        "status": "visible",
        "deleted_at": None,
        "tree_id": tree_id,
    }

    tree_row = {"owner_id": tree_owner_id}

    # Both queries use the same connection and cursor (same with block)
    mock_cursor = MockCursor(fetchone_result=[comment_row, tree_row])

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        with patch("modal_compute.comments.record_audit"):
            result = hide_comment_by_tree_owner(comment_id, tree_owner_id)

    assert result["status"] == "hidden", f"Expected hidden status: {result}"


def test_hide_comment_by_tree_owner_fails_for_non_tree_owner():
    comment_id = str(uuid.uuid4())
    tree_owner_id = "real-tree-owner-xxx"
    fake_actor = "imposter-yyy"
    memory_id = str(uuid.uuid4())
    tree_id = str(uuid.uuid4())

    comment_row = {
        "id": comment_id,
        "memory_id": memory_id,
        "status": "visible",
        "deleted_at": None,
        "tree_id": tree_id,
    }

    tree_row = {"owner_id": tree_owner_id}

    mock_cursor = MockCursor(fetchone_result=[comment_row, tree_row])

    with patch("modal_compute.comments.get_db_connection", return_value=MockConnection(cursor_factory=lambda *a, **k: mock_cursor)):
        try:
            hide_comment_by_tree_owner(comment_id, fake_actor)
            assert False, "Expected SocialWriteError for non-tree-owner hide"
        except SocialWriteError as e:
            assert e.status_code == 403, f"Expected 403, got {e.status_code}: {e}"


# ============================================================================
# Tests: Source-level contract assertions
# ============================================================================

def test_normalize_comment_row_source_excludes_owner_id_assignment():
    import inspect
    from modal_compute import comments

    source = inspect.getsource(comments.normalize_comment_row)
    assert '"ownerId"' not in source, \
        f"normalize_comment_row source must not contain 'ownerId' assignment: {source}"
    assert "'ownerId'" not in source, \
        f"normalize_comment_row source must not contain 'ownerId' assignment: {source}"


def test_normalize_comment_row_source_computes_isOwn_from_owner_id_comparison():
    import inspect
    from modal_compute import comments

    source = inspect.getsource(comments.normalize_comment_row)
    assert "isOwn" in source, f"isOwn must be in normalize_comment_row source: {source}"
    assert "owner_id" in source, f"owner_id comparison must be in source: {source}"
    assert "requester_uid" in source, f"requester_uid must be in source: {source}"


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    tests = [
        # normalize_comment_row privacy
        ("normalize_comment_row excludes ownerId/owner_id", test_normalize_comment_row_excludes_owner_id),
        ("normalize_comment_row includes required fields", test_normalize_comment_row_includes_required_fields),
        ("normalize_comment_row isOwn=true for own comment", test_normalize_comment_row_isOwn_true_for_own_comment),
        ("normalize_comment_row isOwn=false for foreign comment", test_normalize_comment_row_isOwn_false_for_foreign_comment),
        ("normalize_comment_row isOwn UUID type-safe", test_normalize_comment_row_isOwn_uuid_type_safe),
        ("normalize_comment_row no isOwn without requester", test_normalize_comment_row_no_isOwn_when_no_requester),
        # public DTO unchanged
        ("normalize_public_comment_row unchanged (id/body/createdAt only)", test_normalize_public_comment_row_unchanged),
        # fetch_comments: source contract (kept for diagnostics)
        ("fetch_comments passes requester_uid to normalizer (source)", test_fetch_comments_passes_requester_uid_to_normalizer),
        ("fetch_comments has authorization guard (source)", test_fetch_comments_has_authorization_guard),
        # fetch_comments: executable privacy regression (the core #3929 read boundary)
        ("fetch_comments: authenticated non-owner + public Memory + foreign comment (executable)", test_fetch_comments_authenticated_non_owner_foreign_comment),
        ("fetch_comments: authenticated non-owner + public Memory + empty list (executable)", test_fetch_comments_authenticated_non_owner_no_comments),
        # create_comment
        ("create_comment fresh returns isOwn=true, no ownerId", test_create_comment_fresh_returns_isOwn_true_no_owner_id),
        ("create_comment replay returns same privacy shape", test_create_comment_idempotent_replay_returns_same_privacy_shape),
        # delete authorization
        ("soft_delete_own_comment succeeds for owner", test_soft_delete_own_comment_succeeds_for_owner),
        ("soft_delete_own_comment fails for foreign actor (403)", test_soft_delete_own_comment_fails_for_foreign_actor),
        ("hide_comment_by_tree_owner succeeds for tree owner", test_hide_comment_by_tree_owner_succeeds_for_tree_owner),
        ("hide_comment_by_tree_owner fails for non-tree-owner (403)", test_hide_comment_by_tree_owner_fails_for_non_tree_owner),
        # source-level contracts
        ("normalize_comment_row source excludes ownerId assignment", test_normalize_comment_row_source_excludes_owner_id_assignment),
        ("normalize_comment_row source computes isOwn from owner_id comparison", test_normalize_comment_row_source_computes_isOwn_from_owner_id_comparison),
    ]

    print("=" * 70)
    print("Comment ownerId privacy (#3929) contract tests")
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
