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
    var errorEl = document.getElementById('email-auth-error');

    if (!form || !errorEl) return;

    function show(message) {
      var text = String(message || '').trim();
      if (!text) return;
      errorEl.textContent = text;
      errorEl.hidden = false;
      errorEl.setAttribute('aria-hidden', 'false');
    }

    function hide() {
      errorEl.textContent = '';
      errorEl.hidden = true;
      errorEl.setAttribute('aria-hidden', 'true');
    }

    window.LoveBudLoginPageAuthError = {
      show: show,
      hide: hide
    };

    form.addEventListener('submit', hide, true);
    form.addEventListener('input', hide);
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
