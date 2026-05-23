window.LoveBudEditorCanvasViewportState = {
  isStoredViewportExtreme(viewportApi, options) {
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

  applyViewport(viewportApi, viewportState, nextViewport, useFitScale) {
    if (!nextViewport) return false;
    if (useFitScale) {
      viewportApi.setFitScale(viewportState, nextViewport.scale);
    } else {
      viewportApi.setScale(viewportState, nextViewport.scale);
    }
    viewportState.offsetX = nextViewport.offsetX;
    viewportState.offsetY = nextViewport.offsetY;
    return true;
  },

  isAlreadyAtFit(viewportApi, viewportState, fitViewport) {
    if (!fitViewport) return false;
    const scaleDiff = Math.abs((viewportState.scale || 1) - fitViewport.scale);
    const offsetDiffX = Math.abs(viewportState.offsetX - fitViewport.offsetX);
    const offsetDiffY = Math.abs(viewportState.offsetY - fitViewport.offsetY);
    return scaleDiff < 0.01 && offsetDiffX < 5 && offsetDiffY < 5;
  }
};
