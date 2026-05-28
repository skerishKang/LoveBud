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

  assertScriptOrder(scripts, 'js/viewer/public-canvas-bridge.js', 'js/viewer/public-viewer-canvas-entry.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-canvas-entry.js', 'js/viewer/public-canvas-init.js');
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
    'js/editor/editor-dom-selectors.js',
    'js/editor/editor-canvas-interaction-helpers.js',
    'js/editor/editor-canvas-state-boundary.js',
    'js/editor/editor-canvas-layout-helpers.js',
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

test('public canvas entry wrapper exposes boundary and setup methods', () => {
  const entrySrc = fs.readFileSync('js/viewer/public-viewer-canvas-entry.js', 'utf8');

  assert.ok(entrySrc.includes('LoveBudPublicViewerCanvasEntry'), 'entry wrapper must expose LoveBudPublicViewerCanvasEntry namespace');
  assert.ok(entrySrc.includes('installPublicMetrics'), 'entry wrapper must expose installPublicMetrics');
  assert.ok(entrySrc.includes('installPublicViewportProfile'), 'entry wrapper must expose installPublicViewportProfile');
  assert.ok(entrySrc.includes('isCanvasRuntimeReady'), 'entry wrapper must expose isCanvasRuntimeReady');
  assert.ok(entrySrc.includes('isDetailRuntimeReady'), 'entry wrapper must expose isDetailRuntimeReady');
  assert.ok(entrySrc.includes('getBoundaryState'), 'entry wrapper must expose getBoundaryState');
  assert.ok(entrySrc.includes('createReadOnlyActions'), 'entry wrapper must expose createReadOnlyActions');
  assert.ok(entrySrc.includes('createMemorySelectors'), 'entry wrapper must expose createMemorySelectors');
  assert.ok(entrySrc.includes('createPublicCanvasConfig'), 'entry wrapper must expose createPublicCanvasConfig');
  assert.ok(entrySrc.includes('resolveTreeTitleText'), 'entry wrapper createPublicCanvasConfig must expose resolveTreeTitleText');
  assert.ok(entrySrc.includes('resolveMemoryThumbnail'), 'entry wrapper createPublicCanvasConfig must expose resolveMemoryThumbnail');
  assert.ok(entrySrc.includes('createInitialMemory'), 'entry wrapper createPublicCanvasConfig must expose createInitialMemory');
  assert.ok(entrySrc.includes('createEmptyGuideUpdater'), 'entry wrapper must expose createEmptyGuideUpdater');
  assert.ok(entrySrc.includes('canvasEmptyGuide'), 'entry wrapper empty guide updater must target canvasEmptyGuide');
  assert.ok(entrySrc.includes('editor-canvas-empty-guide-hidden'), 'entry wrapper empty guide updater must toggle hidden empty guide class');
  assert.ok(entrySrc.includes('installToolbarCompactMode'), 'entry wrapper must expose installToolbarCompactMode');
  assert.ok(entrySrc.includes('matchMedia'), 'entry wrapper toolbar compact helper must use matchMedia');
  assert.ok(entrySrc.includes('editor-canvas-toolbar'), 'entry wrapper toolbar compact helper must target editor canvas toolbar');
  assert.ok(entrySrc.includes('is-compact'), 'entry wrapper toolbar compact helper must toggle compact toolbar class');
  assert.ok(entrySrc.includes('createSelectionState'), 'entry wrapper must expose createSelectionState');
  assert.ok(entrySrc.includes('getSelectedNodeId'), 'entry wrapper selection state must expose getSelectedNodeId');
  assert.ok(entrySrc.includes('getCurrentEditingMemory'), 'entry wrapper selection state must expose getCurrentEditingMemory');
  assert.ok(entrySrc.includes('selectMemory'), 'entry wrapper selection state must expose selectMemory');
  assert.ok(entrySrc.includes('createDetailUIOptions'), 'entry wrapper must expose createDetailUIOptions');
  assert.ok(entrySrc.includes('publicCanvasConfig'), 'entry wrapper detail UI options must consume publicCanvasConfig');
  assert.ok(entrySrc.includes('readOnlyActions'), 'entry wrapper detail UI options must consume readOnlyActions');
  assert.ok(entrySrc.includes('selectionState'), 'entry wrapper detail UI options must consume selectionState');
  assert.ok(entrySrc.includes('updateSelectedMemoryFields'), 'entry wrapper detail UI options must preserve read-only detail update callback');
  assert.ok(entrySrc.includes('getCanonicalRootId'), 'entry wrapper createMemorySelectors must expose getCanonicalRootId');
  assert.ok(entrySrc.includes('isRootMemory'), 'entry wrapper createMemorySelectors must expose isRootMemory');
  assert.ok(entrySrc.includes('findFirstSelectableMemory'), 'entry wrapper createMemorySelectors must expose findFirstSelectableMemory');
  assert.ok(entrySrc.includes('createCanvasOptions'), 'entry wrapper must expose createCanvasOptions');
  assert.ok(entrySrc.includes('getTreeMemories'), 'entry wrapper canvas options must preserve getTreeMemories');
  assert.ok(entrySrc.includes('resolveMemoryThumbnail'), 'entry wrapper canvas options must preserve thumbnail resolver');
  assert.ok(entrySrc.includes('openAddMoment'), 'entry wrapper canvas options must preserve read-only add moment callback');
  assert.ok(entrySrc.includes('canEdit: false'), 'entry wrapper canvas options must force read-only mode');
  assert.ok(entrySrc.includes('createLoadFailureState'), 'entry wrapper must expose createLoadFailureState');
  assert.ok(entrySrc.includes('트리를 불러올 수 없어요'), 'entry wrapper load failure state must preserve Korean failure title');
  assert.ok(entrySrc.includes('Public endpoint returned an error'), 'entry wrapper load failure state must preserve fallback failure message');
  assert.ok(entrySrc.includes('error_outline'), 'entry wrapper load failure state must preserve failure icon');
  assert.ok(entrySrc.includes('installPublicEditorReadOnlyState'), 'entry wrapper must expose installPublicEditorReadOnlyState');
  assert.ok(entrySrc.includes('__editorCanvasInstance'), 'entry wrapper read-only state helper must store editor canvas instance');
  assert.ok(entrySrc.includes('LoveBudEditor'), 'entry wrapper read-only state helper must preserve LoveBudEditor global state');
  assert.ok(entrySrc.includes('canEdit = false'), 'entry wrapper read-only state helper must force canEdit false');
  assert.ok(entrySrc.includes('runPublicPostInitRefresh'), 'entry wrapper must expose runPublicPostInitRefresh');
  assert.ok(entrySrc.includes('updateCanvasEmptyGuide'), 'entry wrapper post-init refresh must call empty guide updater');
  assert.ok(entrySrc.includes('updateSidebarStatus'), 'entry wrapper post-init refresh must call sidebar status updater');
  assert.ok(entrySrc.includes('getCurrentEditingMemory'), 'entry wrapper post-init refresh must read current editing memory');
  assert.ok(entrySrc.includes('setDetailEmptyState(false)'), 'entry wrapper post-init refresh must preserve non-empty detail state update');
  assert.ok(entrySrc.includes('isPublicRuntimeReady'), 'entry wrapper must expose isPublicRuntimeReady');
  assert.ok(entrySrc.includes('isCanvasRuntimeReady() && isDetailRuntimeReady()'), 'entry wrapper runtime readiness must combine canvas and detail readiness');
  assert.ok(entrySrc.includes('Object.freeze'), 'entry wrapper must freeze the exported namespace');
});

