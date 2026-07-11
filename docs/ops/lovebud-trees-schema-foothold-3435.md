# LoveBud Trees Schema Foothold — Apply / Runbook

**Issue:** #3435 (schema/data incident), #3433 (production `GET /api/trees` 500)  
**Migration:** `scripts/migration-repair-trees-schema-3435.sql`  
**Status:** Reviewed, post-merge only

---

## 1. Scope

This is a **service-restoration foothold**. It adds 7 nullable compatibility columns to the production `public.trees` table so that the deployed runtime can execute owner-list reads and new tree writes without PostgreSQL undefined-column errors.

This is **NOT** legacy metadata recovery:

- No backfill of `owner_id`, `title`, `visibility`, `group_name`, `keywords`, `created_at`, or `updated_at` for existing rows.
- No synthetic default values (`'My LoveTree'`, `'public'`, `NOW()`, `'{}'`).
- No orphan row creation, deletion, or reassignment.
- No dependent-table mutation (`memories`, `tree_likes`, `tree_comments`, etc.).
- Existing legacy/damaged tree rows remain NULL-metadata distinguishable and unowned.

---

## 2. Pre-apply gate

Before executing the migration on the production database, confirm:

### 2a. Merge and head SHA

- The migration file in the merged commit must match the reviewed SHA.
- `origin/main` must include the approved PR.

### 2b. Production binding identity

Run from a **read-only Modal ephemeral function** or **authorized operator session**:

```sql
SELECT current_database(), current_schema();
```

Confirm output matches the expected production database.

### 2c. Current `trees` fingerprint

Run (read-only, aggregate-safe):

```sql
-- Column inventory
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'trees'
ORDER BY ordinal_position;

-- Row count
SELECT COUNT(*)::int AS trees_rows FROM public.trees;

-- Dependent identity aggregates
SELECT COUNT(DISTINCT tree_id)::int AS distinct_memory_tree_ids FROM memories;
SELECT COUNT(DISTINCT tree_id)::int AS distinct_tree_ids_with_memories
FROM memories m
WHERE EXISTS (SELECT 1 FROM public.trees t WHERE t.id = m.tree_id);
```

**Expected baseline:**

| Metric | Expected |
|---|---|
| `trees` columns | Only `id TEXT PK` |
| `trees` row count | 2 |
| Distinct memory tree IDs | 45 |
| Matching dependent-trees | 0 |
| Orphan identities | 45 |

If any value differs materially, **stop** and do not apply.

### 2d. No concurrent schema operations

Verify no other migration or schema operation is in progress.

---

## 3. Apply procedure

### 3a. Requirements

- `psql` (PostgreSQL client) available.
- `DATABASE_URL` environment variable set to the production connection string.
- Operator has database schema-alter privileges.

### 3b. Execution

```bash
# Apply the reviewed migration exactly once
psql "$DATABASE_URL" -f scripts/migration-repair-trees-schema-3435.sql
```

**If the migration succeeds:** It will print `COMMIT` at the end. Proceed to post-check.

**If the migration fails:** The transaction rolls back automatically (`BEGIN` / `COMMIT`-wrapped). No schema change persists. Diagnose the failure reason from the error message before retrying.

**If the migration times out:** The `lock_timeout` (5s) or `statement_timeout` (30s) is exceeded. The transaction rolls back. Do not retry with increased timeouts without separate review.

### 3c. Guardrails

- Execute the migration **exactly once**. The `IF NOT EXISTS` guards make it idempotent, but re-execution should be avoided unless rollback evidence is confirmed.
- Do not edit the SQL file before or during apply.
- Do not run ad-hoc SQL modifications.

---

## 4. Post-check

After successful application, verify from a **read-only session**:

```sql
-- 7 columns PRESENT with correct types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'trees'
ORDER BY ordinal_position;

-- Row count unchanged
SELECT COUNT(*)::int AS trees_rows FROM public.trees;

-- Dependent row counts unchanged
SELECT COUNT(*)::int AS memories_count FROM memories;
SELECT COUNT(*)::int AS tree_social_counts_count FROM tree_social_counts;

-- Orphan identity aggregate unchanged
SELECT COUNT(DISTINCT m.tree_id)::int AS distinct_memory_tree_ids
FROM memories m
WHERE NOT EXISTS (SELECT 1 FROM public.trees t WHERE t.id = m.tree_id);

-- Existing id PK preserved
SELECT count(*)::int AS id_pk_count
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' AND tc.table_name = 'trees'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND kcu.column_name = 'id';
```

