(function() {
    'use strict';

    var MARKER = 'LoveBudViewerShareExportActionsLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    /**
     * Create share/export action handler bridge functions.
     *
     * @param {Object} ctx - Context object with:
     *   - handler: the tree-viewer handler (for getShareUrl etc.)
     *   - showShareStatus: function(result) to display share status feedback
     *   - selectedMoment: current moment object (or null)
     *   - panelBranch: current branch object (or null)
     * @returns {Object} With copyLink, nativeShare, platformShare, exportTreeImageCard, exportMomentImageCard, printTree
     */
    function createShareExportHandlers(ctx) {
        return {
            printTree: function() {
                window.print();
            },
            copyLink: function() {
                var Share = window.LoveBudShareActions;
                if (!Share) return;
                var result = Share.copyLink(ctx.handler);
                ctx.showShareStatus(result);
            },
            nativeShare: function() {
                var Share = window.LoveBudShareActions;
                if (!Share) return;
                Share.nativeShare(ctx.handler).then(function(result) {
                    ctx.showShareStatus(result);
                });
            },
            platformShare: function(platform) {
                var Share = window.LoveBudShareActions;
                if (!Share || typeof Share.shareToPlatform !== 'function') return;
                Promise.resolve(Share.shareToPlatform(ctx.handler, platform)).then(function(result) {
                    ctx.showShareStatus(result);
                });
            },
            exportTreeImageCard: function() {
                var Share = window.LoveBudShareActions;
                if (!Share || typeof Share.exportTreeImageCard !== 'function') return;
                Promise.resolve(Share.exportTreeImageCard(ctx.handler)).then(function(result) {
                    ctx.showShareStatus(result);
                });
            },
            exportMomentImageCard: function() {
                var Share = window.LoveBudShareActions;
                if (!Share || typeof Share.exportMomentImageCard !== 'function') return;
                var momentDetails = ctx.selectedMoment;
                var branch = ctx.panelBranch;
                if (!momentDetails) return;
                Promise.resolve(Share.exportMomentImageCard(ctx.handler, momentDetails, branch)).then(function(result) {
                    ctx.showShareStatus(result);
                });
            }
        };
    }

    /**
     * Handle a share/export data-action click.
     *
     * @param {Element} action - The DOM element with data-action attribute
     * @param {Object} handlers - The object returned by createShareExportHandlers()
     * @returns {boolean} true if the action was handled, false otherwise
     */
    function handleShareExportAction(action, handlers) {
        if (!action || !action.dataset || !handlers) return false;
        var a = action.dataset.action;
        if (a === 'copy-link') { handlers.copyLink(); return true; }
        if (a === 'native-share') { handlers.nativeShare(); return true; }
        if (a === 'platform-share') { handlers.platformShare(action.dataset.platform); return true; }
        if (a === 'export-tree-card') { handlers.exportTreeImageCard(); return true; }
        if (a === 'export-moment-card') { handlers.exportMomentImageCard(); return true; }
        if (a === 'print-tree') { handlers.printTree(); return true; }
        return false;
    }

    window.LoveBudViewerShareExportActions = {
        createShareExportHandlers: createShareExportHandlers,
        handleShareExportAction: handleShareExportAction
    };
})();
