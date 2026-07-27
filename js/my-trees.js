/**
 * LoveBud - My Trees Page
 * v20260423-2
 *
 * Responsibilities:
 * - Auth guard: redirect to login if not authenticated
 * - Load tree list via window.apiClient.getTrees()
 * - Render tree cards (clickable → editor?treeId=xxx)
 * - Empty state with "새 러브트리 만들기" CTA
 * - "새 러브트리 만들기" → createTree() → redirect to editor
 */

(function() {
  var myTreesUI = window.LoveBudMyTreesUI || null;
  var myTreesActions = window.LoveBudMyTreesActions || null;
  var myTreesData = window.LoveBudMyTreesData || null;
  var myTreesState = window.LoveBudMyTreesState || null;
  var myTreesPage = window.LoveBudMyTreesPage || null;
  var myTreesRender = window.LoveBudMyTreesRender || null;

  function showToast(message, type) {
    if (myTreesPage && typeof myTreesPage.showToast === 'function') {
      return myTreesPage.showToast(message, type);
    }

    if (window.LoveBudUI?.showToast) {
      window.LoveBudUI.showToast(message, type, 3000);
    } else {
      console.warn('[my-trees] LoveBudUI not loaded, toast degraded to console');
      console.log('[Toast ' + type + '] ' + message);
    }
  }

  function warnMissingModule(moduleName, actionName) {
    console.warn('[my-trees] Missing module/action:', moduleName, actionName);
  }

  function showMissingActionError(actionLabel) {
    var i18n = window.t || function(k) { return k; };
    var msg = i18n('myTrees.error_action_unavailable') || '일시적으로 기능을 사용할 수 없습니다.';
    showToast(msg, 'error');
  }

  function getConfirmedSessionUser() {
    try {
      if (window.LoveBudProtectedRoute) {
        var state = window.LoveBudProtectedRoute.getAuthState();
        if (state.ready && state.user) return state.user;
      }
      if (window.getConfirmedAuthUser) {
        return window.getConfirmedAuthUser();
      }
      if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
        var raw = localStorage.getItem('lovebud_auth_cache');
        if (raw && raw !== 'null') {
          return JSON.parse(raw);
        }
      }
    } catch (e) {}
    return null;
  }

  function clearConfirmedSessionUser() {
    try {
      localStorage.removeItem('lovebud_auth_cache');
      localStorage.removeItem('lovebud_auth_confirmed');
      localStorage.removeItem('lovebud_auth_token');
    } catch (e) {}
  }

  function setupHeaderCreateButton() {
    if (myTreesPage && typeof myTreesPage.setupHeaderCreateButton === 'function') {
      return myTreesPage.setupHeaderCreateButton({ onCreate: createNewTree });
    }

    var btn = document.getElementById('headerCreateTreeBtn');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        createNewTree();
      });
    }
  }

  function setupRetryButton() {
    if (myTreesPage && typeof myTreesPage.setupRetryButton === 'function') {
      return myTreesPage.setupRetryButton({ onRetry: loadTrees });
    }

    var retryBtn = document.getElementById('retryLoadBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        loadTrees();
      });
    }
  }

  function getLoginRedirectUrl() {
    var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    return basePath + 'login?redirect=' + basePath + 'my-trees';
  }

  function redirectToLogin() {
    window.location.replace(getLoginRedirectUrl());
  }

  function startMyTrees(user) {
    if (!user || !user.uid) {
      redirectToLogin();
      return;
    }

    document.body.classList.remove('my-trees-auth-pending');

    // Auth confirmed: init loading manager first, then controls, then load
    if (myTreesPage && typeof myTreesPage.initLoadingManager === 'function') {
      myTreesPage.initLoadingManager();
    }

    setupHeaderCreateButton();
    setupRetryButton();
    loadTrees();
  }

  async function renameTree(treeId, currentTitle) {
    if (myTreesActions && typeof myTreesActions.renameTree === 'function') {
      return myTreesActions.renameTree(treeId, currentTitle, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }

    warnMissingModule('LoveBudMyTreesActions', 'renameTree');
    showMissingActionError('renameTree');
  }

  async function deleteTree(treeId, treeTitle) {
    if (myTreesActions && typeof myTreesActions.deleteTree === 'function') {
      return myTreesActions.deleteTree(treeId, treeTitle, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }

    warnMissingModule('LoveBudMyTreesActions', 'deleteTree');
    showMissingActionError('deleteTree');
  }

  async function toggleTreeVisibility(treeId, currentVisibility) {
    if (myTreesActions && typeof myTreesActions.toggleTreeVisibility === 'function') {
      return myTreesActions.toggleTreeVisibility(treeId, currentVisibility, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }

    warnMissingModule('LoveBudMyTreesActions', 'toggleTreeVisibility');
    showMissingActionError('toggleTreeVisibility');
  }

  function setupGlobalListeners() {
  }

  function autoSelectFirstTree(trees) {
    if (!Array.isArray(trees) || trees.length === 0) return;
    var previewHub = window.LoveBudMyTreesPreviewHub;
    if (!previewHub || typeof previewHub.onCardClick !== 'function') return;
    if (typeof previewHub.getSelectedTree === 'function' && previewHub.getSelectedTree()) return;

    setTimeout(function() {
      if (typeof previewHub.getSelectedTree === 'function' && previewHub.getSelectedTree()) return;
      previewHub.onCardClick(trees[0], { skipScroll: true });
    }, 0);
  }

  function renderTrees(trees, isFiltered) {
    if (!isFiltered) {
      lastTreesData = Array.isArray(trees) ? trees : [];
      renderCurrentTrees();
      return;
    }

    var container = document.getElementById('state-loaded');
    if (container && lastTreesData.length > 0 && trees.length === 0) {
      if (myTreesPage && typeof myTreesPage.setState === 'function') {
        myTreesPage.setState(myTreesPage.STATE.LOADED);
      }
      container.replaceChildren();

      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'my-trees-search-empty';

      var iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined search-empty-icon';
      iconSpan.textContent = 'search_off';

      var textP = document.createElement('p');
      textP.className = 'search-empty-text';
      textP.textContent = '조건에 맞는 러브트리가 없어요.';

      var subtextP = document.createElement('p');
      subtextP.className = 'search-empty-subtext';
      subtextP.textContent = '검색어를 지우거나 필터를 전체로 바꿔보세요.';

      emptyDiv.appendChild(iconSpan);
      emptyDiv.appendChild(textP);
      emptyDiv.appendChild(subtextP);

      container.appendChild(emptyDiv);

      if (window.LoveBudMyTreesPreviewHub && typeof window.LoveBudMyTreesPreviewHub.showPlaceholder === 'function') {
        window.LoveBudMyTreesPreviewHub.showPlaceholder();
      }
      return;
    }

    if (myTreesRender && typeof myTreesRender.renderTrees === 'function') {
      myTreesRender.renderTrees(trees, {
        uiModule: myTreesUI,
        stateModule: myTreesState,
        setState: myTreesPage.setState,
        stateEnum: myTreesPage.STATE,
        i18n: window.t || function(k) { return k; },
        onRename: renameTree,
        onDelete: deleteTree,
        onToggleVisibility: toggleTreeVisibility,
        onSelect: function(tree) {
          if (window.LoveBudMyTreesPreviewHub && typeof window.LoveBudMyTreesPreviewHub.onCardClick === 'function') {
            window.LoveBudMyTreesPreviewHub.onCardClick(tree);
          }
        },
        setLastTreesData: function(data) {
          // Do not overwrite our raw lastTreesData closure variable here when rendering filtered list
        }
      });
      autoSelectFirstTree(trees);
      return;
    }

    // Fallback: minimal rendering if render module unavailable
    var containerFallback = document.getElementById('state-loaded');
    if (!containerFallback) return;

    if (!trees || trees.length === 0) {
      if (myTreesPage && typeof myTreesPage.setState === 'function') {
        myTreesPage.setState(myTreesPage.STATE.EMPTY);
      }
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'trees-grid';

    trees.forEach(function(tree) {
      var card = document.createElement('div');
      card.className = 'tree-card';
      card.textContent = 'Tree: ' + (tree.title || 'Untitled');
      grid.appendChild(card);
    });

    containerFallback.innerHTML = '';
    containerFallback.appendChild(grid);
    if (myTreesPage && typeof myTreesPage.setState === 'function') {
      myTreesPage.setState(myTreesPage.STATE.LOADED);
    }
    autoSelectFirstTree(trees);
  }

  function sortTrees(trees, sortBy) {
    if (myTreesState && typeof myTreesState.sortTrees === 'function') {
      return myTreesState.sortTrees(trees, sortBy);
    }
    return Array.isArray(trees) ? trees.slice() : [];
  }

  function isTestPublicMode() {
    if (myTreesActions && typeof myTreesActions.isTestPublicMode === 'function') {
      return myTreesActions.isTestPublicMode();
    }
    return false;
  }

  function getDefaultVisibility() {
    if (myTreesActions && typeof myTreesActions.getDefaultVisibility === 'function') {
      return myTreesActions.getDefaultVisibility({ isTestPublicMode: isTestPublicMode });
    }
    return 'public';
  }

  var TREES_CACHE_KEY = myTreesData?.TREES_CACHE_KEY || 'my_trees_list';

  var createFlowGuard = false;
  var createFlowMaxWaitMs = 3000;
  var createFlowRetryIntervalMs = 100;

  function setHeaderCtaState(isOpening, i18n) {
    var headerBtn = document.getElementById('headerCreateTreeBtn');
    if (!headerBtn) return;
    var t = i18n || window.t || function(k) { return k; };
    headerBtn.disabled = isOpening;
    headerBtn.replaceChildren();

    var icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = isOpening ? 'hourglass_empty' : 'add';
    headerBtn.appendChild(icon);

    headerBtn.appendChild(document.createTextNode(' ' + safeText(t, isOpening ? 'myTrees.create_opening' : 'myTrees.header_create', isOpening ? '러브트리 만들기를 준비하고 있어요…' : '새 러브트리')));
  }

  function setEmptyCtaState(isOpening, i18n) {
    var emptyBtn = document.getElementById('createTreeBtn');
    if (!emptyBtn) return;
    var t = i18n || window.t || function(k) { return k; };
    emptyBtn.disabled = isOpening;
    emptyBtn.replaceChildren();

    var icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '20px';
    icon.textContent = isOpening ? 'hourglass_empty' : 'add_circle';
    emptyBtn.appendChild(icon);

    emptyBtn.appendChild(document.createTextNode(' ' + safeText(t, isOpening ? 'myTrees.create_opening' : 'create_tree_btn', isOpening ? '러브트리 만들기를 준비하고 있어요…' : '새 러브트리 만들기')));
  }

  function safeText(i18n, key, fallback) {
    var translated = typeof i18n === 'function' ? i18n(key) : '';
    return translated && translated !== key ? translated : fallback;
  }

  async function waitForMyTreesActions(startTime) {
    while (!window.LoveBudMyTreesActions || typeof window.LoveBudMyTreesActions.createNewTree !== 'function') {
      if (Date.now() - startTime > createFlowMaxWaitMs) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, createFlowRetryIntervalMs));
    }
    return true;
  }

  async function createNewTree() {
    if (createFlowGuard) {
      return;
    }
    createFlowGuard = true;

    var i18n = window.t || function(k) { return k; };
    var startTime = Date.now();

    setHeaderCtaState(true, i18n);
    setEmptyCtaState(true, i18n);

    var redirecting = false;

    try {
      var ready = await waitForMyTreesActions(startTime);
      if (!ready) {
        showMissingActionError('createNewTree');
        return;
      }

      var result = await window.LoveBudMyTreesActions.createNewTree({
        getDefaultVisibility: getDefaultVisibility,
        showToast: showToast,
        cacheKey: TREES_CACHE_KEY,
        i18n: i18n
      });

      if (result && result.outcome === 'redirecting') {
        redirecting = true;
        return result;
      }
    } finally {
      if (!redirecting) {
        createFlowGuard = false;
        setHeaderCtaState(false, i18n);
        setEmptyCtaState(false, i18n);
      }
    }
  }

  async function loadTrees(options) {
    options = options || {};
    if (myTreesData && typeof myTreesData.loadTrees === 'function') {
      return myTreesData.loadTrees({
        setState: myTreesPage.setState,
        stateEnum: myTreesPage.STATE,
        renderTrees: renderTrees,
        showToast: showToast,
        i18n: window.t || function(k) { return k; },
        preserveVisibleList: options.preserveVisibleList === true,
        reason: options.reason || null,
        supersedeStaleLoad: options.supersedeStaleLoad === true
      });
    }

    warnMissingModule('LoveBudMyTreesData', 'loadTrees');
    showMissingActionError('loadTrees');
    myTreesPage.setState?.(myTreesPage.STATE.ERROR);
  }

  var myTreesStarted = false;
  var myTreesBootedFromCache = false;
  var lastTreesData = [];
  var currentSearchQuery = '';
  var currentFilter = 'all';
  var historyRestoreListenerBound = false;

  function isStateSectionVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('state-hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    if (el.classList && (el.classList.contains('state-visible') || el.classList.contains('state-visible-block'))) {
      return true;
    }
    try {
      if (typeof window.getComputedStyle === 'function') {
        var st = window.getComputedStyle(el);
        if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
      }
    } catch (e) {}
    // If neither explicitly shown nor hidden, treat non-empty display as visible.
    return !(el.style && el.style.display === 'none');
  }

  function isLoadingVisible() {
    return isStateSectionVisible(document.getElementById('state-loading'));
  }

  function hasAuthoritativeTerminalState() {
    if (isLoadingVisible()) return false;
    if (isStateSectionVisible(document.getElementById('state-error'))) return true;
    if (isStateSectionVisible(document.getElementById('state-empty'))) return true;
    if (isStateSectionVisible(document.getElementById('state-loaded'))) return true;
    return false;
  }

  /**
   * Detect BFCache/history restoration in a browser-portable way.
   * Isolated for contract tests.
   */
  function isHistoryRestoreEvent(event) {
    if (event && event.persisted === true) return true;
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        var navs = performance.getEntriesByType('navigation');
        if (navs && navs[0] && navs[0].type === 'back_forward') return true;
      }
    } catch (e) {}
    try {
      // Legacy PerformanceNavigation.TYPE_BACK_FORWARD === 2
      if (performance.navigation && Number(performance.navigation.type) === 2) return true;
    } catch (e2) {}
    return false;
  }

  function emitRestoreDiagnostic(phase) {
    if (myTreesData && typeof myTreesData.emitLifecycleDiagnostic === 'function') {
      myTreesData.emitLifecycleDiagnostic({
        phase: phase,
        attempt: 1,
        retried: false,
        authHeaderPresent: false,
        cachePresent: false,
        cacheUsed: false,
        statusClass: 'none',
        resultCountBucket: 'unknown'
      });
    }
  }

  /**
   * History/BFCache restore recovery:
   * - only on restore classification
   * - only when authenticated and already booted
   * - supersedes pre-restore in-flight owner-list loads (they may abort)
   * - exactly one recovery generation (repeated pageshow coalesces)
   * - never re-binds listeners / reboots page
   */
  function maybeRecoverOwnerListFromHistory(event) {
    if (!myTreesStarted) return;

    if (!isHistoryRestoreEvent(event)) {
      // Normal pageshow after initial navigation: do not reload.
      emitRestoreDiagnostic('restore_skipped_not_restore');
      return;
    }

    var user = getConfirmedSessionUser();
    if (!user || !user.uid) return;

    // Terminal authoritative UI: do not force recovery.
    // (In-flight pre-restore loads are NOT treated as valid recovery here —
    //  nonterminal/loading restore supersedes them via supersedeStaleLoad.)
    if (hasAuthoritativeTerminalState() && !isLoadingVisible()) {
      emitRestoreDiagnostic('restore_skipped_terminal');
      return;
    }

    emitRestoreDiagnostic('restore_triggered');

    var loadPromise = loadTrees({
      preserveVisibleList: true,
      reason: 'history_recovery',
      supersedeStaleLoad: true
    });

    if (loadPromise && typeof loadPromise.then === 'function') {
      loadPromise.then(function() {
        if (hasAuthoritativeTerminalState()) {
          emitRestoreDiagnostic('restore_recovered');
        } else {
          emitRestoreDiagnostic('restore_failed');
        }
      }, function() {
        emitRestoreDiagnostic('restore_failed');
      });
    }
  }

  function bindHistoryRestoreListener() {
    if (historyRestoreListenerBound) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    historyRestoreListenerBound = true;
    window.addEventListener('pageshow', function(event) {
      maybeRecoverOwnerListFromHistory(event);
    });
    // Mark in-flight owner-list generations stale on pagehide without network I/O.
    window.addEventListener('pagehide', function() {
      if (myTreesData && typeof myTreesData.markOwnerListEpochStale === 'function') {
        myTreesData.markOwnerListEpochStale();
      }
      // Dispose loading manager to clear all pending timers
      if (myTreesPage && typeof myTreesPage.getLoadingManager === 'function') {
        var mgr = myTreesPage.getLoadingManager();
        if (mgr && typeof mgr.dispose === 'function') {
          mgr.dispose();
        }
      }
    });
  }

  // Bind early so BFCache restore after freeze still has a handler without re-initing boot.
  bindHistoryRestoreListener();

  function getCurrentSortValue() {
    var sortSelect = document.getElementById('sortTreesSelect');
    return sortSelect ? sortSelect.value : 'recent';
  }

  function getVisibleTrees() {
    var source = Array.isArray(lastTreesData) ? lastTreesData : [];
    var filtered = window.LoveBudMyTreesFilter.applyFilters(source, {
      query: currentSearchQuery,
      filter: currentFilter
    });
    if (filtered.length === 0) return [];
    return sortTrees(filtered, getCurrentSortValue());
  }

  function renderCurrentTrees() {
    renderTrees(getVisibleTrees(), true);
  }

  function bootMyTrees(user, options) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    myTreesBootedFromCache = !!(options && options.fromCache);
    startMyTrees(user);
    if (!user || !user.uid) return;

    setupGlobalListeners();

    // Initialize the timed loading manager
    if (myTreesPage && typeof myTreesPage.initLoadingManager === 'function') {
      myTreesPage.initLoadingManager();
    }

    // Initialize My Trees appreciation hub
    if (window.LoveBudMyTreesPreviewHub && typeof window.LoveBudMyTreesPreviewHub.init === 'function') {
      window.LoveBudMyTreesPreviewHub.init({
        stateModule: myTreesState,
        onOpenTree: function(tree) {
          if (tree && tree.id) {
            var basePath = (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath)
              ? window.LoveBudPath.getBasePath() : 'pages/';
            window.location.href = basePath + 'editor?treeId=' + encodeURIComponent(tree.id);
          }
        }
      });
    }

    // Apply hub layout: place hub in right sidebar instead of page bottom
    var hubLayoutShell = document.querySelector('.my-trees-dashboard-grid-shell');
    if (hubLayoutShell) {
      hubLayoutShell.classList.add('my-trees-with-hub');
    }

    var sortSelect = document.getElementById('sortTreesSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        renderCurrentTrees();
      });
    }

    if (window.LoveBudMyTreesFilter && typeof window.LoveBudMyTreesFilter.bindFinderControls === 'function') {
      window.LoveBudMyTreesFilter.bindFinderControls({
        onInput: function(val) {
          currentSearchQuery = val;
          renderCurrentTrees();
        },
        onFilterChange: function(filterVal) {
          currentFilter = filterVal;
          renderCurrentTrees();
        }
      });
    }
  }

  function reconcileBootstrapUser(user) {
    if (user && user.uid) {
      if (!myTreesStarted) {
        bootMyTrees(user, { fromCache: false });
      }
      return;
    }

    if (myTreesBootedFromCache) {
      clearConfirmedSessionUser();
      redirectToLogin();
      return;
    }

    if (!myTreesStarted) {
      bootMyTrees(null, { fromCache: false });
    }
  }

  document.addEventListener('DOMContentLoaded', async function() {
    var cachedUser = getConfirmedSessionUser();

    if (window.LoveBudAuthBootstrap && typeof window.LoveBudAuthBootstrap.whenReady === 'function') {
      try {
        var user = await window.LoveBudAuthBootstrap.whenReady();
        reconcileBootstrapUser(user);
      } catch (e) {
        reconcileBootstrapUser(null);
      }
      return;
    }

    if (typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(function(user) {
        reconcileBootstrapUser(user || null);
      });
      return;
    }

    reconcileBootstrapUser(cachedUser);
  }, { once: true });

  // Test/export surface for focused history-recovery contracts (no secrets).
  window.LoveBudMyTreesHistoryRecovery = {
    isHistoryRestoreEvent: isHistoryRestoreEvent,
    hasAuthoritativeTerminalState: hasAuthoritativeTerminalState,
    isLoadingVisible: isLoadingVisible,
    maybeRecoverOwnerListFromHistory: maybeRecoverOwnerListFromHistory,
    isStarted: function() { return myTreesStarted; }
  };

})();
