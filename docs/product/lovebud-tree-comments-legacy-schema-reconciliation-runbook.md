# LoveBud Tree Comments Legacy Schema Reconciliation Runbook

> **Issue:** #3423
> **Refs:** #3418 (BLOCKED_MIGRATION_REQUIRED), #3188, #3075, #1882
> **Migration:** `scripts/migration-reconcile-tree-comments-legacy-schema.sql`
> **Rollback:** `scripts/rollback-tree-comments-legacy-reconcile.sql`
> **Contract test:** `tests/contracts/migration-tree-comments-legacy-reconcile-contract.test.cjs`
> **Rollback contract test:** `tests/contracts/rollback-tree-comments-legacy-reconcile-contract.test.cjs`
> **Strategy:** In-place ALTER (Strategy A), fail-closed, transaction-wrapped
> **Destructive operations:** NONE unconditionally. The migration never issues DROP TABLE / TRUNCATE / DELETE. The conditional rollback drops only the 4 canonical columns and 3 migration-added indexes, under a zero-row exact-state guard (no CASCADE).

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
None of these exist on the production `public.tree_comments` table. The reader failure
manifests as SQLSTATE 42703 (UndefinedColumn: column "body" does not exist).

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

**Verdict:** `MIGRATION_REQUIRED`.

---

## 2. Production metadata (approved read-only inspection)

- `trees.id` type: **text** (NOT uuid)
- `tree_comments.tree_id` type: **text** (follows trees.id)
- `tree_comments` row count: **0**
- Constraints: PK `(tree_id, id)`; FK `author_id -> users(id) ON DELETE SET NULL`; FK `tree_id -> trees(id) ON DELETE CASCADE`
- Triggers: none
- RLS: disabled
- Dependent views: none
- Table ownership and ACLs are preserved by in-place ALTER (no relation/ACL change performed by this migration).

**Private information exposure:** NONE. No DB URL, host, user, credential, raw UUID, or row content is recorded here.

---

## 2b. Corrected production evidence (Issue #3431)

> The previously recorded compound-index assumption was **incorrect**. A later
> approved read-only preflight confirmed the production legacy `tree_comments`
> table has **zero non-primary (secondary) indexes** — the assumed compound
> `(tree_id, created_at)` index does not exist. No production mutation occurred
> during this discovery. The migration and rollback were corrected (this PR) to
> match the real zero-secondary-index production state: the reconciliation creates
> only the three canonical secondary indexes and no compound index, and rollback
> restores the exact legacy zero-secondary-index state.

---

## 3. Strategy and rationale

**Selected: In-place ALTER (Strategy A).**

Rationale — all conditions satisfied at preflight:

1. Row count = 0 → no data to copy, no DELETE/TRUNCATE needed.
2. Exact legacy 8-column shape confirmed and asserted before ALTER.
3. No risky dependent objects (no triggers, no RLS, no dependent views, no unexpected inbound FK).
4. Type/PK changes performed safely inside a single transaction with bounded `lock_timeout`/`statement_timeout`.
5. Existing table ownership and ACLs are preserved naturally by in-place ALTER.

**Why not rename + replacement (Strategy B):** unnecessary complexity for a zero-row,
dependency-free table; in-place ALTER keeps the relation OID, indexes, FKs, and grants
intact, which is the safest reversible path here.

**Destructive operation required:** NO. The migration never issues DROP TABLE, TRUNCATE,
DELETE, or DROP COLUMN. Legacy columns are preserved (never dropped). `created_at`/
`updated_at` become NOT NULL with `DEFAULT NOW()` — safe because row count = 0 (no
backfill UPDATE, no sentinel values).

**Primary key conversion:** the legacy PK `(tree_id, id)` is dropped (only the known
`tree_comments_pkey` constraint, read from the catalog) and replaced with `PRIMARY KEY (id)`. The writer replays
by `WHERE id = %s`, so `id` must be DB-level unique.

**Legacy secondary index:** approved read-only preflight confirmed the production
legacy `tree_comments` table has **zero non-primary (secondary) indexes**. The
previously assumed compound `(tree_id, created_at)` legacy index does **not**
exist in production. The reconciliation therefore creates only the three canonical
secondary indexes and **no** compound index.

**Migration-added indexes:** the migration creates three canonical read indexes —
`idx_tree_comments_tree_id` on `(tree_id)`,
`idx_tree_comments_owner_id` on `(owner_id)`, and
`idx_tree_comments_created_at` on `(created_at)`. The compound
`(tree_id, created_at)` index is **not** created. The single-column
`idx_tree_comments_tree_id` is **a canonical migration-added index, not a legacy
index**; it is removed by the rollback.

**Reconciled total index count = 4:** 1 primary backing index `(id)` + 3 secondary
indexes (the three canonical `(tree_id)` / `(owner_id)` / `(created_at)`). Each
secondary index is verified by its ordered key array, uniqueness, non-partial /
non-expression status, and absence of INCLUDE columns (`indnkeyatts = indnatts`);
the migration-added indexes are also verified by exact name. The legacy state
instead allows **exactly zero** secondary indexes and rejects any single-column
`tree_id` / `owner_id` / `created_at`, compound, partial, expression, unique, or
INCLUDE index. The legacy unexpected-index guard fails closed on any non-primary
index (total secondary count = 0).

