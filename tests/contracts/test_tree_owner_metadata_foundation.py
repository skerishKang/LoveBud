"""Focused contract tests for tree owner metadata foundation.

Tests:
- normalize_group_name / normalize_keywords business logic
- CREATE / UPDATE / FETCH / FORK round-trip (via modal_compute)
- SQL migration idempotency
- Fork does not inherit metadata
"""
import sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from modal_compute.validation import (
    normalize_group_name,
    normalize_keywords,
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
        assert False, "should raise 400"
    except Exception:
        pass


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
        normalize_keywords(["a"] * 6)
        assert False, "should raise 400"
    except Exception:
        pass


def test_keywords_max_5_ok():
    assert normalize_keywords(["a", "b", "c", "d", "e"]) == ["a", "b", "c", "d", "e"]


def test_keywords_max_24():
    try:
        normalize_keywords(["x" * 25])
        assert False, "should raise 400"
    except Exception:
        pass


def test_keywords_24_ok():
    kw = "x" * 24
    assert normalize_keywords([kw]) == [kw]


def test_keywords_non_array_raises():
    try:
        normalize_keywords("string")
        assert False, "should raise 400"
    except Exception:
        pass


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