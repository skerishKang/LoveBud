"""Focused behavioral tests for modal_compute/validation.normalize_row.

Tests the viewCount and likeCount output of normalize_row directly,
covering positive counts, missing/null fallbacks, and the include_like_count=False path.
"""
import sys
import os

# Add the repo root to sys.path so modal_compute can be imported
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from modal_compute.validation import normalize_row


def test_normalize_row_includes_view_count():
    """Positive view_count and like_count are surfaced as viewCount and likeCount."""
    row = {"view_count": 3, "like_count": 2, "id": "abc", "title": "T",
           "visibility": "public", "created_at": None, "updated_at": None,
           "memory_count": 5, "all_tags": None, "raw_thumbnail": None,
           "raw_source_url": None}
    result = normalize_row(row, include_like_count=True)
    assert result["viewCount"] == 3, f"Expected viewCount=3, got {result['viewCount']}"
    assert result["likeCount"] == 2, f"Expected likeCount=2, got {result['likeCount']}"


def test_normalize_row_missing_view_count():
    """Missing or null view_count/ like_count fall back to 0 when include_like_count=True."""
    row = {"id": "abc", "title": "T", "visibility": "public",
           "created_at": None, "updated_at": None, "memory_count": 5,
           "all_tags": None, "raw_thumbnail": None, "raw_source_url": None}
    # No view_count or like_count keys at all
    result = normalize_row(row, include_like_count=True)
    assert result["viewCount"] == 0
    assert result["likeCount"] == 0

    # Explicit None values
    row["view_count"] = None
    row["like_count"] = None
    result = normalize_row(row, include_like_count=True)
    assert result["viewCount"] == 0
    assert result["likeCount"] == 0


def test_normalize_row_no_include_like_count():
    """When include_like_count=False, neither viewCount nor likeCount appear."""
    row = {"view_count": 3, "like_count": 2, "id": "abc", "title": "T",
           "visibility": "public", "created_at": None, "updated_at": None,
           "memory_count": 5, "all_tags": None, "raw_thumbnail": None,
           "raw_source_url": None}
    result = normalize_row(row, include_like_count=False)
    assert "viewCount" not in result, f"Unexpected viewCount: {result.get('viewCount')}"
    assert "likeCount" not in result, f"Unexpected likeCount: {result.get('likeCount')}"


def test_normalize_row_preserves_existing_fields():
    """The existing public summary fields are unchanged."""
    row = {"id": "abc", "title": "My Tree", "visibility": "public",
           "created_at": None, "updated_at": None, "memory_count": 5,
           "all_tags": None, "raw_thumbnail": None, "raw_source_url": None}
    result = normalize_row(row, include_like_count=False)
    assert result["id"] == "abc"
    assert result["title"] == "My Tree"
    assert result["visibility"] == "public"
    assert result["memoryCount"] == 5


def test_normalize_row_public_visibility_filter():
    """The normalize_row function does not change visibility; the SQL WHERE clause enforces the filter."""
    row = {"id": "abc", "title": "T", "visibility": "public",
           "created_at": None, "updated_at": None, "memory_count": 5,
           "all_tags": None, "raw_thumbnail": None, "raw_source_url": None}
    result = normalize_row(row, include_like_count=True)
    assert result["visibility"] == "public"
