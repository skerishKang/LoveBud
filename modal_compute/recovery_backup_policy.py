"""Pure, deterministic, provider-neutral recovery-backup policy helpers.

Scope boundary (#3828): this module is source-only and side-effect-free. It must
never import Modal, boto3, cryptography, psycopg, or any network/filesystem
library, and it must never read environment variables. All live operations live
in the scheduled Modal app module; this module only classifies sanitized run
outcomes into fixed enums and buckets.

No exact timestamp, object key, byte size, checksum, host, database URL, or
private identifier ever appears in a returned status.
"""

from __future__ import annotations

import base64
from typing import Any, Mapping

# --- fixed status states -------------------------------------------------
BACKUP_POINT_VALID = "BACKUP_POINT_VALID"
BACKUP_POINT_STALE = "BACKUP_POINT_STALE"
BACKUP_POINT_MISSING = "BACKUP_POINT_MISSING"
BACKUP_UPLOAD_INCOMPLETE = "BACKUP_UPLOAD_INCOMPLETE"
BACKUP_INTEGRITY_UNVERIFIED = "BACKUP_INTEGRITY_UNVERIFIED"
EXTERNAL_STORAGE_UNPROVISIONED = "EXTERNAL_STORAGE_UNPROVISIONED"
SECRET_BOUNDARY_UNPROVISIONED = "SECRET_BOUNDARY_UNPROVISIONED"

# --- Drive-specific sanitized states (#3894 / child #4137) ----------------
# Quota preflight + auth boundary states emitted by the Drive adapter. These are
# fixed sanitized states only; exact quota byte values never appear in logs or
# status.
DRIVE_STORAGE_WITHIN_LIMIT = "DRIVE_STORAGE_WITHIN_LIMIT"
DRIVE_STORAGE_NEAR_LIMIT = "DRIVE_STORAGE_NEAR_LIMIT"
DRIVE_STORAGE_EXHAUSTED = "DRIVE_STORAGE_EXHAUSTED"
DRIVE_AUTH_UNAVAILABLE = "DRIVE_AUTH_UNAVAILABLE"
DRIVE_UPLOAD_UNVERIFIED = "DRIVE_UPLOAD_UNVERIFIED"

# Internal hard ceiling: at least 10% provider quota remains reserved. The
# effective ceiling is floor(provider_storage_limit * INTERNAL_CEILING_RATIO).
INTERNAL_CEILING_RATIO = 0.90

ALL_DRIVE_QUOTA_STATES = frozenset(
    {
        DRIVE_STORAGE_WITHIN_LIMIT,
        DRIVE_STORAGE_NEAR_LIMIT,
        DRIVE_STORAGE_EXHAUSTED,
        DRIVE_AUTH_UNAVAILABLE,
    }
)

DAILY_TIER_VALID = "DAILY_TIER_VALID"
WEEKLY_TIER_VALID = "WEEKLY_TIER_VALID"
MONTHLY_TIER_VALID = "MONTHLY_TIER_VALID"
CLEANUP_COMPLETE = "CLEANUP_COMPLETE"
CLEANUP_FAILED = "CLEANUP_FAILED"

# Derived tier states (missing/stale/unknown) used inside sanitized statuses.
DAILY_TIER_STALE = "DAILY_TIER_STALE"
DAILY_TIER_MISSING = "DAILY_TIER_MISSING"
WEEKLY_TIER_STALE = "WEEKLY_TIER_STALE"
WEEKLY_TIER_MISSING = "WEEKLY_TIER_MISSING"
MONTHLY_TIER_STALE = "MONTHLY_TIER_STALE"
MONTHLY_TIER_MISSING = "MONTHLY_TIER_MISSING"
TIER_UNKNOWN = "TIER_UNKNOWN"

