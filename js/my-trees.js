/**
 * LoveBud - My Trees Page
 * v20260422-1
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

   var STATE = myTreesPage?.STATE || {
     LOADING: 'loading',
     LOADED: 'loaded',
     EMPTY: 'empty',
     ERROR: 'error'
   };

   var currentState = STATE.LOADING;

   function setState(newState) {
     currentState = newState;

     if (myTreesPage && typeof myTreesPage.setState === 'function') {
       return myTreesPage.setState(newState);
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
     window.location.href = getLoginRedirectUrl();
   }

   function startMyTrees(user) {
     if (!user || !user.uid) {
       redirectToLogin();
       return;
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
  }

  async function deleteTree(treeId, treeTitle) {
    if (myTreesActions && typeof myTreesActions.deleteTree === 'function') {
      return myTreesActions.deleteTree(treeId, treeTitle, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }
  }

  async function toggleTreeVisibility(treeId, currentVisibility) {
    if (myTreesActions && typeof myTreesActions.toggleTreeVisibility === 'function') {
      return myTreesActions.toggleTreeVisibility(treeId, currentVisibility, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }
  }

  function closeAllDropdowns() {
    if (myTreesUI && typeof myTreesUI.closeAllDropdowns === 'function') {
      return myTreesUI.closeAllDropdowns();
    }
    document.querySelectorAll('.tree-card-dropdown').forEach(function(dd) {
      dd.classList.remove('show');
    });
  }

   function renderTrees(trees) {
     if (myTreesUI && typeof myTreesUI.renderTrees === 'function') {
       return myTreesUI.renderTrees(trees, {
         setState: setState,
         stateEnum: STATE,
         setLastTreesData: function(value) { lastTreesData = value; },
         updateManageSummary: function(nextTrees, uiOptions) { return updateManageSummary(nextTrees, uiOptions); },
         buildTreeCard: function(tree, uiOptions) { return buildTreeCard(tree, uiOptions); },
         normalizeTree: function(tree) { return window.LoveBudNormalize?.normalizeTree(tree); },
         onRename: renameTree,
         onDelete: deleteTree,
         onToggleVisibility: toggleTreeVisibility,
         onNavigate: function(normalizedTree) {
           window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
         },
         onSelect: applyTreeSelection,
         getSelectedTreeId: getSelectedTreeId,
         isSelected: function(treeId) { return getSelectedTreeId() === treeId; },
         closeAllDropdowns: closeAllDropdowns,
         i18n: window.t || function(k) { return k; }
       });
     }
   }

  function sortTrees(trees, sortBy) {
    if (myTreesState && typeof myTreesState.sortTrees === 'function') {
      return myTreesState.sortTrees(trees, sortBy);
    }
    return Array.isArray(trees) ? trees.slice() : [];
  }

  function updateManageSummary(trees, uiOptions) {
    if (myTreesUI && typeof myTreesUI.updateManageSummary === 'function') {
      return myTreesUI.updateManageSummary(trees, uiOptions || {
        setLastTreesData: function(value) { lastTreesData = value; },
        getSelectedTreeId: getSelectedTreeId,
        onNavigate: function(normalizedTree) {
          window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
        },
        onRename: renameTree,
        onDelete: deleteTree,
        onToggleVisibility: toggleTreeVisibility,
        i18n: window.t || function(k) { return k; }
      });
    }
  }

  function buildTreeCard(tree, uiOptions) {
    if (myTreesUI && typeof myTreesUI.buildTreeCard === 'function') {
      return myTreesUI.buildTreeCard(tree, uiOptions || {
        i18n: window.t || function(k) { return k; },
        normalizeTree: function(nextTree) { return window.LoveBudNormalize?.normalizeTree(nextTree); },
        onRename: renameTree,
        onDelete: deleteTree,
        onToggleVisibility: toggleTreeVisibility,
        onNavigate: function(normalizedTree) {
          window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
        },
        onSelect: applyTreeSelection,
        getSelectedTreeId: getSelectedTreeId,
        isSelected: function(treeId) { return getSelectedTreeId() === treeId; },
        closeAllDropdowns: closeAllDropdowns
      });
    }
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
   }

  var myTreesStarted = false;
  var lastTreesData = [];

  function bootMyTrees(user) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    startMyTrees(user);

    var sortSelect = document.getElementById('sortTreesSelect');
    if (myTreesState && typeof myTreesState.bindSortSelect === 'function') {
      myTreesState.bindSortSelect({
        select: sortSelect,
        renderTrees: renderTrees,
        getLastTreesData: function() {
          if (myTreesState && typeof myTreesState.getLastTreesData === 'function') {
            return myTreesState.getLastTreesData();
          }
          return lastTreesData;
        }
      });
    } else if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        var sorted = sortTrees(lastTreesData, this.value);
        renderTrees(sorted);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async function() {
    var cachedUser = getConfirmedSessionUser();
    var bootedFromCache = false;

    if (cachedUser && !myTreesStarted) {
      bootMyTrees(cachedUser);
      bootedFromCache = true;
    }

    if (window.LoveBudAuthBootstrap && typeof window.LoveBudAuthBootstrap.whenReady === 'function') {
      var user = await window.LoveBudAuthBootstrap.whenReady();

      if (!user || !user.uid) {
        if (bootedFromCache || myTreesStarted) {
          redirectToLogin();
          return;
        }
        bootMyTrees(null);
        return;
      }

      if (!myTreesStarted) {
        bootMyTrees(user);
      }
      return;
    }

    if (!myTreesStarted && typeof window.registerOnAuthReady === 'function') {
      window.registerOnAuthReady(function(user) {
        if (!user || !user.uid) {
          redirectToLogin();
          return;
        }
        if (!myTreesStarted) {
          bootMyTrees(user);
        }
      });
      return;
    }

    if (!myTreesStarted) {
      bootMyTrees(cachedUser || null);
    }
  }, { once: true });

})();
