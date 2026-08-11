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
