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

test('public viewer canvas runtime boundary stays documented and ordered', () => {
  const scripts = getScriptSrcs();

  const canvasRuntimeBoundary = [
    'js/editor/editor-root-helpers.js',
    'js/editor/editor-canvas-layout.js',
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
    'js/editor/editor-canvas-viewport-branches.js',
    'js/editor/editor-canvas-viewport-actions.js',
    'js/editor/editor-canvas-viewport-controls.js',
    'js/editor/editor-canvas-edges.js',
    'js/editor/editor-canvas-geometry.js',
    'js/editor/editor-canvas-layout-storage.js',
    'js/editor/editor-canvas-layout-transition.js',
    'js/editor/editor-canvas.js',
  ];

  canvasRuntimeBoundary.forEach((needle) => {
    assert.ok(scriptIncludes(scripts, needle), `view.html currently keeps shared canvas runtime dependency: ${needle}`);
    assertScriptOrder(scripts, needle, 'js/viewer/public-viewer-canvas-adapter.js');
  });

  assertScriptOrder(scripts, 'js/viewer/public-canvas-affordance-fallback.js', 'js/editor/editor-canvas.js');
  assertScriptOrder(scripts, 'js/editor/editor-canvas.js', 'js/viewer/public-viewer-canvas-adapter.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-canvas-adapter.js', 'js/viewer/public-canvas-init.js');
});

test('public viewer canvas boundary keeps editor mutation/runtime-only modules excluded', () => {
  const scripts = getScriptSrcs();

  const excludedEditorRuntime = [
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
    'js/editor/editor-canvas-interaction-helpers.js',
    'js/editor/editor-canvas-state-boundary.js',
    'js/editor/editor-canvas-layout-helpers.js',
  ];

  excludedEditorRuntime.forEach((needle) => {
    assert.equal(
      scriptIncludes(scripts, needle),
      false,
      `public viewer must not reload editor-only runtime dependency: ${needle}`
    );
  });
});

test('public viewer canvas adapter remains the only public seam around createEditorCanvas', () => {
  const adapterSrc = fs.readFileSync('js/viewer/public-viewer-canvas-adapter.js', 'utf8');
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(adapterSrc.includes('LoveBudPublicViewerCanvasAdapter'), 'adapter must expose the public viewer canvas namespace');
  assert.ok(adapterSrc.includes('createPublicViewerCanvas'), 'adapter must expose createPublicViewerCanvas');
  assert.ok(adapterSrc.includes('return factory(canvasOptions);'), 'adapter must remain a thin wrapper over the canvas factory');
  assert.ok(initSrc.includes('LoveBudPublicViewerCanvasAdapter'), 'public init must route canvas creation through the adapter');
  assert.ok(initSrc.includes('if (!editorCanvas)'), 'public init must keep direct fallback when adapter returns falsy');
  assert.ok(initSrc.includes('editorCanvas = window.createEditorCanvas(canvasOptions);'), 'public init must preserve direct fallback assignment');
  assert.equal(adapterSrc.includes('initCanvas'), false, 'adapter must not initialize the canvas runtime itself');
  assert.equal(adapterSrc.includes('innerHTML'), false, 'adapter must not render DOM');
});

test('public viewer canvas runtime audit does not change API backend or schema surfaces', () => {
  const html = getViewHtml();

  assert.ok(html.includes('../js/api/auth-policy.js'), 'public viewer must keep auth policy dependency');
  assert.ok(html.includes('../js/api/base-api-fetch.js'), 'public viewer must keep base API fetch dependency');
  assert.ok(html.includes('../js/postgres-client.js'), 'public viewer must keep postgres client dependency');
  assert.equal(html.includes('/api/admin'), false, 'public viewer route must not add admin API usage');
  assert.equal(html.includes('schema'), false, 'public viewer route must not introduce schema references');
});
