'use strict';

/**
 * Contract tests for Tree-level comment creation rate limiting (Issue #3940).
 *
 * Verifies that modal_compute/social_rate_limit.py and modal_compute/tree_comments.py
 * enforce bounded actor-wide rate limiting on Tree comment writes without schema migration:
 * - Actor ceiling: 10/minute (reusing existing social_rate_limits authority)
 * - Scope: 'tree-comment:actor' with memory_id=None (Tree ID never in memory_id)
 * - Exceeded: HTTP 429 RATE_LIMITED with bounded retry metadata
 * - Outage: HTTP 503 RATE_LIMIT_UNAVAILABLE (fail-closed)
 * - Ordering: visibility lock -> idempotency check/replay -> rate limit -> insert
 * - Replay consumes 0 rate quota
 * - Moment comment rate limiting preserved
 *
 * Refs: #3940, #3947, #3987, #3184, #3177, #3396, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SOCIAL_RATE_LIMIT_PY = path.join(ROOT, 'modal_compute', 'social_rate_limit.py');
const TREE_COMMENTS_PY = path.join(ROOT, 'modal_compute', 'tree_comments.py');
const PYTHON_TEST_PATH = path.join(ROOT, 'tests', 'contracts', 'test_tree_comment_rate_limit_3940.py');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

// ─── 1. File existence ───────────────────────────────────────────────────────

test('3940: social_rate_limit.py and tree_comments.py exist', () => {
  assert.ok(fs.existsSync(SOCIAL_RATE_LIMIT_PY), 'modal_compute/social_rate_limit.py must exist');
  assert.ok(fs.existsSync(TREE_COMMENTS_PY), 'modal_compute/tree_comments.py must exist');
  assert.ok(fs.existsSync(PYTHON_TEST_PATH), 'test_tree_comment_rate_limit_3940.py must exist');
});

// ─── 2. Rate limit helper definition ────────────────────────────────────────

test('3940: social_rate_limit.py defines check_tree_comment_rate_limits and limits', () => {
  const content = readFile(SOCIAL_RATE_LIMIT_PY);

  // Ceiling and window
  assert.ok(
    /COMMENT_ACTOR_LIMIT\s*=\s*10/.test(content),
    'COMMENT_ACTOR_LIMIT must be 10'
  );
  assert.ok(
    /TREE_COMMENT_ACTOR_LIMIT\s*=\s*10/.test(content),
    'TREE_COMMENT_ACTOR_LIMIT must be 10'
  );
  assert.ok(
    /WINDOW_MINUTES\s*=\s*1/.test(content),
    'WINDOW_MINUTES must be 1'
  );

  // Function signature
  assert.ok(
    /def check_tree_comment_rate_limits\(\s*cur:\s*Any,\s*actor_id:\s*str,?\s*\)\s*->\s*None:/.test(content),
    'check_tree_comment_rate_limits function signature must match'
  );

  // Scope and memory_id=None
  assert.ok(
    /scope="tree-comment:actor"/.test(content),
    'Must use distinct scope "tree-comment:actor"'
  );
  assert.ok(
    /memory_id=None/.test(content),
    'Must use memory_id=None (Tree ID never in memory_id)'
  );

  // Error taxonomy
  assert.ok(
    /code="RATE_LIMIT_UNAVAILABLE"/.test(content) && /status_code=503/.test(content),
    'Storage failure must raise 503 RATE_LIMIT_UNAVAILABLE'
  );
  assert.ok(
    /code="RATE_LIMITED"/.test(content) && /status_code=429/.test(content),
    'Exceeded limit must raise 429 RATE_LIMITED'
  );
  assert.ok(
    /retry_after_ms=WINDOW_MINUTES\s*\*\s*60\s*\*\s*1000/.test(content),
    'Must include retry_after_ms metadata'
  );
});

// ─── 3. Tree comment writer integration ─────────────────────────────────────

test('3940: tree_comments.py imports and calls check_tree_comment_rate_limits', () => {
  const content = readFile(TREE_COMMENTS_PY);

  assert.ok(
    /from modal_compute\.social_rate_limit import check_tree_comment_rate_limits/.test(content),
    'tree_comments.py must import check_tree_comment_rate_limits'
  );

  assert.ok(
    /check_tree_comment_rate_limits\(cur,\s*owner_id\)/.test(content),
    'tree_comments.py must call check_tree_comment_rate_limits(cur, owner_id)'
  );
});

// ─── 4. Transaction ordering ────────────────────────────────────────────────

test('3940: create_tree_comment preserves exact transaction ordering', () => {
  const content = readFile(TREE_COMMENTS_PY);

  const fnStart = content.indexOf('def create_tree_comment(');
  assert.ok(fnStart !== -1, 'create_tree_comment must exist');
  const fnBody = content.slice(fnStart);

  const posVisibility = fnBody.indexOf('require_public_tree_cursor(cur, safe_tree_id)');
  const posIdempotency = fnBody.indexOf('reserve_and_verify_idempotency_target(');
  const posReplay = fnBody.indexOf('replay.get("replay")');
  const posRateLimit = fnBody.indexOf('check_tree_comment_rate_limits(cur, owner_id)');
  const posInsert = fnBody.indexOf('INSERT INTO tree_comments');
  const posCompleteIdemp = fnBody.indexOf('complete_idempotency(');
  const posAudit = fnBody.lastIndexOf('record_audit_target(');
  const posCommit = fnBody.lastIndexOf('conn.commit()');

  assert.ok(posVisibility !== -1, 'require_public_tree_cursor must be present');
  assert.ok(posIdempotency !== -1, 'reserve_and_verify_idempotency_target must be present');
  assert.ok(posReplay !== -1, 'replay check must be present');
  assert.ok(posRateLimit !== -1, 'check_tree_comment_rate_limits must be present');
  assert.ok(posInsert !== -1, 'INSERT INTO tree_comments must be present');
  assert.ok(posCompleteIdemp !== -1, 'complete_idempotency must be present');
  assert.ok(posAudit !== -1, 'record_audit_target must be present');
  assert.ok(posCommit !== -1, 'conn.commit must be present');

  // Verify exact order
  assert.ok(posVisibility < posIdempotency, 'visibility lock must precede idempotency check');
  assert.ok(posIdempotency < posReplay, 'idempotency check must precede replay branch');
  assert.ok(posReplay < posRateLimit, 'replay branch must precede rate limit check (replay does not consume quota)');
  assert.ok(posRateLimit < posInsert, 'rate limit check must precede comment insert');
  assert.ok(posInsert < posCompleteIdemp, 'comment insert must precede idempotency completion');
  assert.ok(posCompleteIdemp < posAudit, 'idempotency completion must precede audit log');
  assert.ok(posAudit < posCommit, 'audit log must precede transaction commit');
});

// ─── 5. Moment comment rate limiting preserved ──────────────────────────────

test('3940: moment comment rate limits and scopes remain intact', () => {
  const content = readFile(SOCIAL_RATE_LIMIT_PY);

  assert.ok(
    /def check_comment_rate_limits\(/.test(content),
    'check_comment_rate_limits must remain defined'
  );
  assert.ok(
    /scope="comment:actor"/.test(content),
    'scope "comment:actor" must be preserved'
  );
  assert.ok(
    /scope="comment:actor-memory"/.test(content),
    'scope "comment:actor-memory" must be preserved'
  );
  assert.ok(
    /COMMENT_ACTOR_MEMORY_LIMIT\s*=\s*3/.test(content),
    'COMMENT_ACTOR_MEMORY_LIMIT must remain 3'
  );
});

// ─── 6. Companion test suite and issue references ───────────────────────────

test('3940: companion test suite exists and references required issues', () => {
  const testContent = readFile(PYTHON_TEST_PATH);

  assert.ok(testContent.includes('#3940'), 'Must reference #3940');
  assert.ok(testContent.includes('#3947'), 'Must reference prerequisite #3947');
  assert.ok(testContent.includes('#3987'), 'Must reference PR #3987');
  assert.ok(testContent.includes('#1882'), 'Must reference parent #1882');
  assert.ok(!/\bCloses\s+#1882\b/.test(testContent), 'Must not use Closes #1882');
});
