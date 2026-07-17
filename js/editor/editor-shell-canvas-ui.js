// Editor Shell Canvas UI - Canvas and UI helper factories
// Provides canvas interaction, selection, sidebar, and initial-selection helpers
//
// Sub-module: imported by editor-shell-helpers.js (aggregator)

(function () {
    'use strict';

    window.LoveBudEditorShellCanvasUI = {
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

            if (editorCanvas && typeof editorCanvas.highlightSelectedFlow === 'function') {
                editorCanvas.highlightSelectedFlow(data.id);
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

    createEditorInitialSelectionApplier: function(options) {
        var opts = options || {};
        var getTreeMemories = opts.getTreeMemories || function() { return []; };
        var getSelectedNodeId = opts.getSelectedNodeId || function() { return null; };
        var setSelectedNodeId = opts.setSelectedNodeId || function() {};
        var createInitialMemory = opts.createInitialMemory || function() { return null; };
        var isRootMemory = opts.isRootMemory || function() { return false; };
        var getCanonicalRootId = opts.getCanonicalRootId || function() { return null; };
        var setCurrentEditingMemory = opts.setCurrentEditingMemory || function() {};
        var setDetailEmptyState = opts.setDetailEmptyState || function() {};
        // #3576: tree-scope left rail is populated only inside updateDetailPanel.
        // Empty / root-only paths must still call it; setDetailEmptyState alone is not enough.
        var updateDetailPanel = opts.updateDetailPanel || function() {};
        var log = opts.log || function() {};

        return function applyEditorInitialSelection() {
            var selectedNodeId = getSelectedNodeId();
            var initialSelection = getTreeMemories().find(function(memory) {
                return memory.id === selectedNodeId;
            }) || createInitialMemory();

            if (initialSelection && !isRootMemory(initialSelection, getCanonicalRootId())) {
                setCurrentEditingMemory(initialSelection);
                setDetailEmptyState(false);
                updateDetailPanel(initialSelection);
                log('Initial selection set: ' + initialSelection.id);
            } else {
                // root placeholder 이거나, validated memories에 selectedNodeId가 없는 경우
                // (다른 트리에서 남은 stale selected state) → detail panel selected-moment UI 차단
                // but still render left-rail tree-scope metadata for the loaded tree.
                setDetailEmptyState(true);
                if (selectedNodeId) {
                    setSelectedNodeId(null);
                }
                updateDetailPanel(null);
            }

            return initialSelection;
        };
    },
    };
})();
