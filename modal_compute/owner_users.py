from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry


_USER_BOOTSTRAP_INSERT_COLUMNS = {
    "id",
    "email",
    "created_at",
    "updated_at",
}


def _fetch_users_table_columns(cur: Any) -> dict[str, dict[str, Any]]:
    cur.execute(
        """
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users';
        """
    )
    rows = cur.fetchall() or []
    columns: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = str(row.get("column_name") or "").strip()
        if not name:
            continue
        columns[name] = {
            "is_nullable": row.get("is_nullable"),
            "column_default": row.get("column_default"),
        }
    return columns


def _has_unhandled_required_columns(columns: dict[str, dict[str, Any]]) -> bool:
    for name, meta in columns.items():
        if name in _USER_BOOTSTRAP_INSERT_COLUMNS:
            continue
        is_nullable = str(meta.get("is_nullable") or "").upper() == "YES"
        has_default = meta.get("column_default") is not None
        if not is_nullable and not has_default:
            return True
    return False


def _build_owner_user_upsert_query(columns: dict[str, dict[str, Any]], email: str) -> tuple[str, list[Any]] | None:
    if "id" not in columns:
        return None

    if _has_unhandled_required_columns(columns):
        return None

    insert_columns: list[str] = ["id"]
    value_expressions: list[str] = ["%s"]
    params: list[Any] = []

    if "email" in columns:
        insert_columns.append("email")
        value_expressions.append("%s")
        params.append(email)

    if "created_at" in columns:
        insert_columns.append("created_at")
        value_expressions.append("NOW()")

    if "updated_at" in columns:
        insert_columns.append("updated_at")
        value_expressions.append("NOW()")

    update_expressions: list[str] = []
    if "email" in insert_columns and email:
        update_expressions.append("email = EXCLUDED.email")
    if "updated_at" in insert_columns:
        update_expressions.append("updated_at = NOW()")

    conflict_clause = "DO NOTHING"
    if update_expressions:
        conflict_clause = "DO UPDATE SET " + ", ".join(update_expressions)

    query = f"""
        INSERT INTO users ({', '.join(insert_columns)})
        VALUES ({', '.join(value_expressions)})
        ON CONFLICT (id) {conflict_clause};
    """

    return query, params


def ensure_owner_user_exists(uid: str, email: str = "") -> None:
    """Ensure Firebase-authenticated owner has a matching Postgres users row.

    The private tree write path stores ``trees.owner_id`` as the Firebase UID.
    Some runtimes enforce ``trees.owner_id -> users(id)``. Without a user row,
    first-time owners can hit a ForeignKeyViolation before tree creation.
    """
    safe_uid = str(uid or "").strip()
    if not safe_uid:
        raise HTTPException(status_code=401, detail="Authentication required")

    safe_email = str(email or "").strip()[:320]

    def operation() -> None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                columns = _fetch_users_table_columns(cur)
                built = _build_owner_user_upsert_query(columns, safe_email)
                if not built:
                    raise HTTPException(status_code=500, detail="Owner user bootstrap unavailable")
                query, params = built
                cur.execute(query, [safe_uid, *params])
            conn.commit()

    try:
        run_db_with_retry(operation)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Owner user bootstrap failed") from error
