(function() {
    'use strict';

    var MARKER = 'LoveBudViewerShareExportBridgeLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function setupShareExportBridge(context) {
        var handler = context.handler;
        var showShareStatus = context.showShareStatus;
        var state = context.state;

        var shareExportHandlers = null;
        var SE = window.LoveBudViewerShareExportActions;
        if (!SE) return null;

        var se = SE.createShareExportHandlers({
            handler: handler,
            showShareStatus: showShareStatus,
            get selectedMoment() { return state.selectedMoment; },
            get panelBranch() { return state.panelBranch; }
        });
        
        shareExportHandlers = se;
        
        handler.copyLink = se.copyLink;
        handler.nativeShare = se.nativeShare;
        handler.platformShare = se.platformShare;
        handler.exportTreeImageCard = se.exportTreeImageCard;
        handler.exportMomentImageCard = se.exportMomentImageCard;
        handler.printTree = se.printTree;

        return shareExportHandlers;
    }

    window.LoveBudViewerShareExportBridge = {
        setupShareExportBridge: setupShareExportBridge
    };
})();
