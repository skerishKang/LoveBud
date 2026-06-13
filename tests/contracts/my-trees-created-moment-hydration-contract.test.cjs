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

test('My Trees appreciation hub does not show an empty-state contradiction for non-empty trees', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.match(source, /patchHubForCreatedMoments/, 'must patch hub rendering after a tree is selected');
  assert.match(source, /memoryCount <= 0/, 'must keep the real empty-tree path separate');
  assert.match(source, /noMoments\.hidden = true/, 'must hide no-moments UI when created moments are known');
  assert.match(source, /개의 순간이 있어요/, 'must use count-aware copy when only the count is known');
  assert.doesNotMatch(source, /아직 대표 순간이 남아 있지 않아요[\s\S]*memoryCount > 0/, 'must not couple nonzero count to the old empty representative copy');
});

test('My Trees hydration remains frontend-only and avoids live/feed/provider expansion', () => {
  const source = fs.readFileSync(previewStatePath, 'utf8');

  assert.doesNotMatch(source, /fetch\s*\(/, 'must not add direct network fetch calls');
  assert.doesNotMatch(source, /XMLHttpRequest/, 'must not add raw XHR calls');
  assert.doesNotMatch(source, /YouTube\s*API|youtube\.googleapis|googleapis\.com\/youtube/i, 'must not add YouTube API/feed calls');
  assert.doesNotMatch(source, /Scout|provider|LLM|AI/i, 'must not add Scout/provider/AI behavior');
  assert.doesNotMatch(source, /CREATE\s+TABLE|ALTER\s+TABLE|migration/i, 'must not add schema or migration work');
});
