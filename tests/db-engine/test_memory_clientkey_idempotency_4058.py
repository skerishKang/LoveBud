from __future__ import annotations

import os
import threading
import uuid
from contextlib import contextmanager

import psycopg
from fastapi import HTTPException

import modal_compute.memory_writes as memory_writes
import modal_compute.owner_reads as owner_reads

# Stable UUID tree ids (validate_required_uuid enforces UUID shape).
TREE_1 = str(uuid.uuid4())
TREE_2 = str(uuid.uuid4())


def _conninfo() -> str:
    return (
        f"host={os.environ['LB_TEST_PGHOST']} "
        f"port={os.environ['LB_TEST_PGPORT']} "
        f"user={os.environ['LB_TEST_PGUSER']} "
        f"password={os.environ['LB_TEST_PGPASSWORD']} "
        f"dbname={os.environ['LB_TEST_PGADMIN_DB']}"
    )


def _quote_ident(identifier: str) -> str:
    if not identifier.replace("_", "").isalnum():
        raise ValueError("unsafe synthetic schema identifier")
    return f'"{identifier}"'
def _install_schema(admin: psycopg.Connection, schema: str) -> None:
    # The runtime capability check (schema_capabilities.table_has_column) probes
    # information_schema.columns WHERE table_schema = 'public'. LoveBud's canonical
    # tables live in the `public` schema, so the test MUST install there too — a
    # non-public schema would make the capability probe always return False and
    # route every request to the 501 compatibility-rejection path.
    admin.execute("DROP TABLE IF EXISTS memories CASCADE")
    admin.execute("DROP TABLE IF EXISTS trees CASCADE")
    admin.execute(
        """
        CREATE TABLE trees (
            id text PRIMARY KEY,
            owner_id text NOT NULL,
            title text NOT NULL,
            visibility text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        )
        """
    )
    admin.execute(
        """
        CREATE TABLE memories (
            id text PRIMARY KEY,
            tree_id text NOT NULL REFERENCES trees(id),
            parent_id text,
            title text NOT NULL DEFAULT '',
            memo text NOT NULL DEFAULT '',
            artist text NOT NULL DEFAULT '',
            source text NOT NULL DEFAULT '',
            source_url text NOT NULL DEFAULT '',
            source_type text NOT NULL DEFAULT 'youtube',
            thumbnail text NOT NULL DEFAULT '',
            emotion_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
            timestamp text NOT NULL DEFAULT '',
            visibility text NOT NULL DEFAULT 'private',
            channel_id text,
            channel_name text,
            channel_url text,
            client_key text,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW(),
            UNIQUE (tree_id, client_key)
        )
        """
    )


def _truncate(admin: psycopg.Connection) -> None:
    admin.execute("TRUNCATE memories, trees CASCADE")


def _make_env(schema: str, owner_id: str = "owner-1"):
    """Install an isolated schema and monkeypatch the memory write/read seams."""
    admin = psycopg.connect(_conninfo(), autocommit=True, row_factory=psycopg.rows.dict_row)
    _install_schema(admin, schema)
    # Seed the primary tree row so FK constraints hold for the stubbed owner check.
    _seed_tree(schema, TREE_1)
    # Capability detection is cached per-process (TTL); clear so each isolated
    # schema (with/without the column) is detected fresh.
    from modal_compute.schema_capabilities import clear_schema_capability_cache
    clear_schema_capability_cache()

    original_get_db_connection = memory_writes.get_db_connection
    original_fetch_owner_tree = memory_writes.fetch_owner_tree
    original_require_memory_owner = memory_writes.require_memory_owner
    original_fetch_memory_for_owner_check = memory_writes.fetch_memory_for_owner_check

    original_owner_reads_get_db = owner_reads.get_db_connection

    @contextmanager
    def synthetic_connection():
        conn = psycopg.connect(_conninfo(), row_factory=psycopg.rows.dict_row)
        try:
            conn.execute("SET search_path TO public")
            yield conn
        finally:
            conn.close()

    memory_writes.get_db_connection = synthetic_connection
    owner_reads.get_db_connection = synthetic_connection
    memory_writes.fetch_owner_tree = lambda tree_id, oid: {
        "id": tree_id, "owner_id": oid, "visibility": "public", "title": "t",
    }
    memory_writes.require_memory_owner = lambda memory_id, oid: {"id": memory_id, "tree_id": TREE_1}
    memory_writes.fetch_memory_for_owner_check = lambda memory_id: None

    def cleanup():
        memory_writes.get_db_connection = original_get_db_connection
        owner_reads.get_db_connection = original_owner_reads_get_db
        memory_writes.fetch_owner_tree = original_fetch_owner_tree
        memory_writes.require_memory_owner = original_require_memory_owner
        memory_writes.fetch_memory_for_owner_check = original_fetch_memory_for_owner_check
        _truncate(admin)
        admin.close()

    return schema, cleanup


