#!/usr/bin/env python3
"""Bounded, operator-invoked cleanup primitive for LoveBud social operational rows.

This script is intentionally NOT scheduled by the repository. It defaults to a
bounded dry-run and requires ``--apply`` plus a dedicated database URL
environment variable before deleting anything.

Refs #3942.
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

DEFAULT_DATABASE_URL_ENV = "LOVEBUD_RETENTION_DATABASE_URL"
DEFAULT_BATCH_SIZE = 500
MAX_BATCH_SIZE = 1_000
DEFAULT_MAX_BATCHES = 1
MAX_BATCHES_PER_RUN = 100

IDEMPOTENCY_RETENTION = timedelta(hours=24)
RATE_LIMIT_RETENTION = timedelta(hours=1)
TREE_VIEW_DEDUP_RETENTION = timedelta(hours=24)


@dataclass(frozen=True)
class RetentionTarget:
    table: str
    time_column: str
    retention: timedelta | None
    requires_explicit_retention: bool = False


TARGETS: dict[str, RetentionTarget] = {
    "social_idempotency": RetentionTarget(
        table="social_idempotency",
        time_column="created_at",
        retention=IDEMPOTENCY_RETENTION,
    ),
    "social_rate_limits": RetentionTarget(
        table="social_rate_limits",
        time_column="window_start",
        retention=RATE_LIMIT_RETENTION,
    ),
    "tree_view_dedup_events": RetentionTarget(
        table="tree_view_dedup_events",
        time_column="counted_window_start",
        retention=TREE_VIEW_DEDUP_RETENTION,
    ),
    "social_audit_log": RetentionTarget(
        table="social_audit_log",
        time_column="created_at",
        retention=None,
        requires_explicit_retention=True,
    ),
}

DEFAULT_TARGETS = (
    "social_idempotency",
    "social_rate_limits",
    "tree_view_dedup_events",
)


class RetentionConfigError(ValueError):
    """Raised when an operator request violates the bounded policy."""


def _bounded_positive_int(value: int, *, name: str, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > maximum:
        raise RetentionConfigError(f"{name} must be between 1 and {maximum}")
    return value


def resolve_cutoff(
    target_name: str,
    *,
    now: datetime,
    audit_retention_hours: int | None = None,
) -> datetime:
    """Return the oldest timestamp that must be retained for one target."""
    if target_name not in TARGETS:
        raise RetentionConfigError("unsupported retention target")
    if now.tzinfo is None:
        raise RetentionConfigError("now must be timezone-aware")

    target = TARGETS[target_name]
    retention = target.retention
    if target.requires_explicit_retention:
        if audit_retention_hours is None:
            raise RetentionConfigError("social_audit_log retention decision is required")
        _bounded_positive_int(
            audit_retention_hours,
            name="audit_retention_hours",
            maximum=24 * 3650,
        )
        retention = timedelta(hours=audit_retention_hours)

    assert retention is not None
    return now - retention


def build_delete_sql(target_name: str) -> str:
    """Build bounded DELETE SQL from a fixed identifier allowlist."""
    target = TARGETS.get(target_name)
    if target is None:
        raise RetentionConfigError("unsupported retention target")
    return f"""
WITH doomed AS (
    SELECT id
    FROM {target.table}
    WHERE {target.time_column} < %s
    ORDER BY {target.time_column} ASC, id ASC
    LIMIT %s
)
DELETE FROM {target.table} AS target
USING doomed
WHERE target.id = doomed.id
RETURNING target.id
""".strip()


def build_dry_run_sql(target_name: str) -> str:
    """Count only the next bounded batch; never scan/count the whole table."""
    target = TARGETS.get(target_name)
    if target is None:
        raise RetentionConfigError("unsupported retention target")
    return f"""
