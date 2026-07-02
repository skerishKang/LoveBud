const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getImageBoundary() {
  const start = detailUiSource.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  const end = detailUiSource.indexOf('function createPublicViewerMemoBodyBoundary(deps)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return detailUiSource.slice(start, end);
}

test('viewer image boundary is exposed', () => {
  assert.ok(detailUiSource.includes('function createPublicViewerCurrentMomentImageBoundary(deps)'));
  assert.ok(detailUiSource.includes('createPublicViewerCurrentMomentImageBoundary: createPublicViewerCurrentMomentImageBoundary'));
  assert.ok(detailUiSource.includes('var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps)'));
  assert.ok(detailUiSource.includes('updateCurrentMomentImage(data);'));
});

test('viewer image boundary owns src and alt output', () => {
  const boundary = getImageBoundary();

  assert.ok(boundary.includes('resolveMemoryThumbnail'));
  assert.ok(boundary.includes('detailImg'));
  assert.ok(boundary.includes("document.querySelector('.detail-video img')"));
  assert.ok(boundary.includes('resolveMemoryThumbnail(data)'));
  assert.ok(boundary.includes('imgEl.src ='));
  assert.ok(boundary.includes('imgEl.alt = isEmptyState ?'));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('viewer image alt uses safeDisplayTitle delegation', () => {
  assert.ok(detailUiSource.includes('LoveBudPublicViewerDetailMetadataText'));
  assert.ok(detailUiSource.includes('safeDisplayTitle'));
});

test('viewer image boundary order is stable', () => {
  const hintIndex = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentHint();');
  const imageIndex = detailUiSource.indexOf('updateCurrentMomentImage(data);');
  const dateIndex = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentDate(data);');

  assert.ok(hintIndex < imageIndex);
  assert.ok(imageIndex < dateIndex);
});
