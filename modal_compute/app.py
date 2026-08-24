from __future__ import annotations

import json
import time

import modal
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from modal_compute.auth import (
    EntitlementCheckUnavailableError,
    PlusRequiredError,
    require_authenticated_principal,
    require_firebase_user,
)
from modal_compute.config import _allowed_origins as _config_allowed_origins
from modal_compute.logging import RequestLogger
from modal_compute.api_response_helpers import parse_json_body
from modal_compute.validation import (
    validate_required_uuid,
    validate_optional_uuid,
    validate_required_id,
    validate_optional_id,
    normalize_memory_row,
)
from modal_compute.public_reads import (
    fetch_latest_public_tree_snapshots,
    fetch_growing_public_tree_snapshots,
    fetch_public_memories,
    fetch_public_memory,
    fetch_public_tree,
    require_public_memory_membership,
)
from modal_compute.comments import (
    create_comment,
    fetch_comments,
    fetch_public_comments,
    page_comments,
    soft_delete_own_comment,
)
from modal_compute.social_cursor import CommentCursorError
from modal_compute.owner_reads import (
    OwnerListCursorError,
    OwnerTreeListError,
    fetch_owner_memories,
    page_owner_memories,
    fetch_owner_tree,
    fetch_user_trees,
    page_user_trees,
)
from modal_compute.owner_writes import (
    create_owner_tree,
    create_owner_memory,
    update_owner_tree,
    delete_owner_tree,
    update_owner_memory,
    delete_owner_memory,
    fork_public_tree,
)
from modal_compute.write_validation import require_memory_owner
from modal_compute.appreciation_orders import (
    save_appreciation_order,
    fetch_appreciation_order,
)
from modal_compute.reactions import (
    toggle_reaction,
    fetch_reaction_summary,
    fetch_public_reaction_counts,
)
from modal_compute.tree_likes import (
    toggle_tree_like,
    fetch_tree_like_summary,
    fetch_public_tree_like_count,
)
from modal_compute.tree_comments import create_tree_comment, fetch_tree_comments
from modal_compute.tree_views import record_public_tree_view, fetch_public_tree_view_count
from modal_compute.tree_view_authority import (
    TreeViewAuthorityError,
    verify_tree_view_assertion,
)
from modal_compute.hub_layouts import (
    hub_layout_not_found_handler,
    HubLayoutNotFoundError,
    save_hub_layout,
    fetch_hub_layout,
)
from modal_compute.social_errors import SocialWriteError, SOCIAL_ERROR_CODES
from modal_compute.youtube_playlist_preview import (
    PlaylistPreviewError,
    fetch_playlist_items,
    fetch_playlist_metadata,
    normalize_playlist_preview,
    parse_playlist_source,
    resolve_provider_api_key,
)


def _allowed_origins() -> list[str]:
    return _config_allowed_origins()


app = modal.App("lovebud-browse-snapshot")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.12",
        "firebase-admin==6.5.0",
        "PyJWT[crypto]==2.10.1",
        "psycopg[binary,pool]==3.2.9",
    )
    .add_local_python_source("modal_compute")
)

web_app = FastAPI(
    title="LoveBud Modal Compute Layer",
    version="1.0.0",
)


@web_app.exception_handler(PlusRequiredError)
async def plus_required_exception_handler(request: Request, exc: PlusRequiredError) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "error": "Private storage requires Plus.",
            "code": "PLUS_REQUIRED_PRIVATE_STORAGE",
            "upgradeRequired": True,
        },
    )


@web_app.exception_handler(EntitlementCheckUnavailableError)
async def entitlement_check_unavailable_handler(
    request: Request, exc: EntitlementCheckUnavailableError
) -> JSONResponse:
    # Availability error only. Never echo the raw Firestore exception, UID,
    # email, project ID, credentials, document path, token, or endpoint.
    return JSONResponse(
        status_code=503,
        content={
            "error": "Entitlement check temporarily unavailable.",
            "code": "ENTITLEMENT_CHECK_UNAVAILABLE",
            "upgradeRequired": False,
        },
    )


@web_app.exception_handler(HubLayoutNotFoundError)
async def handle_hub_layout_not_found(request: Request, exc: HubLayoutNotFoundError) -> JSONResponse:
    return await hub_layout_not_found_handler(request, exc)


