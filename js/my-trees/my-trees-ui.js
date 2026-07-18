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
     * Extract the first usable input tree ID from the allowlist order.
     * Mirrors the resolver's id resolution so validated output can be
     * checked against the exact input the user clicked.
     */
    function getInputTreeId(tree) {
      if (!tree || typeof tree !== 'object') return null;
      var keys = ['id', 'treeId', 'tree_id'];
      for (var i = 0; i < keys.length; i++) {
        var raw = tree[keys[i]];
        if (typeof raw === 'string') {
          var trimmed = raw.replace(/^\s+|\s+$/g, '');
          if (trimmed) return trimmed;
        }
      }
      return null;
    }

    /**
     * Expected accessState derived purely from the input visibility.
     * Case-sensitive canonical only — no coercion.
     */
    function getExpectedAccessState(visibility) {
      if (visibility === 'public') return 'public';
      if (visibility === 'private') return 'private';
      return 'unknown';
    }

    /**
     * Strict canonical entry-target validator.
     * Returns the raw target href only when every canonical field matches
     * exactly, including the precise expected href string. Rejects any
     * scheme, fragment, extra query, mode param, or mismatched tree id.
     * Returns null on any deviation (fail-closed for that target).
     */
    function validateEntryTarget(target, expectedAction, expectedInteractionMode, expectedRouteSurface, expectedHref) {
      if (!target || typeof target !== 'object') return null;
      if (target.available !== true) return null;
      if (typeof target.href !== 'string' || !target.href) return null;
      if (target.action !== expectedAction) return null;
      if (target.interactionMode !== expectedInteractionMode) return null;
      if (target.routeSurface !== expectedRouteSurface) return null;
      // Reject dangerous schemes / fragments / protocol-relative before exact match.
      if (target.href.indexOf('://') !== -1) return null;
      if (target.href.indexOf('//') === 0) return null;
      if (target.href.indexOf('javascript:') === 0) return null;
      if (target.href.indexOf('#') === 0) return null;
      // Exact canonical href — no mode param, no extra query, no fragment,
      // no other tree id, no other relative route.
      if (expectedHref !== null && target.href !== expectedHref) return null;
      return target.href;
    }

    function resolveSafeBasePath() {
      if (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath) {
        var bp = window.LoveBudPath.getBasePath();
        if (bp === '' || bp === 'pages/') return bp;
      }
      return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    /**
     * Resolve and strictly validate the owned-tree entry targets.
     *
     * Fail-closed rules:
     *  - resolver missing / throws / non-object → all targets null
     *  - no valid input tree id → all targets null
     *  - targets.treeId !== input id → bundle fail closed (all null)
     *  - targets.accessState !== expected (from visibility) → bundle fail closed
     *  - private/unknown input but publicView.available === true → bundle fail closed
     *  - per-target malformed href/metadata → that target null only
     *
     * Only the validated canonical href receives a safe base path ('' or 'pages/').
     */
    function validateAndResolveEntryTargets(tree) {
      var inputId = getInputTreeId(tree);
      var expectedAccessState = getExpectedAccessState(tree ? tree.visibility : null);

      var targets = null;
      try {
        if (window.LoveBudMyTreesEntryTargetResolver && typeof window.LoveBudMyTreesEntryTargetResolver.resolveMyTreesEntryTargets === 'function') {
          targets = window.LoveBudMyTreesEntryTargetResolver.resolveMyTreesEntryTargets(tree);
        }
      } catch (e) {
        targets = null;
      }

      // publicView/shareTarget are internal share-compat hrefs only (#3563).
      var nullBundle = {
        treeId: null,
        accessState: 'unknown',
        primary: null,
        publicView: null,
        shareTarget: null,
        edit: null
      };

      if (!targets || typeof targets !== 'object') return nullBundle;
      if (!inputId) return nullBundle;
      if (targets.treeId !== inputId) return nullBundle;
      if (targets.accessState !== expectedAccessState) return nullBundle;

      var basePath = resolveSafeBasePath();
      var encId = encodeURIComponent(inputId);
      var primaryHref = 'editor?treeId=' + encId;
      var editHref = 'editor?treeId=' + encId + '&mode=edit';
      var publicHref = 'view.html?treeId=' + encId;

      function build(target, action, mode, surface, expectedHref) {
        var href = validateEntryTarget(target, action, mode, surface, expectedHref);
        return href !== null ? basePath + href : null;
      }

      var primary = build(targets.primary, 'appreciation', 'appreciation', 'editor', primaryHref);
      var edit = build(targets.edit, 'edit', 'edit', 'editor', editHref);

      // Internal share/compatibility target only — never rendered as a third action.
      var shareSource = targets.shareTarget || targets.publicView;
      var shareTarget = null;
      if (expectedAccessState === 'public') {
        shareTarget = build(shareSource, 'public-view', 'none', 'public-viewer', publicHref);
      } else {
        // private/unknown: public share target must stay unavailable.
        if (shareSource && shareSource.available === true) {
          return nullBundle;
        }
        shareTarget = null;
      }

      // Bundle-level fail-closed: required interaction targets are primary+edit.
      // Public trees must still resolve a valid shareTarget for share-link copy.
      if (primary === null || edit === null) return nullBundle;
      if (expectedAccessState === 'public' && shareTarget === null) return nullBundle;

      return {
        treeId: inputId,
        accessState: expectedAccessState,
        primary: primary,
        // Keep publicView key as alias for existing share consumers.
        publicView: shareTarget,
        shareTarget: shareTarget,
        edit: edit
      };
    }

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

  function normalizeCardVisibility(tree) {
    return tree && tree.visibility === 'public' ? 'public' : 'private';
  }

  function buildVisibilityBadgeHtml(visibility, i18n) {
    var visibilityLabel = visibility === 'public'
      ? getI18nText(i18n, 'myTrees.summary_public', '공개')
      : getI18nText(i18n, 'myTrees.summary_private', '비공개');
    var visibilityIcon = visibility === 'public' ? 'public' : 'lock';
    // #3587: demote to quiet icon-only indicator. No visible text label,
    // transparent background, no border/pill. aria-label + title preserved.
    return '<span class="tree-card-visibility ' + visibility + '" aria-label="' + visibilityLabel + '" title="' + visibilityLabel + '" data-visibility="' + visibility + '">' +
      '<span class="material-symbols-outlined" aria-hidden="true">' + visibilityIcon + '</span>' +
      '</span>';
  }

  function getTreeCardMeta(tree, i18n) {
    var Visuals = window.LoveBudMyTreesCardVisuals;
    var delegatedMeta = (Visuals && typeof Visuals.getTreeCardMeta === 'function')
      ? Visuals.getTreeCardMeta(tree, i18n)
      : null;
    var visibility = normalizeCardVisibility(tree);
    var meta = (delegatedMeta && typeof delegatedMeta === 'object')
      ? Object.assign({}, delegatedMeta)
      : {};
    meta.visibilityBadgeHtml = buildVisibilityBadgeHtml(visibility, i18n);
    meta.title = meta.title || (tree && tree.title);
    meta.mood = meta.mood || (function () {
      // #2880: Show group name + keywords on card subcopy when available,
      // fall back to growth status text.
      var groupName = tree && (tree.groupName || tree.group_name || tree.group);
      var keywords = tree && (Array.isArray(tree.keywords) ? tree.keywords : []);
      if (groupName) {
        var subcopy = escapeHtml(groupName);
        if (keywords.length > 0) {
          subcopy += ' <span class="tree-card-keywords">' +
            keywords.map(function (kw) { return '<span class="tree-card-keyword">#' + escapeHtml(kw) + '</span>'; }).join(' ') +
            '</span>';
        }
        return subcopy;
      }
      return getTreeMomentCount(tree) > 0
        ? getI18nText(i18n, 'myTrees.card_growing', '차곡차곡 자라는 중')
        : getI18nText(i18n, 'myTrees.card_waiting', '첫 순간을 기다리는 중');
    })();
    return meta;
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

    return '<div class="tree-card-text-visual" style="--tree-card-text-border:' + palette.leafSoft + ';--tree-card-text-accent:' + palette.accent + ';">' +
      '<div class="tree-card-text-kicker">' + escapeHtml(getI18nText(i18n, 'myTrees.card_first_moment', '첫 순간 기록')) + '</div>' +
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
        visibility: tree && tree.visibility === 'public' ? 'public' : 'private',
        updatedAt: (tree && (tree.updatedAt || tree.createdAt)) || null,
        memoryCount: getTreeMomentCount(tree),
        representativeThumbnail: getRepresentativeThumbnail(tree),
        representativeTitle: tree && (tree.representativeTitle || tree.representative_title || ''),
        representativeMemo: tree && (tree.representativeMemo || tree.representative_memo || '')
      };
    } else {
      normalizedTree.visibility = normalizedTree.visibility === 'public' ? 'public' : 'private';
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

    var selectedClass = typeof isSelected === 'function' && isSelected(normalizedTree.id) ? ' is-selected is-active' : '';
    var resolved = validateAndResolveEntryTargets(normalizedTree);
    var openHref = resolved.primary;
    // #3563: public shareTarget is internal only — never a third card action.
    var editHref = resolved.edit;

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
      if (e.target.closest('.tree-card-open-link, .tree-card-edit-link, button, a[href]')) {
        return;
      }
      if (window.innerWidth < 480) {
        if (openHref) {
          window.location.href = openHref;
        }
        return;
      }
      handleCardSelect();
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.innerWidth < 480) {
          if (openHref) {
            window.location.href = openHref;
          }
          return;
        }
        handleCardSelect();
      }
    });

    // i18n-safe labels via getI18nText helper (#3563: appreciation + edit only)
    var openLabel = getI18nText(i18n, 'myTrees.entry_appreciation', '감상하기');
    var editLabel = getI18nText(i18n, 'myTrees.entry_edit', '편집하기');
    var viewCountLabel = getI18nText(i18n, 'myTrees.view_count', '조회수');
    var likeCountLabel = getI18nText(i18n, 'myTrees.like_count', '좋아요');
    var commentCountLabel = getI18nText(i18n, 'myTrees.comment_count', '댓글');
    var commentCount = Number(normalizedTree.commentCount || normalizedTree.comment_count || 0);
    var shareCountLabel = getI18nText(i18n, 'myTrees.share_count', '공유');
    var shareCount = Number(normalizedTree.shareCount || normalizedTree.share_count || 0);

    card.innerHTML = [
      buildTreeThumbVisual(normalizedTree, i18n),
      '<div class="tree-card-body">',
        '<div class="tree-card-title-row">',
          '<div class="tree-card-title">' + escapeHtml(title) + '</div>',
          cardMeta.visibilityBadgeHtml,
        '</div>',
        '<div class="tree-card-subcopy">' + cardMeta.mood + '</div>',
        '<div class="tree-meta-row">',
          '<div class="tree-meta-left">',
            // Issue #1488 #1490: 조회수→좋아요 순서, 순간수 제거
            '<div class="tree-card-reaction-metrics">',
              '<span class="tree-card-reaction-metric" title="' + escapeHtml(viewCountLabel + ' ' + formatCompactCount(viewCount)) + '">',
                '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
                '<span>' + formatCompactCount(viewCount) + '</span>',
              '</span>',
              '<span class="tree-card-reaction-metric" title="' + escapeHtml(likeCountLabel + ' ' + formatCompactCount(likeCount)) + '">',
                '<span class="material-symbols-outlined" aria-hidden="true">favorite</span>',
                '<span>' + formatCompactCount(likeCount) + '</span>',
              '</span>',
              '<span class="tree-card-reaction-metric" title="' + escapeHtml(commentCountLabel + ' ' + formatCompactCount(commentCount)) + '">',
                '<span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span>',
                '<span>' + formatCompactCount(commentCount) + '</span>',
              '</span>',
              '<span class="tree-card-reaction-metric" title="' + escapeHtml(shareCountLabel + ' ' + formatCompactCount(shareCount)) + '">',
                '<span class="material-symbols-outlined" aria-hidden="true">share</span>',
                '<span>' + formatCompactCount(shareCount) + '</span>',
              '</span>',
            '</div>',
          '</div>',
          '<div class="tree-meta-right">',
            (openHref ? '<a class="tree-card-open-link" href="' + escapeHtml(openHref) + '" target="_self"><span class="material-symbols-outlined" aria-hidden="true">account_tree</span><span data-i18n="myTrees.entry_appreciation">' + escapeHtml(openLabel) + '</span></a>' : ''),
            (editHref ? '<a class="tree-card-edit-link" href="' + escapeHtml(editHref) + '" target="_self"><span class="material-symbols-outlined" aria-hidden="true">edit</span><span data-i18n="myTrees.entry_edit">' + escapeHtml(editLabel) + '</span></a>' : ''),
          '</div>',
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
    getTreeCardMeta: getTreeCardMeta,
    buildMiniTreeSVG: buildMiniTreeSVG,
    getTreeMomentCount: getTreeMomentCount,
    getTreeViewCount: getTreeViewCount,
    getTreeLikeCount: getTreeLikeCount,
    buildTreeThumbVisual: buildTreeThumbVisual,
    updateManageSummary: updateManageSummary,
    buildTreeCard: buildTreeCard,
    renderTrees: renderTrees,
    validateEntryTarget: validateEntryTarget,
    resolveSafeBasePath: resolveSafeBasePath,
    validateAndResolveEntryTargets: validateAndResolveEntryTargets
  };

  window.LoveBudMyTreesUI = api;
  window.LoveTreeMyTreesUI = api;
})();
