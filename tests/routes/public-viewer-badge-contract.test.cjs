const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getBadgeBoundary() {
  const start = metadataTextSource.indexOf('function createPublicViewerCurrentMomentBadgeBoundary(deps)');
  const end = metadataTextSource.indexOf('function createPublicViewerCurrentMomentTitleBoundary(deps)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return metadataTextSource.slice(start, end);
}

test('viewer badge boundary is exposed', () => {
  assert.ok(metadataTextSource.includes('function createPublicViewerCurrentMomentBadgeBoundary(deps)'));
  assert.ok(metadataTextSource.includes('createPublicViewerCurrentMomentBadgeBoundary: createPublicViewerCurrentMomentBadgeBoundary'));
  assert.ok(detailUiSource.includes('LoveBudPublicViewerDetailMetadataText'));
  assert.ok(detailUiSource.includes('createPublicViewerCurrentMomentBadgeBoundary(deps)'));
  assert.ok(detailUiSource.includes('updateCurrentMomentBadge(data);'));
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
  const delegatedIndex = detailUiSource.indexOf('delegatedUpdateDetailPanel(data);');
  const badgeIndex = detailUiSource.indexOf('updateCurrentMomentBadge(data);');
  const titleIndex = detailUiSource.indexOf('updateCurrentMomentTitle(data);');
  const hintIndex = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentHint();');

  assert.ok(delegatedIndex < badgeIndex);
  assert.ok(badgeIndex < titleIndex);
  assert.ok(titleIndex < hintIndex);
});
