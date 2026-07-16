# Phase B Production Read-Only Catalog Collection Report

## Session Info
- **Date:** 2026-07-17
- **Worktree:** `arch-production-readonly-catalog-boundary-3570` (G: drive)
- **DB Host:** `ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech` (Neon PostgreSQL 17)
- **Mode:** `PRODUCTION_READONLY_CATALOG`
- **Collection Mode:** `CATALOG_METADATA_ONLY`
- **Output Policy:** `SANITIZED_STDOUT_ONLY`
- **Reuses:** #3570 (CLOSED), #3572 (CLOSED)

## Results Summary

| Metric | Value |
|--------|-------|
| Round 1 | ✅ `COLLECTION_COMPLETE` |
| Round 2 | ✅ `COLLECTION_COMPLETE` |
| Evidence Digest (both rounds) | `sha256:9b86dede9781086384457e77dba9a6c202995250d9a17b9a4a11e78b0f21cfd3` |
| Schema Consistency | ✅ Identical between rounds |
| Transaction | `BEGIN READ ONLY` → `SHOW transaction_read_only=on` ✅ → `ROLLBACK` |
| Object Count | 9 (all allowlisted) |

## Allowlisted Objects Collected

1. **table:public.trees** — Core tree entity (CORE_TREE_IDENTITY)
2. **table:public.memories** — Moment/memory dependency (MOMENT_DEPENDENCY)
3. **table:public.comments** — Moment comment surface (MOMENT_SOCIAL_SURFACE)
4. **table:public.reactions** — Moment reaction surface (MOMENT_SOCIAL_SURFACE)
5. **table:public.tree_comments** — Tree-level comments (TREE_SOCIAL_SURFACE)
6. **table:public.tree_likes** — Tree likes (TREE_SOCIAL_SURFACE)
7. **table:public.tree_social_counts** — Aggregated social counts (TREE_SOCIAL_SURFACE)
8. **table:public.social_audit_log** — Write hardening audit log (WRITE_HARDENING_SURFACE)
9. **table:public.social_idempotency** — Write idempotency ledger (WRITE_HARDENING_SURFACE)

## Notable Schema Observations

### 1. `trees` Table — Dropped Columns (Positions 2-4)
Columns exist at positions 1 (id), 5-11 (owner_id, title, visibility, group_name, keywords, created_at, updated_at). **Positions 2-4 are missing** — these are dropped columns from historical migration (likely `scenario_prompt`, `scenario_metadata`, and one other field). This confirms schema drift from the original migration baseline.

### 2. Triggers (2 found)
- `trg_social_audit_log_sync_generic_target` (social_audit_log) — enabled
- `trg_social_idempotency_sync_generic_target` (social_idempotency) — enabled
Both are related to generic social target synchronization.

### 3. Row-Level Security
No RLS policies on any of the 9 allowlisted tables.

### 4. Grants
All grants returned `null` — `relacl` is likely NULL for owner-owned tables (neondb_owner).

### 5. Constraints
Each table has a PRIMARY KEY. Foreign keys exist on:
- `comments` → `memory_id` referencing `memories`
- `reactions` → `memory_id` referencing `memories`
- `tree_comments` → `author_id`, `tree_id`

### 6. Unique Indexes
- `idx_reactions_memory_owner_type` (unique on memory_id, owner_id, type)
- `idx_tree_likes_tree_owner_active` (unique on tree_id, owner_id)
- `idx_social_idempotency_actor_op_key` (unique on actor_id, operation, idempotency_key)

## Read-Only Proofs Satisfied

1. ✅ EXPLICIT_READ_ONLY_TRANSACTION — `BEGIN READ ONLY` executed
2. ✅ READ_ONLY_TRANSACTION_CONFIRMED — `SHOW transaction_read_only` = `on`
3. ✅ REPOSITORY_OWNED_SQL_ONLY — SQL from phase-b-collection-child.cjs
4. ✅ NO_CALLER_SQL — All forbidden flags blocked
5. ✅ ALLOWLISTED_OBJECTS_ONLY — Only 9 pre-reviewed objects
6. ✅ NO_APPLICATION_ROW_READS — Metadata-only, no row data
7. ✅ ABSTRACT_ROLE_MAPPING_ONLY — Role mapping file configured
8. ✅ NO_RAW_CATALOG_OUTPUT — Sanitized JSON output
9. ✅ NO_PARTIAL_SUCCESS_CLAIM — Atomic all-or-nothing per round
10. ✅ BOUNDED_FAILURE_OUTPUT — Error reporting without exposing values

## Open Issues (unchanged)

- **#3458** — OPEN (Phase B readiness)
- **#3425** — OPEN
- **#1882** — OPEN (no closing keywords)
- **#3572** — CLOSED / completed
- **#3570** — CLOSED / completed

## Repository Location
- `G:\Ddrive\BatangD\task\workdiary\LoveBud\.local\arch-production-readonly-catalog-boundary-3570\`
- Collection script: `scripts/phase-b-collection-child.cjs`
- Secret file: `.secrets/production-readonly-url.env` (local-only, gitignored)
- Role mapping: `.secrets/production-role-mapping.json` (local-only, gitignored)
- Full output saved: `phase-b-collection-round1.json`, `phase-b-collection-round2.json`
