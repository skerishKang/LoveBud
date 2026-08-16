/**
 * LoveBud - My Trees Filter Helpers
 * v20260616-2535-1
 *
 * Client-side search and filter logic for My LoveTree list
 */

(function () {
  'use strict';

  function normalizeSearchText(text) {
    if (typeof text !== 'string') return '';
    return text.trim().toLowerCase();
  }

  function getTreeMomentCount(tree) {
    if (!tree) return 0;
    var count = tree.memoryCount ?? tree.memory_count ?? tree.nodeCount ?? tree.node_count ?? tree.momentCount ?? tree.moment_count;
    if (count !== undefined && count !== null) return Number(count);
    if (Array.isArray(tree.memories)) return tree.memories.length;
    if (Array.isArray(tree.moments)) return tree.moments.length;
    return 0;
  }

  function getTreeSearchText(tree) {
    if (!tree) return '';
    var title = tree.title || '';
    var repTitle = tree.representativeTitle || tree.representative_title || '';
    var repMemo = tree.representativeMemo || tree.representative_memo || '';
    var visibility = tree.visibility || '';
    return [title, repTitle, repMemo, visibility].join(' ');
  }

  function treeMatchesQuery(tree, query) {
    if (!query) return true;
    var normQuery = normalizeSearchText(query);
    if (!normQuery) return true;
    var normSearchText = normalizeSearchText(getTreeSearchText(tree));
    return normSearchText.indexOf(normQuery) !== -1;
  }

  function treeMatchesFilter(tree, filter) {
    if (!tree) return false;
    var f = filter || 'all';

    // unknown filter fallback to 'all'
    if (f !== 'all' && f !== 'public' && f !== 'private' && f !== 'has-moments' && f !== 'empty') {
      f = 'all';
    }

    if (f === 'all') {
      return true;
    }

    if (f === 'public') {
      return tree.visibility === 'public';
    }

    if (f === 'private') {
      // Issue #3934: unresolved (unknown/empty) visibility is excluded from
      // both the public and private buckets — it may remain only in 'all'.
      return tree.visibility === 'private';
    }

    var count = getTreeMomentCount(tree);

    if (f === 'has-moments') {
      return count > 0;
    }

    if (f === 'empty') {
      return count === 0;
    }

    return true;
  }

  function applyFilters(trees, options) {
    var list = Array.isArray(trees) ? trees : [];
    var query = options && options.query;
    var filter = options && options.filter;

    return list.filter(function (tree) {
      return treeMatchesFilter(tree, filter) && treeMatchesQuery(tree, query);
    });
  }

  function bindFinderControls(options) {
    var onInput = options && options.onInput;
    var onFilterChange = options && options.onFilterChange;

    var searchInput = document.getElementById('myTreesSearchInput');
    if (searchInput && typeof onInput === 'function') {
      searchInput.addEventListener('input', function () {
        onInput(this.value);
      });
    }

    var filterContainer = document.getElementById('myTreesFilterChips');
    if (filterContainer && typeof onFilterChange === 'function') {
      filterContainer.addEventListener('click', function (e) {
        var button = e.target.closest('.my-trees-filter-chip');
        if (!button) return;

        var chips = filterContainer.querySelectorAll('.my-trees-filter-chip');
        chips.forEach(function (chip) {
          chip.classList.remove('is-active');
        });
        button.classList.add('is-active');

        var filterVal = button.getAttribute('data-filter') || 'all';
        onFilterChange(filterVal);
      });
    }
  }

  var api = {
    normalizeSearchText: normalizeSearchText,
    getTreeSearchText: getTreeSearchText,
    treeMatchesQuery: treeMatchesQuery,
    treeMatchesFilter: treeMatchesFilter,
    applyFilters: applyFilters,
    bindFinderControls: bindFinderControls
  };

  window.LoveBudMyTreesFilter = api;
})();