ALL_BACKUP_POINT_STATES = frozenset(
    {
        BACKUP_POINT_VALID,
        BACKUP_POINT_STALE,
        BACKUP_POINT_MISSING,
        BACKUP_UPLOAD_INCOMPLETE,
        BACKUP_INTEGRITY_UNVERIFIED,
    }
)

ALL_TIER_STATES = frozenset(
    {
        DAILY_TIER_VALID,
        DAILY_TIER_STALE,
        DAILY_TIER_MISSING,
        WEEKLY_TIER_VALID,
        WEEKLY_TIER_STALE,
        WEEKLY_TIER_MISSING,
        MONTHLY_TIER_VALID,
        MONTHLY_TIER_STALE,
        MONTHLY_TIER_MISSING,
        TIER_UNKNOWN,
    }
)

ALLOWED_AGE_BUCKETS = frozenset(
    {"LT_1H", "GE_1H_LT_24H", "GE_24H_LT_7D", "GE_7D", "NONE", "UNKNOWN"}
)

ALLOWED_PHASES = frozenset(
    {
        "dump",
        "encryption",
        "plaintext_cleanup",
        "upload",
        "head_verification",
        "daily_promotion",
        "weekly_promotion",
        "monthly_promotion",
        "cleanup",
        "secrets",
        "storage",
        None,
    }
)

# Fixed sanitized status keys. Any other key (timestamp, object key, checksum,
# size, host, database URL, nonce, tag, UUID, secret path, raw error) is
# rejected as private or raw.
ALLOWED_STATUS_KEYS = frozenset(
    {
        "backup_point_state",
        "daily_tier",
        "weekly_tier",
        "monthly_tier",
        "cleanup_state",
        "external_storage_state",
        "secret_boundary_state",
        "phase",
    }
)

PRIVATE_FIELD_MARKERS = (
    "timestamp",
    "time",
    "object_key",
    "key",
    "bucket",
    "endpoint",
    "host",
    "url",
    "database",
    "size",
    "bytes",
    "checksum",
    "digest",
    "hmac",
    "nonce",
    "tag",
    "uuid",
    "secret_path",
    "credential",
    "token",
    "raw",
    "error",
)

_REQUIRED_SUCCESS_STAGES = (
    "dump",
    "encryption",
    "plaintext_cleanup",
    "upload",
    "daily_promotion",
    "post_upload_verification",
)

_ALLOWED_STAGE_KEYS = frozenset(
    {
        "dump",
        "encryption",
        "plaintext_cleanup",
        "upload",
        "daily_promotion",
        "post_upload_verification",
        "weekly_promotion",
        "monthly_promotion",
    }
)

_MISSING_FOR = {
    WEEKLY_TIER_VALID: WEEKLY_TIER_MISSING,
    MONTHLY_TIER_VALID: MONTHLY_TIER_MISSING,
}

_STALE_FOR = {
    WEEKLY_TIER_VALID: WEEKLY_TIER_STALE,
    MONTHLY_TIER_VALID: MONTHLY_TIER_STALE,
}

# Deterministic UTC retention boundaries (no locale/timezone dependence).
WEEKLY_PROMOTION_WEEKDAY = 0  # Monday, UTC
MONTHLY_PROMOTION_DAY = 1  # first day of month, UTC


def decode_encryption_key(value: str) -> bytes:
    """Strict base64-encoded 32-byte key; fail closed on malformed input.

    Pure stdlib helper so the behavior contract can exercise key validation
    without importing cryptography or any provider library.
    """
    decoded = base64.b64decode(value, validate=True)
    if len(decoded) != 32:
        raise ValueError("invalid encryption key length")
    return decoded


