"""Pure PostgreSQL connection-URI to libpq environment decomposition.

Root cause (#3460 / #3894 recovery dump transport fix): libpq never parses a
connection URI that is placed in the ``PGDATABASE`` environment variable, so the
previous single-variable handoff could not connect. The connection value must
also never be placed in a subprocess argv, because a command line is visible in
process listings and captured logs.

This module converts a validated PostgreSQL connection URI into the individual
child-only libpq environment variables (``PGHOST``, ``PGPORT``, ``PGDATABASE``,
``PGUSER``, ``PGPASSWORD``, ``PGSSLMODE`` and the remaining standard libpq
parameters) so ``pg_dump`` connects with exactly the parameters the URI carried,
without ever exposing the raw URI in argv.

The module is pure: it performs no network, subprocess, filesystem, or logging
side effect, and it never returns, records, or prints any credential value. On
any malformed, missing, or unsupported input it fails closed, raising a generic,
non-credential reason token.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, unquote, urlsplit

# Accepted connection URI schemes (libpq accepts both spellings).
_ALLOWED_SCHEMES = frozenset({"postgres", "postgresql"})

# Fixed default port when the URI omits one, and the maximum accepted port.
_DEFAULT_PORT = "5432"
_MAX_PORT = 65535

# Connection parameters that carry a documented libpq environment variable. A
# parameter absent from this table cannot be faithfully preserved as an
# environment variable, so the parser fails closed instead of silently dropping
# it (which could downgrade the transport posture). The mapping is the sole
# authority for which parameters are supported.
_PARAM_ENV = {
    "host": "PGHOST",
    "port": "PGPORT",
    "dbname": "PGDATABASE",
    "user": "PGUSER",
    "password": "PGPASSWORD",
    "sslmode": "PGSSLMODE",
    "sslrootcert": "PGSSLROOTCERT",
    "sslcert": "PGSSLCERT",
    "sslkey": "PGSSLKEY",
    "requirepeer": "PGREQUIREPEER",
    "application_name": "PGAPPNAME",
    "options": "PGOPTIONS",
    "client_encoding": "PGCLIENTENCODING",
    "datestyle": "PGDATESTYLE",
    "timezone": "PGTZ",
    "target_session_attrs": "PGTARGETSESSIONATTRS",
    "connect_timeout": "PGCONNECT_TIMEOUT",
}

# Parameters that redirect libpq to external credential/configuration files must
# never be honored from a URI. They are rejected before the environment mapping.
_DENIED_PARAMS = frozenset({"service", "servicefile", "passfile"})

# Accepted sslmode values (the full libpq set). The value is carried faithfully;
# this parser performs decomposition only and adds no transport policy.
_VALID_SSLMODE = frozenset({
    "disable", "allow", "prefer", "require", "verify-ca", "verify-full",
})


class PgConnectionConfigError(ValueError):
    """Generic, non-credential connection-configuration failure (fail closed)."""


def _decode(value: str) -> str:
    # Percent-decode a userinfo / path component while preserving literal '+'.
    return unquote(value)


def parse_pg_connection(url: str) -> dict:
    """Decompose a PostgreSQL connection URI into child-only libpq env vars.

    Returns a mapping that always contains at least ``PGHOST``, ``PGPORT``,
    ``PGDATABASE`` and ``PGUSER`` (plus ``PGPASSWORD`` and every preserved
    transport parameter). Raises :class:`PgConnectionConfigError` with a fixed,
    non-credential reason token on any malformed, missing, or unsupported input.
    """
    if not isinstance(url, str) or not url.strip():
        raise PgConnectionConfigError("empty_uri")
    try:
        split = urlsplit(url)
    except ValueError as exc:  # pragma: no cover - defensive
        raise PgConnectionConfigError("malformed_uri") from exc

    if split.scheme.lower() not in _ALLOWED_SCHEMES:
        raise PgConnectionConfigError("bad_scheme")
    if split.fragment:
        raise PgConnectionConfigError("unexpected_fragment")

    host = split.hostname or ""
    if not host:
        raise PgConnectionConfigError("missing_host")

    try:
        port = split.port
    except ValueError as exc:
        raise PgConnectionConfigError("bad_port") from exc
    if port is None:
        port_value = _DEFAULT_PORT
    elif 1 <= port <= _MAX_PORT:
        port_value = str(port)
    else:
        raise PgConnectionConfigError("bad_port")

    raw_path = split.path[1:] if split.path.startswith("/") else split.path
    dbname = _decode(raw_path)
    if not dbname:
        raise PgConnectionConfigError("missing_database")

    user = _decode(split.username) if split.username else ""
    if not user:
        raise PgConnectionConfigError("missing_user")

    env = {
        "PGHOST": host,
        "PGPORT": port_value,
        "PGDATABASE": dbname,
        "PGUSER": user,
    }
    if split.password:
        env["PGPASSWORD"] = _decode(split.password)

    try:
        pairs = parse_qsl(split.query, keep_blank_values=True)
    except ValueError as exc:  # pragma: no cover - defensive
        raise PgConnectionConfigError("malformed_query") from exc

    seen = set()
    for key, value in pairs:
        lowered = key.lower()
        if lowered in seen:
            raise PgConnectionConfigError("duplicate_parameter")
        seen.add(lowered)
        if lowered in _DENIED_PARAMS:
            raise PgConnectionConfigError("unsupported_parameter")
        env_name = _PARAM_ENV.get(lowered)
        if env_name is None:
            raise PgConnectionConfigError("unsupported_parameter")
        if lowered == "sslmode" and value not in _VALID_SSLMODE:
            raise PgConnectionConfigError("bad_sslmode")
        if lowered == "port" and not (value.isdigit() and 1 <= int(value) <= _MAX_PORT):
            raise PgConnectionConfigError("bad_port")
        env[env_name] = value

    return env
