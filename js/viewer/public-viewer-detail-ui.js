(function() {
    'use strict';

    function createPublicViewerUpdateFocusSelectedBtn(deps) {
        var getSelectedNodeId = deps && typeof deps.getSelectedNodeId === 'function'
            ? deps.getSelectedNodeId
            : function() { return null; };

        return function updatePublicViewerFocusSelectedBtn() {
            var btn = document.getElementById('focusSelectedBtn');
            if (!btn) return;

            var hasSelection = !!getSelectedNodeId();
            btn.disabled = !hasSelection;
            btn.classList.toggle('is-disabled', !hasSelection);
        };
    }

    function createPublicViewerDetailUI(deps) {
        if (typeof window.createEditorDetailUI !== 'function') {
            throw new Error('createEditorDetailUI is required for public viewer detail UI adapter');
        }

        var detailUI = window.createEditorDetailUI(deps);
        detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps);
        return detailUI;
    }

    window.createPublicViewerDetailUI = createPublicViewerDetailUI;
    window.LoveBudPublicViewerDetailUI = {
        createPublicViewerDetailUI: createPublicViewerDetailUI,
        createPublicViewerUpdateFocusSelectedBtn: createPublicViewerUpdateFocusSelectedBtn,
        delegatesToEditorDetailUI: true
    };
})();
