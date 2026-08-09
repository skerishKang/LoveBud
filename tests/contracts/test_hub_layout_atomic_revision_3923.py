from __future__ import annotations

import ast
import hashlib
from pathlib import Path

SOURCE = Path(__file__).parents[2] / "modal_compute" / "hub_layouts.py"
text = SOURCE.read_text(encoding="utf-8")
tree = ast.parse(text)


def get_function(name: str) -> ast.FunctionDef:
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise AssertionError(f"missing function: {name}")


save = get_function("save_hub_layout")
source_segment = ast.get_source_segment(text, save) or ""

# Regression: the write path must not call the split-connection helper anymore.
assert "_fetch_latest_revision(" not in source_segment

# The advisory lock must be acquired before latest-revision authority and INSERT.
lock_pos = source_segment.index("pg_advisory_xact_lock")
latest_pos = source_segment.index("SELECT revision")
insert_pos = source_segment.index("INSERT INTO tree_hub_layouts")
commit_pos = source_segment.index("conn.commit()")
assert lock_pos < latest_pos < insert_pos < commit_pos

# Stale writers must remain a bounded 409 path and rollback on any exception.
assert "status_code=409" in source_segment
assert "conn.rollback()" in source_segment

# Negative control: domain-separated stable lock keys differ by Tree and fit bigint.
def key(tree_id: str) -> int:
    digest = hashlib.sha256(f"hub-layout:{tree_id}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)

left = key("tree-a")
right = key("tree-b")
assert left != right
assert -(2**63) <= left < 2**63
assert -(2**63) <= right < 2**63

print("hub layout atomic revision #3923: PASS")
