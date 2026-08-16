"""Pure write-outcome classification authority (Issue #4080).

Provider-neutral, source-level classification of write-boundary outcomes.
This module is a PURE SOURCE AUTHORITY:

- it carries NO capability (no network, provider, database, SQL, filesystem
  write, process, timer, retry, alert, or deployment);
- it never executes a write, never retries, never reconciles, never persists,
  and never mutates the user write path or any response status/body;
- it is provider-neutral: no provider, connection, or account identity is
  accepted, encoded, or emitted anywhere in the vocabulary or result;
- it is fail-closed on every privacy and safety boundary: unknown fields,
  unknown enum values, and private identifier keys are rejected on input, and
  no caller-controlled key/value, raw error, stack, payload, SQL, or URL is
  ever echoed into a result;
- it keeps the five write-boundary stages distinct and never treats a write
  acknowledgement as equivalent to a canonical reread confirmation
  (WRITE_ACKNOWLEDGED != CANONICAL_REREAD_CONFIRMED);
- it classifies every undecidable timeout / unavailable commit state as
  WRITE_STATUS_UNKNOWN with retry_safe=False so an unknown write is never
  blindly retried (reread/reconciliation is required first).

This module does NOT modify, import, or duplicate modal_compute.write
handlers, owner_reads, or validation. It reuses the bounded outcome semantics
of the #3835/#3852/#3855 vocabulary by value only.

Refs #4080.
Refs #3461 — Keep OPEN.
Refs #3457.
Refs #3835.
Refs #3852.
Refs #3855.
Refs #4058.
Refs #1882 — Keep OPEN.
"""

from __future__ import annotations

from types import MappingProxyType
from typing import Any, Mapping

CONTRACT_VERSION = "1"

# ---------------------------------------------------------------------------
# Fixed, sanitized error codes. Bounded; never a caller value.
# ---------------------------------------------------------------------------
ERROR_CODES = MappingProxyType(
    {
        "INPUT_NOT_OBJECT": "INPUT_NOT_OBJECT",
        "UNKNOWN_FIELD": "UNKNOWN_FIELD",
        "PRIVATE_FIELD_REJECTED": "PRIVATE_FIELD_REJECTED",
        "MISSING_REQUIRED_FIELD": "MISSING_REQUIRED_FIELD",
        "UNKNOWN_ENUM": "UNKNOWN_ENUM",
        "NON_CANONICAL_RESULT": "NON_CANONICAL_RESULT",
    }
)

# ---------------------------------------------------------------------------
# Ordered write-boundary stages — immutable ordering authority. These five
# stages are kept strictly distinct. A write acknowledgement (server 2xx /
# accepted) is NEVER equivalent to a canonical reread confirmation.
# ---------------------------------------------------------------------------
WRITE_OUTCOME_STAGE_ORDER = (
    "REQUEST_ACCEPTED",
    "DB_TRANSACTION_COMMITTED",
    "CANONICAL_ROW_RETURNED",
    "FOLLOWUP_REREAD_VISIBLE",
    "CLIENT_VISIBLE_SUCCESS",
)

WRITE_OUTCOME_STAGES = MappingProxyType(
    {stage: stage for stage in WRITE_OUTCOME_STAGE_ORDER}
)

# ---------------------------------------------------------------------------
# Bounded outcome codes. The first six reuse the existing #3835/#3852/#3855
# semantics by value; the WRITE_* codes are the narrow server-side additions
# required by #4080. No provider name appears anywhere in this vocabulary.
# ---------------------------------------------------------------------------
OUTCOME_CODES = MappingProxyType(
    {
        "CONFIRMED": "CONFIRMED",
        "TRANSPORT_FAILED": "TRANSPORT_FAILED",
        "ACKNOWLEDGEMENT_MISSING": "ACKNOWLEDGEMENT_MISSING",
        "ACKNOWLEDGED_REREAD_MISSING": "ACKNOWLEDGED_REREAD_MISSING",
        "MONITORING_FAILED": "MONITORING_FAILED",
        "INSUFFICIENT_EVIDENCE": "INSUFFICIENT_EVIDENCE",
        "WRITE_REJECTED_VALIDATION": "WRITE_REJECTED_VALIDATION",
        "WRITE_COMMITTED_ROW_RETURNED": "WRITE_COMMITTED_ROW_RETURNED",
        "WRITE_COMMITTED_REREAD_MISSING": "WRITE_COMMITTED_REREAD_MISSING",
        "WRITE_COMMITTED_REREAD_MISMATCH": "WRITE_COMMITTED_REREAD_MISMATCH",
        "WRITE_STATUS_UNKNOWN": "WRITE_STATUS_UNKNOWN",
    }
)

