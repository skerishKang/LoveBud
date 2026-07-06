/**
 * Finds the initial memory node to focus or display when the canvas loads.
 * It looks for the first visible child of the hidden system root.
 */
export function findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId) {
    const rootMemory = treeMemories.find(function(m) {
        return m && (m.parentId === null || m.parentId === undefined);
    });
    if (rootMemory) {
        var firstChild = drawableMemories.find(function(m) {
            return m && m.parentId === rootMemory.id;
        });
        if (firstChild) return firstChild;
    }
    return drawableMemories[0] || null;
}

/**
 * Checks if a specific position is within the safe viewport padding.
 */
export function isNodeWithinSafeViewport(pos, metrics) {
    const padding = 96;
    return pos.x >= padding && pos.x <= metrics.width - padding && pos.y >= padding && pos.y <= metrics.height - padding;
}

/**
 * Determines the world coordinates of a memory node based on layout mode.
 */
export function getWorldPosition(mem, deps) {
    const {
        layoutMode,
        viewportState,
        getCanonicalRootId,
        getTreeMemories,
        isRootMemory,
        getMetrics,
        layoutPolicy
    } = deps;

    if (layoutMode === 'structured') {
        return window.EditorCanvasGeometry.getStructuredWorldPosition(
            mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics, layoutPolicy
        );
    }
    return window.EditorCanvasGeometry.getWorldPosition(
        mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics
    );
}

/**
 * Projects world coordinates into the current viewport.
 */
export function calcPosition(mem, deps) {
    const {
        getWorldPosition,
        canvasViewport,
        viewportState
    } = deps;

    const world = getWorldPosition(mem, deps);
    if (canvasViewport && typeof canvasViewport.projectWorldPosition === 'function') {
        return canvasViewport.projectWorldPosition(world, viewportState);
    }
    return { x: world.x + viewportState.offsetX, y: world.y + viewportState.offsetY };
}

