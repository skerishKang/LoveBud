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
const MEMORY_PROXY_JS = path.join(ROOT, 'functions/_shared/memory-route-proxy.js');

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

test('production public tree detail is not persisted in an explicit cache (Issue #3933)', () => {
  const content = readFileContent(TREE_DETAIL_JS);

  // The privacy-revocable Tree detail must not use explicit Cache API persistence:
  // a POP-local entry could keep serving a stale public body after revocation.
  assert.ok(
    !hasString(content, 'caches.default'),
    'trees/[id].js must not access the Cache API'
  );
  assert.ok(
    !hasString(content, '__cache/public/trees'),
    'trees/[id].js must not persist a Tree-detail cache key'
  );
  assert.ok(
    !hasString(content, 'max-age=30'),
    'trees/[id].js must not set a 30-second cache lifetime'
  );
  assert.ok(
    !hasString(content, 'x-lovebud-public-tree-cache-expires-at'),
    'trees/[id].js must not set the retired expiry header'
  );
  assert.ok(
    hasString(content, "headers.set('Cache-Control', 'no-store')"),
    'anonymous Tree detail responses must be no-store'
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
  const helper = readFileContent(MEMORY_PROXY_JS);

  assert.ok(
    hasString(content, 'proxyMemoryRouteRequest'),
    'memories.js should delegate to shared memory route proxy'
  );
  assert.ok(
    hasString(helper, '/modal/private/memories'),
    'shared memory route proxy should target /modal/private/memories'
  );
  assert.ok(
    hasString(helper, 'treeId'),
    'shared memory route proxy should handle treeId query parameter'
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
  const helper = readFileContent(MEMORY_PROXY_JS);

  assert.ok(
    hasString(content, 'buildMemoryModalUrl'),
    'catch-all buildModalUrl should delegate /api/memories to shared memory helper'
  );
  assert.ok(
    hasString(helper, '/modal/private/memories'),
    'shared memory helper should map /api/memories to /modal/private/memories'
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
  const helper = readFileContent(MEMORY_PROXY_JS);

  assert.ok(
    hasString(content, 'proxyMemoryRouteRequest'),
    'memory detail route should delegate writes to shared memory route proxy'
  );
  assert.ok(
    hasString(helper, '/modal/private/memories'),
    'shared memory route proxy should forward writes to /modal/private/memories/'
  );
  assert.ok(
    hasString(helper, 'method'),
    'shared memory route proxy should forward request method'
  );
  assert.ok(
    hasRegex(helper, /request\.headers\.get\('authorization'\)/),
    'shared memory route proxy should read and forward the authorization header'
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
  const helper = readFileContent(MEMORY_PROXY_JS);

  assert.ok(
    !hasString(content, 'authHeader && isWrite'),
    'memory route selection should not use authHeader && isWrite'
  );
  assert.ok(
    hasString(content, 'buildMemoryModalUrl'),
    'catch-all should delegate memory detail route selection to shared helper'
  );
  assert.ok(
    hasString(helper, '/modal/private/memories'),
    'shared helper should route memory write to private path'
  );
  assert.ok(
    hasString(helper, '/modal/memories'),
    'shared helper should route anonymous memory GET to public path'
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
  const memoryProxyContent = readFileContent(MEMORY_PROXY_JS);

  assert.ok(
    hasString(treesContent, 'x-lovebud-upstream'),
    'trees.js should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(treesContent, 'modal'),
    'trees.js should set upstream to modal'
  );
  assert.ok(
    hasString(memoriesContent, 'proxyMemoryRouteRequest'),
    'memories.js should delegate upstream header wrapping to shared memory proxy'
  );
  assert.ok(
    hasString(memoryProxyContent, 'x-lovebud-upstream') && hasString(memoryProxyContent, 'modal'),
    'shared memory proxy should set upstream to modal'
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

// ─── PRIVATE CAPABILITY ROUTE CONTRACTS ───────────────────────────────────

const TEST_HOST = 'https://test5.lovebud.pages.dev';
const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';

function mockFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: typeof url === 'string' ? url : url.toString(), options };
    calls.push(call);
    return handler(call, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function callOnRequest(request, envOverrides) {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;
  return onRequest({
    request,
    env: { MODAL_BASE_URL, ...envOverrides },
  });
}

test('1. authenticated GET /api/private/trees/:id/capability forwards to modal private capability', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ viewerCanEdit: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/private/trees/test-tree-123/capability`, {
      headers: { 'authorization': 'Bearer owner-token' }
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/modal/private/trees/test-tree-123/capability'));
    assert.equal(calls[0].options.headers.authorization, 'Bearer owner-token');

    const body = await response.json();
    assert.equal(body.viewerCanEdit, true);
  } finally {
    restore();
  }
});

test('2. unauthenticated GET /api/private/trees/:id/capability returns 401 without Modal fetch', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ error: 'Should not call modal' }), { status: 500 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/private/trees/test-tree-123/capability`, {
      method: 'GET'
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
    const body = await response.json();
    assert.equal(body.error, 'Authorization required');
  } finally {
    restore();
  }
});

test('3. capability route does not fall back to public trees route', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/private/trees/test-tree-123/capability`, {
      headers: { 'authorization': 'Bearer owner-token' }
    });
    const response = await callOnRequest(request);

    // Should return 404 from private path directly, no fallback to public mapping /modal/trees/
    assert.equal(response.status, 404);
    assert.equal(calls.length, 1);
    assert.ok(!calls[0].url.includes('/modal/trees/test-tree-123/capability'));
    assert.ok(calls[0].url.includes('/modal/private/trees/test-tree-123/capability'));
  } finally {
    restore();
  }
});

test('4. method non-GET on capability returns 405 Method Not Allowed with Allow: GET', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ error: 'Should not call modal' }), { status: 500 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/private/trees/test-tree-123/capability`, {
      method: 'POST',
      headers: { 'authorization': 'Bearer owner-token' }
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 405);
    assert.equal(calls.length, 0);
    assert.equal(response.headers.get('allow'), 'GET');
    const body = await response.json();
    assert.equal(body.error, 'Method not allowed');
  } finally {
    restore();
  }
});

// ─── HUB-LAYOUT SAME-ORIGIN GATEWAY CONTRACTS (Issue #3923) ────────────────
//
// Canonical same-origin method is PUT (historical #3058; gateway detail-update
// convention). Modal upstream exposes POST only, so the edge gateway translates
// PUT → POST. GET is also reachable (read). No direct browser→Modal.

test('cloudflare api catch-all routes /api/trees/:id/hub-layout to modal private hub-layout', () => {
  const content = readFileContent(CATCHALL_JS);

  // Mapping regex for the hub-layout sub-resource path.
  assert.ok(
    hasString(content, "/^\\/api\\/trees\\/([^/]+)\\/hub-layout$/"),
    'catch-all should contain regex pattern /^\\/api\\/trees\\/([^/]+)\\/hub-layout$/ for hub-layout path'
  );
  assert.ok(
    hasString(content, "`/modal/private/trees/${treeId}/hub-layout`"),
    'catch-all should build /modal/private/trees/:id/hub-layout target'
  );
});

test('isModalOwnedWriteRoute recognises PUT /api/trees/:id/hub-layout as modal-owned write', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, "method === 'PUT' && path.match(/^\\/api\\/trees\\/[^/]+\\/hub-layout$/)"),
    'isModalOwnedWriteRoute should treat PUT /api/trees/:id/hub-layout as modal-owned write'
  );
});

test('cloudflare api catch-all translates same-origin PUT hub-layout to Modal POST', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'const upstreamMethod = hubLayoutPath ? \'POST\' : method;'),
    'tryModalWrite should translate hub-layout PUT into upstream POST'
  );
});

