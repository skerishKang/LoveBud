# Moment Social Write Hardening — Migration Runbook

## Overview

This migration applies additive schema changes for Issue #3177: hardened
authenticated moment reaction and comment writes. It creates three new tables
and adds three lifecycle columns to the existing `comments` table.

## Migration file

```
scripts/migration-harden-moment-social-writes.sql
```

## New tables

| Table | Purpose |
|-------|---------|
| `social_idempotency` | Tracks idempotency keys for reaction/comment writes |
| `social_rate_limits` | Fixed-window rate-limit buckets per actor (and per memory) |
| `social_audit_log` | Minimal safe audit trail for write operations |

## Modified table

| Table | Change |
|-------|--------|
| `comments` | Added `status VARCHAR(20) DEFAULT 'visible'`, `deleted_at TIMESTAMPTZ`, `deleted_by VARCHAR(128)`, CHECK constraint `status IN ('visible', 'hidden', 'deleted')` |

## Deploy order

1. **Apply migration** to the target database
   ```bash
   psql "$DATABASE_URL" -f scripts/migration-harden-moment-social-writes.sql
   ```

2. **Capture evidence**
   - Run `\dt social_*` to verify new tables exist
   - Run `\d comments` to verify lifecycle columns and CHECK constraint
   - Run `\di social_*` to verify indexes
   - Record output in the deployment log

3. **Approve Modal backend deploy**
   - The Modal compute image must include the new helper modules
     (`social_idempotency.py`, `social_rate_limit.py`, `social_write_audit.py`,
     `social_errors.py`)
   - Roll out the updated `modal_compute/app.py` with idempotency header wiring
     and social write error handler
   - Deploy CF proxy changes (mandatory Idempotency-Key validation) simultaneously or after

4. **Runtime verification**
   - Run contract tests:
     ```bash
     node --test \
       tests/contracts/moment-social-write-hardening-contract.test.cjs \
       tests/contracts/moment-social-write-migration-contract.test.cjs
     ```
   - Verify existing write paths still work (reaction toggle, comment create)
   - Verify idempotent replay returns deterministic results

## Rollback

1. **Roll back Modal application code first.** Verify no active runtime
   depends on the lifecycle/idempotency tables.
2. **Only then perform schema rollback** if approved:

```sql
DROP TABLE IF EXISTS social_idempotency;
DROP TABLE IF EXISTS social_rate_limits;
DROP TABLE IF EXISTS social_audit_log;
ALTER TABLE comments DROP COLUMN IF EXISTS status;
ALTER TABLE comments DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE comments DROP COLUMN IF EXISTS deleted_by;
```

The application code does NOT pass through when migration tables are absent.
Full deployment dependency is:

```
migration apply → schema evidence → Modal deployment approval → Modal deployment → runtime verification
```

Rollback is safe because all changes are additive:
- No existing data is modified (new columns default to `'visible'` / NULL)
- No existing indexes are dropped

## UUID strategy

All new table primary keys use application-generated UUIDs. The `id` column
has no `DEFAULT` clause, so there is no dependency on `pgcrypto` or
`gen_random_uuid()`. The application layer generates UUIDs using
Python's `uuid.uuid4()`.

`social_rate_limits.id` and `social_audit_log.id` are also populated by the
application layer (`uuid.uuid4()`). The INSERT statements in
`social_rate_limit.py` and `social_write_audit.py` include the `id` column.

## Retention policy

현재 자동 TTL cleanup은 구현되어 있지 않다.
`social_idempotency` 및 `social_rate_limits` retention cleanup은
별도 승인된 운영 작업으로만 수행한다.

The `idx_social_idempotency_created_at` and `idx_social_rate_limits_window_start`
indexes exist to support future cleanup queries when a retention policy is
approved and implemented.

## Lifecycle CHECK constraint

A new CHECK constraint `comments_status_check` enforces that `status` can
only be `'visible'`, `'hidden'`, or `'deleted'`. The constraint is added
with a guarded `DO $$ ... $$` block to ensure re-runnable execution.

## Backward compatibility

- `status` defaults to `'visible'`, so existing comment rows are automatically visible
- `deleted_at` and `deleted_by` default to NULL, indicating not deleted
- Public read queries use `WHERE status = 'visible' AND deleted_at IS NULL`,
  which matches the pre-migration behavior for all existing rows
- No backfill required

## Safety notes

- All CREATE statements use `IF NOT EXISTS`
- All ALTER statements use `ADD COLUMN IF NOT EXISTS`
- The CHECK constraint uses a guarded `DO` block for re-runnable execution
- The migration can be re-run safely
- No destructive operations (DROP, ALTER ... DROP, etc.)
- No `pgcrypto` extension requirement
