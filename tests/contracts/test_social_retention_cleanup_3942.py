from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parents[2]
SCRIPT = ROOT / "scripts" / "social_retention_cleanup.py"
spec = importlib.util.spec_from_file_location("social_retention_cleanup", SCRIPT)
assert spec and spec.loader
retention = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = retention
spec.loader.exec_module(retention)


def test_source_authoritative_thresholds() -> None:
    now = datetime(2026, 8, 10, 0, 0, tzinfo=timezone.utc)
    assert retention.resolve_cutoff("social_idempotency", now=now) == now - timedelta(hours=24)
    assert retention.resolve_cutoff("social_rate_limits", now=now) == now - timedelta(hours=1)
    assert retention.resolve_cutoff("tree_view_dedup_events", now=now) == now - timedelta(hours=24)


def test_audit_retention_has_no_invented_default() -> None:
    now = datetime(2026, 8, 10, 0, 0, tzinfo=timezone.utc)
    try:
        retention.resolve_cutoff("social_audit_log", now=now)
    except retention.RetentionConfigError as exc:
        assert "decision is required" in str(exc)
    else:
        raise AssertionError("audit cleanup must require an explicit retention decision")

    assert retention.resolve_cutoff(
        "social_audit_log",
        now=now,
        audit_retention_hours=720,
    ) == now - timedelta(hours=720)


def test_delete_is_bounded_and_identifier_allowlisted() -> None:
    sql = retention.build_delete_sql("social_idempotency")
    assert "WITH doomed AS" in sql
    assert "ORDER BY created_at ASC, id ASC" in sql
    assert "LIMIT %s" in sql
    assert "DELETE FROM social_idempotency" in sql
    assert "RETURNING target.id" in sql
    assert "actor_id" not in sql

    try:
        retention.build_delete_sql("social_idempotency; DROP TABLE trees")
    except retention.RetentionConfigError:
        pass
    else:
        raise AssertionError("unapproved identifiers must be rejected")


def test_dry_run_is_bounded_not_full_table_count() -> None:
    sql = retention.build_dry_run_sql("social_rate_limits")
    assert "SELECT COUNT(*)" in sql
    assert "FROM (" in sql
    assert "LIMIT %s" in sql
    assert "ORDER BY window_start ASC, id ASC" in sql


def test_batch_and_run_budgets_are_hard_capped() -> None:
    assert retention._bounded_positive_int(1, name="batch_size", maximum=1000) == 1
    assert retention._bounded_positive_int(1000, name="batch_size", maximum=1000) == 1000
    for bad in (0, -1, 1001):
        try:
            retention._bounded_positive_int(bad, name="batch_size", maximum=1000)
        except retention.RetentionConfigError:
            pass
        else:
            raise AssertionError(f"bad batch size accepted: {bad}")


def test_default_targets_exclude_audit_log() -> None:
    assert "social_audit_log" not in retention.DEFAULT_TARGETS
    assert set(retention.DEFAULT_TARGETS) == {
        "social_idempotency",
        "social_rate_limits",
        "tree_view_dedup_events",
    }


class FakeCursor:
    def __init__(self, batches):
        self._batches = batches
        self._current = []
        self.executions = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self.executions.append((sql, params))
        self._current = self._batches.pop(0) if self._batches else []

    def fetchall(self):
        return self._current


class FakeConnection:
    def __init__(self, batches):
        self.cursor_obj = FakeCursor(batches)
        self.commit_calls = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commit_calls += 1


def test_cleanup_stops_after_short_batch_and_reports_counts_only() -> None:
    cutoff = datetime(2026, 8, 9, tzinfo=timezone.utc)
    conn = FakeConnection([[("row-a",), ("row-b",)], [("row-c",)]])
    result = retention.cleanup_target(
        conn,
        target_name="social_idempotency",
        cutoff=cutoff,
        batch_size=2,
        max_batches=10,
    )
    assert result == {"deleted": 3, "batches": 2}
    assert conn.commit_calls == 2
    assert "row-a" not in repr(result)
    assert len(conn.cursor_obj.executions) == 2


def test_tree_view_cleanup_uses_completed_window_boundary() -> None:
    now = datetime(2026, 8, 10, 3, 0, tzinfo=timezone.utc)
    cutoff = retention.resolve_cutoff("tree_view_dedup_events", now=now)
    assert cutoff == datetime(2026, 8, 9, 3, 0, tzinfo=timezone.utc)
    sql = retention.build_delete_sql("tree_view_dedup_events")
    assert "counted_window_start < %s" in sql


if __name__ == "__main__":
    tests = [name for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for name in tests:
        globals()[name]()
    print(f"social retention #3942: PASS ({len(tests)} tests)")