test('public canvas init delegates metrics/profile setup through entry wrapper', () => {
  const initSrc = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(initSrc.includes('LoveBudPublicViewerCanvasEntry'), 'public canvas init must reference the entry wrapper');
  assert.ok(initSrc.includes('installPublicMetrics'), 'public canvas init must delegate installPublicMetrics through entry wrapper');
  assert.ok(initSrc.includes('installPublicViewportProfile'), 'public canvas init must delegate installPublicViewportProfile through entry wrapper');
  assert.ok(initSrc.includes('isCanvasRuntimeReady'), 'public canvas init must delegate isCanvasRuntimeReady through entry wrapper');
  assert.ok(initSrc.includes('isDetailRuntimeReady'), 'public canvas init must delegate isDetailRuntimeReady through entry wrapper');
  assert.ok(initSrc.includes('createReadOnlyActions'), 'public canvas init must delegate createReadOnlyActions through entry wrapper');
  assert.ok(initSrc.includes('readOnlyActions'), 'public canvas init must consume readOnlyActions from wrapper');
  assert.ok(initSrc.includes('readOnlyActions.getLocalSaveMode'), 'public canvas init must delegate getLocalSaveMode through readOnlyActions');
  assert.ok(initSrc.includes('readOnlyActions.showToast'), 'public canvas init must delegate showToast through readOnlyActions');
  assert.ok(initSrc.includes('readOnlyActions.noopAsync'), 'public canvas init must delegate noopAsync through readOnlyActions');
  assert.ok(initSrc.includes('readOnlyActions.noop'), 'public canvas init must delegate noop through readOnlyActions');
  assert.ok(initSrc.includes('readOnlyActions.noopFalseAsync'), 'public canvas init must delegate noopFalseAsync through readOnlyActions');
  assert.ok(initSrc.includes('createMemorySelectors'), 'public canvas init must delegate createMemorySelectors through entry wrapper');
  assert.ok(initSrc.includes('memorySelectors'), 'public canvas init must consume memorySelectors from wrapper');
  assert.ok(initSrc.includes('findFirstSelectableMemory'), 'public canvas init must delegate findFirstSelectableMemory through memorySelectors');
  assert.ok(initSrc.includes('createPublicCanvasConfig'), 'public canvas init must delegate createPublicCanvasConfig through entry wrapper');
  assert.ok(initSrc.includes('publicCanvasConfig'), 'public canvas init must consume publicCanvasConfig from wrapper');
  assert.ok(initSrc.includes('publicCanvasConfig.resolveTreeTitleText'), 'public canvas init must use delegated tree title resolver');
  assert.ok(initSrc.includes('publicCanvasConfig.resolveMemoryThumbnail'), 'public canvas init must use delegated thumbnail resolver');
  assert.ok(initSrc.includes('publicCanvasConfig.createInitialMemory'), 'public canvas init must use delegated initial memory builder');
  assert.ok(initSrc.includes('createEmptyGuideUpdater'), 'public canvas init must delegate createEmptyGuideUpdater through entry wrapper');
  assert.ok(initSrc.includes('updateCanvasEmptyGuide'), 'public canvas init must keep updateCanvasEmptyGuide call path');
  assert.ok(initSrc.includes('installToolbarCompactMode'), 'public canvas init must delegate toolbar compact mode through entry wrapper');
  assert.ok(initSrc.includes('canvasEntry.installToolbarCompactMode'), 'public canvas init must call delegated toolbar compact helper');
  assert.ok(initSrc.includes('createSelectionState'), 'public canvas init must delegate createSelectionState through entry wrapper');
  assert.ok(initSrc.includes('selectionState'), 'public canvas init must consume selectionState from wrapper');
  assert.ok(initSrc.includes('selectionState.getSelectedNodeId'), 'public canvas init must use delegated selected node getter');
  assert.ok(initSrc.includes('selectionState.selectMemory'), 'public canvas init must use delegated memory selector');
  assert.ok(initSrc.includes('selectionState.getCurrentEditingMemory'), 'public canvas init must use delegated current memory getter');
  assert.ok(initSrc.includes('createDetailUIOptions'), 'public canvas init must delegate detail UI options through entry wrapper');
  assert.ok(initSrc.includes('detailUIOptions'), 'public canvas init must consume detailUIOptions from wrapper');
  assert.ok(initSrc.includes('window.createPublicViewerDetailUI(detailUIOptions)'), 'public canvas init must pass delegated options into detail UI factory');
  assert.ok(initSrc.includes('getSelectedNodeId: selectionState.getSelectedNodeId'), 'fallback detail UI options must keep delegated selected node getter');
  assert.ok(initSrc.includes('createCanvasOptions'), 'public canvas init must delegate canvas options through entry wrapper');
  assert.ok(initSrc.includes('canvasOptions'), 'public canvas init must consume canvasOptions from wrapper');
  assert.ok(initSrc.includes('window.createEditorCanvas(canvasOptions)'), 'public canvas init must pass delegated options into canvas factory');
  assert.ok(initSrc.includes('onPublicCanvasNodeClick'), 'public canvas init must keep public canvas node click callback in init');
  assert.ok(initSrc.includes('editorCanvas.updateAffordance'), 'public canvas init must preserve affordance refresh in node click flow');
  assert.equal(
    initSrc.includes('window.createEditorCanvas({'),
    false,
    'public canvas init should not construct editor canvas options inline'
  );
  assert.ok(initSrc.includes('createLoadFailureState'), 'public canvas init must keep createLoadFailureState call path');
  assert.ok(initSrc.includes('canvasEntry.createLoadFailureState'), 'public canvas init must delegate load failure state through entry wrapper');
  assert.ok(initSrc.includes('typeof canvasEntry.createLoadFailureState === \'function\''), 'public canvas init must guard delegated load failure state helper');
  assert.ok(initSrc.includes('document.createElement'), 'public canvas init must retain fallback load failure DOM builder');
  assert.ok(initSrc.includes('installPublicEditorReadOnlyState'), 'public canvas init must delegate public editor read-only state through entry wrapper');
  assert.ok(initSrc.includes('canvasEntry.installPublicEditorReadOnlyState(canvas, editorCanvas)'), 'public canvas init must pass canvas and editorCanvas to delegated read-only state helper');
  assert.ok(initSrc.includes('window.LoveBudEditor.canEdit = false'), 'public canvas init must retain fallback canEdit false assignment');
  assert.ok(initSrc.includes('canvas.__editorCanvasInstance = editorCanvas'), 'public canvas init must retain fallback canvas instance storage');
  assert.ok(
    initSrc.indexOf('installPublicEditorReadOnlyState') < initSrc.indexOf('editorCanvas.initCanvas'),
    'public read-only state setup must remain before editorCanvas.initCanvas'
  );
  assert.ok(initSrc.includes('runPublicPostInitRefresh'), 'public canvas init must delegate post-init refresh through entry wrapper');
  assert.ok(initSrc.includes('canvasEntry.runPublicPostInitRefresh'), 'public canvas init must call delegated post-init refresh helper');
  assert.ok(initSrc.includes('updateCanvasEmptyGuide: updateCanvasEmptyGuide'), 'public canvas init must pass empty guide updater into post-init refresh helper');
  assert.ok(initSrc.includes('updateSidebarStatus: updateSidebarStatus'), 'public canvas init must pass sidebar updater into post-init refresh helper');
  assert.ok(initSrc.includes('selectionState: selectionState'), 'public canvas init must pass selectionState into post-init refresh helper');
  assert.ok(initSrc.includes('updateDetailPanel: updateDetailPanel'), 'public canvas init must pass detail panel updater into post-init refresh helper');
  assert.ok(initSrc.includes('setDetailEmptyState: setDetailEmptyState'), 'public canvas init must pass empty-state updater into post-init refresh helper');
  assert.ok(initSrc.includes('var currentEditingMemory = selectionState.getCurrentEditingMemory();'), 'public canvas init must retain fallback current memory refresh');
  assert.ok(
    initSrc.indexOf('editorCanvas.initCanvas') < initSrc.indexOf('runPublicPostInitRefresh'),
    'public post-init refresh must remain after editorCanvas.initCanvas'
  );
  assert.ok(initSrc.includes('isPublicRuntimeReady'), 'public canvas init must delegate combined runtime readiness through entry wrapper');
  assert.ok(initSrc.includes('canvasEntry.isPublicRuntimeReady'), 'public canvas init must call delegated runtime readiness helper');
  assert.ok(initSrc.includes('typeof window.createEditorCanvas === \'function\''), 'public canvas init must retain canvas runtime fallback readiness check');
  assert.ok(initSrc.includes('typeof window.createPublicViewerDetailUI === \'function\''), 'public canvas init must retain detail runtime fallback readiness check');
  assert.ok(
    initSrc.indexOf('isPublicRuntimeReady') < initSrc.indexOf('startCanvas();'),
    'public runtime readiness check must remain before startCanvas call'
  );
  assert.ok(initSrc.includes('function waitForModules'), 'public canvas init must keep waitForModules orchestration local');
  assert.ok(initSrc.includes('function startCanvas'), 'public canvas init must keep startCanvas orchestration local');
});
