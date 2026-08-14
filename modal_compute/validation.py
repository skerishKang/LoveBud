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


def _normalize_stored_visibility(value: Any) -> str | None:
    if value == "public":
        return "public"
    if value == "private":
        return "private"
    return None


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
        "visibility": _normalize_stored_visibility(row.get("visibility")),
        "channelId": row.get("channel_id") or None,
        "channelName": row.get("channel_name") or None,
        "channelUrl": row.get("channel_url") or None,
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
    }


def normalize_tree_row(
    row: dict[str, Any],
    memory_count: int | None = None,
    *,
    include_owner: bool = True,
    include_owner_metadata: bool = False,
    include_owner_social_counts: bool = False,
    _owner_like_available: bool = False,
    _owner_view_available: bool = False,
) -> dict[str, Any]:
    tree = {
        "id": str(row["id"]),
        "title": row.get("title") or "",
        "visibility": _normalize_stored_visibility(row.get("visibility")),
        "createdAt": _to_isoformat(row.get("created_at")),
        "updatedAt": _to_isoformat(row.get("updated_at")),
        "memoryCount": int(memory_count or 0),
    }

    if include_owner:
        tree["ownerId"] = str(row["owner_id"]) if row.get("owner_id") else None

    if include_owner_metadata:
        tree["groupName"] = normalize_group_name(row.get("group_name"))
        raw_keywords = row.get("keywords")
        if raw_keywords is None:
            tree["keywords"] = []
        else:
            tree["keywords"] = [str(kw) for kw in raw_keywords if kw]

    if include_owner_social_counts:
        if _owner_like_available:
            raw_like = row.get("like_count")
            like_val = int(raw_like) if raw_like is not None else 0
            if isinstance(like_val, int) and like_val >= 0:
                tree["likeCount"] = like_val
        if _owner_view_available:
            raw_view = row.get("view_count")
            view_val = int(raw_view) if raw_view is not None else 0
            if isinstance(view_val, int) and view_val >= 0:
                tree["viewCount"] = view_val

    return tree


def normalize_row(row: dict[str, Any], *, stage_override: str | None = None, include_like_count: bool = False) -> dict[str, Any]:
    """Normalize a combined DB row into a browse-friendly snapshot."""
    memory_count = row.get("memory_count", 0) or 0
    emotion_tags = parse_tags(row.get("all_tags"))

    raw_thumbnail = row.get("raw_thumbnail")
    raw_source_url = row.get("raw_source_url")
    representative_thumbnail = raw_thumbnail or raw_source_url or ""

    created_at = _to_isoformat(row.get("created_at"))
    updated_at = _to_isoformat(row.get("updated_at"))

    result = {
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
    if include_like_count:
        result["likeCount"] = row.get("like_count", 0) or 0
        # viewCount is included only when the DB row has a real value.
        # Missing key, None, or social-count source unavailable means we cannot
        # truthfully report a count — omit the field so the UI does not display
        # a synthetic "0" indistinguishable from a genuine persisted zero.
        vc = row.get("view_count")
        if vc is not None:
            result["viewCount"] = int(vc)
    return result


def validate_visibility(value: Any, default: str = "private") -> str:
    if value is None:
        return default
    if value not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="visibility: public, private")
    return value


def validate_explicit_visibility(value: Any) -> str:
    """Validate an explicitly-provided visibility value on UPDATE.

    #3936: an update that carries a visibility key must supply the literal
    string "public" or "private". None, empty/whitespace strings, numbers,
    booleans, lists, dicts or any other non-string value is rejected with
    HTTP 400 instead of silently falling back to a default.
    """
    if not isinstance(value, str) or value not in {"public", "private"}:
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


