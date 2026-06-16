(function () {
  'use strict';

  if (typeof renderSharedHeader === 'function') {
    renderSharedHeader();
  }

  function initViewModeSwitcher() {
    if (!window.LoveBudTreeViewModeSwitcher) return;
    window.LoveBudTreeViewModeSwitcher.init({
      storageKey: 'lovebud:myTrees:viewMode',
      defaultMode: 'large',
      mount: '#myTreesViewModeMount',
      target: '#trees-grid'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewModeSwitcher);
  } else {
    initViewModeSwitcher();
  }
})();
