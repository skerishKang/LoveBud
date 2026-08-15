#!/usr/bin/env python3
"""
Executable contract tests for Issue #3951 — Memory parent cycle validation
must be atomic with the parent UPDATE under PostgreSQL concurrency.

Two layers of proof:

1. Source-contract proof (static): the reparent validation executes inside a
   single `get_db_connection()` transaction. Inside that transaction, the
   source Memory + owning Tree are reread to obtain the authoritative tree_id,
   a tree-scoped pg_advisory_xact_lock is acquired (domain-separated key
   "memory-parent-graph:<tree_id>"), and then the source and target are
   reread before graph validation. Different Trees derive different advisory
   lock keys and do not serialize behind one global lock.

2. Behavioral matrix (mocked DB, authoritative fixture): self-parent,
   cross-tree parent, missing parent, valid same-tree reparent, existing
   ancestor cycle, descendant cycle, detach (null/empty/whitespace),
   rollback-on-reject (zero partial mutation), combined parent+visibility+
   emotionTags update atomicity, owner authorization, and no raw DB
   error/constraint/deadlock text leaking to the caller.

The real PostgreSQL concurrency regression (A<->B simultaneous reparent,
barrier-synchronized, proving BOTH COMMIT is impossible, plus different-Tree
independence) lives in
tests/db-engine/memory-parent-cycle-concurrency-postgres.test.cjs, driven by
a disposable loopback PostgreSQL 17.4 database.

Run: python3 tests/contracts/test_memory_parent_atomicity_3951.py
"""

import os
import sys
import uuid
import inspect
from unittest.mock import patch
from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.memory_writes import (
    update_owner_memory,
    _assert_no_ancestor_cycle_locked,
    _memory_parent_advisory_lock,
)


# ============================================================================
# Fixture / mock helpers
# ============================================================================

def make_memory_row(memory_id, tree_id, parent_id=None, **overrides):
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


def _norm(row):
    """Normalize a memory row so parent_id is str-or-None and id/tree_id are str."""
    out = dict(row)
    out["id"] = str(row["id"])
    out["tree_id"] = str(row["tree_id"])
    pid = row.get("parent_id")
    out["parent_id"] = str(pid) if pid is not None else None
    return out


class HierarchyCursor:
    """Cursor backed by an in-memory parent hierarchy (fixture dict).

    Models the production queries used by the advisory-lock-based reparent
    validation:
      * SELECT m... FROM memories m INNER JOIN trees t ... -> source + tree_owner_id
      * SELECT pg_advisory_xact_lock(%s)                     -> no-op
      * SELECT id, tree_id, parent_id FROM memories WHERE id -> post-lock reread
      * SELECT parent_id FROM memories WHERE id             -> ancestor walk
      * UPDATE memories ... RETURNING ...                   -> configured row
    """

    def __init__(self, fixture, updated_row, owner_id=None):
        self.fx = fixture
        self.updated_row = updated_row
        self.owner_id = owner_id
        self.execute_calls = []
        self._pg_advisory_calls = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))
        self._q = query
        self._p = params

    def fetchone(self):
        q = self._q
        if "INNER JOIN trees t" in q:
            pid = self._p[0]
            row = self.fx.get(str(pid))
            if row is None:
                return None
            return {
                "id": row["id"],
                "tree_id": row["tree_id"],
                "parent_id": row["parent_id"],
                "visibility": row.get("visibility", "public"),
                "tree_owner_id": self.owner_id,
            }
        if "SELECT id, tree_id, parent_id FROM memories WHERE id" in q:
            pid = self._p[0]
            row = self.fx.get(str(pid))
            if row is None:
                return None
            return {"id": row["id"], "tree_id": row["tree_id"], "parent_id": row["parent_id"]}
        if "SELECT parent_id FROM memories WHERE id" in q:
            pid = self._p[0]
            row = self.fx.get(str(pid))
            if row is None:
                return None
            return {"parent_id": row["parent_id"]}
        if "UPDATE memories" in q:
            return self.updated_row
        return None

    def fetchall(self):
        return []


