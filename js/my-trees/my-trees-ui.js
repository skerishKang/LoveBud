/**
 * LoveBud - My Trees UI Helpers
 * v20260523-1488-1
 *
 * Tree card rendering and summary UI utilities
 * Issue #1488: 나의트리 카드 메트릭을 좋아요 + 조회수로 둘러보기와 통일
 */

(function () {
  if (window.LoveBudMyTreesUI) return;

  function escapeHtml(str) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.escapeHtml === 'function') {
      return Utils.escapeHtml(str);
    }
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashSeed(value) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.hashSeed === 'function') {
      return Utils.hashSeed(value);
    }
    var source = String(value || 'lovetree');
    var hash = 0;
    for (var i = 0; i < source.length; i++) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getTreeMomentCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeMomentCount === 'function') {
      return Utils.getTreeMomentCount(tree);
    }
    if (!tree) return 0;
    var count =
      tree.memoryCount ??
      tree.memory_count ??
      tree.nodeCount ??
      tree.node_count ??
      (Array.isArray(tree.memories) ? tree.memories.length : undefined) ??
      (Array.isArray(tree.nodes) ? tree.nodes.length : undefined) ??
      0;
    count = Number(count);
    return Number.isFinite(count) ? count : 0;
  }

  // Issue #1488: totalViewCount 우선 fallback
  function getTreeViewCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeViewCount === 'function') {
      return Utils.getTreeViewCount(tree);
    }
    if (!tree) return 0;
    var keys = [
      'totalViewCount',
      'viewCount', 'viewsCount', 'views', 'view_count', 'views_count',
      'visitorCount', 'visitorsCount', 'visitCount', 'visitsCount', 'visits',
      'openCount', 'opensCount', 'open_count'
    ];
    for (var i = 0; i < keys.length; i++) {
      var value = Number(tree[keys[i]]);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
  }

  // Issue #1488: 좋아요 수 읽기
  function getTreeLikeCount(tree) {
    if (!tree) return 0;
    var keys = ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count'];
    for (var i = 0; i < keys.length; i++) {
      var value = Number(tree[keys[i]]);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
  }

  function formatCompactCount(value) {
    var count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count >= 1000000) return (Math.floor(count / 100000) / 10) + 'M';
    if (count >= 1000) return (Math.floor(count / 100) / 10) + 'K';
    return String(count);
  }

  function getVisibilityActionLabel(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getVisibilityActionLabel === 'function') {
      return Visuals.getVisibilityActionLabel(tree, i18n);
    }
    return tree && tree.visibility === 'public'
      ? (i18n('visibility_make_private') || '비공개로 전환')
      : (i18n('visibility_make_public') || '공개로 전환');
  }

  function getTreeCardMeta(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getTreeCardMeta === 'function') {
      return Visuals.getTreeCardMeta(tree, i18n);
    }
    var visibility = tree && tree.visibility === 'public' ? 'public' : 'private';
    var visibilityLabel = visibility === 'public' ? (i18n('myTrees.summary_public') || '공개') : (i18n('myTrees.summary_private') || '비공개');

    return {
      visibilityIcon: visibility === 'public' ? 'lock' : 'public',
      visibilityActionLabel: getVisibilityActionLabel(tree, i18n),
      title: tree && tree.title,
      mood: getTreeMomentCount(tree) > 0 ? (i18n('myTrees.card_growing') || '차곡차곡 자라는 중') : (i18n('myTrees.card_waiting') || '첫 순간을 기다리는 중'),
      privateBadgeHtml: visibility === 'private' ? '<div class="tree-card-meta"><span class="tree-card-visibility private"><span class="material-symbols-outlined" style="font-size:12px;">lock</span>' + visibilityLabel + '</span></div>' : ''
    };
  }

  function getTreeMoodPalette(tree) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getTreeMoodPalette === 'function') {
      return Visuals.getTreeMoodPalette(tree);
    }
    return {
      background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
      leaf: '#d8839a',
      leafSoft: 'rgba(216, 131, 154, 0.18)',
      accent: '#904951'
    };
  }

  function buildMiniTreeSVG(tree) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.buildMiniTreeSVG === 'function') {
      return Visuals.buildMiniTreeSVG(tree);
    }
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg>';
  }


  function getRepresentativeThumbnail(tree) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getRepresentativeThumbnail === 'function') {
      return Visuals.getRepresentativeThumbnail(tree);
    }
    if (!tree) return '';
    return tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail || '';
  }

  function clipText(value, maxLength) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.clipText === 'function') {
      return Utils.clipText(value, maxLength);
    }
    var text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '\u2026';
  }
  function formatDate(dateValue) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.formatDate === 'function') {
      return Utils.formatDate(dateValue);
    }
    if (!dateValue) return '';
    try {
      var d = new Date(dateValue);
      if (isNaN(d.getTime())) return '';
      var yyyy = d.getFullYear();
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var dd = String(d.getDate()).padStart(2, '0');
      return yyyy + '-' + mm + '-' + dd;
    } catch(e) {
      return '';
    }
  }


  function getRepresentativeTextMeta(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getRepresentativeTextMeta === 'function') {
      return Visuals.getRepresentativeTextMeta(tree, i18n);
    }
    if (!tree) return null;

    var repTitle = clipText(tree.representativeTitle || tree.representative_title || '', 40);
    var repMemo = clipText(tree.representativeMemo || tree.representative_memo || '', 82);

    if (!repTitle && !repMemo) return null;

    return {
      title: repTitle || (i18n('editor_default_first_title') || '첫 순간'),
      memo: repMemo || (i18n('myTrees.card_text_fallback') || '처음 남긴 마음이 이 트리의 시작이 되었어요.')
    };
  }

  function buildRepresentativeTextVisual(tree, palette, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.buildRepresentativeTextVisual === 'function') {
      return Visuals.buildRepresentativeTextVisual(tree, palette, i18n);
    }
    var textMeta = getRepresentativeTextMeta(tree, i18n);
    if (!textMeta) return '';

    return '<div class="tree-card-text-visual" style="border-color:' + palette.leafSoft + ';background:rgba(255,255,255,0.84);">' +
      '<div class="tree-card-text-kicker" style="color:' + palette.accent + ';">' + escapeHtml(i18n('myTrees.card_first_moment') || '첫 순간 기록') + '</div>' +
      '<div class="tree-card-text-title">' + escapeHtml(textMeta.title) + '</div>' +
      '<div class="tree-card-text-memo">' + escapeHtml(textMeta.memo) + '</div>' +
      '</div>';
  }

  function buildTreeThumbVisual(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.buildTreeThumbVisual === 'function') {
      return Visuals.buildTreeThumbVisual(tree, i18n);
    }
    var palette = getTreeMoodPalette(tree);
    var momentCount = getTreeMomentCount(tree);
    var title = (tree && tree.title) || (i18n('default_tree_title') || '나의 러브트리');
    var initial = escapeHtml(title.charAt(0).toUpperCase());
    var moodLabel = momentCount > 1
      ? (i18n('myTrees.card_growing') || '차곡차곡 자라는 중')
      : (i18n('myTrees.card_waiting') || '첫 순간을 기다리는 중');
    var thumbnail = getRepresentativeThumbnail(tree);
    var textVisual = !thumbnail ? buildRepresentativeTextVisual(tree, palette, i18n) : '';

    return '<div class="tree-card-thumb" style="background:' + palette.background + ';">' +
      '<div class="tree-card-thumb-glow" style="background:' + palette.leafSoft + ';"></div>' +
      '<div class="tree-card-thumb-initial" style="color:' + palette.accent + ';border-color:' + palette.leafSoft + ';">' + initial + '</div>' +
      '<div class="tree-card-thumb-art">' +
      (thumbnail ? '<img class="tree-card-thumb-image" src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(title) + '">' : (textVisual || buildMiniTreeSVG(tree))) +
      '</div>' +
      (momentCount > 0 ? '<div class="tree-card-thumb-topline"><span class="tree-card-moment-badge" data-count="' + momentCount + '">' + (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) + '</span></div>' : '') +
      (momentCount > 0 ? '<div class="tree-card-thumb-caption">' + moodLabel + '</div>' : '') +
      '</div>';
  }

  function updateManageSummary(trees, options) {
    var summaryBar = document.getElementById('manageSummaryBar');
    if (!summaryBar || !trees || trees.length === 0) {
      if (summaryBar) {
        summaryBar.classList.remove('manage-summary-visible');
        summaryBar.classList.add('manage-summary-hidden');
      }
      return trees || [];
    }

    var i18n = (options && options.i18n) || window.t || function(k) { return k; };
    var selectedTreeId = options && options.getSelectedTreeId ? options.getSelectedTreeId() : null;
    var selectedTree = selectedTreeId
      ? trees.find(function(t) { return t && t.id === selectedTreeId; })
      : null;
    var total = trees.length;
    var publicCount = trees.filter(function (t) { return t.visibility === 'public'; }).length;
    var privateCount = total - publicCount;
    var totalMoments = trees.reduce(function(sum, tree) {
      return sum + getTreeMomentCount(tree);
    }, 0);

    var totalEl = document.getElementById('totalTreesCount');
    var publicEl = document.getElementById('publicTreesCount');
    var privateEl = document.getElementById('privateTreesCount');
    var momentEl = document.getElementById('totalMomentsCount');
    var selectedTitleEl = document.getElementById('manageSelectedTreeName');
    var selectedMetaEl = document.getElementById('manageSelectedTreeMeta');
    var openBtn = document.getElementById('manageOpenBtn');
    var renameBtn = document.getElementById('manageRenameBtn');
    var deleteBtn = document.getElementById('manageDeleteBtn');
    var visibilityBtn = document.getElementById('manageVisibilityBtn');

    if (totalEl) totalEl.textContent = total;
    if (publicEl) publicEl.textContent = publicCount;
    if (privateEl) privateEl.textContent = privateCount;
    if (momentEl) momentEl.textContent = totalMoments;

    if (selectedTitleEl) {
      selectedTitleEl.textContent = selectedTree
        ? selectedTree.title
        : (i18n('myTrees.manage_none') || '카드에서 트리를 하나 골라 관리해보세요');
    }

    if (selectedMetaEl) {
      if (selectedTree) {
        var momentCount = getTreeMomentCount(selectedTree);
        var visibilityKey = selectedTree.visibility === 'public' ? 'myTrees.summary_public' : 'myTrees.summary_private';
        selectedMetaEl.textContent =
          (i18n('myTrees.moment_count_compact') || '순간 {count}개').replace('{count}', String(momentCount)) +
          ' · ' +
          (i18n(visibilityKey) || (selectedTree.visibility === 'public' ? '공개' : '비공개'));
      } else {
        selectedMetaEl.textContent = i18n('myTrees.manage_hint') || '카드 아래 선택 버튼으로 빠르게 이름 변경과 삭제를 할 수 있어요.';
      }
    }

    [openBtn, renameBtn, deleteBtn, visibilityBtn].forEach(function(btn) {
      if (btn) btn.disabled = !selectedTree;
    });

    if (visibilityBtn) {
      visibilityBtn.textContent = selectedTree
        ? getVisibilityActionLabel(selectedTree, i18n)
        : (i18n('myTrees.manage_visibility') || '공개 설정');
    }

    if (openBtn) {
      openBtn.onclick = function() {
        if (!selectedTree) return;
        if (typeof options?.onNavigate === 'function') {
          options.onNavigate(selectedTree);
        }
      };
    }

    if (renameBtn) {
      renameBtn.onclick = function() {
        if (!selectedTree || typeof options?.onRename !== 'function') return;
        options.onRename(selectedTree.id, selectedTree.title);
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = function() {
        if (!selectedTree || typeof options?.onDelete !== 'function') return;
        options.onDelete(selectedTree.id, selectedTree.title);
      };
    }

    if (visibilityBtn) {
      visibilityBtn.onclick = function() {
        if (!selectedTree || typeof options?.onToggleVisibility !== 'function') return;
        options.onToggleVisibility(selectedTree.id, selectedTree.visibility);
      };
    }

    summaryBar.classList.remove('manage-summary-hidden');
    summaryBar.classList.add('manage-summary-visible');

    if (options && typeof options.setLastTreesData === 'function') {
      options.setLastTreesData(trees);
    }

    return trees;
  }

  function buildTreeCard(tree, options) {
    var i18n = (options && options.i18n) || window.t || function (k) { return k; };
    var normalizeTree = options && options.normalizeTree;
    var onSelect = options && options.onSelect;
    var isSelected = options && options.isSelected;

    var normalizedTree = typeof normalizeTree === 'function'
      ? normalizeTree(tree)
      : null;

    if (!normalizedTree) {
      normalizedTree = {
        id: tree && tree.id,
        title: (tree && tree.title) || '나의 러브트리',
        visibility: (tree && tree.visibility) || 'public',
        updatedAt: (tree && (tree.updatedAt || tree.createdAt)) || null,
        memoryCount: getTreeMomentCount(tree),
        representativeThumbnail: getRepresentativeThumbnail(tree),
        representativeTitle: tree && (tree.representativeTitle || tree.representative_title || ''),
        representativeMemo: tree && (tree.representativeMemo || tree.representative_memo || '')
      };
    } else {
      normalizedTree.representativeThumbnail = normalizedTree.representativeThumbnail || getRepresentativeThumbnail(tree);
      normalizedTree.memoryCount = getTreeMomentCount(tree || normalizedTree);
      normalizedTree.representativeTitle = normalizedTree.representativeTitle || (tree && (tree.representativeTitle || tree.representative_title || ''));
      normalizedTree.representativeMemo = normalizedTree.representativeMemo || (tree && (tree.representativeMemo || tree.representative_memo || ''));
    }

    // Issue #1488: 좋아요 + 조회수로 둘러보기와 통일 (순간수 제거)
    var likeCount = getTreeLikeCount(tree);
    var viewCount = getTreeViewCount(tree);
    var cardMeta = getTreeCardMeta(normalizedTree, i18n);
    var title = cardMeta.title;

    var selectedClass = typeof isSelected === 'function' && isSelected(normalizedTree.id) ? ' is-selected' : '';
    var basePath = options && typeof options.basePath === 'string'
      ? options.basePath
      : ((typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath)
        ? window.LoveBudPath.getBasePath()
        : (window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/'));
    var openHref = basePath + 'editor?treeId=' + encodeURIComponent(normalizedTree.id || '');

    var card = document.createElement('div');
    card.className = 'tree-card' + selectedClass;
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
        card.dataset.treeId = String(normalizedTree.id || '');
    card.dataset.visibility = normalizedTree.visibility;

    var handleCardSelect = function () {
      if (typeof onSelect === 'function') {
        onSelect(normalizedTree);
      }
    };

    card.addEventListener('click', function (e) {
      if (e.target.closest('.tree-card-open-link, .tree-card-footer a, button, a[href]')) {
        return;
      }
      if (window.innerWidth < 480) {
        window.location.href = openHref;
        return;
      }
      handleCardSelect();
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.innerWidth < 480) {
          window.location.href = openHref;
          return;
        }
        handleCardSelect();
      }
    });

    card.innerHTML = [
      buildTreeThumbVisual(normalizedTree, i18n),
      '<div class="tree-card-info">',
        '<div class="tree-card-title-row">',
          '<div class="tree-card-title">' + escapeHtml(title) + '</div>',
        '</div>',
        '<div class="tree-card-subcopy">' + cardMeta.mood + '</div>',
        cardMeta.privateBadgeHtml,
      '</div>',
      '<div class="tree-card-footer">',
        '<div class="tree-card-footer-left">',
          // Issue #1488 #1490: 조회수→좋아요 순서, 순간수 제거
          '<div class="tree-card-footer-metrics">',
            '<span class="tree-card-footer-metric" title="' + escapeHtml((i18n('myTrees.view_count') || '조회수') + ' ' + formatCompactCount(viewCount)) + '">',
              '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
              '<span>' + formatCompactCount(viewCount) + '</span>',
            '</span>',
            '<span class="tree-card-footer-metric" title="' + escapeHtml((i18n('myTrees.like_count') || '좋아요') + ' ' + formatCompactCount(likeCount)) + '">',
              '<span class="material-symbols-outlined" aria-hidden="true">favorite</span>',
              '<span>' + formatCompactCount(likeCount) + '</span>',
            '</span>',
          '</div>',
        '</div>',
        '<div class="tree-card-footer-right">',
          '<a class="tree-card-open-link" href="' + escapeHtml(openHref) + '" target="_self">',
            '<span class="material-symbols-outlined" aria-hidden="true">account_tree</span>',
            (i18n('myTrees.card_open') || '트리 열기'),
          '</a>',
        '</div>',
      '</div>'
    ].join('');

    var openLink = card.querySelector('.tree-card-open-link');
    if (openLink) {
      openLink.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    return card;
  }

  // Issue #616/#1120: first-batch rendering constants
  var FIRST_BATCH_SIZE = 4;
  var BATCH_SIZE = 6;
  var currentVisibleCount = 0;
  var totalTreesCount = 0;
  var allTreesData = [];
  var isLoadingMore = false;
  var scrollSentinel = null;

  function renderTrees(trees, options) {
    var hubOnSelect = options && options.onSelect;
    var hubOnNavigate = options && options.onNavigate;
    var container = document.getElementById('state-loaded');
    if (!container) return;

    var setState = options && options.setState;
    var stateEnum = options && options.stateEnum;
    var buildTreeCardFn = (options && options.buildTreeCard) || buildTreeCard;
    var updateManageSummaryFn = (options && options.updateManageSummary) || updateManageSummary;

    if (options && typeof options.setLastTreesData === 'function') {
      options.setLastTreesData(Array.isArray(trees) ? trees : []);
    }

    updateManageSummaryFn(trees, options);

    if (!trees || trees.length === 0) {
      if (typeof setState === 'function' && stateEnum && stateEnum.EMPTY) {
        setState(stateEnum.EMPTY);
      }
      return;
    }

    allTreesData = trees;
    totalTreesCount = trees.length;
    currentVisibleCount = 0;

    var grid = document.getElementById('trees-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'trees-grid';
      grid.id = 'trees-grid';
      container.appendChild(grid);
    }
    grid.innerHTML = '';

    renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, { onSelect: hubOnSelect, onNavigate: hubOnNavigate });
    setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, { onSelect: hubOnSelect, onNavigate: hubOnNavigate });

    if (typeof setState === 'function' && stateEnum && stateEnum.LOADED) {
      setState(stateEnum.LOADED);
    }
  }

  function renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    var startIndex = currentVisibleCount;
    var batchSize = startIndex === 0 ? FIRST_BATCH_SIZE : BATCH_SIZE;
    var endIndex = Math.min(startIndex + batchSize, totalTreesCount);
    
    var onSelect = extraOptions && extraOptions.onSelect;
    var onNavigate = extraOptions && extraOptions.onNavigate;
    
    for (var i = startIndex; i < endIndex; i++) {
      var tree = allTreesData[i];
      var card = buildTreeCardFn(tree, { onSelect: onSelect, onNavigate: onNavigate });
      if (!(card instanceof Node)) {
        console.warn('[my-trees-ui] buildTreeCard returned a non-Node value:', card, tree);
        continue;
      }
      card.style.opacity = '0';
      card.classList.add('tree-card-batch-pending');
      grid.appendChild(card);
      
      setTimeout(function(c) {
        c.style.transition = 'opacity 0.2s ease-in';
        c.style.opacity = '1';
        c.classList.remove('tree-card-batch-pending');
      }, 10, card);
    }
    
    currentVisibleCount = endIndex;
    
    var summary = document.getElementById('trees-manage-summary');
    if (summary) {
      var i18n = window.i18nMyTrees || {};
      var countText = (i18n.myTrees_count || '총 {count}개').replace('{count}', String(totalTreesCount));
      summary.textContent = countText;
    }
  }

  function setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    if (scrollSentinel) {
      scrollSentinel.remove();
    }
    
    if (currentVisibleCount >= totalTreesCount) {
      return;
    }
    
    scrollSentinel = document.createElement('div');
    scrollSentinel.id = 'trees-scroll-sentinel';
    scrollSentinel.style.height = '20px';
    scrollSentinel.style.gridColumn = '1 / -1';
    grid.appendChild(scrollSentinel);
    
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !isLoadingMore && currentVisibleCount < totalTreesCount) {
            loadMoreBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions);
          }
        });
      }, { rootMargin: '100px' });
      
      scrollSentinel._extraOptions = extraOptions;
      observer.observe(scrollSentinel);
      scrollSentinel._observer = observer;
    }
  }

  function loadMoreBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions) {
    if (isLoadingMore || currentVisibleCount >= totalTreesCount) {
      return;
    }
    
    isLoadingMore = true;
    
    if (scrollSentinel && scrollSentinel._observer) {
      scrollSentinel._observer.disconnect();
    }
    
    renderNextBatch(grid, buildTreeCardFn, setState, stateEnum, extraOptions);
    setupScrollContinuation(grid, buildTreeCardFn, setState, stateEnum, extraOptions);
    
    isLoadingMore = false;
  }

  function resetBatchState() {
    var grid = document.getElementById('trees-grid');
    if (grid) {
      grid.innerHTML = '';
    }
    currentVisibleCount = 0;
    allTreesData = [];
    totalTreesCount = 0;
    isLoadingMore = false;
  }

  var api = {
    escapeHtml: escapeHtml,
    buildMiniTreeSVG: buildMiniTreeSVG,
    getTreeMomentCount: getTreeMomentCount,
    getTreeViewCount: getTreeViewCount,
    getTreeLikeCount: getTreeLikeCount,
    buildTreeThumbVisual: buildTreeThumbVisual,
    updateManageSummary: updateManageSummary,
    buildTreeCard: buildTreeCard,
    renderTrees: renderTrees
  };

  window.LoveBudMyTreesUI = api;
  window.LoveTreeMyTreesUI = api;
})();
