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

    function resolveLayoutLabel(i18n, key, fallback) {
        if (typeof i18n !== 'function') return fallback;
        var value = i18n(key);
        return value && value !== key ? value : fallback;
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
                ? resolveLayoutLabel(i18n, 'editor_layout_structured', '정리된 트리')
                : resolveLayoutLabel(i18n, 'editor_layout_free', '자유 배치');
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

    /**
     * Delegates viewport fit call after layout mode switch.
     * @param {Function} fitFn - the local fitViewportToTree function
     */
    function fitViewportToTree(fitFn) {
        fitFn();
    }

    /**
     * Delegates free-mode position persistence call.
     * Only called from switchToFreeMode; structured mode does not persist positions.
     * @param {Function} persistFn - the local persistStoredPositions function
     */
    function persistStoredPositions(persistFn) {
        persistFn();
    }

    /**
     * Delegates canvas initialization/refresh call.
     * @param {Function} initFn - the local initCanvas function
     */
    function initCanvas(initFn) {
        if (typeof initFn !== 'function') {
            return;
        }
        initFn();
    }

    function createLayoutModeSwitcher(options) {
        var viewportState = options.viewportState;
        var loadStoredLayout = options.loadStoredLayout;
        var persistLayoutModeLocal = options.persistLayoutMode;
        var persistStoredPositionsLocal = options.persistStoredPositions;
        var fitViewportToTreeLocal = options.fitViewportToTree;
        var initCanvasLocal = options.initCanvas;
        var updateLayoutToggleUILocal = options.updateLayoutToggleUI;
        var getSavedFreePositions = options.getSavedFreePositions;
        var setSavedFreePositions = options.setSavedFreePositions;
        var getStoredFreePositions = options.getStoredFreePositions;
        var setStoredFreePositions = options.setStoredFreePositions;

        function switchToFreeMode() {
            viewportState.layoutMode = 'free';
            persistLayoutModeLocal('free');
            viewportState.initialViewportApplied = false;

            var saved = getSavedFreePositions();
            if (saved) {
                viewportState.positions = { ...saved };
                setSavedFreePositions(null);
            }

            var stored = getStoredFreePositions();
            if (stored && Object.keys(viewportState.positions).length === 0) {
                viewportState.positions = { ...stored };
            }

            if (Object.keys(viewportState.positions).length === 0) {
                var loaded = loadStoredLayout();
                if (loaded.positions && Object.keys(loaded.positions).length > 0) {
                    viewportState.positions = { ...loaded.positions };
                }
            }

            fitViewportToTreeLocal();
            applyLayoutModeClasses('free');
            updateLayoutToggleUILocal();
            initCanvasLocal();
            persistStoredPositionsLocal();
        }

        function switchToStructuredMode() {
            setSavedFreePositions({ ...viewportState.positions });
            viewportState.layoutMode = 'structured';
            viewportState.initialViewportApplied = false;
            persistLayoutModeLocal('structured');

            fitViewportToTreeLocal();
            applyLayoutModeClasses('structured');
            updateLayoutToggleUILocal();
            initCanvasLocal();
        }

        function setLayoutMode(mode) {
            if (mode === 'structured') {
                switchToStructuredMode();
            } else {
                switchToFreeMode();
            }
        }

        function toggleLayoutMode() {
            if (viewportState.layoutMode === 'structured') {
                switchToFreeMode();
            } else {
                switchToStructuredMode();
            }
        }

        return {
            switchToFreeMode: switchToFreeMode,
            switchToStructuredMode: switchToStructuredMode,
            setLayoutMode: setLayoutMode,
            toggleLayoutMode: toggleLayoutMode
        };
    }

    window.LoveBudEditorCanvasLayoutTransition = {
        applyLayoutModeClasses: applyLayoutModeClasses,
        fitViewportToTree: fitViewportToTree,
        initCanvas: initCanvas,
        persistLayoutMode: persistLayoutMode,
        persistStoredPositions: persistStoredPositions,
        updateLayoutToggleUI: updateLayoutToggleUI,
        createLayoutModeSwitcher: createLayoutModeSwitcher
    };
})();
