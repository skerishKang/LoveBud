(function() {
    'use strict';

    var viewport = window.LoveBudEditorCanvasViewport;
    if (!viewport || viewport.__publicMobileReadableInitialViewportInstalled) return;
    if (typeof viewport.prepareInitialViewport !== 'function') return;

    var originalPrepareInitialViewport = viewport.prepareInitialViewport.bind(viewport);

    function isNarrowPublicViewport() {
        return !!(window.matchMedia && window.matchMedia('(max-width: 560px)').matches);
    }

    function getReadableScale() {
        return isNarrowPublicViewport() ? 0.75 : 1;
    }

    viewport.prepareInitialViewport = function publicMobilePrepareInitialViewport(options) {
        var viewportState = options && options.viewportState;
        if (!viewportState || !isNarrowPublicViewport()) {
            return originalPrepareInitialViewport(options);
        }

        if (typeof viewport.setScale === 'function') {
            viewport.setScale(viewportState, viewportState.scale || 1);
        }
        if (viewportState.initialViewportApplied) return;
        viewportState.initialViewportApplied = true;

        var readableViewport = typeof viewport.getReadableViewportOffset === 'function'
            ? viewport.getReadableViewportOffset(options, getReadableScale())
            : null;
        var fallbackViewport = typeof viewport.getFitViewport === 'function'
            ? viewport.getFitViewport(options)
            : { scale: 1, offsetX: 0, offsetY: 0 };
        var nextViewport = readableViewport || fallbackViewport;

        if (typeof viewport.applyViewport === 'function') {
            viewport.applyViewport(viewportState, nextViewport, true);
            return;
        }

        viewportState.scale = nextViewport.scale || viewportState.scale || 1;
        viewportState.offsetX = nextViewport.offsetX || 0;
        viewportState.offsetY = nextViewport.offsetY || 0;
    };

    viewport.__publicMobileReadableInitialViewportInstalled = true;
})();
