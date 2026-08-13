from modal_compute import owner_reads, public_reads
from modal_compute.schema_capabilities import (
    SCHEMA_CAPABILITY_CACHE_TTL_SECONDS,
    clear_schema_capability_cache,
    table_exists,
    table_has_column,
)


class FakeClock:
    def __init__(self):
        self.value = 100.0

    def __call__(self):
        return self.value

    def advance(self, seconds):
        self.value += seconds


class FakeCursor:
    def __init__(self, values):
        self.values = iter(values)
        self.calls = []
        self.current = None

    def execute(self, query, params):
        self.calls.append((query, params))
        value = next(self.values)
        if isinstance(value, Exception):
            raise value
        self.current = {"exists": value}

    def fetchone(self):
        return self.current


def setup_function():
    clear_schema_capability_cache()


def test_false_to_true_reprobes_after_ttl_without_sleep():
    clock = FakeClock()
    cur = FakeCursor([False, True])
    assert table_exists(cur, "memories", clock=clock) is False
    clock.advance(SCHEMA_CAPABILITY_CACHE_TTL_SECONDS - 1)
    assert table_exists(cur, "memories", clock=clock) is False
    assert len(cur.calls) == 1
    clock.advance(2)
    assert table_exists(cur, "memories", clock=clock) is True
    assert len(cur.calls) == 2


def test_true_to_false_reprobes_after_ttl():
    clock = FakeClock()
    cur = FakeCursor([True, False])
    assert table_has_column(cur, "trees", "title", clock=clock) is True
    clock.advance(SCHEMA_CAPABILITY_CACHE_TTL_SECONDS + 0.1)
    assert table_has_column(cur, "trees", "title", clock=clock) is False
    assert len(cur.calls) == 2


def test_probe_exception_is_not_cached():
    clock = FakeClock()
    cur = FakeCursor([RuntimeError("probe failed"), True])
    try:
        table_exists(cur, "tree_social_counts", clock=clock)
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected probe exception")
    assert table_exists(cur, "tree_social_counts", clock=clock) is True
    assert len(cur.calls) == 2


def test_table_and_column_cache_are_distinct_and_bounded():
    clock = FakeClock()
    cur = FakeCursor([True, False])
    assert table_exists(cur, "trees", clock=clock) is True
    assert table_has_column(cur, "trees", "visibility", clock=clock) is False
    assert len(cur.calls) == 2
    assert table_exists(cur, "trees", clock=clock) is True
    assert table_has_column(cur, "trees", "visibility", clock=clock) is False
    assert len(cur.calls) == 2


def test_owner_reads_delegates_to_shared_schema_capability_helper():
    # Regression lock: owner reads must use the shared schema_capabilities
    # helper, not a module-local re-implementation.
    assert owner_reads._table_exists is table_exists
    assert owner_reads._table_has_column is table_has_column
    assert owner_reads._table_exists.__module__ == "modal_compute.schema_capabilities"
    assert owner_reads._table_has_column.__module__ == "modal_compute.schema_capabilities"


def test_public_reads_delegates_to_shared_schema_capability_helper():
    # Regression lock: public reads must use the shared schema_capabilities
    # helper, not a module-local re-implementation.
    assert public_reads._table_exists is table_exists
    assert public_reads._table_has_column is table_has_column
    assert public_reads._table_exists.__module__ == "modal_compute.schema_capabilities"
    assert public_reads._table_has_column.__module__ == "modal_compute.schema_capabilities"


def test_owner_and_public_reads_have_no_module_local_capability_cache():
    # Regression lock: the old per-reader permanent caches must never return.
    assert not hasattr(owner_reads, "_TABLE_EXISTS_CACHE")
    assert not hasattr(owner_reads, "_TABLE_HAS_COLUMN_CACHE")
    assert not hasattr(public_reads, "_TABLE_EXISTS_CACHE")
    assert not hasattr(public_reads, "_TABLE_HAS_COLUMN_CACHE")


def test_owner_and_public_share_one_freshness_authority():
    # Regression lock: owner and public readers resolve through ONE shared
    # freshness authority, so a single probe serves both readers.
    clear_schema_capability_cache()
    clock = FakeClock()
    cur = FakeCursor([True])

    assert owner_reads._table_exists(cur, "memories", clock=clock) is True
    assert len(cur.calls) == 1

    # public reads must reuse the same cached entry without reprobing.
    assert public_reads._table_exists(cur, "memories", clock=clock) is True
    assert len(cur.calls) == 1

    # the shared module helper also observes the same authority.
    assert table_exists(cur, "memories", clock=clock) is True
    assert len(cur.calls) == 1


def main():
    tests = [
        test_false_to_true_reprobes_after_ttl_without_sleep,
        test_true_to_false_reprobes_after_ttl,
        test_probe_exception_is_not_cached,
        test_table_and_column_cache_are_distinct_and_bounded,
        test_owner_reads_delegates_to_shared_schema_capability_helper,
        test_public_reads_delegates_to_shared_schema_capability_helper,
        test_owner_and_public_reads_have_no_module_local_capability_cache,
        test_owner_and_public_share_one_freshness_authority,
    ]

    failed = 0
    for test in tests:
        try:
            setup_function()
            test()
            print(f"PASS: {test.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL: {test.__name__}: {type(exc).__name__}: {exc}")

    if failed:
        raise SystemExit(1)
    print(f"PASS: {len(tests)}/{len(tests)}")


if __name__ == "__main__":
    main()
