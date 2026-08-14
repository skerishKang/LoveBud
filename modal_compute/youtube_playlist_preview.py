"""LoveBud — Authenticated public YouTube playlist preview provider.

Owns (per docs/product/LOVETREE_PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY.md):

- provider call (YouTube Data API, fixed official endpoints only)
- verified-auth ordering (require_firebase_user must succeed before any
  provider call — enforced by the caller in app.py)
- provider error normalization into the bounded vocabulary

SSRF boundary:
- The user-supplied source is parsed as a string only (host/scheme/path
  validation + playlist ID extraction). It is NEVER fetched.
- Only the fixed `https://www.googleapis.com/youtube/v3/...` endpoints are
  contacted, with redirect following disabled.

First preview slice ceilings:
- playlists.list: at most 1 call
- playlistItems.list: at most 1 call
- provider request ceiling: 2
- page size: 50, item ceiling: 50, max pages: 1
- automatic retry: 0
- provider request timeout: 10 seconds
- videos.list: 0 calls (no embeddability / region inference)

Privacy: this module never logs the Firebase token, the provider key, user
identifiers, playlist titles, video titles, raw URLs, or raw provider bodies.
All failures surface as bounded PlaylistPreviewError values.

Refs: #3914, #3906, #3897, #3903, #1882.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

PLAYLISTS_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlists"
PLAYLIST_ITEMS_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlistItems"

PLAYLIST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{10,80}$")

PROVIDER_TIMEOUT_SECONDS = 10
PROVIDER_PAGE_SIZE = 50
PROVIDER_ITEM_CEILING = 50
PROVIDER_MAX_PAGES = 1
PROVIDER_MAX_CALLS = 2

PROVIDER_SECRET_NAME = "lovebud-youtube-data-api"
PROVIDER_KEY_ENV = "YOUTUBE_DATA_API_KEY"

MAX_SOURCE_LENGTH = 2048
MAX_ERROR_BODY_BYTES = 4096
MAX_ITEM_DESCRIPTION_LENGTH = 200

CANONICAL_ITEM_STATES = {
    "AVAILABLE_METADATA",
    "PRIVATE_OR_UNAVAILABLE",
    "METADATA_PARTIAL",
    "THUMBNAIL_UNAVAILABLE",
    "UNKNOWN",
}

CANONICAL_ERROR_CODES = {
    "INVALID_PLAYLIST_SOURCE",
    "UNSUPPORTED_PLAYLIST_SOURCE",
    "UNAUTHORIZED",
    "PLAYLIST_NOT_FOUND",
    "PLAYLIST_NOT_ACCESSIBLE",
    "PLAYLIST_UNSUPPORTED",
    "PROVIDER_QUOTA_EXCEEDED",
    "PROVIDER_TIMEOUT",
    "PROVIDER_UNAVAILABLE",
    "CONFIGURATION_REQUIRED",
    "INTERNAL_PREVIEW_ERROR",
}

PRIVATE_OR_UNAVAILABLE_TITLES = {"private video", "deleted video"}
PUBLIC_PRIVACY_STATUSES = {"public", "unlisted"}


class PlaylistPreviewError(Exception):
    """Bounded preview error with a canonical code."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def parse_playlist_source(source: Any) -> str:
    """Extract a validated playlist ID from a user-supplied URL or bare ID.

    Pure string parsing only — no network fetch of the supplied value.
    """
    if not isinstance(source, str):
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist source must be a string."
        )

    value = source.strip()
    if not value:
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist source is required."
        )

    if len(value) > MAX_SOURCE_LENGTH:
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist source is too long."
        )

    has_scheme = bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", value))
    if "://" in value or has_scheme or value.startswith("/") or value.startswith("www."):
        return _extract_playlist_id_from_url(value)

    return _validate_bare_playlist_id(value)


def _validate_bare_playlist_id(value: str) -> str:
    if not PLAYLIST_ID_PATTERN.match(value):
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist ID shape is invalid."
        )
    return value


def _extract_playlist_id_from_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlparse(value)
    except ValueError as error:
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist URL is malformed."
        ) from error

    if parsed.scheme != "https":
        raise PlaylistPreviewError(
            "UNSUPPORTED_PLAYLIST_SOURCE", "Only HTTPS playlist URLs are supported."
        )

    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[len("www."):]
    if host.startswith("m."):
        host = host[len("m."):]

    if host != "youtube.com":
        raise PlaylistPreviewError(
            "UNSUPPORTED_PLAYLIST_SOURCE", "Only youtube.com playlist URLs are supported."
        )

    if parsed.path.rstrip("/") != "/playlist":
        raise PlaylistPreviewError(
            "UNSUPPORTED_PLAYLIST_SOURCE", "Only /playlist URLs are supported."
        )

    query = urllib.parse.parse_qs(parsed.query)
    list_values = query.get("list")
    if not list_values or not list_values[0]:
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE", "Playlist URL is missing the list parameter."
        )

    return _validate_bare_playlist_id(list_values[0])


