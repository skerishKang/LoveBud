from __future__ import annotations

import time
from typing import Any


def log_request_event(
    request_id: str | None = None,
    route: str | None = None,
    method: str | None = None,
    status_code: int | None = None,
    error_category: str | None = None,
    duration_ms: float | None = None,
) -> None:
    """
    Log a redaction-safe request event.

    This function only logs metadata that is safe to expose:
    - request_id: The correlation ID from x-lovebud-request-id header
    - route: The endpoint pattern (e.g., "/modal/browse/latest")
    - method: HTTP method (GET, POST, etc.)
    - status_code: HTTP response status
    - error_category: Coarse error classification (AUTH_FAILED, VALIDATION_FAILED, etc.)
    - duration_ms: Request duration in milliseconds

    This function NEVER logs:
    - Authorization headers
    - Cookies
    - Session values
    - Access tokens
    - API keys
    - Firebase credentials
    - Raw request bodies
    - Private tree or memory content
    - OAuth callback/session material
    
    Refs #472
    """
    # Build redaction-safe log entry
    log_entry: dict[str, Any] = {}

    if request_id:
        log_entry["request_id"] = request_id
    if route:
        log_entry["route"] = route
    if method:
        log_entry["method"] = method
    if status_code is not None:
        log_entry["status_code"] = status_code
    if error_category:
        log_entry["error_category"] = error_category
    if duration_ms is not None:
        log_entry["duration_ms"] = duration_ms

    # Print to stdout (Modal captures this as structured logs)
    if log_entry:
        print(f"[LoveBudModal] {log_entry}")


class RequestLogger:
    """Context manager for timing and logging requests."""

    def __init__(
        self,
        request_id: str | None = None,
        route: str | None = None,
        method: str | None = None,
    ):
        self.request_id = request_id
        self.route = route
        self.method = method
        self.start_time = time.time()
    
    def log_success(self, status_code: int = 200) -> None:
        """Log a successful request."""
        duration_ms = (time.time() - self.start_time) * 1000
        log_request_event(
            request_id=self.request_id,
            route=self.route,
            method=self.method,
            status_code=status_code,
            duration_ms=duration_ms,
        )
    
    def log_error(
        self,
        status_code: int = 500,
        error_category: str = "UNEXPECTED_ERROR",
    ) -> None:
        """Log a failed request with error category."""
        duration_ms = (time.time() - self.start_time) * 1000
        log_request_event(
            request_id=self.request_id,
            route=self.route,
            method=self.method,
            status_code=status_code,
            error_category=error_category,
            duration_ms=duration_ms,
        )
