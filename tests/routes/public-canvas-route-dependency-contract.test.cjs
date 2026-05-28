const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getViewHtml() {
  return fs.readFileSync('pages/view.html', 'utf8');
}

function getScriptSrcs() {
  const html = getViewHtml();
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
}

function stripVersion(src) {
  return String(src || '').split('?')[0];
}

function scriptIncludes(scripts, needle) {
  return scripts.some((src) => stripVersion(src).includes(needle));
}

function scriptIndex(scripts, needle) {
  return scripts.findIndex((src) => stripVersion(src).includes(needle));
}

function assertScriptOrder(scripts, beforeNeedle, afterNeedle) {
  const beforeIndex = scriptIndex(scripts, beforeNeedle);
  const afterIndex = scriptIndex(scripts, afterNeedle);
  assert.notEqual(beforeIndex, -1, `missing script: ${beforeNeedle}`);
  assert.notEqual(afterIndex, -1, `missing script: ${afterNeedle}`);
  assert.ok(beforeIndex < afterIndex, `${beforeNeedle} must load before ${afterNeedle}`);
}

test('public canvas route page exists and avoids unused editor shell mounts after viewer shell cleanup', () => {
  const html = getViewHtml();

  assert.ok(html.includes('<main class="canvas-area'), 'view.html must expose the canvas area');
  assert.ok(html.includes('id="canvasArea"'), 'view.html must mount #canvasArea');
  assert.ok(html.includes('id="canvasSvg"'), 'view.html must mount #canvasSvg');
  assert.ok(
    html.includes('id="editorDetailPanelShellTemplateMount"'),
    'view.html currently uses the editor detail shell mount; update this contract when viewer-only shell replaces it'
  );
  assert.equal(
    html.includes('id="editorFloatingToolbarTemplateMount"'),
    false,
    'view.html must not carry the floating toolbar mount after public viewer shell cleanup'
  );
  assert.equal(
    html.includes('id="editorEmptyGuideTemplateMount"'),
    false,
    'view.html must not carry the empty guide mount after public viewer shell cleanup'
  );
});

test('public canvas route keeps public viewer bootstrap scripts in required order', () => {
  const scripts = getScriptSrcs();

  assertScriptOrder(scripts, 'js/viewer/public-canvas-bridge.js', 'js/viewer/public-canvas-init.js');
  assertScriptOrder(scripts, 'js/viewer/public-canvas-init.js', 'js/viewer/public-viewer-copy-helper.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-copy-helper.js', 'js/viewer/public-viewer-control-visibility-helper.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-control-visibility-helper.js', 'js/viewer/public-viewer-copy-polish.js');

  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-bridge.js'), 'view.html must load public canvas bridge');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-init.js'), 'view.html must load public canvas init');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-copy-helper.js'), 'view.html must load public viewer copy helper before copy polish');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-control-visibility-helper.js'), 'view.html must load public viewer control visibility helper before copy polish');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-copy-polish.js'), 'view.html must load public viewer copy polish until viewer-only copy rendering replaces it');
});

test('public canvas route loads API and i18n dependencies before public viewer init', () => {
  const scripts = getScriptSrcs();

  assertScriptOrder(scripts, 'js/api/auth-policy.js', 'js/api/base-api-fetch.js');
  assertScriptOrder(scripts, 'js/api/base-api-fetch.js', 'js/postgres-client.js');
  assertScriptOrder(scripts, 'js/postgres-client.js', 'js/viewer/public-canvas-bridge.js');

  assertScriptOrder(scripts, 'js/i18n/i18n-core.js', 'js/i18n.js');
  assertScriptOrder(scripts, 'js/i18n/i18n-editor.js', 'js/i18n.js');
  assertScriptOrder(scripts, 'js/i18n.js', 'js/viewer/public-canvas-bridge.js');
});

test('public canvas route documents current mobile public-viewer patches', () => {
  const scripts = getScriptSrcs();

  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-mobile-profile.js'), 'view.html must load mobile readable viewport profile patch');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-mobile-layout.js'), 'view.html must load mobile structured layout default patch');
  assertScriptOrder(scripts, 'js/editor/editor-canvas-viewport-initial.js', 'js/viewer/public-canvas-mobile-profile.js');
  assertScriptOrder(scripts, 'js/editor/editor-canvas-layout-storage.js', 'js/viewer/public-canvas-mobile-layout.js');
  assertScriptOrder(scripts, 'js/viewer/public-canvas-mobile-layout.js', 'js/editor/editor-canvas.js');
});

test('public canvas route loads affordance fallback before editor canvas module', () => {
  const scripts = getScriptSrcs();
  const fallbackSrc = fs.readFileSync('js/viewer/public-canvas-affordance-fallback.js', 'utf8');

  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-affordance-fallback.js'), 'view.html must load public canvas affordance fallback');
  assertScriptOrder(scripts, 'js/editor/editor-canvas-layout-transition.js', 'js/viewer/public-canvas-affordance-fallback.js');
  assertScriptOrder(scripts, 'js/viewer/public-canvas-affordance-fallback.js', 'js/editor/editor-canvas.js');
  assert.ok(fallbackSrc.includes('window.createEditorCanvasGrowthAffordance'), 'fallback must define missing growth affordance constructor');
  assert.ok(fallbackSrc.includes('window.createEditorCanvasBranchPorts'), 'fallback must define missing branch ports constructor');
  assert.ok(fallbackSrc.includes('LoveBudPublicCanvasAffordanceFallback'), 'fallback must expose an inspectable namespace');
});

