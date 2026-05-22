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

    window.LoveBudEditorCanvasPanzoom = {
        calculateZoomScale,
        calculateFocusOffset,
        calculateRecenterOffset,
        getFitViewportIfAvailable
    };
})();
