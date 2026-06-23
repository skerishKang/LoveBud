/**
 * Editor Shell Moment List - Shell-level moment list integration
 * 
 * Integrates the moment list panel with the editor shell.
 * Provides button binding and dependency wiring.
 */

(function () {
    'use strict';

    window.LoveBudEditorShellMomentList = {
        /**
         * Creates a moment list toggle handler and binds it to the DOM button.
         * 
         * @param {object} options - Dependencies
         * @param {function} options.createEditorMomentList - Factory for creating moment list instance
         * @param {function} options.getTreeMemories - Returns current tree memories
         * @param {function} options.getSelectedNodeId - Returns current selected node ID
         * @param {function} options.setSelectedNodeId - Sets the selected node ID
         * @param {function} options.updateDetailPanel - Updates the detail panel with memory data
         * @param {function} options.rerenderCanvas - Triggers canvas re-render
         * @param {function} options.isRootMemory - Checks if memory is root
         * @param {function} options.getCanonicalRootId - Gets canonical root ID
         * @param {object} options.documentRef - Document reference (defaults to document)
         * @param {function} options.i18n - i18n function
         * @returns {object} - Public API with show, hide, toggle methods
         */
        createMomentListBinding: function(options) {
            const opts = options || {};
            const documentRef = opts.documentRef || document;
            const createEditorMomentList = opts.createEditorMomentList || (window.LoveBudEditorMomentList && window.LoveBudEditorMomentList.createEditorMomentList);

            if (typeof createEditorMomentList !== 'function') {
                console.warn('[editor-shell-moment-list] createEditorMomentList not available');
                return {
                    show: function() {},
                    hide: function() {},
                    toggle: function() {},
                    refresh: function() {}
                };
            }

            // Create the moment list instance
            const momentList = createEditorMomentList({
                documentRef: documentRef,
                getTreeMemories: opts.getTreeMemories,
                getSelectedNodeId: opts.getSelectedNodeId,
                setSelectedNodeId: opts.setSelectedNodeId,
                updateDetailPanel: opts.updateDetailPanel,
                rerenderCanvas: opts.rerenderCanvas,
                isRootMemory: opts.isRootMemory,
                getCanonicalRootId: opts.getCanonicalRootId,
                i18n: opts.i18n || function(key) { return key; }
            });

            // Bind to DOM button
            const toggleBtn = documentRef.getElementById('momentListToggleBtn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    momentList.toggle();
                });
            }

            // Expose for external control
            return momentList;
        }
    };
})();
