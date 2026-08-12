#!/usr/bin/env python3
"""Executable regression for Issue #3941 authenticated reaction summaries.

Run: python3 tests/contracts/test_reaction_summary_aggregate_3941.py
"""

from __future__ import annotations

import uuid
from unittest.mock import patch

from modal_compute import reactions


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.execute_calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, params=None):
        self.execute_calls.append((query, params))

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return self._cursor


def normalize_sql(sql: str) -> str:
    return " ".join(sql.split())


def test_aggregate_helper_uses_one_bounded_query():
    cursor = FakeCursor([
        {"type": "like", "count": 10000, "requester_active": True},
        {"type": "celebrate", "count": 2500, "requester_active": False},
    ])

    result = reactions._compute_reaction_summary(cursor, "memory-1", "requester-1")

    assert result == {
        "counts": {"like": 10000, "celebrate": 2500},
        "userReactions": {"like": True},
    }
    assert len(cursor.execute_calls) == 1

    query, params = cursor.execute_calls[0]
    sql = normalize_sql(query)
    assert "COUNT(*)::int AS count" in sql
    assert "BOOL_OR(owner_id = %s) AS requester_active" in sql
    assert "GROUP BY type" in sql
    assert "ORDER BY type" in sql
    assert "SELECT id, memory_id, owner_id, type, created_at" not in sql
    assert params == ("requester-1", "memory-1")


def test_aggregate_helper_preserves_empty_shape():
    cursor = FakeCursor([])
    assert reactions._compute_reaction_summary(cursor, "memory-1", "requester-1") == {
        "counts": {},
        "userReactions": {},
    }


def test_fetch_reaction_summary_keeps_guard_and_returns_aggregate_result():
    memory_id = str(uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"))
    owner_id = "requester-1"
    cursor = FakeCursor([
        {"type": "like", "count": 3, "requester_active": False},
    ])
    connection = FakeConnection(cursor)

    with patch.object(reactions, "require_memory_visible_or_owner") as guard, \
         patch.object(reactions, "get_db_connection", return_value=connection), \
         patch("modal_compute.db.run_db_with_retry", side_effect=lambda operation: operation()):
        result = reactions.fetch_reaction_summary(memory_id, owner_id)

    guard.assert_called_once_with(memory_id, owner_id)
    assert result == {"counts": {"like": 3}, "userReactions": {}}
    assert len(cursor.execute_calls) == 1


def run_test(name, fn):
    try:
        fn()
        print(f"PASS: {name}")
        return True
    except Exception as exc:
        print(f"FAIL: {name}: {type(exc).__name__}: {exc}")
        return False


if __name__ == "__main__":
    tests = [
        ("aggregate helper uses one bounded query", test_aggregate_helper_uses_one_bounded_query),
        ("aggregate helper preserves empty shape", test_aggregate_helper_preserves_empty_shape),
        ("fetch summary keeps guard and aggregate result", test_fetch_reaction_summary_keeps_guard_and_returns_aggregate_result),
    ]
    passed = sum(run_test(name, fn) for name, fn in tests)
    print(f"{passed}/{len(tests)} passed")
    raise SystemExit(0 if passed == len(tests) else 1)
