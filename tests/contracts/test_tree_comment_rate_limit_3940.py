"""Focused contract and regression tests for Tree-level comment creation rate limiting (#3940).

Verifies the bounded actor-wide rate-limit contract on whole-tree comment creation:
- Actor ceiling: 10 writes per minute (reusing COMMENT_ACTOR_LIMIT = 10, WINDOW_MINUTES = 1)
- Scope: distinct 'tree-comment:actor' with memory_id=None (Tree ID is never put in memory_id)
- First 10 unique-key writes succeed
- 11th (N+1) unique-key fresh write is rejected with HTTP 429 RATE_LIMITED and bounded retry metadata
- N+1 rejection results in 0 tree_comments insertions (zero mutation)
- Replay of existing idempotency key succeeds without consuming additional rate quota
- Rate-limit storage / query outage fails closed with sanitized HTTP 503 RATE_LIMIT_UNAVAILABLE (0 insertion)
- Independent actors maintain independent rate-limit quotas
- Private / nonexistent / non-public Trees fail closed 404 before rate-limit check or insert
- Moment comment rate limiting (comment:actor, comment:actor-memory) semantics are preserved
- Transaction ordering: visibility lock -> idempotency check/replay -> rate limit -> insert -> complete idempotency -> audit -> commit

Refs: #3940, #3947, #3987, #3184, #3177, #3396, #1882
"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from typing import Any
from fastapi import HTTPException

from modal_compute import db as db_module
from modal_compute import social_rate_limit
from modal_compute import tree_comments
from modal_compute import tree_likes
from modal_compute.social_errors import SocialWriteError

TREE_ID = "22222222-2222-2222-2222-222222222222"
ACTOR_A = "actor-alice-111"
ACTOR_B = "actor-bob-222"


class _Store:
    def __init__(self):
        self.trees: dict[str, dict[str, Any]] = {}
        self.idempotency: dict[tuple[str, str, str], dict[str, Any]] = {}
        self.comments: list[dict[str, Any]] = []
        self.audit: list[dict[str, Any]] = []
        self.rate_limits: dict[tuple[str, str, str, str], int] = {}
        self.fail_rate_limits = False
        self.operation_trace: list[str] = []


class _Cursor:
    def __init__(self, store: _Store):
        self._store = store
        self._pending: list[dict[str, Any]] = []

    def execute(self, sql: str, params: Any = None):
        params = params or ()
        up = sql.strip().upper()

        if "FROM TREES" in up:
            self._store.operation_trace.append("check_visibility")
            tree_id = params[0]
            row = self._store.trees.get(tree_id)
            self._pending = [row] if row is not None else []
            return

        if "FROM TREE_COMMENTS" in up:
            self._store.operation_trace.append("select_tree_comment")
            comment_id = params[0]
            match = next((c for c in self._store.comments if c["id"] == comment_id), None)
            self._pending = [match] if match is not None else []
            return

        if "FROM SOCIAL_IDEMPOTENCY" in up:
            self._store.operation_trace.append("select_idempotency")
            key = (params[0], params[1], params[2])
            row = self._store.idempotency.get(key)
            self._pending = [row] if row is not None else []
            return

        if "INSERT INTO SOCIAL_IDEMPOTENCY" in up:
            self._store.operation_trace.append("reserve_idempotency")
            (_id, actor, op, ikey, fp, tkind, tid, tmem, rid) = params
            existing_key = (actor, op, ikey)
            existing = self._store.idempotency.get(existing_key)
            if existing is not None:
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

        if "INSERT INTO SOCIAL_RATE_LIMITS" in up:
            self._store.operation_trace.append("check_rate_limit")
            if self._store.fail_rate_limits:
                raise RuntimeError("Synthetic rate-limit database connection outage")
            _row_id, scope, actor_id, memory_id, window_start, max_count = params
            coalesce_mem = memory_id or "00000000-0000-0000-0000-000000000000"
            rl_key = (scope, actor_id, coalesce_mem, str(window_start))
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
            # Over ceiling -> ON CONFLICT UPDATE WHERE request_count < max_count yields no rows
            self._pending = []
            return

        if "INSERT INTO TREE_COMMENTS" in up:
            self._store.operation_trace.append("insert_tree_comment")
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
            self._store.operation_trace.append("record_audit")
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

        if "UPDATE SOCIAL_IDEMPOTENCY" in up:
            self._store.operation_trace.append("complete_idempotency")
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

    def fetchone(self) -> dict[str, Any] | None:
        if getattr(self, "_pending", []):
            return self._pending[0]
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        rows = getattr(self, "_pending", [])
        self._pending = []
        return rows

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def commit(self):
        self._store.operation_trace.append("commit")

    def rollback(self):
        self._store.operation_trace.append("rollback")


class _FakeDb:
    def __init__(self, store: _Store):
        self._store = store

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return _Cursor(self._store)

    def commit(self):
        self._store.operation_trace.append("db_commit")

    def rollback(self):
        self._store.operation_trace.append("db_rollback")


class TestTreeCommentRateLimit3940(unittest.TestCase):
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

    def test_first_10_unique_key_comments_succeed(self):
        """A single actor can write up to 10 unique-key tree comments per minute."""
        for i in range(1, 11):
            res = tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body=f"Comment number {i}",
                idempotency_key=f"unique-key-{i:04d}",
            )
            self.assertEqual(res["treeId"], TREE_ID)
            self.assertEqual(res["ownerId"], ACTOR_A)
            self.assertEqual(res["body"], f"Comment number {i}")

        self.assertEqual(len(self.store.comments), 10)
        # Check rate-limit entry exists for tree-comment:actor
        rate_limit_keys = [k for k in self.store.rate_limits.keys() if k[0] == "tree-comment:actor" and k[1] == ACTOR_A]
        self.assertEqual(len(rate_limit_keys), 1)
        self.assertEqual(self.store.rate_limits[rate_limit_keys[0]], 10)

    def test_11th_unique_key_fresh_write_rejected_429(self):
        """The 11th fresh write in the same window is rejected with HTTP 429 and retry metadata."""
        for i in range(1, 11):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body=f"Comment {i}",
                idempotency_key=f"seq-key-{i:04d}",
            )

        self.assertEqual(len(self.store.comments), 10)

        # 11th request with fresh idempotency key
        with self.assertRaises(SocialWriteError) as ctx:
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="11th comment exceeding quota",
                idempotency_key="seq-key-0011",
            )

        err = ctx.exception
        self.assertEqual(err.status_code, 429)
        self.assertEqual(err.code, "RATE_LIMITED")
        self.assertEqual(err.retry_after_ms, 60000)
        self.assertIn("Too many comments", err.message)

    def test_11th_rejection_results_in_zero_comment_insertions(self):
        """When 429 rate limit is hit, no comment is inserted (zero mutation on tree_comments)."""
        for i in range(1, 11):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body=f"Comment {i}",
                idempotency_key=f"fill-key-{i:04d}",
            )

        comments_before = len(self.store.comments)
        self.assertEqual(comments_before, 10)

        with self.assertRaises(SocialWriteError):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="Blocked comment",
                idempotency_key="blocked-key-0001",
            )

        comments_after = len(self.store.comments)
        self.assertEqual(comments_after, 10)
        self.assertEqual(comments_after - comments_before, 0)
        self.assertIn("db_rollback", self.store.operation_trace)

    def test_replay_of_successful_comment_succeeds_without_consuming_quota(self):
        """Idempotency replay returns cached result and consumes 0 rate-limit quota."""
        first = tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_A,
            body="Original comment",
            idempotency_key="replay-test-key-001",
        )
        self.assertEqual(len(self.store.comments), 1)

        rate_limit_keys = [k for k in self.store.rate_limits.keys() if k[0] == "tree-comment:actor" and k[1] == ACTOR_A]
        count_after_first = self.store.rate_limits[rate_limit_keys[0]]
        self.assertEqual(count_after_first, 1)

        # Replay the same idempotency key
        replay_res = tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_A,
            body="Original comment",
            idempotency_key="replay-test-key-001",
        )

        self.assertEqual(replay_res["id"], first["id"])
        self.assertEqual(len(self.store.comments), 1)
        # Quota remains 1 (0 additional quota consumed)
        self.assertEqual(self.store.rate_limits[rate_limit_keys[0]], 1)

        # Audit contains replay entry
        replay_audits = [a for a in self.store.audit if a["action"] == "tree.comment.create.replay"]
        self.assertEqual(len(replay_audits), 1)

    def test_replay_after_limit_exhausted_still_succeeds(self):
        """An actor who has hit 10 comments can still replay previously successful writes."""
        # Create 10 comments
        for i in range(1, 11):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body=f"Comment {i}",
                idempotency_key=f"exhaust-key-{i:04d}",
            )

        # Fresh 11th is blocked
        with self.assertRaises(SocialWriteError):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="Fresh 11th",
                idempotency_key="exhaust-key-0011",
            )

        # But replaying 1st key succeeds
        replay_1 = tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_A,
            body="Comment 1",
            idempotency_key="exhaust-key-0001",
        )
        self.assertEqual(replay_1["body"], "Comment 1")
        self.assertEqual(len(self.store.comments), 10)

    def test_rate_limit_storage_failure_fails_closed_sanitized_503(self):
        """Storage/query failure during rate limit check raises 503 and rolls back (0 insert)."""
        self.store.fail_rate_limits = True

        with self.assertRaises(SocialWriteError) as ctx:
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="Failing storage comment",
                idempotency_key="outage-key-0001",
            )

        err = ctx.exception
        self.assertEqual(err.status_code, 503)
        self.assertEqual(err.code, "RATE_LIMIT_UNAVAILABLE")
        self.assertEqual(err.message, "Comment write service is temporarily unavailable")
        self.assertEqual(len(self.store.comments), 0)
        self.assertIn("db_rollback", self.store.operation_trace)

    def test_independent_actors_have_independent_quotas(self):
        """Actor A hitting rate limit does not block Actor B."""
        for i in range(1, 11):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body=f"Alice {i}",
                idempotency_key=f"alice-key-{i:04d}",
            )

        # Actor A is blocked
        with self.assertRaises(SocialWriteError):
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="Alice 11",
                idempotency_key="alice-key-0011",
            )

        # Actor B can successfully write
        bob_res = tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_B,
            body="Bob 1",
            idempotency_key="bob-key-0001",
        )
        self.assertEqual(bob_res["ownerId"], ACTOR_B)
        self.assertEqual(len(self.store.comments), 11)

    def test_distinct_scope_and_memory_id_is_none(self):
        """Scope is tree-comment:actor and memory_id is None (never stores Tree ID in memory_id)."""
        tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_A,
            body="Scope check",
            idempotency_key="scope-key-0001",
        )

        for rl_key in self.store.rate_limits.keys():
            scope, actor_id, coalesce_mem, _window = rl_key
            self.assertEqual(scope, "tree-comment:actor")
            self.assertEqual(actor_id, ACTOR_A)
            # COALESCE(memory_id, '00000000-0000-0000-0000-000000000000') must be null UUID, NOT tree_id
            self.assertEqual(coalesce_mem, "00000000-0000-0000-0000-000000000000")
            self.assertNotEqual(coalesce_mem, TREE_ID)

    def test_non_public_tree_fails_404_before_rate_limit(self):
        """Private or missing tree raises 404 before rate-limit checking or insertions."""
        self.store.trees[TREE_ID] = {"id": TREE_ID, "visibility": "private"}

        with self.assertRaises(HTTPException) as ctx:
            tree_comments.create_tree_comment(
                tree_id=TREE_ID,
                owner_id=ACTOR_A,
                body="Private tree comment",
                idempotency_key="priv-key-0001",
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(len(self.store.comments), 0)
        self.assertEqual(len(self.store.rate_limits), 0)
        self.assertNotIn("check_rate_limit", self.store.operation_trace)
        self.assertNotIn("insert_tree_comment", self.store.operation_trace)

    def test_transaction_ordering_trace(self):
        """Validates exact transaction ordering: visibility -> idempotency -> rate limit -> insert -> complete -> audit -> commit."""
        self.store.operation_trace.clear()
        tree_comments.create_tree_comment(
            tree_id=TREE_ID,
            owner_id=ACTOR_A,
            body="Trace comment",
            idempotency_key="trace-key-0001",
        )

        expected_order = [
            "check_visibility",
            "select_idempotency",
            "reserve_idempotency",
            "check_rate_limit",
            "insert_tree_comment",
            "complete_idempotency",
            "record_audit",
            "db_commit",
        ]
        self.assertEqual(self.store.operation_trace, expected_order)

    def test_moment_comment_rate_limiting_preserved(self):
        """Ensures check_comment_rate_limits for Moment comments is unchanged and functional."""
        with self.fake.cursor() as cur:
            # Under limit
            social_rate_limit.check_comment_rate_limits(
                cur,
                actor_id=ACTOR_A,
                memory_id="11111111-1111-1111-1111-111111111111",
            )
            # Check moment scopes were created
            moment_actor_keys = [k for k in self.store.rate_limits.keys() if k[0] == "comment:actor"]
            moment_memory_keys = [k for k in self.store.rate_limits.keys() if k[0] == "comment:actor-memory"]
            self.assertEqual(len(moment_actor_keys), 1)
            self.assertEqual(len(moment_memory_keys), 1)


if __name__ == "__main__":
    unittest.main()
