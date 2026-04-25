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

// Cloudflare Functions 파일 경로
const TREES_JS = path.join(ROOT, 'functions/api/trees.js');
const MEMORIES_JS = path.join(ROOT, 'functions/api/memories.js');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');

test('cloudflare api functions files exist', () => {
  assert.ok(fs.existsSync(TREES_JS), 'functions/api/trees.js should exist');
  assert.ok(fs.existsSync(MEMORIES_JS), 'functions/api/memories.js should exist');
  assert.ok(fs.existsSync(CATCHALL_JS), 'functions/api/[[path]].js should exist');
});

test('cloudflare api trees.js routes to modal/private/trees', () => {
  const content = readFileContent(TREES_JS);
  
  // GET/POST가 /modal/private/trees로 매핑되는지 확인
  assert.ok(
    hasString(content, '/modal/private/trees'),
    'trees.js should proxy to /modal/private/trees'
  );
});

test('cloudflare api memories.js routes to modal/private/memories', () => {
  const content = readFileContent(MEMORIES_JS);
  
  // GET/POST가 /modal/private/memories로 매핑되는지 확인
  assert.ok(
    hasString(content, '/modal/private/memories'),
    'memories.js should proxy to /modal/private/memories'
  );
  
  // treeId query forwarding 확인
  assert.ok(
    hasString(content, 'treeId'),
    'memories.js should handle treeId query parameter'
  );
});

test('cloudflare api catch-all routes community/trees?view=summary to modal/browse/latest', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // /api/community/trees?view=summary 매핑 확인
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
  
  // /api/community/growing-trees 매핑 확인
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
  
  // /api/community/memories 매핑 확인
  assert.ok(
    hasString(content, '/api/community/memories'),
    'catch-all should handle /api/community/memories'
  );
  assert.ok(
    hasString(content, '/modal/community/memories'),
    'catch-all should route to /modal/community/memories'
  );
});

test('cloudflare api catch-all routes trees/:treeId with auth split', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // /api/trees 패턴 확인
  assert.ok(
    hasString(content, '/api/trees'),
    'catch-all should handle /api/trees path'
  );
  
  // 인증 있음: /modal/private/trees/:treeId
  assert.ok(
    hasString(content, '/modal/private/trees/'),
    'catch-all should route to /modal/private/trees/ with auth'
  );
  
  // 인증 없음: /modal/trees/:treeId
  assert.ok(
    hasString(content, '/modal/trees/'),
    'catch-all should route to /modal/trees/ without auth'
  );
  
  // authorization header 확인
  assert.ok(
    hasString(content, 'authorization'),
    'catch-all should check authorization header'
  );
});

test('cloudflare api catch-all routes memories/:memoryId to modal/memories/:memoryId', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // /api/memories 패턴 확인
  assert.ok(
    hasString(content, '/api/memories'),
    'catch-all should handle /api/memories path'
  );
  
  // /modal/memories/:memoryId 매핑 확인
  assert.ok(
    hasString(content, '/modal/memories/'),
    'catch-all should route to /modal/memories/'
  );
});

test('cloudflare api functions add x-lovebud-upstream: modal header', () => {
  const treesContent = readFileContent(TREES_JS);
  const memoriesContent = readFileContent(MEMORIES_JS);
  const catchallContent = readFileContent(CATCHALL_JS);
  
  // trees.js
  assert.ok(
    hasString(treesContent, "x-lovebud-upstream"),
    'trees.js should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(treesContent, "modal"),
    'trees.js should set upstream to modal'
  );
  
  // memories.js
  assert.ok(
    hasString(memoriesContent, "x-lovebud-upstream"),
    'memories.js should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(memoriesContent, "modal"),
    'memories.js should set upstream to modal'
  );
  
  // [[path]].js
  assert.ok(
    hasString(catchallContent, "x-lovebud-upstream"),
    'catch-all should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(catchallContent, "modal"),
    'catch-all should set upstream to modal for handled routes'
  );
});

test('cloudflare api catch-all adds cloudflare upstream for unhandled routes', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // unhandled route에 x-lovebud-upstream: cloudflare
  assert.ok(
    hasString(content, "x-lovebud-upstream"),
    'catch-all should set x-lovebud-upstream header'
  );
  assert.ok(
    hasString(content, "cloudflare"),
    'catch-all should set upstream to cloudflare for unhandled routes'
  );
});

test('cloudflare api catch-all adds unhandled status for 404', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // x-lovebud-route-status: unhandled
  assert.ok(
    hasString(content, "x-lovebud-route-status"),
    'catch-all should set x-lovebud-route-status header'
  );
  assert.ok(
    hasString(content, "unhandled"),
    'catch-all should set route-status to unhandled for 404'
  );
});

test('cloudflare api catch-all returns 405 for unsupported methods on handled routes', () => {
  const content = readFileContent(CATCHALL_JS);
  
  // 405 status
  assert.ok(
    hasString(content, "405"),
    'catch-all should return 405 for unsupported methods'
  );
  
  // allow: GET header
  assert.ok(
    hasString(content, "allow"),
    'catch-all should set allow header'
  );
  assert.ok(
    hasString(content, "GET"),
    'catch-all should allow GET method'
  );
  
  // method-not-allowed status
  assert.ok(
    hasString(content, "method-not-allowed"),
    'catch-all should set route-status to method-not-allowed'
  );
});