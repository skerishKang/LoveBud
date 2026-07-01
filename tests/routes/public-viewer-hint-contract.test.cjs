const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer hint boundary is exposed', () => {
  assert.ok(metadataTextSource.includes('function updatePublicViewerCurrentMomentHint()'));
  assert.ok(metadataTextSource.includes('updatePublicViewerCurrentMomentHint: updatePublicViewerCurrentMomentHint'));
  assert.ok(detailUiSource.includes('metadataText.updatePublicViewerCurrentMomentHint();'));
});

test('viewer hint boundary clears and hides hint output', () => {
  assert.ok(metadataTextSource.includes('detailCurrentMomentHint'));
  assert.ok(metadataTextSource.includes("hintEl.textContent = ''"));
  assert.ok(metadataTextSource.includes('hintEl.hidden = true'));
  assert.equal(metadataTextSource.includes('innerHTML'), false);
});

test('viewer hint boundary order is stable', () => {
  const titleIndex = detailUiSource.indexOf('updateCurrentMomentTitle(data);');
  const hintIndex = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentHint();');
  const imageIndex = detailUiSource.indexOf('updateCurrentMomentImage(data);');

  assert.ok(titleIndex < hintIndex);
  assert.ok(hintIndex < imageIndex);
});
