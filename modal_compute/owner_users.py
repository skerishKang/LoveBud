from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from modal_compute.db import get_db_connection, run_db_with_retry


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
        if name:
            columns[name] = {
                "is_nullable": row.get("is_nullable"),
                "column_default": row.get("column_default"),
            }
    return columns


def _has_required_unknown_columns(columns: dict[str, dict[str, Any]]) -> bool:
    handled = {"id", "email", "created_at", "updated_at"}
    for name, meta in columns.items():
        if name in handled:
            continue
        is_nullable = str(meta.get("is_nullable") or "").upper() == "YES"
        has_default = meta.get("column_default") is not None
        if not is_nullable and not has_default:
            return True
    return False


def ensure_owner_user_exists(uid: str, email: str = "") -> None:
    safe_uid = str(uid or "").strip()
    if not safe_uid:
        raise HTTPException(status_code=401, detail="Authentication required")

    safe_email = str(email or "").strip()[:320]

    def operation() -> None:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                columns = _fetch_users_table_columns(cur)
                if "id" not in columns or _has_required_unknown_columns(columns):
                    raise HTTPException(status_code=500, detail="Owner user bootstrap unavailable")

                insert_columns = ["id"]
                values = ["%s"]
                params: list[Any] = [safe_uid]

                if "email" in columns:
                    insert_columns.append("email")
                    values.append("%s")
                    params.append(safe_email)
                if "created_at" in columns:
                    insert_columns.append("created_at")
                    values.append("NOW()")
                if "updated_at" in columns:
                    insert_columns.append("updated_at")
                    values.append("NOW()")

                updates: list[str] = []
                if "email" in insert_columns and safe_email:
                    updates.append("email = EXCLUDED.email")
                if "updated_at" in insert_columns:
                    updates.append("updated_at = NOW()")

                conflict_clause = "DO NOTHING"
                if updates:
                    conflict_clause = "DO UPDATE SET " + ", ".join(updates)

                cur.execute(
                    f"""
                    INSERT INTO users ({', '.join(insert_columns)})
                    VALUES ({', '.join(values)})
                    ON CONFLICT (id) {conflict_clause};
                    """,
                    params,
                )
            conn.commit()

    try:
        run_db_with_retry(operation)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Owner user bootstrap failed") from error
