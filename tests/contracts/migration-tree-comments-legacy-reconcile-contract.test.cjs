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

// ─── 3. Exact eight-column legacy shape assertion ───────────────────────────

test('reconcile migration asserts exact 8-column legacy shape', () => {
  assert.match(sql, /legacy\s+column\s+count[^;]*expected\s+8/i, 'Must assert legacy column count = 8');
  for (const col of ['id', 'tree_id', 'author_id', 'author_display_name', 'is_deleted', 'created_at', 'updated_at', 'payload']) {
    assert.ok(
      new RegExp(`column_name='${col}'`, 'i').test(sql) || new RegExp(`column_name="${col}"`, 'i').test(sql),
      `Preflight must reference legacy column ${col}`
    );
  }
});

test('reconcile migration asserts exact legacy column metadata (type/udt/nullable/default)', () => {
  // id: text / text / NO
  assert.match(sql, /id expected text\/text NOT NULL/i, 'Must assert id = text NOT NULL');
  // tree_id: text / text / NO
  assert.match(sql, /tree_id expected text\/text NOT NULL/i, 'Must assert tree_id = text NOT NULL');
  // payload: jsonb NOT NULL DEFAULT '{}'::jsonb
  assert.match(sql, /payload expected jsonb NOT NULL DEFAULT/i, 'Must assert payload = jsonb NOT NULL DEFAULT');
  // created_at/updated_at timestamptz NULL
  assert.match(sql, /created_at expected timestamptz NULL/i, 'Must assert created_at = timestamptz NULL');
  assert.match(sql, /updated_at expected timestamptz NULL/i, 'Must assert updated_at = timestamptz NULL');
});

test('reconcile migration asserts table existence', () => {
  assert.match(sql, /tree_comments table existence/i, 'Must assert table existence in preflight');
});

// ─── 5. Exact PK / FK guard ─────────────────────────────────────────────────

test('reconcile migration asserts exact legacy PRIMARY KEY (tree_id, id)', () => {
  assert.match(sql, /legacy PRIMARY KEY expected \(tree_id, id\)/i, 'Must assert legacy PK (tree_id, id)');
});

test('reconcile migration asserts exact legacy FK tree_id -> trees ON DELETE CASCADE', () => {
  assert.match(sql, /FK tree_id -> trees\(id\) ON DELETE CASCADE not found\/changed/i, 'Must assert legacy FK tree_id cascade');
});

test('reconcile migration asserts exact legacy FK author_id -> users ON DELETE SET NULL', () => {
  assert.match(sql, /FK author_id -> users\(id\) ON DELETE SET NULL/i, 'Must assert legacy FK author_id SET NULL');
});

test('reconcile migration guards against unexpected inbound FK', () => {
  assert.match(sql, /unexpected inbound FK/i, 'Must fail closed on unexpected inbound FK');
});

test('reconcile migration does not drop the legacy PK by guessed name; reads it from catalog', () => {
  // PK name must NOT be hard-coded; the migration reads the exact constraint name
  // from the catalog and drops it only when its definition is exactly (tree_id, id).
  assert.equal(/DROP CONSTRAINT tree_comments_pkey/i.test(content), false, 'Must not hard-code/drop a guessed PK name');
  assert.match(sql, /PK LOOKUP FAIL/i, 'Must read PK from catalog and fail closed if not exactly (tree_id, id)');
  assert.equal(/DROP CONSTRAINT.*CASCADE/i.test(content), false, 'Must not DROP CONSTRAINT ... CASCADE');
  assert.equal(/DROP CONSTRAINT IF EXISTS/i.test(content), false, 'Must not guess/IF EXISTS drop constraints');
});

// ─── 6. Zero-row / fail-closed guards ───────────────────────────────────────

test('reconcile migration enforces row count = 0 guard', () => {
  assert.match(sql, /row count\s*=\s*0/i, 'Must assert row count = 0 in preflight');
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
  assert.match(sql, /PREFLIGHT FAIL: tree_comments is neither exact legacy nor reconciled/i, 'Must fail closed on partial/unexpected schema');
  assert.match(sql, /PREFLIGHT FAIL: unexpected triggers/i, 'Must fail closed on unexpected triggers');
  assert.match(sql, /PREFLIGHT FAIL: RLS enabled/i, 'Must fail closed on RLS enabled');
  assert.match(sql, /PREFLIGHT FAIL: dependent views/i, 'Must fail closed on dependent views');
});

// ─── 7. Reader / writer required columns ────────────────────────────────────

test('reconcile migration adds reader-required column body', () => {
  assert.match(sql, /ADD\s+COLUMN\s+body\s+TEXT\s+NOT\s+NULL/i, 'Must add reader-required body TEXT NOT NULL');
});

test('reconcile migration adds writer-required columns', () => {
  assert.match(sql, /ADD\s+COLUMN\s+owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL/i, 'Must add writer-required owner_id (no default)');
  assert.match(sql, /ADD\s+COLUMN\s+target_kind\s+VARCHAR\(16\)\s+NOT\s+NULL\s+DEFAULT\s+'tree'/i, 'Must add writer-required target_kind DEFAULT tree');
  assert.match(sql, /ADD\s+COLUMN\s+target_id\s+TEXT/i, 'Must add writer-required target_id (text)');
});

