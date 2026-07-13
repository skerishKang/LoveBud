/**
 * LoveBud Editor — Floating Toolbar Visibility Rules
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 * Issue #3483 — Gate by owner interaction mode, selection, form, and layout
 * without blanket-hiding owner edit toolbar solely because layout is structured.
 */
(function () {
  'use strict';

  var DEFAULT_MOBILE_BREAKPOINT = 480;
  var DEFAULT_COMPACT_CLASS = 'is-compact';

  /**
   * Check if the floating toolbar should be visible based on contract §4 + #3483.
   */
  function shouldShow(ctx) {
    if (!ctx) return false;

    // Mobile <breakpoint: never show
    var breakpoint = ctx.mobileBreakpoint || DEFAULT_MOBILE_BREAKPOINT;
    if (window.innerWidth < breakpoint) return false;

    // Selected node guard
    var selectedEl = ctx.getSelectedNode ? ctx.getSelectedNode() : null;
    if (!selectedEl) return false;

    // Fail-closed: only explicit edit interaction mode may show the toolbar.
    // null / "" / unknown / view all hide authoring actions.
    var interactionMode = document.body.getAttribute('data-editor-interaction-mode');
    if (interactionMode !== 'edit') return false;

    // Public/read-only shell
    if (document.body.classList.contains('editor-readonly')) return false;

    // New-memory form active: hide conflicting canvas toolbar actions
    if (
      document.querySelector('.canvas-area.is-memory-form-open') ||
      document.querySelector('.editor-layout.is-memory-form-open')
    ) {
      return false;
    }

    // Check if detail panel edit mode is active (moment field editor open)
    var editMode = document.getElementById('detailEditMode');
    if (editMode && editMode.style.display !== 'none' && editMode.style.display !== '') return false;

    // Check if compact mode is active on the canvas toolbar
    var compactCls = ctx.compactClass || DEFAULT_COMPACT_CLASS;
    var canvasToolbar = document.querySelector('.editor-canvas-toolbar');
    if (canvasToolbar && canvasToolbar.classList.contains(compactCls)) return false;

    // Empty-tree guide visible: no selected authoring target
    var canvasEmptyGuide = document.getElementById('canvasEmptyGuide');
    if (canvasEmptyGuide && !canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden')) return false;

    // structured layout alone must NOT hide an otherwise eligible owner toolbar.
    return true;
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarVisibility = {
    shouldShow: shouldShow
  };
})();
