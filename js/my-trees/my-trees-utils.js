(function () {
  'use strict';

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashSeed(value) {
    var source = String(value || 'lovetree');
    var hash = 0;
    for (var i = 0; i < source.length; i++) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getTreeMomentCount(tree) {
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

  function getTreeViewCount(tree) {
    if (!tree) return 0;
    var keys = [
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

  function getTreeLikeCount(tree) {
    if (!tree) return 0;
    var keys = ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count'];
    for (var i = 0; i < keys.length; i++) {
      var value = Number(tree[keys[i]]);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
  }

  function clipText(value, maxLength) {
    var text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '\u2026';
  }

  function formatDate(dateValue) {
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

  function formatCompactCount(value) {
    var count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count >= 1000000) return (Math.floor(count / 100000) / 10) + 'M';
    if (count >= 1000) return (Math.floor(count / 100) / 10) + 'K';
    return String(count);
  }

  window.LoveBudMyTreesUtils = {
    escapeHtml: escapeHtml,
    hashSeed: hashSeed,
    getTreeMomentCount: getTreeMomentCount,
    getTreeViewCount: getTreeViewCount,
    getTreeLikeCount: getTreeLikeCount,
    clipText: clipText,
    formatDate: formatDate,
    formatCompactCount: formatCompactCount
  };
})();
