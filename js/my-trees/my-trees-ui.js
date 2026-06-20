/**
 * LoveBud - My Trees UI Helpers
 * v20260523-1488-1
 *
 * Tree card rendering and summary UI utilities
 * Issue #1488: 나의트리 카드 메트릭을 좋아요 + 조회수로 둘러보기와 통일
 */

(function () {
  if (window.LoveBudMyTreesUI) return;

  var _manageSummary = window.LoveBudMyTreesManageSummary || null;

  /**
   * i18n fallback helper.
   * Treats missing, empty, or key-echo results as a failed lookup
   * and returns the Korean fallback instead.
   * Prevents raw keys like "myTrees.card_edit" from leaking into UI.
   */
  function getI18nText(i18n, key, fallback) {
    var value = typeof i18n === 'function' ? i18n(key) : '';
    if (!value || value === key || String(value).toLowerCase() === String(key).toLowerCase()) {
      return fallback;
    }
    return value;
  }

  function escapeHtml(str) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.escapeHtml === 'function') return Utils.escapeHtml(str);
    return str == null ? '' : String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hashSeed(value) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.hashSeed === 'function') return Utils.hashSeed(value);
    return 0;
  }

  function getTreeMomentCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeMomentCount === 'function') return Utils.getTreeMomentCount(tree);
    return tree ? Number(tree.memoryCount ?? tree.memory_count ?? tree.nodeCount ?? tree.node_count ?? 0) : 0;
  }

  // Issue #1488: totalViewCount 우선 fallback
  function getTreeViewCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeViewCount === 'function') return Utils.getTreeViewCount(tree);
    return tree ? Number(tree.totalViewCount || tree.viewCount || 0) : 0;
  }

  // Issue #1488: 좋아요 수 읽기
  function getTreeLikeCount(tree) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.getTreeLikeCount === 'function') return Utils.getTreeLikeCount(tree);
    return tree ? Number(tree.likeCount || tree.likes || 0) : 0;
  }

  function formatCompactCount(value) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.formatCompactCount === 'function') return Utils.formatCompactCount(value);
    var count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count >= 1000000) return (Math.floor(count / 100000) / 10) + 'M';
    if (count >= 1000) return (Math.floor(count / 100) / 10) + 'K';
    return String(count);
  }

  function getVisibilityActionLabel(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getVisibilityActionLabel === 'function') return Visuals.getVisibilityActionLabel(tree, i18n);
    return tree && tree.visibility === 'public'
      ? getI18nText(i18n, 'visibility_make_private', '비공개로 전환')
      : getI18nText(i18n, 'visibility_make_public', '공개로 전환');
  }

  function getTreeCardMeta(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    if (Visuals && typeof Visuals.getTreeCardMeta === 'function') return Visuals.getTreeCardMeta(tree, i18n);
    var visibility = tree && tree.visibility === 'public' ? 'public' : 'private';
    var visibilityLabel = visibility === 'public'
      ? getI18nText(i18n, 'myTrees.summary_public', '공개')
      : getI18nText(i18n, 'myTrees.summary_private', '비공개');
    return {
      visibilityIcon: visibility === 'public' ? 'lock' : 'public',
      visibilityActionLabel: getVisibilityActionLabel(tree, i18n),
      title: tree && tree.title,
      mood: getTreeMomentCount(tree) > 0
        ? getI18nText(i18n, 'myTrees.card_growing', '차곡차곡 자라는 중')
        : getI18nText(i18n, 'myTrees.card_waiting', '첫 순간을 기다리는 중'),
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
    if (Utils && typeof Utils.clipText === 'function') return Utils.clipText(value, maxLength);
    var text = String(value || '').trim();
    return text.length <= maxLength ? text : text.slice(0, maxLength).trim() + '\u2026';
  }

  function formatDate(dateValue) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.formatDate === 'function') return Utils.formatDate(dateValue);
    if (!dateValue) return '';
    try {
      var d = new Date(dateValue);
      return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
      title: repTitle || getI18nText(i18n, 'editor_default_first_title', '첫 순간'),
      memo: repMemo || getI18nText(i18n, 'myTrees.card_text_fallback', '처음 남긴 마음이 이 트리의 시작이 되었어요.')
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
      '<div class="tree-card-text-kicker" style="color:' + palette.accent + ';">' + escapeHtml(getI18nText(i18n, 'myTrees.card_first_moment', '첫 순간 기록')) + '</div>' +
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
    var title = (tree && tree.title) || getI18nText(i18n, 'default_tree_title', '나의 러브트리');
    var initial = escapeHtml(title.charAt(0).toUpperCase());
    var moodLabel = momentCount > 1
      ? getI18nText(i18n, 'myTrees.card_growing', '차곡차곡 자라는 중')
      : getI18nText(i18n, 'myTrees.card_waiting', '첫 순간을 기다리는 중');
    var thumbnail = getRepresentativeThumbnail(tree);

    var isEnglish = String(window.i18n?.currentLang || '').toLowerCase().startsWith('en');
    var pill1 = isEnglish ? 'First Moment' : '첫 순간';
    var pill2 = isEnglish ? 'Memory Note' : '마음 메모';
    var pill3 = isEnglish ? 'Favorite Scene' : '다시 보고 싶은 장면';

    var fallbackSvg = '';
    if (Visuals && typeof Visuals.buildPremiumFallbackSVG === 'function') {
      fallbackSvg = Visuals.buildPremiumFallbackSVG(tree, palette);
    } else {
      fallbackSvg = buildMiniTreeSVG(tree);
    }

    var fallbackHtml = '<div class="tree-card-media-fallback" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; padding: 16px; box-sizing: border-box;">' +
      '<div class="fallback-svg-container">' +
      fallbackSvg +
      '</div>' +
      '<div class="fallback-pills">' +
      '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill1 + '</span>' +
      '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill2 + '</span>' +
      '<span class="fallback-pill" style="color: ' + palette.accent + ';">' + pill3 + '</span>' +
      '</div>' +
      '<div class="fallback-title" style="display:none !important;"></div>' +
      '</div>';

    return '<div class="tree-card-thumb" style="background:' + palette.background + ';">' +
      '<div class="tree-card-thumb-glow" style="background:' + palette.leafSoft + ';"></div>' +
      '<div class="tree-card-thumb-initial" style="color:' + palette.accent + ';border-color:' + palette.leafSoft + ';">' + initial + '</div>' +
      '<div class="tree-card-thumb-art">' +
      (thumbnail ? '<img class="tree-card-thumb-image" src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(title) + '">' : fallbackHtml) +
      '</div>' +
      (momentCount > 0 ? '<div class="tree-card-thumb-topline"><span class="tree-card-moment-badge" data-count="' + momentCount + '">' + getI18nText(i18n, 'myTrees.moment_count_compact', '순간 {count}개').replace('{count}', String(momentCount)) + '</span></div>' : '') +
      (momentCount > 0 ? '<div class="tree-card-thumb-caption">' + moodLabel + '</div>' : '') +
      '</div>';
  }

  function updateManageSummary(trees, options) {
    if (_manageSummary && typeof _manageSummary.updateManageSummary === 'function') {
      return _manageSummary.updateManageSummary(trees, options);
    }
    return trees || [];
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
        visibility: (tree && tree.visibility) || '',
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
    var isPublicTree = (normalizedTree.visibility === 'public');
    var viewHref = isPublicTree
      ? (basePath + 'view.html?treeId=' + encodeURIComponent(normalizedTree.id || '') + '&from=my-trees')
      : (basePath + 'editor?treeId=' + encodeURIComponent(normalizedTree.id || '') + '&from=my-trees');
    var editHref = basePath + 'editor?treeId=' + encodeURIComponent(normalizedTree.id || '') + '&from=my-trees';

    var card = document.createElement('div');
    card.className = 'tree-card' + selectedClass;
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.dataset.treeId = String(normalizedTree.id || '');
    card.dataset.visibility = normalizedTree.visibility;
    if (selectedClass) {
      card.setAttribute('data-selected-tree-card', 'true');
    }

    var handleCardSelect = function () {
      if (typeof onSelect === 'function') {
        onSelect(normalizedTree);
      }
    };

    card.addEventListener('click', function (e) {
      if (e.target.closest('.tree-card-open-link, .tree-card-edit-link, .tree-card-footer a, button, a[href]')) {
        return;
      }
      if (window.innerWidth < 480) {
        window.location.href = viewHref;
        return;
      }
      handleCardSelect();
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.innerWidth < 480) {
          window.location.href = viewHref;
          return;
        }
        handleCardSelect();
      }
    });

    // i18n-safe labels via getI18nText helper
    var viewLabel = getI18nText(i18n, 'myTrees.card_view', '감상하기');
    var editLabel = getI18nText(i18n, 'myTrees.card_edit', '편집하기');
    var viewCountLabel = getI18nText(i18n, 'myTrees.view_count', '조회수');
    var likeCountLabel = getI18nText(i18n, 'myTrees.like_count', '좋아요');

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
            '<span class="tree-card-footer-metric" title="' + escapeHtml(viewCountLabel + ' ' + formatCompactCount(viewCount)) + '">',
              '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
              '<span>' + formatCompactCount(viewCount) + '</span>',
            '</span>',
            '<span class="tree-card-footer-metric" title="' + escapeHtml(likeCountLabel + ' ' + formatCompactCount(likeCount)) + '">',
              '<span class="material-symbols-outlined" aria-hidden="true">favorite</span>',
              '<span>' + formatCompactCount(likeCount) + '</span>',
            '</span>',
          '</div>',
        '</div>',
        '<div class="tree-card-footer-right">',
          '<a class="tree-card-open-link" href="' + escapeHtml(viewHref) + '" target="_self">',
            '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
            viewLabel,
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
    var editLink = card.querySelector('.tree-card-edit-link');
    if (editLink) {
      editLink.addEventListener('click', function (e) {
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
    getI18nText: getI18nText,
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