def classify_drive_quota(
    *,
    usage_bytes: int | None,
    limit_bytes: int | None,
    artifact_size_bytes: int,
    ceiling_ratio: float = INTERNAL_CEILING_RATIO,
) -> str:
    """Pure fail-closed Drive quota preflight classifier (#3894 / child #4137).

    The total account usage (not only Drive-file usage) is used. The effective
    internal hard ceiling is ``floor(limit_bytes * ceiling_ratio)`` so at least
    ``(1 - ceiling_ratio)`` of provider quota remains reserved (>= 10%).

    Returns:
      DRIVE_STORAGE_WITHIN_LIMIT  -> current usage + artifact fits under the ceiling
      DRIVE_STORAGE_NEAR_LIMIT    -> fits, but within the reserved margin band
      DRIVE_STORAGE_EXHAUSTED     -> would exceed the ceiling OR quota is
                                     missing/unparseable/unbounded/inconsistent
                                     (fail closed: NO upload)

    Missing, unparseable, unbounded, or inconsistent quota responses always fail
    closed as EXHAUSTED. Exact byte values are never emitted here; the caller only
    sees the sanitized state.
    """
    if ceiling_ratio <= 0 or ceiling_ratio >= 1:
        raise ValueError("ceiling_ratio must be in (0, 1)")
    if not isinstance(artifact_size_bytes, int) or artifact_size_bytes < 0:
        return DRIVE_STORAGE_EXHAUSTED
    # Fail closed on missing or unparseable quota: both usage and limit required.
    if not isinstance(usage_bytes, int) or usage_bytes < 0:
        return DRIVE_STORAGE_EXHAUSTED
    if not isinstance(limit_bytes, int) or limit_bytes <= 0:
        return DRIVE_STORAGE_EXHAUSTED
    if usage_bytes > limit_bytes:
        # inconsistent provider response
        return DRIVE_STORAGE_EXHAUSTED
    internal_ceiling = int(limit_bytes * ceiling_ratio)
    if internal_ceiling <= 0:
        return DRIVE_STORAGE_EXHAUSTED
    projected = usage_bytes + artifact_size_bytes
    if projected > internal_ceiling:
        return DRIVE_STORAGE_EXHAUSTED
    # NEAR_LIMIT: usage already within the reserved margin band (>= ceiling).
    if usage_bytes >= internal_ceiling:
        return DRIVE_STORAGE_NEAR_LIMIT
    # Within the operational band but approaching the ceiling (>= 85% of ceiling)
    # still permits upload; classify as NEAR_LIMIT only when inside the reserved
    # margin (handled above). Otherwise the upload is safely WITHIN_LIMIT.
    near_band = int(internal_ceiling * 0.85)
    if projected >= near_band:
        return DRIVE_STORAGE_NEAR_LIMIT
    return DRIVE_STORAGE_WITHIN_LIMIT


def _require_bucket(age_bucket: str) -> None:
    if age_bucket not in ALLOWED_AGE_BUCKETS:
        raise ValueError("unknown age bucket: " + repr(age_bucket))


def classify_daily_freshness(age_bucket: str) -> str:
    """Classify the daily recovery point from a sanitized age bucket."""
    _require_bucket(age_bucket)
    if age_bucket in ("LT_1H", "GE_1H_LT_24H"):
        return DAILY_TIER_VALID
    if age_bucket in ("GE_24H_LT_7D", "GE_7D"):
        return DAILY_TIER_STALE
    if age_bucket == "NONE":
        return DAILY_TIER_MISSING
    return TIER_UNKNOWN


def classify_retained_tier(age_bucket: str, retained: bool, tier: str) -> str:
    """Classify a weekly/monthly retained tier from a bucket and a retention flag.

    `retained` is the deterministic input expressing whether the retained
    checkpoint satisfies the policy minimum (weekly >= 4 weeks, monthly >= 3
    months); it is never derived from a private provider value here.
    """
    if tier not in (WEEKLY_TIER_VALID, MONTHLY_TIER_VALID):
        raise ValueError("tier must be WEEKLY_TIER_VALID or MONTHLY_TIER_VALID")
    _require_bucket(age_bucket)
    if retained:
        if age_bucket in ("LT_1H", "GE_1H_LT_24H", "GE_24H_LT_7D", "GE_7D"):
            return tier
        if age_bucket == "NONE":
            return _MISSING_FOR[tier]
        return TIER_UNKNOWN
    return _MISSING_FOR[tier]


