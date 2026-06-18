(function initSearchPageShell() {
  window.LoveTreePageShell.initSharedPage({
    renderHeader: true,
    applyI18n: true,
  });

  if (window.LoveBudTreeViewModeSwitcher) {
    var ready = function () {
      window.LoveBudTreeViewModeSwitcher.init({
        storageKey: 'lovebud:browse:viewMode',
        defaultMode: 'compact',
        mount: '#browseViewModeMount',
        target: '#resultsList'
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  }
})();
