"""API response helpers for Modal compute layer.

Extracted response utilities to keep app.py thin and focused on route orchestration.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException, Request


def add_request_id_to_response(response: Any, request_id: str | None = None) -> Any:
    """Add request ID to response headers if available."""
    if request_id and hasattr(response, 'headers'):
        response.headers["x-lovebud-request-id"] = request_id
    return response


async def parse_json_body(request: Request) -> dict:
    """Parse and validate JSON body from request.

    Raises:
        HTTPException: 400 if JSON is invalid.

    Returns:
        dict: Parsed JSON payload (empty dict if body is null/empty).
    """
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from error

    return payload if isinstance(payload, dict) else {}
