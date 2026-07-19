/**
 * LoveBud — Shared LoveTree Card Composition
 * Issue #3578 Phase 2
 *
 * Boundary (per Phase 2 architecture decision C):
 *   - shared pure view-model  → composeTreeCardModel
 *   - shared body/footer HTML → renderTreeCardBody / renderTreeMetricFooter
 *   - surface-owned outer/media/activation adapter (Browse / My Trees renderers)
 *
 * Principles (no DOM access, no navigation, no event listeners, no API calls,
 * no input mutation, deterministic, detached plain object, no raw user HTML):
 *   - composeTreeCardModel: builds a canonical model from a tree + options.
 *   - renderTreeCardBody: renders the shared inner content (title / description /
 *     footer / metrics / primary slot / optional visibility slot).
 *   - renderTreeMetricFooter: delegates to the shared metric helper so both
 *     surfaces render identical metric HTML.
 *
 * This module does NOT own the outer card wrapper, media slot, or click/
 * keyboard/mobile activation — those remain in each surface renderer.
 */
(function () {
  'use strict';

  var Metrics = window.LoveBudTreeCardMetrics || null;

  var SURFACE_LABEL_DEFAULTS = {
    browse: {
      view_count: '조회수',
      like_count: '좋아요',
      comment_count: '댓글',
      share_count: '공유',
      open: '트리 열기',
      appreciation: '감상하기',
      public: '공개',
      private: '비공개'
    },
    'my-trees': {
      view_count: '조회수',
      like_count: '좋아요',
      comment_count: '댓글',
      share_count: '공유',
      open: '트리 열기',
      appreciation: '감상하기',
      public: '공개',
      private: '비공개'
    }
  };

  function resolveLabel(labels, surface, key, fallback) {
    if (labels && typeof labels === 'object' && labels[key] != null) return String(labels[key]);
    var def = SURFACE_LABEL_DEFAULTS[surface] || SURFACE_LABEL_DEFAULTS['my-trees'];
    if (def && def[key] != null) return def[key];
    return fallback;
  }

  /**
   * Build the canonical card model.
   * Does not retain the original tree object — only the fields needed for the
   * shared body/footer are projected.
   *
   * @param {object} tree - raw tree record (fields read defensively)
   * @param {object} options
   *   surface: 'browse' | 'my-trees'
   *   href: string | null  (primary appreciation/viewer href)
   *   selected: boolean
   *   visibilityMode: 'omit' | 'icon'
   *   labels: object (i18n overrides)
   *   title: string (already-resolved display title)
   *   description: string (already-resolved subcopy)
   *   metrics: object {views, likes, comments, shares} (raw counts; null = unknown)
   * @returns {object} detached plain model
   */
  function composeTreeCardModel(tree, options) {
    options = options || {};
    var surface = options.surface === 'browse' ? 'browse' : 'my-trees';
    var treeId = tree && (tree.id != null) ? String(tree.id) : '';
    var title = options.title != null ? String(options.title) : '';
    var description = options.description != null ? String(options.description) : '';
    var href = options.href != null ? String(options.href) : null;
    var selected = Boolean(options.selected);
    var visibilityMode = options.visibilityMode === 'omit' ? 'omit' : 'icon';

    var labels = options.labels || null;

    // Visibility projection (state resolved by surface before calling).
    var visibilityState = 'private';
    if (tree) {
      var v = tree.visibility;
      if (v === 'public' || (typeof options.visibility === 'string' && options.visibility === 'public')) {
        visibilityState = 'public';
      }
    }
    if (typeof options.visibility === 'string') {
      visibilityState = options.visibility === 'public' ? 'public' : 'private';
    }

    var visibility = {
      mode: visibilityMode,
      state: visibilityState,
      icon: visibilityState === 'public' ? 'public' : 'lock',
      label: resolveLabel(labels, surface, visibilityState, visibilityState === 'public' ? '공개' : '비공개')
    };

    // Metric projection via shared helper (three-state).
    var rawMetrics = options.metrics || (Metrics ? Metrics.getTreeMetrics(tree || {}) : {});
    var metricList = [];
    if (rawMetrics) {
      var order = ['views', 'likes', 'comments', 'shares'];
      var icons = { views: 'visibility', likes: 'favorite', comments: 'chat_bubble', shares: 'share' };
      var labelKeys = { views: 'view_count', likes: 'like_count', comments: 'comment_count', shares: 'share_count' };
      for (var i = 0; i < order.length; i++) {
        var key = order[i];
        var val = rawMetrics[key];
        if (val === null || val === undefined) continue;
        metricList.push({
          key: key,
          icon: icons[key],
          value: val,
          formattedValue: Metrics ? Metrics.formatCompactCount(val) : String(val),
          label: resolveLabel(labels, surface, labelKeys[key], key)
        });
      }
    }

    return {
      surface: surface,
      treeId: treeId,
      title: title,
      description: description,
      href: href,
      selected: selected,
      visibility: visibility,
      metrics: metricList
    };
  }

  /**
   * Render the shared card body (inner content only — no outer wrapper).
   * Surfaces wrap this output in their own outer card + media slot.
   *
   * Common structure produced:
   *   .love-tree-card-content (.tree-card-body legacy)
   *     .love-tree-card-title-row (.tree-card-title-row / .tree-title-row legacy)
   *       .love-tree-card-title (.tree-card-title / .tree-title legacy)
   *       [optional] .love-tree-card-visibility (.tree-card-visibility legacy)
   *     .love-tree-card-description (.tree-card-subcopy / .tree-subtitle legacy)
   *     .love-tree-card-footer (.tree-meta-row legacy)
   *       .love-tree-card-metrics (.tree-card-reaction-metrics legacy)
   *       .love-tree-card-primary-slot (.tree-meta-right legacy)
   *         [optional] .tree-card-open-link
   */
  function renderTreeCardBody(model, options) {
    options = options || {};
    var escapeHtmlFn = options.escapeHtml || function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var labels = options.labels || null;
    var surface = model.surface;

    var titleHtml = '<div class="love-tree-card-title-row tree-card-title-row tree-title-row">' +
      '<div class="love-tree-card-title tree-card-title tree-title">' + escapeHtmlFn(model.title) + '</div>';

    // Optional visibility slot.
    if (model.visibility && model.visibility.mode === 'icon') {
      var v = model.visibility;
      titleHtml += '<span class="love-tree-card-visibility tree-card-visibility ' + (v.state === 'public' ? 'public' : 'private') +
        '" title="' + escapeHtmlFn(v.label) + '" aria-label="' + escapeHtmlFn(v.label) + '">' +
        '<span class="material-symbols-outlined" aria-hidden="true">' + escapeHtmlFn(v.icon) + '</span>' +
        '</span>';
    }
    titleHtml += '</div>';

    var descriptionHtml = '<div class="love-tree-card-description tree-card-subcopy tree-subtitle">' +
      escapeHtmlFn(model.description) + '</div>';

    var metricsHtml = renderTreeMetricFooter(model.metrics, options);

    // Primary appreciation/viewer link slot.
    var primarySlot = '';
    if (model.href) {
      var primaryLabel = resolveLabel(labels, surface, 'open', '트리 열기');
      if (surface === 'my-trees') {
        primaryLabel = resolveLabel(labels, surface, 'appreciation', '감상하기');
      }
      primarySlot = '<a class="love-tree-card-primary-slot tree-card-open-link" href="' + escapeHtmlFn(model.href) +
        '" target="_self"><span class="material-symbols-outlined" aria-hidden="true">account_tree</span>' +
        '<span>' + escapeHtmlFn(primaryLabel) + '</span></a>';
    }

    var footerHtml = '<div class="love-tree-card-footer tree-meta-row">' +
      '<div class="love-tree-card-metrics tree-card-reaction-metrics-anchor tree-meta-left">' + metricsHtml + '</div>' +
      '<div class="love-tree-card-primary-slot-anchor tree-meta-right">' + primarySlot + '</div>' +
      '</div>';

    return '<div class="love-tree-card-content tree-card-body">' +
      titleHtml +
      descriptionHtml +
      footerHtml +
      '</div>';
  }

  /**
   * Render the metric footer HTML.
   * Delegates to the shared metric helper so Browse and My Trees emit identical
   * metric markup. Accepts either the composed metric list or raw metrics.
   */
  function renderTreeMetricFooter(metrics, options) {
    options = options || {};
    if (!Metrics) {
      // Fail-closed: no silent partial card. Surface renderers must load the helper.
      throw new Error('[LoveBudTreeCardComposition] LoveBudTreeCardMetrics helper is required but not loaded.');
    }
    var escapeHtmlFn = options.escapeHtml || function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var i18n = options.i18n || null;

    // If a composed metric list was passed, rebuild the inner spans directly so
    // the markup matches the shared helper exactly.
    if (Array.isArray(metrics) && metrics.length && typeof metrics[0] === 'object' && 'formattedValue' in metrics[0]) {
      if (metrics.length === 0) return '';
      var html = '<div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">';
      for (var i = 0; i < metrics.length; i++) {
        var item = metrics[i];
        if (!item.formattedValue) continue;
        html += '<span class="tree-card-reaction-metric" title="' + escapeHtmlFn(item.label + ' ' + item.formattedValue) + '">' +
          '<span class="material-symbols-outlined" aria-hidden="true">' + escapeHtmlFn(item.icon) + '</span>' +
          '<span>' + escapeHtmlFn(item.formattedValue) + '</span>' +
          '</span>';
      }
      html += '</div>';
      return html;
    }

    // Otherwise delegate to the shared helper (raw tree metrics object).
    return Metrics.renderTreeReactionMetrics(metrics || {}, escapeHtmlFn, i18n);
  }

  function requireMetrics() {
    if (!Metrics) {
      throw new Error('[LoveBudTreeCardComposition] LoveBudTreeCardMetrics helper is required but not loaded.');
    }
    return Metrics;
  }

  window.LoveBudTreeCardComposition = Object.freeze({
    composeTreeCardModel: composeTreeCardModel,
    renderTreeCardBody: renderTreeCardBody,
    renderTreeMetricFooter: renderTreeMetricFooter,
    requireMetrics: requireMetrics
  });
})();
