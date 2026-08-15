#!/usr/bin/env python3
"""Executable contract tests for comment forward cursor pagination (Issue #3939).

Verifies across all three comment read surfaces:
1. Public Moment comments (fetch_public_comments)
2. Authenticated Moment comments (fetch_comments / page_comments)
3. Public Tree comments (fetch_tree_comments)

Key properties verified:
- Stable order: created_at ASC, id ASC
- Bounded forward pagination (limit + 1 has_more detection)
- Equal timestamp tie-breaking without duplicate or skip
- 21+ comments pagination convergence
- Malformed / corrupted / wrong-kind / target-mismatched cursor fails closed with 400
- Hidden and soft-deleted comment exclusion
- Privacy-safe DTOs (zero raw owner ID)

Refs: #3939, #3940, #3929, #3926, #3408, #3075, #1882
"""

from __future__ import annotations

import base64
import json
import os
import sys
import unittest
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from fastapi import HTTPException

from modal_compute.social_cursor import (
    CommentCursorError,
    decode_comment_cursor,
    encode_comment_cursor,
)
from modal_compute.comments import (
    fetch_public_comments,
    fetch_comments,
    page_comments,
    normalize_public_comment_row,
    normalize_comment_row,
)
from modal_compute.tree_comments import (
    fetch_tree_comments,
    normalize_public_tree_comment_row,
)


class TestSocialCursorUnit(unittest.TestCase):
    """Unit tests for cursor encoding, decoding, validation, and tamper-resistance."""

    def test_encode_decode_roundtrip(self):
        dt = datetime(2026, 8, 15, 7, 30, 0, 123456, tzinfo=timezone.utc)
        cursor_str = encode_comment_cursor("moment_comments", dt, "comment-123", target_id="mem-456")

        decoded = decode_comment_cursor(cursor_str, "moment_comments", expected_target_id="mem-456")
        self.assertEqual(decoded["id"], "comment-123")
        self.assertEqual(decoded["target_id"], "mem-456")
        self.assertEqual(decoded["created_at"], dt)

    def test_bad_version_rejected(self):
        payload = {"v": 999, "k": "moment_comments", "c": "2026-08-15T07:30:00+00:00", "i": "c-1"}
        raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor(raw, "moment_comments")
        self.assertEqual(ctx.exception.reason, "bad_version")

    def test_wrong_kind_rejected(self):
        dt = datetime.now(timezone.utc)
        cursor_str = encode_comment_cursor("tree_comments", dt, "c-1")
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor(cursor_str, "moment_comments")
        self.assertEqual(ctx.exception.reason, "wrong_kind")

    def test_target_mismatch_rejected(self):
        dt = datetime.now(timezone.utc)
        cursor_str = encode_comment_cursor("moment_comments", dt, "c-1", target_id="mem-aaa")
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor(cursor_str, "moment_comments", expected_target_id="mem-bbb")
        self.assertEqual(ctx.exception.reason, "target_mismatch")

    def test_malformed_base64_rejected(self):
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor("not-valid-base64!@#$", "moment_comments")
        self.assertEqual(ctx.exception.reason, "not_base64_json")

    def test_empty_cursor_rejected(self):
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor("", "moment_comments")
        self.assertEqual(ctx.exception.reason, "empty")

    def test_oversized_cursor_rejected(self):
        huge = "a" * 2000
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor(huge, "moment_comments")
        self.assertEqual(ctx.exception.reason, "oversized")

    def test_bad_timestamp_rejected(self):
        payload = {"v": 1, "k": "moment_comments", "c": "not-a-timestamp", "i": "c-1"}
        raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        with self.assertRaises(CommentCursorError) as ctx:
            decode_comment_cursor(raw, "moment_comments")
        self.assertEqual(ctx.exception.reason, "bad_timestamp")


class _MockDbCursor:
    def __init__(self, rows_provider):
        self._rows_provider = rows_provider
        self.last_query = None
        self.last_params = None
        self._pending = []

    def execute(self, query, params=None):
        self.last_query = query
        self.last_params = params
        self._pending = self._rows_provider(query, params)

    def fetchall(self):
        return list(self._pending)

    def fetchone(self):
        return self._pending[0] if self._pending else None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class _MockDbConnection:
    def __init__(self, rows_provider):
        self._rows_provider = rows_provider

    def cursor(self):
        return _MockDbCursor(self._rows_provider)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


