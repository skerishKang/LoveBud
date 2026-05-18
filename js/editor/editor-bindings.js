/**
 * LoveBud - Editor Bindings
 * v20260420-1
 *
 * Responsibilities:
 * - bind add-memory form controls
 * - bind detail action buttons
 * - hide temporary/unimplemented controls
 */

(function() {
  function bindMemoryCreateControls(options) {
    var addBtn = options && options.addBtn;
    var cancelBtn = options && options.cancelBtn;
    var confirmBtn = options && options.confirmBtn;
    var urlInput = options && options.urlInput;
    var titleInput = options && options.titleInput;
    var memoInput = options && options.memoInput;
    var showAddMemoryForm = options && options.showAddMemoryForm;
    var hideAddMemoryForm = options && options.hideAddMemoryForm;
    var addMemoryFromForm = options && options.addMemoryFromForm;
    var updateSaveStatus = options && options.updateSaveStatus;
    var showToast = options && options.showToast;
    var i18n = options && options.i18n;

    if (addBtn) {
      addBtn.disabled = false;
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof showAddMemoryForm === 'function') {
          showAddMemoryForm();
        }
      });
    }

    if (cancelBtn && typeof hideAddMemoryForm === 'function') {
      cancelBtn.addEventListener('click', hideAddMemoryForm);
    }

    if (confirmBtn && typeof addMemoryFromForm === 'function') {
      confirmBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addMemoryFromForm().catch(function(err) {
          console.error('[editor] Failed to add memory:', err);
          if (typeof updateSaveStatus === 'function') {
            updateSaveStatus('failed', typeof i18n === 'function' ? i18n('save_failed') : '저장 실패');
          }
          if (typeof showToast === 'function') {
            showToast((typeof i18n === 'function' ? i18n('record_error') : null) || '기록 중 오류가 발생했습니다', 'error');
          }
        });
      });
    }

    if (urlInput && titleInput) {
      urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') titleInput.focus();
      });
    }

    if (titleInput && memoInput) {
      titleInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') memoInput.focus();
      });
    }

    if (memoInput && typeof addMemoryFromForm === 'function') {
      memoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          addMemoryFromForm();
        }
      });
    }
  }

  function bindButtonOnce(button, bindingKey, handler) {
    if (!button || typeof handler !== 'function') return false;
    if (button.dataset[bindingKey] === '1') return false;
    button.dataset[bindingKey] = '1';
    button.addEventListener('click', handler);
    return true;
  }

  function getDetailButton(id) {
    return document.getElementById(id);
  }

  function ensureDeleteButtonInCurrentMomentActions(deleteMemoryBtn) {
    // Delete button moved to edit mode — no longer inserted in card view.
    if (deleteMemoryBtn) {
      deleteMemoryBtn.classList.remove('editor-edit-danger-action');
      deleteMemoryBtn.setAttribute('aria-label', deleteMemoryBtn.textContent || '순간 삭제');
    }
  }

  function hideCurrentMemoryViewModeSecondaryActions(detailPanel, deleteMemoryBtn) {
    if (!detailPanel) return;

    var titleEditButtons = detailPanel.querySelectorAll('#detailViewMode #detailCurrentMomentTitle .memory-edit-button');
    titleEditButtons.forEach(function(btn) {
      btn.style.setProperty('display', 'none', 'important');
      btn.setAttribute('aria-hidden', 'true');
      btn.tabIndex = -1;
    });

    ensureDeleteButtonInCurrentMomentActions(deleteMemoryBtn);
  }

  function ensureEditModeDeleteButton(deleteMemoryBtn, deleteMemory) {
    if (!deleteMemoryBtn || typeof deleteMemory !== 'function') return null;

    var editMode = document.getElementById('detailEditMode');
    if (!editMode) return null;

    // Use the existing delete button already in the edit mode HTML
    var editDeleteBtn = getDetailButton('deleteMemoryBtn');
    if (!editDeleteBtn || editDeleteBtn.closest('#detailEditMode') !== editMode) return null;

    bindButtonOnce(editDeleteBtn, 'deleteBound', deleteMemory);

    return editDeleteBtn;
  }

  function bindCurrentDetailActionButtons(options) {
    var detailPanel = options && options.detailPanel;
    var enterEditMode = options && options.enterEditMode;
    var deleteMemory = options && options.deleteMemory;
    var exitEditMode = options && options.exitEditMode;
    var saveMemoryEdit = options && options.saveMemoryEdit;

    var editMemoryBtn = getDetailButton('editMemoryBtn');
    var deleteMemoryBtn = getDetailButton('deleteMemoryBtn');
    var cancelEditBtn = getDetailButton('cancelEditBtn');
    var saveEditBtn = getDetailButton('saveEditBtn');

    ensureDeleteButtonInCurrentMomentActions(deleteMemoryBtn);
    ensureEditModeDeleteButton(deleteMemoryBtn, deleteMemory);

    bindButtonOnce(editMemoryBtn, 'editBound', function(e) {
      var latestDeleteBtn = getDetailButton('deleteMemoryBtn');
      hideCurrentMemoryViewModeSecondaryActions(detailPanel, latestDeleteBtn);
      ensureEditModeDeleteButton(latestDeleteBtn, deleteMemory);
      enterEditMode(e);
    });

    bindButtonOnce(deleteMemoryBtn, 'deleteBound', deleteMemory);
    bindButtonOnce(cancelEditBtn, 'cancelBound', exitEditMode);
    bindButtonOnce(saveEditBtn, 'saveBound', saveMemoryEdit);
  }

  function watchCurrentMemoryViewModeActions(options) {
    var detailPanel = options && options.detailPanel;
    if (!detailPanel || detailPanel.dataset.currentMemoryActionWatchBound === '1') return;
    detailPanel.dataset.currentMemoryActionWatchBound = '1';

    bindCurrentDetailActionButtons(options);

    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function() {
      bindCurrentDetailActionButtons(options);
    });

    observer.observe(detailPanel, {
      childList: true,
      subtree: true
    });
  }

  function bindDetailActionButtons(options) {
    var detailPanel = document.getElementById('detailPanel');
    var bindingOptions = {
      detailPanel: detailPanel,
      enterEditMode: options && options.enterEditMode,
      deleteMemory: options && options.deleteMemory,
      exitEditMode: options && options.exitEditMode,
      saveMemoryEdit: options && options.saveMemoryEdit
    };

    bindCurrentDetailActionButtons(bindingOptions);
    watchCurrentMemoryViewModeActions(bindingOptions);
  }

  function hideUnimplementedButtons(detailPanel) {
    if (!detailPanel) return;

    var moreBtn = detailPanel.querySelector('.icon-btn');
    var footerBtn = detailPanel.querySelector('.panel-footer');

    if (moreBtn) moreBtn.style.display = 'none';
    if (footerBtn) footerBtn.style.display = 'none';
  }

  window.LoveBudEditorBindings = {
    bindMemoryCreateControls: bindMemoryCreateControls,
    bindDetailActionButtons: bindDetailActionButtons,
    hideUnimplementedButtons: hideUnimplementedButtons
  };
})();