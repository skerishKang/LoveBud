const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const canvasSource = fs.readFileSync('js/editor/editor-canvas.js', 'utf8').replace(/\r\n/g, '\n');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

function getInitCanvasBlock() {
  const start = indexOfRequired(canvasSource, 'const initCanvas = () => {');
  const endMarker = '\n    const layoutModeSwitcher = typeof layoutTransition.createLayoutModeSwitcher';
  const end = canvasSource.indexOf(endMarker, start);
  assert.notEqual(end, -1, 'initCanvas block must end before layout mode switcher');
  return canvasSource.slice(start, end);
}

const initCanvasBlock = getInitCanvasBlock();

test('editor canvas init computes render state before viewport and render work', () => {
  const canonicalRootIndex = indexOfRequired(initCanvasBlock, 'const canonicalRootId = getCanonicalRootId();');
  const treeMemoriesIndex = indexOfRequired(initCanvasBlock, 'const treeMemories = getTreeMemories();');
  const selectedNodeIndex = indexOfRequired(initCanvasBlock, 'selectedNodeId = selectionUtils.getSelectedMemoryId(document);');
  const drawableIndex = indexOfRequired(initCanvasBlock, 'const drawableMemories = treeMemories.filter((node) => !isRootMemory(node, canonicalRootId));');
  const rootMemoryIndex = indexOfRequired(initCanvasBlock, 'const rootMemory = treeMemories.find((node) => isRootMemory(node, canonicalRootId)) || null;');
  const shouldRenderRootIndex = indexOfRequired(initCanvasBlock, 'const shouldRenderRootNode = drawableMemories.length === 0 && !!rootMemory;');
  const hasVisibleNodesIndex = indexOfRequired(initCanvasBlock, 'const hasVisibleNodes = drawableMemories.length > 0 || shouldRenderRootNode;');

  assert.ok(canonicalRootIndex < treeMemoriesIndex);
  assert.ok(treeMemoriesIndex < selectedNodeIndex);
  assert.ok(selectedNodeIndex < drawableIndex);
  assert.ok(drawableIndex < rootMemoryIndex);
  assert.ok(rootMemoryIndex < shouldRenderRootIndex);
  assert.ok(shouldRenderRootIndex < hasVisibleNodesIndex);
});

test('editor canvas init keeps viewport prep and background before clearing', () => {
  const hasVisibleNodesIndex = indexOfRequired(initCanvasBlock, 'const hasVisibleNodes = drawableMemories.length > 0 || shouldRenderRootNode;');
  const prepareViewportIndex = indexOfRequired(initCanvasBlock, "if (hasVisibleNodes && typeof canvasViewport.prepareInitialViewport === 'function') {");
  const backgroundIndex = indexOfRequired(initCanvasBlock, 'canvas.style.backgroundPosition = `${viewportState.offsetX}px ${viewportState.offsetY}px`;');
  const clearNodesIndex = indexOfRequired(initCanvasBlock, 'renderUtils.clearCanvasNodes(canvas);');

  assert.ok(hasVisibleNodesIndex < prepareViewportIndex);
  assert.ok(prepareViewportIndex < backgroundIndex);
  assert.ok(backgroundIndex < clearNodesIndex);
});

test('editor canvas init clears render surfaces before state updates and drawing', () => {
  const clearNodesIndex = indexOfRequired(initCanvasBlock, 'renderUtils.clearCanvasNodes(canvas);');
  const clearBranchesIndex = indexOfRequired(initCanvasBlock, 'clearBranches();');
  const clearAffordanceIndex = indexOfRequired(initCanvasBlock, 'clearGrowthAffordance();');
  const emptyStateIndex = indexOfRequired(initCanvasBlock, 'setDetailEmptyState(!hasVisibleNodes);');
  const focusButtonIndex = indexOfRequired(initCanvasBlock, 'updateFocusSelectedBtn();');
  const rootDrawIndex = indexOfRequired(initCanvasBlock, 'drawNode(rootMemory);');
  const drawableLoopIndex = indexOfRequired(initCanvasBlock, 'drawableMemories.forEach((node) => {');

  assert.ok(clearNodesIndex < clearBranchesIndex);
  assert.ok(clearBranchesIndex < clearAffordanceIndex);
  assert.ok(clearAffordanceIndex < emptyStateIndex);
  assert.ok(emptyStateIndex < focusButtonIndex);
  assert.ok(focusButtonIndex < rootDrawIndex);
  assert.ok(rootDrawIndex < drawableLoopIndex);
});

