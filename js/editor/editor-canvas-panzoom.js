/**
 * Calculates the new scale after applying a zoom factor.
 */
export function calculateZoomScale(currentScale, factor) {
    const oldScale = currentScale || 1;
    const newScale = factor >= 1 ? Math.min(1.5, oldScale + 0.25) : Math.max(0.2, oldScale - 0.25);
    return newScale;
}

/**
 * Calculates the offset required to center the viewport around a specific world point.
 */
export function calculateFocusOffset(worldX, worldY, scale, metrics) {
    return {
        offsetX: Math.round(metrics.width * 0.5 - (worldX * scale)),
        offsetY: Math.round(metrics.height * 0.38 - (worldY * scale))
    };
}

/**
 * Calculates the offset required to recenter the viewport around all given world points.
 */
export function calculateRecenterOffset(points, metrics) {
    if (!points || !points.length) {
        return { offsetX: 0, offsetY: 0 };
    }
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    return {
        offsetX: Math.round(metrics.width * 0.5 - ((minX + maxX) / 2)),
        offsetY: Math.round(metrics.height * 0.38 - ((minY + maxY) / 2))
    };
}

/**
 * Attempts to calculate a fit viewport if a canvasViewport delegate is provided.
 */
export function getFitViewportIfAvailable(canvasViewport, deps) {
    if (!canvasViewport || typeof canvasViewport.getFitViewport !== 'function') return null;
    return canvasViewport.getFitViewport(deps);
}

/**
 * Fallback orchestration for focusNodeById when no canvasViewport delegate exists.
 * Returns true if the focus was applied, false otherwise.
 */
export function focusNodeByIdFallback(options) {
    const {
        nodeId,
        getTreeMemories,
        getWorldPosition,
        getMetrics,
        viewportState,
        scheduleRender,
        reapplySelection,
        persistStoredPositions
    } = options;

    if (!nodeId) return false;

    const treeMemories = getTreeMemories();
    const target = treeMemories.find((memory) => memory.id === nodeId);
    if (!target) return false;

    const world = getWorldPosition(target);
    const metrics = getMetrics();
    const scale = viewportState.scale || 1;
    const offset = calculateFocusOffset(world.x, world.y, scale, metrics);

    viewportState.offsetX = offset.offsetX;
    viewportState.offsetY = offset.offsetY;

    scheduleRender();
    reapplySelection(nodeId);
    persistStoredPositions();

    return true;
}

/**
 * Fallback orchestration for recenterViewport when no canvasViewport delegate exists.
 * Returns true when recenter was applied.
 */
export function recenterViewportFallback(options) {
    const {
        getTreeMemories,
        getWorldPosition,
        getMetrics,
        viewportState,
        scheduleRender,
        persistStoredPositions
    } = options;

    const treeMemories = getTreeMemories();

    if (!treeMemories.length) {
        viewportState.offsetX = 0;
        viewportState.offsetY = 0;
        viewportState.scale = 1;
        scheduleRender();
        persistStoredPositions();
        return true;
    }

    const points = treeMemories.map((memory) => getWorldPosition(memory));
    const metrics = getMetrics();
    const offset = calculateRecenterOffset(points, metrics);

    viewportState.offsetX = offset.offsetX;
    viewportState.offsetY = offset.offsetY;

    scheduleRender();
    persistStoredPositions();

    return true;
}

