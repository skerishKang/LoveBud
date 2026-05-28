(function () {
    'use strict';

    const globalObject = window;

    function getCanvasRuntime() {
        return globalObject.LoveBudEditorCanvas
            || globalObject.EditorCanvas
            || globalObject.createEditorCanvas
            || null;
    }

    function hasCanvasRuntime() {
        return Boolean(getCanvasRuntime());
    }

    function getBoundaryState() {
        return {
            hasCanvasRuntime: hasCanvasRuntime(),
            hasPublicCanvasBridge: Boolean(globalObject.LoveBudPublicCanvasBridge),
            hasPublicCanvasInit: Boolean(globalObject.LoveBudPublicCanvasInit)
        };
    }

    globalObject.LoveBudPublicViewerCanvasEntry = Object.freeze({
        getCanvasRuntime: getCanvasRuntime,
        hasCanvasRuntime: hasCanvasRuntime,
        getBoundaryState: getBoundaryState
    });
})();
