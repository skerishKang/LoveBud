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
    var storyAdapter = null;

    var ready = function() {
      var switcherApi = window.LoveBudTreeViewModeSwitcher.init({
        storageKey: 'lovebud:myTrees:viewMode',
        // #3608 Phase 1: empty/invalid storage falls back to compact so both
        // Browse and My Trees share the same default appreciation density.
        // Valid saved large/list preferences are preserved by the switcher.
        defaultMode: 'compact',
        mount: '#myTreesViewModeMount',
        target: '#trees-grid',
        // #3811: My Trees gains an optional fourth mode `story` on the
        // shared switcher. Browse and My Trees storage keys stay separate.
        modes: ['large', 'compact', 'list', 'story'],
        onChange: function(mode) {
          if (storyAdapter && typeof storyAdapter.setStoryMode === 'function') {
            storyAdapter.setStoryMode(mode);
          }
        }
      });

      // #3811: thin My Trees Story adapter over LoveBudBrowseStoryView.
      // Initialized exactly once; re-entry/restore goes through setStoryMode
      // and the shared controller's own settled state (no duplicate listeners).
      if (window.LoveBudMyTreesStoryView && typeof window.LoveBudMyTreesStoryView.create === 'function') {
        storyAdapter = window.LoveBudMyTreesStoryView.create({
          grid: '#trees-grid',
          navMount: '#myTreesStoryNavMount'
        });
      }

      // Restore a stored `story` preference on first boot. The grid may not
      // be mounted yet (loading/empty/error); the adapter stays pending and
      // activates once real cards exist.
      if (storyAdapter && switcherApi && typeof switcherApi.getCurrentMode === 'function') {
        storyAdapter.setStoryMode(switcherApi.getCurrentMode());
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  }
})();
