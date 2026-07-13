/**
 * Contract tests for the tree-level comment legacy-schema rollback script
 * (Issue #3423).
 *
 * These tests verify that scripts/rollback-tree-comments-legacy-reconcile.sql
 * safely reverts a reconciled `public.tree_comments` table back to the exact
 * legacy 8-column shape WITHOUT executing any SQL, opening a database connection,
 * or applying to production/staging.
 *
 * Source-level assertions only. No database connection, psql, subprocess, git diff, or
 * git status is used. No raw/private values are asserted. No automatic execution.
 *
 * Refs: #3423, #3418, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROLLBACK_PATH = path.join(ROOT, 'scripts/rollback-tree-comments-legacy-reconcile.sql');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

const sql = readFile(ROLLBACK_PATH);
const content = stripSqlComments(sql);

// ─── 1. Rollback artifact exists and is transactional / guarded ──────────────

test('rollback script file exists', () => {
  assert.ok(fs.existsSync(ROLLBACK_PATH));
});

test('rollback script wraps changes in an explicit transaction', () => {
  assert.ok(/^\s*BEGIN\s*;/im.test(sql), 'Must start with explicit BEGIN');
  assert.ok(/^\s*COMMIT\s*;/im.test(sql), 'Must end with explicit COMMIT');
});

test('rollback script sets bounded lock_timeout and statement_timeout', () => {
  assert.match(sql, /SET\s+LOCAL\s+lock_timeout\s*=\s*'3s'/i, 'Must set bounded lock_timeout');
  assert.match(sql, /SET\s+LOCAL\s+statement_timeout\s*=\s*'30s'/i, 'Must set bounded statement_timeout');
});

test('rollback script takes a safe bounded table lock', () => {
  assert.match(
    sql,
    /LOCK\s+TABLE\s+public\.tree_comments\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i,
    'Must take SHARE ROW EXCLUSIVE lock on tree_comments'
  );
});

// ─── 2. Destructive-operation prohibition ───────────────────────────────────

test('rollback script does not DROP TABLE', () => {
  assert.equal(content.includes('DROP TABLE'), false, 'Must not DROP TABLE');
});

test('rollback script does not TRUNCATE', () => {
  assert.equal(content.includes('TRUNCATE'), false, 'Must not TRUNCATE');
});

test('rollback script does not DELETE rows from tree_comments', () => {
  assert.equal(/DELETE\s+FROM\s+tree_comments/i.test(content), false, 'Must not DELETE FROM tree_comments');
  assert.equal(/DELETE\s+FROM\s+public\.tree_comments/i.test(content), false, 'Must not DELETE FROM public.tree_comments');
});

test('rollback script never uses CASCADE on drops', () => {
  assert.equal(/DROP\s+.*\bCASCADE\b/i.test(content), false, 'Must not use CASCADE on any DROP');
  assert.equal(/DROP\s+CONSTRAINT.*CASCADE/i.test(content), false, 'Must not DROP CONSTRAINT ... CASCADE');
});

test('rollback script does not embed a connection string or credentials', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/DATABASE_URL/i.test(sql), false, 'Must not embed a credential variable');
});

// ─── 3. Exact reconciled-shape preflight guard (fail closed before mutation) ──

test('rollback script confirms exact reconciled 12-column shape before altering', () => {
  assert.match(sql, /ROLLBACK PRECONDITION FAIL: table is not the exact reconciled 12-column shape/i, 'Must fail closed if not exact reconciled');
  assert.match(sql, /v_total_cols = 12 AND v_legacy_markers = 8 AND v_canon_extra = 4/i, 'Must require exactly 12 cols = 8 legacy + 4 canonical');
});

test('rollback script asserts exact canonical column metadata before mutation', () => {
  assert.match(sql, /owner_id must be varchar\(128\) NOT NULL with no default/i, 'owner_id metadata guard');
  assert.match(sql, /body must be text NOT NULL with no default/i, 'body metadata guard');
  assert.match(sql, /target_kind must be varchar\(16\) NOT NULL DEFAULT ''tree''/i, 'target_kind metadata guard');
  assert.match(sql, /target_id must be text NULL/i, 'target_id metadata guard');
  assert.match(sql, /created_at must be timestamptz NOT NULL DEFAULT now\(\)/i, 'created_at metadata guard');
  assert.match(sql, /updated_at must be timestamptz NOT NULL DEFAULT now\(\)/i, 'updated_at metadata guard');
  assert.match(sql, /character_maximum_length=128/i, 'owner_id length guard');
  assert.match(sql, /character_maximum_length=16/i, 'target_kind length guard');
});

test('rollback script preflight asserts exact canonical PRIMARY KEY [id] via catalog array', () => {
  assert.match(sql, /unnest\(c\.conkey\)\s+WITH\s+ORDINALITY/i, 'Must derive PK columns from conkey ordinality');
  assert.match(sql, /canonical PRIMARY KEY must be exactly \[id\]/i, 'Must require canonical PK exactly [id]');
});

test('rollback script preflight enforces exact reconciled constraint set (1 PK + 2 FK + 2 CHECK)', () => {
  assert.match(sql, /reconciled constraint set must be exactly 5 \(1 PK \+ 2 FK \+ 2 CHECK\)/i, 'Must enforce exactly 5 constraints');
  assert.match(sql, /unexpected UNIQUE\/EXCLUDE constraint/i, 'Must reject UNIQUE/EXCLUDE constraints');
  assert.match(sql, /c\.confrelid='public\.trees'::regclass/i, 'Must verify tree FK target via catalog');
  assert.match(sql, /c\.confrelid='public\.users'::regclass/i, 'Must verify author FK target via catalog');
  assert.match(sql, /c\.confdeltype='c'/i, 'Must verify ON DELETE CASCADE via confdeltype');
  assert.match(sql, /c\.confdeltype='n'/i, 'Must verify ON DELETE SET NULL via confdeltype');
});

test('rollback script preflight verifies exact index inventory (catalog arrays, no compound)', () => {
  assert.match(sql, /expected exactly 3 secondary indexes/i, 'Rollback preflight must require exactly 3 canonical secondary indexes (no compound)');
  assert.match(sql, /migration-added indexes missing/i, 'Must verify 3 migration-added indexes exist');
  assert.match(sql, /canonical PK backing index \(id\) not found/i, 'Must verify canonical PK backing index exists');
  assert.match(sql, /unexpected index\(es\) present before rollback/i, 'Must reject any unexpected index');
  assert.match(sql, /unnest\(i\.indkey\)\s+WITH\s+ORDINALITY/i, 'Must use pg_index.indkey ordered column arrays (not indexdef)');
});

test('rollback script preflight verifies exact CHECK definitions (not count-only)', () => {
  assert.match(sql, /_lb_norm_check\(pg_get_constraintdef\(oid\)\) = 'target_kind = ''tree'''/i, 'Rollback preflight must check target_kind = tree CHECK definition via exact normalized comparison');
  assert.match(sql, /_lb_norm_check\(pg_get_constraintdef\(oid\)\) = 'target_id is null or target_id = tree_id'/i, 'Rollback preflight must check target_id/tree_id CHECK definition via exact normalized comparison');
});

test('rollback script preflight verifies all 12 column metadata (incl. 4 legacy-preserved columns)', () => {
  assert.match(sql, /column_name='author_id'[\s\S]*?data_type='text'.*?is_nullable='YES'.*?column_default IS NULL/i,
    'Rollback preflight must check author_id = text NULL, no default');
  assert.match(sql, /column_name='author_display_name'[\s\S]*?data_type='text'.*?is_nullable='YES'.*?column_default IS NULL/i,
    'Rollback preflight must check author_display_name = text NULL, no default');
  assert.match(sql, /column_name='is_deleted'[\s\S]*?data_type='boolean'.*?is_nullable='NO'.*?column_default IN \('false'/i,
    'Rollback preflight must check is_deleted = boolean NOT NULL DEFAULT false');
  assert.match(sql, /column_name='payload'[\s\S]*?data_type='jsonb'.*?is_nullable='NO'.*?column_default = '''{}''::jsonb'/i,
    'Rollback preflight must check payload = jsonb NOT NULL DEFAULT {}');
  assert.match(sql, /column_name='target_id'[\s\S]*?data_type='text'.*?is_nullable='YES'.*?column_default IS NULL/i,
    'Rollback preflight must check target_id = text NULL with no default');
});

test('rollback script preflight uses exact normalized comparison for defaults (no substring)', () => {
  assert.match(sql, /_lb_norm_default\(column_default\) = 'tree'/i,
    'Rollback preflight must check target_kind default via exact normalized comparison');
  assert.match(sql, /_lb_norm_default\(column_default\) = 'now\(\)'/i,
    'Rollback preflight must check created_at/updated_at defaults via exact normalized comparison');
  assert.equal(/column_default ILIKE/i.test(sql), false,
    'Rollback preflight must NOT use ILIKE substring matching for defaults or CHECKs');
});

test('rollback script creates and drops purpose-specific normalizers', () => {
  assert.match(sql, /CREATE FUNCTION _lb_norm_default\(p_expr text\)/i,
    'Rollback must create the _lb_norm_default normalizer function');
  assert.match(sql, /CREATE FUNCTION _lb_norm_check\(p_expr text\)/i,
    'Rollback must create the _lb_norm_check normalizer function');
  assert.match(sql, /DROP FUNCTION IF EXISTS _lb_norm_default\(text\);/i,
    'Rollback must drop the _lb_norm_default function before COMMIT');
  assert.match(sql, /DROP FUNCTION IF EXISTS _lb_norm_check\(text\);/i,
    'Rollback must drop the _lb_norm_check function before COMMIT');
  assert.equal(/_lb_norm_expr/.test(sql), false,
    'Rollback must no longer define the shared _lb_norm_expr normalizer');
});

test('rollback script preflight verifies exact total index count = 4 (PK + 3 canonical, no compound)', () => {
  assert.match(sql, /expected exactly 3 secondary indexes/i, 'Rollback preflight must require exactly 3 secondary indexes (corrected)');
  assert.match(sql, /canonical PK backing index \(id\) not found/i, 'Rollback preflight must require the PK backing index');
});

test('rollback script rejects partial / expression / INCLUDE secondary indexes', () => {
  assert.match(sql, /indpred IS NULL/i, 'Rollback index checks must reject partial indexes');
  assert.match(sql, /indexprs IS NULL/i, 'Rollback index checks must reject expression indexes');
  assert.match(sql, /indnkeyatts\s*(=|<>)\s*i\.indnatts/i, 'Rollback index checks must reject INCLUDE-column indexes');
});

test('rollback script preflight guards triggers/RLS/views/matviews and inbound FK', () => {
  assert.match(sql, /unexpected triggers present on tree_comments/i, 'Must guard triggers');
  assert.match(sql, /RLS enabled on tree_comments/i, 'Must guard RLS');
  assert.match(sql, /relkind\s*=\s*'m'/i, 'Must guard materialized views');
  assert.match(sql, /dependent view references tree_comments/i, 'Must guard dependent views before mutation');
  assert.match(sql, /dependent materialized view references tree_comments/i, 'Must guard dependent matviews before mutation');
  assert.match(sql, /unexpected inbound FK\(s\) reference tree_comments/i, 'Must guard inbound FK');
});

test('rollback script detects view dependencies through pg_rewrite traversal', () => {
  assert.match(sql, /pg_rewrite/i, 'Must join pg_rewrite for view dependency detection');
  assert.match(sql, /r\.ev_class|ev_class/i, 'Must connect rewrite rules via ev_class to pg_class');
  assert.match(sql, /classid\s*=\s*'pg_rewrite'::regclass/i, 'Must require depend classid = pg_rewrite');
  assert.match(sql, /refclassid\s*=\s*'pg_class'::regclass/i, 'Must require depend refclassid = pg_class');
  assert.match(sql, /count\s*\(\s*DISTINCT\s+c\.oid\s*\)/i, 'Must count DISTINCT relation oids');
  assert.equal(
    /JOIN\s+pg_depend\s+d\s+ON\s+d\.refobjid\s*=\s*'public\.tree_comments'::regclass\s+AND\s+d\.objid\s*=\s*c\.oid/i.test(sql),
    false,
    'Must not use obsolete direct pg_depend.objid = pg_class.oid view join'
  );
});

test('rollback script runtime-asserts public.trees.id is text', () => {
  assert.match(
    sql,
    /table_schema\s*=\s*'public'\s+AND\s+table_name\s*=\s*'trees'\s+AND\s+column_name\s*=\s*'id'/i,
    'Must query information_schema.columns for public.trees.id'
  );
  assert.match(sql, /PREFLIGHT FAIL: public\.trees\.id must be text/i, 'Must fail closed if trees.id not text');
});

test('rollback script enforces zero-row guard (fail closed if data exists)', () => {
  assert.match(sql, /ROLLBACK PRECONDITION FAIL: tree_comments row_count=/i, 'Must fail closed when row count <> 0');
  assert.match(sql, /abort to avoid data loss/i, 'Must abort to avoid data loss when rows present');
});

// ─── 4. Canonical column removal ────────────────────────────────────────────

test('rollback script removes canonical columns owner_id/body/target_kind/target_id', () => {
  assert.match(sql, /DROP\s+COLUMN\s+owner_id/i, 'Must DROP COLUMN owner_id');
  assert.match(sql, /DROP\s+COLUMN\s+body/i, 'Must DROP COLUMN body');
  assert.match(sql, /DROP\s+COLUMN\s+target_kind/i, 'Must DROP COLUMN target_kind');
  assert.match(sql, /DROP\s+COLUMN\s+target_id/i, 'Must DROP COLUMN target_id');
});

test('rollback script removes canonical CHECK constraints', () => {
  assert.match(sql, /DROP\s+CONSTRAINT\s+tree_comments_target_id_matches_tree_id/i, 'Must drop target_id CHECK');
  assert.match(sql, /DROP\s+CONSTRAINT\s+tree_comments_target_kind_is_tree/i, 'Must drop target_kind CHECK');
  assert.equal(/DROP\s+CONSTRAINT.*CASCADE/i.test(content), false, 'Must not DROP CONSTRAINT ... CASCADE');
});

// ─── 5. Legacy composite PK restoration (catalog-driven, no name guess) ──────

test('rollback script restores legacy composite PK (tree_id, id)', () => {
  assert.match(sql, /ADD\s+CONSTRAINT\s+tree_comments_pkey\s+PRIMARY\s+KEY\s*\(tree_id,\s*id\)/i, 'Must restore legacy PK (tree_id, id)');
});

test('rollback script reads canonical PK from catalog (no guessed name, array comparison)', () => {
  assert.equal(/DROP CONSTRAINT tree_comments_pkey/i.test(content), false, 'Must not hard-code/drop a guessed PK name');
  assert.match(sql, /PK LOOKUP FAIL/i, 'Must read PK from catalog and fail closed if not exactly [id]');
  assert.match(sql, /ARRAY\['id'\]::text\[\]/i, 'Must compare canonical PK to exact [id] array');
});

// ─── 6. Schema-qualified index removal (migration-added only) ────────────────

test('rollback script removes the three migration-added indexes (schema-qualified)', () => {
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+public\.idx_tree_comments_tree_id/i, 'Must schema-qualify DROP INDEX tree_id');
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+public\.idx_tree_comments_owner_id/i, 'Must schema-qualify DROP INDEX owner_id');
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+public\.idx_tree_comments_created_at/i, 'Must schema-qualify DROP INDEX created_at');
});

test('rollback script does NOT create or drop a compound (tree_id, created_at) index (corrected)', () => {
  // The corrected reconciled state has NO compound index, so rollback neither
  // creates nor drops one. It restores the exact legacy zero-secondary-index state.
  assert.equal(/DROP\s+INDEX\s+IF\s+EXISTS\s+(public\.)?idx_tree_comments_tree_id_created_at/i.test(content), false,
    'Must NOT drop a compound legacy index that does not exist');
  assert.equal(/idx_\.\.\._tree_id_created_at \(tree_id, created_at\) is PRESERVED/i.test(sql), false,
    'Must NOT claim the compound legacy index is preserved');
  assert.equal(/v_idx_compound/i.test(sql), false,
    'Old compound legacy index variable/check must be removed from preflight/post-verify');
});

// ─── 7. Timestamp nullable / default reversion ─────────────────────────────

test('rollback script reverts created_at/updated_at to NULLABLE and drops defaults', () => {
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+DROP\s+DEFAULT/i, 'Must drop created_at default');
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+DROP\s+NOT\s+NULL/i, 'Must revert created_at to NULLABLE');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+DROP\s+DEFAULT/i, 'Must drop updated_at default');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+DROP\s+NOT\s+NULL/i, 'Must revert updated_at to NULLABLE');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+created_at/i.test(content), false, 'Must not UPDATE created_at');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+updated_at/i.test(content), false, 'Must not UPDATE updated_at');
});

// ─── 8. Post-rollback verification (exact legacy shape/metadata) ─────────────

test('rollback script post-verifies exact legacy 8-column shape and metadata', () => {
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: not exact legacy 8-column shape/i, 'Must confirm exact legacy 8-column shape');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: id must be text NOT NULL with no default/i, 'Must confirm id metadata');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: payload must be jsonb NOT NULL DEFAULT/i, 'Must confirm payload metadata');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: created_at must be timestamptz NULL with no default/i, 'Must confirm created_at reverted');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: updated_at must be timestamptz NULL with no default/i, 'Must confirm updated_at reverted');
});

test('rollback script post-verifies exact legacy PK/FK/constraint set via catalog', () => {
  assert.match(sql, /legacy PRIMARY KEY must be exactly \[tree_id, id\]/i, 'Must confirm legacy PK exactly [tree_id, id]');
  assert.match(sql, /legacy constraint set must be exactly 3 \(1 PK \+ 2 FK\)/i, 'Must confirm exact 3-constraint legacy set');
  assert.match(sql, /migration-added CHECK \/ unexpected constraint\(s\) still present/i, 'Must confirm migration CHECKs removed');
  assert.match(sql, /canonical CHECK constraints not removed/i, 'Must confirm no CHECK remains');
  assert.match(sql, /legacy FKs not preserved exactly/i, 'Must confirm legacy FKs preserved exactly');
  assert.match(sql, /c\.confdeltype='c'/i, 'Must verify tree FK cascade via confdeltype');
  assert.match(sql, /c\.confdeltype='n'/i, 'Must verify author FK set null via confdeltype');
});

test('rollback script post-verifies exact final legacy index inventory (zero secondary)', () => {
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: expected exactly 0 secondary indexes after rollback/i,
    'Must confirm zero secondary indexes after rollback');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: final index inventory wrong/i,
    'Must confirm PK backing + 0 secondary (legacy zero-secondary-index state)');
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: unexpected index\(es\) after rollback/i,
    'Must confirm no unexpected index remains');
  assert.equal(/original compound legacy index \(tree_id, created_at\) not preserved/i.test(sql), false,
    'Old "compound legacy index not preserved" assertion removed');
  assert.equal(/migration-added indexes still present/i.test(sql), false, 'Old "migration-added indexes still present" assertion removed');
  assert.equal(/idx_tree_comments_tree_id ON \(tree_id\) not preserved/i.test(sql), false,
    'Old single-column legacy tree_id preservation assertion removed');
});

test('rollback script post-verify requires exactly zero secondary indexes (total 1 = PK only)', () => {
  assert.match(sql, /expected exactly 0 secondary indexes after rollback/i,
    'Post-verify must require exactly 0 secondary indexes (legacy zero-secondary-index state)');
});

// ─── 9. No automatic execution / no private info ───────────────────────────

test('rollback script does not auto-apply or reference production/staging execution', () => {
  assert.equal(/automatically applied|auto-?apply/i.test(sql), false, 'Must not auto-apply');
  assert.equal(/applied to production/i.test(sql), false, 'Must not claim production apply');
  assert.equal(/apply.*staging/i.test(sql), false, 'Must not reference staging apply');
});

test('rollback script does not embed a concrete production DB role/user string', () => {
  assert.equal(/neondb_owner/i.test(sql), false, 'Must not embed concrete production role name');
  assert.equal(/postgres\s+role|role\s*=\s*['"][a-z0-9_]+['"]/i.test(sql), false, 'Must not embed concrete role assignment');
});

// ─── 10. References / no-close hygiene ──────────────────────────────────────

test('rollback script references #3423, #3418, #3188, #3075, #1882 (no #3422)', () => {
  assert.ok(/#3423/.test(sql), 'Must reference #3423');
  assert.ok(/#3418/.test(sql), 'Must reference #3418');
  assert.equal(/#3422/.test(sql), false, 'Must NOT reference #3422');
  assert.ok(/#3188/.test(sql), 'Must reference #3188');
  assert.ok(/#3075/.test(sql), 'Must reference #3075');
  assert.ok(/#1882/.test(sql), 'Must reference #1882');
});

test('rollback script does not use close keywords for parent issues', () => {
  assert.equal(/\bCloses\s+#3188\b/i.test(sql), false, 'Must not use Closes #3188');
  assert.equal(/\bCloses\s+#3075\b/i.test(sql), false, 'Must not use Closes #3075');
  assert.equal(/\bCloses\s+#1882\b/i.test(sql), false, 'Must not use Closes #1882');
});

// ─── 11. Operational runbook correction (Issue #3431) ───────────────────────

// Runbook post-rollback must require secondary count = 0, canonical 3 names
// absent, PK [tree_id, id], compound absent. The stale "captured/preserved
// original PK" wording must be absent from the runbook and SQL.
const RUNBOOK_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-tree-comments-legacy-schema-reconciliation-runbook.md');
const runbook = readFile(RUNBOOK_PATH);

const sec11 = runbook.slice(runbook.indexOf('## 11. Rollback procedure'));
const sec12 = sec11.indexOf('## 12.');
const sec11Block = sec12 > 0 ? sec11.slice(0, sec12) : sec11;

test('rollback runbook post-rollback requires secondary count = 0', () => {
  assert.match(sec11Block, /secondary_index_count = 0/i,
    'Runbook Sec 11 post-rollback must expect secondary_index_count = 0');
  assert.match(sec11Block, /canonical_index_count = 0/i,
    'Runbook Sec 11 post-rollback must expect canonical index count = 0');
});

test('rollback runbook post-rollback PK = [tree_id, id] and compound absent', () => {
  assert.match(sec11Block, /PK ordered columns = \[tree_id, id\]/i,
    'Runbook Sec 11 post-rollback must expect PK ordered columns = [tree_id, id]');
  assert.match(sec11Block, /compound_tree_created_count = 0/i,
    'Runbook Sec 11 post-rollback must expect compound [tree_id, created_at] count = 0');
});

test('rollback runbook post-rollback PK query has no undefined pg_index alias', () => {
  assert.equal(
    /SELECT\s+i\.indisprimary[\s\S]*?FROM\s+pg_constraint\s+c/i.test(sec11Block),
    false,
    'Runbook Sec 11 must not reference undefined alias i in the PK constraint query'
  );

  assert.match(
    sec11Block,
    /unnest\(c\.conkey\)\s+WITH\s+ORDINALITY/i,
    'Runbook Sec 11 must derive PK columns from pg_constraint.conkey'
  );

  assert.match(
    sec11Block,
    /primary_index_count\s*=\s*1/i,
    'Runbook Sec 11 must separately verify exactly one primary index'
  );
});

test('rollback runbook / SQL do not carry stale "captured/preserved original PK" wording', () => {
  assert.equal(/captured at migration time/i.test(runbook), false,
    'Runbook must not claim the original PK was captured at migration time');
  assert.equal(/migration preserved the original PK/i.test(runbook), false,
    'Runbook must not claim the migration preserved the original PK');
  assert.equal(/captured at migration time/i.test(sql), false,
    'Rollback SQL must not claim the original PK was captured at migration time');
  assert.equal(/migration preserved the original PK/i.test(sql), false,
    'Rollback SQL must not claim the migration preserved the original PK');
});
