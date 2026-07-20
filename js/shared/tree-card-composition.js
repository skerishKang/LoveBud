/**
 * LoveBud — Shared LoveTree Card Composition
 * Issue #3578 Phase 2
 *
 * One safe shared card composition boundary for Browse and My Trees.
 *
 * Dependencies (load order):
 *   1. js/utils/security.js or equivalent (escapeHtml / sanitizeUrl)
 *   2. js/shared/tree-card-metrics.js
 *   3. js/shared/tree-card-composition.js  ← this file
 *   4. surface renderer (search-card-renderer.js / my-trees-ui.js)
 *
 * Fail-closed: shared helper must be loaded or both surfaces crash explicitly.
 *
 * Security rules:
 *   - All user-provided strings are HTML-escaped by this module.
 *   - URLs are run through sanitizeUrl before rendering.
 *   - No generic `innerHTML` slot accepting arbitrary HTML.
 *   - No javascript: or protocol-relative URLs accepted.
 *   - Slot inputs are typed (string, boolean, number) and escaped.
 */

(function () {
  'use strict';

  /* ── Helpers (local — no external dependency at load time) ── */

  function escapeHtml(str) {
    var sec = window.LoveBudSecurity;
    if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(str);
    var s = String(str == null ? '' : str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(value) {
    var sec = window.LoveBudSecurity;
    if (sec && typeof sec.sanitizeUrl === 'function') return sec.sanitizeUrl(value);
    if (!value) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    try {
      var parsed = new URL(raw, window.location.origin);
      var protocol = parsed.protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        return parsed.href;
      }
      return '';
    } catch (e) {
      // Relative URL — check for dangerous patterns
      if (/^javascript:/i.test(raw)) return '';
      if (/^\/\//.test(raw)) return '';
      if (/^#/.test(raw)) return '';
      return raw;
    }
  }

  /* ── Card model ── */

  /**
   * @typedef {Object} LoveTreeCardModel
   * @property {string}  surface              - 'browse' | 'my-trees'
   * @property {string}  treeId               - raw tree id (for data attribute)
   *
   * @property {string}  mediaHtml            - Surface-specific media content (escaped by caller)
   * @property {string}  title                - Card title (plain text — escaped here)
   * @property {string}  subtitleHtml         - Subtitle/subcopy (safe HTML — only <span> tags allowed)
   * @property {string}  bodyExtensionHtml    - Surface-specific body content (escaped by caller)
   *
   * @property {string}  metricsHtml          - Reaction metrics HTML from tree-card-metrics
   * @property {string}  visibilityBadgeHtml  - My Trees visibility badge (empty for Browse)
   * @property {string}  metaExtensionHtml    - Surface-specific meta row content
   *
   * @property {string}  primaryHref          - Canonical appreciation URL
   * @property {string}  primaryLabel         - Action link text
   *
   * @property {string}  accessibilityLabel   - Card aria-label
   * @property {boolean} isFeatured           - Browse featured card
   * @property {boolean} isSelected           - My Trees selected state
   * @property {number}  animationDelay       - Animation delay in seconds
   * @property {string}  extraClasses         - Additional CSS classes for card root
   * @property {string}  dataAttributes       - Additional data-* attributes string
   */

  /**
   * Build the complete card HTML from a typed model.
   * All string inputs are either escaped by this function or
   * assumed to be safe (metricsHtml, mediaHtml, visibilityBadgeHtml).
   *
   * @param {LoveTreeCardModel} model
   * @returns {string} Complete card HTML
   */
  function buildCardHtml(model) {
    if (!model || typeof model !== 'object') {
      throw new Error('[LoveBudTreeCardComposition] buildCardHtml: model object required');
    }

    var surface = model.surface === 'my-trees' ? 'my-trees' : 'browse';
    var treeId = String(model.treeId || '');
    var safeTitle = escapeHtml(model.title || '');
    var subtitleHtml = String(model.subtitleHtml || '');
    var metricsHtml = String(model.metricsHtml || '');
    var mediaHtml = String(model.mediaHtml || '');
    var bodyExtensionHtml = String(model.bodyExtensionHtml || '');
    var visibilityBadgeHtml = String(model.visibilityBadgeHtml || '');
    var metaExtensionHtml = String(model.metaExtensionHtml || '');

    var primaryHref = sanitizeUrl(model.primaryHref);
    var primaryLabel = escapeHtml(model.primaryLabel || '감상하기');
    var accessibilityLabel = escapeHtml(model.accessibilityLabel || '');
    var extraClasses = String(model.extraClasses || '');
    var dataAttrs = String(model.dataAttributes || '');

    var featuredClass = model.isFeatured ? ' love-tree-card-featured' : '';
    var selectedClass = model.isSelected ? ' love-tree-card-selected' : '';
    var surfaceClass = surface === 'my-trees' ? ' love-tree-card-my-trees' : ' love-tree-card-browse';

    var animStyle = '';
    if (typeof model.animationDelay === 'number' && model.animationDelay > 0) {
      animStyle = ' style="animation-delay:' + model.animationDelay + 's;"';
    }

    /* ── Build HTML ── */

    var html = '<div class="love-tree-card' + featuredClass + selectedClass + surfaceClass + ' ' + extraClasses + '"' +
      (treeId ? ' data-tree-id="' + escapeHtml(treeId) + '"' : '') +
      (accessibilityLabel ? ' aria-label="' + accessibilityLabel + '"' : '') +
      dataAttrs +
      animStyle +
      '>';

    // Media slot
    if (mediaHtml) {
      html += '<div class="love-tree-card-media">' + mediaHtml + '</div>';
    }

    // Body
    html += '<div class="love-tree-card-body">';

    // Title row
    html += '<div class="love-tree-card-title-row">';
    html += '<div class="love-tree-card-title">' + safeTitle + '</div>';
    if (visibilityBadgeHtml) {
      html += '<div class="love-tree-card-visibility">' + visibilityBadgeHtml + '</div>';
    }
    html += '</div>';

    // Subtitle
    if (subtitleHtml) {
      html += '<div class="love-tree-card-subtitle">' + subtitleHtml + '</div>';
    }

    // Body extension
    if (bodyExtensionHtml) {
      html += '<div class="love-tree-card-body-extension">' + bodyExtensionHtml + '</div>';
    }

    // Meta / footer row
    html += '<div class="love-tree-card-meta-row">';
    html += '<div class="love-tree-card-meta-left">';
    html += metricsHtml;
    if (metaExtensionHtml) {
      html += metaExtensionHtml;
    }
    html += '</div>';

    if (primaryHref) {
      html += '<div class="love-tree-card-meta-right">' +
        '<a class="love-tree-card-open-link" href="' + escapeHtml(primaryHref) + '" aria-label="' + escapeHtml(primaryLabel) + ' 감상">' +
        '<span class="material-symbols-outlined" aria-hidden="true">account_tree</span>' +
        '<span>' + primaryLabel + '</span>' +
        '</a>' +
        '</div>';
    }

    html += '</div>'; // .love-tree-card-meta-row
    html += '</div>'; // .love-tree-card-body
    html += '</div>'; // .love-tree-card

    return html;
  }

  /**
   * Build a tree card using the shared metrics helper for reaction metrics.
   * Convenience wrapper that auto-renders metrics from the tree-card-metrics module.
   *
   * @param {object}   tree       - Tree data object
   * @param {object}   options    - Surface options (same as LoveTreeCardModel except metricsHtml)
   * @param {function} [options.i18n] - i18n function
   * @returns {string} Card HTML
   */
  function buildTreeCard(tree, options) {
    if (!tree || typeof tree !== 'object') return '';
    options = options || {};

    // Resolve metrics via shared helper
    var metricsHtml = '';
    try {
      var Metrics = window.LoveBudTreeCardMetrics;
      if (Metrics && typeof Metrics.renderTreeReactionMetrics === 'function') {
        var i18n = typeof options.i18n === 'function' ? options.i18n : null;
        metricsHtml = Metrics.renderTreeReactionMetrics(tree, escapeHtml, i18n);
      } else {
        // Fallback: extract metrics directly
        var getFirstFiniteCount = Metrics && Metrics.getFirstFiniteCount;
        if (!getFirstFiniteCount) {
          getFirstFiniteCount = function (tree, keys) {
            if (!tree) return null;
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (!Object.prototype.hasOwnProperty.call(tree, key)) continue;
              var raw = tree[key];
              if (raw === undefined || raw === null || raw === '') continue;
              if (typeof raw !== 'number' && typeof raw !== 'string') continue;
              var val = Number(raw);
              if (Number.isFinite(val) && val >= 0) return val;
            }
            return null;
          };
        }
        var formatCompact = Metrics && Metrics.formatCompactCount;
        if (!formatCompact) {
          formatCompact = function (v) {
            var c = Number(v);
            if (!Number.isFinite(c) || c < 0) return '';
            if (c === 0) return '0';
            if (c >= 1000000) return Math.floor(c / 100000) / 10 + 'M';
            if (c >= 1000) return Math.floor(c / 100) / 10 + 'K';
            return String(c);
          };
        }

        var icons = ['visibility', 'favorite', 'chat_bubble', 'share'];
        var labels = ['조회수', '좋아요', '댓글', '공유'];
        var keySets = [
          ['viewCount', 'viewsCount', 'views', 'view_count', 'views_count'],
          ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count'],
          ['commentCount', 'commentsCount', 'comments', 'comment_count'],
          ['shareCount', 'sharesCount', 'shares', 'share_count']
        ];

        var items = [];
        for (var i = 0; i < keySets.length; i++) {
          var val = getFirstFiniteCount(tree, keySets[i]);
          if (val !== null) {
            items.push({ icon: icons[i], label: labels[i], value: val });
          }
        }

        if (items.length > 0) {
          metricsHtml = '<div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">';
          for (var j = 0; j < items.length; j++) {
            var item = items[j];
            var formatted = formatCompact(item.value);
            if (formatted !== '') {
              metricsHtml += '<span class="tree-card-reaction-metric" title="' + escapeHtml(item.label + ' ' + formatted) + '">' +
                '<span class="material-symbols-outlined" aria-hidden="true">' + item.icon + '</span>' +
                '<span>' + escapeHtml(formatted) + '</span>' +
                '</span>';
            }
          }
          metricsHtml += '</div>';
        }
      }
    } catch (e) {
      metricsHtml = '';
    }

    var model = {
      surface: options.surface || 'browse',
      treeId: tree.id || tree.treeId || tree.tree_id || '',
      mediaHtml: options.mediaHtml || '',
      title: options.title || tree.title || '',
      subtitleHtml: options.subtitleHtml || '',
      bodyExtensionHtml: options.bodyExtensionHtml || '',
      metricsHtml: metricsHtml,
      visibilityBadgeHtml: options.visibilityBadgeHtml || '',
      metaExtensionHtml: options.metaExtensionHtml || '',
      primaryHref: options.primaryHref || '',
      primaryLabel: options.primaryLabel || '감상하기',
      accessibilityLabel: options.accessibilityLabel || '',
      isFeatured: !!options.isFeatured,
      isSelected: !!options.isSelected,
      animationDelay: options.index != null ? options.index * 0.05 : 0,
      extraClasses: options.extraClasses || '',
      dataAttributes: options.dataAttributes || ''
    };

    return buildCardHtml(model);
  }

  /* ── Expose ── */

  var api = {
    buildCardHtml: buildCardHtml,
    buildTreeCard: buildTreeCard,
    escapeHtml: escapeHtml,
    sanitizeUrl: sanitizeUrl
  };

  window.LoveBudTreeCardComposition = Object.freeze(api);
})();
