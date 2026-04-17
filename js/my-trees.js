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
  // ── Toast utility (공통 UI 사용) ──────────────────────────────────────────
  function showToast(message, type) {
    if (window.LoveBudUI?.showToast) {
      window.LoveBudUI.showToast(message, type, 3000);
    } else {
      // fallback: 공통 유틸 로드 실패 시 기본 alert
      console.warn('[my-trees] LoveBudUI not loaded, toast degraded to console');
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  // ── Mini tree SVG for card thumbnails ───────────────────────────────────
  function buildMiniTreeSVG() {
    return [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
          '<linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">',
            '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#b85c66;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
          '</linearGradient>',
        '</defs>',
        '<!-- Trunk -->',
        '<path d="M 100 180 Q 98 140 100 110 Q 102 80 95 50" stroke="url(#trunkGrad)" stroke-width="6" fill="none" stroke-linecap="round"/>',
        '<!-- Branches -->',
        '<path d="M 100 130 Q 70 120 55 95 Q 45 75 50 55" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 100 110 Q 130 100 145 80 Q 155 65 150 45" stroke="#c97b83" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>',
        '<path d="M 98 80 Q 75 70 65 50 Q 58 35 62 20" stroke="#c97b83" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>',
        '<!-- Nodes -->',
        '<circle cx="50" cy="55" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="150" cy="45" r="10" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="62" cy="20" r="8" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<circle cx="95" cy="50" r="12" fill="white" stroke="#e8d0d3" stroke-width="1.5"/>',
        '<!-- Glow -->',
        '<ellipse cx="100" cy="170" rx="30" ry="10" fill="none" stroke="#904951" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
      '</svg>'
    ].join('');
  }

  // ── Render tree cards grid ───────────────────────────────────────────────
  function renderTrees(trees) {
    var container = document.getElementById('treesContainer');
    if (!container) return;

    if (!trees || trees.length === 0) {
      renderEmptyState(container);
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
  }

  function buildTreeCard(tree) {
    var i18n = window.t || function(k) { return k; };

    // Tree 정규화 (공통 유틸 사용)
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

    var a = document.createElement('a');
    a.href = 'editor.html?treeId=' + encodeURIComponent(normalizedTree.id);
    a.className = 'tree-card';

    // Visibility badge
    var visClass = normalizedTree.visibility === 'public' ? 'public' : 'private';
    var visLabel = normalizedTree.visibility === 'public' ? i18n('visibility_public') : i18n('visibility_private');

    // Title 및 날짜 (정규화된 값 사용)
    var title = normalizedTree.title;
    var date = normalizedTree.updatedAt || '';
    if (date) {
      date = date.slice(0, 10).replace(/-/g, '.');
    }

    a.innerHTML = [
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

    return a;
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  function renderEmptyState(container) {
    var i18n = window.t || function(k) { return k; };
    container.innerHTML = [
      '<div class="empty-state">',
        '<span class="material-symbols-outlined empty-state-icon">account_tree</span>',
        '<h2>' + i18n('empty_state_title') + '</h2>',
        '<p>' + i18n('empty_state_desc').replace('.', '.<br>') + '</p>',
        '<button class="btn-create-tree" id="createTreeBtn">',
          '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span>',
          i18n('create_tree_btn'),
        '</button>',
      '</div>'
    ].join('');

    document.getElementById('createTreeBtn').addEventListener('click', createNewTree);
  }

  // ── Loading skeletons ────────────────────────────────────────────────────
  function renderLoadingSkeletons() {
    var container = document.getElementById('treesContainer');
    if (!container) return;

    var grid = document.createElement('div');
    grid.className = 'trees-grid';
    grid.style.display = 'flex';
    grid.style.gap = '24px';

    for (var i = 0; i < 3; i++) {
      var skeleton = document.createElement('div');
      skeleton.className = 'tree-card-skeleton';
      skeleton.innerHTML = [
        '<div class="skeleton-thumb"></div>',
        '<div class="skeleton-info">',
          '<div class="skeleton-line" style="width:80%;margin-bottom:16px;"></div>',
          '<div class="skeleton-line short"></div>',
        '</div>'
      ].join('');
      grid.appendChild(skeleton);
    }

    container.innerHTML = '';
    container.appendChild(grid);
  }

  // ── Create new tree ──────────────────────────────────────────────────────
  function getDefaultVisibility() {
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
    return 'private'; // 기본값은 반드시 private
  }

  async function createNewTree() {
    var btn = document.getElementById('createTreeBtn');
    var i18n = window.t || function(k) { return k; };
    if (btn) {
      btn.disabled = true;
      btn.textContent = i18n('creating');
    }

    // 설정에서 defaultVisibility 읽기 (없으면 'private')
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

      // 캐시 무효화 - 새 트리 생성했으므로 목록 갱신 필요
      if (window.LoveBudCache) {
        window.LoveBudCache.clear(TREES_CACHE_KEY);
        console.log('[my-trees] Cache cleared after new tree creation');
      }
      
      // Redirect to editor with new tree (flat camelCase 표준)
      var treeId = newTree?.id;
      if (treeId) {
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(treeId);
      } else {
        window.location.href = 'editor.html';
      }
    } catch (e) {
      console.error('[my-trees] createTree failed:', e);
      var i18n = window.t || function(k) { return k; };
      showToast(i18n('create_tree_fail'), 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span>' + i18n('create_tree_btn');
      }
    }
  }

  // ── Escape HTML ──────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Auth guard: load trees on auth ready ─────────────────────────────────
  function startMyTrees(user) {
    if (!user) {
      // No Firebase user - check confirmed auth cache before redirect
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
      // cached auth 있으면 아래로 진행
    }

    renderLoadingSkeletons();
    loadTrees();
  }

  // ── 캐시 키 상수 ───────────────────────────────────────────────────────
  var TREES_CACHE_KEY = 'my_trees_list';

  async function loadTrees() {
    var cache = window.LoveBudCache;
    
    // 1. 캐시된 트리 목록 먼저 렌더 (즉각 체감 속도)
    var cachedTrees = cache ? cache.get(TREES_CACHE_KEY) : null;
    if (cachedTrees && Array.isArray(cachedTrees)) {
      console.log('[my-trees] Rendering cached trees:', cachedTrees.length);
      renderTrees(cachedTrees);
    } else {
      // 캐시 없으면 skeleton만 표시
      renderLoadingSkeletons();
    }
    
    // 2. Background에서 API로 최신 데이터 가져오기
    try {
      var trees;
      if (window.apiClient && window.apiClient.getTrees) {
        trees = await window.apiClient.getTrees();
        // 인증된 /trees 는 이미 "내 트리 목록"이므로 추가 visibility 필터링 금지
      } else {
        trees = typeof getTrees === 'function' ? getTrees() : [];
      }

      if (Array.isArray(trees)) {
        // 캐시 업데이트
        if (cache) {
          cache.set(TREES_CACHE_KEY, trees, 3 * 60 * 1000); // 3분 TTL
        }
        // 화면 업데이트 (캐시와 다르면)
        if (!cachedTrees || JSON.stringify(cachedTrees) !== JSON.stringify(trees)) {
          console.log('[my-trees] Updating trees from API:', trees.length);
          renderTrees(trees);
        }
      }
    } catch (e) {
      console.warn('[my-trees] getTrees failed:', e.message);
      // API 실패시 캐시라도 보여줌 (있는 경우)
      if (!cachedTrees) {
        renderTrees([]);
      }
    }
  }

  // ── Bootstrap: auth.js가 확정한 인증 상태를 기준으로 시작 ────────────────
  // my-trees.js는 Firebase/Auth 스크립트보다 먼저 로드되므로, 여기서 직접
  // firebase 존재 여부를 검사하면 비로그인 사용자가 오프라인 사용자로 통과할 수 있다.
  var myTreesStarted = false;
  function bootMyTrees(user) {
    if (myTreesStarted) return;
    myTreesStarted = true;
    startMyTrees(user);
  }

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
      var cachedUser = null;
      try {
        if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
          var raw = localStorage.getItem('lovebud_auth_cache');
          if (raw && raw !== 'null') {
            cachedUser = JSON.parse(raw);
          }
        }
      } catch (e) {}
      
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
    }, 5500);
  }, { once: true });

})();
