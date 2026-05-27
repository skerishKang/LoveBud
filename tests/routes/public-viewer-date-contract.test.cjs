const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer date helper is exposed', () => {
  assert.ok(source.includes('function updatePublicViewerCurrentMomentDate(data)'));
  assert.ok(source.includes('updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate'));
  assert.ok(source.includes('detailDateText'));
  assert.ok(source.includes('data.timestamp'));
});

test('viewer date helper is called by detail wrapper', () => {
  assert.ok(source.includes('updatePublicViewerCurrentMomentDate(data);'));
  assert.ok(source.includes('updateCurrentMomentImage(data);'));
});
