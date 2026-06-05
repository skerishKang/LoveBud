// Editor Shell Helpers - Entry-only shell utilities
// Provides fallbacks and utilities for editor initialization without affecting runtime behavior
//
// Aggregator: merges sub-modules with remaining inline functions

(function () {
    'use strict';

    const shellUtils = window.LoveBudEditorShellUtils || {};
    const shellBridges = window.LoveBudEditorShellBridges || {};
    const shellGuards = window.LoveBudEditorShellGuards || {};
    const shellStartup = window.LoveBudEditorShellStartup || {};

    window.LoveBudEditorShellHelpers = {
        ...shellUtils,
        ...shellBridges,
        ...shellGuards,
        ...shellStartup,

    createEditorCanvasEmptyGuideUpdater: function(options) {
        var opts = options || {};
        var emptyGuideUIHelper = opts.emptyGuideUIHelper || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var log = opts.log || function() {};

        if (typeof emptyGuideUIHelper.createCanvasEmptyGuideUpdater === 'function') {
            return emptyGuideUIHelper.createCanvasEmptyGuideUpdater({
                getTreeMemories: getTreeMemories,
                log: log
            });
        }

        return function updateCanvasEmptyGuide() {
            log('WARNING: LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater missing');
        };
    },

    createSelectedMomentFocusHandler: function(options) {
        var opts = options || {};
        var getEditorCanvas = opts.getEditorCanvas || function() { return null; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };

        return function focusSelectedMoment() {
            var editorCanvas = getEditorCanvas();
            var selectedNodeId = getSelectedNodeId();

            if (editorCanvas && typeof editorCanvas.focusNodeById === 'function' && selectedNodeId) {
                editorCanvas.focusNodeById(selectedNodeId);
            }
        };
    },

    createEditorSelectNodeHandler: function(options) {
        var opts = options || {};
        var getEditorCanvas = opts.getEditorCanvas || function() { return null; };
        var getSaveStatusData = opts.getSaveStatusData || function() { return null; };
        var editorSelectionUI = opts.editorSelectionUI || {};
        var editorSaveStatus = opts.editorSaveStatus || {};
        var setSelectedNodeId = opts.setSelectedNodeId || function() {};
        var setCurrentEditingMemory = opts.setCurrentEditingMemory || function() {};
        var updateDetailPanel = opts.updateDetailPanel || function() {};
        var updateFocusSelectedBtn = opts.updateFocusSelectedBtn || function() {};
        var setDetailEmptyState = opts.setDetailEmptyState || function() {};
        var reportError = opts.reportError || function() {};

        return function selectNode(el, data) {
            if (!data) return;

            setSelectedNodeId(data.id);
            setCurrentEditingMemory(data);

            if (typeof editorSelectionUI.applySelectedMemoryNode === 'function') {
                editorSelectionUI.applySelectedMemoryNode(el);
            } else {
                reportError('LoveBudEditorSelectionUI.applySelectedMemoryNode missing');
            }

            if (typeof editorSaveStatus.hideSaveStatusIndicator === 'function') {
                editorSaveStatus.hideSaveStatusIndicator(getSaveStatusData());
            }

            updateDetailPanel(data);
            updateFocusSelectedBtn();
            setDetailEmptyState(false);

            var editorCanvas = getEditorCanvas();
            if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                editorCanvas.updateAffordance();
            }
        };
    },

    createSidebarTreeActionsUpdater: function(options) {
        var opts = options || {};
        var sidebarUIHelper = opts.sidebarUIHelper || {};
        var i18n = opts.i18n;
        var safeI18nText = opts.safeI18nText;
        var getTreeId = opts.getTreeId || function() { return null; };

        return function updateSidebarTreeActions() {
            if (sidebarUIHelper.updateSidebarTreeActions) {
                sidebarUIHelper.updateSidebarTreeActions({
                    i18n: i18n,
                    safeI18nText: safeI18nText,
                    getTreeId: getTreeId
                });
            }
        };
    },

    createEditorSidebarStatusUpdater: function(options) {
        var opts = options || {};
        var updateSidebarStatusBase = opts.updateSidebarStatusBase || function() {};
        var updateCanvasEmptyGuide = opts.updateCanvasEmptyGuide || function() {};
        var updateSidebarTreeActions = opts.updateSidebarTreeActions || function() {};

        return function updateSidebarStatus() {
            updateSidebarStatusBase();
            updateCanvasEmptyGuide();
            updateSidebarTreeActions();
        };
    },

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

    createEditorInitialSelectionApplier: function(options) {
        var opts = options || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };
        var createInitialMemory = opts.createInitialMemory || function() { return null; };
        var isRootMemory = opts.isRootMemory || function() { return false; };
        var getCanonicalRootId = opts.getCanonicalRootId || function() { return null; };
        var setCurrentEditingMemory = opts.setCurrentEditingMemory || function() {};
        var log = opts.log || function() {};

        return function applyEditorInitialSelection() {
            var selectedNodeId = getSelectedNodeId();
            var initialSelection = getTreeMemories().find(function(memory) {
                return memory.id === selectedNodeId;
            }) || createInitialMemory();

            if (initialSelection && !isRootMemory(initialSelection, getCanonicalRootId())) {
                setCurrentEditingMemory(initialSelection);
                log('Initial selection set: ' + initialSelection.id);
            }

            return initialSelection;
        };
    },
    };
})();