test('cloudflare api catch-all 405 Allow header allows GET, PUT for hub-layout path', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasRegex(content, /isHubLayoutPath\s*\?\s*'GET, PUT'/),
    'catch-all 405 should set Allow: GET, PUT for hub-layout path'
  );
});

test('hub-layout 0. gateway auth-first blocks unauthenticated hub-layout GET before Modal fetch', () => {
  const content = readFileContent(CATCHALL_JS);

  assert.ok(
    hasString(content, 'isHubLayoutReadRequest'),
    'catch-all should define isHubLayoutReadRequest helper'
  );
  assert.ok(
    hasRegex(content, /isHubLayoutReadRequest\(request\)\s*&&\s*!hasAuthorizationHeader\(request\)/),
    'catch-all should auth-first block unauthenticated hub-layout read before tryModalRead'
  );
});

test('hub-layout 0b. unauthenticated GET /api/trees/test-tree-123/hub-layout returns 401 with zero Modal fetches', async () => {
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ error: 'Should not call modal' }), { status: 500 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'GET'
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
    const body = await response.json();
    assert.equal(body.error, 'Authorization required');
  } finally {
    restore();
  }
});

test('hub-layout 1. unauthenticated PUT returns 401 without Modal fetch', async () => {
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ error: 'Should not call modal' }), { status: 500 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ layoutMode: 'manual', manualPositions: {} })
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
    const body = await response.json();
    assert.equal(body.error, 'Authorization required');
  } finally {
    restore();
  }
});