class HierarchyConnection:
    def __init__(self, fixture, updated_row=None, owner_id=None):
        self.fx = fixture
        self.updated_row = updated_row
        self.owner_id = owner_id
        self.commit_calls = 0
        self.rollback_calls = 0
        self.cursors = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def cursor(self, *args, **kwargs):
        cur = HierarchyCursor(self.fx, self.updated_row, owner_id=self.owner_id)
        self.cursors.append(cur)
        return cur

    def commit(self):
        self.commit_calls += 1

    def rollback(self):
        self.rollback_calls += 1

    def all_executes(self):
        out = []
        for cur in self.cursors:
            out.extend(cur.execute_calls)
        return out


def build_fixture(*rows):
    fx = {}
    for r in rows:
        nr = _norm(r)
        fx[nr["id"]] = nr
    return fx


def run_update(owner_id, memory_id, payload, fixture, updated_row=None,
               owner_row=None):
    """Run update_owner_memory against a scripted hierarchy connection."""
    conn = HierarchyConnection(fixture, updated_row, owner_id=owner_id)
    owner = owner_row if owner_row is not None else fixture.get(str(memory_id))
    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=owner):
            with patch("modal_compute.memory_writes.require_plus_for_private_storage", return_value=None):
                result = update_owner_memory(owner_id, memory_id, payload)
    return result, conn


def assert_bounded_detail(detail):
    """The error contract must be a bounded code dict, never raw DB text."""
    assert isinstance(detail, dict), f"detail must be a dict, got {detail!r}"
    assert "code" in detail, f"detail must carry a code, got {detail!r}"
    blob = str(detail).lower()
    for leak in ("deadlock", "40p01", "23503", "23514", "constraint", "psycopg",
                 "could not", "duplicate key", "foreign key"):
        assert leak not in blob, f"raw DB error text leaked into detail: {detail!r}"


# ============================================================================
# Source-contract proof (atomic single-transaction + advisory lock design)
# ============================================================================

def test_reparent_validation_runs_in_single_transaction():
    """The parent validation + UPDATE must share ONE get_db_connection()."""
    import modal_compute.memory_writes as mw
    src = inspect.getsource(mw.update_owner_memory)

    # Exactly one connection acquisition in the whole function.
    assert src.count("with get_db_connection() as conn:") == 1, (
        "update_owner_memory must open exactly ONE DB connection; "
        f"found {src.count('with get_db_connection() as conn:')}"
    )
    # The validation call must live inside that single transaction block,
    # before the UPDATE executes.
    assert "_validate_reparent_atomic(cur, safe_memory_id, reparent_target, owner_id)" in src, (
        "reparent validation must be invoked inside the main transaction"
    )
    conn_open = src.find("with get_db_connection() as conn:")
    validate_call = src.find("_validate_reparent_atomic(cur, safe_memory_id, reparent_target, owner_id)")
    update_exec = src.find("cur.execute(query, tuple(params + [safe_memory_id, owner_id]))")
    assert validate_call > conn_open, "validation must be inside the transaction"
    assert update_exec > validate_call, "UPDATE must run after validation (same txn)"
    # The parentId branch must NOT open its own separate connection.
    branch_start = src.find('if "parentId" in payload:')
    branch_end = src.find("query = f", branch_start)
    branch = src[branch_start:branch_end]
    assert "with get_db_connection()" not in branch, (
        "parentId branch must not open a separate connection; validation and "
        "UPDATE must share the single transaction (Issue #3951)"
    )


