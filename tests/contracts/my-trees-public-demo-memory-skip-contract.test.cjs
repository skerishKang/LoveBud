const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const POSTGRES_CLIENT_PATH = path.join(ROOT, 'js', 'postgres-client.js');
const MY_TREES_PREVIEW_STATE_PATH = path.join(ROOT, 'js', 'my-trees', 'my-trees-preview-state.js');

function readPostgresClient() {
  return fs.readFileSync(POSTGRES_CLIENT_PATH, 'utf8');
}

function readMyTreesPreviewState() {
  return fs.readFileSync(MY_TREES_PREVIEW_STATE_PATH, 'utf8');
}

test('my-trees preview state defines a private public-demo tree id guard', () => {
  const source = readMyTreesPreviewState();

  assert.ok(source.includes('function isPublicDemoTreeId(treeId)'));
  assert.ok(source.includes("var value = String(treeId || '').trim().toLowerCase();"));
  assert.ok(source.includes("value.indexOf('public-') !== 0"));
});

test('my-trees preview hydration skips the private memories API for public demo ids', () => {
  const source = readMyTreesPreviewState();
  const existingMemoriesIndex = source.indexOf('var existingMemories = getMemoryList(tree);');
  const cacheIndex = source.indexOf('var cachedMemories = readTreeMemoriesCache(treeId);');
  const guardIndex = source.indexOf('if (isPublicDemoTreeId(treeId))');
  const emptyReturnIndex = source.indexOf('return deriveCreatedMomentMeta(tree, []);', guardIndex);
  const apiFetchIndex = source.indexOf('window.apiClient.getMemoriesByTree(treeId)', guardIndex);

  assert.ok(existingMemoriesIndex > -1, 'expected embedded memories to be checked first');
  assert.ok(cacheIndex > existingMemoriesIndex, 'expected cache to remain before public-demo skip');
  assert.ok(guardIndex > cacheIndex, 'expected public-demo guard after embedded/cache checks');
  assert.ok(emptyReturnIndex > guardIndex, 'expected public-demo guard to return empty memory metadata');
  assert.ok(apiFetchIndex > emptyReturnIndex, 'expected private memories API call to remain after the guard');
});

test('postgres client still preserves normal private tree memory endpoint shape', () => {
  const source = readPostgresClient();

  assert.ok(!source.includes('function isPublicDemoTreeId(treeId)'));
  assert.ok(source.includes('getMemoriesByTree: async (treeId) => BaseApiFetch.apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`)'));
});