def resolve_provider_api_key() -> str:
    """Return the Modal-side YouTube Data API key or fail closed bounded.

    The key is read from the Modal secret environment only. It is never
    logged and never returned to any caller outside Modal.
    """
    key = os.getenv(PROVIDER_KEY_ENV, "").strip()
    if not key:
        raise PlaylistPreviewError(
            "CONFIGURATION_REQUIRED",
            "Preview provider is not configured.",
            status_code=503,
        )
    return key


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Forbid redirect following for the fixed provider endpoints."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR", "Provider redirect rejected.", status_code=500
        )


def _build_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(_NoRedirectHandler())


def _safe_read_error(error: urllib.error.HTTPError) -> str:
    try:
        return error.read(MAX_ERROR_BODY_BYTES).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _provider_get_json(url: str) -> dict[str, Any]:
    """Call a fixed official YouTube Data API endpoint once, no retry.

    Normalizes every provider failure into the bounded vocabulary. Raw
    provider bodies, keys, and network internals never escape.
    """
    opener = _build_opener()
    try:
        with opener.open(url, timeout=PROVIDER_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw)
    except PlaylistPreviewError:
        raise
    except urllib.error.HTTPError as error:
        code = error.code
        body = _safe_read_error(error)
        if code == 400:
            if "playlistOperationUnsupported" in body:
                raise PlaylistPreviewError(
                    "PLAYLIST_UNSUPPORTED",
                    "Playlist type is not supported.",
                    status_code=400,
                ) from error
            raise PlaylistPreviewError(
                "INVALID_PLAYLIST_SOURCE",
                "Playlist identity was rejected by the provider.",
                status_code=400,
            ) from error
        if code == 403:
            lowered_body = body.lower()
            if "quota" in lowered_body:
                raise PlaylistPreviewError(
                    "PROVIDER_QUOTA_EXCEEDED",
                    "Provider quota exceeded.",
                    status_code=429,
                ) from error
            if (
                "playlistitemsnotaccessible" in lowered_body
                or "playlistforbidden" in lowered_body
                or "watchhistorynotaccessible" in lowered_body
                or "watchlaternotaccessible" in lowered_body
            ):
                raise PlaylistPreviewError(
                    "PLAYLIST_NOT_ACCESSIBLE",
                    "Playlist is not accessible.",
                    status_code=403,
                ) from error
            raise PlaylistPreviewError(
                "PLAYLIST_NOT_ACCESSIBLE",
                "Playlist is not accessible.",
                status_code=403,
            ) from error
        if code == 404:
            raise PlaylistPreviewError(
                "PLAYLIST_NOT_FOUND", "Playlist not found.", status_code=404
            ) from error
        if code == 429:
            raise PlaylistPreviewError(
                "PROVIDER_QUOTA_EXCEEDED",
                "Provider quota exceeded.",
                status_code=429,
            ) from error
        if code >= 500:
            raise PlaylistPreviewError(
                "PROVIDER_UNAVAILABLE",
                "Provider is temporarily unavailable.",
                status_code=503,
            ) from error
        raise PlaylistPreviewError(
            "PROVIDER_UNAVAILABLE", "Provider returned an error.", status_code=503
        ) from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        reason = getattr(error, "reason", None)
        if isinstance(error, TimeoutError) or isinstance(reason, TimeoutError):
            raise PlaylistPreviewError(
                "PROVIDER_TIMEOUT", "Provider request timed out.", status_code=504
            ) from error
        raise PlaylistPreviewError(
            "PROVIDER_UNAVAILABLE",
            "Provider is temporarily unavailable.",
            status_code=503,
        ) from error
    except (ValueError, json.JSONDecodeError) as error:
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed response.",
            status_code=500,
        ) from error

    if not isinstance(payload, dict):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed response.",
            status_code=500,
        )
    return payload


def fetch_playlist_metadata(playlist_id: str, api_key: str) -> dict[str, Any]:
    """Fetch playlist metadata via playlists.list (at most 1 call)."""
    query = urllib.parse.urlencode(
        {
            "part": "snippet,contentDetails",
            "id": playlist_id,
            "key": api_key,
        }
    )
    url = f"{PLAYLISTS_ENDPOINT}?{query}"
    payload = _provider_get_json(url)

    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise PlaylistPreviewError(
            "PLAYLIST_NOT_FOUND", "Playlist not found.", status_code=404
        )

    first = items[0]
    if not isinstance(first, dict):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed playlist.",
            status_code=500,
        )

    snippet = first.get("snippet")
    content_details = first.get("contentDetails")
    if not isinstance(snippet, dict) or not isinstance(content_details, dict):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed playlist.",
            status_code=500,
        )

    try:
        item_count = int(content_details.get("itemCount") or 0)
    except (TypeError, ValueError):
        item_count = 0

    return {
        "id": playlist_id,
        "title": str(snippet.get("title") or ""),
        "channelTitle": str(snippet.get("channelTitle") or ""),
        "itemCount": item_count,
    }


