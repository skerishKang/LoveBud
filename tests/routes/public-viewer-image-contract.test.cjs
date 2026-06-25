const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getImageBoundary() {
  const start = source.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  const end = source.indexOf('function updatePublicViewerCurrentMomentDate(data)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('viewer image boundary is exposed', () => {
  assert.ok(source.includes('function createPublicViewerCurrentMomentImageBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerCurrentMomentImageBoundary: createPublicViewerCurrentMomentImageBoundary'));
  assert.ok(source.includes('var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps)'));
  assert.ok(source.includes('updateCurrentMomentImage(data);'));
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

test('viewer image boundary order is stable', () => {
  const hintIndex = source.indexOf('updatePublicViewerCurrentMomentHint();');
  const imageIndex = source.indexOf('updateCurrentMomentImage(data);');
  const dateIndex = source.indexOf('updatePublicViewerCurrentMomentDate(data);');

  assert.ok(hintIndex < imageIndex);
  assert.ok(imageIndex < dateIndex);
});