// ─── 8. Production key-type compatibility (trees.id = text) ─────────────────

test('reconcile migration uses TEXT key type compatible with production trees.id', () => {
  assert.equal(/tree_id\s+UUID/i.test(content), false, 'tree_id must NOT be UUID (production trees.id is text)');
  assert.match(sql, /expected id\/tree_id text/i, 'Preflight must assert legacy id/tree_id are text');
  assert.match(sql, /ADD\s+COLUMN\s+target_id\s+TEXT/i, 'target_id must be TEXT (compatible with trees.id)');
});

// ─── 9. Canonical PRIMARY KEY (id) conversion ───────────────────────────────

test('reconcile migration converts PRIMARY KEY to (id)', () => {
  assert.match(sql, /ADD\s+CONSTRAINT\s+tree_comments_pkey\s+PRIMARY\s+KEY\s*\(id\)/i, 'Must add PRIMARY KEY (id) for writer replay uniqueness');
  // Post-verification must confirm PK (id) and NOT (tree_id, id).
  assert.match(sql, /PRIMARY KEY must be \(id\)/i, 'Post-verify must confirm PRIMARY KEY (id)');
});

// ─── 10. PK / FK / CHECK / DEFAULT / INDEX ──────────────────────────────────

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
  // The obsolete backfill UPDATEs must be gone.
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+created_at\s*=\s*NOW\(\)/i.test(content), false, 'Must not UPDATE created_at');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+updated_at\s*=\s*NOW\(\)/i.test(content), false, 'Must not UPDATE updated_at');
});

test('reconcile migration adds canonical indexes', () => {
  assert.match(sql, /idx_tree_comments_tree_id\s+ON\s+public\.tree_comments\s*\(tree_id\)/i, 'Must add idx_tree_comments_tree_id');
  assert.match(sql, /idx_tree_comments_owner_id\s+ON\s+public\.tree_comments\s*\(owner_id\)/i, 'Must add idx_tree_comments_owner_id');
  assert.match(sql, /idx_tree_comments_created_at\s+ON\s+public\.tree_comments\s*\(created_at\)/i, 'Must add idx_tree_comments_created_at');
});

// ─── 11. Sentinel defaults forbidden ────────────────────────────────────────

test('reconcile migration forbids sentinel defaults for owner_id and body', () => {
  assert.equal(/owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL\s+DEFAULT\s+'unknown'/i.test(content), false, "owner_id must NOT default to sentinel 'unknown'");
  assert.equal(/body\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/i.test(content), false, 'body must NOT default to sentinel empty string');
});

// ─── 12. Legacy preservation / rollback posture ──────────────────────────────

test('reconcile migration preserves legacy columns (no destructive drop of legacy fields)', () => {
  assert.equal(/DROP\s+COLUMN\s+author_id/i.test(content), false, 'Must not DROP legacy author_id');
  assert.equal(/DROP\s+COLUMN\s+payload/i.test(content), false, 'Must not DROP legacy payload');
  assert.equal(/DROP\s+COLUMN\s+is_deleted/i.test(content), false, 'Must not DROP legacy is_deleted');
  assert.match(sql, /POST-VERIFY FAIL: legacy-only columns/i, 'Must verify legacy columns preserved after migration');
});

test('reconcile migration post-verification is complete (sentinel/row-count/triggers)', () => {
  assert.match(sql, /sentinel defaults.*detected/i, 'Post-verify must reject sentinel defaults');
  assert.match(sql, /row count=.*after migration \(expected 0\)/i, 'Post-verify must confirm row count still 0');
  assert.match(sql, /unexpected trigger\/RLS\/dependent view appeared/i, 'Post-verify must confirm no new risky deps');
});

// ─── 13. No concrete DB role/user string, no production/staging apply ─────────

test('reconcile migration does not embed a concrete production DB role/user string', () => {
  // Generalization required: "Existing table ownership and ACLs are preserved by in-place ALTER."
  // Concrete role names (e.g. neondb_owner) must not appear.
  assert.equal(/neondb_owner/i.test(sql), false, 'Must not embed concrete production role name');
  assert.equal(/postgres\s+role|role\s*=\s*['"][a-z0-9_]+['"]/i.test(sql), false, 'Must not embed concrete role assignment');
});

test('reconcile migration does not reference production/staging execution', () => {
  assert.equal(/applied to production/i.test(sql), false, 'Must not claim production apply');
  assert.equal(/apply.*staging/i.test(sql), false, 'Must not reference staging apply');
});

// ─── 14. References / no-close hygiene ──────────────────────────────────────

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

// ─── 16. No private / no runtime / no production apply ──────────────────────

test('reconcile migration does not modify runtime, UI, Scout, or moment files', () => {
  assert.equal(/modal_compute\/tree_comments\.py/i.test(sql), false, 'Must not embed/modify runtime source');
  assert.equal(/functions\/api/i.test(sql), false, 'Must not embed route files');
  assert.equal(/Scout/i.test(sql), false, 'Must not reference Scout modification');
});
