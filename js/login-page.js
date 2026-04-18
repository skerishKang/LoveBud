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

  function initLoginPage() {
    if (typeof renderSharedHeader === 'function') {
      renderSharedHeader();
    }

    if (window.applyI18n) {
      window.applyI18n();
    }

    syncLanguageUi();

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
