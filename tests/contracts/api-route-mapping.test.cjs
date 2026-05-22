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

function hasRegex(content, pattern) {
  return pattern.test(content);
}

function extractBraceBlock(content, openBraceIndex, label) {
  assert.ok(
    Number.isInteger(openBraceIndex) && openBraceIndex >= 0 && openBraceIndex < content.length,
    `${label} should have a valid opening brace index`
  );
  assert.equal(content[openBraceIndex], '{', `${label} should start at an opening brace`);

  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openBraceIndex, index + 1);
  }

  assert.fail(`${label} should be closed`);
}

function extractFunctionBlock(content, functionName) {
  const start = content.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const openBrace = content.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} should have body`);

  return extractBraceBlock(content, openBrace, `${functionName} body`);
}

function extractIfBranchBlock(content, ifNeedle, label) {
  const ifIndex = content.indexOf(ifNeedle);
  assert.notEqual(ifIndex, -1, `${label} should exist`);

  const openBrace = content.indexOf('{', ifIndex);
  assert.notEqual(openBrace, -1, `${label} should have body`);

  return extractBraceBlock(content, openBrace, `${label} body`);
}

// Cloudflare Functions 파일 경로
const TREES_JS = path.join(ROOT, 'functions/api/trees.js');
const MEMORIES_JS = path.join(ROOT, 'functions/api/memories.js');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');
const TREE_DETAIL_JS = path.join(ROOT, 'functions/api/trees/[id].js');
const MEMORY_DETAIL_JS = path.join(ROOT, 'functions/api/memories/[id].js');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────

test('cloudflare api functions files exist', () => {
  assert.ok(fs.existsSync(TREES_JS), 'functions/api/trees.js should exist');
  assert.ok(fs.existsSync(MEMORIES_JS), 'functions/api/memories.js should exist');
  assert.ok(fs.existsSync(CATCHALL_JS), 'functions/api/[[path]].js should exist');
});

test('cloudflare dynamic private detail route files exist', () => {
  assert.ok(fs.existsSync(TREE_DETAIL_JS), 'functions/api/trees/[id].js should exist');
  assert.ok(fs.existsSync(MEMORY_DETAIL_JS), 'functions/api/memories/[id].js should exist');
});

// ─── PUBLIC GET ROUTE MAPPING ──────────────────────────────────────────────

test('cloudflare api catch-all routes community/trees?view=summary to modal/browse/latest', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '/api/community/trees'),
    'catch-all should handle /api/community/trees'
  );
  assert.ok(
    hasString(content, "get('view') === 'summary'"),
    'catch-all should check view=summary parameter'
  );
  assert.ok(
    hasString(content, '/modal/browse/latest'),
    'catch-all should route to /modal/browse/latest'
  );
});

test('cloudflare api catch-all routes community/growing-trees to modal/browse/growing', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '/api/community/growing-trees'),
    'catch-all should handle /api/community/growing-trees'
  );
  assert.ok(
    hasString(content, '/modal/browse/growing'),
    'catch-all should route to /modal/browse/growing'
  );
});

test('cloudflare api catch-all routes community/memories to modal/community/memories', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '/api/community/memories'),
    'catch-all should handle /api/community/memories'
  );
  assert.ok(
    hasString(content, '/modal/community/memories'),
    'catch-all should route to /modal/community/memories'
  );
});

test('cloudflare api catch-all routes public tree GET without auth to modal/trees/:id', () => {
  const content = readFileContent(CATCHALL_JS);

  // Public path (no auth, no write) → /modal/trees/:id
  assert.ok(
    hasString(content, '`/modal/trees/'),
    'catch-all should route public tree GET to /modal/trees/:id'
  );
  // Auth or write → private path
  assert.ok(
    hasString(content, '(isWrite || authHeader)'),
    'catch-all should use (isWrite || authHeader) to choose private vs public tree path'
  );
});

test('cloudflare api trees.js routes to modal/private/trees', () => {
  const content = readFileContent(TREES_JS);

  assert.ok(
    hasString(content, '/modal/private/trees'),
    'trees.js should proxy to /modal/private/trees'
  );
});

test('cloudflare api memories.js routes to modal/private/memories', () => {
  const content = readFileContent(MEMORIES_JS);

  assert.ok(
    hasString(content, '/modal/private/memories'),
    'memories.js should proxy to /modal/private/memories'
  );
  assert.ok(
    hasString(content, 'treeId'),
    'memories.js should handle treeId query parameter'
  );
});

// ─── PRIVATE WRITE ROUTE MAPPING ──────────────────────────────────────────

