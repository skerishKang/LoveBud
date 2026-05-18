from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry


_USER_BOOTSTRAP_ALLOWED_COLUMNS = {
    "id",
    "uid",
    "email",
    "created_at",
    "updated_at",
}


def _fetch_users_table_columns(cur: Any) -> set[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users';
        """
    )
    rows = cur.fetchall() or []
    return {
        str(row.get("column_name") or "").strip()
        for row in rows
        if str(row.get("column_name") or "").strip()
    }


def _build_owner_user_upsert_query(columns: set[str], email: str) -> tuple[str, list[Any]] | None:
    if "id" not in columns:
        return None

    insert_columns: list[str] = ["id"]
    value_expressions: list[str] = ["%s"]
    params: list[Any] = []

    if "email" in columns:
        insert_columns.append("email")
        value_expressions.append("%s")

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
                if not columns or "id" not in columns:
                    return

                unknown_required_columns = columns - _USER_BOOTSTRAP_ALLOWED_COLUMNS
                if unknown_required_columns:
                    # Unknown columns are not automatically populated. The upsert below
                    # still proceeds because columns with defaults or nullable values are safe.
                    pass

                built = _build_owner_user_upsert_query(columns, safe_email)
                if not built:
                    return
                query, params = built
                cur.execute(query, [safe_uid, *([safe_email] if "email" in columns else []), *params])
            conn.commit()

    try:
        run_db_with_retry(operation)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Owner user bootstrap failed") from error
