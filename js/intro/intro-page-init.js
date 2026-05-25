(function initIntroPage() {
document.addEventListener('DOMContentLoaded', function onIntroDOMContentLoaded() {
renderSharedHeader();

var urlParams = new URLSearchParams(window.location.search);
var langParam = urlParams.get('lang');

if (langParam && (langParam === 'en' || langParam === 'ko')) {
  if (window.setCurrentLang) window.setCurrentLang(langParam);
}

if (window.applyI18n) window.applyI18n();

var currentLang = window.getCurrentLang ? window.getCurrentLang() : 'ko';
var langBtn = document.querySelector(
  '.lang-option[data-lang="' + (currentLang === 'ko' ? 'KR' : 'EN') + '"]'
);

if (langBtn) {
  document.querySelectorAll('.lang-option').forEach(function updateLangOption(option) {
    option.classList.remove('active');
  });
  langBtn.classList.add('active');
}

// Two-message hero copy loop animation
var set1 = document.getElementById('hero-set-1');
var set2 = document.getElementById('hero-set-2');
if (set1 && set2) {
  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isReducedMotion) {
    var activeSet = 1;
    setInterval(function toggleHeroCopy() {
      if (activeSet === 1) {
        set1.classList.remove('active');
        set2.classList.add('active');
        activeSet = 2;
      } else {
        set2.classList.remove('active');
        set1.classList.add('active');
        activeSet = 1;
      }
    }, 3500);
  }
}

});

if (window.onLangChange) {
window.onLangChange(function onIntroLangChange() {
if (window.applyI18n) window.applyI18n();
});
}
})();
