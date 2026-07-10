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
 * SQLSTATE 42703 (UndefinedColumn "body") is the root-cause diagnostic from #3422 that
 * this reconciliation resolves. The migration must reference it and the legacy shape.
 *
 * Refs: #3423, #3418, #3422, #3188, #3075, #1882
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

test('reconcile migration does not embed a connection string or auto-apply', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/createdb|pg_restore|automatically applied|auto-?apply/i.test(sql), false, 'Must not auto-apply');
});

// ─── 3. SQLSTATE 42703 root-cause reference ─────────────────────────────────

test('reconcile migration references SQLSTATE 42703 root cause', () => {
  assert.ok(
    /42703/i.test(sql),
    'Migration must reference SQLSTATE 42703 (UndefinedColumn) root cause from #3422'
  );
  assert.ok(
    /column\s+"body"\s+does\s+not\s+exist/i.test(sql),
    'Migration must document the exact reader failure (column "body" does not exist)'
  );
});

// ─── 4. Exact eight-column legacy shape assertion ───────────────────────────

test('reconcile migration asserts exact 8-column legacy shape', () => {
  // The preflight must verify the legacy column count equals 8.
  assert.match(sql, /legacy\s+column\s+count[^;]*expected\s+8/i, 'Must assert legacy column count = 8');
  // All eight legacy column names must be referenced in the preflight.
  for (const col of ['id', 'tree_id', 'author_id', 'author_display_name', 'is_deleted', 'created_at', 'updated_at', 'payload']) {
    assert.ok(
      new RegExp(`column_name='${col}'`, 'i').test(sql) || new RegExp(`column_name="${col}"`, 'i').test(sql),
      `Preflight must reference legacy column ${col}`
    );
  }
});

test('reconcile migration asserts table existence', () => {
  assert.match(sql, /table_existence|tree_comments table existence/i, 'Must assert table existence in preflight');
});

// ─── 5. Zero-row / fail-closed guards ───────────────────────────────────────

test('reconcile migration enforces row count = 0 guard', () => {
  assert.match(sql, /row count\s*=\s*0/i, 'Must assert row count = 0 in preflight');
  assert.match(sql, /v_rows\s*<>\s*0/i, 'Must fail closed when row count <> 0');
  assert.match(sql, /abort to avoid destructive copy/i, 'Must fail closed when rows are present');
});

test('reconcile migration fails closed on unexpected schema (canonical cols present)', () => {
  assert.match(
    sql,
    /canonical columns already present/i,
    'Must fail closed if canonical columns already present (already reconciled / unexpected)'
  );
});

test('reconcile migration fails closed on unexpected triggers/RLS/dependent views', () => {
  assert.match(sql, /PREFLIGHT FAIL: unexpected triggers/i, 'Must fail closed on unexpected triggers');
  assert.match(sql, /PREFLIGHT FAIL: RLS enabled/i, 'Must fail closed on RLS enabled');
  assert.match(sql, /PREFLIGHT FAIL: dependent views/i, 'Must fail closed on dependent views');
});

// ─── 6. Reader / writer required columns ────────────────────────────────────

test('reconcile migration adds reader-required column body', () => {
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+body\s+TEXT\s+NOT\s+NULL/i, 'Must add reader-required body TEXT NOT NULL');
});

test('reconcile migration adds writer-required columns', () => {
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+owner_id\s+VARCHAR\(128\)\s+NOT\s+NULL/i, 'Must add writer-required owner_id');
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+target_kind\s+VARCHAR\(16\)\s+NOT\s+NULL/i, 'Must add writer-required target_kind');
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+target_id\s+TEXT/i, 'Must add writer-required target_id (text)');
});

// ─── 7. Production key-type compatibility (trees.id = text) ─────────────────

test('reconcile migration uses TEXT key type compatible with production trees.id', () => {
  // Production trees.id is TEXT (not UUID). tree_id must be TEXT, not UUID.
  assert.equal(/tree_id\s+UUID/i.test(content), false, 'tree_id must NOT be UUID (production trees.id is text)');
  assert.match(sql, /expected id\/tree_id text/i, 'Preflight must assert legacy id/tree_id are text');
  // target_id reconciled to TEXT to match trees.id text convention.
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+target_id\s+TEXT/i, 'target_id must be TEXT (compatible with trees.id)');
});

