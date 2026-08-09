#!/usr/bin/env python3
"""
Executable contract tests for #3926: fail closed when Tree/Memory visibility is
NULL (or otherwise not exactly the literal "public") in social authorization.

Persisted social visibility is only public when the value is exactly the
string "public". NULL / missing / empty / unknown values must NOT be promoted
to "public" by the authorization guards.

This test drives the real guard helpers with fake fetch/cursor seams (no DB
connection, no network, no production mutation):

- require_memory_visible_or_owner          (non-cursor guard, social READ)
- require_memory_visible_or_owner_cursor   (cursor guard, social WRITE)
- require_public_tree_for_like             (Tree Like/Comment canonical gate)

Run: python3 tests/contracts/test_visibility_authorization_3926.py

Refs: #3926, #3435, #3947, #3954, #1882
"""

import os
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.tree_likes import require_public_tree_for_like
from modal_compute.write_validation import (
    is_explicit_public,
    require_memory_visible_or_owner,
    require_memory_visible_or_owner_cursor,
)

OWNER = "owner-1"
OTHER = "user-2"
THIRD = "user-99"


def _memory_row(mem_visibility, tree_visibility, owner_id=OWNER):
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "tree_id": "22222222-2222-2222-2222-222222222222",
        "visibility": mem_visibility,
        "tree_visibility": tree_visibility,
        "tree_owner_id": owner_id,
    }


class FakeCursor:
    """Minimal cursor seam for require_memory_visible_or_owner_cursor."""

    def __init__(self, row):
        self._row = row

    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        return self._row


NON_PUBLIC = [None, "", "   ", "PUBLIC", "Public", "public ", 0, 1, True, False, [], {}, ["public"], {"v": "public"}, 3.14]


class TestUnversionedExplicitPublicPredicate(unittest.TestCase):
    def test_only_exact_literal_is_public(self):
        for value in NON_PUBLIC:
            self.assertFalse(is_explicit_public(value), f"{value!r} must NOT be public")

    def test_exact_public_literal_is_public(self):
        self.assertTrue(is_explicit_public("public"))


class TestMemoryGuardNonCursor(unittest.TestCase):
    def _call(self, mem_visibility, tree_visibility, requester_uid=THIRD):
        row = _memory_row(mem_visibility, tree_visibility)
        with patch(
            "modal_compute.write_validation.fetch_memory_for_owner_check",
            return_value=row,
        ):
            return require_memory_visible_or_owner("mem-1", requester_uid)

    def _deny(self, mem_visibility, tree_visibility):
        with self.assertRaises(HTTPException) as ctx:
            self._call(mem_visibility, tree_visibility, THIRD)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_null_memory_public_tree_denied(self):
        self._deny(None, "public")

    def test_public_memory_null_tree_denied(self):
        self._deny("public", None)

    def test_both_null_denied(self):
        self._deny(None, None)

    def test_empty_memory_public_tree_denied(self):
        self._deny("", "public")

    def test_public_memory_empty_tree_denied(self):
        self._deny("public", "")

    def test_malformed_values_denied(self):
        for bad in ["PUBLIC", " private", 1, True, 0]:
            self._deny(bad, "public")
            self._deny("public", bad)

    def test_missing_tree_visibility_key_denied(self):
        row = _memory_row("public", "public")
        del row["tree_visibility"]
        with patch("modal_compute.write_validation.fetch_memory_for_owner_check", return_value=row):
            with self.assertRaises(HTTPException) as ctx:
                require_memory_visible_or_owner("mem-1", THIRD)
            self.assertEqual(ctx.exception.status_code, 404)

    def test_both_exact_public_allowed_for_non_owner(self):
        result = self._call("public", "public", THIRD)
        self.assertIsNotNone(result)

    def test_owner_private_preserved(self):
        result = self._call("private", "private", OWNER)
        self.assertIsNotNone(result)

    def test_owner_null_unknown_visibility_preserved(self):
        result = self._call("private", None, OWNER)
        self.assertIsNotNone(result)


