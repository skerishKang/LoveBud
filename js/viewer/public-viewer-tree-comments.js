/**
 * public-viewer-tree-comments.js — read-only whole-tree comments control
 *
 * Adds a "트리 전체 댓글" disclosure to the public viewer tree-meta area.
 * Reads via window.LoveBudTreeComments.fetchTreeComments (tree-target only).
 * Read-only surface: no write field, no mutation, no auth header.
 * Strictly separated from #3075 selected-moment comments (different target key).
 *
 * Refs #3416, #3188, #3414, #3415, #3412, #3413, #3408, #3410, #3404, #3372, #3374, #3075, #1882
 */

(function () {
  'use strict';

  window.LoveBudPublicViewerTreeComments = {
    createTreeCommentsReadOnlyControl: null
  };

  var UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function isValidTreeId(id) {
    return typeof id === 'string' && UUID_RE.test(id.trim());
  }

  function createTreeCommentsReadOnlyControl(deps) {
    var i18n = deps && typeof deps.i18n === 'function'
      ? deps.i18n
      : function (k) { return k; };

    function getText(key, fallback) {
      var value = i18n(key);
      return value && value !== key ? value : fallback;
    }
    var showToast = deps && typeof deps.showToast === 'function'
      ? deps.showToast
      : function () {};

    var treeId = deps && deps.treeId;

    var fetchTreeComments = function (id, opts) {
      var api = window.LoveBudTreeComments;
      if (!api || typeof api.fetchTreeComments !== 'function') {
        throw new Error('[tree-comments] LoveBudTreeComments.fetchTreeComments not found');
      }
      return api.fetchTreeComments(id, opts);
    };

    // --- internal state ---
    var currentState = 'idle';      // idle | loading | loaded_empty | loaded_with_comments | retry | error states
    var hasLoaded = false;
    var cachedComments = [];
    var generation = 0;
    var inFlight = false;

    // --- DOM ---
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'wholeTreeCommentsToggle';
    toggleBtn.className = 'tree-comments-toggle';
    toggleBtn.textContent = getText('tree_comments_toggle', '트리 전체 댓글');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'wholeTreeCommentsPanel');
    toggleBtn.style.display = 'inline-flex';
    toggleBtn.style.alignItems = 'center';
    toggleBtn.style.justifyContent = 'center';
    toggleBtn.style.gap = '6px';
    toggleBtn.style.minHeight = '32px';
    toggleBtn.style.padding = '4px 12px';
    toggleBtn.style.borderRadius = '999px';
    toggleBtn.style.fontSize = '12px';
    toggleBtn.style.fontWeight = '700';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease';
    toggleBtn.style.border = '1px solid rgba(144,73,81,0.10)';
    toggleBtn.style.boxShadow = '0 6px 16px rgba(75, 64, 57, 0.06)';
    toggleBtn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
    toggleBtn.style.color = 'var(--primary)';
    toggleBtn.addEventListener('mouseenter', function () {
      toggleBtn.style.transform = 'translateY(-1px)';
    });
    toggleBtn.addEventListener('mouseleave', function () {
      toggleBtn.style.transform = 'translateY(0)';
    });

    var panel = document.createElement('div');
    panel.id = 'wholeTreeCommentsPanel';
    panel.className = 'tree-comments-panel';
    panel.hidden = true;
    panel.style.width = '100%';
    panel.style.boxSizing = 'border-box';
    panel.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(250,246,244,0.97))';
    panel.style.border = '1px solid rgba(144,73,81,0.10)';
    panel.style.borderRadius = '16px';
    panel.style.padding = '16px 18px';
    panel.style.maxHeight = '420px';
    panel.style.overflowY = 'auto';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '10px';

    var heading = document.createElement('h4');
    heading.id = 'wholeTreeCommentsHeading';
    heading.tabIndex = -1;
    heading.textContent = getText('tree_comments_heading', '트리 전체 댓글');
    heading.style.margin = '0';
    heading.style.padding = '0';
    heading.style.fontSize = '13px';
    heading.style.fontWeight = '800';
    heading.style.color = 'var(--on-surface)';
    heading.style.lineHeight = '1.4';

    var status = document.createElement('div');
    status.id = 'wholeTreeCommentsStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    var list = document.createElement('ul');
    list.id = 'wholeTreeCommentsList';
    list.className = 'tree-comments-list';
    list.style.margin = '0';
    list.style.padding = '0';
    list.style.listStyle = 'none';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';

    panel.appendChild(heading);
    panel.appendChild(status);
    panel.appendChild(list);

    // --- retry button (lazy) ---
    var retryBtn = null;
    function ensureRetryButton() {
      if (retryBtn && retryBtn.parentElement) return retryBtn;
      retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.id = 'wholeTreeCommentsRetry';
      retryBtn.textContent = getText('tree_comments_retry', '다시 시도');
      retryBtn.setAttribute('aria-label', getText('tree_comments_retry_label', '트리 전체 댓글 다시 불러오기'));
      retryBtn.style.display = 'inline-flex';
      retryBtn.style.alignItems = 'center';
      retryBtn.style.justifyContent = 'center';
      retryBtn.style.gap = '6px';
      retryBtn.style.minHeight = '32px';
      retryBtn.style.padding = '4px 12px';
      retryBtn.style.borderRadius = '999px';
      retryBtn.style.fontSize = '12px';
      retryBtn.style.fontWeight = '700';
      retryBtn.style.cursor = 'pointer';
      retryBtn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease';
      retryBtn.style.border = '1px solid rgba(144,73,81,0.10)';
      retryBtn.style.boxShadow = '0 6px 16px rgba(75, 64, 57, 0.06)';
      retryBtn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
      retryBtn.style.color = 'var(--primary)';
      retryBtn.addEventListener('mouseenter', function () {
        retryBtn.style.transform = 'translateY(-1px)';
      });
      retryBtn.addEventListener('mouseleave', function () {
        retryBtn.style.transform = 'translateY(0)';
      });
      retryBtn.addEventListener('click', function () {
        // Explicit retry: exactly one new fetch per click.
        performFetch();
      });
      panel.appendChild(retryBtn);
      return retryBtn;
    }
    function removeRetryButton() {
      if (retryBtn && retryBtn.parentElement) {
        retryBtn.parentElement.removeChild(retryBtn);
      }
    }

    // --- helpers ---
    function formatSafeDate(value) {
      if (!value || typeof value !== 'string') return '';
      return value;
    }

    function setState(next) {
      currentState = next;
    }

    function getState() {
      return currentState;
    }

    function getComments() {
      return cachedComments;
    }

    function clearList() {
      while (list.firstChild) list.removeChild(list.firstChild);
    }

    function renderLoading() {
      status.textContent = getText('tree_comments_loading', '트리 전체 댓글을 불러오는 중이에요.');
      removeRetryButton();
    }

    function renderList() {
      clearList();
      if (!cachedComments.length) {
        status.textContent = getText('tree_comments_empty', '아직 트리 전체에 남겨진 댓글이 없어요.');
        return;
      }
      status.textContent = '';
      cachedComments.forEach(function (c) {
        var li = document.createElement('li');
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '4px';
        var bodyEl = document.createElement('p');
        bodyEl.className = 'tree-comment-body';
        bodyEl.textContent = c.body || '';
        bodyEl.style.margin = '0';
        bodyEl.style.padding = '0';
        bodyEl.style.fontSize = '13px';
        bodyEl.style.fontWeight = '500';
        bodyEl.style.color = 'var(--on-surface)';
        bodyEl.style.lineHeight = '1.6';
        bodyEl.style.whiteSpace = 'pre-wrap';
        bodyEl.style.overflowWrap = 'anywhere';
        bodyEl.style.wordBreak = 'break-word';
        var metaEl = document.createElement('div');
        metaEl.className = 'tree-comment-meta';
        var parts = [];
        if (c.authorDisplayLabel) parts.push(String(c.authorDisplayLabel));
        var date = formatSafeDate(c.createdAt);
        if (date) parts.push(date);
        metaEl.textContent = parts.join(' · ');
        metaEl.style.fontSize = '11px';
        metaEl.style.fontWeight = '600';
        metaEl.style.color = 'var(--on-surface-variant)';
        metaEl.style.lineHeight = '1.5';
        li.appendChild(bodyEl);
        li.appendChild(metaEl);
        list.appendChild(li);
      });
    }

    function errorCopyFor(state) {
      if (state === 'upstream_timeout') {
        return getText('tree_comments_timeout', '댓글을 불러오는 데 시간이 걸리고 있어요. 다시 시도해 주세요.');
      }
      // not_found_private_non_public / upstream_unavailable / unexpected_safe_error /
      // invalid_tree_id all collapse to the same safe unavailable copy (no private exposure).
      return getText('tree_comments_unavailable', '트리 전체 댓글을 불러오지 못했어요. 다시 시도해 주세요.');
    }

    function renderError(state) {
      status.textContent = errorCopyFor(state);
      ensureRetryButton();
    }

    function applyResult(result) {
      if (result && result.ok) {
        hasLoaded = true;
        cachedComments = Array.isArray(result.comments) ? result.comments : [];
        removeRetryButton();
        if (cachedComments.length > 0) {
          setState('loaded_with_comments');
        } else {
          setState('loaded_empty');
        }
        renderList();
        return;
      }
      var errState = (result && result.state) || 'unexpected_safe_error';
      setState(errState);
      renderError(errState);
    }

    function performFetch() {
      if (!treeId || !isValidTreeId(treeId)) {
        // Invalid tree id: safe state, no network call.
        setState('invalid_tree_id');
        renderError('invalid_tree_id');
        return;
      }
      var gen = ++generation;
      inFlight = true;
      setState('loading');
      renderLoading();
      Promise.resolve()
        .then(function () { return fetchTreeComments(treeId, { limit: 20 }); })
        .then(function (result) {
          if (gen !== generation) return; // stale async response guard
          inFlight = false;
          applyResult(result);
        })
        .catch(function () {
          if (gen !== generation) return;
          inFlight = false;
          applyResult({ ok: false, state: 'unexpected_safe_error' });
        });
    }

    function focusHeading() {
      try {
        if (heading && typeof heading.focus === 'function') heading.focus();
      } catch (e) { /* defensive */ }
    }

    function openPanel() {
      if (panel.hidden === false) return; // already open — no duplicate fetch
      panel.hidden = false;
      toggleBtn.setAttribute('aria-expanded', 'true');

      if (hasLoaded) {
        // Reuse successful results; no new fetch.
        renderList();
      } else if (currentState === 'idle') {
        // First open: lazy fetch.
        performFetch();
      }
      // If a prior error/retry state exists, the error copy + retry button are
      // already rendered; do NOT auto-fetch again (explicit retry only).

      focusHeading();
    }

    function closePanel() {
      if (panel.hidden === true) return;
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
      // Focus return to the toggle (connection-safe, defensive).
      try {
        if (toggleBtn && typeof toggleBtn.focus === 'function') toggleBtn.focus();
      } catch (e) { /* defensive */ }
    }

    toggleBtn.addEventListener('click', function () {
      if (panel.hidden) openPanel();
      else closePanel();
    });

    function reset(newTreeId) {
      generation++; // invalidate any pending async response
      inFlight = false;
      hasLoaded = false;
      cachedComments = [];
      currentState = 'idle';
      treeId = newTreeId || treeId;
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
      clearList();
      status.textContent = '';
      removeRetryButton();
    }

    return {
      getElement: function () { return toggleBtn; },
      getPanelElement: function () { return panel; },
      getState: getState,
      getComments: getComments,
      reset: reset,
      open: openPanel,
      close: closePanel
    };
  }

  window.LoveBudPublicViewerTreeComments.createTreeCommentsReadOnlyControl = createTreeCommentsReadOnlyControl;
})();
