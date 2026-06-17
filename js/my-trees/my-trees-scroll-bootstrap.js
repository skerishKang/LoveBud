/**
 * LoveBud - My Trees Scroll Reset Bootstrap
 * v20260617-1
 *
 * 초기 페이지 로드 시 스크롤 위치를 최상단으로 리셋하고 스크롤 복원을 수동으로 설정합니다.
 */
(function() {
  'use strict';
  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) {}
  try {
    window.scrollTo(0, 0);
  } catch (e) {}
})();
