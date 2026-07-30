(function() {
    'use strict';

    var MARKER = 'LoveBudViewerRenderStateLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    /**
     * Create viewer render state helpers for a given SEL config.
     *
     * @param {Object} SEL - Selector map with keys:
     *   shell, loading, empty, error, treeContainer, treeTitle, treeMeta
     * @returns {Object} With qs, show, hide, showLoading, renderEmpty, renderError, renderDeterministicFallback
     */
    function create(SEL) {
        function qs(sel) { return document.querySelector(sel); }

        function setBusy(sel, value) {
            var el = qs(sel);
            if (!el) return;
            if (value) { el.setAttribute('aria-busy', 'true'); }
            else { el.removeAttribute('aria-busy'); }
        }

        function show() {
            for (var i = 0; i < arguments.length; i++) {
                var el = qs(arguments[i]);
                if (el) { el.removeAttribute('hidden'); el.style.removeProperty('display'); }
            }
            setBusy(SEL.shell, false);
        }

        function hide() {
            for (var i = 0; i < arguments.length; i++) {
                var el = qs(arguments[i]);
                if (el) { el.setAttribute('hidden', ''); el.style.removeProperty('display'); }
            }
        }

        function showLoading() { hide(SEL.treeContainer, SEL.empty, SEL.error); show(SEL.loading); setBusy(SEL.shell, true); }
        function renderEmpty() { hide(SEL.treeContainer, SEL.loading, SEL.error); show(SEL.empty); }
        function renderError() { hide(SEL.treeContainer, SEL.loading, SEL.empty); show(SEL.error); }

        /**
         * Render a deterministic fallback state when a confirmed Neon hub
         * snapshot is missing or corrupted.
         *
         * Shows the tree container (so the shell renders with default data)
         * and hides loading/empty/error overlays.  Callers must populate the
         * container with fallback data via ShellRender.renderShell() or
         * equivalent.
         */
        function renderDeterministicFallback() {
            hide(SEL.loading, SEL.empty, SEL.error);
            show(SEL.treeContainer);
        }

        return {
            qs: qs,
            show: show,
            hide: hide,
            showLoading: showLoading,
            renderEmpty: renderEmpty,
            renderError: renderError,
            renderDeterministicFallback: renderDeterministicFallback
        };
    }

    window.LoveBudViewerRenderState = {
        create: create
    };
})();
