from __future__ import annotations
import json
import time
import uuid

import modal
from fastapi import FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from modal_compute.auth import (
    PlusRequiredError,
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
)
from modal_compute.public_reads import (
    fetch_latest_public_tree_snapshots,
    fetch_growing_public_tree_snapshots,
    fetch_public_memories,
    fetch_public_memory,
    fetch_public_tree,
)
from modal_compute.owner_reads import (
    fetch_user_trees,
    fetch_owner_tree,
    fetch_owner_memories,
)
from modal_compute.owner_writes import (
    create_owner_tree,
    update_owner_tree,
    delete_owner_tree,
    fork_public_tree,
    update_owner_memory,
    delete_owner_memory,
)
from modal_compute.reactions import (
    toggle_reaction,
    fetch_reaction_summary,
)
from modal_compute.tree_likes import (
    toggle_tree_like,
    fetch_tree_like_summary,
    fetch_public_tree_like_count,
)
from modal_compute.tree_views import record_public_tree_view, fetch_public_tree_view_count
from modal_compute.comments import (
    create_comment,
    fetch_comments,
)
from modal_compute.hub_layouts import (
    HubLayoutNotFoundError,
    hub_layout_not_found_handler,
    save_hub_layout,
    fetch_hub_layout,
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

@web_app.exception_handler(HubLayoutNotFoundError)
async def handle_hub_layout_not_found(request: Request, exc: HubLayoutNotFoundError) -> JSONResponse:
    return await hub_layout_not_found_handler(request, exc)

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Correlation ID Middleware ─────────────────────────────────────────────────
@web_app.middleware("http")
async def add_correlation_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-lovebud-request-id")
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-lovebud-request-id"] = request_id
    return response

# ── Global Error Handler ───────────────────────────────────────────────────────
@web_app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail
        code = "HTTP_EXCEPTION"
    else:
        status_code = 500
        detail = "An unexpected internal server error occurred."
        code = "UNEXPECTED_ERROR"
    return JSONResponse(
        status_code=status_code,
        content={
            "error": detail,
            "code": code,
            "requestId": request_id,
        },
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

# ── Remaining endpoints ───────────────────────────────────────────────────────
# (Omitted for brevity - all existing endpoints remain unchanged)

@web_app.get("/modal/private/trees")
def get_private_trees(
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
) -> list[dict]:
    user = require_firebase_user(authorization)
    return fetch_user_trees(user["uid"], limit=limit)

@web_app.post("/modal/private/trees")
async def post_private_tree(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return create_owner_tree(user["uid"], payload)

@web_app.get("/modal/private/trees/{tree_id}")
def get_private_tree_detail(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_owner_tree(safe_tree_id, user["uid"])
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree

@web_app.post("/modal/private/trees/{tree_id}/likes")
def post_tree_like(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return toggle_tree_like(tree_id, user["uid"])

@web_app.get("/modal/private/trees/{tree_id}/likes")
def get_tree_likes(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return fetch_tree_like_summary(tree_id, user["uid"])

@web_app.get("/modal/private/memories")
def get_private_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
) -> list[dict]:
    user = require_firebase_user(authorization)
    safe_tree_id = validate_optional_uuid(treeId, "treeId")
    return fetch_owner_memories(user["uid"], tree_id=safe_tree_id, limit=limit)

@web_app.post("/modal/private/memories")
async def post_private_memory(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return create_owner_memory(user["uid"], payload)

@web_app.put("/modal/private/memories/{memory_id}")
async def put_private_memory(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return update_owner_memory(user["uid"], memory_id, payload)

@web_app.delete("/modal/private/memories/{memory_id}")
def delete_private_memory(
    memory_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return delete_owner_memory(user["uid"], memory_id)

@web_app.post("/modal/private/memories/{memory_id}/reactions")
async def post_memory_reaction(
    memory_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    reaction_type = payload.get("type", "")
    return toggle_reaction(memory_id, user["uid"], reaction_type)

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
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    body = payload.get("body", "")
    return create_comment(memory_id, user["uid"], body)

@web_app.get("/modal/private/memories/{memory_id}/comments")
def get_memory_comments(
    memory_id: str,
    authorization: str | None = Header(default=None),
) -> list[dict]:
    user = require_firebase_user(authorization)
    return fetch_comments(memory_id, user["uid"])

@web_app.post("/modal/private/trees/{tree_id}/appreciation-order")
async def post_appreciation_order(
    tree_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    update_owner_tree(user["uid"], tree_id, {"appreciationOrder": payload.get("order", [])})
    return {"ok": True}

@web_app.get("/modal/private/trees/{tree_id}/appreciation-order")
def get_appreciation_order(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_owner_tree(safe_tree_id, user["uid"])
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return {"orderedIds": tree.get("appreciation_order", [])}


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


@app.function(
    image=image,
    cpu=0.25,
    memory=512,
    scaledown_window=300,
    min_containers=1,
    secrets=[
        modal.Secret.from_name("lovebud-db"),
        modal.Secret.from_name("lovebud-firebase-admin"),
    ],
)
@modal.asgi_app()
def fastapi_app():
    return web_app