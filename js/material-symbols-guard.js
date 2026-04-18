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

  if (!supportsFontLoadingApi()) {
    markReady();
    return;
  }

  if (hasMaterialSymbolsFont()) {
    markReady();
    return;
  }

  Promise.race([
    document.fonts.load('16px "Material Symbols Outlined"'),
    new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    })
  ]).then(function () {
    if (hasMaterialSymbolsFont()) {
      markReady();
    }
  }).catch(function () {
    // 폰트 로드 실패 시 텍스트 폴백이 그대로 보이는 것보다
    // 아이콘이 잠시/계속 숨는 편이 낫다.
  });
})();