def validate_optional_memory_string(
    value: Any,
    field_name: str,
    max_length: int = 5000,
    *,
    allow_none: bool = True,
) -> str:
    """Strict optional string validation for memory create/update scalar fields (#3287).

    Unlike validate_optional_string, a non-string value is NOT coerced to "".
    That coercion previously let malformed input clear an existing stored field
    instead of being rejected. Here, non-string input raises a structured 400 so
    the caller can return before any DB mutation.

    - None -> "" (omitted/absent field; callers decide default or omission)
    - valid string -> trimmed, persisted
    - non-string (int/float/bool/list/dict/...) -> HTTPException 400 with
      code INVALID_MEMORY_SCALAR_TYPE
    - length overflow -> HTTPException 400 (compatible with prior behavior)
    """
    if value is None:
        if not allow_none:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_MEMORY_SCALAR_TYPE",
                    "field": field_name,
                    "expected": "string",
                },
            )
        return ""
    if not isinstance(value, str):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_MEMORY_SCALAR_TYPE",
                "field": field_name,
                "expected": "string",
            },
        )
    text = value.strip()
    if len(text) > max_length:
        raise HTTPException(status_code=400, detail=f"Field exceeds max {max_length}")
    return text


def normalize_group_name(raw: Any) -> str | None:
    """Normalize a groupName value: trim, empty→null, max 80 chars."""
    if raw is None:
        return None
    if not isinstance(raw, str):
        return None
    stripped = raw.strip()
    if not stripped:
        return None
    if len(stripped) > 80:
        raise HTTPException(status_code=400, detail="groupName exceeds max 80 characters")
    return stripped


def validate_tree_title(
    value: Any,
    *,
    field: str = "title",
    max_length: int = 200,
) -> str:
    """Strict Tree title validation (#3935).

    Unlike validate_optional_string, a non-string supplied value (number,
    boolean, array, object, ...) is NOT coerced to "" and must NOT silently
    default to the create-time "My LoveTree" fallback or clear an existing
    stored title. It raises a structured HTTP 400 before any DB mutation.

    - None (omitted or explicit null) -> "" (caller decides default/omission)
    - valid string -> trimmed, bound by max_length (overlength -> HTTP 400)
    - non-string -> HTTPException 400 INVALID_TREE_SCALAR_TYPE

    Explicit null is intentionally distinct from a malformed type: it follows
    the current contract (None -> "") and is decided/tested separately from
    malformed scalar types (#3935).
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_TREE_SCALAR_TYPE",
                "field": field,
                "expected": "string",
            },
        )
    text = value.strip()
    if len(text) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field} exceeds max {max_length} characters",
        )
    return text


def validate_tree_group_name(value: Any) -> str | None:
    """Strict Tree groupName validation (#3935).

    Unlike normalize_group_name, a non-string supplied value is NOT coerced to
    None (which would silently clear an existing stored group name). It raises a
    structured HTTP 400 before any DB mutation.

    - None (omitted or explicit null) -> None
    - valid string -> trimmed; empty/whitespace -> None; overlength(80) -> 400
    - non-string (number/boolean/array/object) -> HTTPException 400

    Explicit null is intentionally distinct from a malformed type: it follows
    the current contract (None -> None) and is decided/tested separately from
    malformed scalar types (#3935).
    """
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_TREE_SCALAR_TYPE",
                "field": "groupName",
                "expected": "string",
            },
        )
    stripped = value.strip()
    if not stripped:
        return None
    if len(stripped) > 80:
        raise HTTPException(status_code=400, detail="groupName exceeds max 80 characters")
    return stripped


def normalize_keywords(raw: Any) -> list[str]:
    """
    Normalize a keywords value:
    - Must be an array (if not, 400 error)
    - Each item trim, empty removed
    - Order-preserving deduplication
    - Max 5 items, each max 24 chars
    - DB default [] if empty
    - No '#' auto-add or forced prefix
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="keywords must be an array")

    seen = set()
    result: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            raise HTTPException(status_code=400, detail="each keyword must be a string")
        trimmed = item.strip()
        if not trimmed:
            continue
        if len(trimmed) > 24:
            raise HTTPException(
                status_code=400,
                detail=f"keyword '{trimmed[:20]}...' exceeds max 24 characters"
            )
        if trimmed not in seen:
            seen.add(trimmed)
            result.append(trimmed)

    if len(result) > 5:
        raise HTTPException(status_code=400, detail="keywords exceeds max 5")

    return result


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


def validate_required_id(value: Any, name: str) -> str:
    """Validate a required ID field. Accepts both UUID and non-UUID string IDs."""
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=f"{name} is required")
    return value.strip()


def validate_optional_id(value: Any, name: str) -> str | None:
    """Validate an optional ID field. Accepts both UUID and non-UUID string IDs."""
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=f"Invalid {name}")
    return value.strip()
