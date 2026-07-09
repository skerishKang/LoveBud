from __future__ import annotations

import hashlib
import json
import re
import uuid
from typing import Any

from modal_compute.social_errors import SocialWriteError

KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def validate_idempotency_key_format(idempotency_key: str | None) -> str:
    if not idempotency_key:
        raise SocialWriteError(
            status_code=400,
            code="IDEMPOTENCY_KEY_REQUIRED",
            message="Idempotency-Key header is required for this operation",
        )
    if not isinstance(idempotency_key, str) or not KEY_PATTERN.match(idempotency_key):
        raise SocialWriteError(
            status_code=400,
            code="IDEMPOTENCY_KEY_INVALID",
            message="Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]",
        )
    return idempotency_key


def _compute_fingerprint(body: dict[str, Any]) -> str:
    raw = json.dumps(body, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _compute_key_hash(idempotency_key: str) -> str:
    return hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()


def reserve_and_verify_idempotency(
    cur: Any,
    actor_id: str,
    operation: str,
    idempotency_key: str,
    target_memory_id: str,
    body: dict[str, Any],
) -> dict[str, Any] | None:
    fingerprint = _compute_fingerprint(body)
    key_hash = _compute_key_hash(idempotency_key)
    result_id = str(uuid.uuid4())

    cur.execute(
        """
        INSERT INTO social_idempotency
            (id, actor_id, operation, idempotency_key, request_fingerprint,
             target_memory_id, result_id, result_state, result_payload, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', NULL, NOW())
        ON CONFLICT (actor_id, operation, idempotency_key)
        DO UPDATE SET
            target_memory_id = social_idempotency.target_memory_id,
            result_id = social_idempotency.result_id,
            result_state = social_idempotency.result_state,
            result_payload = social_idempotency.result_payload,
            request_fingerprint = social_idempotency.request_fingerprint
        WHERE social_idempotency.idempotency_key = %s
          AND social_idempotency.actor_id = %s
          AND social_idempotency.operation = %s
        RETURNING
            id, target_memory_id, result_id, result_state,
            request_fingerprint, result_payload, created_at
        """,
        (
            result_id, actor_id, operation, idempotency_key,
            fingerprint, target_memory_id, result_id,
            idempotency_key, actor_id, operation,
        ),
    )
    row = cur.fetchone()

    if row is None:
        return None

    stored_target = str(row["target_memory_id"])
    stored_fingerprint = str(row["request_fingerprint"])
    stored_state = str(row["result_state"])
    stored_result_id = str(row["result_id"]) if row.get("result_id") else None
    stored_result_payload = row.get("result_payload")

    is_new_reservation = (
        stored_result_id == result_id
        and stored_state == "pending"
    )

    if is_new_reservation:
        return None

    if stored_target != target_memory_id:
        raise SocialWriteError(
            status_code=409,
            code="IDEMPOTENCY_KEY_REUSED",
            message="Idempotency key was used for a different target memory",
        )

    if stored_fingerprint != fingerprint:
        raise SocialWriteError(
            status_code=409,
            code="IDEMPOTENCY_KEY_REUSED",
            message="Idempotency key was used with a different request payload",
        )

    if stored_state in ("completed", "replayed"):
        payload = stored_result_payload
        if payload is not None and not isinstance(payload, dict):
            try:
                import json as _json
                payload = _json.loads(payload)
            except (ValueError, TypeError):
                payload = None
        return {
            "replay": True,
            "resultId": stored_result_id,
            "resultState": stored_state,
            "resultPayload": payload,
            "fingerprint": fingerprint,
        }

    if stored_state in ("pending", "failed"):
        raise SocialWriteError(
            status_code=500,
            code="SOCIAL_WRITE_UNAVAILABLE",
            message="Request is already being processed. Please retry with the same key.",
        )

    return None


def _read_existing_idempotency_target(
    cur: Any,
    actor_id: str,
    operation: str,
    idempotency_key: str,
) -> dict[str, Any] | None:
    """SELECT-first lookup of an existing reservation/replay row.

    Replay detection must NOT depend on a DB-level unique constraint on
    (actor_id, operation, idempotency_key). In runtimes where that constraint
    is absent, INSERT ... ON CONFLICT ... RETURNING silently creates a fresh
    pending row on every call, which makes same-key replay apply a second
    toggle instead of returning the stored authoritative DTO (Issue #3366).

    Reading the existing row first makes replay robust regardless of whether
    the unique index is present. The caller holds an advisory lock on
    (actor_id, target_id), so same-actor concurrent calls are serialized and
    this SELECT-first path is race-free for the same key.
    """

    cur.execute(
        """
        SELECT target_kind, target_id, target_memory_id, result_id,
               result_state, request_fingerprint, result_payload
        FROM social_idempotency
        WHERE actor_id = %s AND operation = %s AND idempotency_key = %s
        LIMIT 1
        """,
        (actor_id, operation, idempotency_key),
    )
    return cur.fetchone()


def reserve_and_verify_idempotency_target(
    cur: Any,
    actor_id: str,
    operation: str,
    idempotency_key: str,
    target_kind: str,
    target_id: str,
    body: dict[str, Any],
    target_memory_id: str | None = None,
) -> dict[str, Any] | None:
    """Reservation + replay verification for a generic (target_kind, target_id) pair.

    This variant is used by Gate-B-aligned tree-target writers. It stores the
    canonical generic target pair directly (target_kind/target_id) and leaves
    legacy moment fields NULL so the compatibility trigger accepts the row.

    Replay is resolved by a SELECT-first lookup (see _read_existing_idempotency_target)
    so it does not depend on the DB unique constraint being present.

    Behaviour:
    - new reservation (no existing row) -> None (mutation proceeds)
    - same key + matching kind/id/fingerprint -> replay dict (no second toggle)
    - same key + different target or payload -> 409 IDEMPOTENCY_KEY_REUSED
    - same key + pending/failed prior state -> 500 SOCIAL_WRITE_UNAVAILABLE
    """

    fingerprint = _compute_fingerprint(body)
    existing = _read_existing_idempotency_target(cur, actor_id, operation, idempotency_key)

    if existing is not None:
        stored_kind = str(existing["target_kind"])
        stored_target = str(existing["target_id"])
        stored_fingerprint = str(existing["request_fingerprint"])
        stored_state = str(existing["result_state"])
        stored_result_id = str(existing["result_id"]) if existing.get("result_id") else None
        stored_result_payload = existing.get("result_payload")

        if stored_kind != target_kind or stored_target != target_id:
            raise SocialWriteError(
                status_code=409,
                code="IDEMPOTENCY_KEY_REUSED",
                message="Idempotency key was used for a different target",
            )

        if stored_fingerprint != fingerprint:
            raise SocialWriteError(
                status_code=409,
                code="IDEMPOTENCY_KEY_REUSED",
                message="Idempotency key was used with a different request payload",
            )

        if stored_state in ("completed", "replayed"):
            payload = stored_result_payload
            if payload is not None and not isinstance(payload, dict):
                try:
                    import json as _json
                    payload = _json.loads(payload)
                except (ValueError, TypeError):
                    payload = None
            return {
                "replay": True,
                "resultId": stored_result_id,
                "resultState": stored_state,
                "resultPayload": payload,
                "fingerprint": fingerprint,
            }

        if stored_state in ("pending", "failed"):
            raise SocialWriteError(
                status_code=500,
                code="SOCIAL_WRITE_UNAVAILABLE",
                message="Request is already being processed. Please retry with the same key.",
            )
        # Unknown state falls through to a fresh reservation.

    result_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO social_idempotency
            (id, actor_id, operation, idempotency_key, request_fingerprint,
             target_kind, target_id, target_memory_id, result_id, result_state,
             result_payload, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NULL, NOW())
        ON CONFLICT (actor_id, operation, idempotency_key)
        DO UPDATE SET
            -- SELECT-first handles replay; this fallback only refreshes
            -- reservation metadata WITHOUT overwriting the existing row's
            -- target_kind/target_id/fingerprint/state/payload.
            -- Keeping existing values (social_idempotency.*) is critical
            -- because the advisory lock is on (actor_id, target_id) so
            -- same actor + same key + different tree races are possible,
            -- and EXCLUDED.* would corrupt the first reservation (#3367 review).
            target_kind = social_idempotency.target_kind,
            target_id = social_idempotency.target_id,
            target_memory_id = social_idempotency.target_memory_id,
            request_fingerprint = social_idempotency.request_fingerprint,
            result_id = social_idempotency.result_id,
            result_state = social_idempotency.result_state,
            result_payload = social_idempotency.result_payload
        RETURNING
            target_kind, target_id, target_memory_id,
            result_id, result_state, request_fingerprint, result_payload
        """,
        (
            str(uuid.uuid4()), actor_id, operation, idempotency_key,
            fingerprint, target_kind, target_id, target_memory_id, result_id,
        ),
    )
    row = cur.fetchone()

    if row is not None:
        stored_result_id = str(row["result_id"]) if row.get("result_id") else None
        stored_state = str(row["result_state"])

        # If RETURNING gave our generated result_id with pending state, this
        # is a fresh INSERT (no conflict) -> proceed with mutation.
        if stored_result_id == result_id and stored_state == "pending":
            return None

        # Conflict: RETURNING produced the pre-existing row. Verify it with
        # the same rules as the SELECT-first path above.
        stored_kind = str(row["target_kind"])
        stored_target = str(row["target_id"])
        stored_fingerprint = str(row["request_fingerprint"])
        stored_result_payload = row.get("result_payload")

        if stored_kind != target_kind or stored_target != target_id:
            raise SocialWriteError(
                status_code=409,
                code="IDEMPOTENCY_KEY_REUSED",
                message="Idempotency key was used for a different target",
            )
        if stored_fingerprint != fingerprint:
            raise SocialWriteError(
                status_code=409,
                code="IDEMPOTENCY_KEY_REUSED",
                message="Idempotency key was used with a different request payload",
            )
        if stored_state in ("completed", "replayed"):
            payload = stored_result_payload
            if payload is not None and not isinstance(payload, dict):
                try:
                    import json as _json
                    payload = _json.loads(payload)
                except (ValueError, TypeError):
                    payload = None
            return {
                "replay": True,
                "resultId": stored_result_id,
                "resultState": stored_state,
                "resultPayload": payload,
                "fingerprint": fingerprint,
            }
        if stored_state in ("pending", "failed"):
            raise SocialWriteError(
                status_code=500,
                code="SOCIAL_WRITE_UNAVAILABLE",
                message="Request is already being processed. Please retry with the same key.",
            )

    return None


def complete_idempotency(
    cur: Any,
    actor_id: str,
    operation: str,
    idempotency_key: str,
    result_id: str,
    result_state: str = "completed",
    result_payload: dict[str, Any] | None = None,
) -> None:
    if result_payload is not None:
        cur.execute(
            """
            UPDATE social_idempotency
            SET result_id = %s, result_state = %s, result_payload = %s
            WHERE actor_id = %s AND operation = %s AND idempotency_key = %s
            """,
            (result_id, result_state, json.dumps(result_payload), actor_id, operation, idempotency_key),
        )
    else:
        cur.execute(
            """
            UPDATE social_idempotency
            SET result_id = %s, result_state = %s
            WHERE actor_id = %s AND operation = %s AND idempotency_key = %s
            """,
            (result_id, result_state, actor_id, operation, idempotency_key),
        )
