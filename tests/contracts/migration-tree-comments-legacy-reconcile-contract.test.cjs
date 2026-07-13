/**
 * Contract tests for the tree-level comment legacy-schema reconciliation migration
 * (Issue #3423).
 *
 * These tests verify that scripts/migration-reconcile-tree-comments-legacy-schema.sql
 * safely reconciles the production legacy `public.tree_comments` table (observed via
 * approved read-only inspection) to the canonical tree-comment contract WITHOUT
 * executing any SQL, opening a database connection, or applying to production/staging.
 *
 * Source-level assertions only. No database connection, psql, subprocess, git diff, or
 * git status is used. No raw/private values are asserted.
 *
 * The reader needs `body`; the writer additionally needs `owner_id`, `target_kind`,
 * `target_id`. None of these exist on the production `public.tree_comments` table,
 * producing SQLSTATE 42703 (UndefinedColumn: column "body" does not exist).
 *
 * Refs: #3423, #3418, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-reconcile-tree-comments-legacy-schema.sql');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

const sql = readFile(MIGRATION_PATH);
const content = stripSqlComments(sql);

// Extract the exact reconciled-state validator body so assertions can require the
// checks to live INSIDE the validator, not just somewhere in the file (e.g. comments).
const validatorBody = (() => {
  const m = sql.match(/CREATE FUNCTION _lb_reconciled_validator[\s\S]*?\$\$ LANGUAGE plpgsql;/i);
  return m ? m[0] : '';
})();
assert.ok(validatorBody.length > 0, 'Validator function body must be extractable');

// Extract the legacy preflight index section to assert the unexpected-index query
// is per-index (no uncorrelated global NOT EXISTS).
const preflightLegacyIndexSection = (() => {
  const start = sql.indexOf('Step 11: Exact legacy index inventory');
  const end = sql.indexOf('Step 12:', start);
  if (start < 0) return '';
  return end < 0 ? sql.slice(start) : sql.slice(start, end);
})();
assert.ok(preflightLegacyIndexSection.length > 0, 'Legacy preflight index section must be extractable');

// ─── 1. Migration artifact exists and is transactional / guarded ─────────────

test('reconcile migration SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
});

test('reconcile migration wraps changes in an explicit transaction', () => {
  assert.ok(/^\s*BEGIN\s*;/im.test(sql), 'Must start with explicit BEGIN');
  assert.ok(/^\s*COMMIT\s*;/im.test(sql), 'Must end with explicit COMMIT');
});

test('reconcile migration sets bounded lock_timeout and statement_timeout', () => {
  assert.match(sql, /SET\s+LOCAL\s+lock_timeout\s*=\s*'3s'/i, 'Must set bounded lock_timeout');
  assert.match(sql, /SET\s+LOCAL\s+statement_timeout\s*=\s*'30s'/i, 'Must set bounded statement_timeout');
});

test('reconcile migration takes a safe bounded table lock', () => {
  assert.match(
    sql,
    /LOCK\s+TABLE\s+public\.tree_comments\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i,
    'Must take SHARE ROW EXCLUSIVE lock on tree_comments'
  );
});

// ─── 2. Destructive-operation prohibition ───────────────────────────────────

test('reconcile migration does not DROP TABLE', () => {
  assert.equal(content.includes('DROP TABLE'), false, 'Must not DROP TABLE');
});

test('reconcile migration does not TRUNCATE', () => {
  assert.equal(content.includes('TRUNCATE'), false, 'Must not TRUNCATE');
});

test('reconcile migration does not DELETE rows from tree_comments', () => {
  assert.equal(/DELETE\s+FROM\s+tree_comments/i.test(content), false, 'Must not DELETE FROM tree_comments');
  assert.equal(/DELETE\s+FROM\s+public\.tree_comments/i.test(content), false, 'Must not DELETE FROM public.tree_comments');
});

test('reconcile migration does not DROP any column (legacy preserved, never dropped)', () => {
  assert.equal(/DROP\s+COLUMN/i.test(content), false, 'Must not DROP COLUMN (legacy columns preserved)');
});

test('reconcile migration does not embed a connection string or auto-apply', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/createdb|pg_restore|automatically applied|auto-?apply/i.test(sql), false, 'Must not auto-apply');
});

test('reconcile migration does not use invalid ADD CONSTRAINT IF NOT EXISTS syntax', () => {
  assert.equal(
    /ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS/i.test(sql),
    false,
    'PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS; use explicit ADD CONSTRAINT instead'
  );
});

// ─── 3. Re-run state classifier (reconciled / legacy / partial, exclusive) ───

test('reconcile migration classifies reconciled/legacy/partial before legacy-only enforcement', () => {
  // Exclusive state classifier: exact 12-col reconciled, exact 8-col legacy, else fail.
  assert.match(sql, /v_total_cols\s*=\s*12\s+AND\s+v_legacy_markers\s*=\s*8\s+AND\s+v_canon_extra\s*=\s*4/i,
    'Must classify exact reconciled 12-column shape');
  assert.match(sql, /v_total_cols\s*=\s*8\s+AND\s+v_legacy_markers\s*=\s*8\s+AND\s+v_canon_extra\s*=\s*0/i,
    'Must classify exact legacy 8-column shape');
});

test('reconcile migration reconciled STOP is reachable BEFORE detailed legacy metadata checks', () => {
  // The reconciled STOP must appear before the legacy id/tree_id type assertions so a
  // 12-column reconciled table hits the explicit STOP instead of a spurious count failure.
  const stopIdx = sql.indexOf('PREFLIGHT STOP: tree_comments already reconciled');
  const legacyIdTypeIdx = sql.indexOf('id expected text/text NOT NULL with no default');
  const legacyPkIdx = sql.indexOf('legacy PRIMARY KEY must be exactly [tree_id, id]');
  assert.ok(stopIdx > 0, 'STOP branch must exist');
  assert.ok(legacyIdTypeIdx > 0, 'legacy id metadata assertion must exist');
  assert.ok(legacyPkIdx > 0, 'legacy PK assertion must exist');
  assert.ok(stopIdx < legacyIdTypeIdx, 'reconciled STOP must precede legacy id metadata assertion');
  assert.ok(stopIdx < legacyPkIdx, 'reconciled STOP must precede legacy PK enforcement');
});

test('reconcile migration does NOT enforce a legacy-only column count before classification', () => {
  // The old failing pattern "legacy column count ... expected 8" ran before canonical
  // discrimination and made the reconciled STOP unreachable. It must be gone.
  assert.equal(/legacy\s+column\s+count[^\n]*expected\s+8/i.test(sql), false,
    'Must NOT enforce a standalone legacy column-count=8 check before state classification');
});

test('reconcile migration does NOT STOP on 12-column names without exact canonical validation', () => {
  // A malformed 12-column table must NOT silently STOP. The STOP must be
  // reached only AFTER the exact reconciled-state validator passes.
  assert.equal(/12-column schema is not exact reconciled/i.test(sql), true,
    'Must distinguish a 12-column name-only state (fail closed) from exact reconciled');
  assert.match(sql, /_lb_reconciled_validator\(\)/, 'Must define/call the exact reconciled-state validator');
  const stopIdx = sql.indexOf("RAISE EXCEPTION 'PREFLIGHT STOP: tree_comments already reconciled");
  const validIdx = sql.indexOf('candidate_reconciled: run the FULL exact canonical validation BEFORE the STOP');
  assert.ok(stopIdx > 0 && validIdx > 0, 'STOP and validator call must both exist');
  assert.ok(validIdx < stopIdx, 'Exact canonical validation must run before the explicit STOP');
});

test('reconcile migration asserts zero non-primary legacy secondary indexes (corrected)', () => {
  // Approved read-only preflight confirmed the production legacy table has ZERO
  // non-primary secondary indexes. The previously assumed compound (tree_id,
  // created_at) legacy index does NOT exist.
  assert.match(sql, /legacy secondary index count must be exactly 0/i,
    'Must require exactly zero legacy secondary indexes');
  // No compound legacy index assumption / preservation language remains.
  assert.equal(/legacy compound index \(tree_id, created_at\)/i.test(sql), false,
    'Must NOT reference a legacy compound index assumption');
  assert.equal(/legacy secondary index count must be exactly 1/i.test(sql), false,
    'Must NOT require exactly one legacy secondary index');
  assert.equal(/unexpected legacy secondary index present/i.test(sql), false,
    'Old compound-based single-column guard must be removed');
});

test('reconcile migration fails closed on any non-primary secondary index', () => {
  // The preflight must fail closed whenever v_secondary_total <> 0 (any single-column,
  // compound, unique, partial, expression, INCLUDE, or other secondary index).
  assert.match(sql, /PREFLIGHT FAIL: legacy secondary index count must be exactly 0/i,
    'Legacy preflight must fail closed when any secondary index is present');
});

test('reconcile migration post-verification checks exact index inventory (no compound)', () => {
  assert.match(sql, /final exact reconciled-state validation/i, 'Post-verify must run the exact-state validator');
  assert.match(sql, /expected PK backing \(id\) \+ 3 canonical secondary indexes \+ NO compound/i,
    'Post-verify must assert the corrected index inventory (PK + 3 canonical, compound = 0)');
  // The single-column tree_id index is CREATED by the migration (canonical), not legacy.
  assert.match(sql, /idx_tree_comments_tree_id ON public\.tree_comments\(tree_id\)/i,
    'Migration must create the canonical single-column tree_id index');
  // No compound (tree_id, created_at) index is created.
  assert.equal(/CREATE\s+INDEX[^;]*tree_id,\s*created_at/i.test(sql), false,
    'Must NOT CREATE a compound (tree_id, created_at) index');
});

// ─── 3b. Exact reconciled-state validator (inside _lb_reconciled_validator) ───

test('reconcile validator verifies target_id default NULL (not just nullable)', () => {
  // Must check column_default IS NULL for the target_id column (not only is_nullable).
  assert.match(validatorBody, /column_name='target_id'[\s\S]*?column_default IS NULL/i,
    'Validator must assert target_id has no default (column_default IS NULL)');
});

test('reconcile validator verifies public.trees.id guard (STOP path coverage)', () => {
  assert.match(validatorBody, /table_name='trees' AND column_name='id'/i,
    'Validator must query public.trees.id metadata');
  assert.match(validatorBody, /trees\.id/i, 'Validator must reference the trees.id guard');
  assert.match(validatorBody,
    /v_trees_id_type IS NULL OR v_trees_id_type <> 'text' OR v_trees_id_udt <> 'text' OR v_trees_id_null <> 'NO'/i,
    'Validator must fail closed when trees.id is not text/text/NO');
});

test('reconcile validator verifies exact CHECK definitions (not count-only)', () => {
  // Must check BOTH catalog CHECK definitions via exact normalized expression comparison,
  // not a substring ILIKE match. The normalizer strips casts/parens/whitespace.
  assert.match(validatorBody, /_lb_norm_check\(pg_get_constraintdef\(c\.oid\)\) = 'target_kind = ''tree'''/i,
    'Validator must check target_kind = tree CHECK definition via exact normalized comparison');
  assert.match(validatorBody, /_lb_norm_check\(pg_get_constraintdef\(c\.oid\)\) = 'target_id is null or target_id = tree_id'/i,
    'Validator must check target_id/tree_id CHECK definition via exact normalized comparison');
  // Forbid a validator that only counts CHECKs (count <> 2 style) without definitions.
  assert.equal(/contype='c'[\s\S]*?\n\s*IF v_c2 <> 2/i.test(validatorBody), false,
    'Validator must not rely on a CHECK count-only guard');
});

test('reconcile validator verifies exact total constraint count = 5', () => {
  assert.match(validatorBody, /v_total_con <> 5/i, 'Validator must assert total constraints = 5');
  assert.match(validatorBody, /v_u <> 0/i, 'Validator must reject UNIQUE constraints');
  assert.match(validatorBody, /v_x <> 0/i, 'Validator must reject EXCLUDE constraints');
  assert.match(validatorBody, /contype NOT IN \('p','f','c','u','x'\)/i, 'Validator must reject any other constraint type');
});

test('reconcile validator checks inbound FK = 0 (inside the validator)', () => {
  assert.match(validatorBody, /confrelid='public\.tree_comments'::regclass/i,
    'Validator must check for inbound FKs referencing tree_comments');
  assert.match(validatorBody, /inbound_fk=/i, 'Validator must record the inbound FK count in its message');
});

test('reconcile validator verifies reconciled total index count = 4 (no compound)', () => {
  // 1 primary + 3 secondary (3 canonical migration-added, NO compound legacy).
  assert.match(validatorBody, /v_i1 <> 1 OR v_is <> 3/i, 'Validator must assert 1 primary + 3 secondary = 4 total');
  assert.match(validatorBody, /v_i2 <> 0 OR v_i3 <> 1 OR v_i4 <> 1 OR v_i5 <> 1 OR v_iu <> 0/i,
    'Validator must assert the 3 canonical secondary indexes (compound v_i2 = 0) and no unexpected');
  // Per-index attributes: non-partial / non-expression / no INCLUDE columns.
  assert.match(validatorBody, /indpred IS NULL/i, 'Validator must reject partial indexes');
  assert.match(validatorBody, /indexprs IS NULL/i, 'Validator must reject expression indexes');
  assert.match(validatorBody, /indnkeyatts\s*(=|<>)+\s*i\.indnatts/i, 'Validator must reject INCLUDE-column indexes');
});

test('reconcile validator uses exact normalized comparison for target_kind default (no substring)', () => {
  // Must NOT use column_default ILIKE '%tree%' substring; must use exact normalized.
  assert.match(validatorBody, /_lb_norm_default\(column_default\) = 'tree'/i,
    'Validator must check target_kind default via exact normalized comparison');
  assert.equal(/column_default ILIKE/i.test(validatorBody), false,
    'Validator must not use ILIKE substring matching for any default or CHECK');
});

test('reconcile validator uses exact normalized comparison for created_at / updated_at defaults', () => {
  assert.match(validatorBody, /_lb_norm_default\(column_default\) = 'now\(\)'/i,
    'Validator must check created_at default via exact normalized comparison');
});

test('reconcile migration post-verify uses exact normalized comparison for defaults', () => {
  assert.match(sql, /_lb_norm_default\(column_default\) = 'tree'/i,
    'Post-verify must check target_kind default via exact normalized comparison');
  assert.match(sql, /_lb_norm_default\(column_default\) = 'now\(\)'/i,
    'Post-verify must check created_at/updated_at defaults via exact normalized comparison');
  // The sentinel-rejection check (post-verify lines) may still use ILIKE, which is
  // acceptable — it rejects disallowed patterns rather than verifying an exact value.
  // Only the exact-validation sections (CHECK definitions, defaults) must use exact
  // comparison. These live in the validator body and are already covered above.
});

test('reconcile migration creates and drops purpose-specific normalizers', () => {
  assert.match(sql, /CREATE FUNCTION _lb_norm_default\(p_expr text\)/i,
    'Migration must create the _lb_norm_default normalizer function');
  assert.match(sql, /CREATE FUNCTION _lb_norm_check\(p_expr text\)/i,
    'Migration must create the _lb_norm_check normalizer function');
  assert.match(sql, /DROP FUNCTION IF EXISTS _lb_norm_default\(text\);/i,
    'Migration must drop the _lb_norm_default function before COMMIT');
  assert.match(sql, /DROP FUNCTION IF EXISTS _lb_norm_check\(text\);/i,
    'Migration must drop the _lb_norm_check function before COMMIT');
  // The shared default/CHECK normalizer must be gone (split per purpose).
  assert.equal(/_lb_norm_expr/.test(sql), false,
    'Migration must no longer define the shared _lb_norm_expr normalizer');
});

test('reconcile migration uses _lb_norm_default for defaults and _lb_norm_check for CHECKs', () => {
  // Defaults
  assert.match(sql, /_lb_norm_default\(column_default\) = 'tree'/i,
    'target_kind default must use _lb_norm_default');
  assert.match(sql, /_lb_norm_default\(column_default\) = 'now\(\)'/i,
    'created_at/updated_at defaults must use _lb_norm_default');
  // CHECKs
  assert.match(sql, /_lb_norm_check\(pg_get_constraintdef\(c?\.?oid\)\) = 'target_kind = ''tree'''/i,
    'target_kind CHECK must use _lb_norm_check');
  assert.match(sql, /_lb_norm_check\(pg_get_constraintdef\(c?\.?oid\)\) = 'target_id is null or target_id = tree_id'/i,
    'target_id/tree_id CHECK must use _lb_norm_check');
  // The shared normalizer must not be used anywhere.
  assert.equal(/_lb_norm_expr/.test(sql), false,
    'Must not use the shared _lb_norm_expr normalizer for any comparison');
});

// ─── 3c. Legacy preflight index guard (no uncorrelated global NOT EXISTS) ───

test('reconcile legacy preflight requires exactly zero secondary indexes (corrected)', () => {
  assert.match(preflightLegacyIndexSection, /v_secondary_total/i, 'Legacy preflight must count total secondary indexes');
  assert.match(preflightLegacyIndexSection, /legacy secondary index count must be exactly 0/i,
    'Legacy preflight must require exactly 0 secondary indexes');
  assert.equal(/legacy secondary index count must be exactly 1/i.test(preflightLegacyIndexSection), false,
    'Legacy preflight must NOT require exactly 1 secondary index');
});

test('reconcile legacy preflight unexpected-index query is per-index (no global NOT EXISTS)', () => {
  // The buggy uncorrelated query `NOT EXISTS (SELECT 1 FROM pg_index j ...)` must be gone.
  assert.equal(/FROM pg_index j/i.test(preflightLegacyIndexSection), false,
    'Legacy preflight must not use an uncorrelated global NOT EXISTS over pg_index j');
  // Any non-primary secondary index (single-column / compound / partial / expression /
  // unique / INCLUDE / other) must trigger fail-closed via the total count guard.
  assert.match(preflightLegacyIndexSection, /PREFLIGHT FAIL: legacy secondary index count must be exactly 0/i,
    'Legacy preflight must fail closed on any non-primary secondary index');
  // The corrected guard counts the total non-primary index count and rejects any > 0.
  assert.match(preflightLegacyIndexSection, /v_secondary_total <> 0/i,
    'Legacy preflight must fail closed via the total secondary count guard');
});

// ─── 4. Exact eight-column legacy metadata (type/udt/nullable/default) ───────

test('reconcile migration references all eight legacy columns', () => {
  for (const col of ['id', 'tree_id', 'author_id', 'author_display_name', 'is_deleted', 'created_at', 'updated_at', 'payload']) {
    assert.ok(
      new RegExp(`column_name='${col}'`, 'i').test(sql),
      `Preflight must reference legacy column ${col}`
    );
  }
});

test('reconcile migration asserts exact legacy column metadata (type/udt/nullable/default)', () => {
  assert.match(sql, /id expected text\/text NOT NULL with no default/i, 'Must assert id = text NOT NULL, no default');
  assert.match(sql, /tree_id expected text\/text NOT NULL with no default/i, 'Must assert tree_id = text NOT NULL, no default');
  assert.match(sql, /author_id expected text NULL with no default/i, 'Must assert author_id = text NULL, no default');
  assert.match(sql, /author_display_name expected text NULL with no default/i, 'Must assert author_display_name = text NULL, no default');
  assert.match(sql, /is_deleted expected boolean NOT NULL DEFAULT false/i, 'Must assert is_deleted default false');
  assert.match(sql, /created_at expected timestamptz NULL with no default/i, 'Must assert created_at = timestamptz NULL, no default');
  assert.match(sql, /updated_at expected timestamptz NULL with no default/i, 'Must assert updated_at = timestamptz NULL, no default');
  assert.match(sql, /payload expected jsonb NOT NULL DEFAULT/i, 'Must assert payload = jsonb NOT NULL DEFAULT');
});

test('reconcile migration asserts default absence for nullable legacy columns via column_default IS NULL', () => {
  // author_id / author_display_name / created_at / updated_at must assert no default.
  assert.match(sql, /author_id[\s\S]*?is_nullable='YES'\s+AND\s+column_default IS NULL/i, 'author_id must assert no default');
  assert.match(sql, /created_at[\s\S]*?is_nullable='YES'\s+AND\s+column_default IS NULL/i, 'created_at must assert no default');
  assert.match(sql, /updated_at[\s\S]*?is_nullable='YES'\s+AND\s+column_default IS NULL/i, 'updated_at must assert no default');
  // id / tree_id likewise assert no default.
  assert.match(sql, /v_id_def IS NOT NULL/i, 'id must assert column_default IS NULL');
  assert.match(sql, /v_tree_id_def IS NOT NULL/i, 'tree_id must assert column_default IS NULL');
});

test('reconcile migration asserts table existence', () => {
  assert.match(sql, /tree_comments table existence/i, 'Must assert table existence in preflight');
});

// ─── 5. Runtime public.trees.id guard ────────────────────────────────────────

test('reconcile migration runtime-asserts public.trees.id is text', () => {
  assert.match(
    sql,
    /table_schema\s*=\s*'public'\s+AND\s+table_name\s*=\s*'trees'\s+AND\s+column_name\s*=\s*'id'/i,
    'Must query information_schema.columns for public.trees.id metadata'
  );
  assert.match(sql, /PREFLIGHT FAIL: public\.trees\.id must be text/i, 'Must fail closed if trees.id is not text');
});

// ─── 6. Exact PK / FK guard (catalog arrays, not string matching) ────────────

test('reconcile migration compares legacy PK via conkey/attnum array, not ILIKE', () => {
  assert.match(sql, /unnest\(c\.conkey\)\s+WITH\s+ORDINALITY/i, 'Must derive PK columns from conkey ordinality');
  assert.match(sql, /pg_attribute a ON a\.attrelid = c\.conrelid AND a\.attnum/i, 'Must join pg_attribute on attnum');
  assert.match(sql, /ARRAY\['tree_id','id'\]::text\[\]/i, 'Must compare PK to exact [tree_id, id] array');
  assert.match(sql, /legacy PRIMARY KEY must be exactly \[tree_id, id\]/i, 'Must fail closed unless PK is exactly [tree_id, id]');
  // The loose string match must not be used for PK discrimination (ignore comments).
  assert.equal(/ILIKE\s+'%tree_id%id%'/i.test(content), false, "Must NOT use ILIKE '%tree_id%id%' for PK discrimination");
});

test('reconcile migration verifies exact legacy FKs via conkey/confkey/confrelid/confdeltype', () => {
  assert.match(sql, /c\.confrelid\s*=\s*'public\.trees'::regclass/i, 'Must verify tree FK references public.trees');
  assert.match(sql, /c\.confrelid\s*=\s*'public\.users'::regclass/i, 'Must verify author FK references public.users');
  assert.match(sql, /c\.confdeltype\s*=\s*'c'/i, 'Must verify ON DELETE CASCADE via confdeltype=c');
  assert.match(sql, /c\.confdeltype\s*=\s*'n'/i, 'Must verify ON DELETE SET NULL via confdeltype=n');
  assert.match(sql, /FK tree_id -> public\.trees\(id\) ON DELETE CASCADE not found\/exact/i, 'Must fail closed on tree FK mismatch');
  assert.match(sql, /FK author_id -> public\.users\(id\) ON DELETE SET NULL not found\/exact/i, 'Must fail closed on author FK mismatch');
});

test('reconcile migration enforces exact allowed constraint set (1 PK + 2 FK, nothing else)', () => {
  assert.match(sql, /legacy constraint set must be exactly 3 \(1 PK \+ 2 FK\)/i, 'Must enforce exactly 3 constraints');
  assert.match(sql, /unexpected UNIQUE\/CHECK\/EXCLUDE constraint/i, 'Must reject UNIQUE/CHECK/EXCLUDE constraints');
  assert.match(sql, /expected exactly 2 legacy FKs/i, 'Must enforce exactly 2 outbound FKs');
  assert.match(sql, /contype NOT IN \('p','f'\)/i, 'Must reject any non-PK/FK constraint types');
});

test('reconcile migration guards against unexpected inbound FK', () => {
  assert.match(sql, /unexpected inbound FK/i, 'Must fail closed on unexpected inbound FK');
});

test('reconcile migration does not drop the legacy PK by guessed name; reads it from catalog', () => {
  assert.equal(/DROP CONSTRAINT tree_comments_pkey/i.test(content), false, 'Must not hard-code/drop a guessed PK name');
  assert.match(sql, /PK LOOKUP FAIL/i, 'Must read PK from catalog and fail closed if not exactly [tree_id, id]');
  assert.equal(/DROP CONSTRAINT.*CASCADE/i.test(content), false, 'Must not DROP CONSTRAINT ... CASCADE');
  assert.equal(/DROP CONSTRAINT IF EXISTS/i.test(content), false, 'Must not guess/IF EXISTS drop constraints');
});

// ─── 7. View / dependency guards (view + materialized view) ──────────────────

test('reconcile migration guards normal views and materialized views', () => {
  assert.match(sql, /relkind='v'/i, 'Must check for dependent normal views (relkind v)');
  assert.match(sql, /relkind='m'/i, 'Must check for dependent materialized views (relkind m)');
  assert.match(sql, /dependent materialized views reference tree_comments/i, 'Must fail closed on dependent materialized views');
});

// ─── 8. Zero-row / fail-closed guards ───────────────────────────────────────

test('reconcile migration enforces row count = 0 guard', () => {
  assert.match(sql, /v_rows\s*<>\s*0/i, 'Must fail closed when row count <> 0');
  assert.match(sql, /abort to avoid destructive copy/i, 'Must fail closed when rows are present');
});

test('reconcile migration stops explicitly when already reconciled', () => {
  assert.match(
    sql,
    /PREFLIGHT STOP: tree_comments already reconciled/i,
    'Second run must stop explicitly with "PREFLIGHT STOP: tree_comments already reconciled"'
  );
});

test('reconcile migration fails closed on unexpected/partial schema', () => {
  assert.match(sql, /PREFLIGHT FAIL: tree_comments is neither exact legacy \(8-col\) nor reconciled \(12-col\)/i, 'Must fail closed on partial/unexpected schema');
  assert.match(sql, /PREFLIGHT FAIL: unexpected triggers/i, 'Must fail closed on unexpected triggers');
  assert.match(sql, /PREFLIGHT FAIL: RLS enabled/i, 'Must fail closed on RLS enabled');
  assert.match(sql, /PREFLIGHT FAIL: dependent views/i, 'Must fail closed on dependent views');
});

// ─── 9. Reader / writer required columns ────────────────────────────────────

test('reconcile migration adds reader-required column body', () => {
  assert.match(sql, /ADD\s+COLUMN\s+body\s+TEXT\s+NOT\s+NULL/i, 'Must add reader-required body TEXT NOT NULL');
});

test('reconcile migration adds writer-required columns', () => {
  assert.match(sql, /ADD\s+COLUMN\s+owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL/i, 'Must add writer-required owner_id (no default)');
  assert.match(sql, /ADD\s+COLUMN\s+target_kind\s+VARCHAR\(16\)\s+NOT\s+NULL\s+DEFAULT\s+'tree'/i, 'Must add writer-required target_kind DEFAULT tree');
  assert.match(sql, /ADD\s+COLUMN\s+target_id\s+TEXT/i, 'Must add writer-required target_id (text)');
});

// ─── 10. Production key-type compatibility (trees.id = text) ─────────────────

test('reconcile migration uses TEXT key type compatible with production trees.id', () => {
  assert.equal(/tree_id\s+UUID/i.test(content), false, 'tree_id must NOT be UUID (production trees.id is text)');
  assert.match(sql, /ADD\s+COLUMN\s+target_id\s+TEXT/i, 'target_id must be TEXT (compatible with trees.id)');
});

// ─── 11. Canonical PRIMARY KEY (id) conversion ──────────────────────────────

test('reconcile migration converts PRIMARY KEY to (id)', () => {
  assert.match(sql, /ADD\s+CONSTRAINT\s+tree_comments_pkey\s+PRIMARY\s+KEY\s*\(id\)/i, 'Must add PRIMARY KEY (id) for writer replay uniqueness');
  assert.match(sql, /PRIMARY KEY must be exactly \[id\]/i, 'Post-verify must confirm PRIMARY KEY exactly [id]');
});

// ─── 12. PK / FK / CHECK / DEFAULT / INDEX (apply phase) ─────────────────────

test('reconcile migration adds target invariants via explicit ADD CONSTRAINT', () => {
  assert.match(
    sql,
    /ADD\s+CONSTRAINT\s+tree_comments_target_id_matches_tree_id\s+CHECK\s*\(target_id\s+IS\s+NULL\s+OR\s+target_id\s*=\s*tree_id\)/i,
    'Must add target_id IS NULL OR target_id = tree_id CHECK (explicit, no IF NOT EXISTS)'
  );
  assert.match(
    sql,
    /ADD\s+CONSTRAINT\s+tree_comments_target_kind_is_tree\s+CHECK\s*\(target_kind\s*=\s*'tree'\)/i,
    'Must add target_kind = tree CHECK (explicit, no IF NOT EXISTS)'
  );
});

test('reconcile migration enforces created_at/updated_at NOT NULL DEFAULT NOW()', () => {
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+SET\s+DEFAULT\s+NOW\(\)/i, 'created_at must DEFAULT NOW()');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+SET\s+DEFAULT\s+NOW\(\)/i, 'updated_at must DEFAULT NOW()');
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+SET\s+NOT\s+NULL/i, 'created_at must be NOT NULL');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+SET\s+NOT\s+NULL/i, 'updated_at must be NOT NULL');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+created_at\s*=\s*NOW\(\)/i.test(content), false, 'Must not UPDATE created_at');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+updated_at\s*=\s*NOW\(\)/i.test(content), false, 'Must not UPDATE updated_at');
});

test('reconcile migration adds canonical indexes', () => {
  assert.match(sql, /idx_tree_comments_tree_id\s+ON\s+public\.tree_comments\s*\(tree_id\)/i, 'Must add idx_tree_comments_tree_id');
  assert.match(sql, /idx_tree_comments_owner_id\s+ON\s+public\.tree_comments\s*\(owner_id\)/i, 'Must add idx_tree_comments_owner_id');
  assert.match(sql, /idx_tree_comments_created_at\s+ON\s+public\.tree_comments\s*\(created_at\)/i, 'Must add idx_tree_comments_created_at');
});

// ─── 13. Sentinel defaults forbidden ────────────────────────────────────────

test('reconcile migration forbids sentinel defaults for owner_id and body', () => {
  assert.equal(/owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL\s+DEFAULT\s+'unknown'/i.test(content), false, "owner_id must NOT default to sentinel 'unknown'");
  assert.equal(/body\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i.test(content), false, 'body must NOT default to sentinel empty string');
});

// ─── 14. Legacy preservation / post-verification ─────────────────────────────

test('reconcile migration preserves legacy columns (no destructive drop of legacy fields)', () => {
  assert.equal(/DROP\s+COLUMN\s+author_id/i.test(content), false, 'Must not DROP legacy author_id');
  assert.equal(/DROP\s+COLUMN\s+payload/i.test(content), false, 'Must not DROP legacy payload');
  assert.equal(/DROP\s+COLUMN\s+is_deleted/i.test(content), false, 'Must not DROP legacy is_deleted');
  assert.match(sql, /POST-VERIFY FAIL: legacy-only columns/i, 'Must verify legacy columns preserved after migration');
});

test('reconcile migration post-verification is complete (sentinel/row-count/triggers/matviews)', () => {
  assert.match(sql, /sentinel defaults.*detected/i, 'Post-verify must reject sentinel defaults');
  assert.match(sql, /row count=.*after migration \(expected 0\)/i, 'Post-verify must confirm row count still 0');
  assert.match(sql, /unexpected trigger\/RLS\/dependent view\/materialized view appeared after migration/i, 'Post-verify must confirm no new risky deps incl matviews');
});

// ─── 15. No concrete DB role/user string, no production/staging apply ─────────

test('reconcile migration does not embed a concrete production DB role/user string', () => {
  assert.equal(/neondb_owner/i.test(sql), false, 'Must not embed concrete production role name');
  assert.equal(/postgres\s+role|role\s*=\s*['"][a-z0-9_]+['"]/i.test(sql), false, 'Must not embed concrete role assignment');
});

test('reconcile migration does not reference production/staging execution', () => {
  assert.equal(/applied to production/i.test(sql), false, 'Must not claim production apply');
  assert.equal(/apply.*staging/i.test(sql), false, 'Must not reference staging apply');
});

// ─── 16. References / no-close hygiene ──────────────────────────────────────

test('reconcile migration references #3423, #3418, #3188, #3075, #1882', () => {
  assert.ok(/#3423/.test(sql), 'Must reference #3423');
  assert.ok(/#3418/.test(sql), 'Must reference #3418');
  assert.equal(/#3422/.test(sql), false, 'Must NOT reference #3422 (out of scope for this issue)');
  assert.ok(/#3188/.test(sql), 'Must reference #3188');
  assert.ok(/#3075/.test(sql), 'Must reference #3075 as boundary');
  assert.ok(/#1882/.test(sql), 'Must reference #1882');
});

test('reconcile migration does not use close keywords for parent issues', () => {
  assert.equal(/\bCloses\s+#3188\b/i.test(sql), false, 'Must not use Closes #3188');
  assert.equal(/\bCloses\s+#3075\b/i.test(sql), false, 'Must not use Closes #3075');
  assert.equal(/\bCloses\s+#1882\b/i.test(sql), false, 'Must not use Closes #1882');
});

// ─── 17. No private / no runtime / no production apply ───────────────────────

test('reconcile migration does not modify runtime, UI, Scout, or moment files', () => {
  assert.equal(/modal_compute\/tree_comments\.py/i.test(sql), false, 'Must not embed/modify runtime source');
  assert.equal(/functions\/api/i.test(sql), false, 'Must not embed route files');
  assert.equal(/Scout/i.test(sql), false, 'Must not reference Scout modification');
});

// ─── 18. Migration / rollback command uses ON_ERROR_STOP=1 (fail-fast) ────────

const RUNBOOK_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-tree-comments-legacy-schema-reconciliation-runbook.md');
const runbook = readFile(RUNBOOK_PATH);

// The bare single-line command (no fail-fast flag) is forbidden everywhere.
// Direct migration URI variable is required for operator examples (#3477).
const BARE_MIGRATION_CMD =
  /psql\s+"\$(?:DATABASE_URL|LOVE_BUD_PRODUCTION_DIRECT_DATABASE_URL)"\s+-f\s+scripts\/migration-reconcile-tree-comments-legacy-schema\.sql/;
const ON_ERROR_STOP_RE = /-v\s+ON_ERROR_STOP=1/;

test('reconcile migration SQL usage comment uses fail-fast ON_ERROR_STOP=1', () => {
  // The usage command lives in the SQL header comment block; verify the actual
  // command (not a prose mention) includes -v ON_ERROR_STOP=1.
  const usageIdx = sql.indexOf('Usage (apply ONLY under separate approval');
  assert.ok(usageIdx > 0, 'Migration SQL must contain a usage comment');
  const usageTail = sql.slice(usageIdx, usageIdx + 700);
  assert.match(usageTail, ON_ERROR_STOP_RE, 'Usage command block must include -v ON_ERROR_STOP=1');
});

test('reconcile migration forbids the bare psql command (no ON_ERROR_STOP)', () => {
  // The bare form must not appear as an actual command in the SQL or the runbook.
  assert.equal(BARE_MIGRATION_CMD.test(sql), false, 'Migration SQL must not contain the bare psql command');
  assert.equal(BARE_MIGRATION_CMD.test(runbook), false, 'Runbook must not contain the bare psql command');
});

test('reconcile runbook migration command block uses ON_ERROR_STOP=1', () => {
  // Target the section 8 command block specifically (the operator-runnable command).
  const sec8 = runbook.slice(runbook.indexOf('## 8. Migration command format'));
  const nextSec = sec8.indexOf('## 9.');
  const block = nextSec > 0 ? sec8.slice(0, nextSec) : sec8;
  assert.match(
    block,
    /psql\s+"\$LOVE_BUD_PRODUCTION_DIRECT_DATABASE_URL"\s+-v\s+ON_ERROR_STOP=1\s+\\\s*\n\s*-f\s+scripts\/migration-reconcile-tree-comments-legacy-schema\.sql/,
    'Runbook migration command block must use direct URI + psql -v ON_ERROR_STOP=1 -f ...'
  );
  assert.equal(BARE_MIGRATION_CMD.test(block), false, 'Runbook migration command block must not be the bare form');
});

test('reconcile runbook rollback command continues to use ON_ERROR_STOP=1', () => {
  const sec11 = runbook.slice(runbook.indexOf('## 11. Rollback procedure'));
  const nextSec = sec11.indexOf('## 12.');
  const block = nextSec > 0 ? sec11.slice(0, nextSec) : sec11;
  assert.match(
    block,
    /psql\s+"\$LOVE_BUD_PRODUCTION_DIRECT_DATABASE_URL"\s+-v\s+ON_ERROR_STOP=1\s+\\\s*\n\s*-f\s+scripts\/rollback-tree-comments-legacy-reconcile\.sql/,
    'Runbook rollback command must continue to use direct URI + psql -v ON_ERROR_STOP=1 -f ...'
  );
});

test('reconcile runbook does not claim the migration/rollback were actually executed', () => {
  assert.match(runbook, /actual DB migration\/rollback was NOT executed/i,
    'Runbook must state the DB migration/rollback was NOT executed');
  assert.equal(/full PostgreSQL grammar parse of both SQL files via `pglast`/i.test(runbook), false,
    'Runbook must not claim a pglast parse success');
  assert.match(runbook, /pglast:\s*NOT RUN on this final head/i,
    'Runbook must record pglast: NOT RUN on this final head');
});

// ─── 19. Operational runbook correction (Issue #3431) ───────────────────────

// Runbook legacy preflight must include the real pg_index catalog query and
// require secondary_index_count = 0.
const sec5 = runbook.slice(runbook.indexOf('## 5. Preflight queries'));
const sec6 = sec5.indexOf('## 6.');
const sec5Block = sec6 > 0 ? sec5.slice(0, sec6) : sec5;

test('reconcile runbook preflight includes the pg_index catalog query', () => {
  assert.match(sec5Block, /pg_index/i, 'Runbook Sec 5 must include the pg_index catalog query');
});

test('reconcile runbook preflight requires secondary_index_count = 0', () => {
  assert.match(sec5Block, /secondary_index_count/i, 'Runbook Sec 5 must count secondary indexes');
  assert.match(sec5Block, /secondary_index_count = 0/i, 'Runbook Sec 5 must expect secondary_index_count = 0');
});

test('reconcile runbook approval checklist requires zero legacy secondary index', () => {
  const sec6b = runbook.slice(runbook.indexOf('## 6. Execution approval gate'));
  const next = sec6b.indexOf('## 7.');
  const block = next > 0 ? sec6b.slice(0, next) : sec6b;
  assert.match(block, /Legacy non-primary secondary index count = 0/i,
    'Runbook approval checklist must require legacy non-primary secondary index count = 0');
});

test('reconcile runbook failure-stop criteria includes unexpected index', () => {
  const sec14 = runbook.slice(runbook.indexOf('## 14. Failure stop criteria'));
  assert.match(sec14, /unexpected index or secondary index count != 0/i,
    'Runbook failure-stop criteria must include an unexpected index / secondary count != 0');
});

// Runbook Sec 9 post-migration exact index query.
const sec9 = runbook.slice(runbook.indexOf('## 9. Post-migration schema verification'));
const sec9Next = sec9.indexOf('## 10.');
const sec9Block = sec9Next > 0 ? sec9.slice(0, sec9Next) : sec9;

test('reconcile runbook post-migration includes exact 3 canonical indexes', () => {
  assert.match(sec9Block, /secondary total = 3/i, 'Runbook Sec 9 must expect secondary total = 3');
  assert.match(sec9Block, /idx_tree_comments_tree_id/i, 'Runbook Sec 9 must name idx_tree_comments_tree_id');
  assert.match(sec9Block, /idx_tree_comments_owner_id/i, 'Runbook Sec 9 must name idx_tree_comments_owner_id');
  assert.match(sec9Block, /idx_tree_comments_created_at/i, 'Runbook Sec 9 must name idx_tree_comments_created_at');
});

test('reconcile runbook post-migration compound count = 0 and unexpected count = 0', () => {
  assert.match(sec9Block, /compound \[tree_id, created_at\] count = 0/i,
    'Runbook Sec 9 must expect compound [tree_id, created_at] count = 0');
  assert.match(sec9Block, /unexpected secondary count = 0/i,
    'Runbook Sec 9 must expect unexpected secondary count = 0');
});

// Runbook Sec 12 smoke test must use the public Pages route, not the private Modal route.
const sec12 = runbook.slice(runbook.indexOf('## 12. Smoke test'));
const sec12Next = sec12.indexOf('## 13.');
const sec12Block = sec12Next > 0 ? sec12.slice(0, sec12Next) : sec12;

test('reconcile runbook smoke test uses the public Pages /api/trees/ route', () => {
  assert.match(sec12Block, /https:\/\/lovebud\.pages\.dev\/api\/trees\//i,
    'Runbook Sec 12 must use the public Pages /api/trees/ route');
  assert.match(sec12Block, /\$\{PRIVATE_TREE_ID\}\/comments\?limit=20/i,
    'Runbook Sec 12 must use a bounded limit=20 smoke');
  assert.match(sec12Block, /Expect 400/i, 'Runbook Sec 12 must include invalid-tree-id => 400');
  assert.match(sec12Block, /Expect 404/i, 'Runbook Sec 12 must include missing/non-public tree => 404');
});

test('reconcile runbook smoke test must not use the private Modal route', () => {
  assert.equal(/modal\/private\//i.test(runbook), false,
    'Runbook must not reference the private /modal/private/ route');
  assert.equal(/<approved-public-endpoint>/i.test(runbook), false,
    'Runbook must not use the placeholder <approved-public-endpoint>');
});

// Runbook Sec 7 secure schema-only backup.
const sec7 = runbook.slice(runbook.indexOf('## 7. Backup / rollback strategy'));
const sec7Next = sec7.indexOf('## 8.');
const sec7Block = sec7Next > 0 ? sec7.slice(0, sec7Next) : sec7;

test('reconcile runbook secure backup uses umask/mktemp and --no-owner/--no-privileges', () => {
  assert.match(sec7Block, /umask 077/i, 'Runbook Sec 7 must set umask 077');
  assert.match(sec7Block, /mktemp -d/i, 'Runbook Sec 7 must use mktemp -d for an external dir');
  assert.match(sec7Block, /--no-owner/i, 'Runbook Sec 7 backup must use --no-owner');
  assert.match(sec7Block, /--no-privileges/i, 'Runbook Sec 7 backup must use --no-privileges');
  assert.match(sec7Block, /never .*git add.* or committed/i,
    'Runbook Sec 7 must state the backup is never git added / committed');
});

// Runbook Sec 10 production-evidence wording must not make the false blanket claim.
test('reconcile runbook does not make a false "no production connection was opened" claim', () => {
  assert.equal(/No connection to Neon production or any shared database was opened\.\s*$/m.test(runbook), false,
    'Runbook must NOT claim "No connection ... was opened" as a bare standalone statement');
  assert.match(runbook, /approved production read-only catalog inspection: YES/i,
    'Runbook must distinguish approved production read-only inspection = YES');
  assert.match(runbook, /production\/staging DB access: NO/i,
    'Runbook must state this PR production/staging DB access = NO');
});

// Migration SQL must not carry the stale "tree_id index is preserved for list reads" comment.
test('reconcile migration SQL does not carry the stale "tree_id index is preserved" comment', () => {
  assert.equal(/tree_id index is preserved for list reads/i.test(sql), false,
    'Migration SQL must not contain the stale "tree_id index is preserved for list reads" comment');
});
