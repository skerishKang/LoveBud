#!/usr/bin/env python3
"""Focused regression coverage for Issue #3934 owner DTO visibility truthfulness."""

from pathlib import Path

from modal_compute.validation import normalize_memory_row, normalize_tree_row


def make_tree_row(**overrides):
    row = {
        "id": "tree-1",
        "owner_id": "owner-1",
        "title": "Tree",
        "visibility": "private",
    }
    row.update(overrides)
    return row


def make_memory_row(**overrides):
    row = {
        "id": "memory-1",
        "tree_id": "tree-1",
        "title": "Memory",
        "visibility": "private",
    }
    row.update(overrides)
    return row


def extract_python_function(source: str, function_name: str) -> str:
    start = source.index(f"def {function_name}(")
    next_function = source.find("\n\ndef ", start + 1)
    if next_function == -1:
        return source[start:]
    return source[start:next_function]


def test_owner_tree_null_and_unknown_visibility_are_not_public():
    for value in (None, "unknown", "", 0, False):
        dto = normalize_tree_row(make_tree_row(visibility=value))
        assert dto["visibility"] is None, (value, dto)
        assert dto["visibility"] != "public", (value, dto)

    missing = make_tree_row()
    missing.pop("visibility")
    dto = normalize_tree_row(missing)
    assert dto["visibility"] is None, dto


def test_owner_memory_null_and_unknown_visibility_are_not_public():
    for value in (None, "unknown", "", 0, False):
        dto = normalize_memory_row(make_memory_row(visibility=value))
        assert dto["visibility"] is None, (value, dto)
        assert dto["visibility"] != "public", (value, dto)

    missing = make_memory_row()
    missing.pop("visibility")
    dto = normalize_memory_row(missing)
    assert dto["visibility"] is None, dto


def test_explicit_public_and_private_visibility_are_preserved():
    for value in ("public", "private"):
        assert normalize_tree_row(make_tree_row(visibility=value))["visibility"] == value
        assert normalize_memory_row(make_memory_row(visibility=value))["visibility"] == value


def test_modern_public_reads_keep_explicit_public_predicates():
    source = Path("modal_compute/public_reads.py").read_text(encoding="utf-8")

    memories = extract_python_function(source, "fetch_public_memories")
    assert 'filters = ["m.visibility = \'public\'", "t.visibility = \'public\'"]' in memories
    assert "normalize_memory_row(row)" in memories

    memory = extract_python_function(source, "fetch_public_memory")
    assert "AND m.visibility = 'public'" in memory
    assert "AND t.visibility = 'public'" in memory
    assert "normalize_memory_row(result)" in memory

    tree = extract_python_function(source, "fetch_public_tree")
    assert "AND m.visibility = 'public'" in tree
    assert "AND t.visibility = 'public'" in tree
    assert 'normalize_tree_row(row, row.get("memory_count"), include_owner=False)' in tree


def run_test(name, fn):
    try:
        fn()
        print(f"PASS: {name}")
        return True
    except Exception as exc:
        print(f"FAIL: {name}: {type(exc).__name__}: {exc}")
        return False


def main() -> int:
    tests = [
        ("owner Tree NULL/unknown negative control", test_owner_tree_null_and_unknown_visibility_are_not_public),
        ("owner Memory NULL/unknown negative control", test_owner_memory_null_and_unknown_visibility_are_not_public),
        ("explicit public/private positive controls", test_explicit_public_and_private_visibility_are_preserved),
        ("modern public-read explicit predicates", test_modern_public_reads_keep_explicit_public_predicates),
    ]
    passed = sum(run_test(name, fn) for name, fn in tests)
    print(f"{passed}/{len(tests)} tests passed")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    raise SystemExit(main())