def decide_weekly_promotion(
    daily_fresh: bool,
    weekly_retained: bool,
    utc_weekday: int,
    weekly_boundary_weekday: int = WEEKLY_PROMOTION_WEEKDAY,
) -> bool:
    """Decide weekly promotion independently on a fixed UTC weekday boundary.

    Promotion happens only when the daily point is fresh, the weekly tier is not
    already retained, and the UTC weekday equals the fixed weekly boundary.
    """
    return bool(daily_fresh) and not bool(weekly_retained) and int(utc_weekday) == int(weekly_boundary_weekday)


def decide_monthly_promotion(
    daily_fresh: bool,
    monthly_retained: bool,
    utc_day: int,
    monthly_boundary_day: int = MONTHLY_PROMOTION_DAY,
) -> bool:
    """Decide monthly promotion independently on a fixed UTC day boundary.

    Promotion happens only when the daily point is fresh, the monthly tier is not
    already retained, and the UTC day equals the fixed monthly boundary.
    """
    return bool(daily_fresh) and not bool(monthly_retained) and int(utc_day) == int(monthly_boundary_day)


def reject_unknown_state(value: Any) -> None:
    """Reject a value that is not a known backup-point or tier state."""
    if value not in ALL_BACKUP_POINT_STATES and value not in ALL_TIER_STATES:
        raise ValueError("unknown state rejected: " + repr(value))


def validate_backup_point(stages: Mapping[str, bool]) -> str:
    """Return BACKUP_POINT_VALID only when every required stage succeeded.

    Mapping to failure states:
      dump/encryption/plaintext_cleanup/daily_promotion failure -> MISSING
      upload not complete                             -> UPLOAD_INCOMPLETE
      post-upload verification failure                -> INTEGRITY_UNVERIFIED
    """
    unknown = [k for k in stages if k not in _ALLOWED_STAGE_KEYS]
    if unknown:
        raise ValueError("unknown stage rejected: " + repr(unknown[0]))
    if stages.get("dump") is not True:
        return BACKUP_POINT_MISSING
    if stages.get("encryption") is not True:
        return BACKUP_POINT_MISSING
    if stages.get("plaintext_cleanup") is not True:
        return BACKUP_POINT_MISSING
    if stages.get("upload") is not True:
        return BACKUP_UPLOAD_INCOMPLETE
    if stages.get("post_upload_verification") is not True:
        return BACKUP_INTEGRITY_UNVERIFIED
    if stages.get("daily_promotion") is not True:
        return BACKUP_POINT_MISSING
    return BACKUP_POINT_VALID


def make_sanitized_status(**fields: Any) -> dict:
    """Build a sanitized status object containing only fixed enums and buckets.

    Unknown, private, or raw fields are rejected rather than silently dropped.
    """
    for key in fields:
        if key not in ALLOWED_STATUS_KEYS:
            marker = next((m for m in PRIVATE_FIELD_MARKERS if m in key.lower()), None)
            if marker:
                raise ValueError("RAW_FIELD_REJECTED: " + key)
            raise ValueError("UNKNOWN_FIELD_REJECTED: " + key)
    if "backup_point_state" in fields:
        reject_unknown_state(fields["backup_point_state"])
    for tier_key in ("daily_tier", "weekly_tier", "monthly_tier"):
        if tier_key in fields:
            reject_unknown_state(fields[tier_key])
    if "cleanup_state" in fields and fields["cleanup_state"] not in (
        CLEANUP_COMPLETE,
        CLEANUP_FAILED,
    ):
        raise ValueError("unknown cleanup state rejected: " + repr(fields["cleanup_state"]))
    if "external_storage_state" in fields and fields["external_storage_state"] not in (
        EXTERNAL_STORAGE_UNPROVISIONED,
    ):
        raise ValueError("unknown storage state rejected: " + repr(fields["external_storage_state"]))
    if "secret_boundary_state" in fields and fields["secret_boundary_state"] not in (
        SECRET_BOUNDARY_UNPROVISIONED,
    ):
        raise ValueError("unknown secret state rejected: " + repr(fields["secret_boundary_state"]))
    if "phase" in fields and fields["phase"] not in ALLOWED_PHASES:
        raise ValueError("unknown phase rejected: " + repr(fields["phase"]))
    return dict(fields)


