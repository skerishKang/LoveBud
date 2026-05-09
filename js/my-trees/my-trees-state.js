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

  function setLastTreesData(nextTrees) {
    lastTreesData = Array.isArray(nextTrees) ? nextTrees.slice() : [];
    return lastTreesData;
  }

  function getLastTreesData() {
    return Array.isArray(lastTreesData) ? lastTreesData.slice() : [];
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
    if (!sortBy || !trees) return trees;

    var sorted = Array.isArray(trees) ? trees.slice() : [];

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
    setSelectedTreeId: setSelectedTreeId,
    getSelectedTreeId: getSelectedTreeId,
    clearSelectedTreeId: clearSelectedTreeId,
    sortTrees: sortTrees,
    bindSortSelect: bindSortSelect
  };
})();
