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

test('public canvas route page exists and uses editor-shell mount points until viewer-only shell exists', () => {
  const html = getViewHtml();

  assert.ok(html.includes('<main class="canvas-area'), 'view.html must expose the canvas area');
  assert.ok(html.includes('id="canvasArea"'), 'view.html must mount #canvasArea');
  assert.ok(html.includes('id="canvasSvg"'), 'view.html must mount #canvasSvg');
  assert.ok(
    html.includes('id="editorDetailPanelShellTemplateMount"'),
    'view.html currently uses the editor detail shell mount; update this contract when viewer-only shell replaces it'
  );
  assert.ok(
    html.includes('id="editorFloatingToolbarTemplateMount"'),
    'view.html currently includes the editor floating toolbar mount; update this contract before removing related dependencies'
  );
});

test('public canvas route keeps public viewer bootstrap scripts in required order', () => {
  const scripts = getScriptSrcs();

  assertScriptOrder(scripts, 'js/viewer/public-canvas-bridge.js', 'js/viewer/public-canvas-init.js');
  assertScriptOrder(scripts, 'js/viewer/public-canvas-init.js', 'js/viewer/public-viewer-copy-helper.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-copy-helper.js', 'js/viewer/public-viewer-copy-polish.js');

  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-bridge.js'), 'view.html must load public canvas bridge');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-canvas-init.js'), 'view.html must load public canvas init');
  assert.ok(scriptIncludes(scripts, 'js/viewer/public-viewer-copy-helper.js'), 'view.html must load public viewer copy helper before copy polish');
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

test('public canvas route documents editor-only candidates still loaded by current implementation', () => {
  const scripts = getScriptSrcs();

  const editorOnlyCandidates = [
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
  ];

  editorOnlyCandidates.forEach((needle) => {
    assert.ok(
      scriptIncludes(scripts, needle),
      `view.html still loads editor-only candidate ${needle}; remove this assertion when viewer-only replacement safely removes it`
    );
  });
});

test('public canvas route currently uses editor detail UI stack before public init', () => {
  const scripts = getScriptSrcs();

  const detailScripts = [
    'js/editor/editor-detail-tree-meta.js',
    'js/editor/editor-detail-inline-edit.js',
    'js/editor/editor-detail-sidebar-status-boundary.js',
    'js/editor/editor-detail-ui-builders.js',
    'js/editor/editor-detail-ui.js',
    'js/editor/editor-detail-channel-link.js',
  ];

  detailScripts.forEach((needle) => {
    assert.ok(scriptIncludes(scripts, needle), `view.html currently loads detail dependency: ${needle}`);
    assertScriptOrder(scripts, needle, 'js/viewer/public-canvas-init.js');
  });
});

test('public viewer copy helper centralizes viewer copy and hidden-control rules', () => {
  const helperSrc = fs.readFileSync('js/viewer/public-viewer-copy-helper.js', 'utf8');
  const polishSrc = fs.readFileSync('js/viewer/public-viewer-copy-polish.js', 'utf8');

  assert.ok(helperSrc.includes('window.LoveBudPublicViewerCopyHelper'), 'copy helper must export LoveBudPublicViewerCopyHelper');
  assert.ok(helperSrc.includes('getTextRules: getTextRules'), 'copy helper must expose getTextRules');
  assert.ok(helperSrc.includes('getHideSelectors: getHideSelectors'), 'copy helper must expose getHideSelectors');
  assert.ok(helperSrc.includes('getRawLayoutLabel: getRawLayoutLabel'), 'copy helper must expose getRawLayoutLabel');

  ['선택한 순간', '러브트리 정보', '감상 동선', '순간 자세히 보기', '순간 기록', '감정 태그', '남긴 메모'].forEach((copy) => {
    assert.ok(helperSrc.includes(copy), `copy helper must own viewer copy: ${copy}`);
    assert.equal(polishSrc.includes(copy), false, `copy polish must not hard-code viewer copy: ${copy}`);
  });

  ['#editMemoryBtn', '#continueFromMomentBtn', '.editor-save-status-card'].forEach((selector) => {
    assert.ok(helperSrc.includes(selector), `copy helper must own hidden selector: ${selector}`);
  });

  assert.ok(polishSrc.includes('LoveBudPublicViewerCopyHelper'), 'copy polish must delegate to the helper');
  assert.ok(polishSrc.includes('helper.getTextRules'), 'copy polish must apply helper text rules');
  assert.ok(polishSrc.includes('helper.getHideSelectors'), 'copy polish must apply helper hidden selectors');
  assert.ok(polishSrc.includes('helper.getRawLayoutLabel'), 'copy polish must use helper raw layout label map');
});

test('public canvas route has an executable mobile smoke npm script', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.equal(
    pkg.scripts['test:e2e:public-viewer-mobile'],
    'node scripts/e2e-public-viewer-mobile-smoke.cjs',
    'package.json must expose the public viewer mobile smoke command'
  );
  assert.ok(
    fs.existsSync('scripts/e2e-public-viewer-mobile-smoke.cjs'),
    'public viewer mobile smoke script must exist'
  );
});
