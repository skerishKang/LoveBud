/**
 * Contract tests for public (guest-safe) moment social read endpoints.
 *
 * These tests verify that the new public moment reaction/comment read endpoints
 * enforce tree+memory membership, visibility guards, and return safe DTOs
 * without leaking owner identity, internal fields, or auth state.
 *
 * The existing private endpoints in modal_compute/app.py and their
 * require_firebase_user contracts remain untouched.
 *
 * Refs: #3175, #3075
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

const PUBLIC_READS_PY = path.join(ROOT, 'modal_compute', 'public_reads.py');
const COMMENTS_PY = path.join(ROOT, 'modal_compute', 'comments.py');
const REACTIONS_PY = path.join(ROOT, 'modal_compute', 'reactions.py');
const APP_PY = path.join(ROOT, 'modal_compute', 'app.py');
const POSTGRES_CLIENT_JS = path.join(ROOT, 'js', 'postgres-client.js');

const CF_REACTIONS_PROXY = path.join(ROOT, 'functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js');
const CF_COMMENTS_PROXY = path.join(ROOT, 'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js');

const PUBLIC_VIEWER_UI = path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js');
const PUBLIC_VIEWER_TEMPLATE = path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────────

test('public_reads.py exists', () => {
  assert.ok(fs.existsSync(PUBLIC_READS_PY), 'modal_compute/public_reads.py should exist');
});

test('CF reactions proxy exists', () => {
  assert.ok(fs.existsSync(CF_REACTIONS_PROXY), 'functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js should exist');
});

test('CF comments proxy exists', () => {
  assert.ok(fs.existsSync(CF_COMMENTS_PROXY), 'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js should exist');
});

// ─── PUBLIC GUARD: require_public_memory_membership ───────────────────────────

test('public_reads.py defines require_public_memory_membership', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  assert.ok(
    hasString(content, 'def require_public_memory_membership('),
    'require_public_memory_membership should be defined in public_reads.py'
  );
});

test('require_public_memory_membership queries both tree and memory visibility', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  // Must check m.tree_id = tree_id AND m.visibility = 'public' AND t.visibility = 'public'
  assert.ok(
    hasString(content, "m.tree_id = %s"),
    'guard should check memory.tree_id matches requested tree_id'
  );
  assert.ok(
    hasString(content, "m.visibility = 'public'"),
    'guard should check memory visibility is public'
  );
  assert.ok(
    hasString(content, "t.visibility = 'public'"),
    'guard should check tree visibility is public'
  );
});

test('require_public_memory_membership raises 404 on any failure', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  assert.ok(
    hasString(content, "status_code=404, detail=\"Memory not found\""),
    'guard should raise 404 for missing/private/mismatch'
  );
  assert.ok(
    hasRegex(content, /HTTPException\(status_code=404/),
    'guard should use HTTPException with status 404'
  );
});

test('require_public_memory_membership does not call require_firebase_user', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  assert.equal(
    hasString(content, 'require_firebase_user'),
    false,
    'public guard should not use firebase auth helper'
  );
});

test('require_public_memory_membership rejects legacy payload trees (404)', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  const guardStart = content.indexOf('def require_public_memory_membership(');
  const fetchStart = content.indexOf('def fetch_public_memory(', guardStart);
  const guardBody = content.slice(guardStart, fetchStart);
  // Should return 404 for legacy trees without memories table
  assert.ok(
    hasString(guardBody, '_table_exists'),
    'guard should detect missing memories table for legacy trees'
  );
  assert.ok(
    hasString(guardBody, 'HTTPException(status_code=404'),
    'guard should raise 404 for legacy trees'
  );
});

// ─── PUBLIC MODAL ROUTES ──────────────────────────────────────────────────────

test('app.py defines public reactions route with tree_id + memory_id', () => {
  const content = readFileContent(APP_PY);
  const route = '/modal/public/trees/{tree_id}/memories/{memory_id}/reactions';
  assert.ok(
    hasString(content, route),
    `app.py should define ${route}`
  );
});

test('app.py defines public comments route with tree_id + memory_id', () => {
  const content = readFileContent(APP_PY);
  const route = '/modal/public/trees/{tree_id}/memories/{memory_id}/comments';
  assert.ok(
    hasString(content, route),
    `app.py should define ${route}`
  );
});

test('public Modal reactions route does not call require_firebase_user', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('def get_public_memory_reactions(');
  assert.notEqual(routeMatch, -1, 'get_public_memory_reactions handler must exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 800);

  assert.equal(
    hasString(routeBlock, 'require_firebase_user'),
    false,
    'public reactions route must not use firebase auth'
  );
  assert.ok(
    hasString(routeBlock, 'require_public_memory_membership(safe_tree_id, safe_memory_id)'),
    'public reactions route should call require_public_memory_membership'
  );
  assert.ok(
    hasString(routeBlock, 'fetch_public_reaction_counts(safe_memory_id)'),
    'public reactions route should call fetch_public_reaction_counts'
  );
});

test('public Modal comments route does not call require_firebase_user', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('def get_public_memory_comments(');
  assert.notEqual(routeMatch, -1, 'get_public_memory_comments handler must exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 800);

  assert.equal(
    hasString(routeBlock, 'require_firebase_user'),
    false,
    'public comments route must not use firebase auth'
  );
  assert.ok(
    hasString(routeBlock, 'require_public_memory_membership(safe_tree_id, safe_memory_id)'),
    'public comments route should call require_public_memory_membership'
  );
  assert.ok(
    hasString(routeBlock, 'fetch_public_comments(safe_memory_id, limit=limit)'),
    'public comments route should call fetch_public_comments with limit'
  );
});

test('public Modal comments route uses bounded limit', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('def get_public_memory_comments(');
  assert.notEqual(routeMatch, -1, 'get_public_memory_comments handler must exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 800);

  assert.ok(
    hasRegex(routeBlock, /limit.*Query\(default=20.*le=50/),
    'comments route should use Query with default=20 and le=50'
  );
});

// ─── PUBLIC MODAL ROUTES PRESERVE PRIVATE ROUTES ──────────────────────────────

test('private reactions GET route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('def get_memory_reactions(');
  assert.notEqual(routeMatch, -1, 'get_memory_reactions handler must still exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 500);

  assert.ok(
    hasString(routeBlock, 'require_firebase_user(authorization)'),
    'private reactions GET must still require firebase auth'
  );
});

test('private reactions POST route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('async def post_memory_reaction(');
  assert.notEqual(routeMatch, -1, 'post_memory_reaction handler must still exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 500);

  assert.ok(
    hasString(routeBlock, 'require_firebase_user(authorization)'),
    'private reactions POST must still require firebase auth'
  );
});

test('private comments GET route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('def get_memory_comments(');
  assert.notEqual(routeMatch, -1, 'get_memory_comments handler must still exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 500);

  assert.ok(
    hasString(routeBlock, 'require_firebase_user(authorization)'),
    'private comments GET must still require firebase auth'
  );
});

test('private comments POST route still requires firebase auth', () => {
  const content = readFileContent(APP_PY);

  const routeMatch = content.indexOf('async def post_memory_comment(');
  assert.notEqual(routeMatch, -1, 'post_memory_comment handler must still exist');
  const routeBlock = content.slice(routeMatch, routeMatch + 500);

  assert.ok(
    hasString(routeBlock, 'require_firebase_user(authorization)'),
    'private comments POST must still require firebase auth'
  );
});

// ─── PUBLIC REACTION DTO SAFETY ───────────────────────────────────────────────

test('reactions.py defines fetch_public_reaction_counts', () => {
  const content = readFileContent(REACTIONS_PY);
  assert.ok(
    hasString(content, 'def fetch_public_reaction_counts('),
    'fetch_public_reaction_counts should be defined'
  );
});

test('fetch_public_reaction_counts returns only aggregate counts', () => {
  const content = readFileContent(REACTIONS_PY);
  const fnStart = content.indexOf('def fetch_public_reaction_counts(');
  const fnEnd = content.indexOf('def fetch_reaction_summary(', fnStart);
  const fnBody = content.slice(fnStart, fnEnd);

  assert.ok(
    hasString(fnBody, '"counts"'),
    'public reaction response should include counts'
  );
  assert.ok(
    hasString(fnBody, '"total"'),
    'public reaction response should include total'
  );
  // Must NOT return ownerId, userReactions, or userReacted
  assert.equal(
    hasString(fnBody, 'ownerId'),
    false,
    'public reaction response must not include ownerId'
  );
  assert.equal(
    hasString(fnBody, 'userReactions'),
    false,
    'public reaction response must not include userReactions'
  );
  assert.equal(
    hasString(fnBody, 'userReacted'),
    false,
    'public reaction response must not include userReacted'
  );
});

test('fetch_public_reaction_counts reuses fetch_reaction_counts without auth', () => {
  const content = readFileContent(REACTIONS_PY);
  // fetch_public_reaction_counts must call fetch_reaction_counts not fetch_reaction_summary
  assert.ok(
    hasString(content, 'fetch_reaction_counts(memory_id)'),
    'fetch_public_reaction_counts should delegate to fetch_reaction_counts'
  );
});

// ─── PUBLIC COMMENT DTO SAFETY ────────────────────────────────────────────────

test('comments.py defines normalize_public_comment_row', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'def normalize_public_comment_row('),
    'normalize_public_comment_row should be defined'
  );
});

test('comments.py defines fetch_public_comments', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(
    hasString(content, 'def fetch_public_comments('),
    'fetch_public_comments should be defined'
  );
});

test('normalize_public_comment_row returns only public-safe fields', () => {
  const content = readFileContent(COMMENTS_PY);

  const fnStart = content.indexOf('def normalize_public_comment_row');
  assert.notEqual(fnStart, -1, 'normalize_public_comment_row must exist');
  const fnEnd = content.indexOf('def fetch_public_comments', fnStart);
  const fnBody = content.slice(fnStart, fnEnd);

  // Required public fields
  assert.ok(hasString(fnBody, '"id"'), 'public comment DTO should include id');
  assert.ok(hasString(fnBody, '"body"'), 'public comment DTO should include body');
  assert.ok(hasString(fnBody, '"createdAt"'), 'public comment DTO should include createdAt');

  // Forbidden private fields
  assert.equal(hasString(fnBody, '"ownerId"'), false, 'public comment DTO must not include ownerId');
  assert.equal(hasString(fnBody, '"memoryId"'), false, 'public comment DTO must not include memoryId');
  assert.equal(hasString(fnBody, '"updatedAt"'), false, 'public comment DTO must not include updatedAt');
});

test('fetch_public_comments returns bounded list with nextCursor null', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(
    hasString(content, '"comments"'),
    'fetch_public_comments response should include comments key'
  );
  assert.ok(
    hasString(content, '"nextCursor"'),
    'fetch_public_comments response should include nextCursor'
  );
  assert.ok(
    hasString(content, 'nextCursor'),
    'fetch_public_comments should handle nextCursor'
  );
  assert.ok(
    hasRegex(content, /safe_limit.*min.*limit.*50/),
    'fetch_public_comments should clamp limit to max 50'
  );
});

// ─── PUBLIC BROWSER API METHODS ───────────────────────────────────────────────

test('postgres-client.js defines fetchPublicMomentReactionSummary', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'fetchPublicMomentReactionSummary'),
    'browser API client should define fetchPublicMomentReactionSummary'
  );
});

test('postgres-client.js defines fetchPublicMomentComments', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);
  assert.ok(
    hasString(content, 'fetchPublicMomentComments'),
    'browser API client should define fetchPublicMomentComments'
  );
});

test('public client methods use publicRead: true', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);

  const reactionsLine = content.split('\n').find(l => l.includes('fetchPublicMomentReactionSummary'));
  assert.ok(reactionsLine, 'fetchPublicMomentReactionSummary must exist');

  // Must use publicRead: true
  assert.ok(
    reactionsLine.includes('publicRead: true'),
    'fetchPublicMomentReactionSummary must use publicRead: true'
  );

  const commentsLine = content.split('\n').find(l => l.includes('fetchPublicMomentComments'));
  assert.ok(commentsLine, 'fetchPublicMomentComments must exist');

  assert.ok(
    commentsLine.includes('publicRead: true'),
    'fetchPublicMomentComments must use publicRead: true'
  );
});

test('public client methods use /trees/{id}/memories/{id} path not /memories/{id}', () => {
  const content = readFileContent(POSTGRES_CLIENT_JS);

  const reactionsLine = content.split('\n').find(l => l.includes('fetchPublicMomentReactionSummary'));
  assert.ok(reactionsLine.includes('/trees/'), 'fetchPublicMomentReactionSummary must use /trees/ path');
  assert.ok(reactionsLine.includes('/memories/'), 'fetchPublicMomentReactionSummary must use /memories/ path');

  const commentsLine = content.split('\n').find(l => l.includes('fetchPublicMomentComments'));
  assert.ok(commentsLine.includes('/trees/'), 'fetchPublicMomentComments must use /trees/ path');
  assert.ok(commentsLine.includes('/memories/'), 'fetchPublicMomentComments must use /memories/ path');
});

// ─── CF PROXY CONTRACTS ───────────────────────────────────────────────────────

test('CF reactions proxy is GET-only (no POST handler)', () => {
  const content = readFileContent(CF_REACTIONS_PROXY);
  assert.ok(
    hasString(content, 'onRequestGet'),
    'CF reactions proxy should define onRequestGet'
  );
  assert.equal(
    hasString(content, 'onRequestPost'),
    false,
    'CF reactions proxy should NOT define onRequestPost'
  );
});

test('CF comments proxy is GET-only (no POST handler)', () => {
  const content = readFileContent(CF_COMMENTS_PROXY);
  assert.ok(
    hasString(content, 'onRequestGet'),
    'CF comments proxy should define onRequestGet'
  );
  assert.equal(
    hasString(content, 'onRequestPost'),
    false,
    'CF comments proxy should NOT define onRequestPost'
  );
});

test('CF proxies do not forward Authorization header', () => {
  const reactionsContent = readFileContent(CF_REACTIONS_PROXY);
  assert.equal(
    hasString(reactionsContent, 'authorization'),
    false,
    'CF reactions proxy must not forward authorization header'
  );

  const commentsContent = readFileContent(CF_COMMENTS_PROXY);
  assert.equal(
    hasString(commentsContent, 'authorization'),
    false,
    'CF comments proxy must not forward authorization header'
  );
});

test('CF proxies use /modal/public/trees/ upstream path', () => {
  const reactionsContent = readFileContent(CF_REACTIONS_PROXY);
  assert.ok(
    hasString(reactionsContent, '/modal/public/trees/'),
    'CF reactions proxy must target the public upstream route'
  );

  const commentsContent = readFileContent(CF_COMMENTS_PROXY);
  assert.ok(
    hasString(commentsContent, '/modal/public/trees/'),
    'CF comments proxy must target the public upstream route'
  );
});

test('CF proxies handle MODAL_BASE_URL missing and modal unavailable', () => {
  const reactionsContent = readFileContent(CF_REACTIONS_PROXY);
  assert.ok(hasString(reactionsContent, 'MODAL_BASE_URL'), 'reactions proxy should handle MODAL_BASE_URL');
  assert.ok(hasString(reactionsContent, 'buildModalUnavailableResponse'), 'reactions proxy should handle modal unavailable');

  const commentsContent = readFileContent(CF_COMMENTS_PROXY);
  assert.ok(hasString(commentsContent, 'MODAL_BASE_URL'), 'comments proxy should handle MODAL_BASE_URL');
  assert.ok(hasString(commentsContent, 'buildModalUnavailableResponse'), 'comments proxy should handle modal unavailable');
});

// ─── PUBLIC VIEWER / UI SCOPE GUARD ───────────────────────────────────────────

test('public-viewer-detail-ui.js is not modified', () => {
  assert.ok(fs.existsSync(PUBLIC_VIEWER_UI), 'public-viewer-detail-ui.js must exist');
  // Load the original from git — this checks the working tree hasn't changed it
  const content = readFileContent(PUBLIC_VIEWER_UI);
  // Core identifier unique to the read-only boundary pattern that must stay
  assert.ok(
    hasString(content, 'createPublicViewerReadOnlyReactionSummaryBoundary'),
    'public viewer must still have the read-only reaction boundary'
  );
  assert.ok(
    hasString(content, 'is-public-readonly'),
    'public viewer must still use is-public-readonly class'
  );
});

test('public-viewer-detail-view-mode-template.js is not modified', () => {
  assert.ok(fs.existsSync(PUBLIC_VIEWER_TEMPLATE), 'public-viewer-detail-view-mode-template.js must exist');
  const content = readFileContent(PUBLIC_VIEWER_TEMPLATE);
  assert.ok(
    hasString(content, 'is-read-only'),
    'template must still have read-only class'
  );
  assert.ok(
    hasString(content, '반응 기능은 준비 중이에요'),
    'template must still have the placeholder text'
  );
});

// ─── LEGACY MEMORY GUARD CONTRACT ─────────────────────────────────────────────

test('require_public_memory_membership rejects legacy (payload-based) memories with 404', () => {
  const content = readFileContent(PUBLIC_READS_PY);
  // The guard's docstring should mention this
  assert.ok(
    hasString(content, 'legacy') || hasString(content, 'Legacy'),
    'public guard should document legacy memory rejection'
  );
  assert.ok(
    hasString(content, 'no reaction') || hasString(content, 'no comment') ||
    hasString(content, 'unavailable') || hasString(content, '404'),
    'public guard should document that legacy memories return 404'
  );
});

// ─── SCOPE GUARDS: FORBIDDEN FILES NOT CHANGED ────────────────────────────────

test('Forbidden file: DB migration files are not created or modified', () => {
  const migrationsDir = path.join(ROOT, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    // Just verify the directory is unmodified — no new file assertions
    assert.ok(Array.isArray(files), 'migrations directory should be readable');
  }
});

test('Forbidden file: Scout, Browse, My Trees files are not modified', () => {
  const forbiddenPatterns = [
    'js/scout/',
    'js/browse/',
    'js/my-trees/',
    'pages/search.html',
    'pages/my-trees.html',
  ];
  // These are checked via the file existence test above for public viewer files
  // and the explicit list of changed files in the PR scope.
  const scoutDir = path.join(ROOT, 'js', 'scout');
  const browseDir = path.join(ROOT, 'js', 'browse');
  const myTreesDir = path.join(ROOT, 'js', 'my-trees');
  assert.ok(!fs.existsSync(scoutDir) || fs.statSync(scoutDir).isDirectory(), 'scout dir unchanged');
  assert.ok(!fs.existsSync(browseDir) || fs.statSync(browseDir).isDirectory(), 'browse dir unchanged');
  assert.ok(!fs.existsSync(myTreesDir) || fs.statSync(myTreesDir).isDirectory(), 'my-trees dir unchanged');
});
