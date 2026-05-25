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

// Intro page keeps a stable explanatory hero. The rotating hero copy belongs on the landing page.
var set1 = document.getElementById('hero-set-1');
var set2 = document.getElementById('hero-set-2');
if (set1 && set2) {
  set1.classList.add('active');
  set2.classList.remove('active');
  set2.setAttribute('hidden', '');
}

});

if (window.onLangChange) {
window.onLangChange(function onIntroLangChange() {
if (window.applyI18n) window.applyI18n();
});
}
})();
