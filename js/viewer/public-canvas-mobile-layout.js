(function() {
    'use strict';

    function isPortraitPublicViewer() {
        var width = window.innerWidth || document.documentElement.clientWidth || 0;
        var height = window.innerHeight || document.documentElement.clientHeight || 0;
        return width > 0 && height > 0 && width <= 560 && height >= width;
    }

    function installMobileStructuredLayoutDefault() {
        var storage = window.LoveBudEditorCanvasLayoutStorage;
        if (!storage || storage.__publicMobileLayoutDefaultInstalled) return;
        if (typeof storage.loadLayoutMode !== 'function') return;

        var originalLoadLayoutMode = storage.loadLayoutMode.bind(storage);
        storage.loadLayoutMode = function publicViewerLoadLayoutMode(layoutModeStorageKey, readOnly) {
            if (isPortraitPublicViewer()) return 'structured';
            return originalLoadLayoutMode(layoutModeStorageKey, readOnly);
        };
        storage.__publicMobileLayoutDefaultInstalled = true;
    }

    installMobileStructuredLayoutDefault();
})();
