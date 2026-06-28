import types
import sys
import unittest
from unittest.mock import MagicMock, patch
from contextlib import ExitStack

# ---------------------------------------------------------------
# Stub external dependencies BEFORE any modal_compute imports
# ---------------------------------------------------------------

# fastapi stub (validation.py imports HTTPException)
_fastapi_mod = types.ModuleType("fastapi")


class _HTTPExceptionStub(Exception):
    def __init__(self, status_code=500, detail=""):
        self.status_code = status_code
        self.detail = detail


_fastapi_mod.HTTPException = _HTTPExceptionStub
sys.modules["fastapi"] = _fastapi_mod

# psycopg stubs (db.py imports psycopg, psycopg.rows, psycopg_pool)
_psycopg_mod = types.ModuleType("psycopg")
_psycopg_mod.OperationalError = Exception
sys.modules["psycopg"] = _psycopg_mod

_psycopg_rows_mod = types.ModuleType("psycopg.rows")
_psycopg_rows_mod.dict_row = None
sys.modules["psycopg.rows"] = _psycopg_rows_mod

_psycopg_pool_mod = types.ModuleType("psycopg_pool")
sys.modules["psycopg_pool"] = _psycopg_pool_mod

# ---------------------------------------------------------------
# Load real validation module (fastapi is stubbed above)
# ---------------------------------------------------------------
import modal_compute.validation  # noqa: E402
from modal_compute.validation import normalize_memory_row  # noqa: E402

# ---------------------------------------------------------------
# Stub reactions module (prevent import error inside try_modern)
# ---------------------------------------------------------------
_react_mod = types.ModuleType("modal_compute.reactions")


def _mock_fetch_reaction_counts(memory_id):
    return {}


_react_mod.fetch_reaction_counts = _mock_fetch_reaction_counts
sys.modules["modal_compute.reactions"] = _react_mod

# ---------------------------------------------------------------
# Stub db module before public_reads import
# ---------------------------------------------------------------
sys.modules["modal_compute.db"] = MagicMock()

# ---------------------------------------------------------------
# Import target functions
# ---------------------------------------------------------------
from modal_compute.public_reads import (  # noqa: E402
    _is_public_legacy_node,
    _get_legacy_memory_from_payload,
    _normalize_legacy_tree_row,
    fetch_public_memories,
    fetch_public_memory,
)


# ---------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------


def _nested_patches(patches):
    """Return a single context manager from a list of patch contexts."""
    stack = ExitStack()
    for p in patches:
        stack.enter_context(p)
    return stack


def _legacy_patches(mock_conn, mock_cur, tree_rows=None, table_has_column=True):
    """Return a list of patch context managers for legacy-path DB tests.

    When *tree_rows* is given, ``mock_cur.fetchall`` is set to return it.
    """
    patches = [
        patch("modal_compute.public_reads.get_db_connection", return_value=mock_conn),
        patch("modal_compute.public_reads._table_exists", return_value=False),
        patch(
            "modal_compute.public_reads._table_has_column",
            return_value=table_has_column,
        ),
        patch(
            "modal_compute.public_reads.run_db_with_retry",
            side_effect=lambda op: op(),
        ),
    ]
    if tree_rows is not None:
        mock_cur.fetchall.return_value = tree_rows
    return patches


# ---------------------------------------------------------------
# Common fixtures
# ---------------------------------------------------------------

PUBLIC_NODE = {
    "id": "p1",
    "visibility": "public",
    "order": 1,
    "title": "Public Moment",
    "memo": "Hello public",
    "source_url": "https://example.com/src1",
    "sourceUrl": "https://example.com/src1",
    "thumbnail": "https://example.com/thumb1",
    "emotion_tags": ["happy", "excited"],
    "emotionTags": ["happy", "excited"],
}

PRIVATE_NODE = {
    "id": "pr1",
    "visibility": "private",
    "order": 0,
    "title": "Private Moment",
    "memo": "Secret",
}

DEFAULT_NODE = {
    "id": "d1",
    "order": 2,
    "title": "Default Public",
    "memo": "Missing visibility",
}

UNLISTED_NODE = {"id": "u1", "visibility": "unlisted", "order": 3}

NONE_VIS_NODE = {"id": "nv1", "visibility": None, "order": 4}

UNKNOWN_VIS_NODE = {"id": "uv1", "visibility": "unknown", "order": 5}

BASE_PAYLOAD_NODES = [
    PUBLIC_NODE,
    PRIVATE_NODE,
    DEFAULT_NODE,
    UNLISTED_NODE,
    NONE_VIS_NODE,
    UNKNOWN_VIS_NODE,
    "not_a_dict_string",
    42,
    None,
]

PAYLOAD = {"nodes": list(BASE_PAYLOAD_NODES)}

TREE_ROW = {
    "id": "tree1",
    "name": "Legacy Tree",
    "is_public": True,
    "payload": PAYLOAD,
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00",
}


