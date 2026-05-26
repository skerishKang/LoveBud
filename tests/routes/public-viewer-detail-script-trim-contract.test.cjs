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

test('public viewer does not load editor detail edit/status boundary scripts', () => {
  const scripts = getScriptSrcs();

  assert.equal(scripts.includes('../js/editor/editor-detail-inline-edit.js'), false, 'public view must not load editor detail inline edit boundary runtime');
  assert.equal(scripts.includes('../js/editor/editor-detail-sidebar-status-boundary.js'), false, 'public view must not load editor detail sidebar status boundary runtime');
});

test('public viewer keeps viewer detail builders before detail UI for fallback boundaries', () => {
  const scripts = getScriptSrcs();
  const buildersIndex = scripts.findIndex((src) => src.includes('js/viewer/public-viewer-detail-builders.js'));
  const detailUiIndex = scripts.findIndex((src) => src.includes('js/editor/editor-detail-ui.js'));

  assert.equal(scripts.includes('../js/editor/editor-detail-ui-builders.js'), false, 'public view must not load editor detail UI builders');
  assert.notEqual(buildersIndex, -1, 'public view must load viewer detail builders');
  assert.notEqual(detailUiIndex, -1, 'public view must load detail UI');
  assert.ok(buildersIndex < detailUiIndex, 'viewer detail builders must load before detail UI so fallback boundaries exist');
});

test('public viewer delegates channel link patch to viewer-owned helper', () => {
  const scripts = getScriptSrcs();
  const detailUiIndex = scripts.findIndex((src) => src.includes('js/editor/editor-detail-ui.js'));
  const helperIndex = scripts.findIndex((src) => src.includes('js/viewer/public-viewer-detail-channel-link.js'));

  assert.equal(scripts.includes('../js/editor/editor-detail-channel-link.js'), false, 'public view must not load editor detail channel link patch');
  assert.ok(scripts.includes('../js/viewer/public-viewer-detail-channel-link.js'), 'public view must load viewer detail channel link helper');
  assert.notEqual(detailUiIndex, -1, 'public view must load detail UI');
  assert.notEqual(helperIndex, -1, 'public view must load viewer channel link helper');
  assert.ok(detailUiIndex < helperIndex, 'viewer channel link helper must load after detail UI so it can patch the factory');
});
