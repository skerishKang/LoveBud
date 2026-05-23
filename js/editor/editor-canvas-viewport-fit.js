window.LoveBudEditorCanvasViewportFit = {
  getReadableViewportOffset(viewportNamespace, options, preferredScale = 1) {
    const { getWorldPosition, getMetrics } = options;
    const targets = viewportNamespace.getViewportTargets(options);
    if (!targets.length) return null;

    const scale = viewportNamespace.getNearestZoom(preferredScale);
    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    return {
      scale,
      offsetX: Math.round(metrics.width * viewportNamespace.readableCenter.x - (((minX + maxX) / 2) * scale)),
      offsetY: Math.round(metrics.height * viewportNamespace.readableCenter.y - (((minY + maxY) / 2) * scale))
    };
  },

  getFitViewport(viewportNamespace, options) {
    const { getWorldPosition, getMetrics } = options;
    const targets = viewportNamespace.getViewportTargets(options);
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
    const fitScale = viewportNamespace.getFitZoom(rawFitScale);

    return {
      scale: fitScale,
      offsetX: Math.round(metrics.width * viewportNamespace.readableCenter.x - (((minX + maxX) / 2) * fitScale)),
      offsetY: Math.round(metrics.height * viewportNamespace.readableCenter.y - (((minY + maxY) / 2) * fitScale))
    };
  }
};