def _seed_tree(schema: str, tree_id: str) -> None:
    admin = psycopg.connect(_conninfo(), autocommit=True, row_factory=psycopg.rows.dict_row)
    admin.execute("SET search_path TO public")
    admin.execute(
        "INSERT INTO trees (id, owner_id, title, visibility) "
        "VALUES (%s, 'owner-1', 't', 'public')",
        (tree_id,),
    )
    admin.close()


def test_no_client_key_legacy_null():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        payload = {"treeId": TREE_1, "title": "m", "emotionTags": []}
        r1 = memory_writes.create_owner_memory("owner-1", payload)
        assert r1["id"]
        # No clientKey field on a legacy (NULL) row.
        assert "clientKey" not in r1
    finally:
        cleanup()


def test_valid_client_key_persisted_and_reread():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        payload = {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": "ck-1"}
        r1 = memory_writes.create_owner_memory("owner-1", payload)
        assert r1.get("clientKey") == "ck-1"
        # Owner reread returns exact clientKey (via normalize_memory_row).
        rows = owner_reads.fetch_owner_memories("owner-1", TREE_1)
        assert any(m.get("clientKey") == "ck-1" for m in rows)
    finally:
        cleanup()


def test_sequential_same_tree_key_returns_one_memory():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        base = {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": "ck-seq"}
        r1 = memory_writes.create_owner_memory("owner-1", base)
        r2 = memory_writes.create_owner_memory("owner-1", base)
        assert r1["id"] == r2["id"], "sequential retry must converge to same canonical Memory"
    finally:
        cleanup()


def test_cross_tree_same_key_independent():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        _seed_tree(schema, TREE_2)
        r1 = memory_writes.create_owner_memory("owner-1", {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": "ck-x"})
        r2 = memory_writes.create_owner_memory("owner-1", {"treeId": TREE_2, "title": "m", "emotionTags": [], "clientKey": "ck-x"})
        assert r1["id"] != r2["id"], "same key across different trees must be independent"
    finally:
        cleanup()


def test_non_string_client_key_rejected_before_db():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        # TREE_1 is already seeded by _make_env; rejection happens at validation.
        with __import__("pytest").raises(HTTPException) as exc:
            memory_writes.create_owner_memory("owner-1", {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": 123})
        assert exc.value.status_code == 400
    finally:
        cleanup()


def test_oversized_client_key_rejected():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        # TREE_1 already seeded by _make_env.
        with __import__("pytest").raises(HTTPException) as exc:
            memory_writes.create_owner_memory("owner-1", {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": "x" * 101})
        assert exc.value.status_code == 400
    finally:
        cleanup()


def test_update_client_key_rejected():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        r = memory_writes.create_owner_memory("owner-1", {"treeId": TREE_1, "title": "m", "emotionTags": []})
        with __import__("pytest").raises(HTTPException) as exc:
            memory_writes.update_owner_memory("owner-1", r["id"], {"clientKey": "ck-update"})
        assert exc.value.status_code == 400
        assert exc.value.detail.get("code") == "UNSUPPORTED_MEMORY_UPDATE_FIELDS"
    finally:
        cleanup()


def test_concurrent_same_tree_key_converges_to_one():
    schema = f"mem_4058_{uuid.uuid4().hex[:10]}"
    _, cleanup = _make_env(schema)
    try:
        barrier = threading.Barrier(2)
        results: list[str] = []
        errors: list[Exception] = []

        def worker() -> None:
            try:
                barrier.wait()
                r = memory_writes.create_owner_memory(
                    "owner-1", {"treeId": TREE_1, "title": "m", "emotionTags": [], "clientKey": "ck-concurrent"}
                )
                results.append(r["id"])
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start()
        t2.start()
        t1.join(timeout=30)
        t2.join(timeout=30)

        assert not errors, f"unexpected errors: {errors}"
        assert len(results) == 2, f"expected two successful creates, got {results}"
        assert results[0] == results[1], "concurrent same tree+key must converge to one canonical Memory"
    finally:
        cleanup()


if __name__ == "__main__":
    import sys
    sys.exit(__import__("pytest").main([__file__, "-v"]))
