"""Replay-semantics tests for the tree-like generic idempotency resolver.

These tests drive reserve_and_verify_idempotency_target with an in-memory
stateful fake cursor (no DB connection, no network). They verify the core
replay-safe decision logic required by Issues #3359 / #3366:

- new reservation (no existing row) returns None (mutation proceeds)
- same actor + same target kind `tree` + same target id + same valid key
  first call mutates, second call returns the stored authoritative DTO
  (no second toggle, delta 0)
- same actor + same tree target + different valid key applies the next toggle
- same key + different target raises 409 IDEMPOTENCY_KEY_REUSED
- same key + different payload raises 409 IDEMPOTENCY_KEY_REUSED
- same key + pending/failed prior state raises 500 SOCIAL_WRITE_UNAVAILABLE
- replay response keys are limited to the stored DTO shape

The SELECT-first design means replay is enforced even when the DB unique
constraint on (actor_id, operation, idempotency_key) is NOT present, which is
the exact runtime gap that #3366 fixes.

Refs: #3366, #3361, #3359, #3355, #3356, #3188, #3075, #1882
"""

import json
import unittest
import uuid

from modal_compute.social_idempotency import (
    _compute_fingerprint,
    reserve_and_verify_idempotency_target,
)
from modal_compute.social_errors import SocialWriteError


TARGET_KIND = "tree"
TARGET_ID = "11111111-1111-1111-1111-111111111111"


class StatefulIdempotencyCursor:
    """In-memory stand-in for a psycopg cursor over social_idempotency.

    It persists rows keyed by (actor_id, operation, idempotency_key) and
    supports the two SQL shapes used by the resolver:
      - SELECT ... WHERE actor_id/operation/idempotency_key
      - INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING

    INSERT behaviour when a key already exists is to RETURN the existing
    row with its preserved values (simulating ON CONFLICT DO UPDATE SET
    social_idempotency.* as the live code does).
    """

    def __init__(self):
        self._rows = {}  # (actor, op, key) -> stored dict

    def _key(self, actor_id, operation, idempotency_key):
        return (actor_id, operation, idempotency_key)

    def execute(self, sql, params=None):
        self._last_sql = sql
        self._last_params = params
        up = sql.strip().upper()
        if up.startswith("SELECT"):
            a, o, k = params
            row = self._rows.get((a, o, k))
            self._pending = [row] if row is not None else []
        elif up.startswith("INSERT"):
            (_id, a, o, k, fp, tk, tid, tm, rid) = params
            key = (a, o, k)
            existing = self._rows.get(key)
            if existing is not None:
                # Conflict: RETURNING produces preserved existing row
                self._pending = [existing]
            else:
                # New reservation
                self._rows[key] = {
                    "target_kind": tk,
                    "target_id": tid,
                    "target_memory_id": tm,
                    "result_id": rid,
                    "result_state": "pending",
                    "request_fingerprint": fp,
                    "result_payload": None,
                }
                self._pending = [self._rows[key]]
        else:
            self._pending = []

    def fetchone(self):
        if getattr(self, "_pending", []):
            return self._pending[0]
        return None

    def mark_completed(self, actor_id, operation, idempotency_key, payload):
        row = self._rows[self._key(actor_id, operation, idempotency_key)]
        row["result_state"] = "completed"
        row["result_payload"] = json.dumps(payload)


