/**
 * LoveBud Editor — Floating Toolbar Dropdown Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides dropdown visibility, positioning, event binding,
 * and secondary action dispatch for the floating toolbar's "..." menu.
 *
 * No behavior change.
 */

(function () {
  'use strict';

  var IS_VISIBLE_CLASS = 'is-visible';
  var IS_HIDDEN_CLASS = 'is-hidden';

  /**
   * Determine whether the editor is currently in a read-only state.
   * Priority: window.LoveBudEditor.canEdit === false, then body.editor-readonly class.
   * Returns true when read-only, false when editable.
   * Does NOT introduce a new global flag — relies on existing editor state.
   */
  function isEditorReadOnly() {
    if (window.LoveBudEditor && window.LoveBudEditor.canEdit === false) {
      return true;
    }
    if (document.body && document.body.classList.contains('editor-readonly')) {
      return true;
    }
    return false;
  }

  /**
   * Sync Scout action item visibility with the current editability state.
   * When read-only, the Scout action item is hidden from the dropdown.
   * When editable, it is shown (default).
   */
  function syncScoutActionVisibility(scoutAction) {
    if (!scoutAction) return;
    if (isEditorReadOnly()) {
      scoutAction.classList.add(IS_HIDDEN_CLASS);
      scoutAction.style.display = 'none';
      scoutAction.setAttribute('aria-hidden', 'true');
    } else {
      scoutAction.classList.remove(IS_HIDDEN_CLASS);
      scoutAction.style.display = '';
      scoutAction.removeAttribute('aria-hidden');
    }
  }

  /**
   * Position the dropdown below/right of the "..." button.
   */
  function positionDropdown(dropdown, moreBtn) {
    if (!dropdown || !moreBtn) return;
    var toolbar = moreBtn.closest('.editor-floating-toolbar');
    if (toolbar && toolbar.contains(dropdown)) {
      var triggerRect = moreBtn.getBoundingClientRect();
      var toolbarRect = toolbar.getBoundingClientRect();
      var ddW = dropdown.offsetWidth || 210;
      var ddH = dropdown.offsetHeight || 280;
      var openUpward = triggerRect.bottom + 8 + ddH > window.innerHeight - 8;
      var alignLeft = toolbarRect.right - ddW < 8;

      dropdown.style.left = alignLeft ? '0' : 'auto';
      dropdown.style.right = alignLeft ? 'auto' : '0';
      dropdown.style.top = openUpward ? 'auto' : 'calc(100% + 8px)';
      dropdown.style.bottom = openUpward ? 'calc(100% + 8px)' : 'auto';
      dropdown.style.transformOrigin = (openUpward ? 'bottom ' : 'top ') + (alignLeft ? 'left' : 'right');
      return;
    }

    var rect = moreBtn.getBoundingClientRect();
    var ddW = dropdown.offsetWidth || 180;

    // Align the dropdown's right edge with the more button's right edge
    var x = rect.right - ddW;
    var y = rect.bottom + 4;

    // Keep within viewport
    var maxX = window.innerWidth - ddW - 8;
    x = Math.max(8, Math.min(x, maxX));

    dropdown.style.left = Math.round(x) + 'px';
    dropdown.style.top = Math.round(y) + 'px';
  }

  /**
   * Show the secondary actions dropdown.
   * Re-checks editability state on open to sync Scout action visibility (dual guard §1).
   */
  function showDropdown(dropdown, moreBtn, scoutAction) {
    if (!dropdown || !moreBtn) return;
    syncScoutActionVisibility(scoutAction);
    dropdown.classList.remove(IS_HIDDEN_CLASS);
    dropdown.style.display = '';
    void dropdown.offsetWidth;
    dropdown.classList.add(IS_VISIBLE_CLASS);
    moreBtn.setAttribute('aria-expanded', 'true');
    positionDropdown(dropdown, moreBtn);
  }

  /**
   * Hide the secondary actions dropdown.
   */
  function hideDropdown(dropdown, moreBtn) {
    if (!dropdown) return;
    dropdown.classList.remove(IS_VISIBLE_CLASS);
    dropdown.classList.add(IS_HIDDEN_CLASS);
    dropdown.style.display = 'none';
    if (moreBtn) {
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Toggle the secondary actions dropdown.
   */
  function toggleDropdown(dropdown, moreBtn, e, scoutAction) {
    if (e) {
      e.stopPropagation();
    }
    if (dropdown && dropdown.classList.contains(IS_VISIBLE_CLASS)) {
      hideDropdown(dropdown, moreBtn);
    } else {
      showDropdown(dropdown, moreBtn, scoutAction);
    }
  }

  /**
   * Bind dropdown events: more button click, document click-outside,
   * and secondary action dispatch (delete, share, focus, scout).
   */
  function bindDropdownEvents(ctx) {
    var dropdown = ctx.dropdown;
    var moreBtn = ctx.moreBtn;
    var deleteAction = ctx.deleteAction;
    var shareAction = ctx.shareAction;
    var focusAction = ctx.focusAction;
    var scoutAction = ctx.scoutAction;

    // More button: toggle dropdown
    if (moreBtn) {
      moreBtn.addEventListener('click', function (e) {
        toggleDropdown(dropdown, moreBtn, e, scoutAction);
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!dropdown) return;
      if (dropdown.classList.contains(IS_VISIBLE_CLASS) &&
          !dropdown.contains(e.target) &&
          moreBtn && !moreBtn.contains(e.target)) {
        hideDropdown(dropdown, moreBtn);
      }
    });

    // Secondary action: delete
    if (deleteAction) {
      deleteAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown(dropdown, moreBtn);
        // Trigger delete confirmation via the existing delete button
        var deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        if (deleteMemoryBtn) {
          deleteMemoryBtn.click();
          return;
        }
        // Fallback: find any delete trigger
        var btn = document.querySelector('[data-action="delete-memory"]');
        if (btn) btn.click();
      });
    }

    // Secondary action: share / copy link
    if (shareAction) {
      shareAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown(dropdown, moreBtn);
        var shareBtn = document.getElementById('shareMemoryBtn');
        if (shareBtn) {
          shareBtn.click();
          return;
        }
        // Fallback: copy current URL
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(function () {});
        }
        if (window.LoveBudUI && window.LoveBudUI.showToast) {
          window.LoveBudUI.showToast('링크가 복사되었습니다', 'success', 1800);
        }
      });
    }

    // Secondary action: focus on selected moment
    if (focusAction) {
      focusAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown(dropdown, moreBtn);
        var focusBtn = document.getElementById('focusSelectedBtn');
        if (focusBtn) {
          focusBtn.click();
        }
      });
    }

    // Secondary action: Scout draft (manual entry)
    if (scoutAction) {
      scoutAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown(dropdown, moreBtn);
        // Dual guard §2: re-check editability immediately before opening Scout.
        // In read-only trees, LoveBudScoutDraftUI.open must NEVER be called.
        if (isEditorReadOnly()) {
          return;
        }
        if (window.LoveBudScoutDraftUI && window.LoveBudScoutDraftUI.open) {
          // Get the currently selected node ID from the context
          // ctx.selectedNode might be a function (getSelectedNodeEl) or an element
          var selectedNodeEl = ctx.selectedNode;
          if (typeof selectedNodeEl === 'function') {
            selectedNodeEl = selectedNodeEl();
          }
          var selectedId = selectedNodeEl ? (selectedNodeEl.dataset.id || selectedNodeEl.getAttribute('data-id')) : null;
          window.LoveBudScoutDraftUI.open(selectedId);
        }
      });
    }
  }

  /**
   * Bind dropdown events for the floating toolbar using toolbar element context.
   *
   * @param {Object} ctx
   * @param {HTMLElement} [ctx.dropdown]
   * @param {HTMLElement} [ctx.moreBtn]
   * @param {HTMLElement} [ctx.deleteAction]
   * @param {HTMLElement} [ctx.shareAction]
   * @param {HTMLElement} [ctx.focusAction]
   * @param {HTMLElement} [ctx.scoutAction]
   * @param {Function|HTMLElement} [ctx.selectedNode]
   */
  function bindToolbarDropdown(ctx) {
    if (!ctx) return;

    bindDropdownEvents({
      dropdown: ctx.dropdown,
      moreBtn: ctx.moreBtn,
      deleteAction: ctx.deleteAction,
      shareAction: ctx.shareAction,
      focusAction: ctx.focusAction,
      scoutAction: ctx.scoutAction,
      selectedNode: ctx.selectedNode
    });
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarDropdown = {
    show: function (dropdown, moreBtn, scoutAction) { showDropdown(dropdown, moreBtn, scoutAction); },
    hide: function (dropdown, moreBtn) { hideDropdown(dropdown, moreBtn); },
    toggle: function (dropdown, moreBtn, e, scoutAction) { toggleDropdown(dropdown, moreBtn, e, scoutAction); },
    bind: function (ctx) { bindDropdownEvents(ctx); },
    bindToolbarDropdown: bindToolbarDropdown,
    isEditorReadOnly: isEditorReadOnly,
    syncScoutActionVisibility: syncScoutActionVisibility
  };
})();