# ---------------------------------------------------------------------------
# Bounded fact enums. Each fact is a closed vocabulary; free-form values are
# rejected. No enum carries a provider, host, URL, identifier, or payload.
# ---------------------------------------------------------------------------
TRANSPORT_CLASSES = MappingProxyType(
    {
        "ok": "ok",
        "timeout": "timeout",
        "network_error": "network_error",
        "not_dispatched": "not_dispatched",
    }
)

COMMIT_CLASSES = MappingProxyType(
    {
        "committed": "committed",
        "rolled_back": "rolled_back",
        "not_reached": "not_reached",
        "unknown": "unknown",
    }
)

RETURNING_CLASSES = MappingProxyType(
    {
        "row_returned": "row_returned",
        "no_row": "no_row",
        "not_reached": "not_reached",
        "unknown": "unknown",
    }
)

REREAD_CLASSES = MappingProxyType(
    {
        "visible": "visible",
        "missing": "missing",
        "mismatch": "mismatch",
        "not_attempted": "not_attempted",
        "unknown": "unknown",
    }
)

UPSTREAM_STATUS_CLASSES = MappingProxyType(
    {
        "success_2xx": "success_2xx",
        "client_error_4xx": "client_error_4xx",
        "server_error_5xx": "server_error_5xx",
        "unknown": "unknown",
    }
)

# ---------------------------------------------------------------------------
# Evidence completeness — bounded; mirrors the #3835 safe vocabulary.
# ---------------------------------------------------------------------------
EVIDENCE_COMPLETENESS = MappingProxyType(
    {
        "COMPLETE": "complete",
        "PARTIAL": "partial",
        "MISSING": "missing",
        "INVALID": "invalid",
    }
)

# ---------------------------------------------------------------------------
# Allowed input fields (exact; unknown keys are rejected).
# ---------------------------------------------------------------------------
REQUIRED_FIELDS = ("transport", "commit", "returning", "reread")

OPTIONAL_FIELDS = ("validation_rejected", "upstream_status_class", "client_visible")

ALLOWED_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

# ---------------------------------------------------------------------------
# Privacy-sensitive keys — rejected on input. A write-boundary fact must never
# carry an identifier, credential, payload, SQL, URL, raw error, or
# provider/connection identity.
# ---------------------------------------------------------------------------
PRIVATE_KEYS = frozenset(
    {
        "token",
        "cookie",
        "authorization",
        "email",
        "user_id",
        "uid",
        "owner_id",
        "tree_id",
        "memory_id",
        "target_id",
        "title",
        "description",
        "content",
        "memo",
        "url",
        "query",
        "payload",
        "request_body",
        "response_body",
        "sql",
        "raw_error",
        "exception",
        "stack",
        "database_url",
        "request_id",
        "provider",
        "provider_id",
        "connection",
        "account_id",
        "project_id",
        "secret",
        "timestamp",
        "metadata",
    }
)

# ---------------------------------------------------------------------------
# Core safety invariant: a write acknowledgement is NEVER equivalent to a
# canonical reread confirmation.
# ---------------------------------------------------------------------------
WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED = False

# Capabilities — pure source authority; zero capabilities.
CAPABILITIES = ()


def _is_plain_mapping(value: Any) -> bool:
    """Only plain dict-like mappings are accepted as facts."""
    return isinstance(value, Mapping) and not isinstance(value, type)


def validate_write_outcome_facts(
    facts: Any,
) -> tuple[bool, tuple[str, ...]]:
    """Fail-closed validation of write-boundary facts.

    Returns (ok, errors) where errors is a tuple of fixed ERROR_CODES values.
    Never echoes a caller-controlled key/value.
    """
    errors: list[str] = []

    if not _is_plain_mapping(facts):
        return False, (ERROR_CODES["INPUT_NOT_OBJECT"],)

    for key in facts:
        if key in PRIVATE_KEYS:
            errors.append(ERROR_CODES["PRIVATE_FIELD_REJECTED"])
        elif key not in ALLOWED_FIELDS:
            errors.append(ERROR_CODES["UNKNOWN_FIELD"])

    for field in REQUIRED_FIELDS:
        if field not in facts or facts[field] is None:
            errors.append(ERROR_CODES["MISSING_REQUIRED_FIELD"])

    def _check_enum(field: str, allowed: Mapping[str, str]) -> None:
        value = facts.get(field)
        if value is not None and value not in allowed.values():
            errors.append(ERROR_CODES["UNKNOWN_ENUM"])

    _check_enum("transport", TRANSPORT_CLASSES)
    _check_enum("commit", COMMIT_CLASSES)
    _check_enum("returning", RETURNING_CLASSES)
    _check_enum("reread", REREAD_CLASSES)
    _check_enum("upstream_status_class", UPSTREAM_STATUS_CLASSES)

    for bool_field in ("validation_rejected", "client_visible"):
        value = facts.get(bool_field)
        if value is not None and not isinstance(value, bool):
            errors.append(ERROR_CODES["UNKNOWN_ENUM"])

    unique = tuple(sorted(set(errors)))
    return len(unique) == 0, unique