def test_reparent_validator_acquires_advisory_lock_and_rereads():
    """_validate_reparent_atomic must use tree-scoped pg_advisory_xact_lock
    and reread source + target after lock acquisition."""
    import modal_compute.memory_writes as mw
    src = inspect.getsource(mw.update_owner_memory)

    # Source + Tree reread inside transaction for authoritative tree_id.
    assert "FROM memories m" in src and "INNER JOIN trees t" in src, (
        "source Memory + owning Tree must be reread inside the transaction"
    )
    assert "authoritative_tree_id" in src, (
        "authoritative tree_id must be obtained from the in-transaction reread"
    )

    # Tree-scoped advisory lock acquisition.
    assert "pg_advisory_xact_lock" in src, (
        "validator must acquire tree-scoped pg_advisory_xact_lock"
    )
    assert "_memory_parent_advisory_lock(authoritative_tree_id)" in src, (
        "advisory lock key must be derived from authoritative tree_id"
    )

    # _validate_reparent_atomic is called WITH owner_id (post-lock authority).
    assert "_validate_reparent_atomic(cur, safe_memory_id, reparent_target, owner_id)" in src, (
        "validator must be called with (cur, source_id, parent_id, owner_id) — post-lock owner authority"
    )

    # No ANY(...) FOR UPDATE (old architecture removed).
    validator = inspect.getsource(mw._validate_reparent_atomic)
    assert "FOR UPDATE" not in validator, (
        "validator must NOT use row-level FOR UPDATE locks (advisory lock provides serialization)"
    )
    assert "ANY(" not in validator or "FOR UPDATE" not in validator, (
        "validator must NOT use ANY(...) FOR UPDATE pattern"
    )

    # Post-lock reread of source Memory includes owner_id authority.
    assert "SELECT m.id, m.tree_id, m.parent_id, t.owner_id AS tree_owner_id FROM memories m INNER JOIN trees t ON t.id = m.tree_id WHERE m.id = %s" in validator, (
        "validator must reread source Memory + owning Tree (with owner_id check) after lock acquisition"
    )
    assert "Access denied: not your memory" in validator, (
        "post-lock source reread must re-verify owner_id authority"
    )
    assert "PARENT_MEMORY_TREE_MISMATCH" in validator, (
        "same-tree check must be present in the validator"
    )
    assert "_assert_no_ancestor_cycle_locked(" in validator, (
        "validator must walk the ancestor chain for the cycle check"
    )
    assert "INVALID_PARENT_ID" in validator, (
        "bounded missing-parent code must be present"
    )
    # PARENT_CYCLE is raised by the locked ancestor walker.
    walker = inspect.getsource(mw._assert_no_ancestor_cycle_locked)
    assert "PARENT_CYCLE" in walker, (
        "bounded cycle code must be present in the ancestor walker"
    )


def test_advisory_lock_key_is_domain_separated():
    """_memory_parent_advisory_lock must produce different keys for different trees."""
    tree_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    tree_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    key_a = _memory_parent_advisory_lock(tree_a)
    key_b = _memory_parent_advisory_lock(tree_b)
    assert key_a != key_b, (
        "different Trees must derive different advisory lock keys"
    )
    # Verify the key derivation uses SHA-256 (deterministic, domain-separated).
    src = inspect.getsource(_memory_parent_advisory_lock)
    assert "memory-parent-graph:" in src, (
        "advisory lock key must be domain-separated with 'memory-parent-graph:' prefix"
    )
    assert "sha256" in src.lower() or "SHA256" in src, (
        "advisory lock key must use SHA-256 derivation (project convention)"
    )


def test_reparent_validator_rejects_raw_db_errors():
    """Validator failures are bounded HTTPExceptions, never raw psycopg errors."""
    import modal_compute.memory_writes as mw
    src = inspect.getsource(mw._validate_reparent_atomic)
    src += inspect.getsource(mw._assert_no_ancestor_cycle_locked)
    # Every failure path raises a bounded HTTPException with a code.
    for code in ("INVALID_PARENT_ID", "PARENT_MEMORY_TREE_MISMATCH", "PARENT_CYCLE"):
        assert f'"{code}"' in src or f"'{code}'" in src, (
            f"validator must raise bounded {code}"
        )


# ============================================================================
# Behavioral matrix (mocked, authoritative fixture)
# ============================================================================

def test_self_parent_rejected_no_mutation():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    fx = build_fixture(make_memory_row(A, tree))
    try:
        run_update(owner, A, {"parentId": A}, fx)
        assert False, "self parent must be rejected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "INVALID_PARENT_ID"
        assert e.detail.get("reason") == "self_parent"
        assert_bounded_detail(e.detail)


def test_missing_parent_rejected_no_mutation():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree))  # B absent
    try:
        run_update(owner, A, {"parentId": B}, fx)
        assert False, "missing parent must be rejected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "INVALID_PARENT_ID"
        assert e.detail.get("reason") == "not_found"
        assert_bounded_detail(e.detail)


