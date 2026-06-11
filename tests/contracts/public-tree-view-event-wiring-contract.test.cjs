const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const viewer = fs.readFileSync(path.join(ROOT, 'js', 'viewer', 'public-tree-viewer.js'), 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');

function getFunctionBlock(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} function must exist`);
  const nextFunction = source.indexOf('\n    function ', start + 1);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}

test('public tree viewer records view event only after successful detail render', () => {
  assert.match(viewer, /const\s+VIEW_ACTOR_KEY_STORAGE\s*=\s*'lovebud_public_tree_view_actor_key_v1'/);
  assert.match(viewer, /let\s+viewEventSentForTreeId\s*=\s*null/);

  const initViewer = getFunctionBlock(viewer, 'initViewer');
  assert.match(initViewer, /const\s+memories\s*=\s*await\s+loadPublicMemories\(treeId\)/);
  assert.match(initViewer, /if\s*\(!memories\s*\|\|\s*memories\.length\s*===\s*0\)\s*\{[\s\S]*renderEmpty\(\);[\s\S]*return;/);
  assert.match(initViewer, /renderTree\(\);/);
  assert.match(initViewer, /renderPreview\(\);/);
  assert.match(initViewer, /recordPublicTreeView\(treeId\);/);
});

test('public tree viewer uses privacy-preserving anonymous actor key', () => {
  assert.match(viewer, /function\s+createRandomViewActorKey\(/);
  assert.match(viewer, /crypto\.randomUUID/);
  assert.match(viewer, /anon-/);
  assert.match(viewer, /window\.localStorage\?\.getItem\(VIEW_ACTOR_KEY_STORAGE\)/);
  assert.match(viewer, /window\.localStorage\?\.setItem\(VIEW_ACTOR_KEY_STORAGE,\s*created\)/);
  assert.doesNotMatch(viewer, /userAgent/);
  assert.doesNotMatch(viewer, /document\.cookie/);
  assert.doesNotMatch(viewer, /navigator\.platform/);
  assert.doesNotMatch(viewer, /fingerprint/i);
  assert.doesNotMatch(viewer, /referrer/i);
});

test('public tree viewer sends public_tree_detail event once per loaded tree', () => {
  const recordBlock = getFunctionBlock(viewer, 'recordPublicTreeView');

  assert.match(recordBlock, /if\s*\(!treeId\s*\|\|\s*viewEventSentForTreeId\s*===\s*treeId\)\s*return/);
  assert.match(recordBlock, /viewEventSentForTreeId\s*=\s*treeId/);
  assert.match(recordBlock, /actorKind:\s*'anonymous'/);
  assert.match(recordBlock, /source:\s*'public_tree_detail'/);
  assert.match(recordBlock, /fetch\(buildTreeViewEndpoint\(treeId\),\s*\{/);
  assert.match(recordBlock, /method:\s*'POST'/);
  assert.match(recordBlock, /keepalive:\s*true/);
  assert.match(recordBlock, /\.catch\(\(error\)\s*=>\s*\{/);
});

test('public tree view event endpoint is not wired to Browse or Search sort', () => {
  const endpointBlock = getFunctionBlock(viewer, 'buildTreeViewEndpoint');
  assert.match(endpointBlock, /'\/api\/trees\/'\s*\+/);
  assert.match(endpointBlock, /encodeURIComponent\(treeId\)/);
  assert.match(endpointBlock, /\+\s*'\/views'/);
  assert.match(catchAllRoute, /searchParams\.get\('sort'\) === 'popular' \? 'popular' : 'latest'/);
  assert.doesNotMatch(catchAllRoute, /sort'\) === 'views'/);
  assert.doesNotMatch(catchAllRoute, /sort'\) === 'likes'/);
  assert.doesNotMatch(browseSnapshot, /"viewCount"/);
});
