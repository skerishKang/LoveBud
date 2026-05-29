const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const shellSrc = fs.readFileSync('js/viewer/public-viewer-detail-panel-shell-template.js', 'utf8');
const viewHtml = fs.readFileSync('pages/view.html', 'utf8');

test('public viewer detail shell keeps read-only template mounts', () => {
  assert.ok(
    shellSrc.includes("document.getElementById('editorDetailPanelShellTemplateMount')"),
    'public detail shell must keep the route shell mount lookup'
  );
  assert.ok(
    shellSrc.includes("emptyMount.id = 'editorDetailEmptyStateTemplateMount'"),
    'public detail shell must keep the empty-state template mount'
  );
  assert.ok(
    shellSrc.includes("viewMount.id = 'editorDetailViewModeTemplateMount'"),
    'public detail shell must keep the view-mode template mount'
  );
  assert.ok(
    shellSrc.includes('content.appendChild(emptyMount);'),
    'public detail shell must append the empty-state mount'
  );
  assert.ok(
    shellSrc.includes('content.appendChild(viewMount);'),
    'public detail shell must append the view-mode mount'
  );
});

test('public viewer detail shell does not create an edit-mode mount', () => {
  assert.equal(
    shellSrc.includes('editorDetailEditModeTemplateMount'),
    false,
    'public detail shell must stay read-only and avoid the edit-mode template mount'
  );
  assert.equal(
    viewHtml.includes('js/editor/templates/editor-detail-edit-mode-template.js'),
    false,
    'public view must not load the editor detail edit-mode template'
  );
});
