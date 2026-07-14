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

    // Bind a click handler exactly once per element using a dataset flag.
    // Mirrors the helper in editor-bindings.js to keep this module self-contained.
    function bindButtonOnce(button, bindingKey, handler) {
      if (!button || typeof handler !== 'function') return false;
      if (button.dataset[bindingKey] === '1') return false;
      button.dataset[bindingKey] = '1';
      button.addEventListener('click', handler);
      return true;
    }

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
      updateFormConnectEntryVisibility();
    };

    // ── Form-level existing-moment connection entry (#3502) ──
    // While the new-moment form is open, #detailContent is inert + aria-hidden,
    // so the detail "기존 순간 연결하기" CTA is unreachable. This entry lives
    // inside the active form surface and routes through the existing guarded
    // connect controller — it never proxies the inert detail CTA and never
    // falls back to new-moment creation.
    var formConnectRow = (typeof document !== 'undefined')
      ? document.getElementById('connectExistingFromFormRow')
      : null;
    var formConnectBtn = (typeof document !== 'undefined')
      ? document.getElementById('connectExistingFromFormBtn')
      : null;

    function updateFormConnectEntryVisibility() {
      var controller = opts.connectExistingController;
      var available = Boolean(
        formConnectRow &&
        formConnectBtn &&
        controller &&
        typeof controller.isConnectEntryAvailable === 'function' &&
        controller.isConnectEntryAvailable()
      );

      if (formConnectRow) {
        formConnectRow.hidden = !available;
      }

      if (formConnectBtn) {
        formConnectBtn.hidden = !available;
        formConnectBtn.disabled = !available;
        formConnectBtn.tabIndex = available ? 0 : -1;
        formConnectBtn.setAttribute(
          'aria-hidden',
          available ? 'false' : 'true'
        );
      }

      return available;
    }

    if (formConnectBtn && opts.connectExistingController && typeof opts.connectExistingController.startConnectMode === 'function') {
      bindButtonOnce(formConnectBtn, 'formConnectEntryBound', function (event) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }

        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }

        var controller = opts.connectExistingController;

        var available = Boolean(
          controller &&
          typeof controller.isConnectEntryAvailable === 'function' &&
          controller.isConnectEntryAvailable()
        );

        if (!available) {
          updateFormConnectEntryVisibility();
          return;
        }

        if (typeof wrappedHideAddMemoryForm === 'function') {
          wrappedHideAddMemoryForm();
        }

        controller.startConnectMode();
      });
    }

    // Keep the form entry synchronized with interaction-mode changes.
    // Selection/current-memory eligibility is revalidated whenever the form
    // opens and immediately before the form-level connect action executes.
    if (typeof window !== 'undefined' && window.LoveBudEditorInteractionMode && typeof window.LoveBudEditorInteractionMode.subscribe === 'function') {
      window.LoveBudEditorInteractionMode.subscribe(function () {
        updateFormConnectEntryVisibility();
      });
    }
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

    // #3327: detail action buttons are ALWAYS bound so the save/cancel/edit
    // controls remain interactive regardless of when effectiveCanEdit resolves.
    // MutationObserver re-binding inside bindDetailActionButtons already makes
    // this idempotent. Actual mutation (save/edit/delete) is still gated by the
    // canEdit===false guards inside editor-memory-actions.js, so read-only users
    // get a visible-but-harmless control surface rather than a dead one. The
    // contract flag still reflects editability so callers can observe whether
    // the owner-capability was active at bind time.
    if (typeof editorBindings.bindDetailActionButtons === 'function') {
      editorBindings.bindDetailActionButtons({
        canEdit: canEdit,
        enterEditMode: opts.enterEditMode,
        deleteMemory: opts.deleteMemory,
        exitEditMode: opts.exitEditMode,
        saveMemoryEdit: opts.saveMemoryEdit
      });
      results.detailActionButtons = true;
    }

    // Bind Shortcut Help Trigger Button
    var helpBtn = (typeof document !== 'undefined') ? document.getElementById('editorShortcutHelpBtn') : null;
    if (helpBtn && window.LoveBudEditorShortcutHelp) {
      const helpController = window.LoveBudEditorShortcutHelp.createShortcutHelpController({
        windowRef: (typeof window !== 'undefined') ? window : null,
        documentRef: (typeof document !== 'undefined') ? document : null,
        i18n: opts.i18n,
        triggerEl: helpBtn
      });
      helpBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        helpController.open();
      });
    }

    // Initial fail-closed synchronization
    updateFormConnectEntryVisibility();

    return results;
  }

  window.LoveBudEditorPageEventBindings = Object.freeze({
    bindEditorPageEvents: bindEditorPageEvents
  });
})();