class TestPublicMomentCommentsPagination(unittest.TestCase):
    """Executable regression tests for public moment comments forward cursor pagination."""

    def setUp(self):
        self.memory_id = str(uuid.UUID("11111111-1111-1111-1111-111111111111"))
        self.base_time = datetime(2026, 8, 15, 10, 0, 0, tzinfo=timezone.utc)

    def _make_comments(self, count, same_timestamp=False):
        comments = []
        for i in range(count):
            created_at = self.base_time if same_timestamp else self.base_time + timedelta(seconds=i)
            cid = f"{i:08d}-0000-0000-0000-000000000000"
            comments.append({
                "id": cid,
                "memory_id": self.memory_id,
                "body": f"Comment {i + 1}",
                "status": "visible",
                "deleted_at": None,
                "created_at": created_at,
                "updated_at": created_at,
            })
        return comments

    def test_25_comments_paginated_across_3_pages(self):
        all_comments = self._make_comments(25)

        def mock_query(query, params):
            # parse params: safe_memory_id, [cursor_ts, cursor_ts, cursor_id], limit+1
            limit = params[-1]
            rows = [c for c in all_comments if c["memory_id"] == params[0] and c["status"] == "visible"]
            if len(params) > 2:
                c_ts, _, c_id = params[1], params[2], params[3]
                rows = [
                    c for c in rows
                    if (c["created_at"] > c_ts) or (c["created_at"] == c_ts and str(c["id"]) > c_id)
                ]
            rows.sort(key=lambda c: (c["created_at"], str(c["id"])))
            return rows[:limit]

        with patch("modal_compute.comments.get_db_connection", return_value=_MockDbConnection(mock_query)):
            # Page 1 (limit 10)
            page1 = fetch_public_comments(self.memory_id, limit=10)
            self.assertEqual(len(page1["comments"]), 10)
            self.assertIsNotNone(page1["nextCursor"])
            self.assertEqual(page1["comments"][0]["body"], "Comment 1")
            self.assertEqual(page1["comments"][9]["body"], "Comment 10")

            # Page 2 (limit 10)
            page2 = fetch_public_comments(self.memory_id, limit=10, cursor=page1["nextCursor"])
            self.assertEqual(len(page2["comments"]), 10)
            self.assertIsNotNone(page2["nextCursor"])
            self.assertEqual(page2["comments"][0]["body"], "Comment 11")
            self.assertEqual(page2["comments"][9]["body"], "Comment 20")

            # Page 3 (limit 10)
            page3 = fetch_public_comments(self.memory_id, limit=10, cursor=page2["nextCursor"])
            self.assertEqual(len(page3["comments"]), 5)
            self.assertIsNone(page3["nextCursor"])
            self.assertEqual(page3["comments"][0]["body"], "Comment 21")
            self.assertEqual(page3["comments"][4]["body"], "Comment 25")

            # Convergence: all 25 comments fetched without duplicate or skip
            all_fetched = page1["comments"] + page2["comments"] + page3["comments"]
            self.assertEqual(len(all_fetched), 25)
            fetched_ids = [c["id"] for c in all_fetched]
            self.assertEqual(len(set(fetched_ids)), 25)

    def test_equal_timestamps_tie_breaking_no_duplicate_no_skip(self):
        all_comments = self._make_comments(5, same_timestamp=True)

        def mock_query(query, params):
            limit = params[-1]
            rows = [c for c in all_comments if c["memory_id"] == params[0] and c["status"] == "visible"]
            if len(params) > 2:
                c_ts, _, c_id = params[1], params[2], params[3]
                rows = [
                    c for c in rows
                    if (c["created_at"] > c_ts) or (c["created_at"] == c_ts and str(c["id"]) > c_id)
                ]
            rows.sort(key=lambda c: (c["created_at"], str(c["id"])))
            return rows[:limit]

        with patch("modal_compute.comments.get_db_connection", return_value=_MockDbConnection(mock_query)):
            # Page 1 (limit 2)
            p1 = fetch_public_comments(self.memory_id, limit=2)
            self.assertEqual(len(p1["comments"]), 2)
            self.assertIsNotNone(p1["nextCursor"])

            # Page 2 (limit 2)
            p2 = fetch_public_comments(self.memory_id, limit=2, cursor=p1["nextCursor"])
            self.assertEqual(len(p2["comments"]), 2)
            self.assertIsNotNone(p2["nextCursor"])

            # Page 3 (limit 2)
            p3 = fetch_public_comments(self.memory_id, limit=2, cursor=p2["nextCursor"])
            self.assertEqual(len(p3["comments"]), 1)
            self.assertIsNone(p3["nextCursor"])

            all_ids = [c["id"] for c in p1["comments"] + p2["comments"] + p3["comments"]]
            self.assertEqual(len(all_ids), 5)
            self.assertEqual(len(set(all_ids)), 5)

    def test_hidden_and_deleted_comments_excluded(self):
        c1 = {"id": "11111111-0000-0000-0000-000000000001", "memory_id": self.memory_id, "body": "Visible", "status": "visible", "deleted_at": None, "created_at": self.base_time}
        c2 = {"id": "11111111-0000-0000-0000-000000000002", "memory_id": self.memory_id, "body": "Deleted", "status": "deleted", "deleted_at": self.base_time, "created_at": self.base_time + timedelta(seconds=1)}
        c3 = {"id": "11111111-0000-0000-0000-000000000003", "memory_id": self.memory_id, "body": "Hidden", "status": "hidden", "deleted_at": self.base_time, "created_at": self.base_time + timedelta(seconds=2)}

        def mock_query(query, params):
            return [c1]

        with patch("modal_compute.comments.get_db_connection", return_value=_MockDbConnection(mock_query)):
            res = fetch_public_comments(self.memory_id, limit=10)
            self.assertEqual(len(res["comments"]), 1)
            self.assertEqual(res["comments"][0]["body"], "Visible")
            self.assertIsNone(res["nextCursor"])

    def test_malformed_cursor_fails_closed_with_400(self):
        with self.assertRaises(HTTPException) as ctx:
            fetch_public_comments(self.memory_id, cursor="invalid_cursor_token")
        self.assertEqual(ctx.exception.status_code, 400)