test('hub-layout 2. authenticated PUT forwards to Modal POST with auth + request-id (translation)', async () => {
  const { calls, restore } = mockFetch(async (call) => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'PUT',
      headers: {
        'authorization': 'Bearer owner-token',
        'content-type': 'application/json',
        'x-lovebud-request-id': 'req-incoming-123'
      },
      body: JSON.stringify({ layoutMode: 'manual', manualPositions: { a: 1 } })
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/modal/private/trees/test-tree-123/hub-layout'));
    // PUT on same-origin must be translated to POST upstream.
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.authorization, 'Bearer owner-token');
    // Request-id preserved (parity) and exposed.
    assert.equal(calls[0].options.headers['x-lovebud-request-id'], 'req-incoming-123');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-incoming-123');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    const body = await response.json();
    assert.equal(body.ok, true);
  } finally {
    restore();
  }
});

test('hub-layout 3. authenticated GET forwards to Modal GET with auth', async () => {
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ layoutMode: 'auto', revision: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'GET',
      headers: { 'authorization': 'Bearer owner-token' }
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/modal/private/trees/test-tree-123/hub-layout'));
    // tryModalRead forwards a plain GET (fetch defaults to GET when method omitted).
    assert.ok(calls[0].options.method === undefined || calls[0].options.method === 'GET');
    assert.equal(calls[0].options.headers.authorization, 'Bearer owner-token');
  } finally {
    restore();
  }
});

test('hub-layout 4. stale baseRevision 409 from Modal is passed through truthfully', async () => {
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ error: 'stale baseRevision' }), {
      status: 409,
      headers: { 'content-type': 'application/json' }
    });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'PUT',
      headers: {
        'authorization': 'Bearer owner-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ layoutMode: 'manual', baseRevision: 2, manualPositions: {} })
    });
    const response = await callOnRequest(request);

    // No fake success: the upstream 409 conflict must be returned as-is.
    assert.equal(response.status, 409);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'POST');
    const body = await response.json();
    assert.equal(body.error, 'stale baseRevision');
  } finally {
    restore();
  }
});

test('hub-layout 5. unsupported POST method returns 405 with Allow: GET, PUT', async () => {
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ error: 'Should not call modal' }), { status: 500 });
  });

  try {
    const request = new Request(`${TEST_HOST}/api/trees/test-tree-123/hub-layout`, {
      method: 'POST',
      headers: { 'authorization': 'Bearer owner-token', 'content-type': 'application/json' },
      body: JSON.stringify({ layoutMode: 'manual' })
    });
    const response = await callOnRequest(request);

    assert.equal(response.status, 405);
    assert.equal(calls.length, 0);
    assert.equal(response.headers.get('allow'), 'GET, PUT');
    const body = await response.json();
    assert.equal(body.error, 'Method not allowed');
  } finally {
    restore();
  }
});

