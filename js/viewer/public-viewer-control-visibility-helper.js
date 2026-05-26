(function() {
    'use strict';

    var CONTROL_SELECTORS = [
        '#editMemoryBtn',
        '#continueFromMomentBtn',
        '.editor-save-status-card'
    ];

    function getControlSelectors() {
        return CONTROL_SELECTORS.slice();
    }

    window.LoveBudPublicViewerControlVisibilityHelper = {
        getControlSelectors: getControlSelectors
    };
})();
