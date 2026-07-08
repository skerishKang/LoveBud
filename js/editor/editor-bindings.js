// Cache-bust marker for #3294 production no-change feedback rollout.
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
        var mode = window.LoveBudEditorInteractionMode;
        if (!mode || (!mode.isEditMode() && !ensureEditModeForFirstMoment(options && options.getTreeMemories))) return;
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
        var mode = window.LoveBudEditorInteractionMode;
        if (!mode || (!mode.isEditMode() && !ensureEditModeForFirstMoment(options && options.getTreeMemories))) return;
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
          var mode = window.LoveBudEditorInteractionMode;
          if (!mode || (!mode.isEditMode() && !ensureEditModeForFirstMoment(options && options.getTreeMemories))) return;
          addMemoryFromForm();
        }
      });
    }
  }

  function getMemoryCreateControlRefs() {
    return {
      addBtn: document.getElementById('addMemoryBtn'),
      cancelBtn: document.getElementById('cancelAddMemory'),
      confirmBtn: document.getElementById('confirmAddMemory'),
      urlInput: document.getElementById('memoryUrlInput'),
      titleInput: document.getElementById('memoryTitleInput'),
      memoInput: document.getElementById('memoryMemoInput')
    };
  }

  function bindMemoryCreateControlsFromDom(options) {
    var refs = getMemoryCreateControlRefs();

    bindMemoryCreateControls({
      addBtn: refs.addBtn,
      cancelBtn: refs.cancelBtn,
      confirmBtn: refs.confirmBtn,
      urlInput: refs.urlInput,
      titleInput: refs.titleInput,
      memoInput: refs.memoInput,
      showAddMemoryForm: options && options.showAddMemoryForm,
      hideAddMemoryForm: options && options.hideAddMemoryForm,
      addMemoryFromForm: options && options.addMemoryFromForm,
      updateSaveStatus: options && options.updateSaveStatus,
      showToast: options && options.showToast,
      i18n: options && options.i18n,
      getTreeMemories: options && options.getTreeMemories
    });
  }

  function ensureEditModeForFirstMoment(getTreeMemories) {
    var mode = window.LoveBudEditorInteractionMode;
    if (!mode) return false;
    if (mode.isEditMode()) return true;
    if (typeof getTreeMemories !== 'function') return false;
    var memories = getTreeMemories();
    if (memories && memories.length === 0) {
      mode.setMode(mode.MODE_EDIT);
      return true;
    }
    return false;
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

  function bindDetailEmptyStartButton(options) {
    var showAddMemoryForm = options && options.showAddMemoryForm;
    var detailEmptyStartBtn = getDetailButton('detailEmptyStartBtn');

    bindButtonOnce(detailEmptyStartBtn, 'detailEmptyStartBound', function() {
      var mode = window.LoveBudEditorInteractionMode;
      if (!mode || (!mode.isEditMode() && !ensureEditModeForFirstMoment(options && options.getTreeMemories))) return;
      if (typeof showAddMemoryForm === 'function') {
        showAddMemoryForm();
      }
    });
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

  function shouldIgnoreDirectEditTarget(event) {
    return !!(event && event.target && event.target.closest && event.target.closest('button, a, input, textarea, select, [contenteditable="true"]'));
  }

  function requestDirectNodeEdit(nodeEl, enterEditMode) {
    if (!nodeEl || typeof enterEditMode !== 'function') return;
    if (nodeEl.dataset.directEditLock === '1') return;
    nodeEl.dataset.directEditLock = '1';

    try {
      nodeEl.click();
    } catch (error) {}

    setTimeout(function() {
      try {
        enterEditMode({ type: 'directNodeEdit', target: nodeEl });
      } finally {
        nodeEl.dataset.directEditLock = '';
      }
    }, 0);
  }

  function bindCanvasNodeDirectEdit(options) {
    var enterEditMode = options && options.enterEditMode;
    if (typeof enterEditMode !== 'function') return false;
    if (document.documentElement.dataset.editorNodeDirectEditBound === '1') return false;
    document.documentElement.dataset.editorNodeDirectEditBound = '1';

    function guardEnterEdit(nodeEl) {
      var mode = window.LoveBudEditorInteractionMode;
      if (!mode || !mode.isEditMode()) return;
      requestDirectNodeEdit(nodeEl, enterEditMode);
    }

    var tapThreshold = 10;
    var doubleTapDelay = 360;
    var touchStartPoint = null;
    var lastTap = { time: 0, node: null };

    document.addEventListener('dblclick', function(event) {
      if (shouldIgnoreDirectEditTarget(event)) return;
      var nodeEl = event.target && event.target.closest && event.target.closest('.memory-node');
      if (!nodeEl) return;
      event.preventDefault();
      event.stopPropagation();
      guardEnterEdit(nodeEl);
    }, true);

    document.addEventListener('touchstart', function(event) {
      if (shouldIgnoreDirectEditTarget(event)) return;
      var nodeEl = event.target && event.target.closest && event.target.closest('.memory-node');
      if (!nodeEl) return;
      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      touchStartPoint = { x: touch.clientX, y: touch.clientY, node: nodeEl };
    }, { passive: true, capture: true });

    document.addEventListener('touchend', function(event) {
      if (!touchStartPoint || shouldIgnoreDirectEditTarget(event)) return;
      var nodeEl = event.target && event.target.closest && event.target.closest('.memory-node');
      var touch = event.changedTouches && event.changedTouches[0];
      if (!nodeEl || !touch || nodeEl !== touchStartPoint.node) {
        touchStartPoint = null;
        return;
      }

      var dx = touch.clientX - touchStartPoint.x;
      var dy = touch.clientY - touchStartPoint.y;
      touchStartPoint = null;
      if (Math.abs(dx) > tapThreshold || Math.abs(dy) > tapThreshold) return;

      var now = Date.now();
      var isDoubleTap = lastTap.node === nodeEl && (now - lastTap.time) <= doubleTapDelay;
      lastTap = { time: now, node: nodeEl };
      if (!isDoubleTap) return;

      event.preventDefault();
      event.stopPropagation();
      guardEnterEdit(nodeEl);
      lastTap = { time: 0, node: null };
    }, { passive: false, capture: true });

    document.addEventListener('touchcancel', function() {
      touchStartPoint = null;
      lastTap = { time: 0, node: null };
    }, { passive: true, capture: true });

    return true;
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
      var mode = window.LoveBudEditorInteractionMode;
      if (!mode || !mode.isEditMode()) return;
      var latestDeleteBtn = getDetailButton('deleteMemoryBtn');
      hideCurrentMemoryViewModeSecondaryActions(detailPanel, latestDeleteBtn);
      ensureEditModeDeleteButton(latestDeleteBtn, deleteMemory);
      enterEditMode(e);
    });

    bindButtonOnce(deleteMemoryBtn, 'deleteBound', function() {
      var mode = window.LoveBudEditorInteractionMode;
      if (!mode || !mode.isEditMode()) return;
      deleteMemory();
    });
    bindButtonOnce(cancelEditBtn, 'cancelBound', exitEditMode);
    bindButtonOnce(saveEditBtn, 'saveBound', function() {
      if (window.__LOVEBUD_DIAGNOSTICS_ACTIVE__) window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__ = 'SAVE_CLICK_RECEIVED';
      if (typeof saveMemoryEdit === 'function') saveMemoryEdit();
    });

    // Ctrl+Enter / Meta+Enter keyboard shortcut for save (in editMemoInput).
    // Plain Enter in textarea is preserved as newline — save is NOT triggered.
    var editMemoInput = document.getElementById('editMemoInput');
    if (editMemoInput && !editMemoInput.dataset.saveShortcutBound) {
      editMemoInput.dataset.saveShortcutBound = '1';
      editMemoInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (window.__LOVEBUD_DIAGNOSTICS_ACTIVE__) window.__LOVEBUD_LAST_SAVE_DIAGNOSTIC__ = 'SAVE_CLICK_RECEIVED';
          if (typeof saveMemoryEdit === 'function') saveMemoryEdit();
        }
      });
    }

    bindCanvasNodeDirectEdit({ enterEditMode: enterEditMode });
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

  // ── Connect Existing Moment (Slice 2 #2804) ────────────────────────────

    function createConnectExistingController(options) {
    var connectMemory = options && options.connectMemory;
    var getCurrentEditingMemory = options && options.getCurrentEditingMemory;
    var isRootMemory = options && options.isRootMemory;
    var getCanonicalRootId = options && options.getCanonicalRootId;
    var showToast = options && options.showToast;
    var i18n = options && options.i18n;
    var validateConnectCandidate = options && options.validateConnectCandidate;
    var canEdit = options && options.canEdit;

    var editorCanvas = null;
    var targetData = null;

    var ctaSection = document.getElementById('connectExistingCtaSection');
    var ctaBtn = document.getElementById('connectExistingCtaBtn');
    var pendingSection = document.getElementById('connectExistingPendingSection');
    var pendingCancelBtn = document.getElementById('connectExistingCancelBtn');
    var confirmSection = document.getElementById('connectExistingConfirmSection');
    var confirmHint = document.getElementById('connectExistingConfirmHint');
    var confirmBtn = document.getElementById('connectExistingConfirmBtn');
    var confirmCancelBtn = document.getElementById('connectExistingConfirmCancelBtn');

    var _bindMode = false;

    function setEditorCanvas(canvas) {
      editorCanvas = canvas;
      if (editorCanvas && typeof editorCanvas.setOnPendingConnectCleared === 'function') {
        editorCanvas.setOnPendingConnectCleared(function() {
          targetData = null;
          hideAll();
          updateCtaVisibility();
        });
      }
    }

    function setConnectMemory(fn) {
      connectMemory = fn;
    }

    function setValidateConnectCandidate(fn) {
      validateConnectCandidate = fn;
    }

    function resetConnectFlow() {
      targetData = null;
      if (editorCanvas) editorCanvas.clearPendingConnect();
      hideAll();
      updateCtaVisibility();
    }

    function enterConnectMode() {
      if (canEdit === false) return;
      var sourceId = editorCanvas ? editorCanvas.getPendingConnectSourceId() : null;
      if (sourceId) return;

      var mem = getCurrentEditingMemory ? getCurrentEditingMemory() : null;
      if (!mem || !mem.id || !editorCanvas) return;

      var canonicalRootId = typeof getCanonicalRootId === 'function'
        ? getCanonicalRootId() : 'root';
      var isRoot = typeof isRootMemory === 'function' && isRootMemory(mem, canonicalRootId);
      if (isRoot) {
        if (typeof showToast === 'function') {
          showToast('루트 순간은 연결할 수 없어요', 'error');
        }
        return;
      }

      var posFn = editorCanvas.calcPosition;
      var pos = typeof posFn === 'function' ? posFn(mem) : null;
      editorCanvas.setPendingConnect(mem.id, pos);
      showSection('pending');
    }

    function exitConnectMode() {
      resetConnectFlow();
    }

    function showSection(name) {
      hideAll();
      if (name === 'cta' && ctaSection) ctaSection.style.display = '';
      if (name === 'pending' && pendingSection) pendingSection.style.display = '';
      if (name === 'confirm' && confirmSection) confirmSection.style.display = '';
    }

    function hideAll() {
      if (ctaSection) ctaSection.style.display = 'none';
      if (pendingSection) pendingSection.style.display = 'none';
      if (confirmSection) confirmSection.style.display = 'none';
    }

    function handleConnectTargetSelect(targetMem, targetPos) {
      if (canEdit === false) return;
      var sourceId = editorCanvas ? editorCanvas.getPendingConnectSourceId() : null;
      if (!sourceId || !targetMem) return;

      if (String(sourceId) === String(targetMem.id)) return;

      if (typeof validateConnectCandidate === 'function') {
        var check = validateConnectCandidate(sourceId, targetMem.id);
        if (!check.ok) {
          if (typeof showToast === 'function') {
            var msgs = {
              source_is_root: '루트 순간은 연결할 수 없어요',
              target_is_root: '루트 순간으로 연결할 수 없어요',
              self_connection: '같은 순간으로 연결할 수 없어요',
              already_connected: '이미 연결된 순간입니다',
              target_is_descendant: '하위 순간을 부모로 연결할 수 없어요',
              target_chain_missing_parent: '연결할 수 없는 대상 순간입니다',
              target_chain_loop: '대상 순간의 연결 구조를 확인할 수 없습니다'
            };
            showToast(
              msgs[check.reason] || '연결할 수 없는 대상입니다',
              'error'
            );
          }
          return;
        }
      }

      // Draw preview only after validation passes
      if (editorCanvas && typeof editorCanvas.drawConnectPreview === 'function') {
        editorCanvas.drawConnectPreview(targetPos);
      }

      targetData = { mem: targetMem, pos: targetPos };
      if (confirmHint) {
        var label = targetMem.title || '';
        confirmHint.textContent = (label ? '"' + label + '" ' : '') + '(으)로 연결할까요?';
      }
      showSection('confirm');
    }

    function handleConfirm() {
      if (canEdit === false) return;
      if (!targetData || typeof connectMemory !== 'function') return;
      var sourceId = editorCanvas ? editorCanvas.getPendingConnectSourceId() : null;
      if (!sourceId) return;

      connectMemory(sourceId, targetData.mem.id).then(function(success) {
        if (success) {
          resetConnectFlow();
        } else {
          showSection('confirm');
        }
      });
    }

    function handleCancel() {
      resetConnectFlow();
    }

    function updateCtaVisibility() {
      if (canEdit === false) { hideAll(); return; }
      var mode = window.LoveBudEditorInteractionMode;
      var isEdit = mode && typeof mode.isEditMode === 'function' && mode.isEditMode();
      if (!isEdit) { hideAll(); return; }

      var mem = getCurrentEditingMemory ? getCurrentEditingMemory() : null;
      if (!mem) { hideAll(); return; }

      var canonicalRootId = typeof getCanonicalRootId === 'function' ? getCanonicalRootId() : 'root';
      var isRoot = typeof isRootMemory === 'function' && isRootMemory(mem, canonicalRootId);
      if (isRoot) { hideAll(); return; }

      var sourceId = editorCanvas ? editorCanvas.getPendingConnectSourceId() : null;
      if (sourceId) return;

      showSection('cta');
    }

    function updateCtaNow() {
      updateCtaVisibility();
    }

    function bindControls() {
      if (_bindMode) return;
      _bindMode = true;

      if (ctaBtn && !ctaBtn.dataset.connectBound) {
        ctaBtn.dataset.connectBound = '1';
        ctaBtn.addEventListener('click', function() { enterConnectMode(); });
      }
      if (pendingCancelBtn && !pendingCancelBtn.dataset.connectPendingCancelBound) {
        pendingCancelBtn.dataset.connectPendingCancelBound = '1';
        pendingCancelBtn.addEventListener('click', function() { handleCancel(); });
      }
      if (confirmBtn && !confirmBtn.dataset.connectConfirmBound) {
        confirmBtn.dataset.connectConfirmBound = '1';
        confirmBtn.addEventListener('click', function() { handleConfirm(); });
      }
      if (confirmCancelBtn && !confirmCancelBtn.dataset.connectConfirmCancelBound) {
        confirmCancelBtn.dataset.connectConfirmCancelBound = '1';
        confirmCancelBtn.addEventListener('click', function() { handleCancel(); });
      }

      var mode = window.LoveBudEditorInteractionMode;
      if (mode && typeof mode.subscribe === 'function' && !mode._connectExistingSubscribed) {
        mode._connectExistingSubscribed = true;
        mode.subscribe(function() { updateCtaVisibility(); });
      }

      hideAll();
    }

    return {
      setEditorCanvas: setEditorCanvas,
      setConnectMemory: setConnectMemory,
      setValidateConnectCandidate: setValidateConnectCandidate,
      handleConnectTargetSelect: handleConnectTargetSelect,
      bindControls: bindControls,
      exitConnectMode: exitConnectMode,
      showCtaSection: function() { showSection('cta'); },
      resetConnectFlow: resetConnectFlow,
      updateCtaNow: updateCtaNow
    };
  }

  window.LoveBudEditorBindings = {
    bindMemoryCreateControls: bindMemoryCreateControls,
    bindMemoryCreateControlsFromDom: bindMemoryCreateControlsFromDom,
    bindDetailEmptyStartButton: bindDetailEmptyStartButton,
    bindDetailActionButtons: bindDetailActionButtons,
    hideUnimplementedButtons: hideUnimplementedButtons,
    createConnectExistingController: createConnectExistingController
  };
})();
