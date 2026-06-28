(function() {
  'use strict';

  function bindEditorPageEvents(options) {
    var opts = options || {};
    var canEdit = opts.canEdit === true;
    var sidebarUIHelper = opts.sidebarUIHelper || {};
    var editorBindings = opts.editorBindings || {};
    var emptyGuideUIHelper = opts.emptyGuideUIHelper || {};
    var results = {
      sidebarVisibilityToggle: false,
      memoryCreateControls: false,
      detailEmptyStartButton: false,
      emptyGuideEvents: false,
      detailActionButtons: false,
      panelHistoryBound: false
    };

    // ─────────────────────────────────────────────────────────────────────
    // PR #2449 (UX): browser Back 버튼이 panel을 닫게 함
    //
    // - showAddMemoryForm 호출 시 history state를 가볍게 push
    // - 정상 닫기(X/Esc/outside click) 시 panel state를 back()으로 pop
    // - panel이 열려있을 때 popstate는 panel만 닫음 (browser nav는 진행 안 함)
    // - panel이 닫혀있을 때 popstate는 intercept 하지 않음 (정상 nav)
    // ─────────────────────────────────────────────────────────────────────
    var panelHistoryFactory = (typeof window !== 'undefined'
      && window.LoveBudEditorPanelHistory
      && window.LoveBudEditorPanelHistory.createEditorPanelHistoryController)
      ? window.LoveBudEditorPanelHistory.createEditorPanelHistoryController
      : null;
    var addMemoryFormEl = (typeof document !== 'undefined' && document.getElementById)
      ? document.getElementById('addMemoryForm')
      : null;
    var panelHistory = null;
    if (panelHistoryFactory && addMemoryFormEl) {
      panelHistory = panelHistoryFactory({
        windowRef: (typeof window !== 'undefined') ? window : null,
        isPanelOpen: function () {
          if (!addMemoryFormEl) return false;
          if (addMemoryFormEl.classList.contains('is-open')) return true;
          if (addMemoryFormEl.classList.contains('editor-hidden-initial')) return false;
          return addMemoryFormEl.style.display !== 'none';
        },
        closePanel: function () {
          if (typeof opts.hideAddMemoryForm === 'function') {
            opts.hideAddMemoryForm();
          }
        },
        panelStateKey: 'lovebudEditorPanel',
        panelStateValue: 'add-memory'
      });
    }

    // wrap show/hide with panel history
    var originalShow = opts.showAddMemoryForm;
    var originalHide = opts.hideAddMemoryForm;
    // PR #2449 (Codex P2 fix): pushOnOpen을 originalShow 전에 호출.
    // originalShow가 form을 동기적으로 열면 isPanelOpen()이 true가 되어
    // pushOnOpen이 skip될 수 있음. push를 먼저 해야 Back이 panel만 닫음.
    var wrappedShowAddMemoryForm = function () {
      if (panelHistory) panelHistory.pushOnOpen();
      if (typeof originalShow === 'function') originalShow();
    };
    var wrappedHideAddMemoryForm = function () {
      if (typeof originalHide === 'function') originalHide();
      if (panelHistory) panelHistory.closeAndConsume();
    };

    // popstate listener — bindEditorPageEvents 호출 당 한 번만 등록
    if (panelHistory && !opts._panelHistoryPopStateBound) {
      opts._panelHistoryPopStateBound = true;
      window.addEventListener('popstate', function () {
        panelHistory.handlePopState();
      });
      results.panelHistoryBound = true;
    }

    if (canEdit && typeof sidebarUIHelper.bindSidebarVisibilityToggle === 'function') {
      sidebarUIHelper.bindSidebarVisibilityToggle({
        getTreeId: opts.getTreeId,
        updateTreeVisibility: opts.updateTreeVisibility,
        showToast: opts.showToast,
        safeI18nText: opts.safeI18nText,
        i18n: opts.i18n,
        getHttpStatus: opts.getHttpStatus,
        updateSidebarStatus: opts.updateSidebarStatus
      });
      results.sidebarVisibilityToggle = true;
    }

    if (canEdit && typeof editorBindings.bindMemoryCreateControlsFromDom === 'function') {
      editorBindings.bindMemoryCreateControlsFromDom({
        showAddMemoryForm: wrappedShowAddMemoryForm,
        hideAddMemoryForm: wrappedHideAddMemoryForm,
        addMemoryFromForm: opts.addMemoryFromForm,
        updateSaveStatus: opts.updateSaveStatus,
        showToast: opts.showToast,
        i18n: opts.i18n,
        getTreeMemories: opts.getTreeMemories
      });
      results.memoryCreateControls = true;
    }

    if (canEdit && typeof editorBindings.bindDetailEmptyStartButton === 'function') {
      editorBindings.bindDetailEmptyStartButton({
        showAddMemoryForm: wrappedShowAddMemoryForm,
        getTreeMemories: opts.getTreeMemories
      });
      results.detailEmptyStartButton = true;
    }

    if (typeof emptyGuideUIHelper.bindEmptyGuideEvents === 'function') {
      emptyGuideUIHelper.bindEmptyGuideEvents({
        getEditorCanvas: opts.getEditorCanvas,
        showAddMemoryForm: wrappedShowAddMemoryForm,
        addMemoryFromForm: opts.addMemoryFromForm,
        getTreeMemories: opts.getTreeMemories,
        showToast: opts.showToast,
        i18n: opts.i18n,
        // empty guide UI 자체는 panel history를 직접 호출하지 않음
        // (wrap된 showAddMemoryForm이 push 처리) — 단, future-proof로 노출 가능
        panelHistory: panelHistory
      });
      results.emptyGuideEvents = true;
    }

    if (canEdit && typeof editorBindings.bindDetailActionButtons === 'function') {
      editorBindings.bindDetailActionButtons({
        enterEditMode: opts.enterEditMode,
        deleteMemory: opts.deleteMemory,
        exitEditMode: opts.exitEditMode,
        saveMemoryEdit: opts.saveMemoryEdit
      });
      results.detailActionButtons = true;
    }

    return results;
  }

  window.LoveBudEditorPageEventBindings = Object.freeze({
    bindEditorPageEvents: bindEditorPageEvents
  });
})();
