window.LoveBudEditorCanvasViewportScale = {
  getNearestZoom(viewportApi, scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return viewportApi.zoomLevels.reduce((best, candidate) => (
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
    ), 1);
  },

  getFitZoom(viewportApi, scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    const clamped = Math.min(viewportApi.maxScale, Math.max(viewportApi.minScale, value));
    return viewportApi.zoomLevels.reduce((best, candidate) => (
      candidate <= clamped && candidate > best ? candidate : best
    ), viewportApi.minScale);
  },

  getNextZoom(viewportApi, scale, direction) {
    const current = viewportApi.getNearestZoom(scale);
    const index = viewportApi.zoomLevels.indexOf(current);
    if (direction > 0) return viewportApi.zoomLevels[Math.min(viewportApi.zoomLevels.length - 1, index + 1)];
    return viewportApi.zoomLevels[Math.max(0, index - 1)];
  },

  getScale(viewportApi, viewportState) {
    const scale = Number(viewportState && viewportState.scale);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(viewportApi.maxScale, Math.max(viewportApi.minScale, scale));
  },

  setScale(viewportApi, viewportState, nextScale) {
    viewportState.scale = viewportApi.getNearestZoom(Math.min(viewportApi.maxScale, Math.max(viewportApi.minScale, Number(nextScale) || 1)));
  },

  setFitScale(viewportApi, viewportState, nextScale) {
    viewportState.scale = viewportApi.getFitZoom(nextScale);
  }
};
