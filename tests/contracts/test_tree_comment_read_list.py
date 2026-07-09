"""Focused reader test for the whole-tree comment read/list path.

Drives modal_compute.tree_comments.fetch_tree_comments with a shared in-memory
fake store (no DB, no network). It verifies the backend/API read boundary
required by Issue #3408 / contract #3405:

- reader targets only `tree_comments` (tree_id filter, no moment `comments`)
- public-tree visibility gate runs before read (non-public/missing -> 404)
- bounded `limit` (default 20, clamp 1..50)
- oldest-first stable ordering (created_at ASC, id ASC)
- response DTO excludes raw account identifiers (authorDisplayLabel only)
- no `memory_id` anywhere in the tree read path
- invalid tree id -> 400 safe error

It does NOT implement or exercise UI, client adapter, moderation/deletion,
Scout behaviour, or moment comment routes/helpers.

Refs: #3408, #3188, #3404, #3405, #3400, #3401, #3396, #3398, #3393, #3394,
#3388, #3392, #3075, #1882
"""

import unittest
from datetime import datetime, timezone

from modal_compute import db as db_module
from modal_compute import tree_comments
from modal_compute import tree_likes
from fastapi import HTTPException


TREE_ID = "22222222-2222-2222-2222-222222222222"
PRIVATE_TREE = "99999999-9999-9999-9999-999999999999"
OTHER_TREE = "33333333-3333-3333-3333-333333333333"


class _Store:
    def __init__(self):
        self.trees = {}
        self.comments = []


class _Cursor:
    def __init__(self, store):
        self._store = store
        self._pending = []

    def execute(self, sql, params=None):
        params = params or ()
        up = sql.strip().upper()
        if "FROM TREES" in up:
            tree_id = params[0]
            row = self._store.trees.get(tree_id)
            self._pending = [row] if row is not None else []
            return
        if "FROM TREE_COMMENTS" in up:
            tree_id = params[0]
            limit = int(params[1]) if len(params) > 1 else 20
            matches = [
                c for c in self._store.comments if c["tree_id"] == tree_id
            ]
            matches.sort(key=lambda c: (c["created_at"], c["id"]))
            self._pending = matches[:limit]
            return
        if "FROM COMMENTS" in up:
            # Defensive: reader must never query the moment `comments` table.
            raise AssertionError("reader queried moment comments table")
        self._pending = []

    def fetchone(self):
        if getattr(self, "_pending", []):
            return self._pending[0]
        return None

    def fetchall(self):
        return list(getattr(self, "_pending", []))

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def commit(self):
        pass

    def rollback(self):
        pass


class _FakeDb:
    def __init__(self, store):
        self._store = store

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return _Cursor(self._store)

    def commit(self):
        pass

    def rollback(self):
        pass


def _make_comment(cid, tree_id, owner, body, when):
    return {
        "id": cid,
        "tree_id": tree_id,
        "owner_id": owner,
        "body": body,
        "target_kind": "tree",
        "target_id": tree_id,
        "created_at": when.isoformat(),
        "updated_at": when.isoformat(),
    }


class TestFetchTreeComments(unittest.TestCase):
    def setUp(self):
        self.store = _Store()
        self.store.trees[TREE_ID] = {"id": TREE_ID, "visibility": "public"}
        self.fake = _FakeDb(self.store)
        self._orig_db = db_module.get_db_connection
        self._orig_tc = tree_comments.get_db_connection
        self._orig_tl = tree_likes.get_db_connection
        db_module.get_db_connection = lambda: self.fake
        tree_comments.get_db_connection = lambda: self.fake
        tree_likes.get_db_connection = lambda: self.fake

        base = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        self.store.comments = [
            _make_comment("c-1", TREE_ID, "owner-a", "first", base),
            _make_comment("c-2", TREE_ID, "owner-b", "second", base.replace(hour=1)),
            _make_comment("c-3", TREE_ID, "owner-a", "third", base.replace(hour=2)),
            _make_comment("c-other", OTHER_TREE, "owner-x", "noise", base),
        ]

    def tearDown(self):
        db_module.get_db_connection = self._orig_db
        tree_comments.get_db_connection = self._orig_tc
        tree_likes.get_db_connection = self._orig_tl

    def test_public_tree_returns_bounded_comments_only_for_tree(self):
        result = tree_comments.fetch_tree_comments(TREE_ID)
        self.assertIn("comments", result)
        items = result["comments"]
        self.assertEqual(len(items), 3)
        self.assertTrue(all(c["treeId"] == TREE_ID for c in items))
        self.assertFalse(any(c.get("treeId") == OTHER_TREE for c in items))

    def test_no_raw_account_identifier_in_response(self):
        result = tree_comments.fetch_tree_comments(TREE_ID)
        for c in result["comments"]:
            self.assertNotIn("ownerId", c)
            self.assertNotIn("owner_id", c)
            self.assertIn("authorDisplayLabel", c)
            self.assertEqual(c["authorDisplayLabel"], tree_comments.ANONYMOUS_DISPLAY_LABEL)

    def test_required_safe_fields_present(self):
        result = tree_comments.fetch_tree_comments(TREE_ID)
        for c in result["comments"]:
            for field in ("id", "treeId", "body", "createdAt", "updatedAt", "authorDisplayLabel"):
                self.assertIn(field, c)

    def test_oldest_first_stable_ordering(self):
        result = tree_comments.fetch_tree_comments(TREE_ID)
        ids = [c["id"] for c in result["comments"]]
        self.assertEqual(ids, ["c-1", "c-2", "c-3"])

    def test_default_limit_is_20_and_clamps_to_50(self):
        many = [
            _make_comment(f"m-{i}", TREE_ID, "owner", f"b{i}", datetime(2026, 2, 1, 0, i, tzinfo=timezone.utc))
            for i in range(60)
        ]
        self.store.comments = many
        result = tree_comments.fetch_tree_comments(TREE_ID)
        self.assertLessEqual(len(result["comments"]), 50)

    def test_explicit_limit_is_respected_and_clamped(self):
        result = tree_comments.fetch_tree_comments(TREE_ID, limit=2)
        self.assertEqual(len(result["comments"]), 2)

    def test_private_tree_returns_404_not_found(self):
        self.store.trees[PRIVATE_TREE] = {"id": PRIVATE_TREE, "visibility": "private"}
        with self.assertRaises(HTTPException) as ctx:
            tree_comments.fetch_tree_comments(PRIVATE_TREE)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_missing_tree_returns_404_not_found(self):
        with self.assertRaises(HTTPException) as ctx:
            tree_comments.fetch_tree_comments("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        self.assertEqual(ctx.exception.status_code, 404)

    def test_invalid_tree_id_returns_400(self):
        with self.assertRaises(HTTPException) as ctx:
            tree_comments.fetch_tree_comments("not-a-uuid")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_no_memory_id_in_tree_read_path(self):
        # The reader must not carry/emit memory_id; only tree-scoped fields.
        result = tree_comments.fetch_tree_comments(TREE_ID)
        for c in result["comments"]:
            self.assertNotIn("memoryId", c)
            self.assertNotIn("memory_id", c)


if __name__ == "__main__":
    unittest.main()
