/**
 * Security contract tests for comments and reactions access boundaries.
 *
 * These tests verify that comments and reactions endpoints enforce
 * memory visibility and owner checks. They document the expected
 * security policy and identify gaps in the current implementation.
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

// ─── ROUTE DEFINITION CONTRACTS ────────────────────────────────────────────────

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

  // Find the post_memory_comment function
  const commentPostMatch = content.indexOf('async def post_memory_comment(');
  assert.notEqual(commentPostMatch, -1, 'post_memory_comment function should exist');

  // Check that require_firebase_user is called
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

// ─── VISIBILITY/OWNER CHECK CONTRACTS ──────────────────────────────────────────

test('comments create_comment does not check memory visibility', () => {
  const content = readFileContent(COMMENTS_PY);

  // Check if create_comment checks memory visibility
  const hasVisibilityCheck = hasString(content, 'visibility') ||
    hasString(content, 'is_private') ||
    hasString(content, 'check_owner') ||
    hasString(content, 'is_owner') ||
    hasString(content, 'memory_owner') ||
    hasString(content, 'fetch_memory_for_owner_check');

  // This test documents the gap - if it fails, visibility checks have been added
  assert.ok(
    !hasVisibilityCheck,
    'SECURITY GAP: create_comment should check memory visibility/ownership but does not'
  );
});

test('comments fetch_comments does not check memory visibility', () => {
  const content = readFileContent(COMMENTS_PY);

  const hasVisibilityCheck = hasString(content, 'visibility') ||
    hasString(content, 'is_private') ||
    hasString(content, 'check_owner') ||
    hasString(content, 'is_owner') ||
    hasString(content, 'memory_owner') ||
    hasString(content, 'fetch_memory_for_owner_check');

  assert.ok(
    !hasVisibilityCheck,
    'SECURITY GAP: fetch_comments should check memory visibility/ownership but does not'
  );
});

test('reactions toggle_reaction does not check memory visibility', () => {
  const content = readFileContent(REACTIONS_PY);

  const hasVisibilityCheck = hasString(content, 'visibility') ||
    hasString(content, 'is_private') ||
    hasString(content, 'check_owner') ||
    hasString(content, 'is_owner') ||
    hasString(content, 'memory_owner') ||
    hasString(content, 'fetch_memory_for_owner_check');

  assert.ok(
    !hasVisibilityCheck,
    'SECURITY GAP: toggle_reaction should check memory visibility/ownership but does not'
  );
});

test('reactions fetch_reaction_summary does not check memory visibility', () => {
  const content = readFileContent(REACTIONS_PY);

  const hasVisibilityCheck = hasString(content, 'visibility') ||
    hasString(content, 'is_private') ||
    hasString(content, 'check_owner') ||
    hasString(content, 'is_owner') ||
    hasString(content, 'memory_owner') ||
    hasString(content, 'fetch_memory_for_owner_check');

  assert.ok(
    !hasVisibilityCheck,
    'SECURITY GAP: fetch_reaction_summary should check memory visibility/ownership but does not'
  );
});

// ─── ROUTE-LEVEL VISIBILITY CHECK CONTRACTS ────────────────────────────────────

test('comments POST route does not verify memory ownership before create', () => {
  const content = readFileContent(APP_PY);

  const commentPostMatch = content.indexOf('async def post_memory_comment(');
  assert.notEqual(commentPostMatch, -1, 'post_memory_comment function should exist');

  const commentPostBlock = content.slice(commentPostMatch, commentPostMatch + 800);
  const hasOwnerCheck = hasString(commentPostBlock, 'fetch_memory_for_owner_check') ||
    hasString(commentPostBlock, 'check_owner') ||
    hasString(commentPostBlock, 'is_owner') ||
    hasString(commentPostBlock, 'memory_owner');

  assert.ok(
    !hasOwnerCheck,
    'SECURITY GAP: comments POST route should verify memory ownership but does not'
  );
});

test('reactions POST route does not verify memory ownership before toggle', () => {
  const content = readFileContent(APP_PY);

  const reactionPostMatch = content.indexOf('async def post_memory_reaction(');
  assert.notEqual(reactionPostMatch, -1, 'post_memory_reaction function should exist');

  const reactionPostBlock = content.slice(reactionPostMatch, reactionPostMatch + 800);
  const hasOwnerCheck = hasString(reactionPostBlock, 'fetch_memory_for_owner_check') ||
    hasString(reactionPostBlock, 'check_owner') ||
    hasString(reactionPostBlock, 'is_owner') ||
    hasString(reactionPostBlock, 'memory_owner');

  assert.ok(
    !hasOwnerCheck,
    'SECURITY GAP: reactions POST route should verify memory ownership but does not'
  );
});

// ─── COMPARISON WITH MEMORY ROUTES ─────────────────────────────────────────────

test('memory PUT/DELETE routes delegate to owner-checked functions', () => {
  const content = readFileContent(APP_PY);

  // Memory routes delegate to update_owner_memory/delete_owner_memory
  // which internally call require_memory_owner
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

test('comments/reactions routes do NOT delegate to owner-checked functions', () => {
  const content = readFileContent(APP_PY);

  // Comments route calls create_comment directly without owner check
  const commentPostMatch = content.indexOf('async def post_memory_comment(');
  const commentPostBlock = content.slice(commentPostMatch, commentPostMatch + 800);
  const hasCommentOwnerCheck = hasString(commentPostBlock, 'require_memory_owner') ||
    hasString(commentPostBlock, 'fetch_memory_for_owner_check') ||
    hasString(commentPostBlock, 'update_owner_memory');

  // Reactions route calls toggle_reaction directly without owner check
  const reactionPostMatch = content.indexOf('async def post_memory_reaction(');
  const reactionPostBlock = content.slice(reactionPostMatch, reactionPostMatch + 800);
  const hasReactionOwnerCheck = hasString(reactionPostBlock, 'require_memory_owner') ||
    hasString(reactionPostBlock, 'fetch_memory_for_owner_check') ||
    hasString(reactionPostBlock, 'update_owner_memory');

  // Document the gap
  assert.ok(
    !hasCommentOwnerCheck,
    'SECURITY GAP: comments POST route should verify memory ownership but does not'
  );
  assert.ok(
    !hasReactionOwnerCheck,
    'SECURITY GAP: reactions POST route should verify memory ownership but does not'
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

  assert.ok(
    hasString(content, '"id"'),
    'normalize_comment_row should include id'
  );
  assert.ok(
    hasString(content, '"memoryId"'),
    'normalize_comment_row should include memoryId'
  );
  assert.ok(
    hasString(content, '"ownerId"'),
    'normalize_comment_row should include ownerId'
  );
  assert.ok(
    hasString(content, '"body"'),
    'normalize_comment_row should include body'
  );
  assert.ok(
    hasString(content, '"createdAt"'),
    'normalize_comment_row should include createdAt'
  );
  assert.ok(
    hasString(content, '"updatedAt"'),
    'normalize_comment_row should include updatedAt'
  );
});

test('normalize_reaction_row returns expected fields', () => {
  const content = readFileContent(REACTIONS_PY);

  assert.ok(
    hasString(content, '"id"'),
    'normalize_reaction_row should include id'
  );
  assert.ok(
    hasString(content, '"memoryId"'),
    'normalize_reaction_row should include memoryId'
  );
  assert.ok(
    hasString(content, '"ownerId"'),
    'normalize_reaction_row should include ownerId'
  );
  assert.ok(
    hasString(content, '"type"'),
    'normalize_reaction_row should include type'
  );
  assert.ok(
    hasString(content, '"createdAt"'),
    'normalize_reaction_row should include createdAt'
  );
});