def reject_impossible_partial(status: Mapping[str, Any]) -> None:
    """Reject status combinations that cannot occur in a real pipeline."""
    state = status.get("backup_point_state")
    daily = status.get("daily_tier")
    weekly = status.get("weekly_tier")
    monthly = status.get("monthly_tier")
    if state != BACKUP_POINT_VALID and daily == DAILY_TIER_VALID:
        raise ValueError("impossible partial rejected: daily valid without valid point")
    if state != BACKUP_POINT_VALID and weekly == WEEKLY_TIER_VALID:
        raise ValueError("impossible partial rejected: weekly valid without valid point")
    if state != BACKUP_POINT_VALID and monthly == MONTHLY_TIER_VALID:
        raise ValueError("impossible partial rejected: monthly valid without valid point")
    if daily != DAILY_TIER_VALID and weekly == WEEKLY_TIER_VALID:
        raise ValueError("impossible partial rejected: weekly valid without daily valid")
    if daily != DAILY_TIER_VALID and monthly == MONTHLY_TIER_VALID:
        raise ValueError("impossible partial rejected: monthly valid without daily valid")


def _build_status(
    *,
    state: str,
    daily_tier: str,
    weekly_tier: str,
    monthly_tier: str,
    cleanup_state: str,
    phase: str | None,
    include_provisioned_dimensions: bool,
) -> dict:
    status = make_sanitized_status(
        backup_point_state=state,
        daily_tier=daily_tier,
        weekly_tier=weekly_tier,
        monthly_tier=monthly_tier,
        cleanup_state=cleanup_state,
        phase=phase,
    )
    if include_provisioned_dimensions:
        status = make_sanitized_status(
            backup_point_state=status["backup_point_state"],
            daily_tier=status["daily_tier"],
            weekly_tier=status["weekly_tier"],
            monthly_tier=status["monthly_tier"],
            cleanup_state=status["cleanup_state"],
            external_storage_state=EXTERNAL_STORAGE_UNPROVISIONED,
            secret_boundary_state=SECRET_BOUNDARY_UNPROVISIONED,
            phase=status["phase"],
        )
    reject_impossible_partial(status)
    return status


