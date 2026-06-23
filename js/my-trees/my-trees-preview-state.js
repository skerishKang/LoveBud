(function () {
  'use strict';

  var selectedTree = null;
  var expandedFlowKey = null;
  var stateModule = null;
  var treeGridContainer = null;
  var hydratedTreesById = Object.create(null);
  var hydrationRenderSeq = 0;

  function getTreeKey(tree) {
    if (!tree) return '';
    if (tree.id != null && tree.id !== '') {
      return String(tree.id);
    }
    var title = String(tree.title || '').trim();
    var memoryCount = Array.isArray(tree.memories) ? tree.memories.length : Number(tree.memoryCount || 0);
    return title + ':' + memoryCount;
  }

  function getTreeId(tree) {
    if (!tree) return '';
    if (tree.id != null && tree.id !== '') return String(tree.id);
    if (tree.treeId != null && tree.treeId !== '') return String(tree.treeId);
    if (tree.tree_id != null && tree.tree_id !== '') return String(tree.tree_id);
    return '';
  }

  function escapeHtml(value) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.escapeHtml === 'function') return Utils.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTreeMomentCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeMomentCount === 'function') return Utils.getTreeMomentCount(tree);
    if (!tree) return 0;
    var count;
    if (tree.memoryCount != null) {
      count = tree.memoryCount;
    } else if (tree.memory_count != null) {
      count = tree.memory_count;
    } else if (tree.nodeCount != null) {
      count = tree.nodeCount;
    } else if (tree.node_count != null) {
      count = tree.node_count;
    } else if (Array.isArray(tree.memories)) {
      count = tree.memories.length;
    } else if (Array.isArray(tree.nodes)) {
      count = tree.nodes.length;
    } else {
      count = 0;
    }
    count = Number(count);
    return Number.isFinite(count) ? count : 0;
  }

  function normalizeMemory(memory) {
    if (!memory) return null;
    if (window.LoveBudNormalize && typeof window.LoveBudNormalize.normalizeMemory === 'function') {
      return window.LoveBudNormalize.normalizeMemory(memory);
    }
    return memory;
  }

  function getMemoryList(tree) {
    if (!tree) return [];
    if (Array.isArray(tree.memories)) return tree.memories;
    if (Array.isArray(tree.nodes)) return tree.nodes;
    return [];
  }

  function sortMemoriesByFirstMoment(memories) {
    return (Array.isArray(memories) ? memories.slice() : []).map(function (memory) {
      return normalizeMemory(memory) || memory;
    }).filter(Boolean).sort(function (a, b) {
      var left = new Date((a && (a.createdAt || a.created_at || a.timestamp)) || 0).getTime();
      var right = new Date((b && (b.createdAt || b.created_at || b.timestamp)) || 0).getTime();
      return left - right;
    });
  }

  function getMemoryThumbnail(memory) {
    if (!memory) return '';
    return String(memory.thumbnail ||
      memory.thumbnailUrl ||
      memory.thumbnail_url ||
      memory.imageUrl ||
      memory.image_url ||
      memory.coverUrl ||
      memory.cover_url ||
      memory.posterUrl ||
      memory.poster_url ||
      '').trim();
  }

  function getRepresentativeThumbnail(tree) {
    if (!tree) return '';
    return String(tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail || '').trim();
  }

  function getRepresentativeTitle(tree) {
    if (!tree) return '';
    return String(tree.representativeTitle || tree.representative_title || '').trim();
  }

  function getRepresentativeMemo(tree) {
    if (!tree) return '';
    return String(tree.representativeMemo || tree.representative_memo || '').trim();
  }

  /* ── Date range helper ── */
  function formatDate(dateVal) {
    if (!dateVal) return '';
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + day;
  }

  function deriveTimeRange(memories) {
    if (!Array.isArray(memories) || memories.length === 0) return '';
    var dates = memories.map(function (mem) {
      return new Date((mem && (mem.createdAt || mem.created_at || mem.timestamp)) || 0).getTime();
    }).filter(function (t) { return t > 0; });
    if (dates.length === 0) return '';
    var minDate = Math.min.apply(null, dates);
    var maxDate = Math.max.apply(null, dates);
    return formatDate(minDate) + ' ~ ' + formatDate(maxDate);
  }

  function rememberHydratedTree(tree) {
    var treeId = getTreeId(tree);
    if (treeId) hydratedTreesById[treeId] = tree;
    return tree;
  }

  function getHydratedTree(tree) {
    var treeId = getTreeId(tree);
    return treeId && hydratedTreesById[treeId] ? hydratedTreesById[treeId] : tree;
  }

  function readTreeMemoriesCache(treeId) {
    if (!treeId) return null;
    try {
      var keyPrefix = (window.LoveBudMyTreesData && window.LoveBudMyTreesData.TREE_MEMORIES_CACHE_KEY) || 'tree_memories_';
      var raw = localStorage.getItem(keyPrefix + treeId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function shouldUseCachedMemories(tree, cachedMemories) {
    if (!Array.isArray(cachedMemories)) return false;
    if (cachedMemories.length > 0) return true;
    return getTreeMomentCount(tree) <= 0;
  }

  function writeTreeMemoriesCache(treeId, memories) {
    if (!treeId || !Array.isArray(memories)) return;
    try {
      var keyPrefix = (window.LoveBudMyTreesData && window.LoveBudMyTreesData.TREE_MEMORIES_CACHE_KEY) || 'tree_memories_';
      localStorage.setItem(keyPrefix + treeId, JSON.stringify({
        data: memories,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  function deriveCreatedMomentMeta(tree, memories) {
    var ordered = sortMemoriesByFirstMoment(memories);
    var firstMoment = ordered[0] || null;
    var firstThumbnailMoment = ordered.find(function (memory) {
      return !!getMemoryThumbnail(memory);
    }) || firstMoment;
    var knownCount = getTreeMomentCount(tree);
    var memoryCount = Math.max(knownCount, ordered.length);

    var enriched = Object.assign({}, tree || {});
    enriched.memoryCount = memoryCount;
    enriched.representativeThumbnail = getRepresentativeThumbnail(enriched) || getMemoryThumbnail(firstThumbnailMoment) || '';
    enriched.representativeTitle = getRepresentativeTitle(enriched) || (firstMoment && String(firstMoment.title || '').trim()) || '';
    enriched.representativeMemo = getRepresentativeMemo(enriched) || (firstMoment && String(firstMoment.memo || firstMoment.description || '').trim()) || '';
    enriched.memories = ordered.length ? ordered : getMemoryList(tree);
    /* ── derive timeRange if not already set ── */
    if (!enriched.timeRange && !enriched.time_range && ordered.length > 0) {
      enriched.timeRange = deriveTimeRange(ordered);
    }
    return rememberHydratedTree(enriched);
  }

  async function hydrateTreeWithCreatedMoments(tree) {
    var treeId = getTreeId(tree);
    var existingMemories = getMemoryList(tree);
    if (existingMemories.length > 0) {
      return deriveCreatedMomentMeta(tree, existingMemories);
    }

    var cachedMemories = readTreeMemoriesCache(treeId);
    if (shouldUseCachedMemories(tree, cachedMemories)) {
      return deriveCreatedMomentMeta(tree, cachedMemories);
    }

    if (!treeId || String(treeId).trim().toLowerCase().indexOf('public-') === 0 || !window.apiClient || typeof window.apiClient.getMemoriesByTree !== 'function') {
      return deriveCreatedMomentMeta(tree, []);
    }

    try {
      var fetchedMemories = await window.apiClient.getMemoriesByTree(treeId);
      if (Array.isArray(fetchedMemories)) {
        writeTreeMemoriesCache(treeId, fetchedMemories);
        return deriveCreatedMomentMeta(tree, fetchedMemories);
      }
    } catch (e) {}

    return deriveCreatedMomentMeta(tree, []);
  }

  async function hydrateTreesWithCreatedMoments(trees) {
    if (!Array.isArray(trees) || trees.length === 0) return Array.isArray(trees) ? trees : [];
    return Promise.all(trees.map(function (tree) {
      return hydrateTreeWithCreatedMoments(tree);
    }));
  }

  function getMomentLabel(memory, fallback) {
    if (!memory) return fallback || '시작 순간';
    var title = String(memory.title || '').trim();
    if (title) return title.replace(/\s*-\s*.*$/, '').trim() || title;
    var memo = String(memory.memo || memory.description || '').trim();
    if (memo) return memo.slice(0, 32);
    return fallback || '시작 순간';
  }

  function buildHydratedFlowStages(memories) {
    var visible = memories.slice(0, 4);
    return visible.map(function (memory, index) {
      var label = getMomentLabel(memory, index === 0 ? '시작 순간' : '이어진 순간');
      var stageIndex = index + 1;
      var activeClass = (index === 0) ? ' is-active' : '';
      return '<span class="my-trees-hub-flow-stage' + activeClass + '" role="button" tabindex="0" data-my-trees-moment-index="' + stageIndex + '">' +
        '<span class="my-trees-hub-flow-stage-index">' + stageIndex + '</span>' +
        '<span class="my-trees-hub-flow-stage-label" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
        '</span>';
    }).join('');
  }

  /* ── FIX: patch summary with timeRange after hub renders ── */
  function patchSummaryWithTimeRange(tree) {
    var summaryEl = document.getElementById('myTreesHubSummary');
    if (!summaryEl || summaryEl.hidden) return;
    var hydratedTree = getHydratedTree(tree) || tree;
    var timeRange = String(hydratedTree.timeRange || hydratedTree.time_range || '').trim();
    if (!timeRange) return;
    var memoryCount = Math.max(getTreeMomentCount(tree), getTreeMomentCount(hydratedTree));
    if (memoryCount <= 0) return;
    var summaryTitle = String((hydratedTree && hydratedTree.title) || (tree && tree.title) || '나의 러브트리').trim();
    summaryEl.innerHTML = '<p class="preview-summary-line"><strong>' + escapeHtml(summaryTitle) + '</strong>에 담긴 <strong>' + memoryCount + '개의 순간</strong>이 <strong>' + escapeHtml(timeRange) + '</strong>에 걸쳐 이어졌어요.</p>';
  }

  function patchHubForCreatedMoments(tree) {
    var hydratedTree = getHydratedTree(tree);
    var memoryCount = Math.max(getTreeMomentCount(tree), getTreeMomentCount(hydratedTree));
    if (memoryCount <= 0) return;

    var noMoments = document.getElementById('myTreesHubNoMoments');
    var flowSection = document.getElementById('myTreesHubFlow');
    var flowList = document.getElementById('myTreesHubFlowList');
    var flowControls = document.getElementById('myTreesHubFlowControls');
    var repBlock = document.getElementById('myTreesHubRep');
    var memories = getMemoryList(hydratedTree).length ? getMemoryList(hydratedTree) : getMemoryList(tree);

    if (memories.length > 0) {
      if (noMoments) noMoments.hidden = true;
      if (flowSection) flowSection.hidden = false;
      if (flowList) {
        flowList.innerHTML = buildHydratedFlowStages(memories);
        var previewHub =
          window.LoveBudMyTreesPreviewHub ||
          window.LoveTreeMyTreesPreviewHub;

        if (previewHub && typeof previewHub.rebindFlowStages === 'function') {
          previewHub.rebindFlowStages(tree);
        }
      }
      if (flowControls) {
        var hiddenCount = Math.max(0, memories.length - 4);
        /* FIX: use Browse-style label "... 그리고 N개의 순간 더" instead of "더보기 (N)" */
        if (hiddenCount > 0) {
          flowControls.replaceChildren();
          var flowToggle = document.createElement('button');
          flowToggle.type = 'button';
          flowToggle.className = 'my-trees-hub-flow-toggle';
          flowToggle.setAttribute('data-my-trees-flow-toggle', '');
          flowToggle.textContent = '... 그리고 ' + hiddenCount + '개의 순간 더';
          flowControls.appendChild(flowToggle);
          flowControls.style.display = '';
          flowControls.hidden = false;
        } else {
          flowControls.replaceChildren();
          flowControls.style.display = 'none';
          flowControls.hidden = true;
        }
      }
      /* FIX: patch summary line to include date range */
      patchSummaryWithTimeRange(tree);
      return;
    }

    if (repBlock && !repBlock.hidden && String(repBlock.textContent || '').trim()) {
      if (noMoments) noMoments.hidden = true;
      return;
    }

    if (noMoments) {
      var titleText = String((hydratedTree && hydratedTree.title) || (tree && tree.title) || '나의 러브트리').trim();
      noMoments.hidden = false;
      noMoments.innerHTML = '<span class="material-symbols-outlined">auto_stories</span>' +
        '<strong>' + escapeHtml(titleText) + '</strong>' +
        '<p>' + escapeHtml(memoryCount + '개의 순간이 있어요. 트리를 열면 이어진 흐름을 확인할 수 있어요.') + '</p>';
    }
  }

  function patchDataLoader(dataModule) {
    if (!dataModule || dataModule.__createdMomentHydrationPatched) return dataModule;
    var originalLoadTrees = dataModule.loadTrees;
    if (typeof originalLoadTrees !== 'function') return dataModule;

    dataModule.loadTrees = function (options) {
      options = options || {};
      var originalRenderTrees = options.renderTrees;
      if (typeof originalRenderTrees !== 'function') {
        return originalLoadTrees.call(dataModule, options);
      }

      var wrappedOptions = Object.assign({}, options, {
        renderTrees: function (trees) {
          var renderSeq = ++hydrationRenderSeq;
          return hydrateTreesWithCreatedMoments(trees).then(function (hydratedTrees) {
            if (renderSeq !== hydrationRenderSeq) return;
            originalRenderTrees(hydratedTrees);
          }).catch(function () {
            if (renderSeq !== hydrationRenderSeq) return;
            originalRenderTrees(trees);
          });
        }
      });

      return originalLoadTrees.call(dataModule, wrappedOptions);
    };

    dataModule.__createdMomentHydrationPatched = true;
    dataModule.hydrateTreesWithCreatedMoments = hydrateTreesWithCreatedMoments;
    return dataModule;
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
      card.classList.remove('is-selected', 'is-active');
      card.removeAttribute('data-selected-tree-card');
    });

    cards.forEach(function (card) {
      if (card.dataset && card.dataset.treeId === String(treeId)) {
        card.classList.add('is-selected', 'is-active');
        card.setAttribute('data-selected-tree-card', 'true');
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
        var result = originalShowContent.call(hub, tree);
        patchHubForCreatedMoments(tree);
        return result;
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
        var result = originalOnCardClick.call(hub, tree, event);
        patchHubForCreatedMoments(tree);
        return result;
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
    hydrateTreesWithCreatedMoments: hydrateTreesWithCreatedMoments,
    patchDataLoader: patchDataLoader,
    patchPreviewHub: patchPreviewHub
  };

  window.LoveBudMyTreesPreviewState = api;
  patchDataLoader(window.LoveBudMyTreesData);
  patchPreviewHub(window.LoveBudMyTreesPreviewHub);
  patchPreviewHub(window.LoveTreeMyTreesPreviewHub);
})();
