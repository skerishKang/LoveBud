(function () {
  'use strict';

  var selectedTree = null;
  var expandedFlowKey = null;
  var stateModule = null;
  var treeGridContainer = null;

  function getTreeKey(tree) {
    if (!tree) return '';
    if (tree.id != null && tree.id !== '') {
      return String(tree.id);
    }
    var title = String(tree.title || '').trim();
    var memoryCount = Array.isArray(tree.memories) ? tree.memories.length : Number(tree.memoryCount || 0);
    return title + ':' + memoryCount;
  }

  function setTreeGridContainer(selectorOrEl) {
    if (typeof selectorOrEl === 'string') {
      treeGridContainer = document.querySelector(selectorOrEl);
    } else {
      treeGridContainer = selectorOrEl || null;
    }
    return treeGridContainer;
  }

  function getTreeGridContainer() {
    return treeGridContainer;
  }

  function setStateModule(module) {
    stateModule = module || null;
    return stateModule;
  }

  function getStateModule() {
    return stateModule;
  }

  function setSelectedTree(tree) {
    selectedTree = tree || null;
    return selectedTree;
  }

  function getSelectedTree() {
    return selectedTree;
  }

  function clearSelection() {
    selectedTree = null;
    expandedFlowKey = null;
  }

  function getExpandedFlowKey() {
    return expandedFlowKey;
  }

  function setExpandedFlowKey(key) {
    expandedFlowKey = key || null;
    return expandedFlowKey;
  }

  function isFlowExpanded(tree) {
    var treeKey = getTreeKey(tree);
    return !!treeKey && expandedFlowKey === treeKey;
  }

  function toggleFlowExpanded(tree) {
    var treeKey = getTreeKey(tree);
    expandedFlowKey = expandedFlowKey === treeKey ? null : treeKey;
    return expandedFlowKey;
  }

  function syncSelectedTreeId(treeId) {
    if (stateModule && typeof stateModule.setSelectedTreeId === 'function') {
      stateModule.setSelectedTreeId(treeId);
    }
  }

  function markSelectedCard(treeId, grid) {
    var targetGrid = grid || document.getElementById('trees-grid') || treeGridContainer;
    if (!targetGrid || typeof targetGrid.querySelectorAll !== 'function') return;

    var cards = targetGrid.querySelectorAll('.tree-card');
    cards.forEach(function (card) {
      card.classList.remove('is-selected');
    });

    cards.forEach(function (card) {
      if (card.dataset && card.dataset.treeId === String(treeId)) {
        card.classList.add('is-selected');
      }
    });
  }

  function patchPreviewHub(hub) {
    if (!hub || hub.__previewStatePatched) return hub;

    var originalInit = hub.init;
    var originalShowPlaceholder = hub.showPlaceholder;
    var originalShowContent = hub.showContent;
    var originalShowLoading = hub.showLoading;
    var originalOnCardClick = hub.onCardClick;
    var originalSetTreeGridContainer = hub.setTreeGridContainer;

    if (typeof originalInit === 'function') {
      hub.init = function (options) {
        options = options || {};
        setStateModule(options.stateModule || window.LoveBudMyTreesState || null);
        return originalInit.call(hub, options);
      };
    }

    if (typeof originalShowPlaceholder === 'function') {
      hub.showPlaceholder = function () {
        clearSelection();
        return originalShowPlaceholder.call(hub);
      };
    }

    if (typeof originalShowContent === 'function') {
      hub.showContent = function (tree) {
        setSelectedTree(tree);
        return originalShowContent.call(hub, tree);
      };
    }

    if (typeof originalShowLoading === 'function') {
      hub.showLoading = function (tree) {
        setSelectedTree(tree);
        return originalShowLoading.call(hub, tree);
      };
    }

    if (typeof originalOnCardClick === 'function') {
      hub.onCardClick = function (tree, event) {
        setSelectedTree(tree);
        if (tree && tree.id != null) {
          markSelectedCard(tree.id);
          syncSelectedTreeId(tree.id);
        }
        return originalOnCardClick.call(hub, tree, event);
      };
    }

    if (typeof originalSetTreeGridContainer === 'function') {
      hub.setTreeGridContainer = function (selectorOrEl) {
        setTreeGridContainer(selectorOrEl);
        return originalSetTreeGridContainer.call(hub, selectorOrEl);
      };
    }

    hub.getSelectedTree = getSelectedTree;
    hub.__previewStatePatched = true;
    return hub;
  }

  var api = {
    getTreeKey: getTreeKey,
    setTreeGridContainer: setTreeGridContainer,
    getTreeGridContainer: getTreeGridContainer,
    setStateModule: setStateModule,
    getStateModule: getStateModule,
    setSelectedTree: setSelectedTree,
    getSelectedTree: getSelectedTree,
    clearSelection: clearSelection,
    getExpandedFlowKey: getExpandedFlowKey,
    setExpandedFlowKey: setExpandedFlowKey,
    isFlowExpanded: isFlowExpanded,
    toggleFlowExpanded: toggleFlowExpanded,
    syncSelectedTreeId: syncSelectedTreeId,
    markSelectedCard: markSelectedCard,
    patchPreviewHub: patchPreviewHub
  };

  window.LoveBudMyTreesPreviewState = api;
  patchPreviewHub(window.LoveBudMyTreesPreviewHub);
  patchPreviewHub(window.LoveTreeMyTreesPreviewHub);
})();
