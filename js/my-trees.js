/**
 * LoveBud - My Trees Page
 * v20260415-1
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

     // Setup buttons
     setupHeaderCreateButton();
     setupRetryButton();

     // Initial load (will set appropriate state)
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
      return; // cancelled or unchanged
    }

    try {
      if (window.apiClient && window.apiClient.updateTree) {
        await window.apiClient.updateTree(treeId, { title: newTitle.trim() });
        showToast(i18n('rename_success') || '트리 이름이 변경되었습니다.', 'success');
        // Refresh tree list
        loadTrees();
      } else {
        // Fallback: just show toast (API not available)
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
        // Refresh tree list
        loadTrees();
      } else {
        // Fallback: just show toast (API not available)
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
  function buildMiniTreeSVG() {
    if (myTreesUI && typeof myTreesUI.buildMiniTreeSVG === 'function') {
      return myTreesUI.buildMiniTreeSVG();
    }
    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
          '<linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#b85c66;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        '<path d="M 100 180 Q 98 140 100 110 Q 102 80 95 50" stroke="url(#trunkGrad)" stroke-width="6" fill="none" stroke-linecap="round"/>',
        '<path d="M 100 130 Q 70 120 55 95 Q 45 75 50 55" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 100 110 Q 130 100 145 80 Q 155 65 150 45" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 98 80 Q 75 70 65 50 Q 58 35 62 20" stroke="#c97b83" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>',
        '<circle cx="50" cy="55" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="150" cy="45" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="62" cy="20" r="8" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="95" cy="50" r="12" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<ellipse cx="100" cy="170" rx="30" ry="10" fill="none" stroke="#904951" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
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
        setLastTreesData: function(value) { lastTreesData = value; }
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
        closeAllDropdowns: closeAllDropdowns
      });
    }

    var i18n = window.t || function(k) { return k; };

    var normalizedTree = window.LoveBudNormalize?.normalizeTree(tree);
    if (!normalizedTree) {
      console.warn('[my-trees] LoveBudNormalize not loaded, using local fallback');
      normalizedTree = {
        id: tree?.id,
        title: tree?.title || '나의 러브트리',
        visibility: tree?.visibility || 'private',
        updatedAt: tree?.updatedAt || tree?.createdAt || null
      };
    }

    var card = document.createElement('div');
    card.className = 'tree-card';
    card.style.cursor = 'pointer';

    card.addEventListener('click', function(e) {
      if (e.target.closest('.tree-card-menu') || e.target.closest('.tree-card-dropdown')) {
        return;
      }
      window.location.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
    });

    var visClass = normalizedTree.visibility === 'public' ? 'public' : 'private';
    var visLabel = normalizedTree.visibility === 'public' ? i18n('visibility_public') : i18n('visibility_private');

    var title = normalizedTree.title;
    var date = normalizedTree.updatedAt || '';
    if (date) {
      date = date.slice(0, 10).replace(/-/g, '.');
    }

    var menuBtnId = 'menuBtn_' + normalizedTree.id;
    var dropdownId = 'dropdown_' + normalizedTree.id;

    card.innerHTML = [
      '<button class="tree-card-menu" id="' + menuBtnId + '" type="button">',
        '<span class="material-symbols-outlined" style="font-size:18px;color:#666;">more_vert</span>',
      '</button>',
      '<div class="tree-card-dropdown" id="' + dropdownId + '">',
        '<div class="dropdown-item rename" data-action="rename">',
          '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>',
          i18n('rename') || '이름 변경',
        '</div>',
        '<div class="dropdown-item delete" data-action="delete">',
          '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>',
          i18n('delete') || '삭제',
        '</div>',
      '</div>',
      '<div class="tree-card-thumb">' + buildMiniTreeSVG() + '</div>',
      '<div class="tree-card-info">',
        '<div class="tree-card-title">' + escapeHtml(title) + '</div>',
        '<div class="tree-card-meta">',
          '<span class="tree-card-visibility ' + visClass + '">',
            '<span class="material-symbols-outlined" style="font-size:12px;">' + (visClass === 'public' ? 'public' : 'lock') + '</span>',
            visLabel,
          '</span>',
          date ? '<span>' + date + '</span>' : '',
        '</div>',
      '</div>'
    ].join('');

    setTimeout(function() {
      var menuBtn = document.getElementById(menuBtnId);
      var dropdown = document.getElementById(dropdownId);

      if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          closeAllDropdowns();
          dropdown.classList.toggle('show');
        });

        dropdown.querySelectorAll('.dropdown-item').forEach(function(item) {
          item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var action = this.getAttribute('data-action');
            if (action === 'rename') {
              renameTree(normalizedTree.id, title);
            } else if (action === 'delete') {
              deleteTree(normalizedTree.id, title);
            }

            closeAllDropdowns();
          });
        });
      }
    }, 0);

    return card;
  }

  // ── Create new tree ──────────────────────────────────────────────────────
   function isTestPublicMode() {
     if (myTreesActions && typeof myTreesActions.isTestPublicMode === 'function') {
       return myTreesActions.isTestPublicMode();
     }

     // 테스트 시나리오에서 public 트리 생성을 강제하는 모드 감지
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

     // 테스트 모드일 때는 public을 기본으로
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
     return 'private'; // 실제 사용자 기본값은 반드시 private
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

     var btn = document.getElementById('createTreeBtn');
     var i18n = window.t || function(k) { return k; };

     // Disable button immediately (UX hardening)
     if (btn) {
       btn.disabled = true;
       btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">hourglass_empty</span> ' + (i18n('creating') || '생성 중...');
     }

     var defaultVisibility = getDefaultVisibility();
     console.log('[my-trees] Creating tree with visibility:', defaultVisibility);

     try {
       var newTree;
       if (window.apiClient && window.apiClient.createTree) {
         newTree = await window.apiClient.createTree({
           title: i18n('default_tree_title') || '나의 첫 러브트리',
           visibility: defaultVisibility
         });
         console.log('[my-trees] Tree created:', newTree);
       } else {
         // Fallback: generate client-side ID and redirect
         newTree = { id: 'tree-' + Date.now() };
         showToast((window.t || function(k){return k;})('demo_mode'), 'error');
       }

       // Cache invalidation
       if (window.LoveBudCache) {
         window.LoveBudCache.clear(TREES_CACHE_KEY);
         console.log('[my-trees] Cache cleared after new tree creation');
       }

       // Redirect immediately to editor
       var treeId = newTree?.id;
       if (treeId) {
         window.location.href = 'editor.html?treeId=' + encodeURIComponent(treeId);
       } else {
         window.location.href = 'editor.html';
       }
     } catch (e) {
       console.error('[my-trees] createTree failed:', e);

       // Re-enable button (UX hardening)
       if (btn) {
         btn.disabled = false;
         btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span> ' + (i18n('create_tree_btn') || '새 러브트리');
       }

       // Show error toast (UX hardening)
       var errorMsg = i18n('create_tree_fail') || '트리 생성에 실패했습니다';
       showToast(errorMsg, 'error');
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
  var TREE_DETAIL_CACHE_KEY = myTreesData?.TREE_DETAIL_CACHE_KEY || 'tree_detail_'; // prefix + treeId
  var TREE_MEMORIES_CACHE_KEY = myTreesData?.TREE_MEMORIES_CACHE_KEY || 'tree_memories_'; // prefix + treeId

  // 첫 번째 트리 상세 정보 preload (fire-and-forget)
  function preloadFirstTreeDetail(trees) {
    if (myTreesData && typeof myTreesData.preloadFirstTreeDetail === 'function') {
      return myTreesData.preloadFirstTreeDetail(trees);
    }

    try {
      if (!trees || !trees.length || !window.apiClient) return;
      var firstTree = trees[0];
      var treeId = firstTree.id || firstTree;
      if (!treeId) return;

      Promise.all([
        window.apiClient.getTree ? window.apiClient.getTree(treeId).catch(function() {}) : Promise.resolve(),
        window.apiClient.getMemoriesByTree ? window.apiClient.getMemoriesByTree(treeId).catch(function() {}) : Promise.resolve()
      ]).then(function(results) {
        var treeDetail = results[0];
        var memories = results[1];

        if (treeDetail) {
          localStorage.setItem(TREE_DETAIL_CACHE_KEY + treeId, JSON.stringify({
            data: treeDetail,
            timestamp: Date.now()
          }));
        }
        if (memories && Array.isArray(memories)) {
          localStorage.setItem(TREE_MEMORIES_CACHE_KEY + treeId, JSON.stringify({
            data: memories,
            timestamp: Date.now()
          }));
        }
        console.log('[my-trees] Preloaded first tree detail:', treeId, 'memories:', memories ? memories.length : 0);
      }).catch(function(err) {
        console.warn('[my-trees] Preload first tree detail failed:', err.message);
      });
    } catch (e) {
      console.warn('[my-trees] Preload first tree detail error:', e);
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

     var cache = window.LoveBudCache;
     var i18n = window.t || function(k) { return k; };

     setState(STATE.LOADING);

     var cachedTrees = cache ? cache.get(TREES_CACHE_KEY) : null;
     if (cachedTrees && Array.isArray(cachedTrees)) {
       console.log('[my-trees] Rendering cached trees:', cachedTrees.length);
       renderTrees(cachedTrees);
     }

     try {
       var trees;
       if (window.apiClient && window.apiClient.getTrees) {
         trees = await window.apiClient.getTrees();
       } else {
         trees = typeof getTrees === 'function' ? getTrees() : [];
       }

       if (Array.isArray(trees)) {
         if (cache) {
           cache.set(TREES_CACHE_KEY, trees, 3 * 60 * 1000);
         }

         renderTrees(trees);
         preloadFirstTreeDetail(trees);
       } else {
         console.error('[my-trees] Invalid trees response:', trees);
         setState(STATE.ERROR);
       }
     } catch (e) {
       console.error('[my-trees] loadTrees error:', e);

       if (cachedTrees && Array.isArray(cachedTrees)) {
         console.log('[my-trees] Showing cached trees after API error');
         renderTrees(cachedTrees);
         showToast(i18n('myTrees.offline_mode') || '오프라인 모드 - 캐시된 데이터를 표시합니다', 'warn');
       } else {
         setState(STATE.ERROR);
         showToast(i18n('myTrees.load_failed') || '트리 목록을 불러오는데 실패했습니다', 'error');
       }
     }
   }

  // ── Bootstrap: auth.js가 확정한 인증 상태를 기준으로 시작 ────────────────
  // my-trees.js는 Firebase/Auth 스크립트보다 먼저 로드되므로, 여기서 직접
  // firebase 존재 여부를 검사하면 비로그인 사용자가 오프라인 사용자로 통과할 수 있다.
  var myTreesStarted = false;
  var lastTreesData = []; // fallback only

  function bootMyTrees(user) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    startMyTrees(user);

    // 📌 정렬 드롭다운 이벤트
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

  // DOMContentLoaded: confirmed session이 있으면 즉시 boot
  document.addEventListener('DOMContentLoaded', function() {
    var cachedUser = getConfirmedSessionUser();
    if (cachedUser && !myTreesStarted) {
      console.log('[my-trees] Booting immediately from confirmed session cache');
      bootMyTrees(cachedUser);
    }
  }, { once: true });

  // 새로운 배열 콜백 패턴 사용 (덮어쓰기 문제 해결)
  if (typeof window.registerOnAuthReady === 'function') {
    window.registerOnAuthReady(bootMyTrees);
  } else {
    // 폴백: 구식 단일 콜백 (auth.js가 먼저 로드되지 않은 경우)
    window.onAuthReady = bootMyTrees;
  }

  // auth.js timeout 또는 Firebase unavailable 시에도 confirmed auth cache가 있으면 진입 허용
  // CT: cached auth가 있으면 먼저 페이지를 보고, Firebase 재검증은后台에서 진행
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (myTreesStarted) return;
      
      // Check for confirmed auth cache before redirect
      var cachedUser = getConfirmedSessionUser();
      
      var isFirebaseReady = typeof firebase !== 'undefined' && 
                       firebase.auth && 
                       firebase.apps && 
                       firebase.apps.length > 0;
      
      if (!isFirebaseReady && !cachedUser) {
        // Firebase 없고 cached auth도 없음 → login으로 redirect
        console.warn('[my-trees] Firebase unavailable, no cached auth, redirecting to login');
        var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        window.location.href = basePath + 'login.html?redirect=' + basePath + 'my-trees.html';
        return;
      }
      
      // Firebase 없지만 cached auth 있음 OR Firebase 있음 → boot with cache
      if (cachedUser) {
        console.log('[my-trees] Using cached auth after timeout');
      }
      bootMyTrees(cachedUser);
    }, 700); // 5500ms → 700ms 축소
  }, { once: true });

})();
