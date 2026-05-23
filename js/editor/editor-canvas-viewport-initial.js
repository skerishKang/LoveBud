window.LoveBudEditorCanvasViewportInitial = {
  prepareInitialViewport(viewportApi, options) {
    const { viewportState } = options;
    viewportApi.setScale(viewportState, viewportState.scale || 1);
    if (viewportState.initialViewportApplied) return;
    viewportState.initialViewportApplied = true;

    // Always fit the full tree viewport on initial load,
    // regardless of any previously stored viewport offset.
    viewportApi.applyViewport(viewportState, viewportApi.getFitViewport(options), true);
  }
};
