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

  window.LovetreePageShell = {
    initSharedPage: initSharedPage,
  };
  window.LoveTreePageShell = window.LovetreePageShell;
})();
