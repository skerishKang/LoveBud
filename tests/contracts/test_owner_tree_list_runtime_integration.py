"""Integration coverage for the authenticated owner tree-list runtime.

The existing owner-tree contract tests are static (they grep the source) and
the classifier tests are pure functions. None of them actually run
``fetch_user_trees`` against a schema-shaped cursor. That left a real gap:
a DB / schema-level failure of ``GET /api/trees`` could surface as a 500 while
the suite stayed green.

This test drives ``fetch_user_trees`` through a programmable fake cursor so the
capability detection, SQL assembly, row normalization, and error classification
are exercised end to end without a live database.

Refs #3433
"""

import unittest
from datetime import datetime
from unittest.mock import patch

import psycopg

from modal_compute.owner_reads import (
    OwnerTreeListError,
    fetch_user_trees,
)


class FakePsycopgError(psycopg.Error):
    """Minimal psycopg.Error stand-in carrying a SQLSTATE."""

    def __init__(self, sqlstate: str):
        super().__init__("simulated db error")
        self.sqlstate = sqlstate


class FakeCursor:
    """Cursor whose probe + main query results are programmable.

    - information_schema.tables probe -> social_counts table existence
    - information_schema.columns probe -> social-counts column existence
    - main query -> preprogrammed rows (or a raised error)
    """

    def __init__(
        self,
        *,
        social_counts_table_exists: bool = True,
        column_exists: bool = True,
        rows=None,
        raise_on_main=None,
    ):
        self._social_counts_table_exists = social_counts_table_exists
        self._column_exists = column_exists
        self._rows = rows if rows is not None else []
        self._raise_on_main = raise_on_main
        self._mode = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        if "information_schema.tables" in sql:
            self._mode = "table_exists"
        elif "information_schema.columns" in sql:
            self._mode = "column_exists"
        else:
            self._mode = "main"
            if self._raise_on_main is not None:
                raise self._raise_on_main

    def fetchone(self):
        if self._mode == "table_exists":
            return {"exists": self._social_counts_table_exists}
        if self._mode == "column_exists":
            return {"exists": self._column_exists}
        return None

    def fetchall(self):
        return self._rows


class FakeConnection:
    def __init__(self, cursor: FakeCursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return self._cursor


def _make_rows(owner_id: str = "user-1", count: int = 2):
    return [
        {
            "id": f"tree-{i}",
            "owner_id": owner_id,
            "title": f"Tree {i}",
            "visibility": "private",
            "group_name": "Group A" if i == 0 else None,
            "keywords": ["a", "b"] if i == 0 else [],
            "created_at": datetime(2024, 1, 1 + i),
            "updated_at": datetime(2024, 2, 1 + i),
            "memory_count": i,
            "like_count": i * 3,
            "view_count": i * 5,
        }
        for i in range(count)
    ]


class TestOwnerTreeListRuntimeIntegration(unittest.TestCase):
    def setUp(self):
        # The capability caches in owner_reads are process-lifetime module
        # globals with no invalidation. Reset them so each case starts from a
        # clean capability view (otherwise a prior case would leak state and
        # also mask the never-invalidated production cache behaviour).
        import modal_compute.owner_reads as orm

        orm._TABLE_EXISTS_CACHE.clear()
        orm._TABLE_HAS_COLUMN_CACHE.clear()

    def _run(self, cursor: FakeCursor, owner_id: str = "user-1", limit: int = 100):
        with patch(
            "modal_compute.owner_reads.get_db_connection",
            return_value=FakeConnection(cursor),
        ):
            return fetch_user_trees(owner_id, limit=limit)

    def test_happy_path_normalizes_owner_dto_with_social_counts(self):
        cursor = FakeCursor(rows=_make_rows())
        result = self._run(cursor)

        self.assertEqual(len(result), 2)

        first = result[0]
        self.assertEqual(first["id"], "tree-0")
        self.assertEqual(first["ownerId"], "user-1")
        self.assertEqual(first["title"], "Tree 0")
        self.assertEqual(first["groupName"], "Group A")
        self.assertEqual(first["keywords"], ["a", "b"])
        self.assertEqual(first["memoryCount"], 0)

        # social counts available -> counts surfaced
        self.assertEqual(result[1]["likeCount"], 3)
        self.assertEqual(result[1]["viewCount"], 5)

    def test_missing_social_counts_table_uses_dummy_source_and_succeeds(self):
        cursor = FakeCursor(social_counts_table_exists=False, rows=_make_rows())
        result = self._run(cursor)

        self.assertEqual(len(result), 2)
        # when the social-counts source is unavailable, the counts must be
        # omitted rather than erroring with a 500.
        self.assertNotIn("likeCount", result[0])
        self.assertNotIn("viewCount", result[0])

    def test_undefined_column_maps_to_classified_query_error(self):
        cursor = FakeCursor(raise_on_main=FakePsycopgError("42703"))
        with self.assertRaises(OwnerTreeListError) as ctx:
            self._run(cursor)
        self.assertEqual(
            ctx.exception.error_category,
            "OWNER_TREE_LIST_QUERY_UNDEFINED_COLUMN",
        )
        self.assertEqual(ctx.exception.failure_phase, "query")

    def test_db_connection_failure_maps_to_connection_failure(self):
        with patch(
            "modal_compute.owner_reads.get_db_connection",
            side_effect=RuntimeError("cannot acquire connection"),
        ):
            with self.assertRaises(OwnerTreeListError) as ctx:
                fetch_user_trees("user-1", limit=100)
        self.assertEqual(
            ctx.exception.error_category,
            "OWNER_TREE_LIST_DB_CONNECTION_FAILURE",
        )
        self.assertEqual(ctx.exception.failure_phase, "db_connection")


if __name__ == "__main__":
    unittest.main()
