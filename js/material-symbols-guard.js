(function () {
  var READY_CLASS = 'material-symbols-ready';
  var root = document.documentElement;

  function markReady() {
    root.classList.add(READY_CLASS);
  }

  function supportsFontLoadingApi() {
    return !!(document.fonts && document.fonts.check && document.fonts.load);
  }

  function hasMaterialSymbolsFont() {
    try {
      return document.fonts.check('16px "Material Symbols Outlined"');
    } catch (e) {
      return false;
    }
  }

  // Font Loading API 미지원 환경: 바로 준비 완료
  if (!supportsFontLoadingApi()) {
    markReady();
    return;
  }

  // 이미 캐시된 경우: 즉시 준비 완료
  if (hasMaterialSymbolsFont()) {
    markReady();
    return;
  }

  // 최대 1500ms 대기 후 준비 완료 처리 (성공/실패/타임아웃 모두)
  Promise.race([
    document.fonts.load('16px "Material Symbols Outlined"'),
    new Promise(function (resolve) { setTimeout(resolve, 1500); })
  ]).then(function () {
    markReady();
  }).catch(function () {
    // 로드 실패해도 markReady()로 아이콘 텍스트가 보이도록 함
    markReady();
  });
})();
