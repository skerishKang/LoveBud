/**
 * Contract tests for Migration A of the generic social write target model (Issue #3262).
 *
 * These tests verify that scripts/migration-add-generic-social-targets.sql
 * and docs/ops/generic-social-targets-migration-a-runbook.md satisfy the
 * contractual requirements defined by Issue #3260.
 *
 * All assertions are source-level. No database connection, psql, subprocess,
 * git diff, or git status is used.
 *
 * Refs: #3262, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const RUNBOOK_PATH = path.join(ROOT, 'docs/ops/generic-social-targets-migration-a-runbook.md');
const EXISTING_MIGRATION_PATH = path.join(ROOT, 'scripts/migration-harden-moment-social-writes.sql');
const EXISTING_CONTRACT_PATH = path.join(ROOT, 'tests/contracts/moment-social-write-migration-contract.test.cjs');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

// ─── 1. All three new files exist ─────────────────────────────────────────────

test('Migration A SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
});

test('Migration A runbook exists', () => {
  assert.ok(fs.existsSync(RUNBOOK_PATH));
});

test('Contract test file exists (self-evident)', () => {
  assert.ok(fs.existsSync(__filename));
});

// ─── 2. SQL is transactional with BEGIN and COMMIT ────────────────────────────

test('SQL is wrapped in BEGIN and COMMIT', () => {
  const sql = stripSqlComments(readFile(MIGRATION_PATH));
  const beginIdx = sql.indexOf('BEGIN;');
  const commitIdx = sql.lastIndexOf('COMMIT;');
  assert.ok(beginIdx >= 0, 'SQL must start with BEGIN');
  assert.ok(commitIdx > beginIdx, 'SQL must end with COMMIT after BEGIN');
});

// ─── 3. SQL checks for both prerequisite legacy tables before schema alteration ─

test('SQL checks for both prerequisite legacy tables via to_regclass before ALTER TABLE', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('to_regclass(\'public.social_idempotency\')'),
    'Must check public.social_idempotency with to_regclass'
  );
  assert.ok(
    content.includes('to_regclass(\'public.social_audit_log\')'),
    'Must check public.social_audit_log with to_regclass'
  );
  assert.ok(
    content.includes('RAISE EXCEPTION') && content.includes('not found'),
    'Prerequisite check must RAISE EXCEPTION on missing table'
  );
});

// ─── 4. SQL adds exactly the four generic columns with ADD COLUMN IF NOT EXISTS ─

test('SQL adds target_kind VARCHAR(16) and target_id UUID to social_idempotency with ADD COLUMN IF NOT EXISTS', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('ALTER TABLE social_idempotency\n    ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16)'),
    'social_idempotency target_kind must use ADD COLUMN IF NOT EXISTS'
  );
  assert.ok(
    content.includes('ALTER TABLE social_idempotency\n    ADD COLUMN IF NOT EXISTS target_id UUID'),
    'social_idempotency target_id must use ADD COLUMN IF NOT EXISTS'
  );
});

test('SQL adds target_kind VARCHAR(16) and target_id UUID to social_audit_log with ADD COLUMN IF NOT EXISTS', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('ALTER TABLE social_audit_log\n    ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16)'),
    'social_audit_log target_kind must use ADD COLUMN IF NOT EXISTS'
  );
  assert.ok(
    content.includes('ALTER TABLE social_audit_log\n    ADD COLUMN IF NOT EXISTS target_id UUID'),
    'social_audit_log target_id must use ADD COLUMN IF NOT EXISTS'
  );
});

// ─── 5. SQL does not set generic fields NOT NULL ───────────────────────────────

test('ADD COLUMN statements for generic target fields do not include NOT NULL', () => {
  const content = readFile(MIGRATION_PATH);
  const addMatches = content.match(/ADD COLUMN IF NOT EXISTS target_\w+/g) || [];
  assert.ok(addMatches.length >= 4, 'Must have at least 4 ADD COLUMN IF NOT EXISTS for target fields');
  addMatches.forEach(col => {
    const line = content.split('\n').find(l => l.includes(col));
    if (line) {
      assert.equal(line.includes('NOT NULL'), false,
        `ADD COLUMN for ${col} must not include NOT NULL`);
    }
  });
});

// ─── 6. SQL does not rename or drop tables, columns, indexes, constraints,
//       functions, or triggers ──────────────────────────────────────────────────

test('SQL does not contain any DROP or RENAME statement', () => {
  const content = stripSqlComments(readFile(MIGRATION_PATH));
  const forbids = [
    ['DROP TABLE', 'DROP TABLE'],
    ['DROP INDEX', 'DROP INDEX'],
    ['DROP COLUMN', 'DROP COLUMN'],
    ['DROP CONSTRAINT', 'DROP CONSTRAINT'],
    ['DROP FUNCTION', 'DROP FUNCTION'],
    ['DROP TRIGGER', 'DROP TRIGGER'],
    ['RENAME', 'RENAME'],
  ];
  forbids.forEach(([word, label]) => {
    assert.equal(content.includes(word), false, `SQL must not contain ${label}`);
  });
});

// ─── 7. Existing migration files retain expected legacy-target anchors ─────────

test('Existing migration-harden-moment-social-writes.sql retains target_memory_id and memory_id columns', () => {
  const content = readFile(EXISTING_MIGRATION_PATH);
  assert.ok(
    content.includes('target_memory_id UUID NOT NULL'),
    'Existing migration must retain social_idempotency target_memory_id'
  );
  assert.ok(
    content.includes('memory_id UUID NOT NULL'),
    'Existing migration must retain social_audit_log memory_id'
  );
});

test('Existing moment-social-write-migration-contract.test.cjs remains present', () => {
  assert.ok(fs.existsSync(EXISTING_CONTRACT_PATH), 'Existing moment migration contract test must remain present');
  const content = readFile(EXISTING_CONTRACT_PATH);
  assert.ok(
    content.includes('target_memory_id'),
    'Existing contract test must still reference target_memory_id'
  );
  assert.ok(
    content.includes('memory_id'),
    'Existing contract test must still reference memory_id'
  );
});

// ─── 8. Both legacy tables are backfilled as memory targets from legacy fields ─

test('social_idempotency backfill sets target_kind = memory and target_id from target_memory_id', () => {
  const content = readFile(MIGRATION_PATH);
  const updateBlock = content.slice(
    content.indexOf('UPDATE social_idempotency'),
    content.indexOf('UPDATE social_audit_log')
  );
  assert.ok(updateBlock.includes("target_kind = 'memory'"), 'Must set target_kind to memory');
  assert.ok(updateBlock.includes('target_id = target_memory_id'), 'Must set target_id from target_memory_id');
});

test('social_audit_log backfill sets target_kind = memory and target_id from memory_id', () => {
  const content = readFile(MIGRATION_PATH);
  const updateBlock = content.slice(
    content.indexOf('UPDATE social_audit_log'),
    content.indexOf('-- Post-backfill validation')
  );
  assert.ok(updateBlock.includes("target_kind = 'memory'"), 'Must set target_kind to memory');
  assert.ok(updateBlock.includes('target_id = memory_id'), 'Must set target_id from memory_id');
});

// ─── 9. Backfill does not overwrite a complete existing generic pair ───────────

test('Backfill WHERE clause targets only rows where both generic fields are absent', () => {
  const content = readFile(MIGRATION_PATH);
  const updateStmts = content.match(/UPDATE social_\w+[\s\S]*?WHERE target_kind IS NULL\s+AND target_id IS NULL/g) || [];
  assert.ok(updateStmts.length >= 2, 'Each UPDATE must guard against overwriting existing generic pairs');
  updateStmts.forEach(stmt => {
    assert.ok(
      stmt.includes('target_kind IS NULL') && stmt.includes('target_id IS NULL'),
      'Backfill guard must check both generic fields are NULL'
    );
  });
});

// ─── 10. Validation rejects null, partial, non-memory, and mismatched pairs ────

test('Post-backfill DO block validates null, partial, non-memory, and mismatched pairs for social_idempotency', () => {
  const content = readFile(MIGRATION_PATH);
  const block = content.slice(
    content.indexOf('DECLARE'),
    content.indexOf('-- Generic-pair CHECK constraints')
  );
  assert.ok(
    block.includes('NULL generic pair after backfill'),
    'Must reject NULL generic pairs'
  );
  assert.ok(
    block.includes('partial generic pair'),
    'Must reject partial generic pairs'
  );
  assert.ok(
    block.includes('target_kind other than memory'),
    'Must reject non-memory target_kind'
  );
  assert.ok(
    block.includes('different from legacy target_memory_id'),
    'Must reject generic/legacy mismatch for social_idempotency'
  );
  assert.ok(
    block.includes('different from legacy memory_id'),
    'Must reject generic/legacy mismatch for social_audit_log'
  );
});

// ─── 11. Pair-presence constraints and exactly-two-kind vocabulary ────────────

test('Both tables have guarded pair-presence CHECK constraints', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('social_idempotency_generic_target_pair_check'),
    'Must define social_idempotency pair check'
  );
  assert.ok(
    content.includes('social_audit_log_generic_target_pair_check'),
    'Must define social_audit_log pair check'
  );
  // Both-null or both-non-null pattern
  const pairPattern = /target_kind IS NULL AND target_id IS NULL[\s\S]*?target_kind IS NOT NULL AND target_id IS NOT NULL/;
  assert.ok(
    pairPattern.test(content),
    'Each pair check must use both-null / both-non-null pattern'
  );
});

test('Both tables have guarded target_kind CHECK constraints allowing only memory and tree', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('social_idempotency_generic_target_kind_check'),
    'Must define social_idempotency kind check'
  );
  assert.ok(
    content.includes('social_audit_log_generic_target_kind_check'),
    'Must define social_audit_log kind check'
  );
  assert.ok(
    content.includes("'memory', 'tree'"),
    'Kind check must allow exactly memory and tree'
  );
});

test('All CHECK constraints use guarded DO block with pg_constraint existence check', () => {
  const content = readFile(MIGRATION_PATH);
  const guardCount = (content.match(/conname\s*=\s*'[^']+_check'/g) || []).length;
  assert.ok(guardCount >= 4, 'Each of the 4 CHECK constraints must be guarded (found ' + guardCount + ')');
});

// ─── 12. Both named compatibility functions exist ─────────────────────────────

test('sync_social_idempotency_generic_target_from_legacy_memory function exists and is RETURNS TRIGGER LANGUAGE plpgsql', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()'),
    'Function must use correct full name'
  );
  assert.ok(
    content.match(/sync_social_idempotency_generic_target_from_legacy_memory[\s\S]*?RETURNS TRIGGER/),
    'Function must return TRIGGER'
  );
  assert.ok(
    content.match(/sync_social_idempotency_generic_target_from_legacy_memory[\s\S]*?LANGUAGE plpgsql/),
    'Function must be LANGUAGE plpgsql'
  );
});

test('sync_social_audit_generic_target_from_legacy_memory function exists and is RETURNS TRIGGER LANGUAGE plpgsql', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()'),
    'Function must use correct full name'
  );
  assert.ok(
    content.match(/sync_social_audit_generic_target_from_legacy_memory[\s\S]*?RETURNS TRIGGER/),
    'Function must return TRIGGER'
  );
  assert.ok(
    content.match(/sync_social_audit_generic_target_from_legacy_memory[\s\S]*?LANGUAGE plpgsql/),
    'Function must be LANGUAGE plpgsql'
  );
});

// ─── 13. Both named triggers exist and are BEFORE INSERT OR UPDATE ────────────

test('trg_social_idempotency_sync_generic_target trigger exists with BEFORE INSERT OR UPDATE', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('trg_social_idempotency_sync_generic_target'),
    'Trigger must be named trg_social_idempotency_sync_generic_target'
  );
  assert.ok(
    content.includes('BEFORE INSERT OR UPDATE') &&
    content.includes('ON social_idempotency'),
    'Trigger must be BEFORE INSERT OR UPDATE ON social_idempotency'
  );
  assert.ok(
    content.includes('FOR EACH ROW'),
    'Trigger must be FOR EACH ROW'
  );
  assert.ok(
    content.includes('EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()'),
    'Trigger must execute the idempotency function'
  );
});

test('trg_social_audit_log_sync_generic_target trigger exists with BEFORE INSERT OR UPDATE', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('trg_social_audit_log_sync_generic_target'),
    'Trigger must be named trg_social_audit_log_sync_generic_target'
  );
  assert.ok(
    content.includes('BEFORE INSERT OR UPDATE') &&
    content.includes('ON social_audit_log'),
    'Trigger must be BEFORE INSERT OR UPDATE ON social_audit_log'
  );
  assert.ok(
    content.includes('FOR EACH ROW'),
    'Trigger must be FOR EACH ROW'
  );
  assert.ok(
    content.includes('EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()'),
    'Trigger must execute the audit function'
  );
});

// ─── 14. Legacy-only writes populate the canonical memory pair ─────────────────

test('Trigger auto-populates memory pair when both generic fields absent for social_idempotency', () => {
  const content = readFile(MIGRATION_PATH);
  const func = content.slice(
    content.indexOf('sync_social_idempotency_generic_target_from_legacy_memory'),
    content.indexOf('sync_social_audit_generic_target_from_legacy_memory')
  );
  assert.ok(
    func.includes("NEW.target_kind := 'memory'"),
    'Must set target_kind to memory'
  );
  assert.ok(
    func.includes('NEW.target_id := NEW.target_memory_id'),
    'Must set target_id from target_memory_id'
  );
  assert.ok(
    func.includes('RETURN NEW'),
    'Must return NEW after auto-populate'
  );
});

test('Trigger auto-populates memory pair when both generic fields absent for social_audit_log', () => {
  const content = readFile(MIGRATION_PATH);
  const funcStart = content.indexOf('sync_social_audit_generic_target_from_legacy_memory');
  const funcEnd = content.indexOf('$$;', content.indexOf('NEW.memory_id'));
  const func = content.slice(funcStart, funcEnd);
  assert.ok(
    func.includes("NEW.target_kind := 'memory'"),
    'Must set target_kind to memory'
  );
  assert.ok(
    func.includes('NEW.target_id := NEW.memory_id'),
    'Must set target_id from memory_id'
  );
  assert.ok(
    func.includes('RETURN NEW'),
    'Must return NEW after auto-populate'
  );
});

// ─── 15. Partial generic pairs, tree targets, and generic/legacy mismatches rejected ─

test('Trigger raises exception for partial generic pairs in both functions', () => {
  const content = readFile(MIGRATION_PATH);
  const partialMatches = content.match(/Partial generic target pair/g) || [];
  assert.ok(
    partialMatches.length >= 2,
    'Both trigger functions must reject partial generic pairs (found ' + partialMatches.length + ')'
  );
});

test('Trigger raises exception when target_kind is not memory in both functions', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes("target_kind != 'memory'"),
    'Both functions must check target_kind equals memory'
  );
  assert.ok(
    content.includes('Tree writers remain blocked'),
    'Both functions must mention tree writers blocked in error message'
  );
});

test('Trigger raises exception when target_id mismatches legacy field in both functions', () => {
  const content = readFile(MIGRATION_PATH);
  assert.ok(
    content.includes('IS DISTINCT FROM NEW.target_memory_id'),
    'Idempotency function must compare target_id with target_memory_id'
  );
  assert.ok(
    content.includes('IS DISTINCT FROM NEW.memory_id'),
    'Audit function must compare target_id with memory_id'
  );
});

// ─── 16. Trigger creation is guarded and does not use DROP TRIGGER ────────────

test('Trigger creation uses pg_trigger existence check, not DROP TRIGGER', () => {
  const content = stripSqlComments(readFile(MIGRATION_PATH));
  assert.equal(
    content.includes('DROP TRIGGER'),
    false,
    'Trigger creation must not use DROP TRIGGER'
  );
  const raw = readFile(MIGRATION_PATH);
  assert.ok(
    raw.includes('IF NOT EXISTS') && raw.includes('pg_trigger'),
    'Trigger creation must check pg_trigger with IF NOT EXISTS pattern'
  );
  assert.ok(
    raw.includes("tgname = 'trg_social_idempotency_sync_generic_target'"),
    'Idempotency trigger guard must check exact trigger name'
  );
  assert.ok(
    raw.includes("tgname = 'trg_social_audit_log_sync_generic_target'"),
    'Audit trigger guard must check exact trigger name'
  );
});

// ─── 17. Runbook states no DB execution and requires separate CTO approval ────

test('Runbook states no DB execution occurs in this PR and requires separate CTO approval', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('does not apply the migration') ||
    content.includes('Do not execute') ||
    /This PR.*only prepares.*not apply/.test(content),
    'Runbook must state this task does not apply the migration'
  );
  assert.ok(
    content.includes('separate CTO approval'),
    'Runbook must explicitly require separate CTO approval'
  );
});

// ─── 18. Runbook blocks Modal/Cloudflare deploy, tree runtime, and tree-like activation ─

test('Runbook explicitly blocks Modal/Cloudflare deployment and tree runtime', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('No Modal or Cloudflare deployment'),
    'Runbook must block Modal/Cloudflare deployment in Migration A'
  );
  assert.ok(
    content.includes('Tree runtime hardening') &&
    content.includes('blocked'),
    'Runbook must state tree runtime hardening is blocked'
  );
  assert.ok(
    content.includes('tree idempotency') &&
    content.includes('blocked'),
    'Runbook must state tree idempotency handlers are blocked'
  );
});

// ─── 19. Runbook defines Verification Gate A evidence and aggregate-only safe queries ─

test('Runbook names Verification Gate A and includes aggregate-only safe verification queries', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Verification Gate A'),
    'Runbook must name Verification Gate A'
  );
  assert.ok(
    content.includes('null_pair') &&
    content.includes('partial_pair'),
    'Runbook must include null/partial pair count query'
  );
  assert.ok(
    content.includes('target_kind') &&
    content.includes('GROUP BY'),
    'Runbook must include kind distribution query'
  );
  assert.ok(
    content.includes('mismatch_count'),
    'Runbook must include mismatch count query'
  );
  assert.ok(
    content.includes('trigger_name') &&
    content.includes('table_name'),
    'Runbook must include trigger presence query'
  );
});

// ─── 20. Runbook defines runtime-first rollback boundary and separate schema approval ─

test('Runbook defines runtime-first rollback and separate schema rollback approval', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('roll that runtime back first'),
    'Runbook must state runtime rollback first'
  );
  assert.ok(
    content.includes('separate approval') &&
    (content.includes('schema rollback') || content.includes('Rollback')),
    'Runbook must require separate approval for schema rollback'
  );
  assert.ok(
    content.includes('No automatic rollback'),
    'Runbook must state there is no automatic rollback'
  );
});

// ─── 21. No UI, Browse/My Trees, #3075, Editor, Scout, Hermes, outsider-project ─

test('Runbook non-goals section excludes UI, Browse, My Trees, #3075, Editor, Scout, Hermes scope', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('non-goals') || content.includes('Non-goals'),
    'Runbook must have a non-goals section'
  );
  assert.ok(
    content.includes('Browse') && content.includes('My Trees'),
    'Runbook must exclude Browse and My Trees scope'
  );
  assert.ok(
    content.includes('#3075'),
    'Runbook must reference #3075 in non-goals'
  );
  assert.ok(
    content.includes('Editor') &&
    content.includes('Scout') &&
    content.includes('Hermes'),
    'Runbook must exclude Editor, Scout, and Hermes scope'
  );
});

// ─── Additional: runbook trigger behavior documentation ───────────────────────

test('Runbook documents trigger behavior with table of trigger functions and compatibility guarantee', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('BEFORE INSERT OR UPDATE'),
    'Runbook must document trigger timing'
  );
  assert.ok(
    content.includes('sync_social_idempotency_generic_target_from_legacy_memory()'),
    'Runbook must document idempotency trigger function name'
  );
  assert.ok(
    content.includes('sync_social_audit_generic_target_from_legacy_memory()'),
    'Runbook must document audit trigger function name'
  );
  assert.ok(
    content.includes('no runtime code change'),
    'Runbook must state no runtime code change needed'
  );
});

test('Runbook states legacy fields stay readable and NOT NULL unchanged', () => {
  const content = readFile(RUNBOOK_PATH);
  assert.ok(
    content.includes('Legacy fields stay readable'),
    'Runbook must state legacy fields stay readable'
  );
  assert.ok(
    content.includes('NOT NULL'),
    'Runbook must reference NOT NULL'
  );
});