**Exact reconciled-state validator (`_lb_reconciled_validator()`):** the migration
runs this top-level function (dropped before `COMMIT`) both *before* the reconciled
`PREFLIGHT STOP` and again in post-verification. It is the authoritative exact check
and verifies, inside a single transaction:

- all 12 columns with exact metadata (types / UDTs / nullability / defaults),
  including `target_id` having **no default** (`column_default IS NULL`);
- the runtime **`public.trees.id` guard** (`text` / `text` / `NO`) — so the STOP path
  also aborts when the parent key type is incompatible;
- PRIMARY KEY exactly `[id]`;
- exactly **2 FKs** via catalog `conkey`/`confkey`/`confrelid`/`confdeltype`;
- exactly **2 CHECK definitions** verified by their catalog expressions —
  `target_kind = 'tree'` and `target_id IS NULL OR target_id = tree_id` (not a
  count-only check);
- the **exact total constraint set of 5** (1 PK + 2 FK + 2 CHECK) with **0 UNIQUE /
  0 EXCLUDE / 0 other** constraint types;
- **0 inbound FK** referencing `tree_comments`;
- the exact **4-index inventory** described above (PK `(id)` + 3 canonical secondary,
  compound = 0, unexpected = 0);
- no triggers / RLS / dependent views / materialized views.

A malformed 12-column table (name-only match) fails the validator and raises
`PREFLIGHT FAIL: 12-column schema is not exact reconciled state`, so the reconciled
STOP is reached only when the entire canonical shape matches exactly.

**Rollback / validator contract consistency:** the rollback preflight uses the same
contract — exact 12-column metadata, exact 5-constraint set, exact CHECK definitions,
0 inbound FK, `trees.id` text, exact 4-index inventory (PK `(id)` + 3 canonical
secondary, compound = 0, unexpected = 0), and no triggers/RLS/views/
matviews — so the two scripts agree on what "reconciled" means.

**Rollback:** the migration is a single committed transaction. If the post-verification
block raises, the whole transaction rolls back automatically (atomic) — no partial ALTER
is committed. For a committed apply that fails post-schema verification or API smoke,
the dedicated rollback script `scripts/rollback-tree-comments-legacy-reconcile.sql`
reverts the reconciled schema to the exact legacy 8-column shape. The rollback script:

- is a separate, explicitly-approved operation (never auto-run);
- fails closed unless the table is in the exact reconciled shape with row count = 0;
- drops only the 4 canonical columns and the 3 migration-added indexes
  (`idx_tree_comments_tree_id`, `idx_tree_comments_owner_id`,
  `idx_tree_comments_created_at`);
- restores the legacy composite PK `(tree_id, id)` from the catalog (no name guessing);
- restores the exact legacy **zero-secondary-index** state (no compound index is
  preserved or dropped, because none exists);
- uses no CASCADE, no DELETE/TRUNCATE, and embeds no credentials.

If the rollback preconditions are not met (data present, writer/composer active, or
unexpected schema), automatic rollback is forbidden and #3418 stays open.

---

## 4. Re-run policy (explicit stop, NOT silent NO-OP)

A second execution is **not** a success "no-op":

- **exact legacy schema** → migration runs (adds canonical columns, converts PK).
- **already reconciled schema** → migration raises
  `PREFLIGHT STOP: tree_comments already reconciled`
  and aborts **without changing anything**.
- **partial / unexpected schema** → migration raises `PREFLIGHT FAIL` and aborts **without
  changing anything**.

---

## 5. Preflight queries (run read-only BEFORE approval)

```sql
-- 1. Table existence
SELECT to_regclass('public.tree_comments');

-- 2. Exact legacy shape (expect 8 columns, id/tree_id text)
SELECT column_name, data_type, udt_name, is_nullable, column_default
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

## 6. Execution approval gate

- [ ] Issue #3418 confirmed `BLOCKED_MIGRATION_REQUIRED`
- [ ] Preflight queries above all pass (8 legacy cols, text keys, 0 rows, no risky deps)
- [ ] Approved change window confirmed
- [ ] Database credential available to an authorized operator only
- [ ] This is a **manual, separately-approved** apply — never automatic / never in CI

---

## 7. Backup / rollback strategy

- Take a schema-only backup before applying:
  ```sh
  pg_dump "$DATABASE_URL" --schema-only --table=public.tree_comments > tree_comments_schema_pre.sql
  ```
- Because row count = 0, no data backup is required, but a full pre-change snapshot is
  recommended per environment policy.
- Existing table ownership and ACLs are preserved by in-place ALTER.
- Rollback (if needed, separately approved): reverse the added columns / NOT NULL switches /
  PK. This artifact does NOT perform rollback automatically.

---

## 8. Migration command format

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migration-reconcile-tree-comments-legacy-schema.sql
```

