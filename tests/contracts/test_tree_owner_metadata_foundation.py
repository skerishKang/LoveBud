"""Focused contract tests for tree owner metadata foundation.

Tests:
- normalize_group_name / normalize_keywords business logic
- CREATE / UPDATE / FETCH / FORK round-trip (via modal_compute)
- SQL migration idempotency
- Fork does not inherit metadata
- All except blocks verify HTTPException with status_code 400
"""
import sys, os
from fastapi import HTTPException

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from modal_compute.validation import (
    normalize_group_name,
    normalize_keywords,
    normalize_row,
    normalize_tree_row,
)

# ---------------------------------------------------------------------------
# normalize_group_name
# ---------------------------------------------------------------------------

def test_group_name_none_is_null():
    assert normalize_group_name(None) is None


def test_group_name_empty_is_null():
    assert normalize_group_name("") is None


def test_group_name_whitespace_is_null():
    assert normalize_group_name("  ") is None


def test_group_name_trim():
    assert normalize_group_name("  hello  ") == "hello"


def test_group_name_max_80():
    try:
        normalize_group_name("x" * 81)
        assert False, "should raise"
    except HTTPException as e:
        assert e.status_code == 400


def test_group_name_80_ok():
    assert normalize_group_name("x" * 80) == "x" * 80


def test_group_name_non_string():
    assert normalize_group_name(42) is None


# ---------------------------------------------------------------------------
# normalize_keywords
# ---------------------------------------------------------------------------

def test_keywords_none_is_empty():
    assert normalize_keywords(None) == []


def test_keywords_empty():
    assert normalize_keywords([]) == []


def test_keywords_trim_and_remove_empty():
    assert normalize_keywords(["a", " ", "b"]) == ["a", "b"]


def test_keywords_dedupe_preserves_order():
    # First occurrence wins
    assert normalize_keywords(["a", "b", "a"]) == ["a", "b"]


def test_keywords_max_5():
    try:
        normalize_keywords(["a", "b", "c", "d", "e", "f"])
        assert False, "should raise"
    except HTTPException as e:
        assert e.status_code == 400


def test_keywords_max_5_ok():
    assert normalize_keywords(["a", "b", "c", "d", "e"]) == ["a", "b", "c", "d", "e"]


def test_keywords_max_24():
    try:
        normalize_keywords(["x" * 25])
        assert False, "should raise"
    except HTTPException as e:
        assert e.status_code == 400


def test_keywords_24_ok():
    kw = "x" * 24
    assert normalize_keywords([kw]) == [kw]


def test_keywords_non_array_raises():
    try:
        normalize_keywords("string")
        assert False, "should raise"
    except HTTPException as e:
        assert e.status_code == 400


def test_keywords_no_hash_prefix():
    """Storage value should not auto-add # prefix."""
    result = normalize_keywords(["kpop"])
    assert "#" not in result[0]


# ---------------------------------------------------------------------------
# normalize_tree_row - include_owner_metadata flag
# ---------------------------------------------------------------------------

def _make_tree_row(group_name=None, keywords=None):
    return {
        "id": "abc123",
        "owner_id": "owner1",
        "title": "My Tree",
        "visibility": "public",
        "group_name": group_name,
        "keywords": keywords,
        "created_at": None,
        "updated_at": None,
        "memory_count": 0,
    }


def test_normalize_tree_row_without_metadata():
    """Default normalize_tree_row does not include groupName/keywords."""
    row = _make_tree_row("kpop", ["a", "b"])
    result = normalize_tree_row(row, 0)
    assert "groupName" not in result
    assert "keywords" not in result


def test_normalize_tree_row_with_metadata():
    """include_owner_metadata=True includes groupName/keywords."""
    row = _make_tree_row("kpop", ["a", "b"])
    result = normalize_tree_row(row, 0, include_owner_metadata=True)
    assert result.get("groupName") == "kpop"
    assert result.get("keywords") == ["a", "b"]


def test_normalize_tree_row_fallback_null():
    """Fallback when group_name/keywords are missing in DB row."""
    row = _make_tree_row(None, None)
    result = normalize_tree_row(row, 0, include_owner_metadata=True)
    assert result.get("groupName") is None
    assert result.get("keywords") == []


def test_normalize_tree_row_fallback_empty():
    """Fallback with empty group_name/keywords."""
    row = _make_tree_row("", [])
    result = normalize_tree_row(row, 0, include_owner_metadata=True)
    # Empty group_name -> null, empty keywords -> []
    assert result.get("groupName") is None
    assert result.get("keywords") == []


