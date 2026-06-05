// Editor Shell Memory - Memory/Moment helper factories
// Provides memory actions readiness, current moment detail, initial memory, and next memory id helpers
//
// Sub-module: imported by editor-shell-helpers.js (aggregator)

(function () {
    'use strict';

    window.LoveBudEditorShellMemory = {
    createMemoryActionsReadinessWrapper: function(options) {
        var opts = options || {};
        var getMemoryActions = opts.getMemoryActions || function() { return null; };
        var consoleRef = opts.consoleRef || console;

        return async function updateSelectedMemoryFields() {
            var memoryActions = getMemoryActions();
            var args = Array.prototype.slice.call(arguments);

            if (!memoryActions || typeof memoryActions.updateSelectedMemoryFields !== 'function') {
                consoleRef.warn('[editor] updateSelectedMemoryFields called before memory actions are ready');
                return false;
            }

            return memoryActions.updateSelectedMemoryFields.apply(memoryActions, args);
        };
    },

    createCurrentMomentDetailOpener: function(options) {
        var opts = options || {};
        var getCurrentEditingMemory = opts.getCurrentEditingMemory || function() { return null; };
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };
        var createInitialMemory = opts.createInitialMemory || function() { return null; };
        var getTreeId = opts.getTreeId || function() { return null; };
        var editorPageHelpers = opts.editorPageHelpers || {};
        var getEditorBasePath = opts.getEditorBasePath;
        var locationRef = opts.locationRef || window.location;
        var reportError = opts.reportError || function() {};

        return function openCurrentMomentDetail() {
            var selectedNodeId = getSelectedNodeId();
            var treeMemories = getTreeMemories();
            var activeMemory = getCurrentEditingMemory()
                || treeMemories.find(function(memory) { return memory.id === selectedNodeId; })
                || createInitialMemory();
            var treeId = getTreeId();

            if (!activeMemory || !activeMemory.id || !treeId) return;

            if (typeof editorPageHelpers.openMomentDetail === 'function') {
                editorPageHelpers.openMomentDetail({
                    memoryId: activeMemory.id,
                    treeId: treeId,
                    getEditorBasePath: getEditorBasePath,
                    locationRef: locationRef
                });
            } else {
                reportError('LoveBudEditorPageHelpers.openMomentDetail missing');
            }
        };
    },

    createEditorInitialMemoryProvider: function(options) {
        var opts = options || {};
        var editorTreeHelpers = opts.editorTreeHelpers || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var findRootMemory = opts.findRootMemory || function() { return null; };
        var canonicalRootId = opts.canonicalRootId;
        var treeId = opts.treeId;
        var i18n = opts.i18n || {};

        return function createInitialMemory() {
            return editorTreeHelpers.createInitialMemory({
                getTreeMemories: getTreeMemories,
                findRootMemory: findRootMemory,
                canonicalRootId: canonicalRootId,
                treeId: treeId,
                i18n: i18n
            });
        };
    },

    createEditorNextMemoryIdProvider: function(options) {
        var opts = options || {};
        var nextMemoryIdFromMemories = opts.nextMemoryIdFromMemories;
        var getTreeMemories = opts.getTreeMemories || function() { return []; };

        return function nextMemoryId() {
            return nextMemoryIdFromMemories(getTreeMemories());
        };
    },
    };
})();
