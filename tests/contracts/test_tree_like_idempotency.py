"""Pure replay-semantics tests for the tree-like generic idempotency resolver.

These tests drive reserve_and_verify_idempotency_target with an in-memory fake
cursor (no DB connection, no network). They verify the core replay-safe
decision logic required by Issue #3359:

- new reservation returns None (mutation proceeds)
- same key + same target + same payload returns the stored replay DTO
- same key + different target raises 409 IDEMPOTENCY_KEY_REUSED
- same key + different payload raises 409 IDEMPOTENCY_KEY_REUSED
- same key + pending/failed prior state raises 500 SOCIAL_WRITE_UNAVAILABLE

Refs: #3359, #3355, #3356, #3188, #3075, #1882
"""

import unittest
import uuid

from modal_compute.social_idempotency import (
    _compute_fingerprint,
    reserve_and_verify_idempotency_target,
)
from modal_compute.social_errors import SocialWriteError


class FakeCursor:
    """Minimal cursor stand-in that records the last execute params.

    fetchone() returns a pre-programmed row so the test can simulate the
    idempotency table state after the INSERT ... ON CONFLICT ... RETURNING.
    """

    def __init__(self, next_row=None):
        self.last_params = None
        self._next_row = next_row

    def execute(self, sql, params=None):
        self.last_params = params

    def fetchone(self):
        return self._next_row


def _request(target_kind="tree", target_id="11111111-1111-1111-1111-111111111111"):
    return target_kind, target_id


class TestIdempotencyReplayEngine(unittest.TestCase):
    def _call(self, cursor, target_id, fingerprint_override=None, body=None):
        body = body if body is not None else {}
        return reserve_and_verify_idempotency_target(
            cursor,
            actor_id="actor-1",
            operation="tree.like.toggle",
            idempotency_key="valid-key-1234",
            target_kind="tree",
            target_id=target_id,
            body=body,
        )

    def test_new_reservation_returns_none(self):
        # INSERT ... RETURNING yields a fresh row with result_id == generated id
        cursor = FakeCursor()
        # We cannot know the generated id ahead of time; emulate by copying it
        # after execute via a wrapper.
        sentinel = {}

        class CaptureCursor(FakeCursor):
            def fetchone(self):
                # The function generates result_id at params[8] and params[0].
                gen_id = self.last_params[0]
                return {
                    "target_kind": "tree",
                    "target_id": sentinel.get("tid", "t-1"),
                    "target_memory_id": None,
                    "result_id": gen_id,
                    "result_state": "pending",
                    "request_fingerprint": self.last_params[4],
                    "result_payload": None,
                }

        cap = CaptureCursor()
        cap.last_params = ("t-1",)  # placeholder; real value set on execute
        result = self._call_with_cursor(cap, "t-1")
        self.assertIsNone(result)

    def test_replay_completed_returns_stored_dto(self):
        stored_payload = {"treeId": "t-1", "active": True, "likeCount": 3}
        cursor = FakeCursor(
            {
                "target_kind": "tree",
                "target_id": "t-1",
                "target_memory_id": None,
                "result_id": str(uuid.uuid4()),
                "result_state": "completed",
                "request_fingerprint": _compute_fingerprint({}),
                "result_payload": stored_payload,
            }
        )
        result = self._call_with_cursor(cursor, "t-1")
        self.assertIsNotNone(result)
        self.assertTrue(result.get("replay"))
        self.assertEqual(result.get("resultPayload"), stored_payload)

    def test_target_mismatch_raises_409(self):
        cursor = FakeCursor(
            {
                "target_kind": "tree",
                "target_id": "other-tree",
                "target_memory_id": None,
                "result_id": str(uuid.uuid4()),
                "result_state": "completed",
                "request_fingerprint": _compute_fingerprint({}),
                "result_payload": None,
            }
        )
        with self.assertRaises(SocialWriteError) as ctx:
            self._call_with_cursor(cursor, "t-1")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REUSED")

    def test_payload_mismatch_raises_409(self):
        cursor = FakeCursor(
            {
                "target_kind": "tree",
                "target_id": "t-1",
                "target_memory_id": None,
                "result_id": str(uuid.uuid4()),
                "result_state": "completed",
                "request_fingerprint": "fp-different",
                "result_payload": None,
            }
        )
        with self.assertRaises(SocialWriteError) as ctx:
            self._call_with_cursor(cursor, "t-1")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "IDEMPOTENCY_KEY_REUSED")

    def test_pending_prior_state_raises_500_unavailable(self):
        cursor = FakeCursor(
            {
                "target_kind": "tree",
                "target_id": "t-1",
                "target_memory_id": None,
                "result_id": str(uuid.uuid4()),  # differs from generated id
                "result_state": "pending",
                "request_fingerprint": _compute_fingerprint({}),
                "result_payload": None,
            }
        )
        with self.assertRaises(SocialWriteError) as ctx:
            self._call_with_cursor(cursor, "t-1")
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertEqual(ctx.exception.code, "SOCIAL_WRITE_UNAVAILABLE")

    def _call_with_cursor(self, cursor, target_id, body=None):
        body = body if body is not None else {}
        return reserve_and_verify_idempotency_target(
            cursor,
            actor_id="actor-1",
            operation="tree.like.toggle",
            idempotency_key="valid-key-1234",
            target_kind="tree",
            target_id=target_id,
            body=body,
        )


if __name__ == "__main__":
    unittest.main()
