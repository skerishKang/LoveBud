/**
 * LoveBud - My Trees Page
 * v20260423-2
 *
 * Responsibilities:
 * - Auth guard: redirect to login if not authenticated
 * - Load tree list via window.apiClient.getTrees()
 * - Render tree cards (clickable → editor.html?treeId=xxx)
 * - Empty state with "새 러브트리 만들기" CTA
 * - "새 러브트리 만들기" → createTree() → redirect to editor
 */

(function() {
  var myTreesUI = window.LoveBudMyTreesUI || null;
  var myTreesActions = window.LoveBudMyTreesActions || null;
  var myTreesData = window.LoveBudMyTreesData || null;
  var myTreesState = window.LoveBudMyTreesState || null;
  var myTreesPage = window.LoveBudMyTreesPage || null;

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

  var STATE = myTreesPage?.STATE || {
    LOADING: 'loading',
    LOADED: 'loaded',
    EMPTY: 'empty',
    ERROR: 'error'
  };

  var currentState = STATE.LOADING;

  function setState(newState, meta) {
    currentState = newState;

    if (myTreesPage && typeof myTreesPage.setState === 'function') {
      return myTreesPage.setState(newState, meta);
    }

    var container = document.getElementById('treesContainer');
    if (!container) return;

    var sections = {
      loading: document.getElementById('state-loading'),
      error: document.getElementById('state-error'),
      empty: document.getElementById('state-empty'),
      loaded: document.getElementById('state-loaded')
    };

    Object.values(sections).forEach(function(el) {
      if (el) el.style.display = 'none';
    });

    switch (newState) {
      case STATE.LOADING:
        if (sections.loading) sections.loading.style.display = 'flex';
        break;
      case STATE.ERROR:
        if (sections.error) sections.error.style.display = 'flex';
        break;
      case STATE.EMPTY:
        if (sections.empty) sections.empty.style.display = 'flex';
        break;
      case STATE.LOADED:
        if (sections.loaded) sections.loaded.style.display = 'block';
        break;
    }
  }

  function getSelectedTreeId() {
    if (myTreesState && typeof myTreesState.getSelectedTreeId === 'function') {
      return myTreesState.getSelectedTreeId();
    }
    return null;
  }

  function setSelectedTreeId(treeId) {
    if (myTreesState && typeof myTreesState.setSelectedTreeId === 'function') {
      myTreesState.setSelectedTreeId(treeId);
    }
  }

  function getRenderableTrees() {
    if (myTreesState && typeof myTreesState.getLastTreesData === 'function') {
      return myTreesState.getLastTreesData();
    }
    return lastTreesData;
  }

  function applyTreeSelection(treeId) {
    setSelectedTreeId(treeId);
    var currentTrees = getRenderableTrees();
    if (Array.isArray(currentTrees) && currentTrees.length) {
      renderTrees(currentTrees);
    }
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
    return basePath + 'login.html?redirect=' + basePath + 'my-trees.html';
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

     // Fail-safe: missing renameTree action
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

     // Fail-safe: missing deleteTree action
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

     // Fail-safe: missing toggleTreeVisibility action
     warnMissingModule('LoveBudMyTreesActions', 'toggleTreeVisibility');
     showMissingActionError('toggleTreeVisibility');
   }

  function closeAllDropdowns() {
    if (myTreesUI && typeof myTreesUI.closeAllDropdowns === 'function') {
      myTreesUI.closeAllDropdowns();
    } else {
      document.querySelectorAll('.tree-card-dropdown').forEach(function(dd) {
        dd.classList.remove('show');
      });
    }
  }

  function setupGlobalListeners() {
    // Esc key to close dropdowns
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    // Outside click to close dropdowns
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.tree-card-menu') && !e.target.closest('.tree-card-dropdown')) {
        closeAllDropdowns();
      }
    });
  }

  function renderTrees(trees) {
    if (myTreesUI && typeof myTreesUI.renderTrees === 'function') {
      // UI module에 위임
      myTreesUI.renderTrees(trees, {
        setState: setState,
        stateEnum: STATE,
        i18n: window.t || function(k) { return k; },
        onRename: renameTree,
        onDelete: deleteTree,
        onToggleVisibility: toggleTreeVisibility,
        setLastTreesData: function(data) {
          lastTreesData = data;
        }
      });
      return;
    }

    // Fallback: UI module이 없는 경우
    var container = document.getElementById('state-loaded');
    if (!container) return;

    if (!trees || trees.length === 0) {
      setState(STATE.EMPTY);
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

    container.innerHTML = '';
    container.appendChild(grid);
    setState(STATE.LOADED);
  }

  function sortTrees(trees, sortBy) {
    if (myTreesState && typeof myTreesState.sortTrees === 'function') {
      return myTreesState.sortTrees(trees, sortBy);
    }
    return Array.isArray(trees) ? trees.slice() : [];
  }

  function updateManageSummary(trees) {
    // Sidebar removed, no summary bar to update
    // But we still store the data
    lastTreesData = trees;
    return trees;
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

   async function createNewTree() {
     if (myTreesActions && typeof myTreesActions.createNewTree === 'function') {
       return myTreesActions.createNewTree({
         getDefaultVisibility: getDefaultVisibility,
         showToast: showToast,
         cacheKey: TREES_CACHE_KEY,
         i18n: window.t || function(k) { return k; }
       });
     }

     // Fail-safe: missing createNewTree action
     warnMissingModule('LoveBudMyTreesActions', 'createNewTree');
     showMissingActionError('createNewTree');
   }

  var TREES_CACHE_KEY = myTreesData?.TREES_CACHE_KEY || 'my_trees_list';

   async function loadTrees() {
     if (myTreesData && typeof myTreesData.loadTrees === 'function') {
       return myTreesData.loadTrees({
         setState: setState,
         stateEnum: STATE,
         renderTrees: renderTrees,
         showToast: showToast,
         i18n: window.t || function(k) { return k; }
       });
     }

     // Fail-safe: missing loadTrees module
     warnMissingModule('LoveBudMyTreesData', 'loadTrees');
     showMissingActionError('loadTrees');
     setState(STATE.ERROR);
   }

  var myTreesStarted = false;
  var myTreesBootedFromCache = false;
  var lastTreesData = [];

  function bootMyTrees(user, options) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    myTreesBootedFromCache = !!(options && options.fromCache);
    startMyTrees(user);
    if (!user || !user.uid) return;

    setupGlobalListeners();

    var sortSelect = document.getElementById('sortTreesSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        var sorted = sortTrees(lastTreesData, this.value);
        renderTrees(sorted);
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

    if (cachedUser && cachedUser.uid && !myTreesStarted) {
      bootMyTrees(cachedUser, { fromCache: true });
    }

    if (window.LoveBudAuthBootstrap && typeof window.LoveBudAuthBootstrap.whenReady === 'function') {
      try {
        var user = await window.LoveBudAuthBootstrap.whenReady();
        reconcileBootstrapUser(user);
      } catch (e) {
        reconcileBootstrapUser(null);
      }
      return;
    }

    if (!myTreesStarted && typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(function(user) {
        reconcileBootstrapUser(user || null);
      });
      return;
    }

    if (!myTreesStarted) {
      bootMyTrees(cachedUser || null, { fromCache: !!(cachedUser && cachedUser.uid) });
    }
  }, { once: true });

})();
