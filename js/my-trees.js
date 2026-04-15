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
  var TOAST_DURATION = 3000;

  // ── Toast utility ─────────────────────────────────────────────────────────
  function showToast(message, type) {
    var existing = document.getElementById('myTreesToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'myTreesToast';
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, TOAST_DURATION);
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
    var a = document.createElement('a');
    a.href = 'editor.html?treeId=' + encodeURIComponent(tree.id);
    a.className = 'tree-card';

    // Visibility badge
    var visClass = tree.visibility === 'public' ? 'public' : 'private';
    var visLabel = tree.visibility === 'public' ? '공개' : '비공개';

    // Title fallback
    var title = tree.title || tree.data?.title || '나의 러브트리';
    // Updated date
    var date = tree.updatedAt || tree.data?.updated_at || tree.createdAt || tree.data?.created_at || '';
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
    container.innerHTML = [
      '<div class="empty-state">',
        '<span class="material-symbols-outlined empty-state-icon">account_tree</span>',
        '<h2>아직 러브트리가 없어요</h2>',
        '<p>당신의 첫 번째 러브트리를 만들어 보세요. 영상의 감정적인 순간을 기록하고, 사랑이 자라나는 경로를可视化해 보세요.</p>',
        '<button class="btn-create-tree" id="createTreeBtn">',
          '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span>',
          '새 러브트리 만들기',
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
  async function createNewTree() {
    var btn = document.getElementById('createTreeBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '만드는 중...';
    }

    try {
      var newTree;
      if (window.apiClient && window.apiClient.createTree) {
        newTree = await window.apiClient.createTree({
          title: '나의 첫 러브트리',
          visibility: 'private'
        });
        console.log('[my-trees] Tree created:', newTree);
      } else {
        // Fallback: generate client-side ID and redirect
        newTree = { id: 'tree-' + Date.now() };
        showToast('데모 모드입니다. 실제 트리는 생성되지 않습니다.', 'error');
      }

      // Redirect to editor with new tree
      var treeId = newTree.id || newTree.data?.id;
      if (treeId) {
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(treeId);
      } else {
        // Fallback: redirect to editor without treeId (will auto-create)
        window.location.href = 'editor.html';
      }
    } catch (e) {
      console.error('[my-trees] createTree failed:', e);
      showToast('러브트리 만들기 실패. 다시 시도해 주세요.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span>새 러브트리 만들기';
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
      // Not logged in — redirect to login
      window.location.href = 'login.html?redirect=my-trees.html';
      return;
    }

    // Render loading state
    renderLoadingSkeletons();

    // Load trees
    loadTrees();
  }

  async function loadTrees() {
    try {
      var trees;
      if (window.apiClient && window.apiClient.getTrees) {
        trees = await window.apiClient.getTrees();
      } else {
        // Fallback to mock
        trees = typeof getTrees === 'function' ? getTrees() : [];
      }

      if (Array.isArray(trees)) {
        renderTrees(trees);
      } else {
        renderTrees([]);
      }
    } catch (e) {
      console.warn('[my-trees] getTrees failed, fallback to mock:', e.message);
      var trees = typeof getTrees === 'function' ? getTrees() : [];
      renderTrees(Array.isArray(trees) ? trees : []);
    }
  }

  // ── Bootstrap: wait for auth then load ───────────────────────────────────
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length) {
    var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
      unsubscribe();
      startMyTrees(user);
    });
  } else {
    // Firebase unavailable — try offline mode
    startMyTrees({ uid: 'offline', email: 'offline@example.com' });
  }

})();