**Expected post-check values:**

| Check | Expected |
|---|---|
| 7 columns present | `owner_id TEXT`, `title TEXT`, `visibility TEXT`, `group_name TEXT`, `keywords TEXT[]`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` |
| All 7 nullable | `is_nullable` = `YES` for all |
| Row count | 2 (unchanged) |
| Dependent counts | Unchanged from pre-apply |
| Orphan count | 45 (unchanged) |
| `id` PK | 1 (preserved) |

Do not output raw row values, IDs, or timestamps.

---

## 5. Runtime verification

After migration and Modal revision parity (if needed):

### 5a. Health check

```text
GET /modal/health → 200
```

### 5b. Public browse

```text
GET /modal/browse/latest?limit=3 → 200
```

Expected: Empty or minimal result set (existing damaged trees have NULL visibility, so they do not appear in public browse).

### 5c. Authenticated tree list

```text
GET /api/trees [signed-in] → 200
```

Expected: HTTP 200 with an empty array `[]` if the authenticated user has no owned trees. This is acceptable — existing legacy trees have NULL `owner_id` and will not appear.

### 5d. Production My Trees screen

A signed-in user opens the production My Trees page and confirms:
- The page loads without HTTP 500.
- The page shows an empty state (no trees) if the user has no owned trees.

**Important:** The existing 2 damaged tree rows have NULL `owner_id`, so they will NOT be listed for any user. This is correct behavior for this foothold. Owner reclamation is a separate policy issue.

---

## 6. New-write verification

Automatic production write smoke is **not** performed by this foothold.

After the migration is applied and runtime verified:

1. A user may optionally create a new tree through the production UI.
2. The new tree should be created successfully with the deployed runtime writing non-NULL values for all 7 columns.
3. The new tree should appear in the user's My Trees list.

This step is at the user's discretion and is not part of this automated procedure.

---

## 7. Rollback / forward strategy

### Migration transaction failure

The migration is wrapped in `BEGIN` / `COMMIT`. If any precondition, type check, or DDL statement fails, the transaction rolls back automatically. No schema change persists.

### Apply succeeded, no new writes yet

If the migration has been applied but no new tree writes have occurred yet:

- A **reviewed reverse operation** is a candidate but is **not automatically approved**. Reverse operation discussion must include:
  - Whether any new writes have occurred
  - Whether any downstream code depends on the new columns
- The `IF NOT EXISTS` guards make the migration idempotent — re-running it is a no-op.

### Apply succeeded, new writes exist

If new tree writes have occurred after migration:

- **Do not drop the columns.** The new writes have populated `owner_id`, `title`, `visibility`, etc., for new trees.
- Downgrading the runtime to a version that does not expect these columns would cause regression.
- Forward recovery: keep the columns, continue normal operation.

### Runtime deployment rollback

If the Modal runtime is rolled back to a pre-foothold revision:

- The database schema still has the 7 columns — this is forward-compatible with older runtime code (older code simply does not use the new columns).
- No DB schema rollback is needed for runtime rollback.
- The old runtime will still fail on the damaged legacy rows (NULL `owner_id`, `visibility`), same as before.

### Orphan data preservation

Under no rollback scenario are orphan dependent rows (memories, likes, comments, social records) deleted or modified. Orphan data policy is a separate issue (#3435, later phase).

---

## 8. Timeout rationale

| Timeout | Value | Rationale |
|---|---|---|
| `lock_timeout` | 5s | Covers schema-level lock acquisition; `ALTER TABLE ADD COLUMN` with 2 rows is near-instant. Prolonged lock wait indicates contention that should block migration. |
| `statement_timeout` | 30s | Covers each individual DDL or metadata query. 30s is ample for `information_schema` queries and `ALTER TABLE` on 2-row table. |

The `DB_STATEMENT_TIMEOUT_MS` setting in `modal_compute/db.py` (20s) is unrelated to this migration execution path (direct `psql` session, not Modal).

---

## 9. Files

| Path | Purpose |
|---|---|
| `scripts/migration-repair-trees-schema-3435.sql` | Migration artifact |
| `tests/contracts/migration-repair-trees-schema-3435-contract.test.cjs` | Static/grammar contract tests |
| `docs/ops/lovebud-trees-schema-foothold-3435.md` | Apply / runbook (this file) |

---

## 10. Issue references

```
Refs #3435
Refs #3433
Refs #3425
Refs #1882
```
