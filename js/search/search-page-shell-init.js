(function initSearchPageShell() {
  window.LoveTreePageShell.initSharedPage({
    renderHeader: true,
    applyI18n: true,
  });

  if (window.LoveBudTreeViewModeSwitcher) {
    var ready = function () {
      // #3655: Browse opts in to the fourth `story` mode. The shared
      // switcher still defaults to the three base modes for every other
      // surface (My Trees keeps large/compact/list without any change).
      var browseModes = ['large', 'compact', 'list', 'story'];

      // Story controller observes #resultsList only; safe to create before
      // the first cards are loaded (it syncs on result-set replacement).
      var storyController = null;
      if (window.LoveBudBrowseStoryView) {
        storyController = window.LoveBudBrowseStoryView.init({
          results: '#resultsList',
          navMount: '#browseStoryNavMount',
        });
      }

      var switcher = window.LoveBudTreeViewModeSwitcher.init({
        storageKey: 'lovebud:browse:viewMode',
        defaultMode: 'compact',
        mount: '#browseViewModeMount',
        target: '#resultsList',
        modes: browseModes,
        onChange: function (mode) {
          if (storyController) storyController.setMode(mode);
        },
      });

      // The switcher does not fire onChange for the restored initial mode,
      // so sync the Story controller once with the persisted choice (a
      // stored `story` preference restores into Story mode here).
      if (switcher && storyController) {
        storyController.setMode(switcher.getCurrentMode());
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  }
})();