test('editor canvas init draws nodes before selection and detail sync', () => {
  const drawableLoopIndex = indexOfRequired(initCanvasBlock, 'drawableMemories.forEach((node) => {');
  const drawNodeIndex = indexOfRequired(initCanvasBlock, 'drawNode(node);');
  const drawBranchIndex = indexOfRequired(initCanvasBlock, 'drawBranchForMemory(node, {');
  const selectionBlockIndex = indexOfRequired(initCanvasBlock, 'if (hasVisibleNodes) {');
  const selectedMemIndex = indexOfRequired(initCanvasBlock, 'let selectedMem = selectedNodeId');
  const findInitialIndex = indexOfRequired(initCanvasBlock, 'selectedMem = findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);');
  const reapplySelectionIndex = indexOfRequired(initCanvasBlock, 'reapplySelection(selectedMem.id);');
  const onNodeClickIndex = indexOfRequired(initCanvasBlock, 'onNodeClick(selectedEl, selectedMem);');
  const updateDetailIndex = indexOfRequired(initCanvasBlock, 'updateDetailPanel(selectedMem);');
  const renderAffordanceIndex = indexOfRequired(initCanvasBlock, 'renderAffordanceForMemory(selectedMem);');

  assert.ok(drawableLoopIndex < drawNodeIndex);
  assert.ok(drawNodeIndex < drawBranchIndex);
  assert.ok(drawBranchIndex < selectionBlockIndex);
  assert.ok(selectionBlockIndex < selectedMemIndex);
  assert.ok(selectedMemIndex < findInitialIndex);
  assert.ok(findInitialIndex < reapplySelectionIndex);
  assert.ok(reapplySelectionIndex < onNodeClickIndex);
  assert.ok(onNodeClickIndex < updateDetailIndex);
  assert.ok(updateDetailIndex < renderAffordanceIndex);
});

test('editor canvas init binds controls before marking viewport initialized', () => {
  const bindPanIndex = indexOfRequired(initCanvasBlock, 'bindCanvasPan();');
  const bindViewportIndex = indexOfRequired(initCanvasBlock, 'bindViewportControls();');
  const bindResizeIndex = indexOfRequired(initCanvasBlock, 'bindResizeHandling();');
  const bindLayoutIndex = indexOfRequired(initCanvasBlock, 'bindLayoutModeToggle();');
  const bindCompactIndex = indexOfRequired(initCanvasBlock, 'bindCompactModeToggle();');
  const initializedIndex = indexOfRequired(initCanvasBlock, 'viewportState.initialized = true;');
  const completeLogIndex = indexOfRequired(initCanvasBlock, "console.log(`[editor-canvas] initCanvas complete. Nodes rendered: ${document.querySelectorAll('.memory-node').length}`);");

  assert.ok(bindPanIndex < bindViewportIndex);
  assert.ok(bindViewportIndex < bindResizeIndex);
  assert.ok(bindResizeIndex < bindLayoutIndex);
  assert.ok(bindLayoutIndex < bindCompactIndex);
  assert.ok(bindCompactIndex < initializedIndex);
  assert.ok(initializedIndex < completeLogIndex);
});

test('editor canvas init contains no orphan appreciation-order initializer call', () => {
  assert.doesNotMatch(
    initCanvasBlock,
    /\binitAppreciationOrderManager\b/,
    'initCanvas must not call an unresolved appreciation-order initializer'
  );
  assert.doesNotMatch(
    initCanvasBlock,
    /\bappreciationOrderManager\b/,
    'initCanvas must not attach an appreciation-order manager without a reachable provider'
  );
});

