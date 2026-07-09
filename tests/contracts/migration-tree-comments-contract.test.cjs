/**
 * Contract tests for the tree-level comment storage schema foundation (Issue #3388).
 *
 * These tests verify that scripts/migration-add-tree-comments.sql satisfies the
 * contractual requirements from the #3382/#3385 storage schema boundary audit:
 * a dedicated, tree-target comment table, strictly separate from the
 * moment-level `comments` table, with generic target pair reflecting the
 * existing idempotency/audit model.
 *
 * All assertions are source-level. No database connection, psql, subprocess,
 * git diff, or git status is used. No raw/private values are asserted.
 *
 * Refs: #3388, #3188, #3382, #3385, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-add-tree-comments.sql');
const MOMENT_COMMENTS_PATH = path.join(ROOT, 'scripts/migration-add-reactions-comments.sql');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

const sql = readFile(MIGRATION_PATH);

// ─── 1. Migration artifact exists and is additive/rerun-safe ─────────────────

test('tree comment migration SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
});

test('tree comment migration uses CREATE TABLE IF NOT EXISTS (additive)', () => {
  assert.ok(
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tree_comments/i.test(sql),
    'Must create tree_comments with IF NOT EXISTS'
  );
});

test('tree comment migration does not DROP/RENAME/ALTER existing social tables', () => {
  const content = stripSqlComments(sql);
  assert.equal(content.includes('DROP TABLE'), false, 'Must not DROP TABLE');
  assert.equal(content.includes('DROP COLUMN'), false, 'Must not DROP COLUMN');
  assert.equal(content.includes('RENAME'), false, 'Must not RENAME');
  assert.equal(content.includes('DROP INDEX'), false, 'Must not DROP INDEX');
  assert.equal(content.includes('DROP TRIGGER'), false, 'Must not DROP TRIGGER');
  assert.equal(content.includes('DROP FUNCTION'), false, 'Must not DROP FUNCTION');
});

// ─── 2. Dedicated tree-target storage ───────────────────────────────────────

test('tree_comments uses tree_id FK and never memory_id', () => {
  assert.match(
    sql,
    /tree_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+trees\(id\)\s+ON\s+DELETE\s+CASCADE/i,
    'tree_comments.tree_id must be a non-null FK to trees with cascade delete'
  );
  assert.equal(
    /memory_id/i.test(sql),
    false,
    'tree_comments must not reference memory_id (strict tree/moment separation)'
  );
});

test('tree_comments carries owner/body/timestamp columns', () => {
  assert.match(sql, /\bowner_id\b\s+VARCHAR\(128\)\s+NOT\s+NULL/i);
  assert.match(sql, /\bbody\b\s+TEXT\s+NOT\s+NULL/i);
  assert.match(sql, /\bcreated_at\b\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL/i);
  assert.match(sql, /\bupdated_at\b\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL/i);
});

test('tree_comments has tree-scoped indexes for list reads', () => {
  assert.match(sql, /idx_tree_comments_tree_id\s+ON\s+tree_comments\(tree_id\)/i);
  assert.match(sql, /idx_tree_comments_owner_id\s+ON\s+tree_comments\(owner_id\)/i);
  assert.match(sql, /idx_tree_comments_created_at\s+ON\s+tree_comments\(created_at\)/i);
});

// ─── 3. Generic target pair reflects idempotency/audit prerequisite ─────────

test('tree_comments carries generic target_kind/target_id for idempotency/audit reuse', () => {
  assert.match(sql, /target_kind\s+VARCHAR\(16\)\s+NOT\s+NULL\s+DEFAULT\s+'tree'/i);
  assert.match(sql, /CHECK\s*\(target_kind\s*=\s*'tree'\)/i);
  assert.match(sql, /target_id\s+UUID/i);
  assert.match(
    sql,
    /tree_comments_target_id_matches_tree_id\s+CHECK\s*\(target_id\s+IS\s+NULL\s+OR\s+target_id\s*=\s*tree_id\)/i
  );
});

// ─── 4. Moment comment storage remains untouched (separation) ───────────────

test('moment-level comments table is not modified by this migration', () => {
  const momentSql = readFile(MOMENT_COMMENTS_PATH);
  // The tree migration must not contain the moment comments CREATE/ALTER DDL.
  assert.equal(/ALTER\s+TABLE\s+.*\bcomments\b/i.test(sql), false, 'Must not ALTER the moment comments table');
  assert.equal(sql.includes('CREATE TABLE IF NOT EXISTS comments'), false, 'Must not recreate moment comments table');
  // Moment comments table still exists and is memory-target only (unchanged by us).
  assert.match(momentSql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+comments/i);
  assert.match(momentSql, /memory_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+memories\(id\)/i);
});

// ─── 5. References and no-apply / no-private-value hygiene ───────────────────

test('migration references #3388, #3188, #3382, #3385, #3075, #1882', () => {
  assert.ok(/#3388/.test(sql), 'Must reference #3388');
  assert.ok(/#3188/.test(sql), 'Must reference #3188');
  assert.ok(/#3382/.test(sql), 'Must reference #3382');
  assert.ok(/#3385/.test(sql), 'Must reference #3385');
  assert.ok(/#3075/.test(sql), 'Must reference #3075 as boundary');
  assert.ok(/#1882/.test(sql), 'Must reference #1882');
});

test('migration does not claim apply or embed connection strings', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/migration was applied|applied to production/i.test(sql), false, 'Must not claim production apply');
  assert.ok(
    /schema foundation only|Apply under separate approval/i.test(sql),
    'Must state schema-foundation-only / separate-approval posture'
  );
});

test('migration forbids close keywords for parent issues', () => {
  assert.equal(/\bCloses\s+#3188\b/i.test(sql), false, 'Must not use Closes #3188');
  assert.equal(/\bFixes\s+#3188\b/i.test(sql), false, 'Must not use Fixes #3188');
  assert.equal(/\bResolves\s+#3188\b/i.test(sql), false, 'Must not use Resolves #3188');
  assert.equal(/\bCloses\s+#3075\b/i.test(sql), false, 'Must not use Closes #3075');
  assert.equal(/\bCloses\s+#1882\b/i.test(sql), false, 'Must not use Closes #1882');
});