def _decide(facts: Mapping[str, Any]) -> dict[str, Any]:
    """Deterministic classification decision table. Pure and total over
    validated facts. First matching rule wins. Undecidable commit state always
    resolves to WRITE_STATUS_UNKNOWN with retry_safe=False."""
    transport = facts["transport"]
    commit = facts["commit"]
    returning = facts["returning"]
    reread = facts["reread"]
    validation_rejected = facts.get("validation_rejected") is True
    upstream_status = facts.get("upstream_status_class") or "unknown"
    client_visible = facts.get("client_visible") is True

    # Rule 1 — server-side validation rejected before any DB side effect.
    if validation_rejected:
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["WRITE_REJECTED_VALIDATION"],
            "retry_safe": True,
            "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
        }

    # Rule 2 — never dispatched: no acknowledgement possible.
    if transport == TRANSPORT_CLASSES["not_dispatched"]:
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["ACKNOWLEDGEMENT_MISSING"],
            "retry_safe": True,
            "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
        }

    # Rule 3 — undecidable timeout: commit state unknown. Blind retry forbidden.
    if transport == TRANSPORT_CLASSES["timeout"] and commit == COMMIT_CLASSES["unknown"]:
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["WRITE_STATUS_UNKNOWN"],
            "retry_safe": False,
            "evidence_completeness": EVIDENCE_COMPLETENESS["PARTIAL"],
        }

    # Rule 4 — transport failed and nothing committed (decidable).
    if transport in (
        TRANSPORT_CLASSES["network_error"],
        TRANSPORT_CLASSES["timeout"],
    ) and commit in (
        COMMIT_CLASSES["rolled_back"],
        COMMIT_CLASSES["not_reached"],
    ):
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["TRANSPORT_FAILED"],
            "retry_safe": True,
            "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
        }

    # Rule 5 — network error with undecidable commit state. Blind retry forbidden.
    if transport == TRANSPORT_CLASSES["network_error"] and commit == COMMIT_CLASSES["unknown"]:
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["WRITE_STATUS_UNKNOWN"],
            "retry_safe": False,
            "evidence_completeness": EVIDENCE_COMPLETENESS["PARTIAL"],
        }

    # Rule 6 — transport ok but commit state unknown. Blind retry forbidden.
    if commit == COMMIT_CLASSES["unknown"]:
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["WRITE_STATUS_UNKNOWN"],
            "retry_safe": False,
            "evidence_completeness": EVIDENCE_COMPLETENESS["PARTIAL"],
        }

    # Rule 7 — transaction did not commit (rolled back / not reached).
    if commit in (COMMIT_CLASSES["rolled_back"], COMMIT_CLASSES["not_reached"]):
        if upstream_status == UPSTREAM_STATUS_CLASSES["client_error_4xx"]:
            return {
                "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
                "outcome_code": OUTCOME_CODES["WRITE_REJECTED_VALIDATION"],
                "retry_safe": True,
                "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
            }
        return {
            "stage": WRITE_OUTCOME_STAGES["REQUEST_ACCEPTED"],
            "outcome_code": OUTCOME_CODES["ACKNOWLEDGEMENT_MISSING"],
            "retry_safe": True,
            "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
        }

    # Rule 8 — commit == 'committed'. Distinguish by RETURNING then reread.
    if returning == RETURNING_CLASSES["row_returned"]:
        if reread == REREAD_CLASSES["visible"]:
            return {
                "stage": (
                    WRITE_OUTCOME_STAGES["CLIENT_VISIBLE_SUCCESS"]
                    if client_visible
                    else WRITE_OUTCOME_STAGES["FOLLOWUP_REREAD_VISIBLE"]
                ),
                "outcome_code": OUTCOME_CODES["CONFIRMED"],
                "retry_safe": False,
                "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
            }
        if reread == REREAD_CLASSES["missing"]:
            return {
                "stage": WRITE_OUTCOME_STAGES["CANONICAL_ROW_RETURNED"],
                "outcome_code": OUTCOME_CODES["WRITE_COMMITTED_REREAD_MISSING"],
                "retry_safe": False,
                "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
            }
        if reread == REREAD_CLASSES["mismatch"]:
            return {
                "stage": WRITE_OUTCOME_STAGES["CANONICAL_ROW_RETURNED"],
                "outcome_code": OUTCOME_CODES["WRITE_COMMITTED_REREAD_MISMATCH"],
                "retry_safe": False,
                "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
            }
        # reread not_attempted / unknown: committed + canonical row returned,
        # follow-up reread not yet confirmed.
        return {
            "stage": WRITE_OUTCOME_STAGES["CANONICAL_ROW_RETURNED"],
            "outcome_code": OUTCOME_CODES["WRITE_COMMITTED_ROW_RETURNED"],
            "retry_safe": False,
            "evidence_completeness": EVIDENCE_COMPLETENESS["PARTIAL"],
        }

    if returning == RETURNING_CLASSES["no_row"]:
        return {
            "stage": WRITE_OUTCOME_STAGES["DB_TRANSACTION_COMMITTED"],
            "outcome_code": OUTCOME_CODES["ACKNOWLEDGED_REREAD_MISSING"],
            "retry_safe": False,
            "evidence_completeness": EVIDENCE_COMPLETENESS["COMPLETE"],
        }

    # committed but RETURNING evidence absent — insufficient returning evidence.
    return {
        "stage": WRITE_OUTCOME_STAGES["DB_TRANSACTION_COMMITTED"],
        "outcome_code": OUTCOME_CODES["INSUFFICIENT_EVIDENCE"],
        "retry_safe": False,
        "evidence_completeness": EVIDENCE_COMPLETENESS["PARTIAL"],
    }