The `-v ON_ERROR_STOP=1` flag is REQUIRED (do not use the bare single-line form that
omits `-v ON_ERROR_STOP=1`). On any SQL error psql exits non-zero immediately. The whole script is wrapped
in a single transaction (`BEGIN` … `COMMIT`), so the abort rolls the transaction
back. Without `ON_ERROR_STOP=1`, psql would keep executing later statements and could
end with exit 0, misreporting a failure as success. On command failure the rollback
script is NOT run automatically — first confirm the transaction was rolled back, then
run the rollback script (section 11) only as a separate, explicitly-approved step.

The script itself enforces: explicit `BEGIN`, bounded timeouts, a `SHARE ROW EXCLUSIVE`
lock, full preflight assertions, and post-migration verification. On a second apply it
raises `PREFLIGHT STOP: tree_comments already reconciled` (explicit stop, not a silent
NO-OP).

---

## 9. Post-migration schema verification

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tree_comments'
ORDER BY ordinal_position;
-- Expect 12 columns: id (text PK), tree_id (text FK), author_id (text NULL),
--   author_display_name (text NULL), is_deleted (bool NOT NULL),
--   owner_id (varchar 128 NOT NULL), body (text NOT NULL),
--   target_kind (varchar 16 NOT NULL DEFAULT 'tree'), target_id (text),
--   created_at (timestamptz NOT NULL DEFAULT NOW()),
--   updated_at (timestamptz NOT NULL DEFAULT NOW()), payload (jsonb NOT NULL)
```

---

## 10. Static verification only (no Docker / no local PostgreSQL / no executable rehearsal)

This reconciliation was prepared with **source-level static verification only**:

- No Docker container was used.
- No local PostgreSQL instance was installed or run.
- No temporary/disposable PostgreSQL service was created.
- No executable rehearsal (PG17 / Docker) was performed.
- No connection to Neon production or any shared database was opened.

Verification consists of the contract tests (migration + rollback), the existing
tree-comments migration contract, the Python reader test, the route implementation
contract, the client adapter contract, `npm run lint` / `npm run build` /
`npm run verify`, and the Node.js `--test` contract suite. The normalizer behavior is
verified only by the pure-JS mirror tests; the SQL/PLpgSQL behavior remains static-only.

pglast: NOT RUN on this final head
actual PostgreSQL execution: NO
normalizer behavior: pure-JS mirror tests
SQL/PLpgSQL behavior remains static-only until approved DB execution

**Limitation: the pure-JS normalizer mirror tests do not validate PL/pgSQL variable
declarations.** A dollar-quoted `DO $$ ... $$` block or `CREATE FUNCTION ... AS $$ ... $$`
may be modeled correctly at the top-level SQL grammar level while a used variable is
missing from that block's `DECLARE` section. Only actual PostgreSQL execution (or a
PL/pgSQL-aware static analyzer) can catch undeclared-variable errors. The contract
tests explicitly verify declaration presence for all `v_*` variables used in each
PL/pgSQL block.

**The actual DB migration/rollback was NOT executed in this step — no
Neon production/staging execution.**

The final production schema verification and API smoke test are performed only inside
an approved Neon production change window, as a separate approved task after this PR is
merged. This choice carries operational-apply risk, so the rollback script and the
zero-row guard are mandatory preparation.

---

## 11. Rollback procedure (separate, explicitly-approved task)

If post-schema verification or the API smoke test fails after the migration is applied
to Neon production, run the rollback script **only** when all preconditions hold:

- `tree_comments` row count = 0
- writer / composer still disabled
- exact reconciled schema present
- no unexpected dependencies

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/rollback-tree-comments-legacy-reconcile.sql
```

After rollback, read-only confirm: exact legacy 8-column schema, legacy composite PK
`(tree_id, id)`, existing FKs/indexes, no added canonical columns, row count = 0.
Keep #3418 open and report the failure cause.

---

## 12. Smoke test (read path only)

After apply (in the approved change window), the public comments GET should no longer
raise 42703:

```sh
curl -s "https://<approved-public-endpoint>/modal/private/trees/<publicTreeA>/comments?limit=20"
# Expect 200 with { "comments": [] } for a tree with no comments.
```

Do **not** enable the writer / composer in this step.

---

## 13. Boundary — writer NOT activated here

This reconciliation provisions storage only. The comment writer (`POST`), composer UI,
and #3419 UI work remain explicitly out of scope and must NOT be activated by this
migration. After apply, only the read path is expected to recover.

---

## 14. Failure stop criteria

Abort and do not retry blindly if:

- Preflight reports an unexpected column set, a non-zero row count, or unexpected
  triggers/RLS/dependent views / inbound FK.
- The migration raises `PREFLIGHT FAIL` or `PREFLIGHT STOP` or `POST-VERIFY FAIL`.
- The apply times out (bounded by `statement_timeout = 30s`, `lock_timeout = 3s`).
- Any post-apply smoke test returns 5xx other than the expected empty-list 200.

---

## 15. Private information

No private information (DB URL, host, user, credential, raw UUID, request ID, dashboard
URL, or row content) is recorded in this runbook.
