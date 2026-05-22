/**
 * LoveBud - My Trees UI Helpers
 * v20260523-1490-1
 *
 * Tree card rendering and summary UI utilities
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
    return Number(tree && (tree.memoryCount || (tree.memories && tree.memories.length))) || 0;
  }

  function formatCompactCount(value) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.formatCompactCount === 'function') {
      return Utils.formatCompactCount(value);
    }
    var count = Number(value || 0);
    if (!Number.isFinite(count) || count < 0) return '0';
    if (count >= 1000000) return (Math.floor(count / 100000) / 10) + 'M';
    if (count >= 1000) return (Math.floor(count / 100) / 10) + 'K';
    return String(count);
  }

  function getFirstFiniteCount(tree, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = Number(tree && tree[keys[i]]);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
  }

  function buildTreeCard(tree, opts) {
    opts = opts || {};
    var treeId = escapeHtml(String(tree.id || ''));
    var title = escapeHtml(String(tree.title || '러브트리'));
    var momentCount = getTreeMomentCount(tree);
    var isPublic = tree.isPublic !== false;
    var seed = hashSeed(tree.id || tree.title || 'tree');

    // 메트릭: 조회수 → 좋아요 (필터 탭 순서 일치, #1490)
    var viewCount = getFirstFiniteCount(tree, ['totalViewCount', 'viewCount', 'view_count', 'views']);
    var likeCount = getFirstFiniteCount(tree, ['likeCount', 'likesCount', 'likes', 'reactionCount']);

    var openLabel = (opts.i18n && opts.i18n.card_open) ? escapeHtml(opts.i18n.card_open) : '트리 열기';
    var visibilityLabel = isPublic
      ? ((opts.i18n && opts.i18n.public_label) ? escapeHtml(opts.i18n.public_label) : '공개')
      : ((opts.i18n && opts.i18n.private_label) ? escapeHtml(opts.i18n.private_label) : '비공개');

    var thumbnailHtml = buildTreeThumbnail(tree, seed);

    return [
      '<div class="tree-card" data-tree-id="' + treeId + '">',
      '  <div class="tree-card-thumbnail-wrap">',
      '    ' + thumbnailHtml,
      '    <span class="tree-card-moment-badge">',
      '      <span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span>',
      '      ' + escapeHtml(String(momentCount)),
      '    </span>',
      '  </div>',
      '  <div class="tree-card-info">',
      '    <div class="tree-card-title">' + title + '</div>',
      '    <div class="tree-card-footer">',
      '      <div class="tree-card-footer-metrics">',
      '        <span class="tree-card-metric" title="조회수">',
      '          <span class="material-symbols-outlined" aria-hidden="true">visibility</span>',
      '          <span>' + escapeHtml(formatCompactCount(viewCount)) + '</span>',
      '        </span>',
      '        <span class="tree-card-metric" title="좋아요">',
      '          <span class="material-symbols-outlined" aria-hidden="true">favorite</span>',
      '          <span>' + escapeHtml(formatCompactCount(likeCount)) + '</span>',
      '        </span>',
      '      </div>',
      '      <button class="tree-card-open-btn" data-open-tree="' + treeId + '" aria-label="' + openLabel + '">',
      '        <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>',
      '        ' + openLabel,
      '      </button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function buildTreeThumbnail(tree, seed) {
    var Utils = window.LoveBudMyTreesUtils;
    if (Utils && typeof Utils.buildTreeThumbnail === 'function') {
      return Utils.buildTreeThumbnail(tree, seed);
    }
    var thumbnailUrl = tree && (tree.representativeThumbnail || tree.thumbnail || '');
    if (thumbnailUrl) {
      return '<img src="' + escapeHtml(thumbnailUrl) + '" alt="' + escapeHtml(tree.title || '트리') + '" class="tree-card-thumbnail" loading="lazy">';
    }
    var colors = ['#e8c4ca','#c4d4e8','#c4e8c9','#e8ddc4','#d4c4e8'];
    var bg = colors[seed % colors.length];
    return '<div class="tree-card-thumbnail tree-card-thumbnail-fallback" style="background:' + bg + '" aria-hidden="true"><span class="material-symbols-outlined">account_tree</span></div>';
  }

  function buildSummaryPanel(trees) {
    var total = trees.length;
    var publicCount = trees.filter(function(t) { return t.isPublic !== false; }).length;
    var privateCount = total - publicCount;
    var totalMoments = trees.reduce(function(sum, t) { return sum + getTreeMomentCount(t); }, 0);

    return [
      '<div class="my-trees-summary">',
      '  <div class="summary-stat"><span class="summary-num">' + total + '</span><span class="summary-label">전체 트리</span></div>',
      '  <div class="summary-stat"><span class="summary-num">' + publicCount + '</span><span class="summary-label">공개</span></div>',
      '  <div class="summary-stat"><span class="summary-num">' + privateCount + '</span><span class="summary-label">비공개</span></div>',
      '  <div class="summary-stat"><span class="summary-num">' + totalMoments + '</span><span class="summary-label">총 순간</span></div>',
      '</div>'
    ].join('\n');
  }

  window.LoveBudMyTreesUI = {
    buildTreeCard: buildTreeCard,
    buildTreeThumbnail: buildTreeThumbnail,
    buildSummaryPanel: buildSummaryPanel,
    escapeHtml: escapeHtml,
    formatCompactCount: formatCompactCount
  };

})();
