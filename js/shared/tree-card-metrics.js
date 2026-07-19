/**
 * LoveBud — Shared Tree Card Metric Helpers
 * Issue #3578 Phase 1
 *
 * Three-state metric semantics matching Browse:
 *   - finite 0         → render as '0'
 *   - finite positive → render as compact formatted count
 *   - null/undefined/absent/non-finite → omit (never coerce to 0)
 *
 * This module is the single source of truth for three-state metric semantics.
 * Both My Trees and Browse card renderers delegate metric rendering to it via
 * LoveBudTreeCardComposition (which calls renderTreeReactionMetrics), eliminating
 * the previous duplicated per-surface metric composers.
 * API/schema changes are not performed.
 */
(function () {
  'use strict';

  var VIEW_COUNT_KEYS = [
    'viewCount', 'viewsCount', 'views', 'view_count', 'views_count',
    'visitorCount', 'visitorsCount', 'visitCount', 'visitsCount', 'visits',
    'openCount', 'opensCount', 'open_count'
  ];

  /**
   * Resolve an authoritative non-negative finite count.
   * Missing / null / undefined / '' / NaN / negative → null (unknown).
   * Persisted zero (0) is returned as 0.
   */
  function getFirstFiniteCount(tree, keys) {
    if (!tree) return null;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(tree, key)) continue;
      var rawValue = tree[key];
      if (rawValue === undefined || rawValue === null || rawValue === '') continue;
      if (typeof rawValue !== 'number' && typeof rawValue !== 'string') continue;
      var value = Number(rawValue);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return null;
  }

  /**
   * Resolve view count using canonical field priority.
   * Returns null when absent/unknown (three-state).
   */
  function getViewCount(tree) {
    return getFirstFiniteCount(tree, VIEW_COUNT_KEYS);
  }

  /**
   * Format a count for compact display.
   * Non-finite / negative / null / undefined → '' (omit).
   * Zero → '0'.
   * Positive → compact string (1.2K, 3.4M, etc.).
   */
  function formatCompactCount(value) {
    var count = Number(value);
    if (!Number.isFinite(count) || count < 0) return '';
    if (count === 0) return '0';
    if (count >= 1000000) return (Math.floor(count / 100000) / 10) + 'M';
    if (count >= 1000) return (Math.floor(count / 100) / 10) + 'K';
    return String(count);
  }

  /**
   * Get all tree metrics as a plain object.
   * Keys with null/undefined values indicate absent metrics (omit in UI).
   */
  function getTreeMetrics(tree) {
    return {
      views: getFirstFiniteCount(tree, VIEW_COUNT_KEYS),
      likes: getFirstFiniteCount(tree, ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count']),
      comments: getFirstFiniteCount(tree, ['commentCount', 'commentsCount', 'comments', 'comment_count']),
      shares: getFirstFiniteCount(tree, ['shareCount', 'sharesCount', 'shares', 'share_count'])
    };
  }

  /**
   * Render reaction metrics as HTML string.
   * Only includes metrics that have an authoritative value (not null).
   * Order: views → likes → comments → shares.
   */
  function renderTreeReactionMetrics(tree, escapeHtmlFn, i18n) {
    var metrics = getTreeMetrics(tree);
    var items = [];

    if (metrics.views !== null) {
      items.push({
        icon: 'visibility',
        label: (i18n && i18n('myTrees.view_count', '조회수')) || '조회수',
        value: metrics.views
      });
    }
    if (metrics.likes !== null) {
      items.push({
        icon: 'favorite',
        label: (i18n && i18n('myTrees.like_count', '좋아요')) || '좋아요',
        value: metrics.likes
      });
    }
    if (metrics.comments !== null) {
      items.push({
        icon: 'chat_bubble',
        label: (i18n && i18n('myTrees.comment_count', '댓글')) || '댓글',
        value: metrics.comments
      });
    }
    if (metrics.shares !== null) {
      items.push({
        icon: 'share',
        label: (i18n && i18n('myTrees.share_count', '공유')) || '공유',
        value: metrics.shares
      });
    }

    if (items.length === 0) return '';

    var html = '<div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var formatted = formatCompactCount(item.value);
      if (formatted === '') continue;
      html += '<span class="tree-card-reaction-metric" title="' + escapeHtmlFn(item.label + ' ' + formatted) + '">' +
        '<span class="material-symbols-outlined" aria-hidden="true">' + item.icon + '</span>' +
        '<span>' + escapeHtmlFn(formatted) + '</span>' +
        '</span>';
    }
    html += '</div>';
    return html;
  }

  window.LoveBudTreeCardMetrics = Object.freeze({
    getFirstFiniteCount: getFirstFiniteCount,
    getViewCount: getViewCount,
    formatCompactCount: formatCompactCount,
    getTreeMetrics: getTreeMetrics,
    renderTreeReactionMetrics: renderTreeReactionMetrics,
    VIEW_COUNT_KEYS: VIEW_COUNT_KEYS
  });
})();