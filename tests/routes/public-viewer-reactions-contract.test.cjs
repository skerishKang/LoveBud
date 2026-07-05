const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const detailSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
const socialSource = fs.readFileSync('js/viewer/public-viewer-read-only-social-summary.js', 'utf8');

test('public viewer reaction summary boundary stays read-only', () => {
  const boundarySource = socialSource;

  assert.ok(boundarySource.includes('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)'), 'read-only reaction boundary exists in social summary file');
  assert.equal(boundarySource.includes('onclick = null'), false, 'public viewer does not clear button handlers');
  assert.equal(boundarySource.includes('.disabled'), false, 'public viewer does not depend on disabled button state');
  assert.equal(boundarySource.includes('aria-disabled'), false, 'public viewer does not depend on aria-disabled button state');
  assert.equal(boundarySource.includes('toggleReaction'), false, 'public viewer does not call toggleReaction');
  assert.equal(boundarySource.includes('fetch('), false, 'public viewer reaction boundary does not add mutation fetches');
  assert.equal(boundarySource.includes('from=editor'), false, 'public viewer does not use editor comment context');
});

test('public viewer reaction summary runs after memo and tags post-processing', () => {
  const headingCallRaw = detailSource.indexOf('updateDetailHeading();');
  const realFlowSlice = detailSource.slice(headingCallRaw);

  const memoIndex = realFlowSlice.indexOf('updateMemoBody(data);');
  const tagsIndex = realFlowSlice.indexOf('updateCurrentMomentTags(data);');
  const reactionsIndex = realFlowSlice.indexOf('updateReadOnlyReactionSummary(data);');

  assert.notEqual(memoIndex, -1, 'memo post-processing exists');
  assert.notEqual(tagsIndex, -1, 'tags post-processing exists');
  assert.notEqual(reactionsIndex, -1, 'reaction post-processing exists');
  assert.equal(detailSource.indexOf('delegatedUpdateDetailPanel(data);'), -1, 'delegated editor detail render call is removed');
  assert.ok(memoIndex < reactionsIndex, 'reaction summary follows memo post-processing');
  assert.ok(tagsIndex < reactionsIndex, 'reaction summary follows tag post-processing');
});
