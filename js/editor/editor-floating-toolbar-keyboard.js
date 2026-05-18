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
        if (context.flashButton) context.flashButton(context.editBtn);
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
        if (context.flashButton) context.flashButton(context.continueBtn);
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
        if (context.flashButton) context.flashButton(context.viewBtn);
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
        if (context.moreBtn && context.flashButton) {
          context.flashButton(context.moreBtn);
        }
        context.deleteAction.click();
      } else {
        var deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        if (deleteMemoryBtn) {
          if (context.flashButton) context.flashButton(context.deleteAction);
          deleteMemoryBtn.click();
        }
      }
      return true;
    }

    return false;
  }

  // Export to global namespace
  window.LoveBudFloatingToolbarKeyboard = {
    handleShortcut: handleShortcut
  };

  console.log('[toolbar-keyboard] Initialized (Refs #1275)');
})();
