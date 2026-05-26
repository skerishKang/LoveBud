(function () {
    'use strict';

    function noop() {}

    function createNoopGrowthAffordance() {
        return {
            clearGrowthAffordance: noop,
            openAddMomentFromCanvas: noop,
            getGrowthAffordancePosition: function () {
                return { x: 0, y: 0, side: 'right' };
            },
            drawGrowthAffordanceBranch: noop,
            createGrowthAffordanceElement: noop,
            renderGrowthAffordance: noop
        };
    }

    function createNoopBranchPorts() {
        return {
            clearPorts: noop,
            renderPortsForNode: noop,
            showPortsForMemory: noop,
            hidePortsForMemory: noop,
            hideAllPorts: noop,
            getPortPositions: function () {
                return [];
            },
            drawBranchFromPort: noop
        };
    }

    if (typeof window.createEditorCanvasGrowthAffordance !== 'function') {
        window.createEditorCanvasGrowthAffordance = createNoopGrowthAffordance;
    }

    if (typeof window.createEditorCanvasBranchPorts !== 'function') {
        window.createEditorCanvasBranchPorts = createNoopBranchPorts;
    }

    window.LoveBudPublicCanvasAffordanceFallback = {
        createNoopGrowthAffordance,
        createNoopBranchPorts
    };
})();
