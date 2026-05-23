window.LoveBudEditorCanvasViewport = {
  minScale: 0.2,
  maxScale: 1.5,
  zoomLevels: [0.2, 0.35, 0.5, 0.75, 1, 1.25, 1.5],
  readableCenter: {
    x: 0.5,
    y: 0.42
  },

  getNearestZoom(scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return this.zoomLevels.reduce((best, candidate) => (
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
    ), 1);
  },

  getFitZoom(scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, value));
    return this.zoomLevels.reduce((best, candidate) => (
      candidate <= clamped && candidate > best ? candidate : best
    ), this.minScale);
  },

  getNextZoom(scale, direction) {
    const current = this.getNearestZoom(scale);
    const index = this.zoomLevels.indexOf(current);
    if (direction > 0) return this.zoomLevels[Math.min(this.zoomLevels.length - 1, index + 1)];
    return this.zoomLevels[Math.max(0, index - 1)];
  },

  getScale(viewportState) {
    const scale = Number(viewportState && viewportState.scale);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  },

  setScale(viewportState, nextScale) {
    viewportState.scale = this.getNearestZoom(Math.min(this.maxScale, Math.max(this.minScale, Number(nextScale) || 1)));
  },

  setFitScale(viewportState, nextScale) {
    viewportState.scale = this.getFitZoom(nextScale);
  },

  projectWorldPosition(world, viewportState) {
    const scale = this.getScale(viewportState);
    return {
      x: world.x * scale + viewportState.offsetX,
      y: world.y * scale + viewportState.offsetY
    };
  },

  getViewportTargets(options) {
    const { getTreeMemories, getCanonicalRootId, isRootMemory } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) return [];

    if (typeof getCanonicalRootId !== 'function' || typeof isRootMemory !== 'function') {
      return treeMemories;
    }

    const canonicalRootId = getCanonicalRootId();
    const visibleNodes = treeMemories.filter((memory) => !isRootMemory(memory, canonicalRootId));
    if (visibleNodes.length) return visibleNodes;

    const rootMemory = treeMemories.find((memory) => isRootMemory(memory, canonicalRootId));
    return rootMemory ? [rootMemory] : [];
  },

  isStoredViewportExtreme(options) {
    if (!window.LoveBudEditorCanvasViewportState ||
        typeof window.LoveBudEditorCanvasViewportState.isStoredViewportExtreme !== 'function') {
      return false;
    }
    return window.LoveBudEditorCanvasViewportState.isStoredViewportExtreme(this, options);
  },

  applyViewport(viewportState, nextViewport, useFitScale = false) {
    if (!window.LoveBudEditorCanvasViewportState ||
        typeof window.LoveBudEditorCanvasViewportState.applyViewport !== 'function') {
      return false;
    }
    return window.LoveBudEditorCanvasViewportState.applyViewport(this, viewportState, nextViewport, useFitScale);
  },

  isAlreadyAtFit(viewportState, fitViewport) {
    if (!window.LoveBudEditorCanvasViewportState ||
        typeof window.LoveBudEditorCanvasViewportState.isAlreadyAtFit !== 'function') {
      return false;
    }
    return window.LoveBudEditorCanvasViewportState.isAlreadyAtFit(this, viewportState, fitViewport);
  },

  getReadableViewportOffset(options, preferredScale = 1) {
    if (!window.LoveBudEditorCanvasViewportFit ||
        typeof window.LoveBudEditorCanvasViewportFit.getReadableViewportOffset !== 'function') {
      return null;
    }
    return window.LoveBudEditorCanvasViewportFit.getReadableViewportOffset(this, options, preferredScale);
  },

  getFitViewport(options) {
    if (!window.LoveBudEditorCanvasViewportFit ||
        typeof window.LoveBudEditorCanvasViewportFit.getFitViewport !== 'function') {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    return window.LoveBudEditorCanvasViewportFit.getFitViewport(this, options);
  },

  showAlreadyAtFitFeedback() {
    if (!window.LoveBudEditorCanvasViewportFeedback ||
        typeof window.LoveBudEditorCanvasViewportFeedback.showAlreadyAtFitFeedback !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportFeedback.showAlreadyAtFitFeedback();
  },

  prepareInitialViewport(options) {
    if (!window.LoveBudEditorCanvasViewportInitial ||
        typeof window.LoveBudEditorCanvasViewportInitial.prepareInitialViewport !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportInitial.prepareInitialViewport(this, options);
  },

  drawBranch(svg, startPos, endPos) {
    if (!window.LoveBudEditorCanvasViewportBranches ||
        typeof window.LoveBudEditorCanvasViewportBranches.drawBranch !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportBranches.drawBranch(svg, startPos, endPos);
  },

  focusNodeById(options) {
    if (!window.LoveBudEditorCanvasViewportActions ||
        typeof window.LoveBudEditorCanvasViewportActions.focusNodeById !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportActions.focusNodeById(this, options);
  },

  recenterViewport(options) {
    if (!window.LoveBudEditorCanvasViewportActions ||
        typeof window.LoveBudEditorCanvasViewportActions.recenterViewport !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportActions.recenterViewport(this, options);
  },

  zoomBy(options) {
    if (!window.LoveBudEditorCanvasViewportActions ||
        typeof window.LoveBudEditorCanvasViewportActions.zoomBy !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportActions.zoomBy(this, options);
  },

  bindControls(options) {
    if (!window.LoveBudEditorCanvasViewportControls ||
        typeof window.LoveBudEditorCanvasViewportControls.bindControls !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportControls.bindControls(this, options);
  }
};
