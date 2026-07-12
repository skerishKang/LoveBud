/**
 * LoveBud Editor — Floating Toolbar Positioning Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides toolbar and quick-add positioning relative to the
 * selected memory node on the canvas.
 *
 * No behavior change.
 */

(function () {
  'use strict';

  var IS_HIDDEN = 'is-hidden';

  /**
   * Resolve the selected node in canvas coordinates. Bounding rectangles are
   * required here because structured layout, pan and zoom can all transform
   * the rendered node away from its raw inline left/top values.
   */
  function getSelectedNodePosition(ctx) {
    var selectedEl = (ctx && ctx.getSelectedNode) ? ctx.getSelectedNode() : null;
    if (!selectedEl) return null;

    var canvasArea = document.getElementById('canvasArea');
    if (canvasArea && selectedEl.getBoundingClientRect) {
      var nodeRect = selectedEl.getBoundingClientRect();
      var canvasRect = canvasArea.getBoundingClientRect();
      var renderedWidth = nodeRect.width || 88;
      var renderedHeight = nodeRect.height || 88;
      var renderedLeft = nodeRect.left - canvasRect.left;
      var renderedTop = nodeRect.top - canvasRect.top;

      return {
        left: renderedLeft,
        top: renderedTop,
        right: renderedLeft + renderedWidth,
        bottom: renderedTop + renderedHeight,
        width: renderedWidth,
        height: renderedHeight,
        centerX: renderedLeft + renderedWidth / 2,
        centerY: renderedTop + renderedHeight / 2
      };
    }

    var left = parseFloat(selectedEl.style.left) || 0;
    var top = parseFloat(selectedEl.style.top) || 0;
    var width = parseFloat(selectedEl.style.width) || 88;
    var height = parseFloat(selectedEl.style.height) || 88;

    return {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height,
      width: width,
      height: height,
      centerX: left + width / 2,
      centerY: top + height / 2
    };
  }

  /**
   * Position the toolbar relative to the selected node.
   * Anchors to top-right edge, with overflow handling.
   */
  function positionToolbar(ctx) {
    if (!ctx || !ctx.toolbar) return;

    var nodePos = getSelectedNodePosition(ctx);
    if (!nodePos) {
      if (ctx.onPositionFail) ctx.onPositionFail();
      return;
    }

    var canvasArea = document.getElementById('canvasArea');
    if (!canvasArea) return;

    var canvasWidth = canvasArea.clientWidth;
    var canvasHeight = canvasArea.clientHeight;
    var toolbar = ctx.toolbar;
    var toolbarWidth = toolbar.offsetWidth || 260;
    var toolbarHeight = toolbar.offsetHeight || 42;
    var gap = 10;
    var preferredX = nodePos.right + gap;
    var preferredY = nodePos.top;

    var x = preferredX;
    var y = preferredY;

    // Check if toolbar exceeds right edge
    if (x + toolbarWidth > canvasWidth - 8) {
      x = nodePos.left - gap - toolbarWidth;
    }

    // Check if toolbar exceeds top edge
    if (y < 8) {
      y = nodePos.bottom + gap;
      if (x + toolbarWidth > canvasWidth - 8) {
        x = nodePos.left - gap - toolbarWidth;
      }
    }

    // Check if toolbar exceeds bottom edge
    if (y + toolbarHeight > canvasHeight - 8) {
      if (y > canvasHeight - toolbarHeight - 8) {
        y = Math.max(8, canvasHeight - toolbarHeight - 8);
      }
    }

    // Ensure minimum visibility
    x = Math.max(4, Math.min(x, canvasWidth - toolbarWidth - 4));
    y = Math.max(4, Math.min(y, canvasHeight - toolbarHeight - 4));

    // Skip if position hasn't changed (optimization)
    if (Math.abs(x - ctx.lastX) < 1 && Math.abs(y - ctx.lastY) < 1 && toolbar.classList.contains(IS_HIDDEN) !== true) {
      return;
    }

    ctx.lastX = x;
    ctx.lastY = y;

    toolbar.style.left = Math.round(x) + 'px';
    toolbar.style.top = Math.round(y) + 'px';
  }

  /**
   * Position the quick-add affordance near the bottom-right of the selected node.
   */
  function positionQuickAdd(ctx) {
    if (!ctx || !ctx.quickAdd) return;
    var nodePos = getSelectedNodePosition(ctx);
    if (!nodePos) return;

    var x = nodePos.right - (ctx.quickAddOffset || 12);
    var y = nodePos.bottom - (ctx.quickAddOffset || 12);

    ctx.quickAdd.style.left = Math.round(x) + 'px';
    ctx.quickAdd.style.top = Math.round(y) + 'px';
  }

  /**
   * Schedule a position update for animations/transitions.
   */
  function scheduleUpdate(ctx) {
    if (!ctx) return;
    if (ctx.positionTimer) {
      clearTimeout(ctx.positionTimer);
    }
    var interval = ctx.pollInterval || 160;
    ctx.positionTimer = setTimeout(function () {
      ctx.positionTimer = null;
      if (ctx.toolbar && ctx.toolbar.classList.contains(IS_HIDDEN) !== true) {
        positionToolbar(ctx);
        if (ctx.quickAdd && ctx.quickAdd.classList.contains(IS_HIDDEN) !== true) {
          positionQuickAdd(ctx);
        }
      }
    }, interval);
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarPositioning = {
    getPosition: function (ctx) { return getSelectedNodePosition(ctx); },
    positionToolbar: function (ctx) { positionToolbar(ctx); },
    positionQuickAdd: function (ctx) { positionQuickAdd(ctx); },
    scheduleUpdate: function (ctx) { scheduleUpdate(ctx); }
  };
})();
