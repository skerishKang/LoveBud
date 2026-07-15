# Generic Social Targets Migration A — Runbook

## Execution status (Issue #3536)

- **Historical applied artifact.** `scripts/migration-add-generic-social-targets.sql`
  is retained for audit/history and migration inventory checksum continuity.
- **Direct new execution is prohibited.** Do not run the historical SQL file
  as a standalone new apply path.
- Validators are **read-only execution guards**, not a migration ledger.
  They do **not** create or rewrite applied-ledger records.
- Future disposable/canonical rehearsal or guarded execution, when separately
  approved, **must** use this order only:

  1. `scripts/validate-generic-social-a-preflight.sql`
  2. exact unchanged `scripts/migration-add-generic-social-targets.sql`
  3. `scripts/validate-generic-social-a-postcondition.sql`

- **Production execution is not approved by this issue.** No Production,
  Neon, staging, Modal, or shared-database apply is authorized here.
- This documentation does not apply the migration. Any future apply requires
  separate CTO approval after exact-state preflight and postcondition proof.

## Overview

This runbook documents Migration A of the staged generic social write target
schema (Issue #3260). Migration A is strictly additive preparation: it adds
generic target columns, backfills existing rows, installs legacy-memory
compatibility triggers, and enforces pair-level CHECK constraints.


## Migration file

```
scripts/migration-add-generic-social-targets.sql
```

## Preconditions

Migration A is only valid after the moment social hardening schema exists
(from `scripts/migration-harden-moment-social-writes.sql`, Issues #3177).

Exact-state preflight (Issue #3536) accepts only:

- exact legacy pre-A state (no generic columns / no A objects), or
- exact Migration A post-state (for second-apply only).

All mixed, partial, or same-name incompatible objects fail closed.

## Historical command — do not execute as new work

```bash
# Historical command — do not execute as new work
psql "$DATABASE_URL" -f scripts/migration-add-generic-social-targets.sql
```

Direct new execution of the historical artifact is prohibited. Use the
validator-guarded sequence only when a future task explicitly authorizes
disposable/canonical rehearsal (still never via ad-hoc Production apply
from this runbook).

## Post-apply aggregate-only evidence

Run these safe aggregate queries after apply:

### Generic pair null/partial count

```sql
SELECT
    'social_idempotency' AS table_name,
    COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL) AS null_pair,
    COUNT(*) FILTER (WHERE (target_kind IS NULL AND target_id IS NOT NULL) OR (target_kind IS NOT NULL AND target_id IS NULL)) AS partial_pair
FROM social_idempotency
UNION ALL
SELECT
    'social_audit_log',
    COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL),
    COUNT(*) FILTER (WHERE (target_kind IS NULL AND target_id IS NOT NULL) OR (target_kind IS NOT NULL AND target_id IS NULL))
FROM social_audit_log;
```

### Generic kind distribution

```sql
SELECT target_kind, COUNT(*)::int AS row_count
FROM social_idempotency
GROUP BY target_kind
ORDER BY target_kind;

SELECT target_kind, COUNT(*)::int AS row_count
FROM social_audit_log
GROUP BY target_kind
ORDER BY target_kind;
```

### Generic-to-legacy mismatch count

```sql
SELECT COUNT(*)::int AS mismatch_count
FROM social_idempotency
WHERE target_kind IS NOT NULL
  AND target_id IS NOT NULL
  AND target_id != target_memory_id;

SELECT COUNT(*)::int AS mismatch_count
FROM social_audit_log
WHERE target_kind IS NOT NULL
  AND target_id IS NOT NULL
  AND target_id != memory_id;
```

### Trigger presence

```sql
SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname IN ('trg_social_idempotency_sync_generic_target', 'trg_social_audit_log_sync_generic_target');
```

## Trigger behavior and compatibility guarantee

Two `BEFORE INSERT OR UPDATE` per-row triggers ensure unchanged moment writers
produce canonical generic target pairs:

| Trigger function | Table | Behavior |
|---|---|---|
| `sync_social_idempotency_generic_target_from_legacy_memory()` | `social_idempotency` | When generic fields absent, sets `target_kind = 'memory'` and `target_id = target_memory_id`. Rejects partial pairs, non-memory `target_kind`, and generic/legacy mismatches. |
| `sync_social_audit_generic_target_from_legacy_memory()` | `social_audit_log` | Same behavior using `memory_id` as legacy source. |

Existing moment writes (from `reactions.py`, `comments.py`) populate only
legacy memory target fields (`target_memory_id`, `memory_id`). The triggers
fill generic fields automatically, so no runtime code change is needed.

Legacy fields stay readable and `NOT NULL`. Existing moment runtime remains
unchanged.

## Verification Gate A checklist

Before Migration B may proceed, confirm:

- [ ] Every row in both tables has a valid `(target_kind, target_id)` pair
- [ ] All backfilled rows have `target_kind = 'memory'`
- [ ] Existing moment write behavior remains functional (idempotency reservation, replay, audit logging)
- [ ] No tree runtime caller has been deployed

## Runtime boundary

- **No Modal or Cloudflare deployment occurs in Migration A.**
- Tree runtime hardening, tree idempotency handlers, and tree-like writes
  remain blocked until Migration B and later runtime hardening.
- The trigger error messages explicitly state that tree writers are blocked.

## Rollback boundary

- **No automatic rollback.** This migration is additive.
- If later runtime depends on generic target fields and needs rollback,
  roll that runtime back first.
- Schema rollback (removing generic columns, dropping triggers, dropping
  functions, dropping constraints) requires separate approval.
- Do not execute rollback in this task.

## Explicit non-goals

- No actual database migration application
- No runtime, API, Modal, Cloudflare, or deploy change
- No tree writer, tree idempotency handler, or tree-like UI activation
- No change to existing moment writer behavior
- No legacy column rename, drop, or nullability relaxation
- No `NOT NULL` on generic target columns
- No change to Browse, My Trees, Editor, Scout, Hermes, #3075,
  outside-project code, or `pr-comment-composer-verify`
- No DROP TABLE, DROP INDEX, or ALTER ... DROP statement
