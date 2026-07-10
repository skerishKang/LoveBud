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

test('reconcile migration asserts audited legacy compound index (tree_id, created_at)', () => {
  // The actual production legacy secondary index is compound (tree_id, created_at),
  // NOT a single-column idx_tree_comments_tree_id (that one is migration-added).
  assert.match(sql, /legacy compound index \(tree_id, created_at\)/i, 'Must reference the legacy compound index');
  assert.match(sql, /v_idx_compound/i, 'Must count the compound legacy index in preflight');
  assert.match(sql, /single-column tree_id index must NOT exist before migration/i,
    'Must assert single-column tree_id index is NOT present in legacy state');
});

test('reconcile migration post-verification checks exact index inventory', () => {
  assert.match(sql, /final exact reconciled-state validation/i, 'Post-verify must run the exact-state validator');
  assert.match(sql, /PK backing \+ compound \(tree_id, created_at\) \+ 3 migration added index inventory wrong/i,
    'Post-verify must assert the full index inventory');
  // The single-column tree_id index is CREATED by the migration (canonical), not legacy.
  assert.match(sql, /idx_tree_comments_tree_id ON public\.tree_comments\(tree_id\)/i,
    'Migration must create the canonical single-column tree_id index');
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
