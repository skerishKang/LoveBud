/**
 * LoveBud - My Trees Page
 * v20260421-1
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

  // ── Toast utility (공통 UI 사용) ──────────────────────────────────────────
  function showToast(message, type) {
    if (myTreesPage && typeof myTreesPage.showToast === 'function') {
      return myTreesPage.showToast(message, type);
    }

    if (window.LoveBudUI?.showToast) {
      window.LoveBudUI.showToast(message, type, 3000);
    } else {
      // fallback: 공통 유틸 로드 실패 시 기본 alert
      console.warn('[my-trees] LoveBudUI not loaded, toast degraded to console');
      console.log('[Toast ' + type + '] ' + message);
    }
  }

  // ── Confirmed session helper ───────────────────────────────────────────────
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

   // ── State management ─────────────────────────────────────────────────────
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

   // ── Setup header create button (always visible CTA) ───────────────────────
   function setupHeaderCreateButton() {
     if (myTreesPage && typeof myTreesPage.setupHeaderCreateButton === 'function') {
       return myTreesPage.setupHeaderCreateButton({
         onCreate: createNewTree
       });
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

   // ── Setup retry button ────────────────────────────────────────────────────
   function setupRetryButton() {
     if (myTreesPage && typeof myTreesPage.setupRetryButton === 'function') {
       return myTreesPage.setupRetryButton({
         onRetry: loadTrees
       });
     }

     var retryBtn = document.getElementById('retryLoadBtn');
     if (retryBtn) {
       retryBtn.addEventListener('click', function() {
         console.log('[my-trees] Retry loading trees');
         loadTrees();
       });
     }
   }

   // ── Auth guard: load trees on auth ready ─────────────────────────────────
   function startMyTrees(user) {
     if (!user) {
       var cachedUser = null;
       try {
         if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
           var raw = localStorage.getItem('lovebud_auth_cache');
           if (raw && raw !== 'null') {
             cachedUser = JSON.parse(raw);
           }
         }
       } catch (e) {}

       if (!cachedUser || !cachedUser.uid) {
         window.location.href = 'login.html?redirect=my-trees.html';
         return;
       }
     }

     setupHeaderCreateButton();
     setupRetryButton();
     loadTrees();
   }

  // ── Tree management: rename/delete ─────────────────────────────────────
  async function renameTree(treeId, currentTitle) {
    if (myTreesActions && typeof myTreesActions.renameTree === 'function') {
      return myTreesActions.renameTree(treeId, currentTitle, {
        showToast: showToast,
        reloadTrees: loadTrees,
        i18n: window.t || function(k) { return k; }
      });
    }

    var i18n = window.t || function(k) { return k; };
    var newTitle = prompt(i18n('rename_tree_prompt') || '트리 이름을 입력하세요:', currentTitle);

    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
      return;
    }

    try {
      if (window.apiClient && window.apiClient.updateTree) {
        await window.apiClient.updateTree(treeId, { title: newTitle.trim() });
        showToast(i18n('rename_success') || '트리 이름이 변경되었습니다.', 'success');
        loadTrees();
      } else {
        showToast(i18n('api_not_available') || 'API를 사용할 수 없습니다.', 'error');
      }
    } catch (e) {
      console.error('[my-trees] renameTree failed:', e);
      showToast(i18n('rename_fail') || '이름 변경에 실패했습니다.', 'error');
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

    var i18n = window.t || function(k) { return k; };
    var confirmed = confirm((i18n('delete_tree_confirm') || '정말 "{title}" 트리를 삭제하시겠습니까?').replace('{title}', treeTitle));

    if (!confirmed) return;

    try {
      if (window.apiClient && window.apiClient.deleteTree) {
        await window.apiClient.deleteTree(treeId);
        showToast(i18n('delete_success') || '트리가 삭제되었습니다.', 'success');
        loadTrees();
      } else {
        showToast(i18n('api_not_available') || 'API를 사용할 수 없습니다.', 'error');
      }
    } catch (e) {
      console.error('[my-trees] deleteTree failed:', e);
      showToast(i18n('delete_fail') || '삭제에 실패했습니다.', 'error');
    }
  }

  // ── Close all dropdowns ───────────────────────────────────────────────────
  function closeAllDropdowns() {
    if (myTreesUI && typeof myTreesUI.closeAllDropdowns === 'function') {
      return myTreesUI.closeAllDropdowns();
    }
    document.querySelectorAll('.tree-card-dropdown').forEach(function(dd) {
      dd.classList.remove('show');
    });
  }

  // ── Mini tree SVG for card thumbnails ───────────────────────────────────
  function buildMiniTreeSVG(tree) {
    if (myTreesUI && typeof myTreesUI.buildMiniTreeSVG === 'function') {
      return myTreesUI.buildMiniTreeSVG(tree);
    }
    return '';
  }

   // ── Render tree cards grid + 관리 요약 ───────────────────────────────────────────────
   function renderTrees(trees) {
     if (myTreesUI && typeof myTreesUI.renderTrees === 'function') {
       return myTreesUI.renderTrees(trees, {
         setState: setState,
         stateEnum: STATE,
         setLastTreesData: function(value) { lastTreesData = value; },
         updateManageSummary: function(nextTrees, uiOptions) {
           return updateManageSummary(nextTrees, uiOptions);
         },
         buildTreeCard: function(tree, uiOptions) {
           return buildTreeCard(tree, uiOptions);
         },
         normalizeTree: function(tree) {
           return window.LoveBudNormalize?.normalizeTree(tree);
         },
         onRename: renameTree,
         onDelete: deleteTree,
         onNavigate: function(normalizedTree) {
           window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
         },
         onSelect: applyTreeSelection,
         getSelectedTreeId: getSelectedTreeId,
         isSelected: function(treeId) {
           return getSelectedTreeId() === treeId;
         },
         closeAllDropdowns: closeAllDropdowns,
         i18n: window.t || function(k) { return k; }
       });
     }

     var container = document.getElementById('state-loaded');
     if (!container) return;

     updateManageSummary(trees);

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

  // 📌 트리 정렬
  function sortTrees(trees, sortBy) {
    if (myTreesState && typeof myTreesState.sortTrees === 'function') {
      return myTreesState.sortTrees(trees, sortBy);
    }

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

  // 📌 관리 요약 바 업데이트
  function updateManageSummary(trees, uiOptions) {
    if (myTreesUI && typeof myTreesUI.updateManageSummary === 'function' && !uiOptions) {
      return myTreesUI.updateManageSummary(trees, {
        setLastTreesData: function(value) { lastTreesData = value; },
        getSelectedTreeId: getSelectedTreeId,
        onNavigate: function(normalizedTree) {
          window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
        },
        onRename: renameTree,
        onDelete: deleteTree,
        i18n: window.t || function(k) { return k; }
      });
    }

    var summaryBar = document.getElementById('manageSummaryBar');
    if (!summaryBar || !trees || trees.length === 0) {
      if (summaryBar) summaryBar.style.display = 'none';
      return;
    }

    if (myTreesState && typeof myTreesState.setLastTreesData === 'function') {
      myTreesState.setLastTreesData(trees);
    } else {
      lastTreesData = trees;
    }

    var total = trees.length;
    var publicCount = trees.filter(function(t) { return t.visibility === 'public'; }).length;
    var privateCount = total - publicCount;

    var totalEl = document.getElementById('totalTreesCount');
    var publicEl = document.getElementById('publicTreesCount');
    var privateEl = document.getElementById('privateTreesCount');

    if (totalEl) totalEl.textContent = total;
    if (publicEl) publicEl.textContent = publicCount;
    if (privateEl) privateEl.textContent = privateCount;

    summaryBar.style.display = 'flex';
  }

  function buildTreeCard(tree, uiOptions) {
    if (myTreesUI && typeof myTreesUI.buildTreeCard === 'function' && !uiOptions) {
      return myTreesUI.buildTreeCard(tree, {
        i18n: window.t || function(k) { return k; },
        normalizeTree: function(nextTree) {
          return window.LoveBudNormalize?.normalizeTree(nextTree);
        },
        onRename: renameTree,
        onDelete: deleteTree,
        onNavigate: function(normalizedTree) {
          window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
        },
        onSelect: applyTreeSelection,
        getSelectedTreeId: getSelectedTreeId,
        isSelected: function(treeId) {
          return getSelectedTreeId() === treeId;
        },
        closeAllDropdowns: closeAllDropdowns
      });
    }

    var card = document.createElement('div');
    card.className = 'tree-card';
    return card;
  }

  // ── Create new tree ──────────────────────────────────────────────────────
   function isTestPublicMode() {
     if (myTreesActions && typeof myTreesActions.isTestPublicMode === 'function') {
       return myTreesActions.isTestPublicMode();
     }

     try {
       var urlParams = new URLSearchParams(window.location.search);
       if (urlParams.get('testPublic') === '1') return true;
       if (window.localStorage?.getItem('lovebud_test_public') === '1') return true;
       if (window.LoveBudRuntimeFlags?.forcePublicTrees) return true;
     } catch (e) {}
     return false;
   }

   function getDefaultVisibility() {
     if (myTreesActions && typeof myTreesActions.getDefaultVisibility === 'function') {
       return myTreesActions.getDefaultVisibility({
         isTestPublicMode: isTestPublicMode
       });
     }

     if (isTestPublicMode()) {
       console.log('[my-trees] Test public mode: defaulting to public');
       return 'public';
     }

     try {
       var settings = localStorage.getItem('lovebud_user_settings');
       if (settings) {
         var parsed = JSON.parse(settings);
         if (parsed.defaultVisibility === 'public' || parsed.defaultVisibility === 'private') {
           return parsed.defaultVisibility;
         }
       }
     } catch (e) {
       console.warn('[my-trees] Failed to read settings:', e);
     }
     return 'private';
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

  // ── Escape HTML ──────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (myTreesUI && typeof myTreesUI.escapeHtml === 'function') {
      return myTreesUI.escapeHtml(str);
    }
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');
  }

  // ── 캐시 키 상수 ───────────────────────────────────────────────────────
  var TREES_CACHE_KEY = myTreesData?.TREES_CACHE_KEY || 'my_trees_list';
  var TREE_DETAIL_CACHE_KEY = myTreesData?.TREE_DETAIL_CACHE_KEY || 'tree_detail_';
  var TREE_MEMORIES_CACHE_KEY = myTreesData?.TREE_MEMORIES_CACHE_KEY || 'tree_memories_';

  function preloadFirstTreeDetail(trees) {
    if (myTreesData && typeof myTreesData.preloadFirstTreeDetail === 'function') {
      return myTreesData.preloadFirstTreeDetail(trees);
    }
  }

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

  document.addEventListener('DOMContentLoaded', function() {
    var cachedUser = getConfirmedSessionUser();
    if (cachedUser && !myTreesStarted) {
      console.log('[my-trees] Booting immediately from confirmed session cache');
      bootMyTrees(cachedUser);
    }
  }, { once: true });

  if (typeof window.registerOnAuthReady === 'function') {
    window.registerOnAuthReady(bootMyTrees);
  } else {
    window.onAuthReady = bootMyTrees;
  }

  window.addEventListener('load', function() {
    setTimeout(function() {
      if (myTreesStarted) return;
      var cachedUser = getConfirmedSessionUser();
      var isFirebaseReady = typeof firebase !== 'undefined' && 
                       firebase.auth && 
                       firebase.apps && 
                       firebase.apps.length > 0;
      
      if (!isFirebaseReady && !cachedUser) {
        console.warn('[my-trees] Firebase unavailable, no cached auth, redirecting to login');
        var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        window.location.href = basePath + 'login.html?redirect=' + basePath + 'my-trees.html';
        return;
      }
      
      if (cachedUser) {
        console.log('[my-trees] Using cached auth after timeout');
      }
      bootMyTrees(cachedUser);
    }, 700);
  }, { once: true });

})();