// ─── TREE UPDATE DIRECT-NEON CONTRACTS (#4228) ────────────────────────────

const TREE_UPDATE_MODULE = '../../functions/_shared/tree-update-direct-neon.js';
const TREE_DETAIL_ROUTE = '../../functions/api/trees/[id].js';
const TREE_UPDATE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TREE_UPDATE_OWNER = 'firebase-owner-4228';
const TREE_UPDATE_NEON_URL = 'postgresql://ep-tree-update-4228.us-east-1.aws.neon.tech/neondb?sslmode=require';
const TREE_UPDATE_ENV = {
  LB_TREE_UPDATE_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: TREE_UPDATE_NEON_URL
};

function makeTreeUpdateRequest({ body = {}, authorization = 'Bearer verified-token', headers = {} } = {}) {
  const requestHeaders = new Headers({ 'content-type': 'application/json', ...headers });
  if (authorization) requestHeaders.set('authorization', authorization);
  return new Request(`${TEST_HOST}/api/trees/${TREE_UPDATE_ID}`, {
    method: 'PUT',
    headers: requestHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

function makeTreeUpdateCanonicalRow(overrides = {}) {
  return {
    id: TREE_UPDATE_ID,
    owner_id: TREE_UPDATE_OWNER,
    title: 'Updated Tree',
    visibility: 'public',
    group_name: 'Group A',
    keywords: ['alpha', 'beta'],
    created_at: '2026-08-26 01:02:03.123456+00:00',
    updated_at: '2026-08-26 02:03:04.654321+00:00',
    memory_count: 2,
    ...overrides
  };
}

function makeTreeUpdateFakeAdapter({
  ownerRow = { id: TREE_UPDATE_ID, owner_id: TREE_UPDATE_OWNER },
  updateRows = [{ id: TREE_UPDATE_ID }],
  capabilities = { has_social_counts: false, has_like_count: false, has_view_count: false },
  canonicalRow = makeTreeUpdateCanonicalRow()
} = {}) {
  const events = [];
  let runCount = 0;
  const adapter = {
    async runTransaction(work) {
      runCount += 1;
      const tx = {
        async query(text, values = []) {
          events.push({ type: 'query', text, values: [...values] });
          if (text.includes('SELECT id::text AS id, owner_id::text AS owner_id')) {
            return ownerRow ? [ownerRow] : [];
          }
          if (text.includes('UPDATE trees')) return updateRows;
          if (text.includes('information_schema.tables')) return [capabilities];
          throw new Error(`unexpected fake query: ${text}`);
        },
        async canonicalReread(text, values = []) {
          events.push({ type: 'canonicalReread', text, values: [...values] });
          return canonicalRow ? [canonicalRow] : [];
        }
      };
      const value = await work(tx);
      events.push({ type: 'commit' });
      return { value };
    }
  };
  return { adapter, events, getRunCount: () => runCount };
}

async function loadTreeUpdateModule() {
  return import(TREE_UPDATE_MODULE);
}

test('#4228 gate and dedicated writer config stay bounded', async () => {
  const mod = await loadTreeUpdateModule();
  assert.equal(mod.isTreeUpdateDirectNeonSelected({}), false);
  assert.equal(mod.isTreeUpdateDirectNeonSelected({ LB_TREE_UPDATE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isTreeUpdateDirectNeonSelected({ LB_TREE_UPDATE_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isTreeUpdateDirectNeonSelected({ LB_TREE_UPDATE_WRITE_RUNTIME: ' direct_neon ' }), true);
  assert.equal(mod.readTreeUpdateWriteConfig(TREE_UPDATE_ENV).configured, true);
  assert.equal(mod.readTreeUpdateWriteConfig({
    LB_TREE_UPDATE_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: TREE_UPDATE_NEON_URL
  }).configured, false);
  assert.equal(
    mod.detectTreeUpdateForbiddenWriterFallback({ LOVE_PLATFORM_DATABASE_URL: TREE_UPDATE_NEON_URL }).name,
    'LOVE_PLATFORM_DATABASE_URL'
  );
});

test('#4228 missing/invalid Firebase auth fails before transaction capability', async () => {
  const mod = await loadTreeUpdateModule();
  const fake = makeTreeUpdateFakeAdapter();
  const missing = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ authorization: null }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-auth-a',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: fake.adapter }
  );
  assert.equal(missing.status, 401);
  assert.equal(fake.getRunCount(), 0);

  const invalid = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest(),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-auth-b',
    { verifyTokenOverride: async () => null, transactionAdapterOverride: fake.adapter }
  );
  assert.equal(invalid.status, 401);
  assert.equal(fake.getRunCount(), 0);
});

test('#4228 explicit private visibility defers to Modal before direct DB transaction', async () => {
  const mod = await loadTreeUpdateModule();
  const fake = makeTreeUpdateFakeAdapter();
  const response = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { visibility: 'private', title: 'Still Modal' } }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-private',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: fake.adapter }
  );
  assert.equal(response, null);
  assert.equal(fake.getRunCount(), 0, 'private entitlement path acquires no direct transaction');
  assert.equal(fake.events.length, 0);
});

test('#4228 Modal ordering is preserved: owner check precedes empty/unsupported payload validation', async () => {
  const mod = await loadTreeUpdateModule();

  const foreign = makeTreeUpdateFakeAdapter({
    ownerRow: { id: TREE_UPDATE_ID, owner_id: 'someone-else' }
  });
  const foreignResponse = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { zzz: 1 } }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-owner',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: foreign.adapter }
  );
  assert.equal(foreignResponse.status, 403);
  assert.equal((await foreignResponse.json()).detail, 'Access denied: not your tree');
  assert.equal(foreign.events.filter((event) => event.text && event.text.includes('UPDATE trees')).length, 0);

  const empty = makeTreeUpdateFakeAdapter();
  const emptyResponse = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: {} }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-empty',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: empty.adapter }
  );
  assert.equal(emptyResponse.status, 400);
  assert.deepEqual((await emptyResponse.json()).detail, { code: 'EMPTY_TREE_UPDATE' });
  assert.ok(empty.events[0].text.includes('SELECT id::text AS id'));

  const unknown = makeTreeUpdateFakeAdapter();
  const unknownResponse = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { zzz: 1, title: 'x', aaa: 2 } }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-unknown',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: unknown.adapter }
  );
  assert.equal(unknownResponse.status, 400);
  assert.deepEqual((await unknownResponse.json()).detail, {
    code: 'UNSUPPORTED_TREE_UPDATE_FIELDS',
    fields: ['aaa', 'zzz']
  });
  assert.equal(unknown.events.filter((event) => event.text && event.text.includes('UPDATE trees')).length, 0);
});

