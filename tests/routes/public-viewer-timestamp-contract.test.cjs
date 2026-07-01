const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer timestamp boundary is text-only', () => {
  assert.ok(metadataTextSource.includes('function updatePublicViewerCurrentMomentDate(data)'));
  assert.ok(metadataTextSource.includes('updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate'));
  assert.ok(metadataTextSource.includes('detailDateText'));
  assert.ok(metadataTextSource.includes('dateEl.textContent'));
  assert.ok(metadataTextSource.includes('data && data.timestamp'));
  assert.equal(metadataTextSource.includes('innerHTML'), false);
});

test('viewer timestamp boundary order is stable', () => {
  const delegatedIndex = detailUiSource.indexOf('delegatedUpdateDetailPanel(data);');
  const dateIndex = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentDate(data);');
  const memoIndex = detailUiSource.indexOf('updateMemoBody(data);');
  const tagsIndex = detailUiSource.indexOf('updateCurrentMomentTags(data);');

  assert.ok(delegatedIndex < dateIndex);
  assert.ok(dateIndex < memoIndex);
  assert.ok(dateIndex < tagsIndex);
});