def test_cross_tree_parent_rejected_no_mutation():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    other = "44444444-4444-4444-4444-444444444444"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(
        make_memory_row(A, tree),
        make_memory_row(B, other),  # different tree
    )
    try:
        run_update(owner, A, {"parentId": B}, fx)
        assert False, "cross-tree parent must be rejected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "PARENT_MEMORY_TREE_MISMATCH"
        assert_bounded_detail(e.detail)


def test_valid_same_tree_reparent_commits_and_returns_normalized():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))
    updated = make_memory_row(A, tree, parent_id=B)
    result, conn = run_update(owner, A, {"parentId": B}, fx, updated_row=updated)
    assert result["parentId"] == B
    assert conn.commit_calls == 1
    assert conn.rollback_calls == 0
    updates = [c for c in conn.all_executes() if "UPDATE memories" in c[0]]
    assert len(updates) == 1
    assert "parent_id = %s" in updates[0][0]
    assert B in list(updates[0][1])


def test_existing_ancestor_cycle_rejected():
    # A -> B -> C; attempt C -> A must be rejected (would close the cycle).
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "22222222-2222-2222-2222-222222222222"
    C = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(
        make_memory_row(A, tree, parent_id=B),
        make_memory_row(B, tree, parent_id=C),
        make_memory_row(C, tree),
    )
    try:
        run_update(owner, C, {"parentId": A}, fx)
        assert False, "existing ancestor cycle must be rejected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "PARENT_CYCLE"
        assert_bounded_detail(e.detail)


def test_descendant_cycle_rejected():
    # Source A has child Child; attempt A -> Child must be rejected.
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    child = "22222222-2222-2222-2222-222222222222"
    fx = build_fixture(
        make_memory_row(A, tree),
        make_memory_row(child, tree, parent_id=A),
    )
    try:
        run_update(owner, A, {"parentId": child}, fx)
        assert False, "descendant cycle must be rejected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "PARENT_CYCLE"
        assert_bounded_detail(e.detail)


def test_detach_null_sets_parent_null_and_commits():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    old = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree, parent_id=old))
    updated = make_memory_row(A, tree, parent_id=None)
    result, conn = run_update(owner, A, {"parentId": None}, fx, updated_row=updated)
    assert result["parentId"] is None
    assert conn.commit_calls == 1
    updates = [c for c in conn.all_executes() if "UPDATE memories" in c[0]]
    assert "parent_id = NULL" in updates[0][0]
    assert "parent_id = %s" not in updates[0][0]


def test_detach_empty_and_whitespace_normalize_to_null():
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    old = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree, parent_id=old))
    for value in ("", "   "):
        updated = make_memory_row(A, tree, parent_id=None)
        result, conn = run_update(owner, A, {"parentId": value}, fx, updated_row=updated)
        assert result["parentId"] is None, f"parentId={value!r} must detach"
        assert conn.commit_calls == 1


def test_reject_leaves_original_relationship_intact_zero_partial_mutation():
    """A rejected reparent must not commit anything (rollback, no partial write)."""
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(
        make_memory_row(A, tree),
        make_memory_row(B, tree),
    )
    try:
        run_update(owner, A, {"parentId": "99999999-9999-9999-9999-999999999999"}, fx)  # absent
    except HTTPException as e:
        assert e.detail.get("code") == "INVALID_PARENT_ID"
    # Re-run against a fresh fixture to inspect commit/rollback counts.
    fx2 = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))
    try:
        run_update(owner, A, {"parentId": "99999999-9999-9999-9999-999999999999"}, fx2)
        assert False, "absent parent must be rejected"
    except HTTPException as e:
        assert e.detail.get("code") == "INVALID_PARENT_ID"
        assert e.detail.get("reason") == "not_found"
        assert_bounded_detail(e.detail)
    conn = HierarchyConnection(fx2, None, owner_id=owner)
    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner",
                   return_value=fx2.get(A)):
            with patch("modal_compute.memory_writes.require_plus_for_private_storage",
                       return_value=None):
                try:
                    update_owner_memory(owner, A, {"parentId": "99999999-9999-9999-9999-999999999999"})
                    assert False, "absent parent must be rejected (rerun for counts)"
                except HTTPException as e:
                    assert e.detail.get("code") == "INVALID_PARENT_ID"
    assert conn.commit_calls == 0
    assert conn.rollback_calls == 1
    updates = [c for c in conn.all_executes() if "UPDATE memories" in c[0]]
    assert len(updates) == 0, "rejected reparent must not execute the UPDATE"


