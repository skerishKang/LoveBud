(function () {
  function syncLanguageUi() {
    var currentLang = window.getCurrentLang ? window.getCurrentLang() : 'ko';
    var langCode = currentLang === 'ko' ? 'KR' : 'EN';
    var langBtn = document.querySelector('.lang-option[data-lang="' + langCode + '"]');

    if (!langBtn) return;

    document.querySelectorAll('.lang-option').forEach(function (option) {
      option.classList.remove('active');
    });

    langBtn.classList.add('active');
  }

  function setupEmailAuthInlineError() {
    var form = document.getElementById('email-auth-form');
    var modal = document.getElementById('email-auth-modal');
    var errorEl = document.getElementById('email-auth-error');

    if (!form || !errorEl || window.__lovebudEmailAuthInlineErrorReady) return;
    window.__lovebudEmailAuthInlineErrorReady = true;

    var nativeAlert = window.alert;
    var emailAuthSubmitActive = false;
    var clearSubmitTimer = null;

    function isEmailAuthModalOpen() {
      return !!(modal && modal.style.display !== 'none');
    }

    function shouldShowInline(message) {
      return emailAuthSubmitActive &&
        isEmailAuthModalOpen() &&
        typeof message === 'string' &&
        !!message.trim();
    }

    function showInlineError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      errorEl.setAttribute('aria-hidden', 'false');
    }

    function hideInlineError() {
      errorEl.textContent = '';
      errorEl.hidden = true;
      errorEl.setAttribute('aria-hidden', 'true');
    }

    function markEmailAuthSubmitActive() {
      emailAuthSubmitActive = true;
      if (clearSubmitTimer) window.clearTimeout(clearSubmitTimer);
      clearSubmitTimer = window.setTimeout(function () {
        emailAuthSubmitActive = false;
      }, 15000);
    }

    form.addEventListener('submit', function () {
      hideInlineError();
      markEmailAuthSubmitActive();
    }, true);

    form.addEventListener('input', hideInlineError);

    window.alert = function (message) {
      if (shouldShowInline(message)) {
        showInlineError(String(message).trim());
        return;
      }
      return nativeAlert.apply(window, arguments);
    };
  }

  function initLoginPage() {
    if (typeof renderSharedHeader === 'function') {
      renderSharedHeader();
    }

    if (window.applyI18n) {
      window.applyI18n();
    }

    syncLanguageUi();
    setupEmailAuthInlineError();

    if (window.onLangChange) {
      window.onLangChange(function () {
        if (window.applyI18n) {
          window.applyI18n();
        }
        syncLanguageUi();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initLoginPage);
})();
