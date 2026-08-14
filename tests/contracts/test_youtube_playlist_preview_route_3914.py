"""Executable auth negative controls for the YouTube playlist preview route.

Drives the Modal preview endpoint (modal_compute/app.py
`post_youtube_playlist_preview`) through the real FastAPI TestClient with the
auth and provider seams patched — the same canonical pattern used by
tests/contracts/test_fork_tree.py. No real Firebase and no real YouTube
network call is ever made.

Executable controls (per Issue #3914 correction pass):

- A. require_firebase_user -> HTTPException(401)
     assert bounded 401 Scout envelope, provider key resolution 0,
     provider metadata call 0, provider items call 0.
- B. require_firebase_user -> HTTPException(503) (trusted cert dependency
     outage per #3972)
     assert bounded 503 envelope with a safe message, raw auth detail absent,
     provider calls 0.
- C. require_firebase_user -> verified uid
     provider seams proceed normally and a bounded preview is produced.
- Real missing-Authorization control: the real require_firebase_user
   short-circuits on a missing header before any cert fetch, so the 401 path
   is executed without any network access.

Refs #3914, #3897, #3906, #1882.
"""

from __future__ import annotations

import json
from contextlib import ExitStack
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from modal_compute.app import web_app

client = TestClient(web_app)

PLAYLIST_ID = "PLAbCdEfGhIjKlMnOp"
VALID_PAYLOAD = {"playlistId": PLAYLIST_ID}

MOCK_METADATA = {
    "id": PLAYLIST_ID,
    "title": "Mock Playlist",
    "channelTitle": "Mock Channel",
    "itemCount": 1,
}
MOCK_ITEMS = {
    "items": [
        {
            "position": 0,
            "videoId": "v00000000001",
            "title": "First",
            "description": "",
            "channelTitle": "Mock Channel",
            "thumbnailUrl": None,
            "state": "AVAILABLE_METADATA",
            "sourceUrl": "https://www.youtube.com/watch?v=v00000000001",
        }
    ],
    "totalResults": 1,
    "nextPageToken": None,
}

PROVIDER_PATCH_TARGETS = (
    "modal_compute.app.resolve_provider_api_key",
    "modal_compute.app.fetch_playlist_metadata",
    "modal_compute.app.fetch_playlist_items",
)


def _post(payload=VALID_PAYLOAD, authorization="Bearer mock-id-token"):
    headers = {}
    if authorization is not None:
        headers["authorization"] = authorization
    return client.post(
        "/modal/private/import/youtube/playlist/preview",
        json=payload,
        headers=headers,
    )


def _provider_seams():
    """Patch all provider seams and return their mocks for call-count checks."""
    stack = ExitStack()
    mocks = []
    for target in PROVIDER_PATCH_TARGETS:
        mocks.append(stack.enter_context(patch(target)))
    return stack, mocks


def _assert_zero_provider_calls(mocks):
    for mock in mocks:
        assert mock.call_count == 0, f"{mock} must not be called before auth"


def test_auth_401_normalizes_to_bounded_envelope_before_any_provider_call():
    stack, mocks = _provider_seams()
    with stack:
        with patch(
            "modal_compute.app.require_firebase_user",
            side_effect=HTTPException(status_code=401, detail="Authentication required"),
        ):
            response = _post()

        assert response.status_code == 401
        body = response.json()
        assert body == {
            "ok": False,
            "error": {"code": "UNAUTHORIZED", "message": "Authentication is required."},
        }
        _assert_zero_provider_calls(mocks)


def test_auth_503_dependency_outage_preserved_before_any_provider_call():
    # #3972 taxonomy: trusted Firebase cert dependency outage -> HTTP 503.
    # The route must preserve 503 with a safe message and never leak the raw
    # auth detail (network/cert internals).
    stack, mocks = _provider_seams()
    with stack:
        with patch(
            "modal_compute.app.require_firebase_user",
            side_effect=HTTPException(
                status_code=503,
                detail="cert fetch failed: [Errno 111] Connection refused",
            ),
        ):
            response = _post()

        assert response.status_code == 503
        body = response.json()
        assert body["ok"] is False
        assert body["error"]["code"] == "UNAUTHORIZED"
        assert body["error"]["message"] == "Authentication service is temporarily unavailable."
        raw = json.dumps(body)
        assert "Connection refused" not in raw
        assert "cert fetch" not in raw
        assert "errno" not in raw.lower()
        _assert_zero_provider_calls(mocks)


def test_auth_401_not_collapsed_from_any_non_5xx_http_error():
    stack, mocks = _provider_seams()
    with stack:
        with patch(
            "modal_compute.app.require_firebase_user",
            side_effect=HTTPException(status_code=401, detail="Invalid ID token"),
        ):
            response = _post()

        assert response.status_code == 401
        body = response.json()
        assert body["error"]["code"] == "UNAUTHORIZED"
        assert "Invalid ID token" not in json.dumps(body)
        _assert_zero_provider_calls(mocks)


def test_verified_auth_proceeds_to_provider_seams():
    stack, mocks = _provider_seams()
    resolve_key, fetch_meta, fetch_items = mocks
    with stack:
        with patch(
            "modal_compute.app.require_firebase_user",
            return_value={"uid": "test-uid-3914", "email": "mock@example.test"},
        ):
            resolve_key.return_value = "test-provider-key"
            fetch_meta.return_value = MOCK_METADATA
            fetch_items.return_value = MOCK_ITEMS

            response = _post()

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["playlist"]["id"] == PLAYLIST_ID
        assert body["previewedItems"] == 1
        assert resolve_key.call_count == 1
        assert fetch_meta.call_count == 1
        assert fetch_items.call_count == 1
        fetch_args = fetch_meta.call_args.args
        assert fetch_args[0] == PLAYLIST_ID
        assert fetch_args[1] == "test-provider-key"


def test_missing_authorization_header_rejects_without_network():
    # The REAL require_firebase_user short-circuits on a missing header before
    # any cert fetch, so this executes the real 401 path with no network.
    stack, mocks = _provider_seams()
    with stack:
        response = _post(authorization=None)

        assert response.status_code == 401
        body = response.json()
        assert body == {
            "ok": False,
            "error": {"code": "UNAUTHORIZED", "message": "Authentication is required."},
        }
        _assert_zero_provider_calls(mocks)
