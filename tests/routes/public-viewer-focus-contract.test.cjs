const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getFocusBoundary() {
  const start = source.indexOf('function createPublicViewerUpdateFocusSelectedBtn(deps)');
  const end = source.indexOf('function createPublicViewerSidebarStatusUpdater(deps)');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('viewer focus selected boundary is exposed', () => {
  assert.ok(source.includes('function createPublicViewerUpdateFocusSelectedBtn(deps)'));
  assert.ok(source.includes('createPublicViewerUpdateFocusSelectedBtn: createPublicViewerUpdateFocusSelectedBtn'));
  assert.ok(source.includes('detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps)'));
});

test('viewer focus selected boundary only reflects selected node state', () => {
  const boundary = getFocusBoundary();

  assert.ok(boundary.includes('getSelectedNodeId'));
  assert.ok(boundary.includes("document.getElementById('focusSelectedBtn')"));
  assert.ok(boundary.includes('btn.disabled = !hasSelection'));
  assert.ok(boundary.includes("btn.classList.toggle('is-disabled', !hasSelection)"));
  assert.equal(boundary.includes('innerHTML'), false);
  assert.equal(boundary.includes('onclick'), false);
});
