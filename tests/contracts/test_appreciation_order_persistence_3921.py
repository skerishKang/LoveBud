#!/usr/bin/env python3
"""
Executable contract tests for Issue #3921 — appreciation-order persistence.

Verifies the dedicated persistence module (modal_compute.appreciation_orders)
actually persists to tree_appreciation_orders and that POST -> GET converge,
with owner/membership/duplicate/no-mutation negative controls.

Design constraints honored:
- Does NOT modify tree_writes.py or validation.py (comp2 #3935 ownership).
- No Production/Preview/real DB mutation (fully in-memory FakeDB).
- No generic update_owner_tree / appreciationOrder usage.

Run: python3 tests/contracts/test_appreciation_order_persistence_3921.py
"""

import json
import os
import sys
import uuid
from typing import Any

from fastapi import HTTPException
from unittest.mock import patch, MagicMock

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

import modal_compute.appreciation_orders as appr  # noqa: E402


# ============================================================================
# In-memory FakeDB + FakeCursor
# ============================================================================

class FakeDB:
    def __init__(self):
        # trees: tree_id -> {"id": str, "owner_id": str}
        self.trees: dict[str, dict[str, str]] = {}
        # memories: set of (tree_id, memory_id)
        self.memories: set[tuple[str, str]] = set()
        # orders: tree_id -> list[str]
        self.orders: dict[str, list[str]] = {}


class FakeCursor:
    def __init__(self, db: FakeDB):
        self.db = db
        self._row: Any = None
        self._rows: list[dict] = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query: str, params=None):
        q = query
        p = list(params or ())
        if "FROM trees" in q and "WHERE id = %s" in q:
            tid = p[0]
            self._row = self.db.trees.get(tid)
        elif "FROM memories m" in q and "ANY" in q:
            tid = p[0]
            ids = set(p[1]) if isinstance(p[1], (list, tuple, set)) else set()
            self._rows = [
                {"id": mid} for (t, mid) in self.db.memories if t == tid and mid in ids
            ]
        elif "INSERT INTO tree_appreciation_orders" in q:
            tid = p[0]
            ordered = json.loads(p[1]) if isinstance(p[1], str) else p[1]
            self.db.orders[tid] = ordered
            self._row = {"tree_id": tid}
        elif "FROM tree_appreciation_orders" in q and "ordered_ids" in q:
            tid = p[0]
            self._row = {"ordered_ids": self.db.orders[tid]} if tid in self.db.orders else None
        else:
            self._row = None

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows


class FakeConnection:
    def __init__(self, db: FakeDB):
        self.db = db
        self.commit_calls = 0
        self.rollback_calls = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self, *args, **kwargs):
        return FakeCursor(self.db)

    def commit(self):
        self.commit_calls += 1

    def rollback(self):
        self.rollback_calls += 1


def make_fake_env():
    """Build a FakeDB seeded with one owner tree, a foreign tree, and memories."""
    db = FakeDB()
    owner = "owner-3921"
    tree_id = str(uuid.uuid4())
    foreign_tree = str(uuid.uuid4())

    db.trees[tree_id] = {"id": tree_id, "owner_id": owner}
    db.trees[foreign_tree] = {"id": foreign_tree, "owner_id": "other-owner"}

    own_mem = [str(uuid.uuid4()) for _ in range(4)]
    foreign_mem = str(uuid.uuid4())

    for mid in own_mem:
        db.memories.add((tree_id, mid))
    db.memories.add((foreign_tree, foreign_mem))

    env = {
        "db": db,
        "owner": owner,
        "tree_id": tree_id,
        "foreign_tree": foreign_tree,
        "own_mem": own_mem,
        "foreign_mem": foreign_mem,
    }
    return env


def fake_require_tree_owner_factory(env):
    """Return a require_tree_owner replacement bound to FakeDB.trees."""

    def fake_require_tree_owner(tree_id, owner_id):
        tree = env["db"].trees.get(tree_id)
        if not tree:
            raise HTTPException(status_code=404, detail="Tree not found")
        if str(tree.get("owner_id") or "") != owner_id:
            raise HTTPException(status_code=403, detail="Access denied: not your tree")
        return tree

    return fake_require_tree_owner


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
# Persistence + convergence
# ============================================================================

