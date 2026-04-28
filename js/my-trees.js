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
    document.querySelectorAll('.tree-card-dropdown').forEach(function(dd) {
      dd.classList.remove('show');
    });
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

  function buildTreeCard(tree, uiOptions) {
    var i18n = window.t || function(k) { return k; };
    var normalizeTree = window.LoveBudNormalize?.normalizeTree;
    var normalizedTree = typeof normalizeTree === 'function' ? normalizeTree(tree) : tree;
    
    // Ensure we have normalized data
    if (!normalizedTree.id) normalizedTree.id = tree.id;
    if (!normalizedTree.title) normalizedTree.title = tree.title || i18n('default_tree_title') || '나의 러브트리';
    if (!normalizedTree.visibility) normalizedTree.visibility = tree.visibility || 'public';
    
    var momentCount = (myTreesUI && typeof myTreesUI.getTreeMomentCount === 'function') 
      ? myTreesUI.getTreeMomentCount(normalizedTree) 
      : 0;
    
    var visClass = normalizedTree.visibility === 'public' ? 'public' : 'private';
    var visLabel = normalizedTree.visibility === 'public'
      ? (i18n('myTrees.summary_public') || '공개')
      : (i18n('myTrees.summary_private') || '비공개');
    
    var date = normalizedTree.updatedAt || normalizedTree.createdAt || '';
    if (date) {
      date = date.slice(0, 10).replace(/-/g, '.');
    }

    var menuBtnId = 'menuBtn_' + normalizedTree.id;
    var dropdownId = 'dropdown_' + normalizedTree.id;

    var card = document.createElement('div');
    card.className = 'tree-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', normalizedTree.title);

    // Main navigation on card click
    card.addEventListener('click', function() {
      window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
    });

    // Accessibility: Enter/Space to navigate
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
      }
    });

    var thumbHtml = (myTreesUI && typeof myTreesUI.buildTreeThumbVisual === 'function')
      ? myTreesUI.buildTreeThumbVisual(normalizedTree, i18n)
      : '<div class="tree-card-thumb"></div>';

    card.innerHTML = [
      thumbHtml,
      '<button class="tree-card-menu" id="' + menuBtnId + '" type="button" aria-label="' + (i18n('myTrees.card_menu') || '트리 관리 열기') + '">',
        '<span class="material-symbols-outlined" style="font-size:20px;color:var(--on-surface);">more_vert</span>',
      '</button>',
      '<div class="tree-card-dropdown" id="' + dropdownId + '">',
        '<div class="dropdown-item visibility" data-action="visibility">',
          '<span class="material-symbols-outlined" style="font-size:16px;">' + (normalizedTree.visibility === 'public' ? 'lock' : 'public') + '</span>',
          (normalizedTree.visibility === 'public' ? (i18n('visibility_make_private') || '비공개로 전환') : (i18n('visibility_make_public') || '공개로 전환')),
        '</div>',
        '<div class="dropdown-item rename" data-action="rename">',
          '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>',
          i18n('rename') || '이름 변경',
        '</div>',
        '<div class="dropdown-item delete" data-action="delete">',
          '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>',
          i18n('delete') || '삭제',
        '</div>',
      '</div>',
      '<div class="tree-card-info">',
        '<div class="tree-card-title-row">',
          '<div class="tree-card-title">' + (myTreesUI?.escapeHtml ? myTreesUI.escapeHtml(normalizedTree.title) : normalizedTree.title) + '</div>',
          '<span class="tree-card-count-pill" data-count="' + momentCount + '">' + (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) + '</span>',
        '</div>',
        '<div class="tree-card-meta">',
          '<span class="tree-card-visibility ' + visClass + '">',
            '<span class="material-symbols-outlined" style="font-size:12px;">' + (visClass === 'public' ? 'public' : 'lock') + '</span>',
            visLabel,
          '</span>',
          date ? '<span class="tree-card-date">' + date + '</span>' : '',
        '</div>',
      '</div>'
    ].join('');

    // Set up menu events
    var menuBtn = card.querySelector('.tree-card-menu');
    var dropdown = card.querySelector('.tree-card-dropdown');
    if (!menuBtn || !dropdown) return;

    menuBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var wasShown = dropdown.classList.contains('show');
      closeAllDropdowns();
      if (!wasShown) dropdown.classList.add('show');
    });

    dropdown.querySelectorAll('.dropdown-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var action = this.getAttribute('data-action');
        if (action === 'visibility') {
          toggleTreeVisibility(normalizedTree.id, normalizedTree.visibility);
        } else if (action === 'rename') {
          renameTree(normalizedTree.id, normalizedTree.title);
        } else if (action === 'delete') {
          deleteTree(normalizedTree.id, normalizedTree.title);
        }
        closeAllDropdowns();
      });
    });

    return card;
  }

  function renderTrees(trees) {
    var container = document.getElementById('state-loaded');
    if (!container) return;

    if (!trees || trees.length === 0) {
      setState(STATE.EMPTY);
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'trees-grid';

    trees.forEach(function(tree) {
      var card = buildTreeCard(tree);
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
