from __future__ import annotations

import pytest
from fastapi import HTTPException

from modal_compute.validation import normalize_memory_row, validate_client_key


def test_validate_client_key_omitted_returns_none():
    assert validate_client_key(None) is None
    assert validate_client_key("") is None
    assert validate_client_key("   ") is None


def test_validate_client_key_valid_normalized():
    assert validate_client_key("  abc-123  ") == "abc-123"
    assert validate_client_key("short") == "short"


def test_validate_client_key_non_string_rejected_before_db():
    for bad in [123, 1.5, True, ["k"], {"k": "v"}, None]:
        if bad is None:
            continue
        with pytest.raises(HTTPException) as exc:
            validate_client_key(bad)
        assert exc.value.status_code == 400
        assert exc.value.detail.get("code") == "CLIENT_KEY_INVALID_TYPE"


def test_validate_client_key_oversized_rejected_before_db():
    long = "x" * 101
    with pytest.raises(HTTPException) as exc:
        validate_client_key(long)
    assert exc.value.status_code == 400
    assert exc.value.detail.get("code") == "CLIENT_KEY_TOO_LONG"
    # Boundary: exactly 100 chars is accepted.
    assert validate_client_key("y" * 100) == "y" * 100


def test_normalize_memory_row_exposes_client_key_when_present():
    row = {
        "id": "m1",
        "tree_id": "t1",
        "parent_id": None,
        "title": "t",
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
        "client_key": "ck-abc",
        "created_at": None,
        "updated_at": None,
    }
    out = normalize_memory_row(row)
    assert out["clientKey"] == "ck-abc"


def test_normalize_memory_row_omits_client_key_when_absent():
    # Legacy / pre-migration rows never get a fabricated clientKey.
    row = {
        "id": "m2",
        "tree_id": "t2",
        "parent_id": None,
        "title": "",
        "memo": "",
        "artist": "",
        "source": "",
        "source_url": "",
        "source_type": "youtube",
        "thumbnail": "",
        "emotion_tags": [],
        "timestamp": "",
        "visibility": "private",
        "channel_id": None,
        "channel_name": None,
        "channel_url": None,
        # no client_key key at all (column not present)
        "created_at": None,
        "updated_at": None,
    }
    out = normalize_memory_row(row)
    assert "clientKey" not in out


def test_normalize_memory_row_omits_client_key_when_null():
    row = {
        "id": "m3",
        "tree_id": "t3",
        "parent_id": None,
        "title": "",
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
        "client_key": None,
        "created_at": None,
        "updated_at": None,
    }
    out = normalize_memory_row(row)
    assert "clientKey" not in out
