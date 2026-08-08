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

  // Idempotence guard: bind each dropdown's keyboard and trigger listeners once.
  var boundDropdowns = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  /**
   * Return only visible + enabled dropdown menu items. Hidden, aria-hidden,
   * disabled, aria-disabled, display:none, and .is-hidden items are excluded so
   * Scout/Fork and any read-only-hidden items never receive keyboard focus.
   */
  function isNavigableItem(item) {
    if (!item) return false;
    if (item.hasAttribute && item.hasAttribute('hidden')) return false;
    if (item.getAttribute && item.getAttribute('aria-hidden') === 'true') return false;
    if (item.disabled === true) return false;
    if (item.getAttribute && item.getAttribute('aria-disabled') === 'true') return false;
    if (item.style && item.style.display === 'none') return false;
    if (item.classList && item.classList.contains(IS_HIDDEN_CLASS)) return false;
    return true;
  }

  function getNavigableItems(dropdown) {
    if (!dropdown) return [];
    var nodes = dropdown.querySelectorAll('.editor-ftb-dropdown-item');
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isNavigableItem(nodes[i])) result.push(nodes[i]);
    }
    return result;
  }

  /**
   * Menu keyboard navigation contract: ArrowDown/ArrowUp (wrap), Home/End,
   * Escape (close + restore trigger), Tab/Shift+Tab (close without trap).
   * Focus progression targets visible enabled items only.
   */
  function handleDropdownKeydown(e, dropdown, moreBtn) {
    if (!dropdown || !dropdown.classList.contains(IS_VISIBLE_CLASS)) return;
    var items = getNavigableItems(dropdown);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      if (!items.length) return;
      var current = items.indexOf(document.activeElement);
      var next;
      if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
      else if (e.key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1;
      else if (e.key === 'Home') next = 0;
      else next = items.length - 1;
      if (items[next]) items[next].focus();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideDropdown(dropdown, moreBtn);
      if (moreBtn && typeof moreBtn.focus === 'function') moreBtn.focus();
      return;
    }

    if (e.key === 'Tab') {
      // Menu closes on Tab/Shift+Tab; focus is never trapped, prevented, or
      // forced back to the trigger — normal browser focus progression continues.
      hideDropdown(dropdown, moreBtn);
    }
  }

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

    // Idempotent initialization: binding the same dropdown twice must not
    // duplicate any listener. A re-created dropdown element binds fresh.
    if (boundDropdowns && dropdown) {
      if (boundDropdowns.has(dropdown)) return;
      boundDropdowns.add(dropdown);
    }

    // Menu keyboard navigation (Arrow/Home/End/Escape/Tab). Bound once per
    // dropdown; the keydown bubbles from a focused menuitem to #ftbDropdown.
    if (dropdown) {
      dropdown.addEventListener('keydown', function (e) {
        handleDropdownKeydown(e, dropdown, moreBtn);
      });
    }

    // More button: toggle dropdown
    if (moreBtn) {
      moreBtn.addEventListener('click', function (e) {
        var wasVisible = !!(dropdown && dropdown.classList.contains(IS_VISIBLE_CLASS));
        toggleDropdown(dropdown, moreBtn, e, scoutAction);
        // Keyboard activation (Enter/Space on a button yields a click with
        // detail 0): opening moves focus to the first navigable menuitem.
        if (!wasVisible && dropdown && dropdown.classList.contains(IS_VISIBLE_CLASS) && e && e.detail === 0) {
          var items = getNavigableItems(dropdown);
          if (items.length) items[0].focus();
        }
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
        // Focus the canonical trigger before opening so the modal lifecycle
        // stores #ftbMoreBtn (not a stale activeElement) as the restore target.
        if (moreBtn && typeof moreBtn.focus === 'function') {
          moreBtn.focus();
        }
        if (window.LoveBudScoutDraftUI && window.LoveBudScoutDraftUI.open) {
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