test('#4228 strict Tree field validation rejects malformed input before UPDATE', async () => {
  const mod = await loadTreeUpdateModule();
  const cases = [
    [{ title: 42 }, { code: 'INVALID_TREE_SCALAR_TYPE', field: 'title', expected: 'string' }],
    [{ groupName: true }, { code: 'INVALID_TREE_SCALAR_TYPE', field: 'groupName', expected: 'string' }],
    [{ visibility: 'PRIVATE' }, 'visibility: public, private'],
    [{ keywords: 'not-array' }, 'keywords must be an array'],
    [{ keywords: ['ok', 7] }, 'each keyword must be a string'],
    [{ keywords: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'keywords exceeds max 5']
  ];

  for (const [payload, expectedDetail] of cases) {
    const fake = makeTreeUpdateFakeAdapter();
    const response = await mod.handleTreeUpdateDirectNeon(
      makeTreeUpdateRequest({ body: payload }),
      TREE_UPDATE_ID,
      TREE_UPDATE_ENV,
      'rid-4228-validation',
      { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: fake.adapter }
    );
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.deepEqual((await response.json()).detail, expectedDetail, JSON.stringify(payload));
    assert.equal(fake.events.filter((event) => event.text && event.text.includes('UPDATE trees')).length, 0);
  }
});

test('#4228 happy path uses verified owner predicate and returns canonical DB reread', async () => {
  const mod = await loadTreeUpdateModule();
  const fake = makeTreeUpdateFakeAdapter({
    canonicalRow: makeTreeUpdateCanonicalRow({
      title: 'Updated Tree',
      group_name: 'Group A',
      keywords: ['alpha', 'beta']
    })
  });
  const request = makeTreeUpdateRequest({
    body: {
      title: '  Updated Tree  ',
      groupName: '  Group A  ',
      keywords: [' alpha ', 'alpha', 'beta']
    },
    headers: { 'x-owner-id': 'attacker-owner' }
  });
  const response = await mod.handleTreeUpdateDirectNeon(
    request,
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-happy',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: fake.adapter }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const dto = await response.json();
  assert.equal(dto.ownerId, TREE_UPDATE_OWNER);
  assert.equal(dto.title, 'Updated Tree');
  assert.equal(dto.groupName, 'Group A');
  assert.deepEqual(dto.keywords, ['alpha', 'beta']);
  assert.equal(dto.memoryCount, 2);
  assert.equal(dto.createdAt, '2026-08-26T01:02:03.123456+00:00');
  assert.equal(dto.updatedAt, '2026-08-26T02:03:04.654321+00:00');

  const ownerIndex = fake.events.findIndex((event) => event.text && event.text.includes('SELECT id::text AS id, owner_id::text AS owner_id'));
  const updateIndex = fake.events.findIndex((event) => event.text && event.text.includes('UPDATE trees'));
  const capabilityIndex = fake.events.findIndex((event) => event.text && event.text.includes('information_schema.tables'));
  const rereadIndex = fake.events.findIndex((event) => event.type === 'canonicalReread');
  const commitIndex = fake.events.findIndex((event) => event.type === 'commit');
  assert.ok(ownerIndex >= 0 && ownerIndex < updateIndex);
  assert.ok(updateIndex < capabilityIndex);
  assert.ok(capabilityIndex < rereadIndex);
  assert.ok(rereadIndex < commitIndex);

  const updateEvent = fake.events[updateIndex];
  assert.match(updateEvent.text, /WHERE id = \$4\s+AND owner_id = \$5/);
  assert.deepEqual(updateEvent.values, [
    'Updated Tree',
    'Group A',
    ['alpha', 'beta'],
    TREE_UPDATE_ID,
    TREE_UPDATE_OWNER
  ]);
});

test('#4228 canonical UUID and missing/foreign targets fail without mutation', async () => {
  const mod = await loadTreeUpdateModule();
  const invalidFake = makeTreeUpdateFakeAdapter();
  const invalid = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { title: 'x' } }),
    '%ZZ',
    TREE_UPDATE_ENV,
    'rid-4228-invalid-id',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: invalidFake.adapter }
  );
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).detail, 'Invalid treeId');
  assert.equal(invalidFake.getRunCount(), 0);

  const missingFake = makeTreeUpdateFakeAdapter({ ownerRow: null });
  const missing = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { title: 'x' } }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-missing',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: missingFake.adapter }
  );
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).detail, 'Tree not found');
  assert.equal(missingFake.events.filter((event) => event.text && event.text.includes('UPDATE trees')).length, 0);
});

