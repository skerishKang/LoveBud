(function() {
    /**
     * Calculates the new scale after applying a zoom factor.
     */
    function calculateZoomScale(currentScale, factor) {
        const oldScale = currentScale || 1;
        const newScale = factor >= 1 ? Math.min(1.5, oldScale + 0.25) : Math.max(0.2, oldScale - 0.25);
        return newScale;
    }

    /**
     * Calculates the offset required to center the viewport around a specific world point.
     */
    function calculateFocusOffset(worldX, worldY, scale, metrics) {
        return {
            offsetX: Math.round(metrics.width * 0.5 - (worldX * scale)),
            offsetY: Math.round(metrics.height * 0.38 - (worldY * scale))
        };
    }

    /**
     * Calculates the offset required to recenter the viewport around all given world points.
     */
    function calculateRecenterOffset(points, metrics) {
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
    function getFitViewportIfAvailable(canvasViewport, deps) {
        if (!canvasViewport || typeof canvasViewport.getFitViewport !== 'function') return null;
        return canvasViewport.getFitViewport(deps);
    }

    /**
     * Handles the viewport centering and scaling logic.
     */
    function fitViewportToTree(deps) {
        const {
            panzoomUtils,
            canvasViewport,
            viewportState,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics
        } = deps;

        let nextViewport = null;
        if (typeof panzoomUtils.getFitViewportIfAvailable === 'function') {
            nextViewport = panzoomUtils.getFitViewportIfAvailable(canvasViewport, {
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState
            });
        } else if (typeof canvasViewport.getFitViewport === 'function') {
            nextViewport = canvasViewport.getFitViewport({
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState
            });
        }
        
        if (!nextViewport) return;
        if (typeof canvasViewport.applyViewport === 'function') {
            canvasViewport.applyViewport(viewportState, nextViewport, true);
            return;
        }
        viewportState.scale = nextViewport.scale || viewportState.scale || 1;
        viewportState.offsetX = nextViewport.offsetX;
        viewportState.offsetY = nextViewport.offsetY;
    }

    /**
     * Zooms the viewport by a given factor.
     */
    function zoomBy(factor, deps) {
        const {
            viewportState,
            canvasViewport,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            persistStoredPositions
        } = deps;

        if (typeof canvasViewport.zoomBy === 'function') {
            canvasViewport.zoomBy({
                factor,
                viewportState,
                getMetrics,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }

        if (typeof panzoomUtils.calculateZoomScale === 'function') {
            const newScale = panzoomUtils.calculateZoomScale(viewportState.scale, factor);
            if (newScale === viewportState.scale) return;
            viewportState.scale = newScale;
        } else {
            // Fallback
            const oldScale = viewportState.scale || 1;
            const newScale = factor >= 1 ? Math.min(1.5, oldScale + 0.25) : Math.max(0.2, oldScale - 0.25);
            if (newScale === oldScale) return;
            viewportState.scale = newScale;
        }

        scheduleRender();
        persistStoredPositions();
    }

    /**
     * Focuses the viewport on a specific node.
     */
    function focusNodeById(nodeId, deps) {
        const {
            viewportState,
            canvasViewport,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            reapplySelection,
            persistStoredPositions
        } = deps;

        if (typeof canvasViewport.focusNodeById === 'function') {
            canvasViewport.focusNodeById({
                nodeId,
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas: scheduleRender,
                reapplySelection
            });
            persistStoredPositions();
            return;
        }

        if (!nodeId) return;
        const treeMemories = getTreeMemories();
        const target = treeMemories.find((m) => m.id === nodeId);
        if (!target) return;

        const world = getWorldPosition(target);
        const metrics = getMetrics();
        const scale = viewportState.scale || 1;
        
        if (typeof panzoomUtils.calculateFocusOffset === 'function') {
            const offset = panzoomUtils.calculateFocusOffset(world.x, world.y, scale, metrics);
            viewportState.offsetX = offset.offsetX;
            viewportState.offsetY = offset.offsetY;
        } else {
            // Fallback
            viewportState.offsetX = Math.round(metrics.width * 0.5 - (world.x * scale));
            viewportState.offsetY = Math.round(metrics.height * 0.38 - (world.y * scale));
        }
        
        scheduleRender();
        reapplySelection(nodeId);
        persistStoredPositions();
    }

    /**
     * Recenters the viewport to show all nodes.
     */
    function recenterViewport(deps) {
        const {
            viewportState,
            canvasViewport,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            persistStoredPositions
        } = deps;

        if (typeof canvasViewport.recenterViewport === 'function') {
            canvasViewport.recenterViewport({
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }

        const treeMemories = getTreeMemories();
        if (!treeMemories.length) {
            viewportState.offsetX = 0;
            viewportState.offsetY = 0;
            viewportState.scale = 1;
            scheduleRender();
            persistStoredPositions();
            return;
        }

        const points = treeMemories.map((mem) => getWorldPosition(mem));
        const metrics = getMetrics();
        
        if (typeof panzoomUtils.calculateRecenterOffset === 'function') {
            const offset = panzoomUtils.calculateRecenterOffset(points, metrics);
            viewportState.offsetX = offset.offsetX;
            viewportState.offsetY = offset.offsetY;
        } else {
            // Fallback
            const minX = Math.min(...points.map((p) => p.x));
            const maxX = Math.max(...points.map((p) => p.x));
            const minY = Math.min(...points.map((p) => p.y));
            const maxY = Math.max(...points.map((p) => p.y));
            viewportState.offsetX = Math.round(metrics.width * 0.5 - ((minX + maxX) / 2));
            viewportState.offsetY = Math.round(metrics.height * 0.38 - ((minY + maxY) / 2));
        }

        scheduleRender();
        persistStoredPositions();
    }

    window.LoveBudEditorCanvasPanzoom = {
        calculateZoomScale,
        calculateFocusOffset,
        calculateRecenterOffset,
        getFitViewportIfAvailable,
        fitViewportToTree,
        zoomBy,
        focusNodeById,
        recenterViewport
    };
})();
