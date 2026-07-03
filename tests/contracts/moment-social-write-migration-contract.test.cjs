/**
 * Contract tests for the #3177 migration script (moment social write hardening).
 *
 * These tests verify that scripts/migration-harden-moment-social-writes.sql:
 * - is additive-only (no DROP, no ALTER ... DROP)
 * - creates expected tables and indexes
 * - modifies the comments table with lifecycle columns
 * - documents backward compatibility, rollback, and deploy order
 * - has no pgcrypto/gen_random_uuid() dependency
 * - has lifecycle CHECK constraint
 *
 * Refs: #3177, #3175, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-harden-moment-social-writes.sql');
const EXISTING_MIGRATION_PATH = path.join(ROOT, 'scripts/migration-add-reactions-comments.sql');

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────────

test('Migration: migration-harden-moment-social-writes.sql exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH), 'migration-harden-moment-social-writes.sql should exist');
});

test('Migration: existing migration-add-reactions-comments.sql is unmodified', () => {
  assert.ok(fs.existsSync(EXISTING_MIGRATION_PATH), 'existing migration must still exist');
  const content = readFileContent(EXISTING_MIGRATION_PATH);
  assert.ok(
    hasString(content, 'CREATE TABLE IF NOT EXISTS memories'),
    'existing migration must not be modified'
  );
});

// ─── ADDITIVE-ONLY CONTRACT ───────────────────────────────────────────────────

test('Migration: no DROP TABLE or DROP INDEX statements in SQL code', () => {
  const content = stripSqlComments(readFileContent(MIGRATION_PATH));
  assert.equal(
    hasString(content, 'DROP TABLE'),
    false,
    'migration SQL should not contain DROP TABLE'
  );
  assert.equal(
    hasString(content, 'DROP INDEX'),
    false,
    'migration SQL should not contain DROP INDEX'
  );
  assert.equal(
    hasString(content, 'DROP COLUMN'),
    false,
    'migration SQL should not contain DROP COLUMN'
  );
});

test('Migration: no ALTER TABLE ... DROP in SQL code', () => {
  const content = stripSqlComments(readFileContent(MIGRATION_PATH));
  assert.equal(
    hasString(content, 'ALTER TABLE') && hasString(content, 'DROP'),
    false,
    'migration SQL should not have ALTER TABLE ... DROP statements'
  );
});

// ─── TABLE CREATION ────────────────────────────────────────────────────────────

test('Migration: creates social_idempotency table with expected columns', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'CREATE TABLE IF NOT EXISTS social_idempotency'),
    'should create social_idempotency table'
  );
  assert.ok(
    hasString(content, 'actor_id'),
    'social_idempotency should have actor_id'
  );
  assert.ok(
    hasString(content, 'operation'),
    'social_idempotency should have operation'
  );
  assert.ok(
    hasString(content, 'idempotency_key'),
    'social_idempotency should have idempotency_key'
  );
  assert.ok(
    hasString(content, 'request_fingerprint'),
    'social_idempotency should have request_fingerprint'
  );
  assert.ok(
    hasString(content, 'target_memory_id'),
    'social_idempotency should have target_memory_id'
  );
});

test('Migration: creates social_rate_limits table with expected columns', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'CREATE TABLE IF NOT EXISTS social_rate_limits'),
    'should create social_rate_limits table'
  );
  assert.ok(
    hasString(content, 'scope'),
    'social_rate_limits should have scope'
  );
  assert.ok(
    hasString(content, 'request_count'),
    'social_rate_limits should have request_count'
  );
  assert.ok(
    hasString(content, 'window_start'),
    'social_rate_limits should have window_start'
  );
});

test('Migration: creates social_audit_log table with expected safe columns', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'CREATE TABLE IF NOT EXISTS social_audit_log'),
    'should create social_audit_log table'
  );
  assert.ok(
    hasString(content, 'actor_id'),
    'social_audit_log should have actor_id'
  );
  assert.ok(
    hasString(content, 'memory_id'),
    'social_audit_log should have memory_id'
  );
  assert.ok(
    hasString(content, 'action'),
    'social_audit_log should have action'
  );
  assert.ok(
    hasString(content, 'outcome_code'),
    'social_audit_log should have outcome_code'
  );
  assert.ok(
    hasString(content, 'request_key_hash'),
    'social_audit_log should have request_key_hash'
  );
});

// ─── INDEXES ───────────────────────────────────────────────────────────────────

test('Migration: social_idempotency has unique index on (actor_id, operation, idempotency_key)', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'idx_social_idempotency_actor_op_key'),
    'should create unique index on actor+op+key'
  );
  assert.ok(
    hasString(content, 'UNIQUE INDEX'),
    'index must be UNIQUE'
  );
});

test('Migration: social_rate_limits has unique index for atomic increment', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'idx_social_rate_limits_scope_actor_memory_window'),
    'should create unique combo index for rate limits'
  );
});

// ─── COMMENT LIFECYCLE ─────────────────────────────────────────────────────────

test('Migration: adds status column to comments', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, "ADD COLUMN IF NOT EXISTS status"),
    'should add status column'
  );
  assert.ok(
    hasString(content, "DEFAULT 'visible'"),
    'status should default to visible'
  );
});

test('Migration: adds deleted_at column to comments', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'ADD COLUMN IF NOT EXISTS deleted_at'),
    'should add deleted_at column'
  );
});

test('Migration: adds deleted_by column to comments', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'ADD COLUMN IF NOT EXISTS deleted_by'),
    'should add deleted_by column'
  );
});

// ─── LIFECYCLE CHECK CONSTRAINT ────────────────────────────────────────────────

test('Migration: adds status CHECK constraint with guarded DO block', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'comments_status_check'),
    'should add CHECK constraint named comments_status_check'
  );
  assert.ok(
    hasString(content, "CHECK (status IN ('visible', 'hidden', 'deleted'))"),
    'CHECK constraint should allow visible, hidden, deleted'
  );
  assert.ok(
    hasString(content, 'IF NOT EXISTS'),
    'constraint addition should be guarded with IF NOT EXISTS pattern'
  );
});

// ─── NO PGGCRYPTO DEPENDENCY ──────────────────────────────────────────────────

test('Migration: does not use gen_random_uuid() in any table definition', () => {
  const content = stripSqlComments(readFileContent(MIGRATION_PATH));
  assert.equal(
    hasString(content, 'gen_random_uuid()'),
    false,
    'migration SQL should not use gen_random_uuid() DEFAULT'
  );
});

test('Migration: UUID columns have no DEFAULT clause (app-generated)', () => {
  const content = stripSqlComments(readFileContent(MIGRATION_PATH));
  assert.equal(
    hasString(content, 'UUID PRIMARY KEY DEFAULT'),
    false,
    'UUID primary keys should have no DEFAULT clause'
  );
});

// ─── IDEMPOTENCY RESULT_STATE DEFAULT ─────────────────────────────────────────

test('Migration: social_idempotency result_state defaults to pending', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, "DEFAULT 'pending'"),
    'result_state should default to pending for reservation model'
  );
});

test('Migration: social_idempotency has result_payload JSONB column', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'result_payload'),
    'social_idempotency should have result_payload column'
  );
  assert.ok(
    hasString(content, 'JSONB'),
    'result_payload should be JSONB type'
  );
});

test('Migration: social_rate_limits id has no DEFAULT (application-generated)', () => {
  const content = readFileContent(MIGRATION_PATH);
  const createIdx = content.indexOf('CREATE TABLE IF NOT EXISTS social_rate_limits');
  const tableEnd = content.indexOf(');', createIdx);
  const ddl = content.slice(createIdx, tableEnd + 2);
  assert.ok(
    hasString(ddl, 'id              UUID PRIMARY KEY'),
    'social_rate_limits must have id UUID PRIMARY KEY'
  );
  const idColDef = ddl.split('\n').slice(0, 3).join('\n');
  assert.equal(
    idColDef.includes('DEFAULT'),
    false,
    'social_rate_limits id must have no DEFAULT clause (application-generated)'
  );
});

test('Migration: social_audit_log id has no DEFAULT (application-generated)', () => {
  const content = readFileContent(MIGRATION_PATH);
  const createIdx = content.indexOf('CREATE TABLE IF NOT EXISTS social_audit_log');
  const tableEnd = content.indexOf(');', createIdx);
  const ddl = content.slice(createIdx, tableEnd + 2);
  assert.ok(
    hasString(ddl, 'id              UUID PRIMARY KEY'),
    'social_audit_log must have id UUID PRIMARY KEY'
  );
  const idColDef = ddl.split('\n').slice(0, 3).join('\n');
  assert.equal(
    idColDef.includes('DEFAULT'),
    false,
    'social_audit_log id must have no DEFAULT clause (application-generated)'
  );
});

test('Migration: documents application-generated id strategy for all 3 tables', () => {
  const content = readFileContent(MIGRATION_PATH);
  const matches = content.match(/application-generated/g);
  assert.ok(matches && matches.length >= 3, 'migration should document app-generated IDs for all 3 new tables');
});

// ─── DOCUMENTATION CONTRACTS ───────────────────────────────────────────────────

test('Migration: documents backward compatibility', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'Backward compatibility'),
    'migration should document backward compatibility'
  );
});

test('Migration: documents rollback procedure', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'Rollback'),
    'migration should document rollback procedure'
  );
});

test('Migration: documents deploy order', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'Deploy order'),
    'migration should document deploy order'
  );
});

test('Migration: documents no pass-through behavior', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'does NOT pass through'),
    'migration should document that app code does not pass through without schema'
  );
});

test('Migration: documents UUID strategy', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, 'application-generated'),
    'migration should document application-generated UUID strategy'
  );
});

test('Migration: references #3177', () => {
  const content = readFileContent(MIGRATION_PATH);
  assert.ok(
    hasString(content, '#3177'),
    'migration should reference the issue'
  );
});
