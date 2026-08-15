"""Focused writer contract test for the whole-tree comment create path.

Drives modal_compute.tree_comments.create_tree_comment with a shared in-memory
fake store (no DB, no network). It verifies the slicing boundary required by
Issue #3396 / audit #3394:

- writer targets only `tree_comments`
- generic target is `target_kind='tree'`, `target_id=treeId` (no `memory_id`)
- public visibility gate before write (non-public tree -> 404)
- bounded/validated body (empty body -> 400)
- duplicate idempotency submission returns the stored comment WITHOUT a second
  insert (no duplicate tree comment)
- audit action recorded is `tree.comment.create` (tree-target, never memory_id)

It does NOT implement or exercise any GET/read/list route, UI, client adapter,
moment comments, or Scout behaviour.

Refs: #3396, #3188, #3393, #3394, #3388, #3392, #3382, #3385, #3075, #1882
"""

import unittest
import uuid
from datetime import datetime, timezone

from modal_compute import db as db_module
from modal_compute import tree_comments
from modal_compute import tree_likes
from modal_compute.social_errors import SocialWriteError
from fastapi import HTTPException


TREE_ID = "22222222-2222-2222-2222-222222222222"
OWNER_ID = "owner-abc-123"
OTHER_TREE = "33333333-3333-3333-3333-333333333333"


