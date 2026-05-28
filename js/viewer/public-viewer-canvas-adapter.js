(function() {
    'use strict';

    var globalObject = typeof window !== 'undefined' ? window : globalThis;

    function createPublicViewerCanvas(options) {
        var factory = options && options.createEditorCanvas;
        var canvasOptions = options && options.canvasOptions;
        if (typeof factory !== 'function') return null;
        return factory(canvasOptions);
    }

    globalObject.LoveBudPublicViewerCanvasAdapter = Object.freeze({
        createPublicViewerCanvas: createPublicViewerCanvas
    });
})();