class TestTreeLikeIdempotencyReplay(unittest.TestCase):
    def _first_then_replay(self, cursor, key):
        body = {}
        first = reserve_and_verify_idempotency_target(
            cursor, "actor-1", "tree.like.toggle", key,
            TARGET_KIND, TARGET_ID, body,
        )
        self.assertIsNone(first)
        # Simulate the writer completing the mutation and storing the DTO.
        cursor.mark_completed("actor-1", "tree.like.toggle", key,
                              {"treeId": TARGET_ID, "active": True, "likeCount": 3})
        second = reserve_and_verify_idempotency_target(
            cursor, "actor-1", "tree.like.toggle", key,
            TARGET_KIND, TARGET_ID, body,
        )
        return second

    def test_same_key_replay_returns_stored_dto_no_toggle(self):
        cursor = StatefulIdempotencyCursor()
        replay = self._first_then_replay(cursor, "valid-key-1234")
        self.assertIsNotNone(replay)
        self.assertTrue(replay.get("replay"))
        self.assertEqual(replay.get("resultPayload"),
                         {"treeId": TARGET_ID, "active": True, "likeCount": 3})

    def test_replay_dto_shape_limited_to_treeid_active_likecount(self):
        cursor = StatefulIdempotencyCursor()
        replay = self._first_then_replay(cursor, "valid-key-1234")
        payload = replay.get("resultPayload")
        self.assertEqual(set(payload.keys()), {"treeId", "active", "likeCount"})

    def test_new_key_second_mutation_proceeds(self):
        cursor = StatefulIdempotencyCursor()
        # First mutation with keyA
        self.assertIsNone(reserve_and_verify_idempotency_target(
            cursor, "actor-1", "tree.like.toggle", "key-a",
            TARGET_KIND, TARGET_ID, {}))
        cursor.mark_completed("actor-1", "tree.like.toggle", "key-a",
                              {"treeId": TARGET_ID, "active": True, "likeCount": 1})
        # Different valid key -> next toggle proceeds (None)
        second = reserve_and_verify_idempotency_target(
            cursor, "actor-1", "tree.like.toggle", "key-b",
            TARGET_KIND, TARGET_ID, {})
        self.assertIsNone(second)

    def test_target_mismatch_raises_409(self):
        cursor = StatefulIdempotencyCursor()
        cursor._rows[cursor._key("actor-1", "tree.like.toggle", "valid-key-1234")] = {
            "target_kind": "tree",
            "target_id": "other-tree",
            "target_memory_id": None,
            "result_id": str(uuid.uuid4()),
            "result_state": "completed",
            "request_fingerprint": _compute_fingerprint({}),
            "result_payload": None,
        }
        with self.assertRaises(SocialWriteError) as ctx:
            reserve_and_verify_idempotency_target(
                cursor, "actor-1", "tree.like.toggle", "valid-key-1234",
                TARGET_KIND, TARGET_ID, {})
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REUSED")

    def test_payload_mismatch_raises_409(self):
        cursor = StatefulIdempotencyCursor()
        cursor._rows[cursor._key("actor-1", "tree.like.toggle", "valid-key-1234")] = {
            "target_kind": "tree",
            "target_id": TARGET_ID,
            "target_memory_id": None,
            "result_id": str(uuid.uuid4()),
            "result_state": "completed",
            "request_fingerprint": "fp-different",
            "result_payload": None,
        }
        with self.assertRaises(SocialWriteError) as ctx:
            reserve_and_verify_idempotency_target(
                cursor, "actor-1", "tree.like.toggle", "valid-key-1234",
                TARGET_KIND, TARGET_ID, {})
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REUSED")

    def test_pending_prior_state_raises_500_unavailable(self):
        cursor = StatefulIdempotencyCursor()
        cursor._rows[cursor._key("actor-1", "tree.like.toggle", "valid-key-1234")] = {
            "target_kind": "tree",
            "target_id": TARGET_ID,
            "target_memory_id": None,
            "result_id": str(uuid.uuid4()),
            "result_state": "pending",
            "request_fingerprint": _compute_fingerprint({}),
            "result_payload": None,
        }
        with self.assertRaises(SocialWriteError) as ctx:
            reserve_and_verify_idempotency_target(
                cursor, "actor-1", "tree.like.toggle", "valid-key-1234",
                TARGET_KIND, TARGET_ID, {})
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertEqual(ctx.exception.code, "SOCIAL_WRITE_UNAVAILABLE")


    def test_conflict_fallback_different_target_raises_409(self):
        """INSERT conflict with different target → raise 409 IDEMPOTENCY_KEY_REUSED.

        This simulates the race where SELECT missed an existing row (returned
        None) but the INSERT hit a conflict. Returning the pre-existing row
        must trigger the same target/fingerprint/state verification as the
        SELECT-first path.
        """
        key = "key-conflict-test"
        seed_target = "other-tree-1111"
        cursor = StatefulIdempotencyCursor()
        # Pre-seed a completed row for (actor-1, key) with a different target.
        cursor._rows[cursor._key("actor-1", "tree.like.toggle", key)] = {
            "target_kind": "tree",
            "target_id": seed_target,
            "target_memory_id": None,
            "result_id": str(uuid.uuid4()),
            "result_state": "completed",
            "request_fingerprint": _compute_fingerprint({}),
            "result_payload": json.dumps({"treeId": seed_target, "active": True, "likeCount": 3}),
        }
        # Simulate SELECT missing the row by overriding _pending before execute.
        # Use a subclass that always misses on SELECT.
        class MissCursor(StatefulIdempotencyCursor):
            def execute(self, sql, params=None):
                up = (sql or "").strip().upper()
                if up.startswith("SELECT"):
                    # Skip reading — pretend no row found
                    self._pending = []
                else:
                    super().execute(sql, params)
        mc = MissCursor()
        # Copy the pre-seeded rows into the miss cursor
        mc._rows = cursor._rows
        with self.assertRaises(SocialWriteError) as ctx:
            reserve_and_verify_idempotency_target(
                mc, "actor-1", "tree.like.toggle", key,
                TARGET_KIND, TARGET_ID, {})
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REUSED")

    def test_conflict_fallback_same_target_completed_returns_replay(self):
        """INSERT conflict with same target completed → stored DTO returned.

        Same setup as the mismatch test above, but the pre-existing row has
        the same target and fingerprint, so the conflict fallback must
        return the stored DTO instead of raising.
        """
        key = "key-conflict-replay"
        cursor = StatefulIdempotencyCursor()
        cursor._rows[cursor._key("actor-1", "tree.like.toggle", key)] = {
            "target_kind": "tree",
            "target_id": TARGET_ID,
            "target_memory_id": None,
            "result_id": str(uuid.uuid4()),
            "result_state": "completed",
            "request_fingerprint": _compute_fingerprint({}),
            "result_payload": json.dumps({"treeId": TARGET_ID, "active": True, "likeCount": 5}),
        }
        class MissCursor(StatefulIdempotencyCursor):
            def execute(self, sql, params=None):
                up = (sql or "").strip().upper()
                if up.startswith("SELECT"):
                    self._pending = []
                else:
                    super().execute(sql, params)
        mc = MissCursor()
        mc._rows = cursor._rows
        result = reserve_and_verify_idempotency_target(
            mc, "actor-1", "tree.like.toggle", key,
            TARGET_KIND, TARGET_ID, {})
        self.assertIsNotNone(result)
        self.assertTrue(result.get("replay"))
        self.assertEqual(result.get("resultPayload"),
                         {"treeId": TARGET_ID, "active": True, "likeCount": 5})


if __name__ == "__main__":
    unittest.main()
