const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('public viewer reaction summary boundary stays read-only', () => {
  const start = source.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const end = source.indexOf('function createPublicViewerDetailUI(deps)');
  const boundary = source.slice(start, end);

  assert.notEqual(start, -1, 'read-only reaction boundary exists');
  assert.notEqual(end, -1, 'public detail factory follows reaction boundary');
  assert.ok(boundary.includes('likeBtn.onclick = null'), 'like button handler is cleared');
  assert.ok(boundary.includes('commentBtn) commentBtn.onclick = null'), 'comment button handler is cleared');
  assert.equal(boundary.includes('toggleReaction'), false, 'public viewer does not call toggleReaction');
  assert.equal(boundary.includes('from=editor'), false, 'public viewer does not use editor comment context');
});

test('public viewer reaction summary runs after other detail post-processing', () => {
  const delegatedIndex = source.indexOf('delegatedUpdateDetailPanel(data);');
  const memoIndex = source.indexOf('updateMemoBody(data);');
  const tagsIndex = source.indexOf('updateCurrentMomentTags(data);');
  const reactionsIndex = source.indexOf('updateReadOnlyReactionSummary(data);');

  assert.notEqual(delegatedIndex, -1, 'delegated render exists');
  assert.notEqual(memoIndex, -1, 'memo post-processing exists');
  assert.notEqual(tagsIndex, -1, 'tags post-processing exists');
  assert.notEqual(reactionsIndex, -1, 'reaction post-processing exists');
  assert.ok(delegatedIndex < reactionsIndex, 'reaction summary follows delegated render');
  assert.ok(memoIndex < reactionsIndex, 'reaction summary follows memo post-processing');
  assert.ok(tagsIndex < reactionsIndex, 'reaction summary follows tag post-processing');
});
