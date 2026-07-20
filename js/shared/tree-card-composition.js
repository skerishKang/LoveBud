/**
 * LoveBud — Shared LoveTree Card Composition
 * Issue #3578 Phase 2 — CTO review hardening (second round)
 *
 * One safe shared card composition boundary for Browse and My Trees.
 *
 * Dependencies (load order):
 *   1. js/utils/security.js  (LoveBudSecurity.escapeHtml / sanitizeUrl)
 *   2. js/shared/tree-card-metrics.js  (LoveBudTreeCardMetrics)
 *   3. js/shared/tree-card-composition.js  ← this file
 *   4. surface renderer (search-card-renderer.js / my-trees-ui.js)
 *
 * Fail-closed:
 *   - LoveBudSecurity MUST be loaded — no fallback escape/sanitize.
 *   - LoveBudTreeCardMetrics MUST be loaded — no self-resolved metrics.
 *   - Missing shared helper → explicit error thrown.
 *
 * Security rules:
 *   - All user-provided strings are set via textContent / setAttribute / dataset,
 *     NOT via innerHTML or escaped-HTML-in-DOM-API.
 *   - URLs are run through sanitizeUrl before assignment to href.
 *   - No generic HTML string slot accepting arbitrary markup.
 *   - Complex media / metadata content accepted as Node or DocumentFragment.
 *   - Dataset keys are allowlist-checked.
 *   - Class tokens are validated against /^[a-zA-Z0-9_-]+$/.
 *   - No javascript: or protocol-relative URLs accepted.
 *   - DOM API values use plain String(), never pre-escaped HTML.
 */

