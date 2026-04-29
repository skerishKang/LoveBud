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
        h2.textContent = '로그인이 필요합니다';
        p.textContent = '세션이 만료되었거나 인증이 필요합니다. 다시 로그인해 주세요.';
        break;
      case 'server':
        h2.textContent = '서버 오류가 발생했습니다';
        p.textContent = '잠시 후 다시 시도해 주세요.';
        break;
      case 'network':
        h2.textContent = '불러오기에 실패했습니다';
        p.textContent = '네트워크 연결을 확인하고 다시 시도해주세요.';
        break;
      default:
        // generic or undefined: keep default HTML content
        break;
    }
  }

  /**
   * @param {string} newState - one of STATE.*
   * @param {object} [meta] - optional metadata
   * @param {string} [meta.errorType] - 'auth'|'server'|'network'|'generic'
   */
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
        break;
      case STATE.ERROR:
        if (sections.error) {
          showStateSection(sections.error, 'error');
          _applyErrorStateMessage(meta && meta.errorType);
        }
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

  window.LoveBudMyTreesPage = {
    STATE: STATE,
    showToast: showToast,
    setState: setState,
    setupHeaderCreateButton: setupHeaderCreateButton,
    setupRetryButton: setupRetryButton
  };
})();
