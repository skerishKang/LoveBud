(function () {
  'use strict';

  var FIRST_BATCH_SIZE = 4;
  var BATCH_SIZE = 6;
  var currentVisibleCount = 0;
  var totalTreesCount = 0;
  var allTreesData = [];
  var isLoadingMore = false;
  var scrollSentinel = null;

  function getUI() {
    return window.LoveBudMyTreesUI || window.LoveTreeMyTreesUI || {};
  }

  function getBuildTreeCard(options) {
    var UI = getUI();
    return (options && options.buildTreeCard) || UI.buildTreeCard;
  }

  function getUpdateManageSummary(options) {
    var UI = getUI();
    return (options && options.updateManageSummary) || UI.updateManageSummary;
  }

  function renderTrees(trees, options) {
    var hubOnSelect = options && options.onSelect;
    var hubOnNavigate = options && options.onNavigate;
    var container = document.getElementById('state-loaded');
    if (!container) return;

    var setState = options && options.setState;
    var stateEnum = options && options.stateEnum;
    var buildTreeCardFn = getBuildTreeCard(options);
    var updateManageSummaryFn = getUpdateManageSummary(options);

    if (options && typeof options.setLastTreesData === 'function') {
      options.setLastTreesData(Array.isArray(trees) ? trees : []);
    }

    if (typeof updateManageSummaryFn === 'function') {
      updateManageSummaryFn(trees, options);
    }

    if (!trees || trees.length === 0) {
      if (typeof setState === 'function' && stateEnum && stateEnum.EMPTY) {
        setState(stateEnum.EMPTY);
      }
      return;
    }

    allTreesData = trees;
    totalTreesCount = trees.length;
    currentVisibleCount = 0;

    var grid = document.getElementById('trees-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'trees-grid';
      grid.id = 'trees-grid';
      container.appendChild(grid);
    }

    grid.innerHTML = '';

    renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, { onSelect: hubOnSelect, onNavigate: hubOnNavigate });
    setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, { onSelect: hubOnSelect, onNavigate: hubOnNavigate });

    if (typeof setState === 'function' && stateEnum && stateEnum.LOADED) {
      setState(stateEnum.LOADED);
    }
  }

  function renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    var startIndex = currentVisibleCount;
    var batchSize = startIndex === 0 ? FIRST_BATCH_SIZE : BATCH_SIZE;
    var endIndex = Math.min(startIndex + batchSize, totalTreesCount);

    var onSelect = extraOptions && extraOptions.onSelect;
    var onNavigate = extraOptions && extraOptions.onNavigate;

    for (var i = startIndex; i < endIndex; i++) {
      var tree = allTreesData[i];
      var card = typeof buildTreeCardFn === 'function'
        ? buildTreeCardFn(tree, { onSelect: onSelect, onNavigate: onNavigate })
        : null;
      if (!(card instanceof Node)) {
        console.warn('[my-trees-batch-render] buildTreeCard returned a non-Node value:', card, tree);
        continue;
      }
      card.style.opacity = '0';
      card.classList.add('tree-card-batch-pending');
      grid.appendChild(card);

      setTimeout(function(c) {
        c.style.transition = 'opacity 0.2s ease-in';
        c.style.opacity = '1';
        c.classList.remove('tree-card-batch-pending');
      }, 10, card);
    }

    currentVisibleCount = endIndex;

    var summary = document.getElementById('trees-manage-summary');
    if (summary) {
      var i18n = window.i18nMyTrees || {};
      var countText = (i18n.myTrees_count || '총 {count}개').replace('{count}', String(totalTreesCount));
      summary.textContent = countText;
    }
  }

  function setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    if (scrollSentinel) {
      scrollSentinel.remove();
    }

    if (currentVisibleCount >= totalTreesCount) {
      return;
    }

    scrollSentinel = document.createElement('div');
    scrollSentinel.id = 'trees-scroll-sentinel';
    scrollSentinel.style.height = '20px';
    scrollSentinel.style.gridColumn = '1 / -1';
    grid.appendChild(scrollSentinel);

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !isLoadingMore && currentVisibleCount < totalTreesCount) {
            loadMoreBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions);
          }
        });
      }, { rootMargin: '100px' });

      scrollSentinel._extraOptions = extraOptions;
      observer.observe(scrollSentinel);
      scrollSentinel._observer = observer;
    }
  }

  function loadMoreBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    if (isLoadingMore || currentVisibleCount >= totalTreesCount) {
      return;
    }

    isLoadingMore = true;

    if (scrollSentinel && scrollSentinel._observer) {
      scrollSentinel._observer.disconnect();
    }

    renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions);
    setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, extraOptions);

    isLoadingMore = false;
  }

  function resetBatchState() {
    var grid = document.getElementById('trees-grid');
    if (grid) {
      grid.innerHTML = '';
    }
    currentVisibleCount = 0;
    allTreesData = [];
    totalTreesCount = 0;
    isLoadingMore = false;
  }

  var api = {
    renderTrees: renderTrees,
    renderNextBatch: renderNextBatch,
    setupScrollContinuation: setupScrollContinuation,
    loadMoreBatch: loadMoreBatch,
    resetBatchState: resetBatchState
  };

  window.LoveBudMyTreesBatchRender = api;

  if (window.LoveBudMyTreesUI) {
    window.LoveBudMyTreesUI.renderTrees = renderTrees;
  }
  if (window.LoveTreeMyTreesUI) {
    window.LoveTreeMyTreesUI.renderTrees = renderTrees;
  }
})();
