#!/usr/bin/env python3
"""Contract test: authenticated memory-detail GET endpoint is registered (#3288).

The Cloudflare proxy routes a signed-in GET /api/memories/:id to
/modal/private/memories/:id (mirroring /api/trees/:id). For that routing to
resolve private memories safely, the Modal app must expose a GET handler on
/modal/private/memories/{memory_id} and return the same frontend-compatible
memory shape used by public detail reads.
"""

import os
import re
import sys
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

APP_PY = os.path.join(REPO_ROOT, "modal_compute", "app.py")

with open(APP_PY, "r", encoding="utf-8") as _f:
    SOURCE = _f.read()


def _private_memory_detail_block() -> str:
    marker = '@web_app.get("/modal/private/memories/{memory_id}")'
    start = SOURCE.find(marker)
    assert start >= 0, "GET /modal/private/memories/{memory_id} decorator must be registered"
    next_route = SOURCE.find("\n\n@web_app.", start + len(marker))
    assert next_route > start, "private memory detail handler block must be bounded by the next route"
    return SOURCE[start:next_route]


def test_private_memory_detail_get_route_registered():
    assert re.search(
        r'@web_app\.get\(\s*"/modal/private/memories/\{memory_id\}"', SOURCE
    ), "GET /modal/private/memories/{memory_id} decorator must be registered"


def test_private_memory_detail_handler_is_get_private_memory_detail():
    # The decorator must be immediately followed by the handler def.
    m = re.search(
        r'@web_app\.get\(\s*"/modal/private/memories/\{memory_id\}"\)\s*\n'
        r'def\s+(get_private_memory_detail)\s*\(',
        SOURCE,
    )
    assert m, "GET /modal/private/memories/{memory_id} must be handled by get_private_memory_detail"
    assert m.group(1) == "get_private_memory_detail"


def test_private_memory_detail_uses_owner_guard():
    block = _private_memory_detail_block()
    assert "require_memory_owner" in block, "handler must use require_memory_owner for ownership"


def test_private_memory_detail_normalizes_owner_row_before_return():
    block = _private_memory_detail_block()
    assert "normalize_memory_row" in SOURCE, "app.py must import/use normalize_memory_row"
    assert "return normalize_memory_row(memory)" in block, "private detail must return frontend memory shape"
    assert "return memory" not in block, "private detail must not expose the raw owner-check DB row"


def test_normalized_memory_shape_is_frontend_compatible_and_does_not_expose_owner_check_fields():
    from modal_compute.validation import normalize_memory_row

    normalized = normalize_memory_row({
        "id": "mem-1",
        "tree_id": "tree-1",
        "parent_id": None,
        "title": "Private detail",
        "memo": "memo",
        "artist": "artist",
        "source": "source label",
        "source_url": "https://example.test/video",
        "source_type": "youtube",
        "thumbnail": "https://example.test/thumb.jpg",
        "emotion_tags": ["calm"],
        "timestamp": "2026-07",
        "visibility": "private",
        "channel_id": "channel-1",
        "channel_name": "Channel",
        "channel_url": "https://example.test/channel",
        "created_at": datetime(2026, 7, 8, 1, 2, 3),
        "updated_at": datetime(2026, 7, 8, 4, 5, 6),
        "tree_owner_id": "owner-1",
        "tree_visibility": "private",
    })

    for key in ("sourceUrl", "sourceType", "createdAt", "updatedAt"):
        assert key in normalized, f"normalized private detail must expose {key}"

    for internal_key in ("source_url", "source_type", "tree_owner_id", "tree_visibility"):
        assert internal_key not in normalized, f"normalized private detail must not expose {internal_key}"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-v"]))
