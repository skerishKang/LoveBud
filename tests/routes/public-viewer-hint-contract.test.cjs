const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getHintBoundary() {
  const start = source.indexOf('function updatePublicViewerCurrentMomentHint()');
  const end = source.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('viewer hint boundary is exposed', () => {
  assert.ok(source.includes('function updatePublicViewerCurrentMomentHint()'));
  assert.ok(source.includes('updatePublicViewerCurrentMomentHint: updatePublicViewerCurrentMomentHint'));
  assert.ok(source.includes('updatePublicViewerCurrentMomentHint();'));
});

test('viewer hint boundary clears and hides hint output', () => {
  const boundary = getHintBoundary();

  assert.ok(boundary.includes('detailCurrentMomentHint'));
  assert.ok(boundary.includes("hintEl.textContent = ''"));
  assert.ok(boundary.includes('hintEl.hidden = true'));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('viewer hint boundary order is stable', () => {
  const titleIndex = source.indexOf('updateCurrentMomentTitle(data);');
  const hintIndex = source.indexOf('updatePublicViewerCurrentMomentHint();');
  const imageIndex = source.indexOf('updateCurrentMomentImage(data);');

  assert.ok(titleIndex < hintIndex);
  assert.ok(hintIndex < imageIndex);
});
