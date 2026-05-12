from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

import modal
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from modal_compute.auth import (
    PlusRequiredError,
    get_firebase_certs,
    require_firebase_user,
    require_plus_for_private_storage,
)
from modal_compute.config import _allowed_origins as _config_allowed_origins
from modal_compute.db import (
    get_db_connection,
    run_db_with_retry,
)
from modal_compute.logging import RequestLogger, log_request_event
from modal_compute.api_response_helpers import (
    add_request_id_to_response,
    parse_json_body,
)
from modal_compute.validation import (
    _to_isoformat,
    estimate_stage,
    parse_tags,
    normalize_tags,
    normalize_memory_row,
    normalize_tree_row,
    normalize_row,
    validate_visibility,
    validate_optional_string,
    validate_required_uuid,
    validate_optional_uuid,
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
    create_owner_memory,
    fetch_tree_for_owner_check,
    require_tree_owner,
    fetch_memory_for_owner_check,
    require_memory_owner,
    update_owner_tree,
    delete_owner_tree,
    update_owner_memory,
    delete_owner_memory,
    fork_public_tree,
)


def _allowed_origins() -> list[str]:
    return _config_allowed_origins()


# --- Modal App Setup ---

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
        safe_sort = sort if sort in {"latest", "popular"} else "latest"
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
    logger = RequestLogger(
        request_id=x_lovebud_request_id,
        route="/modal/browse/growing",
        method="GET",
    )
    try:
        result = fetch_growing_public_tree_snapshots(limit=limit)
        logger.log_success(status_code=200)
        return result
    except Exception:
        logger.log_error(status_code=500, error_category="UNEXPECTED_ERROR")
        raise


@web_app.get("/modal/community/memories")
def get_public_community_memories(
    treeId: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[dict]:
    safe_tree_id = validate_optional_uuid(treeId, "treeId")
    return fetch_public_memories(tree_id=safe_tree_id, limit=limit)


@web_app.get("/modal/memories/{memory_id}")
def get_public_memory_detail(memory_id: str) -> dict:
    safe_memory_id = validate_required_uuid(memory_id, "memoryId")
    memory = fetch_public_memory(safe_memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@web_app.get("/modal/trees/{tree_id}")
def get_public_tree_detail(tree_id: str) -> dict:
    safe_tree_id = validate_required_uuid(tree_id, "treeId")
    tree = fetch_public_tree(safe_tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


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
    user = require_firebase_user(authorization)
    payload = await parse_json_body(request)
    return update_owner_tree(user["uid"], tree_id, payload)


@web_app.delete("/modal/private/trees/{tree_id}")
def delete_private_tree(
    tree_id: str,
    authorization: str | None = Header(default=None),
) -> dict:
    user = require_firebase_user(authorization)
    return delete_owner_tree(user["uid"], tree_id)


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
