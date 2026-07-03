from __future__ import annotations

import os
import time
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PRIVATE_READ_MAX_ATTEMPTS = 3
PRIVATE_READ_RETRY_DELAY_SECONDS = 0.2

# Timeouts for Modal-side safety (must be less than Cloudflare 25s proxy timeout)
DB_CONNECT_TIMEOUT_SECONDS = 10
DB_STATEMENT_TIMEOUT_MS = 20000
POOL_ACQUIRE_TIMEOUT_SECONDS = 15

_db_pool: ConnectionPool | None = None


def get_db_pool() -> ConnectionPool:
    global _db_pool
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if _db_pool is None or _db_pool.closed:
        # options='-c statement_timeout=20000' enforces 20s limit on all queries in this session
        _db_pool = ConnectionPool(
            conninfo=db_url,
            min_size=1,
            max_size=4,
            max_idle=300,
            kwargs={
                "row_factory": dict_row,
                "connect_timeout": DB_CONNECT_TIMEOUT_SECONDS,
                "options": f"-c statement_timeout={DB_STATEMENT_TIMEOUT_MS}",
            },
        )
    return _db_pool


@contextmanager
def get_db_connection():
    """Return a pooled psycopg3 connection context."""
    pool = get_db_pool()
    start = time.time()
    try:
        with pool.connection(timeout=POOL_ACQUIRE_TIMEOUT_SECONDS) as conn:
            duration_ms = (time.time() - start) * 1000
            if duration_ms > 1000:
                print(f"[LoveBudModal] DB Pool acquire slow: {duration_ms:.2f}ms")
            yield conn
    except Exception:
        duration_ms = (time.time() - start) * 1000
        print(f"[LoveBudModal] DB Pool acquire failed after {duration_ms:.2f}ms")
        raise


def reset_db_pool() -> None:
    global _db_pool
    if _db_pool is not None and not _db_pool.closed:
        _db_pool.close()
    _db_pool = None


def run_db_with_retry(operation, *, max_attempts: int = PRIVATE_READ_MAX_ATTEMPTS):
    last_error: psycopg.OperationalError | None = None
    for attempt in range(max_attempts):
        try:
            return operation()
        except psycopg.OperationalError as error:
            last_error = error
            reset_db_pool()
            if attempt == max_attempts - 1:
                raise
            time.sleep(PRIVATE_READ_RETRY_DELAY_SECONDS * (attempt + 1))
    if last_error is not None:
        raise last_error
    raise RuntimeError("run_db_with_retry failed without capturing an error")
