const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const previewStatePath = 'js/my-trees/my-trees-preview-state.js';

test('My Trees preview state hydrates created moment metadata before rendering cards', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.match(source, /hydrateTreesWithCreatedMoments/, 'must expose a created-moment hydration helper');
  assert.match(source, /patchDataLoader\(window\.LoveBudMyTreesData\)/, 'must patch the My Trees data loader');
  assert.match(source, /apiClient\.getMemoriesByTree/, 'must reuse existing getMemoriesByTree data instead of inventing new APIs');
  assert.match(source, /representativeThumbnail/, 'must derive a representative thumbnail from created moments');
  assert.match(source, /representativeTitle/, 'must derive a representative title from created moments');
  assert.match(source, /representativeMemo/, 'must derive representative memo text from created moments');
  assert.match(source, /hydratedTreesById/, 'must retain hydrated trees for selected-card hub repair');
});

test('My Trees hydration bypasses stale empty memory caches for non-empty trees', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.match(source, /function shouldUseCachedMemories/, 'must centralize cache trust rules');
  assert.match(source, /cachedMemories\.length > 0/, 'non-empty cached memories may be reused');
  assert.match(source, /getTreeMomentCount\(tree\) <= 0/, 'empty cached memories may be reused only for trees still known to be empty');
  assert.match(source, /shouldUseCachedMemories\(tree, cachedMemories\)/, 'hydrate path must not trust all cached arrays blindly');
});

test('My Trees hydration skips public demo ids before private memory API calls', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');
  const publicDemoSkipIndex = source.indexOf("String(treeId).trim().toLowerCase().indexOf('public-') === 0");
  const apiCallIndex = source.indexOf('window.apiClient.getMemoriesByTree(treeId)');

  assert.ok(publicDemoSkipIndex > -1, 'must detect public demo tree ids in the hydration guard');
  assert.ok(apiCallIndex > -1, 'must keep normal private tree memory hydration path');
  assert.ok(publicDemoSkipIndex < apiCallIndex, 'public demo ids must be skipped before calling the private memories API');
});

test('My Trees appreciation hub does not show an empty-state contradiction for non-empty trees', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.match(source, /patchHubForCreatedMoments/, 'must patch hub rendering after a tree is selected');
  assert.match(source, /memoryCount <= 0/, 'must keep the real empty-tree path separate');
  assert.match(source, /noMoments\.hidden = true/, 'must hide no-moments UI when created moments are known');
  assert.match(source, /개의 순간이 있어요/, 'must use count-aware copy when only the count is known');
  assert.doesNotMatch(source, /아직 대표 순간이 남아 있지 않아요[\s\S]*memoryCount > 0/, 'must not couple nonzero count to the old empty representative copy');
});

test('My Trees hydration remains frontend-only and avoids live/feed expansion', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.doesNotMatch(source, /fetch\s*\(/, 'must not add direct network fetch calls');
  assert.doesNotMatch(source, /XMLHttpRequest/, 'must not add raw XHR calls');
  assert.doesNotMatch(source, /YouTube\s*API|youtube\.googleapis|googleapis\.com\/youtube/i, 'must not add YouTube API/feed calls');
  assert.doesNotMatch(source, /\bScout\b|\bLLM\b/, 'must not add unrelated assistant behavior');
  assert.doesNotMatch(source, /CREATE\s+TABLE|ALTER\s+TABLE|migration/i, 'must not add schema or migration work');
});
