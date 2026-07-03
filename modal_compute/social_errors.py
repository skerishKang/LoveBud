from __future__ import annotations

from fastapi import HTTPException

SOCIAL_ERROR_CODES = frozenset({
    "IDEMPOTENCY_KEY_REQUIRED",
    "IDEMPOTENCY_KEY_INVALID",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
    "REACTION_TYPE_INVALID",
    "RATE_LIMITED",
    "RATE_LIMITED_MEMORY",
    "RATE_LIMIT_UNAVAILABLE",
    "SOCIAL_WRITE_UNAVAILABLE",
})


class SocialWriteError(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        retry_after_ms: int | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.retry_after_ms = retry_after_ms
        content: dict[str, object] = {"error": message, "code": code}
        headers: dict[str, str] = {}
        if retry_after_ms is not None:
            content["retryAfterMs"] = retry_after_ms
            headers["Retry-After"] = str(retry_after_ms // 1000)
        super().__init__(status_code=status_code, detail=content, headers=headers)
