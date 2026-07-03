/**
 * Security contract tests for comments and reactions access boundaries.
 *
 * These tests verify that comments and reactions endpoints enforce
 * memory visibility and owner checks via shared guard helpers.
 *
 * Refs: #1621
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

const COMMENTS_PY = path.join(ROOT, 'modal_compute', 'comments.py');
const REACTIONS_PY = path.join(ROOT, 'modal_compute', 'reactions.py');
const APP_PY = path.join(ROOT, 'modal_compute', 'app.py');
const WRITE_VALIDATION_PY = path.join(ROOT, 'modal_compute', 'write_validation.py');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────────

test('comments.py exists', () => {
  assert.ok(fs.existsSync(COMMENTS_PY), 'modal_compute/comments.py should exist');
});

test('reactions.py exists', () => {
  assert.ok(fs.existsSync(REACTIONS_PY), 'modal_compute/reactions.py should exist');
});

test('app.py exists', () => {
  assert.ok(fs.existsSync(APP_PY), 'modal_compute/app.py should exist');
});

test('write_validation.py exists', () => {
  assert.ok(fs.existsSync(WRITE_VALIDATION_PY), 'modal_compute/write_validation.py should exist');
});

// ─── SHARED GUARD DEFINITION CONTRACTS ─────────────────────────────────────────

test('write_validation.py defines require_memory_visible_or_owner', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);

  assert.ok(
    hasString(content, 'def require_memory_visible_or_owner('),
    'require_memory_visible_or_owner should be defined in write_validation.py'
  );
});

test('require_memory_visible_or_owner checks visibility and ownership', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);

  assert.ok(
    hasString(content, 'visibility'),
    'require_memory_visible_or_owner should check memory visibility'
  );
  assert.ok(
    hasRegex(content, /tree_owner_id.*==.*requester_uid|requester_uid.*==.*tree_owner_id/),
    'require_memory_visible_or_owner should compare tree_owner_id with requester_uid'
  );
});

test('require_memory_visible_or_owner returns 404 for private non-owner access', () => {
  const content = readFileContent(WRITE_VALIDATION_PY);

  assert.ok(
    hasRegex(content, /private.*not\s*is_owner|not\s*is_owner.*private/),
    'require_memory_visible_or_owner should reject private memory for non-owners'
  );
  assert.ok(
    hasRegex(content, /status_code=404.*Memory not found|Memory not found.*status_code=404/),
    'require_memory_visible_or_owner should return 404 for private non-owner access'
  );
});

test('private appreciation-order routes are defined in app.py', () => {
  const content = readFileContent(APP_PY);
  assert.ok(
    hasString(content, '/modal/private/trees/{tree_id}/appreciation-order'),
    'appreciation-order routes should be defined'
  );
});

test('private hub-layout routes are defined in app.py', () => {
  const content = readFileContent(APP_PY);
  assert.ok(
    hasString(content, '/modal/private/trees/{tree_id}/hub-layout'),
    'hub-layout routes should be defined'
  );
});

test('private appreciation-order GET route requires firebase auth', () => {
  const content = readFileContent(APP_PY);
  const getMatch = content.indexOf('def get_appreciation_order(');
  assert.notEqual(getMatch, -1, 'get_appreciation_order should exist');
  const block = content.slice(getMatch, getMatch + 500);
  assert.ok(hasString(block, 'require_firebase_user(authorization)'), 'GET route must require auth');
});

test('private hub-layout GET route requires firebase auth', () => {
  const content = readFileContent(APP_PY);
  const getMatch = content.indexOf('def get_hub_layout(');
  assert.notEqual(getMatch, -1, 'get_hub_layout should exist');
  const block = content.slice(getMatch, getMatch + 500);
  assert.ok(hasString(block, 'require_firebase_user(authorization)'), 'GET route must require auth');
});

test('comments routes are defined in app.py', () => {
  const content = readFileContent(APP_PY);

  assert.ok(
    hasString(content, '/modal/private/memories/{memory_id}/comments'),
    'POST comments route should be defined'
  );
  assert.ok(
    hasString(content, '/modal/private/memories/{memory_id}/comments'),
    'GET comments route should be defined'
  );
});

test('reactions routes are defined in app.py', () => {
  const content = readFileContent(APP_PY);

  assert.ok(
    hasString(content, '/modal/private/memories/{memory_id}/reactions'),
    'POST reactions route should be defined'
  );
  assert.ok(
    hasString(content, '/modal/private/memories/{memory_id}/reactions'),
    'GET reactions route should be defined'
  );
});

// ─── AUTH REQUIREMENT CONTRACTS ────────────────────────────────────────────────

test('comments POST route requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const commentPostMatch = content.indexOf('async def post_memory_comment(');
  assert.notEqual(commentPostMatch, -1, 'post_memory_comment function should exist');

  const commentPostBlock = content.slice(commentPostMatch, commentPostMatch + 500);
  assert.ok(
    hasString(commentPostBlock, 'require_firebase_user(authorization)'),
    'comments POST should require firebase auth'
  );
});

test('comments GET route requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const commentGetMatch = content.indexOf('def get_memory_comments(');
  assert.notEqual(commentGetMatch, -1, 'get_memory_comments function should exist');

  const commentGetBlock = content.slice(commentGetMatch, commentGetMatch + 500);
  assert.ok(
    hasString(commentGetBlock, 'require_firebase_user(authorization)'),
    'comments GET should require firebase auth'
  );
});

test('reactions POST route requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const reactionPostMatch = content.indexOf('async def post_memory_reaction(');
  assert.notEqual(reactionPostMatch, -1, 'post_memory_reaction function should exist');

  const reactionPostBlock = content.slice(reactionPostMatch, reactionPostMatch + 500);
  assert.ok(
    hasString(reactionPostBlock, 'require_firebase_user(authorization)'),
    'reactions POST should require firebase auth'
  );
});

test('reactions GET route requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const reactionGetMatch = content.indexOf('def get_memory_reactions(');
  assert.notEqual(reactionGetMatch, -1, 'get_memory_reactions function should exist');

  const reactionGetBlock = content.slice(reactionGetMatch, reactionGetMatch + 500);
  assert.ok(
    hasString(reactionGetBlock, 'require_firebase_user(authorization)'),
    'reactions GET should require firebase auth'
  );
});

// ─── FORWARD-LOOKING GUARD CONTRACTS ───────────────────────────────────────────

test('comments.py imports require_memory_visible_or_owner', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'from modal_compute.write_validation import require_memory_visible_or_owner'),
    'comments.py should import require_memory_visible_or_owner'
  );
});

test('create_comment calls require_memory_visible_or_owner', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'require_memory_visible_or_owner(safe_memory_id, owner_id)'),
    'create_comment should call require_memory_visible_or_owner'
  );
});

test('fetch_comments calls require_memory_visible_or_owner', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'require_memory_visible_or_owner(safe_memory_id, requester_uid)'),
    'fetch_comments should call require_memory_visible_or_owner'
  );
});

test('fetch_comments accepts requester_uid parameter', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasRegex(content, /def fetch_comments\(memory_id.*requester_uid/),
    'fetch_comments should accept requester_uid parameter'
  );
});

test('reactions.py imports require_memory_visible_or_owner', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, 'from modal_compute.write_validation import require_memory_visible_or_owner'),
    'reactions.py should import require_memory_visible_or_owner'
  );
});

test('toggle_reaction calls require_memory_visible_or_owner', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, 'require_memory_visible_or_owner(safe_memory_id, owner_id)'),
    'toggle_reaction should call require_memory_visible_or_owner'
  );
});

test('fetch_reaction_summary calls require_memory_visible_or_owner', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, 'require_memory_visible_or_owner(safe_memory_id, owner_id)'),
    'fetch_reaction_summary should call require_memory_visible_or_owner'
  );
});

// ─── ROUTE-LEVEL GUARD CONSISTENCY ────────────────────────────────────────────

test('comments GET route passes requester_uid to fetch_comments', () => {
  const content = readFileContent(APP_PY);

  const commentGetMatch = content.indexOf('def get_memory_comments(');
  assert.notEqual(commentGetMatch, -1, 'get_memory_comments function should exist');

  const commentGetBlock = content.slice(commentGetMatch, commentGetMatch + 500);
  assert.ok(
    hasString(commentGetBlock, 'fetch_comments(memory_id, user["uid"])'),
    'comments GET route should pass user uid to fetch_comments'
  );
});

test('memory PUT/DELETE routes delegate to owner-checked functions', () => {
  const content = readFileContent(APP_PY);

  const memoryPutMatch = content.indexOf('async def put_private_memory(');
  assert.notEqual(memoryPutMatch, -1, 'put_private_memory function should exist');

  const memoryPutBlock = content.slice(memoryPutMatch, memoryPutMatch + 800);
  assert.ok(
    hasString(memoryPutBlock, 'update_owner_memory('),
    'memory PUT route should delegate to update_owner_memory'
  );

  const memoryDeleteMatch = content.indexOf('def delete_private_memory(');
  assert.notEqual(memoryDeleteMatch, -1, 'delete_private_memory function should exist');

  const memoryDeleteBlock = content.slice(memoryDeleteMatch, memoryDeleteMatch + 800);
  assert.ok(
    hasString(memoryDeleteBlock, 'delete_owner_memory('),
    'memory DELETE route should delegate to delete_owner_memory'
  );
});

// ─── HELPER FUNCTION CONTRACTS ─────────────────────────────────────────────────

test('comments.py defines expected helper functions', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'def normalize_comment_row('),
    'normalize_comment_row should be defined'
  );
  assert.ok(
    hasString(content, 'def create_comment('),
    'create_comment should be defined'
  );
  assert.ok(
    hasString(content, 'def fetch_comments('),
    'fetch_comments should be defined'
  );
});

test('reactions.py defines expected helper functions', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, 'def normalize_reaction_row('),
    'normalize_reaction_row should be defined'
  );
  assert.ok(
    hasString(content, 'def fetch_reaction_counts('),
    'fetch_reaction_counts should be defined'
  );
  assert.ok(
    hasString(content, 'def toggle_reaction('),
    'toggle_reaction should be defined'
  );
  assert.ok(
    hasString(content, 'def fetch_reaction_summary('),
    'fetch_reaction_summary should be defined'
  );
});

// ─── INPUT VALIDATION CONTRACTS ────────────────────────────────────────────────

test('create_comment validates memory_id as UUID', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'validate_required_uuid(memory_id'),
    'create_comment should validate memory_id'
  );
});

test('create_comment validates body length', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, 'validate_optional_string(body, 5000)'),
    'create_comment should validate body length'
  );
});

test('toggle_reaction validates memory_id as UUID', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, 'validate_required_uuid(memory_id'),
    'toggle_reaction should validate memory_id'
  );
});

test('toggle_reaction validates reaction_type length', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasRegex(content, /len\(safe_type\) > 32/),
    'toggle_reaction should validate reaction_type length'
  );
});

// ─── RESPONSE FORMAT CONTRACTS ─────────────────────────────────────────────────

test('normalize_comment_row returns expected fields', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(hasString(content, '"id"'), 'normalize_comment_row should include id');
  assert.ok(hasString(content, '"memoryId"'), 'normalize_comment_row should include memoryId');
  assert.ok(hasString(content, '"ownerId"'), 'normalize_comment_row should include ownerId');
  assert.ok(hasString(content, '"body"'), 'normalize_comment_row should include body');
  assert.ok(hasString(content, '"createdAt"'), 'normalize_comment_row should include createdAt');
  assert.ok(hasString(content, '"updatedAt"'), 'normalize_comment_row should include updatedAt');
});

test('normalize_reaction_row returns expected fields', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(hasString(content, '"id"'), 'normalize_reaction_row should include id');
  assert.ok(hasString(content, '"memoryId"'), 'normalize_reaction_row should include memoryId');
  assert.ok(hasString(content, '"ownerId"'), 'normalize_reaction_row should include ownerId');
  assert.ok(hasString(content, '"type"'), 'normalize_reaction_row should include type');
  assert.ok(hasString(content, '"createdAt"'), 'normalize_reaction_row should include createdAt');
});
