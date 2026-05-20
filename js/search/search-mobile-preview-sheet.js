(function () {
    'use strict';

    function createSheetController(config, ui) {
        config = config || {};
        var refs = config.refs || {};
        var state = config.state || {};
        var previewSidebar = refs.previewSidebar || null;
        var previewMobileClose = refs.previewMobileClose || null;
        var mobilePreviewMediaQuery = refs.mobilePreviewMediaQuery || null;
        var sheetOverlay = null;
        var savedScrollY = 0;

        function isMobilePreviewMode() {
            return Boolean(mobilePreviewMediaQuery && mobilePreviewMediaQuery.matches);
        }

        function showSheetOverlay() {
            if (sheetOverlay) return;

            savedScrollY = window.scrollY || window.pageYOffset || 0;
            document.body.style.top = '-' + savedScrollY + 'px';
            document.body.classList.add('preview-sheet-open');

            sheetOverlay = document.createElement('div');
            sheetOverlay.className = 'preview-sheet-overlay';
            sheetOverlay.setAttribute('aria-hidden', 'true');
            sheetOverlay.addEventListener('click', function () {
                if (ui && typeof ui.clearSelectedPreview === 'function') {
                    ui.clearSelectedPreview();
                }
            });
            document.body.appendChild(sheetOverlay);
        }

        function hideSheetOverlay() {
            if (sheetOverlay) {
                sheetOverlay.remove();
                sheetOverlay = null;
            }
            document.querySelectorAll('.preview-sheet-overlay').forEach(function (overlay) {
                overlay.remove();
            });

            document.body.classList.remove('preview-sheet-open');
            document.body.style.top = '';

            var restoreY = savedScrollY;
            savedScrollY = 0;
            if (restoreY > 0) {
                window.requestAnimationFrame(function () {
                    window.scrollTo(0, restoreY);
                });
            }
        }

        function setMobilePreviewOpen(isOpen) {
            if (!previewSidebar || !isMobilePreviewMode()) return;
            previewSidebar.classList.toggle('is-open', Boolean(isOpen));

            if (isOpen) {
                showSheetOverlay();
            } else {
                hideSheetOverlay();
            }
        }

        function syncPreviewVisibility() {
            if (!previewSidebar) return;
            if (isMobilePreviewMode()) {
                var shouldStayOpen = previewSidebar.classList.contains('is-open') && Boolean(state.selectedTreeId);
                setMobilePreviewOpen(shouldStayOpen);
                return;
            }
            hideSheetOverlay();
            previewSidebar.classList.remove('is-open');
        }

        function bindMobilePreviewHandlers() {
            if (previewMobileClose) {
                previewMobileClose.addEventListener('click', function () {
                    if (ui && typeof ui.clearSelectedPreview === 'function') {
                        ui.clearSelectedPreview();
                    }
                });
            }

            if (mobilePreviewMediaQuery && typeof mobilePreviewMediaQuery.addEventListener === 'function') {
                mobilePreviewMediaQuery.addEventListener('change', function () {
                    syncPreviewVisibility();
                });
            } else if (mobilePreviewMediaQuery && typeof mobilePreviewMediaQuery.addListener === 'function') {
                mobilePreviewMediaQuery.addListener(function () {
                    syncPreviewVisibility();
                });
            }
        }

        return {
            isMobilePreviewMode: isMobilePreviewMode,
            showSheetOverlay: showSheetOverlay,
            hideSheetOverlay: hideSheetOverlay,
            setMobilePreviewOpen: setMobilePreviewOpen,
            syncPreviewVisibility: syncPreviewVisibility,
            bindMobilePreviewHandlers: bindMobilePreviewHandlers
        };
    }

    function patchSearchUIFactory() {
        var SearchUI = window.LoveBudSearchUI;
        if (!SearchUI || typeof SearchUI.createSearchUI !== 'function' || SearchUI.__mobilePreviewSheetPatched) return;

        var originalCreateSearchUI = SearchUI.createSearchUI;
        SearchUI.createSearchUI = function (config) {
            var ui = originalCreateSearchUI(config);
            if (!ui) return ui;

            var controller = createSheetController(config || {}, ui);
            var originalClearSelectedPreview = ui.clearSelectedPreview;
            ui.isMobilePreviewMode = controller.isMobilePreviewMode;
            ui.setMobilePreviewOpen = controller.setMobilePreviewOpen;
            ui.syncPreviewVisibility = controller.syncPreviewVisibility;
            ui.bindMobilePreviewHandlers = controller.bindMobilePreviewHandlers;

            if (typeof originalClearSelectedPreview === 'function') {
                ui.clearSelectedPreview = function (options) {
                    var nextOptions = options || {};
                    var result = originalClearSelectedPreview(Object.assign({}, nextOptions, {
                        preserveOpenState: true
                    }));

                    if (!nextOptions.preserveOpenState) {
                        controller.setMobilePreviewOpen(false);
                    }

                    return result;
                };
            }

            ui.__mobilePreviewSheetPatched = true;
            return ui;
        };

        SearchUI.__mobilePreviewSheetPatched = true;
    }

    window.LoveBudSearchMobilePreviewSheet = {
        createSheetController: createSheetController,
        patchSearchUIFactory: patchSearchUIFactory
    };

    patchSearchUIFactory();
})();
