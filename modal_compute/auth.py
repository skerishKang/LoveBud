from __future__ import annotations

import json
import os
import time
import urllib.request
from typing import Any

from fastapi import HTTPException

from modal_compute.config import get_firebase_project_id

# Lazy imports for modules installed in Modal container via pip_install()
# These are imported only when needed at runtime inside the Modal container
_jwt_module: Any = None
_cryptography_x509: Any = None
_firebase_admin: Any = None
_firestore_module: Any = None
_firebase_credentials: Any = None


def _get_jwt_module():
    """Lazy import PyJWT module at runtime inside Modal container."""
    global _jwt_module
    if _jwt_module is None:
        import jwt as jwt_mod
        _jwt_module = jwt_mod
    return _jwt_module


def _get_cryptography_x509():
    """Lazy import cryptography.x509 module at runtime inside Modal container."""
    global _cryptography_x509
    if _cryptography_x509 is None:
        from cryptography import x509 as x509_mod
        _cryptography_x509 = x509_mod
    return _cryptography_x509


class PlusRequiredError(Exception):
    pass


class FirebaseCertFetchUnavailableError(Exception):
    """Trusted Firebase signing-certificate metadata could not be refreshed."""


_firebase_cert_cache: dict[str, Any] = {"expires_at": 0, "certs": {}}
_firebase_admin_app: Any = None
_firestore_client: Any = None


def _get_firebase_admin_module():
    """Lazy import firebase_admin module at runtime inside Modal container."""
    global _firebase_admin
    if _firebase_admin is None:
        import firebase_admin as fa
        _firebase_admin = fa
    return _firebase_admin


def _get_firestore_module():
    """Lazy import firestore module at runtime inside Modal container."""
    global _firestore_module
    if _firestore_module is None:
        fa = _get_firebase_admin_module()
        _firestore_module = fa.firestore
    return _firestore_module


def _get_firebase_credentials():
    """Lazy import firebase_admin.credentials module at runtime inside Modal container."""
    global _firebase_credentials
    if _firebase_credentials is None:
        fa = _get_firebase_admin_module()
        _firebase_credentials = fa.credentials
    return _firebase_credentials


def get_firebase_admin_app() -> Any:
    global _firebase_admin_app
    if _firebase_admin_app is not None:
        return _firebase_admin_app

    firebase_admin = _get_firebase_admin_module()
    credentials = _get_firebase_credentials()

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
        firestore = _get_firestore_module()
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

    try:
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
            if not isinstance(certs, dict) or not certs or not all(
                isinstance(kid, str) and kid and isinstance(cert, str) and cert
                for kid, cert in certs.items()
            ):
                raise ValueError("Unusable Firebase certificate metadata")
    except Exception as error:
        raise FirebaseCertFetchUnavailableError() from error

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
        jwt = _get_jwt_module()
        x509_mod = _get_cryptography_x509()
        header = jwt.get_unverified_header(token)
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid ID token") from error

    try:
        certs = get_firebase_certs()
    except FirebaseCertFetchUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable",
        ) from error

    try:
        cert = certs.get(header.get("kid"))
        if not cert:
            raise HTTPException(status_code=401, detail="Invalid ID token")

        project_id = get_firebase_project_id()
        public_key = x509_mod.load_pem_x509_certificate(cert.encode("utf-8")).public_key()
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
