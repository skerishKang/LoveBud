#!/usr/bin/env python3
"""Contract test: authenticated memory-detail GET endpoint is registered (#3288).

The Cloudflare proxy now routes a signed-in GET /api/memories/:id to
/modal/private/memories/:id (mirroring /api/trees/:id). For that routing to
resolve private memories, the Modal app must expose a GET handler on
/modal/private/memories/{memory_id}. This test proves the decorator and handler
are present and aligned, without invoking the DB or auth backend.
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

APP_PY = os.path.join(REPO_ROOT, "modal_compute", "app.py")

with open(APP_PY, "r", encoding="utf-8") as _f:
    SOURCE = _f.read()


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


def test_private_memory_detail_imports_require_memory_owner():
    assert "require_memory_owner" in SOURCE, "handler must use require_memory_owner for ownership"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-v"]))
