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
      detailActionButtons: false
    };

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
        showAddMemoryForm: opts.showAddMemoryForm,
        hideAddMemoryForm: opts.hideAddMemoryForm,
        addMemoryFromForm: opts.addMemoryFromForm,
        updateSaveStatus: opts.updateSaveStatus,
        showToast: opts.showToast,
        i18n: opts.i18n
      });
      results.memoryCreateControls = true;
    }

    if (canEdit && typeof editorBindings.bindDetailEmptyStartButton === 'function') {
      editorBindings.bindDetailEmptyStartButton({
        showAddMemoryForm: opts.showAddMemoryForm
      });
      results.detailEmptyStartButton = true;
    }

    if (typeof emptyGuideUIHelper.bindEmptyGuideEvents === 'function') {
      emptyGuideUIHelper.bindEmptyGuideEvents({
        getEditorCanvas: opts.getEditorCanvas,
        showAddMemoryForm: opts.showAddMemoryForm,
        addMemoryFromForm: opts.addMemoryFromForm,
        getTreeMemories: opts.getTreeMemories,
        showToast: opts.showToast,
        i18n: opts.i18n
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
