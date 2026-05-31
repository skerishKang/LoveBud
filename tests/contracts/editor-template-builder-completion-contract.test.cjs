const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const TEMPLATE_BUILDERS = [
  {
    path: 'js/editor/templates/editor-add-memory-form-template.js',
    builder: 'buildAddMemoryFormTemplate',
    mountId: 'addMemoryFormTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-canvas-topbar-template.js',
    builder: 'buildCanvasTopbarTemplate',
    mountId: 'editorCanvasTopbarTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-empty-guide-template.js',
    builder: 'buildEmptyGuideTemplate',
    mountId: 'editorEmptyGuideTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-sidebar-template.js',
    builder: 'buildSidebarTemplate',
    mountId: 'editorSidebarTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-floating-toolbar-template.js',
    builder: 'buildFloatingToolbarTemplate',
    mountId: 'editorFloatingToolbarTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-detail-panel-shell-template.js',
    builder: 'buildDetailPanelShellTemplate',
    mountId: 'editorDetailPanelShellTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-detail-empty-state-template.js',
    builder: 'buildDetailEmptyStateTemplate',
    mountId: 'editorDetailEmptyStateTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-detail-view-mode-template.js',
    builder: 'buildDetailViewModeTemplate',
    mountId: 'editorDetailViewModeTemplateMount'
  },
  {
    path: 'js/editor/templates/editor-detail-edit-mode-template.js',
    builder: 'buildDetailEditModeTemplate',
    mountId: 'editorDetailEditModeTemplateMount'
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('all editor templates are tracked in the aggregate builder contract', () => {
  assert.equal(TEMPLATE_BUILDERS.length, 9);
});

test('all editor templates define their local builder function', () => {
  for (const { path, builder } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');
    const builderPattern = new RegExp(`function\\s+${escapeRegExp(builder)}\\s*\\(\\)`);

    assert.match(content, builderPattern, `${path} must define ${builder}()`);
  }
});

test('all editor templates mount through their builder function', () => {
  for (const { path, builder, mountId } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');
    const mountPattern = new RegExp(
      `document\\.getElementById\\(['"]${escapeRegExp(mountId)}['"]\\)`
    );
    const mountCallPattern = new RegExp(
      `mount\\.outerHTML\\s*=\\s*${escapeRegExp(builder)}\\(\\)`
    );

    assert.match(content, /^\(function\(\)\s*\{/, `${path} must keep classic IIFE wrapper`);
    assert.match(content, mountPattern, `${path} must target #${mountId}`);
    assert.match(content, mountCallPattern, `${path} must mount via ${builder}()`);
  }
});

test('editor templates do not expose provider globals or module exports yet', () => {
  for (const { path } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');

    assert.doesNotMatch(content, /window\.LoveBudEditor[A-Z]/, `${path} must not set LoveBudEditor globals`);
    assert.doesNotMatch(content, /window\.createEditor[A-Z]/, `${path} must not set createEditor globals`);
    assert.doesNotMatch(content, /\bexport\s+/, `${path} must not use ESM export before module migration`);
  }
});
