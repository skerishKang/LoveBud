/**
 * LoveBud Editor — Floating Toolbar Action Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides action click-through helpers for the floating toolbar.
 * - editAction: triggers detail panel edit mode
 * - continueAction: triggers "continue from moment" flow
 * - viewAction: triggers moment detail view
 *
 * No behavior change. No CSS/HTML change. Pure delegation to existing buttons.
 */

(function () {
  'use strict';

  /**
   * Edit action: delegate to editMemoryBtn click.
   * Entry point: floating toolbar edit button or keyboard shortcut 'E'.
   */
  function toolbarEditAction() {
    var editMemoryBtn = document.getElementById('editMemoryBtn');
    if (editMemoryBtn) {
      editMemoryBtn.click();
      return;
    }
    // Fallback: log warning if target not found
    console.warn('[toolbar-actions] editMemoryBtn not found, edit may fail');
  }

  /**
   * Continue action: delegate to continueFromMomentBtn or addMemoryBtn click.
   * Entry point: floating toolbar continue button or keyboard shortcut 'C'.
   */
  function toolbarContinueAction() {
    var continueBtnDetail = document.getElementById('continueFromMomentBtn');
    if (continueBtnDetail) {
      continueBtnDetail.click();
      return;
    }
    // Fallback: use addMemoryBtn if continue button not found
    var addMemoryBtn = document.getElementById('addMemoryBtn');
    if (addMemoryBtn) {
      addMemoryBtn.click();
    }
  }

  /**
   * View action: delegate to viewMomentDetailBtn click.
   * Entry point: floating toolbar view button or keyboard shortcut 'V'.
   */
  function toolbarViewAction() {
    var viewDetailBtn = document.getElementById('viewMomentDetailBtn');
    if (viewDetailBtn) {
      viewDetailBtn.click();
    }
  }

  // Export to global namespace for use by editor-floating-toolbar.js
  window.LoveBudFloatingToolbarActions = {
    edit: toolbarEditAction,
    continue: toolbarContinueAction,
    view: toolbarViewAction
  };

  console.log('[toolbar-actions] Initialized (Refs #1275)');
})();