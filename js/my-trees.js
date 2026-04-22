/**
 * LoveBud - My Trees Page
 * v20260423-1
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

  function resolveText(key, fallback) {
    try {
      if (typeof window.t === 'function') {
        var translated = window.t(key);
        if (translated === '') return '';
        if (translated && translated !== key) return translated;
      }
    } catch (e) {}
    return fallback;
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

  function ensureDensityStyles() {
    if (document.getElementById('myTreesDensityTuning')) return;

    var style = document.createElement('style');
    style.id = 'myTreesDensityTuning';
    style.textContent = [
      '.my-trees-content{max-width:1160px;padding:48px 40px 64px;}',
      '.my-trees-header{align-items:flex-end;gap:16px;margin-bottom:24px;}',
      '.header-content{max-width:440px;}',
      '.my-trees-header h1{margin-bottom:6px;}',
      '.my-trees-header p{max-width:420px;margin:0;font-size:0.95rem;line-height:1.5;}',
      '.btn-header-create{padding:12px 16px;border-radius:999px;}',
      '.manage-summary-bar{padding:14px 18px;gap:12px;margin-bottom:18px;border-radius:24px;}',
      '.manage-summary-main{gap:14px;}',
      '.manage-summary-main .summary-separator{opacity:0.42;}',
      '.summary-sort-control{margin-left:auto;}',
      '.manage-summary-selected{padding-top:12px;gap:14px;}',
      '.manage-selected-label{font-size:10px;letter-spacing:0.06em;}',
      '.manage-selected-title{font-size:0.98rem;line-height:1.3;}',
      '.manage-selected-meta{font-size:12px;line-height:1.45;}',
      '.manage-selected-meta:empty{display:none;}',
      '.manage-selected-actions{gap:8px;}',
      '.manage-action-btn{padding:10px 14px;font-size:12px;font-weight:700;}',
      '.manage-action-btn.primary{background:var(--primary);color:white;box-shadow:0 8px 18px rgba(144,73,81,0.18);}',
      '.manage-action-btn.secondary{background:rgba(144,73,81,0.08);color:var(--primary);}',
      '.manage-action-btn.danger{background:transparent;border:1px solid rgba(198,40,40,0.18);}',
      '.trees-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;}',
      '.tree-card{border-radius:28px;}',
      '.tree-card-info{padding:18px 18px 20px;gap:8px;}',
      '.tree-card-title{font-size:1.04rem;}',
      '.tree-card-subcopy{font-size:12px;line-height:1.45;}',
      '.tree-card-meta{gap:8px;}',
      '.tree-card-manage-row{gap:8px;margin-top:2px;}',
      '.tree-card-manage-btn{padding:9px 12px;font-size:12px;font-weight:700;}',
      '.tree-card-select-btn{background:transparent;border:1px solid rgba(62,52,47,0.12);color:var(--on-surface-variant);}',
      '.tree-card-select-btn:hover{background:rgba(144,73,81,0.06);color:var(--on-surface);}',
      '.tree-card-open-btn{background:rgba(144,73,81,0.1);color:var(--primary);}',
      '.tree-card-menu{opacity:1;}',
      '@media (max-width:1024px){.my-trees-content{padding:40px 28px 56px;}.trees-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;}}',
      '@media (max-width:768px){.my-trees-content{padding:28px 20px 44px;}.my-trees-header{gap:12px;margin-bottom:18px;}.header-content{max-width:none;}.my-trees-header p{max-width:none;font-size:0.92rem;}.manage-summary-bar{padding:14px 14px 12px;margin-bottom:14px;}.manage-summary-main{gap:10px;align-items:center;}.manage-summary-main .summary-separator,.manage-summary-main .summary-aux-item{display:none !important;}#sortTreesSelect.summary-sort-control{margin-left:auto;max-width:132px;}.manage-selected-copy{min-width:0;}.manage-selected-actions{width:100%;display:grid;grid-template-columns:1fr 1fr;}.manage-action-btn{width:100%;justify-content:center;}.manage-action-btn.danger{grid-column:span 2;}.tree-card-thumb{height:176px;}.tree-card-title-row{gap:10px;}.tree-card-manage-row{display:grid;grid-template-columns:auto 1fr;}.tree-card-open-btn{width:100%;justify-content:center;}}',
      '@media (max-width:420px){.manage-selected-actions{grid-template-columns:1fr;}.manage-action-btn.danger{grid-column:auto;}.tree-card-date{display:none;}}'
    ].join('');

    document.head.appendChild(style);
  }

  function markSummaryElements() {
    var summaryMain = document.querySelector('.manage-summary-main');
    if (!summaryMain) return;

    Array.prototype.forEach.call(summaryMain.children, function(child, index) {
      child.classList.remove('summary-primary-stat', 'summary-aux-item', 'summary-separator', 'summary-sort-control');

      if (child.id === 'sortTreesSelect') {
        child.classList.add('summary-sort-control');
        return;
      }

      if (index === 0) {
        child.classList.add('summary-primary-stat');
        return;
      }

      if (index === 1 || index === 5) {
        child.classList.add('summary-separator');
        return;
      }

      child.classList.add('summary-aux-item');
    });
  }

  function applyCompactCopy() {
    var pageDesc = document.getElementById('myTreesPageDesc');
    var headerCreateLabel = document.getElementById('headerCreateTreeBtnLabel');
    var manageLabel = document.getElementById('manageSelectedTreeLabel');
    var manageTitle = document.getElementById('manageSelectedTreeName');
    var manageMeta = document.getElementById('manageSelectedTreeMeta');
    var manageOpenBtn = document.getElementById('manageOpenBtn');
    var manageRenameBtn = document.getElementById('manageRenameBtn');
    var manageDeleteBtn = document.getElementById('manageDeleteBtn');
    var manageVisibilityBtn = document.getElementById('manageVisibilityBtn');
    var createModalDesc = document.querySelector('[data-i18n="myTrees.create_modal_desc"]');
    var createModalHelp = document.getElementById('createTreeTitleHelp');
    var privateDesc = document.querySelector('[data-i18n="myTrees.create_modal_visibility_private_desc"]');
    var publicDesc = document.querySelector('[data-i18n="myTrees.create_modal_visibility_public_desc"]');

    if (pageDesc) {
      pageDesc.textContent = resolveText('myTrees.page_desc', '다시 열고 이어가는 내 러브트리');
    }
    if (headerCreateLabel) {
      headerCreateLabel.textContent = resolveText('myTrees.header_create', '새 트리');
    }
    if (manageLabel) {
      manageLabel.textContent = resolveText('myTrees.manage_label', '현재 트리');
    }
    if (manageOpenBtn) {
      manageOpenBtn.textContent = resolveText('myTrees.manage_open', '다시 열기');
    }
    if (manageRenameBtn) {
      manageRenameBtn.textContent = resolveText('myTrees.manage_rename', '이름 변경');
    }
    if (manageDeleteBtn) {
      manageDeleteBtn.textContent = resolveText('myTrees.manage_delete', '삭제');
    }
    if (manageVisibilityBtn && manageVisibilityBtn.disabled) {
      manageVisibilityBtn.textContent = resolveText('myTrees.manage_visibility', '공개 설정');
    }
    if (manageTitle && manageOpenBtn && manageOpenBtn.disabled) {
      manageTitle.textContent = resolveText('myTrees.manage_none', '열고 싶은 트리를 골라 보세요');
    }
    if (manageMeta && manageOpenBtn && manageOpenBtn.disabled) {
      manageMeta.textContent = resolveText('myTrees.manage_hint', '');
    }
    if (createModalDesc) {
      createModalDesc.textContent = resolveText('myTrees.create_modal_desc', '이름을 정하고 첫 순간을 남겨요.');
    }
    if (createModalHelp) {
      createModalHelp.textContent = resolveText('myTrees.create_modal_name_help', '제목은 나중에 바꿀 수 있어요.');
    }
    if (privateDesc) {
      privateDesc.textContent = resolveText('myTrees.create_modal_visibility_private_desc', '나만 보고 이어가요.');
    }
    if (publicDesc) {
      publicDesc.textContent = resolveText('myTrees.create_modal_visibility_public_desc', '다른 사람도 감상할 수 있어요.');
    }

    document.querySelectorAll('.tree-card-select-btn').forEach(function(btn) {
      if (btn.closest('.tree-card.is-selected')) {
        btn.textContent = resolveText('myTrees.card_selected', '보고 있는 트리');
      } else {
        btn.textContent = resolveText('myTrees.card_select', '고르기');
      }
    });

    document.querySelectorAll('.tree-card-open-btn').forEach(function(btn) {
      btn.textContent = resolveText('myTrees.card_open', '다시 열기');
    });
  }

  function postProcessMyTreesSurface() {
    ensureDensityStyles();
    markSummaryElements();
    applyCompactCopy();
  }

  function setState(newState) {
    currentState = newState;

    if (myTreesPage && typeof myTreesPage.setState === 'function') {
      var delegated = myTreesPage.setState(newState);
      postProcessMyTreesSurface();
      return delegated;
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

    postProcessMyTreesSurface();
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
    postProcessMyTreesSurface();
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
      var rendered = myTreesUI.renderTrees(trees, {
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
      postProcessMyTreesSurface();
      return rendered;
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
      var updated = myTreesUI.updateManageSummary(trees, uiOptions || {
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
      postProcessMyTreesSurface();
      return updated;
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
  var myTreesBootedFromCache = false;
  var lastTreesData = [];

  function bootMyTrees(user, options) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    myTreesBootedFromCache = !!(options && options.fromCache);
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

    postProcessMyTreesSurface();

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
