/**
 * LoveBud - Editor Canvas Viewport Actions Helper
 *
 * Extracted from editor-canvas-viewport.js to isolate DOM-dependent
 * viewport actions (focus node, recenter, zoom) from pure math.
 *
 * Loaded after editor-canvas-viewport.js, before editor-canvas-viewport-controls.js.
 *
 * @namespace LoveBudEditorCanvasViewportActions
 */
window.LoveBudEditorCanvasViewportActions = {

  /**
   * Centers the viewport on a specific node by ID.
   * @param {object} viewportApi - The viewport object (provides setScale, getScale, readableCenter)
   * @param {object} options
   */
  focusNodeById(viewportApi, options) {
    const { nodeId, getTreeMemories, getWorldPosition, getMetrics, viewportState, initCanvas, reapplySelection, findMemoryNodeById } = options;
    if (!nodeId) return;
    const treeMemories = getTreeMemories();
    const target = treeMemories.find((memory) => memory.id === nodeId);
    if (!target) return;

    const world = getWorldPosition(target);
    const metrics = getMetrics();
    viewportApi.setScale(viewportState, 1);
    const scale = viewportApi.getScale(viewportState);
    viewportState.offsetX = Math.round(metrics.width * viewportApi.readableCenter.x - (world.x * scale));
    viewportState.offsetY = Math.round(metrics.height * viewportApi.readableCenter.y - (world.y * scale));
    initCanvas();
    reapplySelection(nodeId);

    requestAnimationFrame(() => {
      var nodeEl = null;
      if (typeof findMemoryNodeById === 'function') {
        nodeEl = findMemoryNodeById(nodeId);
      }
      if (nodeEl) {
        nodeEl.classList.remove('focus-animate');
        void nodeEl.offsetWidth;
        nodeEl.classList.add('focus-animate');
      }
    });
  },

  /**
   * Re-centers the viewport to fit the full tree.
   * @param {object} viewportApi - The viewport object (provides setScale, getFitViewport, isAlreadyAtFit, showAlreadyAtFitFeedback, applyViewport)
   * @param {object} options
   */
  recenterViewport(viewportApi, options) {
    const { getTreeMemories, viewportState, initCanvas } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) {
      viewportState.offsetX = 0;
      viewportState.offsetY = 0;
      viewportApi.setScale(viewportState, 1);
      initCanvas();
      return;
    }

    const fitViewport = viewportApi.getFitViewport(options);

    // If already at the optimal tree-fit view, show feedback instead of re-applying
    if (viewportApi.isAlreadyAtFit(viewportState, fitViewport)) {
      viewportApi.showAlreadyAtFitFeedback();
      return;
    }

    viewportApi.applyViewport(viewportState, fitViewport, true);
    initCanvas();
  },

  /**
   * Zooms in or out by one preset level, preserving the readable center world point.
   * @param {object} viewportApi - The viewport object (provides getNearestZoom, getNextZoom, setScale, readableCenter)
   * @param {object} options
   */
  zoomBy(viewportApi, options) {
    const { factor, viewportState, getMetrics, initCanvas } = options;
    const oldScale = viewportApi.getNearestZoom(viewportState.scale || 1);
    const nextScale = viewportApi.getNextZoom(oldScale, factor >= 1 ? 1 : -1);
    if (nextScale === oldScale) return;

    const metrics = getMetrics();
    const centerWorldX = (metrics.width * viewportApi.readableCenter.x - viewportState.offsetX) / oldScale;
    const centerWorldY = (metrics.height * viewportApi.readableCenter.y - viewportState.offsetY) / oldScale;

    viewportApi.setScale(viewportState, nextScale);
    viewportState.offsetX = Math.round(metrics.width * viewportApi.readableCenter.x - (centerWorldX * nextScale));
    viewportState.offsetY = Math.round(metrics.height * viewportApi.readableCenter.y - (centerWorldY * nextScale));
    initCanvas();
  },

  /**
   * Zooms to a specific scale while anchoring the given local canvas point.
   * The world coordinate under the pointer remains fixed.
   * @param {object} viewportApi - The viewport object (provides getNearestZoom, getNextZoom, setScale, minScale, maxScale)
   * @param {object} options
   */
  zoomAtPoint(viewportApi, options) {
    const {
      scale,
      localX,
      localY,
      viewportState,
      initCanvas
    } = options;

    const oldScale = viewportApi.getNearestZoom(viewportState.scale || 1);
    const nextScale = viewportApi.getNearestZoom(Math.min(viewportApi.maxScale, Math.max(viewportApi.minScale, scale)));

    if (nextScale === oldScale) return;

    const worldX = (localX - viewportState.offsetX) / oldScale;
    const worldY = (localY - viewportState.offsetY) / oldScale;

    viewportApi.setScale(viewportState, nextScale);
    viewportState.offsetX = Math.round(localX - worldX * nextScale);
    viewportState.offsetY = Math.round(localY - worldY * nextScale);

    initCanvas();
  },
};
