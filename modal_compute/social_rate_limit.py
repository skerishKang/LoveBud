from __future__ import annotations

import uuid
from typing import Any

from modal_compute.social_errors import SocialWriteError

COMMENT_ACTOR_LIMIT = 10
COMMENT_ACTOR_MEMORY_LIMIT = 3
WINDOW_MINUTES = 1


def check_and_increment_rate_limit(
    cur: Any,
    scope: str,
    actor_id: str,
    memory_id: str | None,
    max_count: int,
) -> bool:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    window_start = now.replace(second=0, microsecond=0).isoformat()
    coalesce_id = memory_id if memory_id else "00000000-0000-0000-0000-000000000000"
    row_id = str(uuid.uuid4())

    cur.execute(
        """
        INSERT INTO social_rate_limits
            (id, scope, actor_id, memory_id, window_start, request_count, created_at)
        VALUES (%s, %s, %s, %s, %s::timestamptz, 1, NOW())
        ON CONFLICT (scope, actor_id, COALESCE(memory_id, '00000000-0000-0000-0000-000000000000'), window_start)
        DO UPDATE SET
            request_count = social_rate_limits.request_count + 1
        WHERE social_rate_limits.request_count < %s
        RETURNING request_count
        """,
        (row_id, scope, actor_id, memory_id, window_start, max_count),
    )
    row = cur.fetchone()

    if row is None:
        return False

    current_count = int(row["request_count"])
    return current_count <= max_count


def check_comment_rate_limits(
    cur: Any,
    actor_id: str,
    memory_id: str,
) -> None:
    try:
        actor_ok = check_and_increment_rate_limit(
            cur,
            scope="comment:actor",
            actor_id=actor_id,
            memory_id=None,
            max_count=COMMENT_ACTOR_LIMIT,
        )
    except Exception:
        raise SocialWriteError(
            status_code=503,
            code="RATE_LIMIT_UNAVAILABLE",
            message="Comment write service is temporarily unavailable",
        )

    if not actor_ok:
        raise SocialWriteError(
            status_code=429,
            code="RATE_LIMITED",
            message="Too many comments. Please try again later.",
            retry_after_ms=WINDOW_MINUTES * 60 * 1000,
        )

    try:
        memory_ok = check_and_increment_rate_limit(
            cur,
            scope="comment:actor-memory",
            actor_id=actor_id,
            memory_id=memory_id,
            max_count=COMMENT_ACTOR_MEMORY_LIMIT,
        )
    except Exception:
        raise SocialWriteError(
            status_code=503,
            code="RATE_LIMIT_UNAVAILABLE",
            message="Comment write service is temporarily unavailable",
        )

    if not memory_ok:
        raise SocialWriteError(
            status_code=429,
            code="RATE_LIMITED_MEMORY",
            message="Too many comments on this memory. Please try again later.",
            retry_after_ms=WINDOW_MINUTES * 60 * 1000,
        )