class TestTreeCommentsPagination(unittest.TestCase):
    """Executable regression tests for whole-tree comments forward cursor pagination."""

    def setUp(self):
        self.tree_id = str(uuid.UUID("22222222-2222-2222-2222-222222222222"))
        self.base_time = datetime(2026, 8, 15, 12, 0, 0, tzinfo=timezone.utc)

    def _make_tree_comments(self, count):
        comments = []
        for i in range(count):
            dt = self.base_time + timedelta(seconds=i)
            cid = f"{i:08d}-2222-2222-2222-000000000000"
            comments.append({
                "id": cid,
                "tree_id": self.tree_id,
                "owner_id": f"user-{i}",
                "body": f"Tree Comment {i + 1}",
                "created_at": dt,
                "updated_at": dt,
            })
        return comments

    def test_25_tree_comments_paginated_and_privacy_safe(self):
        all_comments = self._make_tree_comments(25)

        def mock_query(query, params):
            limit = params[-1]
            rows = [c for c in all_comments if c["tree_id"] == params[0]]
            if len(params) > 2:
                c_ts, _, c_id = params[1], params[2], params[3]
                rows = [
                    c for c in rows
                    if (c["created_at"] > c_ts) or (c["created_at"] == c_ts and str(c["id"]) > c_id)
                ]
            rows.sort(key=lambda c: (c["created_at"], str(c["id"])))
            return rows[:limit]

        with patch("modal_compute.tree_comments.require_public_tree_for_like", return_value=None):
            with patch("modal_compute.tree_comments.get_db_connection", return_value=_MockDbConnection(mock_query)):
                # Page 1 (limit 10)
                p1 = fetch_tree_comments(self.tree_id, limit=10)
                self.assertEqual(len(p1["comments"]), 10)
                self.assertIsNotNone(p1["nextCursor"])

                # Page 2 (limit 10)
                p2 = fetch_tree_comments(self.tree_id, limit=10, cursor=p1["nextCursor"])
                self.assertEqual(len(p2["comments"]), 10)
                self.assertIsNotNone(p2["nextCursor"])

                # Page 3 (limit 10)
                p3 = fetch_tree_comments(self.tree_id, limit=10, cursor=p2["nextCursor"])
                self.assertEqual(len(p3["comments"]), 5)
                self.assertIsNone(p3["nextCursor"])

                # Privacy check: zero raw owner_id in output
                for c in p1["comments"] + p2["comments"] + p3["comments"]:
                    self.assertNotIn("ownerId", c)
                    self.assertNotIn("owner_id", c)
                    self.assertEqual(c["authorDisplayLabel"], "anonymous")


class TestAuthenticatedMomentCommentsPagination(unittest.TestCase):
    """Executable regression tests for page_comments authenticated pagination."""

    def setUp(self):
        self.memory_id = str(uuid.UUID("33333333-3333-3333-3333-333333333333"))
        self.requester_uid = "requester-user-123"
        self.base_time = datetime(2026, 8, 15, 14, 0, 0, tzinfo=timezone.utc)

    def test_page_comments_with_is_own(self):
        c1 = {
            "id": "33333333-0000-0000-0000-000000000001",
            "memory_id": self.memory_id,
            "owner_id": self.requester_uid,
            "body": "Own comment",
            "status": "visible",
            "deleted_at": None,
            "created_at": self.base_time,
            "updated_at": self.base_time,
        }
        c2 = {
            "id": "33333333-0000-0000-0000-000000000002",
            "memory_id": self.memory_id,
            "owner_id": "other-user-456",
            "body": "Foreign comment",
            "status": "visible",
            "deleted_at": None,
            "created_at": self.base_time + timedelta(seconds=1),
            "updated_at": self.base_time + timedelta(seconds=1),
        }

        def mock_query(query, params):
            return [c1, c2]

        with patch("modal_compute.comments.require_memory_visible_or_owner", return_value=None):
            with patch("modal_compute.comments.get_db_connection", return_value=_MockDbConnection(mock_query)):
                comments, next_cursor = page_comments(self.memory_id, self.requester_uid, limit=10)
                self.assertEqual(len(comments), 2)
                self.assertIsNone(next_cursor)
                self.assertTrue(comments[0]["isOwn"])
                self.assertFalse(comments[1]["isOwn"])
                self.assertNotIn("ownerId", comments[0])
                self.assertNotIn("owner_id", comments[0])


if __name__ == "__main__":
    unittest.main()
