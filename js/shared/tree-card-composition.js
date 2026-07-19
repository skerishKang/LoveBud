/**
 * LoveBud — Shared Tree Card Composition
 * Issue #3578 Phase 2
 *
 * Provides a unified tree card body composition API consumed by both
 * Browse (search) and My Trees renderers.
 *
 * This module is consumed by both My Trees and Browse card renderers.
 *
 * Design principles:
 *   - View-model only: produces a plain detached model object
 *   - DOM-agnostic: returns HTML strings, no direct DOM manipulation
 *   - No navigation, no event listeners, no API calls
 *   - Deterministic: same inputs always produce same output
 *   - No mutation of the input tree object
 */
(function () {
  'use strict';

  var METRICS = window.LoveBudTreeCardMetrics || null;

  var METRIC_ORDER = ['views', 'likes', 'comments', 'shares'];
  var ICON_MAP = {
    views: 'visibility',
    likes: 'favorite',
    comments: 'chat_bubble',
    shares: 'share'
  };
  var DEFAULT_LABELS = {
    views: '조회수',
    likes: '좋아요',
    comments: '댓글',
    shares: '공유'
  };

  /**
   * Build a detached view-model for a tree card body.
   *
   * Options:
   *   surface        {string}  'browse' | 'my-trees'
   *   href           {string}  primary action URL (appreciation / viewer)
   *   selected       {boolean} selection state (my-trees desktop)
   *   visibilityMode {string}  'omit' | 'icon' (browse=omit, my-trees=icon)
   *   title          {string}  card title text
   *   description    {string}  card subcopy text
   *   labels         {Object}  i18n labels {views, likes, comments, shares}
   *
   * Returns a plain object with no prototype chain dependencies.
   */
  function composeTreeCardModel(tree, options) {
    var href = (options && options.href) || '';
    var title = (options && options.title) || '';
    var description = (options && options.description) || '';
    var surface = (options && options.surface) || 'browse';
    var selected = !!(options && options.selected);
    var visibilityMode = (options && options.visibilityMode) || 'omit';
    var labels = (options && options.labels) || DEFAULT_LABELS;

    var metrics;
    if (METRICS && METRICS.getTreeMetrics) {
      metrics = METRICS.getTreeMetrics(tree || {});
    } else {
      metrics = { views: null, likes: null, comments: null, shares: null };
    }

    var metricList = [];
    for (var i = 0; i < METRIC_ORDER.length; i++) {
      var key = METRIC_ORDER[i];
      var val = metrics[key];
      if (val === null || val === undefined) continue;
      var icon = ICON_MAP[key] || key;
      var formatted = METRICS && METRICS.formatCompactCount
        ? METRICS.formatCompactCount(val)
        : (val === 0 ? '0' : String(val));
      var label = labels[key] || DEFAULT_LABELS[key] || key;
      metricList.push({
        key: key,
        icon: icon,
        label: label,
        value: val,
        formattedValue: formatted
      });
    }

    return {
      href: href,
      title: title,
      description: description,
      surface: surface,
      selected: selected,
      visibilityMode: visibilityMode,
      metrics: metricList
    };
  }

  /**
   * Render the tree card body HTML string using a composed model.
   * Includes: title-row, description, meta-row with metrics.
   */
  function renderTreeCardBody(model, options) {
    var safeTitle = escapeHtml(model.title || '');
    var safeDesc = escapeHtml(model.description || '');
    var href = escapeHtml(model.href || '');
    var surface = model.surface || 'browse';
    var visibilityMode = model.visibilityMode || 'omit';
    var metricList = model.metrics || [];

    var html = '<div class="tree-card-body">';

    // Title row
    html += '<div class="tree-card-title-row">';
    if (visibilityMode === 'icon') {
      html += '<span class="tree-card-visibility" aria-label="트리 공개 상태"></span>';
    }
    html += '<span class="tree-card-title">' + safeTitle + '</span>';
    html += '</div>';

    // Description
    html += '<div class="tree-card-subcopy">' + safeDesc + '</div>';

    // Meta row with metrics
    html += '<div class="tree-meta-row">';
    html += '<div class="tree-meta-left">';
    if (metricList.length > 0) {
      html += renderTreeMetricFooter(metricList, options);
    }
    html += '</div>';
    html += '<div class="tree-meta-right">';
    if (href) {
      html += '<a href="' + href + '" class="tree-card-open-link">';
      html += '<span class="material-symbols-outlined" aria-hidden="true">account_tree</span>';
      html += surface === 'my-trees' ? '감상하기' : '트리 열기';
      html += '</a>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /**
   * Render the reaction metric footer HTML string from a metric list.
   * Requires LoveBudTreeCardMetrics to be available.
   */
  function renderTreeMetricFooter(metricList, options) {
    if (!metricList || metricList.length === 0) return '';
    var labels = (options && options.labels) || DEFAULT_LABELS;
    var html = '<div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">';
    for (var i = 0; i < metricList.length; i++) {
      var m = metricList[i];
      html += '<span class="tree-card-reaction-metric" title="' + escapeHtml(m.label + ' ' + m.formattedValue) + '">';
      html += '<span class="material-symbols-outlined" aria-hidden="true">' + escapeHtml(m.icon) + '</span>';
      html += '<span>' + escapeHtml(m.formattedValue) + '</span>';
      html += '</span>';
    }
    html += '</div>';
    return html;
  }

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, "'");
  }

  window.LoveBudTreeCardComposition = Object.freeze({
    composeTreeCardModel: composeTreeCardModel,
    renderTreeCardBody: renderTreeCardBody,
    renderTreeMetricFooter: renderTreeMetricFooter
  });
})();