/**
 * LoveBud - i18n Index (Dictionary Merger)
 * v20260419-1
 *
 * 모든 페이지별 딕셔너리를 병합하고 전역 i18nDictionary로 설정
 */

(function() {
  'use strict';

  // 모든 딕셔너리 병합
  var mergedDictionary = {};

  var dictModules = [
    window.i18nShared,
    window.i18nLogin,
    window.i18nIntro,
    window.i18nSearch,
    window.i18nDetail,
    window.i18nEditor,
    window.i18nMyTrees,
    window.i18nIndex
  ];

  dictModules.forEach(function(module) {
    if (module && typeof module === 'object') {
      Object.keys(module).forEach(function(key) {
        // 중복 키는 마지막 값으로 덮어씀
        mergedDictionary[key] = module[key];
      });
    }
  });

  // 전역 딕셔너리 설정 (디버깅용)
  window.i18nDictionary = mergedDictionary;

  // i18n-core에 딕셔너리 주입
  if (typeof window._i18nSetDictionary === 'function') {
    window._i18nSetDictionary(mergedDictionary);
  }

  console.log('[i18n-index] Dictionary merged:', Object.keys(mergedDictionary).length, 'keys');
})();
