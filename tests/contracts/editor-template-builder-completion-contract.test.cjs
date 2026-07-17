const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const TEMPLATE_BUILDERS = [
  {
    path: 'js/editor/templates/editor-add-memory-form-template.js',
    builder: 'buildAddMemoryFormTemplate',
    mountId: 'addMemoryFormTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-canvas-topbar-template.js',
    builder: 'buildCanvasTopbarTemplate',
    mountId: 'editorCanvasTopbarTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-empty-guide-template.js',
    builder: 'buildEmptyGuideTemplate',
    mountId: 'editorEmptyGuideTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-sidebar-template.js',
    builder: 'buildSidebarTemplate',
    mountId: 'editorSidebarTemplateMount',
    module: false
  },
  {
    path: 'js/editor/templates/editor-floating-toolbar-template.js',
    builder: 'buildFloatingToolbarTemplate',
    mountId: 'editorFloatingToolbarTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-detail-panel-shell-template.js',
    builder: 'buildDetailPanelShellTemplate',
    mountId: 'editorDetailPanelShellTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-detail-empty-state-template.js',
    builder: 'buildDetailEmptyStateTemplate',
    mountId: 'editorDetailEmptyStateTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-detail-view-mode-template.js',
    builder: 'buildDetailViewModeTemplate',
    mountId: 'editorDetailViewModeTemplateMount',
    module: true
  },
  {
    path: 'js/editor/templates/editor-detail-edit-mode-template.js',
    builder: 'buildDetailEditModeTemplate',
    mountId: 'editorDetailEditModeTemplateMount',
    module: true
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('all editor templates are tracked in the aggregate builder contract', () => {
  assert.equal(TEMPLATE_BUILDERS.length, 9);
});

test('all editor templates define their local builder function', () => {
  for (const { path, builder, module: isModule } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');
    if (isModule) {
      const exportBuilderPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(builder)}\\s*\\(\\)`);
      assert.match(content, exportBuilderPattern, `${path} must define ${builder}() as export`);
    } else {
      const builderPattern = new RegExp(`function\\s+${escapeRegExp(builder)}\\s*\\(\\)`);
      assert.match(content, builderPattern, `${path} must define ${builder}()`);
    }
  }
});

test('all editor templates mount through their builder function', () => {
  for (const { path, builder, mountId, module: isModule } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');
    const mountPattern = new RegExp(
      `document\\.getElementById\\(['"]${escapeRegExp(mountId)}['"]\\)`
    );
    const mountCallPattern = new RegExp(
      `mount\\.outerHTML\\s*=\\s*${escapeRegExp(builder)}\\(\\)`
    );

    if (isModule) {
      assert.doesNotMatch(content, /^\(function\(\)\s*\{/, `${path} must not use IIFE wrapper (ESM)`);
    } else {
      // Sidebar template is a classic script but does NOT use IIFE - it uses direct function declarations
      // because it has helper functions that need to be shared within the script
      if (path.includes('editor-sidebar-template.js')) {
        // Sidebar uses direct function declarations, not IIFE
        assert.match(content, /function\s+getSharedPresentationBuilder/,
          `${path} must use direct function declarations (not IIFE)`);
      } else {
        assert.match(content, /^\(function\(\)\s*\{/, `${path} must keep classic IIFE wrapper`);
      }
    }
    assert.match(content, mountPattern, `${path} must target #${mountId}`);
    assert.match(content, mountCallPattern, `${path} must mount via ${builder}()`);
  }
});

test('editor templates do not expose window provider globals', () => {
  for (const { path } of TEMPLATE_BUILDERS) {
    const content = fs.readFileSync(path, 'utf8');

    assert.doesNotMatch(content, /window\.LoveBudEditor[A-Z]/, `${path} must not set LoveBudEditor globals`);
    assert.doesNotMatch(content, /window\.createEditor[A-Z]/, `${path} must not set createEditor globals`);
  }
});

test('classic templates do not use ESM export', () => {
  const classicTemplates = TEMPLATE_BUILDERS.filter(t => !t.module);
  for (const { path } of classicTemplates) {
    const content = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /\bexport\s+/, `${path} must not use ESM export (classic script)`);
  }
});

test('ESM templates use export function pattern', () => {
  const moduleTemplates = TEMPLATE_BUILDERS.filter(t => t.module);
  assert.ok(moduleTemplates.length > 0, 'at least one template must be ESM');
  for (const { path, builder } of moduleTemplates) {
    const content = fs.readFileSync(path, 'utf8');
    const exportPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(builder)}\\s*\\(`);
    assert.match(content, exportPattern, `${path} must use export function ${builder}`);
  }
});
