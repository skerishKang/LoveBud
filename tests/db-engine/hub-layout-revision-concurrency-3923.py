from __future__ import annotations

import os
import threading
import uuid
from contextlib import contextmanager

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

import modal_compute.hub_layouts as hub_layouts


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


def main() -> None:
    schema = f"hub_layout_3923_{uuid.uuid4().hex[:12]}"
    schema_sql = _quote_ident(schema)

    with psycopg.connect(_conninfo(), autocommit=True, row_factory=dict_row) as admin:
        admin.execute(f"CREATE SCHEMA {schema_sql}")
        admin.execute(
            f"""
            CREATE TABLE {schema_sql}.tree_hub_layouts (
                id text PRIMARY KEY,
                tree_id text NOT NULL,
                revision integer NOT NULL,
                layout_mode text NOT NULL,
                manual_positions jsonb NOT NULL,
                created_at timestamptz NOT NULL DEFAULT NOW(),
                updated_at timestamptz NOT NULL DEFAULT NOW()
            )
            """
        )

    @contextmanager
    def synthetic_connection():
        conn = psycopg.connect(_conninfo(), row_factory=dict_row)
        try:
            conn.execute(f"SET search_path TO {schema_sql}, public")
            yield conn
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    original_get_db_connection = hub_layouts.get_db_connection
    original_require_tree_owner = hub_layouts.require_tree_owner
    hub_layouts.get_db_connection = synthetic_connection
    hub_layouts.require_tree_owner = lambda tree_id, owner_id: {"id": tree_id, "owner_id": owner_id}

    try:
        tree_id = "tree-concurrency"
        owner_id = "owner-synthetic"
        payload = {
            "baseRevision": 0,
            "layoutMode": "manual",
            "manualPositions": [],
        }
        barrier = threading.Barrier(2)
        results: list[dict] = []
        errors: list[Exception] = []

        def worker() -> None:
            barrier.wait()
            try:
                results.append(hub_layouts.save_hub_layout(tree_id, owner_id, payload))
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker), threading.Thread(target=worker)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
            assert not thread.is_alive(), "concurrent save did not complete within bounded test time"

        assert len(results) == 1, f"expected exactly one winner, got {len(results)}"
        assert results[0]["revision"] == 1
        assert len(errors) == 1, f"expected exactly one loser, got {len(errors)}"
        assert isinstance(errors[0], HTTPException)
        assert errors[0].status_code == 409

        with synthetic_connection() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*)::int AS count, MAX(revision)::int AS max_revision
                FROM tree_hub_layouts
                WHERE tree_id = %s
                """,
                (tree_id,),
            ).fetchone()
        assert row["count"] == 1
        assert row["max_revision"] == 1

        try:
            hub_layouts.save_hub_layout(tree_id, owner_id, payload)
        except HTTPException as exc:
            assert exc.status_code == 409
        else:
            raise AssertionError("stale baseRevision unexpectedly succeeded")

        with synthetic_connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*)::int AS count FROM tree_hub_layouts WHERE tree_id = %s",
                (tree_id,),
            ).fetchone()
        assert row["count"] == 1

        assert hub_layouts._hub_layout_advisory_lock("tree-a") == hub_layouts._hub_layout_advisory_lock("tree-a")
        assert hub_layouts._hub_layout_advisory_lock("tree-a") != hub_layouts._hub_layout_advisory_lock("tree-b")

        print("hub-layout concurrency regression: PASS")
    finally:
        hub_layouts.get_db_connection = original_get_db_connection
        hub_layouts.require_tree_owner = original_require_tree_owner
        with psycopg.connect(_conninfo(), autocommit=True) as admin:
            admin.execute(f"DROP SCHEMA IF EXISTS {schema_sql} CASCADE")


if __name__ == "__main__":
    main()
