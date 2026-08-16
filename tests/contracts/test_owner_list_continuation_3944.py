#!/usr/bin/env python3
"""
Executable contract/behavior tests for #3944: bounded deterministic
continuation for owner Tree / Memory lists beyond the 200-row cap.

Backend cursor mode is additive:
- legacy `fetch_user_trees` / `fetch_owner_memories` keep returning a raw array;
- `page_user_trees` / `page_owner_memories` return (items, nextCursor)
  over a stable (created_at DESC, id DESC) keyset, LIMIT limit+1, owner
  predicate always from the authenticated UID.

The DB is mocked with an in-memory keyset filter that mirrors the SQL
predicate, so convergence / no-skip / no-duplicate / tie-break / cross-owner
/ cross-tree behavior is exercised deterministically without a live Postgres.

Run: python3 tests/contracts/test_owner_list_continuation_3944.py
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

import modal_compute.owner_reads as owner_reads

OWNER_A = "owner-a" + "0" * 24
OWNER_B = "owner-b" + "1" * 24


def _iso(ts: datetime) -> str:
    return ts.isoformat()


def _tree_row(tree_id, created_at, owner=OWNER_A, memory_count=0):
    return {
        "id": tree_id,
        "owner_id": owner,
        "title": f"tree-{tree_id}",
        "visibility": "public",
        "group_name": None,
        "keywords": [],
        "created_at": created_at,
        "updated_at": created_at,
        "memory_count": memory_count,
        "like_count": 0,
        "view_count": 0,
    }


def _memory_row(memory_id, tree_id, created_at, owner=OWNER_A, with_tree=True):
    return {
        "id": memory_id,
        "tree_id": tree_id if with_tree else None,
        "parent_id": None,
        "title": f"mem-{memory_id}",
        "memo": "",
        "artist": "",
        "source": "youtube",
        "source_url": "",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "timestamp": "",
        "visibility": "public",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        "created_at": created_at,
        "updated_at": created_at,
    }


def _after(row, cursor_c, cursor_id) -> bool:
    rc = row["created_at"]
    rid = str(row["id"])
    if rc < cursor_c:
        return True
    if rc == cursor_c and rid < cursor_id:
        return True
    return False


class FakeCursor:
    last_params = None

    def __init__(self, full_rows, kind):
        self._full_rows = full_rows
        self._kind = kind
        self.executed = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, query, params=None):
        self.executed = query
        self.params = list(params) if params else []
        FakeCursor.last_params = self.params

    def fetchall(self):
        params = self.params
        limit_plus = params[-1]
        limit = limit_plus - 1
        cursor_c = cursor_id = None
        if self._kind == "trees":
            if len(params) >= 5:
                cursor_c, cursor_id = params[1], params[3]
        else:  # memories with tree_id: [owner, tree, c, c, id, limit+1]
            if len(params) >= 6:
                cursor_c, cursor_id = params[2], params[4]
        rows = self._full_rows
        if cursor_c is not None:
            rows = [r for r in rows if _after(r, cursor_c, cursor_id)]
        return rows[:limit_plus]


class FakeConn:
    def __init__(self, full_rows, kind):
        self._rows = full_rows
        self._kind = kind

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def cursor(self):
        return FakeCursor(self._rows, self._kind)


def _run_page(fn, *args, rows, kind, **kwargs):
    captured = {}

    def fake_conn():
        return FakeConn(rows, kind)

    with patch.object(owner_reads, "get_db_connection", fake_conn), \
         patch.object(owner_reads, "run_db_with_retry", lambda op: op()), \
         patch.object(owner_reads, "_table_exists", lambda *a, **k: False), \
         patch.object(owner_reads, "_table_has_column", lambda *a, **k: False):
        result = fn(*args, **kwargs)
    return result


# ---------------------------------------------------------------------------
# Cursor encode / decode
# ---------------------------------------------------------------------------

def test_cursor_encode_decode_roundtrip_trees():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    cur = owner_reads._encode_owner_list_cursor("trees", ts, "id-1")
    decoded = owner_reads._decode_owner_list_cursor(cur, "trees")
    assert decoded["id"] == "id-1"
    assert decoded["tree_id"] is None
    assert decoded["created_at"] == ts


def test_cursor_encode_decode_roundtrip_memories_tree_scoped():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    cur = owner_reads._encode_owner_list_cursor("memories", ts, "id-9", tree_id="tree-7")
    decoded = owner_reads._decode_owner_list_cursor(cur, "memories")
    assert decoded["id"] == "id-9"
    assert decoded["tree_id"] == "tree-7"


def test_cursor_decode_rejects_not_base64():
    try:
        owner_reads._decode_owner_list_cursor("!!!not-base64!!!", "trees")
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError")


def test_cursor_decode_rejects_wrong_kind():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    cur = owner_reads._encode_owner_list_cursor("trees", ts, "id-1")
    try:
        owner_reads._decode_owner_list_cursor(cur, "memories")
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError")


def test_cursor_decode_rejects_oversized():
    big = "A" * 2000
    try:
        owner_reads._decode_owner_list_cursor(big, "trees")
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError")


def test_cursor_decode_rejects_bad_timestamp():
    import base64 as _b64
    import json as _json
    payload = _json.dumps({"v": 1, "k": "trees", "c": "not-a-date", "i": "id-1"}).encode("utf-8")
    cur = _b64.urlsafe_b64encode(payload).decode("ascii")
    try:
        owner_reads._decode_owner_list_cursor(cur, "trees")
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError")


# ---------------------------------------------------------------------------
# Tree list paging
# ---------------------------------------------------------------------------

def _sorted_trees(rows):
    return sorted(rows, key=lambda r: (r["created_at"], str(r["id"])), reverse=True)


def test_tree_page_terminal_when_rows_le_limit():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = _sorted_trees([_tree_row(f"t{i}", base) for i in range(50)])
    items, nxt = _run_page(
        owner_reads.page_user_trees, OWNER_A, 100, rows=rows, kind="trees"
    )
    assert len(items) == 50
    assert nxt is None


def test_tree_page_has_more_returns_limit_and_cursor():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = _sorted_trees([_tree_row(f"t{i}", base) for i in range(150)])
    items, nxt = _run_page(
        owner_reads.page_user_trees, OWNER_A, 100, rows=rows, kind="trees"
    )
    assert len(items) == 100
    assert nxt is not None
    decoded = owner_reads._decode_owner_list_cursor(nxt, "trees")
    assert decoded["id"] == items[-1]["id"]


def test_tree_page_over_200_convergence_no_skip_no_dup():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    total = 250
    all_ids = [f"t{i:03d}" for i in range(total)]
    rows = _sorted_trees([_tree_row(tid, base) for tid in all_ids])
    seen = []
    cursor = None
    for _ in range(10):
        items, nxt = _run_page(
            owner_reads.page_user_trees, OWNER_A, 100, cursor=cursor, rows=rows, kind="trees"
        )
        seen.extend(it["id"] for it in items)
        cursor = nxt
        if nxt is None:
            break
    assert len(seen) == total
    assert len(set(seen)) == total
    assert set(seen) == set(all_ids)


def test_tree_page_equal_timestamp_tie_break_by_id():
    ts = datetime(2026, 3, 3, 3, 3, 3, tzinfo=timezone.utc)
    ids = [f"t{i:02d}" for i in range(5, 0, -1)]  # t05..t01
    rows = _sorted_trees([_tree_row(tid, ts) for tid in ids])
    seen = []
    cursor = None
    for _ in range(10):
        items, nxt = _run_page(
            owner_reads.page_user_trees, OWNER_A, 2, cursor=cursor, rows=rows, kind="trees"
        )
        seen.extend(it["id"] for it in items)
        cursor = nxt
        if nxt is None:
            break
    assert seen == ["t05", "t04", "t03", "t02", "t01"]
    assert len(set(seen)) == 5


def test_tree_page_owner_predicate_from_auth_not_cursor():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = _sorted_trees([_tree_row(f"t{i}", base) for i in range(10)])
    ts = datetime(2025, 5, 5, tzinfo=timezone.utc)
    foreign_cursor = owner_reads._encode_owner_list_cursor("trees", ts, "foreign-id")
    _run_page(
        owner_reads.page_user_trees, OWNER_A, 100, cursor=foreign_cursor, rows=rows, kind="trees"
    )
    # Owner predicate is taken from the authenticated UID, never from the cursor.
    assert FakeCursor.last_params[0] == OWNER_A


def test_tree_page_malformed_cursor_raises():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = _sorted_trees([_tree_row(f"t{i}", base) for i in range(10)])
    try:
        _run_page(
            owner_reads.page_user_trees, OWNER_A, 100, cursor="%%%bad%%%", rows=rows, kind="trees"
        )
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError")


# ---------------------------------------------------------------------------
# Memory list paging
# ---------------------------------------------------------------------------

def test_memory_page_tree_scoped_full_owner_continuation():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    total = 220
    all_ids = [f"m{i:03d}" for i in range(total)]
    rows = sorted(
        [_memory_row(mid, "tree-X", base) for mid in all_ids],
        key=lambda r: (r["created_at"], str(r["id"])),
        reverse=True,
    )
    seen = []
    cursor = None
    for _ in range(10):
        items, nxt = _run_page(
            owner_reads.page_owner_memories, OWNER_A, "tree-X", 100, cursor=cursor, rows=rows, kind="memories"
        )
        seen.extend(it["id"] for it in items)
        cursor = nxt
        if nxt is None:
            break
    assert len(seen) == total
    assert len(set(seen)) == total


def test_memory_page_cross_tree_cursor_rejected():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ts = datetime(2025, 5, 5, tzinfo=timezone.utc)
    treeX_cursor = owner_reads._encode_owner_list_cursor("memories", ts, "m1", tree_id="tree-X")
    try:
        owner_reads.page_owner_memories(OWNER_A, "tree-Y", 100, cursor=treeX_cursor)
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError for cross-tree cursor")


def test_memory_page_full_owner_cursor_with_tree_id_rejected():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ts = datetime(2025, 5, 5, tzinfo=timezone.utc)
    treeX_cursor = owner_reads._encode_owner_list_cursor("memories", ts, "m1", tree_id="tree-X")
    try:
        owner_reads.page_owner_memories(OWNER_A, None, 100, cursor=treeX_cursor)
    except owner_reads.OwnerListCursorError:
        return
    raise AssertionError("expected OwnerListCursorError for tree-scoped cursor on full-owner list")


def test_memory_page_equal_timestamp_tie_break():
    ts = datetime(2026, 3, 3, 3, 3, 3, tzinfo=timezone.utc)
    ids = [f"m{i:02d}" for i in range(4, 0, -1)]
    rows = sorted(
        [_memory_row(mid, "tree-X", ts) for mid in ids],
        key=lambda r: (r["created_at"], str(r["id"])),
        reverse=True,
    )
    seen = []
    cursor = None
    for _ in range(10):
        items, nxt = _run_page(
            owner_reads.page_owner_memories, OWNER_A, "tree-X", 2, cursor=cursor, rows=rows, kind="memories"
        )
        seen.extend(it["id"] for it in items)
        cursor = nxt
        if nxt is None:
            break
    assert seen == ["m04", "m03", "m02", "m01"]


def test_memory_page_terminal_page_next_cursor_null():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = sorted(
        [_memory_row(f"m{i}", "tree-X", base) for i in range(30)],
        key=lambda r: (r["created_at"], str(r["id"])),
        reverse=True,
    )
    items, nxt = _run_page(
        owner_reads.page_owner_memories, OWNER_A, "tree-X", 100, cursor=None, rows=rows, kind="memories"
    )
    assert len(items) == 30
    assert nxt is None


# ---------------------------------------------------------------------------
# Legacy compatibility: array shape preserved
# ---------------------------------------------------------------------------

def test_legacy_fetch_user_trees_returns_array():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = _sorted_trees([_tree_row(f"t{i}", base) for i in range(5)])
    with patch.object(owner_reads, "get_db_connection", lambda: FakeConn(rows, "trees")), \
         patch.object(owner_reads, "run_db_with_retry", lambda op: op()), \
         patch.object(owner_reads, "_table_exists", lambda *a, **k: False), \
         patch.object(owner_reads, "_table_has_column", lambda *a, **k: False):
        result = owner_reads.fetch_user_trees(OWNER_A, limit=100)
    assert isinstance(result, list)
    assert len(result) == 5
    assert all(isinstance(r, dict) for r in result)


if __name__ == "__main__":
    import traceback

    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"ok   {t.__name__}")
        except Exception as e:  # noqa
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
