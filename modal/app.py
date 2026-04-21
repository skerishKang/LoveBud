from __future__ import annotations

import os
import modal
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from services.browse_latest import fetch_latest_public_tree_snapshots


app = modal.App("lovebud-browse-snapshot")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.115.12",
        "psycopg[binary]==3.2.9",
    )
)

web_app = FastAPI(
    title="LoveBud Modal Compute Layer",
    version="1.0.0",
)


def _allowed_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://lovebud.netlify.app,https://lovebud.vercel.app",
    )
    return [v.strip() for v in raw.split(",") if v.strip()]


web_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@web_app.get("/modal/health")
def modal_health() -> dict[str, str]:
    return {"ok": "true"}


@web_app.get("/modal/browse/latest")
def get_latest_browse_snapshot(
    limit: int = Query(default=3, ge=1, le=3),
) -> list[dict]:
    return fetch_latest_public_tree_snapshots(limit=limit)


@app.function(
    image=image,
    cpu=1,
    memory=512,
    scaledown_window=60,
    min_containers=0,
)
@modal.asgi_app()
def fastapi_app():
    return web_app
