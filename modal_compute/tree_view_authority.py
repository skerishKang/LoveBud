"""Server-authoritative edge actor + signed assertion verification (Issue #3917).

This module is the trust boundary for anonymous public tree view counting. The
browser sends NO actor identity; the Cloudflare edge derives an anonymous actor
from trusted request context and forwards a FIXED, SIGNED assertion as headers.

Modal must verify the signature BEFORE:
  - any JSON/body parsing,
  - any DB connection,
  - record_public_tree_view(),
  - any count mutation.

Design invariants:
  - The actor identity is opaque: actor_key is an HMAC-SHA256 digest of
    `tree-view-actor-v1|<UTC day>|<CF-Connecting-IP>` under TREE_VIEW_AUTHORITY_SECRET.
    Modal never sees the raw IP and never trusts a client-supplied actorKey.
  - The signed assertion binds the countedWindow. Modal rejects any assertion
    whose countedWindow is not the current UTC day, so a valid old signed
    actorKey cannot be replayed into a future day's dedup bucket.
  - Only `anonymous` actor kind is accepted in this first slice. A forged
    `authenticated` actor kind is rejected (no authority upgrade).
  - treeId in the assertion must equal the route tree_id (treeId mismatch).
  - Signature comparison is constant-time.

No real secret is provisioned anywhere here. The secret name contract is
TREE_VIEW_AUTHORITY_SECRET (read from the environment at verification time).
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Any

ASSERTION_VERSION = "v1"
ACTOR_KIND_ANONYMOUS = "anonymous"
VIEW_SOURCE = "public_tree_detail"

ASSERTION_DOMAIN = "tree-view-assertion-v1"
ACTOR_DOMAIN = "tree-view-actor-v1"

SECRET_ENV = "TREE_VIEW_AUTHORITY_SECRET"

SIGNATURE_HEADER = "x-lovebud-tree-view-signature"
VERSION_HEADER = "x-lovebud-tree-view-version"
TREE_ID_HEADER = "x-lovebud-tree-view-tree-id"
ACTOR_KEY_HEADER = "x-lovebud-tree-view-actor-key"
ACTOR_KIND_HEADER = "x-lovebud-tree-view-actor-kind"
SOURCE_HEADER = "x-lovebud-tree-view-source"
COUNTED_WINDOW_HEADER = "x-lovebud-tree-view-counted-window"

# Header name allowlist for the assertion. Any other header is ignored so a
# caller cannot smuggle an alternate actor field via a different casing/name.
_ASSERTION_HEADERS = (
    VERSION_HEADER,
    TREE_ID_HEADER,
    ACTOR_KEY_HEADER,
    ACTOR_KIND_HEADER,
    SOURCE_HEADER,
    COUNTED_WINDOW_HEADER,
    SIGNATURE_HEADER,
)


class TreeViewAuthorityError(Exception):
    """Fail-closed authority rejection. Never carries the secret or raw IP."""

    status_code = 400
    code = "TREE_VIEW_AUTHORITY_INVALID"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _get_secret() -> str | None:
    secret = os.getenv(SECRET_ENV)
    if not secret:
        return None
    return secret


def current_utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _hmac_hex(secret: str, message: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def derive_edge_actor_key(secret: str, cf_connecting_ip: str, utc_day: str | None = None) -> str:
    """Re-derive the opaque edge actor key (used by tests/edge parity only)."""
    day = utc_day or current_utc_day()
    material = f"{ACTOR_DOMAIN}|{day}|{cf_connecting_ip}"
    return _hmac_hex(secret, material)


def canonical_assertion(
    tree_id: str,
    actor_key: str,
    actor_kind: str,
    source: str,
    counted_window: str,
) -> str:
    lines = [
        f"version={ASSERTION_VERSION}",
        f"treeId={tree_id}",
        f"actorKey={actor_key}",
        f"actorKind={actor_kind}",
        f"source={source}",
        f"countedWindow={counted_window}",
    ]
    return ASSERTION_DOMAIN + "\n" + "\n".join(lines)


def sign_assertion(
    secret: str,
    tree_id: str,
    actor_key: str,
    actor_kind: str,
    source: str,
    counted_window: str,
) -> str:
    return _hmac_hex(
        secret,
        canonical_assertion(tree_id, actor_key, actor_kind, source, counted_window),
    )


def _read_assertion(headers: Any) -> dict[str, str | None]:
    """Case-insensitively read the bounded assertion headers."""
    normalized: dict[str, str] = {}
    for name in _ASSERTION_HEADERS:
        value = headers.get(name)
        normalized[name] = value if value is not None else None
    # Starlette Headers.get accepts both cases; normalize explicitly.
    return normalized


def verify_tree_view_assertion(headers: Any, route_tree_id: str) -> dict[str, str]:
    """Verify the signed view assertion and return server-authoritative actor data.

    Raises TreeViewAuthorityError on any failure (missing field, unsupported
    value, window mismatch, treeId mismatch, or bad signature). Performs NO body
    parsing and NO DB access.

    Returned dict:
        {
            "actor_key": <opaque digest from the signed assertion>,
            "actor_kind": "anonymous",
            "source": VIEW_SOURCE,
            "counted_window": <current UTC day>,
        }
    """
    secret = _get_secret()
    if not secret:
        raise TreeViewAuthorityError("view authority unavailable")

    provided = _read_assertion(headers)
    version = provided[VERSION_HEADER]
    tree_id = provided[TREE_ID_HEADER]
    actor_key = provided[ACTOR_KEY_HEADER]
    actor_kind = provided[ACTOR_KIND_HEADER]
    source = provided[SOURCE_HEADER]
    counted_window = provided[COUNTED_WINDOW_HEADER]
    signature = provided[SIGNATURE_HEADER]

    if not all([version, tree_id, actor_key, actor_kind, source, counted_window, signature]):
        raise TreeViewAuthorityError("incomplete view assertion")

    if version != ASSERTION_VERSION:
        raise TreeViewAuthorityError("unsupported assertion version")

    if tree_id != route_tree_id:
        raise TreeViewAuthorityError("view assertion tree id mismatch")

    if actor_kind != ACTOR_KIND_ANONYMOUS:
        # No authenticated-view authority in this first slice. A forged
        # `authenticated` actor kind must be rejected, never upgraded.
        raise TreeViewAuthorityError("unsupported actor kind")

    if source != VIEW_SOURCE:
        raise TreeViewAuthorityError("unsupported view source")

    expected_window = current_utc_day()
    if counted_window != expected_window:
        # Bind the countedWindow: replaying a valid old signed actorKey tomorrow
        # must not insert into tomorrow's dedup bucket. A midnight race failing
        # closed is acceptable for this security slice.
        raise TreeViewAuthorityError("counted window not current")

    canonical = canonical_assertion(tree_id, actor_key, actor_kind, source, counted_window)
    expected_signature = _hmac_hex(secret, canonical)
    if not hmac.compare_digest(expected_signature, signature):
        raise TreeViewAuthorityError("invalid view assertion signature")

    return {
        "actor_key": actor_key,
        "actor_kind": ACTOR_KIND_ANONYMOUS,
        "source": source,
        "counted_window": counted_window,
    }