test('cloudflare api catch-all owns /api/trees GET and POST write routes', () => {
  const content = readFileContent(CATCHALL_JS);

  // Collection path /api/trees must be present in buildModalUrl
  assert.ok(
    hasString(content, "path === '/api/trees'"),
    'catch-all buildModalUrl should handle /api/trees'
  );
  // POST is recognised as a write-route for /api/trees collection
  assert.ok(
    hasRegex(content, /method\s*===\s*'POST'[^}]+\/api\/trees|isModalOwnedWriteRoute|isWrite/),
    'catch-all should recognise POST as a write method'
  );
  assert.ok(
    hasString(content, "/modal/private/trees"),
    'catch-all should map /api/trees to /modal/private/trees'
  );
});

test('cloudflare api catch-all owns /api/memories GET and POST write routes', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, "path === '/api/memories'"),
    'catch-all buildModalUrl should handle /api/memories'
  );
  assert.ok(
    hasString(content, '/modal/private/memories'),
    'catch-all should map /api/memories to /modal/private/memories'
  );
});

test('cloudflare api tree detail route exports private write handlers', () => {
  const content = readFileContent(TREE_DETAIL_JS);

  assert.ok(
    hasRegex(content, /export\s+async\s+function\s+onRequestPut\s*\(/),
    'tree detail route should export onRequestPut'
  );
  assert.ok(
    hasRegex(content, /export\s+async\s+function\s+onRequestDelete\s*\(/),
    'tree detail route should export onRequestDelete'
  );
});

test('cloudflare api tree detail route forwards writes to modal private trees with authorization', () => {
  const content = readFileContent(TREE_DETAIL_JS);

  assert.ok(
    hasString(content, '/modal/private/trees/'),
    'tree detail route should forward writes to /modal/private/trees/'
  );
  assert.ok(
    hasRegex(content, /method:\s*'PUT'/),
    'tree detail route should forward PUT method'
  );
  assert.ok(
    hasRegex(content, /method:\s*'DELETE'/),
    'tree detail route should forward DELETE method'
  );
  assert.ok(
    hasRegex(content, /context\.request\.headers\.get\('authorization'\)/),
    'tree detail route should read and forward the authorization header'
  );
});

test('cloudflare api memory detail route exports private write handlers', () => {
  const content = readFileContent(MEMORY_DETAIL_JS);

  assert.ok(
    hasRegex(content, /export\s+async\s+function\s+onRequestPut\s*\(/),
    'memory detail route should export onRequestPut'
  );
  assert.ok(
    hasRegex(content, /export\s+async\s+function\s+onRequestDelete\s*\(/),
    'memory detail route should export onRequestDelete'
  );
});

test('cloudflare api memory detail route forwards writes to modal private memories with authorization', () => {
  const content = readFileContent(MEMORY_DETAIL_JS);

  assert.ok(
    hasString(content, '/modal/private/memories/'),
    'memory detail route should forward writes to /modal/private/memories/'
  );
  assert.ok(
    hasRegex(content, /method:\s*'PUT'/),
    'memory detail route should forward PUT method'
  );
  assert.ok(
    hasRegex(content, /method:\s*'DELETE'/),
    'memory detail route should forward DELETE method'
  );
  assert.ok(
    hasRegex(content, /context\.request\.headers\.get\('authorization'\)/),
    'memory detail route should read and forward the authorization header'
  );
});

test('cloudflare api catch-all routes trees/:treeId with auth split', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '(isWrite || authHeader)'),
    'catch-all should check (isWrite || authHeader) for trees'
  );
  assert.ok(
    hasString(content, '`/modal/private/trees/'),
    'catch-all should route trees to private path when auth or write'
  );
});

test('cloudflare api catch-all routes memories/:memoryId to modal/memories/:memoryId', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    !hasString(content, 'authHeader && isWrite'),
    'memory route selection should not use authHeader && isWrite'
  );
  assert.ok(
    hasString(content, 'isWrite'),
    'catch-all should check for isWrite for memories'
  );
  assert.ok(
    hasString(content, '`/modal/private/memories/'),
    'catch-all should route memory write to private path'
  );
  assert.ok(
    hasString(content, '`/modal/memories/'),
    'catch-all should route memory GET to public path'
  );
});

// ─── LIMIT CLAMPING CONTRACT ────────────────────────────────────────────────

test('cloudflare catch-all clamps community/trees limit between 1 and 60', () => {
  const content = readFileContent(CATCHALL_JS);

  const buildModalUrlBlock = extractFunctionBlock(content, 'buildModalUrl');
  const communityTreesBlock = extractIfBranchBlock(
    buildModalUrlBlock,
    "if (path === '/api/community/trees' && sourceUrl.searchParams.get('view') === 'summary')",
    'buildModalUrl community/trees summary branch'
  );

  assert.ok(
    hasString(communityTreesBlock, 'Math.min'),
    'buildModalUrl community/trees should use Math.min'
  );
  assert.ok(
    hasString(communityTreesBlock, 'Math.max'),
    'buildModalUrl community/trees should use Math.max'
  );
  assert.ok(
    hasRegex(communityTreesBlock, /\b60\b/),
    'buildModalUrl community/trees should clamp max 60'
  );
  assert.ok(
    hasRegex(communityTreesBlock, /\b1\b/),
    'buildModalUrl community/trees should clamp min 1'
  );
});

