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

  function moveDeleteButtonIntoEditMode(deleteMemoryBtn) {
    if (!deleteMemoryBtn) return;

    var editMode = document.getElementById('detailEditMode');
    var editActions = editMode ? editMode.querySelector('.editor-edit-actions-row') : null;
    if (!editActions) return;

    deleteMemoryBtn.classList.add('editor-edit-danger-action');
    deleteMemoryBtn.setAttribute('aria-label', deleteMemoryBtn.textContent || '순간 삭제');
    deleteMemoryBtn.style.removeProperty('display');

    if (deleteMemoryBtn.parentElement !== editActions) {
      editActions.insertBefore(deleteMemoryBtn, editActions.firstChild);
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

    if (!deleteMemoryBtn) return;
    var viewMode = document.getElementById('detailViewMode');
    var editMode = document.getElementById('detailEditMode');
    var isInsideViewMode = !!(viewMode && viewMode.contains(deleteMemoryBtn));
    var isInsideEditMode = !!(editMode && editMode.contains(deleteMemoryBtn));

    if (isInsideViewMode && !isInsideEditMode) {
      deleteMemoryBtn.style.setProperty('display', 'none', 'important');
      deleteMemoryBtn.setAttribute('aria-hidden', 'true');
      deleteMemoryBtn.tabIndex = -1;
    } else if (isInsideEditMode) {
      deleteMemoryBtn.style.removeProperty('display');
      deleteMemoryBtn.removeAttribute('aria-hidden');
      deleteMemoryBtn.removeAttribute('tabindex');
    }
  }

  function watchCurrentMemoryViewModeActions(detailPanel, deleteMemoryBtn) {
    if (!detailPanel || detailPanel.dataset.currentMemoryActionWatchBound === '1') return;
    detailPanel.dataset.currentMemoryActionWatchBound = '1';

    hideCurrentMemoryViewModeSecondaryActions(detailPanel, deleteMemoryBtn);

    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function() {
      moveDeleteButtonIntoEditMode(deleteMemoryBtn);
      hideCurrentMemoryViewModeSecondaryActions(detailPanel, deleteMemoryBtn);
    });

    observer.observe(detailPanel, {
      childList: true,
      subtree: true
    });
  }

  function bindDetailActionButtons(options) {
    var editMemoryBtn = options && options.editMemoryBtn;
    var deleteMemoryBtn = options && options.deleteMemoryBtn;
    var cancelEditBtn = options && options.cancelEditBtn;
    var saveEditBtn = options && options.saveEditBtn;
    var enterEditMode = options && options.enterEditMode;
    var deleteMemory = options && options.deleteMemory;
    var exitEditMode = options && options.exitEditMode;
    var saveMemoryEdit = options && options.saveMemoryEdit;
    var detailPanel = document.getElementById('detailPanel');

    moveDeleteButtonIntoEditMode(deleteMemoryBtn);
    watchCurrentMemoryViewModeActions(detailPanel, deleteMemoryBtn);

    if (editMemoryBtn && typeof enterEditMode === 'function') {
      editMemoryBtn.addEventListener('click', function(e) {
        moveDeleteButtonIntoEditMode(deleteMemoryBtn);
        hideCurrentMemoryViewModeSecondaryActions(detailPanel, deleteMemoryBtn);
        enterEditMode(e);
      });
    }
    if (deleteMemoryBtn && typeof deleteMemory === 'function') {
      deleteMemoryBtn.addEventListener('click', deleteMemory);
    }
    if (cancelEditBtn && typeof exitEditMode === 'function') {
      cancelEditBtn.addEventListener('click', exitEditMode);
    }
    if (saveEditBtn && typeof saveMemoryEdit === 'function') {
      saveEditBtn.addEventListener('click', saveMemoryEdit);
    }
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