// ─── 8. PK / FK / CHECK / DEFAULT / INDEX ───────────────────────────────────

test('reconcile migration preserves tree_id FK to trees and adds target invariants', () => {
  // Existing legacy PK (tree_id, id) and FK tree_id->trees are preserved by ALTER;
  // the migration must not DROP them and must add the target_id/tree_id CHECK.
  assert.match(
    sql,
    /ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS\s+tree_comments_target_id_matches_tree_id\s+CHECK\s*\(target_id\s+IS\s+NULL\s+OR\s+target_id\s*=\s*tree_id\)/i,
    'Must add target_id IS NULL OR target_id = tree_id CHECK'
  );
  assert.match(
    sql,
    /ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS\s+tree_comments_target_kind_is_tree\s+CHECK\s*\(target_kind\s*=\s*'tree'\)/i,
    'Must add target_kind = tree CHECK'
  );
});

test('reconcile migration enforces created_at/updated_at NOT NULL (canonical requirement)', () => {
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+SET\s+NOT\s+NULL/i, 'Must make created_at NOT NULL');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+SET\s+NOT\s+NULL/i, 'Must make updated_at NOT NULL');
});

test('reconcile migration adds canonical indexes', () => {
  assert.match(sql, /idx_tree_comments_owner_id\s+ON\s+public\.tree_comments\s*\(owner_id\)/i, 'Must add idx_tree_comments_owner_id');
  assert.match(sql, /idx_tree_comments_created_at\s+ON\s+public\.tree_comments\s*\(created_at\)/i, 'Must add idx_tree_comments_created_at');
});

// ─── 9. Legacy preservation / rollback posture ──────────────────────────────

test('reconcile migration preserves legacy columns (no destructive drop of legacy fields)', () => {
  // Legacy columns must remain present (preserved, not dropped).
  assert.equal(/DROP\s+COLUMN\s+author_id/i.test(content), false, 'Must not DROP legacy author_id');
  assert.equal(/DROP\s+COLUMN\s+payload/i.test(content), false, 'Must not DROP legacy payload');
  assert.equal(/DROP\s+COLUMN\s+is_deleted/i.test(content), false, 'Must not DROP legacy is_deleted');
  // Post-verification confirms body/owner_id/target_kind/target_id were added.
  assert.match(sql, /POST-VERIFY FAIL: canonical columns missing/i, 'Must verify canonical columns present after migration');
});

// ─── 10. References / no-close hygiene ──────────────────────────────────────

test('reconcile migration references #3423, #3418, #3422, #3188, #3075, #1882', () => {
  assert.ok(/#3423/.test(sql), 'Must reference #3423');
  assert.ok(/#3418/.test(sql), 'Must reference #3418');
  assert.ok(/#3422/.test(sql), 'Must reference #3422');
  assert.ok(/#3188/.test(sql), 'Must reference #3188');
  assert.ok(/#3075/.test(sql), 'Must reference #3075 as boundary');
  assert.ok(/#1882/.test(sql), 'Must reference #1882');
});

test('reconcile migration does not use close keywords for parent issues', () => {
  assert.equal(/\bCloses\s+#3188\b/i.test(sql), false, 'Must not use Closes #3188');
  assert.equal(/\bCloses\s+#3075\b/i.test(sql), false, 'Must not use Closes #3075');
  assert.equal(/\bCloses\s+#1882\b/i.test(sql), false, 'Must not use Closes #1882');
});

// ─── 11. No private / no runtime / no production apply ──────────────────────

test('reconcile migration does not modify runtime, UI, Scout, or moment files', () => {
  // This is a SQL-only artifact; assert it does not embed source paths it should not touch.
  assert.equal(/modal_compute\/tree_comments\.py/i.test(sql), false, 'Must not embed/modify runtime source');
  assert.equal(/functions\/api/i.test(sql), false, 'Must not embed route files');
  assert.equal(/Scout/i.test(sql), false, 'Must not reference Scout modification');
});
