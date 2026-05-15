"""API response helpers for Modal compute layer.

Extracted response utilities to keep app.py thin and focused on route orchestration.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException, Request

MAX_JSON_BODY_BYTES = 128 * 1024


def add_request_id_to_response(response: Any, request_id: str | None = None) -> Any:
    """Add request ID to response headers if available."""
    if request_id and hasattr(response, 'headers'):
        response.headers["x-lovebud-request-id"] = request_id
    return response


def _get_content_length(request: Request) -> int | None:
    raw_length = request.headers.get("content-length")
    if raw_length is None:
        return None
    try:
        content_length = int(raw_length)
    except (TypeError, ValueError):
        return None
    return content_length if content_length >= 0 else None


def _raise_if_content_length_too_large(request: Request) -> None:
    content_length = _get_content_length(request)
    if content_length is not None and content_length > MAX_JSON_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large")


async def _read_bounded_body(request: Request) -> bytes:
    _raise_if_content_length_too_large(request)

    chunks: list[bytes] = []
    total_size = 0

    async for chunk in request.stream():
        if not chunk:
            continue
        total_size += len(chunk)
        if total_size > MAX_JSON_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Request body too large")
        chunks.append(chunk)

    return b"".join(chunks)


async def parse_json_body(request: Request) -> dict:
    """Parse and validate JSON body from request.

    Raises:
        HTTPException: 400 if JSON is invalid, 413 if the body is too large.

    Returns:
        dict: Parsed JSON payload (empty dict if body is null/empty).
    """
    body = await _read_bounded_body(request)
    if not body:
        return {}

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error

    return payload if isinstance(payload, dict) else {}
