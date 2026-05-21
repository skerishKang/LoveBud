(function() {
    'use strict';

    var MARKER = 'LoveBudViewerClickActionsLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function attachClickActions(container, handler, shareExportHandlers) {
        if (!container) return;
        container.addEventListener('click', function(e) {
            var action = e.target.closest('[data-action]');
            if (action) {
                var a = action.dataset.action;
                if (a === 'close-moment') handler.closeMoment();
                else if (a === 'close-panel') handler.closePanel();
                else if (a === 'toggle-like') { handler.toggleLike(); action.classList.toggle('is-liked'); }
                else if (a === 'open-tree-comments') handler.openPanel('tree-comments');
                else if (a === 'open-share') handler.openPanel('share');
                else if (a === 'toggle-layout') handler.onToggleLayout();
                else {
                    var SE = window.LoveBudViewerShareExportActions;
                    if (SE && shareExportHandlers && SE.handleShareExportAction(action, shareExportHandlers)) {}
                }
                return;
            }
            var momentBtn = e.target.closest('[data-moment-id]');
            if (momentBtn) { handler.onSelectMoment(momentBtn.dataset.momentId, momentBtn.dataset.branchId); return; }
            var branchBtn = e.target.closest('.vv-branch-label[data-branch-id]');
            if (branchBtn) { handler.onSelectBranch(branchBtn.dataset.branchId); return; }
        });
    }

    window.LoveBudViewerClickActions = {
        attachClickActions: attachClickActions
    };
})();
