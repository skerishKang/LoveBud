#!/usr/bin/env python3
"""Focused regression coverage for Issue #3934 create_owner_memory visibility.

Covers the owner-Memory create path:

* explicit caller visibility keeps strict validation + entitlement authority
  (#3935/#3936 semantics) and persists exactly;
* omitted visibility inherits a literal public/private parent Tree visibility;
* omitted visibility with an unresolved (NULL / missing / unknown / invalid)
  parent Tree fails closed BEFORE any DB mutation (no INSERT), classified with
  the stable bounded error code TREE_VISIBILITY_UNRESOLVED.

These tests mock the DB connection and the owner-tree read so they run without a
real database and assert the zero-mutation fail-closed guarantee directly.
"""

import pytest
from fastapi import HTTPException

import modal_compute.memory_writes as mw


ROW = {
    "id": "m1",
    "tree_id": "11111111-1111-1111-1111-111111111111",
    "parent_id": None,
    "title": "T",
    "memo": "",
    "artist": "",
    "source": "",
    "source_url": "",
    "source_type": "youtube",
    "thumbnail": "",
    "emotion_tags": [],
    "timestamp": "",
    "visibility": "public",
    "channel_id": None,
    "channel_name": None,
    "channel_url": None,
    "created_at": None,
    "updated_at": None,
}


class _Capture:
    def __init__(self):
        self.calls = []
        self.insert_params = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def cursor(self):
        return _Cursor(self)

    def commit(self):
        pass


class _Cursor:
    def __init__(self, cap):
        self.cap = cap

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, query, params=None):
        self.cap.calls.append((query, params))
        if isinstance(query, str) and query.strip().upper().startswith("INSERT INTO MEMORIES"):
            self.cap.insert_params = params

    def fetchone(self):
        row = dict(ROW)
        if self.cap.insert_params is not None:
            row["visibility"] = self.cap.insert_params[12]
        return row


def _patch(monkeypatch, parent_visibility):
    cap = _Capture()
    monkeypatch.setattr(mw, "get_db_connection", lambda: cap)
    monkeypatch.setattr(
        mw,
        "fetch_owner_tree",
        lambda tid, oid: {"id": "11111111-1111-1111-1111-111111111111", "visibility": parent_visibility},
    )
    monkeypatch.setattr(mw, "require_plus_for_private_storage", lambda uid, vis: None)
    return cap


def test_explicit_public_persists_public(monkeypatch):
    cap = _patch(monkeypatch, "public")
    result = mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111", "visibility": "public"})
    assert result["visibility"] == "public"
    assert cap.insert_params[12] == "public"


def test_explicit_private_persists_private(monkeypatch):
    cap = _patch(monkeypatch, "private")
    result = mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111", "visibility": "private"})
    assert result["visibility"] == "private"
    assert cap.insert_params[12] == "private"


def test_explicit_non_literal_rejected_before_mutation(monkeypatch):
    # Contract #3: strict validation + entitlement authority preserved (#3935/#3936).
    _patch(monkeypatch, "public")
    with pytest.raises(HTTPException) as exc:
        mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111", "visibility": "secret"})
    assert exc.value.status_code == 400


def test_omit_visibility_inherits_public_parent(monkeypatch):
    cap = _patch(monkeypatch, "public")
    result = mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111"})
    assert result["visibility"] == "public"
    assert cap.insert_params[12] == "public"


def test_omit_visibility_inherits_private_parent(monkeypatch):
    cap = _patch(monkeypatch, "private")
    result = mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111"})
    assert result["visibility"] == "private"
    assert cap.insert_params[12] == "private"


@pytest.mark.parametrize("parent_visibility", [None, "", "unknown", 0, False])
def test_omit_visibility_unresolved_parent_fails_closed_no_mutation(monkeypatch, parent_visibility):
    db_calls = {"n": 0}

    class _NoDb:
        def __enter__(self):
            db_calls["n"] += 1
            return self

        def __exit__(self, *a):
            return False

        def cursor(self):
            raise AssertionError("must not open cursor on unresolved parent")

        def commit(self):
            pass

    monkeypatch.setattr(mw, "get_db_connection", lambda: _NoDb())
    monkeypatch.setattr(
        mw,
        "fetch_owner_tree",
        lambda tid, oid: {"id": "11111111-1111-1111-1111-111111111111", "visibility": parent_visibility},
    )
    monkeypatch.setattr(mw, "require_plus_for_private_storage", lambda uid, vis: None)

    with pytest.raises(HTTPException) as exc:
        mw.create_owner_memory("owner1", {"treeId": "11111111-1111-1111-1111-111111111111"})

    assert exc.value.status_code == 400
    assert exc.value.detail == {"code": "TREE_VISIBILITY_UNRESOLVED"}
    assert db_calls["n"] == 0, "no DB connection may open on unresolved parent"