# ===============================================================
# Test cases
# ===============================================================


class TestIsPublicLegacyNode(unittest.TestCase):
    """_is_public_legacy_node policy: only dict with visibility=="public"
    or missing visibility."""

    def test_public_visible(self):
        self.assertTrue(_is_public_legacy_node({"visibility": "public"}))

    def test_missing_visibility_defaults_public(self):
        self.assertTrue(_is_public_legacy_node({"id": "x"}))

    def test_private_excluded(self):
        self.assertFalse(_is_public_legacy_node({"visibility": "private"}))

    def test_unlisted_excluded(self):
        self.assertFalse(_is_public_legacy_node({"visibility": "unlisted"}))

    def test_none_visibility_excluded(self):
        self.assertFalse(_is_public_legacy_node({"visibility": None}))

    def test_unknown_visibility_excluded(self):
        self.assertFalse(_is_public_legacy_node({"visibility": "unknown"}))

    def test_none_excluded(self):
        self.assertFalse(_is_public_legacy_node(None))

    def test_string_excluded(self):
        self.assertFalse(_is_public_legacy_node("not_a_dict"))

    def test_int_excluded(self):
        self.assertFalse(_is_public_legacy_node(123))

    def test_list_excluded(self):
        self.assertFalse(_is_public_legacy_node([]))


class TestGetLegacyMemoryFromPayload(unittest.TestCase):
    """_get_legacy_memory_from_payload checks visibility BEFORE id."""

    @staticmethod
    def _payload(nodes):
        return {"nodes": nodes}

    def test_returns_public_node_by_id(self):
        nodes = [
            {"id": "p1", "visibility": "public"},
            {"id": "d1"},
        ]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "p1")
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "p1")

    def test_returns_missing_visibility_node_by_id(self):
        nodes = [{"id": "d1"}]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "d1")
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "d1")

    def test_private_returns_none(self):
        nodes = [
            {"id": "pr1", "visibility": "private"},
            {"id": "p1", "visibility": "public"},
        ]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "pr1")
        self.assertIsNone(result)

    def test_unlisted_returns_none(self):
        nodes = [{"id": "u1", "visibility": "unlisted"}]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "u1")
        self.assertIsNone(result)

    def test_none_visibility_returns_none(self):
        nodes = [{"id": "nv1", "visibility": None}]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "nv1")
        self.assertIsNone(result)

    def test_unknown_visibility_returns_none(self):
        nodes = [{"id": "uv1", "visibility": "unknown"}]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "uv1")
        self.assertIsNone(result)

    def test_skips_non_dict_nodes_without_exception(self):
        nodes = [
            "string",
            42,
            None,
            {"id": "p1", "visibility": "public"},
        ]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "p1")
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "p1")

    def test_nonexistent_id_returns_none(self):
        nodes = [{"id": "p1", "visibility": "public"}]
        result = _get_legacy_memory_from_payload(self._payload(nodes), "nonexistent")
        self.assertIsNone(result)

    def test_empty_nodes_returns_none(self):
        result = _get_legacy_memory_from_payload(self._payload([]), "p1")
        self.assertIsNone(result)


class TestNormalizeLegacyTreeRow(unittest.TestCase):
    """memoryCount counts only public + missing-visibility nodes."""

    def test_memory_count_excludes_private_and_non_public(self):
        row = {
            "id": 1,
            "name": "My Tree",
            "is_public": True,
            "payload": {
                "nodes": [
                    {"id": "p1", "visibility": "public"},
                    {"id": "pr1", "visibility": "private"},
                    {"id": "d1"},
                    {"id": "u1", "visibility": "unlisted"},
                    {"id": "nv1", "visibility": None},
                    {"id": "uv1", "visibility": "unknown"},
                    "string",
                    42,
                    None,
                ]
            },
            "created_at": "2026-01-01",
            "updated_at": "2026-01-01",
        }
        result = _normalize_legacy_tree_row(row)
        # p1 + d1 = 2; all others excluded
        self.assertEqual(result["memoryCount"], 2)