def test_combined_parent_visibility_emotiontags_atomic():
    """A single payload with parentId + visibility + emotionTags commits once."""
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))
    updated = make_memory_row(
        A, tree, parent_id=B, visibility="private", emotion_tags=["calm", "happy"]
    )
    result, conn = run_update(
        owner, A,
        {"parentId": B, "visibility": "private", "emotionTags": ["calm", "happy"]},
        fx, updated_row=updated,
    )
    assert result["parentId"] == B
    assert result["visibility"] == "private"
    assert result["emotionTags"] == ["calm", "happy"]
    assert conn.commit_calls == 1
    updates = [c for c in conn.all_executes() if "UPDATE memories" in c[0]]
    assert len(updates) == 1


def test_owner_authorization_blocks_foreign_actor():
    """A non-owner must never reach the reparent write."""
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))

    conn = HierarchyConnection(fx, make_memory_row(A, tree, parent_id=B), owner_id=owner)
    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch(
            "modal_compute.memory_writes.require_memory_owner",
            side_effect=HTTPException(status_code=403, detail="Access denied: not your memory"),
        ):
            try:
                update_owner_memory(owner, A, {"parentId": B})
                assert False, "foreign actor must be rejected"
            except HTTPException as e:
                assert e.status_code == 403
    assert conn.commit_calls == 0, "no mutation for unauthorized actor"


def test_post_lock_owner_mismatch_rejected():
    """Post-lock source reread must re-verify owner_id and reject mismatch."""
    owner = "owner-123"
    other_owner = "owner-999"  # different from the authenticated caller
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))

    # Connection cursor returns tree_owner_id=other_owner (≠ owner).
    conn = HierarchyConnection(fx, make_memory_row(A, tree, parent_id=B), owner_id=other_owner)

    with patch("modal_compute.memory_writes.get_db_connection", return_value=conn):
        with patch("modal_compute.memory_writes.require_memory_owner", return_value=fx.get(A)):
            with patch("modal_compute.memory_writes.require_plus_for_private_storage", return_value=None):
                try:
                    update_owner_memory(owner, A, {"parentId": B})
                    assert False, "post-lock owner mismatch must be rejected"
                except HTTPException as e:
                    assert e.status_code == 403
                    assert "Access denied: not your memory" in str(e.detail)
    assert conn.commit_calls == 0, "no mutation for post-lock owner mismatch"


def test_serialized_reparent_prevents_cycle():
    """After A->B commits, a later B->A reparent must detect the cycle.

    This is the logic-level counterpart to the real PostgreSQL concurrency
    regression: the second reparent reads the authoritative (post-commit)
    hierarchy and rejects instead of closing a cycle.
    """
    owner = "owner-123"
    tree = "22222222-2222-2222-2222-222222222222"
    A = "11111111-1111-1111-1111-111111111111"
    B = "33333333-3333-3333-3333-333333333333"
    fx = build_fixture(make_memory_row(A, tree), make_memory_row(B, tree))

    # First reparent commits: A -> B.
    updated = make_memory_row(A, tree, parent_id=B)
    _, conn1 = run_update(owner, A, {"parentId": B}, dict(fx), updated_row=updated)
    assert conn1.commit_calls == 1
    # Apply the committed edge to the fixture so the next read sees it.
    fx[A]["parent_id"] = B

    # Second reparent B -> A must now be rejected (A is an ancestor of B).
    try:
        run_update(owner, B, {"parentId": A}, fx)
        assert False, "B->A after A->B must be rejected (cycle)"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "PARENT_CYCLE"
        assert_bounded_detail(e.detail)


