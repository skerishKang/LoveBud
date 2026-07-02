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
  assert.equal(boundary.includes('onclick = null'), false, 'public viewer does not clear button handlers');
  assert.equal(boundary.includes('.disabled'), false, 'public viewer does not depend on disabled button state');
  assert.equal(boundary.includes('aria-disabled'), false, 'public viewer does not depend on aria-disabled button state');
  assert.equal(boundary.includes('toggleReaction'), false, 'public viewer does not call toggleReaction');
  assert.equal(boundary.includes('fetch('), false, 'public viewer reaction boundary does not add mutation fetches');
  assert.equal(boundary.includes('from=editor'), false, 'public viewer does not use editor comment context');
});

test('public viewer reaction summary runs after memo and tags post-processing', () => {
  const headingCallRaw = source.indexOf('updateDetailHeading();');
  const realFlowSlice = source.slice(headingCallRaw);

  const memoIndex = realFlowSlice.indexOf('updateMemoBody(data);');
  const tagsIndex = realFlowSlice.indexOf('updateCurrentMomentTags(data);');
  const reactionsIndex = realFlowSlice.indexOf('updateReadOnlyReactionSummary(data);');

  assert.notEqual(memoIndex, -1, 'memo post-processing exists');
  assert.notEqual(tagsIndex, -1, 'tags post-processing exists');
  assert.notEqual(reactionsIndex, -1, 'reaction post-processing exists');
  assert.equal(source.indexOf('delegatedUpdateDetailPanel(data);'), -1, 'delegated editor detail render call is removed');
  assert.ok(memoIndex < reactionsIndex, 'reaction summary follows memo post-processing');
  assert.ok(tagsIndex < reactionsIndex, 'reaction summary follows tag post-processing');
});