class TestFetchPublicMemoriesLegacyPath(unittest.TestCase):
    """Integration: fetch_public_memories legacy path filters correctly."""

    def setUp(self):
        self.mock_cur = MagicMock()
        self.mock_conn = MagicMock()
        self.mock_conn.__enter__.return_value = self.mock_conn
        self.mock_conn.cursor.return_value.__enter__.return_value = self.mock_cur

    # --- test a: list returns public + missing visibility only ---
    def test_filters_to_public_and_missing_visibility(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            memories = fetch_public_memories("tree1", limit=10)
        ids = [m["id"] for m in memories]
        self.assertIn("p1", ids)
        self.assertIn("d1", ids)
        self.assertNotIn("pr1", ids)
        self.assertNotIn("u1", ids)
        self.assertNotIn("nv1", ids)
        self.assertNotIn("uv1", ids)
        self.assertEqual(len(ids), 2)

    # --- test b: order / limit — private does NOT consume limit slot ---
    def test_private_order0_does_not_consume_limit(self):
        order_payload = {
            "nodes": [
                {"id": "pr1", "visibility": "private", "order": 0},
                {"id": "p1", "visibility": "public", "order": 1},
            ]
        }
        order_tree_row = {**TREE_ROW, "payload": order_payload}
        with _nested_patches(
            _legacy_patches(
                self.mock_conn, self.mock_cur, tree_rows=[order_tree_row]
            )
        ):
            memories = fetch_public_memories("tree1", limit=1)
        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["id"], "p1")

    # --- test e (via list): public memory count ---
    def test_public_memory_count_via_list(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            memories = fetch_public_memories("tree1", limit=10)
        # Only 2 public nodes → 2 memories returned
        self.assertEqual(len(memories), 2)


class TestFetchPublicMemoryLegacyPath(unittest.TestCase):
    """Integration: fetch_public_memory legacy path handles visibility."""

    def setUp(self):
        self.mock_cur = MagicMock()
        self.mock_conn = MagicMock()
        self.mock_conn.__enter__.return_value = self.mock_conn
        self.mock_conn.cursor.return_value.__enter__.return_value = self.mock_cur

    # --- test c: private single lookup returns None ---
    def test_private_returns_none(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("pr1")
        self.assertIsNone(result)

    # --- test d: public single lookup preserves normalized projection ---
    def test_public_returns_normalized_projection(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("p1")
        self.assertIsNotNone(result)
        self.assertIn("id", result)
        self.assertIn("title", result)
        self.assertIn("memo", result)
        self.assertIn("sourceUrl", result)
        self.assertIn("thumbnail", result)
        self.assertIn("emotionTags", result)
        self.assertIn("visibility", result)
        # Spot-check values
        self.assertEqual(result["id"], "p1")
        self.assertEqual(result["visibility"], "public")

    def test_missing_visibility_returns_public(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("d1")
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "d1")

    def test_unlisted_returns_none(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("u1")
        self.assertIsNone(result)

    def test_none_visibility_returns_none(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("nv1")
        self.assertIsNone(result)

    def test_unknown_visibility_returns_none(self):
        with _nested_patches(
            _legacy_patches(self.mock_conn, self.mock_cur, tree_rows=[TREE_ROW])
        ):
            result = fetch_public_memory("uv1")
        self.assertIsNone(result)


class TestModernSQLFilters(unittest.TestCase):
    """Modern SQL paths use m.visibility = 'public' and t.visibility = 'public'."""

    def setUp(self):
        self.mock_cur = MagicMock()
        self.mock_conn = MagicMock()
        self.mock_conn.__enter__.return_value = self.mock_conn
        self.mock_conn.cursor.return_value.__enter__.return_value = self.mock_cur
        self.modern_patches_list = [
            patch(
                "modal_compute.public_reads.get_db_connection",
                return_value=self.mock_conn,
            ),
            patch("modal_compute.public_reads._table_exists", return_value=True),
            patch(
                "modal_compute.public_reads._table_has_column", return_value=True
            ),
            patch(
                "modal_compute.public_reads.run_db_with_retry",
                side_effect=lambda op: op(),
            ),
        ]

    # --- test f: fetch_public_memories modern SQL ---
    def test_fetch_public_memories_modern_sql_has_m_visibility_public(self):
        self.mock_cur.fetchall.return_value = []
        with _nested_patches(self.modern_patches_list):
            fetch_public_memories("tree1", limit=10)
        sql = self.mock_cur.execute.call_args[0][0]
        self.assertIn("m.visibility = 'public'", sql)

    def test_fetch_public_memories_modern_sql_has_t_visibility_public(self):
        self.mock_cur.fetchall.return_value = []
        with _nested_patches(self.modern_patches_list):
            fetch_public_memories("tree1", limit=10)
        sql = self.mock_cur.execute.call_args[0][0]
        self.assertIn("t.visibility = 'public'", sql)

    # --- test f: fetch_public_memory modern SQL ---
    def test_fetch_public_memory_modern_sql_has_m_visibility_public(self):
        self.mock_cur.fetchone.return_value = {"id": "test_mem", "tree_id": "tree1"}
        with _nested_patches(self.modern_patches_list):
            fetch_public_memory("test_mem")
        # The last cur.execute call is from the modern path; capture its SQL.
        sql = self.mock_cur.execute.call_args[0][0]
        self.assertIn("m.visibility = 'public'", sql)

    def test_fetch_public_memory_modern_sql_has_t_visibility_public(self):
        self.mock_cur.fetchone.return_value = {"id": "test_mem", "tree_id": "tree1"}
        with _nested_patches(self.modern_patches_list):
            fetch_public_memory("test_mem")
        sql = self.mock_cur.execute.call_args[0][0]
        self.assertIn("t.visibility = 'public'", sql)


if __name__ == "__main__":
    unittest.main()