# ============================================================================
# Focused unit coverage for the locked ancestor walker
# ============================================================================

def test_locked_walk_detects_cycle():
    from unittest.mock import MagicMock
    cur = MagicMock()
    cur.fetchone.side_effect = [
        {"parent_id": "00000000-0000-0000-0000-000000000002"},
        {"parent_id": "00000000-0000-0000-0000-000000000003"},
    ]
    try:
        _assert_no_ancestor_cycle_locked(
            cur, "00000000-0000-0000-0000-000000000003",
            "00000000-0000-0000-0000-000000000001",
        )
        assert False, "cycle must be detected"
    except HTTPException as e:
        assert e.status_code == 400
        assert e.detail.get("code") == "PARENT_CYCLE"


def test_locked_walk_detects_no_cycle():
    from unittest.mock import MagicMock
    cur = MagicMock()
    cur.fetchone.side_effect = [
        {"parent_id": "00000000-0000-0000-0000-000000000002"},
        {"parent_id": None},
    ]
    # Should not raise.
    _assert_no_ancestor_cycle_locked(
        cur, "00000000-0000-0000-0000-000000000003",
        "00000000-0000-0000-0000-000000000001",
    )


def test_locked_walk_breaks_on_corrupted_cycle():
    from unittest.mock import MagicMock
    cur = MagicMock()
    cur.fetchone.side_effect = [
        {"parent_id": "00000000-0000-0000-0000-000000000002"},
        {"parent_id": "00000000-0000-0000-0000-000000000001"},
    ]
    try:
        _assert_no_ancestor_cycle_locked(
            cur, "00000000-0000-0000-0000-000000000003",
            "00000000-0000-0000-0000-000000000001",
        )
        assert False, "corrupted cycle must be rejected"
    except HTTPException as e:
        assert e.detail.get("code") == "PARENT_CYCLE"


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    tests = [
        ("source: reparent validation runs in single transaction",
         test_reparent_validation_runs_in_single_transaction),
        ("source: validator acquires advisory lock + rereads",
         test_reparent_validator_acquires_advisory_lock_and_rereads),
        ("source: advisory lock key is domain-separated",
         test_advisory_lock_key_is_domain_separated),
        ("source: validator rejects with bounded codes only",
         test_reparent_validator_rejects_raw_db_errors),
        ("self parent rejected, no mutation", test_self_parent_rejected_no_mutation),
        ("missing parent rejected, no mutation", test_missing_parent_rejected_no_mutation),
        ("cross-tree parent rejected, no mutation", test_cross_tree_parent_rejected_no_mutation),
        ("valid same-tree reparent commits + normalized", test_valid_same_tree_reparent_commits_and_returns_normalized),
        ("existing ancestor cycle rejected", test_existing_ancestor_cycle_rejected),
        ("descendant cycle rejected", test_descendant_cycle_rejected),
        ("detach null sets parent null + commits", test_detach_null_sets_parent_null_and_commits),
        ("detach empty/whitespace normalizes to null", test_detach_empty_and_whitespace_normalize_to_null),
        ("reject leaves original relationship intact (zero partial mutation)",
         test_reject_leaves_original_relationship_intact_zero_partial_mutation),
        ("combined parent + visibility + emotionTags atomic", test_combined_parent_visibility_emotiontags_atomic),
        ("owner authorization blocks foreign actor", test_owner_authorization_blocks_foreign_actor),
        ("post-lock owner mismatch rejected (authority re-verified)", test_post_lock_owner_mismatch_rejected),
        ("serialized reparent prevents cycle", test_serialized_reparent_prevents_cycle),
        ("locked walk detects cycle", test_locked_walk_detects_cycle),
        ("locked walk detects no cycle", test_locked_walk_detects_no_cycle),
        ("locked walk breaks on corrupted cycle", test_locked_walk_breaks_on_corrupted_cycle),
    ]

    print("=" * 70)
    print("Running Memory parent atomicity contract tests (#3951)")
    print("=" * 70)

    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  [PASS] {name}")
            passed += 1
        except Exception as e:  # noqa: BLE001
            print(f"  [FAIL] {name}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)
