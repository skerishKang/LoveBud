import ast
import json
from pathlib import Path
import time
from unittest.mock import patch

from fastapi import HTTPException

import modal_compute.auth as auth


APP_PATH = Path(__file__).resolve().parents[2] / "modal_compute" / "app.py"


class FakeResponse:
    def __init__(self, body, cache_control="max-age=60"):
        self._body = body
        self.headers = {"cache-control": cache_control}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class FakeJwt:
    def __init__(self, *, header=None, decoded=None, header_error=None, decode_error=None):
        self.header = header or {"kid": "kid-1"}
        self.decoded = decoded or {"uid": "user-1", "email": "u@example.invalid"}
        self.header_error = header_error
        self.decode_error = decode_error

    def get_unverified_header(self, _token):
        if self.header_error:
            raise self.header_error
        return self.header

    def decode(self, *_args, **_kwargs):
        if self.decode_error:
            raise self.decode_error
        return self.decoded


class FakeCert:
    def public_key(self):
        return object()


class FakeX509:
    def load_pem_x509_certificate(self, value):
        assert value == b"CERT"
        return FakeCert()


def reset_cache(certs=None, expires_at=0):
    auth._firebase_cert_cache["certs"] = certs or {}
    auth._firebase_cert_cache["expires_at"] = expires_at


def expect_http(fn, status, detail):
    try:
        fn()
    except HTTPException as exc:
        assert exc.status_code == status, exc
        assert exc.detail == detail, exc
        return
    raise AssertionError("expected HTTPException")


def _load_private_tree_list_handler():
    source = APP_PATH.read_text(encoding="utf-8")
    module = ast.parse(source, filename=str(APP_PATH))
    function = next(
        node
        for node in module.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "get_private_trees"
    )
    function.decorator_list = []

    class StubOwnerTreeListError(Exception):
        error_category = "STUB"
        failure_phase = "query"

    namespace = {
        "Query": lambda **kwargs: kwargs.get("default"),
        "Header": lambda **kwargs: kwargs.get("default"),
        "HTTPException": HTTPException,
        "RequestLogger": object,
        "require_firebase_user": lambda _authorization: {"uid": "unused"},
        "fetch_user_trees": lambda _uid, limit=100: [],
        "OwnerTreeListError": StubOwnerTreeListError,
    }
    ast.fix_missing_locations(function)
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(APP_PATH), "exec"), namespace)
    return namespace["get_private_trees"], namespace


def _run_private_tree_auth_failure(status_code):
    logs = []

    class FakeLogger:
        def __init__(self, **_kwargs):
            pass

        def log_error(self, **kwargs):
            logs.append(kwargs)

        def log_success(self, **_kwargs):
            raise AssertionError("auth failure must not log success")

    def fail_auth(_authorization):
        raise HTTPException(status_code=status_code, detail="synthetic auth failure")

    def forbidden_fetch(*_args, **_kwargs):
        raise AssertionError("owner Tree query must not run after auth failure")

    handler, namespace = _load_private_tree_list_handler()
    namespace["RequestLogger"] = FakeLogger
    namespace["require_firebase_user"] = fail_auth
    namespace["fetch_user_trees"] = forbidden_fetch

    try:
        handler(
            limit=100,
            authorization="Bearer synthetic-token",
            x_lovebud_request_id="req-3945",
        )
    except HTTPException as exc:
        assert exc.status_code == status_code
    else:
        raise AssertionError("auth HTTPException must be preserved")

    return logs


def test_fresh_cache_avoids_network():
    reset_cache({"kid-1": "CERT"}, time.time() + 60)
    with patch.object(auth.urllib.request, "urlopen", side_effect=AssertionError("network must not run")):
        assert auth.get_firebase_certs() == {"kid-1": "CERT"}


def test_expired_cache_network_failure_is_sanitized_503():
    reset_cache({"stale": "STALE"}, 0)
    with patch.object(auth, "_get_jwt_module", return_value=FakeJwt()), \
         patch.object(auth, "_get_cryptography_x509", return_value=FakeX509()), \
         patch.object(auth.urllib.request, "urlopen", side_effect=TimeoutError("secret upstream detail")):
        expect_http(
            lambda: auth.require_firebase_user("Bearer token-value"),
            503,
            "Authentication service temporarily unavailable",
        )


def test_invalid_json_and_non_map_are_unavailable():
    for payload in [b"not-json", b"[]", b"{}", json.dumps({"kid-1": 123}).encode()]:
        reset_cache()
        with patch.object(auth.urllib.request, "urlopen", return_value=FakeResponse(payload)):
            try:
                auth.get_firebase_certs()
            except auth.FirebaseCertFetchUnavailableError as exc:
                assert str(exc) == ""
            else:
                raise AssertionError(f"payload should fail: {payload!r}")


def test_successful_refresh_then_valid_token_succeeds():
    reset_cache()
    payload = json.dumps({"kid-1": "CERT"}).encode()
    with patch.object(auth, "_get_jwt_module", return_value=FakeJwt()), \
         patch.object(auth, "_get_cryptography_x509", return_value=FakeX509()), \
         patch.object(auth.urllib.request, "urlopen", return_value=FakeResponse(payload)):
        result = auth.require_firebase_user("Bearer token-value")
        assert result["uid"] == "user-1"


def test_unknown_kid_after_successful_map_is_401():
    reset_cache({"kid-1": "CERT"}, time.time() + 60)
    with patch.object(auth, "_get_jwt_module", return_value=FakeJwt(header={"kid": "unknown"})), \
         patch.object(auth, "_get_cryptography_x509", return_value=FakeX509()):
        expect_http(lambda: auth.require_firebase_user("Bearer token-value"), 401, "Invalid ID token")


def test_header_and_verification_failures_remain_401():
    reset_cache({"kid-1": "CERT"}, time.time() + 60)
    with patch.object(auth, "_get_jwt_module", return_value=FakeJwt(header_error=ValueError("bad header"))), \
         patch.object(auth, "_get_cryptography_x509", return_value=FakeX509()):
        expect_http(lambda: auth.require_firebase_user("Bearer token-value"), 401, "Invalid ID token")

    for error in [ValueError("bad signature"), RuntimeError("expired"), Exception("audience")]:
        with patch.object(auth, "_get_jwt_module", return_value=FakeJwt(decode_error=error)), \
             patch.object(auth, "_get_cryptography_x509", return_value=FakeX509()):
            expect_http(lambda: auth.require_firebase_user("Bearer token-value"), 401, "Invalid ID token")


def test_private_tree_list_logs_auth_dependency_503_without_user_fault_taxonomy():
    logs = _run_private_tree_auth_failure(503)
    assert logs == [
        {
            "status_code": 503,
            "error_category": "AUTH_DEPENDENCY_UNAVAILABLE",
            "failure_phase": "auth",
        }
    ]


def test_private_tree_list_keeps_invalid_token_401_taxonomy():
    logs = _run_private_tree_auth_failure(401)
    assert logs == [
        {
            "status_code": 401,
            "error_category": "AUTH_FAILED",
            "failure_phase": "auth",
        }
    ]


def run():
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS #3945 focused auth verifier classification regression ({len(tests)} tests)")


if __name__ == "__main__":
    run()