@web_app.exception_handler(SocialWriteError)
async def social_write_error_handler(request: Request, exc: SocialWriteError) -> JSONResponse:
    content: dict[str, object] = {"error": exc.message, "code": exc.code}
    headers: dict[str, str] = {}
    if exc.retry_after_ms is not None:
        content["retryAfterMs"] = exc.retry_after_ms
        headers["Retry-After"] = str(exc.retry_after_ms // 1000)
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=headers if headers else None,
    )


@web_app.exception_handler(PlaylistPreviewError)
async def playlist_preview_error_handler(request: Request, exc: PlaylistPreviewError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": {"code": exc.code, "message": exc.message}},
    )


web_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@web_app.get("/modal/health")
def modal_health() -> dict[str, bool]:
    return {"ok": True}


@web_app.get("/modal/browse/latest")
def get_latest_browse_snapshot(
    limit: int = Query(default=12, ge=1, le=60),
    sort: str = Query(default="latest"),
    x_lovebud_request_id: str | None = Header(default=None),
) -> list[dict]:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/browse/latest",
        method="GET",
    )
    try:
        safe_sort = sort if sort in {"latest", "popular", "likes", "views"} else "latest"
        result = fetch_latest_public_tree_snapshots(limit=limit, sort=safe_sort)
        logger.log_success(status_code=200)
        return result
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/browse/growing")
def get_growing_browse_snapshot(
    limit: int = Query(default=6, ge=3, le=12),
    x_lovebud_request_id: str | None = Header(default=None),
) -> list[dict]:
    handler_start = time.time()
    print("[LoveBudModal] [TIMING] /modal/browse/growing handler entry")
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/browse/growing",
        method="GET",
    )
    try:
        result = fetch_growing_public_tree_snapshots(limit=limit)
        serialize_start = time.time()
        serialized_data = json.dumps(result)
        serialize_duration = (time.time() - serialize_start) * 1000
        print(f"[LoveBudModal] [TIMING] Result serialization (json.dumps) took {serialize_duration:.2f}ms (size={len(serialized_data)} bytes)")
        logger.log_success(status_code=200)
        total_elapsed = (time.time() - handler_start) * 1000
        print(f"[LoveBudModal] [TIMING] /modal/browse/growing handler response return. Total elapsed: {total_elapsed:.2f}ms")
        return result
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/community/memories")
def get_public_community_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    x_lovebud_request_id: str | None = Header(default=None),
) -> list[dict]:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/community/memories",
        method="GET",
    )
    try:
        safe_tree_id = validate_optional_id(treeId, "treeId")
        result = fetch_public_memories(tree_id=safe_tree_id, limit=limit)
        logger.log_success(status_code=200)
        return result
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/memories/{memory_id}")
def get_public_memory_detail(
    memory_id: str,
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/memories/id",
        method="GET",
    )
    try:
        safe_memory_id = validate_required_id(memory_id, "memoryId")
        memory = fetch_public_memory(safe_memory_id)
        if not memory:
            logger.log_error(status_code=404, error_category="NOT_FOUND")
            raise HTTPException(status_code=404, detail="Memory not found")
        logger.log_success(status_code=200)
        return memory
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/trees/{tree_id}")
def get_public_tree_detail(
    tree_id: str,
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/trees/id",
        method="GET",
    )
    try:
        safe_tree_id = validate_required_id(tree_id, "treeId")
        tree = fetch_public_tree(safe_tree_id)
        if not tree:
            logger.log_error(status_code=404, error_category="NOT_FOUND")
            raise HTTPException(status_code=404, detail="Tree not found")
        tree["likeCount"] = fetch_public_tree_like_count(safe_tree_id)
        tree["viewCount"] = fetch_public_tree_view_count(safe_tree_id)
        logger.log_success(status_code=200)
        return tree
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.post("/modal/public/trees/{tree_id}/views")
async def post_public_tree_view(
    tree_id: str,
    request: Request,
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/public/trees/id/views",
        method="POST",
    )
    # Verify the signed edge assertion BEFORE any DB connection, body parsing, or
    # count mutation. Fail closed on any invalid/missing assertion (Issue #3917):
    # no JSON is parsed and no count occurs. The browser never supplies actor
    # identity; the edge-derived anonymous actor is the only authority.
    try:
        authority = verify_tree_view_assertion(request.headers, tree_id)
    except TreeViewAuthorityError as exc:
        logger.log_error(
            status_code=exc.status_code,
            error_category="TREE_VIEW_AUTHORITY_REJECTED",
            failure_phase="view-authority",
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.code)
    try:
        result = record_public_tree_view(
            tree_id,
            authority["actor_key"],
            authority["actor_kind"],
            authority["source"],
        )
        logger.log_success(status_code=200)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/private/trees")