test('editor canvas init preserves error fallback', () => {
  const catchIndex = indexOfRequired(initCanvasBlock, '} catch (error) {');
  const errorLogIndex = indexOfRequired(initCanvasBlock, 'console.error(`[editor-canvas] initCanvas failed to render nodes. Context: treeId=${treeId}, layoutMode=${viewportState.layoutMode}, selectedNodeId=${selectedNodeId}`, error);');
  const guardIndex = indexOfRequired(initCanvasBlock, "if (typeof setDetailEmptyState === 'function') {");
  const emptyTrueIndex = indexOfRequired(initCanvasBlock, 'setDetailEmptyState(true);');

  assert.ok(catchIndex < errorLogIndex);
  assert.ok(errorLogIndex < guardIndex);
  assert.ok(guardIndex < emptyTrueIndex);
});

test('editor canvas public instance API remains present', () => {
  const returnIndex = indexOfRequired(canvasSource, 'return {');
  const createCanvasEndIndex = indexOfRequired(canvasSource, '\n}\n\n// Bridge to window for legacy editor.js compatibility');
  const block = canvasSource.slice(returnIndex, createCanvasEndIndex);

  for (const apiName of [
    'addNodePosition',
    'calcPosition',
    'drawBranch',
    'drawNode',
    'initCanvas',
    'focusNodeById',
    'recenterViewport',
    'setLayoutMode',
    'updateAffordance',
    'getWorldPosition',
    'persistStoredPositions'
  ]) {
    assert.match(block, new RegExp(`\\b${apiName}\\b`), `${apiName} must remain in public instance API`);
  }

  assert.match(block, /get viewportState\(\) \{ return viewportState; \}/);
});

test('editor canvas legacy bridge shape remains present', () => {
  const createBridgeIndex = indexOfRequired(canvasSource, 'window.createEditorCanvas = createEditorCanvas;');
  const editorCanvasIndex = indexOfRequired(canvasSource, 'window.LoveBudEditorCanvas = {');
  const editorCanvasFactoryIndex = indexOfRequired(canvasSource, 'createEditorCanvas,');
  const bridgeInitIndex = indexOfRequired(canvasSource, "const instance = document.querySelector('#canvasArea')?.__editorCanvasInstance;");
  const bridgeCallIndex = indexOfRequired(canvasSource, 'if (instance) instance.initCanvas();');
  const legacyEditorIndex = indexOfRequired(canvasSource, 'window.LoveBudEditor = {');
  const legacyInitIndex = indexOfRequired(canvasSource, 'initCanvas: () => window.LoveBudEditorCanvas.initCanvas(),');
  const legacyRefreshIndex = indexOfRequired(canvasSource, 'refresh: () => window.LoveBudEditorCanvas.initCanvas(),');
  const legacyRenderIndex = indexOfRequired(canvasSource, 'render: () => window.LoveBudEditorCanvas.initCanvas()');

  assert.ok(createBridgeIndex < editorCanvasIndex);
  assert.ok(editorCanvasIndex < editorCanvasFactoryIndex);
  assert.ok(editorCanvasFactoryIndex < bridgeInitIndex);
  assert.ok(bridgeInitIndex < bridgeCallIndex);
  assert.ok(bridgeCallIndex < legacyEditorIndex);
  assert.ok(legacyEditorIndex < legacyInitIndex);
  assert.ok(legacyInitIndex < legacyRefreshIndex);
  assert.ok(legacyRefreshIndex < legacyRenderIndex);
});

test('editor canvas late-load bridge trigger remains after legacy bridge', () => {
  const legacyEditorIndex = indexOfRequired(canvasSource, 'window.LoveBudEditor = {');
  const lateLoadIndex = indexOfRequired(canvasSource, '(function() {');
  const readyStateIndex = indexOfRequired(canvasSource, "if (document.readyState === 'complete' || document.readyState === 'interactive') {");
  const dataReadyIndex = indexOfRequired(canvasSource, 'if (window.currentTreeMemories && window.currentTreeMemories.length > 0) {');
  const timeoutIndex = indexOfRequired(canvasSource, 'setTimeout(() => window.LoveBudEditorCanvas.initCanvas(), 100);');

  assert.ok(legacyEditorIndex < lateLoadIndex);
  assert.ok(lateLoadIndex < readyStateIndex);
  assert.ok(readyStateIndex < dataReadyIndex);
  assert.ok(dataReadyIndex < timeoutIndex);
});
