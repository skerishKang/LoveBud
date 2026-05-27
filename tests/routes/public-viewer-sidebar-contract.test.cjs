const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer sidebar status boundary is a noop', () => {
  assert.ok(source.includes('function updatePublicViewerSidebarStatus() {}'));
  assert.ok(source.includes('detailUI.updateSidebarStatus = updatePublicViewerSidebarStatus'));
  assert.ok(source.includes('updatePublicViewerSidebarStatus: updatePublicViewerSidebarStatus'));
});

test('viewer sidebar status boundary stays before empty state boundary', () => {
  const focusIndex = source.indexOf('function createPublicViewerUpdateFocusSelectedBtn(deps)');
  const sidebarIndex = source.indexOf('function updatePublicViewerSidebarStatus() {}');
  const emptyIndex = source.indexOf('function createPublicViewerEmptyStateContent()');

  assert.notEqual(focusIndex, -1);
  assert.notEqual(sidebarIndex, -1);
  assert.notEqual(emptyIndex, -1);
  assert.ok(focusIndex < sidebarIndex);
  assert.ok(sidebarIndex < emptyIndex);
});
