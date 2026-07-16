const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getScriptSrcs() {
  const html = fs.readFileSync('pages/view.html', 'utf8');
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)]
    .map((match) => String(match[1] || '').split('?')[0]);
}

function getRawScriptSrcs() {
  const html = fs.readFileSync('pages/view.html', 'utf8');
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)]
    .map((match) => String(match[1] || ''));
}

function hasScript(scripts, needle) {
  return scripts.some((src) => src.includes(needle));
}

test('public viewer keeps intentional shared canvas runtime scripts', () => {
  const scripts = getScriptSrcs();

  const sharedCanvasRuntime = [
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

  sharedCanvasRuntime.forEach((needle) => {
    assert.ok(
      hasScript(scripts, needle),
      `pages/view.html intentionally keeps shared canvas runtime until a viewer canvas adapter replaces it: ${needle}`
    );
  });
});

test('public viewer excludes editor authoring-only script stacks', () => {
  const scripts = getScriptSrcs();

  const blockedEditorOnlyScripts = [
    'js/editor/editor-floating-toolbar-actions.js',
    'js/editor/editor-floating-toolbar-keyboard.js',
    'js/editor/editor-floating-toolbar-tooltip.js',
    'js/editor/editor-floating-toolbar-dropdown.js',
    'js/editor/editor-floating-toolbar-positioning.js',
    'js/editor/editor-floating-toolbar.js',
    'js/editor/editor-mobile-bottom-bar.js',
    'js/editor/editor-url-drop.js',
    'js/editor/editor-save-status-ui.js',
    'js/editor/editor-empty-guide-ui.js',
    'js/editor/editor-detail-inline-edit.js',
    'js/editor/editor-detail-ui.js',
    'js/editor/templates/editor-floating-toolbar-template.js',
    'js/editor/templates/editor-empty-guide-template.js',
  ];

  blockedEditorOnlyScripts.forEach((needle) => {
    assert.equal(
      hasScript(scripts, needle),
      false,
      `pages/view.html must not load editor authoring-only script: ${needle}`
    );
  });
});

test('public viewer detail UI uses the #3529 cache-refresh version', () => {
  const scripts = getRawScriptSrcs();

  assert.ok(
    scripts.includes('../js/viewer/public-viewer-detail-ui.js?v=20260715-3529-1'),
    'viewer detail UI script must use #3529 cache version (canonical LoveTreeAuthPolicy)'
  );
});

test('public viewer detail view-mode template uses the #3563 shared-builder cache version', () => {
  const scripts = getRawScriptSrcs();

  assert.ok(
    scripts.some((s) => s.includes('canonical-appreciation-detail-presentation.js')),
    'viewer must load shared canonical appreciation presentation builder'
  );
  assert.ok(
    scripts.includes('../js/viewer/public-viewer-detail-view-mode-template.js?v=e2d926ad0e9c'),
    'viewer detail view-mode thin wrapper must use content-sha cache version'
  );
  const builderIdx = scripts.findIndex((s) => s.includes('canonical-appreciation-detail-presentation.js'));
  const wrapperIdx = scripts.findIndex((s) => s.includes('public-viewer-detail-view-mode-template.js'));
  assert.ok(builderIdx >= 0 && wrapperIdx > builderIdx, 'shared builder must load before public detail wrapper');
});

test('public viewer loads social split scripts before detail-ui', () => {
  const rawScripts = getRawScriptSrcs();
  const detailUiIdx = rawScripts.findIndex(s => s.includes('public-viewer-detail-ui.js'));
  assert.ok(detailUiIdx >= 0, 'detail-ui script must be present');

  const socialScripts = [
    'public-viewer-read-only-social-summary.js',
    'public-viewer-authenticated-like.js',
    'public-viewer-authenticated-comment-composer.js',
  ];

  socialScripts.forEach((name) => {
    const idx = rawScripts.findIndex(s => s.includes(name));
    assert.ok(idx >= 0, `pages/view.html must load ${name}`);
    assert.ok(idx < detailUiIdx, `${name} must be loaded before detail-ui (index ${idx} vs ${detailUiIdx})`);
  });
});

test('view.html loads editor.css with #3419 cache version', () => {
  const html = fs.readFileSync('pages/view.html', 'utf8');
  assert.ok(
    html.includes('../css/editor.css?v=20260716-3562-1'),
    'view.html must load editor.css with #3419 cache version'
  );
});
