const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getBadgeBoundary() {
  const start = source.indexOf('function createPublicViewerCurrentMomentBadgeBoundary(deps)');
  const end = source.indexOf('function createPublicViewerCurrentMomentTitleBoundary(deps)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('viewer badge boundary is exposed', () => {
  assert.ok(source.includes('function createPublicViewerCurrentMomentBadgeBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerCurrentMomentBadgeBoundary: createPublicViewerCurrentMomentBadgeBoundary'));
  assert.ok(source.includes('var updateCurrentMomentBadge = createPublicViewerCurrentMomentBadgeBoundary(deps)'));
  assert.ok(source.includes('updateCurrentMomentBadge(data);'));
});

test('viewer badge boundary owns badge states', () => {
  const boundary = getBadgeBoundary();

  assert.ok(boundary.includes('detailCurrentMomentBadge'));
  assert.ok(boundary.includes('waiting_first_moment'));
  assert.ok(boundary.includes('start_moment'));
  assert.ok(boundary.includes('selected_moment'));
  assert.ok(boundary.includes('badgeEl.textContent'));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('viewer badge boundary order is stable', () => {
  const delegatedIndex = source.indexOf('delegatedUpdateDetailPanel(data);');
  const badgeIndex = source.indexOf('updateCurrentMomentBadge(data);');
  const titleIndex = source.indexOf('updateCurrentMomentTitle(data);');
  const hintIndex = source.indexOf('updatePublicViewerCurrentMomentHint();');

  assert.ok(delegatedIndex < badgeIndex);
  assert.ok(badgeIndex < titleIndex);
  assert.ok(titleIndex < hintIndex);
});
