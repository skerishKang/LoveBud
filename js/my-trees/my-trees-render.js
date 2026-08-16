/**
 * LoveBud - My Trees Render Helpers
 * v20260816-3944-continuation-1
 *
 * Responsibilities:
 * - Tree card rendering orchestration
 * - Dropdown management
 * - Selection state accessors
 * - Tree sorting
 * - #3944 bounded participant continuation bridge for Trees and Memories
 */

(function () {
  'use strict';

  var MEMORY_PAGE_LIMIT = 100;

  // Private state (mirrors/main-tracks selection, synced with my-trees-state)
  var _selectedTreeId = null;
  var memoryPagesByAuthority = Object.create(null);

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

  function getTreeId(tree) {
    if (!tree) return '';
    if (tree.id != null && tree.id !== '') return String(tree.id);
    if (tree.treeId != null && tree.treeId !== '') return String(tree.treeId);
    if (tree.tree_id != null && tree.tree_id !== '') return String(tree.tree_id);
    return '';
  }

  function getMemoryId(memory) {
    if (!memory) return '';
    if (memory.id != null && memory.id !== '') return String(memory.id);
    if (memory.memoryId != null && memory.memoryId !== '') return String(memory.memoryId);
    if (memory.memory_id != null && memory.memory_id !== '') return String(memory.memory_id);
    return '';
  }

  function getMemoryCreatedAt(memory) {
    if (!memory) return 0;
    var raw = memory.createdAt || memory.created_at || memory.timestamp || 0;
    var value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function getKnownMemoryCount(tree) {
    if (!tree) return 0;
    var raw = tree.memoryCount;
    if (raw == null) raw = tree.memory_count;
    if (raw == null) raw = tree.nodeCount;
    if (raw == null) raw = tree.node_count;
    if (raw == null && Array.isArray(tree.memories)) raw = tree.memories.length;
    var value = Number(raw || 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function mergeMemoryItems(existing, incoming) {
    var merged = [];
    var seen = Object.create(null);

    function add(memory) {
      if (!memory) return;
      var id = getMemoryId(memory);
      if (id) {
        if (seen[id]) return;
        seen[id] = true;
      }
      merged.push(memory);
    }

    (Array.isArray(existing) ? existing : []).forEach(add);
    (Array.isArray(incoming) ? incoming : []).forEach(add);

    merged.sort(function (left, right) {
      var timeDiff = getMemoryCreatedAt(left) - getMemoryCreatedAt(right);
      if (timeDiff !== 0) return timeDiff;
      return getMemoryId(left).localeCompare(getMemoryId(right));
    });

    return merged;
  }

  function normalizeMemoryPage(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
      throw new Error('Invalid owner-memory page payload');
    }
    var nextCursor = payload.nextCursor;
    if (nextCursor !== null && typeof nextCursor !== 'string') {
      throw new Error('Invalid owner-memory nextCursor');
    }
    return {
      items: payload.items,
      nextCursor: nextCursor || null
    };
  }

  function getConfirmedOwnerUid() {
    try {
      if (window.LoveBudProtectedRoute && typeof window.LoveBudProtectedRoute.getAuthState === 'function') {
        var state = window.LoveBudProtectedRoute.getAuthState();
        if (state && state.ready && state.user && state.user.uid) return String(state.user.uid);
      }
      if (typeof window.getConfirmedAuthUser === 'function') {
        var confirmed = window.getConfirmedAuthUser();
        if (confirmed && confirmed.uid) return String(confirmed.uid);
      }
      if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
        var raw = localStorage.getItem('lovebud_auth_cache');
        if (raw && raw !== 'null') {
          var cached = JSON.parse(raw);
          if (cached && cached.uid) return String(cached.uid);
        }
      }
    } catch (e) {}
    return '';
  }

  function getOwnerListGeneration() {
    var dataModule = window.LoveBudMyTreesData;
    if (dataModule && typeof dataModule.getOwnerListGeneration === 'function') {
      return Number(dataModule.getOwnerListGeneration()) || 0;
    }
    return 0;
  }

  function captureMemoryAuthority(treeId) {
    var uid = getConfirmedOwnerUid();
    var generation = getOwnerListGeneration();
    var safeTreeId = String(treeId || '');
    return {
      uid: uid,
      generation: generation,
      treeId: safeTreeId,
      key: uid + '|' + generation + '|' + safeTreeId
    };
  }

  function isMemoryAuthorityCurrent(authority, requireSelectedTree) {
    if (!authority) return false;
    if (getConfirmedOwnerUid() !== authority.uid) return false;
    if (getOwnerListGeneration() !== authority.generation) return false;
    if (requireSelectedTree) {
      var hub = window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub;
      var selected = hub && typeof hub.getSelectedTree === 'function' ? hub.getSelectedTree() : null;
      if (getTreeId(selected) !== authority.treeId) return false;
    }
    return true;
  }

  function getMemoryPageEntry(tree, authority) {
    var auth = authority || captureMemoryAuthority(getTreeId(tree));
    var entry = memoryPagesByAuthority[auth.key];
    if (!entry) {
      entry = {
        authority: auth,
        items: mergeMemoryItems([], tree && tree.memories),
        nextCursor: null,
        initialized: false,
        inFlight: null,
        requestSeq: 0
      };
      memoryPagesByAuthority[auth.key] = entry;
    } else if (tree && Array.isArray(tree.memories)) {
      entry.items = mergeMemoryItems(entry.items, tree.memories);
    }
    return entry;
  }

  function writeMemoryContinuationCache(treeId, memories) {
    if (!treeId || !Array.isArray(memories)) return;
    try {
      var prefix = (window.LoveBudMyTreesData && window.LoveBudMyTreesData.TREE_MEMORIES_CACHE_KEY) || 'tree_memories_';
      localStorage.setItem(prefix + treeId, JSON.stringify({ data: memories, timestamp: Date.now() }));
    } catch (e) {}
  }

  function mergePagedMemoriesIntoTree(tree) {
    var treeId = getTreeId(tree);
    if (!treeId) return tree;
    var authority = captureMemoryAuthority(treeId);
    var entry = memoryPagesByAuthority[authority.key];
    if (!entry || !entry.items.length) return tree;
    var enriched = Object.assign({}, tree || {});
    enriched.memories = mergeMemoryItems(tree && tree.memories, entry.items);
    enriched.memoryCount = Math.max(getKnownMemoryCount(tree), enriched.memories.length);
    return enriched;
  }

  function installTreeContinuationBridge() {
    var dataModule = window.LoveBudMyTreesData;
    var stateModule = window.LoveBudMyTreesState;
    if (!dataModule || typeof dataModule.loadMoreTrees !== 'function' || dataModule.__participantContinuationBridge3944) return;

    var originalLoadMoreTrees = dataModule.loadMoreTrees;
    var originalSetLoading = stateModule && typeof stateModule.setIsLoadingMoreTrees === 'function'
      ? stateModule.setIsLoadingMoreTrees
      : null;

    // A stale prior-account finalizer must never clear the loading state of a
    // newer request. loadMoreTrees already keeps the active request flag
    // generation-owned; mirror that ownership at the UI state boundary.
    if (stateModule && originalSetLoading && !stateModule.__generationOwnedLoading3944) {
      stateModule.setIsLoadingMoreTrees = function (value) {
        if (value === false && typeof dataModule.isLoadMoreInFlight === 'function' && dataModule.isLoadMoreInFlight()) {
          return;
        }
        return originalSetLoading.call(stateModule, value);
      };
      stateModule.__generationOwnedLoading3944 = true;
    }

    function getContinuationUiOptions() {
      var pageModule = window.LoveBudMyTreesPage || null;
      return {
        setState: pageModule && pageModule.setState,
        stateEnum: pageModule && pageModule.STATE,
        onSelect: function (tree) {
          var hub = window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub;
          if (hub && typeof hub.onCardClick === 'function') hub.onCardClick(tree);
        },
        onLoadMore: requestNextTreePage
      };
    }

    function appendServerPage(uniqueNew, mergedTrees) {
      var uiModule = window.LoveBudMyTreesUI || window.LoveTreeMyTreesUI;
      if (uiModule && typeof uiModule.appendTrees === 'function') {
        uiModule.appendTrees(uniqueNew, mergedTrees, getContinuationUiOptions());
      }
    }

    function refreshPaginationControls() {
      var uiModule = window.LoveBudMyTreesUI || window.LoveTreeMyTreesUI;
      if (uiModule && typeof uiModule.updatePaginationControls === 'function') {
        uiModule.updatePaginationControls(getContinuationUiOptions());
      }
    }

    function requestNextTreePage(options) {
      var callerOptions = Object.assign({}, options || {});
      var callerAppend = callerOptions.appendTrees;
      var callerSettled = callerOptions.onSettled;

      callerOptions.appendTrees = function (uniqueNew, mergedTrees, loadOptions) {
        appendServerPage(uniqueNew, mergedTrees);
        if (typeof callerAppend === 'function') {
          callerAppend(uniqueNew, mergedTrees, loadOptions);
        }
      };

      callerOptions.onSettled = function () {
        refreshPaginationControls();
        if (typeof callerSettled === 'function') callerSettled();
      };

      return originalLoadMoreTrees.call(dataModule, callerOptions);
    }

    dataModule.loadMoreTrees = requestNextTreePage;
    dataModule.requestNextTreePage = requestNextTreePage;
    dataModule.__participantContinuationBridge3944 = true;
  }

  function installMemoryApiBridge() {
    var client = window.apiClient;
    if (!client || typeof client.getMemoriesPage !== 'function' || client.__ownerMemoryContinuationBridge3944) return;

    var legacyGetMemoriesByTree = client.getMemoriesByTree;

    client.getMemoriesByTree = function (treeId) {
      var authority = captureMemoryAuthority(treeId);
      var entry = getMemoryPageEntry({ id: treeId, memories: [] }, authority);

      if (entry.initialized) {
        return Promise.resolve(entry.items.slice());
      }
      if (entry.inFlight) {
        return entry.inFlight;
      }

      var requestSeq = ++entry.requestSeq;
      entry.inFlight = client.getMemoriesPage({ treeId: authority.treeId, limit: MEMORY_PAGE_LIMIT }).then(function (payload) {
        var page = normalizeMemoryPage(payload);
        if (!isMemoryAuthorityCurrent(authority, false) || requestSeq !== entry.requestSeq) {
          return [];
        }
        entry.items = mergeMemoryItems(entry.items, page.items);
        entry.nextCursor = page.nextCursor;
        entry.initialized = true;
        writeMemoryContinuationCache(authority.treeId, entry.items);
        return entry.items.slice();
      }).catch(function (error) {
        // Keep the legacy fallback only for environments that unexpectedly
        // lose the cursor API itself. Normal page errors stay retryable and
        // are surfaced to the existing preview-state degradation path.
        if (typeof client.getMemoriesPage !== 'function' && typeof legacyGetMemoriesByTree === 'function') {
          return legacyGetMemoriesByTree(treeId);
        }
        throw error;
      }).finally(function () {
        if (requestSeq === entry.requestSeq) entry.inFlight = null;
      });

      return entry.inFlight;
    };

    client.__ownerMemoryContinuationBridge3944 = true;
  }

  function fetchNextMemoryPage(tree) {
    var client = window.apiClient;
    var hub = window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub;
    var treeId = getTreeId(tree);
    if (!client || typeof client.getMemoriesPage !== 'function' || !hub || !treeId) {
      return Promise.resolve(null);
    }

    var authority = captureMemoryAuthority(treeId);
    var entry = getMemoryPageEntry(tree, authority);
    if (entry.inFlight) return entry.inFlight;
    if (entry.initialized && !entry.nextCursor) return Promise.resolve({ terminal: true, items: entry.items.slice() });

    var requestCursor = entry.initialized ? entry.nextCursor : null;
    var requestSeq = ++entry.requestSeq;
    entry.inFlight = client.getMemoriesPage({
      treeId: treeId,
      limit: MEMORY_PAGE_LIMIT,
      cursor: requestCursor || undefined
    }).then(function (payload) {
      var page = normalizeMemoryPage(payload);
      if (!isMemoryAuthorityCurrent(authority, true) || requestSeq !== entry.requestSeq) {
        return null;
      }

      entry.items = mergeMemoryItems(entry.items, page.items);
      entry.nextCursor = page.nextCursor;
      entry.initialized = true;
      writeMemoryContinuationCache(treeId, entry.items);

      var selectedTree = hub.getSelectedTree();
      var updatedTree = Object.assign({}, selectedTree || tree || {});
      updatedTree.memories = mergeMemoryItems(updatedTree.memories, entry.items);
      updatedTree.memoryCount = Math.max(getKnownMemoryCount(updatedTree), updatedTree.memories.length);
      hub.showContent(updatedTree);

      return {
        items: page.items,
        totalLoaded: entry.items.length,
        nextCursor: entry.nextCursor
      };
    }).catch(function (error) {
      // Cursor is intentionally not advanced on failure, so the participant
      // can retry the same page without losing or skipping records.
      console.error('[my-trees-render] Memory continuation failed:', error);
      return null;
    }).finally(function () {
      if (requestSeq === entry.requestSeq) entry.inFlight = null;
      setTimeout(decorateMemoryContinuationControl, 0);
    });

    setTimeout(decorateMemoryContinuationControl, 0);
    return entry.inFlight;
  }

  function isExpandedFlowToggle(toggle) {
    if (!toggle) return false;
    var text = String(toggle.textContent || '').trim().toLowerCase();
    return text === '접기' || text === 'show less';
  }

  function decorateMemoryContinuationControl() {
    var hub = window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub;
    if (!hub || typeof hub.getSelectedTree !== 'function') return;
    var tree = hub.getSelectedTree();
    var treeId = getTreeId(tree);
    var controls = document.getElementById('myTreesHubFlowControls');
    if (!treeId || !controls) return;

    var existingMore = controls.querySelector('[data-my-trees-memory-continuation]');
    if (existingMore) existingMore.remove();

    var flowToggle = controls.querySelector('[data-my-trees-flow-toggle]');
    if (!isExpandedFlowToggle(flowToggle)) return;

    var authority = captureMemoryAuthority(treeId);
    var entry = memoryPagesByAuthority[authority.key];
    if (!entry) return;
    if (entry.initialized && !entry.nextCursor) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'my-trees-hub-flow-toggle preview-flow-toggle my-trees-memory-continuation';
    button.setAttribute('data-my-trees-memory-continuation', '');
    button.disabled = !!entry.inFlight;

    if (entry.inFlight) {
      button.textContent = '불러오는 중...';
    } else {
      var remaining = Math.max(0, getKnownMemoryCount(tree) - entry.items.length);
      button.textContent = remaining > 0
        ? '... 그리고 ' + remaining + '개의 순간 더 불러오기'
        : '... 순간 더 불러오기';
    }

    controls.appendChild(button);
  }

  function installMemoryHubBridge() {
    var hub = window.LoveBudMyTreesPreviewHub || window.LoveTreeMyTreesPreviewHub;
    if (!hub || hub.__ownerMemoryContinuationHub3944) return;

    var originalShowContent = hub.showContent;
    var originalOnCardClick = hub.onCardClick;

    if (typeof originalShowContent === 'function') {
      hub.showContent = function (tree) {
        var result = originalShowContent.call(hub, mergePagedMemoriesIntoTree(tree));
        setTimeout(decorateMemoryContinuationControl, 0);
        return result;
      };
    }

    if (typeof originalOnCardClick === 'function') {
      hub.onCardClick = function (tree, event) {
        return originalOnCardClick.call(hub, mergePagedMemoriesIntoTree(tree), event);
      };
    }

    // The existing flow toggle remains the expand/collapse authority. A first
    // expand is the participant demand boundary for one additional bounded
    // page. Further pages use a sibling control in the existing flow-controls
    // slot; each click fetches exactly one page and never auto-drains history.
    document.addEventListener('click', function (event) {
      var moreButton = event.target && event.target.closest
        ? event.target.closest('[data-my-trees-memory-continuation]')
        : null;
      if (moreButton) {
        event.preventDefault();
        if (moreButton.disabled) return;
        var selectedForMore = hub.getSelectedTree();
        fetchNextMemoryPage(selectedForMore);
        return;
      }

      var flowToggle = event.target && event.target.closest
        ? event.target.closest('[data-my-trees-flow-toggle]')
        : null;
      if (!flowToggle || isExpandedFlowToggle(flowToggle)) return;

      var selectedTree = hub.getSelectedTree();
      if (!selectedTree) return;
      setTimeout(function () {
        fetchNextMemoryPage(selectedTree);
      }, 0);
    }, true);

    hub.fetchNextMemoryPage = fetchNextMemoryPage;
    hub.decorateMemoryContinuationControl = decorateMemoryContinuationControl;
    hub.__ownerMemoryContinuationHub3944 = true;
  }

  function installContinuationBridges() {
    installTreeContinuationBridge();
    installMemoryApiBridge();
    installMemoryHubBridge();
  }

  var api = {
    getSelectedTreeId: getSelectedTreeId,
    setSelectedTreeId: setSelectedTreeId,
    getRenderableTrees: getRenderableTrees,
    applyTreeSelection: applyTreeSelection,
    sortTrees: sortTrees,
    renderTrees: renderTrees,
    installContinuationBridges: installContinuationBridges,
    fetchNextMemoryPage: fetchNextMemoryPage
  };

  window.LoveBudMyTreesRender = api;
  window.LoveTreeMyTreesRender = api;

  // data/state/apiClient are already loaded before this module on My Trees.
  // Patch those immediately so preview-state's initial hydration uses the
  // bounded Memory page contract rather than the legacy capped list.
  installTreeContinuationBridge();
  installMemoryApiBridge();

  // Preview hub/state load after this module. Install the participant-demand
  // bridge once the current script stack finishes, and again at DOM readiness
  // as a cache/order-safe fallback.
  setTimeout(installMemoryHubBridge, 0);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMemoryHubBridge, { once: true });
  } else {
    installMemoryHubBridge();
  }
})();
