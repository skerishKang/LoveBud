from __future__ import annotations

import os


def get_firebase_project_id() -> str:
    return os.getenv("FIREBASE_PROJECT_ID", "relovetree")


def _allowed_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://lovebud.vercel.app,https://lovebud.pages.dev,https://lovebud.netlify.app",
    )
    return [value.strip() for value in raw.split(",") if value.strip()]
