(function () {
    'use strict';

    function initMobilePreviewSheet() {
        var previewSidebar = document.getElementById('myTreesHubPanel');
        var previewMobileClose = document.getElementById('myTreesHubClose');
        var mobilePreviewMediaQuery = window.matchMedia('(max-width: 768px)');
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
                closeMobilePreview();
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

        function closeMobilePreview() {
            setMobilePreviewOpen(false);
        }

        // Intercept/Patch LoveBudMyTreesPreviewHub
        var hub = window.LoveBudMyTreesPreviewHub;
        if (hub) {
            var originalOnCardClick = hub.onCardClick;
            var originalShowPlaceholder = hub.showPlaceholder;
            var originalShowContent = hub.showContent;

            hub.onCardClick = function (tree, options) {
                var res = originalOnCardClick.apply(this, arguments);
                if (isMobilePreviewMode()) {
                    setMobilePreviewOpen(true);
                }
                return res;
            };

            hub.showPlaceholder = function () {
                var res = originalShowPlaceholder.apply(this, arguments);
                if (isMobilePreviewMode()) {
                    setMobilePreviewOpen(false);
                }
                return res;
            };

            hub.showContent = function (tree) {
                var res = originalShowContent.apply(this, arguments);
                if (isMobilePreviewMode() && tree) {
                    setMobilePreviewOpen(true);
                }
                return res;
            };
        }

        // Bind escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isMobilePreviewMode() && previewSidebar && previewSidebar.classList.contains('is-open')) {
                closeMobilePreview();
            }
        });

        // Binds close button
        if (previewMobileClose) {
            previewMobileClose.addEventListener('click', function (e) {
                if (isMobilePreviewMode()) {
                    e.preventDefault();
                    closeMobilePreview();
                }
            });
        }

        // Media query listener
        if (mobilePreviewMediaQuery && typeof mobilePreviewMediaQuery.addEventListener === 'function') {
            mobilePreviewMediaQuery.addEventListener('change', function () {
                if (!isMobilePreviewMode()) {
                    hideSheetOverlay();
                    if (previewSidebar) previewSidebar.classList.remove('is-open');
                } else {
                    var selected = hub && typeof hub.getSelectedTree === 'function' && hub.getSelectedTree();
                    if (selected) {
                        setMobilePreviewOpen(true);
                    }
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobilePreviewSheet);
    } else {
        initMobilePreviewSheet();
    }
})();