test('#4228 direct config absence fails closed after auth with no transaction and no Modal fallback', async () => {
  const mod = await loadTreeUpdateModule();
  const fake = makeTreeUpdateFakeAdapter();
  const response = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { title: 'x' } }),
    TREE_UPDATE_ID,
    { LB_TREE_UPDATE_WRITE_RUNTIME: 'direct_neon', LOVE_PLATFORM_DATABASE_URL: TREE_UPDATE_NEON_URL },
    'rid-4228-config',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: fake.adapter }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_ABSENT');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(fake.getRunCount(), 0);
});

test('#4228 explicit unknown COMMIT outcome is bounded and never retried', async () => {
  const mod = await loadTreeUpdateModule();
  const txMod = await import('../../functions/_shared/db/neon-ws-transaction-adapter.js');
  const fake = makeTreeUpdateFakeAdapter();
  let attempts = 0;
  const ambiguousAdapter = {
    async runTransaction(work) {
      attempts += 1;
      await fake.adapter.runTransaction(work);
      throw new txMod.NeonWsTransactionError(
        txMod.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
        'commit outcome unknown',
        { status: 502 }
      );
    }
  };
  const response = await mod.handleTreeUpdateDirectNeon(
    makeTreeUpdateRequest({ body: { title: 'Updated Tree' } }),
    TREE_UPDATE_ID,
    TREE_UPDATE_ENV,
    'rid-4228-commit',
    { verifyTokenOverride: async () => ({ uid: TREE_UPDATE_OWNER }), transactionAdapterOverride: ambiguousAdapter }
  );
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(attempts, 1);
});

