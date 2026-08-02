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
        // #3845 Browse-only truthful navigation: `positionMode: 'current'`
        // shows the current local Story group index without a loaded-total
        // denominator, and the bounded canRequestMore/requestMore boundary
        // lets Next request exactly one more batch through the EXISTING
        // Browse loader authority (window.LoveBudBrowseStoryLoadMore, set by
        // js/search/index.js). The shared controller never fetches itself.
        storyController = window.LoveBudBrowseStoryView.init({
          results: '#resultsList',
          navMount: '#browseStoryNavMount',
          positionMode: 'current',
          canRequestMore: function () {
            var loader = window.LoveBudBrowseStoryLoadMore;
            return !!(loader && typeof loader.canRequestMore === 'function' && loader.canRequestMore());
          },
          requestMore: function () {
            var loader = window.LoveBudBrowseStoryLoadMore;
            if (loader && typeof loader.requestMore === 'function') {
              return loader.requestMore();
            }
            return Promise.resolve(false);
          },
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
