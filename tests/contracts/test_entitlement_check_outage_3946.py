from __future__ import annotations

import asyncio
import json
from unittest import mock

import modal_compute.auth as auth
from modal_compute.auth import (
    EntitlementCheckUnavailableError,
    PlusRequiredError,
    require_plus_for_private_storage,
    user_has_plus_entitlement,
)
from modal_compute.app import (
    entitlement_check_unavailable_handler,
    plus_required_exception_handler,
)


# ── Fake Firestore client shapes ──────────────────────────────────────────────

class FakeSnapshot:
    def __init__(self, exists: bool, data):
        self.exists = exists
        self._data = data

    def to_dict(self):
        return self._data


class _OkDoc:
    def __init__(self, snapshot):
        self._snapshot = snapshot

    def get(self):
        return self._snapshot


class _OkCollection:
    def __init__(self, snapshot):
        self._snapshot = snapshot

    def document(self, uid):
        return _OkDoc(self._snapshot)


class FakeClient:
    def __init__(self, snapshot):
        self._snapshot = snapshot

    def collection(self, name):
        return _OkCollection(self._snapshot)


class FakeSnapshotToDictError:
    def __init__(self, exists=True):
        self.exists = exists

    def to_dict(self):
        raise RuntimeError("snapshot materialization failed")


class FakeSnapshotExistsError:
    @property
    def exists(self):
        raise RuntimeError("snapshot exists check failed")

    def to_dict(self):
        return {}


class _RaiseOnGetDoc:
    def __init__(self, error):
        self._error = error

    def get(self):
        raise self._error


class _RaiseOnGetCollection:
    def __init__(self, error):
        self._error = error

    def document(self, uid):
        return _RaiseOnGetDoc(self._error)


class RaiseOnGetClient:
    def __init__(self, error):
        self._error = error

    def collection(self, name):
        return _RaiseOnGetCollection(self._error)


def _await(coro):
    return asyncio.run(coro)


# ── successful-read entitlement contract ──────────────────────────────────────

def test_missing_profile_returns_false():
    client = FakeClient(FakeSnapshot(exists=False, data=None))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-missing") is False


def test_free_profile_returns_false():
    client = FakeClient(FakeSnapshot(exists=True, data={}))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-free") is False


def test_empty_entitlements_returns_false():
    client = FakeClient(FakeSnapshot(exists=True, data={"plan": "free", "plus": False}))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-free2") is False


def test_plus_plan_returns_true():
    client = FakeClient(FakeSnapshot(exists=True, data={"plan": "plus"}))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-plus") is True


def test_admin_plan_returns_true():
    client = FakeClient(FakeSnapshot(exists=True, data={"plan": "admin"}))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-admin") is True


def test_private_storage_enabled_returns_true():
    client = FakeClient(FakeSnapshot(exists=True, data={"privateStorageEnabled": True}))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-priv") is True


def test_entitlements_private_storage_returns_true():
    client = FakeClient(
        FakeSnapshot(exists=True, data={"entitlements": {"privateStorage": True}})
    )
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        assert user_has_plus_entitlement("uid-ent") is True


# ── availability (outage) contract ────────────────────────────────────────────

def test_firestore_get_timeout_raises_availability_error():
    client = RaiseOnGetClient(TimeoutError("read deadline exceeded"))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        try:
            user_has_plus_entitlement("uid-outage")
        except EntitlementCheckUnavailableError:
            return
        except Exception as exc:  # pragma: no cover
            raise AssertionError(f"unexpected exception type: {type(exc).__name__}")
        raise AssertionError("expected EntitlementCheckUnavailableError")


def test_firestore_init_failure_raises_availability_error():
    def init_failure():
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured")

    with mock.patch.object(auth, "get_firestore_client", init_failure):
        try:
            user_has_plus_entitlement("uid-init")
        except EntitlementCheckUnavailableError:
            return
        except Exception as exc:  # pragma: no cover
            raise AssertionError(f"unexpected exception type: {type(exc).__name__}")
        raise AssertionError("expected EntitlementCheckUnavailableError")