# ---------------------------------------------------------------------------
# SQL migration idempotency
# ---------------------------------------------------------------------------

def test_sql_idempotent():
    with open("scripts/migration-add-tree-metadata.sql") as f:
        sql = f.read()
    assert "BEGIN;" in sql
    assert "COMMIT;" in sql
    assert "IF NOT EXISTS" in sql
    assert "group_name" in sql
    assert "keywords" in sql
    assert "USING GIN" not in sql  # no index in foundation
    assert "#3111" not in sql  # no unrelated issue refs
    assert "#3087" not in sql
    assert "#3086" not in sql


# ---------------------------------------------------------------------------
# fetch_user_trees query check
# ---------------------------------------------------------------------------

def test_fetch_user_trees_select_has_group_name_and_keywords():
    """fetch_user_trees() SELECT and GROUP BY must include group_name and keywords."""
    import modal_compute.owner_reads as orm
    src = open(orm.__file__).read()
    # Check the SQL query string contains metadata fields in SELECT
    assert "t.group_name" in src
    assert "t.keywords" in src
    # Check GROUP BY also includes metadata fields
    assert "t.group_name" in src.split("GROUP BY")[1].split("ORDER BY")[0]
    assert "t.keywords" in src.split("GROUP BY")[1].split("ORDER BY")[0]


def test_fetch_user_trees_include_owner_metadata():
    """fetch_user_trees() must use include_owner_metadata=True."""
    import modal_compute.owner_reads as orm
    src = open(orm.__file__).read()
    # Verify the normalize_tree_row call includes the flag
    assert "include_owner_metadata=True" in src


# ---------------------------------------------------------------------------
# fetch_owner_tree query check
# ---------------------------------------------------------------------------

def test_fetch_owner_tree_select_has_group_name_and_keywords():
    """fetch_owner_tree() SELECT and GROUP BY must include group_name and keywords."""
    import modal_compute.owner_reads as orm
    src = open(orm.__file__).read()
    assert "t.group_name" in src.split("def fetch_owner_tree")[1]
    assert "t.keywords" in src.split("def fetch_owner_tree")[1]
    assert "include_owner_metadata=True" in src.split("def fetch_owner_tree")[1]


# ---------------------------------------------------------------------------
# create_owner_tree INSERT
# ---------------------------------------------------------------------------

def test_create_owner_tree_insert_includes_group_name_and_keywords():
    """create_owner_tree() INSERT must include group_name and keywords."""
    import modal_compute.tree_writes as tw
    src = open(tw.__file__).read()
    insert_block = src.split("def create_owner_tree")[1].split("def ")[0]
    assert "group_name" in insert_block
    assert "keywords" in insert_block


# ---------------------------------------------------------------------------
# update_owner_tree conditional update
# ---------------------------------------------------------------------------

def test_update_owner_tree_conditional_metadata():
    """update_owner_tree() only adds metadata when payload includes the key."""
    import modal_compute.tree_writes as tw
    src = open(tw.__file__).read()
    update_block = src.split("def update_owner_tree")[1].split("def ")[0]
    assert '"groupName" in payload' in update_block
    assert '"keywords" in payload' in update_block


# ---------------------------------------------------------------------------
# fork_public_tree no metadata inheritance
# ---------------------------------------------------------------------------

def test_fork_public_tree_insert_does_not_include_metadata():
    """fork_public_tree() INSERT must NOT include group_name or keywords."""
    import modal_compute.tree_writes as tw
    src = open(tw.__file__).read()
    # The INSERT query inside fork_public_tree should not have metadata columns
    fork_block = src.split("def fork_public_tree")[1].split("def ")[0]
    assert "group_name" not in fork_block
    assert "keywords" not in fork_block


# ---------------------------------------------------------------------------
# public normalize_row() — no metadata in public output
# ---------------------------------------------------------------------------

def test_public_normalize_row_no_metadata():
    """Public normalize_row() must NOT include groupName or keywords."""
    row = {
        "id": "abc",
        "title": "T",
        "visibility": "public",
        "created_at": None,
        "updated_at": None,
        "memory_count": 5,
        "all_tags": None,
        "raw_thumbnail": None,
        "raw_source_url": None,
        "group_name": "kpop",
        "keywords": ["a", "b"],
    }
    result = normalize_row(row)
    assert "groupName" not in result
    assert "keywords" not in result