def get_private_trees(
    pagination: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
    x_lovebud_request_id: str | None = Header(default=None),
) -> list[dict] | dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/private/trees",
        method="GET",
    )
    try:
        principal = require_authenticated_principal(authorization)
    except HTTPException as e:
        if e.status_code >= 500:
            logger.log_error(
                status_code=e.status_code,
                error_category="AUTH_DEPENDENCY_UNAVAILABLE",
                failure_phase="auth",
            )
        else:
            logger.log_error(
                status_code=e.status_code,
                error_category="AUTH_FAILED",
                failure_phase="auth",
            )
        raise
    try:
        if pagination == "cursor":
            try:
                items, next_cursor = page_user_trees(
                    principal["legacyOwnerId"], limit=limit, cursor=cursor
                )
            except OwnerListCursorError:
                raise HTTPException(status_code=400, detail="Invalid pagination cursor")
            logger.log_success(status_code=200)
            return {"items": items, "nextCursor": next_cursor}
        result = fetch_user_trees(principal["legacyOwnerId"], limit=limit)
        logger.log_success(status_code=200)
        return result
    except HTTPException:
        raise
    except OwnerTreeListError as e:
        logger.log_error(status_code=500, error_category=e.error_category, failure_phase=e.failure_phase)
        raise HTTPException(status_code=500, detail="Internal server error")
    except Exception:
        logger.log_error(status_code=500, error_category="OWNER_TREE_LIST_UNEXPECTED_FAILURE", failure_phase="unexpected")
        raise HTTPException(status_code=500, detail="Internal server error")


