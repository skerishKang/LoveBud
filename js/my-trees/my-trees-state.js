/**
 * LoveBud - My Trees State
 * v20260421-1
 *
 * Responsibilities:
 * - sort tree collections
 * - keep lightweight lastTreesData state
 * - keep lightweight selected tree state
 * - bind sort select change handler
 */

(function() {
  var lastTreesData = [];
  var selectedTreeId = null;
  var treeNextCursor = null;
  var isLoadingMoreTrees = false;

  function setLastTreesData(nextTrees) {
    lastTreesData = Array.isArray(nextTrees) ? nextTrees.slice() : [];
    return lastTreesData;
  }

  function getLastTreesData() {
    return Array.isArray(lastTreesData) ? lastTreesData.slice() : [];
  }

  function setTreeNextCursor(nextCursor) {
    treeNextCursor = (typeof nextCursor === 'string' && nextCursor) ? nextCursor : null;
    return treeNextCursor;
  }

  function getTreeNextCursor() {
    return treeNextCursor || null;
  }

  function hasMoreTrees() {
    return !!treeNextCursor;
  }

  function setIsLoadingMoreTrees(val) {
    isLoadingMoreTrees = !!val;
    return isLoadingMoreTrees;
  }

  function getIsLoadingMoreTrees() {
    return isLoadingMoreTrees;
  }

  function resetPaginationState() {
    treeNextCursor = null;
    isLoadingMoreTrees = false;
  }

  function setSelectedTreeId(nextTreeId) {
    selectedTreeId = nextTreeId || null;
    return selectedTreeId;
  }

  function getSelectedTreeId() {
    return selectedTreeId || null;
  }

  function clearSelectedTreeId() {
    selectedTreeId = null;
    return selectedTreeId;
  }

  function sortTrees(trees, sortBy) {
    var source = Array.isArray(trees) ? trees : [];

    if (source.length === 0 && Array.isArray(lastTreesData) && lastTreesData.length > 0) {
      source = lastTreesData;
    }

    var sorted = source.slice();

    if (!sortBy) return sorted;

    switch (sortBy) {
      case 'recent':
        sorted.sort(function(a, b) {
          var dateA = new Date(a.updatedAt || a.createdAt || 0);
          var dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateB - dateA;
        });
        break;
      case 'oldest':
        sorted.sort(function(a, b) {
          var dateA = new Date(a.updatedAt || a.createdAt || 0);
          var dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateA - dateB;
        });
        break;
      case 'name':
        sorted.sort(function(a, b) {
          return (a.title || '').localeCompare(b.title || '');
        });
        break;
    }

    return sorted;
  }

  function bindSortSelect(options) {
    var select = options && options.select;
    var renderTrees = options && options.renderTrees;
    var getData = options && options.getLastTreesData;

    if (!select || typeof renderTrees !== 'function' || typeof getData !== 'function') {
      return;
    }

    select.addEventListener('change', function() {
      var source = getData();
      var sorted = sortTrees(source, this.value);
      renderTrees(sorted);
    });
  }

  window.LoveBudMyTreesState = {
    setLastTreesData: setLastTreesData,
    getLastTreesData: getLastTreesData,
    setTreeNextCursor: setTreeNextCursor,
    getTreeNextCursor: getTreeNextCursor,
    hasMoreTrees: hasMoreTrees,
    setIsLoadingMoreTrees: setIsLoadingMoreTrees,
    getIsLoadingMoreTrees: getIsLoadingMoreTrees,
    resetPaginationState: resetPaginationState,
    setSelectedTreeId: setSelectedTreeId,
    getSelectedTreeId: getSelectedTreeId,
    clearSelectedTreeId: clearSelectedTreeId,
    sortTrees: sortTrees,
    bindSortSelect: bindSortSelect
  };
})();
