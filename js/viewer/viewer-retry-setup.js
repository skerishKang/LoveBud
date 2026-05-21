(function() {
    'use strict';

    var MARKER = 'LoveBudViewerRetrySetupLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function setupRetry(getCurrentTreeId, initViewer) {
        var btn = document.getElementById('viewerRetryBtn');
        if (btn) {
            btn.addEventListener('click', function() {
                var treeId = typeof getCurrentTreeId === 'function' ? getCurrentTreeId() : null;
                if (treeId && typeof initViewer === 'function') {
                    initViewer();
                }
            });
        }
    }

    window.LoveBudViewerRetrySetup = {
        setupRetry: setupRetry
    };
})();
