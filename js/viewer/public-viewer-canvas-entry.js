(function () {
    'use strict';

    var globalObject = window;

    function getCanvasRuntime() {
        return globalObject.LoveBudEditorCanvas
            || globalObject.EditorCanvas
            || globalObject.createEditorCanvas
            || null;
    }

    function hasCanvasRuntime() {
        return Boolean(getCanvasRuntime());
    }

    function isCanvasRuntimeReady() {
        return typeof globalObject.createEditorCanvas === 'function';
    }

    function isDetailRuntimeReady() {
        return typeof globalObject.createPublicViewerDetailUI === 'function';
    }

    function installPublicMetrics(canvas) {
        var geometry = globalObject.EditorCanvasGeometry;
        if (!geometry || typeof geometry.getMetrics !== 'function') return;
        if (geometry.__publicViewMetricsInstalled) return;
        var originalGetMetrics = geometry.getMetrics;
        geometry.getMetrics = function(targetCanvas) {
            var node = targetCanvas || canvas;
            var rect = node && typeof node.getBoundingClientRect === 'function'
                ? node.getBoundingClientRect()
                : null;
            var width = Math.round((rect && rect.width) || (node && node.clientWidth) || globalObject.innerWidth || 0);
            var height = Math.round((rect && rect.height) || (node && node.clientHeight) || globalObject.innerHeight || 0);
            if (width > 0 && height > 0) {
                return {
                    width: Math.max(width, 320),
                    height: Math.max(height, 420)
                };
            }
            return originalGetMetrics(targetCanvas);
        };
        geometry.__publicViewMetricsInstalled = true;
    }

    function installPublicViewportProfile() {
        var viewport = globalObject.LoveBudEditorCanvasViewport;
        if (!viewport || viewport.__publicViewProfileInstalled) return;
        viewport.minScale = Math.max(Number(viewport.minScale) || 0.2, 0.5);
        viewport.zoomLevels = [0.5, 0.75, 1, 1.25, 1.5];
        viewport.readableCenter = { x: 0.5, y: 0.46 };
        viewport.__publicViewProfileInstalled = true;
    }

    function createReadOnlyActions() {
        return {
            noop: function() {},
            noopAsync: function() { return Promise.resolve(); },
            noopFalseAsync: function() { return Promise.resolve(false); },
            getLocalSaveMode: function() { return false; },
            showToast: function(msg) { console.log('[public-canvas]', msg); }
        };
    }

    function getBoundaryState() {
        return {
            hasCanvasRuntime: hasCanvasRuntime(),
            hasDetailRuntime: isDetailRuntimeReady(),
            hasPublicCanvasBridge: Boolean(globalObject.LoveBudPublicCanvasBridge),
            hasPublicCanvasInit: Boolean(globalObject.LoveBudPublicCanvasInit)
        };
    }

    globalObject.LoveBudPublicViewerCanvasEntry = Object.freeze({
        getCanvasRuntime: getCanvasRuntime,
        hasCanvasRuntime: hasCanvasRuntime,
        isCanvasRuntimeReady: isCanvasRuntimeReady,
        isDetailRuntimeReady: isDetailRuntimeReady,
        installPublicMetrics: installPublicMetrics,
        installPublicViewportProfile: installPublicViewportProfile,
        createReadOnlyActions: createReadOnlyActions,
        getBoundaryState: getBoundaryState
    });
})();
