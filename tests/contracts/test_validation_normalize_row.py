"""Focused behavioral tests for modal_compute/validation.normalize_row.

Tests the viewCount and likeCount output of normalize_row directly,
with explicit two-state policy: persisted zero ≠ unavailable count.
"""
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from modal_compute.validation import normalize_row

_BASE = {"id": "abc", "title": "T", "visibility": "public",
         "created_at": None, "updated_at": None, "memory_count": 5,
         "all_tags": None, "raw_thumbnail": None, "raw_source_url": None}


def test_persisted_zero():
    """Persisted view_count = 0 is a legitimate count and appears as viewCount: 0."""
    row = dict(_BASE, view_count=0, like_count=2)
    result = normalize_row(row, include_like_count=True)
    assert result["viewCount"] == 0
    assert result["likeCount"] == 2


def test_missing_field():
    """Missing view_count key means no value is available — viewCount is omitted."""
    row = dict(_BASE, like_count=2)
    result = normalize_row(row, include_like_count=True)
    assert "viewCount" not in result, f"Unexpected viewCount: {result.get('viewCount')}"
    assert result["likeCount"] == 2


def test_explicit_null():
    """Explicit None view_count is semantically "no data" — viewCount is omitted."""
    row = dict(_BASE, view_count=None, like_count=2)
    result = normalize_row(row, include_like_count=True)
    assert "viewCount" not in result, f"Unexpected viewCount: {result.get('viewCount')}"
    assert result["likeCount"] == 2


def test_positive_count():
    """Positive view_count appears as a numeric positive viewCount."""
    row = dict(_BASE, view_count=42, like_count=7)
    result = normalize_row(row, include_like_count=True)
    assert result["viewCount"] == 42
    assert result["likeCount"] == 7


def test_no_include_like_count():
    """When include_like_count=False, neither viewCount nor likeCount appear."""
    row = dict(_BASE, view_count=42, like_count=7)
    result = normalize_row(row, include_like_count=False)
    assert "viewCount" not in result
    assert "likeCount" not in result


def test_preserves_existing_fields():
    """Existing public summary fields are unchanged."""
    row = dict(_BASE)
    result = normalize_row(row, include_like_count=False)
    assert result["id"] == "abc"
    assert result["title"] == "T"
    assert result["visibility"] == "public"
    assert result["memoryCount"] == 5


def test_visibility_not_changed_by_normalize():
    """normalize_row does not alter visibility; the SQL WHERE clause enforces the filter."""
    row = dict(_BASE, visibility="public")
    result = normalize_row(row, include_like_count=True)
    assert result["visibility"] == "public"
