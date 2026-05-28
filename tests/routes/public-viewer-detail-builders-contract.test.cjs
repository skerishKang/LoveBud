const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const buildersSource = fs.readFileSync('js/viewer/public-viewer-detail-builders.js', 'utf8');
const viewHtml = fs.readFileSync('pages/view.html', 'utf8');

test('public viewer detail builders install editor boundary fallbacks', () => {
  assert.ok(buildersSource.includes('function createNoopInlineEditBoundary()'), 'inline edit fallback factory exists');
  assert.ok(buildersSource.includes('createTitleEditBoundary: noop'), 'title edit fallback is noop');
  assert.ok(buildersSource.includes('createMemoEditBoundary: noop'), 'memo edit fallback is noop');
  assert.ok(buildersSource.includes('function createNoopSidebarStatusBoundary()'), 'sidebar status fallback factory exists');
  assert.ok(buildersSource.includes('updateSidebarStatus: noop'), 'sidebar status fallback is noop');
  assert.ok(buildersSource.includes('installPublicDetailBoundaryFallbacks();'), 'fallbacks are installed on load');
});

test('public viewer detail builders provide editor core compatibility without editor edit scripts', () => {
  assert.ok(buildersSource.includes('window.createEditorDetailInlineEditBoundary = createNoopInlineEditBoundary'), 'inline edit fallback is published only when missing');
  assert.ok(buildersSource.includes('window.createEditorDetailSidebarStatusBoundary = createNoopSidebarStatusBoundary'), 'sidebar status fallback is published only when missing');
  assert.equal(viewHtml.includes('js/editor/editor-detail-inline-edit.js'), false, 'public viewer does not load editor inline edit helper');
  assert.equal(viewHtml.includes('js/editor/editor-detail-sidebar-status-boundary.js'), false, 'public viewer does not load editor sidebar status helper');
  assert.ok(viewHtml.includes('js/viewer/public-viewer-detail-builders.js'), 'public viewer loads viewer detail builders before viewer detail adapter');
  assert.ok(viewHtml.indexOf('js/viewer/public-viewer-detail-builders.js') < viewHtml.indexOf('js/viewer/public-viewer-detail-ui.js'), 'fallbacks load before viewer detail adapter');
});
