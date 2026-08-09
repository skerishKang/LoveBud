/**
 * Contract tests for moment social write hardening (Issue #3177).
 *
 * These tests verify that the #3177 changes maintain backward compatibility
 * while adding idempotency, rate limit, audit, lifecycle, and authorization
 * hardening to reaction and comment write operations.
 *
 * Refs: #3177, #3175, #3075, #1237, #2544, #2862, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

function hasRegex(content, regex) {
  return regex.test(content);
}

// ─── FILE PATHS ────────────────────────────────────────────────────────────────

const APP_PY = path.join(ROOT, 'modal_compute', 'app.py');
const REACTIONS_PY = path.join(ROOT, 'modal_compute', 'reactions.py');
const COMMENTS_PY = path.join(ROOT, 'modal_compute', 'comments.py');
const WRITE_VALIDATION_PY = path.join(ROOT, 'modal_compute', 'write_validation.py');
const SOCIAL_IDEMPOTENCY_PY = path.join(ROOT, 'modal_compute', 'social_idempotency.py');
const SOCIAL_RATE_LIMIT_PY = path.join(ROOT, 'modal_compute', 'social_rate_limit.py');
const SOCIAL_WRITE_AUDIT_PY = path.join(ROOT, 'modal_compute', 'social_write_audit.py');
const SOCIAL_ERRORS_PY = path.join(ROOT, 'modal_compute', 'social_errors.py');
const CF_REACTIONS_PROXY = path.join(ROOT, 'functions/api/memories/[id]/reactions.js');
const CF_COMMENTS_PROXY = path.join(ROOT, 'functions/api/memories/[id]/comments.js');
const POSTGRES_CLIENT_JS = path.join(ROOT, 'js', 'postgres-client.js');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────────

test('Harden: social_idempotency.py exists', () => {
  assert.ok(fs.existsSync(SOCIAL_IDEMPOTENCY_PY), 'modal_compute/social_idempotency.py should exist');
});

test('Harden: social_rate_limit.py exists', () => {
  assert.ok(fs.existsSync(SOCIAL_RATE_LIMIT_PY), 'modal_compute/social_rate_limit.py should exist');
});

test('Harden: social_write_audit.py exists', () => {
  assert.ok(fs.existsSync(SOCIAL_WRITE_AUDIT_PY), 'modal_compute/social_write_audit.py should exist');
});

test('Harden: social_errors.py exists', () => {
  assert.ok(fs.existsSync(SOCIAL_ERRORS_PY), 'modal_compute/social_errors.py should exist');
});

// ─── AUTH CONTRACTS ────────────────────────────────────────────────────────────

test('Harden: private reaction POST route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);
  const match = content.indexOf('async def post_memory_reaction(');
  assert.notEqual(match, -1, 'post_memory_reaction handler must exist');
  const block = content.slice(match, match + 600);
  assert.ok(
    hasString(block, 'require_firebase_user(authorization)'),
    'reaction POST must still require firebase auth'
  );
});

test('Harden: private comment POST route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);
  const match = content.indexOf('async def post_memory_comment(');
  assert.notEqual(match, -1, 'post_memory_comment handler must exist');
  const block = content.slice(match, match + 600);
  assert.ok(
    hasString(block, 'require_firebase_user(authorization)'),
    'comment POST must still require firebase auth'
  );
});

// ─── TREE VISIBILITY BYPASS FIX ───────────────────────────────────────────────

test('Harden: fetch_memory_for_owner_check includes tree_visibility', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);
  assert.ok(
    hasString(content, 't.visibility AS tree_visibility'),
    'write_validation query should include tree_visibility'
  );
});

test('Harden: require_memory_visible_or_owner checks tree_visibility for non-owners', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);
  assert.ok(
    hasRegex(content, /is_explicit_public\([\s\S]*?"tree_visibility"\)/),
    'guard should check tree_visibility for non-owner access'
  );
  assert.ok(
    hasRegex(content, /is_explicit_public\([\s\S]*?"visibility"\)/),
    'guard should still check memory visibility'
  );
});

test('Harden: tree owner bypasses visibility checks', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);
  assert.ok(
    hasRegex(content, /if\s+is_owner[\s\S]*?return\s+memory/),
    'guard should return early for tree owner'
  );
});

// ─── IDEMPOTENCY KEY MANDATORY ─────────────────────────────────────────────────

test('Harden: toggle_reaction requires idempotency_key', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REQUIRED'),
    'toggle_reaction should raise IDEMPOTENCY_KEY_REQUIRED when key is missing'
  );
});

test('Harden: create_comment requires idempotency_key', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REQUIRED'),
    'create_comment should raise IDEMPOTENCY_KEY_REQUIRED when key is missing'
  );
});

test('Harden: social_idempotency validates key format with KEY_PATTERN', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  assert.ok(
    hasString(content, 'KEY_PATTERN'),
    'social_idempotency should define KEY_PATTERN'
  );
  assert.ok(
    hasString(content, 'A-Za-z0-9'),
    'KEY_PATTERN should allow alphanumeric characters'
  );
  assert.ok(
    hasString(content, '{8,128}'),
    'KEY_PATTERN should enforce 8-128 length'
  );
});

test('Harden: validate_idempotency_key_format raises IDEMPOTENCY_KEY_INVALID for bad keys', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_INVALID'),
    'validate_idempotency_key_format should raise IDEMPOTENCY_KEY_INVALID'
  );
});

// ─── TRANSACTION-BOUND IDEMPOTENCY ─────────────────────────────────────────────

test('Harden: reserve_and_verify_idempotency accepts cursor parameter', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  const fnStart = content.indexOf('def reserve_and_verify_idempotency(');
  assert.notEqual(fnStart, -1, 'reserve_and_verify_idempotency must exist');
  const fnBlock = content.slice(fnStart, fnStart + 300);
  assert.ok(
    hasString(fnBlock, 'cur'),
    'reserve_and_verify_idempotency should accept cursor parameter'
  );
});

test('Harden: complete_idempotency accepts cursor parameter', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  const fnStart = content.indexOf('def complete_idempotency(');
  assert.notEqual(fnStart, -1, 'complete_idempotency must exist');
  const fnBlock = content.slice(fnStart, fnStart + 300);
  assert.ok(
    hasString(fnBlock, 'cur'),
    'complete_idempotency should accept cursor parameter'
  );
});

test('Harden: toggle_reaction uses one transaction for idempotency + mutation', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnStart = content.indexOf('def toggle_reaction(');
  const fnEnd = content.indexOf('def fetch_reaction_summary(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, 'conn.commit()'),
    'toggle_reaction should commit transaction'
  );
  assert.ok(
    hasString(fnBody, 'conn.rollback()'),
    'toggle_reaction should rollback on failure'
  );
});

test('Harden: create_comment uses one transaction for idempotency + rate-limit + insert', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def create_comment(');
  const fnEnd = content.indexOf('def fetch_comments(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, 'conn.commit()'),
    'create_comment should commit transaction'
  );
  assert.ok(
    hasString(fnBody, 'conn.rollback()'),
    'create_comment should rollback on failure'
  );
});

// ─── REACTION CONTRACTS ────────────────────────────────────────────────────────

test('Harden: toggle_reaction uses advisory lock for concurrent safety', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'pg_advisory_xact_lock'),
    'toggle_reaction should use advisory lock for serialization'
  );
});

test('Harden: toggle_reaction uses INSERT ON CONFLICT for atomic toggle-on', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'INSERT INTO reactions'),
    'toggle_reaction should insert new reaction'
  );
});

test('Harden: toggle_reaction uses DELETE by composite key for idempotent toggle-off', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'DELETE FROM reactions WHERE memory_id = %s AND owner_id = %s AND type = %s'),
    'toggle_reaction should DELETE by (memory_id, owner_id, type) for idempotent toggle-off'
  );
});

test('Harden: toggle_reaction validates reaction type against ALLOWED_REACTION_TYPES', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'ALLOWED_REACTION_TYPES'),
    'reactions.py should define ALLOWED_REACTION_TYPES'
  );
  assert.ok(
    hasString(content, 'not in ALLOWED_REACTION_TYPES'),
    'toggle_reaction should validate against allowlist'
  );
  assert.ok(
    hasString(content, '"like"'),
    'ALLOWED_REACTION_TYPES should contain "like"'
  );
  const allowDef = content.match(/ALLOWED_REACTION_TYPES\s*=\s*frozenset\([^)]+\)/);
  assert.ok(allowDef, 'ALLOWED_REACTION_TYPES frozenset definition must exist');
  assert.ok(
    allowDef[0].includes('"like"'),
    'ALLOWED_REACTION_TYPES must include "like"'
  );
});

test('Harden: toggle_reaction returns minimal safe response', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, '_make_reaction_dto'),
    'toggle_reaction should use _make_reaction_dto for response'
  );
  assert.equal(
    hasString(content, 'def normalize_reaction_row('),
    false,
    'normalize_reaction_row should be removed - response goes through _make_reaction_dto'
  );
  const dtoDef = content.match(/def _make_reaction_dto\([^)]*\)[\s\S]{0,500}/);
  assert.ok(dtoDef, '_make_reaction_dto must be defined');
  assert.ok(
    hasString(dtoDef[0], '"id"') === false,
    'DTO must not include id'
  );
  assert.ok(
    hasString(dtoDef[0], '"ownerId"') === false,
    'DTO must not include ownerId'
  );
  assert.ok(
    hasString(dtoDef[0], '"memoryId"') === false,
    'DTO must not include memoryId'
  );
  assert.ok(
    hasString(dtoDef[0], '"createdAt"') === false,
    'DTO must not include createdAt'
  );
});

test('Harden: toggle_reaction records audit', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'record_audit('),
    'toggle_reaction should record audit entry'
  );
});

test('Harden: toggle_reaction calls reserve_and_verify_idempotency', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'reserve_and_verify_idempotency'),
    'toggle_reaction should call reserve_and_verify_idempotency'
  );
});

// ─── COMMENT CONTRACTS ─────────────────────────────────────────────────────────

test('Harden: create_comment requires idempotency_key param', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def create_comment(');
  assert.notEqual(fnStart, -1, 'create_comment must exist');
  const fnBlock = content.slice(fnStart, fnStart + 500);
  assert.ok(
    hasString(fnBlock, 'idempotency_key'),
    'create_comment should accept idempotency_key parameter'
  );
});

test('Harden: create_comment verifies idempotency key via reserve_and_verify', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'reserve_and_verify_idempotency'),
    'create_comment should call reserve_and_verify_idempotency'
  );
});

test('Harden: create_comment checks rate limits via check_comment_rate_limits', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def create_comment(');
  const fnEnd = content.indexOf('def fetch_comments(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, 'check_comment_rate_limits'),
    'create_comment should check rate limits'
  );
});

test('Harden: create_comment inserts status = visible', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, "'visible'"),
    'create_comment should set status to visible'
  );
});

test('Harden: create_comment records audit', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'record_audit('),
    'create_comment should record audit entry'
  );
});

test('Harden: create_comment replay detects hidden/deleted comment returns 410', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'IDEMPOTENCY_RESULT_UNAVAILABLE'),
    'create_comment should raise IDEMPOTENCY_RESULT_UNAVAILABLE for unavailable comment'
  );
});

test('Harden: fetch_comments filters by status = visible and deleted_at IS NULL', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def fetch_comments(');
  const fnBody = content.slice(fnStart);
  assert.ok(
    hasString(fnBody, "status = 'visible'"),
    'fetch_comments should filter by visible status'
  );
  assert.ok(
    hasString(fnBody, 'deleted_at IS NULL'),
    'fetch_comments should filter out deleted comments'
  );
});

// ─── RATE LIMIT CONTRACTS ─────────────────────────────────────────────────────

test('Harden: social_rate_limit.py defines COMMENT_ACTOR_LIMIT constant', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  assert.ok(
    hasString(content, 'COMMENT_ACTOR_LIMIT'),
    'rate limit module should define COMMENT_ACTOR_LIMIT'
  );
});

test('Harden: social_rate_limit.py defines COMMENT_ACTOR_MEMORY_LIMIT constant', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  assert.ok(
    hasString(content, 'COMMENT_ACTOR_MEMORY_LIMIT'),
    'rate limit module should define COMMENT_ACTOR_MEMORY_LIMIT'
  );
});

test('Harden: check_comment_rate_limits accepts cursor parameter', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  const fnStart = content.indexOf('def check_comment_rate_limits(');
  assert.notEqual(fnStart, -1, 'check_comment_rate_limits must exist');
  const fnBlock = content.slice(fnStart, fnStart + 300);
  assert.ok(
    hasString(fnBlock, 'cur'),
    'check_comment_rate_limits should accept cursor parameter'
  );
});

test('Harden: check_and_increment_rate_limit accepts cursor and uses ON CONFLICT', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  assert.ok(
    hasString(content, 'ON CONFLICT'),
    'rate limit should use ON CONFLICT for atomic increment'
  );
});

// ─── IDEMPOTENCY CONTRACTS ────────────────────────────────────────────────────

test('Harden: reserve_and_verify_idempotency returns replay=True for prior key', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  assert.ok(
    hasString(content, '"replay"'),
    'reserve_and_verify_idempotency response should include replay key'
  );
});

test('Harden: reserve_and_verify_idempotency raises 409 on key reuse mismatch', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  assert.ok(
    hasString(content, 'status_code=409'),
    'reserve_and_verify_idempotency should return 409 for key mismatch'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REUSED'),
    'reserve_and_verify_idempotency should use IDEMPOTENCY_KEY_REUSED code'
  );
});

// ─── AUDIT CONTRACTS ──────────────────────────────────────────────────────────

test('Harden: record_audit accepts cursor parameter', () => {
  const content = readFileContent(SOCIAL_WRITE_AUDIT_PY);
  const fnStart = content.indexOf('def record_audit(');
  assert.notEqual(fnStart, -1, 'record_audit must exist');
  const fnBlock = content.slice(fnStart, fnStart + 300);
  assert.ok(
    hasString(fnBlock, 'cur'),
    'record_audit should accept cursor parameter'
  );
});

test('Harden: record_audit avoids storing sensitive fields', () => {
  const content = readFileContent(SOCIAL_WRITE_AUDIT_PY);
  assert.ok(
    hasString(content, 'NEVER stored'),
    'audit module should document forbidden fields'
  );
  assert.ok(
    hasString(content, 'Comment body'),
    'audit module must not store comment body'
  );
  assert.ok(
    hasString(content, 'Firebase token'),
    'audit module must not store Firebase token'
  );
  assert.equal(
    hasString(content, 'Authorization header'),
    true,
    'audit module must not store Authorization header'
  );
});

// ─── SOCIAL ERROR DTO CONTRACTS ────────────────────────────────────────────────

test('Harden: social_errors.py defines SocialWriteError class', () => {
  const content = readFileContent(SOCIAL_ERRORS_PY);
  assert.ok(
    hasString(content, 'class SocialWriteError'),
    'social_errors.py should define SocialWriteError'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REQUIRED'),
    'social_errors.py should define IDEMPOTENCY_KEY_REQUIRED code'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_INVALID'),
    'social_errors.py should define IDEMPOTENCY_KEY_INVALID code'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REUSED'),
    'social_errors.py should define IDEMPOTENCY_KEY_REUSED code'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_RESULT_UNAVAILABLE'),
    'social_errors.py should define IDEMPOTENCY_RESULT_UNAVAILABLE code'
  );
  assert.ok(
    hasString(content, 'REACTION_TYPE_INVALID'),
    'social_errors.py should define REACTION_TYPE_INVALID code'
  );
  assert.ok(
    hasString(content, 'RATE_LIMITED'),
    'social_errors.py should define RATE_LIMITED code'
  );
  assert.ok(
    hasString(content, 'RATE_LIMITED_MEMORY'),
    'social_errors.py should define RATE_LIMITED_MEMORY code'
  );
  assert.ok(
    hasString(content, 'RATE_LIMIT_UNAVAILABLE'),
    'social_errors.py should define RATE_LIMIT_UNAVAILABLE code'
  );
  assert.ok(
    hasString(content, 'SOCIAL_WRITE_UNAVAILABLE'),
    'social_errors.py should define SOCIAL_WRITE_UNAVAILABLE code'
  );
});

test('Harden: app.py registers SocialWriteError exception handler', () => {
  const content = readFileContent(APP_PY);
  assert.ok(
    hasString(content, 'exception_handler(SocialWriteError)'),
    'app.py should register SocialWriteError exception handler'
  );
  assert.ok(
    hasString(content, 'social_write_error_handler'),
    'app.py should define social_write_error_handler'
  );
});

test('Harden: SocialWriteError handler returns stable top-level shape', () => {
  const content = readFileContent(APP_PY);
  const handlerStart = content.indexOf('async def social_write_error_handler');
  const block = content.slice(handlerStart, handlerStart + 600);
  assert.ok(
    hasString(block, '"error"'),
    'error handler should include error field'
  );
  assert.ok(
    hasString(block, '"code"'),
    'error handler should include code field'
  );
});

// ─── LIFECYCLE AUTHORITY CONTRACTS ─────────────────────────────────────────────

test('Harden: comments.py defines soft_delete_own_comment', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'def soft_delete_own_comment('),
    'comments.py should define soft_delete_own_comment'
  );
});

test('Harden: comments.py defines hide_comment_by_tree_owner', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'def hide_comment_by_tree_owner('),
    'comments.py should define hide_comment_by_tree_owner'
  );
});

test('Harden: soft_delete_own_comment enforces author-only policy', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def soft_delete_own_comment(');
  const fnEnd = content.indexOf('def hide_comment_by_tree_owner(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, "owner_id") && (hasString(fnBody, "403") || hasString(fnBody, "Forbidden")),
    'soft_delete_own_comment should enforce author-only check'
  );
});

// ─── CF PROXY CONTRACTS ───────────────────────────────────────────────────────

test('Harden: CF reactions proxy validates Idempotency-Key on POST', () => {
  const content = readFileContent(CF_REACTIONS_PROXY);
  assert.ok(
    hasString(content, "headers.get('Idempotency-Key')"),
    'reactions proxy should read Idempotency-Key header'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REQUIRED'),
    'reactions proxy should reject missing key'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_INVALID'),
    'reactions proxy should reject invalid key'
  );
  assert.ok(
    hasString(content, 'KEY_PATTERN'),
    'reactions proxy should validate key format'
  );
});

test('Harden: CF comments proxy validates Idempotency-Key on POST', () => {
  const content = readFileContent(CF_COMMENTS_PROXY);
  assert.ok(
    hasString(content, "headers.get('Idempotency-Key')"),
    'comments proxy should read Idempotency-Key header'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_REQUIRED'),
    'comments proxy should reject missing key'
  );
  assert.ok(
    hasString(content, 'IDEMPOTENCY_KEY_INVALID'),
    'comments proxy should reject invalid key'
  );
  assert.ok(
    hasString(content, 'KEY_PATTERN'),
    'comments proxy should validate key format'
  );
});

test('Harden: CF reactions proxy forwards Idempotency-Key header on POST', () => {
  const content = readFileContent(CF_REACTIONS_PROXY);
  assert.ok(
    hasString(content, "'Idempotency-Key'"),
    'reactions proxy should forward Idempotency-Key header'
  );
});

test('Harden: CF comments proxy forwards Idempotency-Key header on POST', () => {
  const content = readFileContent(CF_COMMENTS_PROXY);
  assert.ok(
    hasString(content, "'Idempotency-Key'"),
    'comments proxy should forward Idempotency-Key header'
  );
});

// ─── BROWSER CLIENT CONTRACTS ─────────────────────────────────────────────────

test('Harden: toggleReaction accepts optional idempotencyKey parameter', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'idempotencyKey'),
    'toggleReaction should accept idempotencyKey parameter'
  );
});

test('Harden: createComment accepts optional idempotencyKey parameter', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'createComment'),
    'createComment should exist'
  );
  assert.ok(
    hasRegex(content, /createComment[^}]*idempotencyKey/),
    'createComment should accept idempotencyKey parameter'
  );
});

test('Harden: generateIdempotencyKey is defined in postgres-client.js', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'generateIdempotencyKey'),
    'generateIdempotencyKey helper should exist'
  );
});

test('Harden: addIdempotencyKey helper is defined', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'addIdempotencyKey'),
    'addIdempotencyKey helper should exist'
  );
});

// ─── UUID INSERT CONTRACTS ────────────────────────────────────────────────────
// social_rate_limits and social_audit_log must supply application-generated id

test('Harden: check_and_increment_rate_limit includes id in INSERT columns', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  const insertMatch = content.match(/INSERT INTO social_rate_limits\s*\(([^)]+)\)/);
  assert.ok(insertMatch, 'rate_limit INSERT statement must exist');
  const columns = insertMatch[1].replace(/\s+/g, ' ').trim();
  const hasId = columns.split(',').map(c => c.trim()).some(c => c === 'id');
  assert.ok(hasId, 'rate_limit INSERT must include id column');
});

test('Harden: check_and_increment_rate_limit generates uuid for id', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  assert.ok(
    hasString(content, 'uuid.uuid4()'),
    'check_and_increment_rate_limit should generate uuid for id'
  );
  assert.ok(
    hasString(content, 'row_id'),
    'rate_limit should assign uuid to a variable for INSERT'
  );
});

test('Harden: record_audit includes id in INSERT columns', () => {
  const content = readFileContent(SOCIAL_WRITE_AUDIT_PY);
  const insertMatch = content.match(/INSERT INTO social_audit_log\s*\(([^)]+)\)/);
  assert.ok(insertMatch, 'audit INSERT statement must exist');
  const columns = insertMatch[1].replace(/\s+/g, ' ').trim();
  const hasId = columns.split(',').map(c => c.trim()).some(c => c === 'id');
  assert.ok(hasId, 'audit INSERT must include id column');
});

test('Harden: record_audit generates uuid for id', () => {
  const content = readFileContent(SOCIAL_WRITE_AUDIT_PY);
  assert.ok(
    hasString(content, 'uuid.uuid4()'),
    'record_audit should generate uuid for id'
  );
  assert.ok(
    hasString(content, 'audit_id'),
    'audit should assign uuid to a variable for INSERT'
  );
});

// ─── RESULT PAYLOAD CONTRACTS ─────────────────────────────────────────────────

test('Harden: complete_idempotency accepts optional result_payload parameter', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  const fnDef = content.match(/def complete_idempotency\([^)]+\)/s);
  assert.ok(fnDef, 'complete_idempotency definition must exist');
  assert.ok(
    hasString(content, 'result_payload'),
    'complete_idempotency should accept result_payload param'
  );
});

test('Harden: complete_idempotency stores result_payload as JSON when provided', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  const fnBody = content.slice(content.indexOf('def complete_idempotency('));
  assert.ok(
    hasString(fnBody, 'result_payload'),
    'complete_idempotency body should reference result_payload'
  );
  assert.ok(
    hasString(fnBody, 'json.dumps(result_payload)'),
    'complete_idempotency should serialize result_payload with json.dumps'
  );
});

test('Harden: reserve_and_verify_idempotency returns resultPayload on replay', () => {
  const content = readFileContent(SOCIAL_IDEMPOTENCY_PY);
  const fnBody = content.slice(content.indexOf('def reserve_and_verify_idempotency('));
  assert.ok(
    hasString(fnBody, 'resultPayload'),
    'replay response should include resultPayload'
  );
  assert.ok(
    hasString(fnBody, 'stored_result_payload'),
    'replay should read stored result_payload'
  );
});

test('Harden: toggle_reaction stores result_payload in complete_idempotency on toggle-on', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnBody = content.slice(content.indexOf('def toggle_reaction('));
  // toggle-on path: INSERT path should pass result_payload
  assert.ok(
    hasString(fnBody, 'result_payload=result_payload'),
    'toggle_reaction should pass result_payload to complete_idempotency'
  );
});

test('Harden: replay returns stored result_payload without querying reaction row', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnBody = content.slice(content.indexOf('def toggle_reaction('));
  // replay path should use resultPayload from idempotency, not re-query reactions
  const replayBranchMatch = fnBody.match(/if replay is not None[^}]*replay.*replay/s);
  assert.ok(
    hasString(fnBody, 'stored_payload'),
    'replay should extract stored_payload from replay dict'
  );
});

// ─── REACTION RESPONSE MINIMIZATION ───────────────────────────────────────────

test('Harden: toggle_reaction toggle-on response uses _make_reaction_dto', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, '_make_reaction_dto'),
    'toggle_reaction should use _make_reaction_dto for response'
  );
});

test('Harden: toggle_reaction toggle-off response uses _make_reaction_dto', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, '_make_reaction_dto'),
    'toggle_reaction should use _make_reaction_dto for response'
  );
});

test('Harden: _make_reaction_dto returns minimal safe DTO', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnDef = content.match(/def _make_reaction_dto\([^)]*\)[\s\S]{0,500}/);
  assert.ok(fnDef, '_make_reaction_dto definition must exist');
  const dtoBody = fnDef[0];
  assert.ok(hasString(dtoBody, '"type"'), 'DTO must include type');
  assert.ok(hasString(dtoBody, '"active"'), 'DTO must include active');
  assert.ok(hasString(dtoBody, '"counts"'), 'DTO must include counts');
  assert.ok(hasString(dtoBody, '"total"'), 'DTO must include total');
  assert.equal(hasString(dtoBody, '"id"'), false, 'DTO must NOT include id');
  assert.equal(hasString(dtoBody, '"ownerId"'), false, 'DTO must NOT include ownerId');
  assert.equal(hasString(dtoBody, '"memoryId"'), false, 'DTO must NOT include memoryId');
  assert.equal(hasString(dtoBody, '"createdAt"'), false, 'DTO must NOT include createdAt');
});

// ─── TRANSACTION-LOCAL AUTHORIZATION ──────────────────────────────────────────

test('Harden: toggle_reaction uses cursor-based authorization inside transaction', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnEnd = content.indexOf('def fetch_reaction_summary(');
  const fnBody = content.slice(content.indexOf('def toggle_reaction('), fnEnd);
  assert.ok(
    hasString(fnBody, 'require_memory_visible_or_owner_cursor(cur,'),
    'toggle_reaction should use cursor-based authorization inside transaction'
  );
  assert.equal(
    hasString(fnBody, 'require_memory_visible_or_owner('),
    false,
    'toggle_reaction should NOT use connection-based authorization'
  );
});

test('Harden: create_comment uses cursor-based authorization inside transaction', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnEnd = content.indexOf('def fetch_public_comments(');
  const fnBody = content.slice(content.indexOf('def create_comment('), fnEnd);
  assert.ok(
    hasString(fnBody, 'require_memory_visible_or_owner_cursor(cur,'),
    'create_comment should use cursor-based authorization inside transaction'
  );
  assert.equal(
    hasString(fnBody, 'require_memory_visible_or_owner('),
    false,
    'create_comment should NOT use connection-based authorization'
  );
});

test('Harden: write_validation defines require_memory_visible_or_owner_cursor', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);
  assert.ok(
    hasString(content, 'def require_memory_visible_or_owner_cursor('),
    'write_validation should define cursor-based auth function'
  );
  assert.ok(
    hasString(content, 'cur'),
    'cursor-based auth should accept cursor parameter'
  );
});

// ─── RATE LIMIT UNAVAILABLE ───────────────────────────────────────────────────

test('Harden: check_comment_rate_limits catches exceptions and raises RATE_LIMIT_UNAVAILABLE', () => {
  const content = readFileContent(SOCIAL_RATE_LIMIT_PY);
  assert.ok(
    hasString(content, 'RATE_LIMIT_UNAVAILABLE'),
    'rate limit module should define RATE_LIMIT_UNAVAILABLE error code'
  );
  assert.ok(
    hasString(content, '503'),
    'RATE_LIMIT_UNAVAILABLE should use 503 status'
  );
  assert.ok(
    hasString(content, 'except Exception'),
    'check_comment_rate_limits should wrap rate-limit calls in try/except'
  );
});

test('Harden: rate-limit failure rolls back transaction (caller rolls back on SocialWriteError)', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnBody = content.slice(content.indexOf('def create_comment('));
  assert.ok(
    hasString(fnBody, 'conn.rollback()'),
    'create_comment rolls back on any exception including rate-limit failure'
  );
});

// ─── LIFECYCLE AUDIT ──────────────────────────────────────────────────────────

test('Harden: soft_delete_own_comment records audit in same transaction', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def soft_delete_own_comment(');
  const fnEnd = content.indexOf('def hide_comment_by_tree_owner(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, "record_audit("),
    'soft_delete_own_comment should record audit'
  );
  assert.ok(
    hasString(fnBody, 'comment.soft_delete'),
    'audit action should be comment.soft_delete'
  );
  assert.ok(
    hasString(fnBody, 'conn.rollback()'),
    'soft_delete_own_comment should rollback on failure'
  );
});

test('Harden: hide_comment_by_tree_owner records audit in same transaction', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def hide_comment_by_tree_owner(');
  const fnBody = content.slice(fnStart);
  assert.ok(
    hasString(fnBody, "record_audit("),
    'hide_comment_by_tree_owner should record audit'
  );
  assert.ok(
    hasString(fnBody, 'comment.hide'),
    'audit action should be comment.hide'
  );
  assert.ok(
    hasString(fnBody, 'conn.rollback()'),
    'hide_comment_by_tree_owner should rollback on failure'
  );
});

test('Harden: soft_delete_own_comment fetches memory_id for audit', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def soft_delete_own_comment(');
  const fnEnd = content.indexOf('def hide_comment_by_tree_owner(');
  const fnBody = content.slice(fnStart, fnEnd);
  assert.ok(
    hasString(fnBody, 'memory_id'),
    'soft_delete_own_comment should fetch memory_id'
  );
});

test('Harden: hide_comment_by_tree_owner fetches memory_id for audit', () => {
  const content = readFileContent(COMMENTS_PY);
  const fnStart = content.indexOf('def hide_comment_by_tree_owner(');
  const fnBody = content.slice(fnStart);
  assert.ok(
    hasString(fnBody, 'memory_id'),
    'hide_comment_by_tree_owner should fetch memory_id'
  );
});

// ─── NO TTL CLEANUP CLAIM ─────────────────────────────────────────────────────

test('Harden: runbook retention section does not claim automatic 24h cleanup', () => {
  const runbookPath = path.join(ROOT, 'docs/ops/moment-social-write-hardening-migration-runbook.md');
  const content = readFileContent(runbookPath);
  const hasCorrectStatement = hasString(content, '현재 자동 TTL cleanup은 구현되어 있지 않다');
  assert.ok(hasCorrectStatement, 'runbook should state that TTL cleanup is not implemented');
  const hasOldClaim = hasString(content, 'TTL cleanup is application-level (24h)');
  assert.equal(hasOldClaim, false, 'runbook must not claim automatic 24h cleanup');
});

// ─── SCOPE GUARDS: FORBIDDEN FILES ────────────────────────────────────────────

test('Harden: My Trees preview does not send tree IDs to moment reactions', () => {
  const myTreesFile = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');
  assert.ok(fs.existsSync(myTreesFile), 'my-trees-preview-hub.js must exist');
  const content = readFileContent(myTreesFile);
  assert.equal(
    content.includes('window.apiClient.toggleReaction(treeKey'),
    false,
    'my-trees-preview-hub.js must not send tree IDs to moment reactions (Refs #3178)'
  );
});

// ─── PRIVATE ROUTE REGRESSION PRESERVATION ─────────────────────────────────────

test('Harden: private reactions comments GET route still exists and requires auth', () => {
  const content = readFileContent(APP_PY);
  assert.ok(
    hasString(content, 'def get_memory_comments('),
    'private comments GET route must exist'
  );
  assert.ok(
    hasString(content, 'def get_memory_reactions('),
    'private reactions GET route must exist'
  );
});

test('Harden: appreciation-order and hub-layout routes still exist', () => {
  const content = readFileContent(APP_PY);
  assert.ok(
    hasString(content, 'appreciation-order'),
    'appreciation-order routes must still exist'
  );
  assert.ok(
    hasString(content, 'hub-layout'),
    'hub-layout routes must still exist'
  );
});

// ─── NO RAW DB ERROR OR FASTAPI DETAIL ENVELOPE ───────────────────────────────

test('Harden: social write errors use SocialWriteError not raw HTTPException', () => {
  const socialErrorPatterns = [
    ['toggle_reaction uses SocialWriteError', REACTIONS_PY],
    ['create_comment uses SocialWriteError', COMMENTS_PY],
    ['validate_idempotency_key_format uses SocialWriteError', SOCIAL_IDEMPOTENCY_PY],
    ['check_comment_rate_limits uses SocialWriteError', SOCIAL_RATE_LIMIT_PY],
    ['soft_delete_own_comment uses SocialWriteError', COMMENTS_PY],
    ['hide_comment_by_tree_owner uses SocialWriteError', COMMENTS_PY],
  ];
  for (const [label, filePath] of socialErrorPatterns) {
    const content = readFileContent(filePath);
    assert.ok(
      hasString(content, 'SocialWriteError('),
      `${label}: should use SocialWriteError`
    );
  }
});