test('#4228 route wiring keeps unset PUT and DELETE on Modal, and writer gate is PUT-only', async () => {
  const route = await import(TREE_DETAIL_ROUTE);
  const { calls, restore } = mockFetch(async () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  try {
    const put = await route.onRequestPut({
      request: makeTreeUpdateRequest({ body: { title: 'Modal title' } }),
      params: { id: TREE_UPDATE_ID },
      env: { MODAL_BASE_URL }
    });
    assert.equal(put.status, 200);
    assert.equal(put.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'PUT');

    const del = await route.onRequestDelete({
      request: new Request(`${TEST_HOST}/api/trees/${TREE_UPDATE_ID}`, {
        method: 'DELETE',
        headers: { authorization: 'Bearer owner-token' }
      }),
      params: { id: TREE_UPDATE_ID },
      env: { MODAL_BASE_URL, LB_TREE_UPDATE_WRITE_RUNTIME: 'direct_neon' }
    });
    assert.equal(del.status, 200);
    assert.equal(del.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(calls.length, 2, 'DELETE remains Modal even when Tree-update gate is direct');
    assert.equal(calls[1].options.method, 'DELETE');
  } finally {
    restore();
  }
});

test('#4228 route source dispatches direct Tree update before Modal config while GET/DELETE ignore the gate', () => {
  const content = readFileContent(TREE_DETAIL_JS);
  const putStart = content.indexOf('export async function onRequestPut');
  const deleteStart = content.indexOf('export async function onRequestDelete');
  assert.ok(putStart >= 0 && deleteStart > putStart);
  const putBlock = content.slice(putStart, deleteStart);
  const deleteBlock = content.slice(deleteStart);
  assert.ok(putBlock.includes('isTreeUpdateDirectNeonSelected(context.env)'));
  assert.ok(putBlock.includes('handleTreeUpdateDirectNeon('));
  assert.ok(
    putBlock.indexOf('handleTreeUpdateDirectNeon(') < putBlock.indexOf('MODAL_BASE_URL'),
    'direct dispatch must happen before Modal config requirement'
  );
  assert.ok(!deleteBlock.includes('isTreeUpdateDirectNeonSelected'));
  assert.ok(!deleteBlock.includes('handleTreeUpdateDirectNeon'));
});

test('#4228 contract metadata pins PUT-only, Firebase owner, no retries and no Production cutover', async () => {
  const mod = await loadTreeUpdateModule();
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.method, 'PUT');
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.gateEnv, 'LB_TREE_UPDATE_WRITE_RUNTIME');
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.databaseEnv, 'LOVE_PLATFORM_WRITE_DATABASE_URL');
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.ownerAuthority, 'verified-firebase-legacyOwnerId');
  assert.deepEqual([...mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.allowedFields], ['title', 'visibility', 'groupName', 'keywords']);
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.explicitPrivate, 'modal-before-direct-db');
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.getUnchanged, true);
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.deleteUnchanged, true);
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.perRequestModalFallbackAfterDirectStart, false);
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(mod.TREE_UPDATE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);
});
