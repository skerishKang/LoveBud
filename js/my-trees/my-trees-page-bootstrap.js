/**
 * LoveBud - My Trees Page Initialization Bootstrap
 * v20260617-1
 *
 * 공통 헤더 및 트리 뷰 모드 스위처 초기화
 */
(function() {
  'use strict';

  // 1. 공통 헤더 렌더링
  if (typeof window.renderSharedHeader === 'function') {
    window.renderSharedHeader();
  }

  // 2. 트리 뷰 모드 스위처 초기화
  if (window.LoveBudTreeViewModeSwitcher) {
    var ready = function() {
      window.LoveBudTreeViewModeSwitcher.init({
        storageKey: 'lovebud:myTrees:viewMode',
        defaultMode: 'large',
        mount: '#myTreesViewModeMount',
        target: '#trees-grid'
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  }
})();
