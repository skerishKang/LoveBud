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

  function showToast(message, type) {
    if (window.LoveBudUI?.showToast) {
      window.LoveBudUI.showToast(message, type, 3000);
    } else {
      console.warn('[my-trees] LoveBudUI not loaded, toast degraded to console');
      console.log('[Toast ' + type + '] ' + message);
    }
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

    Object.values(sections).forEach(function(el) {
      if (el) el.style.display = 'none';
    });

    switch (newState) {
      case STATE.LOADING:
        if (sections.loading) sections.loading.style.display = 'flex';
        break;
      case STATE.ERROR:
        if (sections.error) sections.error.style.display = 'flex';
        break;
      case STATE.EMPTY:
        if (sections.empty) sections.empty.style.display = 'flex';
        break;
      case STATE.LOADED:
        if (sections.loaded) sections.loaded.style.display = 'block';
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

  window.LoveBudMyTreesPage = {
    STATE: STATE,
    showToast: showToast,
    setState: setState,
    setupHeaderCreateButton: setupHeaderCreateButton,
    setupRetryButton: setupRetryButton
  };
})();