def classify_write_outcome(facts: Any) -> Mapping[str, Any]:
    """Canonical bounded result builder.

    Raises TypeError with a single fixed ERROR_CODE on any invalid input.
    Returns an immutable, canonical result. The caller's input is never
    mutated.
    """
    ok, errors = validate_write_outcome_facts(facts)
    if not ok:
        raise TypeError(errors[0])

    normalized: dict[str, Any] = {
        "transport": facts["transport"],
        "commit": facts["commit"],
        "returning": facts["returning"],
        "reread": facts["reread"],
        "validation_rejected": facts.get("validation_rejected") is True,
        "upstream_status_class": facts.get("upstream_status_class") or "unknown",
        "client_visible": facts.get("client_visible") is True,
    }

    decision = _decide(normalized)
    return MappingProxyType(
        {
            "stage": decision["stage"],
            "outcome_code": decision["outcome_code"],
            "retry_safe": decision["retry_safe"],
            "evidence_completeness": decision["evidence_completeness"],
        }
    )


def is_canonical_result(value: Any) -> bool:
    """Only a fully bounded, immutable result passes."""
    if not isinstance(value, Mapping) or isinstance(value, type):
        return False
    if not isinstance(value, MappingProxyType):
        return False

    stage = value.get("stage")
    outcome_code = value.get("outcome_code")
    retry_safe = value.get("retry_safe")
    evidence = value.get("evidence_completeness")

    if stage not in WRITE_OUTCOME_STAGES.values():
        return False
    if outcome_code not in OUTCOME_CODES.values():
        return False
    if not isinstance(retry_safe, bool):
        return False
    if evidence not in EVIDENCE_COMPLETENESS.values():
        return False

    if len(value) != 4:
        return False
    for key in value:
        if key in PRIVATE_KEYS:
            return False

    # CONFIRMED is only ever emitted at or beyond a confirmed reread stage.
    if outcome_code == OUTCOME_CODES["CONFIRMED"] and stage not in (
        WRITE_OUTCOME_STAGES["FOLLOWUP_REREAD_VISIBLE"],
        WRITE_OUTCOME_STAGES["CLIENT_VISIBLE_SUCCESS"],
    ):
        return False

    # WRITE_STATUS_UNKNOWN must never be retry-safe (no blind retry).
    if outcome_code == OUTCOME_CODES["WRITE_STATUS_UNKNOWN"] and retry_safe is not False:
        return False

    return True
