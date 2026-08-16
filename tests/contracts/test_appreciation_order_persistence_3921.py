#!/usr/bin/env python3
"""Executable contract tests for Issue #3921 appreciation-order persistence.

The tests are hermetic: no Production/Preview/real DB access. They exercise the
real persistence helper against an in-memory SQL-aware fake so ownership,
membership, UPSERT acknowledgement, payload strictness, TEXT ids, and
capability-failure behavior remain explicit.

Run: python3 tests/contracts/test_appreciation_order_persistence_3921.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any
from unittest.mock import MagicMock, patch

import psycopg
from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

import modal_compute.appreciation_orders as appr  # noqa: E402


class FakeDB:
    def __init__(self) -> None:
        self.trees: dict[str, dict[str, str]] = {}
        self.memories: set[tuple[str, str]] = set()
        self.orders: dict[str, list[str]] = {}
        self.missing_orders_table = False


class FakeCursor:
    def __init__(self, conn: "FakeConnection") -> None:
        self.conn = conn
        self.db = conn.db
        self._row: Any = None
        self._rows: list[dict[str, Any]] = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query: str, params=None) -> None:
        q = query
        p = list(params or ())
        self.conn.queries.append(q)
        self._row = None
        self._rows = []

        if "FROM trees t" in q and "WHERE t.id = %s" in q:
            tree_id = p[0]
            self._row = self.db.trees.get(tree_id)
            return

        if "FROM memories m" in q and "ANY" in q:
            tree_id = p[0]
            requested = set(p[1]) if isinstance(p[1], (list, tuple, set)) else set()
            self._rows = [
                {"id": memory_id}
                for candidate_tree, memory_id in self.db.memories
                if candidate_tree == tree_id and memory_id in requested
            ]
            return

        if "tree_appreciation_orders" in q and self.db.missing_orders_table:
            raise psycopg.errors.UndefinedTable("relation does not exist")

        if "INSERT INTO tree_appreciation_orders" in q:
            tree_id = p[0]
            ordered = json.loads(p[1]) if isinstance(p[1], str) else list(p[1])
            self.db.orders[tree_id] = list(ordered)
            self._row = {"ordered_ids": list(ordered)}
            return

        if "FROM tree_appreciation_orders" in q and "ordered_ids" in q:
            tree_id = p[0]
            self._row = (
                {"ordered_ids": list(self.db.orders[tree_id])}
                if tree_id in self.db.orders
                else None
            )
            return

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows


class FakeConnection:
    def __init__(self, db: FakeDB) -> None:
        self.db = db
        self.commit_calls = 0
        self.rollback_calls = 0
        self.queries: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self, *args, **kwargs):
        return FakeCursor(self)

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1


def make_fake_env(*, tree_id: str = "tree-text-3921") -> dict[str, Any]:
    db = FakeDB()
    owner = "owner-3921"
    foreign_tree = "tree-foreign-3921"
    own_mem = [f"memory-{index}-3921" for index in range(4)]
    foreign_mem = "memory-foreign-3921"

    db.trees[tree_id] = {"id": tree_id, "owner_id": owner}
    db.trees[foreign_tree] = {"id": foreign_tree, "owner_id": "other-owner"}
    for memory_id in own_mem:
        db.memories.add((tree_id, memory_id))
    db.memories.add((foreign_tree, foreign_mem))

    return {
        "db": db,
        "owner": owner,
        "tree_id": tree_id,
        "foreign_tree": foreign_tree,
        "own_mem": own_mem,
        "foreign_mem": foreign_mem,
    }


def connection_patch(db: FakeDB):
    connections: list[FakeConnection] = []

    def factory():
        conn = FakeConnection(db)
        connections.append(conn)
        return conn

    return patch("modal_compute.appreciation_orders.get_db_connection", side_effect=factory), connections


def assert_raises_status(expected_status: int, fn):
    try:
        fn()
    except HTTPException as error:
        assert error.status_code == expected_status, (error.status_code, error.detail)
        return error
    raise AssertionError(f"expected HTTP {expected_status}")


def run_test(name, fn):
    try:
        fn()
        print(f"  PASS: {name}")
        return True
    except Exception as error:
        print(f"  FAIL: {name}: {type(error).__name__}: {error}")
        import traceback

        traceback.print_exc()
        return False


def test_post_persists_returns_canonical_and_get_converges():
    env = make_fake_env()
    patcher, connections = connection_patch(env["db"])
    order = env["own_mem"][:3]

    with patcher:
        saved = appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": order})
        assert saved == {"orderedIds": order}
        assert env["db"].orders[env["tree_id"]] == order

        # The write uses exactly one connection for owner lock + membership + UPSERT.
        assert len(connections) == 1
        write_conn = connections[0]
        assert write_conn.commit_calls == 1
        owner_index = next(i for i, q in enumerate(write_conn.queries) if "FROM trees t" in q)
        membership_index = next(i for i, q in enumerate(write_conn.queries) if "FROM memories m" in q)
        upsert_index = next(i for i, q in enumerate(write_conn.queries) if "INSERT INTO tree_appreciation_orders" in q)
        assert owner_index < membership_index < upsert_index
        assert "FOR SHARE OF t" in write_conn.queries[owner_index]
        assert "FOR SHARE OF m" in write_conn.queries[membership_index]

        got = appr.fetch_appreciation_order(env["tree_id"], env["owner"])
        assert got == {"orderedIds": order}


def test_non_uuid_text_tree_id_is_supported():
    env = make_fake_env(tree_id="legacy-text-tree-id")
    patcher, _ = connection_patch(env["db"])
    with patcher:
        saved = appr.save_appreciation_order(
            "legacy-text-tree-id",
            env["owner"],
            {"order": [env["own_mem"][0]]},
        )
        assert saved == {"orderedIds": [env["own_mem"][0]]}
        assert appr.fetch_appreciation_order("legacy-text-tree-id", env["owner"]) == saved


def test_memory_ids_are_trimmed_to_canonical_strings():
    env = make_fake_env()
    patcher, _ = connection_patch(env["db"])
    memory_id = env["own_mem"][0]
    with patcher:
        saved = appr.save_appreciation_order(
            env["tree_id"], env["owner"], {"order": [f"  {memory_id}  "]}
        )
    assert saved == {"orderedIds": [memory_id]}
    assert env["db"].orders[env["tree_id"]] == [memory_id]


def test_partial_and_empty_orders_are_intentional_writes():
    env = make_fake_env()
    patcher, _ = connection_patch(env["db"])
    with patcher:
        partial = [env["own_mem"][0], env["own_mem"][2]]
        assert appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": partial}) == {
            "orderedIds": partial
        }
        assert appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": []}) == {
            "orderedIds": []
        }
        assert appr.fetch_appreciation_order(env["tree_id"], env["owner"]) == {"orderedIds": []}


def test_no_row_returns_empty_array_without_creating_row():
    env = make_fake_env()
    patcher, _ = connection_patch(env["db"])
    with patcher:
        assert appr.fetch_appreciation_order(env["tree_id"], env["owner"]) == {"orderedIds": []}
    assert env["tree_id"] not in env["db"].orders


def test_missing_order_or_unknown_fields_rejected_before_db():
    env = make_fake_env()
    db_mock = MagicMock()
    cases = [
        ({}, "APPRECIATION_ORDER_REQUIRED"),
        ({"ordr": []}, "APPRECIATION_ORDER_REQUIRED"),
        ({"order": [], "unknown": 1}, "APPRECIATION_ORDER_UNKNOWN_FIELD"),
    ]
    with patch("modal_compute.appreciation_orders.get_db_connection", db_mock):
        for payload, code in cases:
            error = assert_raises_status(
                400,
                lambda payload=payload: appr.save_appreciation_order(
                    env["tree_id"], env["owner"], payload
                ),
            )
            assert isinstance(error.detail, dict)
            assert error.detail.get("code") == code
    assert db_mock.call_count == 0
    assert env["db"].orders == {}


def test_non_array_and_bad_items_rejected_before_db():
    env = make_fake_env()
    db_mock = MagicMock()
    bad_orders = ["not-array", None, [1], [True], [{}], [[]], ["   "]]
    with patch("modal_compute.appreciation_orders.get_db_connection", db_mock):
        for bad_order in bad_orders:
            assert_raises_status(
                400,
                lambda bad_order=bad_order: appr.save_appreciation_order(
                    env["tree_id"], env["owner"], {"order": bad_order}
                ),
            )
    assert db_mock.call_count == 0


def test_duplicate_after_trim_rejected_before_db():
    env = make_fake_env()
    memory_id = env["own_mem"][0]
    db_mock = MagicMock()
    with patch("modal_compute.appreciation_orders.get_db_connection", db_mock):
        assert_raises_status(
            400,
            lambda: appr.save_appreciation_order(
                env["tree_id"], env["owner"], {"order": [memory_id, f" {memory_id} "]}
            ),
        )
    assert db_mock.call_count == 0


def test_oversized_order_rejected_before_db():
    env = make_fake_env()
    db_mock = MagicMock()
    big = [f"memory-{index}" for index in range(appr.MAX_ORDER_ITEMS + 1)]
    with patch("modal_compute.appreciation_orders.get_db_connection", db_mock):
        assert_raises_status(
            400,
            lambda: appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": big}),
        )
    assert db_mock.call_count == 0


def test_nonexistent_or_foreign_memory_rejected_no_upsert():
    for target in ("missing-memory", "foreign"):
        env = make_fake_env()
        patcher, connections = connection_patch(env["db"])
        bad_memory = "does-not-exist" if target == "missing-memory" else env["foreign_mem"]
        before = dict(env["db"].orders)
        with patcher:
            assert_raises_status(
                400,
                lambda: appr.save_appreciation_order(
                    env["tree_id"], env["owner"], {"order": [bad_memory]}
                ),
            )
        assert env["db"].orders == before
        assert len(connections) == 1
        assert connections[0].rollback_calls == 1
        assert not any("INSERT INTO tree_appreciation_orders" in q for q in connections[0].queries)


def test_foreign_owner_and_missing_tree_rejected_no_upsert():
    env = make_fake_env()
    patcher, connections = connection_patch(env["db"])
    with patcher:
        assert_raises_status(
            403,
            lambda: appr.save_appreciation_order(
                env["tree_id"], "attacker", {"order": [env["own_mem"][0]]}
            ),
        )
        assert_raises_status(
            404,
            lambda: appr.save_appreciation_order("missing-tree", env["owner"], {"order": []}),
        )
    assert env["db"].orders == {}
    for conn in connections:
        assert not any("INSERT INTO tree_appreciation_orders" in q for q in conn.queries)


def test_required_text_tree_id_validation_rejects_empty_only():
    env = make_fake_env()
    db_mock = MagicMock()
    with patch("modal_compute.appreciation_orders.get_db_connection", db_mock):
        for bad_tree_id in ("", "   ", None, 123):
            assert_raises_status(
                400,
                lambda bad_tree_id=bad_tree_id: appr.save_appreciation_order(
                    bad_tree_id, env["owner"], {"order": []}
                ),
            )
    assert db_mock.call_count == 0


def test_missing_storage_table_is_sanitized_503_and_no_false_success():
    env = make_fake_env()
    env["db"].missing_orders_table = True
    patcher, connections = connection_patch(env["db"])
    before = dict(env["db"].orders)
    with patcher:
        error = assert_raises_status(
            503,
            lambda: appr.save_appreciation_order(env["tree_id"], env["owner"], {"order": []}),
        )
    assert error.detail == {"code": "APPRECIATION_ORDER_STORAGE_UNAVAILABLE"}
    assert "relation" not in str(error.detail).lower()
    assert env["db"].orders == before
    assert len(connections) == 1
    assert connections[0].commit_calls == 0


def test_missing_storage_table_get_is_sanitized_503():
    env = make_fake_env()
    env["db"].missing_orders_table = True
    patcher, _ = connection_patch(env["db"])
    with patcher:
        error = assert_raises_status(
            503,
            lambda: appr.fetch_appreciation_order(env["tree_id"], env["owner"]),
        )
    assert error.detail == {"code": "APPRECIATION_ORDER_STORAGE_UNAVAILABLE"}


def test_route_wiring_uses_dedicated_persistence_and_returns_writer_response():
    import modal_compute.app as app_module

    owner = "owner-route"
    tree_id = "tree-route-text"
    expected = {"orderedIds": ["m1", "m2"]}
    spy_save = MagicMock(return_value=expected)
    spy_fetch = MagicMock(return_value=expected)
    boom = MagicMock(side_effect=AssertionError("generic update_owner_tree must not be used"))

    with patch.object(app_module, "require_firebase_user", return_value={"uid": owner}), \
         patch.object(app_module, "parse_json_body", return_value={"order": ["m1", "m2"]}), \
         patch.object(app_module, "save_appreciation_order", spy_save), \
         patch.object(app_module, "fetch_appreciation_order", spy_fetch), \
         patch.object(app_module, "update_owner_tree", boom):
        request = MagicMock()

        async def run_routes():
            posted = await app_module.post_appreciation_order(tree_id, request, "auth")
            fetched = app_module.get_appreciation_order(tree_id, "auth")
            return posted, fetched

        posted, fetched = asyncio.run(run_routes())

    assert posted == expected
    assert fetched == expected
    spy_save.assert_called_once_with(tree_id, owner, {"order": ["m1", "m2"]})
    spy_fetch.assert_called_once_with(tree_id, owner)
    boom.assert_not_called()


def test_source_contract_uses_transaction_local_authority_and_text_ids():
    import inspect

    src = inspect.getsource(appr)
    assert "tree_appreciation_orders" in src
    assert "ON CONFLICT (tree_id)" in src
    assert "RETURNING ordered_ids" in src
    assert "FOR SHARE OF t" in src
    assert "FOR SHARE OF m" in src
    assert "validate_required_id" in src
    assert "validate_required_uuid" not in src
    assert "require_tree_owner(" not in src
    assert "update_owner_tree" not in src
    assert "appreciationOrder" not in src
    assert "APPRECIATION_ORDER_STORAGE_UNAVAILABLE" in src


if __name__ == "__main__":
    tests = [
        ("POST persists + canonical response + GET convergence + one write transaction", test_post_persists_returns_canonical_and_get_converges),
        ("TEXT/non-UUID Tree id supported", test_non_uuid_text_tree_id_is_supported),
        ("Memory ids canonicalized by trim", test_memory_ids_are_trimmed_to_canonical_strings),
        ("Partial and explicit empty orders persist", test_partial_and_empty_orders_are_intentional_writes),
        ("No row -> orderedIds [] without mutation", test_no_row_returns_empty_array_without_creating_row),
        ("Missing/unknown payload rejected before DB", test_missing_order_or_unknown_fields_rejected_before_db),
        ("Non-array/bad item shape rejected before DB", test_non_array_and_bad_items_rejected_before_db),
        ("Duplicate after trim rejected before DB", test_duplicate_after_trim_rejected_before_db),
        ("Oversized order rejected before DB", test_oversized_order_rejected_before_db),
        ("Missing/foreign Memory rejected with no UPSERT", test_nonexistent_or_foreign_memory_rejected_no_upsert),
        ("Foreign owner/missing Tree rejected with no UPSERT", test_foreign_owner_and_missing_tree_rejected_no_upsert),
        ("TEXT Tree id validator rejects only invalid required values", test_required_text_tree_id_validation_rejects_empty_only),
        ("Missing storage table -> sanitized 503, no false success", test_missing_storage_table_is_sanitized_503_and_no_false_success),
        ("Missing storage table GET -> sanitized 503", test_missing_storage_table_get_is_sanitized_503),
        ("Route wiring returns dedicated writer response", test_route_wiring_uses_dedicated_persistence_and_returns_writer_response),
        ("Source contract: transaction-local authority + TEXT ids", test_source_contract_uses_transaction_local_authority_and_text_ids),
    ]

    print("=" * 72)
    print("Running appreciation-order persistence (#3921) contract tests")
    print("=" * 72)
    passed = 0
    failed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1
        else:
            failed += 1
    print("=" * 72)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 72)
    if failed:
        sys.exit(1)