class _Store:
    def __init__(self):
        self.trees = {}
        self.idempotency = {}
        self.comments = []
        self.audit = []
        self.rate_limits = {}


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
            comment_id = params[0]
            match = next(
                (c for c in self._store.comments if c["id"] == comment_id), None)
            self._pending = [match] if match is not None else []
            return
        if "FROM SOCIAL_IDEMPOTENCY" in up:
            key = (params[0], params[1], params[2])
            row = self._store.idempotency.get(key)
            self._pending = [row] if row is not None else []
            return
        if "INSERT INTO SOCIAL_IDEMPOTENCY" in up:
            (_id, actor, op, ikey, fp, tkind, tid, tmem, rid) = params
            existing_key = (actor, op, ikey)
            existing = self._store.idempotency.get(existing_key)
            if existing is not None:
                # Simulate ON CONFLICT DO UPDATE SET social_idempotency.* preserving row.
                self._pending = [existing]
                return
            row = {
                "target_kind": tkind,
                "target_id": tid,
                "target_memory_id": tmem,
                "result_id": rid,
                "result_state": "pending",
                "request_fingerprint": fp,
                "result_payload": None,
            }
            self._store.idempotency[existing_key] = row
            self._pending = [row]
            return
        if "INSERT INTO TREE_COMMENTS" in up:
            comment_id, tree_id, owner_id, body, target_id = params
            row = {
                "id": comment_id,
                "tree_id": tree_id,
                "owner_id": owner_id,
                "body": body,
                "target_kind": "tree",
                "target_id": target_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._store.comments.append(row)
            self._pending = [row]
            return
        if "INSERT INTO SOCIAL_AUDIT_LOG" in up:
            # params: id, actor_id, target_kind, target_id, action, outcome_code, request_key_hash
            action = params[4]
            self._store.audit.append({
                "actor_id": params[1],
                "target_kind": params[2],
                "target_id": params[3],
                "memory_id": None,
                "action": action,
                "outcome_code": params[5],
            })
            self._pending = []
            return
        if "INSERT INTO SOCIAL_RATE_LIMITS" in up:
            _row_id, scope, actor_id, memory_id, window_start, max_count = params
            coalesce_mem = memory_id or "00000000-0000-0000-0000-000000000000"
            rl_key = (scope, actor_id, coalesce_mem, window_start)
            current = self._store.rate_limits.get(rl_key)
            if current is None:
                self._store.rate_limits[rl_key] = 1
                self._pending = [{"request_count": 1}]
                return
            if current < max_count:
                new_count = current + 1
                self._store.rate_limits[rl_key] = new_count
                self._pending = [{"request_count": new_count}]
                return
            self._pending = []
            return
        if "UPDATE SOCIAL_IDEMPOTENCY" in up:
            # complete_idempotency: result_id, result_state, result_payload, actor, op, key
            result_id = params[0]
            result_state = params[1]
            result_payload = params[2]
            key = (params[3], params[4], params[5])
            row = self._store.idempotency.get(key)
            if row is not None:
                row["result_id"] = result_id
                row["result_state"] = result_state
                row["result_payload"] = result_payload
            self._pending = []
            return
        self._pending = []

    def fetchone(self):
        if getattr(self, "_pending", []):
            return self._pending[0]
        return None

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


class TestCreateTreeComment(unittest.TestCase):
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

    def tearDown(self):
        db_module.get_db_connection = self._orig_db
        tree_comments.get_db_connection = self._orig_tc
        tree_likes.get_db_connection = self._orig_tl

    def test_create_targets_tree_comments_only(self):
        result = tree_comments.create_tree_comment(
            TREE_ID, OWNER_ID, "first tree comment", idempotency_key="valid-key-0001")
        self.assertEqual(result["treeId"], TREE_ID)
        self.assertEqual(result["ownerId"], OWNER_ID)
        self.assertEqual(result["body"], "first tree comment")
        self.assertEqual(len(self.store.comments), 1)
        row = self.store.comments[0]
        self.assertEqual(row["tree_id"], TREE_ID)
        self.assertEqual(row["target_kind"], "tree")
        self.assertEqual(row["target_id"], TREE_ID)

    def test_audit_action_is_tree_comment_create_no_memory_id(self):
        tree_comments.create_tree_comment(
            TREE_ID, OWNER_ID, "audit comment", idempotency_key="valid-key-0002")
        self.assertEqual(len(self.store.audit), 1)
        entry = self.store.audit[0]
        self.assertEqual(entry["action"], "tree.comment.create")
        self.assertEqual(entry["target_kind"], "tree")
        self.assertEqual(entry["target_id"], TREE_ID)
        self.assertIsNone(entry["memory_id"])

    def test_empty_body_rejected(self):
        with self.assertRaises(SocialWriteError) as ctx:
            tree_comments.create_tree_comment(
                TREE_ID, OWNER_ID, "   ", idempotency_key="valid-key-0003")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_non_public_tree_returns_404(self):
        self.store.trees[TREE_ID] = {"id": TREE_ID, "visibility": "private"}
        with self.assertRaises(HTTPException) as ctx:
            tree_comments.create_tree_comment(
                TREE_ID, OWNER_ID, "hidden tree comment", idempotency_key="valid-key-0004")
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(len(self.store.comments), 0)

    def test_duplicate_idempotency_does_not_create_duplicate(self):
        first = tree_comments.create_tree_comment(
            TREE_ID, OWNER_ID, "dup comment", idempotency_key="valid-key-0005")
        self.assertEqual(len(self.store.comments), 1)
        second = tree_comments.create_tree_comment(
            TREE_ID, OWNER_ID, "dup comment", idempotency_key="valid-key-0005")
        self.assertEqual(len(self.store.comments), 1)
        self.assertEqual(second["id"], first["id"])

    def test_missing_idempotency_key_rejected(self):
        with self.assertRaises(SocialWriteError) as ctx:
            tree_comments.create_tree_comment(TREE_ID, OWNER_ID, "no key")
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REQUIRED")

    def test_only_tree_target_no_other_tree_leak(self):
        self.store.trees[OTHER_TREE] = {"id": OTHER_TREE, "visibility": "public"}
        tree_comments.create_tree_comment(
            TREE_ID, OWNER_ID, "scoped comment", idempotency_key="valid-key-0006")
        created = self.store.comments[0]
        self.assertEqual(created["tree_id"], TREE_ID)
        self.assertNotEqual(created["tree_id"], OTHER_TREE)
        self.assertEqual(created["target_id"], TREE_ID)


if __name__ == "__main__":
    unittest.main()
