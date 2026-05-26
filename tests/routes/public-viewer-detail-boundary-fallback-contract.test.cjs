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

test('detail UI builders install fallback boundaries before detail UI loads', () => {
  const scripts = getScriptSrcs();
  const buildersIndex = scriptIndex(scripts, 'js/editor/editor-detail-ui-builders.js');
  const detailUiIndex = scriptIndex(scripts, 'js/editor/editor-detail-ui.js');
  const source = fs.readFileSync('js/editor/editor-detail-ui-builders.js', 'utf8');

  assert.notEqual(buildersIndex, -1, 'public view must load detail UI builders');
  assert.notEqual(detailUiIndex, -1, 'public view must load detail UI');
  assert.ok(buildersIndex < detailUiIndex, 'detail UI builders must load before detail UI');
  assert.ok(source.includes('installPublicDetailBoundaryFallbacks'), 'builders must install public detail boundary fallbacks');
  assert.ok(source.includes("typeof window.createEditorDetailInlineEditBoundary !== 'function'"), 'inline edit fallback must not overwrite an existing implementation');
  assert.ok(source.includes("typeof window.createEditorDetailSidebarStatusBoundary !== 'function'"), 'sidebar status fallback must not overwrite an existing implementation');
  assert.ok(source.includes('LoveBudEditorDetailBoundaryFallbacks'), 'fallback namespace must remain inspectable');
});
