# LoveBud Tree Comments Legacy Schema Reconciliation Runbook

> **Issue:** #3423
> **Refs:** #3418 (BLOCKED_MIGRATION_REQUIRED), #3422 (root-cause diagnosis), #3188, #3075, #1882
> **Migration:** `scripts/migration-reconcile-tree-comments-legacy-schema.sql`
> **Contract test:** `tests/contracts/migration-tree-comments-legacy-reconcile-contract.test.cjs`
> **Strategy:** In-place ALTER (Strategy A), fail-closed, transaction-wrapped
> **Destructive operations:** NONE (no DROP TABLE / TRUNCATE / DELETE)

---

## 1. Production symptom (sanitized)

The public tree-comments read route returns HTTP 500. Approved read-only reproduction
isolated the cause:

```
psycopg.errors.UndefinedColumn: column "body" does not exist
SQLSTATE: 42703
failing: fetch_tree_comments() -> SELECT id, tree_id, body, created_at, updated_at FROM tree_comments
```

The reader needs `body`; the writer additionally needs `owner_id`, `target_kind`, `target_id`.
None of these exist on the production `public.tree_comments` table.

### Sanitized schema delta (production vs canonical)

| Canonical column | Production present | Reader req | Writer req |
|---|---|---|---|
| id | YES (text) | YES | YES |
| tree_id | YES (text) | YES | YES |
| owner_id | **NO** | NO | YES |
| body | **NO** | YES | YES |
| target_kind | **NO** | NO | YES |
| target_id | **NO** | NO | YES |
| created_at | YES (timestamptz, nullable) | YES | YES |
| updated_at | YES (timestamptz, nullable) | YES | YES |

Legacy-only columns preserved: `author_id`, `author_display_name`, `is_deleted`, `payload`.

**Verdict (from #3422):** `MIGRATION_REQUIRED`.

---

## 2. Production metadata (approved read-only inspection)

- `trees.id` type: **text** (NOT uuid)
- `tree_comments.tree_id` type: **text** (follows trees.id)
- `tree_comments` row count: **0**
- Constraints: PK `(tree_id, id)`; FK `author_id -> users(id) ON DELETE SET NULL`; FK `tree_id -> trees(id) ON DELETE CASCADE`
- Triggers: none
- RLS: disabled
- Dependent views: none
- Table owner / grants: `neondb_owner` (owner, full privileges). Preserved automatically by ALTER (no relation/ACL change).

**Private information exposure:** NONE. No DB URL, host, user, credential, raw UUID, or row content is recorded here.

---

## 3. Strategy and rationale

**Selected: In-place ALTER (Strategy A).**

Rationale — all conditions satisfied at preflight:

1. Row count = 0 → no data to copy, no DELETE/TRUNCATE needed.
2. Exact legacy 8-column shape confirmed and asserted before ALTER.
3. No risky dependent objects (no triggers, no RLS, no dependent views).
4. Type/PK changes performed safely inside a single transaction with bounded `lock_timeout`/`statement_timeout`.
5. Owner/grants/RLS preserved naturally (ALTER keeps the relation and its ACLs).

**Why not rename + replacement (Strategy B):** unnecessary complexity for a zero-row,
dependency-free table; in-place ALTER keeps the relation OID, indexes, FKs, and grants
intact, which is the safest reversible path here.

**Destructive operation required:** NO. The migration never issues DROP TABLE, TRUNCATE,
or DELETE. Legacy columns are preserved (not dropped). Only `created_at`/`updated_at` are
made NOT NULL, safe only because row count = 0 (NULLs backfilled to `NOW()` before the
NOT NULL switch).

**Rollback:** the migration is a single committed transaction. If the post-verification
block raises, the whole transaction rolls back automatically (atomic). For a committed
apply, rollback is a manual, separately-approved operation (e.g. drop the four added
columns / revert NOT NULL) — out of scope for this artifact and must never be auto-run.

---

## 4. Preflight queries (run read-only BEFORE approval)

```sql
-- 1. Table existence
SELECT to_regclass('public.tree_comments');

-- 2. Exact legacy shape (expect 8 columns, id/tree_id text)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tree_comments'
ORDER BY ordinal_position;

-- 3. trees.id type (must be text)
SELECT data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='trees' AND column_name='id';

-- 4. Constraints / dependencies
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid='public.tree_comments'::regclass;
SELECT count(*) FROM pg_trigger
WHERE tgrelid='public.tree_comments'::regclass AND NOT tgisinternal;  -- expect 0
SELECT relrowsecurity FROM pg_class WHERE oid='public.tree_comments'::regclass;  -- expect f

-- 5. Zero-row guard
SELECT COUNT(*) AS row_count FROM public.tree_comments;  -- must be 0
```

If any preflight fails, **do not apply**. Investigate before proceeding.

---

## 5. Execution approval gate

- [ ] Issue #3418 confirmed `BLOCKED_MIGRATION_REQUIRED`
- [ ] Preflight queries above all pass (8 legacy cols, text keys, 0 rows, no risky deps)
- [ ] Approved change window confirmed
- [ ] Database credential available to an authorized operator only
- [ ] This is a **manual, separately-approved** apply — never automatic / never in CI

---

## 6. Backup / rollback strategy

- Take a schema-only backup before applying:
  ```sh
  pg_dump "$DATABASE_URL" --schema-only --table=public.tree_comments > tree_comments_schema_pre.sql
  ```
- Because row count = 0, no data backup is required, but a full pre-change snapshot is
  recommended per environment policy.
- Rollback (if needed, separately approved): reverse the added columns / NOT NULL switches.
  This artifact does NOT perform rollback automatically.

---

## 7. Migration command format

```sh
psql "$DATABASE_URL" -f scripts/migration-reconcile-tree-comments-legacy-schema.sql
```

The script itself enforces: explicit `BEGIN`, bounded timeouts, a `SHARE ROW EXCLUSIVE`
lock, full preflight assertions, and post-migration verification. It is a safe NO-OP on a
second apply (it detects the reconciled state and does not re-ALTER).

---

## 8. Post-migration schema verification

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tree_comments'
ORDER BY ordinal_position;
-- Expect: id, tree_id, author_id, author_display_name, is_deleted,
--         owner_id (varchar 128, NOT NULL), body (text, NOT NULL),
--         target_kind (varchar 16, NOT NULL), target_id (text),
--         created_at (timestamptz, NOT NULL), updated_at (timestamptz, NOT NULL), payload
```

---

## 9. Smoke test (read path only)

After apply, the public comments GET should no longer raise 42703:

```sh
curl -s "https://<approved-public-endpoint>/modal/private/trees/<publicTreeA>/comments?limit=20"
# Expect 200 with { "comments": [] } for a tree with no comments.
```

Do **not** enable the writer / composer in this step.

---

## 10. Boundary — writer NOT activated here

This reconciliation provisions storage only. The comment writer (`POST`), composer UI,
and #3419 UI work remain explicitly out of scope and must NOT be activated by this
migration. After apply, only the read path is expected to recover.

---

## 11. Failure stop criteria

Abort and do not retry blindly if:

- Preflight reports an unexpected column set, a non-zero row count, or unexpected
  triggers/RLS/dependent views.
- The migration raises `PREFLIGHT FAIL` or `POST-VERIFY FAIL`.
- The apply times out (bounded by `statement_timeout = 30s`, `lock_timeout = 3s`).
- Any post-apply smoke test returns 5xx other than the expected empty-list 200.

---

## 12. Private information

No private information (DB URL, host, user, credential, raw UUID, request ID, dashboard
URL, or row content) is recorded in this runbook.