def test_post_persists_and_converges():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        order = env["own_mem"][:3]
        res = appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": order})
        assert res == {"ok": True}, f"unexpected POST response: {res}"

        # No generic tree mutation path: ensure only the dedicated table changed.
        got = appr.fetch_appreciation_order(env["tree_id"], env["owner"])
        assert got == {"orderedIds": order}, f"GET did not converge: {got}"

        # Persisted in the dedicated table exactly.
        assert env["tree_id"] in db.orders, "order not persisted to dedicated table"
        assert db.orders[env["tree_id"]] == order, "persisted order mismatch"


def test_partial_order_allowed():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        # Subset of the tree's memories is a valid partial order.
        order = [env["own_mem"][0], env["own_mem"][2]]
        appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": order})
        got = appr.fetch_appreciation_order(env["tree_id"], env["owner"])
        assert got == {"orderedIds": order}, f"partial order mismatch: {got}"


def test_no_row_returns_empty_array():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        # Tree with no explicit order row -> GET returns orderedIds: []
        got = appr.fetch_appreciation_order(env["tree_id"], env["owner"])
        assert got == {"orderedIds": []}, f"expected empty array, got {got}"
        assert env["tree_id"] not in db.orders, "GET must not create a row"


def test_empty_order_upserted_as_array():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": []})
        got = appr.fetch_appreciation_order(env["tree_id"], env["owner"])
        assert got == {"orderedIds": []}, f"empty order mismatch: {got}"


# ============================================================================
# Negative controls
# ============================================================================

def test_duplicate_ids_rejected_no_mutation():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        try:
            appr.save_appreciation_order(
                env["tree_id"], env["owner"],
                {"order": [env["own_mem"][0], env["own_mem"][0]]},
            )
            assert False, "duplicate ids should raise"
        except HTTPException as e:
            assert e.status_code == 400, f"expected 400, got {e.status_code}"
        # zero mutation
        assert db.orders == before, "duplicate order must not mutate persistence"


def test_non_array_order_rejected():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        try:
            appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": "not-array"})
            assert False, "non-array order should raise"
        except HTTPException as e:
            assert e.status_code == 400
        assert db.orders == before, "non-array order must not mutate"


def test_bounded_count_rejected():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        big = [str(uuid.uuid4()) for _ in range(appr.MAX_ORDER_ITEMS + 1)]
        try:
            appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": big})
            assert False, "oversized order should raise"
        except HTTPException as e:
            assert e.status_code == 400
        assert db.orders == before, "oversized order must not mutate"


def test_nonexistent_memory_rejected_no_mutation():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        ghost = str(uuid.uuid4())  # not in any tree
        try:
            appr.save_appreciation_order(
                env["tree_id"], env["owner"], {"order": [env["own_mem"][0], ghost]}
            )
            assert False, "ghost memory should raise"
        except HTTPException as e:
            assert e.status_code == 400, f"expected 400, got {e.status_code}"
        assert db.orders == before, "ghost memory must not mutate persistence"


def test_foreign_memory_rejected_no_mutation():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        # Memory belongs to another tree -> must reject (same-owner rule is
        # tree-scoped, not owner-scoped).
        try:
            appr.save_appreciation_order(
                env["tree_id"], env["owner"],
                {"order": [env["own_mem"][0], env["foreign_mem"]]},
            )
            assert False, "cross-tree memory should raise"
        except HTTPException as e:
            assert e.status_code == 400, f"expected 400, got {e.status_code}"
        assert db.orders == before, "cross-tree memory must not mutate persistence"


def test_foreign_owner_rejected_no_mutation():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        try:
            appr.save_appreciation_order(
                env["tree_id"], "attacker-owner", {"order": env["own_mem"]}
            )
            assert False, "foreign owner should raise"
        except HTTPException as e:
            assert e.status_code == 403, f"expected 403, got {e.status_code}"
        assert db.orders == before, "foreign owner must not mutate persistence"


def test_nonexistent_tree_rejected_no_mutation():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        ghost_tree = str(uuid.uuid4())
        try:
            appr.save_appreciation_order(ghost_tree, env["owner"], {"order": []})
            assert False, "ghost tree should raise"
        except HTTPException as e:
            assert e.status_code == 404, f"expected 404, got {e.status_code}"
        assert db.orders == before, "ghost tree must not mutate persistence"


