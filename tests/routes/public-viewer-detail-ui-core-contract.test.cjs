const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getViewHtml() {
  return fs.readFileSync('pages/view.html', 'utf8');
}

function getScriptSrcs() {
  const html = getViewHtml();
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => String(match[1] || '').split('?')[0]);
}

function indexOfScript(scripts, needle) {
  return scripts.findIndex((src) => src.includes(needle));
}

test('public viewer still loads editor detail UI core behind viewer-owned boundaries', () => {
  const scripts = getScriptSrcs();
  const detailTreeMetaIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-tree-meta.js');
  const detailBuildersIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-builders.js');
  const detailUiIndex = indexOfScript(scripts, 'js/editor/editor-detail-ui.js');
  const channelLinkIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-channel-link.js');

  assert.notEqual(detailTreeMetaIndex, -1, 'viewer tree meta helper must load');
  assert.notEqual(detailBuildersIndex, -1, 'viewer detail builders helper must load');
  assert.notEqual(detailUiIndex, -1, 'editor detail UI core remains the current detail renderer');
  assert.notEqual(channelLinkIndex, -1, 'viewer channel link helper must load');
  assert.ok(detailTreeMetaIndex < detailUiIndex, 'viewer tree meta helper must load before detail UI core');
  assert.ok(detailBuildersIndex < detailUiIndex, 'viewer detail builders helper must load before detail UI core');
  assert.ok(detailUiIndex < channelLinkIndex, 'viewer channel link helper patches after detail UI core');
});

test('public viewer has moved extracted detail helpers out of editor namespace', () => {
  const scripts = getScriptSrcs();

  [
    '../js/editor/editor-detail-tree-meta.js',
    '../js/editor/editor-detail-ui-builders.js',
    '../js/editor/editor-detail-inline-edit.js',
    '../js/editor/editor-detail-sidebar-status-boundary.js',
    '../js/editor/editor-detail-channel-link.js'
  ].forEach((src) => {
    assert.equal(scripts.includes(src), false, `public view must not load ${src}`);
  });
});

test('editor detail UI core contract remains explicit for future viewer renderer replacement', () => {
  const source = fs.readFileSync('js/editor/editor-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createEditorDetailUI(deps)'), 'detail UI core must expose createEditorDetailUI factory');
  assert.ok(source.includes('window.createEditorDetailUI = createEditorDetailUI'), 'detail UI core must publish factory on window');
  assert.ok(source.includes('setDetailEmptyState'), 'detail UI core return contract must include setDetailEmptyState');
  assert.ok(source.includes('updateFocusSelectedBtn'), 'detail UI core return contract must include updateFocusSelectedBtn');
  assert.ok(source.includes('updateSidebarStatus'), 'detail UI core return contract must include updateSidebarStatus');
  assert.ok(source.includes('updateDetailPanel'), 'detail UI core return contract must include updateDetailPanel');
  assert.ok(source.includes('window.createEditorDetailTreeMetaBoundary'), 'detail UI core currently depends on the tree meta boundary');
  assert.ok(source.includes('window.createEditorDetailUIBuilders'), 'detail UI core currently depends on detail UI builders');
  assert.ok(source.includes('window.createEditorDetailInlineEditBoundary'), 'detail UI core currently depends on inline edit boundary fallback');
  assert.ok(source.includes('window.createEditorDetailSidebarStatusBoundary'), 'detail UI core currently depends on sidebar status boundary fallback');
});