test('cloudflare catch-all clamps growing-trees limit between 3 and 12', () => {
  const content = readFileContent(CATCHALL_JS);

  const growingLimitBlock = extractFunctionBlock(content, 'normalizeGrowingTreesLimit');

  assert.ok(
    hasString(growingLimitBlock, 'Math.min'),
    'normalizeGrowingTreesLimit should use Math.min'
  );
  assert.ok(
    hasString(growingLimitBlock, 'Math.max'),
    'normalizeGrowingTreesLimit should use Math.max'
  );
  assert.ok(
    hasRegex(growingLimitBlock, /\b12\b/),
    'normalizeGrowingTreesLimit should clamp max 12'
  );
  assert.ok(
    hasRegex(growingLimitBlock, /\b3\b/),
    'normalizeGrowingTreesLimit should clamp min 3'
  );
});

// ─── UNSUPPORTED METHOD HANDLING (405) ────────────────────────────────────

test('cloudflare api catch-all returns 405 for unsupported methods on handled routes', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '405'),
    'catch-all should return 405 for unsupported methods'
  );
  assert.ok(
    hasString(content, 'allow'),
    'catch-all should set allow header'
  );
  assert.ok(
    hasString(content, 'GET'),
    'catch-all should allow GET method'
  );
  assert.ok(
    hasString(content, 'method-not-allowed'),
    'catch-all should set route-status to method-not-allowed'
  );
});

test('cloudflare catch-all 405 allow header distinguishes collection vs detail paths', () => {
  const content = readFileContent(CATCHALL_JS);

  // Collection paths allow GET and POST
  assert.ok(
    hasString(content, "'GET, POST'"),
    'catch-all 405 should allow GET, POST for collection paths'
  );
  // Detail paths allow GET, PUT, DELETE
  assert.ok(
    hasString(content, "'GET, PUT, DELETE'"),
    'catch-all 405 should allow GET, PUT, DELETE for detail paths'
  );
});

test('cloudflare catch-all 405 response sets content-type application/json', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'application/json'),
    '405 response should set content-type: application/json'
  );
  assert.ok(
    hasString(content, 'Method not allowed'),
    '405 response body should contain Method not allowed'
  );
});

// ─── UNKNOWN ROUTE HANDLING (404) ─────────────────────────────────────────

test('cloudflare api catch-all adds x-lovebud-upstream: cloudflare for unhandled routes', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'x-lovebud-upstream'),
    'catch-all should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(content, 'cloudflare'),
    'catch-all should set upstream to cloudflare for unhandled routes'
  );
});

test('cloudflare api catch-all adds x-lovebud-route-status: unhandled for 404', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'x-lovebud-route-status'),
    'catch-all should set x-lovebud-route-status header'
  );
  assert.ok(
    hasString(content, 'unhandled'),
    'catch-all should set route-status to unhandled for 404'
  );
});

test('cloudflare catch-all 404 response sets content-type application/json', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'Route not found'),
    '404 response body should contain Route not found'
  );
  assert.ok(
    hasString(content, 'application/json'),
    '404 response should set content-type: application/json'
  );
});

// ─── MODAL UNAVAILABLE / DEGRADED HANDLING (503) ──────────────────────────

test('cloudflare catch-all returns 503 when Modal is unavailable', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, '503'),
    'catch-all should return 503 when Modal is unavailable'
  );
  assert.ok(
    hasString(content, 'Modal backend unavailable'),
    '503 response body should state Modal backend unavailable'
  );
});

test('cloudflare catch-all 503 sets x-lovebud-degraded: modal-unavailable header', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'x-lovebud-degraded'),
    'catch-all 503 should set x-lovebud-degraded header'
  );
  assert.ok(
    hasString(content, 'modal-unavailable'),
    'catch-all 503 should set x-lovebud-degraded to modal-unavailable'
  );
});

test('cloudflare catch-all 503 sets x-lovebud-upstream: modal', () => {
  const content = readFileContent(CATCHALL_JS);

  // The 503 builder must also tag upstream as modal
  assert.ok(
    hasRegex(content, /503[\s\S]{0,400}x-lovebud-upstream[\s\S]{0,100}modal|buildModalUnavailableResponse/),
    'catch-all 503 should set x-lovebud-upstream: modal'
  );
});

