from __future__ import annotations

import json
import os
import time
import urllib.request
from typing import Any

import firebase_admin
import jwt
from cryptography import x509
from firebase_admin import credentials, firestore
from fastapi import HTTPException

from modal_compute.config import get_firebase_project_id


class PlusRequiredError(Exception):
    pass


_firebase_cert_cache: dict[str, Any] = {"expires_at": 0, "certs": {}}
_firebase_admin_app: firebase_admin.App | None = None
_firestore_client: Any | None = None


def get_firebase_admin_app() -> firebase_admin.App:
    global _firebase_admin_app
    if _firebase_admin_app is not None:
        return _firebase_admin_app

    raw_service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw_service_account:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured")

    service_account_info = json.loads(raw_service_account)
    project_id = service_account_info.get("project_id")
    if project_id != get_firebase_project_id():
        raise RuntimeError("Firebase Admin project_id mismatch")

    _firebase_admin_app = firebase_admin.initialize_app(
        credentials.Certificate(service_account_info),
        name="lovebud-modal-admin",
    )
    return _firebase_admin_app


def get_firestore_client() -> Any:
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.client(app=get_firebase_admin_app())
    return _firestore_client


def is_entitlement_truthy(value: Any) -> bool:
    if value is True:
        return True
    if isinstance(value, int) and value == 1:
        return True
    if isinstance(value, str) and value.strip().lower() in {"true", "1"}:
        return True
    return False


def user_has_plus_entitlement(uid: str) -> bool:
    try:
        snapshot = get_firestore_client().collection("users").document(uid).get()
        if not snapshot.exists:
            return False
        profile = snapshot.to_dict() or {}
    except Exception:
        return False

    if is_entitlement_truthy(profile.get("privateStorageEnabled")):
        return True
    if str(profile.get("plan") or "").strip().lower() in {"plus", "admin"}:
        return True
    if is_entitlement_truthy(profile.get("plus")):
        return True

    entitlements = profile.get("entitlements")
    if isinstance(entitlements, dict) and is_entitlement_truthy(entitlements.get("privateStorage")):
        return True

    return False


def require_plus_for_private_storage(uid: str, visibility: str) -> None:
    if visibility == "private" and not user_has_plus_entitlement(uid):
        raise PlusRequiredError()


def get_firebase_certs() -> dict[str, str]:
    now = time.time()
    if _firebase_cert_cache["expires_at"] > now and _firebase_cert_cache["certs"]:
        return _firebase_cert_cache["certs"]

    with urllib.request.urlopen(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
        timeout=5,
    ) as response:
        raw = response.read().decode("utf-8")
        cache_control = response.headers.get("cache-control", "")

        max_age = 300
        for part in cache_control.split(","):
            part = part.strip()
            if part.startswith("max-age="):
                try:
                    max_age = int(part.split("=", 1)[1])
                except ValueError:
                    max_age = 300

        certs = json.loads(raw)
        _firebase_cert_cache["certs"] = certs
        _firebase_cert_cache["expires_at"] = now + max_age
        return certs


def require_firebase_user(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        header = jwt.get_unverified_header(token)
        cert = get_firebase_certs().get(header.get("kid"))
        if not cert:
            raise HTTPException(status_code=401, detail="Invalid ID token")

        project_id = get_firebase_project_id()
        public_key = x509.load_pem_x509_certificate(cert.encode("utf-8")).public_key()
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid ID token") from error

    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid ID token")

    return {"uid": uid, "email": decoded.get("email") or "", "decoded": decoded}