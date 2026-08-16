(function() {
  'use strict';

  const RENAME_MODAL_ID = 'editorRenameModal';
  const RENAME_MODAL_INPUT_ID = 'editorRenameTitleInput';
  const RENAME_MODAL_ERROR_ID = 'editorRenameTitleError';
  const RENAME_MODAL_SAVE_ID = 'editorRenameSaveBtn';
  const RENAME_MODAL_CANCEL_ID = 'editorRenameCancelBtn';

  function getDocumentRef() {
    return typeof document !== 'undefined' ? document : null;
  }

  function getWindowRef() {
    return typeof window !== 'undefined' ? window : null;
  }

  function getEditorRenameI18n(windowRef) {
    const win = windowRef || getWindowRef();
    return win && typeof win.t === 'function' ? win.t : function(key) { return key; };
  }

  function renameText(i18n, key, fallback) {
    if (typeof i18n !== 'function') return fallback;
    const translated = i18n(key);
    return translated && translated !== key ? translated : fallback;
  }

  function showToast(windowRef, i18n, message, type) {
    const win = windowRef || getWindowRef();
    if (win && win.LoveBudUI && typeof win.LoveBudUI.showToast === 'function') {
      win.LoveBudUI.showToast(message, type, 2600);
    }
  }

  function syncEditorTreeTitle(nextTitle) {
    const doc = getDocumentRef();
    if (!doc) return;

    const sidebarTitleEl = doc.getElementById('sidebarTreeTitle');
    if (sidebarTitleEl) sidebarTitleEl.textContent = nextTitle;

    doc.querySelectorAll('.tree-title-text').forEach((el) => {
      el.textContent = nextTitle;
    });
  }

  function getTreeId(currentTree, windowRef) {
    const win = windowRef || getWindowRef();
    const tree = currentTree || (win && win.currentTreeData) || {};
    if (tree.id) return tree.id;
    if (win && win.location && typeof win.URLSearchParams === 'function') {
      return new win.URLSearchParams(win.location.search || '').get('treeId');
    }
    return null;
  }

  function createRenameModalController(options) {
    options = options || {};
    const doc = options.documentRef || getDocumentRef();
    const win = options.windowRef || getWindowRef();
    const getCurrentTitle = options.getCurrentTitle || function() { return ''; };
    const saveTitle = options.saveTitle;
    const reportError = options.reportError;
    const getI18n = options.getI18n || function() { return getEditorRenameI18n(win); };

    let modalEl = null;
    let inputEl = null;
    let errorEl = null;
    let saveBtn = null;
    let cancelBtn = null;
    let lastFocusedEl = null;
    let bound = false;
    let activeI18n = getI18n();

    // Shared accessibility lifecycle (js/shared/modal-a11y.js). Owns Tab
    // containment, Escape, initial focus, and guarded invoker restoration.
    // The surface keeps the visual shell, backdrop close, save/cancel/error
    // state, and input selection behavior.
    const renameA11y = win && win.LoveBudModalA11y ? win.LoveBudModalA11y.createLifecycle({
      documentRef: doc,
      windowRef: win,
      getModal: function() { return modalEl; },
      isOpen: function() { return isOpen(); },
      onRequestClose: function() { closeRenameModal(); },
      canClose: function() { return true; },
      getInitialFocus: function() { return inputEl; },
      getRestoreFocus: function() { return lastFocusedEl; },
      bindTarget: 'document'
    }) : null;

    function element(id, tagName, className) {
      const el = doc.createElement(tagName || 'div');
      el.id = id;
      if (className) el.className = className;
      return el;
    }

    function ensureModal() {
      if (!doc || !doc.createElement || !doc.body) return null;
      if (modalEl && modalEl.parentElement) return modalEl;

      modalEl = element(RENAME_MODAL_ID, 'div', 'editor-rename-modal');
      modalEl.setAttribute('role', 'presentation');
      modalEl.hidden = true;
      modalEl.innerHTML = [
        '<div id="editorRenameModalBackdrop" class="editor-rename-modal-backdrop" data-rename-modal-close="1" aria-hidden="true"></div>',
        '<section class="editor-rename-modal-card" role="dialog" aria-modal="true" aria-labelledby="editorRenameModalTitle" aria-describedby="editorRenameModalDesc">',
        '<div class="editor-rename-modal-header">',
        '<span class="editor-rename-modal-kicker">러브트리 이름</span>',
        '<h2 id="editorRenameModalTitle">트리 제목 수정</h2>',
        '<p id="editorRenameModalDesc">이 트리의 이름을 바꿔요. 공백만 입력하면 저장할 수 없어요.</p>',
        '</div>',
        '<label class="editor-rename-modal-label" for="' + RENAME_MODAL_INPUT_ID + '">트리 제목</label>',
        '<input id="' + RENAME_MODAL_INPUT_ID + '" class="editor-rename-modal-input" type="text" maxlength="60" autocomplete="off" />',
        '<p id="' + RENAME_MODAL_ERROR_ID + '" class="editor-rename-modal-error" role="alert" hidden></p>',
        '<div class="editor-rename-modal-actions">',
        '<button type="button" id="' + RENAME_MODAL_CANCEL_ID + '" class="editor-rename-modal-btn editor-rename-modal-btn-secondary">취소</button>',
        '<button type="button" id="' + RENAME_MODAL_SAVE_ID + '" class="editor-rename-modal-btn editor-rename-modal-btn-primary">저장하기</button>',
        '</div>',
        '</section>'
      ].join('');

      doc.body.appendChild(modalEl);
      const backdropEl = doc.getElementById('editorRenameModalBackdrop');
      if (backdropEl && typeof backdropEl.addEventListener === 'function') {
        backdropEl.addEventListener('click', closeRenameModal);
      }
      inputEl = doc.getElementById(RENAME_MODAL_INPUT_ID);
      errorEl = doc.getElementById(RENAME_MODAL_ERROR_ID);
      saveBtn = doc.getElementById(RENAME_MODAL_SAVE_ID);
      cancelBtn = doc.getElementById(RENAME_MODAL_CANCEL_ID);

        if (!bound) {
          modalEl.addEventListener('click', function(event) {
            const target = event.target || {};
            if (target === modalEl || target.getAttribute && target.getAttribute('data-rename-modal-close') === '1') {
              closeRenameModal();
            }
          });
          // Surface-owned keydown listener delegating to the shared lifecycle;
          // fallback only when the helper is absent.
          doc.addEventListener('keydown', function(event) {
            if (renameA11y) {
              renameA11y.handleKeydown(event);
            } else if ((event.key === 'Escape' || event.keyCode === 27) && isOpen()) {
              closeRenameModal();
            }
          });
          if (cancelBtn) {
            cancelBtn.addEventListener('click', closeRenameModal);
          }
          if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveClick);
          }
          bound = true;
        }

      return modalEl;
    }

    function isOpen() {
      return !!(modalEl && !modalEl.hidden);
    }

    function clearError() {
      if (!errorEl) return;
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    function showError(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function closeRenameModal() {
      if (!isOpen()) return;
      modalEl.hidden = true;
      if (doc.body && doc.body.classList) {
        doc.body.classList.remove('editor-rename-modal-open');
      }
      if (renameA11y) {
        renameA11y.restoreFocusElement(lastFocusedEl);
      } else if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    }

    function openRenameModal(options) {
      options = options || {};
      const opened = ensureModal();
      if (!opened) return null;

      activeI18n = options.i18n || getI18n();
      lastFocusedEl = doc.activeElement || null;
      clearError();
      if (inputEl) {
        inputEl.value = options.currentTitle || getCurrentTitle() || '';
      }
      modalEl.hidden = false;
      if (doc.body && doc.body.classList) {
        doc.body.classList.add('editor-rename-modal-open');
      }
      if (renameA11y) {
        renameA11y.focusInitial();
      } else if (inputEl && typeof inputEl.focus === 'function') {
        inputEl.focus();
      }
      return modalEl;
    }

    async function handleSaveClick() {
      if (!isOpen() || typeof saveTitle !== 'function') return;

      const trimmed = String((inputEl && inputEl.value) || '').trim();
      if (!trimmed) {
        showError(renameText(activeI18n, 'rename_tree_empty_error', '트리 제목을 입력해 주세요.'));
        if (inputEl && typeof inputEl.focus === 'function') inputEl.focus();
        return;
      }

      if (saveBtn) saveBtn.disabled = true;
      try {
        await saveTitle(trimmed);
        closeRenameModal();
      } catch (error) {
        console.error('[editor] rename tree failed:', error);
        if (typeof reportError === 'function') {
          reportError(error);
        }
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    }

    function destroy() {
      if (modalEl && modalEl.parentElement) {
        modalEl.parentElement.removeChild(modalEl);
      }
      modalEl = null;
      inputEl = null;
      errorEl = null;
      saveBtn = null;
      cancelBtn = null;
      bound = false;
    }

    return {
      open: openRenameModal,
      close: closeRenameModal,
      isOpen: isOpen,
      getInput: function() { return inputEl; },
      getModal: function() { return modalEl; },
      destroy: destroy
    };
  }

  function saveEditorTreeTitle(windowRef, currentTree, treeId, nextTitle) {
    const win = windowRef || getWindowRef();
    if (win && win.apiClient && typeof win.apiClient.updateTree === 'function') {
      return win.apiClient.updateTree(treeId, { title: nextTitle }).then(function(updatedTree) {
        // #4055: a confirmed title change makes the public Browse card stale.
        // Purge only after the mutation succeeds.
        try {
          if (win.apiClient && typeof win.apiClient.clearCommunityCaches === 'function') {
            win.apiClient.clearCommunityCaches(treeId);
          }
        } catch (e) {
          console.error('[editor] Failed to clear community caches after rename:', e);
        }
        win.currentTreeData = Object.assign({}, currentTree, updatedTree || {}, { title: nextTitle });
        syncEditorTreeTitle(nextTitle);
        return win.currentTreeData;
      });
    }

    win.currentTreeData = Object.assign({}, currentTree, { title: nextTitle });
    syncEditorTreeTitle(nextTitle);
    return Promise.resolve(win.currentTreeData);
  }

  function openRenameModalForCurrentTree(options) {
    options = options || {};
    const win = getWindowRef();
    const doc = getDocumentRef();
    const i18n = getEditorRenameI18n(win);
    const currentTree = win && win.currentTreeData ? Object.assign({}, win.currentTreeData) : {};
    const treeId = getTreeId(currentTree, win);

    if (options.canEdit === false || !treeId) {
      if (options.canEdit === false && treeId) {
        // Silently fail or handle per requirements; here we just return null as requested.
      } else if (!treeId) {
        showToast(win, i18n, renameText(i18n, 'rename_tree_missing', '트리 정보를 찾을 수 없습니다'), 'error');
      }
      return null;
    }

    const currentTitle = currentTree.title || renameText(i18n, 'lovetree_brand', '러브트리');
    const controller = win && win.LoveBudEditorRenameModal && typeof win.LoveBudEditorRenameModal.createRenameModalController === 'function'
      ? win.LoveBudEditorRenameModal.createRenameModalController({
        windowRef: win,
        documentRef: doc,
        getCurrentTitle: function() { return currentTitle; },
        getI18n: function() { return i18n; },
        saveTitle: function(nextTitle) {
          return saveEditorTreeTitle(win, currentTree, treeId, nextTitle).then(function(updatedTree) {
            if (typeof options.onSaved === 'function') {
              options.onSaved(updatedTree);
            }
            return updatedTree;
          });
        },
        reportError: function(error) {
          console.error('[editor] rename tree failed:', error);
          showToast(win, i18n, renameText(i18n, 'rename_tree_error', '트리 제목 변경에 실패했습니다'), 'error');
        }
      })
      : createRenameModalController({
        windowRef: win,
        documentRef: doc,
        getCurrentTitle: function() { return currentTitle; },
        getI18n: function() { return i18n; },
        saveTitle: function(nextTitle) {
          return saveEditorTreeTitle(win, currentTree, treeId, nextTitle).then(function(updatedTree) {
            if (typeof options.onSaved === 'function') {
              options.onSaved(updatedTree);
            }
            return updatedTree;
          });
        },
        reportError: function(error) {
          console.error('[editor] rename tree failed:', error);
          showToast(win, i18n, renameText(i18n, 'rename_tree_error', '트리 제목 변경에 실패했습니다'), 'error');
        }
      });

    controller.open({ currentTitle: currentTitle, i18n: i18n });
    return controller;
  }

  function openRenameModalForButton(buttonEl) {
    openRenameModalForCurrentTree({
      triggerEl: buttonEl
    });
  }

  function bindEditorRenameButton(buttonEl, canEdit) {
    if (!buttonEl || buttonEl.dataset.renameBound === '1') return;
    if (canEdit === false) {
      buttonEl.style.display = 'none';
      return;
    }
    buttonEl.dataset.renameBound = '1';
    buttonEl.addEventListener('click', function() {
      openRenameModalForButton(buttonEl);
    });
  }

  function injectEditorRenameButton(canEdit) {
    if (canEdit === undefined) {
      const win = getWindowRef();
      canEdit = win && win.LoveBudEditor ? win.LoveBudEditor.canEdit : undefined;
    }
    const doc = getDocumentRef();
    if (!doc) return;
    bindEditorRenameButton(doc.getElementById('renameTreeBtn'), canEdit);
    bindEditorRenameButton(doc.getElementById('sidebarTitleEditBtn'), canEdit);
  }

  const api = {
    createRenameModalController: createRenameModalController,
    openRenameModalForCurrentTree: openRenameModalForCurrentTree,
    syncEditorTreeTitle: syncEditorTreeTitle,
    bindEditorRenameButton: bindEditorRenameButton,
    injectEditorRenameButton: injectEditorRenameButton
  };

  const win = getWindowRef();
  if (win) {
    win.LoveBudEditorRenameModal = api;
    win.openRenameModalForCurrentTree = openRenameModalForCurrentTree;
    win.syncEditorTreeTitle = syncEditorTreeTitle;
    win.bindEditorRenameButton = bindEditorRenameButton;
    win.injectEditorRenameButton = injectEditorRenameButton;
  }

  const doc = getDocumentRef();
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('DOMContentLoaded', function() {
      injectEditorRenameButton();
    });
  }
})();
