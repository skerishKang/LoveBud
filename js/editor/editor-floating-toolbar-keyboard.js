/**
 * LoveBud Editor — Floating Toolbar Keyboard Shortcut Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides keyboard shortcut dispatch for the floating toolbar.
 * - E shortcut -> edit action
 * - C shortcut -> continue action
 * - V shortcut -> view action
 * - Delete/Backspace -> delete confirmation
 *
 * No behavior change. No accessibility changes (roving focus, escape, etc.).
 */

(function () {
  'use strict';

  var flashTimer = null;

  /**
   * Flash a toolbar button for visual feedback after keyboard activation.
   *
   * @param {Element|null} btn - Toolbar button to flash
   */
  function flashButton(btn) {
    if (!btn) return;
    if (flashTimer) clearTimeout(flashTimer);
    btn.classList.add('flash-feedback');
    flashTimer = setTimeout(function () {
      btn.classList.remove('flash-feedback');
      flashTimer = null;
    }, 160);
  }

  /**
   * Handle global keyboard shortcuts for the floating toolbar.
   * Processes E, C, V, and Delete/Backspace keys when the toolbar is visible.
   *
   * @param {KeyboardEvent} e - The keydown event
   * @param {Object} context - Context containing state and element references
   * @returns {boolean} - True if the event was handled
   */
  function handleShortcut(e, context) {
    if (!context || !context.isVisible) return false;

    // Guard: Don't process if user is typing in an input field
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;

    var key = e.key;
    var actions = window.LoveBudFloatingToolbarActions;

    // E → Edit selected moment
    if (key === 'e' || key === 'E') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        flashButton(context.editBtn);
        // Prefer using action helper if available
        if (actions && actions.edit) {
          actions.edit();
        } else if (context.editBtn) {
          context.editBtn.click();
        }
        return true;
      }
    }

    // C → Continue from selected moment
    if (key === 'c' || key === 'C') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        flashButton(context.continueBtn);
        if (actions && actions.continue) {
          actions.continue();
        } else if (context.continueBtn) {
          context.continueBtn.click();
        }
        return true;
      }
    }

    // V → View selected moment detail
    if (key === 'v' || key === 'V') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        flashButton(context.viewBtn);
        if (actions && actions.view) {
          actions.view();
        } else if (context.viewBtn) {
          context.viewBtn.click();
        }
        return true;
      }
    }

    // Delete/Backspace → Show delete confirmation
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      // Trigger delete via the dropdown action button
      if (context.deleteAction) {
        // Flash the more button to indicate where to find the delete
        if (context.moreBtn) {
          flashButton(context.moreBtn);
        }
        context.deleteAction.click();
      } else {
        var deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        if (deleteMemoryBtn) {
          flashButton(context.deleteAction);
          deleteMemoryBtn.click();
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Bind toolbar-level keyboard navigation (Escape + arrow keys).
   * Extracted from editor-floating-toolbar.js (Issue #1275).
   *
   * @param {Object}   ctx
   * @param {Element}  ctx.toolbar        - Floating toolbar element
   * @param {Function} ctx.getSelectedNode- Returns selected node element or null
   * @param {Function} ctx.hideToolbar    - Hides the floating toolbar
   * @param {Element}  [ctx.dropdown]     - Dropdown element
   * @param {Element}  [ctx.moreBtn]      - More/overflow button element
   * @param {string}   [ctx.selectedClass]- Selected node CSS class (default: 'selected')
   */
  function bindToolbarNavigation(ctx) {
    if (!ctx || !ctx.toolbar) return;

    var selectedClass = ctx.selectedClass || 'selected';
    var btnSelector = '.editor-floating-toolbar-btn, .editor-ftb-more-btn';

    ctx.toolbar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // 1. Determine whether the open dropdown owns focus (restoration target).
        var dropdownEl = ctx.dropdown;
        var moreButton = ctx.moreBtn;
        var dropdownOwnedFocus = !!(dropdownEl && moreButton &&
          dropdownEl.classList.contains('is-visible') &&
          dropdownEl.contains(document.activeElement));

        // 2. Deselect the current node (bounded).
        var selectedEl = ctx.getSelectedNode ? ctx.getSelectedNode() : null;
        if (selectedEl) {
          selectedEl.classList.remove(selectedClass);
          selectedEl.blur();
        }

        // 3. Toolbar dismissal (controller's hideToolbar also hides the dropdown).
        if (ctx.hideToolbar) ctx.hideToolbar();

        // 4. Dropdown cleanup is independent of the optional canvas dispatch.
        if (window.LoveBudFloatingToolbarDropdown) {
          window.LoveBudFloatingToolbarDropdown.hide(ctx.dropdown, ctx.moreBtn);
        }

        // 5. Restore focus to the trigger when the dropdown owned focus.
        if (dropdownOwnedFocus && moreButton && typeof moreButton.focus === 'function') {
          moreButton.focus();
        }

        // 6. Optional canvas deselection dispatch — SVG-safe (dispatchEvent is
        //    available on SVGElement) and narrowly guarded so a failure can never
        //    interrupt dropdown cleanup or focus restoration.
        var canvasArea = document.getElementById('canvasArea');
        if (canvasArea) {
          var emptySpot = canvasArea.querySelector('.canvas-svg');
          if (emptySpot && typeof emptySpot.dispatchEvent === 'function') {
            try {
              emptySpot.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
            } catch (dispatchError) {
              // Bounded: the canvas deselection dispatch is optional.
            }
          }
        }
      }

      // Arrow keys: navigate between buttons
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        var next = e.target.nextElementSibling;
        if (next && (next.classList.contains('editor-floating-toolbar-btn') || next.classList.contains('editor-ftb-more-btn'))) {
          next.focus();
        } else {
          // Wrap to first
          var first = ctx.toolbar.querySelector(btnSelector);
          if (first) first.focus();
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        var prev = e.target.previousElementSibling;
        if (prev && (prev.classList.contains('editor-floating-toolbar-btn') || prev.classList.contains('editor-ftb-more-btn'))) {
          prev.focus();
        } else {
          // Wrap to last
          var buttons = ctx.toolbar.querySelectorAll(btnSelector);
          if (buttons.length) buttons[buttons.length - 1].focus();
        }
      }
    });
  }

  /**
   * Bind document-level keyboard shortcuts for the floating toolbar.
   *
   * @param {Object} ctx
   * @param {Element} ctx.toolbar
   * @param {string} ctx.visibleClass
   * @param {Element} ctx.editBtn
   * @param {Element} ctx.continueBtn
   * @param {Element} ctx.viewBtn
   * @param {Element} [ctx.moreBtn]
   * @param {Element} [ctx.deleteAction]
   */
  function bindDocumentShortcuts(ctx) {
    if (!ctx || !ctx.toolbar) return;

    document.addEventListener('keydown', function (e) {
      var context = {
        isVisible: ctx.toolbar && ctx.toolbar.classList.contains(ctx.visibleClass || 'is-visible'),
        editBtn: ctx.editBtn,
        continueBtn: ctx.continueBtn,
        viewBtn: ctx.viewBtn,
        moreBtn: ctx.moreBtn,
        deleteAction: ctx.deleteAction
      };

      handleShortcut(e, context);
    });
  }

  /**
   * Bind all keyboard-related handlers for the floating toolbar.
   *
   * @param {Object} ctx
   */
  function bind(ctx) {
    if (!ctx) return;
    bindDocumentShortcuts(ctx);
    bindToolbarNavigation(ctx);
  }

  // Export to global namespace
  window.LoveBudFloatingToolbarKeyboard = {
    handleShortcut: handleShortcut,
    bindDocumentShortcuts: bindDocumentShortcuts,
    bindToolbarNavigation: bindToolbarNavigation,
    bind: bind,
    flashButton: flashButton
  };

  console.log('[toolbar-keyboard] Initialized (Refs #1275)');
})();