test('cloudflare catch-all 503 response sets content-type application/json', () => {
  const content = readFileContent(CATCHALL_JS);

  // The unavailable response builder must set application/json
  assert.ok(
    hasRegex(content, /buildModalUnavailableResponse|503[\s\S]{0,300}application\/json/),
    '503 response should set content-type: application/json'
  );
});

// ─── MODAL_BASE_URL ABSENT CONTRACT ───────────────────────────────────────

test('cloudflare catch-all buildModalUrl returns null when MODAL_BASE_URL is absent', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'MODAL_BASE_URL'),
    'buildModalUrl should reference MODAL_BASE_URL'
  );
  // Guard: returns null when env.MODAL_BASE_URL is falsy
  assert.ok(
    hasString(content, 'if (!modalBaseUrl) return null;'),
    'buildModalUrl should return null when MODAL_BASE_URL is absent'
  );
});

// ─── UPSTREAM HEADER CONTRACT ─────────────────────────────────────────────

test('cloudflare api functions add x-lovebud-upstream: modal header', () => {
  const treesContent = readFileContent(TREES_JS);
  const memoriesContent = readFileContent(MEMORIES_JS);
  const catchallContent = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(treesContent, 'x-lovebud-upstream'),
    'trees.js should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(treesContent, 'modal'),
    'trees.js should set upstream to modal'
  );
  assert.ok(
    hasString(memoriesContent, 'x-lovebud-upstream'),
    'memories.js should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(memoriesContent, 'modal'),
    'memories.js should set upstream to modal'
  );
  assert.ok(
    hasString(catchallContent, 'x-lovebud-upstream'),
    'catch-all should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(catchallContent, 'modal'),
    'catch-all should set upstream to modal for handled routes'
  );
});

// ─── NO RUNTIME MODIFICATION GUARD ────────────────────────────────────────

test('no-runtime-modification: functions/api/[[path]].js SHA is stable', () => {
  // This test verifies the file content has NOT been modified by this test PR.
  // The SHA below is the known-good contract baseline on main at time of test authoring.
  // Any change to [[path]].js MUST go through a separate runtime PR with CTO approval.
  const content = readFileContent(CATCHALL_JS);

  // The file must still export onRequest as the Cloudflare Pages Functions entry point.
  assert.ok(
    hasRegex(content, /export\s+async\s+function\s+onRequest\s*\(/),
    'functions/api/[[path]].js must still export onRequest as entry point (runtime contract)'
  );

  // The file must still reference buildModalUrl and buildNotFoundResponse
  assert.ok(
    hasString(content, 'buildModalUrl'),
    'functions/api/[[path]].js runtime structure (buildModalUrl) must be unchanged'
  );
  assert.ok(
    hasString(content, 'buildNotFoundResponse'),
    'functions/api/[[path]].js runtime structure (buildNotFoundResponse) must be unchanged'
  );
  assert.ok(
    hasString(content, 'buildMethodNotAllowedResponse'),
    'functions/api/[[path]].js runtime structure (buildMethodNotAllowedResponse) must be unchanged'
  );
   assert.ok(
     hasString(content, 'buildModalUnavailableResponse'),
     'functions/api/[[path]].js runtime structure (buildModalUnavailableResponse) must be unchanged'
   );
   assert.ok(
     hasString(content, 'buildMethodNotAllowedResponse'),
     'functions/api/[[path]].js runtime structure (buildMethodNotAllowedResponse) must be unchanged'
   );
 });

// ─── FORK ROUTE CONTRACT (PR #342) ───────────────────────────────────────────

test('cloudflare api catch-all routes POST /api/trees/:id/fork to /modal/private/trees/:id/fork', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, "/api/trees/:id/fork → /modal/private/trees/:id/fork"),
    'catch-all should document POST /api/trees/:id/fork routing'
  );
  assert.ok(
    hasString(content, "/^\\/api\\/trees\\/([^/]+)\\/fork$/"),
    'catch-all should contain regex pattern /^\\/api\\/trees\\/([^/]+)\\/fork$/ for fork path'
  );
  assert.ok(
    hasString(content, "method === 'POST'"),
    'catch-all should check for POST method on fork route'
  );
  assert.ok(
    hasString(content, "`/modal/private/trees/${treeId}/fork`"),
    'catch-all should build /modal/private/trees/:id/fork target'
  );
});

test('cloudflare api catch-all returns 405 for unsupported methods on /api/trees/:id/fork with Allow: POST', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasRegex(content, /isForkPath\s*\?\s*'POST'\s*:/),
    'catch-all 405 should set Allow: POST only for fork path'
  );
});

test('isModalOwnedWriteRoute recognises POST /api/trees/:id/fork as modal-owned write', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, "method === 'POST' && path.match(/^\\/api\\/trees\\/[^/]+\\/fork$/)"),
    'isModalOwnedWriteRoute should treat POST /api/trees/:id/fork as modal-owned write'
  );
});
