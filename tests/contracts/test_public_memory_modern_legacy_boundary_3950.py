import sys
import types
import unittest
from contextlib import ExitStack
from unittest.mock import MagicMock, patch

# Stub external/runtime dependencies before importing public_reads.
_fastapi = types.ModuleType("fastapi")


class _HTTPException(Exception):
    def __init__(self, status_code=500, detail=""):
        self.status_code = status_code
        self.detail = detail


_fastapi.HTTPException = _HTTPException
sys.modules["fastapi"] = _fastapi

_db = types.ModuleType("modal_compute.db")
_db.get_db_connection = MagicMock()
_db.run_db_with_retry = MagicMock()
sys.modules["modal_compute.db"] = _db

_validation = types.ModuleType("modal_compute.validation")
_validation.estimate_stage = lambda value: value
_validation.normalize_row = lambda row, **kwargs: row
_validation.normalize_tree_row = lambda row, *args, **kwargs: row
_validation.parse_tags = lambda value: value


def _normalize_memory_row(row):
    return {
        "id": str(row.get("id", "")),
        "treeId": str(row.get("tree_id")) if row.get("tree_id") else None,
        "title": row.get("title") or "Untitled Moment",
        "visibility": row.get("visibility") or "public",
    }


_validation.normalize_memory_row = _normalize_memory_row
sys.modules["modal_compute.validation"] = _validation

_reactions = types.ModuleType("modal_compute.reactions")
_reactions.fetch_reaction_counts = lambda memory_id: {}
sys.modules["modal_compute.reactions"] = _reactions

from modal_compute.public_reads import fetch_public_memory  # noqa: E402


class _Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        cursor = self._cursor

        class _CursorContext:
            def __enter__(self):
                return cursor

            def __exit__(self, *args):
                return False

        return _CursorContext()


def _patches(cursor, *, memories_exists, columns=None):
    columns = set(columns or ())
    return [
        patch(
            "modal_compute.public_reads.get_db_connection",
            side_effect=lambda: _Connection(cursor),
        ),
        patch(
            "modal_compute.public_reads.run_db_with_retry",
            side_effect=lambda operation: operation(),
        ),
        patch(
            "modal_compute.public_reads._table_exists",
            side_effect=lambda _cur, table: memories_exists if table == "memories" else False,
        ),
        patch(
            "modal_compute.public_reads._table_has_column",
            side_effect=lambda _cur, table, column: table == "trees" and column in columns,
        ),
    ]


def _enter_all(stack, contexts):
    for context in contexts:
        stack.enter_context(context)


STALE_TREE_ROW = {
    "id": "legacy-tree",
    "name": "Stale Legacy Tree",
    "is_public": True,
    "payload": {
        "nodes": [
            {
                "id": "target-memory",
                # Missing legacy visibility defaults public; this is the stale-copy trap.
                "title": "Stale copy that must never override modern privacy",
            }
        ]
    },
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-02T00:00:00",
}

LEGACY_COLUMNS = {"payload", "created_at", "updated_at", "name", "is_public"}


class TestPublicMemoryModernAuthority3950(unittest.TestCase):
    def _modern_filtered_miss(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        cursor.fetchall.return_value = [STALE_TREE_ROW]

        with ExitStack() as stack:
            _enter_all(stack, _patches(cursor, memories_exists=True, columns=LEGACY_COLUMNS))
            with patch(
                "modal_compute.public_reads._table_has_column",
                side_effect=AssertionError("legacy capability must not be inspected after a modern miss"),
            ):
                result = fetch_public_memory("target-memory")

        self.assertIsNone(result)
        self.assertEqual(cursor.execute.call_count, 1, "only the modern lookup SQL may execute")
        sql = cursor.execute.call_args_list[0].args[0]
        self.assertIn("FROM memories m", sql)
        self.assertNotIn("payload", sql)

    def test_modern_table_present_missing_target_never_legacy_falls_back(self):
        self._modern_filtered_miss()

    def test_modern_private_memory_never_resurrects_stale_payload(self):
        # The explicit-public SQL filters a private Memory to the same authoritative miss.
        self._modern_filtered_miss()

    def test_public_memory_under_private_tree_never_resurrects_stale_payload(self):
        # The explicit-public parent-Tree predicate filters this to an authoritative miss.
        self._modern_filtered_miss()

    def test_stale_payload_copy_is_not_consulted_after_modern_authority_miss(self):
        self._modern_filtered_miss()

    def test_modern_schema_without_payload_column_has_no_undefined_column_path(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None

        with ExitStack() as stack:
            _enter_all(stack, _patches(cursor, memories_exists=True, columns=set()))
            with patch(
                "modal_compute.public_reads._table_has_column",
                side_effect=AssertionError("modern miss must not ask whether trees.payload exists"),
            ):
                result = fetch_public_memory("target-memory")

        self.assertIsNone(result)
        self.assertEqual(cursor.execute.call_count, 1)
        self.assertIn("FROM memories m", cursor.execute.call_args.args[0])

    def test_genuine_legacy_schema_with_exact_payload_capability_still_succeeds(self):
        cursor = MagicMock()
        cursor.fetchall.return_value = [STALE_TREE_ROW]

        with ExitStack() as stack:
            _enter_all(
                stack,
                _patches(cursor, memories_exists=False, columns=LEGACY_COLUMNS),
            )
            result = fetch_public_memory("target-memory")

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "target-memory")
        self.assertEqual(result["treeId"], "legacy-tree")
        self.assertEqual(result["visibility"], "public")
        self.assertEqual(result["reactionCounts"], {"total": 0})
        self.assertEqual(cursor.execute.call_count, 1)
        self.assertIn("payload", cursor.execute.call_args.args[0])

    def test_genuine_legacy_schema_without_payload_capability_fails_closed(self):
        cursor = MagicMock()
        incomplete = {"created_at", "updated_at", "name", "is_public"}

        with ExitStack() as stack:
            _enter_all(stack, _patches(cursor, memories_exists=False, columns=incomplete))
            result = fetch_public_memory("target-memory")

        self.assertIsNone(result)
        self.assertEqual(
            cursor.execute.call_count,
            0,
            "legacy SQL must not reference an unproven payload column",
        )

    def test_modern_explicit_public_memory_still_returns_modern_projection(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = {
            "id": "target-memory",
            "tree_id": "modern-tree",
            "title": "Modern Public Memory",
            "visibility": "public",
        }

        with ExitStack() as stack:
            _enter_all(stack, _patches(cursor, memories_exists=True, columns=set()))
            result = fetch_public_memory("target-memory")

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "target-memory")
        self.assertEqual(result["treeId"], "modern-tree")
        self.assertEqual(result["reactionCounts"], {"total": 0})
        self.assertEqual(cursor.execute.call_count, 1)
        self.assertIn("FROM memories m", cursor.execute.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
