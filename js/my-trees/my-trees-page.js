/**
 * LoveBud - My Trees Page Helpers
 * v20260420-1
 *
 * Responsibilities:
 * - page state constants
 * - state section visibility toggle
 * - page-level button bindings
 * - toast helper
 */

(function() {
  var STATE = {
    LOADING: 'loading',
    LOADED: 'loaded',
    EMPTY: 'empty',
    ERROR: 'error'
  };

  var STATE_DISPLAY_CLASS = {
    loading: 'state-visible',
    error: 'state-visible',
    empty: 'state-visible',
    loaded: 'state-visible-block'
  };

  function showToast(message, type) {
    if (window.LoveBudUI?.showToast) {
      window.LoveBudUI.showToast(message, type, 3000);
    } else {
      console.warn('[my-trees] LoveBudUI not loaded, toast degraded to console');
      console.log('[Toast ' + type + '] ' + message);
    }
  }

  function hideStateSection(el) {
    if (!el) return;
    el.style.display = '';
    el.classList.remove('state-visible', 'state-visible-block');
    el.classList.add('state-hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function showStateSection(el, stateName) {
    var displayClass = STATE_DISPLAY_CLASS[stateName];
    if (!el || !displayClass) return;
    el.style.display = '';
    el.classList.remove('state-hidden', 'state-visible', 'state-visible-block');
    el.classList.add(displayClass);
    el.removeAttribute('aria-hidden');
  }

  function setState(newState) {
    var container = document.getElementById('treesContainer');
    if (!container) return;

    var sections = {
      loading: document.getElementById('state-loading'),
      error: document.getElementById('state-error'),
      empty: document.getElementById('state-empty'),
      loaded: document.getElementById('state-loaded')
    };

    Object.values(sections).forEach(hideStateSection);

    switch (newState) {
      case STATE.LOADING:
        showStateSection(sections.loading, 'loading');
        break;
      case STATE.ERROR:
        showStateSection(sections.error, 'error');
        break;
      case STATE.EMPTY:
        showStateSection(sections.empty, 'empty');
        break;
      case STATE.LOADED:
        showStateSection(sections.loaded, 'loaded');
        break;
      default:
        console.warn('[my-trees] Unknown state requested:', newState);
        showStateSection(sections.error, 'error');
        break;
    }
  }

  function setupHeaderCreateButton(options) {
    var onCreate = options && options.onCreate;
    var btn = document.getElementById('headerCreateTreeBtn');

    if (!btn || typeof onCreate !== 'function') return;

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      onCreate();
    });
  }

  function setupRetryButton(options) {
    var onRetry = options && options.onRetry;
    var btn = document.getElementById('retryLoadBtn');

    if (!btn || typeof onRetry !== 'function') return;

    btn.addEventListener('click', function() {
      console.log('[my-trees] Retry loading trees');
      onRetry();
    });
  }

  var api = {
    STATE: STATE,
    showToast: showToast,
    setState: setState,
    setupHeaderCreateButton: setupHeaderCreateButton,
    setupRetryButton: setupRetryButton
  };

  // Backward-compat: older page scripts referenced "LoveTree*" namespaces.
  window.LoveBudMyTreesPage = api;
  window.LoveTreeMyTreesPage = api;
})();
