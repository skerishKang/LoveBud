# Generic Social Targets Migration B — Runbook

## Execution status (Issue #3538)

- **Historical applied artifact.** `scripts/migration-b-generic-social-targets-cutover.sql`
  is retained for audit/history and migration inventory checksum continuity.
- **Direct new execution is prohibited.** Do not run the historical SQL file
  as a standalone new apply path.
- Validators are **read-only execution guards**, not a migration ledger.
  They do **not** create or rewrite applied-ledger records.
- Future disposable/canonical rehearsal or guarded execution, when separately
  approved, **must** use this order only:

  1. `scripts/validate-generic-social-b-preflight.sql`
  2. exact unchanged `scripts/migration-b-generic-social-targets-cutover.sql`
  3. `scripts/validate-generic-social-b-postcondition.sql`

- Preflight accepts only exact **STATE_A** (Migration A post-state on both
  tables) or exact **STATE_B** (Migration B post-state on both tables).
- **Production execution is not approved by this issue.** No Production,
  Neon, staging, Modal, or shared-database apply is authorized here.
- This documentation does not apply the migration. Any future apply requires
  separate CTO approval after exact-state preflight and postcondition proof.

## Overview

This runbook documents Migration B of the staged generic social write target
schema (Issues #3260 / #3352). Migration B is the **compatibility cutover**
after Verification Gate A (#3264):

- Relaxes legacy moment-only `NOT NULL` on `target_memory_id` / `memory_id`
- Makes the generic pair `(target_kind, target_id)` authoritative (`NOT NULL`)
- Updates compatibility triggers so:
  - legacy-only moment writers still resolve to `target_kind = 'memory'`
  - future tree writers may use `target_kind = 'tree'` with null legacy fields
  - partial pairs, unknown kinds, memory mismatches, and tree IDs in legacy
    memory fields are rejected

## Migration file

```
scripts/migration-b-generic-social-targets-cutover.sql
```

## Preconditions

Migration B is only valid after:

1. Migration A applied (`scripts/migration-add-generic-social-targets.sql`)
2. Verification Gate A completed (#3264)
3. No tree runtime writer has been deployed that depends on generic tree
   targets before this cutover is approved

Exact-state preflight (Issue #3538) accepts only:

- both tables exact Migration A post-state (STATE_A), or
- both tables exact Migration B post-state (STATE_B)

All mixed, partial, or same-name incompatible objects fail closed.

## Historical command — do not execute as new work

```bash
psql "$DATABASE_URL" -f scripts/migration-b-generic-social-targets-cutover.sql
```

**Historical command only.** Do not execute as new work without the validator
sequence above and separate CTO approval.

## What changes

| Area | Migration B behavior |
|---|---|
| `social_idempotency.target_memory_id` | `NOT NULL` relaxed; column remains readable |
| `social_audit_log.memory_id` | `NOT NULL` relaxed; column remains readable |
| `target_kind` / `target_id` (both tables) | Set `NOT NULL` after preflight (authoritative pair) |
| Moment writers | Unchanged; legacy-only inserts still fill generic memory pair via trigger |
| Tree writers (future) | Schema path allows generic-only `tree` rows; runtime still separately approved |
| Legacy columns | Not renamed, not dropped, not repurposed |

## Compatibility trigger behavior (after Migration B)

Two `BEFORE INSERT OR UPDATE` per-row triggers remain named as in Migration A
and invoke updated function bodies:

| Trigger function | Table | Behavior |
|---|---|---|
| `sync_social_idempotency_generic_target_from_legacy_memory()` | `social_idempotency` | Legacy-only → `memory` pair from `target_memory_id`. Allows complete `tree` pair only when `target_memory_id` is null. Rejects partial pairs, unknown kinds, memory mismatches. |
| `sync_social_audit_generic_target_from_legacy_memory()` | `social_audit_log` | Same using `memory_id` as the legacy moment field. |

Existing moment writes (from `reactions.py`, `comments.py`) populate only
legacy memory target fields. The triggers fill generic fields automatically,
so **no runtime code change is needed** for moment writers.

## Post-apply aggregate-only evidence

Run these safe aggregate queries after apply. Report counts/categories only;
do not export row identifiers or private payloads.

### Legacy and generic nullability metadata

```sql
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'social_idempotency' AND column_name IN ('target_memory_id', 'target_kind', 'target_id'))
    OR (table_name = 'social_audit_log' AND column_name IN ('memory_id', 'target_kind', 'target_id'))
  )
ORDER BY table_name, column_name;
```

Expected after Migration B:

- legacy moment columns: `is_nullable = YES`
- generic pair columns: `is_nullable = NO`

### Generic pair null/partial count

```sql
SELECT
    'social_idempotency' AS table_name,
    COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL) AS null_pair,
    COUNT(*) FILTER (
      WHERE (target_kind IS NULL AND target_id IS NOT NULL)
         OR (target_kind IS NOT NULL AND target_id IS NULL)
    ) AS partial_pair
FROM social_idempotency
UNION ALL
SELECT
    'social_audit_log',
    COUNT(*) FILTER (WHERE target_kind IS NULL OR target_id IS NULL),
    COUNT(*) FILTER (
      WHERE (target_kind IS NULL AND target_id IS NOT NULL)
         OR (target_kind IS NOT NULL AND target_id IS NULL)
    )
FROM social_audit_log;
```

### Memory generic/legacy mismatch (legacy present only)

```sql
SELECT COUNT(*)::int AS mismatch_count
FROM social_idempotency
WHERE target_kind = 'memory'
  AND target_memory_id IS NOT NULL
  AND target_id IS DISTINCT FROM target_memory_id;

SELECT COUNT(*)::int AS mismatch_count
FROM social_audit_log
WHERE target_kind = 'memory'
  AND memory_id IS NOT NULL
  AND target_id IS DISTINCT FROM memory_id;
```

### Tree rows must not populate legacy memory fields

```sql
SELECT COUNT(*)::int AS tree_legacy_populated
FROM social_idempotency
WHERE target_kind = 'tree' AND target_memory_id IS NOT NULL;

SELECT COUNT(*)::int AS tree_legacy_populated
FROM social_audit_log
WHERE target_kind = 'tree' AND memory_id IS NOT NULL;
```

### Kind distribution

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

### Trigger presence

```sql
SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname IN (
  'trg_social_idempotency_sync_generic_target',
  'trg_social_audit_log_sync_generic_target'
);
```

## Verification Gate B checklist (post-apply, separate task)

Before tree-like runtime hardening may proceed, confirm:

- [ ] Legacy moment columns are nullable but still present/readable
- [ ] Generic pair columns are `NOT NULL` on both tables
- [ ] Null/partial generic pair counts are zero
- [ ] Memory mismatch counts are zero where legacy is present
- [ ] Tree rows (if any) do not populate legacy memory fields
- [ ] Compatibility triggers are present
- [ ] Existing moment write path still functions (legacy-only insert path)
- [ ] No unauthorized tree runtime caller was deployed as part of this migration

## Runtime boundary

- **No Modal or Cloudflare deployment occurs in Migration B artifact preparation.**
- Tree runtime hardening, tree idempotency handlers, client adapters, and
  tree-like UI activation remain **blocked** until separately approved
  follow-up work after Migration B is applied and verified.
- This cutover only prepares the schema path for future `target_kind = 'tree'`.

## Rollback boundary

- **No automatic rollback.**
- If later runtime depends on tree generic targets and needs rollback, roll that runtime back first.
- Schema rollback (re-applying legacy `NOT NULL`, removing new CHECKs,
  reverting trigger bodies) requires separate approval.
- Do not execute rollback in this task.
- Do not use DROP TABLE, DROP INDEX, or destructive bulk data rewrites.

## Explicit non-goals

- No actual database migration application in this PR/task
- No runtime, API, Modal, Cloudflare, or deploy change
- No tree writer, tree idempotency handler, or tree-like UI activation
- No change to existing moment writer runtime code
- No legacy column rename or drop
- No change to Browse, My Trees, Editor, Scout, Hermes, #3075,
  outside-project code, or `pr-comment-composer-verify`
- No DROP TABLE, DROP INDEX, DROP COLUMN, or DROP TRIGGER statements
- No production smoke, fixture use, or private value capture

## References

- `docs/product/lovebud-generic-social-write-target-contract.md`
- `docs/ops/generic-social-targets-migration-a-runbook.md`
- `scripts/migration-add-generic-social-targets.sql`
- `scripts/migration-b-generic-social-targets-cutover.sql`

Refs #3352  
Refs #3264  
Refs #3262  
Refs #3260  
Refs #3188  
Refs #3075  
Refs #1882  