test('public canvas route currently depends on editor canvas runtime before public init', () => {
  const scripts = getScriptSrcs();

  const requiredCanvasScripts = [
    'js/editor/editor-canvas-layout.js',
    'js/editor/editor-canvas-layout-helpers.js',
    'js/editor/editor-canvas-node.js',
    'js/editor/editor-canvas-interaction.js',
    'js/editor/editor-canvas-viewport.js',
    'js/editor/editor-canvas-viewport-scale.js',
    'js/editor/editor-canvas-viewport-projection.js',
    'js/editor/editor-canvas-viewport-targets.js',
    'js/editor/editor-canvas-viewport-feedback.js',
    'js/editor/editor-canvas-viewport-state.js',
    'js/editor/editor-canvas-viewport-fit.js',
    'js/editor/editor-canvas-viewport-initial.js',
    'js/editor/editor-canvas-viewport-controls.js',
    'js/editor/editor-canvas-edges.js',
    'js/editor/editor-canvas-geometry.js',
    'js/editor/editor-canvas-layout-storage.js',
    'js/editor/editor-canvas-layout-transition.js',
    'js/editor/editor-canvas.js',
  ];

  requiredCanvasScripts.forEach((needle) => {
    assert.ok(scriptIncludes(scripts, needle), `view.html currently needs canvas runtime dependency: ${needle}`);
    assertScriptOrder(scripts, needle, 'js/viewer/public-canvas-init.js');
  });
});

test('public canvas route has no remaining tracked editor-only runtime candidates loaded by current implementation', () => {
  const scripts = getScriptSrcs();

  const remainingEditorOnlyCandidates = [
    'js/editor/editor-canvas-growth-affordance.js',
    'js/editor/editor-canvas-branch-ports.js',
  ];

  remainingEditorOnlyCandidates.forEach((needle) => {
    assert.equal(
      scriptIncludes(scripts, needle),
      false,
      `view.html must not reload removed editor-only candidate ${needle}`
    );
  });
});

test('public canvas route keeps removed editor-only runtime scripts and unused shell templates out of public view', () => {
  const scripts = getScriptSrcs();

  const removedEditorOnlyRuntimeScripts = [
    'js/editor/editor-floating-toolbar-actions.js',
    'js/editor/editor-floating-toolbar-keyboard.js',
    'js/editor/editor-floating-toolbar-tooltip.js',
    'js/editor/editor-floating-toolbar-dropdown.js',
    'js/editor/editor-floating-toolbar-positioning.js',
    'js/editor/editor-floating-toolbar-affordance.js',
    'js/editor/editor-floating-toolbar-visibility.js',
    'js/editor/editor-floating-toolbar-events.js',
    'js/editor/editor-floating-toolbar-selection.js',
    'js/editor/editor-floating-toolbar-elements.js',
    'js/editor/editor-floating-toolbar.js',
    'js/editor/editor-mobile-bottom-bar.js',
    'js/editor/editor-url-drop.js',
    'js/editor/editor-save-status-ui.js',
    'js/editor/editor-empty-guide-ui.js',
    'js/editor/editor-canvas-growth-affordance.js',
    'js/editor/editor-canvas-branch-ports.js',
    'js/editor/editor-detail-inline-edit.js',
    'js/editor/editor-detail-sidebar-status-boundary.js',
    'js/editor/editor-detail-channel-link.js',
    'js/editor/editor-detail-tree-meta.js',
    'js/editor/editor-detail-ui-builders.js',
    'js/editor/editor-detail-ui.js',
    'js/editor/templates/editor-floating-toolbar-template.js',
    'js/editor/templates/editor-empty-guide-template.js',
  ];

  removedEditorOnlyRuntimeScripts.forEach((needle) => {
    assert.equal(
      scriptIncludes(scripts, needle),
      false,
      `view.html must not reload removed editor-only runtime/template script ${needle}`
    );
  });
});

test('public canvas route loads viewer detail helpers before public init', () => {
  const scripts = getScriptSrcs();

  const detailHelperScripts = [
    'js/viewer/public-viewer-detail-tree-meta.js',
    'js/viewer/public-viewer-detail-builders.js',
  ];

  detailHelperScripts.forEach((needle) => {
    assert.ok(scriptIncludes(scripts, needle), `view.html loads detail helper: ${needle}`);
    assertScriptOrder(scripts, needle, 'js/viewer/public-canvas-init.js');
  });

  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-tree-meta.js', 'js/viewer/public-viewer-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-builders.js', 'js/viewer/public-viewer-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-ui.js', 'js/viewer/public-viewer-detail-channel-link.js');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-detail-ui.js'), 'view.html loads viewer detail UI adapter');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-detail-channel-link.js'), 'view.html loads viewer detail channel link helper');
});

test('public canvas route delegates detail channel link rendering to viewer helper', () => {
  const scripts = getScriptSrcs();
  const helperSrc = fs.readFileSync('js/viewer/public-viewer-detail-channel-link.js', 'utf8');

  assert.equal(
    scriptIncludes(scripts, 'js/editor/editor-detail-channel-link.js'),
    false,
    'view.html must not load editor detail channel link patch'
  );
  assert.ok(
    scriptIncludes(scripts, 'js/viewer/public-viewer-detail-channel-link.js'),
    'view.html must load viewer detail channel link helper'
  );
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-ui.js', 'js/viewer/public-viewer-detail-channel-link.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-channel-link.js', 'js/viewer/public-canvas-init.js');
  assert.ok(helperSrc.includes('window.LoveBudPublicViewerDetailChannelLink'), 'viewer channel link helper must expose inspectable namespace');
  assert.ok(helperSrc.includes('renderDetailChannelLink'), 'viewer channel link helper must expose renderDetailChannelLink');
  assert.equal(helperSrc.includes('createPublicViewerDetailUI'), false, 'viewer channel link helper must not patch the viewer detail adapter');
});
