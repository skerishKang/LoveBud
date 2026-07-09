/**
 * Contract tests for Migration B of the generic social write target model (Issue #3352).
 *
 * These tests verify that scripts/migration-b-generic-social-targets-cutover.sql
 * and docs/ops/generic-social-targets-migration-b-runbook.md satisfy the
 * contractual requirements defined by Issue #3260 / #3352.
 *
 * All assertions are source-level. No database connection, psql, subprocess,
 * git diff, or git status is used. No raw/private values are asserted.
 *
 * Refs: #3352, #3264, #3262, #3260, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const RUNBOOK_PATH = path.join(ROOT, 'docs/ops/generic-social-targets-migration-b-runbook.md');
const MIGRATION_A_PATH = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const PRODUCT_CONTRACT_PATH = path.join(
  ROOT,
  'docs/product/lovebud-generic-social-write-target-contract.md'
);
const EXISTING_HARDEN_PATH = path.join(ROOT, 'scripts/migration-harden-moment-social-writes.sql');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

// ─── 1. Artifact files exist ──────────────────────────────────────────────────

test('Migration B SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
});

test('Migration B runbook exists', () => {
  assert.ok(fs.existsSync(RUNBOOK_PATH));
});

test('Migration A artifact remains present and unedited by this contract path', () => {
  assert.ok(fs.existsSync(MIGRATION_A_PATH));
  const content = readFile(MIGRATION_A_PATH);
  assert.ok(content.includes('Migration A'), 'Migration A file must remain present');
  assert.ok(
    content.includes("target_kind != 'memory'"),
    'Migration A still blocks non-memory kinds in its own trigger body'
  );
});

// ─── 2. SQL is transactional ──────────────────────────────────────────────────

test('SQL is wrapped in BEGIN and COMMIT', () => {
  const sql = stripSqlComments(readFile(MIGRATION_PATH));
  const beginIdx = sql.indexOf('BEGIN;');
  const commitIdx = sql.lastIndexOf('COMMIT;');
  assert.ok(beginIdx >= 0, 'SQL must start with BEGIN');
  assert.ok(commitIdx > beginIdx, 'SQL must end with COMMIT after BEGIN');
});

// ─── 3. Preflight requires Migration A tables, columns, and triggers ──────────

test('SQL preflight checks legacy tables, generic columns, and Migration A triggers', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(content.includes("to_regclass('public.social_idempotency')"));
  assert.ok(content.includes("to_regclass('public.social_audit_log')"));
  assert.ok(content.includes("column_name = 'target_kind'"));
  assert.ok(content.includes("column_name = 'target_id'"));
  assert.ok(content.includes("tgname = 'trg_social_idempotency_sync_generic_target'"));
  assert.ok(content.includes("tgname = 'trg_social_audit_log_sync_generic_target'"));
  assert.ok(
    content.includes('Apply scripts/migration-add-generic-social-targets.sql before Migration B') ||
      content.includes('Migration A generic columns missing'),
    'Must fail clearly when Migration A is missing'
  );
});

// ─── 4. Preflight validates Gate A row integrity ──────────────────────────────

test('Preflight rejects null/partial pairs, memory mismatches, tree-in-legacy, unknown kinds', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(content.includes('lack a complete generic pair') || content.includes('Gate A incomplete'));
  assert.ok(content.includes('partial generic pair'));
  assert.ok(content.includes('memory generic/legacy mismatch'));
  assert.ok(content.includes('incorrectly populate target_memory_id') || content.includes('tree row'));
  assert.ok(content.includes('unknown target_kind'));
});

// ─── 5. Legacy NOT NULL is relaxed; columns preserved ─────────────────────────

test('SQL relaxes NOT NULL on target_memory_id and memory_id without dropping columns', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('ALTER COLUMN target_memory_id DROP NOT NULL'),
    'Must DROP NOT NULL on social_idempotency.target_memory_id'
  );
  assert.ok(
    content.includes('ALTER COLUMN memory_id DROP NOT NULL'),
    'Must DROP NOT NULL on social_audit_log.memory_id'
  );
  assert.ok(
    content.includes("is_nullable = 'NO'"),
    'DROP NOT NULL must be guarded by nullability check for rerun safety'
  );
});

test('SQL does not drop, rename, or repurpose legacy memory columns', () => {
  const content = stripSqlComments(readFile(MIGRATION_PATH));
  assert.equal(content.includes('DROP COLUMN'), false, 'Must not DROP COLUMN');
  assert.equal(content.includes('RENAME'), false, 'Must not RENAME');
  assert.equal(content.includes('DROP TABLE'), false, 'Must not DROP TABLE');
  assert.equal(content.includes('DROP INDEX'), false, 'Must not DROP INDEX');
  assert.equal(content.includes('DROP TRIGGER'), false, 'Must not DROP TRIGGER');
  assert.equal(content.includes('DROP FUNCTION'), false, 'Must not DROP FUNCTION');
  // Columns must still be referenced as legacy readable fields
  const raw = readFile(MIGRATION_PATH);
  assert.ok(raw.includes('target_memory_id'));
  assert.ok(raw.includes('memory_id'));
});

// ─── 6. Generic pair becomes authoritative ────────────────────────────────────

test('SQL sets target_kind and target_id NOT NULL on both tables (guarded)', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(content.includes('ALTER COLUMN target_kind SET NOT NULL'));
  assert.ok(content.includes('ALTER COLUMN target_id SET NOT NULL'));
  // Both tables appear near SET NOT NULL blocks
  assert.ok(content.includes('ALTER TABLE social_idempotency'));
  assert.ok(content.includes('ALTER TABLE social_audit_log'));
  assert.ok(
    content.includes("is_nullable = 'YES'"),
    'SET NOT NULL must be guarded for rerun safety'
  );
});

// ─── 7. Compatibility CHECKs for memory match and tree/legacy isolation ───────

test('SQL adds guarded memory-match and tree-legacy-null CHECK constraints', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(content.includes('social_idempotency_memory_legacy_match_check'));
  assert.ok(content.includes('social_idempotency_tree_legacy_null_check'));
  assert.ok(content.includes('social_audit_log_memory_legacy_match_check'));
  assert.ok(content.includes('social_audit_log_tree_legacy_null_check'));
  assert.ok(content.includes("target_kind IS DISTINCT FROM 'memory'"));
  assert.ok(content.includes("target_kind IS DISTINCT FROM 'tree'"));
  assert.ok(content.includes('OR target_memory_id IS NULL'));
  assert.ok(content.includes('OR memory_id IS NULL'));
});

// ─── 8. Trigger functions preserve moment writers and allow tree ──────────────

test('Trigger functions still auto-populate memory pair from legacy-only writes', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()')
  );
  assert.ok(
    content.includes('CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()')
  );

  const idem = content.slice(
    content.indexOf('sync_social_idempotency_generic_target_from_legacy_memory'),
    content.indexOf('sync_social_audit_generic_target_from_legacy_memory')
  );
  assert.ok(idem.includes("NEW.target_kind := 'memory'"));
  assert.ok(idem.includes('NEW.target_id := NEW.target_memory_id'));
  assert.ok(idem.includes('RETURN NEW'));

  const auditStart = content.indexOf('sync_social_audit_generic_target_from_legacy_memory');
  const audit = content.slice(auditStart, content.indexOf('$$;', content.indexOf('NEW.memory_id', auditStart)) + 3);
  assert.ok(audit.includes("NEW.target_kind := 'memory'"));
  assert.ok(audit.includes('NEW.target_id := NEW.memory_id'));
});

test('Trigger functions permit tree targets only when legacy memory fields are null', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(content.includes("NEW.target_kind = 'tree'"));
  assert.ok(content.includes('Tree targets must not populate legacy target_memory_id'));
  assert.ok(content.includes('Tree targets must not populate legacy memory_id'));
});

test('Trigger functions reject partial pairs, memory mismatches, and unknown kinds', () => {
  const content = readFile(MIGRATION_PATH);
  const partialMatches = content.match(/Partial generic target pair/g) || [];
  assert.ok(partialMatches.length >= 2, 'Both functions must reject partial pairs');
  assert.ok(content.includes('does not match legacy target_memory_id for memory target'));
  assert.ok(content.includes('does not match legacy memory_id for memory target'));
  assert.ok(content.includes('Unknown target_kind'));
  assert.ok(content.includes('only memory and tree are permitted'));
});

// ─── 9. Triggers remain named; creation is guarded without DROP TRIGGER ───────

test('Trigger names remain Migration A names and creation is guarded', () => {
  const raw = readFile(MIGRATION_PATH);
  const content = stripSqlComments(raw);
  assert.equal(content.includes('DROP TRIGGER'), false);
  assert.ok(raw.includes('trg_social_idempotency_sync_generic_target'));
  assert.ok(raw.includes('trg_social_audit_log_sync_generic_target'));
  assert.ok(raw.includes('BEFORE INSERT OR UPDATE'));
  assert.ok(raw.includes('FOR EACH ROW'));
  assert.ok(raw.includes('IF NOT EXISTS') && raw.includes('pg_trigger'));
});

// ─── 10. Product contract alignment ───────────────────────────────────────────

test('Product contract still defines Migration B as separate NOT NULL relaxation cutover', () => {
  const doc = readFile(PRODUCT_CONTRACT_PATH);
  assert.ok(/Migration B/i.test(doc));
  assert.ok(/Relaxes legacy.*NOT NULL|legacy.*NOT NULL.*relax/i.test(doc));
  assert.ok(doc.includes("target_kind = 'tree'"));
  assert.ok(
    /must not populate.*target_memory_id|must not populate.*memory_id/i.test(doc) ||
      doc.includes('must not populate `target_memory_id` or `memory_id`')
  );
});

test('Existing harden migration still documents original legacy NOT NULL creation', () => {
  const content = readFile(EXISTING_HARDEN_PATH);
  assert.ok(content.includes('target_memory_id UUID NOT NULL'));
  assert.ok(content.includes('memory_id UUID NOT NULL'));
});

// ─── 11. Runbook: no apply, separate approval, verification, non-goals ────────

test('Runbook states artifact-only scope and requires separate CTO approval', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('does not apply the migration') ||
      content.includes('Do not execute this command in this task')
  );
  assert.ok(content.includes('separate CTO approval'));
  assert.ok(content.includes('scripts/migration-b-generic-social-targets-cutover.sql'));
});

test('Runbook blocks Modal/Cloudflare deploy and tree runtime activation', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(content.includes('No Modal or Cloudflare deployment'));
  assert.ok(content.includes('Tree runtime hardening') || content.includes('tree runtime'));
  assert.ok(content.includes('blocked'));
});

test('Runbook includes aggregate-only verification queries and Gate B checklist', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(content.includes('is_nullable'));
  assert.ok(content.includes('null_pair') && content.includes('partial_pair'));
  assert.ok(content.includes('mismatch_count'));
  assert.ok(content.includes('tree_legacy_populated'));
  assert.ok(content.includes('GROUP BY'));
  assert.ok(content.includes('trigger_name'));
  assert.ok(content.includes('Verification Gate B'));
});

test('Runbook defines runtime-first rollback and separate schema approval', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(content.includes('No automatic rollback'));
  assert.ok(content.includes('roll that runtime back first') || content.includes('Roll back any runtime'));
  assert.ok(content.includes('separate approval'));
});

test('Runbook non-goals exclude UI, Browse, My Trees, #3075, Editor, Scout, Hermes', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(/non-goals/i.test(content));
  assert.ok(content.includes('Browse') && content.includes('My Trees'));
  assert.ok(content.includes('#3075'));
  assert.ok(content.includes('Editor') && content.includes('Scout') && content.includes('Hermes'));
  assert.ok(content.includes('No actual database migration application'));
});

// ─── 12. No private-value / apply claims in artifacts ─────────────────────────

test('Migration B SQL and runbook do not claim production apply or embed connection strings', () => {
  const sql = readFile(MIGRATION_PATH);
  const runbook = readFile(RUNBOOK_PATH);
  assert.equal(/postgresql:\/\//i.test(sql), false);
  assert.equal(/postgresql:\/\//i.test(runbook), false);
  assert.equal(/migration was applied|applied to production/i.test(runbook), false);
  assert.ok(runbook.includes('does not apply') || runbook.includes('Do not execute'));
});
