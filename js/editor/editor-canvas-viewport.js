window.LoveBudEditorCanvasViewport = {
  minScale: 0.2,
  maxScale: 1.5,
  zoomLevels: [0.2, 0.35, 0.5, 0.75, 1, 1.25, 1.5],
  readableCenter: {
    x: 0.5,
    y: 0.42
  },

  getNearestZoom(scale) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.getNearestZoom !== 'function') {
      return 1;
    }
    return window.LoveBudEditorCanvasViewportScale.getNearestZoom(this, scale);
  },

  getFitZoom(scale) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.getFitZoom !== 'function') {
      return 1;
    }
    return window.LoveBudEditorCanvasViewportScale.getFitZoom(this, scale);
  },

  getNextZoom(scale, direction) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.getNextZoom !== 'function') {
      return this.getNearestZoom(scale);
    }
    return window.LoveBudEditorCanvasViewportScale.getNextZoom(this, scale, direction);
  },

  getScale(viewportState) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.getScale !== 'function') {
      return 1;
    }
    return window.LoveBudEditorCanvasViewportScale.getScale(this, viewportState);
  },

  setScale(viewportState, nextScale) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.setScale !== 'function') {
      if (viewportState) viewportState.scale = 1;
      return;
    }
    return window.LoveBudEditorCanvasViewportScale.setScale(this, viewportState, nextScale);
  },

  setFitScale(viewportState, nextScale) {
    if (!window.LoveBudEditorCanvasViewportScale ||
        typeof window.LoveBudEditorCanvasViewportScale.setFitScale !== 'function') {
      if (viewportState) viewportState.scale = 1;
      return;
    }
    return window.LoveBudEditorCanvasViewportScale.setFitScale(this, viewportState, nextScale);
  },

  projectWorldPosition(world, viewportState) {
    if (!window.LoveBudEditorCanvasViewportProjection ||
        typeof window.LoveBudEditorCanvasViewportProjection.projectWorldPosition !== 'function') {
      const scale = this.getScale(viewportState);
      return {
        x: world.x * scale + viewportState.offsetX,
        y: world.y * scale + viewportState.offsetY
      };
    }
    return window.LoveBudEditorCanvasViewportProjection.projectWorldPosition(this, world, viewportState);
  },

  getViewportTargets(options) {
    if (!window.LoveBudEditorCanvasViewportTargets ||
        typeof window.LoveBudEditorCanvasViewportTargets.getViewportTargets !== 'function') {
      const { getTreeMemories } = options;
      return typeof getTreeMemories === 'function' ? getTreeMemories() : [];
    }
    return window.LoveBudEditorCanvasViewportTargets.getViewportTargets(this, options);
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

  zoomAtPoint(options) {
    if (!window.LoveBudEditorCanvasViewportActions ||
        typeof window.LoveBudEditorCanvasViewportActions.zoomAtPoint !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportActions.zoomAtPoint(this, options);
  },

  bindControls(options) {
    if (!window.LoveBudEditorCanvasViewportControls ||
        typeof window.LoveBudEditorCanvasViewportControls.bindControls !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportControls.bindControls(this, options);
  },

  bindWheelZoom(options) {
    if (!window.LoveBudEditorCanvasViewportControls ||
        typeof window.LoveBudEditorCanvasViewportControls.bindWheelZoom !== 'function') {
      return;
    }
    return window.LoveBudEditorCanvasViewportControls.bindWheelZoom(this, options);
  },
};
