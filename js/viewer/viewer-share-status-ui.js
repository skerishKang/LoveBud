(function() {
    'use strict';

    function showShareStatus(result) {
        if (!result || !result.message) return;
        var statusEl = document.getElementById('vvShareStatus');
        if (!statusEl) return;

        statusEl.textContent = result.message;
        statusEl.className = 'vv-share-status ' + (result.success ? 'is-success' : 'is-error');

        clearTimeout(statusEl._hideTimer);
        statusEl._hideTimer = setTimeout(function() {
            statusEl.textContent = '';
            statusEl.className = 'vv-share-status';
        }, 3000);
    }

    window.LoveBudViewerShareStatusUI = {
        showShareStatus: showShareStatus
    };
})();
