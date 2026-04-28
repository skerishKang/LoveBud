/**
 * LoveBud - Page Shell (Shared Page Initializer)
 * v20260428
 *
 * 책임 경계:
 * - page-shell은 공통 페이지 초기화 순서를 조정합니다.
 * - page-shell은 header markup을 직접 생성하지 않습니다.
 * - page-shell은 optional hook 실행을 조정합니다:
 *   * renderSharedHeader(): shared-header.js가 제공하는 헤더 렌더링
 *   * applyI18n(): 국제화 적용 (제공: i18n module)
 *   * afterInit(): page-specific 후처리
 *
 * 소유하지 않는 것:
 * - Header markup/behavior (→ shared-header.js 소유)
 * - Page-specific business logic
 * - Auth logic (→ auth.js)
 * - Navigation rendering (→ shared-header.js)
 * - Search/Editor/My Trees page logic
 *
 * 사용법:
 *   LoveTreePageShell.initSharedPage({
 *     renderHeader: true,   // shared-header 렌더링
 *     applyI18n: true,      // i18n 적용
 *     afterInit: fn         // page-specific 초기화 함수 (optional)
 *   });
 *
 * 호출 순서:
 *   1. renderSharedHeader() - header markup + 헤더 동작 바인딩
 *   2. applyI18n()        - 국제화 적용
 *   3. afterInit()        - 페이지별 초기화 (있을 경우)
 *
 * 노트:
 * - renderHeader가 true여야 window.renderSharedHeader()가 호출됩니다.
 * - shared-header.js는 별도 script로 로드되어야 합니다.
 * - page-shell은 orchestrator 역할만 수행합니다.
 */
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function initSharedPage(options) {
    var opts = options || {};

    onReady(function () {
      if (opts.renderHeader && typeof window.renderSharedHeader === 'function') {
        window.renderSharedHeader();
      }

      if (opts.applyI18n && typeof window.applyI18n === 'function') {
        window.applyI18n();
      }

      if (typeof opts.afterInit === 'function') {
        opts.afterInit();
      }
    });
  }

  // Canonical namespace
  window.LoveTreePageShell = {
    initSharedPage: initSharedPage,
  };
  // Legacy alias retained for compatibility
  window.LovetreePageShell = window.LoveTreePageShell;
})();