(function () {
  'use strict';

  /* ── Dependency guard (fail-closed) ── */

  function checkSecurityLoaded() {
    var sec = window.LoveBudSecurity;
    if (!sec || typeof sec.escapeHtml !== 'function' || typeof sec.sanitizeUrl !== 'function') {
      throw new Error(
        '[LoveBudTreeCardComposition] LoveBudSecurity not loaded or incomplete. ' +
        'security.js must be loaded before tree-card-composition.js.'
      );
    }
    return sec;
  }

  function checkMetricsLoaded() {
    var m = window.LoveBudTreeCardMetrics;
    if (!m || typeof m.renderTreeReactionMetrics !== 'function') {
      throw new Error(
        '[LoveBudTreeCardComposition] LoveBudTreeCardMetrics not loaded. ' +
        'tree-card-metrics.js must be loaded before tree-card-composition.js.'
      );
    }
    return m;
  }

  /* Cache security reference at init */
  var _sec;
  try {
    _sec = checkSecurityLoaded();
  } catch (e) {
    /* Will re-throw on first buildCardElement call if _sec is null */
  }

  /* ── Constants ── */

  /** Allowlist of dataset keys the composition will accept. */
  var ALLOWED_DATASET_KEYS = ['treeId', 'visibility', 'selectedTreeCard'];

  /** Pattern for validating class tokens. */
  var CLASS_TOKEN_RE = /^[a-zA-Z0-9_-]+$/;

  /** Pattern for valid DOM ID tokens (no spaces, quotes, angle brackets, control chars). */
  var SAFE_ID_RE = /^[a-zA-Z0-9_:.\-]+$/;

  /* ── Helpers ── */

  function validateClassTokens(tokens) {
    if (!Array.isArray(tokens)) return [];
    return tokens.filter(function (t) {
      return typeof t === 'string' && CLASS_TOKEN_RE.test(t);
    });
  }

  function validateDataset(obj) {
    if (!obj || typeof obj !== 'object') return {};
    var result = {};
    Object.keys(obj).forEach(function (k) {
      if (ALLOWED_DATASET_KEYS.indexOf(k) !== -1) {
        result[k] = String(obj[k]);
      }
    });
    return result;
  }

  /**
   * Ensure a string is safe for use as a DOM element id.
   * Returns the token if valid, or generates a safe fallback.
   */
  function safeDomId(value) {
    if (!value) return '';
    var s = String(value).trim();
    if (SAFE_ID_RE.test(s)) return s;
    /* Strip all unsafe characters */
    return s.replace(/[^a-zA-Z0-9_:.\-]/g, '');
  }

  /**
   * Safely convert a trusted HTML string to a DocumentFragment.
   * Used only by buildTreeCard for content produced by metrics module
   * (trusted source) — NOT a generic public API.
   */
  function htmlToFragment(html) {
    if (!html) return null;
    var t = document.createElement('div');
    t.innerHTML = String(html);
    var frag = document.createDocumentFragment();
    while (t.firstChild) {
      frag.appendChild(t.firstChild);
    }
    return frag;
  }

  /* ── Helpers for `buildTreeCard` convenience wrapper ── */

  function _escapeForMetrics(s) {
    return _sec.escapeHtml(s);
  }

  /* ── Card element builder ── */

  /**
   * Build a love-tree-card DOM element from a typed model.
   *
   * Model properties:
   *   surface          - 'browse' | 'my-trees'
   *   treeId           - plain text (used for data-tree-id)
   *   title            - plain text (set via textContent)
   *   subtitleText     - plain text (set via textContent)
   *   primaryLabel     - plain text
   *   primaryHref      - URL (passed through sanitizeUrl)
   *   accessibilityLabel - plain text (aria-label)
   *   isFeatured       - boolean
   *   isSelected       - boolean
   *   animationDelay   - number (seconds)
   *   classTokens      - string[] (each validated against CLASS_TOKEN_RE)
   *   dataset          - { key: value } where keys are in ALLOWED_DATASET_KEYS
   *   mediaNode        - Node|DocumentFragment (surface-specific media)
   *   bodyExtensionNode - Node|DocumentFragment (surface-specific body content)
   *   visibilityNode   - Node (My Trees visibility badge)
   *   metricsNode      - Node (reaction metrics)
   *   metaExtensionNode - Node|DocumentFragment (surface-specific meta row content)
   *
   * @param {object} model
   * @returns {HTMLElement} Card root element
   */
  function buildCardElement(model) {
    if (!model || typeof model !== 'object') {
      throw new Error('[LoveBudTreeCardComposition] buildCardElement: model object required');
    }

    /* Require security (fail-closed) */
    var sec = _sec || checkSecurityLoaded();

    var surface = model.surface === 'my-trees' ? 'my-trees' : 'browse';

    /* ── Root element ── */

    var root = document.createElement('div');

    // Classes: both legacy and shared
    var classes = ['tree-card', 'love-tree-card'];
    classes.push('love-tree-card-' + surface);
    if (surface === 'my-trees') {
      // My Trees uses .tree-card as the surface-specific root
    } else {
      classes.push('tree-card-browse');
    }
    if (model.isFeatured) {
      classes.push('love-tree-card-featured', 'tree-card-featured');
    }
    if (model.isSelected) {
      classes.push('love-tree-card-selected', 'is-selected', 'is-active');
    }
    // Surface-specific extra tokens from adapter
    var extraTokens = validateClassTokens(model.classTokens);
    extraTokens.forEach(function (t) { classes.push(t); });
    root.className = classes.join(' ');

    // Dataset
    if (model.treeId) {
      root.dataset.treeId = String(model.treeId);
    }
    var safeDataset = validateDataset(model.dataset);
    Object.keys(safeDataset).forEach(function (k) {
      root.dataset[k] = safeDataset[k];
    });

    // DOM id (safe only)
    if (model.treeId) {
      var idToken = safeDomId(model.treeId);
      if (idToken) {
        root.id = 'tree-card-' + idToken;
      }
    }

    // Accessibility — use plain String(), not escapeHtml().
    // setAttribute does not interpret HTML; escapeHtml would double-escape.
    if (model.accessibilityLabel) {
      root.setAttribute('aria-label', String(model.accessibilityLabel));
    }

    // Animation delay
    if (typeof model.animationDelay === 'number' && model.animationDelay > 0) {
      root.style.animationDelay = model.animationDelay + 's';
    }

    /* ── Media slot ── */

    if (model.mediaNode) {
      var mediaWrap = document.createElement('div');
      mediaWrap.className = 'tree-card-media love-tree-card-media';
      mediaWrap.appendChild(model.mediaNode);
      root.appendChild(mediaWrap);
    }

    /* ── Body ── */

    var body = document.createElement('div');
    body.className = 'tree-card-body love-tree-card-body';

    // Title row
    var titleRow = document.createElement('div');
    titleRow.className = 'tree-card-title-row love-tree-card-title-row';
    var titleEl = document.createElement('div');
    titleEl.className = 'tree-title love-tree-card-title';
    titleEl.textContent = String(model.title || '');
    titleRow.appendChild(titleEl);

    // Visibility node (My Trees)
    if (model.visibilityNode) {
      var visWrap = document.createElement('div');
      visWrap.className = 'love-tree-card-visibility';
      visWrap.appendChild(model.visibilityNode);
      titleRow.appendChild(visWrap);
    }
    body.appendChild(titleRow);

    // Subtitle (subtitleNode takes priority, otherwise subtitleText as plain text)
    if (model.subtitleNode) {
      var subtitleEl = document.createElement('div');
      subtitleEl.className = 'tree-subtitle love-tree-card-subtitle';
      subtitleEl.appendChild(model.subtitleNode);
      body.appendChild(subtitleEl);
    } else if (model.subtitleText) {
      var subtitleEl = document.createElement('div');
      subtitleEl.className = 'tree-subtitle love-tree-card-subtitle';
      subtitleEl.textContent = String(model.subtitleText);
      body.appendChild(subtitleEl);
    }

    // Body extension
    if (model.bodyExtensionNode) {
      var extWrap = document.createElement('div');
      extWrap.className = 'love-tree-card-body-extension tree-card-body-extension';
      extWrap.appendChild(model.bodyExtensionNode);
      body.appendChild(extWrap);
    }

    /* ── Meta / footer row ── */

    var metaRow = document.createElement('div');
    metaRow.className = 'tree-meta-row love-tree-card-meta-row';

    var metaLeft = document.createElement('div');
    metaLeft.className = 'tree-meta-left love-tree-card-meta-left';

    if (model.metricsNode) {
      metaLeft.appendChild(model.metricsNode);
    }
    if (model.metaExtensionNode) {
      metaLeft.appendChild(model.metaExtensionNode);
    }
    metaRow.appendChild(metaLeft);

    // Primary action — only if sanitized URL is valid
    var safeHref = model.primaryHref ? sec.sanitizeUrl(model.primaryHref) : '';
    if (safeHref) {
      var metaRight = document.createElement('div');
      metaRight.className = 'tree-meta-right love-tree-card-meta-right';

      var link = document.createElement('a');
      link.setAttribute('href', safeHref);
      link.className = 'tree-card-open-link love-tree-card-open-link';

      // Plain text for DOM API (not escapeHtml → double-escape)
      var actionLabel = String(model.primaryLabel || '감상하기');
      link.setAttribute('aria-label', actionLabel + ' 감상');

      var icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'account_tree';
      link.appendChild(icon);

      var labelSpan = document.createElement('span');
      labelSpan.textContent = actionLabel;
      link.appendChild(labelSpan);

      metaRight.appendChild(link);
      metaRow.appendChild(metaRight);
    }

    body.appendChild(metaRow);
    root.appendChild(body);

    return root;
  }

  /* ── Convenience wrapper ── */

  /**
   * Convenience wrapper: uses LoveBudTreeCardMetrics to auto-render
   * reaction metrics from a tree data object.  Returns a DOM element.
   *
   * @param {object} tree   - Tree data object
   * @param {object} options - Options (same as buildCardElement model,
   *                           minus metricsNode which is auto-resolved)
   * @returns {HTMLElement|null} Card root element, or null for invalid tree
   */
  function buildTreeCard(tree, options) {
    if (!tree || typeof tree !== 'object') return null;
    options = options || {};

    // Require security (fail-closed)
    _sec = _sec || checkSecurityLoaded();

    // Require metrics (fail-closed)
    var Metrics = checkMetricsLoaded();

    // Auto-render metrics via shared helper (trusted source)
    var metricsNode = null;
    try {
      var metricsHtml = Metrics.renderTreeReactionMetrics(
        tree,
        _escapeForMetrics,
        typeof options.i18n === 'function' ? options.i18n : null
      );
      if (metricsHtml) {
        var frag = htmlToFragment(metricsHtml);
        metricsNode = frag;
      }
    } catch (metricsErr) {
      // Propagate errors from the metrics module — do not silently swallow
      throw new Error(
        '[LoveBudTreeCardComposition] Metrics rendering failed: ' +
        (metricsErr && metricsErr.message ? metricsErr.message : String(metricsErr))
      );
    }

    var model = {
      surface: options.surface || 'browse',
      treeId: tree.id || tree.treeId || tree.tree_id || '',
      title: options.title || tree.title || '',
      subtitleText: options.subtitleText || '',
      subtitleNode: options.subtitleNode || null,
      primaryLabel: options.primaryLabel || '감상하기',
      primaryHref: options.primaryHref || '',
      accessibilityLabel: options.accessibilityLabel || '',
      isFeatured: !!options.isFeatured,
      isSelected: !!options.isSelected,
      animationDelay: options.index != null ? options.index * 0.05 : 0,
      classTokens: Array.isArray(options.classTokens) ? options.classTokens : [],
      dataset: options.dataset || {},
      mediaNode: options.mediaNode || null,
      bodyExtensionNode: options.bodyExtensionNode || null,
      visibilityNode: options.visibilityNode || null,
      metricsNode: metricsNode,
      metaExtensionNode: options.metaExtensionNode || null
    };

    return buildCardElement(model);
  }

  /* ── Expose (public API only, no htmlToFragment, no escapeHtml, no sanitizeUrl) ── */

  var api = {
    buildCardElement: buildCardElement,
    buildTreeCard: buildTreeCard
  };

  window.LoveBudTreeCardComposition = Object.freeze(api);
})();
