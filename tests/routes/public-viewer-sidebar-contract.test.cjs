const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer sidebar status boundary is created from normalized tree memories', () => {
  assert.ok(source.includes('function createPublicViewerSidebarStatusUpdater(deps)'));
  assert.ok(source.includes('detailUI.updateSidebarStatus = createPublicViewerSidebarStatusUpdater(deps)'));
  assert.ok(source.includes('createPublicViewerSidebarStatusUpdater: createPublicViewerSidebarStatusUpdater'));
  assert.ok(source.includes("document.getElementById('viewerSidebarMomentCount')"));
  assert.ok(source.includes("sidebarCountEl.textContent = visibleMomentCount + '개의 순간'"));
  assert.equal(source.includes('memoryCount || 0'), false, 'sidebar count must not shortcut through tree.memoryCount');
});

test('viewer sidebar status boundary stays before empty state boundary', () => {
  const focusIndex = source.indexOf('function createPublicViewerUpdateFocusSelectedBtn(deps)');
  const sidebarIndex = source.indexOf('function createPublicViewerSidebarStatusUpdater(deps)');
  const emptyIndex = source.indexOf('function createPublicViewerEmptyStateContent()');

  assert.notEqual(focusIndex, -1);
  assert.notEqual(sidebarIndex, -1);
  assert.notEqual(emptyIndex, -1);
  assert.ok(focusIndex < sidebarIndex);
  assert.ok(sidebarIndex < emptyIndex);
});
