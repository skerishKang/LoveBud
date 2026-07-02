const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer date helper is exposed', () => {
  assert.ok(metadataTextSource.includes('function updatePublicViewerCurrentMomentDate(data)'));
  assert.ok(metadataTextSource.includes('updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate'));
  assert.ok(metadataTextSource.includes('detailDateText'));
  assert.ok(metadataTextSource.includes('data.timestamp'));
});

test('viewer date helper is called by detail wrapper', () => {
  assert.ok(detailUiSource.includes('metadataText.updatePublicViewerCurrentMomentDate(data);'));
  assert.ok(detailUiSource.includes('updateCurrentMomentImage(data);'));
});
