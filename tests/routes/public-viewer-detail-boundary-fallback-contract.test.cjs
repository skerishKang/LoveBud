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

function scriptIndex(scripts, needle) {
  return scripts.findIndex((src) => src.includes(needle));
}

test('viewer detail builders install fallback boundaries before detail UI loads', () => {
  const scripts = getScriptSrcs();
  const buildersIndex = scriptIndex(scripts, 'js/viewer/public-viewer-detail-builders.js');
  const detailUiIndex = scriptIndex(scripts, 'js/editor/editor-detail-ui.js');
  const source = fs.readFileSync('js/viewer/public-viewer-detail-builders.js', 'utf8');

  assert.notEqual(buildersIndex, -1, 'public view must load viewer detail builders');
  assert.notEqual(detailUiIndex, -1, 'public view must load detail UI');
  assert.ok(buildersIndex < detailUiIndex, 'viewer detail builders must load before detail UI');
  assert.equal(scripts.includes('../js/editor/editor-detail-ui-builders.js'), false, 'public view must not load editor detail UI builders');
  assert.ok(source.includes('installPublicDetailBoundaryFallbacks'), 'builders must install public detail boundary fallbacks');
  assert.ok(source.includes("typeof window.createEditorDetailInlineEditBoundary !== 'function'"), 'inline edit fallback must not overwrite an existing implementation');
  assert.ok(source.includes("typeof window.createEditorDetailSidebarStatusBoundary !== 'function'"), 'sidebar status fallback must not overwrite an existing implementation');
  assert.ok(source.includes('LoveBudPublicViewerDetailBuilders'), 'viewer fallback namespace must remain inspectable');
});
