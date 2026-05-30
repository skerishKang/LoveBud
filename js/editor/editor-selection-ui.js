(function () {
    'use strict';

    const selectionUI = window.LoveBudEditorSelectionUI || {};
    const DEFAULT_NODE_SELECTOR = '.memory-node';
    const DEFAULT_SELECTED_CLASS = 'selected';

    selectionUI.applySelectedMemoryNode = function(el, options) {
        const doc = (options && options.documentRef) || document;
        const nodeSelector = (options && options.nodeSelector) || DEFAULT_NODE_SELECTOR;
        const selectedClass = (options && options.selectedClass) || DEFAULT_SELECTED_CLASS;

        doc.querySelectorAll(nodeSelector).forEach((node) => {
            node.classList.remove(selectedClass);
        });

        if (el && el.classList && typeof el.classList.add === 'function') {
            el.classList.add(selectedClass);
        }

        return el || null;
    };

    window.LoveBudEditorSelectionUI = selectionUI;
})();