@web_app.post("/modal/private/trees")
async def post_private_tree(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return create_owner_tree(
        user["uid"],
        payload,
        owner_email=user.get("email") or "",
    )


@web_app.get("/modal/private/trees/{tree_id}")
def get_private_tree_detail(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_owner_tree(safe_tree_id, principal["legacyOwnerId"])
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@web_app.get("/modal/private/trees/{tree_id}/capability")
def get_private_tree_capability(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    try:
        user = require_firebase_user(authorization)
        safe_tree_id = validate_required_id(tree_id, "treeId")
        tree = fetch_owner_tree(safe_tree_id, user["uid"])
        return {"viewerCanEdit": tree is not None}
    except HTTPException as e:
        if e.status_code in {401, 403}:
            return {"viewerCanEdit": False}
        raise
    except Exception:
        return {"viewerCanEdit": False}



@web_app.post("/modal/private/trees/{tree_id}/fork")
def post_fork_tree(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fork_public_tree(user["uid"], tree_id)


@web_app.put("/modal/private/trees/{tree_id}")
async def put_private_tree(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    payload = await parse_json_body(request)
    return update_owner_tree(principal["legacyOwnerId"], tree_id, payload)


@web_app.delete("/modal/private/trees/{tree_id}")
def delete_private_tree(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    return delete_owner_tree(principal["legacyOwnerId"], tree_id)


@web_app.post("/modal/private/trees/{tree_id}/likes")
def post_tree_like(
    tree_id: str,
    authorization: str | None = Header(default=None),
    x_idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    user = require_firebase_user(authorization)
    return toggle_tree_like(tree_id, user["uid"], idempotency_key=x_idempotency_key)


@web_app.get("/modal/private/trees/{tree_id}/likes")
def get_tree_likes(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fetch_tree_like_summary(tree_id, user["uid"])


@web_app.post("/modal/private/trees/{tree_id}/comments")
async def post_tree_comment(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    body = payload.get("body") if isinstance(payload, dict) else None
    return create_tree_comment(tree_id, user["uid"], body, idempotency_key=x_idempotency_key)


@web_app.get("/modal/private/trees/{tree_id}/comments")
def get_tree_comments(
    tree_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/private/trees/id/comments",
        method="GET",
    )
    try:
        result = fetch_tree_comments(tree_id, limit=limit, cursor=cursor)
        logger.log_success(status_code=200)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/private/memories")
def get_private_memories(
    treeId: str | None = None,
    pagination: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
) -> list[dict] | dict:
    principal = require_authenticated_principal(authorization)
    safe_tree_id = validate_optional_uuid(treeId, "treeId")
    if pagination == "cursor":
        try:
            items, next_cursor = page_owner_memories(
                principal["legacyOwnerId"], safe_tree_id, limit=limit, cursor=cursor
            )
        except OwnerListCursorError:
            raise HTTPException(status_code=400, detail="Invalid pagination cursor")
        return {"items": items, "nextCursor": next_cursor}
    return fetch_owner_memories(
        principal["legacyOwnerId"], tree_id=safe_tree_id, limit=limit
    )


@web_app.post("/modal/private/memories")
async def post_private_memory(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    payload = await parse_json_body(request)
    return create_owner_memory(principal["legacyOwnerId"], payload)


@web_app.put("/modal/private/memories/{memory_id}")
async def put_private_memory(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    payload = await parse_json_body(request)
    return update_owner_memory(principal["legacyOwnerId"], memory_id, payload)


@web_app.delete("/modal/private/memories/{memory_id}")
def delete_private_memory(
    memory_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    principal = require_authenticated_principal(authorization)
    return delete_owner_memory(principal["legacyOwnerId"], memory_id)


@web_app.get("/modal/private/memories/{memory_id}")
def get_private_memory_detail(
    memory_id: str,
    authorization: str | None = Header(default=None),
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/private/memories/id",
        method="GET",
    )
    try:
        principal = require_authenticated_principal(authorization)
        safe_memory_id = validate_required_id(memory_id, "memoryId")
        memory = require_memory_owner(safe_memory_id, principal["legacyOwnerId"])
        logger.log_success(status_code=200)
        return normalize_memory_row(memory)
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.post("/modal/private/memories/{memory_id}/reactions")
async def post_memory_reaction(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    reaction_type = payload.get("type", "")
    return toggle_reaction(memory_id, user["uid"], reaction_type, idempotency_key=x_idempotency_key)


@web_app.get("/modal/private/memories/{memory_id}/reactions")
def get_memory_reactions(
    memory_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fetch_reaction_summary(memory_id, user["uid"])


@web_app.post("/modal/private/memories/{memory_id}/comments")
async def post_memory_comment(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    body = payload.get("body", "")
    return create_comment(memory_id, user["uid"], body, idempotency_key=x_idempotency_key)


@web_app.get("/modal/private/memories/{memory_id}/comments")
def get_memory_comments(
    memory_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    pagination: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> list[dict] | dict:
    user = require_firebase_user(authorization)
    if pagination != "cursor" and cursor is None:
        return fetch_comments(memory_id, user["uid"])
    try:
        items, next_c = page_comments(memory_id, user["uid"], limit=limit, cursor=cursor)
    except CommentCursorError:
        raise HTTPException(status_code=400, detail="Invalid pagination cursor")
    return {"comments": items, "nextCursor": next_c}


@web_app.delete("/modal/private/comments/{comment_id}")
def delete_own_comment(
    comment_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    safe_comment_id = validate_required_uuid(comment_id, "commentId")
    return soft_delete_own_comment(safe_comment_id, user["uid"])


# ── Private appreciation-order and hub-layout routes ──────────────────────────

@web_app.post("/modal/private/trees/{tree_id}/appreciation-order")
async def post_appreciation_order(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return save_appreciation_order(tree_id, user["uid"], payload)


@web_app.get("/modal/private/trees/{tree_id}/appreciation-order")
def get_appreciation_order(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fetch_appreciation_order(tree_id, user["uid"])


@web_app.post("/modal/private/trees/{tree_id}/hub-layout")
async def post_hub_layout(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return save_hub_layout(tree_id, user["uid"], payload)


@web_app.get("/modal/private/trees/{tree_id}/hub-layout")
def get_hub_layout(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fetch_hub_layout(tree_id, user["uid"])


@web_app.post("/modal/private/import/youtube/playlist/preview")
async def post_youtube_playlist_preview(
    request: Request,
    authorization: str | None = Header(default=None),
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    """Authenticated read-only public YouTube playlist preview (first slice).

    Verified auth (`require_firebase_user`) MUST succeed before any provider
    call. Header presence alone is never authentication. The provider key is
    resolved only after a verified principal exists, so every auth failure
    (missing / malformed / invalid / expired token, verifier unavailable)
    keeps the provider call count at 0.
    """
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/private/import/youtube/playlist/preview",
        method="POST",
    )
    try:
        try:
            user = require_firebase_user(authorization)
        except HTTPException as error:
            # Preserve the sanitized auth dependency taxonomy: #3972 raises
            # HTTPException(503) when the trusted Firebase cert dependency is
            # unavailable. Never collapse that 503 back to 401 and never
            # surface the raw auth detail (network/cert internals) verbatim.
            if error.status_code >= 500:
                raise PlaylistPreviewError(
                    "UNAUTHORIZED",
                    "Authentication service is temporarily unavailable.",
                    status_code=503,
                ) from error
            raise PlaylistPreviewError(
                "UNAUTHORIZED", "Authentication is required.", status_code=401
            ) from error
        except RuntimeError as error:
            # Legacy fail-closed fallback (verifier dependency unavailable):
            # provider key resolution and provider calls stay 0.
            raise PlaylistPreviewError(
                "UNAUTHORIZED",
                "Authentication service is temporarily unavailable.",
                status_code=503,
            ) from error

        payload = await parse_json_body(request)

        source_field = payload.get("source")
        playlist_id_field = payload.get("playlistId")
        if (source_field is not None) == (playlist_id_field is not None):
            raise PlaylistPreviewError(
                "INVALID_PLAYLIST_SOURCE",
                "Provide exactly one of source or playlistId.",
            )

        source = playlist_id_field if playlist_id_field is not None else source_field
        playlist_id = parse_playlist_source(source)

        api_key = resolve_provider_api_key()
        metadata = fetch_playlist_metadata(playlist_id, api_key)
        items_result = fetch_playlist_items(playlist_id, api_key)
        result = normalize_playlist_preview(metadata, items_result)

        logger.log_success(status_code=200)
        return result
    except HTTPException as error:
        # parse_json_body failures become bounded source errors.
        raise PlaylistPreviewError(
            "INVALID_PLAYLIST_SOURCE",
            str(getattr(error, "detail", None) or "Request body is invalid."),
            status_code=error.status_code,
        ) from error
    except PlaylistPreviewError:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise PlaylistPreviewError(
            "INTERNAL_PREVIEW_ERROR",
            "Preview could not be completed.",
            status_code=500,
        ) from None


# ── Public (guest-safe) moment social read endpoints ──────────────────────────

@web_app.get("/modal/public/trees/{tree_id}/memories/{memory_id}/reactions")
def get_public_memory_reactions(
    tree_id: str,
    memory_id: str,
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/public/trees/id/memories/id/reactions",
        method="GET",
    )
    try:
        safe_tree_id = validate_required_id(tree_id, "treeId")
        safe_memory_id = validate_required_id(memory_id, "memoryId")
        require_public_memory_membership(safe_tree_id, safe_memory_id)
        result = fetch_public_reaction_counts(safe_memory_id)
        logger.log_success(status_code=200)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/public/trees/{tree_id}/memories/{memory_id}/comments")
def get_public_memory_comments(
    tree_id: str,
    memory_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    x_lovebud_request_id: str | None = Header(default=None),
) -> dict:
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/public/trees/id/memories/id/comments",
        method="GET",
    )
    try:
        safe_tree_id = validate_required_id(tree_id, "treeId")
        safe_memory_id = validate_required_id(memory_id, "memoryId")
        require_public_memory_membership(safe_tree_id, safe_memory_id)
        result = fetch_public_comments(safe_memory_id, limit=limit, cursor=cursor)
        logger.log_success(status_code=200)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@app.function(
    image=image,
    cpu=0.25,
    memory=512,
    scaledown_window=300,
    min_containers=1,
    secrets=[
        modal.Secret.from_name("lovebud-db"),
        modal.Secret.from_name("lovebud-firebase-admin"),
        modal.Secret.from_name("lovebud-youtube-data-api"),
    ],
)
@modal.asgi_app()
def fastapi_app():
    return web_app
