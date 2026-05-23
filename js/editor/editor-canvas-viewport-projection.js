window.LoveBudEditorCanvasViewportProjection = {
  projectWorldPosition(viewportApi, world, viewportState) {
    const scale = viewportApi.getScale(viewportState);
    return {
      x: world.x * scale + viewportState.offsetX,
      y: world.y * scale + viewportState.offsetY
    };
  }
};
