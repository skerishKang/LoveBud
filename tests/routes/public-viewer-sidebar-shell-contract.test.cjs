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

test('public viewer does not load unused sidebar shell scripts', () => {
  const html = getViewHtml();
  const scripts = getScriptSrcs();

  assert.equal(html.includes('id="editorSidebarTemplateMount"'), false, 'public view must not carry the editor sidebar mount');
  assert.equal(scripts.includes('../js/editor/templates/editor-sidebar-template.js'), false, 'public view must not load the editor sidebar template');
  assert.equal(scripts.includes('../js/editor/editor-sidebar-ui.js'), false, 'public view must not load editor sidebar UI runtime');
});

test('public viewer keeps detail and canvas shells for the current implementation', () => {
  const html = getViewHtml();
  const scripts = getScriptSrcs();

  assert.ok(html.includes('id="editorCanvasTopbarTemplateMount"'), 'canvas topbar shell is still used by public viewer');
  assert.ok(html.includes('id="editorDetailPanelShellTemplateMount"'), 'detail panel shell mount is still used by public viewer');
  assert.ok(scripts.includes('../js/editor/templates/editor-canvas-topbar-template.js'), 'canvas topbar template remains loaded');
  assert.ok(scripts.includes('../js/viewer/public-viewer-detail-panel-shell-template.js'), 'viewer detail panel shell template is loaded');
  assert.ok(scripts.includes('../js/viewer/public-viewer-detail-empty-state-template.js'), 'viewer detail empty state template is loaded');
  assert.equal(scripts.includes('../js/editor/templates/editor-detail-panel-shell-template.js'), false, 'public view must not load the editor detail panel shell template');
  assert.equal(scripts.includes('../js/editor/templates/editor-detail-empty-state-template.js'), false, 'public view must not load the editor detail empty state template');
});
