/**
 * LoveBud - My Trees Render Helpers
 * v20260504-1
 *
 * Extracted rendering-state helpers from my-trees.js
 * Responsibilities:
 * - Tree card rendering orchestration
 * - Dropdown management
 * - Selection state accessors
 * - Tree sorting
 */

(function () {
  'use strict';

  // Private state (mirrors/main-tracks selection, synced with my-trees-state)
  var _selectedTreeId = null;

  function getSelectedTreeId(stateModule) {
    if (stateModule && typeof stateModule.getSelectedTreeId === 'function') {
      return stateModule.getSelectedTreeId();
    }
    return _selectedTreeId;
  }

  function setSelectedTreeId(stateModule, treeId) {
    if (stateModule && typeof stateModule.setSelectedTreeId === 'function') {
      stateModule.setSelectedTreeId(treeId);
    }
    _selectedTreeId = treeId;
  }

  function getRenderableTrees(stateModule) {
    if (stateModule && typeof stateModule.getLastTreesData === 'function') {
      return stateModule.getLastTreesData();
    }
    return [];
  }

  function applyTreeSelection(stateModule, renderFn, treeId) {
    setSelectedTreeId(stateModule, treeId);
    var currentTrees = getRenderableTrees(stateModule);
    if (Array.isArray(currentTrees) && currentTrees.length) {
      renderFn(currentTrees);
    }
  }

  function sortTrees(stateModule, trees, sortBy) {
    if (stateModule && typeof stateModule.sortTrees === 'function') {
      return stateModule.sortTrees(trees, sortBy);
    }
    return Array.isArray(trees) ? trees.slice() : [];
  }

  function renderTrees(trees, options) {
    var uiModule = options && options.uiModule;
    var setState = options && options.setState;
    var stateEnum = options && options.stateEnum;
    var i18n = (options && options.i18n) || window.t || function (k) { return k; };
    var onRename = options && options.onRename;
    var onDelete = options && options.onDelete;
    var onToggleVisibility = options && options.onToggleVisibility;
    var onNavigate = options && options.onNavigate;
    var stateModule = options && options.stateModule;
    var buildTreeCardFn = (options && options.buildTreeCard) || null;
    var updateManageSummaryFn = (options && options.updateManageSummary) || null;

    // Delegate to UI module if available
    if (uiModule && typeof uiModule.renderTrees === 'function') {
      uiModule.renderTrees(trees, {
        setState: setState,
        stateEnum: stateEnum,
        i18n: i18n,
        onRename: onRename,
        onDelete: onDelete,
        onToggleVisibility: onToggleVisibility,
        onNavigate: onNavigate,
        onSelect: options && options.onSelect,
        onLoadMore: options && options.onLoadMore,
        buildTreeCard: buildTreeCardFn,
        updateManageSummary: updateManageSummaryFn,
        getSelectedTreeId: function () { return getSelectedTreeId(stateModule); },
        setLastTreesData: function (data) {
          if (stateModule && typeof stateModule.setLastTreesData === 'function') {
            stateModule.setLastTreesData(data);
          }
          // Also update the original caller's callback so my-trees.js closure
          // stays in sync (Refs #1126)
          if (options && typeof options.setLastTreesData === 'function') {
            options.setLastTreesData(data);
          }
        }
      });
      return;
    }

    // Fallback: minimal rendering if UI module not loaded
    if (typeof setState === 'function' && stateEnum) {
      if (!trees || trees.length === 0) {
        if (stateEnum.EMPTY) setState(stateEnum.EMPTY);
        return;
      }
      if (stateEnum.LOADED) setState(stateEnum.LOADED);
    }
  }

  var api = {
    getSelectedTreeId: getSelectedTreeId,
    setSelectedTreeId: setSelectedTreeId,
    getRenderableTrees: getRenderableTrees,
    applyTreeSelection: applyTreeSelection,
    sortTrees: sortTrees,
    renderTrees: renderTrees
  };

  window.LoveBudMyTreesRender = api;
  window.LoveTreeMyTreesRender = api;
})();