def test_snapshot_to_dict_failure_raises_availability_error():
    client = FakeClient(FakeSnapshotToDictError(exists=True))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        try:
            user_has_plus_entitlement("uid-mat")
        except EntitlementCheckUnavailableError:
            return
        except RuntimeError as exc:
            raise AssertionError(f"raw RuntimeError leaked (not sanitized): {exc}")
        except Exception as exc:
            raise AssertionError(f"unexpected exception type: {type(exc).__name__}")
        raise AssertionError("expected EntitlementCheckUnavailableError")


def test_snapshot_exists_failure_raises_availability_error():
    client = FakeClient(FakeSnapshotExistsError())
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        try:
            user_has_plus_entitlement("uid-exists")
        except EntitlementCheckUnavailableError:
            return
        except RuntimeError as exc:
            raise AssertionError(f"raw RuntimeError leaked (not sanitized): {exc}")
        except Exception as exc:
            raise AssertionError(f"unexpected exception type: {type(exc).__name__}")
        raise AssertionError("expected EntitlementCheckUnavailableError")


def test_private_guard_propagates_availability_error_not_plus_required():
    client = RaiseOnGetClient(TimeoutError("rpc unavailable"))
    with mock.patch.object(auth, "get_firestore_client", lambda: client):
        try:
            require_plus_for_private_storage("uid-outage", "private")
        except EntitlementCheckUnavailableError:
            return
        except PlusRequiredError:
            raise AssertionError(
                "availability error must NOT be converted to PlusRequiredError"
            )
        except Exception as exc:  # pragma: no cover
            raise AssertionError(f"unexpected exception type: {type(exc).__name__}")
        raise AssertionError("expected EntitlementCheckUnavailableError")


def test_public_guard_skips_entitlement_lookup():
    calls = []

    def recording_getter():
        calls.append(1)
        return FakeClient(FakeSnapshot(exists=False, data=None))

    with mock.patch.object(auth, "get_firestore_client", recording_getter):
        # visibility != "private": the entitlement Firestore lookup must not run.
        require_plus_for_private_storage("uid-public", "public")
    assert calls == [], "public visibility must not trigger entitlement lookup"


# ── HTTP boundary contract ────────────────────────────────────────────────────

def test_plus_required_handler_is_403():
    resp = _await(plus_required_exception_handler(None, PlusRequiredError()))
    assert resp.status_code == 403
    body = json.loads(resp.body)
    assert body["code"] == "PLUS_REQUIRED_PRIVATE_STORAGE"
    assert body["upgradeRequired"] is True


def test_entitlement_unavailable_handler_is_503():
    resp = _await(
        entitlement_check_unavailable_handler(None, EntitlementCheckUnavailableError())
    )
    assert resp.status_code == 503
    body = json.loads(resp.body)
    assert body["code"] == "ENTITLEMENT_CHECK_UNAVAILABLE"
    assert body["upgradeRequired"] is False
    assert body["error"] == "Entitlement check temporarily unavailable."

    raw = resp.body.decode("utf-8").lower()
    # raw exception / private identifiers must never reach the client response
    for forbidden in (
        "entitlementcheckunavailableerror",
        "traceback",
        "firebase_service_account",
        "project_id",
        "credentials",
        "document(",
        "users/",
        "bearer ",
        "securetoken",
        "googleapis",
        "uid-",
        "token",
    ):
        assert forbidden not in raw, f"forbidden token leaked into response: {forbidden}"


def main():
    tests = [
        test_missing_profile_returns_false,
        test_free_profile_returns_false,
        test_empty_entitlements_returns_false,
        test_plus_plan_returns_true,
        test_admin_plan_returns_true,
        test_private_storage_enabled_returns_true,
        test_entitlements_private_storage_returns_true,
        test_firestore_get_timeout_raises_availability_error,
        test_firestore_init_failure_raises_availability_error,
        test_snapshot_to_dict_failure_raises_availability_error,
        test_snapshot_exists_failure_raises_availability_error,
        test_private_guard_propagates_availability_error_not_plus_required,
        test_public_guard_skips_entitlement_lookup,
        test_plus_required_handler_is_403,
        test_entitlement_unavailable_handler_is_503,
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
