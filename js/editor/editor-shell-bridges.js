(function () {
    'use strict';

    window.LoveBudEditorShellBridges = {
        exposeCanvasEmptyGuideUpdater: function(options) {
        var opts = options || {};
        var editorNamespace = opts.editorNamespace || (window.LoveBudEditor = window.LoveBudEditor || {});
        var updateCanvasEmptyGuide = opts.updateCanvasEmptyGuide;

        editorNamespace.updateCanvasEmptyGuide = updateCanvasEmptyGuide;

        return editorNamespace;
    },
        exposeDetailPanelUpdater: function(options) {
        var opts = options || {};
        var windowRef = opts.windowRef || window;
        var updateDetailPanel = opts.updateDetailPanel;

        windowRef.updateDetailPanel = updateDetailPanel;

        return windowRef;
    },
        exposeRefreshMemoriesBridge: function(options) {
        var opts = options || {};
        var windowRef = opts.windowRef || window;
        var refreshMemories = opts.refreshMemories;

        windowRef.refreshMemories = refreshMemories;

        return windowRef;
    }
    };
})();