def fetch_playlist_items(
    playlist_id: str, api_key: str, max_results: int = PROVIDER_PAGE_SIZE
) -> dict[str, Any]:
    """Fetch ordered playlist items via playlistItems.list (at most 1 call).

    Single page only: no page-2 pagination and no automatic retry.
    """
    bounded_max = max(1, min(int(max_results), PROVIDER_PAGE_SIZE))
    query = urllib.parse.urlencode(
        {
            "part": "snippet,contentDetails,status",
            "playlistId": playlist_id,
            "maxResults": bounded_max,
            "key": api_key,
        }
    )
    url = f"{PLAYLIST_ITEMS_ENDPOINT}?{query}"
    payload = _provider_get_json(url)

    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed item list.",
            status_code=500,
        )

    page_info = payload.get("pageInfo")
    page_info_dict = page_info if isinstance(page_info, dict) else {}
    total_raw = page_info_dict.get("totalResults")
    try:
        total_results = int(total_raw or len(raw_items))
    except (TypeError, ValueError):
        total_results = len(raw_items)

    items = [_normalize_playlist_item(item) for item in raw_items]
    items = items[:PROVIDER_ITEM_CEILING]

    return {
        "items": items,
        "totalResults": total_results,
        "nextPageToken": payload.get("nextPageToken") or None,
    }


def _normalize_playlist_item(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed item.",
            status_code=500,
        )

    snippet = item.get("snippet")
    content_details = item.get("contentDetails")
    status = item.get("status")
    if (
        not isinstance(snippet, dict)
        or not isinstance(content_details, dict)
        or (status is not None and not isinstance(status, dict))
    ):
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Provider returned a malformed item.",
            status_code=500,
        )

    video_id = str(content_details.get("videoId") or "")
    title = str(snippet.get("title") or "")
    description = str(snippet.get("description") or "")
    channel_title = str(snippet.get("channelTitle") or "")

    position_raw = snippet.get("position")
    try:
        position = int(position_raw if position_raw is not None else 0)
    except (TypeError, ValueError):
        position = 0

    privacy_status = str((status or {}).get("privacyStatus") or "").lower()
    thumbnails = snippet.get("thumbnails")
    thumbnail_url = _pick_thumbnail(thumbnails)
    state = _derive_item_state(title, privacy_status, video_id, thumbnail_url is not None)

    return {
        "position": position,
        "videoId": video_id,
        "title": title,
        "description": description[:MAX_ITEM_DESCRIPTION_LENGTH] if description else "",
        "channelTitle": channel_title,
        "thumbnailUrl": thumbnail_url,
        "state": state,
        "sourceUrl": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
    }


def _derive_item_state(
    title: str, privacy_status: str, video_id: str, has_thumbnail: bool
) -> str:
    """Derive the canonical item state from what playlistItems.list proves.

    - PRIVATE_OR_UNAVAILABLE: title signals Private/Deleted video, or the item
      privacy status is `private`.
    - METADATA_PARTIAL: no video ID, or public/unlisted item whose thumbnail
      metadata is missing from the provider response.
    - UNKNOWN: unexpected/missing privacy status cannot be classified safely.
    - AVAILABLE_METADATA: public/unlisted item with a video ID and thumbnail.

    No embeddability or region inference is ever made from privacyStatus.
    """
    lowered_title = (title or "").strip().lower()
    if lowered_title in PRIVATE_OR_UNAVAILABLE_TITLES:
        return "PRIVATE_OR_UNAVAILABLE"
    if privacy_status == "private":
        return "PRIVATE_OR_UNAVAILABLE"
    if not video_id:
        return "METADATA_PARTIAL"
    if privacy_status not in PUBLIC_PRIVACY_STATUSES:
        return "UNKNOWN"
    if not has_thumbnail:
        return "METADATA_PARTIAL"
    return "AVAILABLE_METADATA"


def _pick_thumbnail(thumbnails: Any) -> str | None:
    """Prefer medium, fall back to default. Return None when absent.

    A deterministic single-host policy: the provider URL is used as-is, and a
    missing thumbnail is a null thumbnail — never a fabricated alternate host.
    """
    if not isinstance(thumbnails, dict):
        return None
    for key in ("medium", "default"):
        candidate = thumbnails.get(key)
        if isinstance(candidate, dict):
            url = candidate.get("url")
            if url:
                return str(url)
    return None


def normalize_playlist_preview(
    metadata: dict[str, Any], items_result: dict[str, Any]
) -> dict[str, Any]:
    """Build the bounded ordered preview response (no writes)."""
    items = items_result.get("items")
    if not isinstance(items, list):
        items = []

    total_raw = items_result.get("totalResults")
    try:
        total_results = int(total_raw or 0)
    except (TypeError, ValueError):
        total_results = len(items)

    truncated = total_results > PROVIDER_ITEM_CEILING or bool(
        items_result.get("nextPageToken")
    )

    return {
        "ok": True,
        "playlist": {
            "id": metadata.get("id") or "",
            "title": metadata.get("title") or "",
            "channelTitle": metadata.get("channelTitle") or "",
            "itemCount": int(metadata.get("itemCount") or 0),
            "truncated": truncated,
        },
        "items": items,
        "truncated": truncated,
        "totalItems": total_results,
        "previewedItems": len(items),
    }
