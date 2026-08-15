from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Callable, Hashable, MutableMapping


SCHEMA_CAPABILITY_CACHE_TTL_SECONDS = 30.0


@dataclass(frozen=True)
class CapabilityCacheEntry:
    value: bool
    expires_at: float


_TABLE_EXISTS_CACHE: dict[str, CapabilityCacheEntry] = {}
_TABLE_HAS_COLUMN_CACHE: dict[tuple[str, str], CapabilityCacheEntry] = {}


def _get_cached(
    cache: MutableMapping[Hashable, CapabilityCacheEntry],
    key: Hashable,
    now: float,
) -> bool | None:
    entry = cache.get(key)
    if entry is None or entry.expires_at <= now:
        return None
    return entry.value


def _store(
    cache: MutableMapping[Hashable, CapabilityCacheEntry],
    key: Hashable,
    value: bool,
    now: float,
) -> bool:
    cache[key] = CapabilityCacheEntry(
        value=value,
        expires_at=now + SCHEMA_CAPABILITY_CACHE_TTL_SECONDS,
    )
    return value


def table_exists(
    cur,
    table_name: str,
    *,
    clock: Callable[[], float] = time.monotonic,
) -> bool:
    now = clock()
    cached = _get_cached(_TABLE_EXISTS_CACHE, table_name, now)
    if cached is not None:
        return cached

    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = %s
        ) AS "exists"
        """,
        (table_name,),
    )
    row = cur.fetchone()
    return _store(_TABLE_EXISTS_CACHE, table_name, bool(row and row.get("exists")), now)


def table_has_column(
    cur,
    table_name: str,
    column_name: str,
    *,
    clock: Callable[[], float] = time.monotonic,
) -> bool:
    key = (table_name, column_name)
    now = clock()
    cached = _get_cached(_TABLE_HAS_COLUMN_CACHE, key, now)
    if cached is not None:
        return cached

    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        ) AS "exists"
        """,
        (table_name, column_name),
    )
    row = cur.fetchone()
    return _store(_TABLE_HAS_COLUMN_CACHE, key, bool(row and row.get("exists")), now)


def clear_schema_capability_cache() -> None:
    _TABLE_EXISTS_CACHE.clear()
    _TABLE_HAS_COLUMN_CACHE.clear()
