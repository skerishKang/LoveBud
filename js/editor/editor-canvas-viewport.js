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

  getReadableViewportOffset(options, preferredScale = 1) {
    const { getWorldPosition, getMetrics } = options;
    const targets = this.getViewportTargets(options);
    if (!targets.length) return null;

    const scale = this.getNearestZoom(preferredScale);
    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    return {
      scale,
      offsetX: Math.round(metrics.width * this.readableCenter.x - (((minX + maxX) / 2) * scale)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - (((minY + maxY) / 2) * scale))
    };
  },

  getFitViewport(options) {
    const { getWorldPosition, getMetrics } = options;
    const targets = this.getViewportTargets(options);
    if (!targets.length) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }

    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();
    const padding = Math.min(160, Math.max(72, Math.round(metrics.width * 0.10)));
    const nodeBoundsPadding = 180;
    const boundsWidth = Math.max(1, maxX - minX + nodeBoundsPadding);
    const boundsHeight = Math.max(1, maxY - minY + nodeBoundsPadding);
    const availableWidth = Math.max(1, metrics.width - (padding * 2));
    const availableHeight = Math.max(1, metrics.height - (padding * 2));
    const rawFitScale = Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight);
    const fitScale = this.getFitZoom(rawFitScale);

    return {
      scale: fitScale,
      offsetX: Math.round(metrics.width * this.readableCenter.x - (((minX + maxX) / 2) * fitScale)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - (((minY + maxY) / 2) * fitScale))
    };
  },

  isStoredViewportExtreme(options) {
    const { viewportState, getMetrics } = options;
    const metrics = getMetrics();
    const margin = Math.max(200, Math.round(metrics.width * 0.25));
    const minOkX = -metrics.width - margin;
    const maxOkX = metrics.width + margin;
    const minOkY = -metrics.height - margin;
    const maxOkY = metrics.height + margin;
    return (
      viewportState.offsetX < minOkX || viewportState.offsetX > maxOkX ||
      viewportState.offsetY < minOkY || viewportState.offsetY > maxOkY
    );
  },

  applyViewport(viewportState, nextViewport, useFitScale = false) {
    if (!nextViewport) return false;
    if (useFitScale) {
      this.setFitScale(viewportState, nextViewport.scale);
    } else {
      this.setScale(viewportState, nextViewport.scale);
    }
    viewportState.offsetX = nextViewport.offsetX;
    viewportState.offsetY = nextViewport.offsetY;
    return true;
  },

  isAlreadyAtFit(viewportState, fitViewport) {
    if (!fitViewport) return false;
    const scaleDiff = Math.abs((viewportState.scale || 1) - fitViewport.scale);
    const offsetDiffX = Math.abs(viewportState.offsetX - fitViewport.offsetX);
    const offsetDiffY = Math.abs(viewportState.offsetY - fitViewport.offsetY);
    return scaleDiff < 0.01 && offsetDiffX < 5 && offsetDiffY < 5;
  },

  showAlreadyAtFitFeedback() {
    if (window.LoveBudUI && typeof window.LoveBudUI.showToast === 'function') {
      window.LoveBudUI.showToast('이미 전체 트리가 보이고 있습니다', 'info', 2000);
    }
  },

  prepareInitialViewport(options) {
    const { viewportState } = options;
    this.setScale(viewportState, viewportState.scale || 1);
    if (viewportState.initialViewportApplied) return;
    viewportState.initialViewportApplied = true;

    // Always fit the full tree viewport on initial load,
    // regardless of any previously stored viewport offset.
    this.applyViewport(viewportState, this.getFitViewport(options), true);
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