class TestMemoryGuardCursor(unittest.TestCase):
    def _call(self, mem_visibility, tree_visibility, requester_uid=THIRD, owner_id=OWNER):
        row = {
            "mem_visibility": mem_visibility,
            "tree_visibility": tree_visibility,
            "tree_owner_id": owner_id,
        }
        cursor = FakeCursor(row)
        return require_memory_visible_or_owner_cursor(cursor, "mem-1", requester_uid)

    def _deny(self, mem_visibility, tree_visibility):
        with self.assertRaises(HTTPException) as ctx:
            self._call(mem_visibility, tree_visibility, THIRD, OWNER)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_null_memory_public_tree_denied(self):
        self._deny(None, "public")

    def test_public_memory_null_tree_denied(self):
        self._deny("public", None)

    def test_both_null_denied(self):
        self._deny(None, None)

    def test_empty_memory_public_tree_denied(self):
        self._deny("", "public")

    def test_public_memory_empty_tree_denied(self):
        self._deny("public", "")

    def test_malformed_values_denied(self):
        for bad in ["PUBLIC", " private ", 1, 0]:
            self._deny(bad, "public")
            self._deny("public", bad)

    def test_both_exact_public_allowed_for_non_owner(self):
        result = self._call("public", "public", THIRD, OWNER)
        self.assertIsNotNone(result)

    def test_owner_private_preserved(self):
        result = self._call("private", "private", OWNER, OWNER)
        self.assertIsNotNone(result)

    def test_owner_null_unknown_visibility_preserved(self):
        result = self._call("private", None, OWNER, OWNER)
        self.assertIsNotNone(result)

    def test_parity_with_non_cursor_guard(self):
        states = [
            (None, "public"),
            ("public", None),
            (None, None),
            ("", "public"),
            ("public", ""),
            ("PUBLIC", "public"),
            ("public", "public"),
        ]
        for mem_v, tree_v in states:
            non_cursor_ok = True
            cursor_ok = True
            with patch(
                "modal_compute.write_validation.fetch_memory_for_owner_check",
                return_value=_memory_row(mem_v, tree_v),
            ):
                try:
                    require_memory_visible_or_owner("mem-1", THIRD)
                except HTTPException:
                    non_cursor_ok = False
            try:
                self._call(mem_v, tree_v, THIRD, OWNER)
            except HTTPException:
                cursor_ok = False
            self.assertEqual(
                non_cursor_ok,
                cursor_ok,
                f"parity mismatch for mem={mem_v!r} tree={tree_v!r}: non-cursor={non_cursor_ok} cursor={cursor_ok}",
            )


class TestTreeGuard(unittest.TestCase):
    def _call(self, visibility):
        tree = {"id": "tree-1", "visibility": visibility}
        with patch("modal_compute.tree_likes.run_db_with_retry", return_value=tree):
            return require_public_tree_for_like("tree-1")

    def _deny(self, visibility):
        with self.assertRaises(HTTPException) as ctx:
            self._call(visibility)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_null_visibility_denied(self):
        self._deny(None)

    def test_empty_visibility_denied(self):
        self._deny("")

    def test_private_tree_denied(self):
        self._deny("private")

    def test_malformed_visibility_denied(self):
        for bad in [" PUBLIC", "Public", 1, True]:
            self._deny(bad)

    def test_exact_public_allowed(self):
        result = self._call("public")
        self.assertIsNotNone(result)

    def test_source_uses_canonical_predicate_only(self):
        with open(os.path.join(REPO_ROOT, "modal_compute", "write_validation.py")) as f:
            wp_src = f.read()
        with open(os.path.join(REPO_ROOT, "modal_compute", "tree_likes.py")) as f:
            tl_src = f.read()
        self.assertIn("def is_explicit_public(", wp_src)
        self.assertIn('isinstance(value, str) and value == "public"', wp_src)
        self.assertNotIn('or "public"', tl_src)
        self.assertNotIn('or \'public\'', tl_src)
        self.assertIn("is_explicit_public(tree.get(\"visibility\"))", tl_src)


if __name__ == "__main__":
    unittest.main()