def evaluate_run(
    *,
    dump_success: bool = False,
    encryption_success: bool = False,
    plaintext_cleanup_success: bool = False,
    upload_complete: bool = False,
    post_upload_verified: bool = False,
    daily_promotion_success: bool = False,
    weekly_promotion_decided: bool = False,
    weekly_promotion_success: bool = False,
    monthly_promotion_decided: bool = False,
    monthly_promotion_success: bool = False,
    cleanup_success: bool = True,
    weekly_retained: bool = False,
    monthly_retained: bool = False,
    existing_daily_bucket: str | None = None,
    daily_age_bucket: str = "GE_1H_LT_24H",
    include_provisioned_dimensions: bool = False,
) -> dict:
    """Deterministically evaluate a single backup run into a sanitized status.

    A valid daily point is preserved when an optional weekly/monthly promotion
    fails; only the affected retained tier is reported separately. The daily tier
    is never assumed fresh when the current run failed: it is MISSING unless an
    existing retained daily point is supplied through `existing_daily_bucket`.
    Every emitted status is validated against impossible partial combinations.
    """
    stages = {
        "dump": dump_success,
        "encryption": encryption_success,
        "plaintext_cleanup": plaintext_cleanup_success,
        "upload": upload_complete,
        "daily_promotion": daily_promotion_success,
        "post_upload_verification": post_upload_verified,
        "weekly_promotion": weekly_promotion_success,
        "monthly_promotion": monthly_promotion_success,
    }
    state = validate_backup_point(stages)
    phase = None
    if not dump_success:
        phase = "dump"
    elif not encryption_success:
        phase = "encryption"
    elif not plaintext_cleanup_success:
        phase = "plaintext_cleanup"
    elif not upload_complete:
        phase = "upload"
    elif not post_upload_verified:
        phase = "head_verification"
    elif not daily_promotion_success:
        phase = "daily_promotion"

    if state == BACKUP_POINT_VALID:
        daily_tier = DAILY_TIER_VALID
    elif existing_daily_bucket is not None:
        daily_tier = classify_daily_freshness(existing_daily_bucket)
    else:
        daily_tier = DAILY_TIER_MISSING

    weekly_tier = TIER_UNKNOWN
    monthly_tier = TIER_UNKNOWN
    if state == BACKUP_POINT_VALID:
        if weekly_promotion_decided:
            if weekly_promotion_success:
                weekly_tier = WEEKLY_TIER_VALID
            else:
                weekly_tier = WEEKLY_TIER_MISSING
                if phase is None:
                    phase = "weekly_promotion"
        elif weekly_retained:
            weekly_tier = classify_retained_tier(daily_age_bucket, True, WEEKLY_TIER_VALID)
        else:
            weekly_tier = WEEKLY_TIER_MISSING
        if monthly_promotion_decided:
            if monthly_promotion_success:
                monthly_tier = MONTHLY_TIER_VALID
            else:
                monthly_tier = MONTHLY_TIER_MISSING
                if phase is None:
                    phase = "monthly_promotion"
        elif monthly_retained:
            monthly_tier = classify_retained_tier(daily_age_bucket, True, MONTHLY_TIER_VALID)
        else:
            monthly_tier = MONTHLY_TIER_MISSING

    return _build_status(
        state=state,
        daily_tier=daily_tier,
        weekly_tier=weekly_tier,
        monthly_tier=monthly_tier,
        cleanup_state=CLEANUP_COMPLETE if cleanup_success else CLEANUP_FAILED,
        phase=phase,
        include_provisioned_dimensions=include_provisioned_dimensions,
    )


def preserve_daily_on_weekly_failure(daily_valid: bool, weekly_promotion_success: bool) -> dict:
    """Preserve a valid daily point when only the weekly promotion failed."""
    if not daily_valid:
        raise ValueError("impossible partial rejected: daily point not valid")
    status = make_sanitized_status(
        backup_point_state=BACKUP_POINT_VALID,
        daily_tier=DAILY_TIER_VALID,
        weekly_tier=WEEKLY_TIER_VALID if weekly_promotion_success else WEEKLY_TIER_MISSING,
        monthly_tier=TIER_UNKNOWN,
        phase=None if weekly_promotion_success else "weekly_promotion",
    )
    reject_impossible_partial(status)
    return status


def preserve_daily_on_monthly_failure(daily_valid: bool, monthly_promotion_success: bool) -> dict:
    """Preserve a valid daily point when only the monthly promotion failed."""
    if not daily_valid:
        raise ValueError("impossible partial rejected: daily point not valid")
    status = make_sanitized_status(
        backup_point_state=BACKUP_POINT_VALID,
        daily_tier=DAILY_TIER_VALID,
        weekly_tier=TIER_UNKNOWN,
        monthly_tier=MONTHLY_TIER_VALID if monthly_promotion_success else MONTHLY_TIER_MISSING,
        phase=None if monthly_promotion_success else "monthly_promotion",
    )
    reject_impossible_partial(status)
    return status
