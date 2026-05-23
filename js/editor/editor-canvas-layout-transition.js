/**
 * Layout mode transition helper for the Editor Canvas.
 * Handles body class toggling and layout toggle button UI updates.
 * Loaded before editor-canvas.js as a global window delegate.
 */
(function() {
    /**
     * Applies CSS classes to the body element based on the current layout mode.
     * @param {string} layoutMode - 'structured' or 'free'
     */
    function applyLayoutModeClasses(layoutMode) {
        if (layoutMode === 'structured') {
            document.body.classList.remove('layout-free');
            document.body.classList.add('layout-structured');
        } else {
            document.body.classList.remove('layout-structured');
            document.body.classList.add('layout-free');
        }
    }

    /**
     * Updates the layout toggle button UI based on the current layout mode.
     * @param {string} layoutMode - 'structured' or 'free'
     * @param {Function} i18n - i18n lookup function
     */
    function updateLayoutToggleUI(layoutMode, i18n) {
        var toggleBtn = document.getElementById('layoutModeToggleBtn');
        var toggleLabel = document.getElementById('layoutModeToggleLabel');
        var toggleIcon = document.getElementById('layoutModeToggleIcon');
        if (!toggleBtn) return;

        var isStructured = layoutMode === 'structured';
        toggleBtn.classList.toggle('is-active', isStructured);

        if (toggleLabel) {
            toggleLabel.textContent = isStructured
                ? (i18n('editor_layout_structured') || '정리된 트리')
                : (i18n('editor_layout_free') || '자유 배치');
        }
        if (toggleIcon) {
            toggleIcon.textContent = isStructured ? 'account_tree' : 'auto_awesome';
        }
    }

    /**
     * Delegates layout mode persistence call.
     * @param {Function} persistFn - the local persistLayoutMode function
     * @param {string} layoutMode - 'structured' or 'free'
     */
    function persistLayoutMode(persistFn, layoutMode) {
        persistFn(layoutMode);
    }

    window.LoveBudEditorCanvasLayoutTransition = {
        applyLayoutModeClasses: applyLayoutModeClasses,
        persistLayoutMode: persistLayoutMode,
        updateLayoutToggleUI: updateLayoutToggleUI
    };
})();
