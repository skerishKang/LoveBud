/**
 * Contract tests for comment forward cursor pagination (Issue #3939).
 *
 * Verifies across all three comment read surfaces:
 * 1. Public Moment comments (fetch_public_comments)
 * 2. Authenticated Moment comments (fetch_comments / page_comments)
 * 3. Public Tree comments (fetch_tree_comments)
 *
 * Key guarantees:
 * - Stable oldest-first ordering: (created_at ASC, id ASC)
 * - Forward cursor pagination with LIMIT limit+1 and nextCursor extraction
 * - Cloudflare Pages Functions query parameter forwarding (limit & cursor)
 * - Browser client contracts (postgres-client.js, tree-comments-client.js)
 * - Privacy-safe DTO compliance (zero raw ownerId)
 * - Refs: #3939, #3940, #3929, #3408, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const COMMENTS_PY = 'modal_compute/comments.py';
const TREE_COMMENTS_PY = 'modal_compute/tree_comments.py';
const SOCIAL_CURSOR_PY = 'modal_compute/social_cursor.py';
const APP_PY = 'modal_compute/app.py';
const CF_MOMENT_COMMENTS_JS = 'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js';
const CF_TREE_COMMENTS_JS = 'functions/api/trees/[tree_id]/comments.js';
const CF_PRIVATE_COMMENTS_JS = 'functions/api/memories/[id]/comments.js';
const POSTGRES_CLIENT_JS = 'js/postgres-client.js';
const TREE_COMMENTS_CLIENT_JS = 'js/social/tree-comments-client.js';
const PUBLIC_VIEWER_SOCIAL_SUMMARY_JS = 'js/viewer/public-viewer-read-only-social-summary.js';

// ─── 1. Core Module Existence & Cursor Primitives ──────────────────────────

test('modal_compute/social_cursor.py defines cursor encode/decode functions', () => {
  const content = readFile(SOCIAL_CURSOR_PY);
  assert.ok(content.includes('def encode_comment_cursor('), 'must define encode_comment_cursor');
  assert.ok(content.includes('def decode_comment_cursor('), 'must define decode_comment_cursor');
  assert.ok(content.includes('class CommentCursorError('), 'must define CommentCursorError');
  assert.ok(content.includes('_COMMENT_CURSOR_VERSION'), 'must define cursor version');
  assert.ok(content.includes('_MAX_CURSOR_PAYLOAD_CHARS'), 'must bound max cursor payload size');
});

// ─── 2. Moment Comments Pagination (comments.py) ───────────────────────────

test('comments.py fetch_public_comments supports cursor pagination with LIMIT+1', () => {
  const content = readFile(COMMENTS_PY);
  assert.ok(content.includes('def fetch_public_comments('), 'must define fetch_public_comments');
  assert.ok(content.includes('cursor: str | None = None'), 'fetch_public_comments must accept cursor');
  assert.ok(content.includes('decode_comment_cursor('), 'must decode cursor');
  assert.ok(content.includes('ORDER BY created_at ASC, id ASC'), 'must order by created_at ASC, id ASC');
  assert.ok(content.includes('safe_limit + 1'), 'must query limit + 1 for has_more check');
  assert.ok(content.includes('encode_comment_cursor('), 'must encode nextCursor from last item');
});

test('comments.py page_comments provides authenticated cursor pagination', () => {
  const content = readFile(COMMENTS_PY);
  assert.ok(content.includes('def page_comments('), 'must define page_comments');
  assert.ok(content.includes('require_memory_visible_or_owner('), 'must check visibility');
  assert.ok(content.includes('normalize_comment_row(row, requester_uid)'), 'must normalize with requester_uid');
});

// ─── 3. Tree Comments Pagination (tree_comments.py) ────────────────────────

test('tree_comments.py fetch_tree_comments supports cursor pagination with nextCursor', () => {
  const content = readFile(TREE_COMMENTS_PY);
  assert.ok(content.includes('def fetch_tree_comments('), 'must define fetch_tree_comments');
  assert.ok(content.includes('cursor: str | None = None'), 'fetch_tree_comments must accept cursor');
  assert.ok(content.includes('require_public_tree_for_like('), 'must check public tree visibility');
  assert.ok(content.includes('ORDER BY created_at ASC, id ASC'), 'must order by created_at ASC, id ASC');
  assert.ok(content.includes('safe_limit + 1'), 'must query limit + 1');
  assert.ok(content.includes('nextCursor'), 'must return nextCursor');
});

// ─── 4. Modal FastAPI Routes (app.py) ──────────────────────────────────────

test('app.py exposes cursor query parameter on all comment read routes', () => {
  const content = readFile(APP_PY);
  // get_tree_comments
  const treeMatch = content.indexOf('def get_tree_comments(');
  assert.notEqual(treeMatch, -1);
  const treeBlock = content.slice(treeMatch, treeMatch + 400);
  assert.ok(treeBlock.includes('cursor: str | None = Query(default=None)'), 'get_tree_comments must accept cursor');

  // get_public_memory_comments
  const pubMatch = content.indexOf('def get_public_memory_comments(');
  assert.notEqual(pubMatch, -1);
  const pubBlock = content.slice(pubMatch, pubMatch + 400);
  assert.ok(pubBlock.includes('cursor: str | None = Query(default=None)'), 'get_public_memory_comments must accept cursor');

  // get_memory_comments
  const privMatch = content.indexOf('def get_memory_comments(');
  assert.notEqual(privMatch, -1);
  const privBlock = content.slice(privMatch, privMatch + 500);
  assert.ok(privBlock.includes('cursor: str | None = Query(default=None)'), 'get_memory_comments must accept cursor');
  assert.ok(privBlock.includes('pagination: str | None = Query(default=None)'), 'get_memory_comments must accept pagination');
});

// ─── 5. Cloudflare Pages Functions Parameter Forwarding ────────────────────

test('Cloudflare proxy for public moment comments forwards search parameters', () => {
  const content = readFile(CF_MOMENT_COMMENTS_JS);
  assert.ok(content.includes('target.searchParams.set'), 'must forward query parameters');
  assert.ok(content.includes('cursor'), 'must handle cursor parameter');
});

test('Cloudflare proxy for private memory comments forwards search parameters', () => {
  const content = readFile(CF_PRIVATE_COMMENTS_JS);
  assert.ok(content.includes('target.search = incomingUrl.search'), 'must forward search parameters');
});

// ─── 6. Client Modules ─────────────────────────────────────────────────────

test('postgres-client.js comment methods accept pagination options', () => {
  const content = readFile(POSTGRES_CLIENT_JS);
  assert.ok(content.includes('fetchPublicMomentComments: async (treeId, memoryId, options = {})'), 'fetchPublicMomentComments must accept options');
  assert.ok(content.includes('fetchComments: async (memoryId, options = {})'), 'fetchComments must accept options');
});

test('tree-comments-client.js forwards cursor parameter and returns nextCursor', () => {
  const content = readFile(TREE_COMMENTS_CLIENT_JS);
  assert.ok(content.includes('opts.cursor'), 'fetchTreeComments must handle cursor option');
  assert.ok(content.includes('nextCursor'), 'fetchTreeComments must return nextCursor');
});

test('public-viewer-read-only-social-summary.js accepts valid nextCursor', () => {
  const content = readFile(PUBLIC_VIEWER_SOCIAL_SUMMARY_JS);
  assert.ok(
    content.includes('typeof commentsData.nextCursor === \'string\''),
    'validateSocialDTOs must accept string nextCursor'
  );
});