SELECT COUNT(*) AS eligible_in_next_batch
FROM (
    SELECT id
    FROM {target.table}
    WHERE {target.time_column} < %s
    ORDER BY {target.time_column} ASC, id ASC
    LIMIT %s
) AS bounded_candidates
""".strip()


def _row_count(row: Any) -> int:
    if row is None:
        return 0
    if isinstance(row, dict):
        return int(row.get("eligible_in_next_batch", 0))
    return int(row[0])


def dry_run_target(conn: Any, *, target_name: str, cutoff: datetime, batch_size: int) -> int:
    batch_size = _bounded_positive_int(batch_size, name="batch_size", maximum=MAX_BATCH_SIZE)
    with conn.cursor() as cur:
        cur.execute(build_dry_run_sql(target_name), (cutoff, batch_size))
        return _row_count(cur.fetchone())


def cleanup_target(
    conn: Any,
    *,
    target_name: str,
    cutoff: datetime,
    batch_size: int,
    max_batches: int,
) -> dict[str, int]:
    """Delete bounded batches and report counts only, never row identifiers."""
    batch_size = _bounded_positive_int(batch_size, name="batch_size", maximum=MAX_BATCH_SIZE)
    max_batches = _bounded_positive_int(max_batches, name="max_batches", maximum=MAX_BATCHES_PER_RUN)
    sql = build_delete_sql(target_name)
    deleted_total = 0
    batches = 0

    for _ in range(max_batches):
        with conn.cursor() as cur:
            cur.execute(sql, (cutoff, batch_size))
            deleted = len(cur.fetchall())
        conn.commit()
        batches += 1
        deleted_total += deleted
        if deleted < batch_size:
            break

    return {"deleted": deleted_total, "batches": batches}


def _load_psycopg():
    try:
        import psycopg  # type: ignore
    except Exception as exc:  # pragma: no cover - exercised only in operator runtime
        raise RuntimeError("RETENTION_DB_DRIVER_UNAVAILABLE") from exc
    return psycopg


def _parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LoveBud bounded social retention cleanup")
    parser.add_argument("--target", action="append", choices=tuple(TARGETS), dest="targets")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--max-batches", type=int, default=DEFAULT_MAX_BATCHES)
    parser.add_argument("--audit-retention-hours", type=int)
    parser.add_argument("--database-url-env", default=DEFAULT_DATABASE_URL_ENV)
    parser.add_argument("--apply", action="store_true", help="perform bounded DELETE batches; default is dry-run")
    return parser.parse_args(list(argv) if argv is not None else None)


def main(argv: Iterable[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        batch_size = _bounded_positive_int(args.batch_size, name="batch_size", maximum=MAX_BATCH_SIZE)
        max_batches = _bounded_positive_int(
            args.max_batches,
            name="max_batches",
            maximum=MAX_BATCHES_PER_RUN,
        )
        targets = tuple(args.targets or DEFAULT_TARGETS)
        now = datetime.now(timezone.utc)
        cutoffs = {
            name: resolve_cutoff(name, now=now, audit_retention_hours=args.audit_retention_hours)
            for name in targets
        }
    except RetentionConfigError as exc:
        print(f"RETENTION_CONFIG_ERROR: {exc}", file=sys.stderr)
        return 2

    db_url = os.getenv(args.database_url_env)
    if not db_url:
        print("RETENTION_DATABASE_UNAVAILABLE", file=sys.stderr)
        return 3

    psycopg = _load_psycopg()
    try:
        with psycopg.connect(db_url) as conn:
            for target_name in targets:
                if args.apply:
                    result = cleanup_target(
                        conn,
                        target_name=target_name,
                        cutoff=cutoffs[target_name],
                        batch_size=batch_size,
                        max_batches=max_batches,
                    )
                    print(
                        f"RETENTION_APPLY target={target_name} "
                        f"deleted={result['deleted']} batches={result['batches']}"
                    )
                else:
                    eligible = dry_run_target(
                        conn,
                        target_name=target_name,
                        cutoff=cutoffs[target_name],
                        batch_size=batch_size,
                    )
                    print(
                        f"RETENTION_DRY_RUN target={target_name} "
                        f"eligible_in_next_batch={eligible} batch_limit={batch_size}"
                    )
    except Exception:
        # Deliberately avoid rendering connection details, SQL, row IDs, or raw DB exceptions.
        print("RETENTION_DATABASE_OPERATION_FAILED", file=sys.stderr)
        return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
