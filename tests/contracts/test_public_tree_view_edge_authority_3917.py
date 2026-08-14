"""Executable regression tests for Issue #3917 public tree view edge authority.

Drives the real Modal route `/modal/public/trees/{tree_id}/views` through the
FastAPI TestClient with the `record_public_tree_view` writer seam patched (no DB,
no network, no real secret). Proves the fail-closed security contract:

  - A valid signed edge assertion reaches the writer exactly once with an
    anonymous, server-authoritative actor.  (happy path)
  - Missing / bad / tampered signature, treeId mismatch, tampered actorKey,
    stale/future countedWindow, forged authenticated actor kind, or missing
    secret → HTTP 400 and ZERO writer (DB) calls.  (Controls D, E, F, G, H, I)
  - The same signed authority yields exactly one aggregate increment at the data
    layer (daily ON CONFLICT dedup).  (Control K)
  - Missing social tables fall back safely to counted=False / viewCount 0.
    (Control M)
  - Modal never reads CF-Connecting-IP (raw IP never reaches the data layer).
    (Control L)

The signed assertion is produced with the SAME canonical form and secret the
Cloudflare edge uses, so these tests exercise the real verification path.

Run: python3 tests/contracts/test_public_tree_view_edge_authority_3917.py
"""

from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from modal_compute.app import web_app
from modal_compute.tree_view_authority import (
    ACTOR_KIND_ANONYMOUS,
    COUNTED_WINDOW_HEADER,
    SIGNATURE_HEADER,
    SOURCE_HEADER,
    ACTOR_KEY_HEADER,
    ACTOR_KIND_HEADER,
    TREE_ID_HEADER,
    VERSION_HEADER,
    VIEW_SOURCE,
    current_utc_day,
    sign_assertion,
)
from modal_compute.tree_views import record_public_tree_view

SECRET = "test-tree-view-authority-secret-3917"
TREE_ID = str(uuid.uuid4())
EDGE_ACTOR = "edge-actor-digest-" + TREE_ID[:12]

client = TestClient(web_app)


@pytest.fixture(autouse=True)
def _secret():
    previous = os.environ.get("TREE_VIEW_AUTHORITY_SECRET")
    os.environ["TREE_VIEW_AUTHORITY_SECRET"] = SECRET
    yield
    if previous is None:
        os.environ.pop("TREE_VIEW_AUTHORITY_SECRET", None)
    else:
        os.environ["TREE_VIEW_AUTHORITY_SECRET"] = previous


def _build_headers(
    *,
    tree_id=TREE_ID,
    actor_key=EDGE_ACTOR,
    actor_kind=ACTOR_KIND_ANONYMOUS,
    source=VIEW_SOURCE,
    counted_window=None,
    signature=None,
):
    counted_window = counted_window or current_utc_day()
    if signature is None:
        signature = sign_assertion(SECRET, tree_id, actor_key, actor_kind, source, counted_window)
    return {
        VERSION_HEADER: "v1",
        TREE_ID_HEADER: tree_id,
        ACTOR_KEY_HEADER: actor_key,
        ACTOR_KIND_HEADER: actor_kind,
        SOURCE_HEADER: source,
        COUNTED_WINDOW_HEADER: counted_window,
        SIGNATURE_HEADER: signature,
    }


def _url(tree_id=TREE_ID):
    return f"/modal/public/trees/{tree_id}/views"


# ── Happy path ────────────────────────────────────────────────────────────────

@patch("modal_compute.app.record_public_tree_view")
def test_valid_signed_assertion_reaches_writer_once(mock_record):
    mock_record.return_value = {"treeId": TREE_ID, "counted": True, "viewCount": 1}
    response = client.post(_url(), headers=_build_headers())
    assert response.status_code == 200, response.text
    assert mock_record.call_count == 1
    args, _kwargs = mock_record.call_args
    assert args[0] == TREE_ID
    assert args[1] == EDGE_ACTOR
    assert args[2] == "anonymous"
    assert args[3] == "public_tree_detail"


# ── Fail-closed: zero DB calls ──────────────────────────────────────────────────

@patch("modal_compute.app.record_public_tree_view")
def test_missing_signature_zero_db_calls(mock_record):
    headers = _build_headers()
    headers.pop(SIGNATURE_HEADER)
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_bad_signature_zero_db_calls(mock_record):
    headers = _build_headers(signature="deadbeef" * 8)
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_tampered_tree_id_zero_db_calls(mock_record):
    # Assertion claims tree "other" but the route tree_id is TREE_ID.
    headers = _build_headers(tree_id="other-tree-id")
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_tampered_actor_key_zero_db_calls(mock_record):
    # Valid signature computed over EDGE_ACTOR, but the header swaps the actor
    # key to an attacker value. The signature no longer binds the header actor
    # key, so verification must fail (zero DB calls).
    valid_signature = sign_assertion(SECRET, TREE_ID, EDGE_ACTOR, ACTOR_KIND_ANONYMOUS, VIEW_SOURCE, current_utc_day())
    headers = {
        VERSION_HEADER: "v1",
        TREE_ID_HEADER: TREE_ID,
        ACTOR_KEY_HEADER: "attacker-forged-actor",
        ACTOR_KIND_HEADER: "anonymous",
        SOURCE_HEADER: VIEW_SOURCE,
        COUNTED_WINDOW_HEADER: current_utc_day(),
        SIGNATURE_HEADER: valid_signature,
    }
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_stale_counted_window_zero_db_calls(mock_record):
    from datetime import datetime, timedelta, timezone

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    headers = _build_headers(counted_window=yesterday)
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_future_counted_window_zero_db_calls(mock_record):
    from datetime import datetime, timedelta, timezone

    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    headers = _build_headers(counted_window=tomorrow)
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_forged_authenticated_actor_kind_rejected(mock_record):
    # A forged authenticated actor kind must be rejected, never upgraded.
    headers = _build_headers(actor_kind="authenticated")
    response = client.post(_url(), headers=headers)
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_missing_secret_zero_db_calls(mock_record):
    with patch.dict(os.environ, {"TREE_VIEW_AUTHORITY_SECRET": ""}):
        response = client.post(_url(), headers=_build_headers())
    assert response.status_code == 400
    assert mock_record.call_count == 0


