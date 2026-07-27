/**
 * LoveBud - My Trees Page Helpers
 * v20260429-2
 *
 * Responsibilities:
 * - page state constants
 * - state section visibility toggle
 * - page-level button bindings
 * - toast helper
 */

(function() {
  /** ── Timed loading state manager for My Trees with operation-token ownership ── */
  function createMyTreesLoadingManager() {
    var timers = {
      indicator: null,
      copy: null,
      longWait: null,
      error: null
    };
    var currentGeneration = 0;
    var i18n = window.t || function (k) { return k; };

    var INDICATOR_DELAY = 500;
    var COPY_THRESHOLD = 2000;
    var LONG_WAIT = 8000;
    var ERROR_ESCALATION = 15000;

    function clearAllTimers() {
      Object.keys(timers).forEach(function (key) {
        if (timers[key]) { clearTimeout(timers[key]); timers[key] = null; }
      });
    }

    function isCurrent(gen) {
      return gen === currentGeneration;
    }

    /**
     * Start a new loading operation with generation token.
     * Only current generation can modify DOM/timers.
     */
    function start() {
      clearAllTimers();
      var gen = ++currentGeneration;

      // 0-500ms: hidden (caller handles initial visibility)
      timers.indicator = setTimeout(function () {
        if (!isCurrent(gen)) return;
        // 500-2000ms: visual indicator visible, no explanatory copy

        timers.copy = setTimeout(function () {
          if (!isCurrent(gen)) return;
          // 2000-8000ms: show owned-tree copy text

          timers.longWait = setTimeout(function () {
            if (!isCurrent(gen)) return;
            // 8000-15000ms: long-wait visible

            timers.error = setTimeout(function () {
              if (!isCurrent(gen)) return;
              // 15000ms+: visible error/retry state
              // UI escalation only — not an abort
            }, ERROR_ESCALATION - LONG_WAIT);
          }, LONG_WAIT - COPY_THRESHOLD);
        }, COPY_THRESHOLD - INDICATOR_DELAY);
      }, INDICATOR_DELAY);

      return gen;
    }

    function ready(gen) {
      if (gen !== undefined && !isCurrent(gen)) return;
      clearAllTimers();
    }

    function error(gen) {
      if (gen !== undefined && !isCurrent(gen)) return;
      clearAllTimers();
    }

    function dispose(gen) {
      if (gen !== undefined && !isCurrent(gen)) return;
      clearAllTimers();
    }

    return {
      start: start,
      ready: ready,
      error: error,
      dispose: dispose,
      getGeneration: function () { return currentGeneration; },
      INDICATOR_DELAY: INDICATOR_DELAY,
      COPY_THRESHOLD: COPY_THRESHOLD,
      LONG_WAIT: LONG_WAIT,
      ERROR_ESCALATION: ERROR_ESCALATION
    };
  }

  function isMyTreesDebugEnabled() {
    return window.LOVEBUD_DEBUG === true || window.LOVEBUD_MY_TREES_DEBUG === true;
  }

  function myTreesDebugLog() {
    if (!isMyTreesDebugEnabled() || !window.console || typeof console.log !== 'function') return;
    console.log.apply(console, arguments);
  }

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

  /**
   * Update the visible text inside #state-error based on errorType.
   * errorType: 'auth' | 'server' | 'network' | 'generic' | undefined
   */
  function _applyErrorStateMessage(errorType) {
    var errorEl = document.getElementById('state-error');
    if (!errorEl) return;
    var h2 = errorEl.querySelector('h2');
    var p = errorEl.querySelector('p');
    if (!h2 || !p) return;

    switch (errorType) {
      case 'auth':
        h2.removeAttribute('data-i18n');
        p.removeAttribute('data-i18n');
        h2.textContent = '로그인이 필요합니다';
        p.textContent = '세션이 만료되었거나 인증이 필요합니다. 다시 로그인해 주세요.';
        break;
      case 'server':
        h2.removeAttribute('data-i18n');
        p.removeAttribute('data-i18n');
        h2.textContent = '서버 오류가 발생했습니다';
        p.textContent = '잠시 후 다시 시도해 주세요.';
        break;
      case 'network':
        h2.removeAttribute('data-i18n');
        p.removeAttribute('data-i18n');
        h2.textContent = '불러오기에 실패했습니다';
        p.textContent = '네트워크 연결을 확인하고 다시 시도해주세요.';
        break;
      default:
        // generic or undefined: restore default attributes for i18n
        h2.setAttribute('data-i18n', 'myTrees.error_title');
        p.setAttribute('data-i18n', 'myTrees.error_desc');
        // Let i18n library or default HTML content take over
        break;
    }
  }

  /**
   * @param {string} newState - one of STATE.*
   * @param {object} [meta] - optional metadata
   * @param {string} [meta.errorType] - 'auth'|'server'|'network'|'generic'
   */
  var _loadingManager = null;

  /**
   * Initialize the timed loading manager for My Trees.
   * Called from the orchestrator after DOM is ready.
   */
  function initLoadingManager() {
    if (_loadingManager) return _loadingManager;
    _loadingManager = createMyTreesLoadingManager();
    return _loadingManager;
  }

  function getLoadingManager() {
    return _loadingManager;
  }

  function setState(newState, meta) {
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
        // Start timed loading manager on LOADING
        if (_loadingManager) {
          _loadingManager.start();
        }
        // Reset long-wait visual class
        if (sections.loading) {
          sections.loading.classList.remove('lt-long-wait');
          var textEl = sections.loading.querySelector('.loading-text');
          if (textEl) {
            var t = window.t || function(k) { return k; };
            textEl.textContent = t('myTrees.loading');
          }
        }
        break;
      case STATE.ERROR:
        if (sections.error) {
          showStateSection(sections.error, 'error');
          _applyErrorStateMessage(meta && meta.errorType);
        }
        // Stop loading manager
        if (_loadingManager) _loadingManager.error();
        break;
      case STATE.EMPTY:
        showStateSection(sections.empty, 'empty');
        // Stop loading manager
        if (_loadingManager) _loadingManager.ready();
        break;
      case STATE.LOADED:
        showStateSection(sections.loaded, 'loaded');
        // Stop loading manager
        if (_loadingManager) _loadingManager.ready();
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
    var emptyBtn = document.getElementById('createTreeBtn');

    if (typeof onCreate !== 'function') return;

    [btn, emptyBtn].forEach(function(target) {
      if (!target || target.dataset.createTreeBound === 'true') return;
      target.dataset.createTreeBound = 'true';
      target.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        onCreate();
      });
    });
  }

  function setupRetryButton(options) {
    var onRetry = options && options.onRetry;
    var btn = document.getElementById('retryLoadBtn');

    if (!btn || typeof onRetry !== 'function') return;

    btn.addEventListener('click', function() {
      myTreesDebugLog('[my-trees] Retry loading trees');
      onRetry();
    });
  }

  var api = {
    STATE: STATE,
    showToast: showToast,
    setState: setState,
    setupHeaderCreateButton: setupHeaderCreateButton,
    setupRetryButton: setupRetryButton,
    initLoadingManager: initLoadingManager,
    getLoadingManager: getLoadingManager
  };

  // Backward compatibility: export both LoveBudMyTreesPage and LoveTreeMyTreesPage
  window.LoveBudMyTreesPage = api;
  window.LoveTreeMyTreesPage = api;
})();