def test_malformed_tree_id_rejected():
    env = make_fake_env()
    db = env["db"]
    patcher_owner = patch(
        "modal_compute.appreciation_orders.require_tree_owner",
        fake_require_tree_owner_factory(env),
    )
    patcher_conn = patch(
        "modal_compute.appreciation_orders.get_db_connection",
        lambda: FakeConnection(db),
    )
    with patcher_owner, patcher_conn:
        before = dict(db.orders)
        try:
            appr.save_appreciation_order("not-a-uuid", env["owner"], {"order": []})
            assert False, "malformed tree id should raise"
        except HTTPException as e:
            assert e.status_code == 400, f"expected 400, got {e.status_code}"
        assert db.orders == before, "malformed tree id must not mutate persistence"


# ============================================================================
# Route wiring + source contract
# ============================================================================

def test_route_wiring_uses_dedicated_persistence():
    import asyncio
    import modal_compute.app as app_module

    owner = "owner-route"
    tree_id = str(uuid.uuid4())

    spy_save = MagicMock(return_value={"ok": True})
    spy_fetch = MagicMock(return_value={"orderedIds": ["m1"]})
    boom = MagicMock(side_effect=AssertionError("generic update_owner_tree must not be used"))

    with patch.object(app_module, "require_firebase_user", return_value={"uid": owner}), \
         patch.object(app_module, "parse_json_body", return_value={"order": ["m1", "m2"]}), \
         patch.object(app_module, "save_appreciation_order", spy_save), \
         patch.object(app_module, "fetch_appreciation_order", spy_fetch), \
         patch.object(app_module, "update_owner_tree", boom):
        from fastapi import Request
        req = MagicMock(spec=Request)

        async def _run():
            await app_module.post_appreciation_order(tree_id, req, "auth")
            app_module.get_appreciation_order(tree_id, "auth")

        asyncio.run(_run())

    spy_save.assert_called_once_with(tree_id, owner, {"order": ["m1", "m2"]})
    spy_fetch.assert_called_once_with(tree_id, owner)
    boom.assert_not_called()


def test_source_contract_no_generic_tree_mutation():
    import inspect
    src = inspect.getsource(appr)
    # Must use the dedicated table.
    assert "tree_appreciation_orders" in src, "must persist to tree_appreciation_orders"
    # Must NOT route through the generic tree writer.
    assert "update_owner_tree" not in src, "must not use generic update_owner_tree"
    assert "appreciationOrder" not in src, "must not stash under generic appreciationOrder field"
    # UPSERT boundary present.
    assert "ON CONFLICT (tree_id)" in src, "must UPSERT on the dedicated table"
    # Membership + ownership validation present.
    assert "require_tree_owner" in src, "must validate tree ownership"
    assert "FROM memories m" in src and "ANY" in src, "must validate memory membership"


if __name__ == "__main__":
    tests = [
        ("POST persists to dedicated table + POST->GET convergence", test_post_persists_and_converges),
        ("Partial order (subset of memories) allowed", test_partial_order_allowed),
        ("No row -> GET orderedIds: [] (no row created)", test_no_row_returns_empty_array),
        ("Empty order UPSERTs as array", test_empty_order_upserted_as_array),
        ("Duplicate IDs -> 400, mutation 0", test_duplicate_ids_rejected_no_mutation),
        ("Non-array order -> 400, mutation 0", test_non_array_order_rejected),
        ("Oversized order -> 400, mutation 0", test_bounded_count_rejected),
        ("Nonexistent Memory -> 400, mutation 0", test_nonexistent_memory_rejected_no_mutation),
        ("Foreign-tree Memory -> 400, mutation 0", test_foreign_memory_rejected_no_mutation),
        ("Foreign owner -> 403, mutation 0", test_foreign_owner_rejected_no_mutation),
        ("Nonexistent Tree -> 404, mutation 0", test_nonexistent_tree_rejected_no_mutation),
        ("Malformed tree id -> 400, mutation 0", test_malformed_tree_id_rejected),
        ("Route wiring uses dedicated persistence (no update_owner_tree)", test_route_wiring_uses_dedicated_persistence),
        ("Source contract: dedicated table, no generic tree mutation", test_source_contract_no_generic_tree_mutation),
    ]

    print("=" * 70)
    print("Running appreciation-order persistence (#3921) contract tests")
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
