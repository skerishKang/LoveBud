/**
 * LoveBud - i18n Entry (Thin Loader with Auto-load)
 * v20260419-1
 *
 * 기존 js/i18n.js는 이제 thin entry + auto-loader입니다.
 * 실제 구현은 js/i18n/ 폴더의 모듈들로 분리되었습니다.
 */

(function() {
  'use strict';

  var BASE_PATH = (function() {
    var scripts = document.querySelectorAll('script[src*="i18n.js"]');
    if (scripts.length > 0) {
      var src = scripts[0].getAttribute('src');
      var base = src.substring(0, src.lastIndexOf('/') + 1);
      return base || 'js/';
    }
    return 'js/';
  })();

  var modules = [
    'i18n/i18n-core.js',
    'i18n/i18n-shared.js',
    'i18n/i18n-login.js',
    'i18n/i18n-intro.js',
    'i18n/i18n-search.js',
    'i18n/i18n-detail.js',
    'i18n/i18n-editor.js',
    'i18n/i18n-my-trees.js',
    'i18n/i18n-index.js'
  ];

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = BASE_PATH + src;
      script.async = false;
      script.onload = function() { resolve(src); };
      script.onerror = function() { reject(src); };
      document.head.appendChild(script);
    });
  }

  // 순차 로드 (의존성 순서 보장)
  var promise = Promise.resolve();
  modules.forEach(function(mod) {
    promise = promise.then(function() { return loadScript(mod); });
  });

  promise.then(function() {
    console.log('[i18n.js] All i18n modules loaded successfully');
  }).catch(function(err) {
    console.error('[i18n.js] Failed to load module:', err);
  });

  console.log('[i18n.js] Thin entry with auto-loader initialized');
})();
