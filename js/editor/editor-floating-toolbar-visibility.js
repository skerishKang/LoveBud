/**
 * LoveBud Editor — Floating Toolbar Visibility Rules
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Determines whether the floating toolbar should be visible based on
 * the current editor state (layout, mode, viewport, selection).
 *
 * No behavior change.
 */
(function () {
  'use strict';

  var DEFAULT_MOBILE_BREAKPOINT = 480;
  var DEFAULT_COMPACT_CLASS = 'is-compact';

  /**
   * Check if the floating toolbar should be visible based on contract §4.
   */
  function shouldShow(ctx) {
    if (!ctx) return false;

    // Mobile <breakpoint: never show
    var breakpoint = ctx.mobileBreakpoint || DEFAULT_MOBILE_BREAKPOINT;
    if (window.innerWidth < breakpoint) return false;

    // Selected node guard
    var selectedEl = ctx.getSelectedNode ? ctx.getSelectedNode() : null;
    if (!selectedEl) return false;

    // Check if detail panel edit mode is active
    var editMode = document.getElementById('detailEditMode');
    if (editMode && editMode.style.display !== 'none' && editMode.style.display !== '') return false;

    // Check if compact mode is active on the canvas toolbar
    var compactCls = ctx.compactClass || DEFAULT_COMPACT_CLASS;
    var canvasToolbar = document.querySelector('.editor-canvas-toolbar');
    if (canvasToolbar && canvasToolbar.classList.contains(compactCls)) return false;

    // Check tree owner / auth context
    var canvasEmptyGuide = document.getElementById('canvasEmptyGuide');
    if (canvasEmptyGuide && !canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden')) return false;

    return true;
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarVisibility = {
    shouldShow: shouldShow
  };
})();
