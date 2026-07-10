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
  // ON DELETE CASCADE on a foreign key definition is allowed (legacy FK preserved).
  assert.equal(/DROP\s+CONSTRAINT.*CASCADE/i.test(content), false, 'Must not DROP CONSTRAINT ... CASCADE');
});

test('rollback script does not embed a connection string or credentials', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/DATABASE_URL/i.test(sql), false, 'Must not embed a credential variable');
});

// ─── 3. Exact reconciled-schema preflight (fail closed) ─────────────────────

test('rollback script confirms exact reconciled schema before altering', () => {
  // It must verify the canonical columns/CHECK/PK are present before reverting.
  assert.match(sql, /ROLLBACK PRECONDITION FAIL: table is not the reconciled shape/i, 'Must fail closed if not reconciled');
  assert.match(sql, /canonical PRIMARY KEY \(id\) not present/i, 'Must confirm canonical PK (id) present');
  assert.match(sql, /canonical CHECK constraints missing/i, 'Must confirm canonical CHECKs present');
  assert.match(sql, /migration-added indexes missing/i, 'Must confirm migration-added indexes present');
});

test('rollback script enforces zero-row guard (fail closed if data exists)', () => {
  assert.match(sql, /ROLLBACK PRECONDITION FAIL: tree_comments row_count=/i, 'Must fail closed when row count <> 0');
  assert.match(sql, /abort to avoid data loss/i, 'Must abort to avoid data loss when rows present');
});

test('rollback script fails closed on unexpected column count', () => {
  assert.match(sql, /unexpected column count=/i, 'Must fail closed on unexpected column count');
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

test('rollback script reads canonical PK from catalog (no guessed name)', () => {
  assert.equal(/DROP CONSTRAINT tree_comments_pkey/i.test(content), false, 'Must not hard-code/drop a guessed PK name');
  assert.match(sql, /PK LOOKUP FAIL/i, 'Must read PK from catalog and fail closed if not exactly (id)');
});

// ─── 6. Index removal (migration-added only) ───────────────────────────────

test('rollback script removes migration-added indexes', () => {
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tree_comments_owner_id/i, 'Must drop idx_tree_comments_owner_id');
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tree_comments_created_at/i, 'Must drop idx_tree_comments_created_at');
});

test('rollback script preserves legacy tree_id index', () => {
  // idx_tree_comments_tree_id is a legacy list-read index and must NOT be dropped.
  assert.equal(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tree_comments_tree_id/i.test(content), false, 'Must preserve legacy idx_tree_comments_tree_id');
});

// ─── 7. Timestamp nullable / default reversion ─────────────────────────────

test('rollback script reverts created_at/updated_at to NULLABLE and drops defaults', () => {
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+DROP\s+DEFAULT/i, 'Must drop created_at default');
  assert.match(sql, /ALTER\s+COLUMN\s+created_at\s+DROP\s+NOT\s+NULL/i, 'Must revert created_at to NULLABLE');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+DROP\s+DEFAULT/i, 'Must drop updated_at default');
  assert.match(sql, /ALTER\s+COLUMN\s+updated_at\s+DROP\s+NOT\s+NULL/i, 'Must revert updated_at to NULLABLE');
  // No sentinel backfill.
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+created_at/i.test(content), false, 'Must not UPDATE created_at');
  assert.equal(/UPDATE\s+public\.tree_comments\s+SET\s+updated_at/i.test(content), false, 'Must not UPDATE updated_at');
});

// ─── 8. Post-rollback verification ──────────────────────────────────────────

test('rollback script post-verifies exact legacy 8-column shape', () => {
  assert.match(sql, /ROLLBACK POST-VERIFY FAIL: column count=/i, 'Must confirm column count = 8');
  assert.match(sql, /canonical columns still present/i, 'Must confirm canonical columns gone');
  assert.match(sql, /legacy composite PK \(tree_id, id\) not restored/i, 'Must confirm legacy PK restored');
  assert.match(sql, /legacy FKs not preserved/i, 'Must confirm legacy FKs preserved');
  assert.match(sql, /migration-added indexes still present/i, 'Must confirm added indexes gone');
  assert.match(sql, /not reverted to NULLABLE/i, 'Must confirm timestamps reverted');
  assert.match(sql, /row count=.*after rollback \(expected 0\)/i, 'Must confirm row count still 0');
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
