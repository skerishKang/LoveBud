from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException


def _to_isoformat(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def estimate_stage(memory_count: int) -> str:
    """Matches netlify/functions/community-trees.js logic."""
    if memory_count <= 0:
        return "empty"
    if memory_count <= 2:
        return "입덕"
    if memory_count <= 4:
        return "성장"
    return "최애"


def parse_tags(all_tags_raw: list[Any] | None) -> list[str]:
    """Parse and flatten emotion tags from multiple memory rows."""
    if not all_tags_raw:
        return []

    unique_tags = set()
    for raw in all_tags_raw:
        if not raw:
            continue
        try:
            if isinstance(raw, (list, dict)):
                tags = raw
            else:
                tags = json.loads(raw)

            if isinstance(tags, list):
                for t in tags:
                    if t:
                        unique_tags.add(str(t))
        except (json.JSONDecodeError, TypeError):
            if isinstance(raw, str):
                unique_tags.add(raw)

    return sorted(list(unique_tags))[:5]


def normalize_tags(raw: Any) -> list[str]:
    """Normalize a single memory emotion_tags value."""
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(tag) for tag in raw if tag]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return [raw] if raw else []
        if isinstance(parsed, list):
            return [str(tag) for tag in parsed if tag]
        return []
    return []


def normalize_memory_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "treeId": str(row["tree_id"]) if row.get("tree_id") else None,
        "parentId": str(row["parent_id"]) if row.get("parent_id") else None,
        "title": row.get("title") or "",
        "memo": row.get("memo") or "",
        "artist": row.get("artist") or "",
        "source": row.get("source") or "",
        "sourceUrl": row.get("source_url") or "",
        "sourceType": row.get("source_type") or "youtube",
        "thumbnail": row.get("thumbnail") or "",
        "emotionTags": normalize_tags(row.get("emotion_tags")),
        "timestamp": row.get("timestamp") or "",
        "visibility": row.get("visibility") or "public",
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
    }


def normalize_tree_row(row: dict[str, Any], memory_count: int | None = None) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "ownerId": str(row["owner_id"]) if row.get("owner_id") else None,
        "title": row.get("title") or "",
        "visibility": row.get("visibility") or "public",
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
        "memoryCount": int(memory_count or 0),
    }


def normalize_row(row: dict[str, Any], *, stage_override: str | None = None) -> dict[str, Any]:
    """Normalize a combined DB row into a browse-friendly snapshot."""
    memory_count = row.get("memory_count", 0) or 0
    emotion_tags = parse_tags(row.get("all_tags"))

    raw_thumbnail = row.get("raw_thumbnail")
    raw_source_url = row.get("raw_source_url")
    representative_thumbnail = raw_thumbnail or raw_source_url or ""

    created_at = _to_isoformat(row.get("created_at"))
    updated_at = _to_isoformat(row.get("updated_at"))

    return {
        "id": str(row["id"]),
        "title": row.get("title") or "나의 Lovetree",
        "visibility": row.get("visibility") or "public",
        "createdAt": created_at,
        "updatedAt": updated_at,
        "representativeThumbnail": representative_thumbnail,
        "memoryCount": memory_count,
        "emotionTags": emotion_tags,
        "stage": stage_override or estimate_stage(memory_count),
        "theme": "LoveTree",
        "timeRange": "",
        "representativeMemorySourceUrl": raw_source_url or "",
    }


def validate_visibility(value: Any, default: str = "private") -> str:
    if value is None:
        return default
    if value not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="visibility: public, private")
    return value


def validate_optional_string(value: Any, max_length: int = 5000) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if len(text) > max_length:
        raise HTTPException(status_code=400, detail=f"Field exceeds max {max_length}")
    return text


def validate_required_uuid(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=f"{name} is required")
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid {name}") from error


def validate_optional_uuid(value: Any, name: str) -> str | None:
    if value is None or value == "":
        return None
    return validate_required_uuid(value, name)