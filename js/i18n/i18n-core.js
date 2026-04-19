/**
 * LoveBud - i18n Core Module
 * v20260419-1
 *
 * 언어 설정 관리 및 다국어 지원 핵심 기능
 * - 기본 언어: 한국어 (ko)
 * - 영어 지원 (en)
 * - localStorage 저장
 */

(function() {
  'use strict';

  var I18N_KEY = 'lovebud_lang';
  var DEFAULT_LANG = 'ko';

  // 현재 언어 가져오기
  function getCurrentLang() {
    try {
      var stored = localStorage.getItem(I18N_KEY);
      if (stored && (stored === 'ko' || stored === 'en')) {
        return stored;
      }
    } catch (e) {
      console.warn('[i18n] Failed to read language:', e);
    }
    return DEFAULT_LANG;
  }

  // 언어 설정하기
  function setCurrentLang(lang) {
    if (lang !== 'ko' && lang !== 'en') {
      console.warn('[i18n] Invalid language:', lang);
      return false;
    }
    try {
      localStorage.setItem(I18N_KEY, lang);
      console.log('[i18n] Language set to:', lang);
      return true;
    } catch (e) {
      console.warn('[i18n] Failed to save language:', e);
      return false;
    }
  }

  // 전역 딕셔너리 참조 (i18n-index.js에서 설정)
  var globalDictionary = {};

  // 딕셔너리 설정 함수 (내부용)
  function setGlobalDictionary(dict) {
    globalDictionary = dict || {};
  }

  // 번역 텍스트 가져오기
  function t(key) {
    var lang = getCurrentLang();
    var entry = globalDictionary[key];
    if (!entry) {
      console.warn('[i18n] Missing key:', key);
      return key;
    }
    return entry[lang] || entry[DEFAULT_LANG] || key;
  }

  // data-i18n 속성을 가진 요소들에 번역 적용
  function applyI18n() {
    // textContent 번역
    var elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    // placeholder 번역
    var placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key);
      }
    });

    console.log('[i18n] Applied to', elements.length, 'elements,', placeholderElements.length, 'placeholders');
  }

  // 언어 변경 이벤트 리스너
  function onLangChange(callback) {
    window.addEventListener('lovebud-lang-change', function(e) {
      callback(e.detail.lang);
    });
  }

  // 언어 변경 이벤트 발생
  function triggerLangChange(lang) {
    window.dispatchEvent(new CustomEvent('lovebud-lang-change', {
      detail: { lang: lang }
    }));
  }

  // 전역 노출
  window.I18N_KEY = I18N_KEY;
  window.DEFAULT_LANG = DEFAULT_LANG;
  window.getCurrentLang = getCurrentLang;
  window.setCurrentLang = setCurrentLang;
  window.t = t;
  window.applyI18n = applyI18n;
  window.onLangChange = onLangChange;
  window.triggerLangChange = triggerLangChange;
  window._i18nSetDictionary = setGlobalDictionary; // 내부용
})();