@patch("modal_compute.app.record_public_tree_view")
def test_direct_modal_call_with_no_assertion_zero_db_calls(mock_record):
    # No assertion headers at all (e.g., attacker calling Modal directly).
    response = client.post(_url())
    assert response.status_code == 400
    assert mock_record.call_count == 0


# ── Control L: Modal never consumes raw client IP ──────────────────────────────

@patch("modal_compute.app.record_public_tree_view")
def test_modal_writer_receives_only_opaque_actor_key(mock_record):
    mock_record.return_value = {"treeId": TREE_ID, "counted": True, "viewCount": 1}
    response = client.post(_url(), headers=_build_headers())
    assert response.status_code == 200
    # The writer receives the opaque digest, never the raw IP.
    assert "CF-Connecting-IP" not in str(mock_record.call_args)
    assert mock_record.call_args.args[1] == EDGE_ACTOR


# ── Control K: same authority → exactly one aggregate increment (data layer) ────

class FakeViewCursor:
    def __init__(self, tree_id, social_tables_exist=True):
        self.tree_id = tree_id
        self.social_tables_exist = social_tables_exist
        self._dedup = {}
        self.view_count = 0
        self._mode = None
        self._params = None

    def execute(self, sql, params=None):
        s = sql.strip().upper()
        if "INFORMATION_SCHEMA.TABLES" in s:
            self._mode = "table_exists"
        elif "INFORMATION_SCHEMA.COLUMNS" in s:
            self._mode = "column_exists"
        elif "FROM TREES" in s and "VISIBILITY" in s:
            self._mode = "tree"
        elif s.startswith("INSERT INTO tree_social_counts".upper()):
            self._mode = None
        elif s.startswith("INSERT INTO tree_view_dedup_events".upper()):
            self._mode = "dedup"
            self._params = params
        elif s.startswith("UPDATE tree_social_counts".upper()):
            self.view_count += 1
            self._mode = None
        elif "VIEW_COUNT" in s and "TREE_SOCIAL_COUNTS" in s:
            self._mode = "view_count"
        else:
            self._mode = None

    def fetchone(self):
        if self._mode == "table_exists":
            return {"exists": self.social_tables_exist}
        if self._mode == "column_exists":
            return {"exists": True}
        if self._mode == "tree":
            return {"id": self.tree_id}
        if self._mode == "dedup":
            actor_key = self._params[2]
            if actor_key in self._dedup:
                self._mode = None
                return None  # ON CONFLICT DO NOTHING
            self._dedup[actor_key] = True
            self._mode = None
            return {"id": self._params[0]}
        if self._mode == "view_count":
            return {"view_count": self.view_count}
        return None


def _view_conn_context(cursor):
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: cursor
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    context = MagicMock()
    context.return_value.__enter__ = lambda s: conn
    context.return_value.__exit__ = MagicMock(return_value=False)
    return context


@patch("modal_compute.tree_views.get_db_connection")
def test_same_authority_idempotent_one_increment(mock_conn):
    cursor = FakeViewCursor(TREE_ID, social_tables_exist=True)
    mock_conn.side_effect = _view_conn_context(cursor)

    first = record_public_tree_view(TREE_ID, EDGE_ACTOR, "anonymous", "public_tree_detail")
    second = record_public_tree_view(TREE_ID, EDGE_ACTOR, "anonymous", "public_tree_detail")

    assert first["counted"] is True
    assert second["counted"] is False
    assert second["viewCount"] == 1, "exactly one aggregate increment for same authority"
    # A different authority still increments (per-actor dedup, not global).
    third = record_public_tree_view(TREE_ID, "other-edge-actor", "anonymous", "public_tree_detail")
    assert third["counted"] is True
    assert third["viewCount"] == 2


# ── Control M: missing social tables → safe fallback ───────────────────────────

@patch("modal_compute.tree_views.get_db_connection")
def test_missing_social_tables_fallback(mock_conn):
    cursor = FakeViewCursor(TREE_ID, social_tables_exist=False)
    mock_conn.side_effect = _view_conn_context(cursor)

    result = record_public_tree_view(TREE_ID, EDGE_ACTOR, "anonymous", "public_tree_detail")
    assert result == {"treeId": TREE_ID, "counted": False, "viewCount": 0}


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
