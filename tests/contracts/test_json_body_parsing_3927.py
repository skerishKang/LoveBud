#!/usr/bin/env python3
"""Executable regression tests for Issue #3927 JSON object-body enforcement."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from unittest.mock import patch

from fastapi import HTTPException

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.api_response_helpers import MAX_JSON_BODY_BYTES, parse_json_body


class MockHeaders:
    def __init__(self, values: dict[str, str] | None = None):
        self._values = {str(k).lower(): str(v) for k, v in (values or {}).items()}

    def get(self, key: str, default=None):
        return self._values.get(str(key).lower(), default)


class MockRequest:
    def __init__(
        self,
        body: bytes = b"",
        *,
        headers: dict[str, str] | None = None,
        chunks: list[bytes] | None = None,
    ):
        self.headers = MockHeaders(headers)
        self._body = body
        self._chunks = chunks

    async def stream(self):
        if self._chunks is not None:
            for chunk in self._chunks:
                yield chunk
            return
        if self._body:
            yield self._body


def run(coro):
    return asyncio.run(coro)


def expect_http_error(body: bytes, status: int, detail, *, headers=None, chunks=None):
    try:
        run(parse_json_body(MockRequest(body, headers=headers, chunks=chunks)))
    except HTTPException as exc:
        assert exc.status_code == status, (body, exc.status_code, exc.detail)
        assert exc.detail == detail, (body, exc.detail)
        return
    raise AssertionError(f"expected HTTP {status} for body {body!r}")


def test_parser_contract_matrix():
    assert run(parse_json_body(MockRequest(b""))) == {}
    assert run(parse_json_body(MockRequest(b"{}"))) == {}

    expected = {"title": "Tree", "visibility": "public"}
    assert run(parse_json_body(MockRequest(json.dumps(expected).encode("utf-8")))) == expected

    expect_http_error(b"{invalid", 400, "Invalid JSON body")

    for body in (b"null", b"[]", b'[1,2]', b'"text"', b"123", b"1.5", b"true", b"false"):
        expect_http_error(body, 400, {"code": "JSON_OBJECT_REQUIRED"})


def test_existing_128kib_bound_is_preserved():
    # Declared oversized body rejects before parsing.
    expect_http_error(
        b"{}",
        413,
        "Request body too large",
        headers={"content-length": str(MAX_JSON_BODY_BYTES + 1)},
    )

    # Actual streamed bytes remain authoritative when no Content-Length is supplied.
    expect_http_error(
        b"",
        413,
        "Request body too large",
        chunks=[b"x" * MAX_JSON_BODY_BYTES, b"x"],
    )


def _exercise_private_tree_route(body: bytes):
    """Call the real post_private_tree route with auth/writer seams only."""
    from modal_compute import app as app_module

    writer_calls: list[tuple[tuple, dict]] = []

    def fake_create_owner_tree(*args, **kwargs):
        writer_calls.append((args, kwargs))
        return {"ok": True}

    with patch.object(
        app_module,
        "require_firebase_user",
        return_value={"uid": "requester-3927", "email": ""},
    ):
        with patch.object(app_module, "create_owner_tree", side_effect=fake_create_owner_tree):
            try:
                result = run(
                    app_module.post_private_tree(
                        MockRequest(body),
                        authorization="Bearer executable-regression",
                    )
                )
                return result, None, writer_calls
            except HTTPException as exc:
                return None, exc, writer_calls


def test_private_tree_non_object_json_never_reaches_writer():
    for body in (b"[]", b"null", b'"text"', b"123", b"true", b"false"):
        result, error, writer_calls = _exercise_private_tree_route(body)
        assert result is None, (body, result)
        assert error is not None, body
        assert error.status_code == 400, (body, error.status_code, error.detail)
        assert error.detail == {"code": "JSON_OBJECT_REQUIRED"}, (body, error.detail)
        assert writer_calls == [], (body, writer_calls)


def test_private_tree_physical_empty_body_keeps_existing_default_payload_contract():
    result, error, writer_calls = _exercise_private_tree_route(b"")
    assert error is None, error
    assert result == {"ok": True}, result
    assert len(writer_calls) == 1, writer_calls

    args, kwargs = writer_calls[0]
    assert args == ("requester-3927", {}), args
    assert kwargs == {"owner_email": ""}, kwargs


def test_private_tree_valid_object_reaches_writer_unchanged():
    body = b'{"title":"Tree","visibility":"public"}'
    result, error, writer_calls = _exercise_private_tree_route(body)
    assert error is None, error
    assert result == {"ok": True}, result
    assert len(writer_calls) == 1, writer_calls

    args, kwargs = writer_calls[0]
    assert args == (
        "requester-3927",
        {"title": "Tree", "visibility": "public"},
    ), args
    assert kwargs == {"owner_email": ""}, kwargs


def test_all_current_parse_json_body_callers_are_object_shaped():
    """Current route inventory must not reveal a legitimate top-level-array caller."""
    import inspect
    from modal_compute import app as app_module

    source = inspect.getsource(app_module)
    caller_names = []
    for name, value in vars(app_module).items():
        if not callable(value):
            continue
        try:
            fn_source = inspect.getsource(value)
        except (OSError, TypeError):
            continue
        if "parse_json_body(request)" in fn_source:
            caller_names.append(name)

    assert caller_names, "expected parse_json_body callers in modal_compute.app"

    # Every current caller extracts named object fields or passes a mapping payload
    # to an object-shaped writer. No route consumes the payload as a top-level list.
    forbidden = (
        "for item in payload",
        "for value in payload",
        "payload[0]",
        "payload.append(",
    )
    for name in caller_names:
        fn_source = inspect.getsource(getattr(app_module, name))
        for pattern in forbidden:
            assert pattern not in fn_source, (name, pattern)

    assert "parse_json_body(request)" in source


def main():
    tests = [
        test_parser_contract_matrix,
        test_existing_128kib_bound_is_preserved,
        test_private_tree_non_object_json_never_reaches_writer,
        test_private_tree_physical_empty_body_keeps_existing_default_payload_contract,
        test_private_tree_valid_object_reaches_writer_unchanged,
        test_all_current_parse_json_body_callers_are_object_shaped,
    ]

    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS: {test.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL: {test.__name__}: {type(exc).__name__}: {exc}")

    if failed:
        raise SystemExit(1)
    print(f"PASS: {len(tests)}/{len(tests)}")


if __name__ == "__main__":
    main()
